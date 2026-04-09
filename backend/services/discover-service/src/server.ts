import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import { createVerifier } from "fast-jwt";
import { z } from "zod";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./config";
import { applyFiltersAndRank, buildRankingMetrics, parseFeedPreferences, parseUserGeoPoint } from "./ranking";
import { loadCandidatesByProfileIds, loadCandidatesFromSupabase } from "./candidates";
import type { FeedCandidate } from "./data";

const filterSchema = z
  .array(z.enum(["all", "nearby", "new", "online", "verified"]))
  .default(["all"]);

const swipeSchema = z.object({
  profileId: z.string().min(1),
  decision: z.enum(["like", "dislike", "superlike"]),
  feedCursor: z.string().min(1),
});

const rewindSchema = z.object({
  feedCursor: z.string().min(1),
});

const decideIncomingLikeSchema = z.object({
  action: z.enum(["like_back", "pass"]),
});

type DiscoverLikeStatus = "pending" | "matched" | "passed";
type DiscoverLikeRow = {
  id: string;
  liker_user_id: string;
  liked_user_id: string;
  status: DiscoverLikeStatus;
  was_superlike: boolean | null;
  hidden_by_shadowghost: boolean | null;
  created_at: string;
  matched_at: string | null;
  passed_at: string | null;
};

type UserSettingsRow = {
  shadow_ghost: boolean | null;
};

type EntitlementSnapshot = {
  planTier?: "free" | "essential" | "gold" | "platinum" | "elite";
  planExpiresAtIso?: string;
  shadowGhost?: {
    source: "shadowghost_item";
    expiresAtIso: string;
    enablePrivacy: boolean;
  };
};

type UserEntitlementRow = {
  entitlement_snapshot: EntitlementSnapshot | null;
};

type InternalJwtPayload = {
  sub: string;
  email?: string;
  role?: string;
};

const verifyInternalToken = createVerifier({
  key: env.INTERNAL_JWT_SECRET,
  algorithms: ["HS256"],
});

const dismissedByUser = new Map<string, string[]>();
const swipeHistoryByUser = new Map<string, string[]>();
const discoverCandidatesCache = new Map<
  string,
  { expiresAtMs: number; candidates: FeedCandidate[]; userGeoPointKey: string }
>();
let actorIdsCache = new Set<string>();
let actorIdsCacheLoadedAtMs = 0;

const supabaseAdminClient: SupabaseClient | null =
  env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE
    ? createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

const extractBearerToken = (request: FastifyRequest) => {
  const header = request.headers.authorization;
  if (!header) return null;
  const trimmed = header.trim();
  if (!trimmed.toLowerCase().startsWith("bearer ")) return null;
  const token = trimmed.slice(7).trim();
  return token.length > 0 ? token : null;
};

const resolveAuthenticatedUserId = (request: FastifyRequest, reply: FastifyReply) => {
  const token = extractBearerToken(request);
  if (!token) {
    reply.status(401);
    return null;
  }

  try {
    const payload = verifyInternalToken(token) as InternalJwtPayload;
    if (!payload?.sub || typeof payload.sub !== "string" || payload.sub.trim().length === 0) {
      reply.status(401);
      return null;
    }
    return payload.sub.trim();
  } catch {
    reply.status(401);
    return null;
  }
};

const isIsoActive = (value?: string | null) => {
  if (!value) return false;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) && ms > Date.now();
};

const resolveEntitlementPlanTier = (
  snapshot: EntitlementSnapshot | null | undefined,
): "free" | "essential" | "gold" | "platinum" | "elite" => {
  if (!snapshot?.planTier || !isIsoActive(snapshot.planExpiresAtIso)) return "free";
  return snapshot.planTier;
};

const canUseShadowGhost = (settings: UserSettingsRow | null, entitlement: UserEntitlementRow | null) => {
  if (!settings?.shadow_ghost) return false;
  const snapshot = entitlement?.entitlement_snapshot;
  const planTier = resolveEntitlementPlanTier(snapshot);
  if (planTier === "platinum" || planTier === "elite") return true;
  if (
    snapshot?.shadowGhost?.source === "shadowghost_item" &&
    isIsoActive(snapshot.shadowGhost.expiresAtIso)
  ) {
    return true;
  }
  return false;
};

