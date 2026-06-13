import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { env } from "../../config/env";
import { prismaClient } from "../../lib/prismaClient";
import { generateOpaqueToken, hashToken } from "../../lib/hashUtils";
import { sendSignupVerification, sendMagicLink } from "../../lib/emailService";
import { clearAuthCookies, extractTokens } from "../../lib/cookies";
import { sendAuthError, sendAuthSuccess } from "./utils";
import type { AuthResponse } from "./types";
import {
  clearInternalSession,
  issueInternalSessionToken,
  issueSessionForUser,
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

const sanitizeRelativePath = (raw?: string): string | undefined => {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/")) return undefined;
  if (trimmed.startsWith("//")) return undefined;
  return trimmed;
};

const OTP_EXPIRY_MAGIC_MS = 15 * 60 * 1000;
const OTP_EXPIRY_SIGNUP_MS = 24 * 60 * 60 * 1000;

// SECURITY: per-email cooldown for outbound auth emails. Stops an attacker from
// flooding a victim's inbox with magic-link / verification mails and from minting
// unbounded OTP rows / unverified accounts. In-memory (single instance) — back
// with Redis if the service is scaled horizontally.
const EMAIL_SEND_COOLDOWN_MS = 60_000;
const lastEmailSendByKey = new Map<string, number>();
const isEmailSendOnCooldown = (key: string): boolean => {
  const now = Date.now();
  const last = lastEmailSendByKey.get(key);
  if (last !== undefined && now - last < EMAIL_SEND_COOLDOWN_MS) return true;
  lastEmailSendByKey.set(key, now);
  if (lastEmailSendByKey.size > 5000) {
    const cutoff = now - EMAIL_SEND_COOLDOWN_MS;
    for (const [k, ts] of lastEmailSendByKey.entries()) {
      if (ts < cutoff) lastEmailSendByKey.delete(k);
    }
  }
  return false;
};

// Constant dummy hash so login spends ~the same time whether or not the account
// exists (mitigates account enumeration via response timing).
const DUMMY_BCRYPT_HASH = "$2a$12$abcdefghijklmnopqrstuuWmZ8Q1nU0m1yq1Qz1Qz1Qz1Qz1Qz1Qa";

export async function registerEmailAuthRoutes(app: FastifyInstance) {
  // ─── Sign up ──────────────────────────────────────────────────────────────
  const handleSignup = async (request: FastifyRequest, reply: FastifyReply) => {
    const parse = signUpSchema.safeParse(request.body);
    if (!parse.success) {
      return sendAuthError(reply, 400, "INVALID_PAYLOAD", "Invalid email or password.");
    }

    const { email, password } = parse.data;
    request.log.info({ email }, "auth.signup.requested");

    const existing = await prismaClient.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      return sendAuthError(reply, 409, "EMAIL_ALREADY_REGISTERED", "Email already exists.", [
        "login_with_password",
        "login_with_google",
        "send_magic_link",
      ]);
    }

    // Throttle repeated signups for the same email (anti account/OTP flooding).
    if (isEmailSendOnCooldown(`signup:${email.toLowerCase()}`)) {
      reply.status(201);
      return sendAuthSuccess(reply, { ok: true, next: "check_email_verification" } satisfies AuthResponse);
    }

    const passwordHash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);
    const user = await prismaClient.user.create({
      data: {
        email,
        passwordHash,
        role: "member",
        emailVerified: false,
        profile: { create: {} },
        settings: { create: {} },
      },
      select: { id: true },
    });

    const rawToken = generateOpaqueToken();
    const tokenHash = hashToken(rawToken);
    await prismaClient.emailOtp.create({
      data: {
        email,
        tokenHash,
        type: "signup",
        expiresAt: new Date(Date.now() + OTP_EXPIRY_SIGNUP_MS),
      },
    });

    try {
      await sendSignupVerification(email, rawToken);
    } catch (err) {
      request.log.error({ err, userId: user.id }, "auth.signup.verification_email_failed");
    }

    request.log.info({ email, userId: user.id }, "auth.signup.success");
    reply.status(201);
    return sendAuthSuccess(reply, {
      ok: true,
      next: "check_email_verification",
    } satisfies AuthResponse);
  };

  app.post("/auth/email/signup", handleSignup);
  app.post("/auth/signup", handleSignup);

  // ─── Login ────────────────────────────────────────────────────────────────
  const handleLogin = async (request: FastifyRequest, reply: FastifyReply) => {
    const parse = loginSchema.safeParse(request.body);
    if (!parse.success) {
      return sendAuthError(reply, 400, "INVALID_PAYLOAD", "Invalid email or password.");
    }

    const { email, password } = parse.data;
    request.log.info({ email }, "auth.login.requested");

    const user = await prismaClient.user.findUnique({
      where: { email },
      select: { id: true, email: true, passwordHash: true, emailVerified: true, role: true },
    });

    if (!user || !user.passwordHash) {
      // Spend comparable time to a real bcrypt compare so existing vs unknown
      // accounts can't be distinguished by response timing.
      await bcrypt.compare(password, DUMMY_BCRYPT_HASH).catch(() => false);
      return sendAuthError(reply, 401, "INVALID_CREDENTIALS", "Invalid credentials.", [
        "login_with_google",
        "send_magic_link",
        "reset_password",
      ]);
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return sendAuthError(reply, 401, "INVALID_CREDENTIALS", "Invalid credentials.", [
        "login_with_google",
        "send_magic_link",
        "reset_password",
      ]);
    }

    if (!user.emailVerified) {
      return sendAuthError(reply, 403, "EMAIL_NOT_CONFIRMED", "Please verify your email before logging in.", [
        "resend_verification",
        "send_magic_link",
      ]);
    }

    const { internalToken } = await issueSessionForUser(reply, user);
    request.log.info({ email, userId: user.id }, "auth.login.success");

    return sendAuthSuccess(reply, {
      ok: true,
      data: {
        token: internalToken,
      },
    } satisfies AuthResponse<{ token: string }>);
  };

  app.post("/auth/email/login", handleLogin);
  app.post("/auth/login", handleLogin);

  // ─── Magic link ───────────────────────────────────────────────────────────
  app.post("/auth/email/magic", async (request, reply) => {
    const parse = magicSchema.safeParse(request.body);
    if (!parse.success) {
      return sendAuthError(reply, 400, "INVALID_PAYLOAD", "Invalid email.");
    }

    const { email, from } = parse.data;
    const redirectFrom = sanitizeRelativePath(from) ?? "/discover";
    request.log.info({ email }, "auth.magic.requested");

    // Generic success on cooldown — never reveal whether/when a mail was sent.
    if (isEmailSendOnCooldown(`magic:${email.toLowerCase()}`)) {
      return sendAuthSuccess(reply, { ok: true, next: "check_email_inbox" } satisfies AuthResponse);
    }

    const rawToken = generateOpaqueToken();
    const tokenHash = hashToken(rawToken);
    await prismaClient.emailOtp.create({
      data: {
        email,
        tokenHash,
        type: "magiclink",
        expiresAt: new Date(Date.now() + OTP_EXPIRY_MAGIC_MS),
      },
    });

    try {
      await sendMagicLink(email, rawToken, redirectFrom);
    } catch (err) {
      request.log.error({ err, email }, "auth.magic.email_failed");
      return sendAuthError(reply, 400, "MAGIC_LINK_FAILED", "Unable to send magic link.", [
        "login_with_password",
        "login_with_google",
      ]);
    }

    return sendAuthSuccess(reply, {
      ok: true,
      next: "check_email_inbox",
    } satisfies AuthResponse);
  });

  // ─── Resend verification ──────────────────────────────────────────────────
  app.post("/auth/email/resend", async (request, reply) => {
    const parse = resendSchema.safeParse(request.body);
    if (!parse.success) {
      return sendAuthError(reply, 400, "INVALID_PAYLOAD", "Invalid email.");
    }

    const { email } = parse.data;
    request.log.info({ email }, "auth.resend.requested");

    if (isEmailSendOnCooldown(`resend:${email.toLowerCase()}`)) {
      return sendAuthSuccess(reply, { ok: true, next: "check_email_inbox" } satisfies AuthResponse);
    }

    const user = await prismaClient.user.findUnique({ where: { email }, select: { id: true, emailVerified: true } });
    if (!user || user.emailVerified) {
      return sendAuthSuccess(reply, { ok: true, next: "check_email_inbox" } satisfies AuthResponse);
    }

    const rawToken = generateOpaqueToken();
    const tokenHash = hashToken(rawToken);
    await prismaClient.emailOtp.create({
      data: {
        email,
        tokenHash,
        type: "signup",
        expiresAt: new Date(Date.now() + OTP_EXPIRY_SIGNUP_MS),
      },
    });

    try {
      await sendSignupVerification(email, rawToken);
    } catch (err) {
      request.log.error({ err, email }, "auth.resend.email_failed");
      return sendAuthError(reply, 400, "RESEND_FAILED", "Unable to resend verification email.", [
        "send_magic_link",
        "login_with_password",
      ]);
    }

    request.log.info({ email }, "auth.resend.success");
    return sendAuthSuccess(reply, { ok: true, next: "check_email_inbox" } satisfies AuthResponse);
  });

  // ─── Verify OTP / magic link ──────────────────────────────────────────────
  app.post("/auth/email/verify", async (request, reply) => {
    const parse = verifyEmailSchema.safeParse(request.body);
    if (!parse.success) {
      return sendAuthError(reply, 400, "INVALID_PAYLOAD", "Invalid verification payload.");
    }

    const { token_hash: rawToken, type } = parse.data;
    const normalizedType = type === "email" ? "signup" : type;
    const tokenHash = hashToken(rawToken);

    const otp = await prismaClient.emailOtp.findUnique({
      where: { tokenHash },
    });

    if (!otp || otp.type !== normalizedType || otp.usedAt || otp.expiresAt < new Date()) {
      return sendAuthError(reply, 401, "EMAIL_VERIFY_FAILED", "Verification link invalid or expired.", [
        "send_magic_link",
        "login_with_password",
        "login_with_google",
      ]);
    }

    await prismaClient.emailOtp.update({ where: { id: otp.id }, data: { usedAt: new Date() } });

    let user = await prismaClient.user.findUnique({
      where: { email: otp.email },
      select: { id: true, email: true, role: true, emailVerified: true },
    });

    if (!user) {
      if (normalizedType === "magiclink") {
        user = await prismaClient.user.create({
          data: {
            email: otp.email,
            emailVerified: true,
            role: "member",
            profile: { create: {} },
            settings: { create: {} },
          },
          select: { id: true, email: true, role: true, emailVerified: true },
        });
      } else {
        return sendAuthError(reply, 401, "EMAIL_VERIFY_FAILED", "Account not found.", [
          "send_magic_link",
        ]);
      }
    }

    if (!user.emailVerified) {
      await prismaClient.user.update({ where: { id: user.id }, data: { emailVerified: true } });
    }

    const { internalToken } = await issueSessionForUser(reply, user);

    return sendAuthSuccess(reply, {
      ok: true,
      data: { token: internalToken },
    } satisfies AuthResponse<{ token: string }>);
  });

  // ─── Logout ───────────────────────────────────────────────────────────────
  app.post("/auth/logout", async (request, reply) => {
    const { refreshToken: opaqueRefreshToken } = extractTokens(request.cookies);
    if (opaqueRefreshToken) {
      const tokenHash = hashToken(opaqueRefreshToken);
      await prismaClient.refreshToken
        .update({ where: { tokenHash }, data: { revokedAt: new Date() } })
        .catch(() => {});
    }
    clearAuthCookies(reply);
    clearInternalSession(reply);
    return sendAuthSuccess(reply, { ok: true } satisfies AuthResponse);
  });

  // ─── Session check ────────────────────────────────────────────────────────
  app.get("/auth/session", async (request, reply) => {
    const { accessToken: jwtToken, refreshToken: opaqueRefreshToken } = extractTokens(request.cookies);
    if (!jwtToken && !opaqueRefreshToken) {
      return sendAuthSuccess(reply, {
        ok: true,
        data: { authenticated: false },
      } satisfies AuthResponse);
    }

    const context = await requireUser(request, reply).catch(() => null);
    if (!context) {
      return sendAuthSuccess(reply, {
        ok: true,
        data: { authenticated: false },
      } satisfies AuthResponse);
    }

    const [profile, settings] = await Promise.all([
      prismaClient.profile.findUnique({
        where: { userId: context.user.id },
        select: { firstName: true, lastName: true, locale: true },
      }),
      prismaClient.userSettings.findUnique({
        where: { userId: context.user.id },
        select: { language: true, distanceKm: true, ageMin: true, ageMax: true, genderPreference: true },
      }),
    ]);

    const internalToken = issueInternalSessionToken({ sub: context.user.id, email: context.user.email });

    return sendAuthSuccess(reply, {
      ok: true,
      data: {
        authenticated: true,
        token: internalToken,
        user: {
          id: context.user.id,
          email: context.user.email,
          profile: profile
            ? { first_name: profile.firstName, last_name: profile.lastName, locale: profile.locale }
            : null,
          settings: settings
            ? {
                language: settings.language,
                distance_km: settings.distanceKm,
                age_min: settings.ageMin,
                age_max: settings.ageMax,
                gender_preference: settings.genderPreference,
              }
            : null,
        },
      },
    } satisfies AuthResponse);
  });

  // ─── Token refresh ────────────────────────────────────────────────────────
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
      data: { token: internalToken },
    } satisfies AuthResponse<{ token: string }>);
  });
}
