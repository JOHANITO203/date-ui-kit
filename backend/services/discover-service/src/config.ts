import { config as loadEnv } from "dotenv";
import { z } from "zod";

loadEnv();

const envSchema = z.object({
  APP_URL: z.string().url().default("http://localhost:3000"),
  API_HOST: z.string().min(1).default("0.0.0.0"),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(8788),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(`Invalid discover-service env: ${JSON.stringify(parsed.error.format(), null, 2)}`);
}

export const env = parsed.data;
