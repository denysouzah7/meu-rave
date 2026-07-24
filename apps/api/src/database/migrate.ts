import { env } from "../config/env.js";
import { now } from "../utils/dates.js";
import { sqlite } from "./client.js";

export function migrate() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS "user" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "name" TEXT NOT NULL,
      "email" TEXT NOT NULL UNIQUE,
      "emailVerified" INTEGER NOT NULL DEFAULT 0,
      "image" TEXT,
      "role" TEXT NOT NULL DEFAULT 'participant',
      "isBlocked" INTEGER NOT NULL DEFAULT 0,
      "blockedReason" TEXT,
      "profileTheme" TEXT DEFAULT 'neon',
      "createdAt" INTEGER NOT NULL,
      "updatedAt" INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "user_email_idx" ON "user" ("email");
    CREATE INDEX IF NOT EXISTS "user_role_idx" ON "user" ("role");

    CREATE TABLE IF NOT EXISTS "session" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "expiresAt" INTEGER NOT NULL,
      "token" TEXT NOT NULL UNIQUE,
      "createdAt" INTEGER NOT NULL,
      "updatedAt" INTEGER NOT NULL,
      "ipAddress" TEXT,
      "userAgent" TEXT,
      "userId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "session_token_idx" ON "session" ("token");
    CREATE INDEX IF NOT EXISTS "session_user_idx" ON "session" ("userId");

    CREATE TABLE IF NOT EXISTS "account" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "accountId" TEXT NOT NULL,
      "providerId" TEXT NOT NULL,
      "userId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
      "accessToken" TEXT,
      "refreshToken" TEXT,
      "idToken" TEXT,
      "accessTokenExpiresAt" INTEGER,
      "refreshTokenExpiresAt" INTEGER,
      "scope" TEXT,
      "password" TEXT,
      "createdAt" INTEGER NOT NULL,
      "updatedAt" INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "account_user_idx" ON "account" ("userId");
    CREATE INDEX IF NOT EXISTS "account_provider_idx" ON "account" ("providerId");

    CREATE TABLE IF NOT EXISTS "verification" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "identifier" TEXT NOT NULL,
      "value" TEXT NOT NULL,
      "expiresAt" INTEGER NOT NULL,
      "createdAt" INTEGER,
      "updatedAt" INTEGER
    );
    CREATE INDEX IF NOT EXISTS "verification_identifier_idx" ON "verification" ("identifier");

    CREATE TABLE IF NOT EXISTS "settings" (
      "key" TEXT PRIMARY KEY NOT NULL,
      "value" TEXT NOT NULL,
      "updatedAt" INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "administrators" (
      "userId" TEXT PRIMARY KEY NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
      "grantedByUserId" TEXT REFERENCES "user"("id") ON DELETE SET NULL,
      "createdAt" INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "administrator_granted_by_idx" ON "administrators" ("grantedByUserId");

    CREATE TABLE IF NOT EXISTS "rooms" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "slug" TEXT NOT NULL UNIQUE,
      "name" TEXT NOT NULL,
      "type" TEXT NOT NULL DEFAULT 'rave',
      "bannerUrl" TEXT,
      "coverUrl" TEXT,
      "backgroundUrl" TEXT,
      "radioEnabled" INTEGER NOT NULL DEFAULT 0,
      "radioUrl" TEXT,
      "description" TEXT NOT NULL,
      "rules" TEXT NOT NULL DEFAULT '',
      "category" TEXT NOT NULL,
      "creatorId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
      "isActive" INTEGER NOT NULL DEFAULT 1,
      "endedAt" INTEGER,
      "createdAt" INTEGER NOT NULL,
      "updatedAt" INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "rooms_slug_idx" ON "rooms" ("slug");
    CREATE INDEX IF NOT EXISTS "rooms_creator_idx" ON "rooms" ("creatorId");
    CREATE INDEX IF NOT EXISTS "rooms_active_idx" ON "rooms" ("isActive");
    CREATE INDEX IF NOT EXISTS "rooms_category_idx" ON "rooms" ("category");

    CREATE TABLE IF NOT EXISTS "room_participants" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "roomId" TEXT NOT NULL REFERENCES "rooms"("id") ON DELETE CASCADE,
      "userId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
      "role" TEXT NOT NULL DEFAULT 'participant',
      "canWatch" INTEGER NOT NULL DEFAULT 1,
      "canChat" INTEGER NOT NULL DEFAULT 1,
      "canSendAudio" INTEGER NOT NULL DEFAULT 1,
      "canModerate" INTEGER NOT NULL DEFAULT 0,
      "isMuted" INTEGER NOT NULL DEFAULT 0,
      "isBanned" INTEGER NOT NULL DEFAULT 0,
      "bannedReason" TEXT,
      "online" INTEGER NOT NULL DEFAULT 0,
      "joinedAt" INTEGER NOT NULL,
      "lastSeenAt" INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "room_participants_room_user_idx" ON "room_participants" ("roomId", "userId");
    CREATE INDEX IF NOT EXISTS "room_participants_room_idx" ON "room_participants" ("roomId");
    CREATE INDEX IF NOT EXISTS "room_participants_online_idx" ON "room_participants" ("roomId", "online");
    CREATE INDEX IF NOT EXISTS "room_participants_banned_idx" ON "room_participants" ("roomId", "isBanned");

    CREATE TABLE IF NOT EXISTS "uploads" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "userId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
      "type" TEXT NOT NULL,
      "originalName" TEXT NOT NULL,
      "filename" TEXT NOT NULL,
      "mimeType" TEXT NOT NULL,
      "size" INTEGER NOT NULL,
      "url" TEXT NOT NULL,
      "createdAt" INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "uploads_user_idx" ON "uploads" ("userId");
    CREATE INDEX IF NOT EXISTS "uploads_type_idx" ON "uploads" ("type");

    CREATE TABLE IF NOT EXISTS "videos" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "uploaderId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
      "uploadId" TEXT REFERENCES "uploads"("id") ON DELETE SET NULL,
      "sourceType" TEXT NOT NULL,
      "sourceUrl" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "durationSeconds" REAL,
      "mimeType" TEXT,
      "createdAt" INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "videos_uploader_idx" ON "videos" ("uploaderId");
    CREATE INDEX IF NOT EXISTS "videos_source_idx" ON "videos" ("sourceType");

    CREATE TABLE IF NOT EXISTS "room_contents" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "roomId" TEXT NOT NULL REFERENCES "rooms"("id") ON DELETE CASCADE,
      "videoId" TEXT NOT NULL REFERENCES "videos"("id") ON DELETE CASCADE,
      "title" TEXT NOT NULL,
      "sortOrder" INTEGER NOT NULL DEFAULT 0,
      "isActive" INTEGER NOT NULL DEFAULT 0,
      "createdAt" INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "room_contents_room_idx" ON "room_contents" ("roomId");
    CREATE INDEX IF NOT EXISTS "room_contents_active_idx" ON "room_contents" ("roomId", "isActive");

    CREATE TABLE IF NOT EXISTS "room_playback_state" (
      "roomId" TEXT PRIMARY KEY NOT NULL REFERENCES "rooms"("id") ON DELETE CASCADE,
      "contentId" TEXT REFERENCES "room_contents"("id") ON DELETE SET NULL,
      "isPlaying" INTEGER NOT NULL DEFAULT 0,
      "positionSeconds" REAL NOT NULL DEFAULT 0,
      "updatedAt" INTEGER NOT NULL,
      "updatedByUserId" TEXT REFERENCES "user"("id") ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS "sticker_packs" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "userId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
      "name" TEXT NOT NULL,
      "createdAt" INTEGER NOT NULL,
      "updatedAt" INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "sticker_packs_user_idx" ON "sticker_packs" ("userId");

    CREATE TABLE IF NOT EXISTS "stickers" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "packId" TEXT NOT NULL REFERENCES "sticker_packs"("id") ON DELETE CASCADE,
      "uploadId" TEXT NOT NULL REFERENCES "uploads"("id") ON DELETE CASCADE,
      "originalCreatorId" TEXT REFERENCES "user"("id") ON DELETE SET NULL,
      "originalCreatedAt" INTEGER,
      "sourceStickerId" TEXT,
      "name" TEXT NOT NULL,
      "imageUrl" TEXT NOT NULL,
      "createdAt" INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "stickers_pack_idx" ON "stickers" ("packId");

    CREATE TABLE IF NOT EXISTS "audios" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "uploadId" TEXT NOT NULL REFERENCES "uploads"("id") ON DELETE CASCADE,
      "userId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
      "durationSeconds" REAL NOT NULL DEFAULT 0,
      "createdAt" INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "audios_user_idx" ON "audios" ("userId");

    CREATE TABLE IF NOT EXISTS "polls" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "roomId" TEXT NOT NULL REFERENCES "rooms"("id") ON DELETE CASCADE,
      "creatorId" TEXT REFERENCES "user"("id") ON DELETE SET NULL,
      "question" TEXT NOT NULL,
      "allowsMultiple" INTEGER NOT NULL DEFAULT 0,
      "closesAt" INTEGER,
      "createdAt" INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "polls_room_idx" ON "polls" ("roomId");
    CREATE INDEX IF NOT EXISTS "polls_creator_idx" ON "polls" ("creatorId");
    CREATE INDEX IF NOT EXISTS "polls_created_idx" ON "polls" ("createdAt");

    CREATE TABLE IF NOT EXISTS "poll_options" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "pollId" TEXT NOT NULL REFERENCES "polls"("id") ON DELETE CASCADE,
      "body" TEXT NOT NULL,
      "sortOrder" INTEGER NOT NULL DEFAULT 0,
      "createdAt" INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "poll_options_poll_idx" ON "poll_options" ("pollId");

    CREATE TABLE IF NOT EXISTS "poll_votes" (
      "pollId" TEXT NOT NULL REFERENCES "polls"("id") ON DELETE CASCADE,
      "optionId" TEXT NOT NULL REFERENCES "poll_options"("id") ON DELETE CASCADE,
      "userId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
      "createdAt" INTEGER NOT NULL,
      PRIMARY KEY ("pollId", "userId", "optionId")
    );
    CREATE INDEX IF NOT EXISTS "poll_votes_option_idx" ON "poll_votes" ("optionId");
    CREATE INDEX IF NOT EXISTS "poll_votes_user_idx" ON "poll_votes" ("userId");

    CREATE TABLE IF NOT EXISTS "messages" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "roomId" TEXT NOT NULL REFERENCES "rooms"("id") ON DELETE CASCADE,
      "userId" TEXT REFERENCES "user"("id") ON DELETE SET NULL,
      "type" TEXT NOT NULL,
      "body" TEXT,
      "replyToMessageId" TEXT,
      "stickerId" TEXT REFERENCES "stickers"("id") ON DELETE SET NULL,
      "audioId" TEXT REFERENCES "audios"("id") ON DELETE SET NULL,
      "imageUploadId" TEXT REFERENCES "uploads"("id") ON DELETE SET NULL,
      "pollId" TEXT REFERENCES "polls"("id") ON DELETE SET NULL,
      "isPinned" INTEGER NOT NULL DEFAULT 0,
      "deletedAt" INTEGER,
      "createdAt" INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "messages_room_created_idx" ON "messages" ("roomId", "createdAt");
    CREATE INDEX IF NOT EXISTS "messages_pinned_idx" ON "messages" ("roomId", "isPinned");
    CREATE INDEX IF NOT EXISTS "messages_room_user_idx" ON "messages" ("roomId", "userId");
    CREATE INDEX IF NOT EXISTS "messages_user_idx" ON "messages" ("userId");

    CREATE TABLE IF NOT EXISTS "message_likes" (
      "messageId" TEXT NOT NULL REFERENCES "messages"("id") ON DELETE CASCADE,
      "userId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
      "createdAt" INTEGER NOT NULL,
      PRIMARY KEY ("messageId", "userId")
    );
    CREATE INDEX IF NOT EXISTS "message_likes_user_idx" ON "message_likes" ("userId");

    CREATE TABLE IF NOT EXISTS "notifications" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "userId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
      "title" TEXT NOT NULL,
      "body" TEXT NOT NULL,
      "readAt" INTEGER,
      "createdAt" INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "notifications_user_read_idx" ON "notifications" ("userId", "readAt");
  `);

  const roomColumns = sqlite
    .prepare("PRAGMA table_info(rooms)")
    .all() as Array<{ name: string }>;
  if (!roomColumns.some((column) => column.name === "type")) {
    sqlite.exec(`
      ALTER TABLE "rooms" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'rave';
    `);
  }
  if (!roomColumns.some((column) => column.name === "backgroundUrl")) {
    sqlite.exec(`
      ALTER TABLE "rooms" ADD COLUMN "backgroundUrl" TEXT;
    `);
  }
  if (!roomColumns.some((column) => column.name === "coverUrl")) {
    sqlite.exec(`
      ALTER TABLE "rooms" ADD COLUMN "coverUrl" TEXT;
    `);
  }
  if (!roomColumns.some((column) => column.name === "radioEnabled")) {
    sqlite.exec(`
      ALTER TABLE "rooms" ADD COLUMN "radioEnabled" INTEGER NOT NULL DEFAULT 0;
    `);
  }
  if (!roomColumns.some((column) => column.name === "radioUrl")) {
    sqlite.exec(`
      ALTER TABLE "rooms" ADD COLUMN "radioUrl" TEXT;
    `);
  }
  if (!roomColumns.some((column) => column.name === "rules")) {
    sqlite.exec(`
      ALTER TABLE "rooms" ADD COLUMN "rules" TEXT NOT NULL DEFAULT '';
    `);
  }
  sqlite.exec(
    `CREATE INDEX IF NOT EXISTS "rooms_type_idx" ON "rooms" ("type");`,
  );

  const stickerColumns = sqlite
    .prepare("PRAGMA table_info(stickers)")
    .all() as Array<{ name: string }>;
  if (!stickerColumns.some((column) => column.name === "originalCreatorId")) {
    sqlite.exec(
      `ALTER TABLE "stickers" ADD COLUMN "originalCreatorId" TEXT REFERENCES "user"("id") ON DELETE SET NULL;`,
    );
  }
  if (!stickerColumns.some((column) => column.name === "originalCreatedAt")) {
    sqlite.exec(
      `ALTER TABLE "stickers" ADD COLUMN "originalCreatedAt" INTEGER;`,
    );
  }
  if (!stickerColumns.some((column) => column.name === "sourceStickerId")) {
    sqlite.exec(`ALTER TABLE "stickers" ADD COLUMN "sourceStickerId" TEXT;`);
  }
  sqlite.exec(`
    UPDATE "stickers"
    SET "originalCreatorId" = (
      SELECT "userId" FROM "sticker_packs" WHERE "sticker_packs"."id" = "stickers"."packId"
    )
    WHERE "originalCreatorId" IS NULL;

    UPDATE "stickers"
    SET "originalCreatedAt" = "createdAt"
    WHERE "originalCreatedAt" IS NULL;

    CREATE INDEX IF NOT EXISTS "stickers_original_creator_idx" ON "stickers" ("originalCreatorId");
    CREATE INDEX IF NOT EXISTS "stickers_source_idx" ON "stickers" ("sourceStickerId");
  `);

  const messageColumns = sqlite
    .prepare("PRAGMA table_info(messages)")
    .all() as Array<{ name: string }>;
  if (!messageColumns.some((column) => column.name === "imageUploadId")) {
    sqlite.exec(`
      ALTER TABLE "messages" ADD COLUMN "imageUploadId" TEXT REFERENCES "uploads"("id") ON DELETE SET NULL;
    `);
  }
  if (!messageColumns.some((column) => column.name === "pollId")) {
    sqlite.exec(`
      ALTER TABLE "messages" ADD COLUMN "pollId" TEXT REFERENCES "polls"("id") ON DELETE SET NULL;
    `);
  }
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS "messages_image_upload_idx" ON "messages" ("imageUploadId");
    CREATE INDEX IF NOT EXISTS "messages_poll_idx" ON "messages" ("pollId");
  `);

  const existing = sqlite
    .prepare("SELECT value FROM settings WHERE key = ?")
    .get("messageRetentionDays");
  if (!existing) {
    sqlite
      .prepare("INSERT INTO settings (key, value, updatedAt) VALUES (?, ?, ?)")
      .run(
        "messageRetentionDays",
        String(env.DEFAULT_MESSAGE_RETENTION_DAYS),
        now().getTime(),
      );
  }
}
