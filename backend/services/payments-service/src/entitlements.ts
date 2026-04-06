import type { Offer } from "./catalog";

export type PlanTier = "free" | "essential" | "gold" | "platinum" | "elite";

export type EntitlementSnapshot = {
  planTier?: PlanTier;
  planExpiresAtIso?: string;
  balancesDelta?: {
    boostsLeft?: number;
    superlikesLeft?: number;
    rewindsLeft?: number;
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

const computeExpiry = (durationHours: number) =>
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
  };

  const hasBalances =
    mergedBalances.boostsLeft > 0 ||
    mergedBalances.superlikesLeft > 0 ||
    mergedBalances.rewindsLeft > 0;

  return {
    planTier: nextIncoming.planTier ?? base.planTier,
    planExpiresAtIso: nextIncoming.planExpiresAtIso ?? base.planExpiresAtIso,
    balancesDelta: hasBalances ? mergedBalances : undefined,
    travelPass: nextIncoming.travelPass ?? base.travelPass,
    shadowGhost: nextIncoming.shadowGhost ?? base.shadowGhost,
  };
};

export const resolveEntitlementSnapshot = (offer: Offer): EntitlementSnapshot => {
  switch (offer.id) {
    case "tier-essential-month":
      return { planTier: "essential", planExpiresAtIso: computeExpiry(24 * 30) };
    case "tier-gold-month":
      return { planTier: "gold", planExpiresAtIso: computeExpiry(24 * 30) };
    case "tier-platinum-month":
      return { planTier: "platinum", planExpiresAtIso: computeExpiry(24 * 30) };
    case "tier-elite-month":
      return { planTier: "elite", planExpiresAtIso: computeExpiry(24 * 30) };
    case "instant-boost":
      return { balancesDelta: { boostsLeft: 1 } };
    case "instant-superlike":
      return { balancesDelta: { superlikesLeft: 5 } };
    case "instant-rewind-x10":
      return { balancesDelta: { rewindsLeft: 10 } };
    case "instant-travel-pass":
      return {
        travelPass: {
          source: "travel_pass",
          expiresAtIso: computeExpiry(24),
        },
      };
    case "pass-travel-pass-plus":
      return {
        planTier: "essential",
        planExpiresAtIso: computeExpiry(24 * 7),
        travelPass: {
          source: "travel_pass",
          expiresAtIso: computeExpiry(24 * 7),
        },
      };
    case "instant-shadowghost":
      return {
        shadowGhost: {
          source: "shadowghost_item",
          expiresAtIso: computeExpiry(24),
          enablePrivacy: true,
        },
      };
    case "pass-day":
      return { planTier: "essential", planExpiresAtIso: computeExpiry(24) };
    case "pass-week":
      return { planTier: "essential", planExpiresAtIso: computeExpiry(24 * 7) };
    case "pass-month":
      return { planTier: "essential", planExpiresAtIso: computeExpiry(24 * 30) };
    case "bundle-starter":
      return {
        balancesDelta: { boostsLeft: 1, superlikesLeft: 5 },
      };
    case "bundle-dating-pro":
      return {
        balancesDelta: { boostsLeft: 5, superlikesLeft: 20, rewindsLeft: 10 },
        travelPass: {
          source: "bundle_included",
          expiresAtIso: computeExpiry(24 * 30),
        },
      };
    case "bundle-premium-plus":
      return {
        planTier: "elite",
        planExpiresAtIso: computeExpiry(24 * 30),
        balancesDelta: { boostsLeft: 4, superlikesLeft: 20, rewindsLeft: 10 },
        travelPass: {
          source: "bundle_included",
          expiresAtIso: computeExpiry(24 * 30),
        },
      };
    default:
      return {};
  }
};

