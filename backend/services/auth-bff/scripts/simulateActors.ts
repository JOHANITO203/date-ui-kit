import { config as loadEnv } from "dotenv";
import { createClient, type User } from "@supabase/supabase-js";
import path from "node:path";
import { fileURLToPath } from "node:url";

type RelationState = "active" | "blocked_by_me" | "blocked_me";
type EntitlementPlanTier = "free" | "essential" | "gold" | "platinum" | "elite";

type EntitlementSnapshot = {
  planTier?: EntitlementPlanTier;
  planExpiresAtIso?: string;
  balancesDelta?: {
    boostsLeft?: number;
    superlikesLeft?: number;
    rewindsLeft?: number;
  };
  travelPass?: {
    source: "travel_pass" | "bundle_included";
    expiresAtIso: string;
  };
  shadowGhost?: {
    source: "shadowghost_item";
    expiresAtIso: string;
    enablePrivacy: boolean;
  };
};

type ProfileRow = {
  user_id: string;
  first_name: string | null;
  birth_date: string | null;
  city: string | null;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../../../../");
const serviceDir = path.resolve(__dirname, "..");

loadEnv({ path: path.join(rootDir, ".env") });
loadEnv({ path: path.join(serviceDir, ".env") });
loadEnv();

const requiredEnv = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE"] as const;
for (const key of requiredEnv) {
  if (!process.env[key] || process.env[key]!.trim().length === 0) {
    throw new Error(`Missing required env: ${key}`);
  }
}

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE!, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const targetEmails = (
  process.env.ACTOR_SIM_TARGET_EMAILS ??
  "johaneoyaraht@gmail.com,johanito203@gmail.com"
)
  .split(",")
  .map((entry) => entry.trim().toLowerCase())
  .filter(Boolean);

const actorEmailRegex = new RegExp(
  process.env.ACTOR_SIM_ACTOR_EMAIL_REGEX ??
    "^seed\\.(moscow|saint-petersburg|voronezh|sochi)\\.\\d+@exotic\\.local$",
  "i",
);

const actorsPerTarget = Math.max(1, Number(process.env.ACTOR_SIM_ACTORS_PER_TARGET ?? "16"));
const messagesPerConversationMin = Math.max(
  1,
  Number(process.env.ACTOR_SIM_MESSAGES_MIN ?? "2"),
);
const messagesPerConversationMax = Math.max(
  messagesPerConversationMin,
  Number(process.env.ACTOR_SIM_MESSAGES_MAX ?? "6"),
);
const superLikeRate = Math.min(1, Math.max(0, Number(process.env.ACTOR_SIM_SUPERLIKE_RATE ?? "0.25")));
const likeOnlyRate = Math.min(1, Math.max(0, Number(process.env.ACTOR_SIM_LIKE_RATE ?? "0.6")));
const blockedByMeRate = Math.min(
  1,
  Math.max(0, Number(process.env.ACTOR_SIM_BLOCKED_BY_ME_RATE ?? "0.08")),
);
const blockedMeRate = Math.min(
  1,
  Math.max(0, Number(process.env.ACTOR_SIM_BLOCKED_ME_RATE ?? "0.05")),
);
const resetBeforeSeed = process.env.ACTOR_SIM_RESET !== "0";
const actorBoostActivationsPerTarget = Math.max(
  1,
  Number(process.env.ACTOR_SIM_BOOST_ACTIVATIONS_PER_TARGET ?? "6"),
);

const nowIso = () => new Date().toISOString();

const shuffle = <T>(source: T[]): T[] => {
  const result = [...source];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

const sample = <T>(source: T[], count: number) => shuffle(source).slice(0, count);

const randomInt = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1));

const randomPastIso = (maxHoursAgo = 72) =>
  new Date(Date.now() - randomInt(5, maxHoursAgo * 60) * 60 * 1000).toISOString();

const listUsers = async (): Promise<User[]> => {
  let page = 1;
  const perPage = 200;
  const all: User[] = [];
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data.users ?? [];
    all.push(...users);
    if (users.length < perPage) break;
    page += 1;
  }
  return all;
};

const resolveRelationState = (): RelationState => {
  const roll = Math.random();
  if (roll < blockedByMeRate) return "blocked_by_me";
  if (roll < blockedByMeRate + blockedMeRate) return "blocked_me";
  return "active";
};

const ageFromBirthDate = (birthDate: string | null) => {
  if (!birthDate) return 24;
  const dob = new Date(birthDate);
  if (Number.isNaN(dob.getTime())) return 24;
  const now = new Date();
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const monthDelta = now.getUTCMonth() - dob.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getUTCDate() < dob.getUTCDate())) age -= 1;
  return Math.max(18, Math.min(45, age));
};

