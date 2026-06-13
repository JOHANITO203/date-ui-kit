import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { z } from "zod";
import { prismaClient } from "../lib/prismaClient";
import {
  uploadToPrivateBucket,
  uploadToPublicBucket,
  deleteFromPrivateBucket,
  deleteFromPublicBucket,
  downloadFromPrivateBucket,
  createSignedUrls,
  buildPublicUrl,
} from "../lib/s3Storage";
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

// SECURITY: every free-text field is length-capped and arrays are size-capped to
// prevent unbounded row growth / payload amplification (stored across discover &
// chat responses) and to bound any future non-React rendering surface.
const profileUpdateSchema = z.object({
  first_name: z.string().min(1).max(100).optional(),
  last_name: z.string().min(1).max(100).optional(),
  locale: z.string().min(2).max(16).optional(),
  bio: z.string().max(1000).optional(),
  birth_date: z.string().max(40).optional(),
  gender: z.string().max(40).optional(),
  city: z.string().max(120).optional(),
  origin_country: z.string().max(120).optional(),
  languages: z.array(z.string().max(60)).max(20).optional(),
  intent: z.string().max(40).optional(),
  interests: z.array(z.string().max(60)).max(30).optional(),
  photos_count: z.number().int().optional(),
  verified_opt_in: z.boolean().optional(),
  onboarding_version: z.string().max(40).optional(),
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

type PrismaPhoto = {
  id: string;
  userId: string;
  storagePath: string;
  sortOrder: number;
  isPrimary: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const PHOTO_MAX_COUNT = 5;

// SECURITY: hard caps for image processing.
// MAX_IMAGE_PIXELS rejects "pixel flood" / decompression-bomb images that are
// tiny on disk but expand to gigabytes of RAM when decoded by sharp.
const MAX_IMAGE_PIXELS = 40_000_000; // ~40 MP
// Only raster formats sharp can safely re-encode. SVG is deliberately excluded
// (it can carry <script>) — any non-listed/undetected format is rejected.
const ALLOWED_IMAGE_FORMATS = new Set(["jpeg", "png", "webp", "heif", "heic", "avif"]);

type PhotoVariant = "card" | "avatar" | "profile";

const VARIANT_PRESETS: Record<
  PhotoVariant,
  { width: number; height: number; fit: "inside" | "cover"; quality: number }
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

const getVariantPaths = (storagePath: string): string[] => {
  const variants: PhotoVariant[] = ["card", "avatar", "profile"];
  return variants.map((variant) => toVariantPath(storagePath, variant));
};

const withRetry = async <T>(label: string, fn: () => Promise<T>, maxAttempts = 3): Promise<T> => {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 120 * attempt));
      }
    }
  }
  throw new Error(`${label}_failed_after_${maxAttempts}_attempts:${String(lastError)}`);
};

const buildPublicPhotoUrl = (storagePath: string, variant: PhotoVariant, versionMs?: number) => {
  if (!env.hasS3) return null;
  return buildPublicUrl(toVariantPath(storagePath, variant), versionMs);
};

const optimizeVariant = async (buffer: Buffer, variant: PhotoVariant) => {
  const preset = VARIANT_PRESETS[variant];
  // failOnError + limitInputPixels guard against malformed/bomb inputs.
  const image = sharp(buffer, { failOnError: true, limitInputPixels: MAX_IMAGE_PIXELS }).rotate();
  const resized = image.resize({
    width: preset.width,
    height: preset.height,
    fit: preset.fit,
    withoutEnlargement: true,
  });
  const output = await resized.jpeg({ quality: preset.quality, mozjpeg: true }).toBuffer();
  return { buffer: output, contentType: "image/jpeg" };
};

