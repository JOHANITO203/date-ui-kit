import { config as loadEnv } from "dotenv";
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../../../../");
const serviceDir = path.resolve(__dirname, "..");

loadEnv({ path: path.join(rootDir, ".env") });
loadEnv({ path: path.join(serviceDir, ".env"), override: true });
loadEnv();

const privateBucket = process.env.S3_BUCKET_PRIVATE?.trim() || "profile-photos";
const publicBucket = process.env.S3_BUCKET_PUBLIC?.trim() || "profile-photos-public";
const BATCH_SIZE = 200;
const SLEEP_MS = 45;

const prisma = new PrismaClient();

type PhotoVariant = "card" | "avatar" | "profile";
const VARIANT_PRESETS: Record<
  PhotoVariant,
  { width: number; height: number; fit: "inside" | "cover"; quality: number }
> = {
  card: { width: 720, height: 960, fit: "inside", quality: 76 },
  avatar: { width: 256, height: 256, fit: "cover", quality: 72 },
  profile: { width: 1080, height: 1440, fit: "inside", quality: 78 },
};

const toVariantPath = (storagePath: string, variant: PhotoVariant) => {
  const clean = storagePath.replace(/^\/+/, "");
  const withoutExt = clean.replace(/\.[^/.]+$/, "");
  return `variants/${variant}/${withoutExt}.jpg`;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const inferContentType = (storagePath: string) => {
  const ext = path.extname(storagePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".heic" || ext === ".heif") return "image/heic";
  return "image/jpeg";
};

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isLegacyPath = (storagePath: string, userId: string) => {
  const top = storagePath.split("/")[0] ?? "";
  return !top || !uuidRe.test(top) || top !== userId;
};

const normalizeLegacyPath = (photoId: string, userId: string, storagePath: string) => {
  const filename = path.basename(storagePath).replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${userId}/legacy/${photoId}-${filename}`;
};

const buildS3Client = async () => {
  const { S3Client } = await import("@aws-sdk/client-s3");
  return new S3Client({
    region: process.env.S3_REGION || "us-east-1",
    endpoint: process.env.S3_ENDPOINT || undefined,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
    forcePathStyle: Boolean(process.env.S3_ENDPOINT),
  });
};

const downloadObject = async (s3: Awaited<ReturnType<typeof buildS3Client>>, bucket: string, key: string): Promise<Buffer> => {
  const { GetObjectCommand } = await import("@aws-sdk/client-s3");
  const response = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!response.Body) throw new Error(`empty_body:${key}`);
  return Buffer.from(await response.Body.transformToByteArray());
};

const uploadObject = async (
  s3: Awaited<ReturnType<typeof buildS3Client>>,
  bucket: string,
  key: string,
  body: Buffer,
  contentType: string,
) => {
  const { PutObjectCommand } = await import("@aws-sdk/client-s3");
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }));
};

const deleteObjects = async (s3: Awaited<ReturnType<typeof buildS3Client>>, bucket: string, keys: string[]) => {
  if (keys.length === 0) return;
  const { DeleteObjectsCommand } = await import("@aws-sdk/client-s3");
  await s3.send(new DeleteObjectsCommand({
    Bucket: bucket,
    Delete: { Objects: keys.map((Key) => ({ Key })) },
  })).catch(() => undefined);
};

const optimizeVariant = async (buffer: Buffer, variant: PhotoVariant) => {
  const preset = VARIANT_PRESETS[variant];
  return sharp(buffer, { failOnError: false })
    .rotate()
    .resize({ width: preset.width, height: preset.height, fit: preset.fit, withoutEnlargement: true })
    .jpeg({ quality: preset.quality, mozjpeg: true })
    .toBuffer();
};

const main = async () => {
  console.log(`[backfill:variants] privateBucket=${privateBucket} publicBucket=${publicBucket}`);
  const s3 = await buildS3Client();
  const stats = { scanned: 0, repairedVariants: 0, migratedLegacy: 0, failed: 0 };

  let cursor: string | undefined;
  while (true) {
    const rows = await prisma.profilePhoto.findMany({
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { createdAt: "asc" },
      select: { id: true, userId: true, storagePath: true },
    });
    if (rows.length === 0) break;
    cursor = rows[rows.length - 1].id;

    for (const row of rows) {
      if (!row.storagePath) continue;
      stats.scanned += 1;

      try {
        const sourceBuffer = await downloadObject(s3, privateBucket, row.storagePath);
        let effectivePath = row.storagePath;

        if (isLegacyPath(row.storagePath, row.userId)) {
          const normalizedPath = normalizeLegacyPath(row.id, row.userId, row.storagePath);
          await uploadObject(s3, privateBucket, normalizedPath, sourceBuffer, inferContentType(row.storagePath));
          await prisma.profilePhoto.update({ where: { id: row.id }, data: { storagePath: normalizedPath } });
          const oldVariants = (["card", "avatar", "profile"] as const).map((v) => toVariantPath(row.storagePath, v));
          await deleteObjects(s3, publicBucket, [...oldVariants, row.storagePath]);
          effectivePath = normalizedPath;
          stats.migratedLegacy += 1;
        }

        const variants: PhotoVariant[] = ["card", "avatar", "profile"];
        for (const variant of variants) {
          const optimized = await optimizeVariant(sourceBuffer, variant);
          await uploadObject(s3, publicBucket, toVariantPath(effectivePath, variant), optimized, "image/jpeg");
        }
        stats.repairedVariants += 1;
      } catch (err) {
        stats.failed += 1;
        console.warn(`[backfill:variants] skip ${row.storagePath}: ${String(err)}`);
      }

      if (stats.scanned % 25 === 0) {
        console.log(`[backfill:variants] scanned=${stats.scanned} repaired=${stats.repairedVariants} legacy=${stats.migratedLegacy} failed=${stats.failed}`);
      }
      await sleep(SLEEP_MS);
    }
  }

  console.log(`[backfill:variants] done scanned=${stats.scanned} repaired=${stats.repairedVariants} legacy=${stats.migratedLegacy} failed=${stats.failed}`);
  await prisma.$disconnect();
};

main().catch((error) => {
  console.error("[backfill:variants] failed", error);
  process.exit(1);
});
