import type { Member, Room, RoomSummary } from '../shared/protocol.ts';

export const MAX_ROOM_SIZE = 8;

export const ROOMS: Room[] = [
  { id: 'bollywood-pop', name: 'Bollywood Pop Songs', emoji: '🎤', description: 'Sing along, request songs and argue about the best decade.' },
  { id: 'just-for-fun', name: 'Just for Fun', emoji: '🎲', description: 'No agenda. Games, banter and whatever comes up.' },
  { id: 'musafir-stories', name: 'The Musafir Stories', emoji: '🧭', description: 'Travel tales from the road, the rails and the mountains.' },
  { id: 'political-debates', name: 'Political Debates', emoji: '🏛️', description: 'Civil, sharp discussion on the issues of the day.' },
  { id: 'finance-society', name: 'Finance Society', emoji: '📈', description: 'Markets, money habits and investing for beginners.' },
  { id: 'mahabharata', name: 'Learning Mahabharata in English', emoji: '📜', description: 'One episode of the epic at a time, retold in English.' },
  { id: 'chit-chat', name: 'Chit Chat', emoji: '☕', description: 'Grab a chai and say hi to whoever is around.' },
  { id: 'standup-comedy', name: 'Standup Comedy', emoji: '🎭', description: 'Open mic. Try your bits on a friendly crowd.' },
  { id: 'party-music', name: 'Party Music Room', emoji: '🪩', description: 'Turn it up. Share tracks and hype the room.' },
  { id: 'musicians-assembly', name: "Musicians' Assembly", emoji: '🎸', description: 'Jam, swap gear tips and get feedback on your songs.' },
];

const roomsById = new Map(ROOMS.map(room => [room.id, room]));

/** A member plus the stable user key used to stop one person joining the same room twice. */
export interface Occupant extends Member {
  userKey: string;
}

interface RoomState {
  hostId: string;
  members: Map<string, Occupant>;
}

const state = new Map<string, RoomState>();

export function getRoom(id: string): Room | undefined {
  return roomsById.get(id);
}

export function getRoomState(id: string): RoomState | undefined {
  return state.get(id);
}

export function summaries({ withMembers = true } = {}): RoomSummary[] {
  return ROOMS.map(room => {
    const members = [...(state.get(room.id)?.members.values() ?? [])];
    return {
      ...room,
      capacity: MAX_ROOM_SIZE,
      listeners: members.length,
      members: withMembers ? members.map(({ id, name }) => ({ id, name })) : [],
    };
  });
}

export function toMember({ id, name, muted }: Occupant): Member {
  return { id, name, muted };
}

/** The connection id this user already has in the room, if any. */
export function findByUserKey(roomId: string, userKey: string): string | undefined {
  for (const member of state.get(roomId)?.members.values() ?? []) {
    if (member.userKey === userKey) return member.id;
  }
  return undefined;
}

/** Adds a member; returns the room state, or null if the room is full. */
export function addMember(roomId: string, member: Occupant): RoomState | null {
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
