/** User-facing copy when a chat request exceeds client or server deadlines. */
export const CHAT_TIMEOUT_MESSAGE = "Request took too long. Please try again.";

/** User-facing copy when AI Gateway or Workers AI rate-limits the request. */
export const CHAT_RATE_LIMIT_MESSAGE =
  "AI service is busy or at its usage limit. Please try again in a few minutes.";

export function resolveChatErrorMessage(
  status: number | undefined,
  error?: string
): string {
  if (status === 429) return CHAT_RATE_LIMIT_MESSAGE;
  if (status === 504) return CHAT_TIMEOUT_MESSAGE;
  if (error?.trim()) return error.trim();
  return "Something went wrong. Please try again.";
}
