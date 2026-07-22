import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate, requireAdmin } from "../middleware/authenticate.js";
import {
  blockUser,
  listUsers,
  removeUser,
  setUserRole,
  updateProfile
} from "../services/user.service.js";

const profileSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  image: z.string().url().nullable().optional(),
  profileTheme: z.string().max(40).optional()
});

const roleSchema = z.object({
  role: z.enum(["admin", "participant"])
});

const blockSchema = z.object({
  isBlocked: z.boolean(),
  blockedReason: z.string().max(200).optional()
});

export async function usersRoutes(app: FastifyInstance) {
  app.get("/me", { preHandler: authenticate }, async (request) => {
    return { user: request.currentUser };
  });

  app.patch("/me", { preHandler: authenticate }, async (request) => {
    const input = profileSchema.parse(request.body);
    return { user: updateProfile(request.currentUser!.id, input) };
  });

  app.get("/admin/users", { preHandler: requireAdmin }, async () => {
    return { users: listUsers() };
  });

  app.patch("/admin/users/:id/role", { preHandler: requireAdmin }, async (request) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const input = roleSchema.parse(request.body);
    return { user: setUserRole(params.id, input.role, request.currentUser!.id) };
  });

  app.patch("/admin/users/:id/block", { preHandler: requireAdmin }, async (request) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const input = blockSchema.parse(request.body);
    return { user: blockUser(params.id, input.isBlocked, input.blockedReason) };
  });

  app.delete("/admin/users/:id", { preHandler: requireAdmin }, async (request) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    return removeUser(params.id, request.currentUser!.id);
  });
}
