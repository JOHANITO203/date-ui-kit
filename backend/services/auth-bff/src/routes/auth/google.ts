import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { supabaseAnonClient } from "../../lib/supabaseClient";
import { getGoogleClient, generatePKCE, generateState } from "../../lib/oidc";
import { env } from "../../config/env";
import {
  setAuthCookies,
  setIntentCookie,
  clearIntentCookie,
  extractIntentId,
} from "../../lib/cookies";
import {
  issueInternalSessionToken,
  persistInternalSession,
} from "../../lib/session";
import { sendAuthError, sendAuthSuccess } from "./utils";

type OnboardingIntent = {
  next: string;
  createdAt: number;
};

type OAuthStateEntry = {
  codeVerifier: string;
  createdAt: number;
  next: string;
  redirect: string;
};

const DEFAULT_NEXT_PATH = "/onboarding";
const DEFAULT_REDIRECT_PATH = "/login/methods";
const OAUTH_STATE_COOKIE = "exotic-oauth-google";

const stateStore = new Map<string, OAuthStateEntry>();

const CALLBACK_EXPIRATION = 1000 * 60 * 10; // 10 minutes
const INTENT_EXPIRATION = 1000 * 60 * 5; // 5 minutes
const OAUTH_CALLBACK_MAX_ATTEMPTS = 3;
const OAUTH_CALLBACK_RETRY_DELAYS_MS = [250, 700];
const SUPABASE_SIGNIN_MAX_ATTEMPTS = 3;
const SUPABASE_SIGNIN_RETRY_DELAYS_MS = [300, 900];

const intentStore = new Map<string, OnboardingIntent>();

const startQuerySchema = z.object({
  next: z.string().optional(),
  redirect_url: z.string().optional(),
});

const callbackQuerySchema = z.object({
  code: z.string(),
  state: z.string(),
  iss: z.string().optional(),
  error: z.string().optional(),
  error_description: z.string().optional(),
});

const sanitizeRelativePath = (raw?: string): string | undefined => {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/")) return undefined;
  if (trimmed.startsWith("//")) return undefined;
  return trimmed;
};

const serializeOAuthStateCookie = (state: string, entry: OAuthStateEntry) =>
  Buffer.from(JSON.stringify({ state, entry }), "utf8").toString("base64url");

const parseOAuthStateCookie = (
  raw: string | undefined
): { state: string; entry: OAuthStateEntry } | null => {
  if (!raw) return null;
  try {
    const decoded = Buffer.from(raw, "base64url").toString("utf8");
    const parsed = JSON.parse(decoded) as {
      state?: string;
      entry?: OAuthStateEntry;
    };
    if (
      !parsed?.state ||
      !parsed?.entry?.codeVerifier ||
      !parsed?.entry?.createdAt ||
      !parsed?.entry?.next ||
      !parsed?.entry?.redirect
    ) {
      return null;
    }
    return {
      state: parsed.state,
      entry: parsed.entry,
    };
  } catch {
    return null;
  }
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isTransientOAuthNetworkError = (error: unknown) => {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: string }).code;
  const message = (error as { message?: string }).message ?? "";

  if (
    code === "EAI_AGAIN" ||
    code === "ETIMEDOUT" ||
    code === "ECONNRESET" ||
    code === "ENOTFOUND"
  ) {
    return true;
  }

  return typeof message === "string" && message.toLowerCase().includes("timed out");
};

const isTransientSupabaseAuthError = (error: unknown) => {
  if (!error || typeof error !== "object") return false;

  const status = (error as { status?: number }).status;
  const code = (error as { code?: string }).code;
  const message = (error as { message?: string }).message ?? "";

  if (status === 0) return true;
  if (
    code === "EAI_AGAIN" ||
    code === "ENOTFOUND" ||
    code === "ETIMEDOUT" ||
    code === "ECONNRESET"
  ) {
    return true;
  }

  const lowered = typeof message === "string" ? message.toLowerCase() : "";
  return lowered.includes("fetch failed") || lowered.includes("timed out");
};

const isOauth2GoogleapisDnsError = (error: unknown) => {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: string }).code;
  const hostname = (error as { hostname?: string }).hostname;
  return (
    (code === "EAI_AGAIN" || code === "ENOTFOUND") &&
    hostname === "oauth2.googleapis.com"
  );
};

const exchangeGoogleCodeViaAccountsEndpoint = async (input: {
  code: string;
  codeVerifier: string;
}) => {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: input.code,
    redirect_uri: env.GOOGLE_REDIRECT_URI,
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    code_verifier: input.codeVerifier,
  });

  const response = await fetch("https://accounts.google.com/o/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`accounts_token_exchange_failed_${response.status}:${payload}`);
  }

  const payload = (await response.json()) as {
    access_token?: string;
    id_token?: string;
  };

  return {
    access_token: payload.access_token,
    id_token: payload.id_token,
  };
};

