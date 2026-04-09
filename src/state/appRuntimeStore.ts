import { useSyncExternalStore } from 'react';
import type {
  ChatMessage,
  ConversationSummary,
  FeedCandidate,
  FeedQuickFilter,
  GetFeedResponse,
  GetReceivedLikesResponse,
  ActivateBoostResponse,
  BoostStatus,
  LikesInventory,
  PatchSettingsRequest,
  DeepPartial,
  PlanTier,
  ProfileCard,
  RewindResponse,
  SendMessageRequest,
  SendMessageResponse,
  SettingsEnvelope,
  SwipeDecision,
  SwipeResponse,
  TranslationToggleRequest,
  TranslationToggleResponse,
  UpdateConversationRelationStateRequest,
  UpdateConversationRelationStateResponse,
  UserSettings,
  EntitlementSnapshot,
} from '../contracts';
import { clearTrackedEvents, trackEvent } from '../services/analytics';
import { resolveTravelPassServerAccess } from '../domain/travelPass';
import { resolveShadowGhostAccess } from '../domain/shadowGhost';

const STORAGE_KEY = 'exotic.runtime.settings.v1';
const BOOST_DURATION_SECONDS = 30 * 60;

type RuntimeState = {
  currentUserId: string;
  planTier: PlanTier;
  balances: {
    superlikesLeft: number;
    boostsLeft: number;
    rewindsLeft: number;
  };
  boost: {
    activeUntilIso: string | null;
  };
  settings: UserSettings;
  feedSource: ProfileCard[];
  dismissedProfileIds: string[];
  likedProfileIds: string[];
  likedByProfileIds: string[];
  likesUnlocked: boolean;
  likes: {
    id: string;
    profile: ProfileCard;
    receivedAtIso: string;
    wasSuperLike: boolean;
  }[];
  conversations: ConversationSummary[];
  messagesByConversation: Record<string, ChatMessage[]>;
  translationByConversationId: Record<string, boolean>;
  firstMessageSentByConversationId: Record<string, boolean>;
  firstMessageReplyByConversationId: Record<string, boolean>;
  sixMessagesReachedByConversationId: Record<string, boolean>;
  impressionByProfileId: Record<string, boolean>;
};

const defaultSettings: UserSettings = {
  account: {
    phone: '',
    email: '',
  },
  privacy: {
    visibility: 'public',
    hideAge: false,
    hideDistance: false,
    preciseLocation: false,
    shadowGhost: false,
    incognito: false,
    readReceipts: true,
  },
  notifications: {
    matches: true,
    messages: true,
    likes: true,
    offers: true,
  },
  preferences: {
    distanceKm: 25,
    ageMin: 22,
    ageMax: 35,
    genderPreference: 'everyone',
    language: 'en',
    travelPassCity: undefined,
    travelPassEntitlementSource: 'none',
    shadowGhostEntitlementSource: 'none',
  },
  translation: {
    autoDetectEnabled: true,
    targetLocale: 'en',
  },
};

const readPersistedSettings = (): UserSettings | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UserSettings;
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      ...defaultSettings,
      ...parsed,
      account: { ...defaultSettings.account, ...(parsed.account ?? {}) },
      privacy: { ...defaultSettings.privacy, ...(parsed.privacy ?? {}) },
      notifications: { ...defaultSettings.notifications, ...(parsed.notifications ?? {}) },
      preferences: { ...defaultSettings.preferences, ...(parsed.preferences ?? {}) },
      translation: { ...defaultSettings.translation, ...(parsed.translation ?? {}) },
    };
  } catch {
    return null;
  }
};

const toConversationId = (profileId: string) => `conv-${profileId}`;

const nowIso = () => new Date().toISOString();

const createInitialState = (): RuntimeState => ({
  currentUserId: 'me',
  planTier: 'free',
  balances: {
    superlikesLeft: 5,
    boostsLeft: 1,
    rewindsLeft: 3,
  },
  boost: {
    activeUntilIso: null,
  },
  settings: readPersistedSettings() ?? defaultSettings,
  feedSource: [],
  dismissedProfileIds: [],
  likedProfileIds: [],
  likedByProfileIds: [],
  likesUnlocked: false,
  likes: [],
  conversations: [],
  messagesByConversation: {},
  translationByConversationId: {},
  firstMessageSentByConversationId: {},
  firstMessageReplyByConversationId: {},
  sixMessagesReachedByConversationId: {},
  impressionByProfileId: {},
});

