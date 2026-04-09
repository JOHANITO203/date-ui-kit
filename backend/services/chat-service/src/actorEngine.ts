import type { FastifyBaseLogger } from "fastify";
import { env } from "./config";
import { supabaseServiceClient } from "./lib/supabaseClient";
import { updateRelationPreview } from "./data";

type Participant = {
  userId: string;
  email: string;
};

type ProfileRow = {
  user_id: string;
  first_name: string | null;
};

type EntitlementSnapshot = {
  planTier: "elite";
  planExpiresAtIso: string;
  balancesDelta: {
    boostsLeft: number;
    superlikesLeft: number;
    rewindsLeft: number;
  };
  travelPass: {
    source: "bundle_included";
    expiresAtIso: string;
  };
  shadowGhost: {
    source: "shadowghost_item";
    expiresAtIso: string;
    enablePrivacy: true;
  };
};

type ActionType = "message" | "like" | "superlike" | "block" | "boost";

const RU_MESSAGES = [
  "Привет, как проходит твой вечер?",
  "Ты мне понравился, давай познакомимся.",
  "У тебя очень приятный профиль.",
  "Я сейчас онлайн, можем пообщаться.",
];

const EN_MESSAGES = [
  "Hey, how is your evening going?",
  "I liked your profile, let's connect.",
  "You have a really nice vibe.",
  "I am online now if you want to chat.",
];

const chooseRandom = <T>(values: T[]): T => values[Math.floor(Math.random() * values.length)]!;

const normalize = (value: string) => value.trim().toLowerCase();
const hasCyrillic = (value: string) => /[\u0400-\u04FF]/.test(value);
const nowIso = () => new Date().toISOString();
const addHoursIso = (hours: number) => new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();

const actorMaxEntitlement = (): EntitlementSnapshot => ({
  planTier: "elite",
  planExpiresAtIso: addHoursIso(24 * 365),
  balancesDelta: {
    boostsLeft: 9999,
    superlikesLeft: 9999,
    rewindsLeft: 9999,
  },
  travelPass: {
    source: "bundle_included",
    expiresAtIso: addHoursIso(24 * 365),
  },
  shadowGhost: {
    source: "shadowghost_item",
    expiresAtIso: addHoursIso(24 * 365),
    enablePrivacy: true,
  },
});

const toConversationId = (targetUserId: string, actorUserId: string) =>
  `live-conv-${targetUserId.slice(0, 8)}-${actorUserId.slice(0, 8)}`;

const pickAction = (): ActionType => {
  const roll = Math.random();
  if (roll < env.ACTOR_ENGINE_BLOCK_RATE) return "block";
  if (roll < env.ACTOR_ENGINE_BLOCK_RATE + env.ACTOR_ENGINE_SUPERLIKE_RATE) return "superlike";
  if (
    roll <
    env.ACTOR_ENGINE_BLOCK_RATE +
      env.ACTOR_ENGINE_SUPERLIKE_RATE +
      env.ACTOR_ENGINE_LIKE_RATE
  ) {
    return "like";
  }
  if (
    roll <
    env.ACTOR_ENGINE_BLOCK_RATE +
      env.ACTOR_ENGINE_SUPERLIKE_RATE +
      env.ACTOR_ENGINE_LIKE_RATE +
      env.ACTOR_ENGINE_BOOST_RATE
  ) {
    return "boost";
  }
  return "message";
};

