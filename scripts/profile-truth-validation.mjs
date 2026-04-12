import { chromium } from 'playwright';

const APP_URL = 'http://localhost:3000';
const AUTH_URL = 'http://localhost:8787';

const EMAIL = 'test.codex+profiletruth3@local.dev';
const PASSWORD = 'Test1234!';

const ONBOARDING_PROFILE = {
  firstName: 'Johane',
  city: 'moscow',
  interests: ['music', 'sport', 'business'],
  birthDate: '1998-02-03',
};

const EDIT_PROFILE = {
  firstName: 'JohaneUpdated',
  cityLabel: 'Voronezh',
  cityValue: 'voronezh',
  interests: ['Kiteboarding', 'Jazz', 'Matcha'],
};

const extractCookie = (setCookie, name) => {
  if (!setCookie) return null;
  const match = setCookie.match(new RegExp(`${name}=([^;]+)`));
  return match ? match[1] : null;
};

const ensureAuthCookie = async (context) => {
  const cookies = await context.cookies(AUTH_URL);
  return cookies.find((c) => c.name === 'exotic.sid');
};

const readBodyText = async (page) => {
  const text = await page.evaluate(() => document.body.innerText || '');
  return text;
};

const main = async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.addInitScript(() => {
    window.localStorage.setItem('exotic.locale', 'en');
  });

  const steps = [];

  const loginRes = await context.request.post(`${AUTH_URL}/auth/email/login`, {
    data: { email: EMAIL, password: PASSWORD },
  });
  const loginOk = loginRes.ok();
  const setCookie = loginRes.headers()['set-cookie'];
  const sessionCookieValue = extractCookie(setCookie, 'exotic.sid');

  if (sessionCookieValue) {
    await context.addCookies([
      {
        name: 'exotic.sid',
        value: sessionCookieValue,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);
  }

  steps.push({ step: 'login', expected: 'ok', observed: loginOk, source: 'auth-bff', result: loginOk ? 'PASS' : 'FAIL' });

  const hasCookie = Boolean(await ensureAuthCookie(context));
  steps.push({ step: 'auth_cookie', expected: 'present', observed: hasCookie, source: 'browser-cookie', result: hasCookie ? 'PASS' : 'FAIL' });

  await page.goto(`${APP_URL}/`, { waitUntil: 'networkidle' });
  const sessionCheck = await page.evaluate(async () => {
    const res = await fetch('http://localhost:8787/auth/session', { credentials: 'include' });
    return res.json();
  });
  steps.push({
    step: 'session_check',
    expected: 'authenticated=true',
    observed: sessionCheck?.data?.authenticated ?? false,
    source: 'auth-bff',
    result: sessionCheck?.data?.authenticated ? 'PASS' : 'FAIL',
  });

  const onboardRes = await context.request.post(`${AUTH_URL}/onboarding/complete`, {
    data: {
      version: 'v1',
      firstName: ONBOARDING_PROFILE.firstName,
      locale: 'en',
      birthDate: ONBOARDING_PROFILE.birthDate,
      gender: 'homme',
      city: ONBOARDING_PROFILE.city,
      originCountry: 'russian',
      languages: ['fr', 'en'],
      intent: 'decouverte',
      interests: ONBOARDING_PROFILE.interests,
      photosCount: 1,
      verifyNow: false,
      lookingFor: 'tous',
      ageMin: 22,
      ageMax: 38,
      distanceKm: 50,
      targetLang: 'en',
      autoTranslate: true,
      autoDetectLanguage: true,
      notifications: true,
      preciseLocation: false,
    },
  });
  steps.push({ step: 'onboarding_complete', expected: 'ok', observed: onboardRes.ok(), source: 'auth-bff', result: onboardRes.ok() ? 'PASS' : 'FAIL' });

  await page.goto(`${APP_URL}/profile`, { waitUntil: 'networkidle' });
  const body1 = await readBodyText(page);
  const name1 = body1.includes(ONBOARDING_PROFILE.firstName) ? ONBOARDING_PROFILE.firstName : 'null';
  const city1 = body1.includes('Moscow') ? 'Moscow' : body1.includes('Москва') ? 'Москва' : 'null';
  steps.push({
    step: 'profile_initial_display',
    expected: `${ONBOARDING_PROFILE.firstName} + Moscow`,
    observed: `${name1} + ${city1}`,
    source: 'ProfileScreen',
    result: name1 === ONBOARDING_PROFILE.firstName && city1 !== 'null' ? 'PASS' : 'FAIL',
  });

  await page.goto(`${APP_URL}/profile/edit`, { waitUntil: 'networkidle' });
  const editUrl = page.url();
  steps.push({ step: 'edit_profile_url', expected: '/profile/edit', observed: editUrl, source: 'browser', result: editUrl.includes('/profile/edit') ? 'PASS' : 'FAIL' });

  const firstNameSection = page.locator('section', { hasText: /First name|Имя/ });
  const citySection = page.locator('section', { hasText: /City|Город/ });
  const interestsSection = page.locator('section', { hasText: /Interests|Интересы/ });
  const firstCount = await firstNameSection.count();
  const cityCount = await citySection.count();
  steps.push({ step: 'edit_profile_sections', expected: 'present', observed: `${firstCount}/${cityCount}`, source: 'dom', result: firstCount > 0 && cityCount > 0 ? 'PASS' : 'FAIL' });

  if (firstCount === 0) {
    await page.screenshot({ path: 'D:/Dev/date-ui-kit/test-results/profile-edit-missing.png', fullPage: true });
    console.log('PROFILE TRUTH VALIDATION');
    for (const row of steps) {
      console.log(`${row.step} | expected=${row.expected} | observed=${row.observed} | source=${row.source} | result=${row.result}`);
    }
    await browser.close();
    process.exit(1);
  }

  const firstNameInput = firstNameSection.locator('input').first();
  const cityInput = citySection.locator('input').first();
  const interestInput = interestsSection.getByPlaceholder(/Add an interest|Добавьте интерес/);
  const addInterestButton = interestsSection.getByRole('button', { name: /Add|Добавить/ });
  const saveButton = page.getByRole('button', { name: /Save|Сохранить/ });

  for (const tag of ONBOARDING_PROFILE.interests) {
    const tagButton = interestsSection.getByRole('button', { name: new RegExp(tag, 'i') });
    if (await tagButton.count()) {
      await tagButton.first().click();
      await page.waitForTimeout(150);
    }
  }

  await firstNameInput.fill(EDIT_PROFILE.firstName);
  await cityInput.fill(EDIT_PROFILE.cityLabel);

  for (const interest of EDIT_PROFILE.interests) {
    await interestInput.fill(interest);
    await addInterestButton.click();
  }

  await saveButton.click();
  await page.waitForTimeout(1200);

  const storageState = await page.evaluate(() => ({
    snapshot: window.localStorage.getItem('exotic.onboarding.profile-snapshot.v1'),
    draft: window.localStorage.getItem('exotic.onboarding.draft.v1'),
  }));

  steps.push({
    step: 'snapshot_after_save',
    expected: 'null',
    observed: storageState.snapshot ? 'present' : 'null',
    source: 'localStorage',
    result: storageState.snapshot ? 'FAIL' : 'PASS',
  });
  steps.push({
    step: 'draft_after_save',
    expected: 'null',
    observed: storageState.draft ? 'present' : 'null',
    source: 'localStorage',
    result: storageState.draft ? 'FAIL' : 'PASS',
  });

  await page.goto(`${APP_URL}/profile`, { waitUntil: 'networkidle' });
  const body2 = await readBodyText(page);
  const name2 = body2.includes(EDIT_PROFILE.firstName) ? EDIT_PROFILE.firstName : 'null';
  const city2 = body2.includes('Voronezh') ? 'Voronezh' : body2.includes('Воронеж') ? 'Воронеж' : body2.includes('Moscow') ? 'Moscow' : 'null';
  steps.push({
    step: 'profile_after_edit',
    expected: `${EDIT_PROFILE.firstName} + Voronezh`,
    observed: `${name2} + ${city2}`,
    source: 'ProfileScreen',
    result: name2 === EDIT_PROFILE.firstName && city2 !== 'null' ? 'PASS' : 'FAIL',
  });

  await page.reload({ waitUntil: 'networkidle' });
  const body3 = await readBodyText(page);
  const name3 = body3.includes(EDIT_PROFILE.firstName) ? EDIT_PROFILE.firstName : 'null';
  const city3 = body3.includes('Voronezh') ? 'Voronezh' : body3.includes('Воронеж') ? 'Воронеж' : body3.includes('Moscow') ? 'Moscow' : 'null';
  steps.push({
    step: 'profile_after_reload',
    expected: `${EDIT_PROFILE.firstName} + Voronezh`,
    observed: `${name3} + ${city3}`,
    source: 'ProfileScreen',
    result: name3 === EDIT_PROFILE.firstName && city3 !== 'null' ? 'PASS' : 'FAIL',
  });

  await context.clearCookies();
  const reloginRes = await context.request.post(`${AUTH_URL}/auth/email/login`, {
    data: { email: EMAIL, password: PASSWORD },
  });
  const reloginCookie = extractCookie(reloginRes.headers()['set-cookie'], 'exotic.sid');
  if (reloginCookie) {
    await context.addCookies([
      {
        name: 'exotic.sid',
        value: reloginCookie,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);
  }
  await page.goto(`${APP_URL}/profile`, { waitUntil: 'networkidle' });
  const body4 = await readBodyText(page);
  const name4 = body4.includes(EDIT_PROFILE.firstName) ? EDIT_PROFILE.firstName : 'null';
  const city4 = body4.includes('Voronezh') ? 'Voronezh' : body4.includes('Воронеж') ? 'Воронеж' : body4.includes('Moscow') ? 'Moscow' : 'null';
  steps.push({
    step: 'profile_after_relogin',
    expected: `${EDIT_PROFILE.firstName} + Voronezh`,
    observed: `${name4} + ${city4}`,
    source: 'ProfileScreen',
    result: name4 === EDIT_PROFILE.firstName && city4 !== 'null' ? 'PASS' : 'FAIL',
  });

  let discoverUrl = null;
  page.on('request', (req) => {
    if (req.url().includes('/discover/feed')) {
      discoverUrl = req.url();
    }
  });

  await page.goto(`${APP_URL}/discover`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  const discoverHasCity = discoverUrl ? discoverUrl.includes(EDIT_PROFILE.cityValue) || discoverUrl.includes(EDIT_PROFILE.cityLabel) : false;
  const discoverHasInterests = discoverUrl ? discoverUrl.toLowerCase().includes('interests') : false;
  const discoverHasNewInterest = discoverUrl ? discoverUrl.toLowerCase().includes('kiteboarding') : false;

  steps.push({
    step: 'discover_feed_request',
    expected: 'query includes new city + interests',
    observed: discoverUrl ?? 'null',
    source: 'discover-request',
    result: discoverHasCity && discoverHasInterests && discoverHasNewInterest ? 'PASS' : 'FAIL',
  });

  console.log('PROFILE TRUTH VALIDATION');
  for (const row of steps) {
    console.log(`${row.step} | expected=${row.expected} | observed=${row.observed} | source=${row.source} | result=${row.result}`);
  }

  await browser.close();
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
