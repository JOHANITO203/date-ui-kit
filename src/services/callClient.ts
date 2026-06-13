// WebRTC audio/video call client. Uses the realtime WebSocket as the signaling
// transport (offer/answer/ICE relay). This is the call CORE — a full call UI
// (incoming-call modal, <video> surfaces, mute/hangup controls) wires on top via
// the callbacks below.
//
// Production note: NAT traversal needs a TURN server for many networks. Set
// VITE_TURN_URL / VITE_TURN_USERNAME / VITE_TURN_CREDENTIAL to add one; STUN
// alone (the default) only works on permissive networks.
import { realtime } from './realtimeClient';

const STUN_URLS = ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'];

const iceServers = (): RTCIceServer[] => {
  const servers: RTCIceServer[] = [{ urls: STUN_URLS }];
  const turnUrl = import.meta.env.VITE_TURN_URL as string | undefined;
  if (turnUrl) {
    servers.push({
      urls: turnUrl,
      username: (import.meta.env.VITE_TURN_USERNAME as string | undefined) ?? undefined,
      credential: (import.meta.env.VITE_TURN_CREDENTIAL as string | undefined) ?? undefined,
    });
  }
  return servers;
};

export type CallState = 'idle' | 'calling' | 'ringing' | 'connected' | 'ended';

export type CallCallbacks = {
  onState?: (state: CallState) => void;
  onLocalStream?: (stream: MediaStream) => void;
  onRemoteStream?: (stream: MediaStream) => void;
  onIncoming?: (peerUserId: string, conversationId: string, withVideo: boolean) => void;
};

type Session = {
  pc: RTCPeerConnection;
  peerUserId: string;
  conversationId: string;
  localStream: MediaStream | null;
};

let session: Session | null = null;
let callbacks: CallCallbacks = {};
let signalingUnsub: (() => void) | null = null;

const setState = (state: CallState) => callbacks.onState?.(state);

const teardown = () => {
  if (session) {
    try {
      session.localStream?.getTracks().forEach((t) => t.stop());
      session.pc.close();
    } catch {
      /* ignore */
    }
  }
  session = null;
};

const createPeer = (peerUserId: string, conversationId: string): RTCPeerConnection => {
  const pc = new RTCPeerConnection({ iceServers: iceServers() });
  pc.onicecandidate = (e) => {
    if (e.candidate) realtime.sendWebrtc('ice', peerUserId, conversationId, e.candidate.toJSON());
  };
  pc.ontrack = (e) => {
    if (e.streams[0]) callbacks.onRemoteStream?.(e.streams[0]);
  };
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'connected') setState('connected');
    if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
      setState('ended');
      teardown();
    }
  };
  return pc;
};

const getMedia = async (withVideo: boolean): Promise<MediaStream> =>
  navigator.mediaDevices.getUserMedia({ audio: true, video: withVideo });

/** Install the global signaling listener. Call once after auth (e.g. in AppShell). */
export const initCallSignaling = (cbs: CallCallbacks): (() => void) => {
  callbacks = cbs;
  signalingUnsub?.();
  signalingUnsub = realtime.on(async (event) => {
    if (event.type !== 'webrtc') return;
    const { signal, fromUserId, conversationId, data } = event;

    if (signal === 'offer') {
      // Surface the incoming call; the UI decides whether to accept.
      callbacks.onIncoming?.(fromUserId, conversationId, Boolean((data as { video?: boolean })?.video));
      setState('ringing');
      // Stash the offer for acceptCall().
      pendingOffer = { fromUserId, conversationId, sdp: (data as { sdp?: RTCSessionDescriptionInit })?.sdp };
      return;
    }
    if (!session) return;
    if (signal === 'answer' && data) {
      await session.pc.setRemoteDescription(new RTCSessionDescription((data as { sdp: RTCSessionDescriptionInit }).sdp));
    } else if (signal === 'ice' && data) {
      try {
        await session.pc.addIceCandidate(new RTCIceCandidate(data as RTCIceCandidateInit));
      } catch {
        /* ignore late candidate */
      }
    } else if (signal === 'hangup') {
      setState('ended');
      teardown();
    }
  });
  return () => {
    signalingUnsub?.();
    signalingUnsub = null;
  };
};

let pendingOffer: { fromUserId: string; conversationId: string; sdp?: RTCSessionDescriptionInit } | null = null;

/** Start an outgoing call. */
export const startCall = async (peerUserId: string, conversationId: string, withVideo = true): Promise<void> => {
  teardown();
  setState('calling');
  const pc = createPeer(peerUserId, conversationId);
  const localStream = await getMedia(withVideo);
  callbacks.onLocalStream?.(localStream);
  localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
  session = { pc, peerUserId, conversationId, localStream };

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  realtime.sendWebrtc('offer', peerUserId, conversationId, { sdp: offer, video: withVideo });
};

/** Accept the most recent incoming call. */
export const acceptCall = async (withVideo = true): Promise<void> => {
  if (!pendingOffer?.sdp) return;
  const { fromUserId, conversationId, sdp } = pendingOffer;
  const pc = createPeer(fromUserId, conversationId);
  const localStream = await getMedia(withVideo);
  callbacks.onLocalStream?.(localStream);
  localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
  session = { pc, peerUserId: fromUserId, conversationId, localStream };

  await pc.setRemoteDescription(new RTCSessionDescription(sdp));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  realtime.sendWebrtc('answer', fromUserId, conversationId, { sdp: answer });
  pendingOffer = null;
};

/** End the current call (and tell the peer). */
export const endCall = (): void => {
  if (session) realtime.sendWebrtc('hangup', session.peerUserId, session.conversationId);
  pendingOffer = null;
  setState('ended');
  teardown();
};
