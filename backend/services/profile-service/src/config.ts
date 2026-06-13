import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(4022),
  APP_URL: z.string().url().default("http://localhost:3000"),
  INTERNAL_JWT_SECRET: z.string().min(32),
  DATABASE_URL: z.string().default(""),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(`Invalid profile-service env: ${JSON.stringify(parsed.error.format(), null, 2)}`);
}

const data = parsed.data;

export const env = {
  ...data,
};
