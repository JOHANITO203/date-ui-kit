import { config as loadEnv } from "dotenv";
import { PrismaClient } from "@prisma/client";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../../../../");
const serviceDir = path.resolve(__dirname, "..");

loadEnv({ path: path.join(rootDir, ".env") });
loadEnv({ path: path.join(serviceDir, ".env") });
loadEnv();

const requiredEnv = ["DATABASE_URL"] as const;
for (const key of requiredEnv) {
  if (!process.env[key] || process.env[key]!.trim().length === 0) {
    throw new Error(`Missing required env: ${key}`);
  }
}

const prisma = new PrismaClient();

const anchorEmails = (
  process.env.SEED_INTERACTIONS_ANCHOR_EMAILS ??
  "johaneoyaraht@gmail.com,johanito203@gmail.com"
)
  .split(",")
  .map((entry) => entry.trim().toLowerCase())
  .filter(Boolean);

const parseSeedEmail = (email: string | undefined) =>
  Boolean(email && /^seed\.(moscow|saint-petersburg|voronezh|sochi)\.\d+@exotic\.local$/i.test(email));

const nowIso = () => new Date().toISOString();

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

const relationStateForIndex = (index: number): "active" | "blocked_by_me" | "blocked_me" => {
  if (index % 7 === 0) return "blocked_by_me";
  if (index % 11 === 0) return "blocked_me";
  return "active";
};

