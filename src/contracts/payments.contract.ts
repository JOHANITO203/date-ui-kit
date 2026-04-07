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
}

export type CheckoutStatus = 'pending' | 'paid' | 'failed' | 'not_found';

export interface EntitlementSnapshot {
  planTier?: 'free' | 'essential' | 'gold' | 'platinum' | 'elite';
  planExpiresAtIso?: string;
  balancesDelta?: {
    boostsLeft?: number;
    superlikesLeft?: number;
    rewindsLeft?: number;
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

export interface GetCheckoutStatusRequest {
  checkoutId: string;
  userId: string;
}

export interface GetCheckoutStatusResponse {
  checkoutId: string;
  status: CheckoutStatus;
  attributed: boolean;
  entitlementSnapshot?: EntitlementSnapshot;
}
