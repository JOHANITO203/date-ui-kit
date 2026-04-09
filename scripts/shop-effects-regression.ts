import assert from "node:assert/strict";
import { offersCatalog } from "../backend/services/payments-service/src/catalog.ts";
import {
  hasMeaningfulEntitlementEffect,
  resolveEntitlementSnapshot,
} from "../backend/services/payments-service/src/entitlements.ts";

const run = () => {
  const missingEffects: string[] = [];

  for (const offer of offersCatalog) {
    const snapshot = resolveEntitlementSnapshot(offer);
    const hasEffect = hasMeaningfulEntitlementEffect(snapshot);
    if (!hasEffect) {
      missingEffects.push(offer.id);
    }
  }

  assert.equal(
    missingEffects.length,
    0,
    `Offers without effective post-purchase effect: ${missingEffects.join(", ")}`,
  );

  // Explicit guard: monthly tiers must grant observable plan+benefits.
  const tierIds = [
    "tier-essential-month",
    "tier-gold-month",
    "tier-platinum-month",
    "tier-elite-month",
  ];
  for (const tierId of tierIds) {
    const tier = offersCatalog.find((offer) => offer.id === tierId);
    assert.ok(tier, `Missing tier in catalog: ${tierId}`);
    const snapshot = resolveEntitlementSnapshot(tier!);
    assert.ok(snapshot.planTier, `${tierId} must set planTier`);
    assert.ok(snapshot.planExpiresAtIso, `${tierId} must set planExpiresAtIso`);
    assert.ok(
      snapshot.balancesDelta &&
        Object.values(snapshot.balancesDelta).some((value) => Number(value ?? 0) > 0),
      `${tierId} must grant at least one quantifiable benefit`,
    );
  }

  const expirableOfferIds = [
    "tier-essential-month",
    "tier-gold-month",
    "tier-platinum-month",
    "tier-elite-month",
    "instant-travel-pass",
    "instant-shadowghost",
    "pass-day",
    "pass-week",
    "pass-month",
    "pass-travel-pass-plus",
    "bundle-dating-pro",
    "bundle-premium-plus",
  ];

  const now = Date.now();
  for (const offerId of expirableOfferIds) {
    const offer = offersCatalog.find((entry) => entry.id === offerId);
    assert.ok(offer, `Missing offer in catalog: ${offerId}`);
    const first = resolveEntitlementSnapshot(offer!);
    const second = resolveEntitlementSnapshot(offer!);

    const firstExpiry =
      first.planExpiresAtIso ??
      first.travelPass?.expiresAtIso ??
      first.shadowGhost?.expiresAtIso;
    const secondExpiry =
      second.planExpiresAtIso ??
      second.travelPass?.expiresAtIso ??
      second.shadowGhost?.expiresAtIso;

    assert.ok(firstExpiry, `${offerId} must expose an expiration at attribution time`);
    assert.ok(secondExpiry, `${offerId} must expose a fresh expiration at attribution time`);

    const firstMs = new Date(firstExpiry!).getTime();
    const secondMs = new Date(secondExpiry!).getTime();
    assert.ok(
      Number.isFinite(firstMs) && firstMs > now,
      `${offerId} expiration must be in the future (first snapshot)`,
    );
    assert.ok(
      Number.isFinite(secondMs) && secondMs > now,
      `${offerId} expiration must be in the future (second snapshot)`,
    );
  }

  // eslint-disable-next-line no-console
  console.log("[shop-effects-regression] ok");
};

run();
