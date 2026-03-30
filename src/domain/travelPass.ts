import type { PlanTier } from '../contracts';
import type { TravelPassEntitlementSource, TravelPassServerAccessSource } from '../contracts/settings.contract';

type ResolveTravelPassServerAccessInput = {
  planTier: PlanTier;
  entitlementSource?: TravelPassEntitlementSource;
  entitlementExpiresAtIso?: string;
};

type TravelPassServerAccess = {
  canChangeServer: boolean;
  source: TravelPassServerAccessSource;
  expiresAtIso?: string;
};

const hasValidExpiry = (expiresAtIso?: string): boolean => {
  if (!expiresAtIso) return true;
  return new Date(expiresAtIso).getTime() > Date.now();
};

export const resolveTravelPassServerAccess = ({
  planTier,
  entitlementSource = 'none',
  entitlementExpiresAtIso,
}: ResolveTravelPassServerAccessInput): TravelPassServerAccess => {
  if (planTier === 'platinum' || planTier === 'elite') {
    return {
      canChangeServer: true,
      source: 'plan_included',
    };
  }

  if (entitlementSource === 'bundle_included' && hasValidExpiry(entitlementExpiresAtIso)) {
    return {
      canChangeServer: true,
      source: 'bundle_included',
      expiresAtIso: entitlementExpiresAtIso,
    };
  }

  if (entitlementSource === 'travel_pass' && hasValidExpiry(entitlementExpiresAtIso)) {
    return {
      canChangeServer: true,
      source: 'travel_pass',
      expiresAtIso: entitlementExpiresAtIso,
    };
  }

  return {
    canChangeServer: false,
    source: 'none',
  };
};
