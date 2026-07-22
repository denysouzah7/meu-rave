import { and, desc, eq, inArray, or } from "drizzle-orm";
import { db } from "../database/client.js";
import {
  audios,
  messages,
  roomParticipants,
  roomPlaybackState,
  roomContents,
  rooms,
  stickers,
  uploads,
  users,
  videos,
  type Upload,
  type RoomParticipant
} from "../database/schema.js";
import { createId, createRoomSlug } from "../utils/id.js";
import { now } from "../utils/dates.js";
import { badRequest, forbidden, notFound } from "../utils/http.js";
import { assertRoomModerator } from "./permission.service.js";
import { deleteUploadFiles } from "./upload.service.js";

export type RoomInput = {
  name: string;
  description: string;
  category: string;
  bannerUrl?: string | null | undefined;
  isActive?: boolean | undefined;
};

export type RoomPatch = {
  name?: string | undefined;
  description?: string | undefined;
  category?: string | undefined;
  bannerUrl?: string | null | undefined;
  isActive?: boolean | undefined;
};

type UploadCleanupCandidate = Pick<Upload, "id" | "type" | "filename" | "url">;

export function listRooms(includeInactive = false) {
  const where = includeInactive ? undefined : eq(rooms.isActive, true);
  const query = db
    .select({
      id: rooms.id,
      slug: rooms.slug,
      name: rooms.name,
      bannerUrl: rooms.bannerUrl,
      description: rooms.description,
      category: rooms.category,
      creatorId: rooms.creatorId,
      creatorName: users.name,
      creatorImage: users.image,
      isActive: rooms.isActive,
      endedAt: rooms.endedAt,
      createdAt: rooms.createdAt,
      updatedAt: rooms.updatedAt
    })
    .from(rooms)
    .leftJoin(users, eq(rooms.creatorId, users.id))
    .orderBy(desc(rooms.createdAt));

  return where ? query.where(where).all() : query.all();
}

export function createRoom(input: RoomInput, creatorId: string) {
  const timestamp = now();
  let slug = createRoomSlug();
  let attempts = 0;
  while (db.select({ id: rooms.id }).from(rooms).where(eq(rooms.slug, slug)).get()) {
    slug = createRoomSlug();
    attempts += 1;
    if (attempts > 5) {
      throw badRequest("Nao foi possivel gerar link exclusivo da sala");
    }
  }

  const room = db
    .insert(rooms)
    .values({
      id: createId("room"),
      slug,
      name: input.name,
      description: input.description,
      category: input.category,
      bannerUrl: input.bannerUrl ?? null,
      creatorId,
      isActive: input.isActive ?? true,
      createdAt: timestamp,
      updatedAt: timestamp
    })
    .returning()
    .get();

  db.insert(roomParticipants)
    .values({
      id: createId("rpar"),
      roomId: room.id,
      userId: creatorId,
      role: "administrator",
      canWatch: true,
      canChat: true,
      canSendAudio: true,
      canModerate: true,
      joinedAt: timestamp,
      lastSeenAt: timestamp,
      online: false
    })
    .onConflictDoNothing()
    .run();

  db.insert(roomPlaybackState)
    .values({
      roomId: room.id,
      contentId: null,
      isPlaying: false,
      positionSeconds: 0,
      updatedAt: timestamp,
      updatedByUserId: creatorId
    })
    .onConflictDoNothing()
    .run();

  return room;
}

export function updateRoom(roomId: string, input: RoomPatch) {
  const patch: Partial<typeof rooms.$inferInsert> = { updatedAt: now() };
  if (input.name !== undefined) patch.name = input.name;
  if (input.description !== undefined) patch.description = input.description;
  if (input.category !== undefined) patch.category = input.category;
  if (input.bannerUrl !== undefined) patch.bannerUrl = input.bannerUrl;
  if (input.isActive !== undefined) {
    patch.isActive = input.isActive;
    patch.endedAt = input.isActive ? null : now();
  }

  const updated = db.update(rooms).set(patch).where(eq(rooms.id, roomId)).returning().get();
  if (!updated) {
    throw notFound("Sala nao encontrada");
  }
  return updated;
}

function addUploadCandidate(
  candidates: Map<string, UploadCleanupCandidate>,
  upload: UploadCleanupCandidate | null | undefined
) {
  if (upload?.id) {
    candidates.set(upload.id, upload);
  }
}

