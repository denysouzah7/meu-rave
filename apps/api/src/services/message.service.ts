import { and, asc, count, desc, eq, inArray, isNull, lt } from "drizzle-orm";
import { db } from "../database/client.js";
import {
  audios,
  messageLikes,
  messages,
  roomParticipants,
  stickerPacks,
  stickers,
  uploads,
  users
} from "../database/schema.js";
import { createId } from "../utils/id.js";
import { now } from "../utils/dates.js";
import { badRequest, notFound } from "../utils/http.js";
import { getMessageRetentionDays } from "./settings.service.js";
import { deleteUploadFiles } from "./upload.service.js";

export const MAX_AUDIO_DURATION_SECONDS = 120;

export type CreateMessageInput = {
  roomId: string;
  userId: string;
  type: "text" | "sticker" | "audio" | "system";
  body?: string | null | undefined;
  replyToMessageId?: string | null | undefined;
  stickerId?: string | null | undefined;
  audioId?: string | null | undefined;
};

export function listMessages(roomId: string, limit = 80) {
  const rows = db
    .select({
      id: messages.id,
      roomId: messages.roomId,
      userId: messages.userId,
      type: messages.type,
      body: messages.body,
      replyToMessageId: messages.replyToMessageId,
      stickerId: messages.stickerId,
      audioId: messages.audioId,
      isPinned: messages.isPinned,
      deletedAt: messages.deletedAt,
      createdAt: messages.createdAt,
      authorName: users.name,
      authorImage: users.image,
      authorRole: users.role,
      stickerName: stickers.name,
      stickerUrl: stickers.imageUrl,
      audioUrl: uploads.url,
      audioDuration: audios.durationSeconds
    })
    .from(messages)
    .leftJoin(users, eq(messages.userId, users.id))
    .leftJoin(stickers, eq(messages.stickerId, stickers.id))
    .leftJoin(audios, eq(messages.audioId, audios.id))
    .leftJoin(uploads, eq(audios.uploadId, uploads.id))
    .where(and(eq(messages.roomId, roomId), isNull(messages.deletedAt)))
    .orderBy(desc(messages.createdAt))
    .limit(limit)
    .all()
    .reverse();

  const ids = rows.map((row) => row.id);
  const likeCounts =
    ids.length > 0
      ? db
          .select({ messageId: messageLikes.messageId, value: count() })
          .from(messageLikes)
          .where(inArray(messageLikes.messageId, ids))
          .groupBy(messageLikes.messageId)
          .all()
      : [];
  const likes = new Map(likeCounts.map((item) => [item.messageId, item.value]));

  return rows.map((row) => ({
    ...row,
    likes: likes.get(row.id) ?? 0
  }));
}

export function createMessage(input: CreateMessageInput) {
  if (input.type === "text" && !input.body?.trim()) {
    throw badRequest("Mensagem vazia");
  }

  const inserted = db
    .insert(messages)
    .values({
      id: createId("msg"),
      roomId: input.roomId,
      userId: input.userId,
      type: input.type,
      body: input.type === "text" || input.type === "system" ? input.body?.trim() ?? "" : input.body ?? null,
      replyToMessageId: input.replyToMessageId ?? null,
      stickerId: input.stickerId ?? null,
      audioId: input.audioId ?? null,
      isPinned: false,
      createdAt: now()
    })
    .returning()
    .get();

  return listMessages(input.roomId, 1).find((message) => message.id === inserted.id) ?? inserted;
}

export function toggleMessageLike(messageId: string, userId: string) {
  const existing = db
    .select()
    .from(messageLikes)
    .where(and(eq(messageLikes.messageId, messageId), eq(messageLikes.userId, userId)))
    .get();

  if (existing) {
    db.delete(messageLikes)
      .where(and(eq(messageLikes.messageId, messageId), eq(messageLikes.userId, userId)))
      .run();
  } else {
    db.insert(messageLikes).values({ messageId, userId, createdAt: now() }).run();
  }

  const row = db
    .select({ value: count() })
    .from(messageLikes)
    .where(eq(messageLikes.messageId, messageId))
    .get();
  return { messageId, likes: row?.value ?? 0 };
}

