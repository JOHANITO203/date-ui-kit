import { config as loadEnv } from "dotenv";
import { createClient, type User } from "@supabase/supabase-js";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type LaunchServerCode = "moscow" | "saint-petersburg" | "voronezh" | "sochi";

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

const bucket = process.env.STORAGE_PROFILE_PHOTOS_BUCKET?.trim() || "profile-photos";
const assetsRoot =
  process.env.SEED_ASSETS_DIR?.trim() || path.join(rootDir, "seed-assets", "launch-servers");

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const allowedExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);

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
  return {
    server: match[1] as LaunchServerCode,
    index,
  };
};

const getSeedUsers = async (): Promise<User[]> => {
  const result: User[] = [];
  let page = 1;
  const perPage = 200;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data.users ?? [];
    result.push(...users.filter((user) => Boolean(parseSeedEmail(user.email))));
    if (users.length < perPage) break;
    page += 1;
  }
  return result;
};

const resolveImageForSeedUser = async (email: string) => {
  const parsed = parseSeedEmail(email);
  if (!parsed) return null;
  const folder = path.join(assetsRoot, parsed.server);
  const entries = await fs.readdir(folder, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(folder, entry.name))
    .filter((fullPath) => allowedExtensions.has(path.extname(fullPath).toLowerCase()))
    .sort((a, b) => a.localeCompare(b));
  const target = files[parsed.index - 1];
  return target ?? null;
};

const uploadSinglePhoto = async (userId: string, localImagePath: string) => {
  const ext = path.extname(localImagePath).toLowerCase();
  const contentType =
    ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
  const body = await fs.readFile(localImagePath);
  const objectPath = `${userId}/seed/${Date.now()}-${path.basename(localImagePath)}`;

  await withRetry(`upload ${objectPath}`, async () => {
    const { error } = await supabase.storage.from(bucket).upload(objectPath, body, {
      contentType,
      upsert: true,
    });
    if (error) throw error;
  });

  await withRetry(`insert profile_photos ${userId}`, async () => {
    const { error } = await supabase.from("profile_photos").insert({
      user_id: userId,
      storage_path: objectPath,
      sort_order: 1,
      is_primary: true,
    });
    if (error) throw error;
  });

  await supabase.from("profiles").update({ photos_count: 1 }).eq("user_id", userId);
};

const main = async () => {
  const users = await getSeedUsers();
  let filled = 0;
  let skipped = 0;

  for (const user of users) {
    const userId = user.id;
    const email = user.email ?? user.id;
    const { count, error } = await supabase
      .from("profile_photos")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    if (error) throw error;

    if ((count ?? 0) > 0) {
      skipped += 1;
      continue;
    }

    const imagePath = await resolveImageForSeedUser(email);
    if (!imagePath) {
      console.warn(`[seed:photos:retry] missing source image for ${email}`);
      skipped += 1;
      continue;
    }

    try {
      await uploadSinglePhoto(userId, imagePath);
      filled += 1;
      console.log(`[seed:photos:retry] filled ${email}`);
    } catch (uploadError) {
      console.warn(`[seed:photos:retry] failed for ${email}: ${String(uploadError)}`);
    }
  }

  console.log(`[seed:photos:retry] done | filled=${filled} skipped=${skipped}`);
};

main().catch((error) => {
  console.error("[seed:photos:retry] failed", error);
  process.exit(1);
});

