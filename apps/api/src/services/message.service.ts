import { and, asc, count, desc, eq, inArray, isNotNull, isNull, lt, ne, or } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { db } from "../database/client.js";
import {
  audios,
  messageLikes,
  messages,
  pollOptions,
  pollVotes,
  polls,
  roomParticipants,
  rooms,
  stickerPacks,
  stickers,
  uploads,
  users,
  videos
} from "../database/schema.js";
import { createId } from "../utils/id.js";
import { now } from "../utils/dates.js";
import { badRequest, notFound } from "../utils/http.js";
import { getMessageRetentionDays } from "./settings.service.js";
import { deleteUploadFiles } from "./upload.service.js";

export const MAX_AUDIO_DURATION_SECONDS = 120;
const MAX_POLL_OPTIONS = 6;

const audioUploads = alias(uploads, "audio_uploads");
const imageUploads = alias(uploads, "image_uploads");
const stickerOriginalCreators = alias(users, "message_sticker_original_creators");

export type CreateMessageInput = {
  roomId: string;
  userId: string;
  type: "text" | "sticker" | "audio" | "image" | "poll" | "system";
  body?: string | null | undefined;
  replyToMessageId?: string | null | undefined;
  stickerId?: string | null | undefined;
  audioId?: string | null | undefined;
  imageUploadId?: string | null | undefined;
  poll?: {
    question: string;
    options: string[];
    allowsMultiple?: boolean | undefined;
  } | null | undefined;
};

export function listMessages(roomId: string, limit = 80, currentUserId?: string | null) {
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
      imageUploadId: messages.imageUploadId,
      pollId: messages.pollId,
      isPinned: messages.isPinned,
      deletedAt: messages.deletedAt,
      createdAt: messages.createdAt,
      authorName: users.name,
      authorImage: users.image,
      authorRole: users.role,
      stickerName: stickers.name,
      stickerUrl: stickers.imageUrl,
      stickerOriginalCreatorId: stickers.originalCreatorId,
      stickerOriginalCreatorName: stickerOriginalCreators.name,
      stickerOriginalCreatedAt: stickers.originalCreatedAt,
      audioUrl: audioUploads.url,
      audioDuration: audios.durationSeconds,
      imageUrl: imageUploads.url,
      imageName: imageUploads.originalName,
      imageMimeType: imageUploads.mimeType
    })
    .from(messages)
    .leftJoin(users, eq(messages.userId, users.id))
    .leftJoin(stickers, eq(messages.stickerId, stickers.id))
    .leftJoin(stickerOriginalCreators, eq(stickers.originalCreatorId, stickerOriginalCreators.id))
    .leftJoin(audios, eq(messages.audioId, audios.id))
    .leftJoin(audioUploads, eq(audios.uploadId, audioUploads.id))
    .leftJoin(imageUploads, eq(messages.imageUploadId, imageUploads.id))
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
  const pollIds = [...new Set(rows.map((row) => row.pollId).filter((pollId): pollId is string => Boolean(pollId)))];
  const pollMap = getPollDtos(pollIds, currentUserId);

  return rows.map((row) => ({
    ...row,
    likes: likes.get(row.id) ?? 0,
    poll: row.pollId ? pollMap.get(row.pollId) ?? null : null
  }));
}

export function countRoomMessages(roomId: string) {
  const row = db
    .select({ value: count() })
    .from(messages)
    .where(and(eq(messages.roomId, roomId), isNull(messages.deletedAt)))
    .get();

  return row?.value ?? 0;
}

export function listRoomMessageRanking(roomId: string) {
  const messageCount = count(messages.id).as("messageCount");

  return db
    .select({
      userId: messages.userId,
      name: users.name,
      image: users.image,
      messageCount
    })
    .from(messages)
    .leftJoin(users, eq(messages.userId, users.id))
    .where(and(eq(messages.roomId, roomId), isNull(messages.deletedAt), isNotNull(messages.userId), ne(messages.type, "system")))
    .groupBy(messages.userId, users.name, users.image)
    .orderBy(desc(messageCount))
    .all()
    .filter((item): item is typeof item & { userId: string } => Boolean(item.userId))
    .map((item) => ({
      userId: item.userId,
      name: item.name,
      image: item.image,
      messageCount: item.messageCount
    }));
}

