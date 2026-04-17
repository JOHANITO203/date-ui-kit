import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const outputPath = path.join(rootDir, "test-results", "discover-photo-pipeline-audit.json");
const tokenPath = path.join(rootDir, "tmp_discover_jwt_runtime.txt");

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const feedUrl = process.env.DISCOVER_FEED_URL ?? "http://127.0.0.1:8788/discover/feed";
const token = fs.existsSync(tokenPath) ? fs.readFileSync(tokenPath, "utf8").trim() : "";

if (!token) {
  throw new Error(`Missing token at ${tokenPath}`);
}

const query = new URLSearchParams({
  quickFilters: "all",
  ageMin: "18",
  ageMax: "65",
  distanceKm: "50",
  genderPreference: "everyone",
  intent: "decouverte",
  interests: "musique,mode,lifestyle,business,tech",
  launchCity: "voronezh",
  originCountry: "ivorian",
  userLanguages: "francais,anglais,russe",
});

const classifyCandidate = (candidate, headStatus) => {
  const storagePath = candidate.photoStoragePath ?? null;
  const top = storagePath ? storagePath.split("/")[0] ?? "" : "";
  const pathLegacy = storagePath ? storagePath.startsWith("seed/") || !uuidRe.test(top) : false;
  const invalid = typeof headStatus === "number" && headStatus >= 400;

  let bucket = "other";
  if (candidate.photoStatus === "public" && !invalid) bucket = "public_ok";
  else if (candidate.photoStatus === "signed_fallback") bucket = "signed_fallback";
  else if (
    candidate.photoStatus === "placeholder" &&
    String(candidate.photoReason ?? "").includes("missing_profile_photo")
  ) {
    bucket = "placeholder_missing_photo";
  } else if (candidate.photoStatus === "placeholder") {
    bucket = "placeholder_incoherent";
  }

  const variantMissing =
    String(candidate.photoReason ?? "").includes("variant_missing") ||
    String(candidate.photoReason ?? "").includes("variant_unavailable");

  return {
    id: candidate.id,
    name: candidate.name,
    photoStatus: candidate.photoStatus ?? null,
    photoReason: candidate.photoReason ?? null,
    photoUrl: candidate.photoUrl ?? candidate.photos?.[0] ?? null,
    photoStoragePath: storagePath,
    headStatus,
    bucket,
    variantMissing,
    pathLegacy,
    pathInvalid: invalid,
  };
};

const headStatus = async (url) => {
  if (!url || url === "/placeholder.svg") return null;
  try {
    const res = await fetch(url, { method: "HEAD" });
    return res.status;
  } catch {
    return -1;
  }
};

const run = async () => {
  const res = await fetch(`${feedUrl}?${query.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Feed request failed (${res.status}): ${body}`);
  }
  const payload = await res.json();
  const candidates = payload.window?.candidates ?? [];

  const audited = [];
  for (const candidate of candidates) {
    const url = candidate.photoUrl ?? candidate.photos?.[0] ?? null;
    const status = await headStatus(url);
    audited.push(classifyCandidate(candidate, status));
  }

  const counts = {
    totalCandidates: audited.length,
    public: audited.filter((entry) => entry.photoStatus === "public").length,
    signed_fallback: audited.filter((entry) => entry.photoStatus === "signed_fallback").length,
    placeholder: audited.filter((entry) => entry.photoStatus === "placeholder").length,
    invalidUrlReturnedCount: audited.filter((entry) => entry.pathInvalid).length,
    variantMissingOrUnavailableCount: audited.filter((entry) => entry.variantMissing).length,
    public_ok: audited.filter((entry) => entry.bucket === "public_ok").length,
    signed_fallback_bucket: audited.filter((entry) => entry.bucket === "signed_fallback").length,
    placeholder_missing_photo: audited.filter((entry) => entry.bucket === "placeholder_missing_photo").length,
    placeholder_incoherent: audited.filter((entry) => entry.bucket === "placeholder_incoherent").length,
    path_legacy: audited.filter((entry) => entry.pathLegacy).length,
    path_invalid: audited.filter((entry) => entry.pathInvalid).length,
  };

  const report = {
    generatedAt: new Date().toISOString(),
    feedUrl,
    counts,
    candidates: audited,
  };
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(counts, null, 2));
  console.log(`report=${outputPath}`);
};

run().catch((error) => {
  console.error("[discover-photo-pipeline-audit] failed", error);
  process.exit(1);
});
