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
  INTERNAL_JWT_SECRET: z.string().min(32),
  DATABASE_URL: z.string().optional().or(z.literal("")),
  S3_ENDPOINT: z.string().optional().or(z.literal("")),
  S3_REGION: z.string().optional().or(z.literal("")),
  S3_ACCESS_KEY_ID: z.string().optional().or(z.literal("")),
  S3_SECRET_ACCESS_KEY: z.string().optional().or(z.literal("")),
  S3_BUCKET_PRIVATE: z.string().min(1).default("profile-photos"),
  S3_PUBLIC_URL: z.string().optional().or(z.literal("")),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(`Invalid chat-service env: ${JSON.stringify(parsed.error.format(), null, 2)}`);
}

const data = parsed.data;

export const env = {
  ...data,
};
