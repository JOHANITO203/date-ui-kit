import type { CityId, GenderPreference, PlanTier, ProfileVisibilityState, TokenBalance } from './common.contract';

export type TravelPassEntitlementSource = 'none' | 'travel_pass' | 'bundle_included';
export type TravelPassServerAccessSource =
  | 'none'
  | 'travel_pass'
  | 'bundle_included'
  | 'plan_included';
export type ShadowGhostEntitlementSource = 'none' | 'shadowghost_item';

export interface PrivacySettings {
  visibility: ProfileVisibilityState;
  hideAge: boolean;
  hideDistance: boolean;
  shadowGhost: boolean;
  incognito: boolean;
  readReceipts: boolean;
}

export interface NotificationSettings {
  matches: boolean;
  messages: boolean;
  likes: boolean;
  offers: boolean;
}

export interface TranslationSettings {
  autoDetectEnabled: boolean;
  targetLocale: 'en' | 'ru';
}

export interface PreferenceSettings {
  distanceKm: number;
  ageMin: number;
  ageMax: number;
  genderPreference: GenderPreference;
  language: 'en' | 'ru';
  travelPassCity?: CityId;
  travelPassEntitlementSource?: TravelPassEntitlementSource;
  travelPassEntitlementExpiresAtIso?: string;
  shadowGhostEntitlementSource?: ShadowGhostEntitlementSource;
  shadowGhostEntitlementExpiresAtIso?: string;
}

export interface UserSettings {
  account: {
    phone: string;
    email: string;
  };
  privacy: PrivacySettings;
  notifications: NotificationSettings;
  preferences: PreferenceSettings;
  translation: TranslationSettings;
}

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

export interface SettingsEnvelope {
  userId: string;
  planTier: PlanTier;
  balances: TokenBalance;
  settings: UserSettings;
  travelPassServerAccess: {
    canChangeServer: boolean;
    source: TravelPassServerAccessSource;
    expiresAtIso?: string;
  };
}

export interface GetSettingsResponse {
  payload: SettingsEnvelope;
}

export interface PatchSettingsRequest {
  patch: DeepPartial<UserSettings>;
}

export interface PatchSettingsResponse {
  payload: SettingsEnvelope;
}
