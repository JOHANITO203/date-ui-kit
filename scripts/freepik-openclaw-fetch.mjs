#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const promptsPath =
  process.env.FREEPIK_PROMPTS_FILE?.trim() ||
  path.join(rootDir, "backend", "services", "auth-bff", "scripts", "freepik-prompts.json");
const assetsRoot =
  process.env.SEED_ASSETS_DIR?.trim() || path.join(rootDir, "seed-assets", "launch-servers");

const perServer = Number(process.env.FREEPIK_SEED_PER_SERVER || "13");
const maxTotal = Number(process.env.FREEPIK_OPENCLAW_MAX || "52");
const skipExisting = process.env.FREEPIK_OPENCLAW_SKIP_EXISTING !== "0";
const delayMs = Number(process.env.FREEPIK_OPENCLAW_DELAY_MS || "600");
const browserTimeoutMs = Number(process.env.FREEPIK_OPENCLAW_TIMEOUT_MS || "120000");
const serverFilterRaw = process.env.FREEPIK_OPENCLAW_SERVERS || "";
const serverFilter = serverFilterRaw
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const runOpenclaw = (args) => {
  const runnerPath = path.join(rootDir, "scripts", "openclaw-runner.mjs");
  const finalArgs =
    args[0] === "browser"
      ? [runnerPath, "browser", "--timeout", String(browserTimeoutMs), ...args.slice(1)]
      : [runnerPath, ...args];
  const result = spawnSync(process.execPath, finalArgs, {
    cwd: rootDir,
    encoding: "utf8",
  });

  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  if (result.status !== 0) {
    throw new Error(
      `openclaw ${args.join(" ")} failed (code ${result.status})\nstdout:\n${stdout}\nstderr:\n${stderr}`,
    );
  }
  return stdout;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const parseJson = (raw) => {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const parseEvaluateOutput = (stdout) => {
  const lines = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const last = lines[lines.length - 1] || "";
  const parsed = parseJson(last);
  if (typeof parsed === "string") return parsed;
  if (parsed === null) return null;
  return last.replace(/^"|"$/g, "");
};

const extractDownloadRef = (snapshotOut) => {
  const patterns = [
    /button "(?:Download|Download by file types|Télécharger|Скачать)[^"]*" \[ref=(e\d+)\]/i,
    /button \[ref=(e\d+)\]\s*$/m,
  ];
  for (const pattern of patterns) {
    const match = snapshotOut.match(pattern);
    if (match) return match[1];
  }
  return null;
};

const detectExtension = (filePath) => {
  const header = readFileSync(filePath).subarray(0, 12);
  if (header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) return "jpg";
  if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4e && header[3] === 0x47) return "png";
  if (
    header[0] === 0x52 &&
    header[1] === 0x49 &&
    header[2] === 0x46 &&
    header[3] === 0x46 &&
    header[8] === 0x57 &&
    header[9] === 0x45 &&
    header[10] === 0x42 &&
    header[11] === 0x50
  ) {
    return "webp";
  }
  return "jpg";
};

const slugify = (value) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

const ensureDir = (dirPath) => {
  if (!existsSync(dirPath)) mkdirSync(dirPath, { recursive: true });
};

const loadPrompts = () => {
  const raw = readFileSync(promptsPath, "utf8");
  return JSON.parse(raw);
};

const pickAssetUrl = async (query) => {
  const searchUrl = `https://www.freepik.com/search?format=search&type=photo&query=${encodeURIComponent(query)}`;
  runOpenclaw(["browser", "navigate", searchUrl]);
  runOpenclaw(["browser", "wait", "--load", "networkidle"]);

  const evalOut = runOpenclaw([
    "browser",
    "evaluate",
    "--fn",
    `() => {
      const links = Array.from(document.querySelectorAll('a[href]')).map((a) => a.href.split('#')[0]);
      const uniq = Array.from(new Set(links));
      const free = uniq.find((u) => /\\/free-photo\\//.test(u));
      if (free) return free;
      const anyPhoto = uniq.find((u) => /\\/(free-photo|premium-photo)\\//.test(u));
      return anyPhoto || null;
    }`,
  ]);

  return parseEvaluateOutput(evalOut);
};

const downloadAsset = async (assetUrl, tmpBaseName) => {
  runOpenclaw(["browser", "navigate", assetUrl]);
  runOpenclaw(["browser", "wait", "--load", "networkidle"]);
  let ref = null;
  for (let i = 0; i < 3; i += 1) {
    const snapshot = runOpenclaw(["browser", "snapshot", "--efficient", "--limit", "240"]);
    ref = extractDownloadRef(snapshot);
    if (ref) break;
    runOpenclaw(["browser", "wait", "--time", "1200"]);
  }
  if (!ref) throw new Error(`Download button ref not found for ${assetUrl}`);

  let out = "";
  let lastError = null;
  for (let i = 0; i < 3; i += 1) {
    try {
      out = runOpenclaw(["browser", "download", ref, tmpBaseName, "--timeout-ms", "180000"]);
      lastError = null;
      break;
    } catch (error) {
      lastError = error;
      runOpenclaw(["browser", "wait", "--time", "1500"]);
    }
  }
  if (lastError) throw lastError;

  const match = out.match(/downloaded:\s*(.+)$/im);
  if (!match) throw new Error(`Downloaded path not found in output for ${assetUrl}`);
  return match[1].trim();
};

const main = async () => {
  const promptsByServer = loadPrompts();
  const allServers = ["moscow", "saint-petersburg", "voronezh", "sochi"];
  const servers = serverFilter.length > 0 ? allServers.filter((s) => serverFilter.includes(s)) : allServers;

  let processed = 0;
  let success = 0;
  let failed = 0;
  const report = [];

  for (const server of servers) {
    const outDir = path.join(assetsRoot, server);
    ensureDir(outDir);
    const prompts = (promptsByServer[server] || []).slice(0, perServer);
    for (let i = 0; i < prompts.length; i += 1) {
      if (processed >= maxTotal) break;
      const idx = String(i + 1).padStart(2, "0");
      const prompt = prompts[i];
      const baseSlug = `${idx}-${slugify(prompt)}`;

      if (skipExisting) {
        const maybe = ["jpg", "png", "webp"].some((ext) => existsSync(path.join(outDir, `${baseSlug}.${ext}`)));
        if (maybe) {
          report.push({ server, idx, status: "skipped_existing" });
          processed += 1;
          continue;
        }
      }

      try {
        const assetUrl = await pickAssetUrl(prompt);
        if (!assetUrl) throw new Error("No asset URL found");
        const tmpBaseName = `${server}_${idx}_${Date.now()}`;
        const downloadedPath = await downloadAsset(assetUrl, tmpBaseName);
        const ext = detectExtension(downloadedPath);
        const targetPath = path.join(outDir, `${baseSlug}.${ext}`);
        const bytes = readFileSync(downloadedPath);
        writeFileSync(targetPath, bytes);
        success += 1;
        report.push({ server, idx, status: "ok", assetUrl, file: targetPath });
      } catch (error) {
        failed += 1;
        report.push({ server, idx, status: "failed", error: String(error) });
      }

      processed += 1;
      await sleep(delayMs);
    }
  }

  console.log(`[freepik-openclaw] processed=${processed} success=${success} failed=${failed}`);
  console.table(report.slice(0, 60));
};

main().catch((error) => {
  console.error("[freepik-openclaw] fatal", error);
  process.exit(1);
});
