import { env } from "./config";
import { prismaClient } from "./lib/prismaClient";
import type { FeedCandidate } from "./data";
import type { CandidatePhotoStatus } from "./data";
import type { FastifyBaseLogger } from "fastify";
import type { PlanTier, ShortPassTier } from "./data";
import type { ImageAccessPolicy } from "./imageAccessPolicy";
import { resolveImageAccessPolicy } from "./imageAccessPolicy";

type ProfileRow = {
  userId: string;
  firstName: string | null;
  birthDate: string | null;
  gender: string | null;
  city: string | null;
  originCountry: string | null;
  languages: string[];
  bio: string | null;
  interests: string[];
  verifiedOptIn: boolean;
};

type ProfilePhotoRow = {
  userId: string;
  storagePath: string;
  sortOrder: number;
  isPrimary: boolean;
  updatedAt: Date;
};

type SettingsRow = {
  userId: string;
  hideAge: boolean;
  hideDistance: boolean;
  shadowGhost: boolean;
  lastSeenAt: Date | null;
};

type UserLocationRow = {
  userId: string;
  lat: number;
  lng: number;
};

type EntitlementSnapshot = {
  planTier?: PlanTier;
  planExpiresAtIso?: string;
  shadowGhost?: {
    source: "shadowghost_item";
    expiresAtIso: string;
    enablePrivacy: boolean;
  };
};

type UserEntitlementRow = {
  userId: string;
  entitlementSnapshot: EntitlementSnapshot | null;
};

type UserBoostRow = {
  userId: string;
  activeUntil: Date | null;
};

const SIGNED_URL_CACHE_VERSION = "v2-card";
const signedPhotoUrlCache = new Map<string, { url: string; expiresAtMs: number }>();
const signedPhotoCacheKey = (storagePath: string) => `${SIGNED_URL_CACHE_VERSION}:${storagePath}`;

const getCachedSignedPhotoUrl = (storagePath: string): string | null => {
  const key = signedPhotoCacheKey(storagePath);
  const cached = signedPhotoUrlCache.get(key);
  if (!cached) return null;
  if (Date.now() >= cached.expiresAtMs) {
    signedPhotoUrlCache.delete(key);
    return null;
  }
  return cached.url;
};

const setCachedSignedPhotoUrl = (storagePath: string, signedUrl: string) => {
  const key = signedPhotoCacheKey(storagePath);
  const safeTtlSec = Math.max(60, env.STORAGE_SIGNED_URL_TTL_SEC - 30);
  signedPhotoUrlCache.set(key, {
    url: signedUrl,
    expiresAtMs: Date.now() + safeTtlSec * 1000,
  });
};

const settingsCache = new Map<string, { value: SettingsRow; expiresAtMs: number }>();
const getCachedSettings = (userId: string): SettingsRow | null => {
  const entry = settingsCache.get(userId);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAtMs) {
    settingsCache.delete(userId);
    return null;
  }
  return entry.value;
};
const setCachedSettings = (row: SettingsRow) => {
  settingsCache.set(row.userId, {
    value: row,
    expiresAtMs: Date.now() + env.DISCOVER_SETTINGS_CACHE_TTL_MS,
  });
};

