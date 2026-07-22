import type { User } from "../database/schema.js";

declare module "fastify" {
  interface FastifyRequest {
    currentUser?: User;
    sessionToken?: string;
  }
}
