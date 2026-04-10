import { createClient } from "@supabase/supabase-js";
import { env } from "./config";
import type { FeedCandidate } from "./data";
import type { FastifyBaseLogger } from "fastify";
import type { PlanTier, ShortPassTier } from "./data";

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
const encodeStoragePath = (value: string) =>
  value
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

const buildPublicPhotoUrl = (storagePath: string, updatedAtIso: string | null) => {
  if (!env.SUPABASE_URL) return "/placeholder.svg";
  const bucket = env.STORAGE_PROFILE_PHOTOS_PUBLIC_BUCKET;
  const version = updatedAtIso ? new Date(updatedAtIso).getTime() : undefined;
  const base = `${env.SUPABASE_URL}/storage/v1/render/image/public/${bucket}/${encodeStoragePath(storagePath)}`;
  const params = new URLSearchParams({
    width: "960",
    quality: "76",
    format: "webp",
  });
  if (version) params.set("v", String(version));
  return `${base}?${params.toString()}`;
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

const chunkArray = <T>(items: T[], size: number) => {
  if (items.length <= size) return [items];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
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

const publicBucketState = {
  checkedAt: 0,
  isPublic: false,
};
const PUBLIC_BUCKET_CHECK_TTL_MS = 60_000;

const isPublicBucketEnabled = async () => {
  if (!supabase) return false;
  const now = Date.now();
  if (publicBucketState.checkedAt > 0 && now - publicBucketState.checkedAt < PUBLIC_BUCKET_CHECK_TTL_MS) {
    return publicBucketState.isPublic;
  }
  const result = await withTimeout(
    supabase
      .from("storage.buckets")
      .select("public")
      .eq("id", env.STORAGE_PROFILE_PHOTOS_PUBLIC_BUCKET)
      .maybeSingle(),
    optionalQueryTimeoutMs,
    "discover_public_bucket_check",
  );
  publicBucketState.checkedAt = now;
  publicBucketState.isPublic = Boolean(result.data?.public);
  return publicBucketState.isPublic;
};

const fetchPublicVariantSet = async (paths: string[]): Promise<Set<string>> => {
  const available = new Set<string>();
  if (!supabase || paths.length === 0) return available;
  const uniquePaths = [...new Set(paths.filter((entry) => typeof entry === "string" && entry.length > 0))];
  const chunks = chunkArray(uniquePaths, 100);
  for (const chunk of chunks) {
    const objectsResult = await withTimeout(
      supabase
        .from("storage.objects")
        .select("name")
        .eq("bucket_id", env.STORAGE_PROFILE_PHOTOS_PUBLIC_BUCKET)
        .in("name", chunk),
      optionalQueryTimeoutMs,
      "discover_public_objects_query",
    );
    if (!objectsResult.error) {
      for (const row of objectsResult.data ?? []) {
        const name = (row as { name?: unknown }).name;
        if (typeof name === "string" && name.length > 0) available.add(name);
      }
    }
  }
  return available;
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

const mapProfileToCandidate = (
  profile: ProfileRow,
  photoUrls: string[],
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
    photos: photoUrls.length > 0 ? photoUrls : ["/placeholder.svg"],
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
      result.set(row.storage_path, buildPublicPhotoUrl(row.storage_path, row.updated_at));
    }
  }
  return result;
};

export const loadCandidatesFromSupabase = async (input: {
  currentUserId: string;
  userGeoPoint: { lat: number; lng: number } | null;
  logger: FastifyBaseLogger;
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
      const settingsResult = await withTimeout(
        supabase
          .from("settings")
          .select("user_id,hide_age,hide_distance,shadow_ghost")
          .in("user_id", profileIds)
          .limit(500),
        optionalQueryTimeoutMs,
        "discover_settings_query",
      );
      if (settingsResult.error) throw settingsResult.error;
      settingsRows = (settingsResult.data ?? []) as SettingsRow[];
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
    const allTopPaths: string[] = [];
    for (const profile of profiles) {
      const photoRows = photosByUser.get(profile.user_id) ?? [];
      const topPaths = photoRows
        .slice(0, 3)
        .map((row) => row.storage_path)
        .filter((value): value is string => typeof value === "string" && value.length > 0);
      topPhotoPathsByUser.set(profile.user_id, topPaths);
      allTopPaths.push(...topPaths);
    }
    const publicBucketEnabled = await isPublicBucketEnabled().catch(() => false);
    const publicAvailable = publicBucketEnabled
      ? await fetchPublicVariantSet(allTopPaths).catch(() => new Set<string>())
      : new Set<string>();
    if (!publicBucketEnabled) {
      input.logger.warn("discover.public_bucket_disabled_fallback_to_signed");
    }
    const publicByPath = createPublicUrlsForPaths(
      photosRows.filter((row) => allTopPaths.includes(row.storage_path)),
      publicAvailable,
    );
    const missingPaths = allTopPaths.filter((path) => !publicByPath.has(path));
    const signedByPath =
      missingPaths.length > 0 ? await createSignedUrlsForPaths(missingPaths) : new Map<string, string>();
    const resolvedCount = publicByPath.size + signedByPath.size;
    if (allTopPaths.length > 0 && resolvedCount === 0) {
      input.logger.error(
        {
          total: allTopPaths.length,
          publicAvailable: publicByPath.size,
          signedAvailable: signedByPath.size,
          publicBucketEnabled,
        },
        "discover.photos_url_map_empty",
      );
    } else if (missingPaths.length > 0 && resolvedCount < allTopPaths.length) {
      input.logger.warn(
        {
          total: allTopPaths.length,
          resolved: resolvedCount,
          missing: allTopPaths.length - resolvedCount,
          publicAvailable: publicByPath.size,
          signedAvailable: signedByPath.size,
          publicBucketEnabled,
        },
        "discover.photos_url_map_partial",
      );
    }

    const candidates: FeedCandidate[] = [];
    for (const profile of profiles) {
      const signedUrls = (topPhotoPathsByUser.get(profile.user_id) ?? [])
        .map((storagePath) => publicByPath.get(storagePath) ?? signedByPath.get(storagePath))
        .filter((value): value is string => typeof value === "string" && value.length > 0);
      candidates.push(
        mapProfileToCandidate(
          profile,
          signedUrls,
          input.userGeoPoint,
          settingsByUser.get(profile.user_id),
          entitlementsByUser.get(profile.user_id),
        ),
      );
    }

    return candidates;
  } catch (error) {
    input.logger.error({ err: error }, "discover.load_candidates_supabase_failed_no_static_fallback");
    return [];
  }
};

export const loadCandidatesByProfileIds = async (input: {
  profileIds: string[];
  userGeoPoint?: { lat: number; lng: number } | null;
  logger: FastifyBaseLogger;
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
    const allTopPaths: string[] = [];
    for (const profile of profiles) {
      const photoRows = photosByUser.get(profile.user_id) ?? [];
      const topPaths = photoRows
        .slice(0, 3)
        .map((row) => row.storage_path)
        .filter((value): value is string => typeof value === "string" && value.length > 0);
      topPhotoPathsByUser.set(profile.user_id, topPaths);
      allTopPaths.push(...topPaths);
    }

    const publicBucketEnabled = await isPublicBucketEnabled().catch(() => false);
    const publicAvailable = publicBucketEnabled
      ? await fetchPublicVariantSet(allTopPaths).catch(() => new Set<string>())
      : new Set<string>();
    if (!publicBucketEnabled) {
      input.logger.warn("discover.public_bucket_disabled_fallback_to_signed");
    }
    const publicByPath = createPublicUrlsForPaths(
      photosRows.filter((row) => allTopPaths.includes(row.storage_path)),
      publicAvailable,
    );
    const missingPaths = allTopPaths.filter((path) => !publicByPath.has(path));
    const signedByPath =
      missingPaths.length > 0 ? await createSignedUrlsForPaths(missingPaths) : new Map<string, string>();
    const resolvedCount = publicByPath.size + signedByPath.size;
    if (allTopPaths.length > 0 && resolvedCount === 0) {
      input.logger.error(
        {
          total: allTopPaths.length,
          publicAvailable: publicByPath.size,
          signedAvailable: signedByPath.size,
          publicBucketEnabled,
        },
        "discover.photos_url_map_empty",
      );
    } else if (missingPaths.length > 0 && resolvedCount < allTopPaths.length) {
      input.logger.warn(
        {
          total: allTopPaths.length,
          resolved: resolvedCount,
          missing: allTopPaths.length - resolvedCount,
          publicAvailable: publicByPath.size,
          signedAvailable: signedByPath.size,
          publicBucketEnabled,
        },
        "discover.photos_url_map_partial",
      );
    }

    const candidates: FeedCandidate[] = [];
    for (const profile of profiles) {
      const signedUrls = (topPhotoPathsByUser.get(profile.user_id) ?? [])
        .map((storagePath) => publicByPath.get(storagePath) ?? signedByPath.get(storagePath))
        .filter((value): value is string => typeof value === "string" && value.length > 0);
      candidates.push(
        mapProfileToCandidate(
          profile,
          signedUrls,
          input.userGeoPoint ?? null,
          settingsByUser.get(profile.user_id),
          entitlementsByUser.get(profile.user_id),
        ),
      );
    }

    return candidates;
  } catch (error) {
    input.logger.error({ err: error }, "discover.load_candidates_by_ids_failed");
    return [];
  }
};
