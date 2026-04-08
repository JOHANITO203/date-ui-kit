import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import { createVerifier } from "fast-jwt";
import { z } from "zod";
import { env } from "./config";
import { supabaseServiceClient } from "./lib/supabaseClient";

const patchSchema = z.object({
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  locale: z.string().optional(),
  bio: z.string().max(1000).optional(),
  city: z.string().optional(),
  settings: z
    .object({
      language: z.enum(["en", "ru"]).optional(),
      target_lang: z.enum(["en", "ru", "fr"]).optional(),
      auto_translate: z.boolean().optional(),
      auto_detect_language: z.boolean().optional(),
      precise_location_enabled: z.boolean().optional(),
      visibility: z.enum(["public", "limited", "hidden"]).optional(),
      hide_age: z.boolean().optional(),
      hide_distance: z.boolean().optional(),
      incognito: z.boolean().optional(),
      read_receipts: z.boolean().optional(),
      shadow_ghost: z.boolean().optional(),
      travel_pass_city: z.enum(["voronezh", "moscow", "saint-petersburg", "sochi"]).optional(),
      phone_country_code: z.string().optional(),
      phone_national_number: z.string().optional(),
      distance_km: z.number().int().optional(),
      age_min: z.number().int().optional(),
      age_max: z.number().int().optional(),
      gender_preference: z.enum(["everyone", "women", "men"]).optional(),
      notifications_enabled: z.boolean().optional(),
    })
    .optional(),
}).superRefine((value, ctx) => {
  const ageMin = value.settings?.age_min;
  const ageMax = value.settings?.age_max;
  if (typeof ageMin === "number" && typeof ageMax === "number" && ageMin > ageMax) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["settings", "age_min"],
      message: "age_min must be lower than or equal to age_max",
    });
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["settings", "age_max"],
      message: "age_max must be greater than or equal to age_min",
    });
  }
});

type MemoryProfile = {
  first_name?: string | null;
  last_name?: string | null;
  locale?: string | null;
  bio?: string | null;
  city?: string | null;
};

type MemorySettings = {
  language?: "en" | "ru" | null;
  target_lang?: "en" | "ru" | "fr" | null;
  auto_translate?: boolean | null;
  auto_detect_language?: boolean | null;
  precise_location_enabled?: boolean | null;
  visibility?: "public" | "limited" | "hidden" | null;
  hide_age?: boolean | null;
  hide_distance?: boolean | null;
  incognito?: boolean | null;
  read_receipts?: boolean | null;
  shadow_ghost?: boolean | null;
  travel_pass_city?: "voronezh" | "moscow" | "saint-petersburg" | "sochi" | null;
  phone_country_code?: string | null;
  phone_national_number?: string | null;
  distance_km?: number | null;
  age_min?: number | null;
  age_max?: number | null;
  gender_preference?: "everyone" | "women" | "men" | null;
  notifications_enabled?: boolean | null;
};

const memoryProfiles = new Map<string, MemoryProfile>();
const memorySettings = new Map<string, MemorySettings>();
type InternalJwtPayload = {
  sub: string;
  email?: string;
  role?: string;
};

const verifyInternalToken = createVerifier({
  key: env.INTERNAL_JWT_SECRET,
  algorithms: ["HS256"],
});

const extractBearerToken = (request: FastifyRequest) => {
  const header = request.headers.authorization;
  if (!header) return null;
  const trimmed = header.trim();
  if (!trimmed.toLowerCase().startsWith("bearer ")) return null;
  const token = trimmed.slice(7).trim();
  return token.length > 0 ? token : null;
};

const resolveAuthenticatedUserId = (
  request: FastifyRequest,
  reply: FastifyReply,
): string | null => {
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

export const buildServer = () => {
  const app = Fastify({ logger: true });

  app.register(cors, {
    origin: [env.APP_URL, "http://127.0.0.1:3000", "http://localhost:3000"],
    credentials: true,
    methods: ["GET", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });

  app.get("/health", async () => ({
    status: "ok",
    service: "profile-service",
    persistence: supabaseServiceClient ? "supabase" : "memory",
    timestamp: new Date().toISOString(),
  }));

  app.get("/profiles/me", async (request, reply) => {
    const userId = resolveAuthenticatedUserId(request, reply);
    if (!userId) {
      return { code: "UNAUTHORIZED" };
    }

    if (!supabaseServiceClient) {
      return {
        userId,
        profile: memoryProfiles.get(userId) ?? null,
        settings: memorySettings.get(userId) ?? null,
      };
    }

    const [profileResult, settingsResult] = await Promise.all([
      supabaseServiceClient.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
      supabaseServiceClient.from("settings").select("*").eq("user_id", userId).maybeSingle(),
    ]);

    if (profileResult.error || settingsResult.error) {
      reply.status(500);
      return { code: "PROFILE_READ_FAILED" };
    }

    return {
      userId,
      profile: profileResult.data,
      settings: settingsResult.data,
    };
  });

  app.patch("/profiles/me", async (request, reply) => {
    const userId = resolveAuthenticatedUserId(request, reply);
    if (!userId) {
      return { code: "UNAUTHORIZED" };
    }

    const parsed = patchSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.status(400);
      return { code: "INVALID_PAYLOAD", message: "Invalid profile patch payload." };
    }

    const payload = parsed.data;

    if (!supabaseServiceClient) {
      const currentProfile = memoryProfiles.get(userId) ?? {};
      const currentSettings = memorySettings.get(userId) ?? {};

      memoryProfiles.set(userId, {
        ...currentProfile,
        first_name: payload.first_name ?? currentProfile.first_name,
        last_name: payload.last_name ?? currentProfile.last_name,
        locale: payload.locale ?? currentProfile.locale,
        bio: payload.bio ?? currentProfile.bio,
        city: payload.city ?? currentProfile.city,
      });

      if (payload.settings) {
        memorySettings.set(userId, {
          ...currentSettings,
          ...payload.settings,
        });
      }

      return {
        userId,
        profile: memoryProfiles.get(userId) ?? null,
        settings: memorySettings.get(userId) ?? null,
      };
    }

    const profilePatch = {
      user_id: userId,
      first_name: payload.first_name,
      last_name: payload.last_name,
      locale: payload.locale,
      bio: payload.bio,
      city: payload.city,
    };

    const profileUpsert = await supabaseServiceClient.from("profiles").upsert(profilePatch, {
      onConflict: "user_id",
    });

    if (profileUpsert.error) {
      reply.status(500);
      return { code: "PROFILE_PATCH_FAILED" };
    }

    if (payload.settings) {
      const settingsUpsert = await supabaseServiceClient.from("settings").upsert(
        {
          user_id: userId,
          ...payload.settings,
        },
        { onConflict: "user_id" },
      );

      if (settingsUpsert.error) {
        reply.status(500);
        return { code: "SETTINGS_PATCH_FAILED" };
      }
    }

    const [profileResult, settingsResult] = await Promise.all([
      supabaseServiceClient.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
      supabaseServiceClient.from("settings").select("*").eq("user_id", userId).maybeSingle(),
    ]);

    return {
      userId,
      profile: profileResult.data ?? null,
      settings: settingsResult.data ?? null,
    };
  });

  return app;
};


