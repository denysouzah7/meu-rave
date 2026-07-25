import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { db } from "../database/client.js";
import { roomStatuses, uploads } from "../database/schema.js";
import { createId } from "../utils/id.js";
import { now } from "../utils/dates.js";
import { badRequest, notFound } from "../utils/http.js";

export function createStatus(
  roomId: string,
  userId: string,
  uploadId: string,
  type: "image" | "video",
  caption?: string | null,
) {
  const upload = db
    .select()
    .from(uploads)
    .where(eq(uploads.id, uploadId))
    .get();

  if (!upload || upload.userId !== userId) {
    throw badRequest("Upload invalido");
  }

  const timestamp = now();
  const expiresAt = new Date(timestamp.getTime() + 24 * 60 * 60 * 1000);

  const status = db
    .insert(roomStatuses)
    .values({
      id: createId("stat"),
      roomId,
      userId,
      uploadId,
      type,
      caption: caption ?? null,
      createdAt: timestamp,
      expiresAt,
      deletedAt: null,
    })
    .returning()
    .get();

  return mapStatus(status, upload.url);
}

export function listActiveStatuses(roomId: string) {
  const rows = db
    .select({
      status: roomStatuses,
      uploadUrl: uploads.url,
    })
    .from(roomStatuses)
    .innerJoin(uploads, eq(roomStatuses.uploadId, uploads.id))
    .where(
      and(
        eq(roomStatuses.roomId, roomId),
        gt(roomStatuses.expiresAt, now()),
        isNull(roomStatuses.deletedAt),
      ),
    )
    .orderBy(desc(roomStatuses.createdAt))
    .all();

  return rows.map((r) => mapStatus(r.status, r.uploadUrl));
}

export function deleteStatus(statusId: string, userId: string) {
  const status = db
    .select()
    .from(roomStatuses)
    .where(eq(roomStatuses.id, statusId))
    .get();

  if (!status) {
    throw notFound("Status nao encontrado");
  }

  if (status.userId !== userId) {
    throw badRequest("Voce nao pode deletar este status");
  }

  db.update(roomStatuses)
    .set({ deletedAt: now() })
    .where(eq(roomStatuses.id, statusId))
    .run();

  return { id: statusId };
}

export function listRoomIdsWithActiveStatus(): string[] {
  const rows = db
    .select({ roomId: roomStatuses.roomId })
    .from(roomStatuses)
    .where(
      and(gt(roomStatuses.expiresAt, now()), isNull(roomStatuses.deletedAt)),
    )
    .groupBy(roomStatuses.roomId)
    .all();

  return rows.map((r) => r.roomId);
}

function mapStatus(s: typeof roomStatuses.$inferSelect, mediaUrl: string) {
  return {
    id: s.id,
    roomId: s.roomId,
    userId: s.userId,
    uploadId: s.uploadId,
    mediaUrl,
    type: s.type,
    caption: s.caption,
    createdAt: s.createdAt.toISOString(),
    expiresAt: s.expiresAt.toISOString(),
  };
}
