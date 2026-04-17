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

const extractCookie = (setCookie, name) => {
  if (!setCookie) return null;
  const match = setCookie.match(new RegExp(`${name}=([^;]+)`));
  return match ? match[1] : null;
};

const main = async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.addInitScript(() => {
    window.localStorage.setItem('exotic.locale', 'en');
  });

  const loginRes = await context.request.post(`${AUTH_URL}/auth/email/login`, {
    data: { email: EMAIL, password: PASSWORD },
  });
  const sessionCookieValue = extractCookie(loginRes.headers()['set-cookie'], 'exotic.sid');
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

  await context.request.post(`${AUTH_URL}/onboarding/complete`, {
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

  const profileRes = await context.request.get(`${AUTH_URL}/profiles/me`);
  const profileJson = await profileRes.json();
  console.log('profiles/me', profileJson?.data?.profile ?? null);

  await page.goto(`${APP_URL}/profile`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const bodyText = await page.evaluate(() => document.body.innerText || '');
  const hasMoscow = bodyText.includes('Moscow') || bodyText.includes('Москва');
  console.log('body_has_moscow', hasMoscow);
  console.log('body_text_snippet', bodyText.slice(0, 400));

  await page.screenshot({ path: 'D:/Dev/date-ui-kit/test-results/profile-onboarding-city.png', fullPage: true });

  await browser.close();
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
