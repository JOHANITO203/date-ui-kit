import { config as loadEnv } from "dotenv";
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../../../../");
const serviceDir = path.resolve(__dirname, "..");

loadEnv({ path: path.join(rootDir, ".env") });
loadEnv({ path: path.join(serviceDir, ".env"), override: true });
loadEnv();

type LaunchServerCode = "moscow" | "saint-petersburg" | "voronezh" | "sochi";

const privateBucket = process.env.S3_BUCKET_PRIVATE?.trim() || "profile-photos";
const publicBucket = process.env.S3_BUCKET_PUBLIC?.trim() || "profile-photos-public";
const assetsRoot =
  process.env.SEED_ASSETS_DIR?.trim() || path.join(rootDir, "seed-assets", "launch-servers");

const prisma = new PrismaClient();
const allowedExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

const optimizeVariant = async (buffer: Buffer, variant: PhotoVariant) => {
  const preset = VARIANT_PRESETS[variant];
  return sharp(buffer, { failOnError: false })
    .rotate()
    .resize({ width: preset.width, height: preset.height, fit: preset.fit, withoutEnlargement: true })
    .jpeg({ quality: preset.quality, mozjpeg: true })
    .toBuffer();
};

const withRetry = async <T>(label: string, fn: () => Promise<T>, maxAttempts = 5): Promise<T> => {
  let lastError: unknown;
  for (let i = 1; i <= maxAttempts; i += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < maxAttempts) await sleep(450 * i);
    }
  }
  throw new Error(`${label} failed after ${maxAttempts} attempts: ${String(lastError)}`);
};

const parseSeedEmail = (email: string | undefined): { server: LaunchServerCode; index: number } | null => {
  if (!email) return null;
  const normalized = email.trim().toLowerCase();
  const match = /^seed\.(moscow|saint-petersburg|voronezh|sochi)\.(\d+)@exotic\.local$/.exec(normalized);
  if (!match) return null;
  const index = Number(match[2]);
  if (!Number.isFinite(index) || index <= 0) return null;
  return { server: match[1] as LaunchServerCode, index };
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

const resolveImageForSeedUser = async (email: string) => {
  const parsed = parseSeedEmail(email);
  if (!parsed) return null;
  const folder = path.join(assetsRoot, parsed.server);
  try {
    const entries = await fs.readdir(folder, { withFileTypes: true });
    const files = entries
      .filter((entry) => entry.isFile())
      .map((entry) => path.join(folder, entry.name))
      .filter((fullPath) => allowedExtensions.has(path.extname(fullPath).toLowerCase()))
      .sort((a, b) => a.localeCompare(b));
    return files[parsed.index - 1] ?? null;
  } catch {
    return null;
  }
};

const uploadSinglePhoto = async (
  s3: Awaited<ReturnType<typeof buildS3Client>>,
  userId: string,
  localImagePath: string,
) => {
  const ext = path.extname(localImagePath).toLowerCase();
  const contentType = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
  const body = await fs.readFile(localImagePath);
  const objectPath = `${userId}/seed/${Date.now()}-${path.basename(localImagePath)}`;

  await withRetry(`upload ${objectPath}`, () =>
    uploadObject(s3, privateBucket, objectPath, body, contentType),
  );

  await withRetry(`insert profile_photos ${userId}`, () =>
    prisma.profilePhoto.create({
      data: { userId, storagePath: objectPath, sortOrder: 1, isPrimary: true },
    }).then(() => undefined),
  );

  for (const variant of ["card", "avatar", "profile"] as PhotoVariant[]) {
    await withRetry(`upload ${variant} variant ${objectPath}`, async () => {
      const optimized = await optimizeVariant(body, variant);
      await uploadObject(s3, publicBucket, toVariantPath(objectPath, variant), optimized, "image/jpeg");
    });
  }

  await prisma.profile.update({ where: { userId }, data: { photosCount: 1 } }).catch(() => undefined);
};

const main = async () => {
  const s3 = await buildS3Client();

  const seedUsers = await prisma.user.findMany({
    where: { email: { contains: "@exotic.local" } },
    select: { id: true, email: true },
  });

  let filled = 0;
  let skipped = 0;

  for (const user of seedUsers) {
    if (!parseSeedEmail(user.email)) { skipped += 1; continue; }

    const photoCount = await prisma.profilePhoto.count({ where: { userId: user.id } });
    if (photoCount > 0) { skipped += 1; continue; }

    const imagePath = await resolveImageForSeedUser(user.email);
    if (!imagePath) {
      console.warn(`[seed:photos:retry] missing source image for ${user.email}`);
      skipped += 1;
      continue;
    }

    try {
      await uploadSinglePhoto(s3, user.id, imagePath);
      filled += 1;
      console.log(`[seed:photos:retry] filled ${user.email}`);
    } catch (uploadError) {
      console.warn(`[seed:photos:retry] failed for ${user.email}: ${String(uploadError)}`);
      skipped += 1;
    }
  }

  console.log(`[seed:photos:retry] done filled=${filled} skipped=${skipped}`);
  await prisma.$disconnect();
};

main().catch((error) => {
  console.error("[seed:photos:retry] failed", error);
  process.exit(1);
});
