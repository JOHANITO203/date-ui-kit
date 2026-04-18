import type { ProfileCard } from './common.contract';

export type FeedQuickFilter = 'all' | 'nearby' | 'new' | 'online' | 'verified';

/**
 * Legacy note:
 * `superlike` is kept temporarily for backward compatibility in low-level runtime mocks.
 * Product flow must use `SuperLikeDirectMessageRequest` via dedicated endpoint.
 */
export type SwipeDecision = 'like' | 'dislike' | 'superlike';

export interface FeedCandidate extends ProfileCard {
  rankScore: number;
  scoreReason: string;
}

export interface FeedWindow {
  cursor: string;
  candidates: FeedCandidate[];
  quickFiltersApplied: FeedQuickFilter[];
}

export interface GetFeedRequest {
  quickFilters: FeedQuickFilter[];
  cursor?: string;
  limit?: number;
}

export interface GetFeedResponse {
  window: FeedWindow;
}

export interface SwipeRequest {
  profileId: string;
  decision: SwipeDecision;
  feedCursor: string;
}

export interface SwipeResponse {
  matched: boolean;
  conversationId?: string;
  superlikesLeft?: number;
}

export interface SuperLikeDirectMessageRequest {
  profileId: string;
  text: string;
  feedCursor?: string;
  idempotencyKey?: string;
}

export interface SuperLikeDirectMessageResponse {
  status: 'sent' | 'no_stock' | 'invalid_target' | 'invalid_message';
  confirmation: string;
  conversationId?: string;
  messageId?: string;
  superlikesLeft: number;
}

export interface RewindRequest {
  feedCursor: string;
}

export interface RewindResponse {
  restoredProfileId?: string;
  rewindsLeft: number;
}

export interface FeedResetRequest {
  quickFilters: FeedQuickFilter[];
  ageMin?: number;
  ageMax?: number;
  distanceKm?: number;
  genderPreference?: 'men' | 'women' | 'everyone';
  intent?: 'serieuse' | 'connexion' | 'decouverte' | 'verrai' | null;
  interests?: string[];
  launchCity?: string | null;
  originCountry?: string | null;
  userLanguages?: string[];
  lat?: number;
  lng?: number;
}

export interface FeedResetResponse extends GetFeedResponse {
  reset: {
    requestedAtIso: string;
    composition: {
      total: number;
      fresh: number;
      passed: number;
      likedWithoutMatch: number;
    };
    poolsAvailable: {
      fresh: number;
      passed: number;
      likedWithoutMatch: number;
    };
    exclusions: {
      matched: number;
      conversations: number;
      safetyBlocked: number;
      safetyReported: number;
      total: number;
    };
  };
}
