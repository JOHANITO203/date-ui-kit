import { config as loadEnv } from "dotenv";
import { z } from "zod";

loadEnv();

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  APP_URL: z.string().url(),
  API_URL: z.string().url(),
  API_HOST: z
    .string()
    .min(1)
    .default("0.0.0.0"),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(8787),
  INTERNAL_JWT_SECRET: z.string().min(16),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE: z.string().min(1),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  GOOGLE_REDIRECT_URI: z.string().url(),
  COOKIE_NAME_AT: z.string().min(1),
  COOKIE_NAME_RT: z.string().min(1),
  COOKIE_NAME_SESSION: z.string().min(1),
  COOKIE_NAME_INTENT: z.string().min(1),
  COOKIE_DOMAIN: z.string().min(1),
  COOKIE_SECURE: z.coerce.boolean().default(false),
  COOKIE_SAMESITE: z.enum(["Strict", "Lax", "None"]).default("Lax"),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(25),
  RATE_LIMIT_TIME_WINDOW: z.coerce.number().int().positive().default(60000),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const formatted = JSON.stringify(parsed.error.format(), null, 2);
  throw new Error(`Invalid auth-bff environment configuration:\n${formatted}`);
}

export const env = {
  ...parsed.data,
  cookie: {
    name: {
      accessToken: parsed.data.COOKIE_NAME_AT,
      refreshToken: parsed.data.COOKIE_NAME_RT,
      session: parsed.data.COOKIE_NAME_SESSION,
      intent: parsed.data.COOKIE_NAME_INTENT,
    },
    domain: parsed.data.COOKIE_DOMAIN,
    sameSite: parsed.data.COOKIE_SAMESITE.toLowerCase() as
      | "strict"
      | "lax"
      | "none",
    secure:
      parsed.data.NODE_ENV === "production"
        ? true
        : parsed.data.COOKIE_SECURE,
  },
};
