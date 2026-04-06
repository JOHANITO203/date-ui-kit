import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { supabaseServiceClient } from "../lib/supabaseClient";
import { sendAuthError, sendAuthSuccess } from "./auth/utils";
import type { AuthResponse } from "./auth/types";
import { requireSessionMiddleware } from "../middleware/requireSession";

const settingsSchema = z
  .object({
    language: z.enum(["en", "ru"]).optional(),
    targetLang: z.enum(["en", "ru", "fr"]).optional(),
    autoTranslate: z.boolean().optional(),
    autoDetectLanguage: z.boolean().optional(),
    notificationsEnabled: z.boolean().optional(),
    preciseLocationEnabled: z.boolean().optional(),
    distanceKm: z.number().int().min(1).max(500).optional(),
    ageMin: z.number().int().min(18).max(100).optional(),
    ageMax: z.number().int().min(18).max(100).optional(),
    genderPreference: z.enum(["everyone", "women", "men"]).optional(),
  })
  .partial();

const profileUpdateSchema = z.object({
  first_name: z.string().min(1).max(100).optional(),
  last_name: z.string().min(1).max(100).optional(),
  locale: z.string().min(2).max(16).optional(),
  birth_date: z.string().optional(),
  gender: z.string().optional(),
  city: z.string().optional(),
  origin_country: z.string().optional(),
  languages: z.array(z.string()).optional(),
  intent: z.string().optional(),
  interests: z.array(z.string()).optional(),
  photos_count: z.number().int().optional(),
  verified_opt_in: z.boolean().optional(),
  onboarding_version: z.string().optional(),
  settings: settingsSchema.optional(),
});

const sanitizeProfilePayload = (input: unknown): Record<string, unknown> => {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }

  const source = input as Record<string, unknown>;
  const result: Record<string, unknown> = {};

  const normalizeString = (value: unknown) => {
    if (value === null) return null;
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  };

  (["first_name", "last_name", "locale", "birth_date", "gender", "city", "origin_country", "intent", "onboarding_version"] as const).forEach((key) => {
    const normalized = normalizeString(source[key]);
    if (normalized !== undefined) {
      result[key] = normalized;
    }
  });

  if (Array.isArray(source.languages)) {
    result.languages = source.languages;
  }
  if (Array.isArray(source.interests)) {
    result.interests = source.interests;
  }
  if (typeof source.photos_count === "number") {
    result.photos_count = source.photos_count;
  }
  if (typeof source.verified_opt_in === "boolean") {
    result.verified_opt_in = source.verified_opt_in;
  }

  if ("settings" in source && source.settings !== undefined) {
    result.settings = source.settings;
  }

  return result;
};

export async function registerProfileRoutes(app: FastifyInstance) {
  app.register(async (protectedRoutes) => {
    protectedRoutes.addHook("preHandler", requireSessionMiddleware);

    protectedRoutes.get("/profiles/me", async (request, reply) => {
      const session = request.userSession;
      if (!session) return;

      const [profileResult, settingsResult] = await Promise.all([
        supabaseServiceClient
          .from("profiles")
          .select("first_name,last_name,locale,birth_date,gender,city,origin_country,languages,intent,interests,photos_count,verified_opt_in,onboarding_version")
          .eq("user_id", session.user.id)
          .maybeSingle(),
        supabaseServiceClient
          .from("settings")
          .select("language,target_lang,auto_translate,auto_detect_language,notifications_enabled,precise_location_enabled,distance_km,age_min,age_max,gender_preference")
          .eq("user_id", session.user.id)
          .maybeSingle(),
      ]);

      if (profileResult.error) {
        request.log.error({ err: profileResult.error, userId: session.user.id }, "profile.fetch_failed");
      }
      if (settingsResult.error) {
        request.log.error({ err: settingsResult.error, userId: session.user.id }, "settings.fetch_failed");
      }

      return sendAuthSuccess(reply, {
        ok: true,
        data: {
          profile: profileResult.error ? null : (profileResult.data ?? null),
          settings: settingsResult.error ? null : (settingsResult.data ?? null),
        },
      } satisfies AuthResponse);
    });

    protectedRoutes.patch("/profiles/me", async (request, reply) => {
      const session = request.userSession;
      if (!session) return;

      const sanitizedBody = sanitizeProfilePayload(request.body);
      const parse = profileUpdateSchema.safeParse(sanitizedBody);
      if (!parse.success) {
        request.log.warn({ err: parse.error.flatten() }, "profile.update.invalid_payload");
        return sendAuthError(reply, 400, "INVALID_PAYLOAD", "Invalid profile payload.");
      }

      const { settings, ...profilePayload } = parse.data;

      if (Object.keys(profilePayload).length > 0) {
        const { error } = await supabaseServiceClient.from("profiles").upsert({
          user_id: session.user.id,
          ...profilePayload,
        });

        if (error) {
          request.log.error({ err: error, userId: session.user.id }, "profile.upsert_failed");
          return sendAuthError(reply, 500, "PROFILE_UPDATE_FAILED", "Unable to update profile.");
        }
      }

      if (settings && Object.keys(settings).length > 0) {
        const payload = {
          user_id: session.user.id,
          language: settings.language,
          target_lang: settings.targetLang,
          auto_translate: settings.autoTranslate,
          auto_detect_language: settings.autoDetectLanguage,
          notifications_enabled: settings.notificationsEnabled,
          precise_location_enabled: settings.preciseLocationEnabled,
          distance_km: settings.distanceKm,
          age_min: settings.ageMin,
          age_max: settings.ageMax,
          gender_preference: settings.genderPreference,
        };

        const { error } = await supabaseServiceClient.from("settings").upsert(payload, { onConflict: "user_id" });
        if (error) {
          request.log.error({ err: error, userId: session.user.id }, "settings.upsert_failed");
          return sendAuthError(reply, 500, "SETTINGS_UPDATE_FAILED", "Unable to update settings.");
        }
      }

      const [profileResult, settingsResult] = await Promise.all([
        supabaseServiceClient
          .from("profiles")
          .select("first_name,last_name,locale,birth_date,gender,city,origin_country,languages,intent,interests,photos_count,verified_opt_in,onboarding_version")
          .eq("user_id", session.user.id)
          .maybeSingle(),
        supabaseServiceClient
          .from("settings")
          .select("language,target_lang,auto_translate,auto_detect_language,notifications_enabled,precise_location_enabled,distance_km,age_min,age_max,gender_preference")
          .eq("user_id", session.user.id)
          .maybeSingle(),
      ]);

      return sendAuthSuccess(reply, {
        ok: true,
        data: {
          profile: profileResult.error ? null : (profileResult.data ?? null),
          settings: settingsResult.error ? null : (settingsResult.data ?? null),
        },
      } satisfies AuthResponse);
    });
  });
}
