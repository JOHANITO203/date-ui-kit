import type {
  FeedQuickFilter,
  GetFeedResponse,
  GetReceivedLikesResponse,
  ActivateBoostResponse,
  BoostStatus,
  RewindResponse,
  SendMessageRequest,
  SendMessageResponse,
  SwipeDecision,
  SwipeResponse,
  TranslationToggleRequest,
  TranslationToggleResponse,
  ConversationSummary,
  ChatMessage,
  SettingsEnvelope,
  PatchSettingsRequest,
  UpdateConversationRelationStateRequest,
  UpdateConversationRelationStateResponse,
  GetPaymentsCatalogResponse,
  CreateCheckoutRequest,
  CreateCheckoutResponse,
  GetCheckoutStatusRequest,
  GetCheckoutStatusResponse,
  EntitlementSnapshot,
  ProfileMeData,
  PatchProfileMeRequest,
  GetBlocksResponse,
  BlockUserResponse,
  UnblockUserResponse,
  ReportUserRequest,
  ReportUserResponse,
} from '../contracts';
import { runtimeApi } from '../state';
import { authApi } from './authApi';

const DISCOVER_API_URL = (import.meta.env.VITE_DISCOVER_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';
const CHAT_API_URL = (import.meta.env.VITE_CHAT_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';
const PAYMENTS_API_URL = (import.meta.env.VITE_PAYMENTS_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';
const SAFETY_API_URL = (import.meta.env.VITE_SAFETY_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';

const withLatency = async <T>(value: T, delayMs = 120): Promise<T> => {
  await new Promise((resolve) => window.setTimeout(resolve, delayMs));
  return value;
};

type FeedIntent = 'serieuse' | 'connexion' | 'decouverte' | 'verrai';
type FeedSignals = {
  intent: FeedIntent | null;
  interests: string[];
  preciseLocationEnabled: boolean | null;
  launchCity: string | null;
  originCountry: string | null;
  userLanguages: string[];
};

let cachedFeedSignals: FeedSignals = {
  intent: null,
  interests: [],
  preciseLocationEnabled: null,
  launchCity: null,
  originCountry: null,
  userLanguages: [],
};
let cachedFeedSignalsFetchedAt = 0;
const FEED_SIGNALS_CACHE_TTL_MS = 5 * 60 * 1000;
const PRECISE_GEO_CACHE_TTL_MS = 2 * 60 * 1000;
let cachedGeoPosition: { lat: number; lng: number; fetchedAt: number } | null = null;
let cachedInternalToken: { value: string; fetchedAt: number } | null = null;
let pendingInternalTokenPromise: Promise<string> | null = null;
const INTERNAL_TOKEN_CACHE_TTL_MS = 30 * 1000;
const CONVERSATION_RELATION_EVENT = 'exotic:conversation-relation-state';

export type ConversationRelationEventDetail = {
  conversationId: string;
  state: ConversationSummary['relationState'];
};

const invalidateFeedSignalsCache = () => {
  cachedFeedSignals = {
    intent: null,
    interests: [],
    preciseLocationEnabled: null,
    launchCity: null,
    originCountry: null,
    userLanguages: [],
  };
  cachedFeedSignalsFetchedAt = 0;
};

const getFeedSignals = async (): Promise<FeedSignals> => {
  const now = Date.now();
  if (cachedFeedSignalsFetchedAt > 0 && now - cachedFeedSignalsFetchedAt < FEED_SIGNALS_CACHE_TTL_MS) {
    return cachedFeedSignals;
  }

  const response = await authApi.getProfileMe();
  if (response.ok !== true) {
    cachedFeedSignals = {
      intent: null,
      interests: [],
      preciseLocationEnabled: null,
      launchCity: null,
      originCountry: null,
      userLanguages: [],
    };
    cachedFeedSignalsFetchedAt = now;
    return cachedFeedSignals;
  }

  const intent = response.data?.profile?.intent;
  const resolvedIntent: FeedIntent | null =
    intent === 'serieuse' || intent === 'connexion' || intent === 'decouverte' || intent === 'verrai'
      ? intent
      : null;
  const interests = Array.isArray(response.data?.profile?.interests)
    ? response.data?.profile?.interests.filter((value): value is string => typeof value === 'string' && value.length > 0)
    : [];
  const preciseLocationEnabled =
    typeof response.data?.settings?.precise_location_enabled === 'boolean'
      ? response.data.settings.precise_location_enabled
      : null;
  const launchCity =
    typeof response.data?.profile?.city === 'string' && response.data.profile.city.trim().length > 0
      ? response.data.profile.city.trim()
      : null;
  const originCountry =
    typeof response.data?.profile?.origin_country === 'string' &&
    response.data.profile.origin_country.trim().length > 0
      ? response.data.profile.origin_country.trim()
      : null;
  const userLanguages = Array.isArray(response.data?.profile?.languages)
    ? response.data.profile.languages.filter(
        (value): value is string => typeof value === 'string' && value.trim().length > 0,
      )
    : [];

  cachedFeedSignals = {
    intent: resolvedIntent,
    interests,
    preciseLocationEnabled,
    launchCity,
    originCountry,
    userLanguages,
  };
  cachedFeedSignalsFetchedAt = now;
  return cachedFeedSignals;
};

const getPreciseGeoPoint = async (enabled: boolean): Promise<{ lat: number; lng: number } | null> => {
  if (!enabled) return null;
  if (typeof window === 'undefined' || !('geolocation' in navigator)) return null;

  const now = Date.now();
  if (cachedGeoPosition && now - cachedGeoPosition.fetchedAt < PRECISE_GEO_CACHE_TTL_MS) {
    return { lat: cachedGeoPosition.lat, lng: cachedGeoPosition.lng };
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const point = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        cachedGeoPosition = {
          ...point,
          fetchedAt: Date.now(),
        };
        resolve(point);
      },
      () => resolve(null),
      {
        enableHighAccuracy: true,
        timeout: 4500,
        maximumAge: PRECISE_GEO_CACHE_TTL_MS,
      },
    );
  });
};

const discoverRequest = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const internalToken = await resolveInternalToken();
  const response = await fetch(`${DISCOVER_API_URL}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${internalToken}`,
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      cachedInternalToken = null;
    }
    throw new Error(`discover_request_failed_${response.status}`);
  }

  return response.json() as Promise<T>;
};

