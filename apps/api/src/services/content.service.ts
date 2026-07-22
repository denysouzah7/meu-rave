import { and, asc, eq } from "drizzle-orm";
import { db } from "../database/client.js";
import {
  roomContents,
  roomPlaybackState,
  rooms,
  uploads,
  videos,
  type RoomContent
} from "../database/schema.js";
import { createId } from "../utils/id.js";
import { now } from "../utils/dates.js";
import { badRequest, notFound } from "../utils/http.js";
import { assertRoomModerator } from "./permission.service.js";

export type ContentInput = {
  title: string;
  sourceUrl: string;
  uploadId?: string | null | undefined;
  durationSeconds?: number | null | undefined;
};

export type PlaybackInput = {
  contentId?: string | null | undefined;
  isPlaying: boolean;
  positionSeconds: number;
};

type PlaybackState = typeof roomPlaybackState.$inferSelect;
type ListedContent = ReturnType<typeof listRoomContents>[number];

export function detectVideoSource(url: string): "youtube" | "direct" | "upload" {
  if (url.includes("/uploads/video/")) {
    return "upload";
  }

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    if (host === "youtube.com" || host === "youtu.be" || host === "m.youtube.com") {
      return "youtube";
    }
  } catch {
    throw badRequest("URL de video invalida");
  }

  return "direct";
}

export function youtubeEmbedUrl(url: string, start = 0) {
  const parsed = new URL(url);
  const host = parsed.hostname.replace(/^www\./, "");
  const id = host === "youtu.be" ? parsed.pathname.slice(1) : parsed.searchParams.get("v");
  if (!id) {
    return url;
  }
  return `https://www.youtube.com/embed/${id}?start=${Math.floor(start)}&enablejsapi=1&rel=0&modestbranding=1`;
}

export function listRoomContents(roomId: string) {
  return db
    .select({
      id: roomContents.id,
      roomId: roomContents.roomId,
      videoId: roomContents.videoId,
      title: roomContents.title,
      sortOrder: roomContents.sortOrder,
      isActive: roomContents.isActive,
      createdAt: roomContents.createdAt,
      sourceType: videos.sourceType,
      sourceUrl: videos.sourceUrl,
      durationSeconds: videos.durationSeconds,
      mimeType: videos.mimeType
    })
    .from(roomContents)
    .innerJoin(videos, eq(roomContents.videoId, videos.id))
    .where(eq(roomContents.roomId, roomId))
    .orderBy(asc(roomContents.sortOrder), asc(roomContents.createdAt))
    .all();
}

export function getPlaybackState(roomId: string) {
  return normalizePlaybackState(roomId).playback;
}

function getStoredPlaybackState(roomId: string) {
  return db
    .select()
    .from(roomPlaybackState)
    .where(eq(roomPlaybackState.roomId, roomId))
    .get();
}

function emptyPlaybackState(roomId: string): PlaybackState {
  return {
    roomId,
    contentId: null,
    isPlaying: false,
    positionSeconds: 0,
    updatedAt: now(),
    updatedByUserId: null
  };
}

function contentDuration(content: ListedContent) {
  return typeof content.durationSeconds === "number" && content.durationSeconds > 0 ? content.durationSeconds : null;
}

function secondsSincePlaybackUpdate(state: PlaybackState) {
  return Math.max(0, (Date.now() - state.updatedAt.getTime()) / 1000);
}

function savePlaybackState(
  roomId: string,
  contentId: string | null,
  isPlaying: boolean,
  positionSeconds: number,
  updatedByUserId: string | null
) {
  const timestamp = now();
  db.update(roomContents).set({ isActive: false }).where(eq(roomContents.roomId, roomId)).run();
  if (contentId) {
    db.update(roomContents).set({ isActive: true }).where(eq(roomContents.id, contentId)).run();
  }

  db.insert(roomPlaybackState)
    .values({
      roomId,
      contentId,
      isPlaying,
      positionSeconds,
      updatedAt: timestamp,
      updatedByUserId
    })
    .onConflictDoUpdate({
      target: roomPlaybackState.roomId,
      set: {
        contentId,
        isPlaying,
        positionSeconds,
        updatedAt: timestamp,
        updatedByUserId
      }
    })
    .run();

  return getStoredPlaybackState(roomId) ?? emptyPlaybackState(roomId);
}

export function normalizePlaybackState(roomId: string) {
  const stored = getStoredPlaybackState(roomId);
  if (!stored) {
    return { playback: emptyPlaybackState(roomId), changed: false };
  }

  if (!stored.isPlaying || !stored.contentId) {
    return { playback: stored, changed: false };
  }

  const contents = listRoomContents(roomId);
  if (contents.length === 0) {
    return {
      playback: savePlaybackState(roomId, null, false, 0, stored.updatedByUserId ?? null),
      changed: true
    };
  }

  let currentIndex = contents.findIndex((content) => content.id === stored.contentId);
  if (currentIndex < 0) {
    currentIndex = Math.max(0, contents.findIndex((content) => content.isActive));
  }
  if (currentIndex < 0) {
    currentIndex = 0;
  }

  let position = stored.positionSeconds + secondsSincePlaybackUpdate(stored);
  let changed = contents[currentIndex]?.id !== stored.contentId;

  while (currentIndex < contents.length) {
    const current = contents[currentIndex];
    if (!current) {
      break;
    }

    const duration = contentDuration(current);

    if (!duration || position < duration) {
      break;
    }

    position -= duration;

    if (currentIndex === contents.length - 1) {
      return {
        playback: savePlaybackState(roomId, current.id, false, duration, stored.updatedByUserId ?? null),
        changed: true
      };
    }

    currentIndex += 1;
    changed = true;
  }

  if (!changed) {
    return { playback: stored, changed: false };
  }

  const nextContent = contents[currentIndex];
  return {
    playback: savePlaybackState(
      roomId,
      nextContent?.id ?? null,
      Boolean(nextContent),
      Math.max(0, position),
      stored.updatedByUserId ?? null
    ),
    changed: true
  };
}

