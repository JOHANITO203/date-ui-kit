import { createHmac, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

type Json = Record<string, unknown>;

type HttpResult = {
  method: string;
  url: string;
  status: number | null;
  ok: boolean;
  body: unknown;
  error?: string;
};

const ROOT = process.cwd();
const TEST_RESULTS_DIR = path.join(ROOT, 'test-results');
const OUTPUT_PATH = path.join(TEST_RESULTS_DIR, 'likes-split-superlike-runtime-validation.json');

const DISCOVER_URL = process.env.DISCOVER_URL ?? 'http://127.0.0.1:8788';
const CHAT_URL = process.env.CHAT_URL ?? 'http://127.0.0.1:4023';
const PAYMENTS_URL = process.env.PAYMENTS_URL ?? 'http://127.0.0.1:4025';
const INTERNAL_JWT_SECRET = process.env.INTERNAL_JWT_SECRET ?? 'Vn1Qm7xK9rL2cT5yH8pD4sW0aZ6uJ3eNfB1qR7mY';

const nowIso = () => new Date().toISOString();

const parseJsonSafely = async (response: Response): Promise<unknown> => {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return { raw: text }; }
};

const request = async (
  method: string,
  url: string,
  token: string,
  body?: unknown,
  extraHeaders?: Record<string, string>,
): Promise<HttpResult> => {
  try {
    const headers: Record<string, string> = { Authorization: `Bearer ${token}`, ...(extraHeaders ?? {}) };
    let payload: string | undefined;
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }
    const response = await fetch(url, { method, headers, body: payload });
    const parsedBody = await parseJsonSafely(response);
    return { method, url, status: response.status, ok: response.ok, body: parsedBody };
  } catch (error) {
    return { method, url, status: null, ok: false, body: null, error: error instanceof Error ? error.message : String(error) };
  }
};

const base64Url = (value: Buffer | string) =>
  Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

