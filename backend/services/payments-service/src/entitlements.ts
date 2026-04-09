import type { Offer } from "./catalog";

export type PlanTier = "free" | "essential" | "gold" | "platinum" | "elite";
export type SubscriptionBenefitKey =
  | "likes_identity_unlocked"
  | "discover_advanced_filters"
  | "profile_hide_age_distance"
  | "messages_translation"
  | "messages_see_online"
  | "travel_pass_included"
  | "shadowghost_included"
  | "premium_badge";

export type EffectiveBenefitsByPage = {
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
};

export type EffectiveBenefitsSnapshot = {
  planTier: PlanTier;
  flags: Record<SubscriptionBenefitKey, boolean>;
  byPage: EffectiveBenefitsByPage;
};

const planBenefits: Record<PlanTier, SubscriptionBenefitKey[]> = {
  free: [],
  essential: ["likes_identity_unlocked", "messages_translation", "premium_badge"],
  gold: [
    "likes_identity_unlocked",
    "messages_translation",
    "premium_badge",
    "discover_advanced_filters",
    "profile_hide_age_distance",
  ],
  platinum: [
    "likes_identity_unlocked",
    "messages_translation",
    "premium_badge",
    "discover_advanced_filters",
    "profile_hide_age_distance",
    "messages_see_online",
    "travel_pass_included",
    "shadowghost_included",
  ],
  elite: [
    "likes_identity_unlocked",
    "messages_translation",
    "premium_badge",
    "discover_advanced_filters",
    "profile_hide_age_distance",
    "messages_see_online",
    "travel_pass_included",
    "shadowghost_included",
  ],
};

const hasPlanBenefit = (planTier: PlanTier, benefit: SubscriptionBenefitKey) =>
  planBenefits[planTier].includes(benefit);

export type EntitlementSnapshot = {
  planTier?: PlanTier;
  planExpiresAtIso?: string;
  balancesDelta?: {
    boostsLeft?: number;
    superlikesLeft?: number;
    rewindsLeft?: number;
    icebreakersLeft?: number;
  };
  travelPass?: {
    source: "travel_pass" | "bundle_included";
    expiresAtIso: string;
  };
  shadowGhost?: {
    source: "shadowghost_item";
    expiresAtIso: string;
    enablePrivacy: boolean;
  };
};

type OfferEffectDefinition = {
  resolveSnapshot: () => EntitlementSnapshot;
  summary: string;
};

const computeExpiryFromNow = (durationHours: number) =>
  new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString();

const isIsoActive = (value?: string) => {
  if (!value) return false;
  const ms = new Date(value).getTime();
  if (!Number.isFinite(ms)) return false;
  return ms > Date.now();
};

export const sanitizeEntitlementSnapshot = (
  snapshot: EntitlementSnapshot | null | undefined,
): EntitlementSnapshot | null => {
  if (!snapshot) return null;

  const next: EntitlementSnapshot = {
    planTier: snapshot.planTier,
    planExpiresAtIso: snapshot.planExpiresAtIso,
    balancesDelta: snapshot.balancesDelta,
  };

  if (!snapshot.planTier || !isIsoActive(snapshot.planExpiresAtIso)) {
    delete next.planTier;
    delete next.planExpiresAtIso;
  }

  if (snapshot.travelPass && isIsoActive(snapshot.travelPass.expiresAtIso)) {
    next.travelPass = snapshot.travelPass;
  }

  if (snapshot.shadowGhost && isIsoActive(snapshot.shadowGhost.expiresAtIso)) {
    next.shadowGhost = snapshot.shadowGhost;
  }
  const hasAny =
    Boolean(next.planTier) ||
    Boolean(next.balancesDelta) ||
    Boolean(next.travelPass) ||
    Boolean(next.shadowGhost);

  return hasAny ? next : null;
};

