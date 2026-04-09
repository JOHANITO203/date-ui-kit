import type { AuthResponse, SessionPayload } from '../contracts';

const AUTH_BFF_URL = (import.meta.env.VITE_AUTH_BFF_URL as string | undefined)?.replace(/\/$/, '') ?? 'http://localhost:8787';
const UPLOAD_IMAGE_MAX_EDGE = 1440;
const UPLOAD_IMAGE_TARGET_MAX_BYTES = 1_200_000;

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }
      reject(new Error('read_result_invalid'));
    };
    reader.onerror = () => reject(new Error('file_read_failed'));
    reader.readAsDataURL(file);
  });

const loadImageFromBlob = (blob: Blob) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('image_decode_failed'));
    };
    image.src = url;
  });

const canvasToBlob = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
  new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });

const optimizeImageForUpload = async (file: File): Promise<File> => {
  if (typeof window === 'undefined' || !file.type.startsWith('image/')) return file;

  try {
    const image = await loadImageFromBlob(file);
    const longestEdge = Math.max(image.width, image.height);
    const scale = longestEdge > UPLOAD_IMAGE_MAX_EDGE ? UPLOAD_IMAGE_MAX_EDGE / longestEdge : 1;
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, 0, 0, width, height);

    const fallbackMimeType = 'image/jpeg';
    const preferredFormats = ['image/avif', 'image/webp', 'image/jpeg'];
    const qualitySteps = [0.86, 0.8, 0.74, 0.68, 0.62];

    const tryEncode = async (mimeType: string, quality: number) => {
      const encoded = await canvasToBlob(canvas, mimeType, quality);
      if (encoded) return encoded;
      if (mimeType !== fallbackMimeType) return canvasToBlob(canvas, fallbackMimeType, quality);
      return null;
    };

    let encoded: Blob | null = null;
    for (const format of preferredFormats) {
      for (const quality of qualitySteps) {
        const candidate = await tryEncode(format, quality);
        if (!candidate) continue;
        encoded = candidate;
        if (candidate.size <= UPLOAD_IMAGE_TARGET_MAX_BYTES) break;
      }
      if (encoded && encoded.size <= UPLOAD_IMAGE_TARGET_MAX_BYTES) break;
    }

    if (!encoded) return file;

    if (encoded.size > UPLOAD_IMAGE_TARGET_MAX_BYTES) {
      for (const quality of [0.58, 0.52, 0.46]) {
        const candidate = await tryEncode(encoded.type || fallbackMimeType, quality);
        if (!candidate) continue;
        encoded = candidate;
        if (encoded.size <= UPLOAD_IMAGE_TARGET_MAX_BYTES) break;
      }
    }

    if (encoded.size >= file.size * 0.98 && file.size <= UPLOAD_IMAGE_TARGET_MAX_BYTES) {
      return file;
    }

    const extension =
      encoded.type === 'image/avif'
        ? 'avif'
        : encoded.type === 'image/webp'
          ? 'webp'
          : encoded.type === 'image/png'
            ? 'png'
            : 'jpg';
    const safeBaseName = file.name.replace(/\.[^/.]+$/, '');
    return new File([encoded], `${safeBaseName}.${extension}`, {
      type: encoded.type,
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
};

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

  refreshInternalToken() {
    return request<{ token: string }>('/auth/token/refresh', { method: 'POST' });
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
        bio?: string | null;
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
        visibility?: 'public' | 'limited' | 'hidden' | null;
        hide_age?: boolean | null;
        hide_distance?: boolean | null;
        incognito?: boolean | null;
        read_receipts?: boolean | null;
        shadow_ghost?: boolean | null;
        travel_pass_city?: 'voronezh' | 'moscow' | 'saint-petersburg' | 'sochi' | null;
        phone_country_code?: string | null;
        phone_national_number?: string | null;
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
    bio?: string;
    birth_date?: string;
    intent?: string;
    interests?: string[];
    verified_opt_in?: boolean;
    city?: string;
    settings?: {
      language?: 'en' | 'ru';
      targetLang?: 'en' | 'ru' | 'fr';
      autoTranslate?: boolean;
      autoDetectLanguage?: boolean;
      notificationsEnabled?: boolean;
      preciseLocationEnabled?: boolean;
      visibility?: 'public' | 'limited' | 'hidden';
      hideAge?: boolean;
      hideDistance?: boolean;
      incognito?: boolean;
      readReceipts?: boolean;
      shadowGhost?: boolean;
      travelPassCity?: 'voronezh' | 'moscow' | 'saint-petersburg' | 'sochi';
      phoneCountryCode?: string;
      phoneNationalNumber?: string;
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
        bio?: string | null;
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
        visibility?: 'public' | 'limited' | 'hidden' | null;
        hide_age?: boolean | null;
        hide_distance?: boolean | null;
        incognito?: boolean | null;
        read_receipts?: boolean | null;
        shadow_ghost?: boolean | null;
        travel_pass_city?: 'voronezh' | 'moscow' | 'saint-petersburg' | 'sochi' | null;
        phone_country_code?: string | null;
        phone_national_number?: string | null;
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
      (async () => {
        const optimized = await optimizeImageForUpload(file);
        const dataUrl = await readFileAsDataUrl(optimized);
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
            mimeType: optimized.type || file.type || 'application/octet-stream',
            base64Data,
          }),
        });
        resolve(payload);
      })().catch(() => {
        resolve({
          ok: false,
          code: 'PHOTO_READ_FAILED',
          message: 'Unable to read photo file.',
          fallback: ['login_with_google'],
        });
      });
    });
  },

  deleteProfilePhoto(photoId: string) {
    return request<{ removed: boolean }>(`/profiles/photos/${photoId}`, {
      method: 'DELETE',
    });
  },

  submitKycSelfie(file: File) {
    return new Promise<AuthResponse<{
      submissionId: string;
      status: 'pending' | 'approved' | 'rejected';
      submittedAt: string;
      verifiedOptIn: boolean;
    }>>((resolve) => {
      (async () => {
        const optimized = await optimizeImageForUpload(file);
        const dataUrl = await readFileAsDataUrl(optimized);
        const base64Data = dataUrl.includes(',') ? dataUrl.split(',')[1] ?? '' : '';
        const payload = await request<{
          submissionId: string;
          status: 'pending' | 'approved' | 'rejected';
          submittedAt: string;
          verifiedOptIn: boolean;
        }>('/profiles/kyc/selfie', {
          method: 'POST',
          body: JSON.stringify({
            mimeType: optimized.type || file.type || 'application/octet-stream',
            base64Data,
            captureMode: 'front_camera',
          }),
        });
        resolve(payload);
      })().catch(() => {
        resolve({
          ok: false,
          code: 'KYC_SELFIE_READ_FAILED',
          message: 'Unable to read selfie file.',
          fallback: ['login_with_google'],
        });
      });
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
