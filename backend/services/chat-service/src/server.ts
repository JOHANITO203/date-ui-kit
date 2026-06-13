import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import { createVerifier } from "fast-jwt";
import { z } from "zod";
import { env } from "./config";
import { prismaClient } from "./lib/prismaClient";
import {
  createStore,
  ensureConversationForProfile,
  getProfileById,
  sortConversations,
  updateRelationPreview,
} from "./data";
import type { ChatMessage } from "./types";
import type { ProfileCard } from "./types";
import { resolveImageAccessPolicy, type ImageAccessPolicy } from "./imageAccessPolicy";

const openChatSchema = z.object({
  profileId: z.string().min(1),
  fromSuperLike: z.boolean().optional().default(false),
});

const sendMessageSchema = z.object({
  conversationId: z.string().min(1),
  text: z.string(),
});

const relationStateSchema = z.object({
  conversationId: z.string().min(1),
  state: z.enum(["active", "blocked_by_me", "blocked_me"]),
});

const translationToggleSchema = z.object({
  conversationId: z.string().min(1),
  enabled: z.boolean(),
  targetLocale: z.enum(["en", "ru"]),
});

type InternalJwtPayload = {
  sub: string;
  email?: string;
  role?: string;
};

type TranslationSetting = {
  enabled: boolean;
  targetLocale: "en" | "ru";
};

type ProfilePhotoRow = {
  userId: string;
  storagePath: string;
  sortOrder: number | null;
  isPrimary: boolean | null;
  updatedAt: Date | null;
};

type LoadPeerProfilesTiming = {
  totalMs: number;
  missingCount: number;
  profileRows: number;
  photoRows: number;
  profilesQueryMs: number;
  photosQueryMs: number;
  signedUrlCalls: number;
  signedUrlMs: number;
};

const verifyInternalToken = createVerifier({
  key: env.INTERNAL_JWT_SECRET,
  algorithms: ["HS256"],
});

const extractBearerToken = (request: FastifyRequest) => {
  const header = request.headers.authorization;
  if (!header) return null;
  const trimmed = header.trim();
  if (!trimmed.toLowerCase().startsWith("bearer ")) return null;
  const token = trimmed.slice(7).trim();
  return token.length > 0 ? token : null;
};

const resolveAuthenticatedUserId = (
  request: FastifyRequest,
  reply: FastifyReply,
): string | null => {
  const token = extractBearerToken(request);
  if (!token) {
    reply.status(401);
    return null;
  }

  try {
    const payload = verifyInternalToken(token) as InternalJwtPayload;
    if (!payload?.sub || typeof payload.sub !== "string" || payload.sub.trim().length === 0) {
      reply.status(401);
      return null;
    }
    return payload.sub.trim();
  } catch {
    reply.status(401);
    return null;
  }
};

const normalizeRelationState = (value: unknown): "active" | "blocked_by_me" | "blocked_me" => {
  if (value === "blocked_by_me") return "blocked_by_me";
  if (value === "blocked_me" || value === "unmatched") return "blocked_me";
  return "active";
};

const resolveConversationId = (userId: string, profileId: string) =>
  `conv-${userId}-${profileId}`;
const looksLikeConversationId = (value: string) =>
  value.startsWith("conv-") || value.startsWith("match-");

const chunkArray = <T,>(items: T[], size: number) => {
  if (items.length <= size) return [items];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

const buildPublicPhotoUrl = (
  storagePath: string,
  variant: "avatar",
  updatedAtIso: string | null,
) => {
  if (!env.S3_PUBLIC_URL) return "/placeholder.svg";
  const version = updatedAtIso ? new Date(updatedAtIso).getTime() : undefined;
  const clean = storagePath.replace(/^\/+/, "");
  const withoutExt = clean.replace(/\.[^/.]+$/, "");
  const variantPath = `variants/${variant}/${withoutExt}.jpg`;
  const base = `${env.S3_PUBLIC_URL}/${variantPath}`;
  return version ? `${base}?v=${version}` : base;
};

const buildSignedPhotoUrls = async (storagePaths: string[]): Promise<Map<string, string>> => {
  const out = new Map<string, string>();
  if (storagePaths.length === 0 || (!env.S3_ENDPOINT && !env.S3_REGION)) return out;
  try {
    const { S3Client, GetObjectCommand } = await import("@aws-sdk/client-s3");
    const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
    const s3 = new S3Client({
      region: env.S3_REGION || "us-east-1",
      endpoint: env.S3_ENDPOINT || undefined,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID!,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
      },
      forcePathStyle: Boolean(env.S3_ENDPOINT),
    });
    await Promise.all(
      storagePaths.map(async (key) => {
        const url = await getSignedUrl(
          s3,
          new GetObjectCommand({ Bucket: env.S3_BUCKET_PRIVATE, Key: key }),
          { expiresIn: 60 * 60 * 24 * 7 },
        );
        out.set(key, url);
      }),
    );
  } catch {
    /* S3 not configured */
  }
  return out;
};

