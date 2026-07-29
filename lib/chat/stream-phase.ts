/** Server-emitted stream phases surfaced in the chat UI. */
export const CHAT_STREAM_PHASE = {
  RETRY: "retry",
} as const;

export type ChatStreamPhase =
  (typeof CHAT_STREAM_PHASE)[keyof typeof CHAT_STREAM_PHASE];

export function isChatStreamPhase(value: string): value is ChatStreamPhase {
  return Object.values(CHAT_STREAM_PHASE).includes(value as ChatStreamPhase);
}
