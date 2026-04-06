export type PlanTier = "free" | "essential" | "gold" | "platinum" | "elite";
export type ShortPassTier = "day" | "week";

export type ProfileFlags = {
  verifiedIdentity: boolean;
  premiumTier: PlanTier;
  shortPassTier?: ShortPassTier;
  hideAge: boolean;
  hideDistance: boolean;
  shadowGhost: boolean;
};

export type FeedCandidate = {
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
  rankScore: number;
  scoreReason: string;
};

export const feedSeed: FeedCandidate[] = [
  {
    id: "u-1",
    name: "Elena",
    age: 24,
    city: "Moscow",
    distanceKm: 2,
    languages: ["English", "Russian"],
    bio: "Art lover and world traveler.",
    photos: [
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=800&q=80"
    ],
    compatibility: 94,
    interests: ["Art", "Travel", "Wine"],
    online: true,
    flags: {
      verifiedIdentity: true,
      premiumTier: "gold",
      hideAge: false,
      hideDistance: false,
      shadowGhost: false
    },
    rankScore: 99,
    scoreReason: "high_compatibility"
  },
  {
    id: "u-2",
    name: "Marcus",
    age: 27,
    city: "Saint Petersburg",
    distanceKm: 5,
    languages: ["English", "French"],
    bio: "Tech enthusiast and coffee addict.",
    photos: [
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=800&q=80"
    ],
    compatibility: 88,
    interests: ["Tech", "Coffee", "Design"],
    online: true,
    flags: {
      verifiedIdentity: true,
      premiumTier: "essential",
      hideAge: false,
      hideDistance: false,
      shadowGhost: false
    },
    rankScore: 93,
    scoreReason: "verified_priority"
  },
  {
    id: "u-3",
    name: "Sofia",
    age: 22,
    city: "Voronezh",
    distanceKm: 1,
    languages: ["Italian", "English"],
    bio: "Architecture student and city explorer.",
    photos: [
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80"
    ],
    compatibility: 91,
    interests: ["Architecture", "Photography"],
    online: false,
    flags: {
      verifiedIdentity: false,
      premiumTier: "free",
      shortPassTier: "day",
      hideAge: true,
      hideDistance: false,
      shadowGhost: false
    },
    rankScore: 89,
    scoreReason: "balanced_discovery"
  }
];