const resolveInternalToken = async (): Promise<string> => {
  const now = Date.now();
  if (cachedInternalToken && now - cachedInternalToken.fetchedAt < INTERNAL_TOKEN_CACHE_TTL_MS) {
    return cachedInternalToken.value;
  }

  if (pendingInternalTokenPromise) return pendingInternalTokenPromise;

  pendingInternalTokenPromise = (async () => {
    const session = await authApi.getSession();
    if (session.ok && session.data?.authenticated && session.data.token) {
      cachedInternalToken = { value: session.data.token, fetchedAt: Date.now() };
      return session.data.token;
    }

    const refresh = await authApi.refreshInternalToken();
    if (refresh.ok && refresh.data?.token) {
      cachedInternalToken = { value: refresh.data.token, fetchedAt: Date.now() };
      return refresh.data.token;
    }

    throw new Error('internal_token_unavailable');
  })().finally(() => {
    pendingInternalTokenPromise = null;
  });

  return pendingInternalTokenPromise;
};

const serviceRequest = async <T>(baseUrl: string, path: string, init?: RequestInit): Promise<T> => {
  const internalToken = await resolveInternalToken();
  const response = await fetch(`${baseUrl}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${internalToken}`,
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      cachedInternalToken = null;
    }
    throw new Error(`service_request_failed_${response.status}`);
  }

  return response.json() as Promise<T>;
};

const chatRequest = async <T>(path: string, init?: RequestInit): Promise<T> =>
  serviceRequest<T>(CHAT_API_URL, path, init);

const paymentsRequest = async <T>(path: string, init?: RequestInit): Promise<T> => {
  return serviceRequest<T>(PAYMENTS_API_URL, path, init);
};

const safetyRequest = async <T>(path: string, init?: RequestInit): Promise<T> => {
  return serviceRequest<T>(SAFETY_API_URL, path, init);
};

