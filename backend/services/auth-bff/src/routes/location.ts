import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prismaClient } from "../lib/prismaClient";
import { requireSessionMiddleware } from "../middleware/requireSession";
import { sendAuthError, sendAuthSuccess } from "./auth/utils";
import type { AuthResponse } from "./auth/types";
import { env } from "../config/env";

const RUSSIA_BOUNDS = { latMin: 41.2, latMax: 82.0, lngMin: 19.6, lngMax: 191.0 };

const locationBodySchema = z.object({
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
  accuracy: z.number().positive().optional(),
  city: z.string().max(120).optional(),
  country: z.string().max(120).optional(),
});

export async function registerLocationRoutes(app: FastifyInstance) {
  app.register(async (protectedRoutes) => {
    protectedRoutes.addHook("preHandler", requireSessionMiddleware);

    protectedRoutes.put("/api/location", async (request, reply) => {
      const session = request.userSession;
      if (!session) return;

      const parsed = locationBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return sendAuthError(reply, 400, "LOCATION_INVALID", "Invalid location payload.");
      }

      const { lat, lng, accuracy, city, country } = parsed.data;

      if (env.GEO_SCOPE === "russia") {
        if (
          lat < RUSSIA_BOUNDS.latMin || lat > RUSSIA_BOUNDS.latMax ||
          lng < RUSSIA_BOUNDS.lngMin || lng > RUSSIA_BOUNDS.lngMax
        ) {
          return sendAuthError(reply, 422, "LOCATION_OUT_OF_SCOPE", "Location outside supported region.");
        }
      }

      await prismaClient.userLocation
        .upsert({
          where: { userId: session.user.id },
          create: {
            userId: session.user.id,
            lat,
            lng,
            accuracy: accuracy ?? null,
            city: city ?? null,
            country: country ?? null,
          },
          update: {
            lat,
            lng,
            accuracy: accuracy ?? null,
            city: city ?? null,
            country: country ?? null,
          },
        })
        .catch((err: unknown) => {
          request.log.error({ err, userId: session.user.id }, "location.upsert_failed");
        });

      return sendAuthSuccess(reply, { ok: true } satisfies AuthResponse);
    });

    protectedRoutes.post("/api/presence/heartbeat", async (request, reply) => {
      const session = request.userSession;
      if (!session) return;

      await prismaClient.userSettings
        .upsert({
          where: { userId: session.user.id },
          create: { userId: session.user.id, lastSeenAt: new Date() },
          update: { lastSeenAt: new Date() },
        })
        .catch((err: unknown) => {
          request.log.warn({ err, userId: session.user.id }, "presence.heartbeat_failed");
        });

      return reply.status(204).send();
    });
  });
}
