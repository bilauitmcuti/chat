/** Client assistant-response lifecycle (shared across models). */
export const ASSISTANT_LIFECYCLE = {
  SUBMITTED: "submitted",
  REASONING: "reasoning",
  TOOL_CALL: "tool-call",
  STREAMING: "streaming",
  COMPLETE: "complete",
  ERROR: "error",
} as const;

export type AssistantLifecycle =
  (typeof ASSISTANT_LIFECYCLE)[keyof typeof ASSISTANT_LIFECYCLE];

/** Server-emitted stream phases surfaced in the chat UI. */
export const CHAT_STREAM_PHASE = {
  RETRY: "retry",
} as const;

export type ChatStreamPhase =
  (typeof CHAT_STREAM_PHASE)[keyof typeof CHAT_STREAM_PHASE];

export function isChatStreamPhase(value: string): value is ChatStreamPhase {
  return Object.values(CHAT_STREAM_PHASE).includes(value as ChatStreamPhase);
}

export function isAssistantLifecycle(value: string): value is AssistantLifecycle {
  return Object.values(ASSISTANT_LIFECYCLE).includes(value as AssistantLifecycle);
}
