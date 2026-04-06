import Fastify from "fastify";
import cors from "@fastify/cors";
import { z } from "zod";
import { env } from "./config";
import { feedSeed } from "./data";

const filterSchema = z
  .array(z.enum(["all", "nearby", "new", "online", "verified"]))
  .default(["all"]);

const swipeSchema = z.object({
  profileId: z.string().min(1),
  decision: z.enum(["like", "dislike", "superlike"]),
});

type FeedPreferences = {
  ageMin: number;
  ageMax: number;
  distanceKm: number;
  genderPreference: "men" | "women" | "everyone";
};

const DEFAULT_PREFERENCES: FeedPreferences = {
  ageMin: 18,
  ageMax: 65,
  distanceKm: 50,
  genderPreference: "everyone",
};

const parsePositiveInt = (raw: string | undefined, fallback: number, min: number, max: number) => {
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  const normalized = Math.trunc(parsed);
  if (normalized < min || normalized > max) return fallback;
  return normalized;
};

const parseFeedPreferences = (query: Record<string, string | undefined>): FeedPreferences => {
  const ageMin = parsePositiveInt(query.ageMin, DEFAULT_PREFERENCES.ageMin, 18, 100);
  const ageMax = parsePositiveInt(query.ageMax, DEFAULT_PREFERENCES.ageMax, 18, 100);
  const distanceKm = parsePositiveInt(query.distanceKm, DEFAULT_PREFERENCES.distanceKm, 1, 500);
  const genderPreference =
    query.genderPreference === "men" || query.genderPreference === "women"
      ? query.genderPreference
      : "everyone";

  return {
    ageMin: Math.min(ageMin, ageMax - 1),
    ageMax: Math.max(ageMax, ageMin + 1),
    distanceKm,
    genderPreference,
  };
};

const applyFilters = (filters: string[], preferences: FeedPreferences) => {
  return feedSeed.filter((candidate, index) => {
    if (candidate.age < preferences.ageMin || candidate.age > preferences.ageMax) return false;
    if (candidate.distanceKm > preferences.distanceKm) return false;
    if (preferences.genderPreference !== "everyone" && candidate.gender !== preferences.genderPreference) return false;
    if (filters.includes("nearby") && candidate.distanceKm > 5) return false;
    if (filters.includes("new") && index > 2) return false;
    if (filters.includes("online") && !candidate.online) return false;
    if (filters.includes("verified") && !candidate.flags.verifiedIdentity) return false;
    return true;
  });
};

export const buildServer = () => {
  const app = Fastify({ logger: true });

  app.register(cors, {
    origin: [env.APP_URL, "http://127.0.0.1:3000", "http://localhost:3000"],
    credentials: true,
  });

  app.get("/health", async () => ({
    status: "ok",
    service: "discover-service",
    timestamp: new Date().toISOString(),
  }));

  app.get("/discover/feed", async (request) => {
    const query = request.query as Record<string, string | undefined>;
    const raw = query.quickFilters ? query.quickFilters.split(",").filter(Boolean) : ["all"];
    const filters = filterSchema.parse(raw);
    const preferences = parseFeedPreferences(query);
    const candidates = applyFilters(filters, preferences);
    return {
      window: {
        cursor: `cursor_${Date.now()}`,
        candidates,
        quickFiltersApplied: filters,
        preferencesApplied: preferences,
      },
    };
  });

  app.post("/discover/swipe", async (request, reply) => {
    const parsed = swipeSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.status(400);
      return { code: "INVALID_PAYLOAD", message: "Invalid swipe payload." };
    }
    const { profileId, decision } = parsed.data;
    const matched = decision !== "dislike" && Math.random() > 0.55;
    return {
      matched,
      conversationId: matched ? `conv-${profileId}` : undefined,
    };
  });

  return app;
};
