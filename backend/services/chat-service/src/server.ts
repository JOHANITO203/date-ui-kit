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

const toOptionalString = (value: unknown) =>
  typeof value === "string" && value.trim().length > 0 ? value : undefined;

const toTranslationMapKey = (userId: string, conversationId: string) =>
  `${userId}:${conversationId}`;

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

  const scheduleIncomingReply = (input: {
    userId: string;
    conversationId: string;
    peerProfileId: string;
  }) => {
    setTimeout(async () => {
      const replyText = "Nice! I will answer soon.";
      const createdAtIso = new Date().toISOString();
      const translationSetting = getTranslationSetting(input.userId, input.conversationId);

      if (supabaseServiceClient) {
        const unreadSnapshot = await supabaseServiceClient
          .from("chat_conversations")
          .select("unread_count")
          .eq("user_id", input.userId)
          .eq("conversation_id", input.conversationId)
          .maybeSingle();

        const nextUnreadCount = Math.max(
          1,
          Number(unreadSnapshot.data?.unread_count ?? 0) + 1,
        );

        const [messageInsert, conversationUpdate] = await Promise.all([
          supabaseServiceClient.from("chat_messages").upsert(
            {
              user_id: input.userId,
              message_id: `m-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
              conversation_id: input.conversationId,
              sender_user_id: input.peerProfileId,
              direction: "incoming",
              original_text: replyText,
              translated: translationSetting.enabled,
              translated_text: translationSetting.enabled ? replyText : null,
              target_locale: translationSetting.enabled ? translationSetting.targetLocale : null,
              created_at: createdAtIso,
            },
            { onConflict: "user_id,message_id" },
          ),
          supabaseServiceClient
            .from("chat_conversations")
            .update({
              unread_count: nextUnreadCount,
              last_message_preview: replyText,
              last_message_at: createdAtIso,
            })
            .eq("user_id", input.userId)
            .eq("conversation_id", input.conversationId),
        ]);

        if (messageInsert.error || conversationUpdate.error) {
          app.log.warn(
            { conversationId: input.conversationId },
            "chat_auto_reply_supabase_failed",
          );
        }

        return;
      }

      const incoming: ChatMessage = {
        id: `m-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        conversationId: input.conversationId,
        senderUserId: input.peerProfileId,
        direction: "incoming",
        originalText: replyText,
        translated: translationSetting.enabled,
        translatedText: translationSetting.enabled ? replyText : undefined,
        targetLocale: translationSetting.enabled ? translationSetting.targetLocale : undefined,
        createdAtIso,
      };

      store.messagesByConversation[input.conversationId] = [
        ...(store.messagesByConversation[input.conversationId] ?? []),
        incoming,
      ];

      store.conversations = store.conversations.map((entry) =>
        entry.id === input.conversationId
          ? {
              ...entry,
              unreadCount: Math.max(1, entry.unreadCount + 1),
              lastMessagePreview: replyText,
              lastMessageAtIso: createdAtIso,
            }
          : entry,
      );
    }, 1200);
  };

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

      const conversations = (conversationsResult.data ?? [])
        .map((row) => {
          const peer = getProfileById(row.peer_profile_id);
          if (!peer) return null;

          return {
            id: row.conversation_id,
            peer,
            unreadCount: row.unread_count ?? 0,
            lastMessagePreview: row.last_message_preview ?? "",
            lastMessageAtIso: row.last_message_at ?? new Date().toISOString(),
            online: peer.online,
            relationState: normalizeRelationState(row.relation_state),
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

    if (supabaseServiceClient) {
      const peer = getProfileById(parsed.data.profileId);
      if (!peer) {
        reply.status(404);
        return { code: "PROFILE_NOT_FOUND", message: "Cannot open conversation for this profile." };
      }

      const conversationId = resolveConversationId(userId, parsed.data.profileId);
      const nowIso = new Date().toISOString();

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
            peer_profile_id: parsed.data.profileId,
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
            sender_user_id: parsed.data.profileId,
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
      parsed.data.profileId,
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
