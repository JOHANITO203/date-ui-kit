import { config as loadEnv } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { S3Client, PutObjectCommand, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import bcrypt from "bcryptjs";
import sharp from "sharp";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type LaunchServerCode = "moscow" | "saint-petersburg" | "voronezh" | "sochi";

type LaunchServerConfig = {
  code: LaunchServerCode;
  city: string;
  country: string;
  languages: string[];
};

type SeedUser = {
  email: string;
  password: string;
  firstName: string;
  birthDate: string;
  city: string;
  country: string;
  languages: string[];
  interests: string[];
  gender: "men" | "women";
};

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
const publicBucket = process.env.S3_BUCKET_PUBLIC?.trim() || "profile-photos-public";
const seedPassword = process.env.SEED_PROFILE_PASSWORD?.trim() || "ExoticSeed!2026";
const seedPerServer = Number(process.env.SEED_PER_SERVER ?? "13");
const shouldReset = process.env.SEED_RESET === "1";

const assetsRoot =
  process.env.SEED_ASSETS_DIR?.trim() || path.join(rootDir, "seed-assets", "launch-servers");

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

const launchServers: LaunchServerConfig[] = [
  { code: "moscow", city: "Moscow", country: "russian", languages: ["Russian", "English"] },
  {
    code: "saint-petersburg",
    city: "Saint Petersburg",
    country: "russian",
    languages: ["Russian", "English"],
  },
  { code: "voronezh", city: "Voronezh", country: "russian", languages: ["Russian", "English"] },
  { code: "sochi", city: "Sochi", country: "russian", languages: ["Russian", "English"] },
];

const femaleNames = [
  "Anastasia",
  "Sofia",
  "Elena",
  "Daria",
  "Alina",
  "Mila",
  "Viktoria",
  "Yana",
  "Polina",
  "Maria",
  "Eva",
  "Lina",
  "Ksenia",
  "Nika",
  "Olga",
];

const maleNames = [
  "Nikita",
  "Artem",
  "Maksim",
  "Denis",
  "Ivan",
  "Roman",
  "Egor",
  "Kirill",
  "Sergey",
  "Andrei",
  "Dmitry",
  "Pavel",
  "Timur",
  "Alexei",
  "Mikhail",
];

const interestsPool = [
  "Travel",
  "Fitness",
  "Music",
  "Cinema",
  "Photography",
  "Art",
  "Books",
  "Food",
  "Tech",
  "Business",
  "Nature",
  "Fashion",
  "Design",
  "Sport",
  "Culture",
];

const allowedExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);

const shuffle = <T>(source: T[]): T[] => {
  const result = [...source];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

const randomBirthDate = () => {
  const now = new Date();
  const year = now.getUTCFullYear() - (21 + Math.floor(Math.random() * 9));
  const month = 1 + Math.floor(Math.random() * 12);
  const day = 1 + Math.floor(Math.random() * 28);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

const pickInterests = () => shuffle(interestsPool).slice(0, 4);

const safeFileName = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, "_");

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
    .resize({
      width: preset.width,
      height: preset.height,
      fit: preset.fit,
      withoutEnlargement: true,
    })
    .jpeg({ quality: preset.quality, mozjpeg: true })
    .toBuffer();
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const withRetry = async <T>(label: string, fn: () => Promise<T>, maxAttempts = 4): Promise<T> => {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        await sleep(450 * attempt);
      }
    }
  }
  throw new Error(`${label} failed after ${maxAttempts} attempts: ${String(lastError)}`);
};

const readImagesForServer = async (serverCode: LaunchServerCode) => {
  const folder = path.join(assetsRoot, serverCode);
  const entries = await fs.readdir(folder, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(folder, entry.name))
    .filter((fullPath) => allowedExtensions.has(path.extname(fullPath).toLowerCase()));

  if (files.length < seedPerServer) {
    throw new Error(
      `Not enough images for ${serverCode}. Found ${files.length}, expected at least ${seedPerServer} in ${folder}`,
    );
  }

  return files.slice(0, seedPerServer);
};

