import { config as loadEnv } from "dotenv";
import { PrismaClient, type Prisma } from "@prisma/client";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../../../../");
const serviceDir = path.resolve(__dirname, "..");

loadEnv({ path: path.join(rootDir, ".env") });
loadEnv({ path: path.join(serviceDir, ".env"), override: true });
loadEnv();

type RelationState = "active" | "blocked_by_me" | "blocked_me";
type EntitlementPlanTier = "free" | "essential" | "gold" | "platinum" | "elite";

type EntitlementSnapshot = {
  planTier?: EntitlementPlanTier;
  planExpiresAtIso?: string;
  balancesDelta?: { boostsLeft?: number; superlikesLeft?: number; rewindsLeft?: number };
  travelPass?: { source: "travel_pass" | "bundle_included"; expiresAtIso: string };
  shadowGhost?: { source: "shadowghost_item"; expiresAtIso: string; enablePrivacy: boolean };
};

const targetEmails = (process.env.ACTOR_SIM_TARGET_EMAILS ?? "johaneoyaraht@gmail.com,johanito203@gmail.com")
  .split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

const actorEmailRegex = new RegExp(
  process.env.ACTOR_SIM_ACTOR_EMAIL_REGEX ?? "^seed\\.(moscow|saint-petersburg|voronezh|sochi)\\.\\d+@exotic\\.local$",
  "i",
);

const actorsPerTarget = Math.max(1, Number(process.env.ACTOR_SIM_ACTORS_PER_TARGET ?? "16"));
const messagesPerConversationMin = Math.max(1, Number(process.env.ACTOR_SIM_MESSAGES_MIN ?? "2"));
const messagesPerConversationMax = Math.max(messagesPerConversationMin, Number(process.env.ACTOR_SIM_MESSAGES_MAX ?? "6"));
const superLikeRate = Math.min(1, Math.max(0, Number(process.env.ACTOR_SIM_SUPERLIKE_RATE ?? "0.25")));
const likeOnlyRate = Math.min(1, Math.max(0, Number(process.env.ACTOR_SIM_LIKE_RATE ?? "0.6")));
const blockedByMeRate = Math.min(1, Math.max(0, Number(process.env.ACTOR_SIM_BLOCKED_BY_ME_RATE ?? "0.08")));
const blockedMeRate = Math.min(1, Math.max(0, Number(process.env.ACTOR_SIM_BLOCKED_ME_RATE ?? "0.05")));
const resetBeforeSeed = process.env.ACTOR_SIM_RESET !== "0";
const actorBoostActivationsPerTarget = Math.max(1, Number(process.env.ACTOR_SIM_BOOST_ACTIVATIONS_PER_TARGET ?? "6"));

const prisma = new PrismaClient();

const nowIso = () => new Date().toISOString();
const computeExpiry = (durationHours: number) => new Date(Date.now() + durationHours * 3600000).toISOString();

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
  new Date(Date.now() - randomInt(5, maxHoursAgo * 60) * 60000).toISOString();

const resolveRelationState = (): RelationState => {
  const roll = Math.random();
  if (roll < blockedByMeRate) return "blocked_by_me";
  if (roll < blockedByMeRate + blockedMeRate) return "blocked_me";
  return "active";
};

const randomActorAction = (): "superlike" | "like" | "none" => {
  const roll = Math.random();
  if (roll < superLikeRate) return "superlike";
  if (roll < superLikeRate + likeOnlyRate) return "like";
  return "none";
};

const ageFromBirthDate = (birthDate: string | null) => {
  if (!birthDate) return 24;
  const dob = new Date(birthDate);
  if (Number.isNaN(dob.getTime())) return 24;
  const now = new Date();
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const m = now.getUTCMonth() - dob.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < dob.getUTCDate())) age -= 1;
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