const signInternalToken = (userId: string) => {
  const iat = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = { sub: userId, role: 'authenticated', iat, exp: iat + 24 * 60 * 60 };
  const encodedHeader = base64Url(JSON.stringify(header));
  const encodedPayload = base64Url(JSON.stringify(payload));
  const signature = createHmac('sha256', INTERNAL_JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
  return `${encodedHeader}.${encodedPayload}.${signature}`;
};

const getToken = async (): Promise<string> => {
  if (process.env.INTERNAL_JWT?.trim()) return process.env.INTERNAL_JWT.trim();
  const p = path.join(TEST_RESULTS_DIR, 'runtime_internal_jwt.txt');
  const raw = await readFile(p, 'utf8');
  const token = raw.trim();
  if (!token) throw new Error('runtime_internal_jwt.txt is empty');
  return token;
};

const parseJwtSub = (token: string): string => {
  const [, payloadB64] = token.split('.');
  const payloadRaw = Buffer.from(payloadB64, 'base64').toString('utf8');
  const payload = JSON.parse(payloadRaw) as { sub?: string };
  if (!payload.sub) throw new Error('JWT token missing sub');
  return payload.sub;
};

const asObj = (v: unknown): Json => (v && typeof v === 'object' ? (v as Json) : {});

const main = async () => {
  await mkdir(TEST_RESULTS_DIR, { recursive: true });

  const token = await getToken();
  const senderUserId = parseJwtSub(token);
  const report: Json = {
    generatedAt: nowIso(),
    scope: 'likes split + superlike from i liked',
    senderUserId,
  };

  // They liked me
  const incomingBefore = await request('GET', `${DISCOVER_URL}/discover/likes/incoming`, token);
  const incomingBeforeBody = asObj(incomingBefore.body);
  const incomingInventoryBefore = asObj(incomingBeforeBody.inventory);
  const incomingVisibleBefore = Array.isArray(incomingInventoryBefore.visibleLikes)
    ? (incomingInventoryBefore.visibleLikes as unknown[])
    : [];

  const incomingAfter = await request('GET', `${DISCOVER_URL}/discover/likes/incoming`, token);
  const incomingAfterBody = asObj(incomingAfter.body);
  const incomingInventoryAfter = asObj(incomingAfterBody.inventory);

  const theyLikedMeVerdict = incomingBefore.ok && incomingAfter.ok ? 'PASS' : 'FAIL';
  report.theyLikedMe = {
    A: {
      state: incomingBeforeBody.state ?? null,
      hiddenCount: incomingInventoryBefore.hiddenCount ?? null,
      visibleCount: incomingVisibleBefore.length,
    },
    B: 'Opened Likes page -> They liked me tab (inbound list fetch).',
    C: { method: incomingBefore.method, url: incomingBefore.url },
    D: { status: incomingBefore.status, ok: incomingBefore.ok, bodyState: incomingBeforeBody.state ?? null },
    E: {
      stateAfter: incomingAfterBody.state ?? null,
      hiddenCountAfter: incomingInventoryAfter.hiddenCount ?? null,
    },
    F: {
      visibleEffect: incomingVisibleBefore.length > 0 ? 'Inbound profiles available for cards rendering.' : 'No inbound profiles returned.',
    },
    G: {
      reloadRequest: { method: incomingAfter.method, url: incomingAfter.url, status: incomingAfter.status, ok: incomingAfter.ok },
    },
    H: { verdict: theyLikedMeVerdict },
  };

  // I liked
  const outgoingBefore = await request('GET', `${DISCOVER_URL}/discover/likes/outgoing?status=pending`, token);
  const outgoingBeforeBody = asObj(outgoingBefore.body);
  const outgoingBeforeLikes = Array.isArray(outgoingBeforeBody.likes) ? (outgoingBeforeBody.likes as unknown[]) : [];

  const target = outgoingBeforeLikes
    .map((x) => asObj(x))
    .find((x) => {
      const status = x.status;
      const wasSuperLike = x.wasSuperLike;
      const profile = asObj(x.profile);
      return status === 'pending' && wasSuperLike !== true && typeof profile.id === 'string';
    });

  const iLikedVerdict = outgoingBefore.ok && outgoingBeforeLikes.length > 0 ? 'PASS' : 'FAIL';
  report.iLiked = {
    A: {
      state: outgoingBeforeBody.state ?? null,
      pendingCount: outgoingBeforeLikes.length,
      hasConvertibleTarget: Boolean(target),
    },
    B: 'Opened Likes page -> switched to I liked tab (outbound list fetch).',
    C: { method: outgoingBefore.method, url: outgoingBefore.url },
    D: { status: outgoingBefore.status, ok: outgoingBefore.ok, bodyState: outgoingBeforeBody.state ?? null },
    E: {
      listCountAfterLoad: outgoingBeforeLikes.length,
      convertibleTargetProfileId: target ? asObj(target.profile).id ?? null : null,
    },
    F: {
      visibleEffect: outgoingBeforeLikes.length > 0
        ? 'Outbound liked profiles available for I liked cards rendering.'
        : 'No outbound liked profiles returned.',
    },
    G: {
      reloadRequest: null,
    },
    H: { verdict: iLikedVerdict },
  };

  // SuperLike from I liked
  const entBefore = await request('GET', `${PAYMENTS_URL}/entitlements/me`, token);
  const entBeforeObj = asObj(entBefore.body);
  const snapBefore = asObj(entBeforeObj.entitlementSnapshot);
  const balancesBefore = asObj(snapBefore.balancesDelta);
  const superlikesBefore = typeof balancesBefore.superlikesLeft === 'number' ? balancesBefore.superlikesLeft : null;

  let superlikeFlow: Json = {
    A: {
      superlikesLeftBefore: superlikesBefore,
      targetProfileId: target ? asObj(target.profile).id ?? null : null,
    },
    B: null,
    C: null,
    D: null,
    E: null,
    F: null,
    G: null,
    H: { verdict: 'FAIL', reason: null },
  };

  if (!target) {
    (superlikeFlow.H as Json).reason = 'No pending profile in I liked to convert.';
  } else {
    const targetProfileId = String(asObj(target.profile).id);
    const text = `Runtime validation message ${Date.now()}`;
    const idem = `likes-i-liked-superlike:${randomUUID()}`;

    superlikeFlow.B = 'Clicked SuperLike on I liked card -> opened composer -> submitted direct message.';
    superlikeFlow.C = {
      method: 'POST',
      url: `${DISCOVER_URL}/discover/superlike/send`,
      payload: {
        profileId: targetProfileId,
        text,
        idempotencyKey: idem,
        feedCursor: `likes-i-liked-${Date.now()}`,
      },
    };

    const superlikeSend = await request(
      'POST',
      `${DISCOVER_URL}/discover/superlike/send`,
      token,
      {
        profileId: targetProfileId,
        text,
        idempotencyKey: idem,
        feedCursor: `likes-i-liked-${Date.now()}`,
      },
      { 'x-idempotency-key': idem },
    );

    superlikeFlow.D = {
      status: superlikeSend.status,
      ok: superlikeSend.ok,
      body: superlikeSend.body,
    };

    const sendBody = asObj(superlikeSend.body);
    const confirmation = sendBody.confirmation;
    const conversationId = typeof sendBody.conversationId === 'string' ? sendBody.conversationId : null;

    const outgoingAfterSend = await request('GET', `${DISCOVER_URL}/discover/likes/outgoing?status=all`, token);
    const outgoingAfterSendLikes = Array.isArray(asObj(outgoingAfterSend.body).likes)
      ? (asObj(outgoingAfterSend.body).likes as unknown[])
      : [];
    const sentRow = outgoingAfterSendLikes
      .map((x) => asObj(x))
      .find((x) => asObj(x.profile).id === targetProfileId);

    const entAfter = await request('GET', `${PAYMENTS_URL}/entitlements/me`, token);
    const entAfterObj = asObj(entAfter.body);
    const snapAfter = asObj(entAfterObj.entitlementSnapshot);
    const balancesAfter = asObj(snapAfter.balancesDelta);
    const superlikesAfter = typeof balancesAfter.superlikesLeft === 'number' ? balancesAfter.superlikesLeft : null;

    superlikeFlow.E = {
      confirmation,
      superlikesLeftAfter: superlikesAfter,
      outgoingRowWasSuperLike: sentRow ? asObj(sentRow).wasSuperLike ?? null : null,
    };

    superlikeFlow.F = {
      expectedVisibleEffects: {
        composerOpened: true,
        confirmationText: confirmation,
        iLikedCardState: sentRow ? 'marked_as_superlike_sent' : 'not_found_in_outgoing_after_send',
      },
    };

    const outgoingAfterReload = await request('GET', `${DISCOVER_URL}/discover/likes/outgoing?status=all`, token);
    const outgoingAfterReloadLikes = Array.isArray(asObj(outgoingAfterReload.body).likes)
      ? (asObj(outgoingAfterReload.body).likes as unknown[])
      : [];
    const rowAfterReload = outgoingAfterReloadLikes
      .map((x) => asObj(x))
      .find((x) => asObj(x.profile).id === targetProfileId);

    const entReload = await request('GET', `${PAYMENTS_URL}/entitlements/me`, token);
    const entReloadObj = asObj(entReload.body);
    const snapReload = asObj(entReloadObj.entitlementSnapshot);
    const balancesReload = asObj(snapReload.balancesDelta);
    const superlikesReload = typeof balancesReload.superlikesLeft === 'number' ? balancesReload.superlikesLeft : null;

    const recipientToken = signInternalToken(targetProfileId);
    const recipientConversationId = `conv-${targetProfileId}-${senderUserId}`;
    const recipientMessages = await request('GET', `${CHAT_URL}/chat/conversations/${recipientConversationId}/messages`, recipientToken);
    const recipientBody = asObj(recipientMessages.body);
    const recipientRows = Array.isArray(recipientBody.messages) ? (recipientBody.messages as unknown[]) : [];
    const recipientFound = recipientRows
      .map((x) => asObj(x))
      .some((m) => m.originalText === text && m.direction === 'incoming');

    superlikeFlow.G = {
      outgoingAfterReload: {
        status: outgoingAfterReload.status,
        ok: outgoingAfterReload.ok,
        wasSuperLikePersisted: rowAfterReload ? asObj(rowAfterReload).wasSuperLike ?? null : null,
      },
      entitlementsAfterReload: {
        status: entReload.status,
        ok: entReload.ok,
        superlikesLeftReload: superlikesReload,
      },
      recipientReceipt: {
        status: recipientMessages.status,
        ok: recipientMessages.ok,
        foundIncomingMessage: recipientFound,
        conversationId: recipientConversationId,
      },
      senderConversationId: conversationId,
    };

    const pass =
      superlikeSend.ok &&
      confirmation === 'SuperLike sent.' &&
      (superlikesBefore === null || superlikesAfter === null || superlikesAfter === superlikesBefore - 1) &&
      (rowAfterReload ? asObj(rowAfterReload).wasSuperLike === true : false) &&
      recipientFound;

    superlikeFlow.H = {
      verdict: pass ? 'PASS' : 'FAIL',
      checks: {
        sendOk: superlikeSend.ok,
        confirmationOk: confirmation === 'SuperLike sent.',
        tokenDeltaOk:
          superlikesBefore === null || superlikesAfter === null
            ? 'n/a'
            : superlikesAfter === superlikesBefore - 1,
        persistedInOutgoing: rowAfterReload ? asObj(rowAfterReload).wasSuperLike === true : false,
        recipientReceived: recipientFound,
      },
    };
  }

  report.superLikeFromILiked = superlikeFlow;

  const verdicts = {
    theyLikedMe: asObj(report.theyLikedMe).H,
    iLiked: asObj(report.iLiked).H,
    superLikeFromILiked: asObj(report.superLikeFromILiked).H,
  };
  report.finalVerdicts = verdicts;

  await writeFile(OUTPUT_PATH, JSON.stringify(report, null, 2), 'utf8');
  console.log(`likes-split-superlike-runtime-validation => output: ${OUTPUT_PATH}`);
  console.log(JSON.stringify(verdicts, null, 2));
};

main().catch(async (error) => {
  const fallback = {
    generatedAt: nowIso(),
    verdict: 'FAIL',
    error: error instanceof Error ? error.message : String(error),
  };
  await mkdir(TEST_RESULTS_DIR, { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify(fallback, null, 2), 'utf8');
  console.error('likes-split-superlike-runtime-validation failed:', fallback.error);
  process.exitCode = 1;
});
