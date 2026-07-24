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
  type RoomParticipant,
} from "../database/schema.js";
import { createId, createRoomSlug, normalizeRoomSlug } from "../utils/id.js";
import { now } from "../utils/dates.js";
import { badRequest, forbidden, notFound } from "../utils/http.js";
import { assertRoomModerator } from "./permission.service.js";
import { deleteUploadFiles } from "./upload.service.js";

export type RoomInput = {
  name: string;
  slug?: string | undefined;
  type?: "rave" | "group" | undefined;
  description: string;
  category: string;
  bannerUrl?: string | null | undefined;
  coverUrl?: string | null | undefined;
  backgroundUrl?: string | null | undefined;
  radioEnabled?: boolean | undefined;
  radioUrl?: string | null | undefined;
  isActive?: boolean | undefined;
  rules?: string | undefined;
};

export type RoomPatch = {
  name?: string | undefined;
  slug?: string | undefined;
  type?: "rave" | "group" | undefined;
  description?: string | undefined;
  category?: string | undefined;
  bannerUrl?: string | null | undefined;
  coverUrl?: string | null | undefined;
  backgroundUrl?: string | null | undefined;
  radioEnabled?: boolean | undefined;
  radioUrl?: string | null | undefined;
  isActive?: boolean | undefined;
  rules?: string | undefined;
};

type UploadCleanupCandidate = Pick<Upload, "id" | "type" | "filename" | "url">;

function ensureValidSlug(value: string) {
  const slug = normalizeRoomSlug(value);
  if (slug.length < 3) {
    throw badRequest(
      "O link personalizado precisa ter pelo menos 3 caracteres",
    );
  }
  return slug;
}

function createAvailableRoomSlug(base: string) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const existing = db
      .select({ id: rooms.id })
      .from(rooms)
      .where(eq(rooms.slug, candidate))
      .get();
    if (!existing) {
      return candidate;
    }
  }

  throw badRequest("Nao foi possivel gerar link exclusivo da sala");
}

function assertSlugAvailable(slug: string, roomId?: string) {
  const existing = db
    .select({ id: rooms.id })
    .from(rooms)
    .where(eq(rooms.slug, slug))
    .get();
  if (existing && existing.id !== roomId) {
    throw badRequest("Esse link personalizado ja esta em uso");
  }
}

function normalizeRadioConfig(
  type: "rave" | "group",
  enabled?: boolean,
  url?: string | null,
) {
  const radioUrl = url?.trim() || null;
  if (type !== "group") {
    return { radioEnabled: false, radioUrl: null };
  }
  if (enabled && !radioUrl) {
    throw badRequest("Informe o link do streaming para ativar a web radio");
  }
  return {
    radioEnabled: Boolean(enabled && radioUrl),
    radioUrl: radioUrl && enabled !== false ? radioUrl : null,
  };
}

export function listRooms(includeInactive = false, userId?: string) {
  const where = includeInactive ? undefined : eq(rooms.isActive, true);
  const query = db
    .select({
      id: rooms.id,
      slug: rooms.slug,
      name: rooms.name,
      type: rooms.type,
      bannerUrl: rooms.bannerUrl,
      coverUrl: rooms.coverUrl,
      backgroundUrl: rooms.backgroundUrl,
      radioEnabled: rooms.radioEnabled,
      radioUrl: rooms.radioUrl,
      description: rooms.description,
      rules: rooms.rules,
      category: rooms.category,
      creatorId: rooms.creatorId,
      creatorName: users.name,
      creatorImage: users.image,
      isActive: rooms.isActive,
      endedAt: rooms.endedAt,
      createdAt: rooms.createdAt,
      updatedAt: rooms.updatedAt,
    })
    .from(rooms)
    .leftJoin(users, eq(rooms.creatorId, users.id))
    .orderBy(desc(rooms.createdAt));

  const rows = where ? query.where(where).all() : query.all();
  if (!userId || rows.length === 0) {
    return rows.map((room) => ({ ...room, hasJoined: false }));
  }

  const joinedRows = db
    .select({ roomId: roomParticipants.roomId })
    .from(roomParticipants)
    .where(
      and(
        eq(roomParticipants.userId, userId),
        inArray(
          roomParticipants.roomId,
          rows.map((room) => room.id),
        ),
      ),
    )
    .all();
  const joinedRoomIds = new Set(joinedRows.map((row) => row.roomId));

  return rows.map((room) => ({
    ...room,
    hasJoined: joinedRoomIds.has(room.id),
  }));
}

