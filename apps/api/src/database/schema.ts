import { relations } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const users = sqliteTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: integer("emailVerified", { mode: "boolean" })
      .notNull()
      .default(false),
    image: text("image"),
    role: text("role", { enum: ["admin", "participant"] })
      .notNull()
      .default("participant"),
    isBlocked: integer("isBlocked", { mode: "boolean" })
      .notNull()
      .default(false),
    blockedReason: text("blockedReason"),
    profileTheme: text("profileTheme").default("neon"),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => ({
    emailIdx: uniqueIndex("user_email_idx").on(table.email),
    roleIdx: index("user_role_idx").on(table.role),
  }),
);

export const sessions = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: integer("expiresAt", { mode: "timestamp_ms" }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
    ipAddress: text("ipAddress"),
    userAgent: text("userAgent"),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (table) => ({
    tokenIdx: uniqueIndex("session_token_idx").on(table.token),
    userIdx: index("session_user_idx").on(table.userId),
  }),
);

export const accounts = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("accountId").notNull(),
    providerId: text("providerId").notNull(),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("accessToken"),
    refreshToken: text("refreshToken"),
    idToken: text("idToken"),
    accessTokenExpiresAt: integer("accessTokenExpiresAt", {
      mode: "timestamp_ms",
    }),
    refreshTokenExpiresAt: integer("refreshTokenExpiresAt", {
      mode: "timestamp_ms",
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => ({
    userIdx: index("account_user_idx").on(table.userId),
    providerIdx: index("account_provider_idx").on(table.providerId),
  }),
);

export const verifications = sqliteTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expiresAt", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" }),
  },
  (table) => ({
    identifierIdx: index("verification_identifier_idx").on(table.identifier),
  }),
);

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
});

