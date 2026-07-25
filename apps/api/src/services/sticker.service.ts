import { and, asc, desc, eq, ne, or } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { db } from "../database/client.js";
import { stickerPacks, stickers, uploads, users } from "../database/schema.js";
import { createId } from "../utils/id.js";
import { now } from "../utils/dates.js";
import { badRequest, notFound } from "../utils/http.js";

const originalCreators = alias(users, "sticker_original_creators");

export function createStickerPack(userId: string, name: string) {
  const timestamp = now();
  return db
    .insert(stickerPacks)
    .values({
      id: createId("spk"),
      userId,
      name,
      createdAt: timestamp,
      updatedAt: timestamp
    })
    .returning()
    .get();
}

export function listStickerPacks(userId: string) {
  const packs = db
    .select()
    .from(stickerPacks)
    .where(eq(stickerPacks.userId, userId))
    .orderBy(desc(stickerPacks.updatedAt))
    .all();

  return packs.map((pack) => ({
    ...pack,
    stickers: listStickersForPack(pack.id)
  }));
}

export function addSticker(packId: string, userId: string, uploadId: string, name: string) {
  const pack = db.select().from(stickerPacks).where(eq(stickerPacks.id, packId)).get();
  if (!pack || pack.userId !== userId) {
    throw notFound("Pacote de figurinhas nao encontrado");
  }

  const upload = db.select().from(uploads).where(eq(uploads.id, uploadId)).get();
  if (!upload || upload.userId !== userId) {
    throw notFound("Upload de figurinha nao encontrado");
  }

  const timestamp = now();
  const sticker = db
    .insert(stickers)
    .values({
      id: createId("stk"),
      packId,
      uploadId,
      originalCreatorId: userId,
      originalCreatedAt: timestamp,
      sourceStickerId: null,
      name,
      imageUrl: upload.url,
      createdAt: timestamp
    })
    .returning()
    .get();

  db.update(stickerPacks).set({ updatedAt: timestamp }).where(eq(stickerPacks.id, packId)).run();
  return getStickerDto(sticker.id) ?? sticker;
}

export function saveStickerFromMessage(stickerId: string, userId: string) {
  const source = db
    .select({
      id: stickers.id,
      packId: stickers.packId,
      uploadId: stickers.uploadId,
      originalCreatorId: stickers.originalCreatorId,
      originalCreatedAt: stickers.originalCreatedAt,
      sourceStickerId: stickers.sourceStickerId,
      name: stickers.name,
      imageUrl: stickers.imageUrl,
      createdAt: stickers.createdAt,
      packUserId: stickerPacks.userId
    })
    .from(stickers)
    .innerJoin(stickerPacks, eq(stickers.packId, stickerPacks.id))
    .where(eq(stickers.id, stickerId))
    .get();

  if (!source) {
    throw notFound("Figurinha nao encontrada");
  }

  const sourceStickerId = source.sourceStickerId ?? source.id;
  if (source.packUserId === userId) {
    return getStickerDto(source.id) ?? source;
  }

  const existing = db
    .select({ id: stickers.id })
    .from(stickers)
    .innerJoin(stickerPacks, eq(stickers.packId, stickerPacks.id))
    .where(
      and(
        eq(stickerPacks.userId, userId),
        or(eq(stickers.id, sourceStickerId), eq(stickers.sourceStickerId, sourceStickerId))
      )
    )
    .get();

  if (existing) {
    return getStickerDto(existing.id) ?? existing;
  }

  const pack = getOrCreateDefaultStickerPack(userId);
  const timestamp = now();
  const sticker = db
    .insert(stickers)
    .values({
      id: createId("stk"),
      packId: pack.id,
      uploadId: source.uploadId,
      originalCreatorId: source.originalCreatorId ?? source.packUserId,
      originalCreatedAt: source.originalCreatedAt ?? source.createdAt,
      sourceStickerId,
      name: source.name,
      imageUrl: source.imageUrl,
      createdAt: timestamp
    })
    .returning()
    .get();

  db.update(stickerPacks).set({ updatedAt: timestamp }).where(eq(stickerPacks.id, pack.id)).run();
  return getStickerDto(sticker.id) ?? sticker;
}

export function deleteSticker(stickerId: string, userId: string) {
  const sticker = db.select().from(stickers).where(eq(stickers.id, stickerId)).get();
  if (!sticker) {
    throw notFound("Figurinha nao encontrada");
  }

  const pack = db.select().from(stickerPacks).where(eq(stickerPacks.id, sticker.packId)).get();
  if (!pack || pack.userId !== userId) {
    throw notFound("Figurinha nao encontrada");
  }

  db.delete(stickers).where(eq(stickers.id, stickerId)).run();
  return { ok: true };
}

