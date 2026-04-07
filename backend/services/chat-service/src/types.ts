export type PremiumTier = "free" | "essential" | "gold" | "platinum" | "elite";

export interface ProfileCard {
  id: string;
  name: string;
  age: number;
  city: string;
  distanceKm: number;
  languages: string[];
  bio: string;
  photos: string[];
  compatibility: number;
  interests: string[];
  online: boolean;
  flags: {
    verifiedIdentity: boolean;
    premiumTier: PremiumTier;
    shortPassTier?: "day" | "week";
    hideAge: boolean;
    hideDistance: boolean;
    shadowGhost: boolean;
  };
}

export type ConversationRelationState = "active" | "blocked_by_me" | "blocked_me";

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

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderUserId: string;
  direction: "incoming" | "outgoing";
  originalText: string;
  translatedText?: string;
  translated: boolean;
  targetLocale?: "en" | "ru";
  createdAtIso: string;
  readAtIso?: string;
}
