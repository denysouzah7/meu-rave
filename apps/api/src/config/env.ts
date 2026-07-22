import "dotenv/config";
import { networkInterfaces } from "node:os";
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

const configuredClientOrigins = env.CLIENT_ORIGIN.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

function getLocalDevOrigins() {
  if (env.NODE_ENV === "production") {
    return [];
  }

  const origins = new Set<string>(["http://localhost:5173", "http://127.0.0.1:5173"]);
  const ports = [5173, 5174];

  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family !== "IPv4" || address.internal) {
        continue;
      }

      for (const port of ports) {
        origins.add(`http://${address.address}:${port}`);
      }
    }
  }

  return [...origins];
}

export const clientOrigins = [...new Set([...configuredClientOrigins, ...getLocalDevOrigins()])];
