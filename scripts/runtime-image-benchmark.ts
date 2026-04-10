import { spawn, type ChildProcess } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium, devices } from 'playwright';

type DeviceMode = 'desktop' | 'mobile';
type OptMode = 'off' | 'on';

type PageTarget = {
  key: 'discover' | 'likes' | 'messages' | 'profile';
  route: string;
  firstUsefulSelector: string;
};

type RunMetrics = {
  lcpMs: number | null;
  firstUsefulMs: number | null;
  totalBytes: number;
  imageBytes: number;
  imageRequests: number;
  imageCacheHits: number;
  domImageCount: number;
  resourceImageCount: number;
  resourceImageBytes: number;
  resourceByType: Record<string, number>;
  resourceByInitiator: Record<string, number>;
  jankFrames: number;
  longTasks: number;
  routePath: string;
  bodySample: string;
};

type ScenarioResult = {
  page: PageTarget['key'];
  device: DeviceMode;
  mode: OptMode;
  firstLoad: RunMetrics;
  secondLoad: Pick<RunMetrics, 'imageRequests' | 'imageBytes' | 'imageCacheHits'>;
  error?: string;
};

const BASE_URL = 'http://127.0.0.1:3000';
const EPHEMERAL_ACCESS_STORAGE_KEY = 'exotic.auth.ephemeral-access.v1';

const allTargets: PageTarget[] = [
  { key: 'discover', route: '/discover', firstUsefulSelector: 'img' },
  { key: 'likes', route: '/likes', firstUsefulSelector: 'img' },
  { key: 'messages', route: '/messages', firstUsefulSelector: 'img' },
  { key: 'profile', route: '/profile', firstUsefulSelector: 'img' },
];

const envList = (value: string | undefined) =>
  value ? value.split(',').map((entry) => entry.trim()).filter(Boolean) : [];

const startDevServer = async (): Promise<ChildProcess> => {
  const child = spawn('npm', ['run', 'dev'], {
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, FORCE_COLOR: '0' },
  });

  let ready = false;
  let outputBuffer = '';
  child.stdout?.on('data', (buffer) => {
    const text = String(buffer);
    outputBuffer += text;
    if (text.includes('Local:') || text.includes('http://127.0.0.1:3000')) {
      ready = true;
    }
  });
  child.stderr?.on('data', (buffer) => {
    outputBuffer += String(buffer);
  });

  const startedAt = Date.now();
  while (!ready && Date.now() - startedAt < 60_000) {
    try {
      const response = await fetch(BASE_URL);
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {}
    await delay(250);
  }
  if (!ready) {
    child.kill('SIGTERM');
    throw new Error(`dev_server_not_ready:${outputBuffer.slice(-1000)}`);
  }
  return child;
};

const stopDevServer = async (child: ChildProcess) => {
  if (child.killed) return;
  child.kill('SIGTERM');
  await delay(500);
  if (!child.killed) child.kill('SIGKILL');
};

const setupNetworkCapture = async (page: import('playwright').Page, device: DeviceMode) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  if (device === 'mobile') {
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 150,
      downloadThroughput: 1_500_000 / 8,
      uploadThroughput: 750_000 / 8,
      connectionType: 'cellular3g',
    });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  }

  const requestType = new Map<string, string>();
  const requestUrl = new Map<string, string>();
  let totalBytes = 0;
  let imageBytes = 0;
  let imageRequests = 0;
  let imageCacheHits = 0;
  const bytesByType: Record<string, number> = {};
  const bytesByInitiator: Record<string, number> = {};

  cdp.on('Network.requestWillBeSent', (event) => {
    if (!event.requestId) return;
    requestType.set(event.requestId, event.type ?? 'Other');
    requestUrl.set(event.requestId, event.request?.url ?? '');
  });

  cdp.on('Network.responseReceived', (event) => {
    const type = requestType.get(event.requestId);
    if (type !== 'Image') return;
    const fromCache = Boolean(event.response?.fromDiskCache || event.response?.fromPrefetchCache);
    if (fromCache) imageCacheHits += 1;
  });

  cdp.on('Network.loadingFinished', (event) => {
    const type = requestType.get(event.requestId);
    const encoded = Number(event.encodedDataLength ?? 0);
    totalBytes += encoded;
    if (type) {
      bytesByType[type] = (bytesByType[type] ?? 0) + encoded;
    }
    const initiatorType = type ?? 'Other';
    bytesByInitiator[initiatorType] = (bytesByInitiator[initiatorType] ?? 0) + encoded;
    if (type === 'Image') {
      imageRequests += 1;
      imageBytes += encoded;
    }
    requestType.delete(event.requestId);
    requestUrl.delete(event.requestId);
  });

  return {
    stop: async () => {
      await cdp.detach();
      return { totalBytes, imageBytes, imageRequests, imageCacheHits, bytesByType, bytesByInitiator };
    },
  };
};

