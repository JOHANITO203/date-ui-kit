import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
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

const requiredEnv = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE"] as const;
for (const key of requiredEnv) {
  if (!process.env[key] || process.env[key]!.trim().length === 0) {
    throw new Error(`Missing required env: ${key}`);
  }
}

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE!;
const bucket = process.env.STORAGE_PROFILE_PHOTOS_BUCKET?.trim() || "profile-photos";
const publicBucket =
  process.env.STORAGE_PROFILE_PHOTOS_PUBLIC_BUCKET?.trim() || "profile-photos-public";
const seedPassword = process.env.SEED_PROFILE_PASSWORD?.trim() || "ExoticSeed!2026";
const seedPerServer = Number(process.env.SEED_PER_SERVER ?? "13");
const shouldReset = process.env.SEED_RESET === "1";

const assetsRoot =
  process.env.SEED_ASSETS_DIR?.trim() || path.join(rootDir, "seed-assets", "launch-servers");

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

const supabase = createClient(supabaseUrl, supabaseServiceRole, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

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
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const users = data.users ?? [];
    const found = users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (users.length < perPage) break;
    page += 1;
  }

  return null;
};

const ensureUser = async (seedUser: SeedUser) => {
  const existing = await findUserByEmail(seedUser.email);
  if (existing && shouldReset) {
    const { error: deleteError } = await supabase.auth.admin.deleteUser(existing.id);
    if (deleteError) throw deleteError;
  }

  const maybeExistingAfterReset = shouldReset ? null : existing;
  if (maybeExistingAfterReset) return maybeExistingAfterReset.id;

  const { data, error } = await supabase.auth.admin.createUser({
    email: seedUser.email,
    password: seedUser.password,
    email_confirm: true,
    user_metadata: {
      source: "seed_profiles_v1",
      first_name: seedUser.firstName,
      launch_city: seedUser.city,
    },
  });

  if (error) throw error;
  if (!data.user?.id) throw new Error(`Unable to create user for ${seedUser.email}`);
  return data.user.id;
};

const resetExistingPhotos = async (userId: string) => {
  const { data: rows, error: readError } = await supabase
    .from("profile_photos")
    .select("id,storage_path")
    .eq("user_id", userId);
  if (readError) throw readError;

  const storagePaths = (rows ?? []).map((row) => row.storage_path).filter(Boolean);
  if (storagePaths.length > 0) {
    try {
      await withRetry(`remove storage objects for ${userId}`, async () => {
        const { error } = await supabase.storage.from(bucket).remove(storagePaths);
        if (error) throw error;
      });
    } catch {
      // Keep seed resilient on unstable network/storage endpoint.
    }
  }

  const { error: deleteError } = await supabase.from("profile_photos").delete().eq("user_id", userId);
  if (deleteError) throw deleteError;
};

const upsertProfileAndSettings = async (userId: string, seedUser: SeedUser) => {
  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      user_id: userId,
      first_name: seedUser.firstName,
      locale: "en",
      birth_date: seedUser.birthDate,
      gender: seedUser.gender,
      city: seedUser.city,
      origin_country: seedUser.country,
      languages: seedUser.languages,
      intent: "dating",
      interests: seedUser.interests,
      bio: `${seedUser.firstName} is looking for meaningful connections in ${seedUser.city}.`,
      onboarding_version: "v1",
      verified_opt_in: false,
      photos_count: 1,
    },
    { onConflict: "user_id" },
  );
  if (profileError) throw profileError;

  const { error: settingsError } = await supabase.from("settings").upsert(
    {
      user_id: userId,
      language: "en",
      target_lang: "ru",
      auto_translate: true,
      auto_detect_language: true,
      notifications_enabled: true,
      precise_location_enabled: true,
      distance_km: 60,
      age_min: 18,
      age_max: 40,
      gender_preference: "everyone",
    },
    { onConflict: "user_id" },
  );
  if (settingsError) throw settingsError;
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
    const { error: uploadError } = await supabase.storage.from(bucket).upload(objectPath, fileBuffer, {
      contentType,
      upsert: true,
    });
    if (uploadError) throw uploadError;
  });

  await withRetry(`insert profile_photos row for ${userId}`, async () => {
    const { error: insertPhotoError } = await supabase.from("profile_photos").insert({
      user_id: userId,
      storage_path: objectPath,
      sort_order: 1,
      is_primary: true,
    });
    if (insertPhotoError) throw insertPhotoError;
  });

  await withRetry(`upload public variant for ${objectPath}`, async () => {
    const { error: publicError } = await supabase.storage.from(publicBucket).upload(objectPath, fileBuffer, {
      contentType,
      cacheControl: "public, max-age=31536000, immutable",
      upsert: true,
    });
    if (publicError) throw publicError;
  });
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
  console.log(`[seed:profiles] bucket=${bucket}`);
  console.log(`[seed:profiles] perServer=${seedPerServer}`);
  console.log(`[seed:profiles] reset=${shouldReset ? "yes" : "no"}`);

  const created: Array<{ email: string; userId: string; city: string }> = [];

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
        await supabase.from("profiles").update({ photos_count: 0 }).eq("user_id", userId);
        console.warn(`[seed:profiles] photo upload skipped for ${seedUser.email}: ${String(error)}`);
      }
      created.push({ email: seedUser.email, userId, city: server.city });
      console.log(`[seed:profiles] ok ${seedUser.email} (${server.city})`);
    }
  }

  console.log("\n[seed:profiles] done");
  console.table(created.slice(0, 12));
  console.log(`[seed:profiles] total=${created.length}`);
};

main().catch((error) => {
  console.error("[seed:profiles] failed", error);
  process.exit(1);
});