const shouldFallbackToRuntime = (error: unknown) => {
  if (error instanceof TypeError) {
    return true;
  }

  if (!(error instanceof Error)) {
    return true;
  }

  const statusMatch = error.message.match(/_failed_(\d{3})/);
  if (!statusMatch) return true;
  const statusCode = Number(statusMatch[1]);
  if (!Number.isFinite(statusCode)) return true;

  // Fallback is only for infra/service availability issues.
  return statusCode >= 500;
};

const syncRuntimeSettingsFromAuthProfile = (
  payload: ProfileMeData | undefined,
) => {
  if (!payload) return;

  const nextPatch: PatchSettingsRequest['patch'] = {};
  const preferencesPatch: PatchSettingsRequest['patch']['preferences'] = {};

  if (payload.settings?.language) preferencesPatch.language = payload.settings.language;
  if (typeof payload.settings?.distance_km === 'number') preferencesPatch.distanceKm = payload.settings.distance_km;
  if (typeof payload.settings?.age_min === 'number') preferencesPatch.ageMin = payload.settings.age_min;
  if (typeof payload.settings?.age_max === 'number') preferencesPatch.ageMax = payload.settings.age_max;
  if (payload.settings?.gender_preference) preferencesPatch.genderPreference = payload.settings.gender_preference;

  if (Object.keys(preferencesPatch).length > 0) {
    nextPatch.preferences = preferencesPatch;
  }

  if (typeof payload.settings?.notifications_enabled === 'boolean') {
    nextPatch.notifications = {
      matches: payload.settings.notifications_enabled,
      messages: payload.settings.notifications_enabled,
      likes: payload.settings.notifications_enabled,
      offers: payload.settings.notifications_enabled,
    };
  }

  if (typeof payload.settings?.auto_detect_language === 'boolean' || payload.settings?.target_lang) {
    nextPatch.translation = {
      autoDetectEnabled:
        typeof payload.settings?.auto_detect_language === 'boolean'
          ? payload.settings.auto_detect_language
          : runtimeApi.getSettingsEnvelope().settings.translation.autoDetectEnabled,
      targetLocale:
        payload.settings?.target_lang === 'ru'
          ? 'ru'
          : 'en',
    };
  }

  if (payload.settings?.visibility) {
    nextPatch.privacy = {
      ...(nextPatch.privacy ?? {}),
      visibility: payload.settings.visibility,
    };
  }
  if (typeof payload.settings?.hide_age === 'boolean') {
    nextPatch.privacy = {
      ...(nextPatch.privacy ?? {}),
      hideAge: payload.settings.hide_age,
    };
  }
  if (typeof payload.settings?.hide_distance === 'boolean') {
    nextPatch.privacy = {
      ...(nextPatch.privacy ?? {}),
      hideDistance: payload.settings.hide_distance,
    };
  }
  if (typeof payload.settings?.precise_location_enabled === 'boolean') {
    nextPatch.privacy = {
      ...(nextPatch.privacy ?? {}),
      preciseLocation: payload.settings.precise_location_enabled,
    };
  }
  if (typeof payload.settings?.incognito === 'boolean') {
    nextPatch.privacy = {
      ...(nextPatch.privacy ?? {}),
      incognito: payload.settings.incognito,
    };
  }
  if (typeof payload.settings?.read_receipts === 'boolean') {
    nextPatch.privacy = {
      ...(nextPatch.privacy ?? {}),
      readReceipts: payload.settings.read_receipts,
    };
  }
  if (typeof payload.settings?.shadow_ghost === 'boolean') {
    nextPatch.privacy = {
      ...(nextPatch.privacy ?? {}),
      shadowGhost: payload.settings.shadow_ghost,
    };
  }
  if (payload.settings && Object.prototype.hasOwnProperty.call(payload.settings, 'travel_pass_city')) {
    nextPatch.preferences = {
      ...(nextPatch.preferences ?? {}),
      travelPassCity: payload.settings.travel_pass_city ?? undefined,
    };
  }
  if (payload.settings?.phone_country_code || payload.settings?.phone_national_number) {
    const code = payload.settings.phone_country_code ?? '';
    const national = payload.settings.phone_national_number ?? '';
    nextPatch.account = {
      ...(nextPatch.account ?? {}),
      phone: `${code}${national}`.trim(),
    };
  }

  if (Object.keys(nextPatch).length > 0) {
    runtimeApi.patchSettings({ patch: nextPatch });
    invalidateFeedSignalsCache();
  }
};

