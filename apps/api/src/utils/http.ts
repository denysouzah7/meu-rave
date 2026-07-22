import type { FastifyReply } from "fastify";
import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code = "REQUEST_ERROR"
  ) {
    super(message);
  }
}

export function notFound(message = "Registro nao encontrado") {
  return new HttpError(404, message, "NOT_FOUND");
}

export function forbidden(message = "Acesso negado") {
  return new HttpError(403, message, "FORBIDDEN");
}

export function badRequest(message = "Dados invalidos") {
  return new HttpError(400, message, "BAD_REQUEST");
}

type ZodLikeError = ZodError | { name: "ZodError"; issues: ZodError["issues"] };

function isZodError(error: unknown): error is ZodLikeError {
  return (
    error instanceof ZodError ||
    (typeof error === "object" &&
      error !== null &&
      "name" in error &&
      error.name === "ZodError" &&
      "issues" in error)
  );
}

export function sendError(reply: FastifyReply, error: unknown) {
  if (error instanceof HttpError) {
    return reply.status(error.statusCode).send({ error: error.message, code: error.code });
  }

  if (isZodError(error)) {
    const zodError = error instanceof ZodError ? error : new ZodError(error.issues as ZodError["issues"]);
    return reply.status(422).send({
      error: "Validacao falhou",
      code: "VALIDATION_ERROR",
      issues: zodError.flatten()
    });
  }

  throw error;
}
