import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";

const testPurchaseToEntitlementFlow = async () => {
  process.env.SUPABASE_URL = "";
  process.env.SUPABASE_SERVICE_ROLE = "";
  const { buildServer: buildPaymentsServer } = await import(
    "../backend/services/payments-service/dist/server.js"
  );
  const app = buildPaymentsServer();
  await app.ready();

  try {
    const catalogResponse = await app.inject({
      method: "GET",
      url: "/payments/catalog",
    });
    assert.equal(catalogResponse.statusCode, 200, "Catalog endpoint should be available.");
    const catalogJson = catalogResponse.json();
    assert(Array.isArray(catalogJson.offers), "Catalog should return offers array.");

    const checkoutResponse = await app.inject({
      method: "POST",
      url: "/payments/checkout",
      payload: {
        offerId: "instant-boost",
        userId: "u-test-wave-b",
        successUrl: "http://localhost:3000/boost",
      },
    });
    assert.equal(checkoutResponse.statusCode, 200, "Checkout should be created.");
    const checkoutJson = checkoutResponse.json();
    assert.ok(checkoutJson.checkoutId, "Checkout response should include checkoutId.");

    await delay(3200);

    const statusResponse = await app.inject({
      method: "POST",
      url: "/payments/checkout/status",
      payload: {
        checkoutId: checkoutJson.checkoutId,
        userId: "u-test-wave-b",
      },
    });
    assert.equal(statusResponse.statusCode, 200, "Checkout status should resolve.");
    const statusJson = statusResponse.json();
    assert.equal(statusJson.status, "paid", "Checkout should become paid in mock mode.");
    assert.equal(statusJson.attributed, true, "Paid checkout should be attributed.");
    assert.equal(
      statusJson.entitlementSnapshot?.balancesDelta?.boostsLeft,
      1,
      "Instant boost purchase should grant one boost entitlement.",
    );
  } finally {
    await app.close();
  }
};

const testBlockAndReportFlow = async () => {
  process.env.SUPABASE_URL = "";
  process.env.SUPABASE_SERVICE_ROLE = "";
  const { buildServer: buildSafetyServer } = await import(
    "../backend/services/safety-service/dist/server.js"
  );
  const app = buildSafetyServer();
  await app.ready();

  try {
    const blockResponse = await app.inject({
      method: "POST",
      url: "/safety/blocks?userId=u-owner",
      payload: { userId: "u-target" },
    });
    assert.equal(blockResponse.statusCode, 200, "Block should succeed.");

    const listResponse = await app.inject({
      method: "GET",
      url: "/safety/blocks?userId=u-owner",
    });
    assert.equal(listResponse.statusCode, 200, "Block list should be readable.");
    const listJson = listResponse.json();
    assert.equal(listJson.blocks.length, 1, "Blocked user should appear in list.");
    assert.equal(listJson.blocks[0].blockedUserId, "u-target");

    const reportResponse = await app.inject({
      method: "POST",
      url: "/safety/reports?userId=u-owner",
      payload: {
        userId: "u-target",
        reason: "abuse",
        note: "Critical check report",
      },
    });
    assert.equal(reportResponse.statusCode, 200, "Report should succeed.");
    const reportJson = reportResponse.json();
    assert.equal(reportJson.status, "reported");

    const unblockResponse = await app.inject({
      method: "DELETE",
      url: "/safety/blocks/u-target?userId=u-owner",
    });
    assert.equal(unblockResponse.statusCode, 200, "Unblock should succeed.");
    const unblockJson = unblockResponse.json();
    assert.equal(unblockJson.status, "unblocked");
  } finally {
    await app.close();
  }
};

const run = async () => {
  await testPurchaseToEntitlementFlow();
  await testBlockAndReportFlow();
  console.log("wave-b-critical-check: all checks passed");
};

await run();
