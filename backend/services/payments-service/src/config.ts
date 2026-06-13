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

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).default(4025),
    APP_URL: z.string().url().default("http://localhost:3000"),
    INTERNAL_JWT_SECRET: z.string().min(32),

    DATABASE_URL: z.string().default(""),

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
  })
  .superRefine((value, ctx) => {
    // SECURITY: the dev auto-grant path hands out paid entitlements for free.
    // It must never be enabled in production.
    if (value.PAYMENTS_DEV_AUTO_GRANT && value.NODE_ENV === "production") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["PAYMENTS_DEV_AUTO_GRANT"],
        message: "PAYMENTS_DEV_AUTO_GRANT must be disabled when NODE_ENV=production.",
      });
    }
    // SECURITY: a configured PSP without a webhook secret means forged webhooks
    // cannot be gated. Require the webhook secret in production when YooKassa is live.
    if (
      value.NODE_ENV === "production" &&
      Boolean(value.YOOKASSA_SHOP_ID && value.YOOKASSA_SECRET_KEY) &&
      !value.YOOKASSA_WEBHOOK_SECRET
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["YOOKASSA_WEBHOOK_SECRET"],
        message: "YOOKASSA_WEBHOOK_SECRET is required in production when YooKassa credentials are set.",
      });
    }
  });

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(`Invalid payments-service env: ${JSON.stringify(parsed.error.format(), null, 2)}`);
}

const data = parsed.data;

export const env = {
  ...data,
  hasYooKassaCredentials: Boolean(data.YOOKASSA_SHOP_ID && data.YOOKASSA_SECRET_KEY),
  hasWebhookSecret: Boolean(data.YOOKASSA_WEBHOOK_SECRET),
};
