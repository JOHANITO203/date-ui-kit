import { config as loadEnv } from "dotenv";
import { z } from "zod";

loadEnv();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url(),
  API_URL: z.string().url(),
  API_HOST: z.string().min(1).default("0.0.0.0"),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(8787),

  DATABASE_URL: z.string().min(1),

  INTERNAL_JWT_SECRET: z.string().min(32),
  BCRYPT_ROUNDS: z.coerce.number().int().min(8).max(14).default(12),

  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  GOOGLE_REDIRECT_URI: z.string().url(),

  // S3-compatible storage (optional — photo routes disabled if absent)
  S3_ENDPOINT: z.string().url().optional().or(z.literal("")),
  S3_REGION: z.string().min(1).default("auto"),
  S3_ACCESS_KEY_ID: z.string().optional().or(z.literal("")),
  S3_SECRET_ACCESS_KEY: z.string().optional().or(z.literal("")),
  S3_BUCKET_PRIVATE: z.string().min(1).default("profile-photos"),
  S3_BUCKET_PUBLIC: z.string().min(1).default("profile-photos-public"),
  S3_PUBLIC_URL: z.string().url().optional().or(z.literal("")),
  STORAGE_SIGNED_URL_TTL_SEC: z.coerce.number().int().positive().default(60 * 60 * 24 * 7),

  // SMTP (optional — OTP tokens logged to console when absent)
  SMTP_HOST: z.string().optional().or(z.literal("")),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  SMTP_USER: z.string().optional().or(z.literal("")),
  SMTP_PASS: z.string().optional().or(z.literal("")),
  SMTP_FROM: z.string().default("noreply@exotic.app"),
  SMTP_SECURE: z.coerce.boolean().default(false),

  COOKIE_NAME_AT: z.string().min(1),
  COOKIE_NAME_RT: z.string().min(1),
  COOKIE_NAME_SESSION: z.string().min(1),
  COOKIE_NAME_INTENT: z.string().min(1),
  COOKIE_DOMAIN: z.string().min(1),
  COOKIE_SECURE: z.coerce.boolean().default(false),
  COOKIE_SAMESITE: z.enum(["Strict", "Lax", "None"]).default("Lax"),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(25),
  RATE_LIMIT_TIME_WINDOW: z.coerce.number().int().positive().default(60000),
  GEO_SCOPE: z.enum(["russia", "global"]).default("russia"),

  // Web Push (VAPID). Push is disabled if either key is absent.
  VAPID_PUBLIC_KEY: z.string().optional().or(z.literal("")),
  VAPID_PRIVATE_KEY: z.string().optional().or(z.literal("")),
  VAPID_SUBJECT: z.string().default("mailto:support@exotic.app"),

  // AI assistance. Provider-pluggable: "anthropic" (default) or "deepseek".
  // Each provider is disabled unless its API key is present.
  AI_PROVIDER: z.enum(["anthropic", "deepseek"]).default("anthropic"),
  // Anthropic (default Opus; set claude-haiku-4-5 for cheap high-volume tasks).
  ANTHROPIC_API_KEY: z.string().optional().or(z.literal("")),
  AI_MODEL: z.string().default("claude-opus-4-8"),
  // DeepSeek (OpenAI-compatible Chat Completions API).
  DEEPSEEK_API_KEY: z.string().optional().or(z.literal("")),
  DEEPSEEK_BASE_URL: z.string().url().default("https://api.deepseek.com"),
  DEEPSEEK_MODEL: z.string().default("deepseek-chat"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const formatted = JSON.stringify(parsed.error.format(), null, 2);
  throw new Error(`Invalid auth-bff environment configuration:\n${formatted}`);
}

const data = parsed.data;

export const env = {
  ...data,
  hasS3: Boolean(data.S3_ACCESS_KEY_ID && data.S3_SECRET_ACCESS_KEY && data.S3_PUBLIC_URL),
  hasSmtp: Boolean(data.SMTP_HOST && data.SMTP_USER),
  hasPush: Boolean(data.VAPID_PUBLIC_KEY && data.VAPID_PRIVATE_KEY),
  hasAI:
    data.AI_PROVIDER === "deepseek"
      ? Boolean(data.DEEPSEEK_API_KEY)
      : Boolean(data.ANTHROPIC_API_KEY),
  cookie: {
    name: {
      accessToken: data.COOKIE_NAME_AT,
      refreshToken: data.COOKIE_NAME_RT,
      session: data.COOKIE_NAME_SESSION,
      intent: data.COOKIE_NAME_INTENT,
    },
    domain: data.COOKIE_DOMAIN,
    sameSite: data.COOKIE_SAMESITE.toLowerCase() as "strict" | "lax" | "none",
    secure: data.NODE_ENV === "production" ? true : data.COOKIE_SECURE,
  },
};
