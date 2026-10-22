import crypto from 'node:crypto';
import type { ChatMessage } from '../shared/protocol.ts';
import { CHAT_TTL_MS } from '../shared/validation.ts';

// Disappearing chat: messages live only in memory and are dropped CHAT_TTL_MS after sending.

interface StoredMessage extends Omit<ChatMessage, 'expiresIn'> {
  expiresAt: number;
  timer: NodeJS.Timeout;
}

const rooms = new Map<string, Map<string, StoredMessage>>();

function toWire(message: StoredMessage): ChatMessage {
  const { expiresAt, timer: _, ...rest } = message;
  return { ...rest, expiresIn: Math.max(0, expiresAt - Date.now()) };
}

export function chatHistory(roomId: string): ChatMessage[] {
  return [...(rooms.get(roomId)?.values() ?? [])].map(toWire);
}

export function addChatMessage(
  roomId: string,
  author: { userId: number; name: string; avatarSeed: string },
  text: string,
  onExpire: (id: string) => void,
): ChatMessage {
  let messages = rooms.get(roomId);
  if (!messages) rooms.set(roomId, (messages = new Map()));

  const id = crypto.randomUUID();
  const sentAt = Date.now();
  const timer = setTimeout(() => {
    messages.delete(id);
    if (messages.size === 0) rooms.delete(roomId);
    onExpire(id);
  }, CHAT_TTL_MS);
  timer.unref();

  const stored: StoredMessage = { id, ...author, text, sentAt, expiresAt: sentAt + CHAT_TTL_MS, timer };
  messages.set(id, stored);
  return toWire(stored);
}

export function clearChat(roomId: string) {
  rooms.get(roomId)?.forEach(message => clearTimeout(message.timer));
  rooms.delete(roomId);
}
