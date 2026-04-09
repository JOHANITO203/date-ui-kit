import type { PlanTier } from '../contracts';

export type SubscriptionBenefitKey =
  | 'likes_identity_unlocked'
  | 'discover_advanced_filters'
  | 'profile_hide_age_distance'
  | 'messages_translation'
  | 'messages_see_online'
  | 'travel_pass_included'
  | 'shadowghost_included'
  | 'premium_badge';

export type SubscriptionPageKey = 'discover' | 'boost' | 'profile' | 'messages';

const PLAN_BENEFITS: Record<PlanTier, SubscriptionBenefitKey[]> = {
  free: [],
  essential: ['likes_identity_unlocked', 'messages_translation', 'premium_badge'],
  gold: [
    'likes_identity_unlocked',
    'messages_translation',
    'premium_badge',
    'discover_advanced_filters',
    'profile_hide_age_distance',
  ],
  platinum: [
    'likes_identity_unlocked',
    'messages_translation',
    'premium_badge',
    'discover_advanced_filters',
    'profile_hide_age_distance',
    'messages_see_online',
    'travel_pass_included',
    'shadowghost_included',
  ],
  elite: [
    'likes_identity_unlocked',
    'messages_translation',
    'premium_badge',
    'discover_advanced_filters',
    'profile_hide_age_distance',
    'messages_see_online',
    'travel_pass_included',
    'shadowghost_included',
  ],
};

const PAGE_BENEFIT_MAP: Record<SubscriptionPageKey, SubscriptionBenefitKey[]> = {
  discover: ['discover_advanced_filters'],
  boost: [
    'likes_identity_unlocked',
    'messages_translation',
    'discover_advanced_filters',
    'profile_hide_age_distance',
    'messages_see_online',
    'travel_pass_included',
    'shadowghost_included',
    'premium_badge',
  ],
  profile: ['profile_hide_age_distance', 'travel_pass_included', 'shadowghost_included', 'premium_badge'],
  messages: ['messages_translation', 'messages_see_online', 'premium_badge'],
};

export const getSubscriptionBenefitsForPlan = (planTier: PlanTier): SubscriptionBenefitKey[] =>
  PLAN_BENEFITS[planTier];

export const hasSubscriptionBenefit = (
  planTier: PlanTier,
  benefit: SubscriptionBenefitKey,
): boolean => PLAN_BENEFITS[planTier].includes(benefit);

export const getSubscriptionBenefitsForPage = (
  planTier: PlanTier,
  page: SubscriptionPageKey,
) => {
  const allBenefits = PLAN_BENEFITS[planTier];
  const pageBenefits = PAGE_BENEFIT_MAP[page];
  return pageBenefits.filter((benefit) => allBenefits.includes(benefit));
};
