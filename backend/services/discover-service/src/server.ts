import Fastify from "fastify";
import cors from "@fastify/cors";
import { z } from "zod";
import { env } from "./config";
import { feedSeed } from "./data";

const filterSchema = z
  .array(z.enum(["all", "nearby", "new", "online", "verified"]))
  .default(["all"]);

const swipeSchema = z.object({
  profileId: z.string().min(1),
  decision: z.enum(["like", "dislike", "superlike"]),
});

type FeedPreferences = {
  ageMin: number;
  ageMax: number;
  distanceKm: number;
  genderPreference: "men" | "women" | "everyone";
  intent: "serieuse" | "connexion" | "decouverte" | "verrai" | null;
  interests: string[];
};

type GeoPoint = {
  lat: number;
  lng: number;
};

const DEFAULT_PREFERENCES: FeedPreferences = {
  ageMin: 18,
  ageMax: 65,
  distanceKm: 50,
  genderPreference: "everyone",
  intent: null,
  interests: [],
};

const CITY_COORDINATES: Record<string, GeoPoint> = {
  Moscow: { lat: 55.7558, lng: 37.6173 },
  "Saint Petersburg": { lat: 59.9311, lng: 30.3609 },
  Voronezh: { lat: 51.6608, lng: 39.2003 },
  Sochi: { lat: 43.5855, lng: 39.7231 },
};

const parsePositiveInt = (raw: string | undefined, fallback: number, min: number, max: number) => {
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  const normalized = Math.trunc(parsed);
  if (normalized < min || normalized > max) return fallback;
  return normalized;
};

const parseCoordinate = (raw: string | undefined, min: number, max: number) => {
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return null;
  if (parsed < min || parsed > max) return null;
  return parsed;
};

const parseUserGeoPoint = (query: Record<string, string | undefined>): GeoPoint | null => {
  const lat = parseCoordinate(query.lat, -90, 90);
  const lng = parseCoordinate(query.lng, -180, 180);
  if (lat === null || lng === null) return null;
  return { lat, lng };
};

const toRadians = (value: number) => (value * Math.PI) / 180;

const haversineKm = (a: GeoPoint, b: GeoPoint) => {
  const earthRadiusKm = 6371;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const aa =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(a.lat)) *
      Math.cos(toRadians(b.lat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
  return earthRadiusKm * c;
};

const normalizeTag = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]+/g, " ")
    .trim();

const USER_INTEREST_CANONICAL_MAP: Record<string, string> = {
  musique: "music",
  sport: "sport",
  business: "business",
  voyage: "travel",
  cinema: "movies",
  food: "food",
  mode: "fashion",
  spiritualite: "spirituality",
  tech: "tech",
  art: "art",
  danse: "dance",
  lifestyle: "lifestyle",
};

const CANDIDATE_INTEREST_CANONICAL_MAP: Record<string, string> = {
  art: "art",
  travel: "travel",
  wine: "lifestyle",
  tech: "tech",
  coffee: "food",
  design: "art",
  architecture: "art",
  photography: "art",
  pizza: "food",
  hiking: "sport",
  sea: "travel",
  yoga: "sport",
  music: "music",
  food: "food",
  photo: "art",
};

const toCanonicalUserInterest = (value: string) => USER_INTEREST_CANONICAL_MAP[normalizeTag(value)];
const toCanonicalCandidateInterest = (value: string) => CANDIDATE_INTEREST_CANONICAL_MAP[normalizeTag(value)];

const parseFeedPreferences = (query: Record<string, string | undefined>): FeedPreferences => {
  const ageMin = parsePositiveInt(query.ageMin, DEFAULT_PREFERENCES.ageMin, 18, 100);
  const ageMax = parsePositiveInt(query.ageMax, DEFAULT_PREFERENCES.ageMax, 18, 100);
  const distanceKm = parsePositiveInt(query.distanceKm, DEFAULT_PREFERENCES.distanceKm, 1, 500);
  const genderPreference =
    query.genderPreference === "men" || query.genderPreference === "women"
      ? query.genderPreference
      : "everyone";
  const intent =
    query.intent === "serieuse" ||
    query.intent === "connexion" ||
    query.intent === "decouverte" ||
    query.intent === "verrai"
      ? query.intent
      : null;
  const interests = query.interests
    ? query.interests
        .split(",")
        .map((value) => value.trim())
        .filter((value) => value.length > 0)
    : [];

  return {
    ageMin: Math.min(ageMin, ageMax - 1),
    ageMax: Math.max(ageMax, ageMin + 1),
    distanceKm,
    genderPreference,
    intent,
    interests,
  };
};

const resolveCandidateDistanceKm = (candidate: (typeof feedSeed)[number], userGeoPoint: GeoPoint | null) => {
  if (!userGeoPoint) return candidate.distanceKm;
  const candidateGeo = CITY_COORDINATES[candidate.city];
  if (!candidateGeo) return candidate.distanceKm;
  return Math.max(1, Math.round(haversineKm(userGeoPoint, candidateGeo)));
};