function collectRoomCleanupTargets(roomId: string, bannerUrl?: string | null) {
  const uploadCandidates = new Map<string, UploadCleanupCandidate>();

  if (bannerUrl) {
    addUploadCandidate(
      uploadCandidates,
      db
        .select({
          id: uploads.id,
          type: uploads.type,
          filename: uploads.filename,
          url: uploads.url
        })
        .from(uploads)
        .where(eq(uploads.url, bannerUrl))
        .get()
    );
  }

  const roomVideos = db
    .select({
      videoId: videos.id,
      uploadId: uploads.id,
      uploadType: uploads.type,
      uploadFilename: uploads.filename,
      uploadUrl: uploads.url
    })
    .from(roomContents)
    .innerJoin(videos, eq(roomContents.videoId, videos.id))
    .leftJoin(uploads, or(eq(videos.uploadId, uploads.id), eq(videos.sourceUrl, uploads.url)))
    .where(eq(roomContents.roomId, roomId))
    .all();

  for (const row of roomVideos) {
    if (row.uploadId && row.uploadType && row.uploadFilename && row.uploadUrl) {
      addUploadCandidate(uploadCandidates, {
        id: row.uploadId,
        type: row.uploadType,
        filename: row.uploadFilename,
        url: row.uploadUrl
      });
    }
  }

  const roomAudios = db
    .select({
      audioId: audios.id,
      uploadId: uploads.id,
      uploadType: uploads.type,
      uploadFilename: uploads.filename,
      uploadUrl: uploads.url
    })
    .from(messages)
    .innerJoin(audios, eq(messages.audioId, audios.id))
    .innerJoin(uploads, eq(audios.uploadId, uploads.id))
    .where(eq(messages.roomId, roomId))
    .all();

  for (const row of roomAudios) {
    addUploadCandidate(uploadCandidates, {
      id: row.uploadId,
      type: row.uploadType,
      filename: row.uploadFilename,
      url: row.uploadUrl
    });
  }

  return {
    videoIds: [...new Set(roomVideos.map((row) => row.videoId))],
    audioIds: [...new Set(roomAudios.map((row) => row.audioId))],
    uploadCandidates: [...uploadCandidates.values()]
  };
}

function uploadStillReferenced(upload: UploadCleanupCandidate) {
  const videoReference = db
    .select({ id: videos.id })
    .from(videos)
    .where(or(eq(videos.uploadId, upload.id), eq(videos.sourceUrl, upload.url)))
    .get();
  if (videoReference) return true;

  const audioReference = db
    .select({ id: audios.id })
    .from(audios)
    .where(eq(audios.uploadId, upload.id))
    .get();
  if (audioReference) return true;

  const stickerReference = db
    .select({ id: stickers.id })
    .from(stickers)
    .where(eq(stickers.uploadId, upload.id))
    .get();
  if (stickerReference) return true;

  const roomBannerReference = db
    .select({ id: rooms.id })
    .from(rooms)
    .where(eq(rooms.bannerUrl, upload.url))
    .get();
  if (roomBannerReference) return true;

  const avatarReference = db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.image, upload.url))
    .get();

  return Boolean(avatarReference);
}

export function deleteRoom(roomId: string) {
  const room = db.select().from(rooms).where(eq(rooms.id, roomId)).get();
  if (!room) {
    throw notFound("Sala nao encontrada");
  }

  const targets = collectRoomCleanupTargets(room.id, room.bannerUrl);

  db.transaction((tx) => {
    if (targets.audioIds.length > 0) {
      tx.delete(audios).where(inArray(audios.id, targets.audioIds)).run();
    }

    if (targets.videoIds.length > 0) {
      tx.delete(videos).where(inArray(videos.id, targets.videoIds)).run();
    }

    const deleted = tx.delete(rooms).where(eq(rooms.id, roomId)).returning({ id: rooms.id }).get();
    if (!deleted) {
      throw notFound("Sala nao encontrada");
    }
  });

  const unusedUploads = targets.uploadCandidates.filter((upload) => !uploadStillReferenced(upload));
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

  return { ok: true, deletedUploads: deletedUploads.length };
}

