import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import { createVerifier } from "fast-jwt";
import { z } from "zod";
import { env } from "./config";
import { prismaClient } from "./lib/prismaClient";

const patchSchema = z.object({
  first_name: z.string().max(100).optional(),
  last_name: z.string().max(100).optional(),
  locale: z.string().max(16).optional(),
  bio: z.string().max(1000).optional(),
  city: z.string().max(120).optional(),
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
  const app = Fastify({ logger: true, trustProxy: true });

  // SECURITY: only allow localhost dev origins outside production.
  const allowedOrigins = [env.APP_URL];
  if (process.env.NODE_ENV !== "production") {
    allowedOrigins.push("http://127.0.0.1:3000", "http://localhost:3000");
  }

  app.register(cors, {
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });

  app.get("/health", async () => ({
    status: "ok",
    service: "profile-service",
    persistence: "prisma",
    timestamp: new Date().toISOString(),
  }));

  app.get("/profiles/me", async (request, reply) => {
    const userId = resolveAuthenticatedUserId(request, reply);
    if (!userId) {
      return { code: "UNAUTHORIZED" };
    }

    try {
      const [profile, settings] = await Promise.all([
        prismaClient.profile.findUnique({
          where: { userId },
          select: {
            firstName: true,
            lastName: true,
            locale: true,
            bio: true,
            birthDate: true,
            gender: true,
            city: true,
            originCountry: true,
            languages: true,
            intent: true,
            interests: true,
            photosCount: true,
            verifiedOptIn: true,
            onboardingVersion: true,
          },
        }),
        prismaClient.userSettings.findUnique({
          where: { userId },
          select: {
            language: true,
            targetLang: true,
            autoTranslate: true,
            autoDetectLanguage: true,
            notificationsEnabled: true,
            preciseLocationEnabled: true,
            visibility: true,
            hideAge: true,
            hideDistance: true,
            incognito: true,
            readReceipts: true,
            shadowGhost: true,
            travelPassCity: true,
            phoneCountryCode: true,
            phoneNationalNumber: true,
            distanceKm: true,
            ageMin: true,
            ageMax: true,
            genderPreference: true,
          },
        }),
      ]);

      return { userId, profile, settings };
    } catch {
      return {
        userId,
        profile: memoryProfiles.get(userId) ?? null,
        settings: memorySettings.get(userId) ?? null,
      };
    }
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

    try {
      const profileData = {
        firstName: payload.first_name,
        lastName: payload.last_name,
        locale: payload.locale,
        bio: payload.bio,
        city: payload.city,
      };

      await prismaClient.profile.upsert({
        where: { userId },
        update: profileData,
        create: { userId, ...profileData },
      });

      if (payload.settings) {
        const settingsData = {
          language: payload.settings.language,
          targetLang: payload.settings.target_lang,
          autoTranslate: payload.settings.auto_translate,
          autoDetectLanguage: payload.settings.auto_detect_language,
          notificationsEnabled: payload.settings.notifications_enabled,
          preciseLocationEnabled: payload.settings.precise_location_enabled,
          visibility: payload.settings.visibility,
          hideAge: payload.settings.hide_age,
          hideDistance: payload.settings.hide_distance,
          incognito: payload.settings.incognito,
          readReceipts: payload.settings.read_receipts,
          shadowGhost: payload.settings.shadow_ghost,
          travelPassCity: payload.settings.travel_pass_city,
          phoneCountryCode: payload.settings.phone_country_code,
          phoneNationalNumber: payload.settings.phone_national_number,
          distanceKm: payload.settings.distance_km,
          ageMin: payload.settings.age_min,
          ageMax: payload.settings.age_max,
          genderPreference: payload.settings.gender_preference,
        };

        await prismaClient.userSettings.upsert({
          where: { userId },
          update: settingsData,
          create: { userId, ...settingsData },
        });
      }

      const [profile, settings] = await Promise.all([
        prismaClient.profile.findUnique({
          where: { userId },
          select: {
            firstName: true,
            lastName: true,
            locale: true,
            bio: true,
            birthDate: true,
            gender: true,
            city: true,
            originCountry: true,
            languages: true,
            intent: true,
            interests: true,
            photosCount: true,
            verifiedOptIn: true,
            onboardingVersion: true,
          },
        }),
        prismaClient.userSettings.findUnique({
          where: { userId },
          select: {
            language: true,
            targetLang: true,
            autoTranslate: true,
            autoDetectLanguage: true,
            notificationsEnabled: true,
            preciseLocationEnabled: true,
            visibility: true,
            hideAge: true,
            hideDistance: true,
            incognito: true,
            readReceipts: true,
            shadowGhost: true,
            travelPassCity: true,
            phoneCountryCode: true,
            phoneNationalNumber: true,
            distanceKm: true,
            ageMin: true,
            ageMax: true,
            genderPreference: true,
          },
        }),
      ]);

      return { userId, profile, settings };
    } catch {
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
  });

  return app;
};


