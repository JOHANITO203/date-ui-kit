import { FastifyReply } from "fastify";
import type { AuthFallback, AuthResponse } from "./types";

export function sendAuthError(
  reply: FastifyReply,
  statusCode: number,
  code: string,
  message: string,
  fallback?: AuthFallback[]
) {
  reply.status(statusCode).send({
    ok: false,
    code,
    message,
    fallback,
  } satisfies AuthResponse);
}

export function sendAuthSuccess<T>(
  reply: FastifyReply,
  payload: AuthResponse<T>
) {
  reply.send(payload);
}
