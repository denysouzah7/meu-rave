import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAdmin } from "../middleware/authenticate.js";
import {
  getSettings,
  updateMessageRetentionDays,
  updateMusicApiUrl,
} from "../services/settings.service.js";

const settingsSchema = z.object({
  messageRetentionDays: z.number().int().min(1).max(365).optional(),
  musicApiUrl: z.string().optional(),
});

export async function settingsRoutes(app: FastifyInstance) {
  app.get("/music-api-url", async () => {
    return { url: getSettings().musicApiUrl };
  });

  app.get("/admin/settings", { preHandler: requireAdmin }, async () => {
    return { settings: getSettings() };
  });

  app.patch("/admin/settings", { preHandler: requireAdmin }, async (request) => {
    const input = settingsSchema.parse(request.body);
    if (input.messageRetentionDays !== undefined) {
      updateMessageRetentionDays(input.messageRetentionDays);
    }
    if (input.musicApiUrl !== undefined) {
      updateMusicApiUrl(input.musicApiUrl);
    }
    return { settings: getSettings() };
  });
}
