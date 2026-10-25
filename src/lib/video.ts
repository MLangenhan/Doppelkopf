import type { RealtimeChannel } from '@supabase/supabase-js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';

// ---------------------------------------------------------------------------
// Eigene Kamera
// ---------------------------------------------------------------------------

export type CameraState = 'off' | 'starting' | 'on' | 'denied' | 'unavailable';

export function useCamera() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [state, setState] = useState<CameraState>('off');
  const [enabled, setEnabled] = useState(true);
  const streamRef = useRef<MediaStream | null>(null);

  const start = useCallback(async () => {
    if (streamRef.current) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setState('unavailable');
      return;
    }
    setState('starting');
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24, max: 30 }, facingMode: 'user' },
        audio: false,
      });
      streamRef.current = s;
      setStream(s);
      setState('on');
      setEnabled(true);
    } catch (e) {
      const name = (e as DOMException).name;
      setState(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'unavailable');
    }
  }, []);

  /** Kamera aus/an, ohne die Verbindung zu den anderen neu aufzubauen. */
  const toggle = useCallback(() => {
    const s = streamRef.current;
    if (!s) {
      start();
      return;
    }
    const next = !s.getVideoTracks().some((t) => t.enabled);
    s.getVideoTracks().forEach((t) => (t.enabled = next));
    setEnabled(next);
  }, [start]);

  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    },
    [],
  );

  return { stream, state, enabled: state === 'on' && enabled, start, toggle };
}

// ---------------------------------------------------------------------------
// Mesh: jede/r schickt das eigene Bild direkt an alle anderen (WebRTC, P2P)
// Signalisierung über einen Supabase-Realtime-Broadcast-Kanal pro Tisch.
// ---------------------------------------------------------------------------

function iceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
  const turnUrl = import.meta.env.VITE_TURN_URL as string | undefined;
  if (turnUrl) {
    servers.push({
      urls: turnUrl.split(',').map((u) => u.trim()),
      username: import.meta.env.VITE_TURN_USERNAME as string | undefined,
      credential: import.meta.env.VITE_TURN_CREDENTIAL as string | undefined,
    });
  }
  return servers;
}