const chatOpeners = [
  "Hey, your profile caught my eye.",
  "Hi, how is your day going?",
  "You seem fun. Want to chat?",
  "I liked your vibe instantly.",
  "Hi, we should definitely talk.",
];

const chatReplies = [
  "Nice to meet you too.",
  "Thanks, glad we matched.",
  "Sure, tell me more about you.",
  "That sounds interesting.",
  "I am online this evening.",
];

const computeExpiry = (durationHours: number) =>
  new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString();

const sanitizeEntitlementSnapshot = (
  snapshot: EntitlementSnapshot | null | undefined,
): EntitlementSnapshot | null => {
  if (!snapshot) return null;
  const next: EntitlementSnapshot = {
    planTier: snapshot.planTier,
    planExpiresAtIso: snapshot.planExpiresAtIso,
    balancesDelta: snapshot.balancesDelta,
  };

  const planMs = snapshot.planExpiresAtIso ? new Date(snapshot.planExpiresAtIso).getTime() : NaN;
  if (!snapshot.planTier || !Number.isFinite(planMs) || planMs <= Date.now()) {
    delete next.planTier;
    delete next.planExpiresAtIso;
  }

  const travelMs = snapshot.travelPass?.expiresAtIso
    ? new Date(snapshot.travelPass.expiresAtIso).getTime()
    : NaN;
  if (snapshot.travelPass && Number.isFinite(travelMs) && travelMs > Date.now()) {
    next.travelPass = snapshot.travelPass;
  }

  const shadowMs = snapshot.shadowGhost?.expiresAtIso
    ? new Date(snapshot.shadowGhost.expiresAtIso).getTime()
    : NaN;
  if (snapshot.shadowGhost && Number.isFinite(shadowMs) && shadowMs > Date.now()) {
    next.shadowGhost = snapshot.shadowGhost;
  }

  const hasBalances = Boolean(
    (next.balancesDelta?.boostsLeft ?? 0) > 0 ||
      (next.balancesDelta?.superlikesLeft ?? 0) > 0 ||
      (next.balancesDelta?.rewindsLeft ?? 0) > 0,
  );
  if (!hasBalances) delete next.balancesDelta;

  return next.planTier || next.travelPass || next.shadowGhost || next.balancesDelta ? next : null;
};

const mergeEntitlementSnapshots = (
  previous: EntitlementSnapshot | null | undefined,
  incoming: EntitlementSnapshot,
) => {
  const base = sanitizeEntitlementSnapshot(previous) ?? {};
  const patch = sanitizeEntitlementSnapshot(incoming) ?? {};

  const balances = {
    boostsLeft: (base.balancesDelta?.boostsLeft ?? 0) + (patch.balancesDelta?.boostsLeft ?? 0),
    superlikesLeft:
      (base.balancesDelta?.superlikesLeft ?? 0) + (patch.balancesDelta?.superlikesLeft ?? 0),
    rewindsLeft: (base.balancesDelta?.rewindsLeft ?? 0) + (patch.balancesDelta?.rewindsLeft ?? 0),
  };

  const merged: EntitlementSnapshot = {
    planTier: patch.planTier ?? base.planTier,
    planExpiresAtIso: patch.planExpiresAtIso ?? base.planExpiresAtIso,
    travelPass: patch.travelPass ?? base.travelPass,
    shadowGhost: patch.shadowGhost ?? base.shadowGhost,
  };

  if (balances.boostsLeft > 0 || balances.superlikesLeft > 0 || balances.rewindsLeft > 0) {
    merged.balancesDelta = balances;
  }

  return merged;
};

const resolveEntitlementByOfferId = (offerId: string): EntitlementSnapshot => {
  switch (offerId) {
    case "instant-boost":
      return { balancesDelta: { boostsLeft: 1 } };
    case "instant-superlike":
      return { balancesDelta: { superlikesLeft: 5 } };
    case "instant-rewind-x10":
      return { balancesDelta: { rewindsLeft: 10 } };
    case "instant-travel-pass":
      return {
        travelPass: {
          source: "travel_pass",
          expiresAtIso: computeExpiry(24),
        },
      };
    case "instant-shadowghost":
      return {
        shadowGhost: {
          source: "shadowghost_item",
          expiresAtIso: computeExpiry(24),
          enablePrivacy: true,
        },
      };
    case "bundle-starter":
      return { balancesDelta: { boostsLeft: 1, superlikesLeft: 5 } };
    case "bundle-dating-pro":
      return {
        balancesDelta: { boostsLeft: 5, superlikesLeft: 20, rewindsLeft: 10 },
        travelPass: { source: "bundle_included", expiresAtIso: computeExpiry(24 * 30) },
      };
    case "bundle-premium-plus":
      return {
        planTier: "elite",
        planExpiresAtIso: computeExpiry(24 * 30),
        balancesDelta: { boostsLeft: 4, superlikesLeft: 20, rewindsLeft: 10 },
        travelPass: { source: "bundle_included", expiresAtIso: computeExpiry(24 * 30) },
      };
    case "tier-essential-month":
      return { planTier: "essential", planExpiresAtIso: computeExpiry(24 * 30) };
    case "tier-gold-month":
      return { planTier: "gold", planExpiresAtIso: computeExpiry(24 * 30) };
    case "tier-platinum-month":
      return { planTier: "platinum", planExpiresAtIso: computeExpiry(24 * 30) };
    case "tier-elite-month":
      return { planTier: "elite", planExpiresAtIso: computeExpiry(24 * 30) };
    default:
      return {};
  }
};

