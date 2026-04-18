import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import { createVerifier } from "fast-jwt";
import { z } from "zod";
import { env } from "./config";
import { supabaseServiceClient } from "./lib/supabaseClient";
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
  user_id: string;
  storage_path: string;
  sort_order: number | null;
  is_primary: boolean | null;
  updated_at: string | null;
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
const encodeStoragePath = (value: string) =>
  value
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

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
  if (!env.SUPABASE_URL) return "/placeholder.svg";
  const bucket = env.STORAGE_PROFILE_PHOTOS_PUBLIC_BUCKET;
  const version = updatedAtIso ? new Date(updatedAtIso).getTime() : undefined;
  const clean = storagePath.replace(/^\/+/, "");
  const withoutExt = clean.replace(/\.[^/.]+$/, "");
  const variantPath = `variants/${variant}/${withoutExt}.jpg`;
  const base = `${env.SUPABASE_URL}/storage/v1/object/public/${bucket}/${encodeStoragePath(variantPath)}`;
  if (!version) return base;
  return `${base}?v=${version}`;
};

const buildSignedPhotoUrl = async (storagePath: string): Promise<string | null> => {
  if (!supabaseServiceClient) return null;
  const result = await supabaseServiceClient.storage
    .from(env.STORAGE_PROFILE_PHOTOS_BUCKET)
    .createSignedUrls([storagePath], 60 * 60 * 24 * 7, {
      transform: { width: 256, quality: 72 },
    } as any);
  if (result.error || !Array.isArray(result.data)) return null;
  const entry = result.data[0];
  if (!entry?.signedUrl) return null;
  return entry.signedUrl;
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

const buildPeerCardFromSupabase = (row: {
  user_id: string;
  first_name: string | null;
  birth_date: string | null;
  city: string | null;
  languages: string[] | null;
  bio: string | null;
  interests: string[] | null;
  verified_opt_in: boolean | null;
  photos: string[];
}): ProfileCard => ({
  id: row.user_id,
  name: row.first_name?.trim() || "Profile",
  age: computeAge(row.birth_date),
  city: row.city?.trim() || "Unknown",
  distanceKm: 0,
  languages: row.languages && row.languages.length > 0 ? row.languages : ["English", "Russian"],
  bio: row.bio?.trim() || "Looking for meaningful connections.",
  photos: row.photos.length > 0 ? row.photos : ["/placeholder.svg"],
  compatibility: 75,
  interests: row.interests && row.interests.length > 0 ? row.interests : ["Travel", "Music"],
  online: true,
  flags: {
    verifiedIdentity: Boolean(row.verified_opt_in),
    premiumTier: "free",
    hideAge: false,
    hideDistance: false,
    shadowGhost: false,
  },
});

const loadPeerProfiles = async (
  peerIds: string[],
  resolvePhotoAccess?: (profileId: string) => ImageAccessPolicy,
): Promise<Map<string, ProfileCard>> => {
  const byId = new Map<string, ProfileCard>();
  for (const peerId of peerIds) {
    const staticPeer = getProfileById(peerId);
    if (staticPeer) byId.set(peerId, staticPeer);
  }

  if (!supabaseServiceClient) return byId;

  const missing = peerIds.filter((peerId) => !byId.has(peerId));
  if (missing.length === 0) return byId;

  const primaryPathByUser = new Map<string, string>();
  const photoAccessResolver =
    resolvePhotoAccess ?? (() => resolveImageAccessPolicy("messages", "pending"));
  const profileRows: {
    user_id: string;
    first_name: string | null;
    birth_date: string | null;
    city: string | null;
    languages: string[] | null;
    bio: string | null;
    interests: string[] | null;
    verified_opt_in: boolean | null;
  }[] = [];

  for (const chunk of chunkArray(missing, 100)) {
    const profileResult = await supabaseServiceClient
      .from("profiles")
      .select("user_id,first_name,birth_date,city,languages,bio,interests,verified_opt_in")
      .in("user_id", chunk);

    if (!profileResult.error) {
      profileRows.push(...((profileResult.data ?? []) as typeof profileRows));
    }
  }

  for (const chunk of chunkArray(missing, 100)) {
    const photoResult = await supabaseServiceClient
      .from("profile_photos")
      .select("user_id,storage_path,sort_order,is_primary,updated_at")
      .in("user_id", chunk)
      .or("is_primary.eq.true,sort_order.eq.0,sort_order.eq.1")
      .order("is_primary", { ascending: false })
      .order("sort_order", { ascending: true })
      .limit(Math.max(200, chunk.length * 3));

    if (!photoResult.error) {
      const rows = (photoResult.data ?? []) as ProfilePhotoRow[];
      for (const row of rows) {
        if (!primaryPathByUser.has(row.user_id) && typeof row.storage_path === "string" && row.storage_path.length > 0) {
          primaryPathByUser.set(row.user_id, row.storage_path);
        }
      }
      for (const row of rows) {
        if (!primaryPathByUser.has(row.user_id) && row.storage_path) {
          primaryPathByUser.set(row.user_id, row.storage_path);
        }
      }
    }
  }

  for (const row of profileRows) {
    const path = primaryPathByUser.get(row.user_id);
    let primarySignedUrl: string | null = null;
    if (path) {
      const policy = photoAccessResolver(row.user_id);
      if (policy === "public_stable") {
        primarySignedUrl = buildPublicPhotoUrl(path, "avatar", null);
      } else {
        primarySignedUrl = await buildSignedPhotoUrl(path);
      }
    }
    byId.set(
      row.user_id,
      buildPeerCardFromSupabase({
        ...row,
        photos: primarySignedUrl ? [primarySignedUrl] : [],
      }),
    );
  }

  return byId;
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
  const app = Fastify({ logger: true });

  app.register(cors, {
    origin: [env.APP_URL, "http://127.0.0.1:3000", "http://localhost:3000"],
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
    persistence: supabaseServiceClient ? "supabase" : "memory",
    timestamp: new Date().toISOString(),
  }));

  app.get("/chat/conversations", async (request, reply) => {
    const userId = resolveAuthenticatedUserId(request, reply);
    if (!userId) {
      return { code: "UNAUTHORIZED" };
    }

    if (supabaseServiceClient) {
      const conversationsResult = await supabaseServiceClient
        .from("chat_conversations")
        .select("*")
        .eq("user_id", userId);

      if (conversationsResult.error) {
        reply.status(500);
        return { code: "CHAT_CONVERSATIONS_READ_FAILED" };
      }

      const peerIds = [...new Set((conversationsResult.data ?? []).map((row) => row.peer_profile_id))].filter(
        (entry): entry is string => typeof entry === "string" && entry.length > 0,
      );
      const peerPolicyById = new Map<string, ImageAccessPolicy>();
      for (const row of conversationsResult.data ?? []) {
        const conversationId = row.conversation_id as string;
        const relationState = normalizeRelationState(row.relation_state);
        const state =
          conversationId.startsWith("match-")
            ? "match_confirmed"
            : relationState === "active"
              ? "conversation_authorized"
              : "pending";
        const policy = resolveImageAccessPolicy("messages", state);
        const existing = peerPolicyById.get(row.peer_profile_id);
        peerPolicyById.set(
          row.peer_profile_id,
          existing === "signed_private" || policy === "signed_private" ? "signed_private" : "public_stable",
        );
      }
      const peerMap = await loadPeerProfiles(peerIds, (profileId) =>
        peerPolicyById.get(profileId) ?? resolveImageAccessPolicy("messages", "pending"),
      );
      let shadowGhostPeerSet = new Set<string>();
      if (peerIds.length > 0) {
        const shadowGhostResult = await supabaseServiceClient
          .from("discover_likes")
          .select("liker_user_id")
          .eq("liked_user_id", userId)
          .eq("hidden_by_shadowghost", true)
          .in("status", ["pending", "matched"])
          .in("liker_user_id", peerIds);
        if (!shadowGhostResult.error) {
          shadowGhostPeerSet = new Set(
            (shadowGhostResult.data ?? [])
              .map((row) => (row as { liker_user_id?: unknown }).liker_user_id)
              .filter((value): value is string => typeof value === "string" && value.length > 0),
          );
        }
      }
      let blockedByMeSet = new Set<string>();
      const blockedResult = await supabaseServiceClient
        .from("safety_blocks")
        .select("blocked_user_id")
        .eq("user_id", userId);
      if (!blockedResult.error) {
        blockedByMeSet = new Set(
          (blockedResult.data ?? [])
            .map((row) => (row as { blocked_user_id?: unknown }).blocked_user_id)
            .filter((value): value is string => typeof value === "string" && value.length > 0),
        );
      }

      const conversations = (conversationsResult.data ?? [])
        .map((row) => {
          const peer = peerMap.get(row.peer_profile_id) ?? null;
          if (!peer) return null;
          const shadowGhostMasked =
            shadowGhostPeerSet.has(row.peer_profile_id) && Boolean(peer.flags.shadowGhost);
          let relationState = normalizeRelationState(row.relation_state);
          if (relationState === "blocked_by_me" && !blockedByMeSet.has(row.peer_profile_id)) {
            relationState = "active";
          }

          return {
            id: row.conversation_id,
            peer: {
              ...peer,
              flags: {
                ...peer.flags,
                shadowGhost: peer.flags.shadowGhost,
              },
            },
            shadowGhostMasked,
            unreadCount: row.unread_count ?? 0,
            lastMessagePreview: row.last_message_preview ?? "",
            lastMessageAtIso: row.last_message_at ?? new Date().toISOString(),
            online: peer.online,
            relationState,
            relationStateUpdatedAtIso: toOptionalString(row.relation_state_updated_at),
            receivedSuperLikeTraceAtIso: toOptionalString(row.received_superlike_trace_at),
          };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item));

      return {
        conversations: sortConversations(conversations),
      };
    }

    return {
      conversations: sortConversations(store.conversations),
    };
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

    if (supabaseServiceClient) {
      if (looksLikeConversationId(requestedProfileId)) {
        const existingByConversationId = await supabaseServiceClient
          .from("chat_conversations")
          .select("conversation_id")
          .eq("user_id", userId)
          .eq("conversation_id", requestedProfileId)
          .maybeSingle();
        if (existingByConversationId.error) {
          reply.status(500);
          return { code: "CHAT_OPEN_FAILED" };
        }
        if (existingByConversationId.data?.conversation_id) {
          return { conversationId: existingByConversationId.data.conversation_id };
        }
      }

      const peerMap = await loadPeerProfiles([requestedProfileId], () =>
        resolveImageAccessPolicy("messages", "pending"),
      );
      const peer = peerMap.get(requestedProfileId) ?? null;
      if (!peer) {
        reply.status(404);
        return { code: "PROFILE_NOT_FOUND", message: "Cannot open conversation for this profile." };
      }

      const nowIso = new Date().toISOString();
      const byPeer = await supabaseServiceClient
        .from("chat_conversations")
        .select("conversation_id")
        .eq("user_id", userId)
        .eq("peer_profile_id", requestedProfileId)
        .order("last_message_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (byPeer.error) {
        reply.status(500);
        return { code: "CHAT_OPEN_FAILED" };
      }

      if (byPeer.data?.conversation_id) {
        return { conversationId: byPeer.data.conversation_id };
      }

      const conversationId = resolveConversationId(userId, requestedProfileId);

      const existingConversation = await supabaseServiceClient
        .from("chat_conversations")
        .select("conversation_id")
        .eq("user_id", userId)
        .eq("conversation_id", conversationId)
        .maybeSingle();

      if (existingConversation.error) {
        reply.status(500);
        return { code: "CHAT_OPEN_FAILED" };
      }

      if (!existingConversation.data) {
        const conversationUpsert = await supabaseServiceClient.from("chat_conversations").upsert(
          {
            user_id: userId,
            conversation_id: conversationId,
            peer_profile_id: requestedProfileId,
            unread_count: 0,
            last_message_preview: parsed.data.fromSuperLike
              ? "This chat started from a SuperLike."
              : "New match. Say hello.",
            last_message_at: nowIso,
            relation_state: "active",
            relation_state_updated_at: nowIso,
            received_superlike_trace_at: parsed.data.fromSuperLike ? nowIso : null,
          },
          { onConflict: "user_id,conversation_id" },
        );

        if (conversationUpsert.error) {
          reply.status(500);
          return { code: "CHAT_OPEN_FAILED" };
        }

        const welcomeInsert = await supabaseServiceClient.from("chat_messages").upsert(
          {
            user_id: userId,
            message_id: `m-${Date.now()}`,
            conversation_id: conversationId,
            sender_user_id: requestedProfileId,
            direction: "incoming",
            original_text: parsed.data.fromSuperLike
              ? "SuperLike landed. Want to chat tonight?"
              : "We matched. Nice to meet you!",
            translated: false,
            created_at: nowIso,
          },
          { onConflict: "user_id,message_id" },
        );

        if (welcomeInsert.error) {
          reply.status(500);
          return { code: "CHAT_OPEN_WELCOME_FAILED" };
        }
      }

      return { conversationId };
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

    if (supabaseServiceClient) {
      const conversationResult = await supabaseServiceClient
        .from("chat_conversations")
        .select("conversation_id")
        .eq("user_id", userId)
        .eq("conversation_id", conversationId)
        .maybeSingle();

      if (conversationResult.error) {
        reply.status(500);
        return { code: "CHAT_MESSAGES_READ_FAILED" };
      }

      if (!conversationResult.data) {
        reply.status(404);
        return { code: "NOT_FOUND", message: "Conversation not found." };
      }

      const messagesResult = await supabaseServiceClient
        .from("chat_messages")
        .select("*")
        .eq("user_id", userId)
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (messagesResult.error) {
        reply.status(500);
        return { code: "CHAT_MESSAGES_READ_FAILED" };
      }

      const translation = getTranslationSetting(userId, conversationId);

      return {
        conversationId,
        translation,
        messages: (messagesResult.data ?? []).map((row) => {
          const translatedText = translation.enabled
            ? toOptionalString(row.translated_text) ?? row.original_text
            : undefined;
          return {
            id: row.message_id,
            conversationId: row.conversation_id,
            senderUserId: row.sender_user_id,
            direction: row.direction,
            originalText: row.original_text,
            translatedText,
            translated: translation.enabled,
            targetLocale: translation.enabled ? translation.targetLocale : undefined,
            createdAtIso: row.created_at,
            readAtIso: toOptionalString(row.read_at),
          };
        }),
      };
    }

    const conversationExists = store.conversations.some((entry) => entry.id === conversationId);
    if (!conversationExists) {
      reply.status(404);
      return { code: "NOT_FOUND", message: "Conversation not found." };
    }

    const translation = getTranslationSetting(userId, conversationId);
    return {
      conversationId,
      translation,
      messages: [...(store.messagesByConversation[conversationId] ?? [])].map((message) =>
        translation.enabled
          ? {
              ...message,
              translated: true,
              translatedText: message.translatedText ?? message.originalText,
              targetLocale: translation.targetLocale,
            }
          : {
              ...message,
              translated: false,
              translatedText: undefined,
              targetLocale: undefined,
            },
      ),
    };
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

    if (supabaseServiceClient) {
      const conversationResult = await supabaseServiceClient
        .from("chat_conversations")
        .select("conversation_id")
        .eq("user_id", userId)
        .eq("conversation_id", conversationId)
        .maybeSingle();

      if (conversationResult.error || !conversationResult.data) {
        reply.status(404);
        return { code: "NOT_FOUND", message: "Conversation not found." };
      }

      const nowIso = new Date().toISOString();
      const [conversationUpdate, messagesUpdate] = await Promise.all([
        supabaseServiceClient
          .from("chat_conversations")
          .update({ unread_count: 0 })
          .eq("user_id", userId)
          .eq("conversation_id", conversationId),
        supabaseServiceClient
          .from("chat_messages")
          .update({ read_at: nowIso })
          .eq("user_id", userId)
          .eq("conversation_id", conversationId)
          .eq("direction", "incoming")
          .is("read_at", null),
      ]);

      if (conversationUpdate.error || messagesUpdate.error) {
        reply.status(500);
        return { code: "CHAT_MARK_READ_FAILED" };
      }

      return { conversationId, markedRead: true };
    }

    const exists = store.conversations.some((entry) => entry.id === conversationId);
    if (!exists) {
      reply.status(404);
      return { code: "NOT_FOUND", message: "Conversation not found." };
    }

    const nowIso = new Date().toISOString();
    store.conversations = store.conversations.map((entry) =>
      entry.id === conversationId
        ? {
            ...entry,
            unreadCount: 0,
          }
        : entry,
    );
    store.messagesByConversation[conversationId] = (store.messagesByConversation[conversationId] ?? []).map(
      (message) =>
        message.direction === "incoming" && !message.readAtIso
          ? { ...message, readAtIso: nowIso }
          : message,
    );

    return { conversationId, markedRead: true };
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

    if (supabaseServiceClient) {
      const conversationResult = await supabaseServiceClient
        .from("chat_conversations")
        .select("*")
        .eq("user_id", userId)
        .eq("conversation_id", conversationId)
        .maybeSingle();

      if (conversationResult.error || !conversationResult.data) {
        reply.status(404);
        return { status: "invalid" as const };
      }

      const relationState = normalizeRelationState(conversationResult.data.relation_state);
      if (relationState !== "active") {
        return { status: relationState };
      }

      const translationSetting = getTranslationSetting(userId, conversationId);

      const message: ChatMessage = {
        id: `m-${Date.now()}`,
        conversationId,
        senderUserId: userId,
        direction: "outgoing",
        originalText: trimmed,
        translated: translationSetting.enabled,
        translatedText: translationSetting.enabled ? trimmed : undefined,
        targetLocale: translationSetting.enabled ? translationSetting.targetLocale : undefined,
        createdAtIso: new Date().toISOString(),
      };

      const [messageInsert, conversationUpdate] = await Promise.all([
        supabaseServiceClient.from("chat_messages").upsert(
          {
            user_id: userId,
            message_id: message.id,
            conversation_id: conversationId,
            sender_user_id: userId,
            direction: "outgoing",
            original_text: trimmed,
            translated: translationSetting.enabled,
            translated_text: translationSetting.enabled ? trimmed : null,
            target_locale: translationSetting.enabled ? translationSetting.targetLocale : null,
            created_at: message.createdAtIso,
          },
          { onConflict: "user_id,message_id" },
        ),
        supabaseServiceClient
          .from("chat_conversations")
          .update({
            unread_count: 0,
            last_message_preview: trimmed,
            last_message_at: message.createdAtIso,
          })
          .eq("user_id", userId)
          .eq("conversation_id", conversationId),
      ]);

      if (messageInsert.error || conversationUpdate.error) {
        reply.status(500);
        return { code: "CHAT_SEND_FAILED" };
      }

      scheduleIncomingReply({
        userId,
        conversationId,
        peerProfileId: conversationResult.data.peer_profile_id,
        userText: trimmed,
      });

      return {
        status: "sent" as const,
        message,
      };
    }

    const conversation = store.conversations.find((entry) => entry.id === conversationId);

    if (!conversation) {
      reply.status(404);
      return { status: "invalid" as const };
    }

    if (conversation.relationState !== "active") {
      return { status: conversation.relationState };
    }

    const translationSetting = getTranslationSetting(userId, conversationId);

    const message: ChatMessage = {
      id: `m-${Date.now()}`,
      conversationId,
      senderUserId: userId,
      direction: "outgoing",
      originalText: trimmed,
      translated: translationSetting.enabled,
      translatedText: translationSetting.enabled ? trimmed : undefined,
      targetLocale: translationSetting.enabled ? translationSetting.targetLocale : undefined,
      createdAtIso: new Date().toISOString(),
    };

    store.messagesByConversation[conversationId] = [
      ...(store.messagesByConversation[conversationId] ?? []),
      message,
    ];

    store.conversations = store.conversations.map((entry) =>
      entry.id === conversationId
        ? {
            ...entry,
            unreadCount: 0,
            lastMessagePreview: trimmed,
            lastMessageAtIso: message.createdAtIso,
          }
        : entry,
    );

    scheduleIncomingReply({
      userId,
      conversationId,
      peerProfileId: conversation.peer.id,
      userText: trimmed,
    });

    return {
      status: "sent" as const,
      message,
    };
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

    if (supabaseServiceClient) {
      const conversationResult = await supabaseServiceClient
        .from("chat_conversations")
        .select("last_message_preview")
        .eq("user_id", userId)
        .eq("conversation_id", conversationId)
        .maybeSingle();

      if (conversationResult.error || !conversationResult.data) {
        reply.status(404);
        return { code: "NOT_FOUND", message: "Conversation not found." };
      }

      const updateResult = await supabaseServiceClient
        .from("chat_conversations")
        .update({
          relation_state: state,
          relation_state_updated_at: updatedAtIso,
          last_message_preview: updateRelationPreview(
            state,
            conversationResult.data.last_message_preview ?? "",
          ),
        })
        .eq("user_id", userId)
        .eq("conversation_id", conversationId);

      if (updateResult.error) {
        reply.status(500);
        return { code: "CHAT_RELATION_UPDATE_FAILED" };
      }

      return {
        conversationId,
        state,
      };
    }

    let found = false;
    store.conversations = store.conversations.map((entry) => {
      if (entry.id !== conversationId) return entry;
      found = true;
      return {
        ...entry,
        relationState: state,
        relationStateUpdatedAtIso: updatedAtIso,
        lastMessagePreview: updateRelationPreview(state, entry.lastMessagePreview),
      };
    });

    if (!found) {
      reply.status(404);
      return { code: "NOT_FOUND", message: "Conversation not found." };
    }

    return {
      conversationId,
      state,
    };
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

    const conversationExists = supabaseServiceClient
      ? await supabaseServiceClient
          .from("chat_conversations")
          .select("conversation_id")
          .eq("user_id", userId)
          .eq("conversation_id", conversationId)
          .maybeSingle()
      : {
          data: store.conversations.find((entry) => entry.id === conversationId)
            ? { conversation_id: conversationId }
            : null,
          error: null,
        };

    if (conversationExists.error) {
      reply.status(500);
      return { code: "CHAT_TRANSLATION_UPDATE_FAILED" };
    }

    if (!conversationExists.data) {
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