// SECURITY: validate an uploaded image by actually decoding it (magic bytes via
// sharp metadata), enforce the pixel cap, reject anything not in the raster
// allowlist (incl. SVG/HTML/polyglots), and re-encode to a clean JPEG so any
// embedded active content is stripped from the bytes we persist & later serve.
const sanitizeImageToJpeg = async (
  buffer: Buffer,
): Promise<{ buffer: Buffer; contentType: "image/jpeg"; ext: "jpg" } | null> => {
  try {
    const metadata = await sharp(buffer, {
      failOnError: true,
      limitInputPixels: MAX_IMAGE_PIXELS,
    }).metadata();
    if (!metadata.format || !ALLOWED_IMAGE_FORMATS.has(metadata.format)) return null;
    if (
      metadata.width &&
      metadata.height &&
      metadata.width * metadata.height > MAX_IMAGE_PIXELS
    ) {
      return null;
    }
    const output = await sharp(buffer, {
      failOnError: true,
      limitInputPixels: MAX_IMAGE_PIXELS,
    })
      .rotate()
      .jpeg({ quality: 90, mozjpeg: true })
      .toBuffer();
    return { buffer: output, contentType: "image/jpeg", ext: "jpg" };
  } catch {
    return null;
  }
};

const uploadPublicVariantFromBuffer = async (storagePath: string, buffer: Buffer) => {
  if (!buffer || buffer.length === 0) return;
  const variants: PhotoVariant[] = ["card", "avatar", "profile"];
  for (const variant of variants) {
    const optimized = await optimizeVariant(buffer, variant);
    const variantPath = toVariantPath(storagePath, variant);
    await uploadToPublicBucket(variantPath, optimized.buffer, optimized.contentType);
  }
};

const removePublicVariants = async (storagePath: string) => {
  const targets = [...getVariantPaths(storagePath), storagePath];
  await deleteFromPublicBucket(targets).catch(() => {});
};

const copyPublicVariantFromPrivate = async (storagePath: string) => {
  try {
    const buffer = await downloadFromPrivateBucket(storagePath);
    await uploadPublicVariantFromBuffer(storagePath, buffer);
  } catch {
    // non-fatal
  }
};

const createSignedUrlsForPaths = async (paths: string[]): Promise<Map<string, string>> => {
  const uniquePaths = [...new Set(paths.filter((p) => typeof p === "string" && p.length > 0))];
  if (uniquePaths.length === 0 || !env.hasS3) return new Map<string, string>();
  return createSignedUrls(uniquePaths, env.STORAGE_SIGNED_URL_TTL_SEC);
};

const buildPhotoPayload = (row: PrismaPhoto, signedUrl: string | null) => ({
  id: row.id,
  path: row.storagePath,
  url: signedUrl,
  sort_order: row.sortOrder,
  is_primary: row.isPrimary,
  created_at: row.createdAt.toISOString(),
});

const serializeProfile = (p: {
  firstName: string | null;
  lastName: string | null;
  locale: string | null;
  bio: string | null;
  birthDate: string | null;
  gender: string | null;
  city: string | null;
  originCountry: string | null;
  languages: string[];
  intent: string | null;
  interests: string[];
  photosCount: number;
  verifiedOptIn: boolean;
  onboardingVersion: string | null;
} | null) => {
  if (!p) return null;
  return {
    first_name: p.firstName,
    last_name: p.lastName,
    locale: p.locale,
    bio: p.bio,
    birth_date: p.birthDate,
    gender: p.gender,
    city: p.city,
    origin_country: p.originCountry,
    languages: p.languages,
    intent: p.intent,
    interests: p.interests,
    photos_count: p.photosCount,
    verified_opt_in: p.verifiedOptIn,
    onboarding_version: p.onboardingVersion,
  };
};

