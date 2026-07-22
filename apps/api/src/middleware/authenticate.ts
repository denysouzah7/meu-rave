import type { FastifyReply, FastifyRequest } from "fastify";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../auth/auth.js";
import { getUserById, ensureFirstAdmin } from "../services/user.service.js";

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(request.headers)
  });

  if (!session) {
    return reply.status(401).send({ error: "Autenticacao obrigatoria", code: "UNAUTHORIZED" });
  }

  ensureFirstAdmin(session.user.id);

  const user = getUserById(session.user.id);
  if (!user) {
    return reply.status(401).send({ error: "Sessao invalida", code: "INVALID_SESSION" });
  }

  if (user.isBlocked) {
    return reply.status(403).send({
      error: user.blockedReason ?? "Usuario bloqueado",
      code: "USER_BLOCKED"
    });
  }

  request.currentUser = user;
  request.sessionToken = session.session.token;
}

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  await authenticate(request, reply);
  if (reply.sent) {
    return;
  }

  if (request.currentUser?.role !== "admin") {
    return reply.status(403).send({ error: "Acesso de administrador obrigatorio", code: "ADMIN_ONLY" });
  }
}