export const administrators = sqliteTable(
  "administrators",
  {
    userId: text("userId")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    grantedByUserId: text("grantedByUserId").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => ({
    grantedByIdx: index("administrator_granted_by_idx").on(
      table.grantedByUserId,
    ),
  }),
);

export const rooms = sqliteTable(
  "rooms",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    type: text("type", { enum: ["rave", "group"] })
      .notNull()
      .default("rave"),
    bannerUrl: text("bannerUrl"),
    coverUrl: text("coverUrl"),
    backgroundUrl: text("backgroundUrl"),
    radioEnabled: integer("radioEnabled", { mode: "boolean" })
      .notNull()
      .default(false),
    radioUrl: text("radioUrl"),
    description: text("description").notNull(),
    rules: text("rules").notNull().default(""),
    category: text("category").notNull(),
    creatorId: text("creatorId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    isActive: integer("isActive", { mode: "boolean" }).notNull().default(true),
    endedAt: integer("endedAt", { mode: "timestamp_ms" }),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => ({
    slugIdx: uniqueIndex("rooms_slug_idx").on(table.slug),
    creatorIdx: index("rooms_creator_idx").on(table.creatorId),
    typeIdx: index("rooms_type_idx").on(table.type),
    activeIdx: index("rooms_active_idx").on(table.isActive),
    categoryIdx: index("rooms_category_idx").on(table.category),
  }),
);

export const roomParticipants = sqliteTable(
  "room_participants",
  {
    id: text("id").primaryKey(),
    roomId: text("roomId")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role", {
      enum: ["administrator", "moderator", "participant", "viewer"],
    })
      .notNull()
      .default("participant"),
    canWatch: integer("canWatch", { mode: "boolean" }).notNull().default(true),
    canChat: integer("canChat", { mode: "boolean" }).notNull().default(true),
    canSendAudio: integer("canSendAudio", { mode: "boolean" })
      .notNull()
      .default(true),
    canModerate: integer("canModerate", { mode: "boolean" })
      .notNull()
      .default(false),
    isMuted: integer("isMuted", { mode: "boolean" }).notNull().default(false),
    isBanned: integer("isBanned", { mode: "boolean" }).notNull().default(false),
    bannedReason: text("bannedReason"),
    online: integer("online", { mode: "boolean" }).notNull().default(false),
    joinedAt: integer("joinedAt", { mode: "timestamp_ms" }).notNull(),
    lastSeenAt: integer("lastSeenAt", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => ({
    roomUserIdx: uniqueIndex("room_participants_room_user_idx").on(
      table.roomId,
      table.userId,
    ),
    roomIdx: index("room_participants_room_idx").on(table.roomId),
    onlineIdx: index("room_participants_online_idx").on(
      table.roomId,
      table.online,
    ),
    bannedIdx: index("room_participants_banned_idx").on(
      table.roomId,
      table.isBanned,
    ),
  }),
);

export const uploads = sqliteTable(
  "uploads",
  {
    id: text("id").primaryKey(),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type", {
      enum: ["video", "image", "sticker", "avatar", "audio"],
    }).notNull(),
    originalName: text("originalName").notNull(),
    filename: text("filename").notNull(),
    mimeType: text("mimeType").notNull(),
    size: integer("size").notNull(),
    url: text("url").notNull(),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => ({
    userIdx: index("uploads_user_idx").on(table.userId),
    typeIdx: index("uploads_type_idx").on(table.type),
  }),
);

export const videos = sqliteTable(
  "videos",
  {
    id: text("id").primaryKey(),
    uploaderId: text("uploaderId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    uploadId: text("uploadId").references(() => uploads.id, {
      onDelete: "set null",
    }),
    sourceType: text("sourceType", {
      enum: ["upload", "youtube", "direct"],
    }).notNull(),
    sourceUrl: text("sourceUrl").notNull(),
    title: text("title").notNull(),
    durationSeconds: real("durationSeconds"),
    mimeType: text("mimeType"),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => ({
    uploaderIdx: index("videos_uploader_idx").on(table.uploaderId),
    sourceIdx: index("videos_source_idx").on(table.sourceType),
  }),
);

export const roomContents = sqliteTable(
  "room_contents",
  {
    id: text("id").primaryKey(),
    roomId: text("roomId")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    videoId: text("videoId")
      .notNull()
      .references(() => videos.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    sortOrder: integer("sortOrder").notNull().default(0),
    isActive: integer("isActive", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => ({
    roomIdx: index("room_contents_room_idx").on(table.roomId),
    activeIdx: index("room_contents_active_idx").on(
      table.roomId,
      table.isActive,
    ),
  }),
);

export const roomPlaybackState = sqliteTable("room_playback_state", {
  roomId: text("roomId")
    .primaryKey()
    .references(() => rooms.id, { onDelete: "cascade" }),
  contentId: text("contentId").references(() => roomContents.id, {
    onDelete: "set null",
  }),
  isPlaying: integer("isPlaying", { mode: "boolean" }).notNull().default(false),
  positionSeconds: real("positionSeconds").notNull().default(0),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
  updatedByUserId: text("updatedByUserId").references(() => users.id, {
    onDelete: "set null",
  }),
});

export const stickerPacks = sqliteTable(
  "sticker_packs",
  {
    id: text("id").primaryKey(),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => ({
    userIdx: index("sticker_packs_user_idx").on(table.userId),
  }),
);

export const stickers = sqliteTable(
  "stickers",
  {
    id: text("id").primaryKey(),
    packId: text("packId")
      .notNull()
      .references(() => stickerPacks.id, { onDelete: "cascade" }),
    uploadId: text("uploadId")
      .notNull()
      .references(() => uploads.id, { onDelete: "cascade" }),
    originalCreatorId: text("originalCreatorId").references(() => users.id, {
      onDelete: "set null",
    }),
    originalCreatedAt: integer("originalCreatedAt", { mode: "timestamp_ms" }),
    sourceStickerId: text("sourceStickerId"),
    name: text("name").notNull(),
    imageUrl: text("imageUrl").notNull(),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => ({
    packIdx: index("stickers_pack_idx").on(table.packId),
    originalCreatorIdx: index("stickers_original_creator_idx").on(
      table.originalCreatorId,
    ),
    sourceIdx: index("stickers_source_idx").on(table.sourceStickerId),
  }),
);

export const audios = sqliteTable(
  "audios",
  {
    id: text("id").primaryKey(),
    uploadId: text("uploadId")
      .notNull()
      .references(() => uploads.id, { onDelete: "cascade" }),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    durationSeconds: real("durationSeconds").notNull().default(0),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => ({
    userIdx: index("audios_user_idx").on(table.userId),
  }),
);

export const polls = sqliteTable(
  "polls",
  {
    id: text("id").primaryKey(),
    roomId: text("roomId")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    creatorId: text("creatorId").references(() => users.id, {
      onDelete: "set null",
    }),
    question: text("question").notNull(),
    allowsMultiple: integer("allowsMultiple", { mode: "boolean" })
      .notNull()
      .default(false),
    closesAt: integer("closesAt", { mode: "timestamp_ms" }),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => ({
    roomIdx: index("polls_room_idx").on(table.roomId),
    creatorIdx: index("polls_creator_idx").on(table.creatorId),
    createdIdx: index("polls_created_idx").on(table.createdAt),
  }),
);

export const pollOptions = sqliteTable(
  "poll_options",
  {
    id: text("id").primaryKey(),
    pollId: text("pollId")
      .notNull()
      .references(() => polls.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    sortOrder: integer("sortOrder").notNull().default(0),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => ({
    pollIdx: index("poll_options_poll_idx").on(table.pollId),
  }),
);

export const pollVotes = sqliteTable(
  "poll_votes",
  {
    pollId: text("pollId")
      .notNull()
      .references(() => polls.id, { onDelete: "cascade" }),
    optionId: text("optionId")
      .notNull()
      .references(() => pollOptions.id, { onDelete: "cascade" }),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.pollId, table.userId, table.optionId] }),
    optionIdx: index("poll_votes_option_idx").on(table.optionId),
    userIdx: index("poll_votes_user_idx").on(table.userId),
  }),
);

export const messages = sqliteTable(
  "messages",
  {
    id: text("id").primaryKey(),
    roomId: text("roomId")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    userId: text("userId").references(() => users.id, { onDelete: "set null" }),
    type: text("type", {
      enum: ["text", "sticker", "audio", "image", "poll", "system"],
    }).notNull(),
    body: text("body"),
    replyToMessageId: text("replyToMessageId"),
    stickerId: text("stickerId").references(() => stickers.id, {
      onDelete: "set null",
    }),
    audioId: text("audioId").references(() => audios.id, {
      onDelete: "set null",
    }),
    imageUploadId: text("imageUploadId").references(() => uploads.id, {
      onDelete: "set null",
    }),
    pollId: text("pollId").references(() => polls.id, { onDelete: "set null" }),
    isPinned: integer("isPinned", { mode: "boolean" }).notNull().default(false),
    editedAt: integer("editedAt", { mode: "timestamp_ms" }),
    deletedAt: integer("deletedAt", { mode: "timestamp_ms" }),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => ({
    roomCreatedIdx: index("messages_room_created_idx").on(
      table.roomId,
      table.createdAt,
    ),
    pinnedIdx: index("messages_pinned_idx").on(table.roomId, table.isPinned),
    roomUserIdx: index("messages_room_user_idx").on(table.roomId, table.userId),
    userIdx: index("messages_user_idx").on(table.userId),
    imageUploadIdx: index("messages_image_upload_idx").on(table.imageUploadId),
    pollIdx: index("messages_poll_idx").on(table.pollId),
  }),
);

export const messageLikes = sqliteTable(
  "message_likes",
  {
    messageId: text("messageId")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.messageId, table.userId] }),
    userIdx: index("message_likes_user_idx").on(table.userId),
  }),
);

export const messageReactions = sqliteTable(
  "message_reactions",
  {
    messageId: text("messageId")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    emoji: text("emoji").notNull(),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.messageId, table.userId, table.emoji] }),
    userIdx: index("message_reactions_user_idx").on(table.userId),
  }),
);

