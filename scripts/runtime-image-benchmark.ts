import { spawn, type ChildProcess } from 'node:child_process';
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
  jankFrames: number;
  longTasks: number;
};

type ScenarioResult = {
  page: PageTarget['key'];
  device: DeviceMode;
  mode: OptMode;
  firstLoad: RunMetrics;
  secondLoad: Pick<RunMetrics, 'imageRequests' | 'imageBytes' | 'imageCacheHits'>;
};

const BASE_URL = 'http://127.0.0.1:3000';

const targets: PageTarget[] = [
  { key: 'discover', route: '/discover', firstUsefulSelector: '.container-deck img' },
  { key: 'likes', route: '/likes', firstUsefulSelector: 'article img' },
  { key: 'messages', route: '/messages', firstUsefulSelector: 'img' },
  { key: 'profile', route: '/profile', firstUsefulSelector: '.aspect-square img, img' },
];

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
      return { totalBytes, imageBytes, imageRequests, imageCacheHits };
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

const runSingleNavigation = async (
  page: import('playwright').Page,
  target: PageTarget,
  mode: OptMode,
): Promise<RunMetrics> => {
  const capture = await setupNetworkCapture(page, (page as any).__deviceMode as DeviceMode);
  await setupPagePerf(page);

  const url = `${BASE_URL}${target.route}?imgOpt=${mode}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 40_000 });

  let firstUsefulMs: number | null = null;
  try {
    await page.waitForSelector(target.firstUsefulSelector, { timeout: 5_000, state: 'visible' });
    firstUsefulMs = await page.evaluate(() => performance.now());
  } catch {
    firstUsefulMs = null;
  }

  await delay(500);

  const scrollProbe = await page.evaluate(async () => {
    let jankFrames = 0;
    let prev = performance.now();
    for (let i = 0; i < 20; i += 1) {
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
    jankFrames: scrollProbe.jankFrames,
    longTasks: scrollProbe.longTasks,
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
          ...devices['iPhone 13'],
          bypassCSP: true,
        })
      : await browser.newContext({
          viewport: { width: 1440, height: 900 },
          deviceScaleFactor: 1,
          bypassCSP: true,
        });

  const page = await context.newPage();
  (page as any).__deviceMode = deviceMode;

  const firstLoad = await runSingleNavigation(page, target, mode);
  const secondLoad = await runSingleNavigation(page, target, mode);

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
  const server = await startDevServer();
  const browser = await chromium.launch({ headless: true });
  const results: ScenarioResult[] = [];

  try {
    for (const target of targets) {
      for (const device of ['desktop', 'mobile'] as const) {
        for (const mode of ['off', 'on'] as const) {
          const result = await runScenario(browser, target, device, mode);
          results.push(result);
        }
      }
    }
  } finally {
    await browser.close();
    await stopDevServer(server);
  }

  console.log(JSON.stringify({ results }, null, 2));
};

void main();
