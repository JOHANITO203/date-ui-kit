import { createHmac, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

type Json = Record<string, unknown>;

type HttpResult = {
  method: string;
  url: string;
  status: number | null;
  ok: boolean;
  body: unknown;
  error?: string;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const TEST_RESULTS_DIR = path.join(ROOT, "test-results");
const OUTPUT_PATH = path.join(TEST_RESULTS_DIR, "proof-superlike-sot-runtime.json");

const DISCOVER_URL = process.env.DISCOVER_URL ?? "http://127.0.0.1:8788";
const CHAT_URL = process.env.CHAT_URL ?? "http://127.0.0.1:4023";
const PAYMENTS_URL = process.env.PAYMENTS_URL ?? "http://127.0.0.1:4025";
const SUPERLIKE_TEXT =
  process.env.SUPERLIKE_TEXT ?? "Hi, direct message sent from Discover via SuperLike.";
const INTERNAL_JWT_SECRET =
  process.env.INTERNAL_JWT_SECRET ?? "Vn1Qm7xK9rL2cT5yH8pD4sW0aZ6uJ3eNfB1qR7mY";

const nowIso = () => new Date().toISOString();

const parseJsonSafely = async (response: Response): Promise<unknown> => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
};

const request = async (
  method: string,
  url: string,
  token: string,
  body?: unknown,
  extraHeaders?: Record<string, string>,
): Promise<HttpResult> => {
  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      ...extraHeaders,
    };
    let payload: string | undefined;
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      payload = JSON.stringify(body);
    }

    const response = await fetch(url, {
      method,
      headers,
      body: payload,
    });
    const parsedBody = await parseJsonSafely(response);
    return {
      method,
      url,
      status: response.status,
      ok: response.ok,
      body: parsedBody,
    };
  } catch (error) {
    return {
      method,
      url,
      status: null,
      ok: false,
      body: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

const getToken = async (): Promise<string> => {
  if (process.env.INTERNAL_JWT?.trim()) return process.env.INTERNAL_JWT.trim();
  const p = path.join(TEST_RESULTS_DIR, "runtime_internal_jwt.txt");
  const raw = await readFile(p, "utf8");
  const token = raw.trim();
  if (!token) throw new Error("runtime_internal_jwt.txt is empty");
  return token;
};

const parseJwtSub = (token: string): string => {
  const [, payloadB64] = token.split(".");
  const payloadRaw = Buffer.from(payloadB64, "base64").toString("utf8");
  const payload = JSON.parse(payloadRaw) as { sub?: string };
  if (!payload.sub) throw new Error("JWT token missing sub");
  return payload.sub;
};

const base64Url = (value: Buffer | string) =>
  Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

const signInternalToken = (userId: string) => {
  const iat = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const payload = { sub: userId, role: "authenticated", iat, exp: iat + 24 * 60 * 60 };
  const encodedHeader = base64Url(JSON.stringify(header));
  const encodedPayload = base64Url(JSON.stringify(payload));
  const signature = createHmac("sha256", INTERNAL_JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  return `${encodedHeader}.${encodedPayload}.${signature}`;
};

const toNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const readSuperlikesLeftFromEntitlements = (payload: unknown): number | null => {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Json;
  const snapshot = p.entitlementSnapshot as Json | undefined;
  const balancesDelta = snapshot?.balancesDelta as Json | undefined;
  return toNumber(balancesDelta?.superlikesLeft);
};

const readFeedCandidate = (payload: unknown): { profileId: string | null; feedCursor: string | null } => {
  if (!payload || typeof payload !== "object") return { profileId: null, feedCursor: null };
  const p = payload as Json;
  const win = (p.window as Json | undefined) ?? p;
  const candidates = Array.isArray(win.candidates) ? win.candidates : [];
  const first = candidates[0] as Json | undefined;
  return {
    profileId:
      typeof first?.id === "string"
        ? first.id
        : typeof first?.profileId === "string"
          ? first.profileId
          : null,
    feedCursor:
      typeof win.cursor === "string"
        ? win.cursor
        : typeof p.feedCursor === "string"
          ? p.feedCursor
          : null,
  };
};

const main = async () => {
  await mkdir(TEST_RESULTS_DIR, { recursive: true });
  const token = await getToken();
  const senderUserId = parseJwtSub(token);
  const idempotencyKey = `superlike-sot:${randomUUID()}`;

  const evidence: Json = {
    generatedAt: nowIso(),
    product: "SuperLike",
    sotExpected: {
      directMessageFromDiscover: true,
      noMatchDependency: true,
      confirmationUi: "SuperLike sent.",
      consumesOneToken: true,
      recipientReceivesMessage: true,
    },
  };

  const entBefore = await request("GET", `${PAYMENTS_URL}/entitlements/me`, token);
  const feedBefore = await request("GET", `${DISCOVER_URL}/discover/feed?quickFilters=all`, token);
  const beforeSuperlikes = readSuperlikesLeftFromEntitlements(entBefore.body);
  const { profileId: targetProfileId, feedCursor } = readFeedCandidate(feedBefore.body);

  const checkout = await request("POST", `${PAYMENTS_URL}/payments/checkout`, token, { offerId: "instant-superlike" });
  let checkoutId: string | null = null;
  if (checkout.body && typeof checkout.body === "object") {
    const body = checkout.body as Json;
    checkoutId = typeof body.checkoutId === "string" ? body.checkoutId : null;
  }
  const checkoutStatus = checkoutId
    ? await request("POST", `${PAYMENTS_URL}/payments/checkout/status`, token, { checkoutId })
    : null;
  const entAfterBuy = await request("GET", `${PAYMENTS_URL}/entitlements/me`, token);
  const afterBuySuperlikes = readSuperlikesLeftFromEntitlements(entAfterBuy.body);

  const superLikePayload = {
    profileId: targetProfileId,
    text: SUPERLIKE_TEXT,
    idempotencyKey,
    feedCursor: feedCursor ?? `feed-${Date.now()}`,
  };
  const superLikeRequest = await request(
    "POST",
    `${DISCOVER_URL}/discover/superlike/send`,
    token,
    superLikePayload,
    { "x-idempotency-key": idempotencyKey },
  );

  const entAfter = await request("GET", `${PAYMENTS_URL}/entitlements/me`, token);
  const afterSuperlikes = readSuperlikesLeftFromEntitlements(entAfter.body);

  let senderConversationId: string | null = null;
  let senderMessageId: string | null = null;
  if (superLikeRequest.body && typeof superLikeRequest.body === "object") {
    const b = superLikeRequest.body as Json;
    senderConversationId = typeof b.conversationId === "string" ? b.conversationId : null;
    senderMessageId = typeof b.messageId === "string" ? b.messageId : null;
  }

  const senderMessages = senderConversationId
    ? await request("GET", `${CHAT_URL}/chat/conversations/${senderConversationId}/messages`, token)
    : null;

  const recipientToken = targetProfileId ? signInternalToken(targetProfileId) : null;
  const recipientConversationId = targetProfileId ? `conv-${targetProfileId}-${senderUserId}` : null;
  const recipientMessages =
    recipientToken && recipientConversationId
      ? await request("GET", `${CHAT_URL}/chat/conversations/${recipientConversationId}/messages`, recipientToken)
      : null;

  const entAfterReload = await request("GET", `${PAYMENTS_URL}/entitlements/me`, token);
  const afterReloadSuperlikes = readSuperlikesLeftFromEntitlements(entAfterReload.body);

  const senderMessageFound =
    Boolean(senderMessages?.body && typeof senderMessages.body === "object") &&
    Array.isArray((senderMessages.body as Json).messages) &&
    ((senderMessages.body as Json).messages as unknown[]).some((m) => {
      if (!m || typeof m !== "object") return false;
      const row = m as Json;
      return row.originalText === SUPERLIKE_TEXT && row.direction === "outgoing";
    });

  const recipientMessageFound =
    Boolean(recipientMessages?.body && typeof recipientMessages.body === "object") &&
    Array.isArray((recipientMessages.body as Json).messages) &&
    ((recipientMessages.body as Json).messages as unknown[]).some((m) => {
      if (!m || typeof m !== "object") return false;
      const row = m as Json;
      return row.originalText === SUPERLIKE_TEXT && row.direction === "incoming";
    });

  const expectedAfterConsumeFromBefore =
    beforeSuperlikes !== null ? beforeSuperlikes + 5 - 1 : null;

  const verdict =
    superLikeRequest.ok &&
    afterSuperlikes === expectedAfterConsumeFromBefore &&
    afterReloadSuperlikes === afterSuperlikes &&
    senderMessageFound &&
    recipientMessageFound
      ? "PASS"
      : "FAIL";

  evidence.A = {
    beforeSuperlikes,
    targetProfileId,
    feedCursor,
  };
  evidence.B = {
    action: "buy instant-superlike + send direct superlike message from Discover pipeline",
    payload: superLikePayload,
  };
  evidence.C = {
    requests: [
      `${PAYMENTS_URL}/entitlements/me`,
      `${DISCOVER_URL}/discover/feed?quickFilters=all`,
      `${PAYMENTS_URL}/payments/checkout`,
      `${PAYMENTS_URL}/payments/checkout/status`,
      `${DISCOVER_URL}/discover/superlike/send`,
      `${CHAT_URL}/chat/conversations/:conversationId/messages (sender+recipient)`,
    ],
  };
  evidence.D = {
    entBefore,
    feedBefore,
    checkout,
    checkoutStatus,
    entAfterBuy,
    superLikeRequest,
    entAfter,
    senderMessages,
    recipientMessages,
    entAfterReload,
  };
  evidence.E = {
    beforeSuperlikes,
    afterBuySuperlikes,
    afterSuperlikes,
    expectedAfterConsumeFromBefore,
    senderConversationId,
    senderMessageId,
  };
  evidence.F = {
    uiObservableProxy: {
      confirmationExpected: "SuperLike sent.",
      backendConfirmation: superLikeRequest.body,
      senderMessageFound,
      recipientMessageFound,
    },
  };
  evidence.G = {
    afterReloadSuperlikes,
    persisted: afterReloadSuperlikes === afterSuperlikes,
  };
  evidence.H = {
    verdict,
    checks: {
      dedicatedEndpointOk: superLikeRequest.ok,
      consumedOneTokenAfterPurchase: afterSuperlikes === expectedAfterConsumeFromBefore,
      noMatchFieldInResponse:
        !(superLikeRequest.body && typeof superLikeRequest.body === "object" && "matched" in (superLikeRequest.body as Json)),
      senderMessageFound,
      recipientMessageFound,
      persistedAfterReload: afterReloadSuperlikes === afterSuperlikes,
    },
  };

  await writeFile(OUTPUT_PATH, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  console.log(`Wrote ${OUTPUT_PATH}`);
  console.log(`Verdict: ${verdict}`);
};

main().catch(async (error) => {
  const fallback = {
    generatedAt: nowIso(),
    product: "SuperLike",
    verdict: "BLOCKED_SCRIPT_ERROR",
    error: error instanceof Error ? error.message : String(error),
  };
  await mkdir(TEST_RESULTS_DIR, { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(fallback, null, 2)}\n`, "utf8");
  console.error(error);
  process.exitCode = 1;
});
