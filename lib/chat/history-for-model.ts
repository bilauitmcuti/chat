import type { ChatMessage } from "@/lib/ai";

/** Max history turns sent to the model (2 Q&A pairs). */
export const MODEL_HISTORY_MAX_MESSAGES = 4;

/** Max chars per user history message in model input. */
export const MODEL_HISTORY_USER_MAX_CHARS = 3_000;

/** Max chars per assistant history message in model input. */
export const MODEL_HISTORY_ASSISTANT_MAX_CHARS = 2_000;

const TRUNCATION_MARKER = "\n...[truncated]";

function trimAssistantContent(content: string, maxChars: number): string {
  if (content.length <= maxChars) return content;
  const budget = maxChars - TRUNCATION_MARKER.length;
  if (budget < 200) return content.slice(0, maxChars);

  const headChars = Math.floor(budget * 0.4);
  const tailChars = budget - headChars;
  return (
    content.slice(0, headChars) +
    TRUNCATION_MARKER +
    content.slice(content.length - tailChars)
  );
}

function trimHistoryMessage(msg: ChatMessage): ChatMessage {
  const maxChars =
    msg.role === "user"
      ? MODEL_HISTORY_USER_MAX_CHARS
      : MODEL_HISTORY_ASSISTANT_MAX_CHARS;

  if (msg.content.length <= maxChars) return msg;

  const content =
    msg.role === "assistant"
      ? trimAssistantContent(msg.content, maxChars)
      : msg.content.slice(0, maxChars) + TRUNCATION_MARKER;

  return { ...msg, content };
}

/**
 * Trim chat history for model input: keep the last N turns and cap per-message
 * length so multi-turn conversations stay within context limits.
 */
export function trimHistoryForModel(
  history: ChatMessage[] | undefined,
  options?: { maxMessages?: number }
): ChatMessage[] {
  if (!history?.length) return [];
  const maxMessages = options?.maxMessages ?? MODEL_HISTORY_MAX_MESSAGES;
  return history.slice(-maxMessages).map(trimHistoryMessage);
}
