import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
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
    visibility: z.enum(["public", "limited", "hidden"]).optional(),
    hideAge: z.boolean().optional(),
    hideDistance: z.boolean().optional(),
    incognito: z.boolean().optional(),
    readReceipts: z.boolean().optional(),
    shadowGhost: z.boolean().optional(),
    travelPassCity: z.enum(["voronezh", "moscow", "saint-petersburg", "sochi"]).optional(),
    phoneCountryCode: z.string().trim().regex(/^\+[0-9]{1,5}$/).optional(),
    phoneNationalNumber: z.string().trim().regex(/^[0-9]{4,15}$/).optional(),
    distanceKm: z.number().int().min(1).max(500).optional(),
    ageMin: z.number().int().min(18).max(100).optional(),
    ageMax: z.number().int().min(18).max(100).optional(),
    genderPreference: z.enum(["everyone", "women", "men"]).optional(),
  })
  .partial()
  .superRefine((value, ctx) => {
    if (
      typeof value.ageMin === "number" &&
      typeof value.ageMax === "number" &&
      value.ageMin > value.ageMax
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ageMin"],
        message: "ageMin must be lower than or equal to ageMax",
      });
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ageMax"],
        message: "ageMax must be greater than or equal to ageMin",
      });
    }
  });

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
  updated_at: string;
};

const PROFILE_PHOTOS_BUCKET = env.STORAGE_PROFILE_PHOTOS_BUCKET;
const PROFILE_PHOTOS_PUBLIC_BUCKET = env.STORAGE_PROFILE_PHOTOS_PUBLIC_BUCKET;
const PHOTO_MAX_COUNT = 5;

const encodeStoragePath = (value: string) =>
  value
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

type PhotoVariant = "card" | "avatar" | "profile";

const VARIANT_PRESETS: Record<
  PhotoVariant,
  {
    width: number;
    height: number;
    fit: "inside" | "cover";
    quality: number;
  }
> = {
  card: { width: 720, height: 960, fit: "inside", quality: 76 },
  avatar: { width: 256, height: 256, fit: "cover", quality: 72 },
  profile: { width: 1080, height: 1440, fit: "inside", quality: 78 },
};

const toVariantPath = (storagePath: string, variant: PhotoVariant) => {
  const clean = storagePath.replace(/^\/+/, "");
  const withoutExt = clean.replace(/\.[^/.]+$/, "");
  return `variants/${variant}/${withoutExt}.jpg`;
};

const buildPublicPhotoUrl = (
  storagePath: string,
  variant: PhotoVariant,
  updatedAtIso?: string | null,
) => {
  if (!env.SUPABASE_URL) return null;
  const version = updatedAtIso ? new Date(updatedAtIso).getTime() : undefined;
  const variantPath = toVariantPath(storagePath, variant);
  const base = `${env.SUPABASE_URL}/storage/v1/object/public/${PROFILE_PHOTOS_PUBLIC_BUCKET}/${encodeStoragePath(variantPath)}`;
  if (!version) return base;
  return `${base}?v=${version}`;
};

const optimizeVariant = async (buffer: Buffer, variant: PhotoVariant) => {
  const preset = VARIANT_PRESETS[variant];
  const image = sharp(buffer, { failOnError: false }).rotate();
  const resized = image.resize({
    width: preset.width,
    height: preset.height,
    fit: preset.fit,
    withoutEnlargement: true,
  });

  const output = await resized
    .jpeg({
      quality: preset.quality,
      mozjpeg: true,
    })
    .toBuffer();

  return {
    buffer: output,
    contentType: "image/jpeg",
  };
};

const uploadPublicVariantFromBuffer = async (storagePath: string, buffer: Buffer) => {
  if (!buffer || buffer.length === 0) return;
  const variants: PhotoVariant[] = ["card", "avatar", "profile"];
  for (const variant of variants) {
    const optimized = await optimizeVariant(buffer, variant);
    const variantPath = toVariantPath(storagePath, variant);
    await supabaseServiceClient.storage.from(PROFILE_PHOTOS_PUBLIC_BUCKET).upload(variantPath, optimized.buffer, {
      contentType: optimized.contentType,
      cacheControl: "public, max-age=31536000, immutable",
      upsert: true,
    });
  }
};