export const mergeEntitlementSnapshots = (
  previous: EntitlementSnapshot | null | undefined,
  incoming: EntitlementSnapshot,
): EntitlementSnapshot => {
  const base = sanitizeEntitlementSnapshot(previous) ?? {};
  const nextIncoming = sanitizeEntitlementSnapshot(incoming) ?? {};

  const mergedBalances = {
    boostsLeft:
      (base.balancesDelta?.boostsLeft ?? 0) + (nextIncoming.balancesDelta?.boostsLeft ?? 0),
    superlikesLeft:
      (base.balancesDelta?.superlikesLeft ?? 0) +
      (nextIncoming.balancesDelta?.superlikesLeft ?? 0),
    rewindsLeft:
      (base.balancesDelta?.rewindsLeft ?? 0) + (nextIncoming.balancesDelta?.rewindsLeft ?? 0),
    icebreakersLeft:
      (base.balancesDelta?.icebreakersLeft ?? 0) +
      (nextIncoming.balancesDelta?.icebreakersLeft ?? 0),
  };

  const hasBalances =
    mergedBalances.boostsLeft > 0 ||
    mergedBalances.superlikesLeft > 0 ||
    mergedBalances.rewindsLeft > 0 ||
    mergedBalances.icebreakersLeft > 0;

  return {
    planTier: nextIncoming.planTier ?? base.planTier,
    planExpiresAtIso: nextIncoming.planExpiresAtIso ?? base.planExpiresAtIso,
    balancesDelta: hasBalances ? mergedBalances : undefined,
    travelPass: nextIncoming.travelPass ?? base.travelPass,
    shadowGhost: nextIncoming.shadowGhost ?? base.shadowGhost,
  };
};

const MONTH_HOURS = 24 * 30;

const offerEffectsById: Record<string, OfferEffectDefinition> = {
  "tier-essential-month": {
    resolveSnapshot: () => ({
      planTier: "essential",
      planExpiresAtIso: computeExpiryFromNow(MONTH_HOURS),
      balancesDelta: { superlikesLeft: 5 },
    }),
    summary: "Essential monthly plan + starter superlikes allocation",
  },
  "tier-gold-month": {
    resolveSnapshot: () => ({
      planTier: "gold",
      planExpiresAtIso: computeExpiryFromNow(MONTH_HOURS),
      balancesDelta: { superlikesLeft: 10, boostsLeft: 4, rewindsLeft: 12 },
    }),
    summary: "Gold monthly plan + included boosts/superlikes/rewinds allocation",
  },
  "tier-platinum-month": {
    resolveSnapshot: () => ({
      planTier: "platinum",
      planExpiresAtIso: computeExpiryFromNow(MONTH_HOURS),
      balancesDelta: { superlikesLeft: 20, boostsLeft: 30, rewindsLeft: 30 },
    }),
    summary: "Platinum monthly plan + high included token allocation",
  },
  "tier-elite-month": {
    resolveSnapshot: () => ({
      planTier: "elite",
      planExpiresAtIso: computeExpiryFromNow(MONTH_HOURS),
      balancesDelta: { superlikesLeft: 30, boostsLeft: 45, rewindsLeft: 45, icebreakersLeft: 5 },
    }),
    summary: "Elite monthly plan + top included token allocation",
  },

  "instant-boost": {
    resolveSnapshot: () => ({ balancesDelta: { boostsLeft: 1 } }),
    summary: "Single boost token",
  },
  "instant-superlike": {
    resolveSnapshot: () => ({ balancesDelta: { superlikesLeft: 5 } }),
    summary: "SuperLike token pack",
  },
  "instant-icebreaker": {
    resolveSnapshot: () => ({ balancesDelta: { icebreakersLeft: 1 } }),
    summary: "Single IceBreaker item",
  },
  "instant-rewind-x10": {
    resolveSnapshot: () => ({ balancesDelta: { rewindsLeft: 10 } }),
    summary: "Rewind x10 token pack",
  },
  "instant-travel-pass": {
    resolveSnapshot: () => ({
      travelPass: {
        source: "travel_pass",
        expiresAtIso: computeExpiryFromNow(24),
      },
    }),
    summary: "Travel Pass access for 24h",
  },
  "instant-shadowghost": {
    resolveSnapshot: () => ({
      shadowGhost: {
        source: "shadowghost_item",
        expiresAtIso: computeExpiryFromNow(24),
        enablePrivacy: true,
      },
    }),
    summary: "ShadowGhost privacy access for 24h",
  },

  "pass-day": {
    resolveSnapshot: () => ({
      planTier: "essential",
      planExpiresAtIso: computeExpiryFromNow(24),
    }),
    summary: "Essential short pass (24h)",
  },
  "pass-week": {
    resolveSnapshot: () => ({
      planTier: "essential",
      planExpiresAtIso: computeExpiryFromNow(24 * 7),
    }),
    summary: "Essential short pass (7d)",
  },
  "pass-month": {
    resolveSnapshot: () => ({
      planTier: "essential",
      planExpiresAtIso: computeExpiryFromNow(MONTH_HOURS),
      balancesDelta: { superlikesLeft: 5 },
    }),
    summary: "Essential monthly pass + starter superlikes allocation",
  },
  "pass-travel-pass-plus": {
    resolveSnapshot: () => ({
      planTier: "essential",
      planExpiresAtIso: computeExpiryFromNow(24 * 7),
      travelPass: {
        source: "travel_pass",
        expiresAtIso: computeExpiryFromNow(24 * 7),
      },
    }),
    summary: "Essential weekly pass + Travel Pass+ access",
  },

  "bundle-starter": {
    resolveSnapshot: () => ({
      balancesDelta: { boostsLeft: 1, superlikesLeft: 5 },
    }),
    summary: "Starter bundle token credits",
  },
  "bundle-dating-pro": {
    resolveSnapshot: () => ({
      balancesDelta: { boostsLeft: 5, superlikesLeft: 20, rewindsLeft: 10, icebreakersLeft: 2 },
      travelPass: {
        source: "bundle_included",
        expiresAtIso: computeExpiryFromNow(MONTH_HOURS),
      },
    }),
    summary: "Dating Pro bundle credits + Travel Pass entitlement",
  },
  "bundle-premium-plus": {
    resolveSnapshot: () => ({
      planTier: "elite",
      planExpiresAtIso: computeExpiryFromNow(MONTH_HOURS),
      balancesDelta: { boostsLeft: 4, superlikesLeft: 20, rewindsLeft: 10, icebreakersLeft: 3 },
      travelPass: {
        source: "bundle_included",
        expiresAtIso: computeExpiryFromNow(MONTH_HOURS),
      },
    }),
    summary: "Premium+ bundle with elite plan + credits + travel pass",
  },
};

