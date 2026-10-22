// Validation rules shared by the server (enforcement) and the client (instant feedback).

export const NAME_MIN = 3;
export const NAME_MAX = 24;
export const PASSWORD_MIN = 8;
export const ROOM_NAME_MAX = 40;
export const ROOM_DESCRIPTION_MAX = 120;
export const CHAT_MESSAGE_MAX = 500;
export const CHAT_TTL_MS = 5 * 60 * 1000;
export const MAX_PRIVATE_ROOMS_PER_USER = 5;

export const ROOM_EMOJIS = ['🎧', '🎙️', '🎵', '🎮', '📚', '💼', '🍿', '🌙', '☕', '🔥', '🌍', '💬'];

/** Trims and collapses inner whitespace. */
export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

/** Returns an error message, or null when the display name is valid. */
export function validateName(name: string): string | null {
  if (name.length < NAME_MIN || name.length > NAME_MAX) return `Use ${NAME_MIN}–${NAME_MAX} characters.`;
  if (!/^[\p{L}\p{N}][\p{L}\p{N} ._-]*[\p{L}\p{N}]$/u.test(name)) {
    return 'Use letters, numbers, spaces, dots, dashes or underscores, starting and ending with a letter or number.';
  }
  return null;
}

export function isValidPasscode(passcode: string): boolean {
  return /^\d{6}$/.test(passcode);
}

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
