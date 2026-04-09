import { config as loadEnv } from "dotenv";
import { z } from "zod";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serviceDir = path.resolve(__dirname, "..");
const rootDir = path.resolve(__dirname, "../../../../");

loadEnv({ path: path.join(rootDir, ".env") });
loadEnv({ path: path.join(serviceDir, ".env") });
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
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(`Invalid discover-service env: ${JSON.stringify(parsed.error.format(), null, 2)}`);
}

export const env = parsed.data;