export const hasMeaningfulEntitlementEffect = (
  snapshot: EntitlementSnapshot | null | undefined,
): boolean => {
  const sanitized = sanitizeEntitlementSnapshot(snapshot);
  return Boolean(sanitized);
};

export const listOfferEffectsAudit = (): Array<{
  offerId: string;
  summary: string;
  hasEffect: boolean;
}> =>
  Object.entries(offerEffectsById).map(([offerId, effect]) => ({
    offerId,
    summary: effect.summary,
    hasEffect: hasMeaningfulEntitlementEffect(effect.resolveSnapshot()),
  }));

export const resolveEntitlementSnapshot = (offer: Offer): EntitlementSnapshot => {
  return offerEffectsById[offer.id]?.resolveSnapshot() ?? {};
};

export const resolveEffectiveBenefitsSnapshot = (
  entitlementSnapshot: EntitlementSnapshot | null | undefined,
): EffectiveBenefitsSnapshot => {
  const sanitized = sanitizeEntitlementSnapshot(entitlementSnapshot);
  const planTier = sanitized?.planTier ?? "free";
  const flags: Record<SubscriptionBenefitKey, boolean> = {
    likes_identity_unlocked: hasPlanBenefit(planTier, "likes_identity_unlocked"),
    discover_advanced_filters: hasPlanBenefit(planTier, "discover_advanced_filters"),
    profile_hide_age_distance: hasPlanBenefit(planTier, "profile_hide_age_distance"),
    messages_translation: hasPlanBenefit(planTier, "messages_translation"),
    messages_see_online: hasPlanBenefit(planTier, "messages_see_online"),
    travel_pass_included: hasPlanBenefit(planTier, "travel_pass_included"),
    shadowghost_included: hasPlanBenefit(planTier, "shadowghost_included"),
    premium_badge: hasPlanBenefit(planTier, "premium_badge"),
  };

  return {
    planTier,
    flags,
    byPage: {
      discover: {
        discoverAdvancedFilters: flags.discover_advanced_filters,
      },
      boost: {
        likesIdentityUnlocked: flags.likes_identity_unlocked,
        discoverAdvancedFilters: flags.discover_advanced_filters,
        profileHideAgeDistance: flags.profile_hide_age_distance,
        messagesTranslation: flags.messages_translation,
        messagesSeeOnline: flags.messages_see_online,
        travelPassIncluded: flags.travel_pass_included,
        shadowGhostIncluded: flags.shadowghost_included,
        premiumBadge: flags.premium_badge,
      },
      profile: {
        profileHideAgeDistance: flags.profile_hide_age_distance,
        travelPassIncluded: flags.travel_pass_included,
        shadowGhostIncluded: flags.shadowghost_included,
        premiumBadge: flags.premium_badge,
      },
      messages: {
        messagesTranslation: flags.messages_translation,
        messagesSeeOnline: flags.messages_see_online,
        premiumBadge: flags.premium_badge,
      },
    },
  };
};
