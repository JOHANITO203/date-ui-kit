import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { randomUUID } from "node:crypto";
import { createSigner } from "fast-jwt";
import { z } from "zod";
import { env } from "../../config/env";
import {
  supabaseAnonClient,
  supabaseServiceClient,
} from "../../lib/supabaseClient";
import {
  setAuthCookies,
  clearAuthCookies,
  extractTokens,
} from "../../lib/cookies";
import { sendAuthError, sendAuthSuccess } from "./utils";
import type { AuthResponse } from "./types";
import {
  clearInternalSession,
  issueInternalSessionToken,
  persistInternalSession,
  requireUser,
} from "../../lib/session";

const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const magicSchema = z.object({
  email: z.string().email(),
  from: z.string().optional(),
});

const resendSchema = z.object({
  email: z.string().email(),
});

const verifyEmailSchema = z.object({
  token_hash: z.string().min(1),
  type: z.enum(["magiclink", "signup", "email"]),
});

const TEST_MODE = process.env.E2E_TEST_MODE === "1";
const TEST_SESSION_COOKIE = process.env.E2E_TEST_SESSION_COOKIE ?? "exotic.sid";
type TestUserRecord = { id: string; password: string };
const testUsers = new Map<string, TestUserRecord>();
const TEST_USER_ROLE = "member";
const signTestToken = TEST_MODE
  ? createSigner({
      key: env.INTERNAL_JWT_SECRET,
      algorithm: "HS256",
      expiresIn: 60 * 60 * 12,
    })
  : null;

const setTestSessionCookie = (reply: FastifyReply, token: string) => {
  reply.setCookie(TEST_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: env.cookie.sameSite,
    secure: env.cookie.secure,
    path: "/",
    domain: env.cookie.domain,
    maxAge: 60 * 60,
  });
};

const sanitizeRelativePath = (raw?: string): string | undefined => {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/")) return undefined;
  if (trimmed.startsWith("//")) return undefined;
  return trimmed;
};

