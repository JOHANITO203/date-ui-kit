import { config as loadEnv } from "dotenv";
import { z } from "zod";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serviceDir = path.resolve(__dirname, "..");
const rootDir = path.resolve(__dirname, "../../../../");

loadEnv({ path: path.join(rootDir, ".env") });
loadEnv({ path: path.join(serviceDir, ".env"), override: true });
loadEnv();

const envSchema = z.object({
  APP_URL: z.string().url().default("http://localhost:3000"),
  API_HOST: z.string().min(1).default("0.0.0.0"),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(8788),
  INTERNAL_JWT_SECRET: z.string().min(16),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE: z.string().min(1).optional(),
  STORAGE_PROFILE_PHOTOS_BUCKET: z.string().min(1).default("profile-photos"),
  STORAGE_SIGNED_URL_TTL_SEC: z.coerce.number().int().positive().default(60 * 60 * 24 * 7),
  DISCOVER_SUPABASE_TIMEOUT_MS: z.coerce.number().int().min(500).max(20000).default(3500),
  DISCOVER_OPTIONAL_QUERY_TIMEOUT_MS: z.coerce.number().int().min(200).max(5000).default(900),
  DISCOVER_CANDIDATES_CACHE_TTL_MS: z.coerce.number().int().min(500).max(30000).default(8000),
  DISCOVER_FEED_PROFILE_LIMIT: z.coerce.number().int().min(10).max(120).default(40),
  ACTOR_ENGINE_ACTOR_EMAIL_REGEX: z
    .string()
    .optional()
    .default("^seed\\..+@exotic\\.local$"),
  ACTOR_DISCOVER_MATCH_CACHE_TTL_SEC: z.coerce.number().int().min(15).max(3600).default(300),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(`Invalid discover-service env: ${JSON.stringify(parsed.error.format(), null, 2)}`);
}

export const env = parsed.data;
