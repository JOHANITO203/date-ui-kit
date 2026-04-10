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
  ACTOR_ENGINE_ENABLED: z.string().optional().default("0"),
  ACTOR_ENGINE_TICK_SECONDS: z.coerce.number().int().min(10).max(3600).default(45),
  ACTOR_ENGINE_TARGET_EMAILS: z
    .string()
    .optional()
    .default("*"),
  ACTOR_ENGINE_ACTOR_EMAIL_REGEX: z
    .string()
    .optional()
    .default("^seed\\..+@exotic\\.local$"),
  ACTOR_ENGINE_MESSAGE_RATE: z.coerce.number().min(0).max(1).default(0.6),
  ACTOR_ENGINE_LIKE_RATE: z.coerce.number().min(0).max(1).default(0.25),
  ACTOR_ENGINE_SUPERLIKE_RATE: z.coerce.number().min(0).max(1).default(0.1),
  ACTOR_ENGINE_BLOCK_RATE: z.coerce.number().min(0).max(1).default(0.05),
  ACTOR_ENGINE_BOOST_RATE: z.coerce.number().min(0).max(1).default(0.15),
  ACTOR_ENGINE_BOOST_DURATION_MINUTES: z.coerce.number().int().min(1).max(240).default(15),
  ACTOR_ENGINE_SHADOWGHOST_LIKE_RATE: z.coerce.number().min(0).max(1).default(0.45),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(`Invalid chat-service env: ${JSON.stringify(parsed.error.format(), null, 2)}`);
}

const data = parsed.data;

export const env = {
  ...data,
  hasSupabase: Boolean(data.SUPABASE_URL && data.SUPABASE_SERVICE_ROLE),
  actorEngineEnabled: data.ACTOR_ENGINE_ENABLED === "1",
  actorEngineTargetEmails: data.ACTOR_ENGINE_TARGET_EMAILS.split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean),
};