export async function registerEmailAuthRoutes(app: FastifyInstance) {
  const handleSignup = async (request: FastifyRequest, reply: FastifyReply) => {
    const parse = signUpSchema.safeParse(request.body);
    if (!parse.success) {
      return sendAuthError(reply, 400, "INVALID_PAYLOAD", "Invalid email or password.");
    }

    const { email, password } = parse.data;
    request.log.info({ email }, "auth.signup.requested");

    if (TEST_MODE) {
      if (testUsers.has(email)) {
        return sendAuthError(reply, 409, "EMAIL_ALREADY_REGISTERED", "Email already exists.");
      }

      const created = await supabaseServiceClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

      if (created.error) {
        const already = created.error.message?.toLowerCase().includes("already");
        const code = already ? "EMAIL_ALREADY_REGISTERED" : "SIGNUP_FAILED";
        const status = already ? 409 : 500;
        return sendAuthError(reply, status, code, created.error.message ?? "Unable to create account.");
      }

      const userId = created.data.user?.id ?? randomUUID();
      testUsers.set(email, { id: userId, password });

      const now = new Date().toISOString();
      const { error: profileError } = await supabaseServiceClient.from("users").upsert(
        {
          id: userId,
          email,
          role: TEST_USER_ROLE,
          created_at: now,
          updated_at: now,
        },
        { onConflict: "id" }
      );

      if (profileError) {
        request.log.error({ err: profileError, userId }, "auth.test_mode.profile_upsert_failed");
        return sendAuthError(reply, 500, "PROFILE_SYNC_FAILED", "Unable to sync test profile.");
      }

      reply.status(201);
      return sendAuthSuccess(reply, {
        ok: true,
        next: "check_email_verification",
      } satisfies AuthResponse);
    }

    const { data, error } = await supabaseAnonClient.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${env.APP_URL}/auth/callback`,
      },
    });

    if (error) {
      const code = error.message?.toLowerCase().includes("already")
        ? "EMAIL_ALREADY_REGISTERED"
        : "SIGNUP_FAILED";
      const status = code === "EMAIL_ALREADY_REGISTERED" ? 409 : 500;
      const fallback =
        code === "EMAIL_ALREADY_REGISTERED"
          ? (["login_with_password", "login_with_google", "send_magic_link"] as const)
          : undefined;

      request.log.warn({ email, code, err: error }, "auth.signup.failed");
      return sendAuthError(
        reply,
        status,
        code,
        error.message ?? "Signup failed.",
        fallback ? Array.from(fallback) : undefined
      );
    }

    if (!data.user) {
      request.log.error({ email }, "auth.signup.user_missing");
      return sendAuthError(reply, 500, "SIGNUP_FAILED", "Unable to create account.");
    }

    request.log.info({ email, userId: data.user.id }, "auth.signup.success");
    reply.status(201);
    return sendAuthSuccess(reply, {
      ok: true,
      next: "check_email_verification",
    } satisfies AuthResponse);
  };

  app.post("/auth/email/signup", handleSignup);
  app.post("/auth/signup", handleSignup);

  const handleLogin = async (request: FastifyRequest, reply: FastifyReply) => {
    const parse = loginSchema.safeParse(request.body);
    if (!parse.success) {
      return sendAuthError(reply, 400, "INVALID_PAYLOAD", "Invalid email or password.");
    }

    const { email, password } = parse.data;
    request.log.info({ email }, "auth.login.requested");

    if (TEST_MODE) {
      const record = testUsers.get(email);
      if (!record || record.password !== password) {
        return sendAuthError(reply, 401, "INVALID_CREDENTIALS", "Invalid credentials.");
      }
      if (!signTestToken) {
        return sendAuthError(reply, 500, "TEST_MODE_TOKEN_MISSING", "Session token unavailable.");
      }
      const token = signTestToken({
        sub: record.id,
        email,
        role: "tester",
      });
      setTestSessionCookie(reply, token);
      return sendAuthSuccess(reply, {
        ok: true,
      } satisfies AuthResponse);
    }

    const { data, error } = await supabaseAnonClient.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.session) {
      const code = error?.message?.toLowerCase().includes("email not confirmed")
        ? "EMAIL_NOT_CONFIRMED"
        : "INVALID_CREDENTIALS";
      const fallback =
        code === "EMAIL_NOT_CONFIRMED"
          ? (["resend_verification", "send_magic_link"] as const)
          : (["login_with_google", "send_magic_link", "reset_password"] as const);

      const status = code === "EMAIL_NOT_CONFIRMED" ? 403 : 401;
      request.log.warn({ email, code, err: error }, "auth.login.failed");
      return sendAuthError(
        reply,
        status,
        code,
        error?.message ?? "Invalid credentials.",
        Array.from(fallback)
      );
    }

    setAuthCookies(reply, data.session.access_token, data.session.refresh_token);
    const internalToken = issueInternalSessionToken({
      sub: data.session.user.id,
      email: data.session.user.email,
      role: data.session.user.role ?? "authenticated",
    });
    persistInternalSession(reply, internalToken);
    request.log.info({ email, userId: data.session.user.id }, "auth.login.success");

    return sendAuthSuccess(reply, {
      ok: true,
      data: {
        token: internalToken,
        supabase_access_token: data.session.access_token,
        supabase_refresh_token: data.session.refresh_token,
        supabase_expires_in: data.session.expires_in ?? null,
      },
    } satisfies AuthResponse<{
      token: string;
      supabase_access_token: string;
      supabase_refresh_token: string | null;
      supabase_expires_in: number | null;
    }>);
  };

  app.post("/auth/email/login", handleLogin);
  app.post("/auth/login", handleLogin);

  app.post("/auth/email/magic", async (request, reply) => {
    const parse = magicSchema.safeParse(request.body);
    if (!parse.success) {
      return sendAuthError(reply, 400, "INVALID_PAYLOAD", "Invalid email.");
    }

    const { email, from } = parse.data;
    const redirectFrom = sanitizeRelativePath(from) ?? "/discover";
    request.log.info({ email }, "auth.magic.requested");
    const { error } = await supabaseAnonClient.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${env.APP_URL}/auth/callback?from=${encodeURIComponent(redirectFrom)}`,
      },
    });

    if (error) {
      request.log.warn({ email, err: error }, "auth.magic.failed");
      return sendAuthError(
        reply,
        400,
        "MAGIC_LINK_FAILED",
        error.message ?? "Unable to send magic link.",
        ["login_with_password", "login_with_google"]
      );
    }

    return sendAuthSuccess(reply, {
      ok: true,
      next: "check_email_inbox",
    } satisfies AuthResponse);
  });

  app.post("/auth/email/resend", async (request, reply) => {
    const parse = resendSchema.safeParse(request.body);
    if (!parse.success) {
      return sendAuthError(reply, 400, "INVALID_PAYLOAD", "Invalid email.");
    }

    const { email } = parse.data;
    request.log.info({ email }, "auth.resend.requested");

    const { error } = await supabaseAnonClient.auth.resend({
      type: "signup",
      email,
    });

    if (error) {
      request.log.warn({ email, err: error }, "auth.resend.failed");
      return sendAuthError(
        reply,
        400,
        "RESEND_FAILED",
        error.message ?? "Unable to resend verification email.",
        ["send_magic_link", "login_with_password"]
      );
    }

    request.log.info({ email }, "auth.resend.success");
    return sendAuthSuccess(reply, {
      ok: true,
      next: "check_email_inbox",
    } satisfies AuthResponse);
  });

  app.post("/auth/email/verify", async (request, reply) => {
    const parse = verifyEmailSchema.safeParse(request.body);
    if (!parse.success) {
      return sendAuthError(reply, 400, "INVALID_PAYLOAD", "Invalid verification payload.");
    }

    const { token_hash, type } = parse.data;
    const { data, error } = await supabaseAnonClient.auth.verifyOtp({
      token_hash,
      type: type === "email" ? "magiclink" : type,
    });

    if (error || !data.session) {
      request.log.warn({ err: error }, "auth.email.verify_failed");
      return sendAuthError(
        reply,
        401,
        "EMAIL_VERIFY_FAILED",
        error?.message ?? "Email verification failed.",
        ["send_magic_link", "login_with_password", "login_with_google"]
      );
    }

    setAuthCookies(reply, data.session.access_token, data.session.refresh_token);
    const internalToken = issueInternalSessionToken({
      sub: data.session.user.id,
      email: data.session.user.email,
      role: data.session.user.role ?? "authenticated",
    });
    persistInternalSession(reply, internalToken);

    return sendAuthSuccess(reply, {
      ok: true,
      data: {
        token: internalToken,
      },
    } satisfies AuthResponse<{ token: string }>);
  });

  app.post("/auth/logout", async (_request, reply) => {
    clearAuthCookies(reply);
    clearInternalSession(reply);
    return sendAuthSuccess(reply, { ok: true } satisfies AuthResponse);
  });

  app.get("/auth/session", async (request, reply) => {
    const { accessToken, refreshToken } = extractTokens(request.cookies);

    if (!accessToken) {
      return sendAuthSuccess(reply, {
        ok: true,
        data: { authenticated: false },
      } satisfies AuthResponse);
    }

    let userResponse = await supabaseServiceClient.auth.getUser(accessToken);

    if (userResponse.error && refreshToken) {
      const refresh = await supabaseAnonClient.auth.refreshSession({
        refresh_token: refreshToken,
      });

      if (refresh.data.session) {
        setAuthCookies(
          reply,
          refresh.data.session.access_token,
          refresh.data.session.refresh_token
        );
        const refreshedInternalToken = issueInternalSessionToken({
          sub: refresh.data.session.user.id,
          email: refresh.data.session.user.email,
          role: refresh.data.session.user.role ?? "authenticated",
        });
        persistInternalSession(reply, refreshedInternalToken);
        userResponse = await supabaseServiceClient.auth.getUser(
          refresh.data.session.access_token
        );
      } else {
        request.log.warn({ reason: "refresh_failed" }, "auth.session.invalidated");
        clearAuthCookies(reply);
        clearInternalSession(reply);
        return sendAuthSuccess(reply, {
          ok: true,
          data: { authenticated: false },
        } satisfies AuthResponse);
      }
    }

    if (userResponse.error || !userResponse.data.user) {
      request.log.warn({ err: userResponse.error }, "auth.session.get_user_failed");
      clearAuthCookies(reply);
      clearInternalSession(reply);
      return sendAuthSuccess(reply, {
        ok: true,
        data: { authenticated: false },
      } satisfies AuthResponse);
    }

    const { user } = userResponse.data;

    const [{ data: profile }, { data: settings }] = await Promise.all([
      supabaseServiceClient
        .from("profiles")
        .select("first_name,last_name,locale")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabaseServiceClient
        .from("settings")
        .select("language,distance_km,age_min,age_max,gender_preference")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

    const internalToken = issueInternalSessionToken({
      sub: user.id,
      email: user.email,
      role: user.role ?? "authenticated",
    });
    persistInternalSession(reply, internalToken);

    return sendAuthSuccess(reply, {
      ok: true,
      data: {
        authenticated: true,
        token: internalToken,
        user: {
          id: user.id,
          email: user.email,
          profile,
          settings,
        },
      },
    } satisfies AuthResponse);
  });

  app.post("/auth/token/refresh", async (request, reply) => {
    const context = await requireUser(request, reply);
    if (!context) return;

    const internalToken = issueInternalSessionToken({
      sub: context.user.id,
      email: context.user.email,
    });

    persistInternalSession(reply, internalToken);

    return sendAuthSuccess(reply, {
      ok: true,
      data: {
        token: internalToken,
      },
    } satisfies AuthResponse<{ token: string }>);
  });
}
