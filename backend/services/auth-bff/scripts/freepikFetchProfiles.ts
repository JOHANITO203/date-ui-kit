import { config as loadEnv } from "dotenv";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type LaunchServerCode = "moscow" | "saint-petersburg" | "voronezh" | "sochi";
type PromptsByServer = Record<LaunchServerCode, string[]>;

type FreepikResource = {
  id: number;
  title?: string;
  has_people?: boolean;
  image?: { type?: string };
  is_ai_generated?: boolean;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../../../../");
const serviceDir = path.resolve(__dirname, "..");

loadEnv({ path: path.join(rootDir, ".env") });
loadEnv({ path: path.join(serviceDir, ".env") });
loadEnv();

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const overwrite = args.includes("--overwrite");

const apiKey = process.env.FREEPIK_API_KEY?.trim() ?? "";
if (!dryRun && !apiKey) {
  throw new Error("Missing required env: FREEPIK_API_KEY");
}
const canSearchApi = apiKey.length > 0;

const perServer = Number(process.env.FREEPIK_SEED_PER_SERVER ?? "13");
const searchLimit = Number(process.env.FREEPIK_SEARCH_LIMIT ?? "20");
const language = process.env.FREEPIK_ACCEPT_LANGUAGE?.trim() || "fr-FR";
const imageSize = process.env.FREEPIK_IMAGE_SIZE?.trim() || "large";
const apiBase = process.env.FREEPIK_API_BASE?.trim() || "https://api.freepik.com/v1";
const assetsRoot =
  process.env.SEED_ASSETS_DIR?.trim() || path.join(rootDir, "seed-assets", "launch-servers");
const promptsFile =
  process.env.FREEPIK_PROMPTS_FILE?.trim() || path.join(__dirname, "freepik-prompts.json");

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

const extFromContentType = (contentType: string | null) => {
  if (!contentType) return "jpg";
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  return "jpg";
};

const apiFetchJson = async (url: URL) => {
  const response = await fetch(url, {
    headers: {
      "x-freepik-api-key": apiKey,
      "Accept-Language": language,
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Freepik API ${response.status} ${response.statusText} for ${url}: ${body}`);
  }
  return response.json();
};

const loadPrompts = async (): Promise<PromptsByServer> => {
  const raw = await fs.readFile(promptsFile, "utf8");
  const parsed = JSON.parse(raw) as Partial<PromptsByServer>;
  const required: LaunchServerCode[] = ["moscow", "saint-petersburg", "voronezh", "sochi"];
  for (const key of required) {
    const prompts = parsed[key];
    if (!Array.isArray(prompts) || prompts.length < perServer) {
      throw new Error(`Prompt list missing or too short for '${key}' in ${promptsFile}`);
    }
  }
  return parsed as PromptsByServer;
};

const searchResource = async (term: string, usedIds: Set<number>): Promise<FreepikResource | null> => {
  const url = new URL(`${apiBase}/resources`);
  url.searchParams.set("term", term);
  url.searchParams.set("limit", String(searchLimit));

  const payload = await apiFetchJson(url);
  const rows: FreepikResource[] = Array.isArray(payload?.data) ? payload.data : [];
  if (rows.length === 0) return null;

  const candidates = rows.filter((row) => !usedIds.has(row.id));
  const preferred =
    candidates.find((row) => row.image?.type === "photo" && row.has_people !== false && row.is_ai_generated !== true) ??
    candidates.find((row) => row.image?.type === "photo") ??
    candidates[0] ??
    null;
  return preferred;
};

const downloadResourceBytes = async (resourceId: number): Promise<{ bytes: ArrayBuffer; ext: string }> => {
  const url = new URL(`${apiBase}/resources/${resourceId}/download`);
  url.searchParams.set("image_size", imageSize);
  const payload = await apiFetchJson(url);
  const signedUrl =
    payload?.data?.signed_url ||
    payload?.data?.url ||
    payload?.signed_url ||
    payload?.url;
  if (typeof signedUrl !== "string" || signedUrl.length === 0) {
    throw new Error(`Download URL missing for resource ${resourceId}`);
  }

  const imageResp = await fetch(signedUrl);
  if (!imageResp.ok) {
    throw new Error(`Signed URL download failed (${imageResp.status}) for resource ${resourceId}`);
  }
  const bytes = await imageResp.arrayBuffer();
  const ext = extFromContentType(imageResp.headers.get("content-type"));
  return { bytes, ext };
};

const ensureDir = async (dirPath: string) => {
  await fs.mkdir(dirPath, { recursive: true });
};

const main = async () => {
  const promptsByServer = await loadPrompts();
  const usedIds = new Set<number>();
  const launchServers: LaunchServerCode[] = ["moscow", "saint-petersburg", "voronezh", "sochi"];

  console.log(`[freepik] mode=${dryRun ? "dry-run" : "download"} overwrite=${overwrite ? "yes" : "no"}`);
  console.log(`[freepik] assetsRoot=${assetsRoot}`);
  console.log(`[freepik] perServer=${perServer}`);

  for (const server of launchServers) {
    const prompts = promptsByServer[server].slice(0, perServer);
    const outDir = path.join(assetsRoot, server);
    await ensureDir(outDir);

    if (overwrite && !dryRun) {
      const existing = await fs.readdir(outDir).catch(() => []);
      for (const file of existing) {
        await fs.rm(path.join(outDir, file), { force: true });
      }
    }

    for (let i = 0; i < prompts.length; i += 1) {
      const prompt = prompts[i];
      const index = String(i + 1).padStart(2, "0");

      if (dryRun && !canSearchApi) {
        console.log(`[freepik] dry-run (no API key) ${server} #${index}: ${prompt}`);
        continue;
      }

      const resource = await searchResource(prompt, usedIds);
      if (!resource) {
        console.warn(`[freepik] no result for ${server} #${index}: ${prompt}`);
        continue;
      }
      usedIds.add(resource.id);

      const baseName = `${index}-${slugify(resource.title || prompt || `resource-${resource.id}`)}`;
      if (dryRun) {
        console.log(`[freepik] dry-run ${server}/${baseName} <- resource ${resource.id}`);
        continue;
      }

      try {
        const { bytes, ext } = await downloadResourceBytes(resource.id);
        const targetPath = path.join(outDir, `${baseName}.${ext}`);
        await fs.writeFile(targetPath, Buffer.from(bytes));
        console.log(`[freepik] saved ${targetPath}`);
      } catch (error) {
        console.warn(`[freepik] download failed for resource ${resource.id}: ${String(error)}`);
      }

      await delay(450);
    }
  }

  console.log("[freepik] done");
};

main().catch((error) => {
  console.error("[freepik] failed", error);
  process.exit(1);
});
