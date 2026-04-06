import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(4024),
  APP_URL: z.string().url().default("http://localhost:3000"),
  SUPABASE_URL: z.string().url().optional().or(z.literal("")),
  SUPABASE_SERVICE_ROLE: z.string().optional().or(z.literal("")),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  RATE_LIMIT_MAX_BLOCK: z.coerce.number().int().positive().default(40),
  RATE_LIMIT_MAX_REPORT: z.coerce.number().int().positive().default(20),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(`Invalid safety-service env: ${JSON.stringify(parsed.error.format(), null, 2)}`);
}

const data = parsed.data;

export const env = {
  ...data,
  hasSupabase: Boolean(data.SUPABASE_URL && data.SUPABASE_SERVICE_ROLE),
};
