import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../middleware/authenticate.js";
import {
  addSticker,
  createStickerPack,
  deleteSticker,
  listStickerPacks
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

  app.post("/stickers/packs/:packId/stickers", { preHandler: authenticate }, async (request) => {
    const params = z.object({ packId: z.string() }).parse(request.params);
    const input = stickerSchema.parse(request.body);
    return { sticker: addSticker(params.packId, request.currentUser!.id, input.uploadId, input.name) };
  });

  app.delete("/stickers/:id", { preHandler: authenticate }, async (request) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    return deleteSticker(params.id, request.currentUser!.id);
  });
}
