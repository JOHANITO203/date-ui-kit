import type { FastifyReply, FastifyRequest } from "fastify";
import { createSigner } from "fast-jwt";
import {
  supabaseAnonClient,
  supabaseServiceClient,
} from "./supabaseClient";
import {
  extractTokens,
  clearAuthCookies,
  setAuthCookies,
  setSessionCookie,
  clearSessionCookie,
} from "./cookies";
import { sendAuthError } from "../routes/auth/utils";
import { env } from "../config/env";

export interface RequireUserResult {
  user: {
    id: string;
    email?: string;
  };
  accessToken: string;
}

const signInternalSessionToken = createSigner({
  key: env.INTERNAL_JWT_SECRET,
  algorithm: "HS256",
  expiresIn: "1h",
});

export interface InternalSessionClaims {
  sub: string;
  email?: string | null;
  role?: string | null;
}

export function issueInternalSessionToken(claims: InternalSessionClaims) {
  return signInternalSessionToken({
    sub: claims.sub,
    email: claims.email ?? undefined,
    role: claims.role ?? undefined,
  });
}

export function persistInternalSession(reply: FastifyReply, token: string) {
  setSessionCookie(reply, token);
}

export function clearInternalSession(reply: FastifyReply) {
  clearSessionCookie(reply);
}

export async function requireUser(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<RequireUserResult | null> {
  const { accessToken, refreshToken } = extractTokens(request.cookies);

  if (!accessToken) {
    sendAuthError(
      reply,
      401,
      "UNAUTHENTICATED",
      "Session expirée. Merci de vous reconnecter.",
      ["login_with_password", "login_with_google", "send_magic_link"]
    );
    return null;
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
      const refreshedInternal = issueInternalSessionToken({
        sub: refresh.data.session.user.id,
        email: refresh.data.session.user.email,
        role: refresh.data.session.user.role ?? "authenticated",
      });
      persistInternalSession(reply, refreshedInternal);
      userResponse = await supabaseServiceClient.auth.getUser(
        refresh.data.session.access_token
      );
    } else {
      clearAuthCookies(reply);
      clearInternalSession(reply);
      sendAuthError(
        reply,
        401,
        "UNAUTHENTICATED",
        "Session expirée. Merci de vous reconnecter.",
        ["login_with_password", "login_with_google", "send_magic_link"]
      );
      return null;
    }
  }

  if (userResponse.error || !userResponse.data.user) {
    clearAuthCookies(reply);
    clearInternalSession(reply);
    sendAuthError(
      reply,
      401,
      "UNAUTHENTICATED",
      "Session invalide.",
      ["login_with_password", "login_with_google", "send_magic_link"]
    );
    return null;
  }

  return {
    user: {
      id: userResponse.data.user.id,
      email: userResponse.data.user.email ?? undefined,
    },
    accessToken: accessToken,
  };
}
