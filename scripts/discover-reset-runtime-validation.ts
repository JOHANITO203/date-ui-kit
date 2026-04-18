import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
const ROOT = path.resolve(__dirname, '..');
const TEST_RESULTS_DIR = path.join(ROOT, 'test-results');
const OUTPUT_PATH = path.join(TEST_RESULTS_DIR, 'discover-feed-reset-runtime-validation.json');

const DISCOVER_URL = process.env.DISCOVER_URL ?? 'http://127.0.0.1:8788';
const CHAT_URL = process.env.CHAT_URL ?? 'http://127.0.0.1:4023';

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
      headers['Content-Type'] = 'application/json';
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
  const p = path.join(TEST_RESULTS_DIR, 'runtime_internal_jwt.txt');
  const raw = await readFile(p, 'utf8');
  const token = raw.trim();
  if (!token) throw new Error('runtime_internal_jwt.txt is empty');
  return token;
};

const extractFeed = (payload: unknown): { cursor: string | null; candidates: Array<{ id: string }> } => {
  if (!payload || typeof payload !== 'object') return { cursor: null, candidates: [] };
  const root = payload as Json;
  const win = (root.window as Json | undefined) ?? root;
  const cursor = typeof win.cursor === 'string' ? win.cursor : null;
  const candidatesRaw = Array.isArray(win.candidates) ? win.candidates : [];
  const candidates = candidatesRaw
    .map((row) => {
      if (!row || typeof row !== 'object') return null;
      const id = (row as Json).id;
      if (typeof id !== 'string' || id.length === 0) return null;
      return { id };
    })
    .filter((row): row is { id: string } => Boolean(row));
  return { cursor, candidates };
};

const extractResetMeta = (payload: unknown) => {
  if (!payload || typeof payload !== 'object') return null;
  const reset = (payload as Json).reset;
  if (!reset || typeof reset !== 'object') return null;
  return reset as Json;
};

const extractChatPeerIds = (payload: unknown): string[] => {
  if (!payload || typeof payload !== 'object') return [];
  const root = payload as Json;
  const conversations = Array.isArray(root.conversations) ? root.conversations : [];
  const ids = new Set<string>();
  for (const row of conversations) {
    if (!row || typeof row !== 'object') continue;
    const json = row as Json;
    const peer = json.peer;
    if (peer && typeof peer === 'object') {
      const id = (peer as Json).id;
      if (typeof id === 'string' && id.length > 0) ids.add(id);
    }
    const directPeerProfileId = json.peerProfileId;
    if (typeof directPeerProfileId === 'string' && directPeerProfileId.length > 0) ids.add(directPeerProfileId);
  }
  return [...ids];
};

