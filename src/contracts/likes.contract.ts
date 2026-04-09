import type { ProfileCard } from './common.contract';

export type LikesScreenState = 'loading' | 'empty' | 'locked' | 'unlocked' | 'error';

export interface ReceivedLike {
  id: string;
  profile: ProfileCard;
  receivedAtIso: string;
  wasSuperLike: boolean;
  state: 'pending_incoming_like' | 'matched' | 'refused';
  hiddenByShadowGhost: boolean;
  blurredLocked: boolean;
}

export interface IceBreakerState {
  eligibleLikesHiddenCount: number;
  activeUntilIso?: string;
  consumed: boolean;
}

export interface LikesInventory {
  unlocked: boolean;
  hiddenCount: number;
  visibleLikes: ReceivedLike[];
  iceBreaker: IceBreakerState;
}

export interface GetReceivedLikesResponse {
  state: LikesScreenState;
  inventory: LikesInventory;
}

export interface DecideIncomingLikeRequest {
  likeId: string;
  action: 'like_back' | 'pass';
}

export interface DecideIncomingLikeResponse {
  ok: boolean;
  likeId: string;
  status: 'matched' | 'refused' | 'pending_incoming_like';
  matched: boolean;
  conversationId?: string;
  peerOnline?: boolean;
}

export interface PaywallClickRequest {
  source: 'likes' | 'discover' | 'messages' | 'profile';
}

export interface PaywallClickResponse {
  nextRoute: '/boost';
}