export function updateStickerPack(packId: string, userId: string, name: string) {
  const pack = db.select().from(stickerPacks).where(eq(stickerPacks.id, packId)).get();
  if (!pack || pack.userId !== userId) {
    throw notFound("Pacote de figurinhas nao encontrado");
  }

  if (!name.trim() || name.trim().length < 2 || name.trim().length > 60) {
    throw badRequest("Nome do pacote deve ter entre 2 e 60 caracteres");
  }

  return db
    .update(stickerPacks)
    .set({ name: name.trim(), updatedAt: now() })
    .where(eq(stickerPacks.id, packId))
    .returning()
    .get();
}

export function deleteStickerPack(packId: string, userId: string) {
  const pack = db.select().from(stickerPacks).where(eq(stickerPacks.id, packId)).get();
  if (!pack || pack.userId !== userId) {
    throw notFound("Pacote de figurinhas nao encontrado");
  }

  const stickerCount = db
    .select({ count: stickers.id })
    .from(stickers)
    .where(eq(stickers.packId, packId))
    .all();

  if (stickerCount.length > 0) {
    throw badRequest("Remova todas as figurinhas antes de excluir o pacote");
  }

  db.delete(stickerPacks).where(eq(stickerPacks.id, packId)).run();
  return { ok: true };
}

export function moveStickerToPack(stickerId: string, targetPackId: string, userId: string) {
  const sticker = db.select().from(stickers).where(eq(stickers.id, stickerId)).get();
  if (!sticker) {
    throw notFound("Figurinha nao encontrada");
  }

  const currentPack = db
    .select()
    .from(stickerPacks)
    .where(eq(stickerPacks.id, sticker.packId))
    .get();
  if (!currentPack || currentPack.userId !== userId) {
    throw notFound("Figurinha nao encontrada");
  }

  const targetPack = db
    .select()
    .from(stickerPacks)
    .where(eq(stickerPacks.id, targetPackId))
    .get();
  if (!targetPack || targetPack.userId !== userId) {
    throw notFound("Pacote destino nao encontrado");
  }

  const timestamp = now();
  db.update(stickers)
    .set({ packId: targetPackId })
    .where(eq(stickers.id, stickerId))
    .run();

  db.update(stickerPacks).set({ updatedAt: timestamp }).where(eq(stickerPacks.id, targetPackId)).run();
  db.update(stickerPacks).set({ updatedAt: timestamp }).where(eq(stickerPacks.id, currentPack.id)).run();

  return getStickerDto(stickerId) ?? { ok: true };
}

function getOrCreateDefaultStickerPack(userId: string) {
  const existing = db
    .select()
    .from(stickerPacks)
    .where(and(eq(stickerPacks.userId, userId), eq(stickerPacks.name, "Favoritas")))
    .get();

  return existing ?? createStickerPack(userId, "Favoritas");
}

function listStickersForPack(packId: string) {
  return db
    .select({
      id: stickers.id,
      packId: stickers.packId,
      uploadId: stickers.uploadId,
      originalCreatorId: stickers.originalCreatorId,
      originalCreatorName: originalCreators.name,
      originalCreatedAt: stickers.originalCreatedAt,
      sourceStickerId: stickers.sourceStickerId,
      name: stickers.name,
      imageUrl: stickers.imageUrl,
      createdAt: stickers.createdAt
    })
    .from(stickers)
    .leftJoin(originalCreators, eq(stickers.originalCreatorId, originalCreators.id))
    .where(eq(stickers.packId, packId))
    .orderBy(desc(stickers.createdAt))
    .all();
}

function getStickerDto(stickerId: string) {
  return db
    .select({
      id: stickers.id,
      packId: stickers.packId,
      uploadId: stickers.uploadId,
      originalCreatorId: stickers.originalCreatorId,
      originalCreatorName: originalCreators.name,
      originalCreatedAt: stickers.originalCreatedAt,
      sourceStickerId: stickers.sourceStickerId,
      name: stickers.name,
      imageUrl: stickers.imageUrl,
      createdAt: stickers.createdAt
    })
    .from(stickers)
    .leftJoin(originalCreators, eq(stickers.originalCreatorId, originalCreators.id))
    .where(eq(stickers.id, stickerId))
    .get();
}
