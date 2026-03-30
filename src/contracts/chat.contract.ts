import type { ProfileCard } from './common.contract';

export type ChatMessageDirection = 'incoming' | 'outgoing';

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
  receivedSuperLikeTraceAtIso?: string;
}

export interface GetConversationsResponse {
  conversations: ConversationSummary[];
}

export interface GetMessagesResponse {
  conversationId: string;
  messages: ChatMessage[];
}

export interface SendMessageRequest {
  conversationId: string;
  text: string;
}

export interface SendMessageResponse {
  message: ChatMessage;
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
