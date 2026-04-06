import type { FastifyReply } from "fastify";
import { env } from "../config/env";

const ACCESS_TOKEN_MAX_AGE = 60 * 60; // 1 hour
const REFRESH_TOKEN_MAX_AGE = 60 * 60 * 24 * 90; // 90 days
const REFRESH_TOKEN_ROTATION_THRESHOLD = 60 * 5; // 5 minutes
const INTENT_MAX_AGE = 60 * 5; // 5 minutes
const SESSION_MAX_AGE = 60 * 60 * 12; // 12 hours

export function setAuthCookies(reply: FastifyReply, accessToken: string, refreshToken: string) {
  reply.setCookie(env.cookie.name.accessToken, accessToken, {
    httpOnly: true,
    path: "/",
    sameSite: env.cookie.sameSite,
    secure: env.cookie.secure,
    domain: env.cookie.domain,
    maxAge: ACCESS_TOKEN_MAX_AGE,
  });

  reply.setCookie(env.cookie.name.refreshToken, refreshToken, {
    httpOnly: true,
    path: "/",
    sameSite: env.cookie.sameSite,
    secure: env.cookie.secure,
    domain: env.cookie.domain,
    maxAge: REFRESH_TOKEN_MAX_AGE,
  });
}

export function clearAuthCookies(reply: FastifyReply) {
  reply.clearCookie(env.cookie.name.accessToken, {
    path: "/",
    domain: env.cookie.domain,
  });
  reply.clearCookie(env.cookie.name.refreshToken, {
    path: "/",
    domain: env.cookie.domain,
  });
}

export function extractTokens(requestCookies: Record<string, string | undefined>) {
  return {
    accessToken: requestCookies[env.cookie.name.accessToken],
    refreshToken: requestCookies[env.cookie.name.refreshToken],
  };
}

export function shouldRotateRefreshToken(expiry: number | null | undefined) {
  if (!expiry) return false;
  const secondsUntilExpiry = expiry - Math.floor(Date.now() / 1000);
  return secondsUntilExpiry < REFRESH_TOKEN_ROTATION_THRESHOLD;
}

export function setSessionCookie(reply: FastifyReply, token: string) {
  reply.setCookie(env.cookie.name.session, token, {
    httpOnly: true,
    path: "/",
    sameSite: env.cookie.sameSite,
    secure: env.cookie.secure,
    domain: env.cookie.domain,
    maxAge: SESSION_MAX_AGE,
  });
}

export function clearSessionCookie(reply: FastifyReply) {
  reply.clearCookie(env.cookie.name.session, {
    path: "/",
    domain: env.cookie.domain,
  });
}

export function setIntentCookie(reply: FastifyReply, intentId: string) {
  reply.setCookie(env.cookie.name.intent, intentId, {
    httpOnly: true,
    path: "/",
    sameSite: env.cookie.sameSite,
    secure: env.cookie.secure,
    domain: env.cookie.domain,
    maxAge: INTENT_MAX_AGE,
  });
}

export function clearIntentCookie(reply: FastifyReply) {
  reply.clearCookie(env.cookie.name.intent, {
    path: "/",
    domain: env.cookie.domain,
  });
}

export function extractIntentId(requestCookies: Record<string, string | undefined>) {
  return requestCookies[env.cookie.name.intent];
}
