/** User-facing copy when a chat request exceeds client or server deadlines. */
export const CHAT_TIMEOUT_MESSAGE =
  "Request took too long. Please try again, or switch to a faster model.";

/** User-facing copy when AI Gateway or Workers AI rate-limits the request. */
export const CHAT_RATE_LIMIT_MESSAGE =
  "Too many requests right now. Please wait a minute, then try again.";

/** Model failed or returned an unusable response — suggest switching models. */
export const CHAT_MODEL_ERROR_MESSAGE =
  "This AI model failed to answer. Please try again, or choose a different model in the picker.";

/** Model is loading / temporarily unavailable. */
export const CHAT_MODEL_UNAVAILABLE_MESSAGE =
  "This AI model is temporarily unavailable. Please try again in a few seconds, or switch to another model.";

/** Model access denied / not enabled for the account. */
export const CHAT_MODEL_ACCESS_DENIED_MESSAGE =
  "This AI model is not available on your account. Please choose a different model.";

/** Generic upstream / gateway failure. */
export const CHAT_SERVICE_ERROR_MESSAGE =
  "The AI service returned an error. Please try again in a moment, or switch to another model.";

/** Server / unexpected failure. */
export const CHAT_SERVER_ERROR_MESSAGE =
  "Something went wrong on the server. Please try again shortly.";

/** Request body or prompt too large. */
export const CHAT_REQUEST_TOO_LARGE_MESSAGE =
  "Your message or chat history is too long. Shorten the message or clear older chat, then try again.";

/** Network / connection failure on the client. */
export const CHAT_NETWORK_ERROR_MESSAGE =
  "Could not reach the chat service. Check your connection and try again.";

/** Turnstile / access blocked. */
export const CHAT_ACCESS_BLOCKED_MESSAGE =
  "Access was blocked. Please refresh the page and try again.";

/** Verification required before chat. */
export const CHAT_VERIFICATION_REQUIRED_MESSAGE =
  "Please complete verification first, then send your message.";

/** Workers AI binding missing (mostly local / misconfigured deploy). */
export const CHAT_AI_UNAVAILABLE_MESSAGE =
  "AI is not available right now. Please try again later, or switch to another model if the issue continues.";

/** Tool / function-calling schema mismatch for a model. */
export const CHAT_TOOL_FORMAT_ERROR_MESSAGE =
  "This model had a tool-calling error. Please switch to another model (for example Gemma 4) and try again.";

/** Empty model reply when recovery path is not used. */
export const CHAT_EMPTY_REPLY_ERROR_MESSAGE =
  "The AI model returned an empty reply. Please rephrase your question, or switch to another model.";

/** Fallback when no more specific message applies. */
export const CHAT_GENERIC_ERROR_MESSAGE =
  "Failed to get a response. Please try again, or switch to another model.";

/** When the model returns empty — still give a user-facing answer (not an SSE error). */
export const CHAT_EMPTY_REPLY_FALLBACK =
  "Saya tidak dapat menjana jawapan lengkap buat masa ini. Cuba tanya semula tentang kalendar akademik UiTM, cuti, minggu kuliah, atau maklumat pelajar — atau cuba ulang soalan anda.";

export function isEmptyModelReplyError(error: unknown): boolean {
  const msg =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  return msg.toLowerCase().includes("empty response");
}

/**
 * Prefer status-based copy; fall back to a known server message, then generic.
 * Keeps client and SSE abort paths aligned with mapChatError.
 */
export function resolveChatErrorMessage(
  status: number | undefined,
  error?: string
): string {
  const fromServer = error?.trim();
  if (status === 429) return CHAT_RATE_LIMIT_MESSAGE;
  if (status === 504) return CHAT_TIMEOUT_MESSAGE;
  if (status === 413) return CHAT_REQUEST_TOO_LARGE_MESSAGE;
  if (status === 403) {
    if (fromServer?.toLowerCase().includes("verification")) {
      return CHAT_VERIFICATION_REQUIRED_MESSAGE;
    }
    return CHAT_ACCESS_BLOCKED_MESSAGE;
  }
  if (status === 503) {
    if (
      fromServer &&
      (fromServer.includes("loading") ||
        fromServer.includes("unavailable") ||
        fromServer.includes("not available") ||
        fromServer.includes("Workers AI") ||
        fromServer.includes("AI is not available"))
    ) {
      return fromServer.includes("loading")
        ? CHAT_MODEL_UNAVAILABLE_MESSAGE
        : CHAT_AI_UNAVAILABLE_MESSAGE;
    }
    return CHAT_MODEL_UNAVAILABLE_MESSAGE;
  }
  if (status === 502) {
    if (fromServer?.toLowerCase().includes("empty")) {
      return CHAT_EMPTY_REPLY_ERROR_MESSAGE;
    }
    if (
      fromServer?.toLowerCase().includes("tool") ||
      fromServer?.toLowerCase().includes("function")
    ) {
      return CHAT_TOOL_FORMAT_ERROR_MESSAGE;
    }
    if (
      fromServer?.toLowerCase().includes("access denied") ||
      fromServer?.toLowerCase().includes("forbidden") ||
      fromServer?.toLowerCase().includes("not available on your account")
    ) {
      return CHAT_MODEL_ACCESS_DENIED_MESSAGE;
    }
    return fromServer && looksLikeUserFacingChatError(fromServer)
      ? fromServer
      : CHAT_MODEL_ERROR_MESSAGE;
  }
  if (status === 500) return CHAT_SERVER_ERROR_MESSAGE;
  if (fromServer && looksLikeUserFacingChatError(fromServer)) return fromServer;
  return CHAT_GENERIC_ERROR_MESSAGE;
}

function looksLikeUserFacingChatError(message: string): boolean {
  const lower = message.toLowerCase();
  if (lower.includes("wrangler") || lower.includes("cloudflare pages")) return false;
  if (lower.includes("binding named")) return false;
  if (lower.includes("skip_ai_gateway")) return false;
  return message.length > 0 && message.length < 280;
}
