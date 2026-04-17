import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const AUTH_ENV_PATH = path.resolve('backend/services/auth-bff/.env');
const AUTH_BFF_URL = process.env.VITE_AUTH_BFF_URL || 'http://localhost:8787';

const parseEnvFile = (filePath) => {
  const out = {};
  const raw = fs.readFileSync(filePath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#')) continue;
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    let [, key, value] = match;
    value = value.trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
};

const env = parseEnvFile(AUTH_ENV_PATH);
const SUPABASE_URL = env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = env.SUPABASE_SERVICE_ROLE;

const pickBaseUrl = async () => {
  const candidates = ['http://localhost:3000', 'http://localhost:3001'];
  for (const url of candidates) {
    try {
      const res = await fetch(url, { method: 'GET' });
      if (res.ok || res.status === 200 || res.status === 304) return url;
    } catch {
      // try next
    }
  }
  return candidates[1];
};

const createUser = async (email, password) => {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`createUser failed: ${res.status} ${text}`);
  }
  return res.json();
};

const login = async (email, password) => {
  const res = await fetch(`${AUTH_BFF_URL}/auth/email/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`login failed: ${res.status} ${text}`);
  }
  const setCookie = res.headers.get('set-cookie') || '';
  if (!setCookie) throw new Error('login missing set-cookie');
  return { setCookie, payload: await res.json() };
};

const parseCookies = (setCookieHeader, baseUrl) => {
  const cookies = [];
  const baseDomain = new URL(baseUrl).hostname;
  const parts = setCookieHeader.split(/,(?=[^;]+?=)/g);
  for (const part of parts) {
    const [pair, ...attrs] = part.split(';').map((s) => s.trim());
    if (!pair) continue;
    const [name, ...valueParts] = pair.split('=');
    if (!name) continue;
    const value = valueParts.join('=');
    if (!value) continue;
    const cookie = {
      name,
      value,
      domain: baseDomain,
      path: '/',
    };
    attrs.forEach((attr) => {
      const [k, v] = attr.split('=');
      if (!k) return;
      const key = k.toLowerCase();
      if (key === 'path' && v) cookie.path = v;
      if (key === 'domain' && v) cookie.domain = v;
      if (key === 'secure') cookie.secure = true;
      if (key === 'httponly') cookie.httpOnly = true;
      if (key === 'samesite' && v) cookie.sameSite = v;
    });
    cookies.push(cookie);
  }
  return cookies;
};

const completeOnboarding = async (cookieHeader, payload) => {
  const res = await fetch(`${AUTH_BFF_URL}/onboarding/complete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      cookie: cookieHeader,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`completeOnboarding failed: ${res.status} ${text}`);
  }
  return res.json();
};

const fetchProfileMe = async (cookieHeader) => {
  const res = await fetch(`${AUTH_BFF_URL}/profiles/me`, {
    method: 'GET',
    headers: { cookie: cookieHeader },
  });
  if (!res.ok) return null;
  return res.json();
};