export function syncPlaybackSchedule() {
  const playingRooms = db
    .select({ roomId: roomPlaybackState.roomId })
    .from(roomPlaybackState)
    .where(eq(roomPlaybackState.isPlaying, true))
    .all();

  return playingRooms
    .map((room) => normalizePlaybackState(room.roomId))
    .filter((result) => result.changed)
    .map((result) => result.playback);
}

export function addContent(roomId: string, actorId: string, input: ContentInput) {
  assertRoomModerator(roomId, actorId);

  const room = db.select().from(rooms).where(eq(rooms.id, roomId)).get();
  if (!room) {
    throw notFound("Sala nao encontrada");
  }

  const sourceType = detectVideoSource(input.sourceUrl);
  let upload: typeof uploads.$inferSelect | null = null;
  if (input.uploadId) {
    upload = db.select().from(uploads).where(eq(uploads.id, input.uploadId)).get() ?? null;
    if (!upload) {
      throw notFound("Upload de video nao encontrado");
    }
  } else if (sourceType === "upload") {
    upload = db.select().from(uploads).where(eq(uploads.url, input.sourceUrl)).get() ?? null;
  }

  if (upload && upload.type !== "video") {
    throw badRequest("Upload de video invalido");
  }

  const timestamp = now();
  const video = db
    .insert(videos)
    .values({
      id: createId("vid"),
      uploaderId: actorId,
      uploadId: upload?.id ?? null,
      sourceType,
      sourceUrl: input.sourceUrl,
      title: input.title,
      durationSeconds:
        typeof input.durationSeconds === "number" && input.durationSeconds > 0 ? input.durationSeconds : null,
      mimeType: upload?.mimeType ?? null,
      createdAt: timestamp
    })
    .returning()
    .get();

  const order = listRoomContents(roomId).length;
  const content = db
    .insert(roomContents)
    .values({
      id: createId("cnt"),
      roomId,
      videoId: video.id,
      title: input.title,
      sortOrder: order,
      isActive: order === 0,
      createdAt: timestamp
    })
    .returning()
    .get();

  if (order === 0) {
    setActiveContent(roomId, content.id, actorId);
  }

  return { content, video };
}

export function removeContent(roomId: string, contentId: string, actorId: string) {
  assertRoomModerator(roomId, actorId);
  const deleted = db
    .delete(roomContents)
    .where(and(eq(roomContents.roomId, roomId), eq(roomContents.id, contentId)))
    .returning({ id: roomContents.id })
    .get();
  if (!deleted) {
    throw notFound("Conteudo nao encontrado");
  }
  return { ok: true };
}

export function setActiveContent(roomId: string, contentId: string | null, actorId: string) {
  assertRoomModerator(roomId, actorId);

  if (contentId) {
    const content = db
      .select()
      .from(roomContents)
      .where(and(eq(roomContents.roomId, roomId), eq(roomContents.id, contentId)))
      .get();
    if (!content) {
      throw notFound("Conteudo nao encontrado");
    }
  }

  db.update(roomContents).set({ isActive: false }).where(eq(roomContents.roomId, roomId)).run();
  if (contentId) {
    db.update(roomContents).set({ isActive: true }).where(eq(roomContents.id, contentId)).run();
  }

  const timestamp = now();
  db.insert(roomPlaybackState)
    .values({
      roomId,
      contentId,
      isPlaying: false,
      positionSeconds: 0,
      updatedAt: timestamp,
      updatedByUserId: actorId
    })
    .onConflictDoUpdate({
      target: roomPlaybackState.roomId,
      set: {
        contentId,
        isPlaying: false,
        positionSeconds: 0,
        updatedAt: timestamp,
        updatedByUserId: actorId
      }
    })
    .run();

  return getPlaybackState(roomId);
}

export function updatePlayback(roomId: string, actorId: string, input: PlaybackInput) {
  assertRoomModerator(roomId, actorId);

  const timestamp = now();
  db.insert(roomPlaybackState)
    .values({
      roomId,
      contentId: input.contentId ?? null,
      isPlaying: input.isPlaying,
      positionSeconds: Math.max(0, input.positionSeconds),
      updatedAt: timestamp,
      updatedByUserId: actorId
    })
    .onConflictDoUpdate({
      target: roomPlaybackState.roomId,
      set: {
        contentId: input.contentId ?? null,
        isPlaying: input.isPlaying,
        positionSeconds: Math.max(0, input.positionSeconds),
        updatedAt: timestamp,
        updatedByUserId: actorId
      }
    })
    .run();

  return getPlaybackState(roomId);
}

export function getActiveContent(contents: ReturnType<typeof listRoomContents>, state: ReturnType<typeof getPlaybackState>) {
  return contents.find((content) => content.id === state.contentId) ?? contents.find((content) => content.isActive) ?? null;
}
