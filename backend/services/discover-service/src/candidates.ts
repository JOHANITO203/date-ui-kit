import { createClient } from "@supabase/supabase-js";
import { env } from "./config";
import type { FeedCandidate } from "./data";
import type { CandidatePhotoStatus } from "./data";
import type { FastifyBaseLogger } from "fastify";
import type { PlanTier, ShortPassTier } from "./data";
import type { ImageAccessPolicy } from "./imageAccessPolicy";
import { resolveImageAccessPolicy } from "./imageAccessPolicy";

type ProfileRow = {
  user_id: string;
  first_name: string | null;
  birth_date: string | null;
  gender: string | null;
  city: string | null;
  origin_country: string | null;
  languages: string[] | null;
  bio: string | null;
  interests: string[] | null;
  verified_opt_in: boolean | null;
};

type ProfilePhotoRow = {
  user_id: string;
  storage_path: string;
  sort_order: number | null;
  is_primary: boolean | null;
  updated_at: string | null;
};

type SettingsRow = {
  user_id: string;
  hide_age: boolean | null;
  hide_distance: boolean | null;
  shadow_ghost: boolean | null;
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
  user_id: string;
  entitlement_snapshot: EntitlementSnapshot | null;
};

const hasSupabase =
  typeof env.SUPABASE_URL === "string" &&
  env.SUPABASE_URL.length > 0 &&
  typeof env.SUPABASE_SERVICE_ROLE === "string" &&
  env.SUPABASE_SERVICE_ROLE.length > 0;

const supabase = hasSupabase
  ? createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;
const optionalQueryTimeoutMs = Math.min(
  env.DISCOVER_SUPABASE_TIMEOUT_MS,
  env.DISCOVER_OPTIONAL_QUERY_TIMEOUT_MS,
);
const settingsQueryTimeoutMs = Math.min(
  env.DISCOVER_SUPABASE_TIMEOUT_MS,
  env.DISCOVER_SETTINGS_QUERY_TIMEOUT_MS,
);
const encodeStoragePath = (value: string) =>
  value
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

const buildPublicPhotoUrl = (
  storagePath: string,
  variant: "card",
  updatedAtIso: string | null,
) => {
  if (!env.SUPABASE_URL) return "/placeholder.svg";
  const bucket = env.STORAGE_PROFILE_PHOTOS_PUBLIC_BUCKET;
  const version = updatedAtIso ? new Date(updatedAtIso).getTime() : undefined;
  const clean = storagePath.replace(/^\/+/, "");
  const withoutExt = clean.replace(/\.[^/.]+$/, "");
  const variantPath = `variants/${variant}/${withoutExt}.jpg`;
  const base = `${env.SUPABASE_URL}/storage/v1/object/public/${bucket}/${encodeStoragePath(variantPath)}`;
  const params = new URLSearchParams();
  if (version) params.set("v", String(version));
  const query = params.toString();
  return query ? `${base}?${query}` : base;
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
  settingsCache.set(row.user_id, {
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

const createSignedUrlsForPaths = async (paths: string[]): Promise<Map<string, string>> => {
  const result = new Map<string, string>();
  if (!supabase || paths.length === 0) return result;

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
      const signedBatch = await withTimeout(
        supabase.storage
          .from(env.STORAGE_PROFILE_PHOTOS_BUCKET)
          .createSignedUrls(chunk, env.STORAGE_SIGNED_URL_TTL_SEC, {
            transform: {
              width: 960,
              quality: 76,
            },
          } as any),
        optionalQueryTimeoutMs,
        "discover_create_signed_urls",
      );

      if (!signedBatch.error && Array.isArray(signedBatch.data)) {
        for (const entry of signedBatch.data) {
          if (!entry?.path || !entry?.signedUrl) continue;
          result.set(entry.path, entry.signedUrl);
          setCachedSignedPhotoUrl(entry.path, entry.signedUrl);
        }
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
        const response = await withTimeout(
          fetch(url, { method: "HEAD" }),
          Math.min(env.DISCOVER_SUPABASE_TIMEOUT_MS, 700),
          "discover_public_variant_probe",
        );
        return { storagePath, status: response.status, ok: response.ok };
      } catch {
        return { storagePath, status: 0, ok: false };
      }
    }),
  );

  for (const check of checks) {
    publicVariantHealthCache.set(check.storagePath, {
      healthy: check.ok,
      checkedAtMs: now,
    });
    if (!check.ok) {
      broken.add(check.storagePath);
      logger.warn(
        {
          storagePath: check.storagePath,
          status: check.status,
        },
        "discover.public_variant_unavailable_fallback_to_signed",
      );
    }
  }

  return broken;
};

