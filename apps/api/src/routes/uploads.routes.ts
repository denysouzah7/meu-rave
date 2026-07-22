import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../middleware/authenticate.js";
import { saveUpload, type UploadKind } from "../services/upload.service.js";
import { updateProfile } from "../services/user.service.js";

const uploadKindSchema = z.object({
  type: z.enum(["video", "image", "sticker", "avatar", "audio"])
});

export async function uploadsRoutes(app: FastifyInstance) {
  app.post("/uploads/:type", { preHandler: authenticate }, async (request, reply) => {
    const params = uploadKindSchema.parse(request.params);
    const file = await request.file();
    if (!file) {
      return reply.status(400).send({ error: "Arquivo obrigatorio", code: "FILE_REQUIRED" });
    }

    const upload = await saveUpload(file, request.currentUser!.id, params.type as UploadKind);
    if (params.type === "avatar") {
      updateProfile(request.currentUser!.id, { image: upload.url });
    }

    return { upload };
  });
}