const setupPagePerf = async (page: import('playwright').Page) => {
  await page.addInitScript(() => {
    (window as any).__perfAudit = {
      lcp: null,
      longTasks: 0,
    };
    try {
      const lcpObserver = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        const last = entries[entries.length - 1];
        if (last) (window as any).__perfAudit.lcp = last.startTime;
      });
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch {}

    try {
      const longTaskObserver = new PerformanceObserver((entryList) => {
        (window as any).__perfAudit.longTasks += entryList.getEntries().length;
      });
      longTaskObserver.observe({ type: 'longtask', buffered: true });
    } catch {}
  });
};

const safeGoto = async (page: import('playwright').Page, url: string) => {
  const maxAttempts = 2;
  let lastError: unknown = null;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 35_000 });
      return;
    } catch (error) {
      lastError = error;
      await delay(500);
    }
  }
  throw lastError ?? new Error('navigation_failed');
};

const runSingleNavigation = async (
  page: import('playwright').Page,
  target: PageTarget,
  mode: OptMode,
): Promise<RunMetrics> => {
  const capture = await setupNetworkCapture(page, (page as any).__deviceMode as DeviceMode);
  await setupPagePerf(page);

  const url = `${BASE_URL}${target.route}?imgOpt=${mode}&bench=1`;
  await safeGoto(page, url);

  let firstUsefulMs: number | null = null;
  try {
    const fast = process.env.BENCH_FAST === '1';
    await page.waitForSelector(target.firstUsefulSelector, { timeout: fast ? 3000 : 6000, state: 'visible' });
    firstUsefulMs = await page.evaluate(() => performance.now());
  } catch {
    try {
      const fast = process.env.BENCH_FAST === '1';
      await page.waitForFunction(
        () => Boolean(document.body && document.body.innerText && document.body.innerText.trim().length > 0),
        { timeout: fast ? 3000 : 6000 },
      );
      firstUsefulMs = await page.evaluate(() => performance.now());
    } catch {
      firstUsefulMs = null;
    }
  }

  await delay(process.env.BENCH_FAST === '1' ? 250 : 500);

  const scrollProbe = await page.evaluate(async () => {
    let jankFrames = 0;
    let prev = performance.now();
    const steps = process.env.BENCH_FAST === '1' ? 10 : 20;
    for (let i = 0; i < steps; i += 1) {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          const now = performance.now();
          if (now - prev > 24) jankFrames += 1;
          prev = now;
          window.scrollBy(0, 80);
          resolve();
        });
      });
    }
    return {
      lcp: (window as any).__perfAudit?.lcp ?? null,
      longTasks: (window as any).__perfAudit?.longTasks ?? 0,
      domImageCount: document.querySelectorAll('img').length,
      jankFrames,
      resourceImageCount: performance
        .getEntriesByType('resource')
        .filter((entry) => (entry as PerformanceResourceTiming).initiatorType === 'img').length,
      resourceImageBytes: performance
        .getEntriesByType('resource')
        .filter((entry) => (entry as PerformanceResourceTiming).initiatorType === 'img')
        .reduce((sum, entry) => sum + ((entry as PerformanceResourceTiming).transferSize || 0), 0),
      routePath: window.location.pathname,
      bodySample: document.body?.innerText?.slice(0, 140) ?? '',
    };
  });

  const net = await capture.stop();
  return {
    lcpMs: typeof scrollProbe.lcp === 'number' ? scrollProbe.lcp : null,
    firstUsefulMs,
    totalBytes: net.totalBytes,
    imageBytes: net.imageBytes,
    imageRequests: net.imageRequests,
    imageCacheHits: net.imageCacheHits,
    domImageCount: scrollProbe.domImageCount,
    resourceImageCount: scrollProbe.resourceImageCount,
    resourceImageBytes: scrollProbe.resourceImageBytes,
    resourceByType: net.bytesByType,
    resourceByInitiator: net.bytesByInitiator,
    jankFrames: scrollProbe.jankFrames,
    longTasks: scrollProbe.longTasks,
    routePath: scrollProbe.routePath,
    bodySample: scrollProbe.bodySample,
  };
};