let state: RuntimeState = createInitialState();

const listeners = new Set<() => void>();

const emit = () => {
  listeners.forEach((listener) => listener());
};

const setState = (updater: (prev: RuntimeState) => RuntimeState) => {
  state = updater(state);
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.settings));
  }
  emit();
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const getStateSnapshot = () => state;

const stableScore = (profileId: string) => {
  return [...profileId].reduce((acc, char) => acc + char.charCodeAt(0), 0) % 100;
};

const feedScoreReason = (profile: ProfileCard) => {
  if (profile.compatibility >= 94) return 'high_compatibility';
  if (profile.flags.verifiedIdentity) return 'verified_priority';
  if (profile.online) return 'online_recent';
  return 'balanced_discovery';
};

const profileAgeVisible = (profile: ProfileCard) => !profile.flags.hideAge;
const profileDistanceVisible = (profile: ProfileCard) => !profile.flags.hideDistance;

const asFeedCandidate = (profile: ProfileCard): FeedCandidate => ({
  ...profile,
  age: profileAgeVisible(profile) ? profile.age : 0,
  distanceKm: profileDistanceVisible(profile) ? profile.distanceKm : -1,
  rankScore: profile.compatibility + (profile.online ? 3 : 0) + (profile.flags.verifiedIdentity ? 2 : 0),
  scoreReason: feedScoreReason(profile),
});

const applyFeedFilters = (profiles: ProfileCard[], filters: FeedQuickFilter[]) => {
  if (filters.length === 0 || filters.includes('all')) return profiles;
  return profiles.filter((profile, index) => {
    if (filters.includes('verified') && !profile.flags.verifiedIdentity) return false;
    if (filters.includes('nearby') && profile.distanceKm > 5) return false;
    if (filters.includes('new') && index > 2) return false;
    if (filters.includes('online') && !profile.online) return false;
    return true;
  });
};

const canUnlockLikes = (planTier: PlanTier) => planTier !== 'free';

const ensureConversationForProfile = (profileId: string, fromSuperLike = false): string => {
  const id = toConversationId(profileId);
  const exists = state.conversations.some((entry) => entry.id === id);
  if (exists) return id;

  const peer = state.feedSource.find((profile) => profile.id === profileId);
  if (!peer) return id;

  const conversation: ConversationSummary = {
    id,
    peer,
    unreadCount: 0,
    lastMessagePreview: fromSuperLike
      ? 'This chat started from a SuperLike.'
      : 'New match. Say hello.',
    lastMessageAtIso: nowIso(),
    online: peer.online,
    relationState: 'active',
    receivedSuperLikeTraceAtIso: fromSuperLike ? nowIso() : undefined,
  };

  const welcomeMessage: ChatMessage = {
    id: `m-${Date.now()}`,
    conversationId: id,
    senderUserId: peer.id,
    direction: 'incoming',
    originalText: fromSuperLike
      ? 'SuperLike landed. Want to chat tonight?'
      : 'We matched. Nice to meet you!',
    translated: false,
    createdAtIso: nowIso(),
  };

  state = {
    ...state,
    conversations: [conversation, ...state.conversations],
    messagesByConversation: {
      ...state.messagesByConversation,
      [id]: [welcomeMessage],
    },
    translationByConversationId: {
      ...state.translationByConversationId,
      [id]: state.settings.translation.autoDetectEnabled,
    },
  };
  return id;
};

const mergeSettings = (prev: UserSettings, patch: DeepPartial<UserSettings>): UserSettings => ({
  ...prev,
  ...patch,
  account: { ...prev.account, ...(patch.account ?? {}) },
  privacy: { ...prev.privacy, ...(patch.privacy ?? {}) },
  notifications: { ...prev.notifications, ...(patch.notifications ?? {}) },
  preferences: { ...prev.preferences, ...(patch.preferences ?? {}) },
  translation: { ...prev.translation, ...(patch.translation ?? {}) },
});

