import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(4000),
  CLIENT_ORIGIN: z.string().default("http://localhost:5173"),
  PUBLIC_API_URL: z.string().url().default("http://localhost:4000"),
  DATABASE_PATH: z.string().default("./data/meu-rave.db"),
  UPLOAD_DIR: z.string().default("./uploads"),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:4000"),
  BETTER_AUTH_SECRET: z
    .string()
    .min(32)
    .default("dev-secret-change-me-please-32-characters"),
  DEFAULT_MESSAGE_RETENTION_DAYS: z.coerce.number().int().positive().default(30)
});

export const env = envSchema.parse(process.env);

export const clientOrigins = env.CLIENT_ORIGIN.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