export function createRoom(input: RoomInput, creatorId: string) {
  const timestamp = now();
  const type = input.type ?? "rave";
  const radio = normalizeRadioConfig(type, input.radioEnabled, input.radioUrl);
  const requestedSlug = input.slug?.trim();
  let slug: string;

  if (requestedSlug) {
    const baseSlug = ensureValidSlug(requestedSlug);
    assertSlugAvailable(baseSlug);
    slug = baseSlug;
  } else {
    const readableSlug = normalizeRoomSlug(input.name);
    const baseSlug =
      readableSlug.length >= 3
        ? readableSlug
        : `${readableSlug || "sala"}-${createRoomSlug()}`;
    slug = createAvailableRoomSlug(baseSlug);
  }

  const room = db
    .insert(rooms)
    .values({
      id: createId("room"),
      slug,
      name: input.name,
      type,
      description: input.description,
      category: input.category,
      bannerUrl: input.bannerUrl ?? null,
      coverUrl: input.coverUrl ?? null,
      backgroundUrl: input.backgroundUrl ?? null,
      radioEnabled: radio.radioEnabled,
      radioUrl: radio.radioUrl,
      creatorId,
      rules: input.rules?.trim() ?? "",
      isActive: input.isActive ?? true,
      createdAt: timestamp,
      updatedAt: timestamp,
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
      online: false,
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
      updatedByUserId: creatorId,
    })
    .onConflictDoNothing()
    .run();

  return room;
}

export function updateRoom(roomId: string, input: RoomPatch) {
  const existing = db.select().from(rooms).where(eq(rooms.id, roomId)).get();
  if (!existing) {
    throw notFound("Sala nao encontrada");
  }

  const patch: Partial<typeof rooms.$inferInsert> = { updatedAt: now() };
  if (input.name !== undefined) patch.name = input.name;
  if (input.slug !== undefined) {
    const slug = ensureValidSlug(input.slug);
    assertSlugAvailable(slug, roomId);
    patch.slug = slug;
  }
  if (input.type !== undefined) patch.type = input.type;
  if (input.description !== undefined) patch.description = input.description;
  if (input.rules !== undefined) patch.rules = input.rules.trim();
  if (input.category !== undefined) patch.category = input.category;
  if (input.bannerUrl !== undefined) patch.bannerUrl = input.bannerUrl;
  if (input.coverUrl !== undefined) patch.coverUrl = input.coverUrl;
  if (input.backgroundUrl !== undefined)
    patch.backgroundUrl = input.backgroundUrl;
  if (
    input.type !== undefined ||
    input.radioEnabled !== undefined ||
    input.radioUrl !== undefined
  ) {
    const nextType = input.type ?? existing.type;
    const radio = normalizeRadioConfig(
      nextType,
      input.radioEnabled ?? existing.radioEnabled,
      input.radioUrl !== undefined ? input.radioUrl : existing.radioUrl,
    );
    patch.radioEnabled = radio.radioEnabled;
    patch.radioUrl = radio.radioUrl;
  }
  if (input.isActive !== undefined) {
    patch.isActive = input.isActive;
    patch.endedAt = input.isActive ? null : now();
  }

  const updated = db
    .update(rooms)
    .set(patch)
    .where(eq(rooms.id, roomId))
    .returning()
    .get();
  if (!updated) {
    throw notFound("Sala nao encontrada");
  }
  return updated;
}

function addUploadCandidate(
  candidates: Map<string, UploadCleanupCandidate>,
  upload: UploadCleanupCandidate | null | undefined,
) {
  if (upload?.id) {
    candidates.set(upload.id, upload);
  }
}

