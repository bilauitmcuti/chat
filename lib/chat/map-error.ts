import { normalizeAiErrorMessage } from "@/lib/ai";
import {
  CHAT_AI_UNAVAILABLE_MESSAGE,
  CHAT_EMPTY_REPLY_ERROR_MESSAGE,
  CHAT_GENERIC_ERROR_MESSAGE,
  CHAT_MODEL_ACCESS_DENIED_MESSAGE,
  CHAT_MODEL_ERROR_MESSAGE,
  CHAT_MODEL_UNAVAILABLE_MESSAGE,
  CHAT_RATE_LIMIT_MESSAGE,
  CHAT_REQUEST_TOO_LARGE_MESSAGE,
  CHAT_SERVER_ERROR_MESSAGE,
  CHAT_SERVICE_ERROR_MESSAGE,
  CHAT_TIMEOUT_MESSAGE,
  CHAT_TOOL_FORMAT_ERROR_MESSAGE,
} from "@/lib/chat/user-messages";

export function mapChatError(error: unknown): { message: string; status: number } {
  const errMsg = normalizeAiErrorMessage(error).toLowerCase();
  const status =
    error !== null &&
    typeof error === "object" &&
    "status" in error &&
    typeof (error as { status?: unknown }).status === "number"
      ? (error as { status: number }).status
      : undefined;

  if (
    status === 503 ||
    errMsg.includes("binding not available") ||
    errMsg.includes("workers ai binding") ||
    errMsg.includes("not configured")
  ) {
    if (
      errMsg.includes("loading") ||
      errMsg.includes("temporarily unavailable")
    ) {
      return { message: CHAT_MODEL_UNAVAILABLE_MESSAGE, status: 503 };
    }
    return { message: CHAT_AI_UNAVAILABLE_MESSAGE, status: 503 };
  }
  if (status === 401 || errMsg.includes("401") || errMsg.includes("unauthorized")) {
    return { message: CHAT_AI_UNAVAILABLE_MESSAGE, status: 502 };
  }
  if (status === 403 || errMsg.includes("403") || errMsg.includes("forbidden")) {
    return { message: CHAT_MODEL_ACCESS_DENIED_MESSAGE, status: 502 };
  }
  if (status === 413 || errMsg.includes("413")) {
    return { message: CHAT_REQUEST_TOO_LARGE_MESSAGE, status: 413 };
  }
  if (
    status === 429 ||
    errMsg.includes("429") ||
    errMsg.includes("rate limit") ||
    errMsg.includes("too many requests")
  ) {
    return { message: CHAT_RATE_LIMIT_MESSAGE, status: 429 };
  }
  if (
    errMsg.includes("503") ||
    errMsg.includes("loading") ||
    errMsg.includes("unavailable") ||
    errMsg.includes("temporarily unavailable")
  ) {
    return { message: CHAT_MODEL_UNAVAILABLE_MESSAGE, status: 503 };
  }
  if (status === 504 || errMsg.includes("timeout") || errMsg.includes("timed out")) {
    return { message: CHAT_TIMEOUT_MESSAGE, status: 504 };
  }
  if (errMsg.includes("empty response")) {
    return { message: CHAT_EMPTY_REPLY_ERROR_MESSAGE, status: 502 };
  }
  if (
    errMsg.includes("no function-calling model") ||
    (errMsg.includes("model") &&
      (errMsg.includes("not found") ||
        errMsg.includes("does not exist") ||
        errMsg.includes("unsupported") ||
        errMsg.includes("unknown model")))
  ) {
    return { message: CHAT_MODEL_ERROR_MESSAGE, status: 502 };
  }
  if (status === 502 || errMsg.includes("502")) {
    return { message: CHAT_SERVICE_ERROR_MESSAGE, status: 502 };
  }
  if (status === 500 || errMsg.includes("500")) {
    return { message: CHAT_SERVER_ERROR_MESSAGE, status: 502 };
  }
  if (errMsg.includes("configure ai gateway") || errMsg.includes("2001")) {
    return { message: CHAT_SERVICE_ERROR_MESSAGE, status: 502 };
  }
  if (errMsg.includes("partner") || errMsg.includes("unified")) {
    return { message: CHAT_MODEL_UNAVAILABLE_MESSAGE, status: 502 };
  }
  if (
    errMsg.includes("validation error") &&
    errMsg.includes("tools") &&
    errMsg.includes("function")
  ) {
    return { message: CHAT_TOOL_FORMAT_ERROR_MESSAGE, status: 502 };
  }
  return { message: CHAT_GENERIC_ERROR_MESSAGE, status: 500 };
}

/** @internal */
export const mapChatErrorForTest = mapChatError;
