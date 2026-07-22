import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAdmin } from "../middleware/authenticate.js";
import { getSettings, updateMessageRetentionDays } from "../services/settings.service.js";

const retentionSchema = z.object({
  messageRetentionDays: z.number().int().min(1).max(365)
});

export async function settingsRoutes(app: FastifyInstance) {
  app.get("/admin/settings", { preHandler: requireAdmin }, async () => {
    return { settings: getSettings() };
  });

  app.patch("/admin/settings", { preHandler: requireAdmin }, async (request) => {
    const input = retentionSchema.parse(request.body);
    return { settings: updateMessageRetentionDays(input.messageRetentionDays) };
  });
}
