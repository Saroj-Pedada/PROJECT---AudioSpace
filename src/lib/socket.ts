import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '../../shared/protocol.ts';

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// forceNew: each page owns its connection, so one page disconnecting can't close another's.
export function createSocket(): AppSocket {
  return io({ withCredentials: true, forceNew: true });
}
