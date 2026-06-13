import type { FastifyReply, FastifyRequest } from "fastify";
import { createSigner, createVerifier } from "fast-jwt";
import {
  extractTokens,
  clearAuthCookies,
  setAuthCookies,
  setSessionCookie,
  clearSessionCookie,
} from "./cookies";
import { sendAuthError } from "../routes/auth/utils";
import { env } from "../config/env";
import { prismaClient } from "./prismaClient";
import { generateOpaqueToken, hashToken } from "./hashUtils";

export interface RequireUserResult {
  user: {
    id: string;
    email?: string;
  };
  accessToken: string;
}

export interface InternalSessionClaims {
  sub: string;
  email?: string | null;
  role?: string | null;
}

const REFRESH_TOKEN_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

const signAccessToken = createSigner({
  key: env.INTERNAL_JWT_SECRET,
  algorithm: "HS256",
  expiresIn: "1h",
});

const signInternalSessionToken = createSigner({
  key: env.INTERNAL_JWT_SECRET,
  algorithm: "HS256",
  expiresIn: "12h",
});

const verifyAccessToken = createVerifier({
  key: env.INTERNAL_JWT_SECRET,
  algorithms: ["HS256"],
});

export function issueAccessToken(claims: InternalSessionClaims): string {
  return signAccessToken({
    sub: claims.sub,
    email: claims.email ?? undefined,
    role: claims.role ?? undefined,
  });
}

export function issueInternalSessionToken(claims: InternalSessionClaims): string {
  return signInternalSessionToken({
    sub: claims.sub,
    email: claims.email ?? undefined,
    role: claims.role ?? undefined,
  });
}

export function persistInternalSession(reply: FastifyReply, token: string): void {
  setSessionCookie(reply, token);
}

export function clearInternalSession(reply: FastifyReply): void {
  clearSessionCookie(reply);
}

export async function issueSessionForUser(
  reply: FastifyReply,
  user: { id: string; email?: string | null; role?: string | null },
): Promise<{ accessToken: string; internalToken: string }> {
  const rawRefreshToken = generateOpaqueToken();
  const tokenHash = hashToken(rawRefreshToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_MAX_AGE_MS);

  await prismaClient.refreshToken.create({
    data: { userId: user.id, tokenHash, expiresAt },
  });

  const accessToken = issueAccessToken({ sub: user.id, email: user.email, role: user.role });
  const internalToken = issueInternalSessionToken({ sub: user.id, email: user.email, role: user.role });

  setAuthCookies(reply, accessToken, rawRefreshToken);
  persistInternalSession(reply, internalToken);

  return { accessToken, internalToken };
}

const UNAUTHENTICATED_ACTIONS = ["login_with_password", "login_with_google", "send_magic_link"] as const;

export async function requireUser(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<RequireUserResult | null> {
  const { accessToken: jwtToken, refreshToken: opaqueRefreshToken } = extractTokens(request.cookies);

  if (jwtToken) {
    try {
      const payload = verifyAccessToken(jwtToken) as { sub: string; email?: string };
      if (payload?.sub) {
        return { user: { id: payload.sub, email: payload.email }, accessToken: jwtToken };
      }
    } catch {
      // expired or invalid — fall through to refresh
    }
  }

  if (!opaqueRefreshToken) {
    sendAuthError(reply, 401, "UNAUTHENTICATED", "Session expirée. Merci de vous reconnecter.", [
      ...UNAUTHENTICATED_ACTIONS,
    ]);
    return null;
  }

  const tokenHash = hashToken(opaqueRefreshToken);
  const stored = await prismaClient.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: { select: { id: true, email: true, role: true } } },
  });

  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    clearAuthCookies(reply);
    clearInternalSession(reply);
    sendAuthError(reply, 401, "UNAUTHENTICATED", "Session expirée. Merci de vous reconnecter.", [
      ...UNAUTHENTICATED_ACTIONS,
    ]);
    return null;
  }

  const newRawRefreshToken = generateOpaqueToken();
  const newTokenHash = hashToken(newRawRefreshToken);
  const newExpiresAt = new Date(Date.now() + REFRESH_TOKEN_MAX_AGE_MS);

  await prismaClient.$transaction([
    prismaClient.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    }),
    prismaClient.refreshToken.create({
      data: { userId: stored.userId, tokenHash: newTokenHash, expiresAt: newExpiresAt },
    }),
  ]);

  const { user } = stored;
  const newAccessToken = issueAccessToken({ sub: user.id, email: user.email, role: user.role });
  const newInternalToken = issueInternalSessionToken({ sub: user.id, email: user.email, role: user.role });

  setAuthCookies(reply, newAccessToken, newRawRefreshToken);
  persistInternalSession(reply, newInternalToken);

  return { user: { id: user.id, email: user.email ?? undefined }, accessToken: newAccessToken };
}