const publicBucketState = {
  checkedAt: 0,
  isPublic: false,
};
const PUBLIC_BUCKET_CHECK_TTL_MS = 60_000;

const checkPublicBucketViaStorageApi = async (): Promise<boolean> => {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE) return false;
  const response = await withTimeout(
    fetch(`${env.SUPABASE_URL}/storage/v1/bucket`, {
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE}`,
      },
    }),
    Math.min(env.DISCOVER_SUPABASE_TIMEOUT_MS, env.DISCOVER_PUBLIC_BUCKET_CHECK_TIMEOUT_MS),
    "discover_public_bucket_storage_api",
  );
  if (!response.ok) return false;
  const buckets = (await response.json()) as Array<{ id?: string; public?: boolean }>;
  const target = buckets.find((bucket) => bucket.id === env.STORAGE_PROFILE_PHOTOS_PUBLIC_BUCKET);
  return Boolean(target?.public);
};

const isPublicBucketEnabled = async () => {
  if (env.DISCOVER_PUBLIC_BUCKET_ASSUME_ENABLED) return true;
  const now = Date.now();
  if (publicBucketState.checkedAt > 0 && now - publicBucketState.checkedAt < PUBLIC_BUCKET_CHECK_TTL_MS) {
    return publicBucketState.isPublic;
  }
  try {
    publicBucketState.isPublic = await checkPublicBucketViaStorageApi();
  } catch {
    // Keep last known state on transient failure to avoid false negatives.
    publicBucketState.isPublic = publicBucketState.isPublic;
  }
  publicBucketState.checkedAt = now;
  return publicBucketState.isPublic;
};
const withTimeout = async <T>(promise: PromiseLike<T>, timeoutMs: number, label: string): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label}_timeout_${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
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

const deterministicScore = (seed: string) =>
  [...seed].reduce((acc, ch, index) => (acc + ch.charCodeAt(0) * (index + 1)) % 1000, 0);

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
        return {
          urls,
          status: "signed_fallback",
          url: primaryUrl,
          reason: "public_variant_unavailable_signed_fallback",
          storagePath: primaryPath,
        };
      }
      return {
        urls: ["/placeholder.svg"],
        status: "placeholder",
        url: "/placeholder.svg",
        reason: "public_variant_unavailable_no_signed",
        storagePath: primaryPath,
      };
    }
    if (input.publicByPath.has(primaryPath)) {
      return {
        urls,
        status: "public",
        url: primaryUrl,
        reason: "public_variant_ok",
        storagePath: primaryPath,
      };
    }
    if (input.signedByPath.has(primaryPath)) {
      return {
        urls,
        status: "signed_fallback",
        url: primaryUrl,
        reason: "public_variant_missing_signed_fallback",
        storagePath: primaryPath,
      };
    }
    return {
      urls: ["/placeholder.svg"],
      status: "placeholder",
      url: "/placeholder.svg",
      reason: "public_candidate_unresolved",
      storagePath: primaryPath,
    };
  }

  if (input.signedByPath.has(primaryPath)) {
    return {
      urls,
      status: "signed_fallback",
      url: primaryUrl,
      reason: "signed_policy_private",
      storagePath: primaryPath,
    };
  }
  return {
    urls: ["/placeholder.svg"],
    status: "placeholder",
    url: "/placeholder.svg",
    reason: "signed_policy_missing_source",
    storagePath: primaryPath,
  };
};

const mapProfileToCandidate = (
  profile: ProfileRow,
  photoResolution: CandidatePhotoResolution,
  userGeoPoint: { lat: number; lng: number } | null,
  settings: SettingsRow | undefined,
  entitlement: UserEntitlementRow | undefined,
): FeedCandidate => {
  const city = profile.city?.trim() || "Moscow";
  const cityGeo = cityCoordinates[city];
  const effectiveDistanceKm =
    userGeoPoint && cityGeo ? Math.max(1, Math.round(haversineKm(userGeoPoint, cityGeo))) : 7;
  const scoreSeed = deterministicScore(profile.user_id);
  const planTier = resolveEntitlementPlanTier(entitlement?.entitlement_snapshot);
  const shortPassTier = resolveShortPassTier(entitlement?.entitlement_snapshot);
  const shadowGhostEnabledByUser = Boolean(settings?.shadow_ghost);

  return {
    id: profile.user_id,
    name: profile.first_name?.trim() || "Profile",
    gender: normalizeGender(profile.gender),
    age: computeAge(profile.birth_date),
    city,
    originCountry: profile.origin_country?.trim() || "russian",
    distanceKm: effectiveDistanceKm,
    languages: profile.languages && profile.languages.length > 0 ? profile.languages : ["English", "Russian"],
    bio: profile.bio?.trim() || "Looking for meaningful connections.",
    photos: photoResolution.urls.length > 0 ? photoResolution.urls : ["/placeholder.svg"],
    photoStatus: photoResolution.status,
    photoUrl: photoResolution.url,
    photoReason: photoResolution.reason,
    photoStoragePath: photoResolution.storagePath,
    compatibility: 70 + (scoreSeed % 28),
    interests: profile.interests && profile.interests.length > 0 ? profile.interests : ["Travel", "Music"],
    online: scoreSeed % 3 !== 0,
    flags: {
      verifiedIdentity: Boolean(profile.verified_opt_in),
      premiumTier: planTier,
      shortPassTier,
      hideAge: Boolean(settings?.hide_age),
      hideDistance: Boolean(settings?.hide_distance),
      shadowGhost: shadowGhostEnabledByUser && canUseShadowGhost(entitlement?.entitlement_snapshot),
    },
    rankScore: 80 + (scoreSeed % 20),
    scoreReason: "supabase_seed",
  };
};

const createPublicUrlsForPaths = (
  rows: ProfilePhotoRow[],
  available: Set<string>,
): Map<string, string> => {
  const result = new Map<string, string>();
  for (const row of rows) {
    if (!row.storage_path) continue;
    if (available.has(row.storage_path)) {
      result.set(row.storage_path, buildPublicPhotoUrl(row.storage_path, "card", row.updated_at));
    }
  }
  return result;
};

export const loadCandidatesFromSupabase = async (input: {
  currentUserId: string;
  userGeoPoint: { lat: number; lng: number } | null;
  logger: FastifyBaseLogger;
  resolvePhotoAccess?: PhotoAccessResolver;
}): Promise<FeedCandidate[]> => {
  if (!supabase) {
    input.logger.error("discover.supabase_config_missing_no_static_fallback");
    return [];
  }

  try {
    const profilesResult = await withTimeout(
      supabase
        .from("profiles")
        .select(
          "user_id,first_name,birth_date,gender,city,origin_country,languages,bio,interests,verified_opt_in",
        )
        .neq("user_id", input.currentUserId)
        .limit(env.DISCOVER_FEED_PROFILE_LIMIT),
      env.DISCOVER_SUPABASE_TIMEOUT_MS,
      "discover_profiles_query",
    );

    if (profilesResult.error) throw profilesResult.error;
    const profiles = (profilesResult.data ?? []) as ProfileRow[];
    if (profiles.length === 0) return [];

    const profileIds = profiles.map((row) => row.user_id);

    let photosRows: ProfilePhotoRow[] = [];
    try {
      const photosResult = await withTimeout(
        supabase
          .from("profile_photos")
          .select("user_id,storage_path,sort_order,is_primary,updated_at")
          .in("user_id", profileIds)
          .or("is_primary.eq.true,sort_order.eq.0,sort_order.eq.1,sort_order.eq.2")
          .order("is_primary", { ascending: false })
          .order("sort_order", { ascending: true })
        .limit(Math.max(160, env.DISCOVER_FEED_PROFILE_LIMIT * 4)),
        optionalQueryTimeoutMs,
        "discover_photos_query",
      );
      if (photosResult.error) throw photosResult.error;
      photosRows = (photosResult.data ?? []) as ProfilePhotoRow[];
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
        const settingsResult = await withTimeout(
          supabase
            .from("settings")
            .select("user_id,hide_age,hide_distance,shadow_ghost")
            .in("user_id", missingIds)
            .limit(500),
          settingsQueryTimeoutMs,
          "discover_settings_query",
        );
        if (settingsResult.error) throw settingsResult.error;
        const fresh = (settingsResult.data ?? []) as SettingsRow[];
        for (const row of fresh) setCachedSettings(row);
        settingsRows = [...cachedSettings, ...fresh];
      } else {
        settingsRows = cachedSettings;
      }
    } catch (error) {
      input.logger.warn({ err: error }, "discover.settings_query_failed_continue_with_defaults");
    }

    let entitlementRows: UserEntitlementRow[] = [];
    try {
      const entitlementResult = await withTimeout(
        supabase
          .from("user_entitlements")
          .select("user_id,entitlement_snapshot")
          .in("user_id", profileIds)
          .limit(500),
        optionalQueryTimeoutMs,
        "discover_entitlements_query",
      );
      if (entitlementResult.error) throw entitlementResult.error;
      entitlementRows = (entitlementResult.data ?? []) as UserEntitlementRow[];
    } catch (error) {
      input.logger.warn({ err: error }, "discover.entitlements_query_failed_continue_with_free_tier");
    }

    const photosByUser = new Map<string, ProfilePhotoRow[]>();
    for (const row of photosRows) {
      const bucketRows = photosByUser.get(row.user_id) ?? [];
      bucketRows.push(row);
      photosByUser.set(row.user_id, bucketRows);
    }

    const settingsByUser = new Map(
      settingsRows.map((row) => [row.user_id, row]),
    );

    const entitlementsByUser = new Map(
      entitlementRows.map((row) => [row.user_id, row]),
    );

    const topPhotoPathsByUser = new Map<string, string[]>();
    const photoAccessByUser = new Map<string, ImageAccessPolicy>();
    const allTopPaths: string[] = [];
    const publicPaths: string[] = [];
    const signedPaths: string[] = [];
    const resolvePhotoAccess =
      input.resolvePhotoAccess ??
      (() => resolveImageAccessPolicy("discover", "visible_standard"));
    for (const profile of profiles) {
      const photoRows = photosByUser.get(profile.user_id) ?? [];
      const topPaths = photoRows
        .slice(0, 3)
        .map((row) => row.storage_path)
        .filter((value): value is string => typeof value === "string" && value.length > 0);
      topPhotoPathsByUser.set(profile.user_id, topPaths);
      allTopPaths.push(...topPaths);
      const accessPolicy = resolvePhotoAccess(profile.user_id);
      photoAccessByUser.set(profile.user_id, accessPolicy);
      if (accessPolicy === "public_stable") {
        publicPaths.push(...topPaths);
      } else {
        signedPaths.push(...topPaths);
      }
    }
    const publicBucketEnabled = await isPublicBucketEnabled().catch(() => false);
    if (!publicBucketEnabled) {
      input.logger.warn("discover.public_bucket_disabled_fallback_to_signed");
    }
    const publicByPath = new Map<string, string>();
    if (publicBucketEnabled) {
      const rowByPath = new Map<string, ProfilePhotoRow>();
      for (const row of photosRows) {
        if (row.storage_path) rowByPath.set(row.storage_path, row);
      }
      for (const storagePath of publicPaths) {
        if (!storagePath) continue;
        const row = rowByPath.get(storagePath);
        publicByPath.set(storagePath, buildPublicPhotoUrl(storagePath, "card", row?.updated_at ?? null));
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
      input.logger.error(
        {
          total: totalPaths,
          publicAvailable: publicByPath.size,
          signedAvailable: signedByPath.size,
          publicBucketEnabled,
        },
        "discover.photos_url_map_empty",
      );
    } else if (totalPaths > 0 && resolvedCount < totalPaths) {
      input.logger.warn(
        {
          total: totalPaths,
          resolved: resolvedCount,
          missing: totalPaths - resolvedCount,
          publicAvailable: publicByPath.size,
          signedAvailable: signedByPath.size,
          publicBucketEnabled,
        },
        "discover.photos_url_map_partial",
      );
    }

    const candidates: FeedCandidate[] = [];
    for (const profile of profiles) {
      const accessPolicy = photoAccessByUser.get(profile.user_id) ?? "public_stable";
      const photoResolution = resolveCandidatePhoto({
        topPaths: topPhotoPathsByUser.get(profile.user_id) ?? [],
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
          settingsByUser.get(profile.user_id),
          entitlementsByUser.get(profile.user_id),
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
        {
          candidates: candidates.length,
          eligibleCandidates: eligibleCandidates.length,
          droppedNoPhoto: candidates.length - eligibleCandidates.length,
          requirePhoto: env.DISCOVER_REQUIRE_PHOTO,
          photoStatus: statusCounts,
          photoReason: reasonCounts,
        },
        "discover.photo_resolution_summary",
      );
    }

    return eligibleCandidates;
  } catch (error) {
    input.logger.error({ err: error }, "discover.load_candidates_supabase_failed_no_static_fallback");
    return [];
  }
};

export const loadCandidatesByProfileIds = async (input: {
  profileIds: string[];
  userGeoPoint?: { lat: number; lng: number } | null;
  logger: FastifyBaseLogger;
  resolvePhotoAccess?: PhotoAccessResolver;
}): Promise<FeedCandidate[]> => {
  if (!supabase) {
    input.logger.error("discover.supabase_config_missing_no_static_fallback");
    return [];
  }

  const profileIds = [...new Set(input.profileIds.filter((entry) => typeof entry === "string" && entry.length > 0))];
  if (profileIds.length === 0) return [];

  try {
    const profilesResult = await withTimeout(
      supabase
        .from("profiles")
        .select(
          "user_id,first_name,birth_date,gender,city,origin_country,languages,bio,interests,verified_opt_in",
        )
        .in("user_id", profileIds)
        .limit(Math.max(32, profileIds.length * 2)),
      env.DISCOVER_SUPABASE_TIMEOUT_MS,
      "discover_profiles_by_ids_query",
    );

    if (profilesResult.error) throw profilesResult.error;
    const profiles = (profilesResult.data ?? []) as ProfileRow[];
    if (profiles.length === 0) return [];

    let photosRows: ProfilePhotoRow[] = [];
    try {
      const photosResult = await withTimeout(
        supabase
          .from("profile_photos")
          .select("user_id,storage_path,sort_order,is_primary,updated_at")
          .in("user_id", profileIds)
          .order("is_primary", { ascending: false })
          .order("sort_order", { ascending: true })
          .limit(Math.max(96, profileIds.length * 4)),
        optionalQueryTimeoutMs,
        "discover_photos_by_ids_query",
      );
      if (photosResult.error) throw photosResult.error;
      photosRows = (photosResult.data ?? []) as ProfilePhotoRow[];
    } catch (error) {
      input.logger.warn({ err: error }, "discover.photos_by_ids_query_failed_continue_with_placeholders");
    }

    let settingsRows: SettingsRow[] = [];
    try {
      const settingsResult = await withTimeout(
        supabase
          .from("settings")
          .select("user_id,hide_age,hide_distance,shadow_ghost")
          .in("user_id", profileIds)
          .limit(Math.max(64, profileIds.length * 2)),
        optionalQueryTimeoutMs,
        "discover_settings_by_ids_query",
      );
      if (settingsResult.error) throw settingsResult.error;
      settingsRows = (settingsResult.data ?? []) as SettingsRow[];
    } catch (error) {
      input.logger.warn({ err: error }, "discover.settings_by_ids_query_failed_continue_with_defaults");
    }

    let entitlementRows: UserEntitlementRow[] = [];
    try {
      const entitlementResult = await withTimeout(
        supabase
          .from("user_entitlements")
          .select("user_id,entitlement_snapshot")
          .in("user_id", profileIds)
          .limit(Math.max(64, profileIds.length * 2)),
        optionalQueryTimeoutMs,
        "discover_entitlements_by_ids_query",
      );
      if (entitlementResult.error) throw entitlementResult.error;
      entitlementRows = (entitlementResult.data ?? []) as UserEntitlementRow[];
    } catch (error) {
      input.logger.warn({ err: error }, "discover.entitlements_by_ids_query_failed_continue_with_free_tier");
    }

    const photosByUser = new Map<string, ProfilePhotoRow[]>();
    for (const row of photosRows) {
      const bucketRows = photosByUser.get(row.user_id) ?? [];
      bucketRows.push(row);
      photosByUser.set(row.user_id, bucketRows);
    }

    const settingsByUser = new Map(settingsRows.map((row) => [row.user_id, row]));
    const entitlementsByUser = new Map(entitlementRows.map((row) => [row.user_id, row]));

    const topPhotoPathsByUser = new Map<string, string[]>();
    const photoAccessByUser = new Map<string, ImageAccessPolicy>();
    const allTopPaths: string[] = [];
    const publicPaths: string[] = [];
    const signedPaths: string[] = [];
    const resolvePhotoAccess =
      input.resolvePhotoAccess ??
      (() => resolveImageAccessPolicy("discover", "visible_standard"));
    for (const profile of profiles) {
      const photoRows = photosByUser.get(profile.user_id) ?? [];
      const topPaths = photoRows
        .slice(0, 3)
        .map((row) => row.storage_path)
        .filter((value): value is string => typeof value === "string" && value.length > 0);
      topPhotoPathsByUser.set(profile.user_id, topPaths);
      allTopPaths.push(...topPaths);
      const accessPolicy = resolvePhotoAccess(profile.user_id);
      photoAccessByUser.set(profile.user_id, accessPolicy);
      if (accessPolicy === "public_stable") {
        publicPaths.push(...topPaths);
      } else {
        signedPaths.push(...topPaths);
      }
    }

    const publicBucketEnabled = await isPublicBucketEnabled().catch(() => false);
    if (!publicBucketEnabled) {
      input.logger.warn("discover.public_bucket_disabled_fallback_to_signed");
    }
    const publicByPath = new Map<string, string>();
    if (publicBucketEnabled) {
      const rowByPath = new Map<string, ProfilePhotoRow>();
      for (const row of photosRows) {
        if (row.storage_path) rowByPath.set(row.storage_path, row);
      }
      for (const storagePath of publicPaths) {
        if (!storagePath) continue;
        const row = rowByPath.get(storagePath);
        publicByPath.set(storagePath, buildPublicPhotoUrl(storagePath, "card", row?.updated_at ?? null));
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
      input.logger.error(
        {
          total: totalPaths,
          publicAvailable: publicByPath.size,
          signedAvailable: signedByPath.size,
          publicBucketEnabled,
        },
        "discover.photos_url_map_empty",
      );
    } else if (totalPaths > 0 && resolvedCount < totalPaths) {
      input.logger.warn(
        {
          total: totalPaths,
          resolved: resolvedCount,
          missing: totalPaths - resolvedCount,
          publicAvailable: publicByPath.size,
          signedAvailable: signedByPath.size,
          publicBucketEnabled,
        },
        "discover.photos_url_map_partial",
      );
    }

    const candidates: FeedCandidate[] = [];
    for (const profile of profiles) {
      const accessPolicy = photoAccessByUser.get(profile.user_id) ?? "public_stable";
      const photoResolution = resolveCandidatePhoto({
        topPaths: topPhotoPathsByUser.get(profile.user_id) ?? [],
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
          settingsByUser.get(profile.user_id),
          entitlementsByUser.get(profile.user_id),
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
        {
          candidates: candidates.length,
          eligibleCandidates: eligibleCandidates.length,
          droppedNoPhoto: candidates.length - eligibleCandidates.length,
          requirePhoto: env.DISCOVER_REQUIRE_PHOTO,
          photoStatus: statusCounts,
          photoReason: reasonCounts,
        },
        "discover.photo_resolution_summary",
      );
    }

    return eligibleCandidates;
  } catch (error) {
    input.logger.error({ err: error }, "discover.load_candidates_by_ids_failed");
    return [];
  }
};