const exchangeGoogleCallbackWithRetry = async (input: {
  code: string;
  state: string;
  iss?: string;
  codeVerifier: string;
}) => {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= OAUTH_CALLBACK_MAX_ATTEMPTS; attempt += 1) {
    try {
      const client = await getGoogleClient();
      const tokenSet = await client.callback(
        env.GOOGLE_REDIRECT_URI,
        { code: input.code, state: input.state, iss: input.iss },
        {
          code_verifier: input.codeVerifier,
          state: input.state,
        }
      );
      return tokenSet;
    } catch (error) {
      if (isOauth2GoogleapisDnsError(error)) {
        return exchangeGoogleCodeViaAccountsEndpoint({
          code: input.code,
          codeVerifier: input.codeVerifier,
        });
      }

      lastError = error;
      if (!isTransientOAuthNetworkError(error) || attempt >= OAUTH_CALLBACK_MAX_ATTEMPTS) {
        break;
      }
      const retryDelay = OAUTH_CALLBACK_RETRY_DELAYS_MS[attempt - 1] ?? 1000;
      await sleep(retryDelay);
    }
  }

  throw lastError;
};

const signInWithSupabaseIdTokenWithRetry = async (input: {
  idToken: string;
  accessToken: string;
}) => {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= SUPABASE_SIGNIN_MAX_ATTEMPTS; attempt += 1) {
    const { data, error } = await supabaseAnonClient.auth.signInWithIdToken({
      provider: "google",
      token: input.idToken,
      access_token: input.accessToken,
    });

    if (!error && data.session) {
      return { data, error: null as null };
    }

    lastError = error ?? new Error("supabase_signin_missing_session");
    if (!isTransientSupabaseAuthError(lastError) || attempt >= SUPABASE_SIGNIN_MAX_ATTEMPTS) {
      break;
    }

    const retryDelay = SUPABASE_SIGNIN_RETRY_DELAYS_MS[attempt - 1] ?? 1200;
    await sleep(retryDelay);
  }

  return {
    data: null,
    error: lastError,
  };
};

