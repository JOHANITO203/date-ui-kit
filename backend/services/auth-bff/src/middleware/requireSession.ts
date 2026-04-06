import type { FastifyReply, FastifyRequest } from "fastify";
import { requireUser, type RequireUserResult } from "../lib/session";

declare module "fastify" {
  interface FastifyRequest {
    userSession?: RequireUserResult;
  }
}

export async function requireSessionMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const session = await requireUser(request, reply);
  if (!session) return;
  request.userSession = session;
}
