import type { PlanTier } from '../contracts';
import type { ShadowGhostEntitlementSource } from '../contracts/settings.contract';

type ResolveShadowGhostAccessInput = {
  planTier: PlanTier;
  entitlementSource?: ShadowGhostEntitlementSource;
  entitlementExpiresAtIso?: string;
};

type ShadowGhostAccess = {
  canUse: boolean;
  source: 'none' | 'shadowghost_item' | 'plan_included';
  expiresAtIso?: string;
};

const hasValidExpiry = (expiresAtIso?: string): boolean => {
  if (!expiresAtIso) return true;
  return new Date(expiresAtIso).getTime() > Date.now();
};

export const resolveShadowGhostAccess = ({
  planTier,
  entitlementSource = 'none',
  entitlementExpiresAtIso,
}: ResolveShadowGhostAccessInput): ShadowGhostAccess => {
  if (planTier === 'platinum' || planTier === 'elite') {
    return {
      canUse: true,
      source: 'plan_included',
    };
  }

  if (entitlementSource === 'shadowghost_item' && hasValidExpiry(entitlementExpiresAtIso)) {
    return {
      canUse: true,
      source: 'shadowghost_item',
      expiresAtIso: entitlementExpiresAtIso,
    };
  }

  return {
    canUse: false,
    source: 'none',
  };
};

