import { useCallback, useEffect, useRef, useState } from 'react';
import type { Member, Signal } from '../../shared/protocol.ts';
import { api } from './api.ts';
import { createSocket, type AppSocket } from './socket.ts';

export type RoomStatus = 'connecting' | 'live' | 'reconnecting' | 'full' | 'elsewhere' | 'error';
/** The mic is only requested the first time you unmute, so listeners never see a permission prompt. */
export type MicState = 'idle' | 'pending' | 'ready' | 'denied';

interface Peer {
  pc: RTCPeerConnection;
  audio: HTMLAudioElement;
  pendingCandidates: RTCIceCandidateInit[];
}

const MIC_CONSTRAINTS: MediaStreamConstraints = {
  audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
};

export function useAudioRoom(roomId: string) {
  const [status, setStatus] = useState<RoomStatus>('connecting');
  const [micState, setMicState] = useState<MicState>('idle');
  const [members, setMembers] = useState<Member[]>([]);
  const [selfId, setSelfId] = useState<string | null>(null);
  const [hostId, setHostId] = useState<string | null>(null);
  const [streams, setStreams] = useState<Record<string, MediaStream>>({});
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const socketRef = useRef<AppSocket | null>(null);
  const micRef = useRef<MediaStreamTrack | null>(null);
  const selfIdRef = useRef<string | null>(null);
  const peersRef = useRef(new Map<string, Peer>());

  useEffect(() => {
    let cancelled = false;
    const peers = peersRef.current;

    function closePeer(id: string) {
      const peer = peers.get(id);
      if (!peer) return;
      peer.pc.close();
      peer.audio.srcObject = null;
      peers.delete(id);
      setStreams(({ [id]: _, ...rest }) => rest);
    }

    function closeAllPeers() {
      [...peers.keys()].forEach(closePeer);
    }

    async function start() {
      const iceServers = await api.get<RTCIceServer[]>('/api/ice-servers').catch(() => []);
      if (cancelled) return;

      const socket = createSocket();
      socketRef.current = socket;

      const signal = (to: string, payload: Signal) => socket.emit('signal', { to, ...payload });

      function createPeer(id: string): Peer {
        const pc = new RTCPeerConnection({ iceServers });
        const audio = new Audio();
        audio.autoplay = true;
        const peer: Peer = { pc, audio, pendingCandidates: [] };
        peers.set(id, peer);

        pc.onicecandidate = e => {
          if (e.candidate) signal(id, { candidate: e.candidate.toJSON() });
        };

        pc.ontrack = e => {
          const stream = e.streams[0] ?? new MediaStream([e.track]);
          audio.srcObject = stream;
          audio.play().catch(() => setAudioBlocked(true));
          setStreams(prev => ({ ...prev, [id]: stream }));
        };

        return peer;
      }

      async function setRemote(peer: Peer, description: RTCSessionDescriptionInit) {
        await peer.pc.setRemoteDescription(description);
        for (const candidate of peer.pendingCandidates.splice(0)) {
          await peer.pc.addIceCandidate(candidate).catch(console.warn);
        }
      }

      socket.on('connect', () => {
        setStatus(prev => (prev === 'full' ? prev : 'connecting'));
        socket.emit('join', { roomId, muted: !micRef.current?.enabled });
      });

      socket.on('connect_error', err => {
        if (err.message === 'unauthorized') {
          setStatus('error');
          socket.disconnect();
        }
      });

      socket.on('disconnect', reason => {
        closeAllPeers();
        setMembers([]);
        if (reason !== 'io client disconnect') setStatus('reconnecting');
      });

      socket.on('room full', () => {
        setStatus('full');
        socket.disconnect();
      });

      // You opened this room in another tab or device; this one steps aside.
      socket.on('joined elsewhere', () => {
        setStatus('elsewhere');
        socket.disconnect();
        micRef.current?.stop();
        micRef.current = null;
        setMicState('idle');
      });

      // We just joined: the newcomer calls everyone who was already here.
      socket.on('joined', async ({ selfId, hostId, members }) => {
        selfIdRef.current = selfId;
        setSelfId(selfId);
        setHostId(hostId);
        setMembers(members);
        setStatus('live');
        const mic = micRef.current;
        if (mic) setStreams(prev => ({ ...prev, [selfId]: new MediaStream([mic]) }));

        for (const member of members) {
          if (member.id === selfId) continue;
          const peer = createPeer(member.id);
          // A send/receive slot from the start lets us add the mic later without renegotiating.
          const transceiver = peer.pc.addTransceiver('audio', { direction: 'sendrecv' });
          if (mic) await transceiver.sender.replaceTrack(mic);
          await peer.pc.setLocalDescription(await peer.pc.createOffer());
          signal(member.id, { description: peer.pc.localDescription!.toJSON() });
        }
      });

      socket.on('member joined', member => {
        setMembers(prev => [...prev.filter(m => m.id !== member.id), member]);
      });

      socket.on('member left', id => {
        closePeer(id);
        setMembers(prev => prev.filter(m => m.id !== id));
      });

      socket.on('member muted', ({ id, muted }) => {
        setMembers(prev => prev.map(m => (m.id === id ? { ...m, muted } : m)));
      });

      socket.on('host changed', setHostId);

      socket.on('force muted', () => {
        if (micRef.current) micRef.current.enabled = false;
        socket.emit('set muted', true);
        setNotice('The host muted you.');
      });

      socket.on('signal', async ({ from, description, candidate }) => {
        try {
          let peer = peers.get(from);
          if (description?.type === 'offer') {
            peer ??= createPeer(from);
            await setRemote(peer, description);
            // Answer on the offered audio slot so we can send on it too.
            const transceiver = peer.pc.getTransceivers()[0];
            if (transceiver) {
              transceiver.direction = 'sendrecv';
              if (micRef.current) await transceiver.sender.replaceTrack(micRef.current);
            }
            await peer.pc.setLocalDescription(await peer.pc.createAnswer());
            signal(from, { description: peer.pc.localDescription!.toJSON() });
          } else if (description && peer) {
            await setRemote(peer, description);
          } else if (candidate && peer) {
            if (peer.pc.remoteDescription) await peer.pc.addIceCandidate(candidate);
            else peer.pendingCandidates.push(candidate);
          }
        } catch (err) {
          console.warn('Signalling error with', from, err);
        }
      });
    }

    start().catch(err => {
      console.error(err);
      if (!cancelled) setStatus('error');
    });

    return () => {
      cancelled = true;
      socketRef.current?.disconnect();
      socketRef.current = null;
      closeAllPeers();
      micRef.current?.stop();
      micRef.current = null;
    };
  }, [roomId]);

  /** Asks for the mic once, then shares it with every current peer. */
  const acquireMic = useCallback(async (): Promise<MediaStreamTrack | null> => {
    if (micRef.current) return micRef.current;
    setMicState('pending');
    try {
      const stream = await navigator.mediaDevices.getUserMedia(MIC_CONSTRAINTS);
      const track = stream.getAudioTracks()[0];
      if (!socketRef.current) {
        track.stop(); // left the room while the prompt was open
        return null;
      }
      micRef.current = track;
      await Promise.all(
        [...peersRef.current.values()].map(({ pc }) => pc.getTransceivers()[0]?.sender.replaceTrack(track)),
      );
      const id = selfIdRef.current;
      if (id) setStreams(prev => ({ ...prev, [id]: stream }));
      setMicState('ready');
      return track;
    } catch (err) {
      console.warn('Microphone unavailable', err);
      setMicState('denied');
      setNotice('Microphone access was blocked. Allow it in your browser settings to speak.');
      return null;
    }
  }, []);

  const setMuted = useCallback(async (muted: boolean) => {
    const track = muted ? micRef.current : await acquireMic();
    if (!track) return;
    track.enabled = !muted;
    socketRef.current?.emit('set muted', muted);
    if (!muted) setNotice(null);
  }, [acquireMic]);

  const muteMember = useCallback((id: string) => {
    socketRef.current?.emit('host mute', id);
  }, []);

  const unlockAudio = useCallback(() => {
    peersRef.current.forEach(peer => peer.audio.play().catch(() => {}));
    setAudioBlocked(false);
  }, []);

  const self = members.find(m => m.id === selfId);

  return {
    status,
    micState,
    members,
    selfId,
    hostId,
    isHost: selfId !== null && selfId === hostId,
    muted: self?.muted ?? true,
    streams,
    audioBlocked,
    notice,
    dismissNotice: () => setNotice(null),
    setMuted,
    muteMember,
    unlockAudio,
  };
}