const main = async () => {
  try {
    const allUsers = await prisma.user.findMany({
      where: { email: { contains: "@exotic.local" } },
      select: { id: true, email: true },
    });

    const anchorUsers = await prisma.user.findMany({
      where: { email: { in: anchorEmails } },
      select: { id: true, email: true },
    });

    const anchors = anchorUsers
      .filter((u): u is { id: string; email: string } => Boolean(u.email))
      .map((u) => ({ email: u.email!, userId: u.id }));

    if (anchors.length === 0) {
      throw new Error(`None of anchor emails found: ${anchorEmails.join(", ")}`);
    }

    const seedPeers = allUsers.filter((u) => parseSeedEmail(u.email ?? undefined));
    if (seedPeers.length === 0) {
      throw new Error("No seed users found. Run `npm run seed:profiles` first.");
    }

    const peerIds = seedPeers.map((peer) => peer.id);
    const profileRows = await prisma.profile.findMany({
      where: { userId: { in: peerIds } },
      select: { userId: true, firstName: true, birthDate: true, city: true },
    });

    const peerProfileByUserId = new Map(
      profileRows.map((row) => [row.userId, row]),
    );

    const seededConversations: Array<{ anchor: string; conversationId: string; peerId: string }> = [];

    for (const anchor of anchors) {
      const peersForAnchor = seedPeers.slice(0, 18);

      for (let i = 0; i < peersForAnchor.length; i += 1) {
        const peer = peersForAnchor[i];
        if (peer.id === anchor.userId) continue;
        const peerProfile = peerProfileByUserId.get(peer.id);
        const peerName = peerProfile?.firstName ?? "Profile";
        const peerAge = ageFromBirthDate(peerProfile?.birthDate ?? null);
        const conversationId = `seed-conv-${anchor.userId.slice(0, 8)}-${peer.id.slice(0, 8)}`;
        const relationState = relationStateForIndex(i);
        const lastText =
          relationState === "active"
            ? `Hi ${peerName}, welcome to Exotic.`
            : relationState === "blocked_by_me"
              ? "You blocked this conversation."
              : "This user blocked you.";
        const ts = nowIso();

        await prisma.chatConversation.upsert({
          where: { userId_conversationId: { userId: anchor.userId, conversationId } },
          update: {
            peerProfileId: peer.id,
            unreadCount: relationState === "active" ? (i % 3 === 0 ? 1 : 0) : 0,
            lastMessagePreview: lastText,
            lastMessageAt: new Date(ts),
            relationState,
            relationStateUpdatedAt: new Date(ts),
            receivedSuperlikeTraceAt: i % 5 === 0 ? new Date(ts) : null,
          },
          create: {
            userId: anchor.userId,
            conversationId,
            peerProfileId: peer.id,
            unreadCount: relationState === "active" ? (i % 3 === 0 ? 1 : 0) : 0,
            lastMessagePreview: lastText,
            lastMessageAt: new Date(ts),
            relationState,
            relationStateUpdatedAt: new Date(ts),
            receivedSuperlikeTraceAt: i % 5 === 0 ? new Date(ts) : null,
          },
        });

        const msgInId = `seed-msg-in-${anchor.userId.slice(0, 8)}-${peer.id.slice(0, 8)}`;
        await prisma.chatMessage.upsert({
          where: { userId_messageId: { userId: anchor.userId, messageId: msgInId } },
          update: {
            conversationId,
            senderUserId: peer.id,
            direction: "incoming",
            originalText:
              relationState === "active"
                ? `Hi, I am ${peerName}, ${peerAge}.`
                : relationState === "blocked_by_me"
                  ? "Conversation blocked by you."
                  : "Conversation restricted by peer.",
            translated: false,
            createdAt: new Date(ts),
          },
          create: {
            userId: anchor.userId,
            messageId: msgInId,
            conversationId,
            senderUserId: peer.id,
            direction: "incoming",
            originalText:
              relationState === "active"
                ? `Hi, I am ${peerName}, ${peerAge}.`
                : relationState === "blocked_by_me"
                  ? "Conversation blocked by you."
                  : "Conversation restricted by peer.",
            translated: false,
            createdAt: new Date(ts),
          },
        });

        const msgOutId = `seed-msg-out-${anchor.userId.slice(0, 8)}-${peer.id.slice(0, 8)}`;
        await prisma.chatMessage.upsert({
          where: { userId_messageId: { userId: anchor.userId, messageId: msgOutId } },
          update: {
            conversationId,
            senderUserId: anchor.userId,
            direction: "outgoing",
            originalText: relationState === "active" ? "Nice to meet you too." : "State synced.",
            translated: false,
            createdAt: new Date(ts),
            readAt: relationState === "active" ? new Date(ts) : null,
          },
          create: {
            userId: anchor.userId,
            messageId: msgOutId,
            conversationId,
            senderUserId: anchor.userId,
            direction: "outgoing",
            originalText: relationState === "active" ? "Nice to meet you too." : "State synced.",
            translated: false,
            createdAt: new Date(ts),
            readAt: relationState === "active" ? new Date(ts) : null,
          },
        });

        seededConversations.push({ anchor: anchor.email, conversationId, peerId: peer.id });
      }

      const blockedPeers = peersForAnchor.slice(0, 3);
      for (const blocked of blockedPeers) {
        await prisma.safetyBlock.upsert({
          where: { userId_blockedUserId: { userId: anchor.userId, blockedUserId: blocked.id } },
          update: {},
          create: { userId: anchor.userId, blockedUserId: blocked.id },
        });
      }

      const reportPeer = peersForAnchor[3];
      if (reportPeer) {
        const reportId = `seed-report-${anchor.userId.slice(0, 8)}-${reportPeer.id.slice(0, 8)}`;
        await prisma.safetyReport.upsert({
          where: { userId_reportId: { userId: anchor.userId, reportId } },
          update: {},
          create: {
            userId: anchor.userId,
            reportId,
            reportedUserId: reportPeer.id,
            reason: "other",
            note: "Seed report for QA scenarios",
            createdAt: new Date(nowIso()),
          },
        });
      }
    }

    console.log("[seed:interactions] done");
    console.log(`[seed:interactions] anchors=${anchors.length}`);
    console.log(`[seed:interactions] conversations_upserted=${seededConversations.length}`);
    console.table(seededConversations.slice(0, 12));
  } finally {
    await prisma.$disconnect();
  }
};

main().catch((error) => {
  console.error("[seed:interactions] failed", error);
  process.exit(1);
});
