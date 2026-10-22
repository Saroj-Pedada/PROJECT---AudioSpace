import type { Member, Room, RoomSummary } from '../shared/protocol.ts';

export const MAX_ROOM_SIZE = 8;

export const PUBLIC_ROOMS: Room[] = [
  { id: 'bollywood-pop', kind: 'public', name: 'Bollywood Pop Songs', emoji: '🎤', description: 'Sing along, request songs and argue about the best decade.' },
  { id: 'just-for-fun', kind: 'public', name: 'Just for Fun', emoji: '🎲', description: 'No agenda. Games, banter and whatever comes up.' },
  { id: 'musafir-stories', kind: 'public', name: 'The Musafir Stories', emoji: '🧭', description: 'Travel tales from the road, the rails and the mountains.' },
  { id: 'political-debates', kind: 'public', name: 'Political Debates', emoji: '🏛️', description: 'Civil, sharp discussion on the issues of the day.' },
  { id: 'finance-society', kind: 'public', name: 'Finance Society', emoji: '📈', description: 'Markets, money habits and investing for beginners.' },
  { id: 'mahabharata', kind: 'public', name: 'Learning Mahabharata in English', emoji: '📜', description: 'One episode of the epic at a time, retold in English.' },
  { id: 'chit-chat', kind: 'public', name: 'Chit Chat', emoji: '☕', description: 'Grab a chai and say hi to whoever is around.' },
  { id: 'standup-comedy', kind: 'public', name: 'Standup Comedy', emoji: '🎭', description: 'Open mic. Try your bits on a friendly crowd.' },
  { id: 'party-music', kind: 'public', name: 'Party Music Room', emoji: '🪩', description: 'Turn it up. Share tracks and hype the room.' },
  { id: 'musicians-assembly', kind: 'public', name: "Musicians' Assembly", emoji: '🎸', description: 'Jam, swap gear tips and get feedback on your songs.' },
];

const publicById = new Map(PUBLIC_ROOMS.map(room => [room.id, room]));

export function getPublicRoom(id: string): Room | undefined {
  return publicById.get(id);
}

interface RoomState {
  hostId: string;
  members: Map<string, Member>;
}

// Who is in each room right now. Rooms themselves (public or private) live elsewhere;
// this only tracks connections, so an empty private room simply has no entry here.
const state = new Map<string, RoomState>();

export function getRoomState(id: string): RoomState | undefined {
  return state.get(id);
}

export function summarize(room: Room, { withMembers = true } = {}): RoomSummary {
  const members = [...(state.get(room.id)?.members.values() ?? [])];
  return {
    ...room,
    capacity: MAX_ROOM_SIZE,
    listeners: members.length,
    members: withMembers ? members.map(({ id, name, avatarSeed }) => ({ id, name, avatarSeed })) : [],
  };
}

/** The connection id this user already has in the room, if any. */
export function findByUserId(roomId: string, userId: number): string | undefined {
  for (const member of state.get(roomId)?.members.values() ?? []) {
    if (member.userId === userId) return member.id;
  }
  return undefined;
}

/** Adds a member; returns the room state, or null if the room is full. */
export function addMember(roomId: string, member: Member): RoomState | null {
  let room = state.get(roomId);
  if (room && room.members.size >= MAX_ROOM_SIZE) return null;
  if (!room) {
    room = { hostId: member.id, members: new Map() };
    state.set(roomId, room);
  }
  room.members.set(member.id, member);
  return room;
}

/** Removes a member; returns the new host id if hosting passed to someone else. */
export function removeMember(roomId: string, memberId: string): string | null {
  const room = state.get(roomId);
  if (!room) return null;

  room.members.delete(memberId);
  if (room.members.size === 0) {
    state.delete(roomId);
    return null;
  }
  if (room.hostId === memberId) {
    room.hostId = room.members.keys().next().value!;
    return room.hostId;
  }
  return null;
}

/** Ids of everyone currently connected to a room. */
export function memberIds(roomId: string): string[] {
  return [...(state.get(roomId)?.members.keys() ?? [])];
}
