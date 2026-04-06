import Fastify from "fastify";
import cors from "@fastify/cors";
import { z } from "zod";
import { env } from "./config.js";
import { supabaseServiceClient } from "./lib/supabaseClient.js";
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

const resolveActorUserId = (query: Record<string, unknown>) => {
  const candidate = query.userId;
  return typeof candidate === "string" && candidate.trim() ? candidate.trim() : "me";
};

const blocks = new Map<string, BlockEntry>();
const reports: ReportEntry[] = [];

const getRequestIp = (headers: Record<string, unknown>, fallback: string) => {
  const forwardedFor = headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0].trim();
  }
  return fallback;
};

export const buildServer = () => {
  const app = Fastify({ logger: true });

  app.register(cors, {
    origin: [env.APP_URL, "http://127.0.0.1:3000", "http://localhost:3000"],
    credentials: true,
  });

  app.get("/health", async () => ({
    status: "ok",
    service: "safety-service",
    persistence: supabaseServiceClient ? "supabase" : "memory",
    timestamp: new Date().toISOString(),
  }));

  app.get("/safety/blocks", async (request, reply) => {
    if (supabaseServiceClient) {
      const actorUserId = resolveActorUserId((request.query as Record<string, unknown>) ?? {});
      const blocksResult = await supabaseServiceClient
        .from("safety_blocks")
        .select("*")
        .eq("user_id", actorUserId)
        .order("created_at", { ascending: false });

      if (blocksResult.error) {
        reply.status(500);
        return { code: "SAFETY_BLOCKS_READ_FAILED" };
      }

      return {
        blocks: (blocksResult.data ?? []).map((row: { blocked_user_id: string; created_at: string }) => ({
          blockedUserId: row.blocked_user_id,
          createdAtIso: row.created_at,
        })),
      };
    }

    return {
      blocks: [...blocks.values()].sort(
        (a, b) => new Date(b.createdAtIso).getTime() - new Date(a.createdAtIso).getTime(),
      ),
    };
  });

  app.post("/safety/blocks", async (request, reply) => {
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

    const actorUserId = resolveActorUserId((request.query as Record<string, unknown>) ?? {});
    if (parsed.data.userId === actorUserId) {
      reply.status(400);
      return { code: "INVALID_BLOCK_TARGET", message: "User cannot block self." };
    }

    const entry: BlockEntry = {
      blockedUserId: parsed.data.userId,
      createdAtIso: new Date().toISOString(),
    };

    if (supabaseServiceClient) {
      const blockResult = await supabaseServiceClient.from("safety_blocks").upsert(
        {
          user_id: actorUserId,
          blocked_user_id: entry.blockedUserId,
          created_at: entry.createdAtIso,
        },
        { onConflict: "user_id,blocked_user_id" },
      );

      if (blockResult.error) {
        reply.status(500);
        return { code: "SAFETY_BLOCK_FAILED" };
      }
    } else {
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

    if (supabaseServiceClient) {
      const actorUserId = resolveActorUserId((request.query as Record<string, unknown>) ?? {});
      const deleteResult = await supabaseServiceClient
        .from("safety_blocks")
        .delete()
        .eq("user_id", actorUserId)
        .eq("blocked_user_id", userId);

      if (deleteResult.error) {
        reply.status(500);
        return { code: "SAFETY_UNBLOCK_FAILED" };
      }

      return {
        status: "unblocked",
        userId,
      };
    }

    const existed = blocks.delete(userId);
    return {
      status: existed ? "unblocked" : "noop",
      userId,
    };
  });

  app.post("/safety/reports", async (request, reply) => {
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

    const actorUserId = resolveActorUserId((request.query as Record<string, unknown>) ?? {});
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

    if (supabaseServiceClient) {
      const reportResult = await supabaseServiceClient.from("safety_reports").upsert(
        {
          user_id: actorUserId,
          report_id: report.id,
          reported_user_id: report.reportedUserId,
          reason: report.reason,
          note: report.note,
          created_at: report.createdAtIso,
        },
        { onConflict: "user_id,report_id" },
      );

      if (reportResult.error) {
        reply.status(500);
        return { code: "SAFETY_REPORT_FAILED" };
      }
    } else {
      reports.push(report);
    }

    return {
      status: "reported",
      report,
    };
  });

  return app;
};
