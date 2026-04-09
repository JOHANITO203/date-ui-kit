import assert from "node:assert/strict";
import { offersCatalog } from "../backend/services/payments-service/src/catalog.ts";
import { buildServer } from "../backend/services/payments-service/src/server.ts";

const run = async () => {
  const app = buildServer();
  try {
    await app.listen({ port: 0, host: "127.0.0.1" });
    const address = app.server.address();
    assert.ok(address && typeof address === "object", "Failed to resolve ephemeral port for test server.");
    const url = `http://127.0.0.1:${address.port}/payments/catalog`;

    const res = await fetch(url);
    assert.equal(res.status, 200, `Expected /payments/catalog=200, got ${res.status}`);
    const body = (await res.json()) as {
      offers?: Array<{ id: string }>;
      degraded?: boolean;
      code?: string;
    };

    assert.ok(Array.isArray(body.offers), "Expected /payments/catalog response to include offers[]");
    const ids = new Set((body.offers ?? []).map((offer) => offer.id));
    const missing = offersCatalog.map((offer) => offer.id).filter((id) => !ids.has(id));

    assert.equal(
      missing.length,
      0,
      `Endpoint returned incomplete catalog (missing required IDs): ${missing.join(", ")}`,
    );

    // In strict mode this must stay false; in fallback mode this flips true and is still explicit.
    assert.notEqual(
      body.degraded,
      undefined,
      "Endpoint must expose 'degraded' state explicitly to avoid silent fallback.",
    );

    // eslint-disable-next-line no-console
    console.log("[payments-catalog-endpoint-regression] ok");
  } finally {
    await app.close();
  }
};

void run();

