export const ONBOARDING_DRAFT_STORAGE_KEY = 'exotic.onboarding.draft.v1';
const ONBOARDING_DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const ONBOARDING_PROFILE_SNAPSHOT_STORAGE_KEY = 'exotic.onboarding.profile-snapshot.v1';

type OnboardingDraftForm = {
  firstName?: unknown;
  birthDate?: unknown;
  city?: unknown;
  intent?: unknown;
  interests?: unknown;
  verifyNow?: unknown;
};

type OnboardingDraftPayload = {
  form?: OnboardingDraftForm;
  updatedAtIso?: unknown;
};

type OnboardingProfileSnapshot = {
  firstName?: string;
  city?: string;
  bio?: string;
  intent?: string;
  interests?: string[];
  birthDate?: string;
  verifyNow?: boolean;
  updatedAtIso?: string;
};

type ProfileLike = {
  first_name?: string | null;
  city?: string | null;
  bio?: string | null;
  intent?: string | null;
  interests?: string[] | null;
  birth_date?: string | null;
  verified_opt_in?: boolean | null;
};

type SessionProfileLike = Record<string, unknown> | null | undefined;

export type HydratedProfileSeed = {
  firstName: string;
  city: string;
  bio: string;
  interests: string[];
  birthDate: string;
  verifiedOptIn: boolean;
};

const safeTrim = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const safeStringArray = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0).map((entry) => entry.trim())
    : [];

const readOnboardingDraft = (): OnboardingDraftForm | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(ONBOARDING_DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OnboardingDraftPayload;
    if (!parsed || typeof parsed !== 'object') return null;

    const updatedAtMs = new Date(String(parsed.updatedAtIso ?? '')).getTime();
    if (!Number.isFinite(updatedAtMs)) return null;
    if (Date.now() - updatedAtMs > ONBOARDING_DRAFT_TTL_MS) return null;

    return parsed.form ?? null;
  } catch {
    return null;
  }
};

const readOnboardingProfileSnapshot = (): OnboardingProfileSnapshot | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(ONBOARDING_PROFILE_SNAPSHOT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OnboardingProfileSnapshot;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
};

export const getOnboardingProfileSnapshot = () => {
  const snapshot = readOnboardingProfileSnapshot();
  if (!snapshot) return null;
  return {
    firstName: safeTrim(snapshot.firstName),
    city: safeTrim(snapshot.city),
    bio: safeTrim(snapshot.bio),
    intent: safeTrim(snapshot.intent),
    interests: safeStringArray(snapshot.interests),
    birthDate: safeTrim(snapshot.birthDate),
    verifyNow: snapshot.verifyNow === true,
  };
};

export const saveOnboardingProfileSnapshot = (payload: {
  firstName?: string;
  city?: string;
  bio?: string;
  intent?: string;
  interests?: string[];
  birthDate?: string;
  verifyNow?: boolean;
}) => {
  if (typeof window === 'undefined') return;
  const current = readOnboardingProfileSnapshot() ?? {};
  const snapshot: OnboardingProfileSnapshot = {
    ...current,
    ...payload,
    updatedAtIso: new Date().toISOString(),
  };
  window.localStorage.setItem(
    ONBOARDING_PROFILE_SNAPSHOT_STORAGE_KEY,
    JSON.stringify(snapshot),
  );
};

export const clearOnboardingProfileSnapshot = () => {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(ONBOARDING_PROFILE_SNAPSHOT_STORAGE_KEY);
};

export const clearOnboardingDraft = () => {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(ONBOARDING_DRAFT_STORAGE_KEY);
};

export const hydrateProfileSeed = (
  apiProfile: ProfileLike | null | undefined,
  sessionProfile: SessionProfileLike,
  options: { allowOnboardingFallback?: boolean } = {},
): HydratedProfileSeed => {
  const { allowOnboardingFallback = true } = options;
  const draft = allowOnboardingFallback ? readOnboardingDraft() : null;
  const snapshot = allowOnboardingFallback ? readOnboardingProfileSnapshot() : null;
  const session = (sessionProfile ?? {}) as Record<string, unknown>;

  const firstName =
    safeTrim(apiProfile?.first_name) ||
    safeTrim(snapshot?.firstName) ||
    safeTrim(draft?.firstName) ||
    safeTrim(session.first_name) ||
    safeTrim(session.given_name) ||
    safeTrim(session.name);

  const city = safeTrim(apiProfile?.city) || safeTrim(snapshot?.city) || safeTrim(draft?.city);
  const bio =
    safeTrim(apiProfile?.bio) ||
    safeTrim(snapshot?.bio) ||
    safeTrim(apiProfile?.intent) ||
    safeTrim(snapshot?.intent) ||
    safeTrim(draft?.intent);

  const interestsFromApi = safeStringArray(apiProfile?.interests);
  const interestsFromSnapshot = safeStringArray(snapshot?.interests);
  const interestsFromDraft = safeStringArray(draft?.interests);
  const interests =
    interestsFromApi.length > 0
      ? interestsFromApi
      : interestsFromSnapshot.length > 0
        ? interestsFromSnapshot
        : interestsFromDraft;

  const birthDate =
    safeTrim(apiProfile?.birth_date) ||
    safeTrim(snapshot?.birthDate) ||
    safeTrim(draft?.birthDate);
  const verifiedOptIn =
    apiProfile?.verified_opt_in === true ||
    snapshot?.verifyNow === true ||
    draft?.verifyNow === true;

  return {
    firstName,
    city,
    bio,
    interests,
    birthDate,
    verifiedOptIn,
  };
};