const toOptionalString = (value: unknown) =>
  typeof value === "string" && value.trim().length > 0 ? value : undefined;

const toTranslationMapKey = (userId: string, conversationId: string) =>
  `${userId}:${conversationId}`;


const computeAge = (birthDate: string | null): number => {
  if (!birthDate) return 24;
  const dob = new Date(birthDate);
  if (Number.isNaN(dob.getTime())) return 24;
  const now = new Date();
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const monthDelta = now.getUTCMonth() - dob.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getUTCDate() < dob.getUTCDate())) age -= 1;
  return Math.max(18, Math.min(60, age));
};

const buildPeerCard = (row: {
  userId: string;
  firstName: string | null;
  birthDate: Date | string | null;
  city: string | null;
  languages: string[] | null;
  bio: string | null;
  interests: string[] | null;
  verifiedOptIn: boolean | null;
  photos: string[];
}): ProfileCard => {
  const birthDateStr =
    row.birthDate instanceof Date ? row.birthDate.toISOString() : row.birthDate ?? null;
  return {
    id: row.userId,
    name: row.firstName?.trim() || "Profile",
    age: computeAge(birthDateStr),
    city: row.city?.trim() || "Unknown",
    distanceKm: 0,
    languages: row.languages && row.languages.length > 0 ? row.languages : ["English", "Russian"],
    bio: row.bio?.trim() || "Looking for meaningful connections.",
    photos: row.photos.length > 0 ? row.photos : ["/placeholder.svg"],
    compatibility: 75,
    interests: row.interests && row.interests.length > 0 ? row.interests : ["Travel", "Music"],
    online: true,
    flags: {
      verifiedIdentity: Boolean(row.verifiedOptIn),
      premiumTier: "free",
      hideAge: false,
      hideDistance: false,
      shadowGhost: false,
    },
  };
};

