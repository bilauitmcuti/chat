import {
  CHAT_MAX_BODY_BYTES,
  CHAT_MAX_HISTORY_CONTENT_LENGTH,
  CHAT_MAX_MESSAGE_LENGTH,
} from "@/lib/chat/limits";
export const MAX_BODY_SIZE_BYTES = CHAT_MAX_BODY_BYTES;
/** @deprecated Use CHAT_MAX_MESSAGE_LENGTH from @/lib/chat/limits */
export const MAX_MESSAGE_LENGTH = CHAT_MAX_MESSAGE_LENGTH;
export const MAX_HISTORY_ARRAY_LENGTH = 20;
/** @deprecated Use CHAT_MAX_HISTORY_CONTENT_LENGTH from @/lib/chat/limits */
export const MAX_HISTORY_CONTENT_LENGTH = CHAT_MAX_HISTORY_CONTENT_LENGTH;
export const MAX_SELECTED_SESSIONS = 6;
export const CHAT_TURNSTILE_COOKIE = "chat_turnstile_verified";
export const CHAT_TURNSTILE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 12;

export interface ChatRequest {
  message: string;
  program?: string;
  selectedSessions?: string[];
  history?: { role: "user" | "assistant"; content: string }[];
  turnstileToken?: string;
  /** When true (default), LLM replies use SSE; cache hits always JSON. */
  stream?: boolean;
}

export function parseChatRequest(raw: unknown): { success: true; data: ChatRequest } | { success: false; error: string } {
  if (!raw || typeof raw !== "object") return { success: false, error: "Invalid request" };
  const o = raw as Record<string, unknown>;

  const message = o.message;
  if (typeof message !== "string" || message.length === 0)
    return { success: false, error: "Message is required" };
  if (message.length > CHAT_MAX_MESSAGE_LENGTH)
    return { success: false, error: "Message is too long. Please shorten your message." };

  const program = o.program != null ? String(o.program) : undefined;

  let selectedSessions: string[] | undefined;
  if (o.selectedSessions != null) {
    if (!Array.isArray(o.selectedSessions))
      return { success: false, error: "Invalid request. Please try again." };
    if (o.selectedSessions.length > MAX_SELECTED_SESSIONS)
      return { success: false, error: "Invalid request. Please try again." };
    selectedSessions = o.selectedSessions.map(String);
  }

  let history: { role: "user" | "assistant"; content: string }[] | undefined;
  if (o.history != null) {
    if (!Array.isArray(o.history))
      return { success: false, error: "Invalid request. Please try again." };
    if (o.history.length > MAX_HISTORY_ARRAY_LENGTH)
      return { success: false, error: "Chat history too long. Please start a new conversation." };
    const parsed: { role: "user" | "assistant"; content: string }[] = [];
    for (const h of o.history) {
      if (!h || typeof h !== "object") return { success: false, error: "Invalid request. Please try again." };
      const item = h as Record<string, unknown>;
      if (item.role !== "user" && item.role !== "assistant")
        return { success: false, error: "Invalid request. Please try again." };
      const content = String(item.content ?? "");
      if (content.length > CHAT_MAX_HISTORY_CONTENT_LENGTH)
        return { success: false, error: "Chat history too long. Please start a new conversation." };
      parsed.push({ role: item.role, content });
    }
    history = parsed;
  }

  const turnstileToken = o.turnstileToken != null && String(o.turnstileToken).trim().length > 0
    ? String(o.turnstileToken)
    : undefined;

  const stream = o.stream === false ? false : true;

  return { success: true, data: { message, program, selectedSessions, history, turnstileToken, stream } };
}