const runScenario = async (
  browser: import('playwright').Browser,
  target: PageTarget,
  deviceMode: DeviceMode,
  mode: OptMode,
): Promise<ScenarioResult> => {
  const context =
    deviceMode === 'mobile'
      ? await browser.newContext({
          viewport: { width: 390, height: 844 },
          deviceScaleFactor: 2,
          bypassCSP: true,
        })
      : await browser.newContext({
          viewport: { width: 1440, height: 900 },
          deviceScaleFactor: 1,
          bypassCSP: true,
        });

  if (process.env.BENCH_TRACE === '1') {
    await mkdir('test-results/bench-traces', { recursive: true });
    await context.tracing.start({ screenshots: true, snapshots: true, sources: false });
  }
  const page = await context.newPage();
  (page as any).__deviceMode = deviceMode;
  page.setDefaultNavigationTimeout(40_000);
  await page.addInitScript((storageKey: string) => {
    const payload = { enabledAtIso: new Date().toISOString() };
    window.localStorage.setItem(storageKey, JSON.stringify(payload));
  }, EPHEMERAL_ACCESS_STORAGE_KEY);

  const firstLoad = await runSingleNavigation(page, target, mode);
  const secondLoad = await runSingleNavigation(page, target, mode);

  if (process.env.BENCH_TRACE === '1') {
    const label = `${target.key}-${deviceMode}-${mode}`;
    const tracePath = `test-results/bench-traces/${label}.zip`;
    await context.tracing.stop({ path: tracePath });
  }
  await context.close();

  return {
    page: target.key,
    device: deviceMode,
    mode,
    firstLoad,
    secondLoad: {
      imageRequests: secondLoad.imageRequests,
      imageBytes: secondLoad.imageBytes,
      imageCacheHits: secondLoad.imageCacheHits,
    },
  };
};

const main = async () => {
  const skipServer = process.env.BENCH_SKIP_SERVER === '1';
  const server = skipServer ? null : await startDevServer();
  const headless = process.env.BENCH_HEADLESS !== '0';
  const browser = await chromium.launch({
    headless,
    args: ['--disable-gpu', '--disable-dev-shm-usage'],
  });
  const results: ScenarioResult[] = [];

  try {
    const targetFilter = new Set(envList(process.env.BENCH_PAGES));
    const deviceFilter = new Set(envList(process.env.BENCH_DEVICES));
    const modeFilter = new Set(envList(process.env.BENCH_MODES));
    const targets = targetFilter.size > 0 ? allTargets.filter((t) => targetFilter.has(t.key)) : allTargets;
    const devices: DeviceMode[] = (deviceFilter.size > 0
      ? (['desktop', 'mobile'] as const).filter((d) => deviceFilter.has(d))
      : ['desktop', 'mobile']) as DeviceMode[];
    const modes: OptMode[] = (modeFilter.size > 0
      ? (['off', 'on'] as const).filter((m) => modeFilter.has(m))
      : ['off', 'on']) as OptMode[];

    for (const target of targets) {
      for (const device of devices) {
        for (const mode of modes) {
          const label = `${target.key}:${device}:${mode}`;
          // eslint-disable-next-line no-console
          console.log(`[bench] start ${label}`);
          const timeoutMs = Number(process.env.BENCH_TIMEOUT_MS ?? '120000');
          try {
            const result = await Promise.race([
              runScenario(browser, target, device, mode),
              new Promise<ScenarioResult>((_, reject) =>
                setTimeout(() => reject(new Error(`timeout_${label}`)), timeoutMs),
              ),
            ]);
            results.push(result as ScenarioResult);
            // eslint-disable-next-line no-console
            console.log(`[bench] done ${label}`);
          } catch (error) {
            results.push({
              page: target.key,
              device,
              mode,
              firstLoad: {
                lcpMs: null,
                firstUsefulMs: null,
                totalBytes: 0,
                imageBytes: 0,
                imageRequests: 0,
                imageCacheHits: 0,
                domImageCount: 0,
                resourceImageCount: 0,
                resourceImageBytes: 0,
                resourceByType: {},
                jankFrames: 0,
                longTasks: 0,
                routePath: '',
                bodySample: '',
              },
              secondLoad: { imageRequests: 0, imageBytes: 0, imageCacheHits: 0 },
              error: error instanceof Error ? error.message : 'bench_error',
            });
            // eslint-disable-next-line no-console
            console.log(`[bench] fail ${label}`);
          }
        }
      }
    }
  } finally {
    await browser.close();
    if (server) {
      await stopDevServer(server);
    }
  }

  console.log(JSON.stringify({ results }, null, 2));
};

void main();