const chunkArray = <T>(items: T[], size: number) => {
  if (items.length <= size) return [items];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

type PhotoAccessResolver = (profileId: string) => ImageAccessPolicy;

type CandidatePhotoResolution = {
  urls: string[];
  status: CandidatePhotoStatus;
  url: string;
  reason: string;
  storagePath: string | null;
};

const buildPublicPhotoUrl = (storagePath: string, variant: string, versionMs?: number): string => {
  if (!env.S3_PUBLIC_URL) return "/placeholder.svg";
  const clean = storagePath.replace(/^\/+/, "").replace(/\.[^/.]+$/, "");
  const variantPath = `variants/${variant}/${clean}.jpg`;
  return versionMs ? `${env.S3_PUBLIC_URL}/${variantPath}?v=${versionMs}` : `${env.S3_PUBLIC_URL}/${variantPath}`;
};

const buildSignedPhotoUrls = async (paths: string[]): Promise<Map<string, string>> => {
  const out = new Map<string, string>();
  if (paths.length === 0 || !env.S3_BUCKET_PRIVATE) return out;
  try {
    const { S3Client, GetObjectCommand } = await import("@aws-sdk/client-s3");
    const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
    const s3 = new S3Client({
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT || undefined,
      credentials: { accessKeyId: env.S3_ACCESS_KEY_ID!, secretAccessKey: env.S3_SECRET_ACCESS_KEY! },
      forcePathStyle: Boolean(env.S3_ENDPOINT),
    });
    await Promise.all(paths.map(async (key) => {
      const url = await getSignedUrl(s3, new GetObjectCommand({ Bucket: env.S3_BUCKET_PRIVATE, Key: key }), { expiresIn: 3600 });
      out.set(key, url);
    }));
  } catch {}
  return out;
};

const createSignedUrlsForPaths = async (paths: string[]): Promise<Map<string, string>> => {
  const result = new Map<string, string>();
  if (paths.length === 0) return result;

  const uniquePaths = [...new Set(paths.filter((entry) => typeof entry === "string" && entry.length > 0))];
  const missingPaths: string[] = [];

  for (const storagePath of uniquePaths) {
    const cached = getCachedSignedPhotoUrl(storagePath);
    if (cached) {
      result.set(storagePath, cached);
    } else {
      missingPaths.push(storagePath);
    }
  }

  if (missingPaths.length > 0) {
    const chunks = chunkArray(missingPaths, 100);
    for (const chunk of chunks) {
      const signedBatch = await buildSignedPhotoUrls(chunk);
      for (const [path, url] of signedBatch.entries()) {
        result.set(path, url);
        setCachedSignedPhotoUrl(path, url);
      }
    }
  }

  return result;
};

const PUBLIC_VARIANT_HEALTH_TTL_MS = 10 * 60 * 1000;
const MAX_PUBLIC_VARIANT_PROBES_PER_REQUEST = 256;
const publicVariantHealthCache = new Map<string, { healthy: boolean; checkedAtMs: number }>();

const probePublicVariantHealth = async (
  publicByPath: Map<string, string>,
  logger: FastifyBaseLogger,
) => {
  const now = Date.now();
  const broken = new Set<string>();
  const unknownEntries: Array<[string, string]> = [];

  for (const [storagePath, url] of publicByPath.entries()) {
    const cached = publicVariantHealthCache.get(storagePath);
    if (cached && now - cached.checkedAtMs < PUBLIC_VARIANT_HEALTH_TTL_MS) {
      if (!cached.healthy) broken.add(storagePath);
      continue;
    }
    unknownEntries.push([storagePath, url]);
  }

  const toProbe = unknownEntries.slice(0, MAX_PUBLIC_VARIANT_PROBES_PER_REQUEST);
  if (toProbe.length === 0) return broken;

  const checks = await Promise.all(
    toProbe.map(async ([storagePath, url]) => {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), Math.min(2000, 1400));
        try {
          const response = await fetch(url, { method: "HEAD", signal: controller.signal });
          return { storagePath, status: response.status, ok: response.ok, networkError: false };
        } finally {
          clearTimeout(timer);
        }
      } catch {
        return { storagePath, status: 0, ok: false, networkError: true };
      }
    }),
  );

  for (const check of checks) {
    if (check.ok) {
      publicVariantHealthCache.set(check.storagePath, { healthy: true, checkedAtMs: now });
      continue;
    }
    if (check.networkError || check.status === 0 || check.status >= 500 || check.status === 429) {
      logger.debug({ storagePath: check.storagePath, status: check.status }, "discover.public_variant_probe_inconclusive_keep_public");
      continue;
    }
    publicVariantHealthCache.set(check.storagePath, { healthy: false, checkedAtMs: now });
    if (!check.ok) {
      broken.add(check.storagePath);
      logger.warn({ storagePath: check.storagePath, status: check.status }, "discover.public_variant_unavailable_fallback_to_signed");
    }
  }

  return broken;
};

const isPublicBucketEnabled = (): boolean => {
  return Boolean(env.S3_PUBLIC_URL);
};

const cityCoordinates: Record<string, { lat: number; lng: number }> = {
  Moscow: { lat: 55.7558, lng: 37.6173 },
  "Saint Petersburg": { lat: 59.9311, lng: 30.3609 },
  Voronezh: { lat: 51.6608, lng: 39.2003 },
  Sochi: { lat: 43.5855, lng: 39.7231 },
};

const toRadians = (value: number) => (value * Math.PI) / 180;
const haversineKm = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const earthRadiusKm = 6371;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const aa =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
  return earthRadiusKm * c;
};

const normalizeGender = (value: string | null): "men" | "women" => {
  if (!value) return "women";
  const normalized = value.trim().toLowerCase();
  if (normalized === "men" || normalized === "male" || normalized === "man") return "men";
  return "women";
};

const computeAge = (birthDate: string | null): number => {
  if (!birthDate) return 24;
  const dob = new Date(birthDate);
  if (Number.isNaN(dob.getTime())) return 24;
  const now = new Date();
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const monthDelta = now.getUTCMonth() - dob.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getUTCDate() < dob.getUTCDate())) age -= 1;
  return Math.max(18, Math.min(45, age));
};


const isIsoActive = (value?: string | null) => {
  if (!value) return false;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) && ms > Date.now();
};

const resolveEntitlementPlanTier = (
  snapshot: EntitlementSnapshot | null | undefined,
): PlanTier => {
  if (!snapshot?.planTier || !isIsoActive(snapshot.planExpiresAtIso)) return "free";
  return snapshot.planTier;
};

const resolveShortPassTier = (
  snapshot: EntitlementSnapshot | null | undefined,
): ShortPassTier | undefined => {
  if (!snapshot?.planExpiresAtIso || snapshot.planTier !== "essential") return undefined;
  const expiresAtMs = new Date(snapshot.planExpiresAtIso).getTime();
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) return undefined;
  const remainingHours = (expiresAtMs - Date.now()) / (1000 * 60 * 60);
  if (remainingHours <= 36) return "day";
  if (remainingHours <= 8 * 24) return "week";
  return undefined;
};