const serializeSettings = (s: {
  language: string | null;
  targetLang: string | null;
  autoTranslate: boolean;
  autoDetectLanguage: boolean;
  notificationsEnabled: boolean;
  preciseLocationEnabled: boolean;
  visibility: string;
  hideAge: boolean;
  hideDistance: boolean;
  incognito: boolean;
  readReceipts: boolean;
  shadowGhost: boolean;
  travelPassCity: string | null;
  phoneCountryCode: string | null;
  phoneNationalNumber: string | null;
  distanceKm: number;
  ageMin: number;
  ageMax: number;
  genderPreference: string;
} | null) => {
  if (!s) return null;
  return {
    language: s.language,
    target_lang: s.targetLang,
    auto_translate: s.autoTranslate,
    auto_detect_language: s.autoDetectLanguage,
    notifications_enabled: s.notificationsEnabled,
    precise_location_enabled: s.preciseLocationEnabled,
    visibility: s.visibility,
    hide_age: s.hideAge,
    hide_distance: s.hideDistance,
    incognito: s.incognito,
    read_receipts: s.readReceipts,
    shadow_ghost: s.shadowGhost,
    travel_pass_city: s.travelPassCity,
    phone_country_code: s.phoneCountryCode,
    phone_national_number: s.phoneNationalNumber,
    distance_km: s.distanceKm,
    age_min: s.ageMin,
    age_max: s.ageMax,
    gender_preference: s.genderPreference,
  };
};

const syncPhotosCount = async (userId: string) => {
  const count = await prismaClient.profilePhoto.count({ where: { userId } }).catch(() => null);
  if (count === null) return;
  await prismaClient.profile
    .upsert({
      where: { userId },
      update: { photosCount: count },
      create: { userId, photosCount: count },
    })
    .catch(() => {});
};

type EntitlementSnapshot = {
  planTier?: "free" | "essential" | "gold" | "platinum" | "elite";
  planExpiresAtIso?: string;
  travelPass?: { source?: "travel_pass" | "bundle_included"; expiresAtIso?: string };
  shadowGhost?: { source?: "shadowghost_item"; expiresAtIso?: string };
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
  if (
    snapshot.travelPass.source !== "travel_pass" &&
    snapshot.travelPass.source !== "bundle_included"
  ) {
    return false;
  }
  return isIsoActive(snapshot.travelPass.expiresAtIso);
};

const getUserEntitlementSnapshot = async (userId: string): Promise<EntitlementSnapshot | null> => {
  const row = await prismaClient.userEntitlement
    .findUnique({ where: { userId }, select: { entitlementSnapshot: true } })
    .catch(() => null);

  const raw = row?.entitlementSnapshot ?? null;
  if (!raw || typeof raw !== "object") return null;
  return raw as EntitlementSnapshot;
};

const sanitizeProfilePayload = (input: unknown): Record<string, unknown> => {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const source = input as Record<string, unknown>;
  const result: Record<string, unknown> = {};

  const normalizeString = (value: unknown) => {
    if (value === null) return null;
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  };

  (
    [
      "first_name",
      "last_name",
      "locale",
      "bio",
      "birth_date",
      "gender",
      "city",
      "origin_country",
      "intent",
      "onboarding_version",
    ] as const
  ).forEach((key) => {
    const normalized = normalizeString(source[key]);
    if (normalized !== undefined) result[key] = normalized;
  });

  if (Array.isArray(source.languages)) result.languages = source.languages;
  if (Array.isArray(source.interests)) result.interests = source.interests;
  if (typeof source.photos_count === "number") result.photos_count = source.photos_count;
  if (typeof source.verified_opt_in === "boolean") result.verified_opt_in = source.verified_opt_in;
  if ("settings" in source && source.settings !== undefined) result.settings = source.settings;
  return result;
};

