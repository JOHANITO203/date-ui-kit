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

const applyFilters = (filters: string[]) => {
  if (filters.includes("all")) return feedSeed;
  return feedSeed.filter((candidate, index) => {
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
    const candidates = applyFilters(filters);
    return {
      window: {
        cursor: `cursor_${Date.now()}`,
        candidates,
        quickFiltersApplied: filters,
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