const canUseShadowGhost = (snapshot: EntitlementSnapshot | null | undefined) => {
  const planTier = resolveEntitlementPlanTier(snapshot);
  if (planTier === "platinum" || planTier === "elite") return true;
  if (
    snapshot?.shadowGhost?.source === "shadowghost_item" &&
    isIsoActive(snapshot.shadowGhost.expiresAtIso)
  ) {
    return true;
  }
  return false;
};

const resolveCandidatePhoto = (input: {
  topPaths: string[];
  accessPolicy: ImageAccessPolicy;
  publicByPath: Map<string, string>;
  signedByPath: Map<string, string>;
  brokenPublicPaths: Set<string>;
}): CandidatePhotoResolution => {
  const primaryPath = input.topPaths[0] ?? null;
  if (!primaryPath) {
    return {
      urls: ["/placeholder.svg"],
      status: "placeholder",
      url: "/placeholder.svg",
      reason: "missing_profile_photo",
      storagePath: null,
    };
  }

  const urls = input.topPaths
    .map((storagePath) => {
      if (input.accessPolicy === "public_stable") {
        if (input.brokenPublicPaths.has(storagePath)) {
          return input.signedByPath.get(storagePath) ?? "/placeholder.svg";
        }
        return input.publicByPath.get(storagePath) ?? input.signedByPath.get(storagePath) ?? "/placeholder.svg";
      }
      return input.signedByPath.get(storagePath) ?? "/placeholder.svg";
    })
    .filter((value): value is string => typeof value === "string" && value.length > 0);

  const primaryUrl = urls[0] ?? "/placeholder.svg";
  if (input.accessPolicy === "public_stable") {
    if (input.brokenPublicPaths.has(primaryPath)) {
      if (input.signedByPath.has(primaryPath)) {
        return { urls, status: "signed_fallback", url: primaryUrl, reason: "public_variant_unavailable_signed_fallback", storagePath: primaryPath };
      }
      return { urls: ["/placeholder.svg"], status: "placeholder", url: "/placeholder.svg", reason: "public_variant_unavailable_no_signed", storagePath: primaryPath };
    }
    if (input.publicByPath.has(primaryPath)) {
      return { urls, status: "public", url: primaryUrl, reason: "public_variant_ok", storagePath: primaryPath };
    }
    if (input.signedByPath.has(primaryPath)) {
      return { urls, status: "signed_fallback", url: primaryUrl, reason: "public_variant_missing_signed_fallback", storagePath: primaryPath };
    }
    return { urls: ["/placeholder.svg"], status: "placeholder", url: "/placeholder.svg", reason: "public_candidate_unresolved", storagePath: primaryPath };
  }

  if (input.signedByPath.has(primaryPath)) {
    return { urls, status: "signed_fallback", url: primaryUrl, reason: "signed_policy_private", storagePath: primaryPath };
  }
  return { urls: ["/placeholder.svg"], status: "placeholder", url: "/placeholder.svg", reason: "signed_policy_missing_source", storagePath: primaryPath };
};

const mapProfileToCandidate = (
  profile: ProfileRow,
  photoResolution: CandidatePhotoResolution,
  userGeoPoint: { lat: number; lng: number } | null,
  settings: SettingsRow | undefined,
  entitlement: UserEntitlementRow | undefined,
  hasActiveBoost: boolean,
  candidateLocation: UserLocationRow | undefined,
): FeedCandidate => {
  const city = profile.city?.trim() || "Moscow";
  const candidateGeo = candidateLocation
    ? { lat: candidateLocation.lat, lng: candidateLocation.lng }
    : cityCoordinates[city];
  const effectiveDistanceKm =
    userGeoPoint && candidateGeo ? Math.max(1, Math.round(haversineKm(userGeoPoint, candidateGeo))) : 7;
  const planTier = resolveEntitlementPlanTier(entitlement?.entitlementSnapshot);
  const shortPassTier = resolveShortPassTier(entitlement?.entitlementSnapshot);
  const shadowGhostEnabledByUser = Boolean(settings?.shadowGhost);
  const boostRankBonus = hasActiveBoost ? env.DISCOVER_ACTIVE_BOOST_SCORE_BONUS : 0;

  const photosCount = photoResolution.urls.filter((u) => u !== "/placeholder.svg").length;
  const hasBio = Boolean(profile.bio?.trim() && profile.bio.trim().length > 10);
  const hasInterests = Boolean(profile.interests && profile.interests.length > 0);
  const hasOriginCountry = Boolean(profile.originCountry?.trim());

  const completenessBonus =
    (hasBio ? 4 : 0) +
    (photosCount >= 3 ? 6 : photosCount >= 2 ? 4 : photosCount >= 1 ? 2 : 0) +
    (hasInterests ? 3 : 0) +
    (hasOriginCountry ? 2 : 0);

  const qualityBonus =
    (Boolean(profile.verifiedOptIn) ? 5 : 0) +
    (planTier === "platinum" || planTier === "elite" ? 3 : planTier === "gold" ? 2 : planTier === "essential" ? 1 : 0) +
    (profile.languages && profile.languages.length >= 2 ? 2 : 0);

  const profileQualityScore = completenessBonus + qualityBonus;
  const qualityLabel = profileQualityScore >= 20 ? "high" : profileQualityScore >= 10 ? "mid" : "basic";
  const onlineWindowMs = env.ONLINE_ACTIVE_WINDOW_SEC * 1000;
  const lastSeenAt = settings?.lastSeenAt ?? null;
  const online = Boolean(lastSeenAt && Date.now() - lastSeenAt.getTime() < onlineWindowMs);

  return {
    id: profile.userId,
    name: profile.firstName?.trim() || "Profile",
    gender: normalizeGender(profile.gender),
    age: computeAge(profile.birthDate),
    city,
    originCountry: profile.originCountry?.trim() || "russian",
    distanceKm: effectiveDistanceKm,
    languages: profile.languages && profile.languages.length > 0 ? profile.languages : ["English", "Russian"],
    bio: profile.bio?.trim() || "Looking for meaningful connections.",
    photos: photoResolution.urls.length > 0 ? photoResolution.urls : ["/placeholder.svg"],
    photoStatus: photoResolution.status,
    photoUrl: photoResolution.url,
    photoReason: photoResolution.reason,
    photoStoragePath: photoResolution.storagePath,
    compatibility: Math.round(55 + completenessBonus * 0.8 + qualityBonus * 1.2),
    interests: profile.interests && profile.interests.length > 0 ? profile.interests : ["Travel", "Music"],
    online,
    flags: {
      verifiedIdentity: Boolean(profile.verifiedOptIn),
      premiumTier: planTier,
      shortPassTier,
      hideAge: Boolean(settings?.hideAge),
      hideDistance: Boolean(settings?.hideDistance),
      shadowGhost: shadowGhostEnabledByUser && canUseShadowGhost(entitlement?.entitlementSnapshot),
      boostActive: hasActiveBoost,
    },
    rankScore: 50 + completenessBonus + qualityBonus + boostRankBonus,
    scoreReason: hasActiveBoost ? `quality_${qualityLabel}_boost_active` : `quality_${qualityLabel}`,
  };
};

