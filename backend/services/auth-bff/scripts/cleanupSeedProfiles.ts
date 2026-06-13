import { config as loadEnv } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { S3Client, DeleteObjectsCommand } from "@aws-sdk/client-s3";
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

const privateBucket = process.env.S3_BUCKET_PRIVATE?.trim() || "profile-photos";

const prisma = new PrismaClient();

const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT || "http://localhost:9000",
  region: process.env.S3_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || "minioadmin",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "minioadmin",
  },
  forcePathStyle: true,
});

const isSeedEmail = (email: string | null) =>
  Boolean(email && /^seed\.(moscow|saint-petersburg|voronezh|sochi)\.\d+@exotic\.local$/i.test(email));

const main = async () => {
  try {
    const seedUsers = await prisma.user.findMany({
      where: { email: { endsWith: "@exotic.local" } },
      select: { id: true, email: true },
    });

    const filtered = seedUsers.filter((u) => isSeedEmail(u.email));
    const seedIds = filtered.map((u) => u.id);

    if (seedIds.length === 0) {
      console.log("[seed:cleanup] no seed users found");
      return;
    }

    // Cleanup seeded interaction artifacts from anchor users (conversation/message ids prefixed by seed-).
    await prisma.chatMessage.deleteMany({ where: { messageId: { startsWith: "seed-msg-" } } });
    await prisma.chatConversation.deleteMany({ where: { conversationId: { startsWith: "seed-conv-" } } });
    await prisma.safetyReport.deleteMany({ where: { reportId: { startsWith: "seed-report-" } } });

    // Remove rows where seed users were peers in safety tables.
    await prisma.safetyBlock.deleteMany({ where: { blockedUserId: { in: seedIds } } });
    await prisma.safetyReport.deleteMany({ where: { reportedUserId: { in: seedIds } } });

    // Collect and remove storage objects first.
    const photoRows = await prisma.profilePhoto.findMany({
      where: { userId: { in: seedIds } },
      select: { storagePath: true },
    });
    const storagePaths = photoRows
      .map((row) => row.storagePath)
      .filter((value): value is string => typeof value === "string" && value.length > 0);

    if (storagePaths.length > 0) {
      await s3.send(
        new DeleteObjectsCommand({
          Bucket: privateBucket,
          Delete: { Objects: storagePaths.map((Key) => ({ Key })) },
        }),
      );
    }

    // Delete seed users (cascades profiles/settings/profile_photos/other FK-based rows).
    await prisma.user.deleteMany({ where: { email: { endsWith: "@exotic.local" } } });

    console.log(`[seed:cleanup] done seedUsers=${seedIds.length} storageObjects=${storagePaths.length}`);
  } finally {
    await prisma.$disconnect();
  }
};

main().catch((error) => {
  console.error("[seed:cleanup] failed", error);
  process.exit(1);
});
