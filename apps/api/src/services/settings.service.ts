import { eq } from "drizzle-orm";
import { db } from "../database/client.js";
import { settings } from "../database/schema.js";
import { env } from "../config/env.js";
import { now } from "../utils/dates.js";

const MESSAGE_RETENTION_KEY = "messageRetentionDays";
const MUSIC_API_URL_KEY = "musicApiUrl";

export function getMessageRetentionDays() {
  const row = db.select().from(settings).where(eq(settings.key, MESSAGE_RETENTION_KEY)).get();
  return row ? Number(row.value) : env.DEFAULT_MESSAGE_RETENTION_DAYS;
}

export function updateMessageRetentionDays(days: number) {
  const updatedAt = now();
  db.insert(settings)
    .values({ key: MESSAGE_RETENTION_KEY, value: String(days), updatedAt })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: String(days), updatedAt }
    })
    .run();
  return { messageRetentionDays: days };
}

export function getMusicApiUrl(): string {
  const row = db.select().from(settings).where(eq(settings.key, MUSIC_API_URL_KEY)).get();
  return row?.value || "";
}

export function updateMusicApiUrl(url: string) {
  const updatedAt = now();
  db.insert(settings)
    .values({ key: MUSIC_API_URL_KEY, value: url, updatedAt })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: url, updatedAt }
    })
    .run();
  return { musicApiUrl: url };
}

export function getSettings() {
  return {
    messageRetentionDays: getMessageRetentionDays(),
    musicApiUrl: getMusicApiUrl(),
  };
}
