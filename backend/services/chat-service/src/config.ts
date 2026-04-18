import { config as loadEnv } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serviceDir = path.resolve(__dirname, "..");
const rootDir = path.resolve(__dirname, "../../../../");

loadEnv({ path: path.join(rootDir, ".env") });
loadEnv({ path: path.join(serviceDir, ".env"), override: true });
loadEnv();

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(4023),
  APP_URL: z.string().url().default("http://localhost:3000"),
  INTERNAL_JWT_SECRET: z.string().min(16),
  SUPABASE_URL: z.string().url().optional().or(z.literal("")),
  SUPABASE_SERVICE_ROLE: z.string().optional().or(z.literal("")),
  STORAGE_PROFILE_PHOTOS_BUCKET: z.string().min(1).default("profile-photos"),
  STORAGE_PROFILE_PHOTOS_PUBLIC_BUCKET: z.string().min(1).default("profile-photos-public"),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(`Invalid chat-service env: ${JSON.stringify(parsed.error.format(), null, 2)}`);
}

const data = parsed.data;

export const env = {
  ...data,
  hasSupabase: Boolean(data.SUPABASE_URL && data.SUPABASE_SERVICE_ROLE),
};
