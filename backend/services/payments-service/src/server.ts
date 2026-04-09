import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import formbody from "@fastify/formbody";
import { createVerifier } from "fast-jwt";
import { z } from "zod";
import { env } from "./config.js";
import { offerSchema, offersCatalog, resolveOffer, type Offer } from "./catalog.js";
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
import { supabaseServiceClient } from "./lib/supabaseClient.js";
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
  offers: Offer[];
};

const CATALOG_CACHE_TTL_MS = 60_000;

const checkoutSchema = z.object({
  offerId: z.string().min(1),
  userId: z.string().min(1).optional(),
  locale: z.string().optional(),
  successUrl: z.string().url().optional(),
  failUrl: z.string().url().optional(),
});

const checkoutStatusSchema = z.object({
  checkoutId: z.string().min(1),
  userId: z.string().min(1).optional(),
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

const formatAmountValue = (amountMinor: number) => (amountMinor / 100).toFixed(2);

const normalizeYooKassaStatus = (status?: string): CheckoutState => {
  if (status === "succeeded") return "paid";
  if (status === "canceled") return "failed";
  return "pending";
};

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

const getRequestIp = (headers: Record<string, unknown>, fallback: string) => {
  const forwardedFor = headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0].trim();
  }
  return fallback;
};

const getWebhookSecret = (headers: Record<string, unknown>) => {
  const headerToken = headers["x-yookassa-webhook-secret"];
  if (typeof headerToken === "string" && headerToken.trim()) return headerToken.trim();
  const altHeaderToken = headers["x-webhook-secret"];
  if (typeof altHeaderToken === "string" && altHeaderToken.trim()) return altHeaderToken.trim();
  return "";
};

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
  const app = Fastify({ logger: true });

  app.register(cors, {
    origin: [env.APP_URL, "http://127.0.0.1:3000", "http://localhost:3000"],
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
    if (!supabaseServiceClient) {
      checkoutsMemory.set(row.checkout_id, row);
      return;
    }
    const { error } = await supabaseServiceClient.from("payments_checkouts").upsert(row, {
      onConflict: "checkout_id",
    });
    if (error) throw error;
  };

  const getCheckout = async (checkoutId: string, userId: string): Promise<CheckoutRow | null> => {
    if (!supabaseServiceClient) {
      const checkout = checkoutsMemory.get(checkoutId);
      if (!checkout || checkout.user_id !== userId) return null;
      return checkout;
    }
    const { data, error } = await supabaseServiceClient
      .from("payments_checkouts")
      .select("*")
      .eq("checkout_id", checkoutId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return (data as CheckoutRow | null) ?? null;
  };

  const getCheckoutByPaymentOrOrder = async (input: {
    yookassaPaymentId?: string;
    orderNumber?: string;
  }): Promise<CheckoutRow | null> => {
    if (!supabaseServiceClient) {
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
    if (input.yookassaPaymentId) {
      const { data, error } = await supabaseServiceClient
        .from("payments_checkouts")
        .select("*")
        .eq("yookassa_payment_id", input.yookassaPaymentId)
        .maybeSingle();
      if (error) throw error;
      if (data) return data as CheckoutRow;
    }

    if (input.orderNumber) {
      const { data, error } = await supabaseServiceClient
        .from("payments_checkouts")
        .select("*")
        .eq("order_number", input.orderNumber)
        .maybeSingle();
      if (error) throw error;
      if (data) return data as CheckoutRow;
    }

    return null;
  };

  const patchCheckout = async (
    checkoutId: string,
    patch: Partial<Pick<CheckoutRow, "status" | "attributed" | "entitlement_snapshot" | "provider_raw">>,
  ) => {
    if (!supabaseServiceClient) {
      const existing = checkoutsMemory.get(checkoutId);
      if (!existing) return;
      checkoutsMemory.set(checkoutId, {
        ...existing,
        ...patch,
      });
      return;
    }
    const { error } = await supabaseServiceClient
      .from("payments_checkouts")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("checkout_id", checkoutId);
    if (error) throw error;
  };

  const saveEntitlement = async (userId: string, snapshot: EntitlementSnapshot) => {
    const sanitized = sanitizeEntitlementSnapshot(snapshot);
    if (!supabaseServiceClient) {
      if (sanitized) {
        entitlementsMemory.set(userId, sanitized);
      } else {
        entitlementsMemory.delete(userId);
      }
      return;
    }

    if (!sanitized) {
      const { error } = await supabaseServiceClient
        .from("user_entitlements")
        .delete()
        .eq("user_id", userId);
      if (error) throw error;
      return;
    }

    const { error } = await supabaseServiceClient
      .from("user_entitlements")
      .upsert(
        {
          user_id: userId,
          entitlement_snapshot: sanitized,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
    if (error) throw error;
  };

  const getEntitlement = async (userId: string): Promise<EntitlementSnapshot | null> => {
    if (!supabaseServiceClient) {
      return sanitizeEntitlementSnapshot(entitlementsMemory.get(userId) ?? null);
    }

    const { data, error } = await supabaseServiceClient
      .from("user_entitlements")
      .select("entitlement_snapshot")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;

    return sanitizeEntitlementSnapshot(
      (data?.entitlement_snapshot as EntitlementSnapshot | null | undefined) ?? null,
    );
  };

  const getCatalog = async (): Promise<Offer[]> => {
    const now = Date.now();
    if (catalogCache && now - catalogCache.fetchedAt < CATALOG_CACHE_TTL_MS) {
      return catalogCache.offers;
    }

    if (!supabaseServiceClient) {
      catalogCache = { fetchedAt: now, offers: offersCatalog };
      return offersCatalog;
    }

    const { data, error } = await supabaseServiceClient
      .from("in_app_offers")
      .select("id,label,description,tag,amount_minor,currency_numeric,type,duration_hours,is_active,sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error || !data) {
      catalogCache = { fetchedAt: now, offers: offersCatalog };
      return offersCatalog;
    }

    const parsedOffers = (data as Record<string, unknown>[])
      .map((row) =>
        offerSchema.safeParse({
          id: row.id,
          label: row.label,
          description: row.description,
          tag: row.tag,
          amountMinor: row.amount_minor,
          currencyNumeric: row.currency_numeric,
          type: row.type,
          durationHours: row.duration_hours,
        }),
      )
      .filter((entry): entry is { success: true; data: Offer } => entry.success)
      .map((entry) => entry.data);

    const finalOffers = parsedOffers.length > 0 ? parsedOffers : offersCatalog;
    catalogCache = { fetchedAt: now, offers: finalOffers };
    return finalOffers;
  };

  const getOfferById = async (offerId: string): Promise<Offer | undefined> => {
    const catalog = await getCatalog();
    return catalog.find((offer) => offer.id === offerId) ?? resolveOffer(offerId);
  };

  const attributeCheckout = async (checkout: CheckoutRow): Promise<CheckoutRow> => {
    if (checkout.attributed || checkout.status !== "paid") return checkout;
    const offer = await getOfferById(checkout.offer_id);
    if (!offer) return checkout;

    const resolvedSnapshot = resolveEntitlementSnapshot(offer);
    if (!hasMeaningfulEntitlementEffect(resolvedSnapshot)) {
      throw new Error(`offer_effect_missing:${offer.id}`);
    }
    const snapshot = sanitizeEntitlementSnapshot(resolvedSnapshot);
    if (!snapshot) {
      throw new Error(`offer_effect_sanitized_empty:${offer.id}`);
    }
    const currentEntitlement = await getEntitlement(checkout.user_id);
    const mergedSnapshot = mergeEntitlementSnapshots(currentEntitlement, snapshot);

    await patchCheckout(checkout.checkout_id, {
      attributed: true,
      entitlement_snapshot: mergedSnapshot,
    });

    await saveEntitlement(checkout.user_id, mergedSnapshot);

    return {
      ...checkout,
      attributed: true,
      entitlement_snapshot: mergedSnapshot,
    };
  };

  app.get("/health", async () => ({
    status: "ok",
    service: "payments-service",
    pspMode: yookassa ? "yookassa" : "mock",
    devAutoGrant: devAutoGrantEnabled,
    persistence: supabaseServiceClient ? "supabase" : "memory",
    timestamp: new Date().toISOString(),
  }));

  app.get("/payments/effects/audit", async () => ({
    offers: listOfferEffectsAudit(),
  }));

  app.get("/payments/catalog", async () => {
    const offers = await getCatalog();
    return {
      offers,
      pspMode: yookassa ? "yookassa" : "mock",
    };
  });

  app.get("/entitlements/me", async (request, reply) => {
    const userId = resolveAuthenticatedUserId(request, reply);
    if (!userId) {
      return { code: "UNAUTHORIZED", message: "Missing or invalid internal token." };
    }
    try {
      const snapshot = await getEntitlement(userId);
      if (snapshot) {
        await saveEntitlement(userId, snapshot);
      } else if (!supabaseServiceClient) {
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
      checkout = await attributeCheckout(checkout);

      return {
        mode: "mock",
        checkoutId,
        orderNumber,
        offer,
        status: checkout.status,
        attributed: checkout.attributed,
        entitlementSnapshot: checkout.entitlement_snapshot ?? undefined,
        effectiveBenefits: resolveEffectiveBenefitsSnapshot(checkout.entitlement_snapshot),
        message: "DEV auto-grant mode enabled: purchase was instantly attributed.",
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
        returnUrl: payload.successUrl ?? env.YOOKASSA_RETURN_URL,
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
      const attributed = await attributeCheckout(checkout);
      return {
        checkoutId: attributed.checkout_id,
        status: attributed.status,
        attributed: attributed.attributed,
        entitlementSnapshot: attributed.entitlement_snapshot ?? undefined,
        effectiveBenefits: resolveEffectiveBenefitsSnapshot(attributed.entitlement_snapshot),
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

    const attributed = await attributeCheckout(checkout);

    return {
      checkoutId: attributed.checkout_id,
      status: attributed.status,
      attributed: attributed.attributed,
      entitlementSnapshot: attributed.entitlement_snapshot ?? undefined,
      effectiveBenefits: resolveEffectiveBenefitsSnapshot(attributed.entitlement_snapshot),
    };
  });

  app.post("/payments/webhook/yookassa", async (request, reply) => {
    const requestKey = `${getRequestIp(request.headers as Record<string, unknown>, request.ip)}:webhook`;
    if (isRateLimited(requestKey, env.RATE_LIMIT_MAX_WEBHOOK)) {
      reply.status(429);
      return { code: "RATE_LIMITED", message: "Too many webhook requests." };
    }

    const secretFromHeader = getWebhookSecret(request.headers as Record<string, unknown>);
    if (env.hasWebhookSecret && secretFromHeader !== env.YOOKASSA_WEBHOOK_SECRET) {
      reply.status(401);
      return { accepted: false, matched: false, reason: "invalid_webhook_secret" };
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

    const statusFromEvent = normalizeYooKassaStatus(payload.paymentStatus);
    await patchCheckout(checkout.checkout_id, {
      status: statusFromEvent,
      provider_raw: body,
    });

    checkout.status = statusFromEvent;
    checkout.provider_raw = body;

    const attributed = await attributeCheckout(checkout);

    return {
      accepted: true,
      matched: true,
      event: payload.event,
      checkoutId: attributed.checkout_id,
      status: attributed.status,
      attributed: attributed.attributed,
    };
  });

  app.post("/payments/order-status", async (request, reply) => {
    if (!yookassa) {
      reply.status(503);
      return { code: "PSP_NOT_CONFIGURED" };
    }

    const parsed = yookassaOrderStatusSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.status(400);
      return { code: "INVALID_PAYLOAD", message: "Invalid YooKassa status payload." };
    }

    const payment = await yookassa.getPayment(parsed.data.paymentId);
    return {
      provider: "yookassa",
      response: payment,
    };
  });

  return app;
};
