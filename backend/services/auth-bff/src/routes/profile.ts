import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { supabaseServiceClient } from "../lib/supabaseClient";
import { sendAuthError, sendAuthSuccess } from "./auth/utils";
import type { AuthResponse } from "./auth/types";
import { requireSessionMiddleware } from "../middleware/requireSession";
import { env } from "../config/env";

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
  bio: z.string().max(1000).optional(),
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

const deletePhotoParamsSchema = z.object({
  photoId: z.string().uuid(),
});

const uploadPhotoBodySchema = z.object({
  mimeType: z.string().min(1),
  base64Data: z.string().min(1),
});

const uploadKycSelfieBodySchema = z.object({
  mimeType: z.string().min(1),
  base64Data: z.string().min(1),
  captureMode: z.literal("front_camera"),
});

type ProfilePhotoRow = {
  id: string;
  user_id: string;
  storage_path: string;
  sort_order: number;
  is_primary: boolean;
  created_at: string;
};

const PROFILE_PHOTOS_BUCKET = env.STORAGE_PROFILE_PHOTOS_BUCKET;
const PHOTO_MAX_COUNT = 5;

const mapStorageUploadError = (
  error: { message?: string; statusCode?: string | number } | null,
  context: "profile_photo" | "kyc_selfie"
) => {
  const message = (error?.message ?? "").toLowerCase();
  const statusCode = Number(error?.statusCode ?? 0);
  const bucketNotFound =
    statusCode === 404 ||
    message.includes("bucket not found") ||
    message.includes("not found");

  if (bucketNotFound) {
    return {
      code: context === "profile_photo" ? "PROFILE_PHOTO_BUCKET_MISSING" : "KYC_SELFIE_BUCKET_MISSING",
      message: `Storage bucket "${PROFILE_PHOTOS_BUCKET}" is missing. Create it in Supabase Storage.`,
    };
  }

  return {
    code: context === "profile_photo" ? "PROFILE_PHOTO_UPLOAD_FAILED" : "KYC_SELFIE_UPLOAD_FAILED",
    message: context === "profile_photo" ? "Unable to upload profile photo." : "Unable to upload selfie.",
  };
};

const extensionFromMimeType = (mimeType: string) => {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/heic") return "heic";
  if (mimeType === "image/heif") return "heif";
  return "bin";
};

const buildPhotoPublicPayload = async (row: ProfilePhotoRow) => {
  const { data, error } = await supabaseServiceClient.storage
    .from(PROFILE_PHOTOS_BUCKET)
    .createSignedUrl(row.storage_path, env.STORAGE_SIGNED_URL_TTL_SEC);

  if (error) {
    return {
      id: row.id,
      path: row.storage_path,
      url: null,
      sort_order: row.sort_order,
      is_primary: row.is_primary,
      created_at: row.created_at,
    };
  }

  return {
    id: row.id,
    path: row.storage_path,
    url: data.signedUrl,
    sort_order: row.sort_order,
    is_primary: row.is_primary,
    created_at: row.created_at,
  };
};

