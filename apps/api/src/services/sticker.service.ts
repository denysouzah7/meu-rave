import { asc, eq } from "drizzle-orm";
import { db } from "../database/client.js";
import { stickerPacks, stickers, uploads } from "../database/schema.js";
import { createId } from "../utils/id.js";
import { now } from "../utils/dates.js";
import { notFound } from "../utils/http.js";

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
    .orderBy(asc(stickerPacks.createdAt))
    .all();

  return packs.map((pack) => ({
    ...pack,
    stickers: db.select().from(stickers).where(eq(stickers.packId, pack.id)).orderBy(asc(stickers.createdAt)).all()
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
      name,
      imageUrl: upload.url,
      createdAt: timestamp
    })
    .returning()
    .get();

  db.update(stickerPacks).set({ updatedAt: timestamp }).where(eq(stickerPacks.id, packId)).run();
  return sticker;
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