const buildPublicUrlsForPhotos = (
  rows: ProfilePhotoRow[],
): Map<string, string> => {
  const result = new Map<string, string>();
  for (const row of rows) {
    if (!row.storagePath) continue;
    const versionMs = row.updatedAt ? new Date(row.updatedAt).getTime() : undefined;
    result.set(row.storagePath, buildPublicPhotoUrl(row.storagePath, "card", versionMs));
  }
  return result;
};

export const loadCandidatesFromDb = async (input: {
  currentUserId: string;
  userGeoPoint: { lat: number; lng: number } | null;
  logger: FastifyBaseLogger;
  resolvePhotoAccess?: PhotoAccessResolver;
}): Promise<FeedCandidate[]> => {
  try {
    const profilesRaw = await prismaClient.profile.findMany({
      where: { userId: { not: input.currentUserId } },
      select: {
        userId: true,
        firstName: true,
        birthDate: true,
        gender: true,
        city: true,
        originCountry: true,
        languages: true,
        bio: true,
        interests: true,
        verifiedOptIn: true,
      },
      take: env.DISCOVER_FEED_PROFILE_LIMIT,
    });

    const profiles: ProfileRow[] = profilesRaw.map((p) => ({
      userId: p.userId,
      firstName: p.firstName,
      birthDate: p.birthDate,
      gender: p.gender,
      city: p.city,
      originCountry: p.originCountry,
      languages: p.languages,
      bio: p.bio,
      interests: p.interests,
      verifiedOptIn: p.verifiedOptIn,
    }));

    if (profiles.length === 0) return [];

    const profileIds = profiles.map((row) => row.userId);

    let photosRows: ProfilePhotoRow[] = [];
    try {
      const photosRaw = await prismaClient.profilePhoto.findMany({
        where: { userId: { in: profileIds } },
        orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
        take: Math.max(160, env.DISCOVER_FEED_PROFILE_LIMIT * 4),
      });
      photosRows = photosRaw.map((p) => ({
        userId: p.userId,
        storagePath: p.storagePath,
        sortOrder: p.sortOrder,
        isPrimary: p.isPrimary,
        updatedAt: p.updatedAt,
      }));
    } catch (error) {
      input.logger.warn({ err: error }, "discover.photos_query_failed_continue_with_placeholders");
    }

    let settingsRows: SettingsRow[] = [];
    try {
      const cachedSettings: SettingsRow[] = [];
      const missingIds: string[] = [];
      for (const profileId of profileIds) {
        const cached = getCachedSettings(profileId);
        if (cached) cachedSettings.push(cached);
        else missingIds.push(profileId);
      }

      if (missingIds.length > 0) {
        const settingsRaw = await prismaClient.userSettings.findMany({
          where: { userId: { in: missingIds } },
          select: { userId: true, shadowGhost: true, hideAge: true, hideDistance: true, lastSeenAt: true },
          take: 500,
        });
        const fresh: SettingsRow[] = settingsRaw.map((s) => ({
          userId: s.userId,
          hideAge: s.hideAge,
          hideDistance: s.hideDistance,
          shadowGhost: s.shadowGhost,
          lastSeenAt: s.lastSeenAt,
        }));
        for (const row of fresh) setCachedSettings(row);
        settingsRows = [...cachedSettings, ...fresh];
      } else {
        settingsRows = cachedSettings;
      }
    } catch (error) {
      input.logger.warn({ err: error }, "discover.settings_query_failed_continue_with_defaults");
    }

    let locationRows: UserLocationRow[] = [];
    try {
      const locRaw = await prismaClient.userLocation.findMany({
        where: { userId: { in: profileIds } },
        select: { userId: true, lat: true, lng: true },
        take: 500,
      });
      locationRows = locRaw.map((l) => ({ userId: l.userId, lat: l.lat, lng: l.lng }));
    } catch (error) {
      input.logger.warn({ err: error }, "discover.locations_query_failed_continue_without_gps");
    }

    let entitlementRows: UserEntitlementRow[] = [];
    try {
      const entRaw = await prismaClient.userEntitlement.findMany({
        where: { userId: { in: profileIds } },
        select: { userId: true, entitlementSnapshot: true },
        take: 500,
      });
      entitlementRows = entRaw.map((e) => ({
        userId: e.userId,
        entitlementSnapshot: (e.entitlementSnapshot as EntitlementSnapshot | null),
      }));
    } catch (error) {
      input.logger.warn({ err: error }, "discover.entitlements_query_failed_continue_with_free_tier");
    }

    let boostedProfileIds = new Set<string>();
    try {
      const nowIso = new Date().toISOString();
      const boostRaw = await prismaClient.discoverBoost.findMany({
        where: { userId: { in: profileIds }, activeUntil: { gt: new Date(nowIso) } },
        select: { userId: true, activeUntil: true },
        take: 500,
      });
      boostedProfileIds = new Set(boostRaw.map((b) => b.userId));
    } catch (error) {
      input.logger.warn({ err: error }, "discover.boosts_query_failed_continue_without_boost_bonus");
    }

    const photosByUser = new Map<string, ProfilePhotoRow[]>();
    for (const row of photosRows) {
      const bucketRows = photosByUser.get(row.userId) ?? [];
      bucketRows.push(row);
      photosByUser.set(row.userId, bucketRows);
    }

    const settingsByUser = new Map(settingsRows.map((row) => [row.userId, row]));
    const entitlementsByUser = new Map(entitlementRows.map((row) => [row.userId, row]));
    const locationsByUser = new Map(locationRows.map((row) => [row.userId, row]));

    const topPhotoPathsByUser = new Map<string, string[]>();
    const photoAccessByUser = new Map<string, ImageAccessPolicy>();
    const publicPaths: string[] = [];
    const signedPaths: string[] = [];
    const resolvePhotoAccess =
      input.resolvePhotoAccess ?? (() => resolveImageAccessPolicy("discover", "visible_standard"));
    for (const profile of profiles) {
      const photoRows = photosByUser.get(profile.userId) ?? [];
      const topPaths = photoRows
        .slice(0, 3)
        .map((row) => row.storagePath)
        .filter((value): value is string => typeof value === "string" && value.length > 0);
      topPhotoPathsByUser.set(profile.userId, topPaths);
      const accessPolicy = resolvePhotoAccess(profile.userId);
      photoAccessByUser.set(profile.userId, accessPolicy);
      if (accessPolicy === "public_stable") {
        publicPaths.push(...topPaths);
      } else {
        signedPaths.push(...topPaths);
      }
    }

    const publicBucketEnabled = isPublicBucketEnabled();
    if (!publicBucketEnabled) {
      input.logger.warn("discover.public_bucket_disabled_fallback_to_signed");
    }
    const publicByPath = new Map<string, string>();
    if (publicBucketEnabled) {
      const rowByPath = new Map<string, ProfilePhotoRow>();
      for (const row of photosRows) {
        if (row.storagePath) rowByPath.set(row.storagePath, row);
      }
      for (const storagePath of publicPaths) {
        if (!storagePath) continue;
        const row = rowByPath.get(storagePath);
        const versionMs = row?.updatedAt ? new Date(row.updatedAt).getTime() : undefined;
        publicByPath.set(storagePath, buildPublicPhotoUrl(storagePath, "card", versionMs));
      }
    }
    const brokenPublicPaths = publicBucketEnabled
      ? await probePublicVariantHealth(publicByPath, input.logger)
      : new Set<string>();
    const signedCandidates = [
      ...signedPaths,
      ...(!publicBucketEnabled ? publicPaths : []),
      ...(publicBucketEnabled ? [...brokenPublicPaths] : []),
    ];
    const signedByPath =
      signedCandidates.length > 0 ? await createSignedUrlsForPaths(signedCandidates) : new Map<string, string>();

    const resolvedCount = publicByPath.size + signedByPath.size;
    const totalPaths = publicPaths.length + signedPaths.length;
    if (totalPaths > 0 && resolvedCount === 0) {
      input.logger.error({ total: totalPaths, publicAvailable: publicByPath.size, signedAvailable: signedByPath.size, publicBucketEnabled }, "discover.photos_url_map_empty");
    } else if (totalPaths > 0 && resolvedCount < totalPaths) {
      input.logger.warn({ total: totalPaths, resolved: resolvedCount, missing: totalPaths - resolvedCount, publicAvailable: publicByPath.size, signedAvailable: signedByPath.size, publicBucketEnabled }, "discover.photos_url_map_partial");
    }

    const candidates: FeedCandidate[] = [];
    for (const profile of profiles) {
      const accessPolicy = photoAccessByUser.get(profile.userId) ?? "public_stable";
      const photoResolution = resolveCandidatePhoto({
        topPaths: topPhotoPathsByUser.get(profile.userId) ?? [],
        accessPolicy,
        publicByPath,
        signedByPath,
        brokenPublicPaths,
      });
      candidates.push(
        mapProfileToCandidate(
          profile,
          photoResolution,
          input.userGeoPoint,
          settingsByUser.get(profile.userId),
          entitlementsByUser.get(profile.userId),
          boostedProfileIds.has(profile.userId),
          locationsByUser.get(profile.userId),
        ),
      );
    }

    const eligibleCandidates = env.DISCOVER_REQUIRE_PHOTO
      ? candidates.filter((item) => item.photoStatus !== "placeholder")
      : candidates;

    if (candidates.length > 0) {
      const statusCounts = candidates.reduce<Record<string, number>>((acc, item) => {
        acc[item.photoStatus] = (acc[item.photoStatus] ?? 0) + 1;
        return acc;
      }, {});
      const reasonCounts = candidates.reduce<Record<string, number>>((acc, item) => {
        acc[item.photoReason] = (acc[item.photoReason] ?? 0) + 1;
        return acc;
      }, {});
      input.logger.info(
        { candidates: candidates.length, eligibleCandidates: eligibleCandidates.length, droppedNoPhoto: candidates.length - eligibleCandidates.length, requirePhoto: env.DISCOVER_REQUIRE_PHOTO, photoStatus: statusCounts, photoReason: reasonCounts },
        "discover.photo_resolution_summary",
      );
    }

    return eligibleCandidates;
  } catch (error) {
    input.logger.error({ err: error }, "discover.load_candidates_prisma_failed_no_static_fallback");
    return [];
  }
};

