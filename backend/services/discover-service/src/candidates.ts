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

const createSignedUrlForPath = async (storagePath: string): Promise<string | null> => {
  if (!supabase) return null;
  const signed = await supabase.storage
    .from(env.STORAGE_PROFILE_PHOTOS_BUCKET)
    .createSignedUrl(storagePath, env.STORAGE_SIGNED_URL_TTL_SEC);
  if (signed.error || !signed.data?.signedUrl) return null;
  return signed.data.signedUrl;
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
    const profilesResult = await supabase
      .from("profiles")
      .select(
        "user_id,first_name,birth_date,gender,city,origin_country,languages,bio,interests,verified_opt_in",
      )
      .neq("user_id", input.currentUserId)
      .limit(200);

    if (profilesResult.error) throw profilesResult.error;
    const profiles = (profilesResult.data ?? []) as ProfileRow[];
    if (profiles.length === 0) return [];

    const profileIds = profiles.map((row) => row.user_id);
    const photosResult = await supabase
      .from("profile_photos")
      .select("user_id,storage_path,sort_order,is_primary")
      .in("user_id", profileIds)
      .order("is_primary", { ascending: false })
      .order("sort_order", { ascending: true })
      .limit(500);
    if (photosResult.error) throw photosResult.error;

    const settingsResult = await supabase
      .from("settings")
      .select("user_id,hide_age,hide_distance,shadow_ghost")
      .in("user_id", profileIds)
      .limit(500);
    if (settingsResult.error) throw settingsResult.error;

    const entitlementResult = await supabase
      .from("user_entitlements")
      .select("user_id,entitlement_snapshot")
      .in("user_id", profileIds)
      .limit(500);
    if (entitlementResult.error) throw entitlementResult.error;

    const photosByUser = new Map<string, ProfilePhotoRow[]>();
    for (const row of (photosResult.data ?? []) as ProfilePhotoRow[]) {
      const bucketRows = photosByUser.get(row.user_id) ?? [];
      bucketRows.push(row);
      photosByUser.set(row.user_id, bucketRows);
    }

    const settingsByUser = new Map(
      ((settingsResult.data ?? []) as SettingsRow[]).map((row) => [row.user_id, row]),
    );

    const entitlementsByUser = new Map(
      ((entitlementResult.data ?? []) as UserEntitlementRow[]).map((row) => [row.user_id, row]),
    );

    const candidates: FeedCandidate[] = [];
    for (const profile of profiles) {
      const photoRows = photosByUser.get(profile.user_id) ?? [];
      const topRows = photoRows.slice(0, 2);
      const signedUrls: string[] = [];
      for (const photoRow of topRows) {
        const signed = await createSignedUrlForPath(photoRow.storage_path);
        if (signed) signedUrls.push(signed);
      }
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
