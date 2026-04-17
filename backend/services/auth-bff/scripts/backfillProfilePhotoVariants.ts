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
const SLEEP_MS = 45;
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

type PhotoRow = {
  id: string;
  user_id: string;
  storage_path: string;
  created_at: string | null;
};

const toVariantPath = (storagePath: string, variant: PhotoVariant) => {
  const clean = storagePath.replace(/^\/+/, "");
  const withoutExt = clean.replace(/\.[^/.]+$/, "");
  return `variants/${variant}/${withoutExt}.jpg`;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const safeSegment = (value: string) => value.replace(/[^a-zA-Z0-9._-]/g, "_");
const inferContentType = (storagePath: string) => {
  const ext = path.extname(storagePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".heic" || ext === ".heif") return "image/heic";
  return "image/jpeg";
};

const isLegacyPath = (row: PhotoRow) => {
  const top = row.storage_path.split("/")[0] ?? "";
  if (!top) return true;
  if (!uuidRe.test(top)) return true;
  return top !== row.user_id;
};

const normalizeLegacyPath = (row: PhotoRow) => {
  const filename = safeSegment(path.basename(row.storage_path));
  return `${row.user_id}/legacy/${row.id}-${filename}`;
};

const fetchBatch = async (offset: number) => {
  return supabase
    .from("profile_photos")
    .select("id,user_id,storage_path,created_at")
    .order("created_at", { ascending: true })
    .range(offset, offset + BATCH_SIZE - 1);
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

const uploadAllVariants = async (storagePath: string, sourceBuffer: Buffer) => {
  const variants: PhotoVariant[] = ["card", "avatar", "profile"];
  for (const variant of variants) {
    const optimized = await optimizeVariant(sourceBuffer, variant);
    const variantPath = toVariantPath(storagePath, variant);
    const { error } = await supabase.storage.from(publicBucket).upload(variantPath, optimized, {
      contentType: "image/jpeg",
      cacheControl: "public, max-age=31536000, immutable",
      upsert: true,
    });
    if (error) throw error;
  }
};

const downloadPrivatePhoto = async (storagePath: string) => {
  const download = await supabase.storage.from(sourceBucket).download(storagePath);
  if (download.error || !download.data) {
    throw new Error(`download_failed:${storagePath}:${download.error?.message ?? "unknown"}`);
  }
  return Buffer.from(await download.data.arrayBuffer());
};

const migrateLegacyRow = async (row: PhotoRow, sourceBuffer: Buffer) => {
  const normalizedPath = normalizeLegacyPath(row);
  const upload = await supabase.storage.from(sourceBucket).upload(normalizedPath, sourceBuffer, {
    contentType: inferContentType(row.storage_path),
    upsert: false,
  });

  if (upload.error && !String(upload.error.message ?? "").toLowerCase().includes("already exists")) {
    throw new Error(`legacy_upload_failed:${row.storage_path}:${upload.error.message ?? "unknown"}`);
  }

  const update = await supabase.from("profile_photos").update({ storage_path: normalizedPath }).eq("id", row.id);
  if (update.error) throw new Error(`legacy_row_update_failed:${row.id}:${update.error.message ?? "unknown"}`);

  await supabase.storage.from(sourceBucket).remove([row.storage_path]).catch(() => undefined);
  const oldVariants = (["card", "avatar", "profile"] as const).map((variant) =>
    toVariantPath(row.storage_path, variant),
  );
  await supabase.storage.from(publicBucket).remove([...oldVariants, row.storage_path]).catch(() => undefined);

  return normalizedPath;
};

const main = async () => {
  console.log(`[backfill:variants] sourceBucket=${sourceBucket}`);
  console.log(`[backfill:variants] publicBucket=${publicBucket}`);

  const stats = {
    scanned: 0,
    repairedVariants: 0,
    migratedLegacy: 0,
    failed: 0,
  };

  let offset = 0;
  while (true) {
    const { data, error } = await fetchBatch(offset);
    if (error) throw error;
    const rows = (data ?? []) as PhotoRow[];
    if (rows.length === 0) break;

    for (const row of rows) {
      if (!row.storage_path) continue;
      stats.scanned += 1;

      try {
        const sourceBuffer = await downloadPrivatePhoto(row.storage_path);
        let effectivePath = row.storage_path;

        if (isLegacyPath(row)) {
          effectivePath = await migrateLegacyRow(row, sourceBuffer);
          stats.migratedLegacy += 1;
        }

        await uploadAllVariants(effectivePath, sourceBuffer);
        stats.repairedVariants += 1;
      } catch (err) {
        stats.failed += 1;
        console.warn(`[backfill:variants] skip ${row.storage_path}: ${String(err)}`);
      }

      if (stats.scanned % 25 === 0) {
        console.log(
          `[backfill:variants] scanned=${stats.scanned} repaired=${stats.repairedVariants} legacy=${stats.migratedLegacy} failed=${stats.failed}`,
        );
      }
      await sleep(SLEEP_MS);
    }

    offset += BATCH_SIZE;
  }

  console.log(
    `[backfill:variants] done scanned=${stats.scanned} repaired=${stats.repairedVariants} legacy=${stats.migratedLegacy} failed=${stats.failed}`,
  );
};

main().catch((error) => {
  console.error("[backfill:variants] failed", error);
  process.exit(1);
});
