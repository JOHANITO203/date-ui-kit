import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import formbody from "@fastify/formbody";
import { createVerifier } from "fast-jwt";
import { z } from "zod";
import { env } from "./config.js";
import { offerSchema, offersCatalog, type Offer } from "./catalog.js";
import {
  hasMeaningfulEntitlementEffect,
  listOfferEffectsAudit,
  mergeEntitlementSnapshots,
  resolveEntitlementSnapshot,
  resolveEffectiveBenefitsSnapshot,
  sanitizeEntitlementSnapshot,
  type EntitlementSnapshot,
} from "./entitlements.js";
import { YooKassaClient } from "./providers/yookassaClient.js";
import { timingSafeEqual } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prismaClient } from "./lib/prismaClient.js";
import { consumeRateLimit } from "./rateLimit.js";

type CheckoutState = "pending" | "paid" | "failed";

type CheckoutRow = {
  checkout_id: string;
  yookassa_payment_id: string | null;
  order_number: string;
  user_id: string;
  offer_id: string;
  mode: "mock" | "yookassa";
  status: CheckoutState;
  attributed: boolean;
  entitlement_snapshot: EntitlementSnapshot | null;
  provider_raw: Record<string, unknown> | null;
};

type CatalogCache = {
  fetchedAt: number;
  result: CatalogBuildResult;
};

type CatalogRequiredValidation = {
  requiredOfferIds: string[];
  missingOfferIds: string[];
  offersWithoutEffects: string[];
};

type CatalogBuildResult = {
  offers: Offer[];
  source: "db" | "fallback" | "code";
  degraded: boolean;
  reason?: string;
  validation: CatalogRequiredValidation;
};

const CATALOG_CACHE_TTL_MS = 60_000;

// SECURITY: identity is always derived from the JWT `sub`, never from the body.
// `userId` is intentionally NOT accepted here to avoid mass-assignment.
const checkoutSchema = z.object({
  offerId: z.string().min(1),
  locale: z.string().optional(),
  successUrl: z.string().url().optional(),
  failUrl: z.string().url().optional(),
});

const checkoutStatusSchema = z.object({
  checkoutId: z.string().min(1),
});

const yookassaOrderStatusSchema = z.object({
  paymentId: z.string().min(1),
});

const formatOrderNumber = (offerId: string, userId: string) => {
  const compactOffer = offerId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 18);
  const compactUser = userId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12);
  const timestamp = Date.now();
  return `${compactOffer}_${compactUser}_${timestamp}`;
};

const toCurrencyCode = (currencyNumeric: number) => {
  if (currencyNumeric === 643) return "RUB";
  return "RUB";
};

// SECURITY: only allow the PSP return URL to point back to our own app origin.
// A client-supplied successUrl on a foreign origin is an open-redirect / phishing
// vector branded as our payment flow. Falls back to the configured default.
const sanitizeReturnUrl = (candidate: string | undefined, fallback: string): string => {
  if (!candidate) return fallback;
  try {
    const appOrigin = new URL(env.APP_URL).origin;
    const candidateOrigin = new URL(candidate).origin;
    return candidateOrigin === appOrigin ? candidate : fallback;
  } catch {
    return fallback;
  }
};

const formatAmountValue = (amountMinor: number) => (amountMinor / 100).toFixed(2);

const normalizeYooKassaStatus = (status?: string): CheckoutState => {
  if (status === "succeeded") return "paid";
  if (status === "canceled") return "failed";
  return "pending";
};

const isTransientNetworkError = (error: unknown) => {
  const text = JSON.stringify(error ?? "").toLowerCase();
  return (
    text.includes("econnreset") ||
    text.includes("etimedout") ||
    text.includes("fetch failed") ||
    text.includes("socket hang up") ||
    text.includes("connection terminated")
  );
};

const waitMs = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

const asRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object") return {};
  return value as Record<string, unknown>;
};

const pickString = (container: Record<string, unknown>, keys: string[]): string | undefined => {
  for (const key of keys) {
    const raw = container[key];
    if (typeof raw === "string" && raw.length > 0) return raw;
  }
  return undefined;
};

const pickYooKassaPaymentPayload = (body: Record<string, unknown>) => {
  const event = pickString(body, ["event"]);
  const object = asRecord(body.object);
  const metadata = asRecord(object.metadata);

  const paymentId = pickString(object, ["id"]);
  const paymentStatus = pickString(object, ["status"]);
  const orderNumber = pickString(metadata, ["order_number"]);

  return {
    event,
    paymentId,
    paymentStatus,
    orderNumber,
    object,
  };
};

