import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import { createVerifier } from "fast-jwt";
import { z } from "zod";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./config";
import { applyFiltersAndRank, buildRankingMetrics, parseFeedPreferences, parseUserGeoPoint } from "./ranking";
import { loadCandidatesByProfileIds, loadCandidatesFromSupabase } from "./candidates";
import type { FeedCandidate } from "./data";
import { resolveImageAccessPolicy, type ImageAccessPolicy } from "./imageAccessPolicy";

const filterSchema = z
  .array(z.enum(["all", "nearby", "new", "online", "verified"]))
  .default(["all"]);

const swipeSchema = z.object({
  profileId: z.string().min(1),
  decision: z.enum(["like", "dislike"]),
  feedCursor: z.string().min(1),
  idempotencyKey: z.string().min(1).optional(),
});

const superLikeSendSchema = z.object({
  profileId: z.string().min(1),
  text: z.string().min(1),
  feedCursor: z.string().min(1).optional(),
  idempotencyKey: z.string().min(1),
});

const rewindSchema = z.object({
  feedCursor: z.string().min(1),
  idempotencyKey: z.string().min(1).optional(),
});

const feedResetSchema = z.object({
  quickFilters: filterSchema.optional().default(["all"]),
  ageMin: z.number().int().min(18).max(100).optional(),
  ageMax: z.number().int().min(18).max(100).optional(),
  distanceKm: z.number().int().min(1).max(500).optional(),
  genderPreference: z.enum(["men", "women", "everyone"]).optional(),
  intent: z.enum(["serieuse", "connexion", "decouverte", "verrai"]).nullable().optional(),
  interests: z.array(z.string().min(1)).max(30).optional(),
  launchCity: z.string().min(1).nullable().optional(),
  originCountry: z.string().min(1).nullable().optional(),
  userLanguages: z.array(z.string().min(1)).max(20).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

const boostActivateSchema = z.object({
  idempotencyKey: z.string().min(1).optional(),
});

const decideIncomingLikeSchema = z.object({
  action: z.enum(["like_back", "pass"]),
});

const outgoingLikesQuerySchema = z.object({
  status: z.enum(["pending", "matched", "passed", "all"]).optional().default("pending"),
});

type DiscoverLikeStatus = "pending" | "matched" | "passed";
type BoostAvailability = "active" | "available" | "out_of_tokens";
type BoostStatus = {
  active: boolean;
  activeUntilIso?: string;
  remainingSeconds: number;
  boostsLeft: number;
  availability: BoostAvailability;
  durationSeconds: number;
};
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
  balancesDelta?: {
    boostsLeft?: number;
    superlikesLeft?: number;
    rewindsLeft?: number;
    icebreakersLeft?: number;
  };
  shadowGhost?: {
    source: "shadowghost_item";
    expiresAtIso: string;
    enablePrivacy: boolean;
  };
};

type UserEntitlementRow = {
  entitlement_snapshot: EntitlementSnapshot | null;
};

type DiscoverFeedEventDecision = "like" | "dislike" | "superlike";

type DiscoverFeedEventRow = {
  user_id: string;
  profile_id: string;
  last_decision: DiscoverFeedEventDecision | null;
  seen_count: number | null;
};

type InternalJwtPayload = {
  sub: string;
  email?: string;
  role?: string;
};

type AuthUserLike = {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
  app_metadata?: Record<string, unknown> | null;
};

const verifyInternalToken = createVerifier({
  key: env.INTERNAL_JWT_SECRET,
  algorithms: ["HS256"],
});

const dismissedByUser = new Map<string, string[]>();
const swipeHistoryByUser = new Map<string, string[]>();
const consumptionIdempotencyCache = new Map<string, number>();
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

const BOOST_DURATION_SECONDS = 30 * 60;

const idempotencyKeyFromRequest = (request: FastifyRequest) => {
  const header = request.headers["x-idempotency-key"];
  if (typeof header === "string" && header.trim().length > 0) return header.trim();
  return undefined;
};

const isDuplicateKeyError = (error: unknown) => {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
  const message =
    "message" in error ? String((error as { message?: unknown }).message ?? "").toLowerCase() : "";
  return code === "23505" || message.includes("duplicate key");
};

const registerConsumptionIdempotency = async (input: {
  userId: string;
  idempotencyKey: string;
  action: "superlike" | "rewind" | "boost";
}): Promise<{ duplicate: boolean }> => {
  const cacheKey = `${input.userId}:${input.idempotencyKey}`;
  if (!supabaseAdminClient) {
    if (consumptionIdempotencyCache.has(cacheKey)) {
      return { duplicate: true };
    }
    consumptionIdempotencyCache.set(cacheKey, Date.now());
    if (consumptionIdempotencyCache.size > 2000) {
      const cutoff = Date.now() - 1000 * 60 * 60;
      for (const [key, ts] of consumptionIdempotencyCache.entries()) {
        if (ts < cutoff) consumptionIdempotencyCache.delete(key);
      }
    }
    return { duplicate: false };
  }

  const result = await supabaseAdminClient.from("entitlement_consumptions").insert({
    user_id: input.userId,
    idempotency_key: input.idempotencyKey,
    action: input.action,
  });
  if (result.error) {
    if (isDuplicateKeyError(result.error)) {
      return { duplicate: true };
    }
    throw result.error;
  }
  return { duplicate: false };
};

const consumeBalance = async (input: {
  userId: string;
  field: "superlikesLeft" | "rewindsLeft" | "boostsLeft";
  amount: number;
  action: "superlike" | "rewind" | "boost";
  idempotencyKey?: string;
}): Promise<{
  ok: boolean;
  duplicate: boolean;
  balancesLeft: number;
  snapshot: EntitlementSnapshot | null;
}> => {
  const snapshot = (await getUserEntitlementSnapshot(input.userId)) ?? {};
  const current = Math.max(0, snapshot.balancesDelta?.[input.field] ?? 0);
  if (current < input.amount) {
    return { ok: false, duplicate: false, balancesLeft: current, snapshot };
  }

  const key = input.idempotencyKey;
  if (key) {
    const idempotency = await registerConsumptionIdempotency({
      userId: input.userId,
      idempotencyKey: key,
      action: input.action,
    });
    if (idempotency.duplicate) {
      const latest = await getUserEntitlementSnapshot(input.userId);
      const latestLeft = Math.max(0, latest?.balancesDelta?.[input.field] ?? current);
      return {
        ok: true,
        duplicate: true,
        balancesLeft: latestLeft,
        snapshot: latest ?? snapshot,
      };
    }
  }

  const nextSnapshot: EntitlementSnapshot = {
    ...snapshot,
    balancesDelta: {
      ...(snapshot.balancesDelta ?? {}),
      [input.field]: Math.max(0, current - input.amount),
    },
  };
  await saveUserEntitlementSnapshot(input.userId, nextSnapshot);

  return {
    ok: true,
    duplicate: false,
    balancesLeft: Math.max(0, nextSnapshot.balancesDelta?.[input.field] ?? 0),
    snapshot: nextSnapshot,
  };
};

const resolveBoostStatus = (input: {
  boostsLeft: number;
  activeUntilIso?: string | null;
}): BoostStatus => {
  const nowMs = Date.now();
  const activeUntilMs = input.activeUntilIso ? new Date(input.activeUntilIso).getTime() : 0;
  const active = Boolean(input.activeUntilIso) && activeUntilMs > nowMs;
  const remainingSeconds = active ? Math.max(0, Math.floor((activeUntilMs - nowMs) / 1000)) : 0;
  const availability: BoostStatus["availability"] = active
    ? "active"
    : input.boostsLeft > 0
      ? "available"
      : "out_of_tokens";
  return {
    active,
    activeUntilIso: active ? input.activeUntilIso ?? undefined : undefined,
    remainingSeconds,
    boostsLeft: input.boostsLeft,
    availability,
    durationSeconds: BOOST_DURATION_SECONDS,
  };
};

const getUserBoostRow = async (userId: string) => {
  if (!supabaseAdminClient) return null;
  const result = await supabaseAdminClient
    .from("user_boosts")
    .select("active_until")
    .eq("user_id", userId)
    .maybeSingle();
  if (result.error) throw result.error;
  return result.data as { active_until: string | null } | null;
};

const setUserBoostActiveUntil = async (userId: string, activeUntilIso: string | null) => {
  if (!supabaseAdminClient) return;
  const { error } = await supabaseAdminClient.from("user_boosts").upsert(
    {
      user_id: userId,
      active_until: activeUntilIso,
    },
    { onConflict: "user_id" },
  );
  if (error) throw error;
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

const getUserEntitlementSnapshot = async (userId: string): Promise<EntitlementSnapshot | null> => {
  if (!supabaseAdminClient) return null;
  const result = await supabaseAdminClient
    .from("user_entitlements")
    .select("entitlement_snapshot")
    .eq("user_id", userId)
    .maybeSingle();
  if (result.error) throw result.error;
  const row = (result.data ?? null) as UserEntitlementRow | null;
  return row?.entitlement_snapshot ?? null;
};

const saveUserEntitlementSnapshot = async (userId: string, snapshot: EntitlementSnapshot) => {
  if (!supabaseAdminClient) return;
  const { error } = await supabaseAdminClient.from("user_entitlements").upsert(
    {
      user_id: userId,
      entitlement_snapshot: snapshot,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw error;
};

const getIceBreakersLeft = (snapshot: EntitlementSnapshot | null | undefined) =>
  Math.max(0, snapshot?.balancesDelta?.icebreakersLeft ?? 0);

const stableScore = (seed: string) =>
  [...seed].reduce((acc, char, index) => (acc + char.charCodeAt(0) * (index + 1)) % 1000, 0) % 100;

const toBool = (value: unknown) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true" || value === "1";
  return false;
};

const isActorUser = (user: AuthUserLike, actorRegex: RegExp) => {
  const email = typeof user.email === "string" ? user.email : "";
  if (actorRegex.test(email)) return true;

  const metadata = user.user_metadata ?? {};
  const appMetadata = user.app_metadata ?? {};

  const source = typeof metadata.source === "string" ? metadata.source.toLowerCase() : "";
  if (source.startsWith("seed_")) return true;

  if (toBool(metadata.actor) || toBool(metadata.is_actor)) return true;
  if (toBool(appMetadata.actor) || toBool(appMetadata.is_actor)) return true;

  return false;
};

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
      if (
        isActorUser(
          {
            id: user.id,
            email: user.email ?? undefined,
            user_metadata:
              user.user_metadata && typeof user.user_metadata === "object"
                ? (user.user_metadata as Record<string, unknown>)
                : null,
            app_metadata:
              user.app_metadata && typeof user.app_metadata === "object"
                ? (user.app_metadata as Record<string, unknown>)
                : null,
          },
          actorRegex,
        )
      ) {
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

const loadConversationProfileIds = async (userId: string): Promise<Set<string>> => {
  if (!supabaseAdminClient) return new Set<string>();
  // Only exclude real open direct conversations:
  // - relation is active
  // - non-match thread
  // - has at least one persisted message
  const directConversations = await supabaseAdminClient
    .from("chat_conversations")
    .select("conversation_id,peer_profile_id")
    .eq("user_id", userId)
    .eq("relation_state", "active")
    .not("conversation_id", "like", "match-%")
    .limit(5000);
  if (directConversations.error) throw directConversations.error;

  const conversationRows = (directConversations.data ?? []) as Array<{
    conversation_id?: unknown;
    peer_profile_id?: unknown;
  }>;
  if (conversationRows.length === 0) return new Set<string>();

  const conversationIds = conversationRows
    .map((row) => (typeof row.conversation_id === "string" ? row.conversation_id : null))
    .filter((value): value is string => Boolean(value));
  if (conversationIds.length === 0) return new Set<string>();

  const messageRows = await supabaseAdminClient
    .from("chat_messages")
    .select("conversation_id")
    .eq("user_id", userId)
    .in("conversation_id", conversationIds)
    .limit(10000);
  if (messageRows.error) throw messageRows.error;

  const conversationIdsWithMessages = new Set<string>();
  for (const row of messageRows.data ?? []) {
    const conversationId = (row as { conversation_id?: unknown }).conversation_id;
    if (typeof conversationId === "string" && conversationId.length > 0) {
      conversationIdsWithMessages.add(conversationId);
    }
  }

  const ids = new Set<string>();
  for (const row of conversationRows) {
    const conversationId = typeof row.conversation_id === "string" ? row.conversation_id : null;
    if (!conversationId || !conversationIdsWithMessages.has(conversationId)) continue;
    const peer = row.peer_profile_id;
    if (typeof peer === "string" && peer.length > 0) ids.add(peer);
  }
  return ids;
};

const loadSafetyExcludedProfileIds = async (
  userId: string,
): Promise<{ blockedByMe: Set<string>; reportedByMe: Set<string> }> => {
  if (!supabaseAdminClient) {
    return { blockedByMe: new Set<string>(), reportedByMe: new Set<string>() };
  }

  const [blocksResult, reportsResult] = await Promise.all([
    supabaseAdminClient
      .from("safety_blocks")
      .select("blocked_user_id")
      .eq("user_id", userId)
      .limit(5000),
    supabaseAdminClient
      .from("safety_reports")
      .select("reported_user_id")
      .eq("user_id", userId)
      .limit(5000),
  ]);

  if (blocksResult.error) throw blocksResult.error;
  if (reportsResult.error) throw reportsResult.error;

  const blockedByMe = new Set<string>();
  for (const row of blocksResult.data ?? []) {
    const blocked = (row as { blocked_user_id?: unknown }).blocked_user_id;
    if (typeof blocked === "string" && blocked.length > 0) blockedByMe.add(blocked);
  }

  const reportedByMe = new Set<string>();
  for (const row of reportsResult.data ?? []) {
    const reported = (row as { reported_user_id?: unknown }).reported_user_id;
    if (typeof reported === "string" && reported.length > 0) reportedByMe.add(reported);
  }

  return { blockedByMe, reportedByMe };
};

const parseResetFeedPreferences = (input: z.infer<typeof feedResetSchema>) =>
  parseFeedPreferences({
    ageMin: input.ageMin !== undefined ? String(input.ageMin) : undefined,
    ageMax: input.ageMax !== undefined ? String(input.ageMax) : undefined,
    distanceKm: input.distanceKm !== undefined ? String(input.distanceKm) : undefined,
    genderPreference: input.genderPreference,
    intent: input.intent ?? undefined,
    interests: input.interests?.join(","),
    launchCity: input.launchCity ?? undefined,
    originCountry: input.originCountry ?? undefined,
    userLanguages: input.userLanguages?.join(","),
  });

const parseResetUserGeoPoint = (input: z.infer<typeof feedResetSchema>) =>
  parseUserGeoPoint({
    lat: input.lat !== undefined ? String(input.lat) : undefined,
    lng: input.lng !== undefined ? String(input.lng) : undefined,
  });

const shuffleCandidates = (pool: FeedCandidate[]) => {
  const next = [...pool];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const current = next[index];
    next[index] = next[swapIndex];
    next[swapIndex] = current;
  }
  return next;
};

const resolveResetFeedComposition = (input: {
  rankedCandidates: FeedCandidate[];
  passedProfileIds: Set<string>;
  likedWithoutMatchProfileIds: Set<string>;
  preferredPassedProfileIds?: string[];
  preferredLikedWithoutMatchProfileIds?: string[];
  maxCount: number;
}) => {
  const freshPool: FeedCandidate[] = [];
  const passedPool: FeedCandidate[] = [];
  const likedWithoutMatchPool: FeedCandidate[] = [];

  for (const candidate of input.rankedCandidates) {
    if (input.likedWithoutMatchProfileIds.has(candidate.id)) {
      likedWithoutMatchPool.push(candidate);
      continue;
    }
    if (input.passedProfileIds.has(candidate.id)) {
      passedPool.push(candidate);
      continue;
    }
    freshPool.push(candidate);
  }

  const targetCount = Math.min(input.maxCount, input.rankedCandidates.length);
  const desiredFresh = Math.ceil(targetCount * 0.65);
  const desiredPassed = Math.floor(targetCount * 0.25);
  const desiredLiked = Math.floor(targetCount * 0.1);

  const nextCandidates: FeedCandidate[] = [];

  const shuffledFresh = shuffleCandidates(freshPool);
  const passedById = new Map(passedPool.map((candidate) => [candidate.id, candidate]));
  const likedById = new Map(likedWithoutMatchPool.map((candidate) => [candidate.id, candidate]));

  const prioritizedPassed: FeedCandidate[] = [];
  for (const profileId of input.preferredPassedProfileIds ?? []) {
    const candidate = passedById.get(profileId);
    if (!candidate) continue;
    prioritizedPassed.push(candidate);
    passedById.delete(profileId);
  }

  const prioritizedLiked: FeedCandidate[] = [];
  for (const profileId of input.preferredLikedWithoutMatchProfileIds ?? []) {
    const candidate = likedById.get(profileId);
    if (!candidate) continue;
    prioritizedLiked.push(candidate);
    likedById.delete(profileId);
  }

  const shuffledPassed = [...prioritizedPassed, ...shuffleCandidates([...passedById.values()])];
  const shuffledLiked = [...prioritizedLiked, ...shuffleCandidates([...likedById.values()])];

  nextCandidates.push(...shuffledFresh.slice(0, desiredFresh));
  nextCandidates.push(...shuffledPassed.slice(0, desiredPassed));
  nextCandidates.push(...shuffledLiked.slice(0, desiredLiked));

  if (nextCandidates.length < targetCount) {
    const remainder = [
      ...shuffledFresh.slice(desiredFresh),
      ...shuffledPassed.slice(desiredPassed),
      ...shuffledLiked.slice(desiredLiked),
    ];
    nextCandidates.push(...remainder.slice(0, targetCount - nextCandidates.length));
  }

  return {
    candidates: nextCandidates,
    pools: {
      fresh: freshPool.length,
      passed: passedPool.length,
      likedWithoutMatch: likedWithoutMatchPool.length,
    },
    composition: {
      fresh: nextCandidates.filter((candidate) => !input.passedProfileIds.has(candidate.id) && !input.likedWithoutMatchProfileIds.has(candidate.id)).length,
      passed: nextCandidates.filter((candidate) => input.passedProfileIds.has(candidate.id) && !input.likedWithoutMatchProfileIds.has(candidate.id)).length,
      likedWithoutMatch: nextCandidates.filter((candidate) => input.likedWithoutMatchProfileIds.has(candidate.id)).length,
    },
  };
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
    resolvePhotoAccess: () => resolveImageAccessPolicy("discover", "visible_standard"),
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

const toDirectConversationId = (userId: string, peerId: string) => `conv-${userId}-${peerId}`;

const ensureProfileExists = async (profileId: string): Promise<boolean> => {
  if (!supabaseAdminClient) return false;
  const result = await supabaseAdminClient
    .from("profiles")
    .select("user_id")
    .eq("user_id", profileId)
    .maybeSingle();
  if (result.error) throw result.error;
  return Boolean(result.data);
};

const upsertDirectConversationForUser = async (input: {
  userId: string;
  peerProfileId: string;
  conversationId: string;
  nowIso: string;
  previewText: string;
  unreadCount: number;
  receivedSuperLikeTraceAtIso?: string;
}) => {
  if (!supabaseAdminClient) return;
  const upsertConversation = await supabaseAdminClient.from("chat_conversations").upsert(
    {
      user_id: input.userId,
      conversation_id: input.conversationId,
      peer_profile_id: input.peerProfileId,
      unread_count: input.unreadCount,
      last_message_preview: input.previewText,
      last_message_at: input.nowIso,
      relation_state: "active",
      relation_state_updated_at: input.nowIso,
      received_superlike_trace_at: input.receivedSuperLikeTraceAtIso ?? null,
    },
    { onConflict: "user_id,conversation_id" },
  );
  if (upsertConversation.error) throw upsertConversation.error;
};

const insertDirectMessageForUser = async (input: {
  userId: string;
  conversationId: string;
  senderUserId: string;
  direction: "incoming" | "outgoing";
  text: string;
  nowIso: string;
  messageId: string;
}) => {
  if (!supabaseAdminClient) return;
  const insertResult = await supabaseAdminClient.from("chat_messages").upsert(
    {
      user_id: input.userId,
      message_id: input.messageId,
      conversation_id: input.conversationId,
      sender_user_id: input.senderUserId,
      direction: input.direction,
      original_text: input.text,
      translated: false,
      created_at: input.nowIso,
    },
    { onConflict: "user_id,message_id" },
  );
  if (insertResult.error) throw insertResult.error;
};

const rollbackConsumedSuperLike = async (userId: string) => {
  const snapshot = (await getUserEntitlementSnapshot(userId)) ?? {};
  const current = Math.max(0, snapshot.balancesDelta?.superlikesLeft ?? 0);
  const restoredSnapshot: EntitlementSnapshot = {
    ...snapshot,
    balancesDelta: {
      ...(snapshot.balancesDelta ?? {}),
      superlikesLeft: current + 1,
    },
  };
  await saveUserEntitlementSnapshot(userId, restoredSnapshot);
  return Math.max(0, restoredSnapshot.balancesDelta?.superlikesLeft ?? 0);
};

const upsertDiscoverFeedEvent = async (input: {
  userId: string;
  profileId: string;
  decision: DiscoverFeedEventDecision;
  feedCursor: string;
}) => {
  if (!supabaseAdminClient) return;
  const nowIso = new Date().toISOString();
  const existing = await supabaseAdminClient
    .from("discover_feed_events")
    .select("seen_count")
    .eq("user_id", input.userId)
    .eq("profile_id", input.profileId)
    .maybeSingle();
  if (existing.error) throw existing.error;

  const currentSeen = Math.max(0, Number((existing.data as { seen_count?: unknown } | null)?.seen_count ?? 0));
  const upsert = await supabaseAdminClient
    .from("discover_feed_events")
    .upsert(
      {
        user_id: input.userId,
        profile_id: input.profileId,
        first_seen_at: nowIso,
        last_seen_at: nowIso,
        last_swiped_at: nowIso,
        last_decision: input.decision,
        seen_count: Math.max(1, currentSeen + 1),
        last_feed_cursor: input.feedCursor,
        updated_at: nowIso,
      },
      { onConflict: "user_id,profile_id" },
    );
  if (upsert.error) throw upsert.error;
};

const loadDiscoverFeedEventsByProfileIds = async (input: {
  userId: string;
  profileIds: string[];
}): Promise<DiscoverFeedEventRow[]> => {
  if (!supabaseAdminClient || input.profileIds.length === 0) return [];
  const result = await supabaseAdminClient
    .from("discover_feed_events")
    .select("user_id,profile_id,last_decision,seen_count")
    .eq("user_id", input.userId)
    .in("profile_id", input.profileIds)
    .limit(8000);
  if (result.error) throw result.error;
  return (result.data ?? []) as DiscoverFeedEventRow[];
};

const loadPendingLikedWithoutMatchProfileIds = async (input: {
  userId: string;
  profileIds: string[];
}): Promise<string[]> => {
  if (!supabaseAdminClient || input.profileIds.length === 0) return [];
  const result = await supabaseAdminClient
    .from("discover_likes")
    .select("liked_user_id,status,updated_at")
    .eq("liker_user_id", input.userId)
    .eq("status", "pending")
    .in("liked_user_id", input.profileIds)
    .order("updated_at", { ascending: false })
    .limit(5000);
  if (result.error) throw result.error;
  const ids: string[] = [];
  const dedupe = new Set<string>();
  for (const row of result.data ?? []) {
    const likedUserId = (row as { liked_user_id?: unknown }).liked_user_id;
    if (typeof likedUserId !== "string" || likedUserId.length === 0) continue;
    if (dedupe.has(likedUserId)) continue;
    dedupe.add(likedUserId);
    ids.push(likedUserId);
  }
  return ids;
};

const loadPassedProfileIdsFromLikes = async (input: {
  userId: string;
  profileIds: string[];
}): Promise<string[]> => {
  if (!supabaseAdminClient || input.profileIds.length === 0) return [];
  const result = await supabaseAdminClient
    .from("discover_likes")
    .select("liked_user_id,status,passed_at,updated_at")
    .eq("liker_user_id", input.userId)
    .eq("status", "passed")
    .in("liked_user_id", input.profileIds)
    .order("passed_at", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false })
    .limit(5000);
  if (result.error) throw result.error;
  const ids: string[] = [];
  const dedupe = new Set<string>();
  for (const row of result.data ?? []) {
    const likedUserId = (row as { liked_user_id?: unknown }).liked_user_id;
    if (typeof likedUserId !== "string" || likedUserId.length === 0) continue;
    if (dedupe.has(likedUserId)) continue;
    dedupe.add(likedUserId);
    ids.push(likedUserId);
  }
  return ids;
};

const loadOutgoingLikes = async (input: {
  userId: string;
  status: "pending" | "matched" | "passed" | "all";
}): Promise<DiscoverLikeRow[]> => {
  if (!supabaseAdminClient) return [];

  const query = supabaseAdminClient
    .from("discover_likes")
    .select("*")
    .eq("liker_user_id", input.userId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(500);

  const result =
    input.status === "all"
      ? await query
      : await query.eq("status", input.status);

  if (result.error) throw result.error;
  return (result.data ?? []) as DiscoverLikeRow[];
};

const upsertLikeRow = async (input: {
  likerUserId: string;
  likedUserId: string;
  wasSuperLike: boolean;
  hiddenByShadowGhost: boolean;
  nowIso: string;
}): Promise<DiscoverLikeRow | null> => {
  if (!supabaseAdminClient) return null;
  const existing = await readLikeRow({
    likerUserId: input.likerUserId,
    likedUserId: input.likedUserId,
  });
  const wasSuperLike = Boolean(existing?.was_superlike) || input.wasSuperLike;
  const hiddenByShadowGhost = Boolean(existing?.hidden_by_shadowghost) || input.hiddenByShadowGhost;
  const result = await supabaseAdminClient
    .from("discover_likes")
    .upsert(
      {
        liker_user_id: input.likerUserId,
        liked_user_id: input.likedUserId,
        status: "pending",
        was_superlike: wasSuperLike,
        hidden_by_shadowghost: hiddenByShadowGhost,
        created_at: existing?.created_at ?? input.nowIso,
        updated_at: input.nowIso,
        passed_at: null,
        matched_at: null,
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

const isMissingDiscoverLikeUnlocksTableError = (error: unknown) => {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
  const message =
    "message" in error ? String((error as { message?: unknown }).message ?? "").toLowerCase() : "";
  return code === "PGRST205" || code === "42P01" || message.includes("discover_like_unlocks");
};

const loadIceBreakerUnlockedLikeIds = async (userId: string): Promise<Set<string>> => {
  if (!supabaseAdminClient) return new Set<string>();
  const result = await supabaseAdminClient
    .from("discover_like_unlocks")
    .select("like_id")
    .eq("user_id", userId)
    .limit(1000);
  if (result.error) {
    if (isMissingDiscoverLikeUnlocksTableError(result.error)) {
      return new Set<string>();
    }
    throw result.error;
  }
  return new Set(
    (result.data ?? [])
      .map((row) => (row as { like_id?: unknown }).like_id)
      .filter((value): value is string => typeof value === "string" && value.length > 0),
  );
};

export const buildServer = () => {
  const app = Fastify({ logger: true });

  app.register(cors, {
    origin: [env.APP_URL, "http://127.0.0.1:3000", "http://localhost:3000"],
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
    // Discover client sends this header for swipe/rewind/boost idempotency.
    allowedHeaders: ["Content-Type", "Authorization", "X-Idempotency-Key"],
  });

  app.get("/health", async () => ({
    status: "ok",
    service: "discover-service",
    timestamp: new Date().toISOString(),
  }));

  app.get("/discover/likes/incoming", async (request, reply) => {
    const routeStartMs = performance.now();
    const timing: Record<string, number> = {};
    const mark = (key: string, fromMs: number) => {
      timing[key] = Number((performance.now() - fromMs).toFixed(2));
    };
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
            ownedCount: 0,
            canUse: false,
            unlockedCount: 0,
          },
        },
      };
    }

    try {
      const entAndLikesStartMs = performance.now();
      const [entitlementSnapshot, likesResult] = await Promise.all([
        getUserEntitlementSnapshot(userId),
        supabaseAdminClient
          .from("discover_likes")
          .select("*")
          .eq("liked_user_id", userId)
          .in("status", ["pending", "matched"])
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .limit(2000),
      ]);
      mark("entitlement_plus_likes_query_ms", entAndLikesStartMs);

      const planAndStockStartMs = performance.now();
      const planTier = resolveEntitlementPlanTier(entitlementSnapshot);
      const ownedIceBreakers = getIceBreakersLeft(entitlementSnapshot);
      mark("entitlement_compute_ms", planAndStockStartMs);
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
              ownedCount: getIceBreakersLeft(entitlementSnapshot),
              canUse: false,
              unlockedCount: 0,
            },
          },
        };
      }

      const policyBuildStartMs = performance.now();
      const unlockedByPlan = planTier !== "free";
      let unlockedByIceBreaker = new Set<string>();
      if (!unlockedByPlan) {
        const unlocksLoadStartMs = performance.now();
        unlockedByIceBreaker = await loadIceBreakerUnlockedLikeIds(userId);
        mark("icebreaker_unlocks_query_ms", unlocksLoadStartMs);
      } else {
        timing.icebreaker_unlocks_query_ms = 0;
      }
      const senderIds = [...new Set(likesRows.map((row) => row.liker_user_id))];
      const photoPolicyByProfile = new Map<string, ImageAccessPolicy>();
      const mergePolicy = (current: ImageAccessPolicy | undefined, next: ImageAccessPolicy) =>
        current === "signed_private" || next === "signed_private" ? "signed_private" : "public_stable";
      for (const row of likesRows) {
        let state: "locked_free" | "shadowghost_active" | "visible_by_entitlement" | "unlocked_icebreaker" | "unlockable_icebreaker" = "locked_free";
        if (row.hidden_by_shadowghost) {
          state = "shadowghost_active";
        } else if (unlockedByPlan) {
          state = "visible_by_entitlement";
        } else if (unlockedByIceBreaker.has(row.id)) {
          state = "unlocked_icebreaker";
        } else if (ownedIceBreakers > 0) {
          state = "unlockable_icebreaker";
        }
        // Likes locked/ghost cards intentionally use real blurred previews:
        // use public stable preview URLs to avoid signed-url fanout latency.
        const policy =
          state === "locked_free" || state === "unlockable_icebreaker" || state === "shadowghost_active"
            ? ("public_stable" as ImageAccessPolicy)
            : resolveImageAccessPolicy("likes", state);
        const existing = photoPolicyByProfile.get(row.liker_user_id);
        photoPolicyByProfile.set(row.liker_user_id, mergePolicy(existing, policy));
      }
      mark("policy_build_ms", policyBuildStartMs);

      const senderCardsStartMs = performance.now();
      const senderCards = await loadCandidatesByProfileIds({
        profileIds: senderIds,
        userGeoPoint: null,
        logger: app.log,
        includeBoostStatus: false,
        photoProbeMode: "off",
        source: "likes_incoming",
        resolvePhotoAccess: (profileId) =>
          photoPolicyByProfile.get(profileId) ?? resolveImageAccessPolicy("likes", "locked_free"),
      });
      mark("load_sender_cards_ms", senderCardsStartMs);
      const senderMap = new Map(senderCards.map((entry) => [entry.id, entry]));
      const visibleSlice = likesRows;

      const payloadComposeStartMs = performance.now();
      const visibleLikes = visibleSlice.map((row) => {
        const sender = senderMap.get(row.liker_user_id);
        const hiddenByShadowGhost =
          Boolean(row.hidden_by_shadowghost) &&
          (sender ? Boolean(sender.flags.shadowGhost) : true);
        const unlockedByItem = unlockedByIceBreaker.has(row.id);
        const blurredLocked = !(unlockedByPlan || unlockedByItem);
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
          hiddenByShadowGhost,
          blurredLocked,
        };
      });
      const hiddenCount = visibleLikes.filter((entry) => entry.blurredLocked).length;
      const unlocked = hiddenCount === 0;
      mark("payload_compose_ms", payloadComposeStartMs);
      timing.total_ms = Number((performance.now() - routeStartMs).toFixed(2));
      app.log.info(
        {
          userId,
          likesCount: likesRows.length,
          senderCount: senderIds.length,
          hiddenCount,
          unlockedByPlan,
          ownedIceBreakers,
          timings: timing,
        },
        "discover.likes_incoming_timing",
      );

      return {
        state: unlocked ? "unlocked" : "locked",
        inventory: {
          unlocked,
          hiddenCount,
          visibleLikes,
          iceBreaker: {
            eligibleLikesHiddenCount: hiddenCount,
            ownedCount: ownedIceBreakers,
            canUse: ownedIceBreakers > 0 && hiddenCount > 0,
            unlockedCount: unlockedByIceBreaker.size,
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

  app.get("/discover/likes/outgoing", async (request, reply) => {
    const userId = resolveAuthenticatedUserId(request, reply);
    if (!userId) {
      return { code: "UNAUTHORIZED", message: "Missing or invalid internal token." };
    }
    if (!supabaseAdminClient) {
      return { state: "empty", likes: [] };
    }

    const parsed = outgoingLikesQuerySchema.safeParse(request.query ?? {});
    if (!parsed.success) {
      reply.status(400);
      return { code: "INVALID_QUERY", message: "Invalid outgoing likes query." };
    }

    try {
      const likesRows = await loadOutgoingLikes({
        userId,
        status: parsed.data.status,
      });

      if (likesRows.length === 0) {
        return {
          state: "empty",
          likes: [],
        };
      }

      const profileIds = [...new Set(likesRows.map((row) => row.liked_user_id))];
      const profileCards = await loadCandidatesByProfileIds({
        profileIds,
        userGeoPoint: null,
        logger: app.log,
        includeBoostStatus: false,
        photoProbeMode: "off",
        source: "likes_outgoing",
        resolvePhotoAccess: () => resolveImageAccessPolicy("likes", "visible_by_entitlement"),
      });
      const profileById = new Map(profileCards.map((profile) => [profile.id, profile]));

      const likes = likesRows
        .map((row) => {
          const profile = profileById.get(row.liked_user_id);
          if (!profile) return null;
          return {
            id: row.id,
            profile,
            sentAtIso: row.created_at,
            status: row.status,
            wasSuperLike: Boolean(row.was_superlike),
            hiddenByShadowGhost: Boolean(row.hidden_by_shadowghost),
          };
        })
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

      return {
        state: likes.length === 0 ? "empty" : "ready",
        likes,
      };
    } catch (error) {
      app.log.error({ err: error, userId }, "discover.likes_outgoing_failed");
      reply.status(500);
      return { code: "LIKES_OUTGOING_FAILED" };
    }
  });

  app.post("/discover/likes/:likeId/icebreaker/use", async (request, reply) => {
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

    try {
      const entitlementSnapshot = (await getUserEntitlementSnapshot(userId)) ?? {};
      const currentLeft = getIceBreakersLeft(entitlementSnapshot);
      const planTier = resolveEntitlementPlanTier(entitlementSnapshot);

      const targetLikeResult = await supabaseAdminClient
        .from("discover_likes")
        .select("id,hidden_by_shadowghost,status")
        .eq("id", likeId)
        .eq("liked_user_id", userId)
        .in("status", ["pending", "matched"])
        .maybeSingle();
      if (targetLikeResult.error) throw targetLikeResult.error;
      const targetLike = targetLikeResult.data as
        | { id: string; hidden_by_shadowghost: boolean | null; status: DiscoverLikeStatus }
        | null;
      if (!targetLike) {
        reply.status(404);
        return { code: "LIKE_NOT_FOUND" };
      }

      if (planTier !== "free") {
        reply.status(409);
        return { code: "ICEBREAKER_NOT_REQUIRED_PLAN_UNLOCKED" };
      }

      const existingUnlockResult = await supabaseAdminClient
        .from("discover_like_unlocks")
        .select("id")
        .eq("user_id", userId)
        .eq("like_id", likeId)
        .maybeSingle();
      if (existingUnlockResult.error) {
        if (isMissingDiscoverLikeUnlocksTableError(existingUnlockResult.error)) {
          reply.status(503);
          return { code: "ICEBREAKER_UNLOCKS_TABLE_MISSING" };
        }
        throw existingUnlockResult.error;
      }
      if (existingUnlockResult.data?.id) {
        reply.status(409);
        return { code: "ICEBREAKER_ALREADY_UNLOCKED" };
      }

      if (currentLeft <= 0) {
        reply.status(409);
        return { code: "ICEBREAKER_EMPTY" };
      }

      const unlockInsert = await supabaseAdminClient.from("discover_like_unlocks").insert({
        user_id: userId,
        like_id: likeId,
        unlock_method: "icebreaker",
        consumed_item_id: "instant-icebreaker",
      });
      if (unlockInsert.error) {
        if (isMissingDiscoverLikeUnlocksTableError(unlockInsert.error)) {
          reply.status(503);
          return { code: "ICEBREAKER_UNLOCKS_TABLE_MISSING" };
        }
        throw unlockInsert.error;
      }

      const nextSnapshot: EntitlementSnapshot = {
        ...entitlementSnapshot,
        balancesDelta: {
          ...(entitlementSnapshot.balancesDelta ?? {}),
          icebreakersLeft: Math.max(0, currentLeft - 1),
        },
      };
      await saveUserEntitlementSnapshot(userId, nextSnapshot);

      const likesPayload = await app.inject({
        method: "GET",
        url: "/discover/likes/incoming",
        headers: {
          authorization: request.headers.authorization ?? "",
        },
      });
      if (likesPayload.statusCode >= 400) {
        reply.status(500);
        return { code: "ICEBREAKER_REFRESH_FAILED" };
      }
      const parsedPayload = JSON.parse(likesPayload.payload) as {
        state: "loading" | "empty" | "locked" | "unlocked" | "error";
        inventory: {
          unlocked: boolean;
          hiddenCount: number;
          visibleLikes: unknown[];
          iceBreaker: {
            eligibleLikesHiddenCount: number;
            ownedCount: number;
            canUse: boolean;
            unlockedCount: number;
          };
        };
      };

      return {
        ok: true,
        state: parsedPayload.state,
        inventory: parsedPayload.inventory,
      };
    } catch (error) {
      app.log.error({ err: error, userId }, "discover.likes_icebreaker_use_failed");
      reply.status(500);
      return {
        code: "ICEBREAKER_USE_FAILED",
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
        resolvePhotoAccess: () => resolveImageAccessPolicy("messages", "pending"),
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
    const hardExcludedProfileIds = new Set(dismissedByUser.get(userId) ?? []);
    try {
      const matchedProfileIds = await loadMatchedProfileIds(userId);
      for (const matchedId of matchedProfileIds) hardExcludedProfileIds.add(matchedId);
      const conversationProfileIds = await loadConversationProfileIds(userId);
      for (const profileId of conversationProfileIds) hardExcludedProfileIds.add(profileId);
      const safety = await loadSafetyExcludedProfileIds(userId);
      for (const profileId of safety.blockedByMe) hardExcludedProfileIds.add(profileId);
      for (const profileId of safety.reportedByMe) hardExcludedProfileIds.add(profileId);
    } catch (error) {
      app.log.warn({ err: error, userId }, "discover.load_hard_exclusions_failed");
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
      hardExcludedProfileIds,
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
    const hardExcludedProfileIds = new Set(dismissedByUser.get(userId) ?? []);
    try {
      const matchedProfileIds = await loadMatchedProfileIds(userId);
      for (const matchedId of matchedProfileIds) hardExcludedProfileIds.add(matchedId);
      const conversationProfileIds = await loadConversationProfileIds(userId);
      for (const profileId of conversationProfileIds) hardExcludedProfileIds.add(profileId);
      const safety = await loadSafetyExcludedProfileIds(userId);
      for (const profileId of safety.blockedByMe) hardExcludedProfileIds.add(profileId);
      for (const profileId of safety.reportedByMe) hardExcludedProfileIds.add(profileId);
    } catch (error) {
      app.log.warn({ err: error, userId }, "discover.load_hard_exclusions_failed");
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
      hardExcludedProfileIds,
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

  app.post("/discover/feed/reset", async (request, reply) => {
    const userId = resolveAuthenticatedUserId(request, reply);
    if (!userId) {
      return { code: "UNAUTHORIZED", message: "Missing or invalid internal token." };
    }

    const parsed = feedResetSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      reply.status(400);
      return { code: "INVALID_PAYLOAD", message: "Invalid feed reset payload." };
    }

    const filters = parsed.data.quickFilters;
    const preferences = parseResetFeedPreferences(parsed.data);
    const userGeoPoint = parseResetUserGeoPoint(parsed.data);
    // Reset intentionally re-opens dismissed/passed pools.
    // We first compute a pre-famine universe without conversation exclusion,
    // then apply strict exclusions for the final composition.
    const hardExcludedProfileIds = new Set<string>();

    let matchedProfileIds = new Set<string>();
    let conversationProfileIds = new Set<string>();
    let safetyBlockedByMe = new Set<string>();
    let safetyReportedByMe = new Set<string>();
    try {
      matchedProfileIds = await loadMatchedProfileIds(userId);
      conversationProfileIds = await loadConversationProfileIds(userId);
      const safety = await loadSafetyExcludedProfileIds(userId);
      safetyBlockedByMe = safety.blockedByMe;
      safetyReportedByMe = safety.reportedByMe;
    } catch (error) {
      app.log.warn({ err: error, userId }, "discover.feed_reset_hard_exclusion_load_failed");
    }

    const poolSeedExcludedProfileIds = new Set<string>();
    for (const profileId of matchedProfileIds) poolSeedExcludedProfileIds.add(profileId);
    for (const profileId of safetyBlockedByMe) poolSeedExcludedProfileIds.add(profileId);
    for (const profileId of safetyReportedByMe) poolSeedExcludedProfileIds.add(profileId);

    const candidatesSource = await loadDiscoverCandidatesCached({
      userId,
      userGeoPoint,
      logger: app.log,
    });
    const rankedCandidatesForPoolSeed = applyFiltersAndRank(
      filters,
      preferences,
      userGeoPoint,
      poolSeedExcludedProfileIds,
      candidatesSource,
    );
    const candidateIds = rankedCandidatesForPoolSeed.map((candidate) => candidate.id);
    let passedProfileIds = new Set<string>();
    let preferredPassedProfileIds: string[] = [];
    let passedFromEvents: string[] = [];
    try {
      const events = await loadDiscoverFeedEventsByProfileIds({ userId, profileIds: candidateIds });
      passedFromEvents = events
        .filter((row) => row.last_decision === "dislike")
        .map((row) => row.profile_id)
        .filter((value): value is string => typeof value === "string" && value.length > 0);
    } catch (error) {
      app.log.warn({ err: error, userId }, "discover.feed_reset_events_load_failed");
    }

    try {
      preferredPassedProfileIds = await loadPassedProfileIdsFromLikes({
        userId,
        profileIds: candidateIds,
      });
    } catch (error) {
      app.log.warn({ err: error, userId }, "discover.feed_reset_passed_likes_load_failed");
    }
    passedProfileIds = new Set([...preferredPassedProfileIds, ...passedFromEvents]);

    let likedWithoutMatchProfileIds = new Set<string>();
    let preferredLikedWithoutMatchProfileIds: string[] = [];
    try {
      preferredLikedWithoutMatchProfileIds = await loadPendingLikedWithoutMatchProfileIds({
        userId,
        profileIds: candidateIds,
      });
      likedWithoutMatchProfileIds = new Set(preferredLikedWithoutMatchProfileIds);
    } catch (error) {
      app.log.warn({ err: error, userId }, "discover.feed_reset_likes_load_failed");
    }

    for (const profileId of matchedProfileIds) likedWithoutMatchProfileIds.delete(profileId);
    for (const profileId of conversationProfileIds) likedWithoutMatchProfileIds.delete(profileId);
    for (const profileId of safetyBlockedByMe) likedWithoutMatchProfileIds.delete(profileId);
    for (const profileId of safetyReportedByMe) likedWithoutMatchProfileIds.delete(profileId);

    for (const profileId of matchedProfileIds) hardExcludedProfileIds.add(profileId);
    for (const profileId of conversationProfileIds) hardExcludedProfileIds.add(profileId);
    for (const profileId of safetyBlockedByMe) hardExcludedProfileIds.add(profileId);
    for (const profileId of safetyReportedByMe) hardExcludedProfileIds.add(profileId);
    const rankedCandidates = applyFiltersAndRank(
      filters,
      preferences,
      userGeoPoint,
      hardExcludedProfileIds,
      candidatesSource,
    );

    const targetCount = Math.min(env.DISCOVER_FEED_PROFILE_LIMIT, rankedCandidates.length);
    const resetResult = resolveResetFeedComposition({
      rankedCandidates,
      passedProfileIds,
      likedWithoutMatchProfileIds,
      preferredPassedProfileIds,
      preferredLikedWithoutMatchProfileIds,
      maxCount: targetCount,
    });

    const exclusionTotal = new Set<string>([
      ...matchedProfileIds,
      ...conversationProfileIds,
      ...safetyBlockedByMe,
      ...safetyReportedByMe,
    ]).size;

    app.log.info(
      {
        userId,
        filters,
        before: {
          rankedCandidatesForPoolSeed: rankedCandidatesForPoolSeed.length,
          rankedCandidates: rankedCandidates.length,
          pools: resetResult.pools,
          sourceSets: {
            passedFromEvents: passedFromEvents.length,
            passedFromLikes: preferredPassedProfileIds.length,
            likedWithoutMatch: preferredLikedWithoutMatchProfileIds.length,
          },
        },
        exclusions: {
          matched: matchedProfileIds.size,
          conversations: conversationProfileIds.size,
          safetyBlocked: safetyBlockedByMe.size,
          safetyReported: safetyReportedByMe.size,
          total: exclusionTotal,
        },
      },
      "discover.feed_reset_requested",
    );

    app.log.info(
      {
        userId,
        composition: {
          total: resetResult.candidates.length,
          fresh: resetResult.composition.fresh,
          passed: resetResult.composition.passed,
          likedWithoutMatch: resetResult.composition.likedWithoutMatch,
        },
      },
      "discover.feed_reset_composed",
    );

    return {
      window: {
        cursor: `reset_${userId}_${Date.now()}`,
        candidates: resetResult.candidates,
        quickFiltersApplied: filters,
        preferencesApplied: preferences,
      },
      reset: {
        requestedAtIso: new Date().toISOString(),
        composition: {
          total: resetResult.candidates.length,
          fresh: resetResult.composition.fresh,
          passed: resetResult.composition.passed,
          likedWithoutMatch: resetResult.composition.likedWithoutMatch,
        },
        poolsAvailable: {
          fresh: resetResult.pools.fresh,
          passed: resetResult.pools.passed,
          likedWithoutMatch: resetResult.pools.likedWithoutMatch,
        },
        exclusions: {
          matched: matchedProfileIds.size,
          conversations: conversationProfileIds.size,
          safetyBlocked: safetyBlockedByMe.size,
          safetyReported: safetyReportedByMe.size,
          total: exclusionTotal,
        },
      },
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
    try {
      await upsertDiscoverFeedEvent({
        userId,
        profileId,
        decision,
        feedCursor: parsed.data.feedCursor,
      });
    } catch (error) {
      app.log.warn({ err: error, userId, profileId, decision }, "discover.feed_event_upsert_failed");
    }

    const dismissed = dismissedByUser.get(userId) ?? [];
    if (!dismissed.includes(profileId)) {
      dismissed.push(profileId);
      dismissedByUser.set(userId, dismissed.slice(-400));
    }

    const history = swipeHistoryByUser.get(userId) ?? [];
    history.push(profileId);
    swipeHistoryByUser.set(userId, history.slice(-120));
    app.log.info(
      {
        userId,
        profileId,
        decision,
        historySize: Math.min(history.length, 120),
      },
      "discover.swipe_recorded_for_rewind",
    );

    if (decision === "dislike") {
      if (supabaseAdminClient) {
        const nowIso = new Date().toISOString();
        try {
          const persisted = await supabaseAdminClient
            .from("discover_likes")
            .upsert(
              {
                liker_user_id: userId,
                liked_user_id: profileId,
                status: "passed",
                was_superlike: false,
                hidden_by_shadowghost: false,
                passed_at: nowIso,
                matched_at: null,
                updated_at: nowIso,
                created_at: nowIso,
              },
              { onConflict: "liker_user_id,liked_user_id" },
            );
          if (persisted.error) throw persisted.error;
        } catch (error) {
          app.log.warn({ err: error, userId, profileId }, "discover.persist_passed_like_failed");
        }
      }
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
          wasSuperLike: false,
          hiddenByShadowGhost,
          nowIso,
        });

        const seed = `${userId}:${profileId}`;
        const deterministic = stableScore(seed);
        const matchedByScoring = deterministic >= 62;
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

  app.post("/discover/superlike/send", async (request, reply) => {
    const userId = resolveAuthenticatedUserId(request, reply);
    if (!userId) {
      return { code: "UNAUTHORIZED", message: "Missing or invalid internal token." };
    }
    if (!supabaseAdminClient) {
      reply.status(503);
      return { code: "DISCOVER_SUPERLIKE_UNAVAILABLE" };
    }

    const parsed = superLikeSendSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      reply.status(400);
      return {
        status: "invalid_message",
        confirmation: "SuperLike failed.",
        code: "INVALID_PAYLOAD",
        superlikesLeft: Math.max(0, (await getUserEntitlementSnapshot(userId))?.balancesDelta?.superlikesLeft ?? 0),
      };
    }

    const profileId = parsed.data.profileId.trim();
    const messageText = parsed.data.text.trim();
    if (!messageText) {
      reply.status(400);
      return {
        status: "invalid_message",
        confirmation: "SuperLike failed.",
        code: "EMPTY_MESSAGE",
        superlikesLeft: Math.max(0, (await getUserEntitlementSnapshot(userId))?.balancesDelta?.superlikesLeft ?? 0),
      };
    }
    if (profileId === userId) {
      reply.status(400);
      return {
        status: "invalid_target",
        confirmation: "SuperLike failed.",
        code: "SELF_SUPERLIKE_NOT_ALLOWED",
        superlikesLeft: Math.max(0, (await getUserEntitlementSnapshot(userId))?.balancesDelta?.superlikesLeft ?? 0),
      };
    }

    try {
      const profileExists = await ensureProfileExists(profileId);
      if (!profileExists) {
        reply.status(404);
        return {
          status: "invalid_target",
          confirmation: "SuperLike failed.",
          code: "PROFILE_NOT_FOUND",
          superlikesLeft: Math.max(0, (await getUserEntitlementSnapshot(userId))?.balancesDelta?.superlikesLeft ?? 0),
        };
      }
    } catch (error) {
      app.log.warn({ err: error, userId, profileId }, "discover.superlike_target_lookup_failed");
      reply.status(503);
      return { code: "DISCOVER_SUPERLIKE_TARGET_UNAVAILABLE" };
    }

    const idempotencyKey = parsed.data.idempotencyKey ?? idempotencyKeyFromRequest(request);
    if (!idempotencyKey) {
      reply.status(400);
      return { code: "MISSING_IDEMPOTENCY_KEY" };
    }

    let superlikesLeft = 0;
    let consumptionDuplicate = false;
    try {
      const consumption = await consumeBalance({
        userId,
        field: "superlikesLeft",
        amount: 1,
        action: "superlike",
        idempotencyKey,
      });
      if (!consumption.ok) {
        return {
          status: "no_stock",
          confirmation: "SuperLike unavailable.",
          code: "SUPERLIKE_EMPTY",
          superlikesLeft: consumption.balancesLeft,
        };
      }
      superlikesLeft = consumption.balancesLeft;
      consumptionDuplicate = consumption.duplicate;
    } catch (error) {
      app.log.warn({ err: error, userId }, "discover.superlike_consume_failed");
      reply.status(503);
      return { code: "ENTITLEMENT_CONSUME_FAILED" };
    }

    const nowIso = new Date().toISOString();
    const senderConversationId = toDirectConversationId(userId, profileId);
    const recipientConversationId = toDirectConversationId(profileId, userId);
    const messageSeed = idempotencyKey.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || `${Date.now()}`;
    const senderMessageId = `sl-out-${messageSeed}`;
    const recipientMessageId = `sl-in-${messageSeed}`;

    try {
      const hiddenByShadowGhost = await getUserShadowGhostState(userId);
      await upsertLikeRow({
        likerUserId: userId,
        likedUserId: profileId,
        wasSuperLike: true,
        hiddenByShadowGhost,
        nowIso,
      });

      let recipientUnreadCount = 1;
      const recipientConversationResult = await supabaseAdminClient
        .from("chat_conversations")
        .select("unread_count")
        .eq("user_id", profileId)
        .eq("conversation_id", recipientConversationId)
        .maybeSingle();
      if (recipientConversationResult.error) throw recipientConversationResult.error;
      const existingUnread = Math.max(0, recipientConversationResult.data?.unread_count ?? 0);
      recipientUnreadCount = existingUnread + 1;

      await Promise.all([
        upsertDirectConversationForUser({
          userId,
          peerProfileId: profileId,
          conversationId: senderConversationId,
          nowIso,
          previewText: messageText,
          unreadCount: 0,
        }),
        upsertDirectConversationForUser({
          userId: profileId,
          peerProfileId: userId,
          conversationId: recipientConversationId,
          nowIso,
          previewText: messageText,
          unreadCount: recipientUnreadCount,
          receivedSuperLikeTraceAtIso: nowIso,
        }),
      ]);

      await Promise.all([
        insertDirectMessageForUser({
          userId,
          conversationId: senderConversationId,
          senderUserId: userId,
          direction: "outgoing",
          text: messageText,
          nowIso,
          messageId: senderMessageId,
        }),
        insertDirectMessageForUser({
          userId: profileId,
          conversationId: recipientConversationId,
          senderUserId: userId,
          direction: "incoming",
          text: messageText,
          nowIso,
          messageId: recipientMessageId,
        }),
      ]);
    } catch (error) {
      app.log.warn({ err: error, userId, profileId }, "discover.superlike_send_failed");
      if (!consumptionDuplicate) {
        try {
          superlikesLeft = await rollbackConsumedSuperLike(userId);
        } catch (rollbackError) {
          app.log.error(
            { err: rollbackError, userId, profileId },
            "discover.superlike_rollback_failed",
          );
        }
      }
      reply.status(503);
      return {
        status: "invalid_message",
        confirmation: "SuperLike failed.",
        code: "SUPERLIKE_SEND_FAILED",
        superlikesLeft,
      };
    }

    try {
      await upsertDiscoverFeedEvent({
        userId,
        profileId,
        decision: "superlike",
        feedCursor: parsed.data.feedCursor ?? `superlike:${Date.now()}`,
      });
    } catch (error) {
      app.log.warn({ err: error, userId, profileId }, "discover.feed_event_upsert_failed");
    }

    return {
      status: "sent",
      confirmation: "SuperLike sent.",
      superlikesLeft,
      conversationId: senderConversationId,
      messageId: senderMessageId,
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
    const restoredProfileId = history[history.length - 1];
    if (!restoredProfileId) {
      const snapshot = await getUserEntitlementSnapshot(userId);
      app.log.info(
        {
          userId,
          restoredProfileId: null,
          historySize: history.length,
          rewindsLeft: Math.max(0, snapshot?.balancesDelta?.rewindsLeft ?? 0),
          reason: "no_history",
        },
        "discover.rewind_result",
      );
      return {
        restoredProfileId: undefined,
        rewindsLeft: Math.max(0, snapshot?.balancesDelta?.rewindsLeft ?? 0),
      };
    }

    const key =
      parsed.data.idempotencyKey ??
      idempotencyKeyFromRequest(request) ??
      `rewind:${parsed.data.feedCursor}`;
    let rewindsLeft = 0;
    try {
      const consumption = await consumeBalance({
        userId,
        field: "rewindsLeft",
        amount: 1,
        action: "rewind",
        idempotencyKey: key,
      });
      if (!consumption.ok) {
        return { restoredProfileId: undefined, rewindsLeft: consumption.balancesLeft };
      }
      rewindsLeft = consumption.balancesLeft;
    } catch (error) {
      app.log.warn({ err: error, userId }, "discover.rewind_consume_failed");
      reply.status(503);
      return { code: "ENTITLEMENT_CONSUME_FAILED" };
    }

    history.pop();
    swipeHistoryByUser.set(userId, history);

    const dismissed = dismissedByUser.get(userId) ?? [];
    dismissedByUser.set(
      userId,
      dismissed.filter((profileId) => profileId !== restoredProfileId),
    );
    app.log.info(
      {
        userId,
        restoredProfileId,
        historySize: history.length,
        rewindsLeft,
        reason: "restored",
      },
      "discover.rewind_result",
    );

    return { restoredProfileId, rewindsLeft };
  });

  app.get("/discover/boost/status", async (request, reply) => {
    const userId = resolveAuthenticatedUserId(request, reply);
    if (!userId) {
      return { code: "UNAUTHORIZED", message: "Missing or invalid internal token." };
    }
    if (!supabaseAdminClient) {
      return resolveBoostStatus({ boostsLeft: 0 });
    }

    try {
      const snapshot = await getUserEntitlementSnapshot(userId);
      const boostsLeft = Math.max(0, snapshot?.balancesDelta?.boostsLeft ?? 0);
      const boostRow = await getUserBoostRow(userId);
      return resolveBoostStatus({
        boostsLeft,
        activeUntilIso: boostRow?.active_until ?? undefined,
      });
    } catch (error) {
      app.log.warn({ err: error, userId }, "discover.boost_status_failed");
      reply.status(503);
      return { code: "BOOST_STATUS_UNAVAILABLE" };
    }
  });

  app.post("/discover/boost/activate", async (request, reply) => {
    const userId = resolveAuthenticatedUserId(request, reply);
    if (!userId) {
      return { code: "UNAUTHORIZED", message: "Missing or invalid internal token." };
    }
    if (!supabaseAdminClient) {
      reply.status(503);
      return { code: "DISCOVER_BOOST_UNAVAILABLE" };
    }

    const parsed = boostActivateSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      reply.status(400);
      return { code: "INVALID_PAYLOAD", message: "Invalid boost payload." };
    }

    const key =
      parsed.data.idempotencyKey ??
      idempotencyKeyFromRequest(request) ??
      `boost:${Date.now()}`;

    try {
      const currentBoost = await getUserBoostRow(userId);
      if (isIsoActive(currentBoost?.active_until ?? null)) {
        const snapshot = await getUserEntitlementSnapshot(userId);
        const boostsLeft = Math.max(0, snapshot?.balancesDelta?.boostsLeft ?? 0);
        return {
          status: "already_active",
          boost: resolveBoostStatus({
            boostsLeft,
            activeUntilIso: currentBoost?.active_until ?? undefined,
          }),
        };
      }
      const consumption = await consumeBalance({
        userId,
        field: "boostsLeft",
        amount: 1,
        action: "boost",
        idempotencyKey: key,
      });
      if (!consumption.ok) {
        return {
          status: "no_tokens",
          boost: resolveBoostStatus({
            boostsLeft: consumption.balancesLeft,
          }),
        };
      }
      const activeUntilIso = new Date(Date.now() + BOOST_DURATION_SECONDS * 1000).toISOString();
      await setUserBoostActiveUntil(userId, activeUntilIso);
      return {
        status: "activated",
        boost: resolveBoostStatus({
          boostsLeft: consumption.balancesLeft,
          activeUntilIso,
        }),
      };
    } catch (error) {
      app.log.error({ err: error, userId }, "discover.boost_consume_failed");
      reply.status(503);
      return { code: "ENTITLEMENT_CONSUME_FAILED" };
    }
  });

  return app;
};