const main = async () => {
  await mkdir(TEST_RESULTS_DIR, { recursive: true });
  const token = await getToken();

  const evidence: Json = {
    generatedAt: nowIso(),
    scenario: 'Discover Feed Reset prod-ready runtime validation',
  };

  const initialFeed = await request('GET', `${DISCOVER_URL}/discover/feed?quickFilters=all`, token);
  const initial = extractFeed(initialFeed.body);

  const swipedIds = new Set<string>();
  const dislikedIds: string[] = [];
  const likedWithoutMatchIds: string[] = [];
  const swipeResults: HttpResult[] = [];

  const feedCursor = initial.cursor ?? `feed-${Date.now()}`;
  const candidatesToSwipe = initial.candidates.slice(0, 12);
  for (const candidate of candidatesToSwipe) {
    if (dislikedIds.length === 0) {
      const result = await request('POST', `${DISCOVER_URL}/discover/swipe`, token, {
        profileId: candidate.id,
        decision: 'dislike',
        feedCursor,
      });
      swipeResults.push(result);
      if (result.ok) {
        dislikedIds.push(candidate.id);
        swipedIds.add(candidate.id);
      }
      continue;
    }

    if (likedWithoutMatchIds.length === 0) {
      const result = await request('POST', `${DISCOVER_URL}/discover/swipe`, token, {
        profileId: candidate.id,
        decision: 'like',
        feedCursor,
      });
      swipeResults.push(result);
      if (result.ok) {
        swipedIds.add(candidate.id);
        const matched = Boolean((result.body as Json | null)?.matched);
        if (!matched) likedWithoutMatchIds.push(candidate.id);
      }
      continue;
    }

    const result = await request('POST', `${DISCOVER_URL}/discover/swipe`, token, {
      profileId: candidate.id,
      decision: 'dislike',
      feedCursor,
    });
    swipeResults.push(result);
    if (result.ok) {
      dislikedIds.push(candidate.id);
      swipedIds.add(candidate.id);
    }
  }

  const resetRequestBody = {
    quickFilters: ['all'],
  };
  const resetResult = await request('POST', `${DISCOVER_URL}/discover/feed/reset`, token, resetRequestBody, {
    'x-idempotency-key': `runtime-reset-${Date.now()}`,
  });
  const resetFeed = extractFeed(resetResult.body);
  const resetMeta = extractResetMeta(resetResult.body);
  const resetIds = new Set(resetFeed.candidates.map((candidate) => candidate.id));

  const chatConversations = await request('GET', `${CHAT_URL}/chat/conversations`, token);
  const conversationPeerIds = new Set(extractChatPeerIds(chatConversations.body));

  const reloadFeed = await request('GET', `${DISCOVER_URL}/discover/feed?quickFilters=all`, token);
  const reload = extractFeed(reloadFeed.body);
  const reloadIds = new Set(reload.candidates.map((candidate) => candidate.id));

  const case1 = {
    description: 'feed presque epuise -> reset -> nouveaux profils apparaissent',
    pass: resetResult.ok && [...resetIds].some((id) => !swipedIds.has(id)),
  };

  const case2 = {
    description: 'profils passed reintroduits selon regle',
    pass: dislikedIds.length > 0 && dislikedIds.some((id) => resetIds.has(id)),
    dislikedIds,
  };

  const case3 = {
    description: 'profils liked_without_match reintroduits selon regle',
    pass: likedWithoutMatchIds.length > 0 && likedWithoutMatchIds.some((id) => resetIds.has(id)),
    likedWithoutMatchIds,
  };

  const case4 = {
    description: 'profils exclus (conversations ouvertes) ne reviennent pas',
    pass: [...conversationPeerIds].every((id) => !resetIds.has(id)),
    excludedConversationCount: conversationPeerIds.size,
  };

  const case5 = {
    description: 'coherence apres reload',
    pass: reloadFeed.ok && reload.candidates.length > 0 && [...conversationPeerIds].every((id) => !reloadIds.has(id)),
    reloadCandidateCount: reload.candidates.length,
  };

  const overallPass = [case1, case2, case3, case4, case5].every((item) => item.pass);

  evidence.A = {
    initialFeed,
    swipes: swipeResults,
    resetCall: resetResult,
    reloadFeed,
  };
  evidence.B = {
    resetRequestBody,
    resetMeta,
    resetCandidateCount: resetFeed.candidates.length,
    conversationPeerCount: conversationPeerIds.size,
  };
  evidence.C = {
    cases: [case1, case2, case3, case4, case5],
  };
  evidence.verdict = overallPass ? 'PASS' : 'FAIL';

  await writeFile(OUTPUT_PATH, JSON.stringify(evidence, null, 2), 'utf8');
  console.log(`discover-feed-reset-runtime-validation => ${evidence.verdict}`);
  console.log(`output: ${OUTPUT_PATH}`);
};

main().catch(async (error) => {
  const fallback = {
    generatedAt: nowIso(),
    verdict: 'FAIL',
    error: error instanceof Error ? error.message : String(error),
  };
  await mkdir(TEST_RESULTS_DIR, { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify(fallback, null, 2), 'utf8');
  console.error('discover-feed-reset-runtime-validation failed:', fallback.error);
  process.exitCode = 1;
});
