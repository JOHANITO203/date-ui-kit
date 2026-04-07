import * as oidc from "openid-client";
import { env } from "../config/env";

const { Issuer, generators } = oidc;
const custom = (oidc as any).custom;

if (custom?.setHttpOptionsDefaults) {
  custom.setHttpOptionsDefaults({
    timeout: 15000,
  });
}

let googleIssuer: Awaited<ReturnType<typeof Issuer.discover>> | null = null;

export async function getGoogleClient() {
  if (!googleIssuer) {
    googleIssuer = await Issuer.discover("https://accounts.google.com");
  }

  return new googleIssuer.Client({
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    redirect_uris: [env.GOOGLE_REDIRECT_URI],
    response_types: ["code"],
  });
}

export function generatePKCE() {
  const codeVerifier = generators.codeVerifier();
  const codeChallenge = generators.codeChallenge(codeVerifier);
  return { codeVerifier, codeChallenge };
}

export function generateState() {
  return generators.state();
}

export function generateNonce() {
  return generators.nonce();
}