const loadPeerProfiles = async (
  peerIds: string[],
  resolvePhotoAccess?: (profileId: string) => ImageAccessPolicy,
): Promise<{ byId: Map<string, ProfileCard>; timing: LoadPeerProfilesTiming }> => {
  const startedAt = performance.now();
  const byId = new Map<string, ProfileCard>();
  const timing: LoadPeerProfilesTiming = {
    totalMs: 0,
    missingCount: 0,
    profileRows: 0,
    photoRows: 0,
    profilesQueryMs: 0,
    photosQueryMs: 0,
    signedUrlCalls: 0,
    signedUrlMs: 0,
  };
  for (const peerId of peerIds) {
    const staticPeer = getProfileById(peerId);
    if (staticPeer) byId.set(peerId, staticPeer);
  }

  const missing = peerIds.filter((peerId) => !byId.has(peerId));
  timing.missingCount = missing.length;
  if (missing.length === 0) {
    timing.totalMs = performance.now() - startedAt;
    return { byId, timing };
  }

  const primaryPathByUser = new Map<string, string>();
  const primaryUpdatedAtByUser = new Map<string, string | null>();
  const photoAccessResolver =
    resolvePhotoAccess ?? (() => resolveImageAccessPolicy("messages", "pending"));

  type PrismaProfileRow = {
    userId: string;
    firstName: string | null;
    birthDate: Date | null;
    city: string | null;
    languages: string[] | null;
    bio: string | null;
    interests: string[] | null;
    verifiedOptIn: boolean | null;
  };
  const profileRows: PrismaProfileRow[] = [];

  try {
    for (const chunk of chunkArray(missing, 100)) {
      const queryStartedAt = performance.now();
      const rows = await prismaClient.profile.findMany({
        where: { userId: { in: chunk } },
        select: {
          userId: true,
          firstName: true,
          birthDate: true,
          city: true,
          languages: true,
          bio: true,
          interests: true,
          verifiedOptIn: true,
        },
      });
      timing.profilesQueryMs += performance.now() - queryStartedAt;
      profileRows.push(...(rows as PrismaProfileRow[]));
    }
    timing.profileRows = profileRows.length;

    for (const chunk of chunkArray(missing, 100)) {
      const queryStartedAt = performance.now();
      const rows = (await prismaClient.profilePhoto.findMany({
        where: { userId: { in: chunk } },
        orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
        take: Math.max(200, chunk.length * 3),
      })) as ProfilePhotoRow[];
      timing.photosQueryMs += performance.now() - queryStartedAt;
      timing.photoRows += rows.length;
      for (const row of rows) {
        if (
          !primaryPathByUser.has(row.userId) &&
          typeof row.storagePath === "string" &&
          row.storagePath.length > 0
        ) {
          primaryPathByUser.set(row.userId, row.storagePath);
          primaryUpdatedAtByUser.set(
            row.userId,
            row.updatedAt ? row.updatedAt.toISOString() : null,
          );
        }
      }
    }
  } catch {
    /* Prisma unavailable — fall back to static profiles only */
    timing.totalMs = performance.now() - startedAt;
    return { byId, timing };
  }

  const signedPathsSet = new Set<string>();
  for (const row of profileRows) {
    const path = primaryPathByUser.get(row.userId);
    if (!path) continue;
    const policy = photoAccessResolver(row.userId);
    if (policy !== "public_stable") {
      signedPathsSet.add(path);
    }
  }
  const signedPaths = [...signedPathsSet];
  const signStartedAt = performance.now();
  const signedByPath = await buildSignedPhotoUrls(signedPaths);
  timing.signedUrlCalls = signedPaths.length;
  timing.signedUrlMs = performance.now() - signStartedAt;

  for (const row of profileRows) {
    const path = primaryPathByUser.get(row.userId);
    let primarySignedUrl: string | null = null;
    if (path) {
      const policy = photoAccessResolver(row.userId);
      if (policy === "public_stable") {
        primarySignedUrl = buildPublicPhotoUrl(
          path,
          "avatar",
          primaryUpdatedAtByUser.get(row.userId) ?? null,
        );
      } else {
        primarySignedUrl = signedByPath.get(path) ?? null;
      }
    }
    byId.set(
      row.userId,
      buildPeerCard({
        ...row,
        photos: primarySignedUrl ? [primarySignedUrl] : [],
      }),
    );
  }

  timing.totalMs = performance.now() - startedAt;
  return { byId, timing };
};

const translationSettingsByConversation = new Map<string, TranslationSetting>();
const getTranslationSetting = (userId: string, conversationId: string): TranslationSetting =>
  translationSettingsByConversation.get(toTranslationMapKey(userId, conversationId)) ?? {
    enabled: false,
    targetLocale: "en",
  };

const setTranslationSetting = (
  userId: string,
  conversationId: string,
  setting: TranslationSetting,
) => {
  translationSettingsByConversation.set(toTranslationMapKey(userId, conversationId), setting);
};

const store = createStore();

