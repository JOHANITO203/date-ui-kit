import type {
  ChatMessage,
  ConversationSummary,
  ConversationRelationState,
  ProfileCard,
} from "./types";

const now = Date.now();
const isoFromOffsetMinutes = (offsetMinutes: number) =>
  new Date(now - offsetMinutes * 60_000).toISOString();

const profiles: ProfileCard[] = [
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
    ],
    compatibility: 94,
    interests: ["Art", "Travel", "Wine"],
    online: true,
    flags: {
      verifiedIdentity: true,
      premiumTier: "gold",
      hideAge: false,
      hideDistance: false,
      shadowGhost: false,
    },
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
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=800&q=80",
    ],
    compatibility: 88,
    interests: ["Tech", "Coffee", "Design"],
    online: true,
    flags: {
      verifiedIdentity: true,
      premiumTier: "essential",
      hideAge: false,
      hideDistance: false,
      shadowGhost: false,
    },
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
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80",
    ],
    compatibility: 91,
    interests: ["Architecture", "Photography", "Pizza"],
    online: false,
    flags: {
      verifiedIdentity: false,
      premiumTier: "free",
      shortPassTier: "day",
      hideAge: true,
      hideDistance: false,
      shadowGhost: false,
    },
  },
  {
    id: "u-5",
    name: "Lina",
    age: 25,
    city: "Moscow",
    distanceKm: 3,
    languages: ["Russian", "English"],
    bio: "Food photographer and jazz fan.",
    photos: [
      "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=1200&q=80",
    ],
    compatibility: 96,
    interests: ["Music", "Food", "Photo"],
    online: true,
    flags: {
      verifiedIdentity: true,
      premiumTier: "free",
      hideAge: false,
      hideDistance: false,
      shadowGhost: false,
    },
  },
];

const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
export const getProfileById = (profileId: string) => profileById.get(profileId) ?? null;

const conversationsSeed: ConversationSummary[] = [
  {
    id: "conv-u-1",
    peer: profileById.get("u-1")!,
    unreadCount: 2,
    lastMessagePreview: "Hey! I loved your photography.",
    lastMessageAtIso: isoFromOffsetMinutes(14),
    online: true,
    relationState: "active",
  },
  {
    id: "conv-u-2",
    peer: profileById.get("u-2")!,
    unreadCount: 0,
    lastMessagePreview: "You blocked this conversation.",
    lastMessageAtIso: isoFromOffsetMinutes(65),
    online: true,
    relationState: "blocked_by_me",
    relationStateUpdatedAtIso: isoFromOffsetMinutes(63),
  },
  {
    id: "conv-u-3",
    peer: profileById.get("u-3")!,
    unreadCount: 0,
    lastMessagePreview: "Conversation no longer available.",
    lastMessageAtIso: isoFromOffsetMinutes(36),
    online: false,
    relationState: "unmatched",
    relationStateUpdatedAtIso: isoFromOffsetMinutes(35),
  },
  {
    id: "conv-u-5",
    peer: profileById.get("u-5")!,
    unreadCount: 1,
    lastMessagePreview: "This chat started from a SuperLike.",
    lastMessageAtIso: isoFromOffsetMinutes(4),
    online: true,
    relationState: "blocked_me",
    relationStateUpdatedAtIso: isoFromOffsetMinutes(3),
    receivedSuperLikeTraceAtIso: isoFromOffsetMinutes(180),
  },
];

const messagesSeed: Record<string, ChatMessage[]> = {
  "conv-u-1": [
    {
      id: "m-1",
      conversationId: "conv-u-1",
      senderUserId: "u-1",
      direction: "incoming",
      originalText: "Hey! I saw your profile and loved your photography.",
      translatedText: "Hey! I saw your profile and loved your photography.",
      translated: true,
      targetLocale: "en",
      createdAtIso: isoFromOffsetMinutes(45),
    },
    {
      id: "m-2",
      conversationId: "conv-u-1",
      senderUserId: "me",
      direction: "outgoing",
      originalText: "Thanks! That photo was taken in Iceland last summer.",
      translated: false,
      createdAtIso: isoFromOffsetMinutes(41),
      readAtIso: isoFromOffsetMinutes(40),
    },
  ],
  "conv-u-2": [
    {
      id: "m-4",
      conversationId: "conv-u-2",
      senderUserId: "u-2",
      direction: "incoming",
      originalText: "Coffee this week?",
      translated: false,
      createdAtIso: isoFromOffsetMinutes(80),
    },
  ],
  "conv-u-3": [
    {
      id: "m-6",
      conversationId: "conv-u-3",
      senderUserId: "u-3",
      direction: "incoming",
      originalText: "We are not a match anymore.",
      translated: false,
      createdAtIso: isoFromOffsetMinutes(36),
    },
  ],
  "conv-u-5": [
    {
      id: "m-5",
      conversationId: "conv-u-5",
      senderUserId: "u-5",
      direction: "incoming",
      originalText: "SuperLike landed. Want to chat tonight?",
      translated: false,
      createdAtIso: isoFromOffsetMinutes(10),
    },
  ],
};

const createConversationForProfile = (profileId: string, fromSuperLike = false): ConversationSummary | null => {
  const profile = profileById.get(profileId);
  if (!profile) return null;

  return {
    id: `conv-${profileId}`,
    peer: profile,
    unreadCount: 0,
    lastMessagePreview: fromSuperLike
      ? "This chat started from a SuperLike."
      : "New match. Say hello.",
    lastMessageAtIso: new Date().toISOString(),
    online: profile.online,
    relationState: "active",
    receivedSuperLikeTraceAtIso: fromSuperLike ? new Date().toISOString() : undefined,
  };
};

const createWelcomeMessage = (conversationId: string, profileId: string, fromSuperLike = false): ChatMessage => ({
  id: `m-${Date.now()}`,
  conversationId,
  senderUserId: profileId,
  direction: "incoming",
  originalText: fromSuperLike
    ? "SuperLike landed. Want to chat tonight?"
    : "We matched. Nice to meet you!",
  translated: false,
  createdAtIso: new Date().toISOString(),
});

export type ChatStore = {
  conversations: ConversationSummary[];
  messagesByConversation: Record<string, ChatMessage[]>;
};

export const createStore = (): ChatStore => ({
  conversations: [...conversationsSeed],
  messagesByConversation: Object.fromEntries(
    Object.entries(messagesSeed).map(([conversationId, items]) => [conversationId, [...items]]),
  ),
});

export const ensureConversationForProfile = (
  store: ChatStore,
  profileId: string,
  fromSuperLike = false,
) => {
  const conversationId = `conv-${profileId}`;
  const existing = store.conversations.find((entry) => entry.id === conversationId);
  if (existing) return existing;

  const created = createConversationForProfile(profileId, fromSuperLike);
  if (!created) return null;

  store.conversations = [created, ...store.conversations];
  store.messagesByConversation[conversationId] = [
    createWelcomeMessage(conversationId, profileId, fromSuperLike),
  ];

  return created;
};

export const updateRelationPreview = (state: ConversationRelationState, previous: string) => {
  if (state === "blocked_by_me") return "You blocked this conversation.";
  if (state === "blocked_me") return "You were blocked by this user.";
  if (state === "unmatched") return "Conversation no longer available.";
  return previous === "You blocked this conversation." || previous === "Conversation no longer available."
    ? "Conversation reopened."
    : previous;
};

export const sortConversations = (items: ConversationSummary[]) =>
  [...items].sort(
    (a, b) => new Date(b.lastMessageAtIso).getTime() - new Date(a.lastMessageAtIso).getTime(),
  );
