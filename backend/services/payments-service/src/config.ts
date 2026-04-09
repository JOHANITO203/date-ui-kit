import { config as loadEnv } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serviceDir = path.resolve(__dirname, "..");
const rootDir = path.resolve(__dirname, "../../../../");

loadEnv({ path: path.join(rootDir, ".env") });
loadEnv({ path: path.join(serviceDir, ".env") });
loadEnv();

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(4025),
  APP_URL: z.string().url().default("http://localhost:3000"),
  INTERNAL_JWT_SECRET: z.string().min(16),

  SUPABASE_URL: z.string().url().optional().or(z.literal("")),
  SUPABASE_SERVICE_ROLE: z.string().optional().or(z.literal("")),

  YOOKASSA_BASE_URL: z.string().url().default("https://api.yookassa.ru/v3"),
  YOOKASSA_SHOP_ID: z.string().optional(),
  YOOKASSA_SECRET_KEY: z.string().optional(),
  YOOKASSA_WEBHOOK_SECRET: z.string().optional(),
  YOOKASSA_RETURN_URL: z.string().url().default("http://localhost:3000/boost"),
  YOOKASSA_FAIL_URL: z.string().url().default("http://localhost:3000/boost"),
  YOOKASSA_TIMEOUT_MS: z.coerce.number().int().min(1000).max(30000).default(12000),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  RATE_LIMIT_MAX_CHECKOUT: z.coerce.number().int().positive().default(20),
  RATE_LIMIT_MAX_STATUS: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_MAX_WEBHOOK: z.coerce.number().int().positive().default(120),
  PAYMENTS_DEV_AUTO_GRANT: z
    .string()
    .optional()
    .transform((value) => value === "1" || value?.toLowerCase() === "true"),
  PAYMENTS_CATALOG_SOURCE: z
    .enum(["db_strict", "db_with_emergency_fallback", "code"])
    .default("db_strict"),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(`Invalid payments-service env: ${JSON.stringify(parsed.error.format(), null, 2)}`);
}

const data = parsed.data;

export const env = {
  ...data,
  hasSupabase: Boolean(data.SUPABASE_URL && data.SUPABASE_SERVICE_ROLE),
  hasYooKassaCredentials: Boolean(data.YOOKASSA_SHOP_ID && data.YOOKASSA_SECRET_KEY),
  hasWebhookSecret: Boolean(data.YOOKASSA_WEBHOOK_SECRET),
};