const getIntentScoreDelta = (
  candidate: (typeof feedSeed)[number],
  intent: FeedPreferences["intent"],
  effectiveDistanceKm: number
) => {
  if (!intent || intent === "verrai") return 0;

  if (intent === "serieuse") {
    let delta = 0;
    if (candidate.flags.verifiedIdentity) delta += 2;
    if (candidate.compatibility >= 90) delta += 1;
    return delta;
  }

  if (intent === "connexion") {
    let delta = 0;
    if (candidate.online) delta += 2;
    if (effectiveDistanceKm <= 8) delta += 1;
    return delta;
  }

  // decouverte: slight boost for open and diverse profiles.
  let delta = 0;
  if (candidate.languages.length >= 2) delta += 1;
  if (effectiveDistanceKm >= 3 && effectiveDistanceKm <= 25) delta += 1;
  return delta;
};

const getInterestsScoreDelta = (
  candidate: (typeof feedSeed)[number],
  interests: FeedPreferences["interests"]
) => {
  if (interests.length === 0) return 0;

  const requested = new Set(interests.map(toCanonicalUserInterest).filter((value): value is string => Boolean(value)));
  if (requested.size === 0) return 0;

  const candidateTags = new Set(
    candidate.interests.map(toCanonicalCandidateInterest).filter((value): value is string => Boolean(value))
  );
  if (candidateTags.size === 0) return 0;

  let overlap = 0;
  requested.forEach((tag) => {
    if (candidateTags.has(tag)) overlap += 1;
  });

  if (overlap <= 0) return 0;
  if (overlap === 1) return 2;
  if (overlap === 2) return 3;
  return 4;
};

const applyFiltersAndRank = (
  filters: string[],
  preferences: FeedPreferences,
  userGeoPoint: GeoPoint | null
) => {
  const filtered = feedSeed.filter((candidate, index) => {
    const effectiveDistanceKm = resolveCandidateDistanceKm(candidate, userGeoPoint);
    if (candidate.age < preferences.ageMin || candidate.age > preferences.ageMax) return false;
    if (effectiveDistanceKm > preferences.distanceKm) return false;
    if (preferences.genderPreference !== "everyone" && candidate.gender !== preferences.genderPreference) return false;
    if (filters.includes("nearby") && effectiveDistanceKm > 5) return false;
    if (filters.includes("new") && index > 2) return false;
    if (filters.includes("online") && !candidate.online) return false;
    if (filters.includes("verified") && !candidate.flags.verifiedIdentity) return false;
    return true;
  });

  return filtered
    .map((candidate) => {
      const effectiveDistanceKm = resolveCandidateDistanceKm(candidate, userGeoPoint);
      const intentDelta = getIntentScoreDelta(candidate, preferences.intent, effectiveDistanceKm);
      const interestDelta = getInterestsScoreDelta(candidate, preferences.interests);
      const delta = intentDelta + interestDelta;
      const reasonSuffix = [
        intentDelta > 0 && preferences.intent ? `intent_${preferences.intent}` : null,
        interestDelta > 0 ? "interest_match" : null,
      ]
        .filter((value): value is string => Boolean(value))
        .join("_");

      return {
        ...candidate,
        distanceKm: effectiveDistanceKm,
        rankScore: candidate.rankScore + delta,
        scoreReason: delta === 0 ? candidate.scoreReason : `${candidate.scoreReason}_${reasonSuffix}`,
      };
    })
    .sort((a, b) => b.rankScore - a.rankScore);
};

export const buildServer = () => {
  const app = Fastify({ logger: true });

  app.register(cors, {
    origin: [env.APP_URL, "http://127.0.0.1:3000", "http://localhost:3000"],
    credentials: true,
  });

  app.get("/health", async () => ({
    status: "ok",
    service: "discover-service",
    timestamp: new Date().toISOString(),
  }));

  app.get("/discover/feed", async (request) => {
    const query = request.query as Record<string, string | undefined>;
    const raw = query.quickFilters ? query.quickFilters.split(",").filter(Boolean) : ["all"];
    const filters = filterSchema.parse(raw);
    const preferences = parseFeedPreferences(query);
    const userGeoPoint = parseUserGeoPoint(query);
    const candidates = applyFiltersAndRank(filters, preferences, userGeoPoint);

    return {
      window: {
        cursor: `cursor_${Date.now()}`,
        candidates,
        quickFiltersApplied: filters,
        preferencesApplied: preferences,
      },
    };
  });

  app.post("/discover/swipe", async (request, reply) => {
    const parsed = swipeSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.status(400);
      return { code: "INVALID_PAYLOAD", message: "Invalid swipe payload." };
    }

    const { profileId, decision } = parsed.data;
    const matched = decision !== "dislike" && Math.random() > 0.55;
    return {
      matched,
      conversationId: matched ? `conv-${profileId}` : undefined,
    };
  });

  return app;
};
