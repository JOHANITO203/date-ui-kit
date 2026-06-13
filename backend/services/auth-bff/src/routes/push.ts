import type { FastifyInstance } from "fastify";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { prismaClient } from "../lib/prismaClient";
import { requireSessionMiddleware } from "../middleware/requireSession";
import { sendAuthError, sendAuthSuccess } from "./auth/utils";
import type { AuthResponse } from "./auth/types";
import { env } from "../config/env";
import { sendPushToUser, type PushPayload } from "../lib/pushService";

const subscribeSchema = z.object({
  endpoint: z.string().url().max(2000),
  keys: z.object({
    p256dh: z.string().min(1).max(500),
    auth: z.string().min(1).max(500),
  }),
});

const unsubscribeSchema = z.object({
  endpoint: z.string().url().max(2000),
});

const internalPushSchema = z.object({
  userId: z.string().min(1),
  payload: z.object({
    title: z.string().min(1).max(120),
    body: z.string().max(400).default(""),
    url: z.string().max(500).optional(),
    tag: z.string().max(80).optional(),
    kind: z.enum(["match", "message", "boost", "visitor", "generic"]).optional(),
    icon: z.string().max(500).optional(),
  }),
});

const constantTimeEqual = (a: string, b: string): boolean => {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
};

export async function registerPushRoutes(app: FastifyInstance) {
  // Public VAPID key — the frontend needs it to subscribe.
  app.get("/api/push/public-key", async (_request, reply) => {
    if (!env.hasPush) {
      reply.status(404);
      return { code: "PUSH_NOT_CONFIGURED" };
    }
    return { publicKey: env.VAPID_PUBLIC_KEY };
  });

  // Internal service-to-service trigger. Only reachable on the internal Docker
  // network (nginx does not proxy /internal/*). Gated by the shared secret.
  app.post("/internal/notifications/push", async (request, reply) => {
    const provided = request.headers["x-internal-secret"];
    if (typeof provided !== "string" || !constantTimeEqual(provided, env.INTERNAL_JWT_SECRET)) {
      reply.status(401);
      return { ok: false, code: "UNAUTHORIZED" };
    }
    const parsed = internalPushSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.status(400);
      return { ok: false, code: "INVALID_PAYLOAD" };
    }
    try {
      const result = await sendPushToUser(parsed.data.userId, parsed.data.payload as PushPayload);
      return { ok: true, sent: result.sent };
    } catch (err) {
      request.log.error({ err }, "push.internal_send_failed");
      reply.status(500);
      return { ok: false, code: "PUSH_SEND_FAILED" };
    }
  });

  app.register(async (protectedRoutes) => {
    protectedRoutes.addHook("preHandler", requireSessionMiddleware);

    protectedRoutes.post("/api/push/subscribe", async (request, reply) => {
      const session = request.userSession;
      if (!session) return;

      const parsed = subscribeSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendAuthError(reply, 400, "PUSH_SUBSCRIBE_INVALID", "Invalid subscription payload.");
      }
      const { endpoint, keys } = parsed.data;
      const userAgent = (request.headers["user-agent"] ?? "").toString().slice(0, 255);

      try {
        await prismaClient.pushSubscription.upsert({
          where: { endpoint },
          create: { userId: session.user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent },
          update: { userId: session.user.id, p256dh: keys.p256dh, auth: keys.auth, userAgent },
        });
      } catch (err) {
        request.log.error({ err, userId: session.user.id }, "push.subscribe_failed");
        return sendAuthError(reply, 500, "PUSH_SUBSCRIBE_FAILED", "Unable to save subscription.");
      }

      return sendAuthSuccess(reply, { ok: true } satisfies AuthResponse);
    });

    protectedRoutes.post("/api/push/unsubscribe", async (request, reply) => {
      const session = request.userSession;
      if (!session) return;

      const parsed = unsubscribeSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendAuthError(reply, 400, "PUSH_UNSUBSCRIBE_INVALID", "Invalid payload.");
      }
      try {
        // Scope deletion to the owner so one user can't remove another's device.
        await prismaClient.pushSubscription.deleteMany({
          where: { endpoint: parsed.data.endpoint, userId: session.user.id },
        });
      } catch (err) {
        request.log.warn({ err, userId: session.user.id }, "push.unsubscribe_failed");
      }
      return sendAuthSuccess(reply, { ok: true } satisfies AuthResponse);
    });
  });
}
