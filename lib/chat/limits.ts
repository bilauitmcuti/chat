/** Max characters per chat message (user input). */
export const CHAT_MAX_MESSAGE_LENGTH = 6_000;

/** Max characters per history item in the request body. */
export const CHAT_MAX_HISTORY_CONTENT_LENGTH = 12_000;

/** Max JSON body size for POST /chat/api. */
export const CHAT_MAX_BODY_BYTES = 128 * 1024;

/** User messages longer than this use a higher output token budget (still not “simple”). */
export const CHAT_LONG_MESSAGE_THRESHOLD_CHARS = 320;