export async function registerGoogleAuthRoutes(app: FastifyInstance) {
  const registerStartRoute = (path: string) => {
    app.get(path, async (request, reply) => {
      try {
        const parsedQuery = startQuerySchema.safeParse(request.query);
        const requestedNext = parsedQuery.success ? parsedQuery.data.next : undefined;
        const requestedRedirect = parsedQuery.success ? parsedQuery.data.redirect_url : undefined;

        const next = sanitizeRelativePath(requestedNext) ?? DEFAULT_NEXT_PATH;
        const redirect = sanitizeRelativePath(requestedRedirect) ?? DEFAULT_REDIRECT_PATH;

        const client = await getGoogleClient();
        const { codeVerifier, codeChallenge } = generatePKCE();
        const state = generateState();

        const entry: OAuthStateEntry = {
          codeVerifier,
          createdAt: Date.now(),
          next,
          redirect,
        };

        stateStore.set(state, entry);

        setTimeout(() => stateStore.delete(state), CALLBACK_EXPIRATION).unref?.();
        reply.setCookie(OAUTH_STATE_COOKIE, serializeOAuthStateCookie(state, entry), {
          httpOnly: true,
          path: "/",
          sameSite: env.cookie.sameSite,
          secure: env.cookie.secure,
          domain: env.cookie.domain,
          maxAge: Math.floor(CALLBACK_EXPIRATION / 1000),
        });

        const authUrl = client.authorizationUrl({
          scope: "openid email profile",
          code_challenge: codeChallenge,
          code_challenge_method: "S256",
          state,
          redirect_uri: env.GOOGLE_REDIRECT_URI,
          prompt: "consent",
        });

        reply.redirect(authUrl);
      } catch (error) {
        request.log.error({ err: error }, "auth.google.start_failed");
        sendAuthError(
          reply,
          500,
          "OAUTH_START_FAILED",
          "Failed to start Google authentication.",
          ["login_with_google"]
        );
      }
    });
  };

  registerStartRoute("/auth/google/start");
  registerStartRoute("/auth/oauth/google/start");

  app.get("/auth/google/callback", async (request, reply) => {
    const parse = callbackQuerySchema.safeParse(request.query);
    if (!parse.success) {
      request.log.warn({ query: request.query }, "auth.google.callback_invalid_query");
      return sendAuthError(
        reply,
        400,
        "OAUTH_INVALID_CALLBACK",
        "Invalid OAuth callback query.",
        ["login_with_google"]
      );
    }

    const { code, state, iss, error, error_description } = parse.data;

    if (error) {
      request.log.warn({ state, error, error_description }, "auth.google.callback_error");
      return sendAuthError(
        reply,
        401,
        "OAUTH_EXCHANGE_FAILED",
        error_description ?? "Google authentication canceled.",
        ["login_with_google"]
      );
    }

    const cookieState = parseOAuthStateCookie(request.cookies[OAUTH_STATE_COOKIE]);
    const mapState = stateStore.get(state);
    const entry = mapState ?? (cookieState && cookieState.state === state ? cookieState.entry : undefined);

    if (!entry || Date.now() - entry.createdAt > CALLBACK_EXPIRATION) {
      request.log.warn({ state }, "auth.google.callback_state_expired");
      return sendAuthError(
        reply,
        401,
        "OAUTH_STATE_MISMATCH",
        "OAuth state expired.",
        ["login_with_google"]
      );
    }

    try {
      const tokenSet = await exchangeGoogleCallbackWithRetry({
        code,
        state,
        iss,
        codeVerifier: entry.codeVerifier,
      });

      const idToken = tokenSet.id_token;
      const accessToken = tokenSet.access_token;

      if (!idToken || !accessToken) {
        request.log.error({ tokenSet }, "auth.google.callback_missing_tokens");
        return sendAuthError(
          reply,
          401,
          "ID_TOKEN_MISSING",
          "Missing Google tokens.",
          ["login_with_google"]
        );
      }

      const { data, error: supabaseError } = await signInWithSupabaseIdTokenWithRetry({
        idToken,
        accessToken,
      });
      const session = data?.session;

      if (supabaseError || !session) {
        request.log.error({ err: supabaseError }, "auth.google.supabase_signin_failed");
        if (isTransientSupabaseAuthError(supabaseError)) {
          return sendAuthError(
            reply,
            503,
            "SUPABASE_NETWORK_UNAVAILABLE",
            "Temporary network issue while finalizing Google sign-in. Please retry.",
            ["login_with_google"]
          );
        }
        return sendAuthError(
          reply,
          401,
          "SUPABASE_SIGNIN_FAILED",
          "Google sign-in failed on Supabase.",
          ["login_with_google"]
        );
      }

      setAuthCookies(reply, session.access_token, session.refresh_token);
      request.log.info(
        {
          provider: "google",
          userId: session.user.id,
          email: session.user.email,
        },
        "auth.google.success"
      );

      const internalToken = issueInternalSessionToken({
        sub: session.user.id,
        email: session.user.email,
        role: session.user.role ?? "authenticated",
      });
      persistInternalSession(reply, internalToken);

      const nextPath = entry.next ?? DEFAULT_NEXT_PATH;
      const redirectPath = entry.redirect ?? DEFAULT_REDIRECT_PATH;
      const intentId = randomUUID();

      intentStore.set(intentId, {
        next: nextPath,
        createdAt: Date.now(),
      });

      setTimeout(() => intentStore.delete(intentId), INTENT_EXPIRATION).unref?.();
      setIntentCookie(reply, intentId);

      const redirectUrl = new URL(redirectPath, env.APP_URL);
      redirectUrl.searchParams.set("provider", "google");
      redirectUrl.searchParams.set("token", internalToken);
      if (session.access_token) {
        redirectUrl.searchParams.set("access_token", session.access_token);
      }
      if (session.refresh_token) {
        redirectUrl.searchParams.set("refresh_token", session.refresh_token);
      }
      redirectUrl.searchParams.set("next", nextPath);
      if (session.expires_in) {
        redirectUrl.searchParams.set("expires_in", String(session.expires_in));
      }

      stateStore.delete(state);
      reply.clearCookie(OAUTH_STATE_COOKIE, {
        path: "/",
        domain: env.cookie.domain,
      });

      reply.redirect(redirectUrl.toString());
    } catch (err) {
      request.log.error(
        {
          err,
          state,
          callbackRedirectUri: env.GOOGLE_REDIRECT_URI,
        },
        "auth.google.callback_exception"
      );
      return sendAuthError(
        reply,
        401,
        "OAUTH_EXCHANGE_FAILED",
        "Failed to exchange Google OAuth code.",
        ["login_with_google"]
      );
    }
  });

  app.get("/auth/intent", async (request, reply) => {
    const intentId = extractIntentId(request.cookies);

    if (!intentId) {
      clearIntentCookie(reply);
      return sendAuthSuccess(reply, {
        ok: true,
        data: null,
      });
    }

    const intent = intentStore.get(intentId);
    if (!intent || Date.now() - intent.createdAt > INTENT_EXPIRATION) {
      intentStore.delete(intentId);
      clearIntentCookie(reply);
      return sendAuthSuccess(reply, {
        ok: true,
        data: null,
      });
    }

    intentStore.delete(intentId);
    clearIntentCookie(reply);
    return sendAuthSuccess(reply, {
      ok: true,
      data: {
        next: intent.next,
      },
    });
  });
}