const sanitizeEntitlementSnapshot = (snapshot: EntitlementSnapshot | null | undefined): EntitlementSnapshot | null => {
  if (!snapshot) return null;
  const next: EntitlementSnapshot = {
    planTier: snapshot.planTier,
    planExpiresAtIso: snapshot.planExpiresAtIso,
    balancesDelta: snapshot.balancesDelta,
  };
  const planMs = snapshot.planExpiresAtIso ? new Date(snapshot.planExpiresAtIso).getTime() : NaN;
  if (!snapshot.planTier || !Number.isFinite(planMs) || planMs <= Date.now()) {
    delete next.planTier; delete next.planExpiresAtIso;
  }
  const travelMs = snapshot.travelPass?.expiresAtIso ? new Date(snapshot.travelPass.expiresAtIso).getTime() : NaN;
  if (snapshot.travelPass && Number.isFinite(travelMs) && travelMs > Date.now()) next.travelPass = snapshot.travelPass;
  const shadowMs = snapshot.shadowGhost?.expiresAtIso ? new Date(snapshot.shadowGhost.expiresAtIso).getTime() : NaN;
  if (snapshot.shadowGhost && Number.isFinite(shadowMs) && shadowMs > Date.now()) next.shadowGhost = snapshot.shadowGhost;
  const hasBalances = ((next.balancesDelta?.boostsLeft ?? 0) > 0 ||
    (next.balancesDelta?.superlikesLeft ?? 0) > 0 ||
    (next.balancesDelta?.rewindsLeft ?? 0) > 0);
  if (!hasBalances) delete next.balancesDelta;
  return next.planTier || next.travelPass || next.shadowGhost || next.balancesDelta ? next : null;
};