export const buildServer = () => {
  const app = Fastify({ logger: true, trustProxy: true });

  // SECURITY: only allow localhost dev origins outside production.
  const allowedOrigins = [env.APP_URL];
  if (process.env.NODE_ENV !== "production") {
    allowedOrigins.push("http://127.0.0.1:3000", "http://localhost:3000");
  }

  app.register(cors, {
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });

  const scheduleIncomingReply = (_input: {
    userId: string;
    conversationId: string;
    peerProfileId: string;
    userText: string;
  }) => {};

  app.get("/health", async () => ({
    status: "ok",
    service: "chat-service",
    persistence: "prisma",
    timestamp: new Date().toISOString(),
  }));

  app.get("/chat/conversations", async (request, reply) => {
    const startedAt = performance.now();
    const buckets = {
      authMs: 0,
      conversationsReadMs: 0,
      peerPreparationMs: 0,
      loadPeerProfilesMs: 0,
      shadowGhostMs: 0,
      safetyBlocksMs: 0,
      mappingMs: 0,
      sortMs: 0,
    };
    const userId = resolveAuthenticatedUserId(request, reply);
    buckets.authMs = performance.now() - startedAt;
    if (!userId) {
      return { code: "UNAUTHORIZED" };
    }

    try {
      let cursor = performance.now();
      const conversationRows = await prismaClient.chatConversation.findMany({
        where: { userId },
      });
      buckets.conversationsReadMs = performance.now() - cursor;

      cursor = performance.now();
      const peerIds = [
        ...new Set(conversationRows.map((row) => row.peerProfileId)),
      ].filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
      const peerPolicyById = new Map<string, ImageAccessPolicy>();
      for (const row of conversationRows) {
        const convId = row.conversationId;
        const relationState = normalizeRelationState(row.relationState);
        const state =
          convId.startsWith("match-")
            ? "match_confirmed"
            : relationState === "active"
              ? "conversation_authorized"
              : "pending";
        const policy = resolveImageAccessPolicy("messages", state);
        const existing = peerPolicyById.get(row.peerProfileId);
        peerPolicyById.set(
          row.peerProfileId,
          existing === "signed_private" || policy === "signed_private"
            ? "signed_private"
            : "public_stable",
        );
      }
      buckets.peerPreparationMs = performance.now() - cursor;

      cursor = performance.now();
      const { byId: peerMap, timing: peerLoadTiming } = await loadPeerProfiles(
        peerIds,
        (profileId) =>
          peerPolicyById.get(profileId) ?? resolveImageAccessPolicy("messages", "pending"),
      );
      buckets.loadPeerProfilesMs = performance.now() - cursor;

      let shadowGhostPeerSet = new Set<string>();
      let blockedByMeSet = new Set<string>();
      if (peerIds.length > 0) {
        cursor = performance.now();
        const [shadowGhostRows, blockedRows] = await Promise.all([
          prismaClient.discoverLike.findMany({
            where: {
              likedUserId: userId,
              hiddenByShadowghost: true,
              status: { in: ["pending", "matched"] },
              likerUserId: { in: peerIds },
            },
            select: { likerUserId: true },
          }),
          prismaClient.safetyBlock.findMany({
            where: { userId, blockedUserId: { in: peerIds } },
            select: { blockedUserId: true },
          }),
        ]);
        const parallelDurationMs = performance.now() - cursor;
        buckets.shadowGhostMs = parallelDurationMs;
        buckets.safetyBlocksMs = parallelDurationMs;
        shadowGhostPeerSet = new Set(
          shadowGhostRows
            .map((row) => row.likerUserId)
            .filter((value): value is string => typeof value === "string" && value.length > 0),
        );
        blockedByMeSet = new Set(
          blockedRows
            .map((row) => row.blockedUserId)
            .filter((value): value is string => typeof value === "string" && value.length > 0),
        );
      }

      cursor = performance.now();
      const conversations = conversationRows
        .map((row) => {
          const peer = peerMap.get(row.peerProfileId) ?? null;
          if (!peer) return null;
          const shadowGhostMasked =
            shadowGhostPeerSet.has(row.peerProfileId) && Boolean(peer.flags.shadowGhost);
          let relationState = normalizeRelationState(row.relationState);
          if (relationState === "blocked_by_me" && !blockedByMeSet.has(row.peerProfileId)) {
            relationState = "active";
          }
          return {
            id: row.conversationId,
            peer: {
              ...peer,
              flags: { ...peer.flags, shadowGhost: peer.flags.shadowGhost },
            },
            shadowGhostMasked,
            unreadCount: row.unreadCount ?? 0,
            lastMessagePreview: row.lastMessagePreview ?? "",
            lastMessageAtIso: row.lastMessageAt
              ? row.lastMessageAt.toISOString()
              : new Date().toISOString(),
            online: peer.online,
            relationState,
            relationStateUpdatedAtIso: row.relationStateUpdatedAt
              ? row.relationStateUpdatedAt.toISOString()
              : undefined,
            receivedSuperLikeTraceAtIso: row.receivedSuperlikeTraceAt
              ? row.receivedSuperlikeTraceAt.toISOString()
              : undefined,
          };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item));
      buckets.mappingMs = performance.now() - cursor;

      cursor = performance.now();
      const sortedConversations = sortConversations(conversations);
      buckets.sortMs = performance.now() - cursor;
      const totalMs = performance.now() - startedAt;
      request.log.info(
        {
          totalMs,
          conversationsCount: conversations.length,
          peerCount: peerIds.length,
          buckets,
          loadPeerProfiles: peerLoadTiming,
        },
        "chat.conversations_timing",
      );
      return { conversations: sortedConversations };
    } catch {
      return {
        conversations: sortConversations(store.conversations),
      };
    }
  });

  app.post("/chat/open", async (request, reply) => {
    const parsed = openChatSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.status(400);
      return { code: "INVALID_PAYLOAD", message: "Invalid open chat payload." };
    }

    const userId = resolveAuthenticatedUserId(request, reply);
    if (!userId) {
      return { code: "UNAUTHORIZED" };
    }
    const requestedProfileId = parsed.data.profileId.trim();

    try {
      if (looksLikeConversationId(requestedProfileId)) {
        const existingByConvId = await prismaClient.chatConversation.findUnique({
          where: { userId_conversationId: { userId, conversationId: requestedProfileId } },
        });
        if (existingByConvId) {
          return { conversationId: existingByConvId.conversationId };
        }
      }

      const byPeer = await prismaClient.chatConversation.findFirst({
        where: { userId, peerProfileId: requestedProfileId },
        orderBy: { lastMessageAt: "desc" },
      });

      if (byPeer) {
        return { conversationId: byPeer.conversationId };
      }

      const { byId: peerMap } = await loadPeerProfiles([requestedProfileId], () =>
        resolveImageAccessPolicy("messages", "pending"),
      );
      const peer = peerMap.get(requestedProfileId) ?? null;
      if (!peer) {
        reply.status(404);
        return { code: "PROFILE_NOT_FOUND", message: "Cannot open conversation for this profile." };
      }

      const now = new Date();
      const conversationId = resolveConversationId(userId, requestedProfileId);
      const messageId = `m-${Date.now()}`;

      await prismaClient.$transaction([
        prismaClient.chatConversation.upsert({
          where: { userId_conversationId: { userId, conversationId } },
          update: {},
          create: {
            userId,
            conversationId,
            peerProfileId: requestedProfileId,
            unreadCount: 0,
            lastMessagePreview: parsed.data.fromSuperLike
              ? "This chat started from a SuperLike."
              : "New match. Say hello.",
            lastMessageAt: now,
            relationState: "active",
            relationStateUpdatedAt: now,
            receivedSuperlikeTraceAt: parsed.data.fromSuperLike ? now : null,
          },
        }),
        prismaClient.chatMessage.upsert({
          where: { userId_messageId: { userId, messageId } },
          update: {},
          create: {
            userId,
            messageId,
            conversationId,
            senderUserId: requestedProfileId,
            direction: "incoming",
            originalText: parsed.data.fromSuperLike
              ? "SuperLike landed. Want to chat tonight?"
              : "We matched. Nice to meet you!",
            translated: false,
            createdAt: now,
          },
        }),
      ]);

      return { conversationId };
    } catch {
      /* fall through to memory store */
    }

    const createdOrExisting = ensureConversationForProfile(
      store,
      requestedProfileId,
      parsed.data.fromSuperLike,
    );

    if (!createdOrExisting) {
      reply.status(404);
      return { code: "PROFILE_NOT_FOUND", message: "Cannot open conversation for this profile." };
    }

    return { conversationId: createdOrExisting.id };
  });

  app.get("/chat/conversations/:conversationId/messages", async (request, reply) => {
    const startedAt = performance.now();
    const buckets = {
      authMs: 0,
      guardMs: 0,
      messagesReadMs: 0,
      mappingMs: 0,
    };
    const params = request.params as { conversationId?: string };
    const conversationId = params.conversationId;

    if (!conversationId) {
      reply.status(400);
      return { code: "INVALID_PARAMS", message: "conversationId is required." };
    }

    const userId = resolveAuthenticatedUserId(request, reply);
    buckets.authMs = performance.now() - startedAt;
    if (!userId) {
      return { code: "UNAUTHORIZED" };
    }

    try {
      let cursor = performance.now();
      const conversationRow = await prismaClient.chatConversation.findUnique({
        where: { userId_conversationId: { userId, conversationId } },
      });
      buckets.guardMs = performance.now() - cursor;

      if (!conversationRow) {
        reply.status(404);
        return { code: "NOT_FOUND", message: "Conversation not found." };
      }

      cursor = performance.now();
      const messageRows = await prismaClient.chatMessage.findMany({
        where: { userId, conversationId },
        orderBy: { createdAt: "asc" },
      });
      buckets.messagesReadMs = performance.now() - cursor;

      const translation = getTranslationSetting(userId, conversationId);

      cursor = performance.now();
      const mappedMessages = messageRows.map((row) => {
        const translatedText = translation.enabled
          ? toOptionalString(row.translatedText) ?? row.originalText
          : undefined;
        return {
          id: row.messageId,
          conversationId: row.conversationId,
          senderUserId: row.senderUserId,
          direction: row.direction,
          originalText: row.originalText,
          translatedText,
          translated: translation.enabled,
          targetLocale: translation.enabled ? translation.targetLocale : undefined,
          createdAtIso: row.createdAt.toISOString(),
          readAtIso: row.readAt ? row.readAt.toISOString() : undefined,
        };
      });
      buckets.mappingMs = performance.now() - cursor;
      const totalMs = performance.now() - startedAt;
      request.log.info(
        { totalMs, conversationId, messageCount: mappedMessages.length, buckets },
        "chat.messages_timing",
      );
      return { conversationId, translation, messages: mappedMessages };
    } catch (error) {
      // SECURITY: fail closed. The legacy in-memory store is keyed by
      // conversationId only (not userId), so serving it on DB error would leak
      // another user's messages (IDOR). Refuse instead.
      request.log.error({ err: error, userId, conversationId }, "chat.messages_db_failed");
      reply.status(503);
      return { code: "CHAT_UNAVAILABLE", message: "Chat is temporarily unavailable." };
    }
  });

  app.post("/chat/conversations/:conversationId/read", async (request, reply) => {
    const params = request.params as { conversationId?: string };
    const conversationId = params.conversationId;
    if (!conversationId) {
      reply.status(400);
      return { code: "INVALID_PARAMS", message: "conversationId is required." };
    }

    const userId = resolveAuthenticatedUserId(request, reply);
    if (!userId) {
      return { code: "UNAUTHORIZED" };
    }

    try {
      const conversationRow = await prismaClient.chatConversation.findUnique({
        where: { userId_conversationId: { userId, conversationId } },
      });

      if (!conversationRow) {
        reply.status(404);
        return { code: "NOT_FOUND", message: "Conversation not found." };
      }

      const now = new Date();
      await prismaClient.$transaction([
        prismaClient.chatConversation.update({
          where: { userId_conversationId: { userId, conversationId } },
          data: { unreadCount: 0 },
        }),
        prismaClient.chatMessage.updateMany({
          where: { userId, conversationId, direction: "incoming", readAt: null },
          data: { readAt: now },
        }),
      ]);

      return { conversationId, markedRead: true };
    } catch (error) {
      // SECURITY: fail closed (memory store is not user-scoped → IDOR risk).
      request.log.error({ err: error, userId, conversationId }, "chat.read_db_failed");
      reply.status(503);
      return { code: "CHAT_UNAVAILABLE", message: "Chat is temporarily unavailable." };
    }
  });

  app.post("/chat/messages", async (request, reply) => {
    const parsed = sendMessageSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.status(400);
      return { code: "INVALID_PAYLOAD", message: "Invalid send message payload." };
    }

    const userId = resolveAuthenticatedUserId(request, reply);
    if (!userId) {
      return { code: "UNAUTHORIZED" };
    }
    const { conversationId } = parsed.data;
    const trimmed = parsed.data.text.trim();

    if (!trimmed) {
      return { status: "invalid" as const };
    }

    try {
      const conversationRow = await prismaClient.chatConversation.findUnique({
        where: { userId_conversationId: { userId, conversationId } },
      });

      if (!conversationRow) {
        reply.status(404);
        return { status: "invalid" as const };
      }

      const relationState = normalizeRelationState(conversationRow.relationState);
      if (relationState !== "active") {
        return { status: relationState };
      }

      const translationSetting = getTranslationSetting(userId, conversationId);
      const now = new Date();
      const messageId = `m-${Date.now()}`;

      const message: ChatMessage = {
        id: messageId,
        conversationId,
        senderUserId: userId,
        direction: "outgoing",
        originalText: trimmed,
        translated: translationSetting.enabled,
        translatedText: translationSetting.enabled ? trimmed : undefined,
        targetLocale: translationSetting.enabled ? translationSetting.targetLocale : undefined,
        createdAtIso: now.toISOString(),
      };

      await prismaClient.$transaction([
        prismaClient.chatMessage.upsert({
          where: { userId_messageId: { userId, messageId } },
          update: {},
          create: {
            userId,
            messageId,
            conversationId,
            senderUserId: userId,
            direction: "outgoing",
            originalText: trimmed,
            translated: translationSetting.enabled,
            translatedText: translationSetting.enabled ? trimmed : null,
            targetLocale: translationSetting.enabled ? translationSetting.targetLocale : null,
            createdAt: now,
          },
        }),
        prismaClient.chatConversation.update({
          where: { userId_conversationId: { userId, conversationId } },
          data: {
            unreadCount: 0,
            lastMessagePreview: trimmed,
            lastMessageAt: now,
          },
        }),
      ]);

      scheduleIncomingReply({
        userId,
        conversationId,
        peerProfileId: conversationRow.peerProfileId,
        userText: trimmed,
      });

      return { status: "sent" as const, message };
    } catch (error) {
      // SECURITY: fail closed. Writing/sending via the user-agnostic memory
      // store on DB error would let a caller post into another user's
      // conversation partition (IDOR). Refuse instead.
      request.log.error({ err: error, userId, conversationId }, "chat.send_db_failed");
      reply.status(503);
      return { status: "unavailable" as const };
    }
  });

  app.patch("/chat/relation-state", async (request, reply) => {
    const parsed = relationStateSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.status(400);
      return { code: "INVALID_PAYLOAD", message: "Invalid relation state payload." };
    }

    const userId = resolveAuthenticatedUserId(request, reply);
    if (!userId) {
      return { code: "UNAUTHORIZED" };
    }
    const { conversationId, state } = parsed.data;
    const updatedAtIso = new Date().toISOString();

    try {
      const conversationRow = await prismaClient.chatConversation.findUnique({
        where: { userId_conversationId: { userId, conversationId } },
      });

      if (!conversationRow) {
        reply.status(404);
        return { code: "NOT_FOUND", message: "Conversation not found." };
      }

      await prismaClient.chatConversation.update({
        where: { userId_conversationId: { userId, conversationId } },
        data: {
          relationState: state,
          relationStateUpdatedAt: new Date(updatedAtIso),
          lastMessagePreview: updateRelationPreview(
            state,
            conversationRow.lastMessagePreview ?? "",
          ),
        },
      });

      return { conversationId, state };
    } catch (error) {
      // SECURITY: fail closed (memory store is not user-scoped → IDOR risk).
      request.log.error({ err: error, userId, conversationId }, "chat.relation_state_db_failed");
      reply.status(503);
      return { code: "CHAT_UNAVAILABLE", message: "Chat is temporarily unavailable." };
    }
  });

  app.patch("/chat/translation", async (request, reply) => {
    const parsed = translationToggleSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.status(400);
      return { code: "INVALID_PAYLOAD", message: "Invalid translation payload." };
    }

    const userId = resolveAuthenticatedUserId(request, reply);
    if (!userId) {
      return { code: "UNAUTHORIZED" };
    }

    const { conversationId, enabled, targetLocale } = parsed.data;

    let conversationFound: boolean;
    try {
      const conversationRow = await prismaClient.chatConversation.findUnique({
        where: { userId_conversationId: { userId, conversationId } },
      });
      conversationFound = Boolean(conversationRow);
    } catch (error) {
      // SECURITY: fail closed — do not fall back to the user-agnostic memory
      // store (it would let a caller toggle translation on a conversation they
      // don't own).
      request.log.error({ err: error, userId, conversationId }, "chat.translation_db_failed");
      reply.status(503);
      return { code: "CHAT_UNAVAILABLE", message: "Chat is temporarily unavailable." };
    }

    if (!conversationFound) {
      reply.status(404);
      return { code: "NOT_FOUND", message: "Conversation not found." };
    }

    setTranslationSetting(userId, conversationId, {
      enabled,
      targetLocale,
    });

    return {
      conversationId,
      enabled,
    };
  });

  return app;
};

