import type { ProfileCard } from './common.contract';

export type LikesScreenState = 'loading' | 'empty' | 'locked' | 'unlocked' | 'error';

export interface ReceivedLike {
  id: string;
  profile: ProfileCard;
  receivedAtIso: string;
  wasSuperLike: boolean;
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

export interface PaywallClickRequest {
  source: 'likes' | 'discover' | 'messages' | 'profile';
}

export interface PaywallClickResponse {
  nextRoute: '/boost';
}