const mergeEntitlementSnapshots = (
  previous: EntitlementSnapshot | null | undefined,
  incoming: EntitlementSnapshot,
): EntitlementSnapshot => {
  const base = sanitizeEntitlementSnapshot(previous) ?? {};
  const patch = sanitizeEntitlementSnapshot(incoming) ?? {};
  const balances = {
    boostsLeft: (base.balancesDelta?.boostsLeft ?? 0) + (patch.balancesDelta?.boostsLeft ?? 0),
    superlikesLeft: (base.balancesDelta?.superlikesLeft ?? 0) + (patch.balancesDelta?.superlikesLeft ?? 0),
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

const actorMaxEntitlementSnapshot = (): EntitlementSnapshot => ({
  planTier: "elite",
  planExpiresAtIso: computeExpiry(24 * 365),
  balancesDelta: { boostsLeft: 9999, superlikesLeft: 9999, rewindsLeft: 9999 },
  travelPass: { source: "bundle_included", expiresAtIso: computeExpiry(24 * 365) },
  shadowGhost: { source: "shadowghost_item", expiresAtIso: computeExpiry(24 * 365), enablePrivacy: true },
});

const main = async () => {
  const allUsers = await prisma.user.findMany({ select: { id: true, email: true } });
  const byEmail = new Map(allUsers.filter((u) => u.email).map((u) => [u.email.toLowerCase(), u.id]));

  const targets = targetEmails
    .map((email) => ({ email, userId: byEmail.get(email) }))
    .filter((e): e is { email: string; userId: string } => Boolean(e.userId));

  if (targets.length === 0) throw new Error(`No targets found for ACTOR_SIM_TARGET_EMAILS: ${targetEmails.join(", ")}`);

  const actorUsers = allUsers.filter((u) => actorEmailRegex.test(u.email ?? ""));
  if (actorUsers.length === 0) throw new Error("No actor users found. Seed profiles first.");

  const actorIds = actorUsers.map((u) => u.id);
  const profileRows = await prisma.profile.findMany({
    where: { userId: { in: actorIds } },
    select: { userId: true, firstName: true, birthDate: true, city: true },
  });
  const profileByUserId = new Map(profileRows.map((p) => [p.userId, p]));

  if (resetBeforeSeed) {
    await prisma.chatMessage.deleteMany({ where: { messageId: { startsWith: "sim-msg-" } } });
    await prisma.chatConversation.deleteMany({ where: { conversationId: { startsWith: "sim-conv-" } } });
    await prisma.paymentCheckout.deleteMany({ where: { checkoutId: { startsWith: "sim-checkout-" } } });
  }

  let conversationsCount = 0;
  let messagesCount = 0;
  let blocksCount = 0;
  let likesCount = 0;
  let superlikesCount = 0;
  let actorEntitlementsCount = 0;

  for (const target of targets) {
    const peers = sample(actorUsers.filter((u) => u.id !== target.userId), actorsPerTarget);

    for (let i = 0; i < peers.length; i += 1) {
      const peer = peers[i];
      const peerProfile = profileByUserId.get(peer.id);
      const peerName = peerProfile?.firstName?.trim() || "Profile";
      const peerAge = ageFromBirthDate(peerProfile?.birthDate ?? null);
      const relationState = resolveRelationState();
      const actorAction = randomActorAction();
      const traceSuperlike = actorAction === "superlike";
      const baseIso = randomPastIso(72);
      const conversationId = `sim-conv-${target.userId.slice(0, 8)}-${peer.id.slice(0, 8)}`;
      const messageCount = randomInt(messagesPerConversationMin, messagesPerConversationMax);

      const conversationMessages: Prisma.ChatMessageCreateManyInput[] = [];
      let unreadCount = 0;
      for (let m = 0; m < messageCount; m += 1) {
        const incoming = m % 2 === 0;
        const senderUserId = incoming ? peer.id : target.userId;
        const createdAt = new Date(new Date(baseIso).getTime() + m * 45000);
        const text = incoming
          ? m === 0 ? `${chatOpeners[m % chatOpeners.length]} I am ${peerName}, ${peerAge}.` : chatOpeners[(m + i) % chatOpeners.length]
          : chatReplies[(m + i) % chatReplies.length];
        const readAt = relationState === "active" && incoming && m < messageCount - 1 ? createdAt : null;
        if (incoming && !readAt && relationState === "active") unreadCount += 1;

        conversationMessages.push({
          userId: target.userId,
          messageId: `sim-msg-${target.userId.slice(0, 8)}-${peer.id.slice(0, 8)}-${m}`,
          conversationId,
          senderUserId,
          direction: incoming ? "incoming" : "outgoing",
          originalText: text,
          translated: false,
          createdAt,
          readAt,
        });
      }

      const lastMessage = conversationMessages[conversationMessages.length - 1];
      const lastMessagePreview =
        relationState === "active" ? (lastMessage?.originalText ?? "New interaction")
        : relationState === "blocked_by_me" ? "You blocked this conversation."
        : "This user blocked you.";

      await prisma.chatConversation.upsert({
        where: { userId_conversationId: { userId: target.userId, conversationId } },
        create: {
          userId: target.userId,
          conversationId,
          peerProfileId: peer.id,
          unreadCount: relationState === "active" ? unreadCount : 0,
          lastMessagePreview,
          lastMessageAt: lastMessage ? (lastMessage.createdAt as Date) : new Date(baseIso),
          relationState,
          relationStateUpdatedAt: new Date(nowIso()),
          receivedSuperlikeTraceAt: traceSuperlike ? new Date(baseIso) : null,
        },
        update: {
          peerProfileId: peer.id,
          unreadCount: relationState === "active" ? unreadCount : 0,
          lastMessagePreview,
          lastMessageAt: lastMessage ? (lastMessage.createdAt as Date) : new Date(baseIso),
          relationState,
          relationStateUpdatedAt: new Date(nowIso()),
          receivedSuperlikeTraceAt: traceSuperlike ? new Date(baseIso) : null,
        },
      });

      await prisma.chatMessage.createMany({ data: conversationMessages, skipDuplicates: true });

      conversationsCount += 1;
      messagesCount += conversationMessages.length;
      if (actorAction === "superlike") superlikesCount += 1;
      else if (actorAction === "like") likesCount += 1;

      if (relationState === "blocked_by_me") {
        await prisma.safetyBlock.upsert({
          where: { userId_blockedUserId: { userId: target.userId, blockedUserId: peer.id } },
          create: { userId: target.userId, blockedUserId: peer.id },
          update: {},
        });
        blocksCount += 1;
      }
    }
  }

  for (const actor of actorUsers) {
    const existing = await prisma.userEntitlement.findUnique({
      where: { userId: actor.id },
      select: { entitlementSnapshot: true },
    });
    const merged = mergeEntitlementSnapshots(
      existing?.entitlementSnapshot as EntitlementSnapshot | null,
      actorMaxEntitlementSnapshot(),
    );
    const sanitized = sanitizeEntitlementSnapshot(merged);
    if (!sanitized) continue;
    await prisma.userEntitlement.upsert({
      where: { userId: actor.id },
      create: { userId: actor.id, entitlementSnapshot: sanitized as Prisma.InputJsonValue },
      update: { entitlementSnapshot: sanitized as Prisma.InputJsonValue },
    });
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
  console.log(`[actor:simulate] actor_entitlements_upserted=${actorEntitlementsCount}`);

  await prisma.$disconnect();
};

main().catch((error) => {
  console.error("[actor:simulate] failed", error);
  process.exit(1);
});
