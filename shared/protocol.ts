// Types shared by the server and the React client.

export interface User {
  id: number;
  name: string;
  email: string;
  avatarSeed: string;
  isAdmin: boolean;
  createdAt: string;
}

export type RoomKind = 'public' | 'private';

export interface Room {
  id: string;
  kind: RoomKind;
  name: string;
  description: string;
  emoji: string;
  /** Private rooms only. */
  ownerId?: number;
  ownerName?: string;
}

export interface RoomSummary extends Room {
  listeners: number;
  capacity: number;
  /** Who is in the room; only sent to signed-in users. */
  members: Pick<Member, 'id' | 'name' | 'avatarSeed'>[];
}

export interface LobbyRooms {
  public: RoomSummary[];
  /** Private rooms you own or have unlocked (every private room for admins). */
  private: RoomSummary[];
}

export interface RoomDetails {
  room: Room;
  /** True until the user has entered the passcode. */
  locked: boolean;
  /** Owner or admin: can see the passcode and delete the room. */
  canManage: boolean;
  passcode?: string;
}

export interface Member {
  /** Connection id. */
  id: string;
  userId: number;
  name: string;
  avatarSeed: string;
  isAdmin: boolean;
  muted: boolean;
}

export interface ChatMessage {
  id: string;
  userId: number;
  name: string;
  avatarSeed: string;
  text: string;
  sentAt: number;
  /** Milliseconds until the message disappears, measured when the server sent it. */
  expiresIn: number;
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
  rooms: (rooms: LobbyRooms) => void;
  joined: (payload: { selfId: string; hostId: string; members: Member[] }) => void;
  'room full': () => void;
  'room locked': () => void;
  'room deleted': () => void;
  'member joined': (member: Member) => void;
  'member left': (id: string) => void;
  'member muted': (payload: { id: string; muted: boolean }) => void;
  'host changed': (id: string) => void;
  /** A moderator muted you. Nobody can unmute you but you. */
  'force muted': () => void;
  /** The same user joined this room from another tab or device; this connection was removed. */
  'joined elsewhere': () => void;
  'chat history': (messages: ChatMessage[]) => void;
  'chat message': (message: ChatMessage) => void;
  'chat expired': (ids: string[]) => void;
  signal: (payload: Signal & { from: string }) => void;
}

export interface ClientToServerEvents {
  'watch rooms': () => void;
  join: (payload: { roomId: string; muted: boolean }) => void;
  'set muted': (muted: boolean) => void;
  'host mute': (target: string) => void;
  'chat send': (text: string, ack: (result: { ok: true } | { ok: false; error: string }) => void) => void;
  signal: (payload: Signal & { to: string }) => void;
}
