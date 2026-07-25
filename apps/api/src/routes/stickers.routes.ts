import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../middleware/authenticate.js";
import {
  addSticker,
  createStickerPack,
  deleteSticker,
  deleteStickerPack,
  listStickerPacks,
  moveStickerToPack,
  saveStickerFromMessage,
  updateStickerPack,
} from "../services/sticker.service.js";

const packSchema = z.object({
  name: z.string().min(2).max(60)
});

const stickerSchema = z.object({
  uploadId: z.string().min(1),
  name: z.string().min(1).max(60)
});

export async function stickersRoutes(app: FastifyInstance) {
  app.get("/stickers/packs", { preHandler: authenticate }, async (request) => {
    return { packs: listStickerPacks(request.currentUser!.id) };
  });

  app.post("/stickers/packs", { preHandler: authenticate }, async (request) => {
    const input = packSchema.parse(request.body);
    return { pack: createStickerPack(request.currentUser!.id, input.name) };
  });

  app.patch("/stickers/packs/:packId", { preHandler: authenticate }, async (request) => {
    const params = z.object({ packId: z.string() }).parse(request.params);
    const input = packSchema.parse(request.body);
    return { pack: updateStickerPack(params.packId, request.currentUser!.id, input.name) };
  });

  app.delete("/stickers/packs/:packId", { preHandler: authenticate }, async (request) => {
    const params = z.object({ packId: z.string() }).parse(request.params);
    return deleteStickerPack(params.packId, request.currentUser!.id);
  });

  app.post("/stickers/packs/:packId/stickers", { preHandler: authenticate }, async (request) => {
    const params = z.object({ packId: z.string() }).parse(request.params);
    const input = stickerSchema.parse(request.body);
    return { sticker: addSticker(params.packId, request.currentUser!.id, input.uploadId, input.name) };
  });

  app.patch("/stickers/:id/move", { preHandler: authenticate }, async (request) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const input = z.object({ packId: z.string() }).parse(request.body);
    return { sticker: moveStickerToPack(params.id, input.packId, request.currentUser!.id) };
  });

  app.post("/stickers/:id/save", { preHandler: authenticate }, async (request) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    return { sticker: saveStickerFromMessage(params.id, request.currentUser!.id) };
  });

  app.delete("/stickers/:id", { preHandler: authenticate }, async (request) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    return deleteSticker(params.id, request.currentUser!.id);
  });
}
