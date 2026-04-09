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

  // eslint-disable-next-line no-console
  console.log("[shop-effects-regression] ok");
};

run();
