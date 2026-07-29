import { normalizeAiErrorMessage } from "@/lib/ai";

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
    return {
      message:
        "Workers AI is not available. For local dev, restart after `pnpm dev` (loads wrangler.jsonc) or use `pnpm preview`. On Cloudflare Pages, add a Workers AI binding named AI.",
      status: 503,
    };
  }
  if (status === 401 || errMsg.includes("401") || errMsg.includes("unauthorized")) {
    return {
      message:
        "Workers AI is not configured. Add an AI binding named AI in Cloudflare Pages settings.",
      status: 502,
    };
  }
  if (status === 403 || errMsg.includes("403") || errMsg.includes("forbidden")) {
    return {
      message: "AI model access denied. Please try again later or contact support.",
      status: 502,
    };
  }
  if (status === 413 || errMsg.includes("413")) {
    return { message: "Request too large. Try a shorter message or clear chat history.", status: 413 };
  }
  if (
    status === 429 ||
    errMsg.includes("429") ||
    errMsg.includes("rate limit") ||
    errMsg.includes("too many requests")
  ) {
    return {
      message:
        "AI service is busy or at its usage limit. Please try again in a few minutes.",
      status: 429,
    };
  }
  if (
    status === 503 ||
    errMsg.includes("503") ||
    errMsg.includes("loading") ||
    errMsg.includes("unavailable") ||
    errMsg.includes("temporarily unavailable")
  ) {
    return { message: "AI model is loading. Please try again in a few seconds.", status: 503 };
  }
  if (status === 504 || errMsg.includes("timeout") || errMsg.includes("timed out")) {
    return { message: "Request took too long. Please try again.", status: 504 };
  }
  if (errMsg.includes("empty response")) {
    return {
      message: "The AI model returned an empty reply. Please try again or rephrase your question.",
      status: 502,
    };
  }
  if (status === 502 || errMsg.includes("502")) {
    return {
      message: "AI service returned an error. Please try again in a moment.",
      status: 502,
    };
  }
  if (status === 500 || errMsg.includes("500")) {
    return {
      message: "AI service error. Please try again shortly.",
      status: 502,
    };
  }
  if (
    errMsg.includes("configure ai gateway") ||
    errMsg.includes("2001")
  ) {
    return {
      message:
        "AI Gateway is not configured. Create gateway bilauitmcuti-chat in Cloudflare dashboard (AI → AI Gateway), or set SKIP_AI_GATEWAY=1 for local dev.",
      status: 502,
    };
  }
  if (errMsg.includes("partner") || errMsg.includes("unified")) {
    return {
      message:
        "Partner AI model is unavailable. Enable Workers AI partner models in your Cloudflare account or try again later.",
      status: 502,
    };
  }
  if (
    errMsg.includes("validation error") &&
    errMsg.includes("tools") &&
    errMsg.includes("function")
  ) {
    return {
      message:
        "AI tool format error. Please try again; if it persists, switch to Llama or report the issue.",
      status: 502,
    };
  }
  return { message: "Failed to get response from AI. Please try again.", status: 500 };
}

/** @internal */
export const mapChatErrorForTest = mapChatError;
