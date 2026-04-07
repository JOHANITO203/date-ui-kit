export interface ProfileMeData {
  profile: {
    first_name?: string | null;
    last_name?: string | null;
    locale?: string | null;
    bio?: string | null;
    city?: string | null;
    verified_opt_in?: boolean | null;
  } | null;
  settings: {
    language?: 'en' | 'ru' | null;
    target_lang?: 'en' | 'ru' | 'fr' | null;
    auto_translate?: boolean | null;
    auto_detect_language?: boolean | null;
    precise_location_enabled?: boolean | null;
    visibility?: 'public' | 'limited' | 'hidden' | null;
    hide_age?: boolean | null;
    hide_distance?: boolean | null;
    incognito?: boolean | null;
    read_receipts?: boolean | null;
    shadow_ghost?: boolean | null;
    travel_pass_city?: 'voronezh' | 'moscow' | 'saint-petersburg' | 'sochi' | null;
    phone_country_code?: string | null;
    phone_national_number?: string | null;
    distance_km?: number | null;
    age_min?: number | null;
    age_max?: number | null;
    gender_preference?: 'everyone' | 'women' | 'men' | null;
    notifications_enabled?: boolean | null;
  } | null;
}

export interface PatchProfileMeRequest {
  first_name?: string;
  last_name?: string;
  locale?: string;
  bio?: string;
  city?: string;
  settings?: {
    language?: 'en' | 'ru';
    targetLang?: 'en' | 'ru' | 'fr';
    autoTranslate?: boolean;
    autoDetectLanguage?: boolean;
    preciseLocationEnabled?: boolean;
    visibility?: 'public' | 'limited' | 'hidden';
    hideAge?: boolean;
    hideDistance?: boolean;
    incognito?: boolean;
    readReceipts?: boolean;
    shadowGhost?: boolean;
    travelPassCity?: 'voronezh' | 'moscow' | 'saint-petersburg' | 'sochi';
    phoneCountryCode?: string;
    phoneNationalNumber?: string;
    distanceKm?: number;
    ageMin?: number;
    ageMax?: number;
    genderPreference?: 'everyone' | 'women' | 'men';
    notificationsEnabled?: boolean;
  };
}
