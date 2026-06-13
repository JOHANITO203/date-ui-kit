import { createHash, randomBytes } from "node:crypto";

export const generateOpaqueToken = (): string =>
  randomBytes(32).toString("hex");

export const hashToken = (raw: string): string =>
  createHash("sha256").update(raw).digest("hex");

export const decodeJwtPayload = (token: string): Record<string, unknown> => {
  try {
    const base64Payload = token.split(".")[1];
    if (!base64Payload) return {};
    const decoded = Buffer.from(base64Payload, "base64url").toString("utf8");
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return {};
  }
};
