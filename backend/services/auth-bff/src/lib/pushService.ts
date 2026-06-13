import webpush from "web-push";
import { env } from "../config/env";
import { prismaClient } from "./prismaClient";

let configured = false;

const ensureConfigured = (): boolean => {
  if (configured) return true;
  if (!env.hasPush) return false;
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY as string, env.VAPID_PRIVATE_KEY as string);
  configured = true;
  return true;
};

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  kind?: "match" | "message" | "boost" | "visitor" | "generic";
  icon?: string;
};

/**
 * Send a Web Push notification to every registered device of a user.
 * Dead subscriptions (404/410) are pruned. No-op when VAPID is not configured.
 */
export const sendPushToUser = async (userId: string, payload: PushPayload): Promise<{ sent: number }> => {
  if (!ensureConfigured()) return { sent: 0 };

  const subs = await prismaClient.pushSubscription.findMany({ where: { userId } });
  if (subs.length === 0) return { sent: 0 };

  const body = JSON.stringify(payload);
  let sent = 0;
  const stale: string[] = [];

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body,
        );
        sent += 1;
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          stale.push(sub.endpoint);
        }
      }
    }),
  );

  if (stale.length > 0) {
    await prismaClient.pushSubscription
      .deleteMany({ where: { endpoint: { in: stale } } })
      .catch(() => {});
  }

  return { sent };
};
