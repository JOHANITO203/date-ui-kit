import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import { createVerifier } from "fast-jwt";
import { z } from "zod";
import { env } from "./config";
import { applyFiltersAndRank, buildRankingMetrics, parseFeedPreferences, parseUserGeoPoint } from "./ranking";
import { loadCandidatesFromSupabase } from "./candidates";

const filterSchema = z
  .array(z.enum(["all", "nearby", "new", "online", "verified"]))
  .default(["all"]);

const swipeSchema = z.object({
  profileId: z.string().min(1),
  decision: z.enum(["like", "dislike", "superlike"]),
  feedCursor: z.string().min(1),
});

const rewindSchema = z.object({
  feedCursor: z.string().min(1),
});

type InternalJwtPayload = {
  sub: string;
  email?: string;
  role?: string;
};

const verifyInternalToken = createVerifier({
  key: env.INTERNAL_JWT_SECRET,
  algorithms: ["HS256"],
});

const dismissedByUser = new Map<string, string[]>();
const swipeHistoryByUser = new Map<string, string[]>();

const extractBearerToken = (request: FastifyRequest) => {
  const header = request.headers.authorization;
  if (!header) return null;
  const trimmed = header.trim();
  if (!trimmed.toLowerCase().startsWith("bearer ")) return null;
  const token = trimmed.slice(7).trim();
  return token.length > 0 ? token : null;
};

const resolveAuthenticatedUserId = (request: FastifyRequest, reply: FastifyReply) => {
  const token = extractBearerToken(request);
  if (!token) {
    reply.status(401);
    return null;
  }

  try {
    const payload = verifyInternalToken(token) as InternalJwtPayload;
    if (!payload?.sub || typeof payload.sub !== "string" || payload.sub.trim().length === 0) {
      reply.status(401);
      return null;
    }
    return payload.sub.trim();
  } catch {
    reply.status(401);
    return null;
  }
};

const stableScore = (seed: string) =>
  [...seed].reduce((acc, char, index) => (acc + char.charCodeAt(0) * (index + 1)) % 1000, 0) % 100;

export const buildServer = () => {
  const app = Fastify({ logger: true });

  app.register(cors, {
    origin: [env.APP_URL, "http://127.0.0.1:3000", "http://localhost:3000"],
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });

  app.get("/health", async () => ({
    status: "ok",
    service: "discover-service",
    timestamp: new Date().toISOString(),
  }));

  app.get("/discover/feed", async (request, reply) => {
    const userId = resolveAuthenticatedUserId(request, reply);
    if (!userId) {
      return { code: "UNAUTHORIZED", message: "Missing or invalid internal token." };
    }
    const query = request.query as Record<string, string | undefined>;
    const raw = query.quickFilters ? query.quickFilters.split(",").filter(Boolean) : ["all"];
    const filters = filterSchema.parse(raw);
    const preferences = parseFeedPreferences(query);
    const userGeoPoint = parseUserGeoPoint(query);
    const dismissedProfileIds = new Set(dismissedByUser.get(userId) ?? []);
    const candidatesSource = await loadCandidatesFromSupabase({
      currentUserId: userId,
      userGeoPoint,
      logger: app.log,
    });
    const candidates = applyFiltersAndRank(
      filters,
      preferences,
      userGeoPoint,
      dismissedProfileIds,
      candidatesSource,
    );

    return {
      window: {
        cursor: `cursor_${userId}_${Date.now()}`,
        candidates,
        quickFiltersApplied: filters,
        preferencesApplied: preferences,
      },
    };
  });

  app.get("/discover/metrics/ranking", async (request, reply) => {
    const userId = resolveAuthenticatedUserId(request, reply);
    if (!userId) {
      return { code: "UNAUTHORIZED", message: "Missing or invalid internal token." };
    }
    const query = request.query as Record<string, string | undefined>;
    const raw = query.quickFilters ? query.quickFilters.split(",").filter(Boolean) : ["all"];
    const filters = filterSchema.parse(raw);
    const preferences = parseFeedPreferences(query);
    const userGeoPoint = parseUserGeoPoint(query);
    const dismissedProfileIds = new Set(dismissedByUser.get(userId) ?? []);
    const candidatesSource = await loadCandidatesFromSupabase({
      currentUserId: userId,
      userGeoPoint,
      logger: app.log,
    });
    const ranked = applyFiltersAndRank(
      filters,
      preferences,
      userGeoPoint,
      dismissedProfileIds,
      candidatesSource,
    );
    const topN = Number(query.topN ?? "20");
    const metrics = buildRankingMetrics(ranked, preferences, Number.isFinite(topN) ? topN : 20);

    return {
      metrics,
      quickFiltersApplied: filters,
      preferencesApplied: preferences,
      sampleSize: ranked.length,
    };
  });

  app.post("/discover/swipe", async (request, reply) => {
    const userId = resolveAuthenticatedUserId(request, reply);
    if (!userId) {
      return { code: "UNAUTHORIZED", message: "Missing or invalid internal token." };
    }
    const parsed = swipeSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.status(400);
      return { code: "INVALID_PAYLOAD", message: "Invalid swipe payload." };
    }

    const { profileId, decision } = parsed.data;
    const dismissed = dismissedByUser.get(userId) ?? [];
    if (!dismissed.includes(profileId)) {
      dismissed.push(profileId);
      dismissedByUser.set(userId, dismissed.slice(-400));
    }

    const history = swipeHistoryByUser.get(userId) ?? [];
    history.push(profileId);
    swipeHistoryByUser.set(userId, history.slice(-120));

    const seed = `${userId}:${profileId}`;
    const deterministic = stableScore(seed);
    const matched =
      decision === "superlike" ? deterministic >= 30 : decision === "like" ? deterministic >= 62 : false;
    return {
      matched,
      conversationId: matched ? `conv-${userId}-${profileId}` : undefined,
    };
  });

  app.post("/discover/rewind", async (request, reply) => {
    const userId = resolveAuthenticatedUserId(request, reply);
    if (!userId) {
      return { code: "UNAUTHORIZED", message: "Missing or invalid internal token." };
    }

    const parsed = rewindSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.status(400);
      return { code: "INVALID_PAYLOAD", message: "Invalid rewind payload." };
    }

    const history = swipeHistoryByUser.get(userId) ?? [];
    const restoredProfileId = history.pop();
    swipeHistoryByUser.set(userId, history);

    if (!restoredProfileId) {
      return { restoredProfileId: undefined, rewindsLeft: 0 };
    }

    const dismissed = dismissedByUser.get(userId) ?? [];
    dismissedByUser.set(
      userId,
      dismissed.filter((profileId) => profileId !== restoredProfileId),
    );

    return { restoredProfileId, rewindsLeft: 0 };
  });

  return app;
};
