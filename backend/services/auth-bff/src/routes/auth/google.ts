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

const DEFAULT_NEXT_PATH = "/onboarding";
const DEFAULT_REDIRECT_PATH = "/login/methods";

const stateStore = new Map<
  string,
  {
    codeVerifier: string;
    createdAt: number;
    next: string;
    redirect: string;
  }
>();

const CALLBACK_EXPIRATION = 1000 * 60 * 10; // 10 minutes
const INTENT_EXPIRATION = 1000 * 60 * 5; // 5 minutes

const intentStore = new Map<string, OnboardingIntent>();

const startQuerySchema = z.object({
  next: z.string().optional(),
  redirect_url: z.string().optional(),
});

const callbackQuerySchema = z.object({
  code: z.string(),
  state: z.string(),
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

        stateStore.set(state, {
          codeVerifier,
          createdAt: Date.now(),
          next,
          redirect,
        });

        setTimeout(() => stateStore.delete(state), CALLBACK_EXPIRATION).unref?.();

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
          ["login_with_password", "send_magic_link"]
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
        ["login_with_password", "send_magic_link"]
      );
    }

    const { code, state, error, error_description } = parse.data;

    if (error) {
      request.log.warn({ state, error, error_description }, "auth.google.callback_error");
      return sendAuthError(
        reply,
        401,
        "OAUTH_EXCHANGE_FAILED",
        error_description ?? "Google authentication canceled.",
        ["login_with_password", "send_magic_link"]
      );
    }

    const entry = stateStore.get(state);
    if (!entry || Date.now() - entry.createdAt > CALLBACK_EXPIRATION) {
      request.log.warn({ state }, "auth.google.callback_state_expired");
      return sendAuthError(
        reply,
        401,
        "OAUTH_STATE_MISMATCH",
        "OAuth state expired.",
        ["login_with_password", "send_magic_link"]
      );
    }

    stateStore.delete(state);

    try {
      const client = await getGoogleClient();
      const tokenSet = await client.callback(
        env.GOOGLE_REDIRECT_URI,
        { code, state },
        {
          code_verifier: entry.codeVerifier,
          state,
        }
      );

      const idToken = tokenSet.id_token;
      const accessToken = tokenSet.access_token;

      if (!idToken || !accessToken) {
        request.log.error({ tokenSet }, "auth.google.callback_missing_tokens");
        return sendAuthError(
          reply,
          401,
          "ID_TOKEN_MISSING",
          "Missing Google tokens.",
          ["login_with_password", "send_magic_link"]
        );
      }

      const { data, error: supabaseError } = await supabaseAnonClient.auth.signInWithIdToken({
        provider: "google",
        token: idToken,
        access_token: accessToken,
      });

      if (supabaseError || !data.session) {
        request.log.error({ err: supabaseError }, "auth.google.supabase_signin_failed");
        return sendAuthError(
          reply,
          401,
          "SUPABASE_SIGNIN_FAILED",
          "Google sign-in failed on Supabase.",
          ["login_with_password", "send_magic_link"]
        );
      }

      setAuthCookies(reply, data.session.access_token, data.session.refresh_token);
      request.log.info(
        {
          provider: "google",
          userId: data.session.user.id,
          email: data.session.user.email,
        },
        "auth.google.success"
      );

      const internalToken = issueInternalSessionToken({
        sub: data.session.user.id,
        email: data.session.user.email,
        role: data.session.user.role ?? "authenticated",
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
      if (data.session.access_token) {
        redirectUrl.searchParams.set("access_token", data.session.access_token);
      }
      if (data.session.refresh_token) {
        redirectUrl.searchParams.set("refresh_token", data.session.refresh_token);
      }
      redirectUrl.searchParams.set("next", nextPath);
      if (data.session.expires_in) {
        redirectUrl.searchParams.set("expires_in", String(data.session.expires_in));
      }

      reply.redirect(redirectUrl.toString());
    } catch (err) {
      request.log.error({ err }, "auth.google.callback_exception");
      return sendAuthError(
        reply,
        401,
        "OAUTH_EXCHANGE_FAILED",
        "Failed to exchange Google OAuth code.",
        ["login_with_password", "send_magic_link"]
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
