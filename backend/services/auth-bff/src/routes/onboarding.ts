import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { supabaseServiceClient } from "../lib/supabaseClient";
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

      const profileUpsert = await supabaseServiceClient.from("profiles").upsert(
        {
          user_id: session.user.id,
          first_name: payload.firstName,
          locale: payload.locale,
          birth_date: payload.birthDate,
          gender: payload.gender,
          city: payload.city,
          origin_country: payload.originCountry,
          languages: payload.languages,
          intent: payload.intent,
          interests: payload.interests,
          photos_count: payload.photosCount,
          verified_opt_in: payload.verifyNow,
          onboarding_version: payload.version,
        },
        { onConflict: "user_id" }
      );

      if (profileUpsert.error) {
        request.log.error({ err: profileUpsert.error, userId: session.user.id }, "onboarding.complete.profile_failed");
        return sendAuthError(reply, 500, "ONBOARDING_PROFILE_FAILED", "Unable to save onboarding profile.");
      }

      const settingsUpsert = await supabaseServiceClient.from("settings").upsert(
        {
          user_id: session.user.id,
          language: payload.locale,
          distance_km: payload.distanceKm,
          age_min: payload.ageMin,
          age_max: payload.ageMax,
          gender_preference: mapLookingFor(payload.lookingFor),
          target_lang: payload.targetLang,
          auto_translate: payload.autoTranslate,
          auto_detect_language: payload.autoDetectLanguage,
          notifications_enabled: payload.notifications,
          precise_location_enabled: payload.preciseLocation,
        },
        { onConflict: "user_id" }
      );

      if (settingsUpsert.error) {
        request.log.error({ err: settingsUpsert.error, userId: session.user.id }, "onboarding.complete.settings_failed");
        return sendAuthError(reply, 500, "ONBOARDING_SETTINGS_FAILED", "Unable to save onboarding settings.");
      }

      return sendAuthSuccess(reply, {
        ok: true,
        data: {
          completed: true,
        },
      } satisfies AuthResponse<{ completed: boolean }>);
    });
  });
}
