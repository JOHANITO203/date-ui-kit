import { feedSeed, type FeedCandidate } from "./data";

export type FeedPreferences = {
  ageMin: number;
  ageMax: number;
  distanceKm: number;
  genderPreference: "men" | "women" | "everyone";
  intent: "serieuse" | "connexion" | "decouverte" | "verrai" | null;
  interests: string[];
  launchCity: string | null;
  originCountry: string | null;
  userLanguages: string[];
};

export type GeoPoint = {
  lat: number;
  lng: number;
};

export type RankingMetrics = {
  topN: number;
  scoreReason: Record<string, number>;
  city: {
    local: number;
    nonLocal: number;
  };
  nationality: {
    same: number;
    cross: number;
    crossRussianPair: number;
  };
};

export const DEFAULT_PREFERENCES: FeedPreferences = {
  ageMin: 18,
  ageMax: 65,
  distanceKm: 50,
  genderPreference: "everyone",
  intent: null,
  interests: [],
  launchCity: null,
  originCountry: null,
  userLanguages: [],
};

export const CITY_COORDINATES: Record<string, GeoPoint> = {
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

export const normalizeTag = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]+/g, " ")
    .trim();

const normalizeKey = (value: string) => normalizeTag(value).replace(/\s+/g, "_");

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

export const parseUserGeoPoint = (query: Record<string, string | undefined>): GeoPoint | null => {
  const lat = parseCoordinate(query.lat, -90, 90);
  const lng = parseCoordinate(query.lng, -180, 180);
  if (lat === null || lng === null) return null;
  return { lat, lng };
};

export const parseFeedPreferences = (query: Record<string, string | undefined>): FeedPreferences => {
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
  const launchCity = query.launchCity ? query.launchCity.trim() : null;
  const originCountry = query.originCountry ? normalizeKey(query.originCountry) : null;
  const userLanguages = query.userLanguages
    ? query.userLanguages
        .split(",")
        .map((value) => normalizeTag(value))
        .filter((value) => value.length > 0)
    : [];

  return {
    ageMin: Math.min(ageMin, ageMax - 1),
    ageMax: Math.max(ageMax, ageMin + 1),
    distanceKm,
    genderPreference,
    intent,
    interests,
    launchCity: launchCity && launchCity.length > 0 ? launchCity : null,
    originCountry,
    userLanguages,
  };
};

const resolveCandidateDistanceKm = (candidate: FeedCandidate, userGeoPoint: GeoPoint | null) => {
  if (!userGeoPoint) return candidate.distanceKm;
  const candidateGeo = CITY_COORDINATES[candidate.city];
  if (!candidateGeo) return candidate.distanceKm;
  return Math.max(1, Math.round(haversineKm(userGeoPoint, candidateGeo)));
};

const getIntentScoreDelta = (candidate: FeedCandidate, intent: FeedPreferences["intent"], effectiveDistanceKm: number) => {
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

  let delta = 0;
  if (candidate.languages.length >= 2) delta += 1;
  if (effectiveDistanceKm >= 3 && effectiveDistanceKm <= 25) delta += 1;
  return delta;
};