export async function registerProfileRoutes(app: FastifyInstance) {
  app.register(async (protectedRoutes) => {
    protectedRoutes.addHook("preHandler", requireSessionMiddleware);

    // ─── GET /profiles/photos ────────────────────────────────────────────────
    protectedRoutes.get("/profiles/photos", async (request, reply) => {
      const session = request.userSession;
      if (!session) return;

      const rows = await prismaClient.profilePhoto
        .findMany({
          where: { userId: session.user.id },
          orderBy: { sortOrder: "asc" },
        })
        .catch((err: unknown) => {
          request.log.error({ err, userId: session.user.id }, "profile.photos.fetch_failed");
          return null;
        });

      if (rows === null) {
        return sendAuthError(reply, 500, "PROFILE_PHOTOS_FETCH_FAILED", "Unable to fetch profile photos.");
      }

      const signedByPath = await createSignedUrlsForPaths(rows.map((r) => r.storagePath));
      const payload = rows.map((row) =>
        buildPhotoPayload(row as PrismaPhoto, signedByPath.get(row.storagePath) ?? null),
      );

      return sendAuthSuccess(reply, {
        ok: true,
        data: { photos: payload },
      } satisfies AuthResponse);
    });

    // ─── POST /profiles/photos ───────────────────────────────────────────────
    protectedRoutes.post("/profiles/photos", async (request, reply) => {
      const session = request.userSession;
      if (!session) return;

      const currentCount = await prismaClient.profilePhoto
        .count({ where: { userId: session.user.id } })
        .catch((err: unknown) => {
          request.log.error({ err, userId: session.user.id }, "profile.photos.count_failed");
          return null;
        });

      if (currentCount === null) {
        return sendAuthError(reply, 500, "PROFILE_PHOTOS_COUNT_FAILED", "Unable to validate photo count.");
      }
      if (currentCount >= PHOTO_MAX_COUNT) {
        return sendAuthError(reply, 400, "PROFILE_PHOTOS_LIMIT_REACHED", "Maximum number of photos reached.");
      }

      const parsedBody = uploadPhotoBodySchema.safeParse(request.body);
      if (!parsedBody.success) {
        return sendAuthError(reply, 400, "PHOTO_INVALID_PAYLOAD", "Invalid photo payload.");
      }

      const { base64Data } = parsedBody.data;
      // Guard before decoding: base64 expands ~1.37x, so cap the encoded length.
      if (base64Data.length > 15 * 1024 * 1024) {
        return sendAuthError(reply, 400, "PHOTO_FILE_TOO_LARGE", "Photo exceeds max allowed size.");
      }

      const rawBuffer = Buffer.from(base64Data, "base64");
      if (!rawBuffer || rawBuffer.length === 0) {
        return sendAuthError(reply, 400, "PHOTO_INVALID_PAYLOAD", "Photo data is empty.");
      }
      if (rawBuffer.length > 10 * 1024 * 1024) {
        return sendAuthError(reply, 400, "PHOTO_FILE_TOO_LARGE", "Photo exceeds max allowed size.");
      }

      if (!env.hasS3) {
        return sendAuthError(reply, 503, "STORAGE_NOT_CONFIGURED", "Photo storage is not configured.");
      }

      // SECURITY: validate + re-encode. Rejects non-images (incl. SVG/polyglots)
      // and bombs; `buffer` below is a clean JPEG, never the attacker's bytes.
      const sanitized = await sanitizeImageToJpeg(rawBuffer);
      if (!sanitized) {
        return sendAuthError(reply, 400, "PHOTO_INVALID_TYPE", "Only valid image uploads are allowed.");
      }
      const buffer = sanitized.buffer;

      const storagePath = `${session.user.id}/${Date.now()}-${randomUUID()}.${sanitized.ext}`;

      try {
        await uploadToPrivateBucket(storagePath, buffer, sanitized.contentType);
      } catch (err) {
        request.log.error({ err, userId: session.user.id }, "profile.photos.upload_failed");
        return sendAuthError(reply, 500, "PROFILE_PHOTO_UPLOAD_FAILED", "Unable to upload profile photo.");
      }

      const maxSortRow = await prismaClient.profilePhoto.findFirst({
        where: { userId: session.user.id },
        orderBy: { sortOrder: "desc" },
        select: { sortOrder: true },
      });
      const nextSortOrder = (maxSortRow?.sortOrder ?? 0) + 1;

      let insertedRow: PrismaPhoto;
      try {
        insertedRow = (await prismaClient.profilePhoto.create({
          data: {
            userId: session.user.id,
            storagePath,
            sortOrder: nextSortOrder,
            isPrimary: nextSortOrder === 1,
          },
        })) as PrismaPhoto;
      } catch (err) {
        request.log.error({ err, userId: session.user.id }, "profile.photos.insert_failed");
        await deleteFromPrivateBucket([storagePath]).catch(() => {});
        return sendAuthError(reply, 500, "PROFILE_PHOTO_INSERT_FAILED", "Unable to persist profile photo.");
      }

      try {
        await withRetry(
          `profile.photos.public_variant.${storagePath}`,
          () => uploadPublicVariantFromBuffer(storagePath, buffer),
          3,
        );
      } catch (error) {
        request.log.error(
          { err: error, userId: session.user.id, storagePath },
          "profile.photos.public_variant_failed_rollback",
        );
        await prismaClient.profilePhoto.delete({ where: { id: insertedRow.id } }).catch(() => {});
        await deleteFromPrivateBucket([storagePath]).catch(() => {});
        await removePublicVariants(storagePath);
        await syncPhotosCount(session.user.id);
        return sendAuthError(
          reply,
          503,
          "PROFILE_PHOTO_VARIANT_GENERATION_FAILED",
          "Unable to process photo variants. Please retry upload.",
        );
      }

      await syncPhotosCount(session.user.id);
      const signedByPath = await createSignedUrlsForPaths([storagePath]);
      const photoPayload = buildPhotoPayload(insertedRow, signedByPath.get(storagePath) ?? null);

      return sendAuthSuccess(reply, {
        ok: true,
        data: { photo: photoPayload },
      } satisfies AuthResponse);
    });

    // ─── POST /profiles/kyc/selfie ───────────────────────────────────────────
    protectedRoutes.post("/profiles/kyc/selfie", async (request, reply) => {
      const session = request.userSession;
      if (!session) return;

      const parsedBody = uploadKycSelfieBodySchema.safeParse(request.body);
      if (!parsedBody.success) {
        return sendAuthError(reply, 400, "KYC_SELFIE_INVALID_PAYLOAD", "Invalid KYC selfie payload.");
      }

      const { base64Data, captureMode } = parsedBody.data;
      if (captureMode !== "front_camera") {
        return sendAuthError(reply, 400, "KYC_SELFIE_CAPTURE_MODE_INVALID", "Only front camera capture is allowed.");
      }

      if (base64Data.length > 15 * 1024 * 1024) {
        return sendAuthError(reply, 400, "KYC_SELFIE_FILE_TOO_LARGE", "Selfie exceeds max allowed size.");
      }

      const rawBuffer = Buffer.from(base64Data, "base64");
      if (!rawBuffer || rawBuffer.length === 0) {
        return sendAuthError(reply, 400, "KYC_SELFIE_INVALID_PAYLOAD", "Selfie data is empty.");
      }
      if (rawBuffer.length > 10 * 1024 * 1024) {
        return sendAuthError(reply, 400, "KYC_SELFIE_FILE_TOO_LARGE", "Selfie exceeds max allowed size.");
      }

      if (!env.hasS3) {
        return sendAuthError(reply, 503, "STORAGE_NOT_CONFIGURED", "Photo storage is not configured.");
      }

      // SECURITY: validate + re-encode the selfie to a clean JPEG (same rationale
      // as profile photos). KYC images are the most sensitive asset stored.
      const sanitized = await sanitizeImageToJpeg(rawBuffer);
      if (!sanitized) {
        return sendAuthError(reply, 400, "KYC_SELFIE_INVALID_TYPE", "Only valid image uploads are allowed.");
      }
      const buffer = sanitized.buffer;

      const storagePath = `${session.user.id}/kyc/${Date.now()}-${randomUUID()}.${sanitized.ext}`;

      try {
        await uploadToPrivateBucket(storagePath, buffer, sanitized.contentType);
      } catch (err) {
        request.log.error({ err, userId: session.user.id }, "kyc.selfie.upload_failed");
        return sendAuthError(reply, 500, "KYC_SELFIE_UPLOAD_FAILED", "Unable to upload selfie.");
      }

      let submission: { id: string; status: string; createdAt: Date };
      try {
        submission = await prismaClient.kycSelfieSubmission.create({
          data: {
            userId: session.user.id,
            storagePath,
            status: "pending",
            provider: "internal_v1",
          },
          select: { id: true, status: true, createdAt: true },
        });
      } catch (err) {
        request.log.error({ err, userId: session.user.id }, "kyc.selfie.insert_failed");
        await deleteFromPrivateBucket([storagePath]).catch(() => {});
        return sendAuthError(reply, 500, "KYC_SELFIE_PIPELINE_FAILED", "Unable to register KYC submission.");
      }

      await prismaClient.profile
        .upsert({
          where: { userId: session.user.id },
          update: { verifiedOptIn: true },
          create: { userId: session.user.id, verifiedOptIn: true },
        })
        .catch((err: unknown) => {
          request.log.error({ err, userId: session.user.id }, "kyc.selfie.profile_flag_failed");
        });

      return sendAuthSuccess(reply, {
        ok: true,
        data: {
          submissionId: submission.id,
          status: submission.status,
          submittedAt: submission.createdAt.toISOString(),
          verifiedOptIn: true,
        },
      } satisfies AuthResponse);
    });

    // ─── DELETE /profiles/photos/:photoId ────────────────────────────────────
    protectedRoutes.delete("/profiles/photos/:photoId", async (request, reply) => {
      const session = request.userSession;
      if (!session) return;

      const parsedParams = deletePhotoParamsSchema.safeParse(request.params);
      if (!parsedParams.success) {
        return sendAuthError(reply, 400, "INVALID_PHOTO_ID", "Invalid photo id.");
      }

      const existing = await prismaClient.profilePhoto
        .findFirst({
          where: { id: parsedParams.data.photoId, userId: session.user.id },
        })
        .catch((err: unknown) => {
          request.log.error({ err, userId: session.user.id }, "profile.photos.lookup_failed");
          return null;
        });

      if (existing === null) {
        return sendAuthError(reply, 500, "PROFILE_PHOTO_LOOKUP_FAILED", "Unable to remove profile photo.");
      }
      if (!existing) {
        return sendAuthError(reply, 404, "PROFILE_PHOTO_NOT_FOUND", "Photo not found.");
      }

      if (env.hasS3) {
        await deleteFromPrivateBucket([existing.storagePath]).catch(() => {});
        await removePublicVariants(existing.storagePath);
      }

      await prismaClient.profilePhoto
        .delete({ where: { id: parsedParams.data.photoId } })
        .catch((err: unknown) => {
          request.log.error({ err, userId: session.user.id }, "profile.photos.delete_failed");
        });

      await syncPhotosCount(session.user.id);

      return sendAuthSuccess(reply, {
        ok: true,
        data: { removed: true },
      } satisfies AuthResponse);
    });

    // ─── GET /profiles/me ────────────────────────────────────────────────────
    protectedRoutes.get("/profiles/me", async (request, reply) => {
      const session = request.userSession;
      if (!session) return;

      const [profile, settings] = await Promise.all([
        prismaClient.profile
          .findUnique({
            where: { userId: session.user.id },
            select: {
              firstName: true,
              lastName: true,
              locale: true,
              bio: true,
              birthDate: true,
              gender: true,
              city: true,
              originCountry: true,
              languages: true,
              intent: true,
              interests: true,
              photosCount: true,
              verifiedOptIn: true,
              onboardingVersion: true,
            },
          })
          .catch(() => null),
        prismaClient.userSettings
          .findUnique({
            where: { userId: session.user.id },
            select: {
              language: true,
              targetLang: true,
              autoTranslate: true,
              autoDetectLanguage: true,
              notificationsEnabled: true,
              preciseLocationEnabled: true,
              visibility: true,
              hideAge: true,
              hideDistance: true,
              incognito: true,
              readReceipts: true,
              shadowGhost: true,
              travelPassCity: true,
              phoneCountryCode: true,
              phoneNationalNumber: true,
              distanceKm: true,
              ageMin: true,
              ageMax: true,
              genderPreference: true,
            },
          })
          .catch(() => null),
      ]);

      let serializedSettings = serializeSettings(settings);
      if (serializedSettings && serializedSettings.shadow_ghost === true) {
        const entitlementSnapshot = await getUserEntitlementSnapshot(session.user.id);
        if (!canUseShadowGhost(entitlementSnapshot)) {
          serializedSettings = { ...serializedSettings, shadow_ghost: false };
        }
      }

      return sendAuthSuccess(reply, {
        ok: true,
        data: {
          profile: serializeProfile(profile),
          settings: serializedSettings,
        },
      } satisfies AuthResponse);
    });

    // ─── PATCH /profiles/me ──────────────────────────────────────────────────
    protectedRoutes.patch("/profiles/me", async (request, reply) => {
      const session = request.userSession;
      if (!session) return;

      const sanitizedBody = sanitizeProfilePayload(request.body);
      const parse = profileUpdateSchema.safeParse(sanitizedBody);
      if (!parse.success) {
        request.log.warn({ err: parse.error.flatten() }, "profile.update.invalid_payload");
        return sendAuthError(reply, 400, "INVALID_PAYLOAD", "Invalid profile payload.");
      }

      const { settings, ...profilePayloadRaw } = parse.data;

      // Map snake_case from frontend payload to Prisma camelCase
      const profileData: Record<string, unknown> = {};
      if (profilePayloadRaw.first_name !== undefined) profileData.firstName = profilePayloadRaw.first_name;
      if (profilePayloadRaw.last_name !== undefined) profileData.lastName = profilePayloadRaw.last_name;
      if (profilePayloadRaw.locale !== undefined) profileData.locale = profilePayloadRaw.locale;
      if (profilePayloadRaw.bio !== undefined) profileData.bio = profilePayloadRaw.bio;
      if (profilePayloadRaw.birth_date !== undefined) profileData.birthDate = profilePayloadRaw.birth_date;
      if (profilePayloadRaw.gender !== undefined) profileData.gender = profilePayloadRaw.gender;
      if (profilePayloadRaw.city !== undefined) profileData.city = profilePayloadRaw.city;
      if (profilePayloadRaw.origin_country !== undefined) profileData.originCountry = profilePayloadRaw.origin_country;
      if (profilePayloadRaw.languages !== undefined) profileData.languages = profilePayloadRaw.languages;
      if (profilePayloadRaw.intent !== undefined) profileData.intent = profilePayloadRaw.intent;
      if (profilePayloadRaw.interests !== undefined) profileData.interests = profilePayloadRaw.interests;
      if (profilePayloadRaw.photos_count !== undefined) profileData.photosCount = profilePayloadRaw.photos_count;
      if (profilePayloadRaw.verified_opt_in !== undefined) profileData.verifiedOptIn = profilePayloadRaw.verified_opt_in;
      if (profilePayloadRaw.onboarding_version !== undefined) profileData.onboardingVersion = profilePayloadRaw.onboarding_version;

      if (Object.keys(profileData).length > 0) {
        const err = await prismaClient.profile
          .upsert({
            where: { userId: session.user.id },
            update: profileData,
            create: { userId: session.user.id, ...profileData },
          })
          .then(() => null)
          .catch((e: unknown) => e);

        if (err) {
          request.log.error({ err, userId: session.user.id }, "profile.upsert_failed");
          return sendAuthError(reply, 500, "PROFILE_UPDATE_FAILED", "Unable to update profile.");
        }
      }

      if (settings && Object.keys(settings).length > 0) {
        const entitlementSnapshot = await getUserEntitlementSnapshot(session.user.id);
        if (settings.shadowGhost === true && !canUseShadowGhost(entitlementSnapshot)) {
          return sendAuthError(reply, 403, "SHADOWGHOST_LOCKED", "ShadowGhost requires an active entitlement.");
        }
        if (settings.travelPassCity && !canChangeServer(entitlementSnapshot)) {
          return sendAuthError(reply, 403, "TRAVEL_PASS_LOCKED", "Travel Pass is required to change server city.");
        }

        const settingsData: Record<string, unknown> = {};
        if (settings.language !== undefined) settingsData.language = settings.language;
        if (settings.targetLang !== undefined) settingsData.targetLang = settings.targetLang;
        if (settings.autoTranslate !== undefined) settingsData.autoTranslate = settings.autoTranslate;
        if (settings.autoDetectLanguage !== undefined) settingsData.autoDetectLanguage = settings.autoDetectLanguage;
        if (settings.notificationsEnabled !== undefined) settingsData.notificationsEnabled = settings.notificationsEnabled;
        if (settings.preciseLocationEnabled !== undefined) settingsData.preciseLocationEnabled = settings.preciseLocationEnabled;
        if (settings.visibility !== undefined) settingsData.visibility = settings.visibility;
        if (settings.hideAge !== undefined) settingsData.hideAge = settings.hideAge;
        if (settings.hideDistance !== undefined) settingsData.hideDistance = settings.hideDistance;
        if (settings.incognito !== undefined) settingsData.incognito = settings.incognito;
        if (settings.readReceipts !== undefined) settingsData.readReceipts = settings.readReceipts;
        if (settings.shadowGhost !== undefined) settingsData.shadowGhost = settings.shadowGhost;
        if (settings.travelPassCity !== undefined) settingsData.travelPassCity = settings.travelPassCity;
        if (settings.phoneCountryCode !== undefined) settingsData.phoneCountryCode = settings.phoneCountryCode;
        if (settings.phoneNationalNumber !== undefined) settingsData.phoneNationalNumber = settings.phoneNationalNumber;
        if (settings.distanceKm !== undefined) settingsData.distanceKm = settings.distanceKm;
        if (settings.ageMin !== undefined) settingsData.ageMin = settings.ageMin;
        if (settings.ageMax !== undefined) settingsData.ageMax = settings.ageMax;
        if (settings.genderPreference !== undefined) settingsData.genderPreference = settings.genderPreference;

        const settingsErr = await prismaClient.userSettings
          .upsert({
            where: { userId: session.user.id },
            update: settingsData,
            create: { userId: session.user.id, ...settingsData },
          })
          .then(() => null)
          .catch((e: unknown) => e);

        if (settingsErr) {
          request.log.error({ err: settingsErr, userId: session.user.id }, "settings.upsert_failed");
          return sendAuthError(reply, 500, "SETTINGS_UPDATE_FAILED", "Unable to update settings.");
        }
      }

      const [profile, settings2] = await Promise.all([
        prismaClient.profile
          .findUnique({
            where: { userId: session.user.id },
            select: {
              firstName: true, lastName: true, locale: true, bio: true,
              birthDate: true, gender: true, city: true, originCountry: true,
              languages: true, intent: true, interests: true, photosCount: true,
              verifiedOptIn: true, onboardingVersion: true,
            },
          })
          .catch(() => null),
        prismaClient.userSettings
          .findUnique({
            where: { userId: session.user.id },
            select: {
              language: true, targetLang: true, autoTranslate: true, autoDetectLanguage: true,
              notificationsEnabled: true, preciseLocationEnabled: true, visibility: true,
              hideAge: true, hideDistance: true, incognito: true, readReceipts: true,
              shadowGhost: true, travelPassCity: true, phoneCountryCode: true,
              phoneNationalNumber: true, distanceKm: true, ageMin: true, ageMax: true,
              genderPreference: true,
            },
          })
          .catch(() => null),
      ]);

      return sendAuthSuccess(reply, {
        ok: true,
        data: {
          profile: serializeProfile(profile),
          settings: serializeSettings(settings2),
        },
      } satisfies AuthResponse);
    });
  });
}
