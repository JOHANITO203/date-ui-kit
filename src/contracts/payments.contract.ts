export type OfferType = 'tier' | 'instant' | 'time_pack' | 'bundle';

export interface OfferItem {
  id: string;
  label: string;
  description?: string;
  tag?: string;
  amountMinor: number;
  currencyNumeric: number;
  type: OfferType;
  durationHours?: number;
}

export interface GetPaymentsCatalogResponse {
  offers: OfferItem[];
  pspMode: 'yookassa' | 'mock';
}

export interface CreateCheckoutRequest {
  offerId: string;
  userId: string;
  locale?: string;
  successUrl?: string;
  failUrl?: string;
}

export interface CreateCheckoutResponse {
  mode: 'yookassa' | 'mock';
  checkoutId?: string;
  orderNumber: string;
  orderId?: string;
  formUrl?: string;
  qrId?: string;
  qrPayload?: string;
  offer: OfferItem;
  message?: string;
  status?: CheckoutStatus;
  attributed?: boolean;
  entitlementSnapshot?: EntitlementSnapshot;
  effectiveBenefits?: EffectiveBenefitsSnapshot;
}

export type CheckoutStatus = 'pending' | 'paid' | 'failed' | 'not_found';

export interface EntitlementSnapshot {
  planTier?: 'free' | 'essential' | 'gold' | 'platinum' | 'elite';
  planExpiresAtIso?: string;
  balancesDelta?: {
    boostsLeft?: number;
    superlikesLeft?: number;
    rewindsLeft?: number;
    icebreakersLeft?: number;
  };
  travelPass?: {
    source: 'travel_pass' | 'bundle_included';
    expiresAtIso: string;
  };
  shadowGhost?: {
    source: 'shadowghost_item';
    expiresAtIso: string;
    enablePrivacy: boolean;
  };
}

export interface EffectiveBenefitsByPage {
  discover: {
    discoverAdvancedFilters: boolean;
  };
  boost: {
    likesIdentityUnlocked: boolean;
    discoverAdvancedFilters: boolean;
    profileHideAgeDistance: boolean;
    messagesTranslation: boolean;
    messagesSeeOnline: boolean;
    travelPassIncluded: boolean;
    shadowGhostIncluded: boolean;
    premiumBadge: boolean;
  };
  profile: {
    profileHideAgeDistance: boolean;
    travelPassIncluded: boolean;
    shadowGhostIncluded: boolean;
    premiumBadge: boolean;
  };
  messages: {
    messagesTranslation: boolean;
    messagesSeeOnline: boolean;
    premiumBadge: boolean;
  };
}

export interface EffectiveBenefitsSnapshot {
  planTier: 'free' | 'essential' | 'gold' | 'platinum' | 'elite';
  flags: {
    likes_identity_unlocked: boolean;
    discover_advanced_filters: boolean;
    profile_hide_age_distance: boolean;
    messages_translation: boolean;
    messages_see_online: boolean;
    travel_pass_included: boolean;
    shadowghost_included: boolean;
    premium_badge: boolean;
  };
  byPage: EffectiveBenefitsByPage;
}

export interface GetCheckoutStatusRequest {
  checkoutId: string;
  userId: string;
}

export interface GetCheckoutStatusResponse {
  checkoutId: string;
  status: CheckoutStatus;
  attributed: boolean;
  entitlementSnapshot?: EntitlementSnapshot;
  effectiveBenefits?: EffectiveBenefitsSnapshot;
}

export interface GetEntitlementsResponse {
  userId: string;
  entitlementSnapshot: EntitlementSnapshot | null;
  effectiveBenefits: EffectiveBenefitsSnapshot;
}