export function getRoomBySlug(slug: string, userId: string) {
  const room = db
    .select({
      id: rooms.id,
      slug: rooms.slug,
      name: rooms.name,
      bannerUrl: rooms.bannerUrl,
      description: rooms.description,
      category: rooms.category,
      creatorId: rooms.creatorId,
      creatorName: users.name,
      creatorImage: users.image,
      isActive: rooms.isActive,
      endedAt: rooms.endedAt,
      createdAt: rooms.createdAt,
      updatedAt: rooms.updatedAt
    })
    .from(rooms)
    .leftJoin(users, eq(rooms.creatorId, users.id))
    .where(eq(rooms.slug, slug))
    .get();

  if (!room) {
    throw notFound("Sala nao encontrada");
  }

  const globalUser = db.select().from(users).where(eq(users.id, userId)).get();
  if (!room.isActive && globalUser?.role !== "admin" && room.creatorId !== userId) {
    throw forbidden("Esta sala foi encerrada");
  }

  const participant = joinRoom(room.id, userId, room.creatorId === userId || globalUser?.role === "admin");
  if (participant.isBanned) {
    throw forbidden(participant.bannedReason ?? "Voce foi banido desta sala");
  }
  if (!participant.canWatch) {
    throw forbidden("Voce nao tem permissao para assistir esta sala");
  }

  return { room, participant };
}

export function joinRoom(roomId: string, userId: string, moderator = false): RoomParticipant {
  const timestamp = now();
  const existing = db
    .select()
    .from(roomParticipants)
    .where(and(eq(roomParticipants.roomId, roomId), eq(roomParticipants.userId, userId)))
    .get();

  if (existing) {
    return db
      .update(roomParticipants)
      .set({
        online: true,
        lastSeenAt: timestamp,
        role: moderator ? "administrator" : existing.role,
        canModerate: moderator ? true : existing.canModerate
      })
      .where(eq(roomParticipants.id, existing.id))
      .returning()
      .get();
  }

  return db
    .insert(roomParticipants)
    .values({
      id: createId("rpar"),
      roomId,
      userId,
      role: moderator ? "administrator" : "participant",
      canWatch: true,
      canChat: true,
      canSendAudio: true,
      canModerate: moderator,
      joinedAt: timestamp,
      lastSeenAt: timestamp,
      online: true
    })
    .returning()
    .get();
}

export function leaveRoom(roomId: string, userId: string) {
  db.update(roomParticipants)
    .set({ online: false, lastSeenAt: now() })
    .where(and(eq(roomParticipants.roomId, roomId), eq(roomParticipants.userId, userId)))
    .run();
}

export function listParticipants(roomId: string) {
  return db
    .select({
      id: roomParticipants.id,
      roomId: roomParticipants.roomId,
      userId: roomParticipants.userId,
      role: roomParticipants.role,
      canWatch: roomParticipants.canWatch,
      canChat: roomParticipants.canChat,
      canSendAudio: roomParticipants.canSendAudio,
      canModerate: roomParticipants.canModerate,
      isMuted: roomParticipants.isMuted,
      isBanned: roomParticipants.isBanned,
      bannedReason: roomParticipants.bannedReason,
      online: roomParticipants.online,
      joinedAt: roomParticipants.joinedAt,
      lastSeenAt: roomParticipants.lastSeenAt,
      name: users.name,
      email: users.email,
      image: users.image,
      globalRole: users.role
    })
    .from(roomParticipants)
    .leftJoin(users, eq(roomParticipants.userId, users.id))
    .where(eq(roomParticipants.roomId, roomId))
    .orderBy(desc(roomParticipants.online), roomParticipants.joinedAt)
    .all();
}

export function updateParticipantPermissions(
  roomId: string,
  participantId: string,
  actorId: string,
  input: {
    role?: RoomParticipant["role"] | undefined;
    canWatch?: boolean | undefined;
    canChat?: boolean | undefined;
    canSendAudio?: boolean | undefined;
    canModerate?: boolean | undefined;
    isMuted?: boolean | undefined;
    isBanned?: boolean | undefined;
    bannedReason?: string | null | undefined;
  }
) {
  assertRoomModerator(roomId, actorId);
  const participant = db
    .select()
    .from(roomParticipants)
    .where(and(eq(roomParticipants.id, participantId), eq(roomParticipants.roomId, roomId)))
    .get();
  if (!participant) {
    throw notFound("Participante nao encontrado");
  }

  const updated = db
    .update(roomParticipants)
    .set({ ...input, lastSeenAt: now() })
    .where(eq(roomParticipants.id, participantId))
    .returning()
    .get();
  return updated;
}

export function endRoom(roomId: string, actorId: string) {
  assertRoomModerator(roomId, actorId);
  return updateRoom(roomId, { isActive: false });
}

export function getRoomById(roomId: string) {
  const room = db.select().from(rooms).where(eq(rooms.id, roomId)).get();
  if (!room) {
    throw notFound("Sala nao encontrada");
  }
  return room;
}
