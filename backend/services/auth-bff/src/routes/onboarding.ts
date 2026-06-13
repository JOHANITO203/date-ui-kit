import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prismaClient } from "../lib/prismaClient";
import { sendAuthError, sendAuthSuccess } from "./auth/utils";
import type { AuthResponse } from "./auth/types";
import { requireSessionMiddleware } from "../middleware/requireSession";

const onboardingCompleteSchema = z.object({
  version: z.literal("v1"),
  firstName: z.string().min(1).max(100),
  locale: z.enum(["en", "ru"]),
  birthDate: z.string().min(10).max(10),
  gender: z.enum(["homme", "femme", "autre"]),
  city: z.string().min(1).max(120),
  originCountry: z.string().min(1).max(120),
  languages: z.array(z.string().min(1)).min(1).max(10),
  intent: z.enum(["serieuse", "connexion", "decouverte", "verrai"]),
  interests: z.array(z.string().min(1)).min(3).max(5),
  photosCount: z.number().int().min(0).max(12),
  verifyNow: z.boolean(),
  lookingFor: z.enum(["hommes", "femmes", "tous"]),
  ageMin: z.number().int().min(18).max(100),
  ageMax: z.number().int().min(18).max(100),
  distanceKm: z.number().int().min(1).max(500),
  targetLang: z.enum(["en", "ru", "fr"]),
  autoTranslate: z.boolean(),
  autoDetectLanguage: z.boolean(),
  notifications: z.boolean(),
  preciseLocation: z.boolean(),
});

const mapLookingFor = (value: "hommes" | "femmes" | "tous") => {
  if (value === "hommes") return "men";
  if (value === "femmes") return "women";
  return "everyone";
};

export async function registerOnboardingRoutes(app: FastifyInstance) {
  app.register(async (protectedRoutes) => {
    protectedRoutes.addHook("preHandler", requireSessionMiddleware);

    protectedRoutes.post("/onboarding/complete", async (request, reply) => {
      const session = request.userSession;
      if (!session) return;

      const parse = onboardingCompleteSchema.safeParse(request.body);
      if (!parse.success) {
        request.log.warn({ err: parse.error.flatten() }, "onboarding.complete.invalid_payload");
        return sendAuthError(reply, 400, "INVALID_PAYLOAD", "Invalid onboarding payload.");
      }

      const payload = parse.data;
      const userId = session.user.id;

      try {
        await prismaClient.$transaction([
          prismaClient.profile.upsert({
            where: { userId },
            update: {
              firstName: payload.firstName,
              locale: payload.locale,
              birthDate: payload.birthDate,
              gender: payload.gender,
              city: payload.city,
              originCountry: payload.originCountry,
              languages: payload.languages,
              intent: payload.intent,
              interests: payload.interests,
              photosCount: payload.photosCount,
              verifiedOptIn: payload.verifyNow,
              onboardingVersion: payload.version,
            },
            create: {
              userId,
              firstName: payload.firstName,
              locale: payload.locale,
              birthDate: payload.birthDate,
              gender: payload.gender,
              city: payload.city,
              originCountry: payload.originCountry,
              languages: payload.languages,
              intent: payload.intent,
              interests: payload.interests,
              photosCount: payload.photosCount,
              verifiedOptIn: payload.verifyNow,
              onboardingVersion: payload.version,
            },
          }),
          prismaClient.userSettings.upsert({
            where: { userId },
            update: {
              language: payload.locale,
              targetLang: payload.targetLang,
              autoTranslate: payload.autoTranslate,
              autoDetectLanguage: payload.autoDetectLanguage,
              distanceKm: payload.distanceKm,
              ageMin: payload.ageMin,
              ageMax: payload.ageMax,
              genderPreference: mapLookingFor(payload.lookingFor),
              notificationsEnabled: payload.notifications,
              preciseLocationEnabled: payload.preciseLocation,
            },
            create: {
              userId,
              language: payload.locale,
              targetLang: payload.targetLang,
              autoTranslate: payload.autoTranslate,
              autoDetectLanguage: payload.autoDetectLanguage,
              distanceKm: payload.distanceKm,
              ageMin: payload.ageMin,
              ageMax: payload.ageMax,
              genderPreference: mapLookingFor(payload.lookingFor),
              notificationsEnabled: payload.notifications,
              preciseLocationEnabled: payload.preciseLocation,
            },
          }),
        ]);
      } catch (err) {
        request.log.error({ err, userId }, "onboarding.complete.db_failed");
        return sendAuthError(reply, 500, "ONBOARDING_FAILED", "Unable to save onboarding data.");
      }

      return sendAuthSuccess(reply, {
        ok: true,
        data: { completed: true },
      } satisfies AuthResponse<{ completed: boolean }>);
    });
  });
}