const run = async () => {
  const baseUrl = await pickBaseUrl();
  const now = Date.now();
  const email = `test.onboarding.city.${now}@local.dev`;
  const password = 'Test1234!';
  const cityKey = 'voronezh';
  const cityLabel = 'Voronezh';

  await createUser(email, password);
  const loginResult = await login(email, password);
  const cookieHeader = loginResult.setCookie.split(/\r?\n/).map((line) => line.split(';')[0]).join('; ');

  await completeOnboarding(cookieHeader, {
    version: 'v1',
    firstName: 'Johane',
    locale: 'en',
    birthDate: '1997-10-10',
    gender: 'autre',
    city: cityKey,
    originCountry: 'russian',
    languages: ['francais'],
    intent: 'serieuse',
    interests: ['musique', 'sport', 'voyage'],
    photosCount: 0,
    verifyNow: false,
    lookingFor: 'tous',
    ageMin: 21,
    ageMax: 45,
    distanceKm: 50,
    targetLang: 'fr',
    autoTranslate: false,
    autoDetectLanguage: true,
    notifications: true,
    preciseLocation: false,
  });

  const apiProfile = await fetchProfileMe(cookieHeader);
  const apiCity = apiProfile?.data?.profile?.city ?? null;

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const cookies = parseCookies(loginResult.setCookie, baseUrl);
  if (cookies.length > 0) await context.addCookies(cookies);

  const page = await context.newPage();
  const seenRequests = [];
  page.on('request', (req) => {
    if (req.url().includes('/profiles/me')) {
      seenRequests.push({ url: req.url(), method: req.method() });
    }
  });
  page.on('console', (msg) => {
    if (['error', 'warning'].includes(msg.type())) {
      console.log(`[console.${msg.type()}] ${msg.text()}`);
    }
  });
  await page.addInitScript((payload) => {
    localStorage.setItem('exotic.locale', payload.locale);
    localStorage.setItem(
      'exotic.onboarding.profile-snapshot.v1',
      JSON.stringify({
        firstName: payload.firstName,
        city: payload.city,
        intent: payload.intent,
        interests: payload.interests,
        birthDate: payload.birthDate,
        verifyNow: payload.verifyNow,
        updatedAtIso: new Date().toISOString(),
      }),
    );
    localStorage.removeItem('exotic.onboarding.draft.v1');
  }, {
    locale: 'en',
    firstName: 'Johane',
    city: cityKey,
    intent: 'serieuse',
    interests: ['musique', 'sport', 'voyage'],
    birthDate: '1997-10-10',
    verifyNow: false,
  });

  let profileResponseSeen = false;
  await page.route('**/profiles/me', async (route) => {
    await new Promise((r) => setTimeout(r, 2000));
    profileResponseSeen = true;
    await route.continue();
  });

  const results = [];

  // Step 1+2+3: onboarding done, navigate to profile, check initial render before /profiles/me resolves
  await page.goto(`${baseUrl}/profile`, { waitUntil: 'domcontentloaded' });
  let initialHasCity = false;
  let initialObservedAtMs = null;
  let elapsed = 0;
  for (const delay of [200, 600, 1200, 1800]) {
    const waitFor = delay - elapsed;
    if (waitFor > 0) {
      await page.waitForTimeout(waitFor);
      elapsed = delay;
    }
    const body = await page.textContent('body');
    if (body?.includes(cityLabel)) {
      initialHasCity = true;
      initialObservedAtMs = delay;
      break;
    }
  }
  results.push({
    step: 'initial_render',
    expected: cityLabel,
    observed: initialHasCity ? `${cityLabel} (t=${initialObservedAtMs}ms)` : 'not_found',
    source: 'optimistic_seed (onboarding snapshot)',
    result: initialHasCity ? 'PASS' : 'FAIL',
  });

  // Wait for /profiles/me
  const profileResponse = await page
    .waitForResponse((resp) => resp.url().includes('/profiles/me') && resp.status() === 200, { timeout: 30000 })
    .catch(() => null);
  if (!profileResponse) {
    const currentUrl = page.url();
    const bodySnippet = (await page.textContent('body'))?.slice(0, 500) ?? '';
    throw new Error(
      `profiles/me response not seen. url=${currentUrl} requests=${JSON.stringify(seenRequests)} body=${bodySnippet}`,
    );
  }
  const snapshotAfterPersist = await page.evaluate(() => localStorage.getItem('exotic.onboarding.profile-snapshot.v1'));
  results.push({
    step: 'after_profiles_me',
    expected: 'snapshot_cleared',
    observed: snapshotAfterPersist ? 'snapshot_still_present' : 'snapshot_cleared',
    source: 'localStorage',
    result: snapshotAfterPersist ? 'FAIL' : 'PASS',
  });

  // Step 4+5: reload
  await page.reload({ waitUntil: 'domcontentloaded' });
  const reloadResponse = await page
    .waitForResponse((resp) => resp.url().includes('/profiles/me') && resp.status() === 200, { timeout: 30000 })
    .catch(() => null);
  if (!reloadResponse) {
    const currentUrl = page.url();
    throw new Error(`profiles/me response not seen after reload. url=${currentUrl}`);
  }
  const reloadBody = await page.textContent('body');
  const reloadHasCity = reloadBody?.includes(cityLabel) ?? false;
  results.push({
    step: 'after_reload',
    expected: cityLabel,
    observed: reloadHasCity ? cityLabel : 'not_found',
    source: '/profiles/me',
    result: reloadHasCity ? 'PASS' : 'FAIL',
  });

  await browser.close();

  const summary = {
    baseUrl,
    apiCity,
    profileResponseDelayed: profileResponseSeen,
    results,
  };

  const outPath = path.resolve('test-results/onboarding-city-validation.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(summary, null, 2));

  console.log(JSON.stringify(summary, null, 2));
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
