import { CHAT_MAX_HISTORY_CONTENT_LENGTH, CHAT_MAX_MESSAGE_LENGTH } from "@/lib/chat/limits";
export { CHAT_TURNSTILE_COOKIE } from "@/lib/chat/parse-request";
import { CHAT_RATE_LIMIT_MESSAGE, CHAT_TIMEOUT_MESSAGE, resolveChatErrorMessage } from "@/lib/chat/user-messages";
export {
  consumeChatStream,
  createMarkdownStreamPainter,
  createReasoningStreamPainter,
  createRafMarkdownStreamPainter,
  createRafReasoningStreamPainter,
} from "@/lib/chat/sse";
export type { ChatStreamDonePayload } from "@/lib/chat/sse";
export { CHAT_RATE_LIMIT_MESSAGE, CHAT_TIMEOUT_MESSAGE, resolveChatErrorMessage };

export function getChatErrorMessage(res: Response, fallback: string): string {
  if (res.status === 429) return CHAT_RATE_LIMIT_MESSAGE;
  if (res.status === 403) return "Access was blocked. Please refresh and try again.";
  if (res.status === 504) return CHAT_TIMEOUT_MESSAGE;
  if (res.status >= 500) return "Server is temporarily unavailable. Please try again in a moment.";
  return fallback;
}

export async function parseChatResponse(res: Response): Promise<{
  error?: string;
  reply?: string;
  correlationId?: string;
  path?: string;
}> {
  const text = await res.text();
  try {
    return JSON.parse(text) as {
      error?: string;
      reply?: string;
      correlationId?: string;
      path?: string;
    };
  } catch {
    return { error: getChatErrorMessage(res, "Something went wrong. Please try again.") };
  }
}

/** Timeout until HTTP headers are received (time-to-first-byte). */
export const FETCH_HEADERS_TIMEOUT_MS = 60_000;
/** Timeout covering the full SSE stream read after headers arrive. */
export const FETCH_STREAM_TIMEOUT_MS = 120_000;
/** Backwards-compatible alias for callers that only need a single timeout. */
export const FETCH_TIMEOUT_MS = FETCH_HEADERS_TIMEOUT_MS;
export const RETRY_DELAYS_MS = [400, 800, 1600];
export const MAX_CHAT_MESSAGE_LENGTH = CHAT_MAX_MESSAGE_LENGTH;
export const MAX_HISTORY_CONTENT_LENGTH = CHAT_MAX_HISTORY_CONTENT_LENGTH;
export const MAX_HISTORY_ITEMS = 4;

export interface ChatMessageItem {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp?: number;
  correlationId?: string;
  userPrompt?: string;
  /** False while streaming; omit or true when the answer is finished. */
  isComplete?: boolean;
  /** Model reasoning / tool-planning text shown above the answer. */
  reasoning?: string;
  /** When false, hide the reasoning UI (e.g. dev Llama). Omit or true for legacy messages. */
  reasoningUiSupported?: boolean;
  /** True when the thinking indicator or reasoning paragraph was shown for this turn. */
  hadThinking?: boolean;
  /** Seconds spent in the thinking state before the answer streamed. */
  thinkingDurationSec?: number;
  /** Server-driven in-progress phase (e.g. `retry` during regenerate). */
  streamPhase?: string;
  /** Short status line from server pools for the current stream phase. */
  statusMessage?: string;
}

/** Live token/reasoning draft kept outside `messages` to avoid full-list re-renders. */
export interface ChatStreamingDraft {
  id: string;
  content: string;
  reasoning?: string;
}

export interface MentionMatch {
  start: number;
  end: number;
  query: string;
}

export function prepareHistory(messages: ChatMessageItem[]): { role: "user" | "assistant"; content: string }[] {
  return messages
    .filter((msg) => msg.isComplete !== false)
    .slice(-MAX_HISTORY_ITEMS)
    .map((msg) => ({
      role: msg.role,
      content: msg.content.slice(0, MAX_HISTORY_CONTENT_LENGTH),
    }));
}

export function getActiveMentionMatch(value: string, caretIndex: number): MentionMatch | null {
  if (caretIndex < 0) return null;
  const prefix = value.slice(0, caretIndex);
  const atIndex = prefix.lastIndexOf("@");
  if (atIndex < 0) return null;
  const charBefore = atIndex > 0 ? prefix[atIndex - 1] : "";
  const isBoundary = atIndex === 0 || /\s/.test(charBefore);
  if (!isBoundary) return null;
  const query = prefix.slice(atIndex + 1);
  if (/\s/.test(query)) return null;
  return { start: atIndex, end: caretIndex, query };
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
