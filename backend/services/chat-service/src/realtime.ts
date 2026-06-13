import type { FastifyInstance, FastifyRequest } from "fastify";
import type { WebSocket } from "ws";
import { createVerifier } from "fast-jwt";
import { z } from "zod";
import { env } from "./config";
import { prismaClient } from "./lib/prismaClient";

type InternalJwtPayload = { sub: string; email?: string; role?: string };

const verifyInternalToken = createVerifier({
  key: env.INTERNAL_JWT_SECRET,
  algorithms: ["HS256"],
});

// userId -> live sockets (a user may have several tabs/devices)
const socketsByUser = new Map<string, Set<WebSocket>>();

const clientMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("ping") }),
  z.object({
    type: z.literal("typing"),
    conversationId: z.string().min(1).max(200),
    peerUserId: z.string().min(1).max(100),
    isTyping: z.boolean(),
  }),
  z.object({
    type: z.literal("webrtc"),
    signal: z.enum(["offer", "answer", "ice", "hangup"]),
    toUserId: z.string().min(1).max(100),
    conversationId: z.string().min(1).max(200),
    data: z.unknown().optional(),
  }),
]);

export const isUserOnline = (userId: string): boolean => {
  const set = socketsByUser.get(userId);
  return Boolean(set && set.size > 0);
};

/** Push a JSON message to every live socket of a user. Returns delivery count. */
export const sendToUser = (userId: string, message: unknown): number => {
  const set = socketsByUser.get(userId);
  if (!set || set.size === 0) return 0;
  const raw = JSON.stringify(message);
  let delivered = 0;
  for (const socket of set) {
    try {
      // 1 === WebSocket.OPEN
      if (socket.readyState === 1) {
        socket.send(raw);
        delivered += 1;
      }
    } catch {
      /* ignore broken socket — cleaned up on close */
    }
  }
  return delivered;
};

const peerUserIdsOf = async (userId: string): Promise<string[]> => {
  try {
    const rows = await prismaClient.chatConversation.findMany({
      where: { userId },
      select: { peerProfileId: true },
      take: 1000,
    });
    const ids = new Set<string>();
    for (const row of rows) {
      if (typeof row.peerProfileId === "string" && row.peerProfileId.length > 0) ids.add(row.peerProfileId);
    }
    return [...ids];
  } catch {
    return [];
  }
};

const broadcastPresence = async (userId: string, online: boolean) => {
  const peers = await peerUserIdsOf(userId);
  for (const peer of peers) {
    sendToUser(peer, { type: "presence", userId, online });
  }
};

export function registerRealtime(app: FastifyInstance) {
  app.get("/chat/ws", { websocket: true }, (socket: WebSocket, request: FastifyRequest) => {
    // Browsers can't set Authorization on a WebSocket, so the internal token is
    // passed as a query param and verified here.
    const token = (request.query as { token?: string })?.token;
    let userId: string;
    try {
      if (!token) throw new Error("missing_token");
      const payload = verifyInternalToken(token) as InternalJwtPayload;
      if (!payload?.sub) throw new Error("invalid_token");
      userId = payload.sub.trim();
    } catch {
      try {
        socket.send(JSON.stringify({ type: "error", code: "UNAUTHORIZED" }));
      } catch { /* ignore */ }
      socket.close(1008, "unauthorized");
      return;
    }

    // Register
    let set = socketsByUser.get(userId);
    const wasOffline = !set || set.size === 0;
    if (!set) {
      set = new Set();
      socketsByUser.set(userId, set);
    }
    set.add(socket);

    socket.send(JSON.stringify({ type: "ready", userId }));
    if (wasOffline) {
      void prismaClient.userSettings
        .upsert({
          where: { userId },
          create: { userId, lastSeenAt: new Date() },
          update: { lastSeenAt: new Date() },
        })
        .catch(() => {});
      void broadcastPresence(userId, true);
    }

    socket.on("message", (raw: Buffer) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw.toString());
      } catch {
        return;
      }
      const msg = clientMessageSchema.safeParse(parsed);
      if (!msg.success) return;

      if (msg.data.type === "ping") {
        try { socket.send(JSON.stringify({ type: "pong" })); } catch { /* ignore */ }
        return;
      }

      if (msg.data.type === "typing") {
        // Relay the typing indicator to the peer only.
        sendToUser(msg.data.peerUserId, {
          type: "typing",
          conversationId: msg.data.conversationId,
          fromUserId: userId,
          isTyping: msg.data.isTyping,
        });
        return;
      }

      if (msg.data.type === "webrtc") {
        // Relay WebRTC signaling between the two peers (transport only).
        sendToUser(msg.data.toUserId, {
          type: "webrtc",
          signal: msg.data.signal,
          fromUserId: userId,
          conversationId: msg.data.conversationId,
          data: msg.data.data,
        });
        return;
      }
    });

    socket.on("close", () => {
      const current = socketsByUser.get(userId);
      if (current) {
        current.delete(socket);
        if (current.size === 0) {
          socketsByUser.delete(userId);
          void prismaClient.userSettings
            .update({ where: { userId }, data: { lastSeenAt: new Date() } })
            .catch(() => {});
          void broadcastPresence(userId, false);
        }
      }
    });
  });
}
