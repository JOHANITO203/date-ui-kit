export interface ProfileMeData {
  profile: {
    first_name?: string | null;
    last_name?: string | null;
    locale?: string | null;
    city?: string | null;
    verified_opt_in?: boolean | null;
  } | null;
  settings: {
    language?: 'en' | 'ru' | null;
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
  city?: string;
  settings?: {
    language?: 'en' | 'ru';
    distanceKm?: number;
    ageMin?: number;
    ageMax?: number;
    genderPreference?: 'everyone' | 'women' | 'men';
    notificationsEnabled?: boolean;
  };
}
