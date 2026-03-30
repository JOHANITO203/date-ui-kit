export type AnalyticsEventName =
  | 'profile_impression'
  | 'swipe_like'
  | 'swipe_dislike'
  | 'superlike_used'
  | 'rewind_used'
  | 'match_created'
  | 'paywall_view'
  | 'paywall_click'
  | 'purchase_success'
  | 'boost_activated'
  | 'first_message_sent'
  | 'first_message_reply'
  | 'conversation_reached_6_messages'
  | 'translation_toggle_changed'
  | 'block_user';

export interface AnalyticsEventPayload {
  userId: string;
  sourceScreen: 'discover' | 'likes' | 'messages' | 'chat' | 'boost' | 'settings' | 'profile';
  targetId?: string;
  conversationId?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface AnalyticsEvent {
  id: string;
  name: AnalyticsEventName;
  timestampIso: string;
  payload: AnalyticsEventPayload;
}
