import Fastify from "fastify";
import cors from "@fastify/cors";
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
  state: z.enum(["active", "blocked_by_me", "blocked_me", "unmatched"]),
});

const resolveUserId = (query: Record<string, unknown>) => {
  const candidate = query.userId;
  return typeof candidate === "string" && candidate.trim() ? candidate.trim() : "me";
};

const resolveConversationId = (userId: string, profileId: string) =>
  userId === "me" ? `conv-${profileId}` : `conv-${userId}-${profileId}`;

const toOptionalString = (value: unknown) =>
  typeof value === "string" && value.trim().length > 0 ? value : undefined;

const store = createStore();

export const buildServer = () => {
  const app = Fastify({ logger: true });

  app.register(cors, {
    origin: [env.APP_URL, "http://127.0.0.1:3000", "http://localhost:3000"],
    credentials: true,
  });

  const scheduleIncomingReply = (input: {
    userId: string;
    conversationId: string;
    peerProfileId: string;
  }) => {
    setTimeout(async () => {
      const replyText = "Nice! I will answer soon.";
      const createdAtIso = new Date().toISOString();

      if (supabaseServiceClient) {
        const [messageInsert, conversationUpdate] = await Promise.all([
          supabaseServiceClient.from("chat_messages").upsert(
            {
              user_id: input.userId,
              message_id: `m-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
              conversation_id: input.conversationId,
              sender_user_id: input.peerProfileId,
              direction: "incoming",
              original_text: replyText,
              translated: false,
              created_at: createdAtIso,
            },
            { onConflict: "user_id,message_id" },
          ),
          supabaseServiceClient
            .from("chat_conversations")
            .update({
              unread_count: 1,
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
        translated: false,
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
    if (supabaseServiceClient) {
      const userId = resolveUserId((request.query as Record<string, unknown>) ?? {});
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
            relationState: row.relation_state,
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

    if (supabaseServiceClient) {
      const userId = resolveUserId((request.query as Record<string, unknown>) ?? {});
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

    if (supabaseServiceClient) {
      const userId = resolveUserId((request.query as Record<string, unknown>) ?? {});

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

      return {
        conversationId,
        messages: (messagesResult.data ?? []).map((row) => ({
          id: row.message_id,
          conversationId: row.conversation_id,
          senderUserId: row.sender_user_id,
          direction: row.direction,
          originalText: row.original_text,
          translatedText: toOptionalString(row.translated_text),
          translated: Boolean(row.translated),
          targetLocale: toOptionalString(row.target_locale) as "en" | "ru" | undefined,
          createdAtIso: row.created_at,
          readAtIso: toOptionalString(row.read_at),
        })),
      };
    }

    const conversationExists = store.conversations.some((entry) => entry.id === conversationId);
    if (!conversationExists) {
      reply.status(404);
      return { code: "NOT_FOUND", message: "Conversation not found." };
    }

    return {
      conversationId,
      messages: [...(store.messagesByConversation[conversationId] ?? [])],
    };
  });

  app.post("/chat/messages", async (request, reply) => {
    const parsed = sendMessageSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.status(400);
      return { code: "INVALID_PAYLOAD", message: "Invalid send message payload." };
    }

    const userId = resolveUserId((request.query as Record<string, unknown>) ?? {});
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

      if (conversationResult.data.relation_state !== "active") {
        return { status: conversationResult.data.relation_state };
      }

      const message: ChatMessage = {
        id: `m-${Date.now()}`,
        conversationId,
        senderUserId: userId,
        direction: "outgoing",
        originalText: trimmed,
        translated: false,
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
            translated: false,
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

    const message: ChatMessage = {
      id: `m-${Date.now()}`,
      conversationId,
      senderUserId: "me",
      direction: "outgoing",
      originalText: trimmed,
      translated: false,
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

    const userId = resolveUserId((request.query as Record<string, unknown>) ?? {});
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

  return app;
};