// SECURITY: with Fastify trustProxy enabled, `fallback` (request.ip) is the real
// client IP resolved from the trusted proxy hop. We must NOT trust the raw
// x-forwarded-for header directly — a client can spoof it to bypass rate limits.
const getRequestIp = (_headers: Record<string, unknown>, fallback: string) => fallback;

const getWebhookSecret = (headers: Record<string, unknown>) => {
  const headerToken = headers["x-yookassa-webhook-secret"];
  if (typeof headerToken === "string" && headerToken.trim()) return headerToken.trim();
  const altHeaderToken = headers["x-webhook-secret"];
  if (typeof altHeaderToken === "string" && altHeaderToken.trim()) return altHeaderToken.trim();
  return "";
};

// Constant-time string comparison to avoid leaking the secret via timing.
const timingSafeEqualStr = (a: string, b: string): boolean => {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
};

const requiredOfferIds = offersCatalog.map((offer) => offer.id);

const validateRequiredCatalog = (offers: Offer[]): CatalogRequiredValidation => {
  const byId = new Map(offers.map((offer) => [offer.id, offer]));
  const missingOfferIds = requiredOfferIds.filter((offerId) => !byId.has(offerId));
  const offersWithoutEffects = requiredOfferIds.filter((offerId) => {
    const offer = byId.get(offerId);
    if (!offer) return false;
    return !hasMeaningfulEntitlementEffect(resolveEntitlementSnapshot(offer));
  });

  return {
    requiredOfferIds,
    missingOfferIds,
    offersWithoutEffects,
  };
};

const isCatalogValidationOk = (validation: CatalogRequiredValidation) =>
  validation.missingOfferIds.length === 0 && validation.offersWithoutEffects.length === 0;

type InternalJwtPayload = {
  sub: string;
  email?: string;
  role?: string;
};

const verifyInternalToken = createVerifier({
  key: env.INTERNAL_JWT_SECRET,
  algorithms: ["HS256"],
});

const extractBearerToken = (request: FastifyRequest) => {
  const header = request.headers.authorization;
  if (!header) return null;
  const trimmed = header.trim();
  if (!trimmed.toLowerCase().startsWith("bearer ")) return null;
  const token = trimmed.slice(7).trim();
  return token.length > 0 ? token : null;
};

const resolveAuthenticatedUserId = (request: FastifyRequest, reply: FastifyReply) => {
  const token = extractBearerToken(request);
  if (!token) {
    reply.status(401);
    return null;
  }

  try {
    const payload = verifyInternalToken(token) as InternalJwtPayload;
    if (!payload?.sub || typeof payload.sub !== "string" || payload.sub.trim().length === 0) {
      reply.status(401);
      return null;
    }
    return payload.sub.trim();
  } catch {
    reply.status(401);
    return null;
  }
};