const getUserShadowGhostState = async (userId: string): Promise<boolean> => {
  if (!supabaseAdminClient) return false;
  const [settingsResult, entitlementResult] = await Promise.all([
    supabaseAdminClient
      .from("settings")
      .select("shadow_ghost")
      .eq("user_id", userId)
      .maybeSingle(),
    supabaseAdminClient
      .from("user_entitlements")
      .select("entitlement_snapshot")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);
  const settings = (settingsResult.data ?? null) as UserSettingsRow | null;
  const entitlement = (entitlementResult.data ?? null) as UserEntitlementRow | null;
  return canUseShadowGhost(settings, entitlement);
};

const getUserPlanTier = async (userId: string): Promise<"free" | "essential" | "gold" | "platinum" | "elite"> => {
  if (!supabaseAdminClient) return "free";
  const entitlementResult = await supabaseAdminClient
    .from("user_entitlements")
    .select("entitlement_snapshot")
    .eq("user_id", userId)
    .maybeSingle();
  const entitlement = (entitlementResult.data ?? null) as UserEntitlementRow | null;
  return resolveEntitlementPlanTier(entitlement?.entitlement_snapshot);
};

const stableScore = (seed: string) =>
  [...seed].reduce((acc, char, index) => (acc + char.charCodeAt(0) * (index + 1)) % 1000, 0) % 100;

const refreshActorIdsCache = async (logger: ReturnType<typeof Fastify>["log"]) => {
  if (!supabaseAdminClient) return;

  const nowMs = Date.now();
  if (nowMs - actorIdsCacheLoadedAtMs < env.ACTOR_DISCOVER_MATCH_CACHE_TTL_SEC * 1000) return;

  const actorRegex = new RegExp(env.ACTOR_ENGINE_ACTOR_EMAIL_REGEX, "i");
  const actorIds = new Set<string>();
  let page = 1;
  const perPage = 200;

  while (true) {
    const result = await supabaseAdminClient.auth.admin.listUsers({ page, perPage });
    if (result.error) throw result.error;
    const users = result.data.users ?? [];
    for (const user of users) {
      if (typeof user.email === "string" && actorRegex.test(user.email)) {
        actorIds.add(user.id);
      }
    }
    if (users.length < perPage) break;
    page += 1;
  }

  actorIdsCache = actorIds;
  actorIdsCacheLoadedAtMs = nowMs;
  logger.debug({ actorCount: actorIds.size }, "discover.actor_cache_refreshed");
};

const isActorProfileId = async (profileId: string, logger: ReturnType<typeof Fastify>["log"]) => {
  try {
    await refreshActorIdsCache(logger);
  } catch (error) {
    logger.warn({ err: error }, "discover.actor_cache_refresh_failed");
  }
  return actorIdsCache.has(profileId);
};

const loadMatchedProfileIds = async (userId: string): Promise<Set<string>> => {
  if (!supabaseAdminClient) return new Set<string>();
  const result = await supabaseAdminClient
    .from("chat_conversations")
    .select("peer_profile_id")
    .eq("user_id", userId)
    .like("conversation_id", "match-%")
    .limit(2000);
  if (result.error) throw result.error;
  const ids = new Set<string>();
  for (const row of result.data ?? []) {
    const peer = (row as { peer_profile_id?: unknown }).peer_profile_id;
    if (typeof peer === "string" && peer.length > 0) ids.add(peer);
  }
  return ids;
};

const buildUserGeoPointKey = (geoPoint: { lat: number; lng: number } | null) =>
  geoPoint ? `${geoPoint.lat.toFixed(3)}:${geoPoint.lng.toFixed(3)}` : "none";

const loadDiscoverCandidatesCached = async (input: {
  userId: string;
  userGeoPoint: { lat: number; lng: number } | null;
  logger: ReturnType<typeof Fastify>["log"];
}): Promise<FeedCandidate[]> => {
  const nowMs = Date.now();
  const userGeoPointKey = buildUserGeoPointKey(input.userGeoPoint);
  const cached = discoverCandidatesCache.get(input.userId);
  if (cached && cached.expiresAtMs > nowMs && cached.userGeoPointKey === userGeoPointKey) {
    return cached.candidates;
  }

  const loaded = await loadCandidatesFromSupabase({
    currentUserId: input.userId,
    userGeoPoint: input.userGeoPoint,
    logger: input.logger,
  });

  discoverCandidatesCache.set(input.userId, {
    candidates: loaded,
    userGeoPointKey,
    expiresAtMs: nowMs + env.DISCOVER_CANDIDATES_CACHE_TTL_MS,
  });
  return loaded;
};

const toMatchConversationId = (userId: string, peerId: string) =>
  `match-${userId.slice(0, 8)}-${peerId.slice(0, 8)}`;

const upsertLikeRow = async (input: {
  likerUserId: string;
  likedUserId: string;
  wasSuperLike: boolean;
  hiddenByShadowGhost: boolean;
  nowIso: string;
}): Promise<DiscoverLikeRow | null> => {
  if (!supabaseAdminClient) return null;
  const result = await supabaseAdminClient
    .from("discover_likes")
    .upsert(
      {
        liker_user_id: input.likerUserId,
        liked_user_id: input.likedUserId,
        status: "pending",
        was_superlike: input.wasSuperLike,
        hidden_by_shadowghost: input.hiddenByShadowGhost,
        created_at: input.nowIso,
        updated_at: input.nowIso,
        passed_at: null,
      },
      { onConflict: "liker_user_id,liked_user_id" },
    )
    .select("*")
    .maybeSingle();
  if (result.error) throw result.error;
  return (result.data ?? null) as DiscoverLikeRow | null;
};

const upsertMatchConversationForUser = async (input: {
  userId: string;
  profileId: string;
  fromSuperLike: boolean;
  nowIso: string;
}) => {
  if (!supabaseAdminClient) return;
  const conversationId = toMatchConversationId(input.userId, input.profileId);
  const upsertConversation = await supabaseAdminClient.from("chat_conversations").upsert(
    {
      user_id: input.userId,
      conversation_id: conversationId,
      peer_profile_id: input.profileId,
      unread_count: 1,
      last_message_preview: input.fromSuperLike
        ? "This chat started from a SuperLike."
        : "New match. Say hello.",
      last_message_at: input.nowIso,
      relation_state: "active",
      relation_state_updated_at: input.nowIso,
      received_superlike_trace_at: input.fromSuperLike ? input.nowIso : null,
    },
    { onConflict: "user_id,conversation_id" },
  );
  if (upsertConversation.error) throw upsertConversation.error;

  const upsertWelcome = await supabaseAdminClient.from("chat_messages").upsert(
    {
      user_id: input.userId,
      message_id: `match-welcome-${input.profileId.slice(0, 8)}`,
      conversation_id: conversationId,
      sender_user_id: input.profileId,
      direction: "incoming",
      original_text: input.fromSuperLike
        ? "SuperLike landed. Want to chat tonight?"
        : "We matched. Nice to meet you!",
      translated: false,
      created_at: input.nowIso,
    },
    { onConflict: "user_id,message_id" },
  );
  if (upsertWelcome.error) throw upsertWelcome.error;
};

const createBidirectionalMatch = async (input: {
  userA: string;
  userB: string;
  fromSuperLikeByA: boolean;
  fromSuperLikeByB: boolean;
  nowIso: string;
}) => {
  if (!supabaseAdminClient) return;
  await Promise.all([
    upsertMatchConversationForUser({
      userId: input.userA,
      profileId: input.userB,
      fromSuperLike: input.fromSuperLikeByA,
      nowIso: input.nowIso,
    }),
    upsertMatchConversationForUser({
      userId: input.userB,
      profileId: input.userA,
      fromSuperLike: input.fromSuperLikeByB,
      nowIso: input.nowIso,
    }),
  ]);
};

const markLikePairMatched = async (input: {
  likerUserId: string;
  likedUserId: string;
  reciprocalLikerUserId: string;
  reciprocalLikedUserId: string;
  nowIso: string;
}) => {
  if (!supabaseAdminClient) return;
  const updateDirect = supabaseAdminClient
    .from("discover_likes")
    .update({
      status: "matched",
      matched_at: input.nowIso,
      updated_at: input.nowIso,
    })
    .eq("liker_user_id", input.likerUserId)
    .eq("liked_user_id", input.likedUserId);
  const updateReciprocal = supabaseAdminClient
    .from("discover_likes")
    .update({
      status: "matched",
      matched_at: input.nowIso,
      updated_at: input.nowIso,
    })
    .eq("liker_user_id", input.reciprocalLikerUserId)
    .eq("liked_user_id", input.reciprocalLikedUserId);
  const [direct, reciprocal] = await Promise.all([updateDirect, updateReciprocal]);
  if (direct.error) throw direct.error;
  if (reciprocal.error) throw reciprocal.error;
};

const readLikeRow = async (input: {
  likerUserId: string;
  likedUserId: string;
}): Promise<DiscoverLikeRow | null> => {
  if (!supabaseAdminClient) return null;
  const result = await supabaseAdminClient
    .from("discover_likes")
    .select("*")
    .eq("liker_user_id", input.likerUserId)
    .eq("liked_user_id", input.likedUserId)
    .maybeSingle();
  if (result.error) throw result.error;
  return (result.data ?? null) as DiscoverLikeRow | null;
};

export const buildServer = () => {
  const app = Fastify({ logger: true });

  app.register(cors, {
    origin: [env.APP_URL, "http://127.0.0.1:3000", "http://localhost:3000"],
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });

  app.get("/health", async () => ({
    status: "ok",
    service: "discover-service",
    timestamp: new Date().toISOString(),
  }));

  app.get("/discover/likes/incoming", async (request, reply) => {
    const userId = resolveAuthenticatedUserId(request, reply);
    if (!userId) {
      return { code: "UNAUTHORIZED", message: "Missing or invalid internal token." };
    }
    if (!supabaseAdminClient) {
      return {
        state: "empty",
        inventory: {
          unlocked: false,
          hiddenCount: 0,
          visibleLikes: [],
          iceBreaker: {
            eligibleLikesHiddenCount: 0,
            consumed: false,
          },
        },
      };
    }

    try {
      const likesResult = await supabaseAdminClient
        .from("discover_likes")
        .select("*")
        .eq("liked_user_id", userId)
        .in("status", ["pending", "matched"])
        .order("created_at", { ascending: false })
        .limit(250);
      if (likesResult.error) throw likesResult.error;
      const likesRows = (likesResult.data ?? []) as DiscoverLikeRow[];
      if (likesRows.length === 0) {
        return {
          state: "empty",
          inventory: {
            unlocked: false,
            hiddenCount: 0,
            visibleLikes: [],
            iceBreaker: {
              eligibleLikesHiddenCount: 0,
              consumed: false,
            },
          },
        };
      }

      const senderIds = [...new Set(likesRows.map((row) => row.liker_user_id))];
      const senderCards = await loadCandidatesByProfileIds({
        profileIds: senderIds,
        userGeoPoint: null,
        logger: app.log,
      });
      const senderMap = new Map(senderCards.map((entry) => [entry.id, entry]));
      const planTier = await getUserPlanTier(userId);
      const unlocked = planTier !== "free";
      const visibleSlice = unlocked ? likesRows : likesRows.slice(0, 4);

      const visibleLikes = visibleSlice.map((row) => {
        const sender = senderMap.get(row.liker_user_id);
        const profile = sender
          ? {
              id: sender.id,
              name: sender.name,
              age: sender.age,
              city: sender.city,
              distanceKm: sender.distanceKm,
              languages: sender.languages,
              bio: sender.bio,
              photos: sender.photos,
              compatibility: sender.compatibility,
              interests: sender.interests,
              online: sender.online,
              flags: sender.flags,
            }
          : {
              id: row.liker_user_id,
              name: "Profile",
              age: 24,
              city: "Moscow",
              distanceKm: 10,
              languages: ["English", "Russian"],
              bio: "",
              photos: ["/placeholder.svg"],
              compatibility: 70,
              interests: [],
              online: false,
              flags: {
                verifiedIdentity: false,
                premiumTier: "free" as const,
                hideAge: false,
                hideDistance: false,
                shadowGhost: false,
              },
            };

        return {
          id: row.id,
          profile,
          receivedAtIso: row.created_at,
          wasSuperLike: Boolean(row.was_superlike),
          state: row.status === "matched" ? "matched" : "pending_incoming_like",
          hiddenByShadowGhost: Boolean(row.hidden_by_shadowghost),
          blurredLocked: !unlocked,
        };
      });

      return {
        state: unlocked ? "unlocked" : "locked",
        inventory: {
          unlocked,
          hiddenCount: unlocked ? 0 : Math.max(0, likesRows.length - visibleSlice.length),
          visibleLikes,
          iceBreaker: {
            eligibleLikesHiddenCount: unlocked ? 0 : Math.max(0, likesRows.length - visibleSlice.length),
            consumed: false,
          },
        },
      };
    } catch (error) {
      app.log.error({ err: error, userId }, "discover.likes_incoming_failed");
      reply.status(500);
      return {
        code: "LIKES_INCOMING_FAILED",
      };
    }
  });

  app.post("/discover/likes/:likeId/decision", async (request, reply) => {
    const userId = resolveAuthenticatedUserId(request, reply);
    if (!userId) {
      return { code: "UNAUTHORIZED", message: "Missing or invalid internal token." };
    }
    if (!supabaseAdminClient) {
      reply.status(503);
      return { code: "DISCOVER_LIKES_UNAVAILABLE" };
    }
    const likeId = (request.params as { likeId?: string }).likeId?.trim();
    if (!likeId) {
      reply.status(400);
      return { code: "INVALID_PARAMS" };
    }
    const parsed = decideIncomingLikeSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.status(400);
      return { code: "INVALID_PAYLOAD" };
    }

    try {
      const incomingLikeResult = await supabaseAdminClient
        .from("discover_likes")
        .select("*")
        .eq("id", likeId)
        .eq("liked_user_id", userId)
        .maybeSingle();
      if (incomingLikeResult.error) throw incomingLikeResult.error;
      const incoming = (incomingLikeResult.data ?? null) as DiscoverLikeRow | null;
      if (!incoming) {
        reply.status(404);
        return { code: "LIKE_NOT_FOUND" };
      }

      const nowIso = new Date().toISOString();
      if (parsed.data.action === "pass") {
        const updateIncoming = await supabaseAdminClient
          .from("discover_likes")
          .update({
            status: "passed",
            passed_at: nowIso,
            updated_at: nowIso,
          })
          .eq("id", likeId);
        if (updateIncoming.error) throw updateIncoming.error;

        const updateOutgoing = await supabaseAdminClient
          .from("discover_likes")
          .update({
            status: "passed",
            passed_at: nowIso,
            updated_at: nowIso,
          })
          .eq("liker_user_id", userId)
          .eq("liked_user_id", incoming.liker_user_id)
          .in("status", ["pending", "matched"]);
        if (updateOutgoing.error) throw updateOutgoing.error;

        return {
          ok: true,
          likeId,
          status: "refused",
          matched: false,
        };
      }

      const hiddenByShadowGhost = await getUserShadowGhostState(userId);
      const outgoing = await upsertLikeRow({
        likerUserId: userId,
        likedUserId: incoming.liker_user_id,
        wasSuperLike: false,
        hiddenByShadowGhost,
        nowIso,
      });
      const reciprocal = await readLikeRow({
        likerUserId: incoming.liker_user_id,
        likedUserId: userId,
      });

      if (!outgoing || !reciprocal) {
        return {
          ok: true,
          likeId,
          status: "pending_incoming_like",
          matched: false,
        };
      }

      await markLikePairMatched({
        likerUserId: outgoing.liker_user_id,
        likedUserId: outgoing.liked_user_id,
        reciprocalLikerUserId: reciprocal.liker_user_id,
        reciprocalLikedUserId: reciprocal.liked_user_id,
        nowIso,
      });

      await createBidirectionalMatch({
        userA: userId,
        userB: incoming.liker_user_id,
        fromSuperLikeByA: Boolean(outgoing.was_superlike),
        fromSuperLikeByB: Boolean(reciprocal.was_superlike),
        nowIso,
      });

      const senderCards = await loadCandidatesByProfileIds({
        profileIds: [incoming.liker_user_id],
        userGeoPoint: null,
        logger: app.log,
      });
      const peerOnline = Boolean(senderCards[0]?.online);

      return {
        ok: true,
        likeId,
        status: "matched",
        matched: true,
        conversationId: toMatchConversationId(userId, incoming.liker_user_id),
        peerOnline,
      };
    } catch (error) {
      app.log.error({ err: error, userId, likeId }, "discover.like_decision_failed");
      reply.status(500);
      return { code: "LIKE_DECISION_FAILED" };
    }
  });

  app.get("/discover/feed", async (request, reply) => {
    const userId = resolveAuthenticatedUserId(request, reply);
    if (!userId) {
      return { code: "UNAUTHORIZED", message: "Missing or invalid internal token." };
    }
    const query = request.query as Record<string, string | undefined>;
    const raw = query.quickFilters ? query.quickFilters.split(",").filter(Boolean) : ["all"];
    const filters = filterSchema.parse(raw);
    const preferences = parseFeedPreferences(query);
    const userGeoPoint = parseUserGeoPoint(query);
    const dismissedProfileIds = new Set(dismissedByUser.get(userId) ?? []);
    try {
      const matchedProfileIds = await loadMatchedProfileIds(userId);
      for (const matchedId of matchedProfileIds) dismissedProfileIds.add(matchedId);
    } catch (error) {
      app.log.warn({ err: error, userId }, "discover.load_matched_profile_ids_failed");
    }
    const candidatesSource = await loadDiscoverCandidatesCached({
      userId,
      userGeoPoint,
      logger: app.log,
    });
    const candidates = applyFiltersAndRank(
      filters,
      preferences,
      userGeoPoint,
      dismissedProfileIds,
      candidatesSource,
    );

    return {
      window: {
        cursor: `cursor_${userId}_${Date.now()}`,
        candidates,
        quickFiltersApplied: filters,
        preferencesApplied: preferences,
      },
    };
  });

  app.get("/discover/metrics/ranking", async (request, reply) => {
    const userId = resolveAuthenticatedUserId(request, reply);
    if (!userId) {
      return { code: "UNAUTHORIZED", message: "Missing or invalid internal token." };
    }
    const query = request.query as Record<string, string | undefined>;
    const raw = query.quickFilters ? query.quickFilters.split(",").filter(Boolean) : ["all"];
    const filters = filterSchema.parse(raw);
    const preferences = parseFeedPreferences(query);
    const userGeoPoint = parseUserGeoPoint(query);
    const dismissedProfileIds = new Set(dismissedByUser.get(userId) ?? []);
    try {
      const matchedProfileIds = await loadMatchedProfileIds(userId);
      for (const matchedId of matchedProfileIds) dismissedProfileIds.add(matchedId);
    } catch (error) {
      app.log.warn({ err: error, userId }, "discover.load_matched_profile_ids_failed");
    }
    const candidatesSource = await loadDiscoverCandidatesCached({
      userId,
      userGeoPoint,
      logger: app.log,
    });
    const ranked = applyFiltersAndRank(
      filters,
      preferences,
      userGeoPoint,
      dismissedProfileIds,
      candidatesSource,
    );
    const topN = Number(query.topN ?? "20");
    const metrics = buildRankingMetrics(ranked, preferences, Number.isFinite(topN) ? topN : 20);

    return {
      metrics,
      quickFiltersApplied: filters,
      preferencesApplied: preferences,
      sampleSize: ranked.length,
    };
  });

  app.post("/discover/swipe", async (request, reply) => {
    const userId = resolveAuthenticatedUserId(request, reply);
    if (!userId) {
      return { code: "UNAUTHORIZED", message: "Missing or invalid internal token." };
    }
    const parsed = swipeSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.status(400);
      return { code: "INVALID_PAYLOAD", message: "Invalid swipe payload." };
    }

    const { profileId, decision } = parsed.data;
    const dismissed = dismissedByUser.get(userId) ?? [];
    if (!dismissed.includes(profileId)) {
      dismissed.push(profileId);
      dismissedByUser.set(userId, dismissed.slice(-400));
    }

    const history = swipeHistoryByUser.get(userId) ?? [];
    history.push(profileId);
    swipeHistoryByUser.set(userId, history.slice(-120));

    if (decision === "dislike") {
      return {
        matched: false,
      };
    }

    const nowIso = new Date().toISOString();
    let matched = false;
    let conversationId: string | undefined;

    if (supabaseAdminClient) {
      try {
        const hiddenByShadowGhost = await getUserShadowGhostState(userId);
        const outgoing = await upsertLikeRow({
          likerUserId: userId,
          likedUserId: profileId,
          wasSuperLike: decision === "superlike",
          hiddenByShadowGhost,
          nowIso,
        });

        const seed = `${userId}:${profileId}`;
        const deterministic = stableScore(seed);
        const matchedByScoring = decision === "superlike" ? deterministic >= 30 : deterministic >= 62;
        const matchedByActorAutoLike = await isActorProfileId(profileId, app.log);

        if (matchedByScoring || matchedByActorAutoLike) {
          const reciprocalShadowGhost = await getUserShadowGhostState(profileId);
          await upsertLikeRow({
            likerUserId: profileId,
            likedUserId: userId,
            wasSuperLike: false,
            hiddenByShadowGhost: reciprocalShadowGhost,
            nowIso,
          });
        }

        const reciprocal = await readLikeRow({
          likerUserId: profileId,
          likedUserId: userId,
        });

        if (outgoing && reciprocal && outgoing.status !== "passed" && reciprocal.status !== "passed") {
          await markLikePairMatched({
            likerUserId: outgoing.liker_user_id,
            likedUserId: outgoing.liked_user_id,
            reciprocalLikerUserId: reciprocal.liker_user_id,
            reciprocalLikedUserId: reciprocal.liked_user_id,
            nowIso,
          });
          await createBidirectionalMatch({
            userA: userId,
            userB: profileId,
            fromSuperLikeByA: Boolean(outgoing.was_superlike),
            fromSuperLikeByB: Boolean(reciprocal.was_superlike),
            nowIso,
          });
          matched = true;
          conversationId = toMatchConversationId(userId, profileId);
        }
      } catch (error) {
        app.log.warn({ err: error, userId, profileId }, "discover.persist_like_or_match_failed");
      }
    }

    return {
      matched,
      conversationId,
    };
  });

  app.post("/discover/rewind", async (request, reply) => {
    const userId = resolveAuthenticatedUserId(request, reply);
    if (!userId) {
      return { code: "UNAUTHORIZED", message: "Missing or invalid internal token." };
    }

    const parsed = rewindSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.status(400);
      return { code: "INVALID_PAYLOAD", message: "Invalid rewind payload." };
    }

    const history = swipeHistoryByUser.get(userId) ?? [];
    const restoredProfileId = history.pop();
    swipeHistoryByUser.set(userId, history);

    if (!restoredProfileId) {
      return { restoredProfileId: undefined, rewindsLeft: 0 };
    }

    const dismissed = dismissedByUser.get(userId) ?? [];
    dismissedByUser.set(
      userId,
      dismissed.filter((profileId) => profileId !== restoredProfileId),
    );

    return { restoredProfileId, rewindsLeft: 0 };
  });

  return app;
};
