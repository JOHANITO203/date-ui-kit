import assert from "node:assert/strict";
import { offerSchema, offersCatalog } from "../backend/services/payments-service/src/catalog.ts";
import {
  hasMeaningfulEntitlementEffect,
  resolveEntitlementSnapshot,
} from "../backend/services/payments-service/src/entitlements.ts";
import { env } from "../backend/services/payments-service/src/config.ts";
import { supabaseServiceClient } from "../backend/services/payments-service/src/lib/supabaseClient.ts";

const run = async () => {
  const requiredIds = offersCatalog.map((offer) => offer.id);

  const missingHandlers = offersCatalog
    .filter((offer) => !hasMeaningfulEntitlementEffect(resolveEntitlementSnapshot(offer)))
    .map((offer) => offer.id);
  assert.equal(
    missingHandlers.length,
    0,
    `Catalog offers without actionable entitlement handler: ${missingHandlers.join(", ")}`,
  );

  assert.ok(
    env.hasSupabase && supabaseServiceClient,
    "Supabase service role is required for catalog DB integrity check.",
  );

  const { data, error } = await supabaseServiceClient!
    .from("in_app_offers")
    .select("id,label,description,tag,amount_minor,currency_numeric,type,duration_hours,is_active");
  assert.ifError(error);

  const dbRows = (data ?? []) as Array<{
    id: string;
    is_active: boolean;
    type: string;
    label: string;
    description: string;
    tag: string | null;
    amount_minor: number;
    currency_numeric: number;
    duration_hours: number | null;
  }>;
  const dbById = new Map(dbRows.map((row) => [row.id, row]));

  const missingInDb = requiredIds.filter((id) => !dbById.has(id));
  assert.equal(
    missingInDb.length,
    0,
    `Required offers missing in DB table in_app_offers: ${missingInDb.join(", ")}`,
  );

  const inactiveInDb = requiredIds.filter((id) => dbById.get(id)?.is_active !== true);
  assert.equal(
    inactiveInDb.length,
    0,
    `Required offers present but inactive in DB: ${inactiveInDb.join(", ")}`,
  );

  const mismatches = offersCatalog.flatMap((offer) => {
    const db = dbById.get(offer.id);
    if (!db) return [];
    const issues: string[] = [];
    if (db.type !== offer.type) issues.push(`type(db=${db.type},code=${offer.type})`);
    if (Number(db.amount_minor) !== offer.amountMinor) {
      issues.push(`amount_minor(db=${db.amount_minor},code=${offer.amountMinor})`);
    }
    if (Number(db.currency_numeric) !== offer.currencyNumeric) {
      issues.push(`currency_numeric(db=${db.currency_numeric},code=${offer.currencyNumeric})`);
    }
    return issues.length > 0 ? [`${offer.id}: ${issues.join("; ")}`] : [];
  });

  assert.equal(
    mismatches.length,
    0,
    `Catalog DB rows mismatch with source catalog: ${mismatches.join(" | ")}`,
  );

  const parseErrors = offersCatalog.flatMap((offer) => {
    const db = dbById.get(offer.id);
    if (!db) return [];
    const parsed = offerSchema.safeParse({
      id: db.id,
      label: db.label,
      description: db.description,
      tag: db.tag ?? undefined,
      amountMinor: db.amount_minor,
      currencyNumeric: db.currency_numeric,
      type: db.type,
      durationHours: db.duration_hours ?? undefined,
    });
    return parsed.success ? [] : [offer.id];
  });
  assert.equal(
    parseErrors.length,
    0,
    `Catalog DB rows not parseable as Offer schema: ${parseErrors.join(", ")}`,
  );

  // eslint-disable-next-line no-console
  console.log("[payments-catalog-regression] ok");
};

void run();
