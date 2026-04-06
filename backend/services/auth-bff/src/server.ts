import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import sensible from "@fastify/sensible";
import { env } from "./config/env";
import { registerEmailAuthRoutes } from "./routes/auth/email";
import { registerGoogleAuthRoutes } from "./routes/auth/google";
import { registerProfileRoutes } from "./routes/profile";
import { registerOnboardingRoutes } from "./routes/onboarding";

const resolveAllowedOrigins = (appUrl: string): Set<string> => {
  const allowed = new Set<string>();

  const normalize = (input: string) => input.replace(/\/$/, "");

  allowed.add(normalize(appUrl));

  try {
    const url = new URL(appUrl);
    const base = `${url.protocol}//${url.host}`;
    allowed.add(normalize(base));

    if (url.hostname === "127.0.0.1" || url.hostname === "localhost") {
      const alternateHost = url.hostname === "127.0.0.1" ? "localhost" : "127.0.0.1";
      const alternate = `${url.protocol}//${alternateHost}${url.port ? `:${url.port}` : ""}`;
      allowed.add(normalize(alternate));
    }
  } catch {
    // Si APP_URL n'est pas une URL valide, on se contente de la valeur brute normalisée.
  }

  return allowed;
};

export function buildServer() {
  const server = Fastify({
    logger: {
      level: env.NODE_ENV === "production" ? "info" : "debug",
    },
  });

  const allowedOrigins = resolveAllowedOrigins(env.APP_URL);

  server.register(sensible);

  server.register(cors, {
    credentials: true,
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      const normalized = origin.replace(/\/$/, "");

      if (allowedOrigins.has(normalized)) {
        callback(null, true);
        return;
      }

      server.log.warn({ origin }, "CORS origin refusé");
      callback(null, false);
    },
  });

  server.register(cookie, {
    hook: "onRequest",
    parseOptions: {
      sameSite: env.cookie.sameSite,
      secure: env.cookie.secure,
      domain: env.cookie.domain,
    },
  });

  const isRelaxedMode =
    process.env.E2E_TEST_MODE === "1" ||
    process.env.PLAYWRIGHT === "1" ||
    env.NODE_ENV !== "production";

  const rateLimitMax = isRelaxedMode
    ? Math.max(env.RATE_LIMIT_MAX, 50_000)
    : env.RATE_LIMIT_MAX;

  const rateLimitWindow = isRelaxedMode
    ? Math.max(env.RATE_LIMIT_TIME_WINDOW, 60_000)
    : env.RATE_LIMIT_TIME_WINDOW;

  server.register(rateLimit, {
    max: rateLimitMax,
    timeWindow: rateLimitWindow,
    skipOnError: true,
    keyGenerator: (request) =>
      (request.headers["x-real-ip"] as string | undefined) ?? request.ip,
  });

  server.register(async (instance) => {
    await registerEmailAuthRoutes(instance);
    await registerGoogleAuthRoutes(instance);
    await registerProfileRoutes(instance);
    await registerOnboardingRoutes(instance);
  });

  server.get("/health", async () => ({
    status: "ok",
    service: "auth-bff",
    timestamp: new Date().toISOString(),
  }));

  return server;
}
