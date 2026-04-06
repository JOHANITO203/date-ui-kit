import Fastify from "fastify";
import cors from "@fastify/cors";
import { z } from "zod";
import { env } from "./config";
import { supabaseServiceClient } from "./lib/supabaseClient";

const patchSchema = z.object({
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  locale: z.string().optional(),
  city: z.string().optional(),
  settings: z
    .object({
      language: z.enum(["en", "ru"]).optional(),
      distance_km: z.number().int().optional(),
      age_min: z.number().int().optional(),
      age_max: z.number().int().optional(),
      gender_preference: z.enum(["everyone", "women", "men"]).optional(),
    })
    .optional(),
});

type MemoryProfile = {
  first_name?: string | null;
  last_name?: string | null;
  locale?: string | null;
  city?: string | null;
};

type MemorySettings = {
  language?: "en" | "ru" | null;
  distance_km?: number | null;
  age_min?: number | null;
  age_max?: number | null;
  gender_preference?: "everyone" | "women" | "men" | null;
};

const memoryProfiles = new Map<string, MemoryProfile>();
const memorySettings = new Map<string, MemorySettings>();

export const buildServer = () => {
  const app = Fastify({ logger: true });

  app.register(cors, {
    origin: [env.APP_URL, "http://127.0.0.1:3000", "http://localhost:3000"],
    credentials: true,
  });

  app.get("/health", async () => ({
    status: "ok",
    service: "profile-service",
    persistence: supabaseServiceClient ? "supabase" : "memory",
    timestamp: new Date().toISOString(),
  }));

  app.get("/profiles/me", async (request, reply) => {
    const query = request.query as { userId?: string };
    const userId = query.userId ?? "me";

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
    const query = request.query as { userId?: string };
    const userId = query.userId ?? "me";

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
