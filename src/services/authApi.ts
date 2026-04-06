import type { AuthResponse, SessionPayload } from '../contracts';

const AUTH_BFF_URL = (import.meta.env.VITE_AUTH_BFF_URL as string | undefined)?.replace(/\/$/, '') ?? 'http://127.0.0.1:8787';

const request = async <T>(
  path: string,
  init?: RequestInit,
): Promise<AuthResponse<T>> => {
  const response = await fetch(`${AUTH_BFF_URL}${path}`, {
    credentials: 'include',
    headers:
      init?.body instanceof FormData
        ? { ...(init?.headers ?? {}) }
        : {
            'Content-Type': 'application/json',
            ...(init?.headers ?? {}),
          },
    ...init,
  });

  const payload = (await response.json()) as AuthResponse<T>;
  return payload;
};

export const authApi = {
  getBaseUrl() {
    return AUTH_BFF_URL;
  },

  getGoogleStartUrl(next = '/discover', redirectUrl = '/login/methods') {
    const params = new URLSearchParams({
      next,
      redirect_url: redirectUrl,
    });
    return `${AUTH_BFF_URL}/auth/google/start?${params.toString()}`;
  },

  getSession() {
    return request<SessionPayload>('/auth/session', { method: 'GET' });
  },

  loginWithPassword(email: string, password: string) {
    return request('/auth/email/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  signUpWithPassword(email: string, password: string) {
    return request('/auth/email/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  sendMagicLink(email: string, from?: string) {
    return request('/auth/email/magic', {
      method: 'POST',
      body: JSON.stringify({ email, from }),
    });
  },

  resendVerification(email: string) {
    return request('/auth/email/resend', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  verifyEmailToken(tokenHash: string, type: 'magiclink' | 'signup' | 'email' = 'magiclink') {
    return request('/auth/email/verify', {
      method: 'POST',
      body: JSON.stringify({
        token_hash: tokenHash,
        type,
      }),
    });
  },

  getProfileMe() {
    return request<{
      profile: {
        first_name?: string | null;
        last_name?: string | null;
        locale?: string | null;
        birth_date?: string | null;
        gender?: string | null;
        city?: string | null;
        origin_country?: string | null;
        languages?: string[] | null;
        intent?: string | null;
        interests?: string[] | null;
        photos_count?: number | null;
        verified_opt_in?: boolean | null;
        onboarding_version?: string | null;
      } | null;
      settings: {
        language?: 'en' | 'ru' | null;
        target_lang?: 'en' | 'ru' | 'fr' | null;
        auto_translate?: boolean | null;
        auto_detect_language?: boolean | null;
        notifications_enabled?: boolean | null;
        precise_location_enabled?: boolean | null;
        distance_km?: number | null;
        age_min?: number | null;
        age_max?: number | null;
        gender_preference?: 'everyone' | 'women' | 'men' | null;
      } | null;
    }>('/profiles/me', { method: 'GET' });
  },

  patchProfileMe(payload: {
    first_name?: string;
    last_name?: string;
    locale?: string;
    settings?: {
      language?: 'en' | 'ru';
      targetLang?: 'en' | 'ru' | 'fr';
      autoTranslate?: boolean;
      autoDetectLanguage?: boolean;
      notificationsEnabled?: boolean;
      preciseLocationEnabled?: boolean;
      distanceKm?: number;
      ageMin?: number;
      ageMax?: number;
      genderPreference?: 'everyone' | 'women' | 'men';
    };
  }) {
    return request<{
      profile: {
        first_name?: string | null;
        last_name?: string | null;
        locale?: string | null;
        birth_date?: string | null;
        gender?: string | null;
        city?: string | null;
        origin_country?: string | null;
        languages?: string[] | null;
        intent?: string | null;
        interests?: string[] | null;
        photos_count?: number | null;
        verified_opt_in?: boolean | null;
        onboarding_version?: string | null;
      } | null;
      settings: {
        language?: 'en' | 'ru' | null;
        target_lang?: 'en' | 'ru' | 'fr' | null;
        auto_translate?: boolean | null;
        auto_detect_language?: boolean | null;
        notifications_enabled?: boolean | null;
        precise_location_enabled?: boolean | null;
        distance_km?: number | null;
        age_min?: number | null;
        age_max?: number | null;
        gender_preference?: 'everyone' | 'women' | 'men' | null;
      } | null;
    }>('/profiles/me', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  getProfilePhotos() {
    return request<{
      photos: Array<{
        id: string;
        path: string;
        url: string | null;
        sort_order: number;
        is_primary: boolean;
        created_at: string;
      }>;
    }>('/profiles/photos', { method: 'GET' });
  },

  uploadProfilePhoto(file: File) {
    return new Promise<AuthResponse<{
      photo: {
        id: string;
        path: string;
        url: string | null;
        sort_order: number;
        is_primary: boolean;
        created_at: string;
      };
    }>>((resolve) => {
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = typeof reader.result === 'string' ? reader.result : '';
        const base64Data = dataUrl.includes(',') ? dataUrl.split(',')[1] ?? '' : '';
        const payload = await request<{
          photo: {
            id: string;
            path: string;
            url: string | null;
            sort_order: number;
            is_primary: boolean;
            created_at: string;
          };
        }>('/profiles/photos', {
          method: 'POST',
          body: JSON.stringify({
            mimeType: file.type || 'application/octet-stream',
            base64Data,
          }),
        });
        resolve(payload);
      };
      reader.onerror = () => {
        resolve({
          ok: false,
          code: 'PHOTO_READ_FAILED',
          message: 'Unable to read photo file.',
          fallback: ['login_with_google'],
        });
      };
      reader.readAsDataURL(file);
    });
  },

  deleteProfilePhoto(photoId: string) {
    return request<{ removed: boolean }>(`/profiles/photos/${photoId}`, {
      method: 'DELETE',
    });
  },

  completeOnboarding(payload: {
    version: 'v1';
    firstName: string;
    locale: 'en' | 'ru';
    birthDate: string;
    gender: 'homme' | 'femme' | 'autre';
    city: string;
    originCountry: string;
    languages: string[];
    intent: 'serieuse' | 'connexion' | 'decouverte' | 'verrai';
    interests: string[];
    photosCount: number;
    verifyNow: boolean;
    lookingFor: 'hommes' | 'femmes' | 'tous';
    ageMin: number;
    ageMax: number;
    distanceKm: number;
    targetLang: 'fr' | 'en' | 'ru';
    autoTranslate: boolean;
    autoDetectLanguage: boolean;
    notifications: boolean;
    preciseLocation: boolean;
  }) {
    return request('/onboarding/complete', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  logout() {
    return request('/auth/logout', { method: 'POST' });
  },
};