const findUserByEmail = async (email: string) => {
  return prisma.user.findUnique({ where: { email: email.toLowerCase() } });
};

const ensureUser = async (seedUser: SeedUser) => {
  const existing = await findUserByEmail(seedUser.email);
  if (existing && shouldReset) {
    await prisma.user.delete({ where: { id: existing.id } });
  }

  const maybeExistingAfterReset = shouldReset ? null : existing;
  if (maybeExistingAfterReset) return maybeExistingAfterReset.id;

  const passwordHash = await bcrypt.hash(seedUser.password, 12);
  const created = await prisma.user.create({
    data: {
      email: seedUser.email,
      passwordHash,
      role: "member",
      emailVerified: true,
      profile: {
        create: {
          firstName: seedUser.firstName,
          locale: "en",
          birthDate: seedUser.birthDate,
          gender: seedUser.gender,
          city: seedUser.city,
          originCountry: seedUser.country,
          languages: seedUser.languages,
          intent: "dating",
          interests: seedUser.interests,
          bio: `${seedUser.firstName} is looking for meaningful connections in ${seedUser.city}.`,
          onboardingVersion: "v1",
          verifiedOptIn: false,
          photosCount: 1,
        },
      },
      settings: {
        create: {
          language: "en",
          targetLang: "ru",
          autoTranslate: true,
          autoDetectLanguage: true,
          notificationsEnabled: true,
          preciseLocationEnabled: true,
          distanceKm: 60,
          ageMin: 18,
          ageMax: 40,
          genderPreference: "everyone",
        },
      },
    },
  });

  return created.id;
};

const resetExistingPhotos = async (userId: string) => {
  const rows = await prisma.profilePhoto.findMany({
    where: { userId },
    select: { storagePath: true },
  });

  const storagePaths = rows.map((row) => row.storagePath).filter(Boolean);
  if (storagePaths.length > 0) {
    try {
      await withRetry(`remove storage objects for ${userId}`, async () => {
        await s3.send(
          new DeleteObjectsCommand({
            Bucket: privateBucket,
            Delete: { Objects: storagePaths.map((Key) => ({ Key })) },
          }),
        );
      });
    } catch {
      // Keep seed resilient on unstable network/storage endpoint.
    }
  }

  await prisma.profilePhoto.deleteMany({ where: { userId } });
};

const upsertProfileAndSettings = async (userId: string, seedUser: SeedUser) => {
  await prisma.profile.upsert({
    where: { userId },
    update: {
      firstName: seedUser.firstName,
      locale: "en",
      birthDate: seedUser.birthDate,
      gender: seedUser.gender,
      city: seedUser.city,
      originCountry: seedUser.country,
      languages: seedUser.languages,
      intent: "dating",
      interests: seedUser.interests,
      bio: `${seedUser.firstName} is looking for meaningful connections in ${seedUser.city}.`,
      onboardingVersion: "v1",
      verifiedOptIn: false,
      photosCount: 1,
    },
    create: {
      userId,
      firstName: seedUser.firstName,
      locale: "en",
      birthDate: seedUser.birthDate,
      gender: seedUser.gender,
      city: seedUser.city,
      originCountry: seedUser.country,
      languages: seedUser.languages,
      intent: "dating",
      interests: seedUser.interests,
      bio: `${seedUser.firstName} is looking for meaningful connections in ${seedUser.city}.`,
      onboardingVersion: "v1",
      verifiedOptIn: false,
      photosCount: 1,
    },
  });

  await prisma.userSettings.upsert({
    where: { userId },
    update: {
      language: "en",
      targetLang: "ru",
      autoTranslate: true,
      autoDetectLanguage: true,
      notificationsEnabled: true,
      preciseLocationEnabled: true,
      distanceKm: 60,
      ageMin: 18,
      ageMax: 40,
      genderPreference: "everyone",
    },
    create: {
      userId,
      language: "en",
      targetLang: "ru",
      autoTranslate: true,
      autoDetectLanguage: true,
      notificationsEnabled: true,
      preciseLocationEnabled: true,
      distanceKm: 60,
      ageMin: 18,
      ageMax: 40,
      genderPreference: "everyone",
    },
  });
};