const resolveBoostStatus = (payload: RuntimeState): BoostStatus => {
  const activeUntilIso = payload.boost.activeUntilIso ?? undefined;
  if (!activeUntilIso) {
    return {
      active: false,
      remainingSeconds: 0,
      boostsLeft: payload.balances.boostsLeft,
      availability: payload.balances.boostsLeft > 0 ? 'available' : 'out_of_tokens',
      durationSeconds: BOOST_DURATION_SECONDS,
    };
  }

  const activeUntilMs = new Date(activeUntilIso).getTime();
  const remainingSeconds = Math.max(0, Math.ceil((activeUntilMs - Date.now()) / 1000));
  const active = remainingSeconds > 0;
  return {
    active,
    activeUntilIso,
    remainingSeconds,
    boostsLeft: payload.balances.boostsLeft,
    availability: active ? 'active' : payload.balances.boostsLeft > 0 ? 'available' : 'out_of_tokens',
    durationSeconds: BOOST_DURATION_SECONDS,
  };
};

export const runtimeApi = {
  getSettingsEnvelope(): SettingsEnvelope {
    const travelPassServerAccess = resolveTravelPassServerAccess({
      planTier: state.planTier,
      entitlementSource: state.settings.preferences.travelPassEntitlementSource,
      entitlementExpiresAtIso: state.settings.preferences.travelPassEntitlementExpiresAtIso,
    });
    const shadowGhostAccess = resolveShadowGhostAccess({
      planTier: state.planTier,
      entitlementSource: state.settings.preferences.shadowGhostEntitlementSource,
      entitlementExpiresAtIso: state.settings.preferences.shadowGhostEntitlementExpiresAtIso,
    });
    const effectiveSettings = shadowGhostAccess.canUse
      ? state.settings
      : {
          ...state.settings,
          privacy: {
            ...state.settings.privacy,
            shadowGhost: false,
          },
        };

    return {
      userId: state.currentUserId,
      planTier: state.planTier,
      balances: state.balances,
      settings: effectiveSettings,
      travelPassServerAccess,
    };
  },

  getFeed(quickFilters: FeedQuickFilter[]): GetFeedResponse {
    const visibleProfiles = state.feedSource.filter(
      (profile) => !state.dismissedProfileIds.includes(profile.id),
    );
    const filtered = applyFeedFilters(visibleProfiles, quickFilters)
      .map(asFeedCandidate)
      .sort((a, b) => b.rankScore - a.rankScore);
    return {
      window: {
        cursor: `feed-${Date.now()}`,
        candidates: filtered,
        quickFiltersApplied: quickFilters,
      },
    };
  },

  markProfileImpression(profileId: string) {
    if (state.impressionByProfileId[profileId]) return;
    setState((prev) => ({
      ...prev,
      impressionByProfileId: { ...prev.impressionByProfileId, [profileId]: true },
    }));
    trackEvent('profile_impression', {
      userId: state.currentUserId,
      sourceScreen: 'discover',
      targetId: profileId,
    });
  },

  swipe(profileId: string, decision: SwipeDecision): SwipeResponse {
    const profile = state.feedSource.find((item) => item.id === profileId);
    if (!profile) return { matched: false };

    const eventName =
      decision === 'superlike'
        ? 'superlike_used'
        : decision === 'like'
          ? 'swipe_like'
          : 'swipe_dislike';

    trackEvent(eventName, {
      userId: state.currentUserId,
      sourceScreen: 'discover',
      targetId: profileId,
    });

    if (decision === 'superlike' && state.balances.superlikesLeft <= 0) {
      return { matched: false };
    }

    const deterministic = stableScore(profileId);
    const matched =
      decision === 'superlike'
        ? deterministic >= 30
        : decision === 'like'
          ? deterministic >= 62
          : false;

    const nextDismissed = [...state.dismissedProfileIds];
    if (!nextDismissed.includes(profileId)) nextDismissed.push(profileId);

    const nextLiked = [...state.likedProfileIds];
    if ((decision === 'like' || decision === 'superlike') && !nextLiked.includes(profileId)) {
      nextLiked.push(profileId);
    }

    setState((prev) => ({
      ...prev,
      dismissedProfileIds: nextDismissed,
      likedProfileIds: nextLiked,
      balances:
        decision === 'superlike'
          ? { ...prev.balances, superlikesLeft: Math.max(0, prev.balances.superlikesLeft - 1) }
          : prev.balances,
    }));

    if (!matched) return { matched: false };

    const conversationId = ensureConversationForProfile(profileId, decision === 'superlike');
    trackEvent('match_created', {
      userId: state.currentUserId,
      sourceScreen: 'discover',
      targetId: profileId,
      conversationId,
      metadata: { via: decision },
    });

    return { matched: true, conversationId };
  },

  rewind(): RewindResponse {
    const lastDismissedId = state.dismissedProfileIds[state.dismissedProfileIds.length - 1];
    if (!lastDismissedId || state.balances.rewindsLeft <= 0) {
      return { restoredProfileId: undefined, rewindsLeft: state.balances.rewindsLeft };
    }

    trackEvent('rewind_used', {
      userId: state.currentUserId,
      sourceScreen: 'discover',
      targetId: lastDismissedId,
    });

    setState((prev) => ({
      ...prev,
      dismissedProfileIds: prev.dismissedProfileIds.slice(0, -1),
      balances: { ...prev.balances, rewindsLeft: Math.max(0, prev.balances.rewindsLeft - 1) },
    }));

    return {
      restoredProfileId: lastDismissedId,
      rewindsLeft: state.balances.rewindsLeft,
    };
  },

  getBoostStatus(): BoostStatus {
    return resolveBoostStatus(state);
  },

  activateBoost(): ActivateBoostResponse {
    const currentStatus = resolveBoostStatus(state);
    if (currentStatus.active) {
      return {
        status: 'already_active',
        boost: currentStatus,
      };
    }

    if (state.balances.boostsLeft <= 0) {
      return {
        status: 'no_tokens',
        boost: currentStatus,
      };
    }

    const activeUntilIso = new Date(Date.now() + BOOST_DURATION_SECONDS * 1000).toISOString();
    setState((prev) => ({
      ...prev,
      boost: {
        activeUntilIso,
      },
      balances: {
        ...prev.balances,
        boostsLeft: Math.max(0, prev.balances.boostsLeft - 1),
      },
    }));

    trackEvent('boost_activated', {
      userId: state.currentUserId,
      sourceScreen: 'discover',
      metadata: {
        duration_seconds: BOOST_DURATION_SECONDS,
        boosts_left: state.balances.boostsLeft,
      },
    });

    return {
      status: 'activated',
      boost: resolveBoostStatus(state),
    };
  },

  getLikes(): GetReceivedLikesResponse {
    const unlocked = state.likesUnlocked || canUnlockLikes(state.planTier);
    const hiddenCount = unlocked ? 0 : state.likes.length;
    const visibleLikes = (unlocked ? state.likes : state.likes.slice(0, 4)).map((entry) => ({
      ...entry,
      state: 'pending_incoming_like' as const,
      hiddenByShadowGhost: false,
      blurredLocked: !unlocked,
    }));

    const inventory: LikesInventory = {
      unlocked,
      hiddenCount,
      visibleLikes,
      iceBreaker: {
        eligibleLikesHiddenCount: hiddenCount,
        consumed: false,
      },
    };

    return {
      state: state.likes.length === 0 ? 'empty' : unlocked ? 'unlocked' : 'locked',
      inventory,
    };
  },

  trackLikesPaywallView() {
    trackEvent('paywall_view', {
      userId: state.currentUserId,
      sourceScreen: 'likes',
      metadata: { hidden_count: state.likes.length },
    });
  },

  clickLikesPaywall() {
    trackEvent('paywall_click', {
      userId: state.currentUserId,
      sourceScreen: 'likes',
      metadata: { target_route: '/boost' },
    });
  },

  unlockLikesPreview() {
    setState((prev) => ({ ...prev, likesUnlocked: true }));
  },

  getConversations() {
    return [...state.conversations].sort(
      (a, b) => new Date(b.lastMessageAtIso).getTime() - new Date(a.lastMessageAtIso).getTime(),
    );
  },

  getConversationByUserId(profileId: string): ConversationSummary | undefined {
    return state.conversations.find((entry) => entry.peer.id === profileId);
  },

  getConversationMessages(conversationId: string): ChatMessage[] {
    return [...(state.messagesByConversation[conversationId] ?? [])];
  },

  openChat(profileId: string, fromSuperLike = false): string {
    return ensureConversationForProfile(profileId, fromSuperLike);
  },

  sendMessage(request: SendMessageRequest): SendMessageResponse {
    const { conversationId, text } = request;
    const conversation = state.conversations.find((entry) => entry.id === conversationId);
    const relationState = conversation?.relationState ?? 'active';
    if (relationState !== 'active') {
      return { status: relationState };
    }

    const trimmed = text.trim();
    if (!trimmed) {
      return { status: 'invalid' };
    }

    const message: ChatMessage = {
      id: `m-${Date.now()}`,
      conversationId,
      senderUserId: state.currentUserId,
      direction: 'outgoing',
      originalText: trimmed,
      translated: false,
      createdAtIso: nowIso(),
    };

    const previousMessages = state.messagesByConversation[conversationId] ?? [];
    const nextMessages = [...previousMessages, message];

    const updatedConversation: ConversationSummary | undefined = conversation
      ? {
          ...conversation,
          unreadCount: 0,
          lastMessagePreview: trimmed,
          lastMessageAtIso: message.createdAtIso,
        }
      : undefined;

    const firstOutgoingAlreadySent = state.firstMessageSentByConversationId[conversationId];
    const firstReplyAlreadyTracked = state.firstMessageReplyByConversationId[conversationId];
    const hasIncoming = previousMessages.some((entry) => entry.direction === 'incoming');
    const totalMessages = nextMessages.length;
    const reachedSixAlready = state.sixMessagesReachedByConversationId[conversationId];

    setState((prev) => ({
      ...prev,
      messagesByConversation: {
        ...prev.messagesByConversation,
        [conversationId]: nextMessages,
      },
      conversations: updatedConversation
        ? prev.conversations
            .map((entry) => (entry.id === conversationId ? updatedConversation : entry))
            .sort((a, b) => new Date(b.lastMessageAtIso).getTime() - new Date(a.lastMessageAtIso).getTime())
        : prev.conversations,
      firstMessageSentByConversationId: firstOutgoingAlreadySent
        ? prev.firstMessageSentByConversationId
        : { ...prev.firstMessageSentByConversationId, [conversationId]: true },
      firstMessageReplyByConversationId:
        !prev.firstMessageReplyByConversationId[conversationId] && hasIncoming
          ? { ...prev.firstMessageReplyByConversationId, [conversationId]: true }
          : prev.firstMessageReplyByConversationId,
      sixMessagesReachedByConversationId:
        !reachedSixAlready && totalMessages >= 6
          ? { ...prev.sixMessagesReachedByConversationId, [conversationId]: true }
          : prev.sixMessagesReachedByConversationId,
    }));

    if (!firstOutgoingAlreadySent) {
      trackEvent('first_message_sent', {
        userId: state.currentUserId,
        sourceScreen: 'chat',
        conversationId,
      });
    }
    if (!firstReplyAlreadyTracked && hasIncoming) {
      trackEvent('first_message_reply', {
        userId: state.currentUserId,
        sourceScreen: 'chat',
        conversationId,
      });
    }
    if (!reachedSixAlready && totalMessages >= 6) {
      trackEvent('conversation_reached_6_messages', {
        userId: state.currentUserId,
        sourceScreen: 'chat',
        conversationId,
      });
    }

    return { status: 'sent', message };
  },

  setConversationRelationState(
    request: UpdateConversationRelationStateRequest,
  ): UpdateConversationRelationStateResponse {
    const { conversationId, state: nextState } = request;
    const existing = state.conversations.find((entry) => entry.id === conversationId);
    if (!existing) {
      return { conversationId, state: nextState };
    }

    const updatedAtIso = nowIso();
    setState((prev) => ({
      ...prev,
      conversations: prev.conversations.map((entry) =>
        entry.id === conversationId
          ? {
              ...entry,
              relationState: nextState,
              relationStateUpdatedAtIso: updatedAtIso,
              lastMessagePreview:
                nextState === 'blocked_by_me'
                  ? 'You blocked this conversation.'
                  : nextState === 'blocked_me'
                    ? 'You were blocked by this user.'
                    : entry.relationState !== 'active'
                      ? 'Conversation reopened.'
                      : entry.lastMessagePreview,
            }
          : entry,
      ),
    }));

    if (nextState === 'blocked_by_me') {
      trackEvent('block_user', {
        userId: state.currentUserId,
        sourceScreen: 'chat',
        targetId: existing.peer.id,
        conversationId,
      });
    }

    return {
      conversationId,
      state: nextState,
    };
  },

  setTranslationToggle(request: TranslationToggleRequest): TranslationToggleResponse {
    const { conversationId, enabled, targetLocale } = request;
    setState((prev) => ({
      ...prev,
      translationByConversationId: {
        ...prev.translationByConversationId,
        [conversationId]: enabled,
      },
      settings: {
        ...prev.settings,
        translation: {
          ...prev.settings.translation,
          targetLocale,
        },
      },
    }));

    trackEvent('translation_toggle_changed', {
      userId: state.currentUserId,
      sourceScreen: 'chat',
      conversationId,
      metadata: { enabled, target_locale: targetLocale },
    });

    return { conversationId, enabled };
  },

  isTranslationEnabled(conversationId: string): boolean {
    return (
      state.translationByConversationId[conversationId] ?? state.settings.translation.autoDetectEnabled
    );
  },

  patchSettings(request: PatchSettingsRequest) {
    const nextSettings = mergeSettings(state.settings, request.patch);
    const shadowGhostAccess = resolveShadowGhostAccess({
      planTier: state.planTier,
      entitlementSource: nextSettings.preferences.shadowGhostEntitlementSource,
      entitlementExpiresAtIso: nextSettings.preferences.shadowGhostEntitlementExpiresAtIso,
    });
    if (!shadowGhostAccess.canUse && nextSettings.privacy.shadowGhost) {
      nextSettings.privacy.shadowGhost = false;
    }
    setState((prev) => ({ ...prev, settings: nextSettings }));
    return this.getSettingsEnvelope();
  },

  applyEntitlementSnapshot(snapshot: EntitlementSnapshot) {
    setState((prev) => {
      const nextPlanTier = snapshot.planTier ?? prev.planTier;
      const nextBalances = {
        superlikesLeft:
          prev.balances.superlikesLeft + (snapshot.balancesDelta?.superlikesLeft ?? 0),
        boostsLeft: prev.balances.boostsLeft + (snapshot.balancesDelta?.boostsLeft ?? 0),
        rewindsLeft: prev.balances.rewindsLeft + (snapshot.balancesDelta?.rewindsLeft ?? 0),
      };

      const nextSettings = {
        ...prev.settings,
        preferences: {
          ...prev.settings.preferences,
          travelPassEntitlementSource:
            snapshot.travelPass?.source ?? prev.settings.preferences.travelPassEntitlementSource,
          travelPassEntitlementExpiresAtIso:
            snapshot.travelPass?.expiresAtIso ?? prev.settings.preferences.travelPassEntitlementExpiresAtIso,
          shadowGhostEntitlementSource:
            snapshot.shadowGhost?.source ?? prev.settings.preferences.shadowGhostEntitlementSource,
          shadowGhostEntitlementExpiresAtIso:
            snapshot.shadowGhost?.expiresAtIso ?? prev.settings.preferences.shadowGhostEntitlementExpiresAtIso,
        },
        privacy: {
          ...prev.settings.privacy,
          shadowGhost:
            snapshot.shadowGhost?.enablePrivacy === true ? true : prev.settings.privacy.shadowGhost,
        },
      };

      return {
        ...prev,
        planTier: nextPlanTier,
        balances: nextBalances,
        settings: nextSettings,
      };
    });

    return this.getSettingsEnvelope();
  },

  setPlanTier(planTier: PlanTier) {
    setState((prev) => ({ ...prev, planTier }));
  },

  resetForTests() {
    state = createInitialState();
    clearTrackedEvents();
    emit();
  },

  getState() {
    return state;
  },
};

export const useRuntimeSelector = <T>(selector: (payload: RuntimeState) => T): T => {
  const snapshot = useSyncExternalStore(subscribe, getStateSnapshot, getStateSnapshot);
  return selector(snapshot);
};
