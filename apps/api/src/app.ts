import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import { resolve } from "node:path";
import { clientOrigins, env } from "./config/env.js";
import { migrate } from "./database/migrate.js";
import { registerRoutes } from "./routes/index.js";
import { sendError } from "./utils/http.js";

export async function buildApp() {
  migrate();

  const app = Fastify({
    logger: {
      level: env.NODE_ENV === "development" ? "info" : "warn"
    },
    bodyLimit: 20 * 1024 * 1024
  });

  await app.register(cors, {
    origin: clientOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
  });

  await app.register(multipart, {
    limits: {
      fileSize: 1024 * 1024 * 700,
      files: 1
    }
  });

  await app.register(fastifyStatic, {
    root: resolve(process.cwd(), env.UPLOAD_DIR),
    prefix: "/uploads/",
    decorateReply: false
  });

  await registerRoutes(app);

  app.setErrorHandler((error, _request, reply) => {
    try {
      return sendError(reply, error);
    } catch {
      app.log.error(error);
      return reply.status(500).send({
        error: "Erro interno do servidor",
        code: "INTERNAL_SERVER_ERROR"
      });
    }
  });

  return app;
}
