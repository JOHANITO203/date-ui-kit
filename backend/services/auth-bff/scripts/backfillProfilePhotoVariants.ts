import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
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

const requiredEnv = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE"] as const;
for (const key of requiredEnv) {
  if (!process.env[key] || process.env[key]!.trim().length === 0) {
    throw new Error(`Missing required env: ${key}`);
  }
}

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const sourceBucket = process.env.STORAGE_PROFILE_PHOTOS_BUCKET?.trim() || "profile-photos";
const publicBucket = process.env.STORAGE_PROFILE_PHOTOS_PUBLIC_BUCKET?.trim() || "profile-photos-public";

const BATCH_SIZE = 200;
type PhotoVariant = "card" | "avatar" | "profile";
const VARIANT_PRESETS: Record<
  PhotoVariant,
  {
    width: number;
    height: number;
    fit: "inside" | "cover";
    quality: number;
  }
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

const fetchBatch = async (offset: number) => {
  return supabase
    .from("profile_photos")
    .select("storage_path")
    .order("created_at", { ascending: true })
    .range(offset, offset + BATCH_SIZE - 1);
};

const uploadVariant = async (storagePath: string) => {
  const download = await supabase.storage.from(sourceBucket).download(storagePath);
  if (download.error || !download.data) {
    throw new Error(`download_failed:${download.error?.message ?? "unknown"}`);
  }
  const arrayBuffer = await download.data.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  if (!buffer || buffer.length === 0) {
    throw new Error("variant_empty");
  }
  const variants: PhotoVariant[] = ["card", "avatar", "profile"];
  for (const variant of variants) {
    const preset = VARIANT_PRESETS[variant];
    const optimized = await sharp(buffer, { failOnError: false })
      .rotate()
      .resize({
        width: preset.width,
        height: preset.height,
        fit: preset.fit,
        withoutEnlargement: true,
      })
      .jpeg({ quality: preset.quality, mozjpeg: true })
      .toBuffer();

    const variantPath = toVariantPath(storagePath, variant);
    const { error } = await supabase.storage.from(publicBucket).upload(variantPath, optimized, {
      contentType: "image/jpeg",
      cacheControl: "public, max-age=31536000, immutable",
      upsert: true,
    });
    if (error) throw error;
  }
};

const main = async () => {
  console.log(`[backfill:variants] sourceBucket=${sourceBucket}`);
  console.log(`[backfill:variants] publicBucket=${publicBucket}`);

  let offset = 0;
  let total = 0;
  while (true) {
    const { data, error } = await fetchBatch(offset);
    if (error) throw error;
    const rows = (data ?? []) as Array<{ storage_path: string }>;
    if (rows.length === 0) break;

    for (const row of rows) {
      if (!row.storage_path) continue;
      try {
        await uploadVariant(row.storage_path);
        total += 1;
        if (total % 25 === 0) {
          console.log(`[backfill:variants] processed=${total}`);
        }
      } catch (err) {
        console.warn(`[backfill:variants] skip ${row.storage_path}: ${String(err)}`);
      }
      await sleep(80);
    }

    offset += BATCH_SIZE;
  }

  console.log(`[backfill:variants] done total=${total}`);
};

main().catch((error) => {
  console.error("[backfill:variants] failed", error);
  process.exit(1);
});