const syncPhotosCount = async (userId: string) => {
  const countResult = await supabaseServiceClient
    .from("profile_photos")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if (countResult.error) return;

  await supabaseServiceClient.from("profiles").upsert(
    {
      user_id: userId,
      photos_count: countResult.count ?? 0,
    },
    { onConflict: "user_id" }
  );
};

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

  (["first_name", "last_name", "locale", "bio", "birth_date", "gender", "city", "origin_country", "intent", "onboarding_version"] as const).forEach((key) => {
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

    protectedRoutes.get("/profiles/photos", async (request, reply) => {
      const session = request.userSession;
      if (!session) return;

      const photosResult = await supabaseServiceClient
        .from("profile_photos")
        .select("id,user_id,storage_path,sort_order,is_primary,created_at")
        .eq("user_id", session.user.id)
        .order("sort_order", { ascending: true });

      if (photosResult.error) {
        request.log.error({ err: photosResult.error, userId: session.user.id }, "profile.photos.fetch_failed");
        return sendAuthError(reply, 500, "PROFILE_PHOTOS_FETCH_FAILED", "Unable to fetch profile photos.");
      }

      const payload = await Promise.all(
        (photosResult.data ?? []).map((row) => buildPhotoPublicPayload(row as ProfilePhotoRow))
      );

      return sendAuthSuccess(reply, {
        ok: true,
        data: {
          photos: payload,
        },
      } satisfies AuthResponse);
    });

    protectedRoutes.post("/profiles/photos", async (request, reply) => {
      const session = request.userSession;
      if (!session) return;

      const existingResult = await supabaseServiceClient
        .from("profile_photos")
        .select("id", { count: "exact", head: true })
        .eq("user_id", session.user.id);

      if (existingResult.error) {
        request.log.error({ err: existingResult.error, userId: session.user.id }, "profile.photos.count_failed");
        return sendAuthError(reply, 500, "PROFILE_PHOTOS_COUNT_FAILED", "Unable to validate photo count.");
      }

      const currentCount = existingResult.count ?? 0;
      if (currentCount >= PHOTO_MAX_COUNT) {
        return sendAuthError(reply, 400, "PROFILE_PHOTOS_LIMIT_REACHED", "Maximum number of photos reached.");
      }

      const parsedBody = uploadPhotoBodySchema.safeParse(request.body);
      if (!parsedBody.success) {
        return sendAuthError(reply, 400, "PHOTO_INVALID_PAYLOAD", "Invalid photo payload.");
      }

      const { mimeType, base64Data } = parsedBody.data;

      if (!mimeType.startsWith("image/")) {
        return sendAuthError(reply, 400, "PHOTO_INVALID_TYPE", "Only image uploads are allowed.");
      }

      const buffer = Buffer.from(base64Data, "base64");
      if (!buffer || buffer.length === 0) {
        return sendAuthError(reply, 400, "PHOTO_INVALID_PAYLOAD", "Photo data is empty.");
      }
      if (buffer.length > 10 * 1024 * 1024) {
        return sendAuthError(reply, 400, "PHOTO_FILE_TOO_LARGE", "Photo exceeds max allowed size.");
      }

      const ext = extensionFromMimeType(mimeType);
      const storagePath = `${session.user.id}/${Date.now()}-${randomUUID()}.${ext}`;

      const uploadResult = await supabaseServiceClient.storage
        .from(PROFILE_PHOTOS_BUCKET)
        .upload(storagePath, buffer, {
          contentType: mimeType,
          upsert: false,
        });

      if (uploadResult.error) {
        request.log.error({ err: uploadResult.error, userId: session.user.id }, "profile.photos.upload_failed");
        const mapped = mapStorageUploadError(uploadResult.error as { message?: string; statusCode?: string | number }, "profile_photo");
        return sendAuthError(reply, 500, mapped.code, mapped.message);
      }

      const maxSortResult = await supabaseServiceClient
        .from("profile_photos")
        .select("sort_order")
        .eq("user_id", session.user.id)
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextSortOrder = (maxSortResult.data?.sort_order ?? 0) + 1;

      const insertResult = await supabaseServiceClient
        .from("profile_photos")
        .insert({
          user_id: session.user.id,
          storage_path: storagePath,
          sort_order: nextSortOrder,
          is_primary: nextSortOrder === 1,
        })
        .select("id,user_id,storage_path,sort_order,is_primary,created_at")
        .single();

      if (insertResult.error || !insertResult.data) {
        request.log.error({ err: insertResult.error, userId: session.user.id }, "profile.photos.insert_failed");
        await supabaseServiceClient.storage.from(PROFILE_PHOTOS_BUCKET).remove([storagePath]);
        return sendAuthError(reply, 500, "PROFILE_PHOTO_INSERT_FAILED", "Unable to persist profile photo.");
      }

      await syncPhotosCount(session.user.id);
      const photoPayload = await buildPhotoPublicPayload(insertResult.data as ProfilePhotoRow);

      return sendAuthSuccess(reply, {
        ok: true,
        data: {
          photo: photoPayload,
        },
      } satisfies AuthResponse);
    });

    protectedRoutes.post("/profiles/kyc/selfie", async (request, reply) => {
      const session = request.userSession;
      if (!session) return;

      const parsedBody = uploadKycSelfieBodySchema.safeParse(request.body);
      if (!parsedBody.success) {
        return sendAuthError(reply, 400, "KYC_SELFIE_INVALID_PAYLOAD", "Invalid KYC selfie payload.");
      }

      const { mimeType, base64Data, captureMode } = parsedBody.data;
      if (captureMode !== "front_camera") {
        return sendAuthError(reply, 400, "KYC_SELFIE_CAPTURE_MODE_INVALID", "Only front camera capture is allowed.");
      }
      if (!mimeType.startsWith("image/")) {
        return sendAuthError(reply, 400, "KYC_SELFIE_INVALID_TYPE", "Only image uploads are allowed.");
      }

      const buffer = Buffer.from(base64Data, "base64");
      if (!buffer || buffer.length === 0) {
        return sendAuthError(reply, 400, "KYC_SELFIE_INVALID_PAYLOAD", "Selfie data is empty.");
      }
      if (buffer.length > 10 * 1024 * 1024) {
        return sendAuthError(reply, 400, "KYC_SELFIE_FILE_TOO_LARGE", "Selfie exceeds max allowed size.");
      }

      const ext = extensionFromMimeType(mimeType);
      const storagePath = `${session.user.id}/kyc/${Date.now()}-${randomUUID()}.${ext}`;

      const uploadResult = await supabaseServiceClient.storage
        .from(PROFILE_PHOTOS_BUCKET)
        .upload(storagePath, buffer, {
          contentType: mimeType,
          upsert: false,
        });

      if (uploadResult.error) {
        request.log.error({ err: uploadResult.error, userId: session.user.id }, "kyc.selfie.upload_failed");
        const mapped = mapStorageUploadError(uploadResult.error as { message?: string; statusCode?: string | number }, "kyc_selfie");
        return sendAuthError(reply, 500, mapped.code, mapped.message);
      }

      const insertResult = await supabaseServiceClient
        .from("kyc_selfie_submissions")
        .insert({
          user_id: session.user.id,
          storage_path: storagePath,
          status: "pending",
          provider: "internal_v1",
        })
        .select("id,status,created_at")
        .single();

      if (insertResult.error || !insertResult.data) {
        request.log.error({ err: insertResult.error, userId: session.user.id }, "kyc.selfie.insert_failed");
        await supabaseServiceClient.storage.from(PROFILE_PHOTOS_BUCKET).remove([storagePath]);
        return sendAuthError(reply, 500, "KYC_SELFIE_PIPELINE_FAILED", "Unable to register KYC submission.");
      }

      const profileUpdateResult = await supabaseServiceClient
        .from("profiles")
        .upsert(
          {
            user_id: session.user.id,
            verified_opt_in: true,
          },
          { onConflict: "user_id" }
        );

      if (profileUpdateResult.error) {
        request.log.error({ err: profileUpdateResult.error, userId: session.user.id }, "kyc.selfie.profile_flag_failed");
      }

      return sendAuthSuccess(reply, {
        ok: true,
        data: {
          submissionId: insertResult.data.id,
          status: insertResult.data.status,
          submittedAt: insertResult.data.created_at,
          verifiedOptIn: true,
        },
      } satisfies AuthResponse);
    });

    protectedRoutes.delete("/profiles/photos/:photoId", async (request, reply) => {
      const session = request.userSession;
      if (!session) return;

      const parsedParams = deletePhotoParamsSchema.safeParse(request.params);
      if (!parsedParams.success) {
        return sendAuthError(reply, 400, "INVALID_PHOTO_ID", "Invalid photo id.");
      }

      const lookup = await supabaseServiceClient
        .from("profile_photos")
        .select("id,user_id,storage_path,sort_order,is_primary,created_at")
        .eq("id", parsedParams.data.photoId)
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (lookup.error) {
        request.log.error({ err: lookup.error, userId: session.user.id }, "profile.photos.lookup_failed");
        return sendAuthError(reply, 500, "PROFILE_PHOTO_LOOKUP_FAILED", "Unable to remove profile photo.");
      }

      if (!lookup.data) {
        return sendAuthError(reply, 404, "PROFILE_PHOTO_NOT_FOUND", "Photo not found.");
      }

      await supabaseServiceClient.storage.from(PROFILE_PHOTOS_BUCKET).remove([lookup.data.storage_path]);

      const removeResult = await supabaseServiceClient
        .from("profile_photos")
        .delete()
        .eq("id", parsedParams.data.photoId)
        .eq("user_id", session.user.id);

      if (removeResult.error) {
        request.log.error({ err: removeResult.error, userId: session.user.id }, "profile.photos.delete_failed");
        return sendAuthError(reply, 500, "PROFILE_PHOTO_DELETE_FAILED", "Unable to delete profile photo.");
      }

      await syncPhotosCount(session.user.id);
      return sendAuthSuccess(reply, {
        ok: true,
        data: {
          removed: true,
        },
      } satisfies AuthResponse);
    });

    protectedRoutes.get("/profiles/me", async (request, reply) => {
      const session = request.userSession;
      if (!session) return;

      const [profileResult, settingsResult] = await Promise.all([
        supabaseServiceClient
          .from("profiles")
          .select("first_name,last_name,locale,bio,birth_date,gender,city,origin_country,languages,intent,interests,photos_count,verified_opt_in,onboarding_version")
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
          .select("first_name,last_name,locale,bio,birth_date,gender,city,origin_country,languages,intent,interests,photos_count,verified_opt_in,onboarding_version")
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