export function softDeleteMessage(messageId: string) {
  const deleted = db
    .update(messages)
    .set({ deletedAt: now(), body: "" })
    .where(eq(messages.id, messageId))
    .returning({ id: messages.id, roomId: messages.roomId })
    .get();

  if (!deleted) {
    throw notFound("Mensagem nao encontrada");
  }

  return deleted;
}

export function pinMessage(messageId: string, isPinned: boolean) {
  const updated = db
    .update(messages)
    .set({ isPinned })
    .where(eq(messages.id, messageId))
    .returning()
    .get();

  if (!updated) {
    throw notFound("Mensagem nao encontrada");
  }

  return updated;
}

export function cleanupOldMessages() {
  const retentionDays = getMessageRetentionDays();
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const deleted = db.delete(messages).where(lt(messages.createdAt, cutoff)).returning({ id: messages.id }).all();
  return { deleted: deleted.length, retentionDays };
}

export function createAudioFromUpload(uploadId: string, userId: string, durationSeconds: number) {
  const upload = db.select().from(uploads).where(eq(uploads.id, uploadId)).get();
  if (!upload) {
    throw notFound("Upload de audio nao encontrado");
  }
  if (upload.userId !== userId || upload.type !== "audio") {
    throw badRequest("Upload de audio invalido");
  }

  const duration = Number.isFinite(durationSeconds) ? durationSeconds : 0;
  if (duration <= 0) {
    cleanupUnusedAudioUpload(upload);
    throw badRequest("Duracao de audio invalida");
  }
  if (duration > MAX_AUDIO_DURATION_SECONDS) {
    cleanupUnusedAudioUpload(upload);
    throw badRequest("Audios podem ter no maximo 2 minutos");
  }

  return db
    .insert(audios)
    .values({
      id: createId("aud"),
      uploadId,
      userId,
      durationSeconds: duration,
      createdAt: now()
    })
    .returning()
    .get();
}

function cleanupUnusedAudioUpload(upload: typeof uploads.$inferSelect) {
  const existingAudio = db.select({ id: audios.id }).from(audios).where(eq(audios.uploadId, upload.id)).get();
  if (existingAudio) {
    return;
  }

  db.delete(uploads).where(eq(uploads.id, upload.id)).run();
  deleteUploadFiles([upload]);
}

export function listPinnedMessages(roomId: string) {
  return db
    .select()
    .from(messages)
    .where(and(eq(messages.roomId, roomId), eq(messages.isPinned, true), isNull(messages.deletedAt)))
    .orderBy(asc(messages.createdAt))
    .all();
}

export function userCanDeleteMessage(messageId: string, userId: string) {
  const message = db.select().from(messages).where(eq(messages.id, messageId)).get();
  if (!message) {
    throw notFound("Mensagem nao encontrada");
  }
  if (message.userId === userId) {
    return { ok: true, roomId: message.roomId };
  }
  const moderator = db
    .select()
    .from(roomParticipants)
    .where(
      and(
        eq(roomParticipants.roomId, message.roomId),
        eq(roomParticipants.userId, userId),
        eq(roomParticipants.canModerate, true)
      )
    )
    .get();
  return { ok: Boolean(moderator), roomId: message.roomId };
}

export function listStickerPacks(userId: string) {
  const packs = db
    .select()
    .from(stickerPacks)
    .where(eq(stickerPacks.userId, userId))
    .orderBy(asc(stickerPacks.createdAt))
    .all();

  return packs.map((pack) => ({
    ...pack,
    stickers: db.select().from(stickers).where(eq(stickers.packId, pack.id)).orderBy(asc(stickers.createdAt)).all()
  }));
}
