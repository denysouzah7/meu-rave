import type { FastifyInstance } from "fastify";
import { authRoutes } from "./auth.routes.js";
import { roomsRoutes } from "./rooms.routes.js";
import { settingsRoutes } from "./settings.routes.js";
import { statusRoutes } from "./status.routes.js";
import { stickersRoutes } from "./stickers.routes.js";
import { uploadsRoutes } from "./uploads.routes.js";
import { usersRoutes } from "./users.routes.js";

export async function registerRoutes(app: FastifyInstance) {
  app.get("/health", async () => ({ ok: true }));
  await app.register(authRoutes, { prefix: "/api" });
  await app.register(usersRoutes, { prefix: "/api" });
  await app.register(roomsRoutes, { prefix: "/api" });
  await app.register(uploadsRoutes, { prefix: "/api" });
  await app.register(stickersRoutes, { prefix: "/api" });
  await app.register(statusRoutes, { prefix: "/api" });
  await app.register(settingsRoutes, { prefix: "/api" });
}
