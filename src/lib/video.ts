import type { RealtimeChannel } from '@supabase/supabase-js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { setPref } from './prefs';
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
  const enabledRef = useRef(true);
  const alive = useRef(true);
  // Merkt sich, ob wir die Kamera neu holen müssen, sobald der Tab wieder sichtbar ist
  const lost = useRef(false);

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
      if (!alive.current) {
        s.getTracks().forEach((t) => t.stop());
        return;
      }
      lost.current = false;
      s.getVideoTracks().forEach((t) => {
        t.enabled = enabledRef.current;
        // Handys beenden die Kamera gern, wenn man die App verlässt: dann still neu holen
        t.addEventListener('ended', () => {
          if (streamRef.current !== s) return;
          streamRef.current = null;
          lost.current = true;
          setState('off');
          if (document.visibilityState === 'visible') void start();
        });
      });
      streamRef.current = s;
      setStream(s);
      setState('on');
      setPref('camera', true);
    } catch (e) {
      const name = (e as DOMException).name;
      setState(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'unavailable');
    }
  }, []);

  /** Kamera aus/an, ohne die Verbindung zu den anderen neu aufzubauen. */
  const toggle = useCallback(() => {
    const s = streamRef.current;
    if (!s) {
      enabledRef.current = true;
      setEnabled(true);
      start();
      return;
    }
    const next = !s.getVideoTracks().some((t) => t.enabled);
    s.getVideoTracks().forEach((t) => (t.enabled = next));
    enabledRef.current = next;
    setEnabled(next);
    setPref('camera', next);
  }, [start]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const s = streamRef.current;
      if (s && s.getVideoTracks().every((t) => t.readyState === 'ended')) {
        streamRef.current = null;
        lost.current = true;
      }
      if (lost.current) void start();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', onVisible);
    };
  }, [start]);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

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
  /** Timer: nach kurzem Verbindungsabbruch ICE neu starten */
  iceTimer?: ReturnType<typeof setTimeout>;
}

/** So lange bleibt eine Verbindung bestehen, wenn jemand kurz aus der Anwesenheit fällt (Tab-Wechsel, Funkloch). */
const LEAVE_GRACE_MS = 30_000;

export type PeerStatus = 'connecting' | 'connected' | 'failed';

export interface RemoteVideo {
  stream: MediaStream | null;
  status: PeerStatus;
}

/** Eigene Spuren senden: vorhandene Sender bekommen die neue Spur (ohne Neuverhandlung), sonst addTrack. */
function attachTracks(p: Peer, stream: MediaStream | null) {
  if (!stream || p.pc.signalingState === 'closed') return;
  for (const track of stream.getTracks()) {
    if (p.senders.some((sender) => sender.track === track)) continue;
    const reuse = p.senders.find((sender) => !sender.track || sender.track.kind === track.kind);
    if (reuse) void reuse.replaceTrack(track).catch((e) => console.warn('Spur ersetzen fehlgeschlagen', e));
    else p.senders.push(p.pc.addTrack(track, stream));
  }
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

    const leaveTimers = new Map<string, ReturnType<typeof setTimeout>>();
    const closePeer = (userId: string) => {
      clearTimeout(leaveTimers.get(userId));
      leaveTimers.delete(userId);
      const p = peerMap.get(userId);
      if (!p) return;
      clearTimeout(p.iceTimer);
      p.pc.close();
      peerMap.delete(userId);
      setRemote(userId, null);
    };

    const addLocalTracks = (p: Peer) => attachTracks(p, localRef.current);

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
        clearTimeout(p.iceTimer);
        if (pc.connectionState === 'connected') setRemote(userId, { status: 'connected' });
        if (pc.connectionState === 'failed') {
          setRemote(userId, { status: 'failed' });
          pc.restartIce();
        }
        // "disconnected" erholt sich oft von selbst; wenn nicht, nach kurzer Zeit neu verhandeln
        if (pc.connectionState === 'disconnected') {
          p.iceTimer = setTimeout(() => {
            if (pc.connectionState === 'disconnected') pc.restartIce();
          }, 4000);
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
          clearTimeout(leaveTimers.get(userId));
          leaveTimers.delete(userId);
          const existing = peerMap.get(userId);
          if (existing && existing.session === session) continue;
          if (me < userId || existing) ensurePeer(userId, session);
        }
        // Wer verschwindet, bekommt eine Schonfrist: Die Verbindung läuft oft direkt weiter
        for (const userId of [...peerMap.keys()]) {
          if (present.has(userId) || leaveTimers.has(userId)) continue;
          const p = peerMap.get(userId)!;
          if (p.pc.connectionState === 'connected') {
            leaveTimers.set(userId, setTimeout(() => closePeer(userId), LEAVE_GRACE_MS));
          } else closePeer(userId);
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') await channel.track({ user: me, session: mySession });
      });

    // Zurück im Tab: Anwesenheit auffrischen und hängende Verbindungen neu anstoßen
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      void channel.track({ user: me, session: mySession });
      for (const p of peerMap.values()) {
        if (p.pc.connectionState === 'failed' || p.pc.connectionState === 'disconnected') p.pc.restartIce();
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      for (const userId of [...peerMap.keys()]) closePeer(userId);
      supabase.removeChannel(channel);
      channelRef.current = null;
      setOnline([]);
    };
  }, [tableId, me, setRemote]);

  // Kamera kommt später dazu oder wurde neu geholt → an alle bestehenden Verbindungen hängen
  useEffect(() => {
    localRef.current = localStream;
    if (!localStream) return;
    for (const p of peers.current.values()) attachTracks(p, localStream);
  }, [localStream]);

  return { remotes, online };
}
