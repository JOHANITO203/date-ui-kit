import type { ProfileCard } from './common.contract';

export type ChatMessageDirection = 'incoming' | 'outgoing';
export type ConversationRelationState = 'active' | 'blocked_by_me' | 'blocked_me';

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderUserId: string;
  direction: ChatMessageDirection;
  originalText: string;
  translatedText?: string;
  translated: boolean;
  targetLocale?: 'en' | 'ru';
  createdAtIso: string;
  readAtIso?: string;
}

export interface ConversationSummary {
  id: string;
  peer: ProfileCard;
  unreadCount: number;
  lastMessagePreview: string;
  lastMessageAtIso: string;
  online: boolean;
  relationState: ConversationRelationState;
  relationStateUpdatedAtIso?: string;
  receivedSuperLikeTraceAtIso?: string;
}

export interface GetConversationsResponse {
  conversations: ConversationSummary[];
}

export interface GetMessagesResponse {
  conversationId: string;
  translation?: {
    enabled: boolean;
    targetLocale: 'en' | 'ru';
  };
  messages: ChatMessage[];
}

export interface SendMessageRequest {
  conversationId: string;
  text: string;
}

export interface SendMessageResponse {
  status: 'sent' | 'blocked_by_me' | 'blocked_me' | 'invalid';
  message?: ChatMessage;
}

export interface TranslationToggleRequest {
  conversationId: string;
  enabled: boolean;
  targetLocale: 'en' | 'ru';
}

export interface TranslationToggleResponse {
  conversationId: string;
  enabled: boolean;
}

export interface UpdateConversationRelationStateRequest {
  conversationId: string;
  state: ConversationRelationState;
}

export interface UpdateConversationRelationStateResponse {
  conversationId: string;
  state: ConversationRelationState;
}
