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
  INTERNAL_JWT_SECRET: z.string().min(32),
  DATABASE_URL: z.string().min(1),
  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().min(1).default("us-east-1"),
  S3_ACCESS_KEY_ID: z.string().min(1).optional(),
  S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  S3_BUCKET_PRIVATE: z.string().min(1).optional(),
  S3_PUBLIC_URL: z.string().url().optional(),
  STORAGE_SIGNED_URL_TTL_SEC: z.coerce.number().int().positive().default(60 * 60 * 24 * 7),
  DISCOVER_SETTINGS_CACHE_TTL_MS: z.coerce.number().int().min(1000).max(600000).default(60000),
  DISCOVER_CANDIDATES_CACHE_TTL_MS: z.coerce.number().int().min(500).max(30000).default(8000),
  DISCOVER_FEED_PROFILE_LIMIT: z.coerce.number().int().min(10).max(120).default(40),
  DISCOVER_ACTIVE_BOOST_SCORE_BONUS: z.coerce.number().int().min(0).max(100).default(14),
  DISCOVER_REQUIRE_PHOTO: z.coerce.boolean().default(true),
  ONLINE_ACTIVE_WINDOW_SEC: z.coerce.number().int().min(60).max(3600).default(600),
  ACTOR_ENGINE_ACTOR_EMAIL_REGEX: z
    .string()
    .optional()
    .default("^seed\\..+@exotic\\.local$"),
  ACTOR_DISCOVER_MATCH_CACHE_TTL_SEC: z.coerce.number().int().min(15).max(3600).default(300),
  // Internal URL of auth-bff (owns Web Push). Reachable on the Docker network.
  AUTH_BFF_INTERNAL_URL: z.string().url().default("http://auth-bff:8787"),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(`Invalid discover-service env: ${JSON.stringify(parsed.error.format(), null, 2)}`);
}

export const env = parsed.data;