const actorMaxEntitlementSnapshot = (): EntitlementSnapshot => ({
  planTier: "elite",
  planExpiresAtIso: computeExpiry(24 * 365),
  balancesDelta: {
    boostsLeft: 9999,
    superlikesLeft: 9999,
    rewindsLeft: 9999,
  },
  travelPass: {
    source: "bundle_included",
    expiresAtIso: computeExpiry(24 * 365),
  },
  shadowGhost: {
    source: "shadowghost_item",
    expiresAtIso: computeExpiry(24 * 365),
    enablePrivacy: true,
  },
});

const randomActorAction = (): "superlike" | "like" | "none" => {
  const roll = Math.random();
  if (roll < superLikeRate) return "superlike";
  if (roll < superLikeRate + likeOnlyRate) return "like";
  return "none";
};

const safeEmailPrefix = (email: string) =>
  email.replace(/[^a-zA-Z0-9]/g, "").slice(0, 16).toLowerCase();

const main = async () => {
  const users = await listUsers();
  const byEmail = new Map(
    users
      .filter((entry) => entry.email)
      .map((entry) => [entry.email!.toLowerCase(), entry.id] as const),
  );

  const targets = targetEmails
    .map((email) => ({ email, userId: byEmail.get(email) }))
    .filter((entry): entry is { email: string; userId: string } => Boolean(entry.userId));

  if (targets.length === 0) {
    throw new Error(
      `No targets found for ACTOR_SIM_TARGET_EMAILS: ${targetEmails.join(", ")}`,
    );
  }

  const actorUsers = users.filter((entry) => actorEmailRegex.test(entry.email ?? ""));
  if (actorUsers.length === 0) {
    throw new Error("No actor users found. Seed profiles first.");
  }

  const actorIds = actorUsers.map((entry) => entry.id);
  const { data: profileRows, error: profileError } = await supabase
    .from("profiles")
    .select("user_id,first_name,birth_date,city")
    .in("user_id", actorIds)
    .limit(1000);
  if (profileError) throw profileError;
  const profileByUserId = new Map(
    ((profileRows ?? []) as ProfileRow[]).map((row) => [row.user_id, row]),
  );

  if (resetBeforeSeed) {
    await supabase.from("chat_messages").delete().like("message_id", "sim-msg-%");
    await supabase.from("chat_conversations").delete().like("conversation_id", "sim-conv-%");
    await supabase.from("payments_checkouts").delete().like("checkout_id", "sim-checkout-%");
  }

  let conversationsCount = 0;
  let messagesCount = 0;
  let blocksCount = 0;
  let likesCount = 0;
  let superlikesCount = 0;
  let boostActionsCount = 0;
  let actorEntitlementsCount = 0;

  for (const target of targets) {
    const peers = sample(actorUsers.filter((entry) => entry.id !== target.userId), actorsPerTarget);
    const boostedActors = sample(peers, Math.min(actorBoostActivationsPerTarget, peers.length));

    for (let i = 0; i < peers.length; i += 1) {
      const peer = peers[i];
      const peerProfile = profileByUserId.get(peer.id);
      const peerName = peerProfile?.first_name?.trim() || "Profile";
      const peerAge = ageFromBirthDate(peerProfile?.birth_date ?? null);
      const relationState = resolveRelationState();
      const actorAction = randomActorAction();
      const traceSuperlike = actorAction === "superlike";
      const baseIso = randomPastIso(72);
      const conversationId = `sim-conv-${target.userId.slice(0, 8)}-${peer.id.slice(0, 8)}`;

      const messageCount = randomInt(messagesPerConversationMin, messagesPerConversationMax);
      const conversationMessages: Array<{
        user_id: string;
        message_id: string;
        conversation_id: string;
        sender_user_id: string;
        direction: "incoming" | "outgoing";
        original_text: string;
        translated: boolean;
        created_at: string;
        read_at: string | null;
      }> = [];

      let unreadCount = 0;
      for (let m = 0; m < messageCount; m += 1) {
        const incoming = m % 2 === 0;
        const direction: "incoming" | "outgoing" = incoming ? "incoming" : "outgoing";
        const senderUserId = incoming ? peer.id : target.userId;
        const createdAtIso = new Date(new Date(baseIso).getTime() + m * 45 * 1000).toISOString();
        const text = incoming
          ? m === 0
            ? `${chatOpeners[m % chatOpeners.length]} I am ${peerName}, ${peerAge}.`
            : chatOpeners[(m + i) % chatOpeners.length]
          : chatReplies[(m + i) % chatReplies.length];
        const readAt =
          relationState === "active" && incoming && m < messageCount - 1
            ? createdAtIso
            : null;
        if (incoming && !readAt && relationState === "active") unreadCount += 1;

        conversationMessages.push({
          user_id: target.userId,
          message_id: `sim-msg-${target.userId.slice(0, 8)}-${peer.id.slice(0, 8)}-${m}`,
          conversation_id: conversationId,
          sender_user_id: senderUserId,
          direction,
          original_text: text,
          translated: false,
          created_at: createdAtIso,
          read_at: readAt,
        });
      }

      const lastMessage = conversationMessages[conversationMessages.length - 1];
      const lastMessagePreview =
        relationState === "active"
          ? lastMessage?.original_text ?? "New interaction"
          : relationState === "blocked_by_me"
            ? "You blocked this conversation."
            : "This user blocked you.";

      const { error: convoError } = await supabase.from("chat_conversations").upsert(
        {
          user_id: target.userId,
          conversation_id: conversationId,
          peer_profile_id: peer.id,
          unread_count: relationState === "active" ? unreadCount : 0,
          last_message_preview: lastMessagePreview,
          last_message_at: lastMessage?.created_at ?? baseIso,
          relation_state: relationState,
          relation_state_updated_at: nowIso(),
          received_superlike_trace_at: traceSuperlike ? baseIso : null,
        },
        { onConflict: "user_id,conversation_id" },
      );
      if (convoError) throw convoError;

      const { error: messagesError } = await supabase
        .from("chat_messages")
        .upsert(conversationMessages, { onConflict: "user_id,message_id" });
      if (messagesError) throw messagesError;

      conversationsCount += 1;
      messagesCount += conversationMessages.length;
      if (actorAction === "superlike") {
        superlikesCount += 1;
      } else if (actorAction === "like") {
        likesCount += 1;
      }
      if (boostedActors.some((entry) => entry.id === peer.id)) {
        boostActionsCount += 1;
      }

      if (relationState === "blocked_by_me") {
        const { error: blockError } = await supabase.from("safety_blocks").upsert(
          {
            user_id: target.userId,
            blocked_user_id: peer.id,
            created_at: nowIso(),
          },
          { onConflict: "user_id,blocked_user_id" },
        );
        if (blockError) throw blockError;
        blocksCount += 1;
      }
    }
  }

  for (const actor of actorUsers) {
    const maxSnapshot = actorMaxEntitlementSnapshot();
    const { data: existingEntitlementRow } = await supabase
      .from("user_entitlements")
      .select("entitlement_snapshot")
      .eq("user_id", actor.id)
      .maybeSingle();
    const merged = mergeEntitlementSnapshots(
      (existingEntitlementRow?.entitlement_snapshot ?? null) as EntitlementSnapshot | null,
      maxSnapshot,
    );
    const sanitized = sanitizeEntitlementSnapshot(merged);
    if (!sanitized) continue;
    const { error: entitlementError } = await supabase.from("user_entitlements").upsert(
      {
        user_id: actor.id,
        entitlement_snapshot: sanitized,
        updated_at: nowIso(),
      },
      { onConflict: "user_id" },
    );
    if (entitlementError) throw entitlementError;
    actorEntitlementsCount += 1;
  }

  console.log("[actor:simulate] done");
  console.log(`[actor:simulate] targets=${targets.length}`);
  console.log(`[actor:simulate] actors_pool=${actorUsers.length}`);
  console.log(`[actor:simulate] conversations_upserted=${conversationsCount}`);
  console.log(`[actor:simulate] messages_upserted=${messagesCount}`);
  console.log(`[actor:simulate] blocks_upserted=${blocksCount}`);
  console.log(`[actor:simulate] likes_simulated=${likesCount}`);
  console.log(`[actor:simulate] superlikes_simulated=${superlikesCount}`);
  console.log(`[actor:simulate] boosts_simulated=${boostActionsCount}`);
  console.log(`[actor:simulate] actor_entitlements_upserted=${actorEntitlementsCount}`);
}

main().catch((error) => {
  console.error("[actor:simulate] failed", error);
  process.exit(1);
});