export const buildServer = () => {
  const app = Fastify({ logger: true, trustProxy: true });

  // SECURITY: only allow localhost dev origins outside production.
  const allowedOrigins = [env.APP_URL];
  if (env.NODE_ENV !== "production") {
    allowedOrigins.push("http://127.0.0.1:3000", "http://localhost:3000");
  }

  app.register(cors, {
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });
  app.register(formbody);

  const yookassa = env.hasYooKassaCredentials ? new YooKassaClient(env.YOOKASSA_BASE_URL) : null;
  const devAutoGrantEnabled = Boolean(env.PAYMENTS_DEV_AUTO_GRANT);
  const checkoutsMemory = new Map<string, CheckoutRow>();
  const entitlementsMemory = new Map<string, EntitlementSnapshot>();
  let catalogCache: CatalogCache | null = null;

  const isRateLimited = (
    key: string,
    max: number,
    windowMs = env.RATE_LIMIT_WINDOW_MS,
  ) => !consumeRateLimit(key, { max, windowMs }).allowed;

  const upsertCheckout = async (row: CheckoutRow) => {
    try {
      await prismaClient.paymentCheckout.upsert({
        where: { checkoutId: row.checkout_id },
        update: {
          yookassaPaymentId: row.yookassa_payment_id,
          orderNumber: row.order_number,
          userId: row.user_id,
          offerId: row.offer_id,
          mode: row.mode,
          status: row.status,
          attributed: row.attributed,
          entitlementSnapshot: (row.entitlement_snapshot ?? undefined) as Prisma.InputJsonValue | undefined,
          providerRaw: (row.provider_raw ?? undefined) as Prisma.InputJsonValue | undefined,
        },
        create: {
          checkoutId: row.checkout_id,
          yookassaPaymentId: row.yookassa_payment_id,
          orderNumber: row.order_number,
          userId: row.user_id,
          offerId: row.offer_id,
          mode: row.mode,
          status: row.status,
          attributed: row.attributed,
          entitlementSnapshot: (row.entitlement_snapshot ?? undefined) as Prisma.InputJsonValue | undefined,
          providerRaw: (row.provider_raw ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });
    } catch {
      checkoutsMemory.set(row.checkout_id, row);
    }
  };

  const getCheckout = async (checkoutId: string, userId: string): Promise<CheckoutRow | null> => {
    try {
      const row = await prismaClient.paymentCheckout.findFirst({
        where: { checkoutId, userId },
      });
      if (!row) return checkoutsMemory.get(checkoutId) ?? null;
      return {
        checkout_id: row.checkoutId,
        yookassa_payment_id: row.yookassaPaymentId ?? null,
        order_number: row.orderNumber,
        user_id: row.userId,
        offer_id: row.offerId,
        mode: row.mode as CheckoutRow["mode"],
        status: row.status as CheckoutState,
        attributed: row.attributed,
        entitlement_snapshot: (row.entitlementSnapshot as EntitlementSnapshot | null) ?? null,
        provider_raw: (row.providerRaw as Record<string, unknown> | null) ?? null,
      };
    } catch {
      const checkout = checkoutsMemory.get(checkoutId);
      if (!checkout || checkout.user_id !== userId) return null;
      return checkout;
    }
  };

  const getCheckoutByPaymentOrOrder = async (input: {
    yookassaPaymentId?: string;
    orderNumber?: string;
  }): Promise<CheckoutRow | null> => {
    const toRow = (row: {
      checkoutId: string;
      yookassaPaymentId: string | null;
      orderNumber: string;
      userId: string;
      offerId: string;
      mode: string;
      status: string;
      attributed: boolean;
      entitlementSnapshot: unknown;
      providerRaw: unknown;
    }): CheckoutRow => ({
      checkout_id: row.checkoutId,
      yookassa_payment_id: row.yookassaPaymentId ?? null,
      order_number: row.orderNumber,
      user_id: row.userId,
      offer_id: row.offerId,
      mode: row.mode as CheckoutRow["mode"],
      status: row.status as CheckoutState,
      attributed: row.attributed,
      entitlement_snapshot: (row.entitlementSnapshot as EntitlementSnapshot | null) ?? null,
      provider_raw: (row.providerRaw as Record<string, unknown> | null) ?? null,
    });

    try {
      if (input.yookassaPaymentId) {
        const row = await prismaClient.paymentCheckout.findFirst({
          where: { yookassaPaymentId: input.yookassaPaymentId },
        });
        if (row) return toRow(row);
      }
      if (input.orderNumber) {
        const row = await prismaClient.paymentCheckout.findFirst({
          where: { orderNumber: input.orderNumber },
        });
        if (row) return toRow(row);
      }
      return null;
    } catch {
      const values = [...checkoutsMemory.values()];
      if (input.yookassaPaymentId) {
        const byPayment = values.find((entry) => entry.yookassa_payment_id === input.yookassaPaymentId);
        if (byPayment) return byPayment;
      }
      if (input.orderNumber) {
        const byOrder = values.find((entry) => entry.order_number === input.orderNumber);
        if (byOrder) return byOrder;
      }
      return null;
    }
  };

  const patchCheckout = async (
    checkoutId: string,
    patch: Partial<Pick<CheckoutRow, "status" | "attributed" | "entitlement_snapshot" | "provider_raw">>,
  ) => {
    try {
      await prismaClient.paymentCheckout.update({
        where: { checkoutId },
        data: {
          ...(patch.status !== undefined && { status: patch.status }),
          ...(patch.attributed !== undefined && { attributed: patch.attributed }),
          ...(patch.entitlement_snapshot !== undefined && {
            entitlementSnapshot: (patch.entitlement_snapshot ?? undefined) as Prisma.InputJsonValue | undefined,
          }),
          ...(patch.provider_raw !== undefined && {
            providerRaw: (patch.provider_raw ?? undefined) as Prisma.InputJsonValue | undefined,
          }),
        },
      });
    } catch {
      const existing = checkoutsMemory.get(checkoutId);
      if (!existing) return;
      checkoutsMemory.set(checkoutId, { ...existing, ...patch });
    }
  };

  const listPendingAttributionCheckouts = async (userId: string): Promise<CheckoutRow[]> => {
    try {
      const rows = await prismaClient.paymentCheckout.findMany({
        where: { userId, status: "paid", attributed: false },
        orderBy: { updatedAt: "desc" },
        take: 20,
      });
      return rows.map((row) => ({
        checkout_id: row.checkoutId,
        yookassa_payment_id: row.yookassaPaymentId ?? null,
        order_number: row.orderNumber,
        user_id: row.userId,
        offer_id: row.offerId,
        mode: row.mode as CheckoutRow["mode"],
        status: row.status as CheckoutState,
        attributed: row.attributed,
        entitlement_snapshot: (row.entitlementSnapshot as EntitlementSnapshot | null) ?? null,
        provider_raw: (row.providerRaw as Record<string, unknown> | null) ?? null,
      }));
    } catch {
      return [...checkoutsMemory.values()].filter(
        (entry) => entry.user_id === userId && entry.status === "paid" && !entry.attributed,
      );
    }
  };

  const saveEntitlement = async (userId: string, snapshot: EntitlementSnapshot) => {
    const sanitized = sanitizeEntitlementSnapshot(snapshot);
    try {
      if (!sanitized) {
        await prismaClient.userEntitlement.deleteMany({ where: { userId } });
        entitlementsMemory.delete(userId);
        return;
      }
      await prismaClient.userEntitlement.upsert({
        where: { userId },
        update: { entitlementSnapshot: sanitized as object },
        create: { userId, entitlementSnapshot: sanitized as object },
      });
      entitlementsMemory.set(userId, sanitized);
    } catch {
      if (sanitized) {
        entitlementsMemory.set(userId, sanitized);
      } else {
        entitlementsMemory.delete(userId);
      }
    }
  };

  const getEntitlement = async (userId: string): Promise<EntitlementSnapshot | null> => {
    try {
      const row = await prismaClient.userEntitlement.findUnique({
        where: { userId },
        select: { entitlementSnapshot: true },
      });
      return sanitizeEntitlementSnapshot(
        (row?.entitlementSnapshot as EntitlementSnapshot | null | undefined) ?? null,
      );
    } catch {
      return sanitizeEntitlementSnapshot(entitlementsMemory.get(userId) ?? null);
    }
  };

  const getCatalog = async (): Promise<CatalogBuildResult> => {
    const now = Date.now();
    if (catalogCache && now - catalogCache.fetchedAt < CATALOG_CACHE_TTL_MS) {
      return catalogCache.result;
    }

    const buildFromCode = (reason?: string): CatalogBuildResult => {
      const validation = validateRequiredCatalog(offersCatalog);
      return {
        offers: offersCatalog,
        source: "code",
        degraded: Boolean(reason),
        reason,
        validation,
      };
    };

    if (env.PAYMENTS_CATALOG_SOURCE === "code") {
      const result = buildFromCode("catalog_source_code_mode");
      catalogCache = { fetchedAt: now, result };
      return result;
    }

    let dbRows: {
      id: string;
      label: string;
      description: string | null;
      tag: string | null;
      amountMinor: number;
      currencyNumeric: number;
      type: string;
      durationHours: number | null;
    }[];
    try {
      dbRows = await prismaClient.inAppOffer.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          label: true,
          description: true,
          tag: true,
          amountMinor: true,
          currencyNumeric: true,
          type: true,
          durationHours: true,
        },
      });
    } catch (dbErr) {
      if (env.PAYMENTS_CATALOG_SOURCE === "db_strict") {
        throw new Error(`catalog_db_query_failed:${dbErr instanceof Error ? dbErr.message : "unknown"}`);
      }
      const fallback = buildFromCode("catalog_db_query_failed");
      app.log.error(
        {
          reason: fallback.reason,
          sourceMode: env.PAYMENTS_CATALOG_SOURCE,
          dbError: dbErr instanceof Error ? dbErr.message : null,
        },
        "payments.catalog.emergency_fallback_used",
      );
      const result = { ...fallback, source: "fallback" as const };
      catalogCache = { fetchedAt: now, result };
      return result;
    }

    const invalidDbRows: string[] = [];
    const parsedOffers = dbRows
      .map((row) => {
        const parsed = offerSchema.safeParse({
          id: row.id,
          label: row.label,
          description: row.description,
          tag: row.tag,
          amountMinor: row.amountMinor,
          currencyNumeric: row.currencyNumeric,
          type: row.type,
          durationHours: row.durationHours ?? undefined,
        });
        if (!parsed.success) {
          invalidDbRows.push(String(row.id ?? "unknown"));
        }
        return parsed;
      })
      .filter((entry): entry is { success: true; data: Offer } => entry.success)
      .map((entry) => entry.data);

    const dbValidation = validateRequiredCatalog(parsedOffers);
    const dbValid = isCatalogValidationOk(dbValidation) && invalidDbRows.length === 0;

    if (dbValid) {
      const result = {
        offers: parsedOffers,
        source: "db" as const,
        degraded: false,
        validation: dbValidation,
      };
      catalogCache = { fetchedAt: now, result };
      return result;
    }

    app.log.error(
      {
        sourceMode: env.PAYMENTS_CATALOG_SOURCE,
        invalidDbRows,
        missingOfferIds: dbValidation.missingOfferIds,
        offersWithoutEffects: dbValidation.offersWithoutEffects,
      },
      "payments.catalog.incomplete_required_offers",
    );

    if (env.PAYMENTS_CATALOG_SOURCE === "db_strict") {
      throw new Error("catalog_db_incomplete_required_offers");
    }

    const fallback = buildFromCode("catalog_db_incomplete_required_offers");
    app.log.error(
      {
        reason: fallback.reason,
        sourceMode: env.PAYMENTS_CATALOG_SOURCE,
      },
      "payments.catalog.emergency_fallback_used",
    );
    const result = { ...fallback, source: "fallback" as const };
    catalogCache = { fetchedAt: now, result };
    return result;
  };

  const getOfferById = async (offerId: string): Promise<Offer | undefined> => {
    const catalogResult = await getCatalog();
    return catalogResult.offers.find((offer) => offer.id === offerId);
  };

  const withTransientRetry = async <T>(action: () => Promise<T>, context: string): Promise<T> => {
    const delays = [200, 600];
    let lastError: unknown;
    for (let attempt = 0; attempt <= delays.length; attempt += 1) {
      try {
        return await action();
      } catch (error) {
        lastError = error;
        if (!isTransientNetworkError(error) || attempt === delays.length) {
          throw error;
        }
        app.log.warn({ err: error, context, attempt: attempt + 1 }, "payments.transient_retry");
        await waitMs(delays[attempt]);
      }
    }
    throw lastError;
  };

  const attributeCheckout = async (checkout: CheckoutRow): Promise<CheckoutRow> => {
    if (checkout.attributed || checkout.status !== "paid") return checkout;
    const offer = await getOfferById(checkout.offer_id);
    if (!offer) return checkout;

    const resolvedSnapshot = resolveEntitlementSnapshot(offer);
    if (!hasMeaningfulEntitlementEffect(resolvedSnapshot)) {
      app.log.error({ checkoutId: checkout.checkout_id, offerId: checkout.offer_id }, "payments.attribute.offer_effect_missing");
      throw new Error(`offer_effect_missing:${offer.id}`);
    }
    const snapshot = sanitizeEntitlementSnapshot(resolvedSnapshot);
    if (!snapshot) {
      app.log.error(
        { checkoutId: checkout.checkout_id, offerId: checkout.offer_id },
        "payments.attribute.offer_effect_sanitized_empty",
      );
      throw new Error(`offer_effect_sanitized_empty:${offer.id}`);
    }
    const currentEntitlement = await getEntitlement(checkout.user_id);
    const mergedSnapshot = mergeEntitlementSnapshots(currentEntitlement, snapshot);

    await patchCheckout(checkout.checkout_id, {
      attributed: true,
      entitlement_snapshot: mergedSnapshot,
    });

    await saveEntitlement(checkout.user_id, mergedSnapshot);

    app.log.info(
      {
        checkoutId: checkout.checkout_id,
        userId: checkout.user_id,
        offerId: checkout.offer_id,
      },
      "payments.attribute.applied",
    );

    return {
      ...checkout,
      attributed: true,
      entitlement_snapshot: mergedSnapshot,
    };
  };

  const attributeCheckoutSafely = async (checkout: CheckoutRow, context: string) => {
    try {
      const attributed = await withTransientRetry(
        () => attributeCheckout(checkout),
        `attribute:${context}:${checkout.checkout_id}`,
      );
      return { checkout: attributed, pendingAttribution: false };
    } catch (error) {
      app.log.error(
        {
          err: error,
          context,
          checkoutId: checkout.checkout_id,
          offerId: checkout.offer_id,
        },
        "payments.attribute_pending_reconciliation",
      );
      return { checkout, pendingAttribution: true };
    }
  };

  // Public health check — intentionally minimal. Internal config (PSP mode,
  // dev-auto-grant) must NOT be disclosed to unauthenticated callers.
  app.get("/health", async () => ({
    status: "ok",
    service: "payments-service",
    timestamp: new Date().toISOString(),
  }));

  app.get("/payments/effects/audit", async () => ({
    offers: listOfferEffectsAudit(),
  }));

  app.get("/payments/catalog/audit", async (_request, reply) => {
    try {
      const catalog = await getCatalog();
      return {
        sourceMode: env.PAYMENTS_CATALOG_SOURCE,
        source: catalog.source,
        degraded: catalog.degraded,
        reason: catalog.reason ?? null,
        requiredOfferIds: catalog.validation.requiredOfferIds,
        missingOfferIds: catalog.validation.missingOfferIds,
        offersWithoutEffects: catalog.validation.offersWithoutEffects,
        totalOffers: catalog.offers.length,
      };
    } catch (error) {
      app.log.error({ error }, "payments.catalog.audit_failed");
      reply.status(503);
      return {
        code: "CATALOG_AUDIT_FAILED",
      };
    }
  });

  app.get("/payments/catalog", async (_request, reply) => {
    try {
      const catalog = await getCatalog();
      return {
        offers: catalog.offers,
        pspMode: yookassa ? "yookassa" : "mock",
        source: catalog.source,
        degraded: catalog.degraded,
      };
    } catch (error) {
      app.log.error({ error }, "payments.catalog.unavailable");
      reply.status(503);
      return {
        code: "CATALOG_UNAVAILABLE",
        message: "Payments catalog is incomplete or unavailable.",
      };
    }
  });

  app.get("/entitlements/me", async (request, reply) => {
    const userId = resolveAuthenticatedUserId(request, reply);
    if (!userId) {
      return { code: "UNAUTHORIZED", message: "Missing or invalid internal token." };
    }
    try {
      const pendingCheckouts = await listPendingAttributionCheckouts(userId);
      if (pendingCheckouts.length > 0) {
        for (const checkout of pendingCheckouts) {
          try {
            await attributeCheckout(checkout);
          } catch (error) {
            app.log.error(
              {
                error,
                checkoutId: checkout.checkout_id,
                offerId: checkout.offer_id,
              },
              "payments.attribute.reconcile_failed",
            );
          }
        }
      }

      const snapshot = await getEntitlement(userId);
      if (snapshot) {
        await saveEntitlement(userId, snapshot);
      } else {
        entitlementsMemory.delete(userId);
      }

      return {
        userId,
        entitlementSnapshot: snapshot,
        effectiveBenefits: resolveEffectiveBenefitsSnapshot(snapshot),
      };
    } catch {
      reply.status(500);
      return { code: "ENTITLEMENTS_READ_FAILED" };
    }
  });

  app.post("/payments/checkout", async (request, reply) => {
    const userId = resolveAuthenticatedUserId(request, reply);
    if (!userId) {
      return { code: "UNAUTHORIZED", message: "Missing or invalid internal token." };
    }
    const requestKey = `${getRequestIp(request.headers as Record<string, unknown>, request.ip)}:checkout`;
    if (isRateLimited(requestKey, env.RATE_LIMIT_MAX_CHECKOUT)) {
      reply.status(429);
      return { code: "RATE_LIMITED", message: "Too many checkout requests. Retry later." };
    }

    const parsed = checkoutSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.status(400);
      return { code: "INVALID_PAYLOAD", message: "Invalid checkout payload." };
    }

    const payload = parsed.data;
    const offer = await getOfferById(payload.offerId);
    if (!offer) {
      reply.status(404);
      return { code: "OFFER_NOT_FOUND", message: "Offer not found." };
    }

    const orderNumber = formatOrderNumber(offer.id, userId);

    if (devAutoGrantEnabled) {
      const checkoutId = `dev_${orderNumber}`;
      let checkout: CheckoutRow = {
        checkout_id: checkoutId,
        yookassa_payment_id: null,
        order_number: orderNumber,
        user_id: userId,
        offer_id: offer.id,
        mode: "mock",
        status: "paid",
        attributed: false,
        entitlement_snapshot: null,
        provider_raw: {
          mode: "dev_auto_grant",
        },
      };

      await upsertCheckout(checkout);
      const attributedResult = await attributeCheckoutSafely(checkout, "checkout_dev_auto");
      checkout = attributedResult.checkout;

      return {
        mode: "mock",
        checkoutId,
        orderNumber,
        offer,
        status: checkout.status,
        attributed: checkout.attributed,
        entitlementSnapshot: checkout.entitlement_snapshot ?? undefined,
        effectiveBenefits: resolveEffectiveBenefitsSnapshot(checkout.entitlement_snapshot),
        pendingAttribution: attributedResult.pendingAttribution,
        message: attributedResult.pendingAttribution
          ? "DEV auto-grant accepted; entitlement attribution is pending reconciliation."
          : "DEV auto-grant mode enabled: purchase was instantly attributed.",
      };
    }

    if (!yookassa) {
      const checkoutId = `mock_${orderNumber}`;
      await upsertCheckout({
        checkout_id: checkoutId,
        yookassa_payment_id: null,
        order_number: orderNumber,
        user_id: userId,
        offer_id: offer.id,
        mode: "mock",
        status: "pending",
        attributed: false,
        entitlement_snapshot: null,
        provider_raw: null,
      });

      return {
        mode: "mock",
        checkoutId,
        orderNumber,
        offer,
        message: "PSP credentials missing. Add credentials in payments-service .env to enable real checkout.",
      };
    }

    let payment;
    try {
      payment = await yookassa.createPayment({
        amountValue: formatAmountValue(offer.amountMinor),
        currency: toCurrencyCode(offer.currencyNumeric),
        description: `${offer.label} (${offer.id})`,
        orderNumber,
        userId,
        offerId: offer.id,
        returnUrl: sanitizeReturnUrl(payload.successUrl, env.YOOKASSA_RETURN_URL),
        capture: true,
      });
    } catch (error) {
      request.log.error({ error }, "yookassa_create_payment_failed");
      reply.status(502);
      return { code: "PSP_CREATE_FAILED", message: "Unable to initialize checkout." };
    }

    const checkoutId = payment.id;

    await upsertCheckout({
      checkout_id: checkoutId,
      yookassa_payment_id: payment.id,
      order_number: orderNumber,
      user_id: userId,
      offer_id: offer.id,
      mode: "yookassa",
      status: normalizeYooKassaStatus(payment.status),
      attributed: false,
      entitlement_snapshot: null,
      provider_raw: payment as unknown as Record<string, unknown>,
    });

    return {
      mode: "yookassa",
      provider: "yookassa",
      checkoutId,
      orderNumber,
      orderId: payment.id,
      formUrl: payment.confirmation?.confirmation_url,
      offer,
    };
  });

  app.post("/payments/checkout/status", async (request, reply) => {
    const userId = resolveAuthenticatedUserId(request, reply);
    if (!userId) {
      return { code: "UNAUTHORIZED", message: "Missing or invalid internal token." };
    }
    const requestKey = `${getRequestIp(request.headers as Record<string, unknown>, request.ip)}:status`;
    if (isRateLimited(requestKey, env.RATE_LIMIT_MAX_STATUS)) {
      reply.status(429);
      return { code: "RATE_LIMITED", message: "Too many status checks. Retry later." };
    }

    const parsed = checkoutStatusSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.status(400);
      return { code: "INVALID_PAYLOAD", message: "Invalid checkout status payload." };
    }

    const checkout = await getCheckout(parsed.data.checkoutId, userId);
    if (!checkout) {
      return {
        checkoutId: parsed.data.checkoutId,
        status: "not_found",
        attributed: false,
      };
    }

    if (checkout.mode === "mock") {
      const createdAt = Number(checkout.order_number.split("_").at(-1) ?? Date.now());
      if (Date.now() - createdAt >= 3000 && checkout.status !== "paid") {
        await patchCheckout(checkout.checkout_id, { status: "paid" });
        checkout.status = "paid";
      }
      const attributedResult = await attributeCheckoutSafely(checkout, "checkout_status_mock");
      const attributed = attributedResult.checkout;
      return {
        checkoutId: attributed.checkout_id,
        status: attributed.status,
        attributed: attributed.attributed,
        entitlementSnapshot: attributed.entitlement_snapshot ?? undefined,
        effectiveBenefits: resolveEffectiveBenefitsSnapshot(attributed.entitlement_snapshot),
        pendingAttribution: attributedResult.pendingAttribution,
      };
    }

    if (yookassa && checkout.yookassa_payment_id) {
      let payment;
      try {
        payment = await yookassa.getPayment(checkout.yookassa_payment_id);
      } catch (error) {
        request.log.error({ error, checkoutId: checkout.checkout_id }, "yookassa_status_failed");
        reply.status(502);
        return { code: "PSP_STATUS_FAILED", message: "Unable to fetch payment status." };
      }
      const nextStatus = normalizeYooKassaStatus(payment.status);

      await patchCheckout(checkout.checkout_id, {
        status: nextStatus,
        provider_raw: payment as unknown as Record<string, unknown>,
      });

      checkout.status = nextStatus;
      checkout.provider_raw = payment as unknown as Record<string, unknown>;
    }

    const attributedResult = await attributeCheckoutSafely(checkout, "checkout_status_psp");
    const attributed = attributedResult.checkout;

    return {
      checkoutId: attributed.checkout_id,
      status: attributed.status,
      attributed: attributed.attributed,
      entitlementSnapshot: attributed.entitlement_snapshot ?? undefined,
      effectiveBenefits: resolveEffectiveBenefitsSnapshot(attributed.entitlement_snapshot),
      pendingAttribution: attributedResult.pendingAttribution,
    };
  });

  app.post("/payments/webhook/yookassa", async (request, reply) => {
    const requestKey = `${getRequestIp(request.headers as Record<string, unknown>, request.ip)}:webhook`;
    if (isRateLimited(requestKey, env.RATE_LIMIT_MAX_WEBHOOK)) {
      reply.status(429);
      return { code: "RATE_LIMITED", message: "Too many webhook requests." };
    }

    // SECURITY: webhook authenticity.
    // 1) The shared-secret header (when configured) gates the endpoint.
    //    It is mandatory in production: a missing secret means we cannot
    //    distinguish a genuine PSP callback from a forged one, so we fail closed.
    // 2) Regardless of the secret, the payment status is NEVER taken from the
    //    request body — it is re-fetched from YooKassa's API below. This makes
    //    a forged webhook body harmless even if the secret ever leaks.
    const secretFromHeader = getWebhookSecret(request.headers as Record<string, unknown>);
    if (env.hasWebhookSecret) {
      if (!timingSafeEqualStr(secretFromHeader, env.YOOKASSA_WEBHOOK_SECRET ?? "")) {
        reply.status(401);
        return { accepted: false, matched: false, reason: "invalid_webhook_secret" };
      }
    } else if (env.NODE_ENV === "production") {
      request.log.error("payments.webhook.secret_not_configured_in_production");
      reply.status(503);
      return { accepted: false, matched: false, reason: "webhook_secret_not_configured" };
    }

    const body = asRecord(request.body);
    const payload = pickYooKassaPaymentPayload(body);

    const checkout = await getCheckoutByPaymentOrOrder({
      yookassaPaymentId: payload.paymentId,
      orderNumber: payload.orderNumber,
    });

    if (!checkout) {
      reply.status(202);
      return {
        accepted: true,
        matched: false,
        reason: "checkout_not_found",
      };
    }

    // SECURITY: never trust payload.paymentStatus. Re-fetch the authoritative
    // status from YooKassa using the stored payment id (same pattern as
    // /payments/checkout/status). Only a real "yookassa" checkout with a known
    // payment id can be attributed via the webhook.
    if (checkout.mode !== "yookassa" || !checkout.yookassa_payment_id || !yookassa) {
      reply.status(202);
      return {
        accepted: true,
        matched: false,
        reason: "checkout_not_verifiable",
      };
    }

    let payment;
    try {
      payment = await yookassa.getPayment(checkout.yookassa_payment_id);
    } catch (error) {
      request.log.error(
        { error, checkoutId: checkout.checkout_id },
        "payments.webhook.psp_verify_failed",
      );
      reply.status(502);
      return { accepted: false, matched: true, reason: "psp_verify_failed" };
    }

    const verifiedStatus = normalizeYooKassaStatus(payment.status);
    await patchCheckout(checkout.checkout_id, {
      status: verifiedStatus,
      provider_raw: payment as unknown as Record<string, unknown>,
    });

    checkout.status = verifiedStatus;
    checkout.provider_raw = payment as unknown as Record<string, unknown>;

    const attributedResult = await attributeCheckoutSafely(checkout, "yookassa_webhook");
    const attributed = attributedResult.checkout;

    return {
      accepted: true,
      matched: true,
      event: payload.event,
      checkoutId: attributed.checkout_id,
      status: attributed.status,
      attributed: attributed.attributed,
      pendingAttribution: attributedResult.pendingAttribution,
    };
  });

  app.post("/payments/order-status", async (request, reply) => {
    const userId = resolveAuthenticatedUserId(request, reply);
    if (!userId) {
      return { code: "UNAUTHORIZED", message: "Missing or invalid internal token." };
    }
    const requestKey = `${getRequestIp(request.headers as Record<string, unknown>, request.ip)}:order-status`;
    if (isRateLimited(requestKey, env.RATE_LIMIT_MAX_STATUS)) {
      reply.status(429);
      return { code: "RATE_LIMITED", message: "Too many status checks. Retry later." };
    }

    if (!yookassa) {
      reply.status(503);
      return { code: "PSP_NOT_CONFIGURED" };
    }

    const parsed = yookassaOrderStatusSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.status(400);
      return { code: "INVALID_PAYLOAD", message: "Invalid YooKassa status payload." };
    }

    // SECURITY: the payment id must map to a checkout owned by the caller.
    // Prevents anonymous/cross-user enumeration of arbitrary payments.
    const checkout = await getCheckoutByPaymentOrOrder({ yookassaPaymentId: parsed.data.paymentId });
    if (!checkout || checkout.user_id !== userId) {
      reply.status(404);
      return { code: "PAYMENT_NOT_FOUND" };
    }

    let payment;
    try {
      payment = await yookassa.getPayment(parsed.data.paymentId);
    } catch (error) {
      request.log.error({ error }, "payments.order_status.psp_failed");
      reply.status(502);
      return { code: "PSP_STATUS_FAILED", message: "Unable to fetch payment status." };
    }

    // Return only a minimal, non-sensitive status — never the raw PSP object.
    return {
      provider: "yookassa",
      status: normalizeYooKassaStatus(payment.status),
      paid: Boolean(payment.paid),
    };
  });

  return app;
};
