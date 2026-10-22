// Types shared by the server and the React client.

export interface User {
  id?: number;
  name: string;
  guest: boolean;
}

export interface Room {
  id: string;
  name: string;
  description: string;
  emoji: string;
}

export interface Member {
  id: string;
  name: string;
  muted: boolean;
}

export interface RoomSummary extends Room {
  listeners: number;
  capacity: number;
  /** Who is in the room; only sent to signed-in users. */
  members: Pick<Member, 'id' | 'name'>[];
}

// Minimal structural versions of the DOM WebRTC types, so the server can use them too.
export interface SessionDescription {
  type: 'offer' | 'answer' | 'pranswer' | 'rollback';
  sdp?: string;
}

export interface IceCandidate {
  candidate?: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  usernameFragment?: string | null;
}

export interface Signal {
  description?: SessionDescription;
  candidate?: IceCandidate;
}

export interface ServerToClientEvents {
  rooms: (rooms: RoomSummary[]) => void;
  joined: (payload: { selfId: string; hostId: string; members: Member[] }) => void;
  'room full': () => void;
  'member joined': (member: Member) => void;
  'member left': (id: string) => void;
  'member muted': (payload: { id: string; muted: boolean }) => void;
  'host changed': (id: string) => void;
  /** The host muted you. Hosts can't unmute people; only you can turn your mic on. */
  'force muted': () => void;
  /** The same user joined this room from another tab or device; this connection was removed. */
  'joined elsewhere': () => void;
  signal: (payload: Signal & { from: string }) => void;
}

export interface ClientToServerEvents {
  'watch rooms': () => void;
  join: (payload: { roomId: string; muted: boolean }) => void;
  'set muted': (muted: boolean) => void;
  'host mute': (target: string) => void;
  signal: (payload: Signal & { to: string }) => void;
}

export interface ApiError {
  error: string;
}
