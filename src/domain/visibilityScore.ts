export type VisibilityScoreInput = {
  photosCount: number;
  hasFirstName: boolean;
  hasCity: boolean;
  hasBio: boolean;
  verifiedIdentity: boolean;
  planTier: 'free' | 'essential' | 'gold' | 'platinum' | 'elite';
  boostActive: boolean;
  boostTokens: number;
  superlikesTokens: number;
  rewindTokens: number;
  travelPassSource: 'none' | 'travel_pass' | 'bundle_included' | 'plan_included';
  shadowGhostActive: boolean;
};

export const VISIBILITY_SCORE_VERSION = 'v1.1';

export const computeVisibilityScore = (input: VisibilityScoreInput) => {
  let score = 15;

  score += Math.min(22, input.photosCount * 5);
  if (input.hasFirstName) score += 8;
  if (input.hasCity) score += 8;
  if (input.hasBio) score += 10;
  if (input.verifiedIdentity) score += 14;

  if (input.planTier === 'essential') score += 3;
  if (input.planTier === 'gold') score += 5;
  if (input.planTier === 'platinum') score += 7;
  if (input.planTier === 'elite') score += 9;

  if (input.boostActive) score += 8;
  if (input.boostTokens > 0) score += 2;
  if (input.superlikesTokens > 0) score += 2;
  if (input.rewindTokens > 0) score += 1;
  if (input.travelPassSource === 'travel_pass') score += 4;
  if (input.travelPassSource === 'bundle_included') score += 3;
  if (input.travelPassSource === 'plan_included') score += 2;
  if (input.shadowGhostActive) score += 4;

  return Math.max(0, Math.min(100, Math.round(score)));
};
