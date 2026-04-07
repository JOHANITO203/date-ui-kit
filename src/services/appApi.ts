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
const PROFILE_API_URL = (import.meta.env.VITE_PROFILE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';
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
};

let cachedFeedSignals: FeedSignals = { intent: null, interests: [], preciseLocationEnabled: null };
let cachedFeedSignalsFetchedAt = 0;
const FEED_SIGNALS_CACHE_TTL_MS = 5 * 60 * 1000;
const PRECISE_GEO_CACHE_TTL_MS = 2 * 60 * 1000;
let cachedGeoPosition: { lat: number; lng: number; fetchedAt: number } | null = null;

const getFeedSignals = async (): Promise<FeedSignals> => {
  const now = Date.now();
  if (cachedFeedSignalsFetchedAt > 0 && now - cachedFeedSignalsFetchedAt < FEED_SIGNALS_CACHE_TTL_MS) {
    return cachedFeedSignals;
  }

  const response = await authApi.getProfileMe();
  if (response.ok !== true) {
    cachedFeedSignals = { intent: null, interests: [], preciseLocationEnabled: null };
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

  cachedFeedSignals = { intent: resolvedIntent, interests, preciseLocationEnabled };
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
  const response = await fetch(`${DISCOVER_API_URL}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    throw new Error(`discover_request_failed_${response.status}`);
  }

  return response.json() as Promise<T>;
};

const chatRequest = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${CHAT_API_URL}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    throw new Error(`chat_request_failed_${response.status}`);
  }

  return response.json() as Promise<T>;
};

const paymentsRequest = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${PAYMENTS_API_URL}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    throw new Error(`payments_request_failed_${response.status}`);
  }

  return response.json() as Promise<T>;
};

const profileRequest = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${PROFILE_API_URL}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    throw new Error(`profile_request_failed_${response.status}`);
  }

  return response.json() as Promise<T>;
};

const safetyRequest = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${SAFETY_API_URL}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    throw new Error(`safety_request_failed_${response.status}`);
  }

  return response.json() as Promise<T>;
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

  async swipe(profileId: string, decision: SwipeDecision): Promise<SwipeResponse> {
    if (DISCOVER_API_URL) {
      try {
        return await discoverRequest<SwipeResponse>('/discover/swipe', {
          method: 'POST',
          body: JSON.stringify({
            profileId,
            decision,
          }),
        });
      } catch (error) {
        if (!shouldFallbackToRuntime(error)) throw error;
        // Fallback keeps swipe flow available while service stabilizes.
      }
    }
    return withLatency(runtimeApi.swipe(profileId, decision), 80);
  },

  rewind(): Promise<RewindResponse> {
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
      return chatRequest<{ conversations: ConversationSummary[] }>('/chat/conversations')
        .then((payload) => payload.conversations)
        .catch((error) =>
          shouldFallbackToRuntime(error)
            ? withLatency(runtimeApi.getConversations(), 100)
            : Promise.reject(error),
        );
    }
    return withLatency(runtimeApi.getConversations(), 100);
  },

  openChat(profileId: string, fromSuperLike = false): Promise<string> {
    if (CHAT_API_URL) {
      return chatRequest<{ conversationId: string }>('/chat/open', {
        method: 'POST',
        body: JSON.stringify({ profileId, fromSuperLike }),
      })
        .then((payload) => payload.conversationId)
        .catch((error) =>
          shouldFallbackToRuntime(error)
            ? withLatency(runtimeApi.openChat(profileId, fromSuperLike), 60)
            : Promise.reject(error),
        );
    }
    return withLatency(runtimeApi.openChat(profileId, fromSuperLike), 60);
  },

  getMessages(conversationId: string): Promise<ChatMessage[]> {
    if (CHAT_API_URL) {
      return chatRequest<{ conversationId: string; messages: ChatMessage[] }>(
        `/chat/conversations/${conversationId}/messages`,
      )
        .then((payload) => payload.messages)
        .catch((error) =>
          shouldFallbackToRuntime(error)
            ? withLatency(runtimeApi.getConversationMessages(conversationId), 80)
            : Promise.reject(error),
        );
    }
    return withLatency(runtimeApi.getConversationMessages(conversationId), 80);
  },

  sendMessage(request: SendMessageRequest): Promise<SendMessageResponse> {
    if (CHAT_API_URL) {
      return chatRequest<SendMessageResponse>('/chat/messages', {
        method: 'POST',
        body: JSON.stringify(request),
      }).catch((error) =>
        shouldFallbackToRuntime(error)
          ? withLatency(runtimeApi.sendMessage(request), 60)
          : Promise.reject(error),
      );
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
      }).catch((error) =>
        shouldFallbackToRuntime(error)
          ? withLatency(runtimeApi.setConversationRelationState(request), 50)
          : Promise.reject(error),
      );
    }
    return withLatency(runtimeApi.setConversationRelationState(request), 50);
  },

  setTranslationToggle(request: TranslationToggleRequest): Promise<TranslationToggleResponse> {
    return withLatency(runtimeApi.setTranslationToggle(request), 40);
  },

  isTranslationEnabled(conversationId: string): boolean {
    return runtimeApi.isTranslationEnabled(conversationId);
  },

  getSettings(): Promise<SettingsEnvelope> {
    return withLatency(runtimeApi.getSettingsEnvelope(), 80);
  },

  patchSettings(request: PatchSettingsRequest): Promise<SettingsEnvelope> {
    return withLatency(runtimeApi.patchSettings(request), 100);
  },

  getProfileMe(): Promise<ProfileMeData> {
    if (PROFILE_API_URL) {
      return profileRequest<{
        userId: string;
        profile: ProfileMeData['profile'];
        settings: ProfileMeData['settings'];
      }>('/profiles/me')
        .then((payload) => ({
          profile: payload.profile,
          settings: payload.settings,
        }))
        .catch((error) => {
          if (!shouldFallbackToRuntime(error)) {
            return Promise.reject(error);
          }
          return withLatency({
            profile: {
              first_name: null,
              last_name: null,
              locale: runtimeApi.getSettingsEnvelope().settings.preferences.language,
              city: null,
            },
            settings: null,
          });
        });
    }

    return withLatency({
      profile: {
        first_name: null,
        last_name: null,
        locale: runtimeApi.getSettingsEnvelope().settings.preferences.language,
        city: null,
      },
      settings: null,
    });
  },

  patchProfileMe(payload: PatchProfileMeRequest): Promise<ProfileMeData> {
    if (PROFILE_API_URL) {
      return profileRequest<{
        userId: string;
        profile: ProfileMeData['profile'];
        settings: ProfileMeData['settings'];
      }>('/profiles/me', {
        method: 'PATCH',
        body: JSON.stringify({
          first_name: payload.first_name,
          last_name: payload.last_name,
          locale: payload.locale,
          city: payload.city,
          settings: payload.settings
            ? {
                language: payload.settings.language,
                distance_km: payload.settings.distanceKm,
                age_min: payload.settings.ageMin,
                age_max: payload.settings.ageMax,
                gender_preference: payload.settings.genderPreference,
                notifications_enabled: payload.settings.notificationsEnabled,
              }
            : undefined,
        }),
      })
        .then((response) => {
          runtimeApi.patchSettings({
            patch: {
              preferences: {
                language: response.settings?.language ?? undefined,
                distanceKm: response.settings?.distance_km ?? undefined,
                ageMin: response.settings?.age_min ?? undefined,
                ageMax: response.settings?.age_max ?? undefined,
                genderPreference: response.settings?.gender_preference ?? undefined,
              },
            },
          });

          return {
            profile: response.profile,
            settings: response.settings,
          };
        })
        .catch((error) => {
          if (!shouldFallbackToRuntime(error)) {
            return Promise.reject(error);
          }
          return withLatency({
            profile: null,
            settings: null,
          });
        });
    }

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

    return withLatency({
      profile: null,
      settings: null,
    });
  },

  getBlockedUsers(): Promise<GetBlocksResponse> {
    if (SAFETY_API_URL) {
      return safetyRequest<GetBlocksResponse>('/safety/blocks').catch((error) =>
        shouldFallbackToRuntime(error) ? withLatency({ blocks: [] }) : Promise.reject(error),
      );
    }
    return withLatency({ blocks: [] });
  },

  blockUser(userId: string): Promise<BlockUserResponse> {
    if (SAFETY_API_URL) {
      return safetyRequest<BlockUserResponse>('/safety/blocks', {
        method: 'POST',
        body: JSON.stringify({ userId }),
      }).catch((error) =>
        shouldFallbackToRuntime(error)
          ? withLatency({
              status: 'blocked',
              block: {
                blockedUserId: userId,
                createdAtIso: new Date().toISOString(),
              },
            })
          : Promise.reject(error),
      );
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
      }).catch((error) =>
        shouldFallbackToRuntime(error) ? withLatency({ status: 'noop', userId }) : Promise.reject(error),
      );
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

  applyEntitlementSnapshot(snapshot: EntitlementSnapshot): Promise<SettingsEnvelope> {
    return withLatency(runtimeApi.applyEntitlementSnapshot(snapshot), 40);
  },
};
