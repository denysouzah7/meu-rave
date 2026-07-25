import type { FastifyInstance } from "fastify";
import { authenticate } from "../middleware/authenticate.js";
import { assertRoomModerator } from "../services/permission.service.js";
import { getRoomBySlug } from "../services/room.service.js";
import {
  createStatus,
  deleteStatus,
  listActiveStatuses,
  listRoomIdsWithActiveStatus,
} from "../services/status.service.js";
import { badRequest, notFound } from "../utils/http.js";

export async function statusRoutes(app: FastifyInstance) {
  app.get("/status-active", { preHandler: [authenticate] }, async (_req, _reply) => {
    const roomIds = listRoomIdsWithActiveStatus();
    return { roomIds };
  });

  app.get(
    "/rooms/:slug/status",
    { preHandler: [authenticate] },
    async (req, reply) => {
      const { slug } = req.params as { slug: string };
      const { room } = getRoomBySlug(slug, req.currentUser!.id);
      if (!room) throw notFound("Sala nao encontrada");
      const statuses = listActiveStatuses(room.id);
      return { statuses };
    },
  );

  app.post(
    "/rooms/:slug/status",
    { preHandler: [authenticate] },
    async (req, reply) => {
      const { slug } = req.params as { slug: string };
      const { uploadId, type, caption } = req.body as {
        uploadId: string;
        type: "image" | "video";
        caption?: string;
      };
      const { room } = getRoomBySlug(slug, req.currentUser!.id);
      if (!room) throw notFound("Sala nao encontrada");
      assertRoomModerator(room.id, req.currentUser!.id);
      if (!uploadId || !type) throw badRequest("uploadId e type sao obrigatorios");
      if (type !== "image" && type !== "video") throw badRequest("type deve ser image ou video");
      const status = createStatus(room.id, req.currentUser!.id, uploadId, type, caption);
      return { status };
    },
  );

  app.delete(
    "/rooms/:slug/status/:statusId",
    { preHandler: [authenticate] },
    async (req, reply) => {
      const { slug, statusId } = req.params as {
        slug: string;
        statusId: string;
      };
      const { room } = getRoomBySlug(slug, req.currentUser!.id);
      if (!room) throw notFound("Sala nao encontrada");
      const result = deleteStatus(statusId, req.currentUser!.id);
      return result;
    },
  );
}