export const notifications = sqliteTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body").notNull(),
    readAt: integer("readAt", { mode: "timestamp_ms" }),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => ({
    userReadIdx: index("notifications_user_read_idx").on(
      table.userId,
      table.readAt,
    ),
  }),
);

export const roomsRelations = relations(rooms, ({ one, many }) => ({
  creator: one(users, {
    fields: [rooms.creatorId],
    references: [users.id],
  }),
  participants: many(roomParticipants),
  contents: many(roomContents),
}));

export const participantsRelations = relations(roomParticipants, ({ one }) => ({
  room: one(rooms, {
    fields: [roomParticipants.roomId],
    references: [rooms.id],
  }),
  user: one(users, {
    fields: [roomParticipants.userId],
    references: [users.id],
  }),
}));

export const messagesRelations = relations(messages, ({ one, many }) => ({
  room: one(rooms, {
    fields: [messages.roomId],
    references: [rooms.id],
  }),
  user: one(users, {
    fields: [messages.userId],
    references: [users.id],
  }),
  likes: many(messageLikes),
}));

export type User = typeof users.$inferSelect;
export type Room = typeof rooms.$inferSelect;
export type RoomParticipant = typeof roomParticipants.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type RoomContent = typeof roomContents.$inferSelect;
export type Video = typeof videos.$inferSelect;
export type Upload = typeof uploads.$inferSelect;
export type Sticker = typeof stickers.$inferSelect;
export type Poll = typeof polls.$inferSelect;
export type PollOption = typeof pollOptions.$inferSelect;
