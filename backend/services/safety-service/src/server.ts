import Fastify from "fastify";
import cors from "@fastify/cors";
import { createVerifier } from "fast-jwt";
import { z } from "zod";
import { env } from "./config.js";
import { prismaClient } from "./lib/prismaClient.js";
import type { BlockEntry, ReportEntry } from "./types.js";
import { consumeRateLimit } from "./rateLimit.js";

const blockSchema = z.object({
  userId: z.string().min(1),
});

const reportSchema = z.object({
  userId: z.string().min(1),
  reason: z.enum(["spam", "scam", "abuse", "fake_profile", "other"]),
  note: z.string().max(500).optional(),
});

type InternalJwtPayload = {
  sub: string;
  email?: string;
  role?: string;
};

const blocks = new Map<string, BlockEntry>();
const reports: ReportEntry[] = [];

const verifyInternalToken = createVerifier({
  key: env.INTERNAL_JWT_SECRET,
  algorithms: ["HS256"],
});

const extractBearerToken = (authorization: unknown) => {
  if (typeof authorization !== "string") return null;
  const trimmed = authorization.trim();
  if (!trimmed.toLowerCase().startsWith("bearer ")) return null;
  const token = trimmed.slice(7).trim();
  return token.length > 0 ? token : null;
};

const resolveActorUserId = (authorization: unknown): string | null => {
  const token = extractBearerToken(authorization);
  if (!token) return null;

  try {
    const payload = verifyInternalToken(token) as InternalJwtPayload;
    if (!payload?.sub || typeof payload.sub !== "string" || payload.sub.trim().length === 0) {
      return null;
    }
    return payload.sub.trim();
  } catch {
    return null;
  }
};

// SECURITY: with Fastify trustProxy enabled, `fallback` (request.ip) is the real
// client IP resolved from the trusted proxy hop. Do NOT trust the raw
// x-forwarded-for header directly — a client can spoof it to bypass rate limits.
const getRequestIp = (_headers: Record<string, unknown>, fallback: string) => fallback;

export const buildServer = () => {
  const app = Fastify({ logger: true, trustProxy: true });

  // SECURITY: only allow localhost dev origins outside production.
  const allowedOrigins = [env.APP_URL];
  if (process.env.NODE_ENV !== "production") {
    allowedOrigins.push("http://127.0.0.1:3000", "http://localhost:3000");
  }

  app.register(cors, {
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });

  app.get("/health", async () => ({
    status: "ok",
    service: "safety-service",
    persistence: "prisma",
    timestamp: new Date().toISOString(),
  }));

  app.get("/safety/blocks", async (request, reply) => {
    const actorUserId = resolveActorUserId(request.headers.authorization);
    if (!actorUserId) {
      reply.status(401);
      return { code: "UNAUTHORIZED" };
    }

    try {
      const rows = await prismaClient.safetyBlock.findMany({
        where: { userId: actorUserId },
        orderBy: { createdAt: "desc" },
      });

      return {
        blocks: rows.map((row) => ({
          blockedUserId: row.blockedUserId,
          createdAtIso: row.createdAt.toISOString(),
        })),
      };
    } catch {
      return {
        blocks: [...blocks.values()].sort(
          (a, b) => new Date(b.createdAtIso).getTime() - new Date(a.createdAtIso).getTime(),
        ),
      };
    }
  });

  app.post("/safety/blocks", async (request, reply) => {
    const actorUserId = resolveActorUserId(request.headers.authorization);
    if (!actorUserId) {
      reply.status(401);
      return { code: "UNAUTHORIZED" };
    }

    const requestIp = getRequestIp(request.headers as Record<string, unknown>, request.ip);
    const rateLimit = consumeRateLimit(`${requestIp}:block`, {
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      max: env.RATE_LIMIT_MAX_BLOCK,
    });
    if (!rateLimit.allowed) {
      reply.status(429);
      return { code: "RATE_LIMITED", message: "Too many block actions. Retry later." };
    }

    const parsed = blockSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.status(400);
      return { code: "INVALID_PAYLOAD", message: "Invalid block payload." };
    }

    if (parsed.data.userId === actorUserId) {
      reply.status(400);
      return { code: "INVALID_BLOCK_TARGET", message: "User cannot block self." };
    }

    const entry: BlockEntry = {
      blockedUserId: parsed.data.userId,
      createdAtIso: new Date().toISOString(),
    };

    try {
      await prismaClient.safetyBlock.upsert({
        where: {
          userId_blockedUserId: {
            userId: actorUserId,
            blockedUserId: entry.blockedUserId,
          },
        },
        update: {},
        create: {
          userId: actorUserId,
          blockedUserId: entry.blockedUserId,
        },
      });
    } catch {
      blocks.set(entry.blockedUserId, entry);
    }

    return {
      status: "blocked",
      block: entry,
    };
  });

  app.delete("/safety/blocks/:userId", async (request, reply) => {
    const params = request.params as { userId?: string };
    const userId = params.userId ?? "";
    const actorUserId = resolveActorUserId(request.headers.authorization);
    if (!actorUserId) {
      reply.status(401);
      return { code: "UNAUTHORIZED" };
    }

    try {
      await prismaClient.safetyBlock.deleteMany({
        where: { userId: actorUserId, blockedUserId: userId },
      });

      return { status: "unblocked", userId };
    } catch {
      const existed = blocks.delete(userId);
      return {
        status: existed ? "unblocked" : "noop",
        userId,
      };
    }
  });

  app.post("/safety/reports", async (request, reply) => {
    const actorUserId = resolveActorUserId(request.headers.authorization);
    if (!actorUserId) {
      reply.status(401);
      return { code: "UNAUTHORIZED" };
    }

    const requestIp = getRequestIp(request.headers as Record<string, unknown>, request.ip);
    const rateLimit = consumeRateLimit(`${requestIp}:report`, {
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      max: env.RATE_LIMIT_MAX_REPORT,
    });
    if (!rateLimit.allowed) {
      reply.status(429);
      return { code: "RATE_LIMITED", message: "Too many report actions. Retry later." };
    }

    const parsed = reportSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.status(400);
      return { code: "INVALID_PAYLOAD", message: "Invalid report payload." };
    }

    if (parsed.data.userId === actorUserId) {
      reply.status(400);
      return { code: "INVALID_REPORT_TARGET", message: "User cannot report self." };
    }
    const report: ReportEntry = {
      id: `rep-${Date.now()}`,
      reportedUserId: parsed.data.userId,
      reason: parsed.data.reason,
      note: parsed.data.note,
      createdAtIso: new Date().toISOString(),
    };

    try {
      await prismaClient.safetyReport.upsert({
        where: {
          userId_reportId: {
            userId: actorUserId,
            reportId: report.id,
          },
        },
        update: {
          reason: report.reason,
          note: report.note,
        },
        create: {
          userId: actorUserId,
          reportId: report.id,
          reportedUserId: report.reportedUserId,
          reason: report.reason,
          note: report.note,
        },
      });
    } catch {
      reports.push(report);
    }

    return {
      status: "reported",
      report,
    };
  });

  return app;
};
