import type { ProfileCard } from './common.contract';

export type FeedQuickFilter = 'all' | 'nearby' | 'new' | 'online' | 'verified';

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

export interface SuperLikeRequest {
  profileId: string;
  feedCursor: string;
}

export interface SuperLikeResponse {
  matched: boolean;
  conversationId?: string;
}

export interface RewindRequest {
  feedCursor: string;
}

export interface RewindResponse {
  restoredProfileId?: string;
  rewindsLeft: number;
}