interface Signal {
  from: string;
  fromSession: string;
  to: string;
  toSession: string;
  description?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

interface Peer {
  userId: string;
  session: string;
  pc: RTCPeerConnection;
  polite: boolean;
  makingOffer: boolean;
  ignoreOffer: boolean;
  senders: RTCRtpSender[];
}

export type PeerStatus = 'connecting' | 'connected' | 'failed';

export interface RemoteVideo {
  stream: MediaStream | null;
  status: PeerStatus;
}

export function useVideoMesh(tableId: string | undefined, me: string | null, localStream: MediaStream | null) {
  const [remotes, setRemotes] = useState<Record<string, RemoteVideo>>({});
  const [online, setOnline] = useState<string[]>([]);
  const peers = useRef(new Map<string, Peer>());
  const localRef = useRef<MediaStream | null>(localStream);
  const sessionId = useRef(crypto.randomUUID());
  const channelRef = useRef<RealtimeChannel | null>(null);

  const setRemote = useCallback((userId: string, patch: Partial<RemoteVideo> | null) => {
    setRemotes((cur) => {
      if (patch === null) {
        const { [userId]: _removed, ...rest } = cur;
        return rest;
      }
      const base: RemoteVideo = cur[userId] ?? { stream: null, status: 'connecting' };
      return { ...cur, [userId]: { ...base, ...patch } };
    });
  }, []);

  useEffect(() => {
    if (!tableId || !me) return;
    const mySession = sessionId.current;
    const peerMap = peers.current;

    const send = (payload: Omit<Signal, 'from' | 'fromSession'>) => {
      channelRef.current?.send({
        type: 'broadcast',
        event: 'signal',
        payload: { ...payload, from: me, fromSession: mySession },
      });
    };

    const closePeer = (userId: string) => {
      const p = peerMap.get(userId);
      if (!p) return;
      p.pc.close();
      peerMap.delete(userId);
      setRemote(userId, null);
    };

    const addLocalTracks = (p: Peer) => {
      const s = localRef.current;
      if (!s) return;
      for (const track of s.getTracks()) {
        if (!p.senders.some((sender) => sender.track === track)) p.senders.push(p.pc.addTrack(track, s));
      }
    };

    const createPeer = (userId: string, session: string): Peer => {
      const pc = new RTCPeerConnection({ iceServers: iceServers() });
      const p: Peer = { userId, session, pc, polite: me > userId, makingOffer: false, ignoreOffer: false, senders: [] };
      peerMap.set(userId, p);
      setRemote(userId, { status: 'connecting', stream: null });

      // Immer ein Video empfangen können, auch wenn wir selbst keine Kamera haben
      pc.addTransceiver('video', { direction: 'recvonly' });

      pc.onnegotiationneeded = async () => {
        try {
          p.makingOffer = true;
          await pc.setLocalDescription();
          send({ to: userId, toSession: p.session, description: pc.localDescription!.toJSON() });
        } catch (e) {
          console.warn('Verhandlung fehlgeschlagen', e);
        } finally {
          p.makingOffer = false;
        }
      };
      pc.onicecandidate = ({ candidate }) => {
        if (candidate) send({ to: userId, toSession: p.session, candidate: candidate.toJSON() });
      };
      pc.ontrack = ({ track, streams }) => {
        const stream = streams[0] ?? new MediaStream([track]);
        setRemote(userId, { stream });
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') setRemote(userId, { status: 'connected' });
        if (pc.connectionState === 'failed') {
          setRemote(userId, { status: 'failed' });
          pc.restartIce();
        }
      };
      addLocalTracks(p);
      return p;
    };

    const ensurePeer = (userId: string, session: string) => {
      const existing = peerMap.get(userId);
      if (existing && existing.session === session) return existing;
      if (existing) closePeer(userId);
      return createPeer(userId, session);
    };

    const onSignal = async (sig: Signal) => {
      if (sig.to !== me || sig.toSession !== mySession || sig.from === me) return;
      const p = ensurePeer(sig.from, sig.fromSession);
      const pc = p.pc;
      try {
        if (sig.description) {
          const collision = sig.description.type === 'offer' && (p.makingOffer || pc.signalingState !== 'stable');
          p.ignoreOffer = !p.polite && collision;
          if (p.ignoreOffer) return;
          await pc.setRemoteDescription(sig.description);
          if (sig.description.type === 'offer') {
            await pc.setLocalDescription();
            send({ to: sig.from, toSession: sig.fromSession, description: pc.localDescription!.toJSON() });
          }
        } else if (sig.candidate) {
          try {
            await pc.addIceCandidate(sig.candidate);
          } catch (e) {
            if (!p.ignoreOffer) console.warn('ICE-Kandidat abgelehnt', e);
          }
        }
      } catch (e) {
        console.warn('Signal-Fehler', e);
      }
    };

    const channel = supabase.channel(`rtc:${tableId}`, {
      config: { broadcast: { self: false }, presence: { key: `${me}:${mySession}` } },
    });
    channelRef.current = channel;

    channel
      .on('broadcast', { event: 'signal' }, ({ payload }) => onSignal(payload as Signal))
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<{ user: string; session: string }>();
        const present = new Map<string, string>();
        for (const metas of Object.values(state)) {
          for (const m of metas) if (m.user !== me) present.set(m.user, m.session);
        }
        setOnline([...present.keys()]);
        // Neue Peers: der "unhöfliche" (kleinere ID) startet die Verbindung, damit nicht beide gleichzeitig anbieten
        for (const [userId, session] of present) {
          const existing = peerMap.get(userId);
          if (existing && existing.session === session) continue;
          if (me < userId || existing) ensurePeer(userId, session);
        }
        for (const userId of [...peerMap.keys()]) if (!present.has(userId)) closePeer(userId);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') await channel.track({ user: me, session: mySession });
      });

    return () => {
      for (const userId of [...peerMap.keys()]) closePeer(userId);
      supabase.removeChannel(channel);
      channelRef.current = null;
      setOnline([]);
    };
  }, [tableId, me, setRemote]);

  // Kamera kommt später dazu → an alle bestehenden Verbindungen anhängen
  useEffect(() => {
    localRef.current = localStream;
    if (!localStream) return;
    for (const p of peers.current.values()) {
      for (const track of localStream.getTracks()) {
        if (!p.senders.some((s) => s.track === track)) p.senders.push(p.pc.addTrack(track, localStream));
      }
    }
  }, [localStream]);

  return { remotes, online };
}
