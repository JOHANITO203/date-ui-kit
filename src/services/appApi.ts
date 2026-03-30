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
} from '../contracts';
import { runtimeApi } from '../state';

const withLatency = async <T>(value: T, delayMs = 120): Promise<T> => {
  await new Promise((resolve) => window.setTimeout(resolve, delayMs));
  return value;
};

export const appApi = {
  getFeed(quickFilters: FeedQuickFilter[]): Promise<GetFeedResponse> {
    return withLatency(runtimeApi.getFeed(quickFilters));
  },

  markProfileImpression(profileId: string): void {
    runtimeApi.markProfileImpression(profileId);
  },

  swipe(profileId: string, decision: SwipeDecision): Promise<SwipeResponse> {
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
    return withLatency(runtimeApi.getConversations(), 100);
  },

  openChat(profileId: string, fromSuperLike = false): Promise<string> {
    return withLatency(runtimeApi.openChat(profileId, fromSuperLike), 60);
  },

  getMessages(conversationId: string): Promise<ChatMessage[]> {
    return withLatency(runtimeApi.getConversationMessages(conversationId), 80);
  },

  sendMessage(request: SendMessageRequest): Promise<SendMessageResponse> {
    return withLatency(runtimeApi.sendMessage(request), 60);
  },

  setConversationRelationState(
    request: UpdateConversationRelationStateRequest,
  ): Promise<UpdateConversationRelationStateResponse> {
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
};
