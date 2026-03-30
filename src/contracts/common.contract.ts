export type PlanTier = 'free' | 'essential' | 'gold' | 'platinum' | 'elite';
export type ShortPassTier = 'day' | 'week';

export type CityId = 'voronezh' | 'moscow' | 'saint-petersburg' | 'sochi';

export type GenderPreference = 'men' | 'women' | 'everyone';

export type ProfileVisibilityState = 'public' | 'limited' | 'hidden';

export interface TokenBalance {
  superlikesLeft: number;
  boostsLeft: number;
  rewindsLeft: number;
}

export interface ProfileFlags {
  verifiedIdentity: boolean;
  premiumTier: PlanTier;
  shortPassTier?: ShortPassTier;
  hideAge: boolean;
  hideDistance: boolean;
  shadowGhost: boolean;
}

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
  flags: ProfileFlags;
}