function collectRoomCleanupTargets(
  roomId: string,
  bannerUrl?: string | null,
  coverUrl?: string | null,
  backgroundUrl?: string | null,
) {
  const uploadCandidates = new Map<string, UploadCleanupCandidate>();

  for (const url of [bannerUrl, coverUrl, backgroundUrl]) {
    if (!url) {
      continue;
    }
    addUploadCandidate(
      uploadCandidates,
      db
        .select({
          id: uploads.id,
          type: uploads.type,
          filename: uploads.filename,
          url: uploads.url,
        })
        .from(uploads)
        .where(eq(uploads.url, url))
        .get(),
    );
  }

  const roomVideos = db
    .select({
      videoId: videos.id,
      uploadId: uploads.id,
      uploadType: uploads.type,
      uploadFilename: uploads.filename,
      uploadUrl: uploads.url,
    })
    .from(roomContents)
    .innerJoin(videos, eq(roomContents.videoId, videos.id))
    .leftJoin(
      uploads,
      or(eq(videos.uploadId, uploads.id), eq(videos.sourceUrl, uploads.url)),
    )
    .where(eq(roomContents.roomId, roomId))
    .all();

  for (const row of roomVideos) {
    if (row.uploadId && row.uploadType && row.uploadFilename && row.uploadUrl) {
      addUploadCandidate(uploadCandidates, {
        id: row.uploadId,
        type: row.uploadType,
        filename: row.uploadFilename,
        url: row.uploadUrl,
      });
    }
  }

  const roomAudios = db
    .select({
      audioId: audios.id,
      uploadId: uploads.id,
      uploadType: uploads.type,
      uploadFilename: uploads.filename,
      uploadUrl: uploads.url,
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
      url: row.uploadUrl,
    });
  }

  const roomImages = db
    .select({
      uploadId: uploads.id,
      uploadType: uploads.type,
      uploadFilename: uploads.filename,
      uploadUrl: uploads.url,
    })
    .from(messages)
    .innerJoin(uploads, eq(messages.imageUploadId, uploads.id))
    .where(eq(messages.roomId, roomId))
    .all();

  for (const row of roomImages) {
    addUploadCandidate(uploadCandidates, {
      id: row.uploadId,
      type: row.uploadType,
      filename: row.uploadFilename,
      url: row.uploadUrl,
    });
  }

  return {
    videoIds: [...new Set(roomVideos.map((row) => row.videoId))],
    audioIds: [...new Set(roomAudios.map((row) => row.audioId))],
    uploadCandidates: [...uploadCandidates.values()],
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

  const messageImageReference = db
    .select({ id: messages.id })
    .from(messages)
    .where(eq(messages.imageUploadId, upload.id))
    .get();
  if (messageImageReference) return true;

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

  const roomBackgroundReference = db
    .select({ id: rooms.id })
    .from(rooms)
    .where(eq(rooms.backgroundUrl, upload.url))
    .get();
  if (roomBackgroundReference) return true;

  const roomCoverReference = db
    .select({ id: rooms.id })
    .from(rooms)
    .where(eq(rooms.coverUrl, upload.url))
    .get();
  if (roomCoverReference) return true;

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

  const targets = collectRoomCleanupTargets(
    room.id,
    room.bannerUrl,
    room.coverUrl,
    room.backgroundUrl,
  );

  db.transaction((tx) => {
    if (targets.audioIds.length > 0) {
      tx.delete(audios).where(inArray(audios.id, targets.audioIds)).run();
    }

    if (targets.videoIds.length > 0) {
      tx.delete(videos).where(inArray(videos.id, targets.videoIds)).run();
    }

    const deleted = tx
      .delete(rooms)
      .where(eq(rooms.id, roomId))
      .returning({ id: rooms.id })
      .get();
    if (!deleted) {
      throw notFound("Sala nao encontrada");
    }
  });

  const unusedUploads = targets.uploadCandidates.filter(
    (upload) => !uploadStillReferenced(upload),
  );
  const deletedUploads =
    unusedUploads.length > 0
      ? db
          .delete(uploads)
          .where(
            inArray(
              uploads.id,
              unusedUploads.map((upload) => upload.id),
            ),
          )
          .returning({
            id: uploads.id,
            type: uploads.type,
            filename: uploads.filename,
            url: uploads.url,
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
      type: rooms.type,
      bannerUrl: rooms.bannerUrl,
      coverUrl: rooms.coverUrl,
      backgroundUrl: rooms.backgroundUrl,
      radioEnabled: rooms.radioEnabled,
      radioUrl: rooms.radioUrl,
      description: rooms.description,
      rules: rooms.rules,
      category: rooms.category,
      creatorId: rooms.creatorId,
      creatorName: users.name,
      creatorImage: users.image,
      isActive: rooms.isActive,
      endedAt: rooms.endedAt,
      createdAt: rooms.createdAt,
      updatedAt: rooms.updatedAt,
    })
    .from(rooms)
    .leftJoin(users, eq(rooms.creatorId, users.id))
    .where(eq(rooms.slug, slug))
    .get();

  if (!room) {
    throw notFound("Sala nao encontrada");
  }

  const globalUser = db.select().from(users).where(eq(users.id, userId)).get();
  if (
    !room.isActive &&
    globalUser?.role !== "admin" &&
    room.creatorId !== userId
  ) {
    throw forbidden("Esta sala foi encerrada");
  }

  const participant = getExistingRoomParticipant(room.id, userId);
  if (participant?.isBanned) {
    throw forbidden(participant.bannedReason ?? "Voce foi banido desta sala");
  }
  if (participant && !participant.canWatch) {
    throw forbidden("Voce nao tem permissao para assistir esta sala");
  }

  return { room, participant };
}

export function getExistingRoomParticipant(
  roomId: string,
  userId: string,
): RoomParticipant | null {
  return (
    db
      .select()
      .from(roomParticipants)
      .where(
        and(
          eq(roomParticipants.roomId, roomId),
          eq(roomParticipants.userId, userId),
        ),
      )
      .get() ?? null
  );
}

export function joinRoom(
  roomId: string,
  userId: string,
  moderator = false,
): RoomParticipant {
  const timestamp = now();
  const existing = db
    .select()
    .from(roomParticipants)
    .where(
      and(
        eq(roomParticipants.roomId, roomId),
        eq(roomParticipants.userId, userId),
      ),
    )
    .get();

  if (existing) {
    return db
      .update(roomParticipants)
      .set({
        online: true,
        lastSeenAt: timestamp,
        role: moderator ? "administrator" : existing.role,
        canModerate: moderator ? true : existing.canModerate,
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
      online: true,
    })
    .returning()
    .get();
}

export function leaveRoom(roomId: string, userId: string) {
  db.update(roomParticipants)
    .set({ online: false, lastSeenAt: now() })
    .where(
      and(
        eq(roomParticipants.roomId, roomId),
        eq(roomParticipants.userId, userId),
      ),
    )
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
      globalRole: users.role,
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
  },
) {
  assertRoomModerator(roomId, actorId);
  const participant = db
    .select()
    .from(roomParticipants)
    .where(
      and(
        eq(roomParticipants.id, participantId),
        eq(roomParticipants.roomId, roomId),
      ),
    )
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