const uploadPrimaryPhoto = async (userId: string, localImagePath: string) => {
  const fileBuffer = await fs.readFile(localImagePath);
  const ext = path.extname(localImagePath).toLowerCase() || ".jpg";
  const objectPath = `${userId}/seed/${Date.now()}-${safeFileName(path.basename(localImagePath))}`;
  const contentType =
    ext === ".png"
      ? "image/png"
      : ext === ".webp"
        ? "image/webp"
        : "image/jpeg";

  await withRetry(`upload photo ${objectPath}`, async () => {
    await s3.send(
      new PutObjectCommand({
        Bucket: privateBucket,
        Key: objectPath,
        Body: fileBuffer,
        ContentType: contentType,
      }),
    );
  });

  await withRetry(`insert profile_photos row for ${userId}`, async () => {
    await prisma.profilePhoto.create({
      data: {
        userId,
        storagePath: objectPath,
        sortOrder: 1,
        isPrimary: true,
      },
    });
  });

  const variants: PhotoVariant[] = ["card", "avatar", "profile"];
  for (const variant of variants) {
    await withRetry(`upload public ${variant} variant for ${objectPath}`, async () => {
      const optimized = await optimizeVariant(fileBuffer, variant);
      const variantPath = toVariantPath(objectPath, variant);
      await s3.send(
        new PutObjectCommand({
          Bucket: publicBucket,
          Key: variantPath,
          Body: optimized,
          ContentType: "image/jpeg",
          CacheControl: "public, max-age=31536000, immutable",
        }),
      );
    });
  }
};

const buildSeedUser = (server: LaunchServerConfig, index: number): SeedUser => {
  const useFemale = index % 2 === 0;
  const firstNamePool = useFemale ? femaleNames : maleNames;
  const firstName = firstNamePool[index % firstNamePool.length];
  return {
    email: `seed.${server.code}.${index + 1}@exotic.local`,
    password: seedPassword,
    firstName,
    birthDate: randomBirthDate(),
    city: server.city,
    country: server.country,
    languages: server.languages,
    interests: pickInterests(),
    gender: useFemale ? "women" : "men",
  };
};

const main = async () => {
  console.log(`[seed:profiles] assetsRoot=${assetsRoot}`);
  console.log(`[seed:profiles] bucket=${privateBucket}`);
  console.log(`[seed:profiles] perServer=${seedPerServer}`);
  console.log(`[seed:profiles] reset=${shouldReset ? "yes" : "no"}`);

  const created: Array<{ email: string; userId: string; city: string }> = [];

  try {
    for (const server of launchServers) {
      const images = await readImagesForServer(server.code);

      for (let i = 0; i < seedPerServer; i += 1) {
        const seedUser = buildSeedUser(server, i);
        const image = images[i];
        const userId = await ensureUser(seedUser);
        await upsertProfileAndSettings(userId, seedUser);
        await resetExistingPhotos(userId);
        try {
          await uploadPrimaryPhoto(userId, image);
        } catch (error) {
          await prisma.profile.update({ where: { userId }, data: { photosCount: 0 } });
          console.warn(`[seed:profiles] photo upload skipped for ${seedUser.email}: ${String(error)}`);
        }
        created.push({ email: seedUser.email, userId, city: server.city });
        console.log(`[seed:profiles] ok ${seedUser.email} (${server.city})`);
      }
    }

    console.log("\n[seed:profiles] done");
    console.table(created.slice(0, 12));
    console.log(`[seed:profiles] total=${created.length}`);
  } finally {
    await prisma.$disconnect();
  }
};

main().catch((error) => {
  console.error("[seed:profiles] failed", error);
  process.exit(1);
});
