import type { ChatMessage } from '@/types';

/**
 * Server history is the source of truth; local messages still pending or failed
 * (not yet in server history by id) are kept at the end so polling never drops them.
 */
export function mergeChat(server: ChatMessage[], local: ChatMessage[]): ChatMessage[] {
  const serverIds = new Set(server.map((m) => m.id));
  const unsynced = local.filter((m) => m.status && m.id && !serverIds.has(m.id));
  return [...server, ...unsynced];
}

/** Messages from the other person that are not in `before` (by id). */
export function countNewIncoming(before: ChatMessage[], after: ChatMessage[]): number {
  const seen = new Set(before.map((m) => m.id));
  return after.filter((m) => m.from === 'them' && !seen.has(m.id)).length;
}