export const loadCandidatesByProfileIds = async (input: {
  profileIds: string[];
  userGeoPoint?: { lat: number; lng: number } | null;
  logger: FastifyBaseLogger;
  resolvePhotoAccess?: PhotoAccessResolver;
  includeBoostStatus?: boolean;
  photoProbeMode?: "sync" | "off";
  source?: string;
}): Promise<FeedCandidate[]> => {
  const profileIds = [...new Set(input.profileIds.filter((entry) => typeof entry === "string" && entry.length > 0))];
  if (profileIds.length === 0) return [];

  try {
    const functionStartMs = performance.now();
    const timings: Record<string, number> = {};
    const mark = (key: string, startMs: number) => {
      timings[key] = Number((performance.now() - startMs).toFixed(2));
    };

    const profilesQueryStartMs = performance.now();
    const profilesRaw = await prismaClient.profile.findMany({
      where: { userId: { in: profileIds } },
      select: {
        userId: true,
        firstName: true,
        birthDate: true,
        gender: true,
        city: true,
        originCountry: true,
        languages: true,
        bio: true,
        interests: true,
        verifiedOptIn: true,
      },
      take: Math.max(32, profileIds.length * 2),
    });
    mark("profiles_query_ms", profilesQueryStartMs);

    const profiles: ProfileRow[] = profilesRaw.map((p) => ({
      userId: p.userId,
      firstName: p.firstName,
      birthDate: p.birthDate,
      gender: p.gender,
      city: p.city,
      originCountry: p.originCountry,
      languages: p.languages,
      bio: p.bio,
      interests: p.interests,
      verifiedOptIn: p.verifiedOptIn,
    }));

    if (profiles.length === 0) return [];

    const includeBoostStatus = input.includeBoostStatus ?? true;
    const settingsCacheStartMs = performance.now();
    const cachedSettings: SettingsRow[] = [];
    const missingSettingsIds: string[] = [];
    for (const profileId of profileIds) {
      const cached = getCachedSettings(profileId);
      if (cached) cachedSettings.push(cached);
      else missingSettingsIds.push(profileId);
    }
    mark("settings_cache_lookup_ms", settingsCacheStartMs);

    const photosPromise = (async (): Promise<ProfilePhotoRow[]> => {
      const startMs = performance.now();
      try {
        const photosRaw = await prismaClient.profilePhoto.findMany({
          where: { userId: { in: profileIds } },
          orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
          take: Math.max(96, profileIds.length * 4),
        });
        return photosRaw.map((p) => ({
          userId: p.userId,
          storagePath: p.storagePath,
          sortOrder: p.sortOrder,
          isPrimary: p.isPrimary,
          updatedAt: p.updatedAt,
        }));
      } catch (error) {
        input.logger.warn({ err: error }, "discover.photos_by_ids_query_failed_continue_with_placeholders");
        return [];
      } finally {
        mark("photos_query_ms", startMs);
      }
    })();

    const settingsPromise = (async (): Promise<SettingsRow[]> => {
      const startMs = performance.now();
      try {
        if (missingSettingsIds.length === 0) return cachedSettings;
        const settingsRaw = await prismaClient.userSettings.findMany({
          where: { userId: { in: missingSettingsIds } },
          select: { userId: true, hideAge: true, hideDistance: true, shadowGhost: true, lastSeenAt: true },
          take: Math.max(64, missingSettingsIds.length * 2),
        });
        const fresh: SettingsRow[] = settingsRaw.map((s) => ({
          userId: s.userId,
          hideAge: s.hideAge,
          hideDistance: s.hideDistance,
          shadowGhost: s.shadowGhost,
          lastSeenAt: s.lastSeenAt,
        }));
        for (const row of fresh) setCachedSettings(row);
        return [...cachedSettings, ...fresh];
      } catch (error) {
        input.logger.warn({ err: error }, "discover.settings_by_ids_query_failed_continue_with_defaults");
        return cachedSettings;
      } finally {
        mark("settings_query_ms", startMs);
      }
    })();

    const locationsPromise = (async (): Promise<UserLocationRow[]> => {
      const startMs = performance.now();
      try {
        const locRaw = await prismaClient.userLocation.findMany({
          where: { userId: { in: profileIds } },
          select: { userId: true, lat: true, lng: true },
          take: Math.max(64, profileIds.length * 2),
        });
        return locRaw.map((l) => ({ userId: l.userId, lat: l.lat, lng: l.lng }));
      } catch (error) {
        input.logger.warn({ err: error }, "discover.locations_by_ids_query_failed_continue_without_gps");
        return [];
      } finally {
        mark("locations_query_ms", startMs);
      }
    })();

    const entitlementsPromise = (async (): Promise<UserEntitlementRow[]> => {
      const startMs = performance.now();
      try {
        const entRaw = await prismaClient.userEntitlement.findMany({
          where: { userId: { in: profileIds } },
          select: { userId: true, entitlementSnapshot: true },
          take: Math.max(64, profileIds.length * 2),
        });
        return entRaw.map((e) => ({
          userId: e.userId,
          entitlementSnapshot: (e.entitlementSnapshot as EntitlementSnapshot | null),
        }));
      } catch (error) {
        input.logger.warn({ err: error }, "discover.entitlements_by_ids_query_failed_continue_with_free_tier");
        return [];
      } finally {
        mark("entitlements_query_ms", startMs);
      }
    })();

    const boostsPromise = (async (): Promise<Set<string>> => {
      const startMs = performance.now();
      try {
        if (!includeBoostStatus) return new Set<string>();
        const boostRaw = await prismaClient.discoverBoost.findMany({
          where: { userId: { in: profileIds }, activeUntil: { gt: new Date() } },
          select: { userId: true, activeUntil: true },
          take: Math.max(64, profileIds.length * 2),
        });
        return new Set(boostRaw.map((b) => b.userId));
      } catch (error) {
        input.logger.warn({ err: error }, "discover.boosts_by_ids_query_failed_continue_without_boost_bonus");
        return new Set<string>();
      } finally {
        mark("boosts_query_ms", startMs);
      }
    })();

    const parallelQueriesStartMs = performance.now();
    const [photosRows, settingsRows, entitlementRows, boostedProfileIds, locationRows] = await Promise.all([
      photosPromise,
      settingsPromise,
      entitlementsPromise,
      boostsPromise,
      locationsPromise,
    ]);
    mark("parallel_secondary_queries_wall_ms", parallelQueriesStartMs);

    const photosByUser = new Map<string, ProfilePhotoRow[]>();
    for (const row of photosRows) {
      const bucketRows = photosByUser.get(row.userId) ?? [];
      bucketRows.push(row);
      photosByUser.set(row.userId, bucketRows);
    }

    const settingsByUser = new Map(settingsRows.map((row) => [row.userId, row]));
    const entitlementsByUser = new Map(entitlementRows.map((row) => [row.userId, row]));
    const locationsByUser = new Map(locationRows.map((row) => [row.userId, row]));

    const topPhotoPathsByUser = new Map<string, string[]>();
    const photoAccessByUser = new Map<string, ImageAccessPolicy>();
    const publicPaths: string[] = [];
    const signedPaths: string[] = [];
    const resolvePhotoAccess =
      input.resolvePhotoAccess ?? (() => resolveImageAccessPolicy("discover", "visible_standard"));
    for (const profile of profiles) {
      const photoRows = photosByUser.get(profile.userId) ?? [];
      const topPaths = photoRows
        .slice(0, 3)
        .map((row) => row.storagePath)
        .filter((value): value is string => typeof value === "string" && value.length > 0);
      topPhotoPathsByUser.set(profile.userId, topPaths);
      const accessPolicy = resolvePhotoAccess(profile.userId);
      photoAccessByUser.set(profile.userId, accessPolicy);
      if (accessPolicy === "public_stable") {
        publicPaths.push(...topPaths);
      } else {
        signedPaths.push(...topPaths);
      }
    }

    const bucketCheckStartMs = performance.now();
    const publicBucketEnabled = isPublicBucketEnabled();
    mark("public_bucket_check_ms", bucketCheckStartMs);
    if (!publicBucketEnabled) {
      input.logger.warn("discover.public_bucket_disabled_fallback_to_signed");
    }
    const publicByPath = new Map<string, string>();
    if (publicBucketEnabled) {
      const rowByPath = new Map<string, ProfilePhotoRow>();
      for (const row of photosRows) {
        if (row.storagePath) rowByPath.set(row.storagePath, row);
      }
      for (const storagePath of publicPaths) {
        if (!storagePath) continue;
        const row = rowByPath.get(storagePath);
        const versionMs = row?.updatedAt ? new Date(row.updatedAt).getTime() : undefined;
        publicByPath.set(storagePath, buildPublicPhotoUrl(storagePath, "card", versionMs));
      }
    }
    const photoProbeMode = input.photoProbeMode ?? "sync";
    const probeStartMs = performance.now();
    const brokenPublicPaths = publicBucketEnabled && photoProbeMode !== "off"
      ? await probePublicVariantHealth(publicByPath, input.logger)
      : new Set<string>();
    if (publicBucketEnabled && photoProbeMode === "off" && publicByPath.size > 0) {
      void probePublicVariantHealth(publicByPath, input.logger).catch(() => undefined);
    }
    mark("public_variant_probe_ms", probeStartMs);
    const signedCandidates = [
      ...signedPaths,
      ...(!publicBucketEnabled ? publicPaths : []),
      ...(publicBucketEnabled ? [...brokenPublicPaths] : []),
    ];
    const signedUrlsStartMs = performance.now();
    const signedByPath =
      signedCandidates.length > 0 ? await createSignedUrlsForPaths(signedCandidates) : new Map<string, string>();
    mark("signed_urls_ms", signedUrlsStartMs);
    const resolvedCount = publicByPath.size + signedByPath.size;
    const totalPaths = publicPaths.length + signedPaths.length;
    if (totalPaths > 0 && resolvedCount === 0) {
      input.logger.error({ total: totalPaths, publicAvailable: publicByPath.size, signedAvailable: signedByPath.size, publicBucketEnabled }, "discover.photos_url_map_empty");
    } else if (totalPaths > 0 && resolvedCount < totalPaths) {
      input.logger.warn({ total: totalPaths, resolved: resolvedCount, missing: totalPaths - resolvedCount, publicAvailable: publicByPath.size, signedAvailable: signedByPath.size, publicBucketEnabled }, "discover.photos_url_map_partial");
    }

    const mappingStartMs = performance.now();
    const candidates: FeedCandidate[] = [];
    for (const profile of profiles) {
      const accessPolicy = photoAccessByUser.get(profile.userId) ?? "public_stable";
      const photoResolution = resolveCandidatePhoto({
        topPaths: topPhotoPathsByUser.get(profile.userId) ?? [],
        accessPolicy,
        publicByPath,
        signedByPath,
        brokenPublicPaths,
      });
      candidates.push(
        mapProfileToCandidate(
          profile,
          photoResolution,
          input.userGeoPoint ?? null,
          settingsByUser.get(profile.userId),
          entitlementsByUser.get(profile.userId),
          boostedProfileIds.has(profile.userId),
          locationsByUser.get(profile.userId),
        ),
      );
    }
    mark("candidate_mapping_ms", mappingStartMs);

    const eligibleCandidates = env.DISCOVER_REQUIRE_PHOTO
      ? candidates.filter((item) => item.photoStatus !== "placeholder")
      : candidates;

    if (candidates.length > 0) {
      const statusCounts = candidates.reduce<Record<string, number>>((acc, item) => {
        acc[item.photoStatus] = (acc[item.photoStatus] ?? 0) + 1;
        return acc;
      }, {});
      const reasonCounts = candidates.reduce<Record<string, number>>((acc, item) => {
        acc[item.photoReason] = (acc[item.photoReason] ?? 0) + 1;
        return acc;
      }, {});
      input.logger.info(
        { candidates: candidates.length, eligibleCandidates: eligibleCandidates.length, droppedNoPhoto: candidates.length - eligibleCandidates.length, requirePhoto: env.DISCOVER_REQUIRE_PHOTO, photoStatus: statusCounts, photoReason: reasonCounts },
        "discover.photo_resolution_summary",
      );
    }

    timings.total_wall_ms = Number((performance.now() - functionStartMs).toFixed(2));
    input.logger.info(
      {
        source: input.source ?? "generic",
        requestedIds: profileIds.length,
        profiles: profiles.length,
        photosRows: photosRows.length,
        settingsRows: settingsRows.length,
        entitlementRows: entitlementRows.length,
        boostedProfiles: boostedProfileIds.size,
        publicPaths: publicPaths.length,
        signedPaths: signedPaths.length,
        brokenPublicPaths: brokenPublicPaths.size,
        signedCandidates: signedCandidates.length,
        timings,
      },
      "discover.load_candidates_by_ids_timing",
    );
    return eligibleCandidates;
  } catch (error) {
    input.logger.error({ err: error }, "discover.load_candidates_by_ids_failed");
    return [];
  }
};