export function createMessage(input: CreateMessageInput) {
  if (input.type === "text" && !input.body?.trim()) {
    throw badRequest("Mensagem vazia");
  }
  if (input.type === "image" && !input.imageUploadId) {
    throw badRequest("Imagem obrigatoria");
  }
  if (input.type === "poll" && !input.poll) {
    throw badRequest("Enquete obrigatoria");
  }

  const imageUploadId =
    input.type === "image" ? validateImageUpload(input.imageUploadId ?? "", input.userId).id : null;
  const pollInput = input.type === "poll" ? normalizePollInput(input.poll) : null;

  const inserted = db.transaction((tx) => {
    const timestamp = now();
    let pollId: string | null = null;

    if (pollInput) {
      const poll = tx
        .insert(polls)
        .values({
          id: createId("poll"),
          roomId: input.roomId,
          creatorId: input.userId,
          question: pollInput.question,
          allowsMultiple: pollInput.allowsMultiple,
          createdAt: timestamp
        })
        .returning()
        .get();
      const createdPollId = poll.id;
      pollId = createdPollId;

      tx.insert(pollOptions)
        .values(
          pollInput.options.map((option, index) => ({
            id: createId("popt"),
            pollId: createdPollId,
            body: option,
            sortOrder: index,
            createdAt: timestamp
          }))
        )
        .run();
    }

    return tx
      .insert(messages)
      .values({
        id: createId("msg"),
        roomId: input.roomId,
        userId: input.userId,
        type: input.type,
        body:
          input.type === "text" || input.type === "system" || input.type === "image"
            ? input.body?.trim() ?? ""
            : input.body ?? null,
        replyToMessageId: input.replyToMessageId ?? null,
        stickerId: input.stickerId ?? null,
        audioId: input.audioId ?? null,
        imageUploadId,
        pollId,
        isPinned: false,
        createdAt: timestamp
      })
      .returning()
      .get();
  });

  return listMessages(input.roomId, 1, input.userId).find((message) => message.id === inserted.id) ?? inserted;
}

function normalizePollInput(input: CreateMessageInput["poll"]) {
  const question = input?.question.trim() ?? "";
  const options = [...new Set(input?.options?.map((option) => option.trim()).filter(Boolean) ?? [])].slice(
    0,
    MAX_POLL_OPTIONS
  );

  if (question.length < 3) {
    throw badRequest("A pergunta da enquete precisa ter pelo menos 3 caracteres");
  }
  if (question.length > 160) {
    throw badRequest("A pergunta da enquete esta muito longa");
  }
  if (options.length < 2) {
    throw badRequest("A enquete precisa ter pelo menos 2 opcoes");
  }
  if (options.some((option) => option.length > 80)) {
    throw badRequest("Cada opcao da enquete pode ter no maximo 80 caracteres");
  }

  return {
    question,
    options,
    allowsMultiple: Boolean(input?.allowsMultiple)
  };
}

function validateImageUpload(uploadId: string, userId: string) {
  const upload = db.select().from(uploads).where(eq(uploads.id, uploadId)).get();
  if (!upload) {
    throw notFound("Imagem nao encontrada");
  }
  if (upload.userId !== userId || upload.type !== "image") {
    throw badRequest("Upload de imagem invalido");
  }
  return upload;
}

function getPollDtos(pollIds: string[], currentUserId?: string | null) {
  const pollMap = new Map<string, ReturnType<typeof buildPollDto>>();
  if (pollIds.length === 0) {
    return pollMap;
  }

  const pollRows = db.select().from(polls).where(inArray(polls.id, pollIds)).all();
  const optionRows = db
    .select()
    .from(pollOptions)
    .where(inArray(pollOptions.pollId, pollIds))
    .orderBy(asc(pollOptions.sortOrder), asc(pollOptions.createdAt))
    .all();
  const voteCounts = db
    .select({ optionId: pollVotes.optionId, value: count() })
    .from(pollVotes)
    .where(inArray(pollVotes.pollId, pollIds))
    .groupBy(pollVotes.optionId)
    .all();
  const ownVotes = currentUserId
    ? db
        .select({ optionId: pollVotes.optionId })
        .from(pollVotes)
        .where(and(eq(pollVotes.userId, currentUserId), inArray(pollVotes.pollId, pollIds)))
        .all()
    : [];

  const votesByOption = new Map(voteCounts.map((vote) => [vote.optionId, vote.value]));
  const ownOptionIds = new Set(ownVotes.map((vote) => vote.optionId));

  for (const poll of pollRows) {
    const options = optionRows.filter((option) => option.pollId === poll.id);
    pollMap.set(poll.id, buildPollDto(poll, options, votesByOption, ownOptionIds));
  }

  return pollMap;
}

function buildPollDto(
  poll: typeof polls.$inferSelect,
  options: Array<typeof pollOptions.$inferSelect>,
  votesByOption: Map<string, number>,
  ownOptionIds: Set<string>
) {
  const enrichedOptions = options.map((option) => {
    const votes = votesByOption.get(option.id) ?? 0;
    return {
      ...option,
      votes,
      votedByMe: ownOptionIds.has(option.id)
    };
  });

  return {
    ...poll,
    totalVotes: enrichedOptions.reduce((total, option) => total + option.votes, 0),
    options: enrichedOptions
  };
}