const getInterestsScoreDelta = (candidate: FeedCandidate, interests: FeedPreferences["interests"]) => {
  if (interests.length === 0) return 0;

  const requested = new Set(interests.map(toCanonicalUserInterest).filter((value): value is string => Boolean(value)));
  if (requested.size === 0) return 0;

  const candidateTags = new Set(
    candidate.interests.map(toCanonicalCandidateInterest).filter((value): value is string => Boolean(value)),
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

const getLaunchCityScoreDelta = (candidate: FeedCandidate, launchCity: FeedPreferences["launchCity"]) => {
  if (!launchCity) return 0;
  const requested = normalizeTag(launchCity);
  const candidateCity = normalizeTag(candidate.city);
  return requested.length > 0 && requested === candidateCity ? 5 : 0;
};

const getNationalityScoreDelta = (candidate: FeedCandidate, originCountry: FeedPreferences["originCountry"]) => {
  if (!originCountry) return 0;
  const candidateCountry = normalizeKey(candidate.originCountry);
  if (!candidateCountry) return 0;

  const userIsRussian = originCountry === "russian";
  const candidateIsRussian = candidateCountry === "russian";
  const isCrossRussianPair = userIsRussian !== candidateIsRussian;
  if (isCrossRussianPair) return 12;
  if (originCountry !== candidateCountry) return 7;
  return 0;
};

const getLanguageScoreDelta = (candidate: FeedCandidate, userLanguages: FeedPreferences["userLanguages"]) => {
  const candidateLanguages = candidate.languages
    .map((value) => normalizeTag(value))
    .filter((value) => value.length > 0);

  if (candidateLanguages.length === 0) return 0;
  const candidateUnique = new Set(candidateLanguages);

  if (userLanguages.length === 0) {
    return candidateUnique.size >= 2 ? 3 : 0;
  }

  const userSet = new Set(userLanguages);
  let overlap = 0;
  let diversity = 0;

  candidateUnique.forEach((language) => {
    if (userSet.has(language)) {
      overlap += 1;
    } else {
      diversity += 1;
    }
  });

  let delta = 0;
  if (diversity >= 1) delta += 5;
  if (diversity >= 2) delta += 3;
  if (overlap >= 1) delta += 1;
  if (candidateUnique.size >= 3) delta += 1;
  return Math.min(10, delta);
};

export const applyFiltersAndRank = (
  filters: string[],
  preferences: FeedPreferences,
  userGeoPoint: GeoPoint | null,
  dismissedProfileIds: Set<string>,
  candidatesSource: FeedCandidate[] = feedSeed,
) => {
  const filtered = candidatesSource.filter((candidate, index) => {
    if (dismissedProfileIds.has(candidate.id)) return false;
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
      const launchCityDelta = getLaunchCityScoreDelta(candidate, preferences.launchCity);
      const nationalityDelta = getNationalityScoreDelta(candidate, preferences.originCountry);
      const languageDelta = getLanguageScoreDelta(candidate, preferences.userLanguages);
      const delta = intentDelta + interestDelta + launchCityDelta + nationalityDelta + languageDelta;
      const reasonSuffix = [
        intentDelta > 0 && preferences.intent ? `intent_${preferences.intent}` : null,
        interestDelta > 0 ? "interest_match" : null,
        launchCityDelta > 0 ? "launch_city_match" : null,
        nationalityDelta > 0 ? "nationality_diversity" : null,
        languageDelta > 0 ? "language_diversity" : null,
      ]
        .filter((value): value is string => Boolean(value))
        .join("_");

      return {
        ...candidate,
        age: candidate.flags.hideAge ? 0 : candidate.age,
        distanceKm: candidate.flags.hideDistance ? -1 : effectiveDistanceKm,
        rankScore: candidate.rankScore + delta,
        scoreReason: delta === 0 ? candidate.scoreReason : `${candidate.scoreReason}_${reasonSuffix}`,
      };
    })
    .sort((a, b) => b.rankScore - a.rankScore);
};

export const buildRankingMetrics = (
  rankedCandidates: ReturnType<typeof applyFiltersAndRank>,
  preferences: FeedPreferences,
  limit = 20,
): RankingMetrics => {
  const top = rankedCandidates.slice(0, Math.max(1, limit));
  const scoreReason: Record<string, number> = {};
  let local = 0;
  let nonLocal = 0;
  let same = 0;
  let cross = 0;
  let crossRussianPair = 0;
  const requestedCity = preferences.launchCity ? normalizeTag(preferences.launchCity) : null;
  const requestedCountry = preferences.originCountry ?? null;

  for (const candidate of top) {
    scoreReason[candidate.scoreReason] = (scoreReason[candidate.scoreReason] ?? 0) + 1;

    if (requestedCity) {
      if (normalizeTag(candidate.city) === requestedCity) local += 1;
      else nonLocal += 1;
    }

    if (requestedCountry) {
      const candidateCountry = normalizeKey(candidate.originCountry);
      if (candidateCountry === requestedCountry) {
        same += 1;
      } else {
        cross += 1;
        const userIsRussian = requestedCountry === "russian";
        const candidateIsRussian = candidateCountry === "russian";
        if (userIsRussian !== candidateIsRussian) crossRussianPair += 1;
      }
    }
  }

  return {
    topN: top.length,
    scoreReason,
    city: { local, nonLocal },
    nationality: { same, cross, crossRussianPair },
  };
};
