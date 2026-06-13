import type { FastifyInstance } from "fastify";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { requireSessionMiddleware } from "../middleware/requireSession";
import { sendAuthError, sendAuthSuccess } from "./auth/utils";
import type { AuthResponse } from "./auth/types";
import { env } from "../config/env";
import { generateText, generateJson, isAiEnabled } from "../lib/aiClient";

const bioSchema = z.object({
  draft: z.string().min(1).max(1000),
  tone: z.enum(["warm", "playful", "confident", "sincere", "witty"]).optional(),
});

const replySchema = z.object({
  messages: z
    .array(z.object({ from: z.enum(["me", "them"]), text: z.string().max(1000) }))
    .min(1)
    .max(20),
  tone: z.enum(["warm", "playful", "confident", "sincere", "witty"]).optional(),
});

const translateSchema = z.object({
  text: z.string().min(1).max(2000),
  targetLang: z.enum(["en", "ru", "fr"]),
});

const riskSchema = z.object({
  bio: z.string().max(1000).optional(),
  name: z.string().max(120).optional(),
  city: z.string().max(120).optional(),
  signals: z.array(z.string().max(200)).max(20).optional(),
});

const constantTimeEqual = (a: string, b: string): boolean => {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
};

export async function registerAiRoutes(app: FastifyInstance) {
  app.get("/api/ai/status", async () => ({ enabled: isAiEnabled() }));

  app.register(async (protectedRoutes) => {
    protectedRoutes.addHook("preHandler", requireSessionMiddleware);

    // Improve a dating bio while keeping the user's voice.
    protectedRoutes.post("/api/ai/bio/optimize", async (request, reply) => {
      if (!request.userSession) return;
      if (!isAiEnabled()) return sendAuthError(reply, 503, "AI_DISABLED", "AI features are not enabled.");
      const parsed = bioSchema.safeParse(request.body);
      if (!parsed.success) return sendAuthError(reply, 400, "AI_INVALID", "Invalid payload.");

      const tone = parsed.data.tone ?? "warm";
      const suggestion = await generateText({
        system:
          "You are a dating-profile editor. Rewrite the user's bio so it is authentic, specific, and engaging, keeping their voice and facts. " +
          "No clichés, no emojis unless present, 1-3 short sentences, first person. Return ONLY the improved bio text.",
        prompt: `Tone: ${tone}\n\nDraft bio:\n${parsed.data.draft}`,
        maxTokens: 400,
      });
      if (!suggestion) return sendAuthError(reply, 502, "AI_FAILED", "Could not generate a suggestion.");
      return sendAuthSuccess(reply, { ok: true, data: { suggestion } } satisfies AuthResponse<{ suggestion: string }>);
    });

    // Suggest a few opening/reply lines from recent conversation context.
    protectedRoutes.post("/api/ai/reply/suggest", async (request, reply) => {
      if (!request.userSession) return;
      if (!isAiEnabled()) return sendAuthError(reply, 503, "AI_DISABLED", "AI features are not enabled.");
      const parsed = replySchema.safeParse(request.body);
      if (!parsed.success) return sendAuthError(reply, 400, "AI_INVALID", "Invalid payload.");

      const tone = parsed.data.tone ?? "warm";
      const transcript = parsed.data.messages
        .map((m) => `${m.from === "me" ? "Me" : "Them"}: ${m.text}`)
        .join("\n");

      const result = await generateJson<{ suggestions: string[] }>({
        system:
          "You are a witty, respectful dating conversation coach. Given a short chat transcript, propose 3 natural, varied replies the user ('Me') could send next. " +
          "Keep each under 220 characters, no emojis unless the conversation uses them, never creepy or pushy.",
        prompt: `Tone: ${tone}\n\nTranscript:\n${transcript}`,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: { suggestions: { type: "array", items: { type: "string" } } },
          required: ["suggestions"],
        },
        maxTokens: 500,
      });
      if (!result?.suggestions?.length) return sendAuthError(reply, 502, "AI_FAILED", "Could not generate suggestions.");
      return sendAuthSuccess(reply, {
        ok: true,
        data: { suggestions: result.suggestions.slice(0, 3) },
      } satisfies AuthResponse<{ suggestions: string[] }>);
    });

    // Conversational search: natural language → structured discovery filters.
    protectedRoutes.post("/api/ai/search", async (request, reply) => {
      if (!request.userSession) return;
      if (!isAiEnabled()) return sendAuthError(reply, 503, "AI_DISABLED", "AI features are not enabled.");
      const parsed = z.object({ query: z.string().min(1).max(400) }).safeParse(request.body);
      if (!parsed.success) return sendAuthError(reply, 400, "AI_INVALID", "Invalid payload.");

      const filters = await generateJson<{
        interests: string[];
        keywords: string[];
        intent?: string;
        genderPreference?: string;
        ageMin?: number;
        ageMax?: number;
        distanceKm?: number;
      }>({
        system:
          "Parse a natural-language dating search into structured discovery filters. " +
          "Only populate fields the query clearly implies; leave the rest empty. " +
          "interests and keywords are short lowercase tags. Ages 18-100.",
        prompt: parsed.data.query,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            interests: { type: "array", items: { type: "string" } },
            keywords: { type: "array", items: { type: "string" } },
            intent: { type: "string", enum: ["serieuse", "connexion", "decouverte", "verrai"] },
            genderPreference: { type: "string", enum: ["men", "women", "everyone"] },
            ageMin: { type: "integer" },
            ageMax: { type: "integer" },
            distanceKm: { type: "integer" },
          },
          required: ["interests", "keywords"],
        },
        maxTokens: 400,
      });
      if (!filters) return sendAuthError(reply, 502, "AI_FAILED", "Could not parse the search.");
      return sendAuthSuccess(reply, {
        ok: true,
        data: { filters },
      } satisfies AuthResponse<{ filters: typeof filters }>);
    });

    // Real-time translation of a message.
    protectedRoutes.post("/api/ai/translate", async (request, reply) => {
      if (!request.userSession) return;
      if (!isAiEnabled()) return sendAuthError(reply, 503, "AI_DISABLED", "AI features are not enabled.");
      const parsed = translateSchema.safeParse(request.body);
      if (!parsed.success) return sendAuthError(reply, 400, "AI_INVALID", "Invalid payload.");

      const langName = { en: "English", ru: "Russian", fr: "French" }[parsed.data.targetLang];
      const translated = await generateText({
        system: `Translate the user's message into ${langName}. Preserve tone and meaning. Return ONLY the translation, no notes.`,
        prompt: parsed.data.text,
        maxTokens: 800,
      });
      if (translated == null) return sendAuthError(reply, 502, "AI_FAILED", "Could not translate.");
      return sendAuthSuccess(reply, {
        ok: true,
        data: { translated },
      } satisfies AuthResponse<{ translated: string }>);
    });
  });

  // Internal moderation: fake-profile risk scoring. Internal-network only,
  // shared-secret gated (same pattern as push). Not exposed via nginx.
  app.post("/internal/ai/profile-risk", async (request, reply) => {
    const provided = request.headers["x-internal-secret"];
    if (typeof provided !== "string" || !constantTimeEqual(provided, env.INTERNAL_JWT_SECRET)) {
      reply.status(401);
      return { ok: false, code: "UNAUTHORIZED" };
    }
    if (!isAiEnabled()) {
      reply.status(503);
      return { ok: false, code: "AI_DISABLED" };
    }
    const parsed = riskSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.status(400);
      return { ok: false, code: "AI_INVALID" };
    }

    const result = await generateJson<{ score: number; verdict: string; reasons: string[] }>({
      system:
        "You are a trust-and-safety classifier for a dating app. Assess how likely a profile is fake/scam/bot based on the provided signals. " +
        "Return a risk score 0-100 (higher = riskier), a verdict, and short reasons. Be calibrated; absence of info is not strong evidence.",
      prompt: JSON.stringify(parsed.data),
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          score: { type: "integer" },
          verdict: { type: "string", enum: ["low", "medium", "high"] },
          reasons: { type: "array", items: { type: "string" } },
        },
        required: ["score", "verdict", "reasons"],
      },
      maxTokens: 500,
    });
    if (!result) {
      reply.status(502);
      return { ok: false, code: "AI_FAILED" };
    }
    return { ok: true, ...result };
  });
}