const emitConversationRelationChange = (detail: ConversationRelationEventDetail) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<ConversationRelationEventDetail>(CONVERSATION_RELATION_EVENT, {
      detail,
    }),
  );
};

export const subscribeConversationRelationChange = (
  listener: (detail: ConversationRelationEventDetail) => void,
) => {
  if (typeof window === 'undefined') return () => {};
  const handler = (event: Event) => {
    const custom = event as CustomEvent<ConversationRelationEventDetail>;
    if (!custom.detail) return;
    listener(custom.detail);
  };
  window.addEventListener(CONVERSATION_RELATION_EVENT, handler as EventListener);
  return () => {
    window.removeEventListener(CONVERSATION_RELATION_EVENT, handler as EventListener);
  };
};

export const appApi = {
  async getFeed(quickFilters: FeedQuickFilter[]): Promise<GetFeedResponse> {
    if (DISCOVER_API_URL) {
      try {
        const preferences = runtimeApi.getSettingsEnvelope().settings.preferences;
        const settingsEnvelope = runtimeApi.getSettingsEnvelope();
        const feedSignals = await getFeedSignals().catch<FeedSignals>(() => ({
          intent: null,
          interests: [],
          preciseLocationEnabled: null,
          launchCity: null,
          originCountry: null,
          userLanguages: [],
        }));
        const preciseLocationEnabled =
          feedSignals.preciseLocationEnabled ?? settingsEnvelope.settings.privacy.preciseLocation;
        const preciseGeoPoint = await getPreciseGeoPoint(preciseLocationEnabled).catch(() => null);
        const query = new URLSearchParams({
          quickFilters: quickFilters.join(','),
          ageMin: String(preferences.ageMin),
          ageMax: String(preferences.ageMax),
          distanceKm: String(preferences.distanceKm),
          genderPreference: preferences.genderPreference,
        });
        if (feedSignals.intent) {
          query.set('intent', feedSignals.intent);
        }
        if (feedSignals.interests.length > 0) {
          query.set('interests', feedSignals.interests.join(','));
        }
        if (feedSignals.launchCity) {
          query.set('launchCity', feedSignals.launchCity);
        }
        if (feedSignals.originCountry) {
          query.set('originCountry', feedSignals.originCountry);
        }
        if (feedSignals.userLanguages.length > 0) {
          query.set('userLanguages', feedSignals.userLanguages.join(','));
        }
        if (preciseGeoPoint) {
          query.set('lat', String(preciseGeoPoint.lat));
          query.set('lng', String(preciseGeoPoint.lng));
        }
        return await discoverRequest<GetFeedResponse>(`/discover/feed?${query.toString()}`);
      } catch (error) {
        if (!shouldFallbackToRuntime(error)) throw error;
        // Fallback keeps app usable during service rollout.
      }
    }
    return withLatency(runtimeApi.getFeed(quickFilters));
  },

  markProfileImpression(profileId: string): void {
    runtimeApi.markProfileImpression(profileId);
  },

  async swipe(profileId: string, decision: SwipeDecision, feedCursor?: string): Promise<SwipeResponse> {
    if (DISCOVER_API_URL) {
      try {
        return await discoverRequest<SwipeResponse>('/discover/swipe', {
          method: 'POST',
          body: JSON.stringify({
            profileId,
            decision,
            feedCursor: feedCursor ?? `feed-${Date.now()}`,
          }),
        });
      } catch (error) {
        if (!shouldFallbackToRuntime(error)) throw error;
        // Fallback keeps swipe flow available while service stabilizes.
      }
    }
    return withLatency(runtimeApi.swipe(profileId, decision), 80);
  },

  rewind(feedCursor?: string): Promise<RewindResponse> {
    if (DISCOVER_API_URL) {
      return discoverRequest<RewindResponse>('/discover/rewind', {
        method: 'POST',
        body: JSON.stringify({
          feedCursor: feedCursor ?? `feed-${Date.now()}`,
        }),
      }).catch((error) => {
        if (!shouldFallbackToRuntime(error)) {
          return Promise.reject(error);
        }
        return withLatency(runtimeApi.rewind(), 80);
      });
    }
    return withLatency(runtimeApi.rewind(), 80);
  },

  getBoostStatus(): Promise<BoostStatus> {
    return withLatency(runtimeApi.getBoostStatus(), 40);
  },

  activateBoost(): Promise<ActivateBoostResponse> {
    return withLatency(runtimeApi.activateBoost(), 60);
  },

  getLikes(): Promise<GetReceivedLikesResponse> {
    return withLatency(runtimeApi.getLikes());
  },

  trackLikesPaywallView(): void {
    runtimeApi.trackLikesPaywallView();
  },

  clickLikesPaywall(): void {
    runtimeApi.clickLikesPaywall();
  },

  unlockLikesPreview(): void {
    runtimeApi.unlockLikesPreview();
  },

  getConversations(): Promise<ConversationSummary[]> {
    if (CHAT_API_URL) {
      return chatRequest<{ conversations: ConversationSummary[] }>('/chat/conversations').then(
        (payload) => payload.conversations,
      );
    }
    return withLatency(runtimeApi.getConversations(), 100);
  },

  openChat(profileId: string, fromSuperLike = false): Promise<string> {
    if (CHAT_API_URL) {
      return chatRequest<{ conversationId: string }>('/chat/open', {
        method: 'POST',
        body: JSON.stringify({ profileId, fromSuperLike }),
      }).then((payload) => payload.conversationId);
    }
    return withLatency(runtimeApi.openChat(profileId, fromSuperLike), 60);
  },

  getMessages(conversationId: string): Promise<ChatMessage[]> {
    if (CHAT_API_URL) {
      return chatRequest<{
        conversationId: string;
        messages: ChatMessage[];
        translation?: { enabled: boolean; targetLocale: 'en' | 'ru' };
      }>(`/chat/conversations/${conversationId}/messages`).then((payload) => {
        if (payload.translation) {
          runtimeApi.setTranslationToggle({
            conversationId,
            enabled: payload.translation.enabled,
            targetLocale: payload.translation.targetLocale,
          });
        }
        return payload.messages;
      });
    }
    return withLatency(runtimeApi.getConversationMessages(conversationId), 80);
  },

  markConversationRead(conversationId: string): Promise<{ conversationId: string; markedRead: boolean }> {
    if (CHAT_API_URL) {
      return chatRequest<{ conversationId: string; markedRead: boolean }>(
        `/chat/conversations/${conversationId}/read`,
        {
          method: 'POST',
        },
      );
    }

    return withLatency({ conversationId, markedRead: true }, 40);
  },

  sendMessage(request: SendMessageRequest): Promise<SendMessageResponse> {
    if (CHAT_API_URL) {
      return chatRequest<SendMessageResponse>('/chat/messages', {
        method: 'POST',
        body: JSON.stringify(request),
      });
    }
    return withLatency(runtimeApi.sendMessage(request), 60);
  },

  setConversationRelationState(
    request: UpdateConversationRelationStateRequest,
  ): Promise<UpdateConversationRelationStateResponse> {
    if (CHAT_API_URL) {
      return chatRequest<UpdateConversationRelationStateResponse>('/chat/relation-state', {
        method: 'PATCH',
        body: JSON.stringify(request),
      }).then((payload) => {
        emitConversationRelationChange({
          conversationId: payload.conversationId,
          state: payload.state,
        });
        return payload;
      });
    }
    return withLatency(runtimeApi.setConversationRelationState(request), 50).then((payload) => {
      emitConversationRelationChange({
        conversationId: payload.conversationId,
        state: payload.state,
      });
      return payload;
    });
  },

  setTranslationToggle(request: TranslationToggleRequest): Promise<TranslationToggleResponse> {
    if (CHAT_API_URL) {
      return chatRequest<TranslationToggleResponse>('/chat/translation', {
        method: 'PATCH',
        body: JSON.stringify(request),
      }).then((payload) => {
        runtimeApi.setTranslationToggle(request);
        return payload;
      });
    }
    return withLatency(runtimeApi.setTranslationToggle(request), 40);
  },

  isTranslationEnabled(conversationId: string): boolean {
    return runtimeApi.isTranslationEnabled(conversationId);
  },

  getSettings(): Promise<SettingsEnvelope> {
    return authApi
      .getProfileMe()
      .then((response) => {
        if (response.ok) {
          syncRuntimeSettingsFromAuthProfile(response.data);
        }
        return runtimeApi.getSettingsEnvelope();
      })
      .catch(() => runtimeApi.getSettingsEnvelope())
      .then((payload) => withLatency(payload, 80));
  },

  patchSettings(request: PatchSettingsRequest): Promise<SettingsEnvelope> {
    const localEnvelope = runtimeApi.patchSettings(request);
    invalidateFeedSignalsCache();

    const settingsPatch: {
      language?: 'en' | 'ru';
      targetLang?: 'en' | 'ru' | 'fr';
      autoTranslate?: boolean;
      autoDetectLanguage?: boolean;
      notificationsEnabled?: boolean;
      visibility?: 'public' | 'limited' | 'hidden';
      hideAge?: boolean;
      hideDistance?: boolean;
      preciseLocationEnabled?: boolean;
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
    } = {};

    if (request.patch.preferences?.language) settingsPatch.language = request.patch.preferences.language;
    if (typeof request.patch.preferences?.distanceKm === 'number') settingsPatch.distanceKm = request.patch.preferences.distanceKm;
    if (typeof request.patch.preferences?.ageMin === 'number') settingsPatch.ageMin = request.patch.preferences.ageMin;
    if (typeof request.patch.preferences?.ageMax === 'number') settingsPatch.ageMax = request.patch.preferences.ageMax;
    if (request.patch.preferences?.genderPreference) settingsPatch.genderPreference = request.patch.preferences.genderPreference;
    if (typeof request.patch.translation?.autoDetectEnabled === 'boolean') {
      settingsPatch.autoDetectLanguage = request.patch.translation.autoDetectEnabled;
    }
    if (request.patch.translation?.targetLocale) {
      settingsPatch.targetLang = request.patch.translation.targetLocale;
    }
    if (typeof request.patch.notifications === 'object') {
      const merged = {
        ...runtimeApi.getSettingsEnvelope().settings.notifications,
        ...request.patch.notifications,
      };
      settingsPatch.notificationsEnabled =
        merged.matches || merged.messages || merged.likes || merged.offers;
    }
    if (request.patch.privacy?.visibility) settingsPatch.visibility = request.patch.privacy.visibility;
    if (typeof request.patch.privacy?.hideAge === 'boolean') settingsPatch.hideAge = request.patch.privacy.hideAge;
    if (typeof request.patch.privacy?.hideDistance === 'boolean') settingsPatch.hideDistance = request.patch.privacy.hideDistance;
    if (typeof request.patch.privacy?.preciseLocation === 'boolean') settingsPatch.preciseLocationEnabled = request.patch.privacy.preciseLocation;
    if (typeof request.patch.privacy?.incognito === 'boolean') settingsPatch.incognito = request.patch.privacy.incognito;
    if (typeof request.patch.privacy?.readReceipts === 'boolean') settingsPatch.readReceipts = request.patch.privacy.readReceipts;
    if (typeof request.patch.privacy?.shadowGhost === 'boolean') settingsPatch.shadowGhost = request.patch.privacy.shadowGhost;
    if (request.patch.preferences?.travelPassCity) settingsPatch.travelPassCity = request.patch.preferences.travelPassCity;

    const shouldCallServer = Object.keys(settingsPatch).length > 0;
    if (!shouldCallServer) {
      return withLatency(localEnvelope, 100);
    }

    return authApi
      .patchProfileMe({ settings: settingsPatch })
      .then((response) => {
        if (response.ok) {
          syncRuntimeSettingsFromAuthProfile(response.data);
          invalidateFeedSignalsCache();
          return runtimeApi.getSettingsEnvelope();
        }
        throw new Error('settings_patch_failed');
      })
      .catch((error) => Promise.reject(error))
      .then((payload) => withLatency(payload, 100));
  },

  getProfileMe(): Promise<ProfileMeData> {
    return authApi
      .getProfileMe()
      .then((response) => {
        if (!response.ok) {
          throw new Error('profile_me_failed');
        }

        syncRuntimeSettingsFromAuthProfile(response.data);
        return {
          profile: response.data?.profile
            ? {
                first_name: response.data.profile.first_name ?? null,
                last_name: response.data.profile.last_name ?? null,
                locale: response.data.profile.locale ?? null,
                bio: response.data.profile.bio ?? null,
                city: response.data.profile.city ?? null,
                verified_opt_in: response.data.profile.verified_opt_in ?? null,
              }
            : null,
          settings: response.data?.settings
            ? {
                language: response.data.settings.language ?? null,
                target_lang: response.data.settings.target_lang ?? null,
                auto_translate: response.data.settings.auto_translate ?? null,
                auto_detect_language: response.data.settings.auto_detect_language ?? null,
                precise_location_enabled: response.data.settings.precise_location_enabled ?? null,
                visibility: response.data.settings.visibility ?? null,
                hide_age: response.data.settings.hide_age ?? null,
                hide_distance: response.data.settings.hide_distance ?? null,
                incognito: response.data.settings.incognito ?? null,
                read_receipts: response.data.settings.read_receipts ?? null,
                shadow_ghost: response.data.settings.shadow_ghost ?? null,
                travel_pass_city: response.data.settings.travel_pass_city ?? null,
                phone_country_code: response.data.settings.phone_country_code ?? null,
                phone_national_number: response.data.settings.phone_national_number ?? null,
                distance_km: response.data.settings.distance_km ?? null,
                age_min: response.data.settings.age_min ?? null,
                age_max: response.data.settings.age_max ?? null,
                gender_preference: response.data.settings.gender_preference ?? null,
                notifications_enabled: response.data.settings.notifications_enabled ?? null,
              }
            : null,
        };
      })
      .catch((error) => Promise.reject(error))
      .then((payload) => withLatency(payload));
  },

  patchProfileMe(payload: PatchProfileMeRequest): Promise<ProfileMeData> {
    invalidateFeedSignalsCache();
    if (payload.settings) {
      runtimeApi.patchSettings({
        patch: {
          preferences: {
            language: payload.settings.language,
            distanceKm: payload.settings.distanceKm,
            ageMin: payload.settings.ageMin,
            ageMax: payload.settings.ageMax,
            genderPreference: payload.settings.genderPreference,
          },
        },
      });
    }

    return authApi
      .patchProfileMe({
        first_name: payload.first_name,
        last_name: payload.last_name,
        locale: payload.locale,
        bio: payload.bio,
        city: payload.city,
        settings: payload.settings
          ? {
              language: payload.settings.language,
              targetLang: payload.settings.targetLang,
              autoTranslate: payload.settings.autoTranslate,
              autoDetectLanguage: payload.settings.autoDetectLanguage,
              preciseLocationEnabled: payload.settings.preciseLocationEnabled,
              visibility: payload.settings.visibility,
              hideAge: payload.settings.hideAge,
              hideDistance: payload.settings.hideDistance,
              incognito: payload.settings.incognito,
              readReceipts: payload.settings.readReceipts,
              shadowGhost: payload.settings.shadowGhost,
              travelPassCity: payload.settings.travelPassCity,
              phoneCountryCode: payload.settings.phoneCountryCode,
              phoneNationalNumber: payload.settings.phoneNationalNumber,
              distanceKm: payload.settings.distanceKm,
              ageMin: payload.settings.ageMin,
              ageMax: payload.settings.ageMax,
              genderPreference: payload.settings.genderPreference,
              notificationsEnabled: payload.settings.notificationsEnabled,
            }
          : undefined,
      })
      .then((response) => {
        if (!response.ok) {
          throw new Error('profile_patch_failed');
        }

        syncRuntimeSettingsFromAuthProfile(response.data);
        invalidateFeedSignalsCache();
        return {
          profile: response.data?.profile
            ? {
                first_name: response.data.profile.first_name ?? null,
                last_name: response.data.profile.last_name ?? null,
                locale: response.data.profile.locale ?? null,
                bio: response.data.profile.bio ?? null,
                city: response.data.profile.city ?? null,
                verified_opt_in: response.data.profile.verified_opt_in ?? null,
              }
            : null,
          settings: response.data?.settings
            ? {
                language: response.data.settings.language ?? null,
                target_lang: response.data.settings.target_lang ?? null,
                auto_translate: response.data.settings.auto_translate ?? null,
                auto_detect_language: response.data.settings.auto_detect_language ?? null,
                precise_location_enabled: response.data.settings.precise_location_enabled ?? null,
                visibility: response.data.settings.visibility ?? null,
                hide_age: response.data.settings.hide_age ?? null,
                hide_distance: response.data.settings.hide_distance ?? null,
                incognito: response.data.settings.incognito ?? null,
                read_receipts: response.data.settings.read_receipts ?? null,
                shadow_ghost: response.data.settings.shadow_ghost ?? null,
                travel_pass_city: response.data.settings.travel_pass_city ?? null,
                phone_country_code: response.data.settings.phone_country_code ?? null,
                phone_national_number: response.data.settings.phone_national_number ?? null,
                distance_km: response.data.settings.distance_km ?? null,
                age_min: response.data.settings.age_min ?? null,
                age_max: response.data.settings.age_max ?? null,
                gender_preference: response.data.settings.gender_preference ?? null,
                notifications_enabled: response.data.settings.notifications_enabled ?? null,
              }
            : null,
        };
      })
      .catch((error) => Promise.reject(error))
      .then((result) => withLatency(result));
  },

  getBlockedUsers(): Promise<GetBlocksResponse> {
    if (SAFETY_API_URL) {
      return safetyRequest<GetBlocksResponse>('/safety/blocks');
    }
    return withLatency({ blocks: [] });
  },

  blockUser(userId: string): Promise<BlockUserResponse> {
    if (SAFETY_API_URL) {
      return safetyRequest<BlockUserResponse>('/safety/blocks', {
        method: 'POST',
        body: JSON.stringify({ userId }),
      });
    }
    return withLatency({
      status: 'blocked',
      block: {
        blockedUserId: userId,
        createdAtIso: new Date().toISOString(),
      },
    });
  },

  unblockUser(userId: string): Promise<UnblockUserResponse> {
    if (SAFETY_API_URL) {
      return safetyRequest<UnblockUserResponse>(`/safety/blocks/${userId}`, {
        method: 'DELETE',
      });
    }
    return withLatency({ status: 'noop', userId });
  },

  reportUser(payload: ReportUserRequest): Promise<ReportUserResponse> {
    if (SAFETY_API_URL) {
      return safetyRequest<ReportUserResponse>('/safety/reports', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    }

    return withLatency({
      status: 'reported',
      report: {
        id: `rep-${Date.now()}`,
        reportedUserId: payload.userId,
        reason: payload.reason,
        note: payload.note,
        createdAtIso: new Date().toISOString(),
      },
    });
  },

  getPaymentsCatalog(): Promise<GetPaymentsCatalogResponse> {
    if (!PAYMENTS_API_URL) {
      return Promise.resolve({
        offers: [],
        pspMode: 'mock',
      });
    }
    return paymentsRequest<GetPaymentsCatalogResponse>('/payments/catalog');
  },

  createCheckout(request: CreateCheckoutRequest): Promise<CreateCheckoutResponse> {
    if (!PAYMENTS_API_URL) {
      return Promise.reject(new Error('payments_api_not_configured'));
    }

    return paymentsRequest<CreateCheckoutResponse>('/payments/checkout', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  getCheckoutStatus(request: GetCheckoutStatusRequest): Promise<GetCheckoutStatusResponse> {
    if (!PAYMENTS_API_URL) {
      return Promise.resolve({
        checkoutId: request.checkoutId,
        status: 'not_found',
        attributed: false,
      });
    }

    return paymentsRequest<GetCheckoutStatusResponse>('/payments/checkout/status', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  getEntitlements(): Promise<{ userId: string; entitlementSnapshot: EntitlementSnapshot | null }> {
    if (!PAYMENTS_API_URL) {
      return Promise.resolve({
        userId: 'me',
        entitlementSnapshot: null,
      });
    }
    return paymentsRequest<{ userId: string; entitlementSnapshot: EntitlementSnapshot | null }>(
      '/entitlements/me',
    );
  },

  applyEntitlementSnapshot(snapshot: EntitlementSnapshot): Promise<SettingsEnvelope> {
    return withLatency(runtimeApi.applyEntitlementSnapshot(snapshot), 40);
  },
};