export function votePoll(roomId: string, pollId: string, optionId: string, userId: string) {
  const poll = db.select().from(polls).where(and(eq(polls.id, pollId), eq(polls.roomId, roomId))).get();
  if (!poll) {
    throw notFound("Enquete nao encontrada");
  }

  if (poll.closesAt && poll.closesAt.getTime() < Date.now()) {
    throw badRequest("Esta enquete ja foi encerrada");
  }

  const option = db
    .select()
    .from(pollOptions)
    .where(and(eq(pollOptions.id, optionId), eq(pollOptions.pollId, poll.id)))
    .get();
  if (!option) {
    throw notFound("Opcao da enquete nao encontrada");
  }

  db.transaction((tx) => {
    const existing = tx
      .select()
      .from(pollVotes)
      .where(
        and(eq(pollVotes.pollId, poll.id), eq(pollVotes.optionId, option.id), eq(pollVotes.userId, userId))
      )
      .get();

    if (poll.allowsMultiple) {
      if (existing) {
        tx.delete(pollVotes)
          .where(
            and(eq(pollVotes.pollId, poll.id), eq(pollVotes.optionId, option.id), eq(pollVotes.userId, userId))
          )
          .run();
        return;
      }
    } else {
      tx.delete(pollVotes).where(and(eq(pollVotes.pollId, poll.id), eq(pollVotes.userId, userId))).run();
    }

    tx.insert(pollVotes)
      .values({
        pollId: poll.id,
        optionId: option.id,
        userId,
        createdAt: now()
      })
      .onConflictDoNothing()
      .run();
  });

  return getPollDtos([poll.id], userId).get(poll.id);
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
  const staleMessages = db
    .select({
      id: messages.id,
      audioId: messages.audioId,
      imageUploadId: messages.imageUploadId
    })
    .from(messages)
    .where(lt(messages.createdAt, cutoff))
    .all();

  if (staleMessages.length === 0) {
    return { deleted: 0, deletedUploads: 0, retentionDays };
  }

  const staleIds = staleMessages.map((message) => message.id);
  const audioIds = [...new Set(staleMessages.map((message) => message.audioId).filter((id): id is string => Boolean(id)))];
  const imageUploadIds = [
    ...new Set(staleMessages.map((message) => message.imageUploadId).filter((id): id is string => Boolean(id)))
  ];
  const uploadCandidates = new Map<string, Pick<typeof uploads.$inferSelect, "id" | "type" | "filename" | "url">>();

  if (audioIds.length > 0) {
    for (const row of db
      .select({
        id: uploads.id,
        type: uploads.type,
        filename: uploads.filename,
        url: uploads.url
      })
      .from(audios)
      .innerJoin(uploads, eq(audios.uploadId, uploads.id))
      .where(inArray(audios.id, audioIds))
      .all()) {
      uploadCandidates.set(row.id, row);
    }
  }

  if (imageUploadIds.length > 0) {
    for (const row of db
      .select({
        id: uploads.id,
        type: uploads.type,
        filename: uploads.filename,
        url: uploads.url
      })
      .from(uploads)
      .where(inArray(uploads.id, imageUploadIds))
      .all()) {
      uploadCandidates.set(row.id, row);
    }
  }

  const deleted = db.delete(messages).where(inArray(messages.id, staleIds)).returning({ id: messages.id }).all();

  const orphanAudioIds = audioIds.filter(
    (audioId) => !db.select({ id: messages.id }).from(messages).where(eq(messages.audioId, audioId)).get()
  );
  if (orphanAudioIds.length > 0) {
    db.delete(audios).where(inArray(audios.id, orphanAudioIds)).run();
  }

  const unusedUploads = [...uploadCandidates.values()].filter((upload) => !uploadStillReferenced(upload));
  const deletedUploads =
    unusedUploads.length > 0
      ? db
          .delete(uploads)
          .where(inArray(uploads.id, unusedUploads.map((upload) => upload.id)))
          .returning({
            id: uploads.id,
            type: uploads.type,
            filename: uploads.filename,
            url: uploads.url
          })
          .all()
      : [];
  deleteUploadFiles(deletedUploads);

  return { deleted: deleted.length, deletedUploads: deletedUploads.length, retentionDays };
}

function uploadStillReferenced(upload: Pick<typeof uploads.$inferSelect, "id" | "url">) {
  const videoReference = db
    .select({ id: videos.id })
    .from(videos)
    .where(or(eq(videos.uploadId, upload.id), eq(videos.sourceUrl, upload.url)))
    .get();
  if (videoReference) return true;

  const audioReference = db.select({ id: audios.id }).from(audios).where(eq(audios.uploadId, upload.id)).get();
  if (audioReference) return true;

  const imageReference = db
    .select({ id: messages.id })
    .from(messages)
    .where(eq(messages.imageUploadId, upload.id))
    .get();
  if (imageReference) return true;

  const stickerReference = db.select({ id: stickers.id }).from(stickers).where(eq(stickers.uploadId, upload.id)).get();
  if (stickerReference) return true;

  const roomBannerReference = db.select({ id: rooms.id }).from(rooms).where(eq(rooms.bannerUrl, upload.url)).get();
  if (roomBannerReference) return true;

  const avatarReference = db.select({ id: users.id }).from(users).where(eq(users.image, upload.url)).get();
  return Boolean(avatarReference);
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