const copyPublicVariantFromPrivate = async (storagePath: string) => {
  const download = await supabaseServiceClient.storage.from(PROFILE_PHOTOS_BUCKET).download(storagePath);
  if (download.error || !download.data) return;
  const arrayBuffer = await download.data.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  await uploadPublicVariantFromBuffer(storagePath, buffer);
};

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

const createSignedUrlsForPaths = async (paths: string[]) => {
  const uniquePaths = [...new Set(paths.filter((entry) => typeof entry === "string" && entry.length > 0))];
  if (uniquePaths.length === 0) return new Map<string, string>();
  const result = await supabaseServiceClient.storage
    .from(PROFILE_PHOTOS_BUCKET)
    .createSignedUrls(uniquePaths, env.STORAGE_SIGNED_URL_TTL_SEC, {
      transform: { width: 1080, quality: 78 },
    } as any);
  const byPath = new Map<string, string>();
  if (result.error || !Array.isArray(result.data)) return byPath;
  for (const entry of result.data) {
    if (entry?.path && entry?.signedUrl) {
      byPath.set(entry.path, entry.signedUrl);
    }
  }
  return byPath;
};

const buildPhotoPayload = (row: ProfilePhotoRow, signedUrl: string | null) => {
  return {
    id: row.id,
    path: row.storage_path,
    url: signedUrl,
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

type EntitlementSnapshot = {
  planTier?: "free" | "essential" | "gold" | "platinum" | "elite";
  planExpiresAtIso?: string;
  travelPass?: {
    source?: "travel_pass" | "bundle_included";
    expiresAtIso?: string;
  };
  shadowGhost?: {
    source?: "shadowghost_item";
    expiresAtIso?: string;
  };
};

const isIsoActive = (value?: string): boolean => {
  if (!value) return true;
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return false;
  return timestamp > Date.now();
};

const canUsePlanIncludedBenefits = (snapshot: EntitlementSnapshot | null) => {
  if (!snapshot?.planTier) return false;
  if (snapshot.planTier !== "platinum" && snapshot.planTier !== "elite") return false;
  return isIsoActive(snapshot.planExpiresAtIso);
};

const canUseShadowGhost = (snapshot: EntitlementSnapshot | null) => {
  if (canUsePlanIncludedBenefits(snapshot)) return true;
  if (snapshot?.shadowGhost?.source !== "shadowghost_item") return false;
  return isIsoActive(snapshot.shadowGhost.expiresAtIso);
};

const canChangeServer = (snapshot: EntitlementSnapshot | null) => {
  if (canUsePlanIncludedBenefits(snapshot)) return true;
  if (!snapshot?.travelPass) return false;
  if (snapshot.travelPass.source !== "travel_pass" && snapshot.travelPass.source !== "bundle_included") {
    return false;
  }
  return isIsoActive(snapshot.travelPass.expiresAtIso);
};

const getUserEntitlementSnapshot = async (userId: string): Promise<EntitlementSnapshot | null> => {
  const { data, error } = await supabaseServiceClient
    .from("user_entitlements")
    .select("entitlement_snapshot")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return null;
  }

  const raw = (data?.entitlement_snapshot ?? null) as unknown;
  if (!raw || typeof raw !== "object") return null;
  return raw as EntitlementSnapshot;
};

export async function registerProfileRoutes(app: FastifyInstance) {
  app.register(async (protectedRoutes) => {
    protectedRoutes.addHook("preHandler", requireSessionMiddleware);

    protectedRoutes.get("/profiles/photos", async (request, reply) => {
      const session = request.userSession;
      if (!session) return;

      const photosResult = await supabaseServiceClient
        .from("profile_photos")
        .select("id,user_id,storage_path,sort_order,is_primary,created_at,updated_at")
        .eq("user_id", session.user.id)
        .order("sort_order", { ascending: true });

      if (photosResult.error) {
        request.log.error({ err: photosResult.error, userId: session.user.id }, "profile.photos.fetch_failed");
        return sendAuthError(reply, 500, "PROFILE_PHOTOS_FETCH_FAILED", "Unable to fetch profile photos.");
      }

      const rows = (photosResult.data ?? []) as ProfilePhotoRow[];
      const signedByPath = await createSignedUrlsForPaths(rows.map((row) => row.storage_path));
      const payload = rows.map((row) =>
        buildPhotoPayload(row, signedByPath.get(row.storage_path) ?? null),
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
        .select("id,user_id,storage_path,sort_order,is_primary,created_at,updated_at")
        .single();

      if (insertResult.error || !insertResult.data) {
        request.log.error({ err: insertResult.error, userId: session.user.id }, "profile.photos.insert_failed");
        await supabaseServiceClient.storage.from(PROFILE_PHOTOS_BUCKET).remove([storagePath]);
        return sendAuthError(reply, 500, "PROFILE_PHOTO_INSERT_FAILED", "Unable to persist profile photo.");
      }

      await uploadPublicVariantFromBuffer(storagePath, buffer).catch((error) => {
        request.log.warn({ err: error, storagePath }, "profile.photos.public_variant_failed");
      });

      await syncPhotosCount(session.user.id);
      const signedByPath = await createSignedUrlsForPaths([storagePath]);
      const photoPayload = buildPhotoPayload(
        insertResult.data as ProfilePhotoRow,
        signedByPath.get(storagePath) ?? null,
      );

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
        .select("id,user_id,storage_path,sort_order,is_primary,created_at,updated_at")
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
      await supabaseServiceClient.storage.from(PROFILE_PHOTOS_PUBLIC_BUCKET).remove([lookup.data.storage_path]);

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
          .select("language,target_lang,auto_translate,auto_detect_language,notifications_enabled,precise_location_enabled,visibility,hide_age,hide_distance,incognito,read_receipts,shadow_ghost,travel_pass_city,phone_country_code,phone_national_number,distance_km,age_min,age_max,gender_preference")
          .eq("user_id", session.user.id)
          .maybeSingle(),
      ]);

      if (profileResult.error) {
        request.log.error({ err: profileResult.error, userId: session.user.id }, "profile.fetch_failed");
      }
      if (settingsResult.error) {
        request.log.error({ err: settingsResult.error, userId: session.user.id }, "settings.fetch_failed");
      }

      let effectiveSettings =
        settingsResult.error || !settingsResult.data ? null : { ...(settingsResult.data as Record<string, unknown>) };
      if (effectiveSettings && effectiveSettings.shadow_ghost === true) {
        const entitlementSnapshot = await getUserEntitlementSnapshot(session.user.id);
        if (!canUseShadowGhost(entitlementSnapshot)) {
          effectiveSettings.shadow_ghost = false;
        }
      }

      return sendAuthSuccess(reply, {
        ok: true,
        data: {
          profile: profileResult.error ? null : (profileResult.data ?? null),
          settings: effectiveSettings,
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
        const entitlementSnapshot = await getUserEntitlementSnapshot(session.user.id);
        if (settings.shadowGhost === true && !canUseShadowGhost(entitlementSnapshot)) {
          return sendAuthError(
            reply,
            403,
            "SHADOWGHOST_LOCKED",
            "ShadowGhost requires an active entitlement."
          );
        }
        if (settings.travelPassCity && !canChangeServer(entitlementSnapshot)) {
          return sendAuthError(
            reply,
            403,
            "TRAVEL_PASS_LOCKED",
            "Travel Pass is required to change server city."
          );
        }

        const payload = {
          user_id: session.user.id,
          language: settings.language,
          target_lang: settings.targetLang,
          auto_translate: settings.autoTranslate,
          auto_detect_language: settings.autoDetectLanguage,
          notifications_enabled: settings.notificationsEnabled,
          precise_location_enabled: settings.preciseLocationEnabled,
          visibility: settings.visibility,
          hide_age: settings.hideAge,
          hide_distance: settings.hideDistance,
          incognito: settings.incognito,
          read_receipts: settings.readReceipts,
          shadow_ghost: settings.shadowGhost,
          travel_pass_city: settings.travelPassCity,
          phone_country_code: settings.phoneCountryCode,
          phone_national_number: settings.phoneNationalNumber,
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
          .select("language,target_lang,auto_translate,auto_detect_language,notifications_enabled,precise_location_enabled,visibility,hide_age,hide_distance,incognito,read_receipts,shadow_ghost,travel_pass_city,phone_country_code,phone_national_number,distance_km,age_min,age_max,gender_preference")
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
