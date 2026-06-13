// Realtime WebSocket client for chat (live messages, typing, presence) and
// WebRTC signaling transport. Single shared connection with auto-reconnect and
// a keepalive ping. Auth token is passed as a query param (browsers can't set
// WebSocket headers).
import { authApi } from './authApi';

const CHAT_API_URL = (import.meta.env.VITE_CHAT_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';

export type RealtimeEvent =
  | { type: 'ready'; userId: string }
  | { type: 'message'; conversationId: string; message: Record<string, unknown> }
  | { type: 'typing'; conversationId: string; fromUserId: string; isTyping: boolean }
  | { type: 'presence'; userId: string; online: boolean }
  | { type: 'webrtc'; signal: 'offer' | 'answer' | 'ice' | 'hangup'; fromUserId: string; conversationId: string; data?: unknown }
  | { type: 'pong' }
  | { type: 'error'; code: string };

type Handler = (event: RealtimeEvent) => void;

let ws: WebSocket | null = null;
const handlers = new Set<Handler>();
let reconnectAttempts = 0;
let pingTimer: number | null = null;
let manuallyClosed = false;

const buildWsUrl = (token: string): string => {
  const base = CHAT_API_URL || window.location.origin;
  const url = new URL('/chat/ws', base);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.searchParams.set('token', token);
  return url.toString();
};

const ensureToken = async (): Promise<string | null> => {
  const session = await authApi.getSession().catch(() => null);
  if (session?.ok && session.data?.token) return session.data.token;
  const refresh = await authApi.refreshInternalToken().catch(() => null);
  return refresh?.ok && refresh.data?.token ? refresh.data.token : null;
};

const stopPing = () => {
  if (pingTimer !== null) {
    window.clearInterval(pingTimer);
    pingTimer = null;
  }
};

const startPing = () => {
  stopPing();
  pingTimer = window.setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'ping' }));
    }
  }, 25_000);
};

const emit = (event: RealtimeEvent) => {
  handlers.forEach((handler) => {
    try {
      handler(event);
    } catch {
      /* a bad handler must not break the others */
    }
  });
};

export const realtime = {
  async connect(): Promise<void> {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
    manuallyClosed = false;
    const token = await ensureToken();
    if (!token) return;

    try {
      ws = new WebSocket(buildWsUrl(token));
    } catch {
      return;
    }

    ws.onopen = () => {
      reconnectAttempts = 0;
      startPing();
    };
    ws.onmessage = (ev) => {
      let data: RealtimeEvent;
      try {
        data = JSON.parse(ev.data as string);
      } catch {
        return;
      }
      emit(data);
    };
    ws.onclose = () => {
      stopPing();
      ws = null;
      if (!manuallyClosed) {
        reconnectAttempts += 1;
        const delay = Math.min(30_000, 1_000 * 2 ** Math.min(reconnectAttempts, 5));
        window.setTimeout(() => {
          void realtime.connect();
        }, delay);
      }
    };
    ws.onerror = () => {
      try {
        ws?.close();
      } catch {
        /* ignore */
      }
    };
  },

  disconnect(): void {
    manuallyClosed = true;
    stopPing();
    try {
      ws?.close();
    } catch {
      /* ignore */
    }
    ws = null;
  },

  isConnected(): boolean {
    return Boolean(ws && ws.readyState === WebSocket.OPEN);
  },

  /** Subscribe to realtime events. Returns an unsubscribe function. */
  on(handler: Handler): () => void {
    handlers.add(handler);
    return () => handlers.delete(handler);
  },

  sendTyping(conversationId: string, peerUserId: string, isTyping: boolean): void {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'typing', conversationId, peerUserId, isTyping }));
    }
  },

  sendWebrtc(
    signal: 'offer' | 'answer' | 'ice' | 'hangup',
    toUserId: string,
    conversationId: string,
    data?: unknown,
  ): void {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'webrtc', signal, toUserId, conversationId, data }));
    }
  },
};