export const startActorEngine = (logger: FastifyBaseLogger) => {
  if (!env.actorEngineEnabled || !supabaseServiceClient) return null;
  const client = supabaseServiceClient;

  const actorRegex = new RegExp(env.ACTOR_ENGINE_ACTOR_EMAIL_REGEX, "i");
  const boostedActorsUntil = new Map<string, number>();
  const actorProfiles = new Map<string, ProfileRow>();
  let targets: Participant[] = [];
  let actors: Participant[] = [];
  let running = false;
  let stopped = false;

  const ensureActorEntitlements = async () => {
    if (actors.length === 0) return;
    const snapshot = actorMaxEntitlement();
    const updates = actors.map((actor) =>
      client
        .from("user_entitlements")
        .upsert(
          {
            user_id: actor.userId,
            entitlement_snapshot: snapshot,
            updated_at: nowIso(),
          },
          { onConflict: "user_id" },
        ),
    );
    await Promise.all(updates);
  };

  const loadParticipants = async () => {
    const allUsers: Array<{ id: string; email?: string }> = [];
    let page = 1;
    const perPage = 200;

    while (true) {
      const result = await client.auth.admin.listUsers({ page, perPage });
      if (result.error) throw result.error;
      const users = result.data.users ?? [];
      allUsers.push(...users.map((user) => ({ id: user.id, email: user.email ?? undefined })));
      if (users.length < perPage) break;
      page += 1;
    }

    actors = allUsers
      .filter((entry) => typeof entry.email === "string" && actorRegex.test(entry.email))
      .map((entry) => ({
        userId: entry.id,
        email: entry.email!,
      }));

    const actorIds = new Set(actors.map((entry) => entry.userId));
    const allNonActorParticipants = allUsers
      .filter(
        (entry): entry is { id: string; email: string } =>
          typeof entry.email === "string" && !actorIds.has(entry.id),
      )
      .map((entry) => ({ userId: entry.id, email: entry.email }));

    const targetAll =
      env.actorEngineTargetEmails.length === 0 ||
      env.actorEngineTargetEmails.includes("*") ||
      env.actorEngineTargetEmails.includes("all");

    if (targetAll) {
      targets = allNonActorParticipants;
    } else {
      const byEmail = new Map(
        allNonActorParticipants.map((entry) => [normalize(entry.email), entry.userId] as const),
      );
      targets = env.actorEngineTargetEmails
        .map((email) => {
          const userId = byEmail.get(normalize(email));
          return userId ? { userId, email } : null;
        })
        .filter((entry): entry is Participant => Boolean(entry));
    }

    if (actors.length > 0) {
      const profileResult = await client
        .from("profiles")
        .select("user_id,first_name")
        .in(
          "user_id",
          actors.map((actor) => actor.userId),
        );

      if (!profileResult.error) {
        for (const row of (profileResult.data ?? []) as ProfileRow[]) {
          actorProfiles.set(row.user_id, row);
        }
      }
    }

    await ensureActorEntitlements();

    logger.info(
      {
        targets: targets.length,
        actors: actors.length,
      },
      "actor_engine_ready",
    );
  };

  const chooseActorWeighted = (): Participant | null => {
    if (actors.length === 0) return null;
    const nowMs = Date.now();
    const weightedPool: Participant[] = [];
    for (const actor of actors) {
      const boostedUntil = boostedActorsUntil.get(actor.userId) ?? 0;
      const weight = boostedUntil > nowMs ? 3 : 1;
      for (let i = 0; i < weight; i += 1) weightedPool.push(actor);
    }
    return chooseRandom(weightedPool);
  };

  const ensureConversation = async (input: {
    targetUserId: string;
    actorUserId: string;
    lastPreview: string;
    relationState: "active" | "blocked_me";
    superlikeTraceAtIso?: string | null;
  }) => {
    const conversationId = toConversationId(input.targetUserId, input.actorUserId);
    const upsertResult = await client.from("chat_conversations").upsert(
      {
        user_id: input.targetUserId,
        conversation_id: conversationId,
        peer_profile_id: input.actorUserId,
        unread_count: 0,
        last_message_preview: input.lastPreview,
        last_message_at: nowIso(),
        relation_state: input.relationState,
        relation_state_updated_at: nowIso(),
        received_superlike_trace_at: input.superlikeTraceAtIso ?? null,
      },
      { onConflict: "user_id,conversation_id" },
    );
    if (upsertResult.error) throw upsertResult.error;
    return conversationId;
  };

  const upsertIncomingLike = async (input: {
    actorUserId: string;
    targetUserId: string;
    wasSuperLike: boolean;
    hiddenByShadowGhost: boolean;
  }) => {
    const now = nowIso();
    const result = await client.from("discover_likes").upsert(
      {
        liker_user_id: input.actorUserId,
        liked_user_id: input.targetUserId,
        status: "pending",
        was_superlike: input.wasSuperLike,
        hidden_by_shadowghost: input.hiddenByShadowGhost,
        created_at: now,
        updated_at: now,
        matched_at: null,
        passed_at: null,
      },
      { onConflict: "liker_user_id,liked_user_id" },
    );
    if (result.error) throw result.error;
  };

  const runTick = async () => {
    if (running || stopped) return;
    running = true;
    try {
      if (targets.length === 0 || actors.length === 0) {
        await loadParticipants();
      }
      if (targets.length === 0 || actors.length === 0) return;

      const target = chooseRandom(targets);
      const actor = chooseActorWeighted();
      if (!actor || actor.userId === target.userId) return;

      const action = pickAction();
      const conversationId = toConversationId(target.userId, actor.userId);

      if (action === "boost") {
        boostedActorsUntil.set(
          actor.userId,
          Date.now() + env.ACTOR_ENGINE_BOOST_DURATION_MINUTES * 60 * 1000,
        );
        logger.debug({ actorUserId: actor.userId }, "actor_engine_boost_activated");
        return;
      }

      if (action === "like") {
        const hiddenByShadowGhost = Math.random() < env.ACTOR_ENGINE_SHADOWGHOST_LIKE_RATE;
        await upsertIncomingLike({
          actorUserId: actor.userId,
          targetUserId: target.userId,
          wasSuperLike: false,
          hiddenByShadowGhost,
        });
        logger.debug(
          { actorUserId: actor.userId, targetUserId: target.userId, hiddenByShadowGhost },
          "actor_engine_like_sent",
        );
        return;
      }

      if (action === "superlike") {
        const hiddenByShadowGhost = Math.random() < env.ACTOR_ENGINE_SHADOWGHOST_LIKE_RATE;
        await upsertIncomingLike({
          actorUserId: actor.userId,
          targetUserId: target.userId,
          wasSuperLike: true,
          hiddenByShadowGhost,
        });
        logger.debug(
          { actorUserId: actor.userId, targetUserId: target.userId, hiddenByShadowGhost },
          "actor_engine_superlike_sent",
        );
        return;
      }

      if (action === "block") {
        const preview = updateRelationPreview("blocked_me", "This user blocked you.");
        await ensureConversation({
          targetUserId: target.userId,
          actorUserId: actor.userId,
          lastPreview: preview,
          relationState: "blocked_me",
        });
        return;
      }

      const conversationResult = await client
        .from("chat_conversations")
        .select("unread_count,relation_state")
        .eq("user_id", target.userId)
        .eq("conversation_id", conversationId)
        .maybeSingle();
      if (conversationResult.error) throw conversationResult.error;
      const relationState = conversationResult.data?.relation_state;
      if (relationState === "blocked_by_me" || relationState === "blocked_me") return;

      const actorName = actorProfiles.get(actor.userId)?.first_name?.trim() || "Someone";
      const templates = hasCyrillic(actorName) ? RU_MESSAGES : EN_MESSAGES;
      const text = `${chooseRandom(templates)} (${actorName})`;
      const createdAtIso = nowIso();
      const messageResult = await client.from("chat_messages").upsert(
        {
          user_id: target.userId,
          message_id: `live-msg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          conversation_id: conversationId,
          sender_user_id: actor.userId,
          direction: "incoming",
          original_text: text,
          translated: false,
          created_at: createdAtIso,
        },
        { onConflict: "user_id,message_id" },
      );
      if (messageResult.error) throw messageResult.error;

      const unreadCount = Math.max(1, Number(conversationResult.data?.unread_count ?? 0) + 1);
      const convoUpdate = await client
        .from("chat_conversations")
        .upsert(
          {
            user_id: target.userId,
            conversation_id: conversationId,
            peer_profile_id: actor.userId,
            unread_count: unreadCount,
            last_message_preview: text,
            last_message_at: createdAtIso,
            relation_state: "active",
            relation_state_updated_at: createdAtIso,
          },
          { onConflict: "user_id,conversation_id" },
        );
      if (convoUpdate.error) throw convoUpdate.error;
    } catch (error) {
      logger.warn({ err: error }, "actor_engine_tick_failed");
    } finally {
      running = false;
    }
  };

  void loadParticipants().catch((error) => {
    logger.warn({ err: error }, "actor_engine_init_failed");
  });

  const interval = setInterval(() => {
    void runTick();
  }, env.ACTOR_ENGINE_TICK_SECONDS * 1000);

  logger.info(
    {
      tickSeconds: env.ACTOR_ENGINE_TICK_SECONDS,
    },
    "actor_engine_started",
  );

  return () => {
    stopped = true;
    clearInterval(interval);
    logger.info("actor_engine_stopped");
  };
};
