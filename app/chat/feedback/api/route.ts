export const runtime = "edge";

import { NextRequest, NextResponse } from "next/server";
import {
  buildChatFeedbackEmbed,
  chatFeedbackWebhookKind,
  getDiscordWebhookUrl,
  sendDiscordWebhook,
} from "@/lib/discord-webhook";
import { jsonError, getClientIp, formatNotificationTime } from "@/lib/api-response";
import { checkRateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

const MAX_BODY_SIZE_BYTES = 32 * 1024;
const MAX_FEEDBACK_CONTENT_LENGTH = 4_000;

interface ChatFeedbackRequest {
  rating: "up" | "down";
  correlationId?: string;
  userMessage: string;
  assistantMessage: string;
  program?: string;
  selectedSessions?: string[];
}

function parseFeedbackRequest(
  raw: unknown
): { success: true; data: ChatFeedbackRequest } | { success: false; error: string } {
  if (!raw || typeof raw !== "object") {
    return { success: false, error: "Invalid request" };
  }
  const o = raw as Record<string, unknown>;
  const rating = o.rating;
  if (rating !== "up" && rating !== "down") {
    return { success: false, error: "Invalid rating" };
  }

  const userMessage = String(o.userMessage ?? "").slice(0, MAX_FEEDBACK_CONTENT_LENGTH);
  const assistantMessage = String(o.assistantMessage ?? "").slice(0, MAX_FEEDBACK_CONTENT_LENGTH);
  if (!assistantMessage.trim()) {
    return { success: false, error: "Missing assistant message" };
  }

  const correlationId = String(o.correlationId ?? "").trim() || undefined;

  let selectedSessions: string[] | undefined;
  if (o.selectedSessions != null) {
    if (!Array.isArray(o.selectedSessions)) {
      return { success: false, error: "Invalid request" };
    }
    if (o.selectedSessions.length > 6) {
      return { success: false, error: "Invalid request" };
    }
    selectedSessions = o.selectedSessions.map(String);
  }

  const program = o.program != null ? String(o.program).slice(0, 120) : undefined;

  return {
    success: true,
    data: {
      rating,
      correlationId,
      userMessage,
      assistantMessage,
      program,
      selectedSessions,
    },
  };
}

export async function POST(request: NextRequest) {
  const logId = `chat-feedback-${Date.now().toString(36)}`;
  try {
    const contentType = request.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      return jsonError("Content-Type must be application/json", 415);
    }

    const contentLength = request.headers.get("content-length");
    if (contentLength && Number.parseInt(contentLength, 10) > MAX_BODY_SIZE_BYTES) {
      return jsonError("Request body too large", 413);
    }

    const ip = getClientIp(request);
    const limitResult = checkRateLimit(ip, request);
    if (limitResult.limited) return jsonError(limitResult.message, 429);

    const rawBody = await request.json();
    if (JSON.stringify(rawBody).length > MAX_BODY_SIZE_BYTES) {
      return jsonError("Request body too large", 413);
    }

    const parsed = parseFeedbackRequest(rawBody);
    if (!parsed.success) return jsonError(parsed.error, 400);

    const webhookKind = chatFeedbackWebhookKind(parsed.data.rating);
    try {
      getDiscordWebhookUrl(webhookKind);
    } catch (envErr) {
      const errMsg = envErr instanceof Error ? envErr.message : String(envErr);
      logger.warn("Chat feedback: Discord webhook missing", { logId, webhookKind, errMsg });
      return jsonError(
        "Feedback is not configured. Set DISCORD_WEBHOOK_CHAT_HELPFUL and DISCORD_WEBHOOK_CHAT_NOT_HELPFUL in .env.local and restart the dev server.",
        503
      );
    }

    const embed = buildChatFeedbackEmbed({
      rating: parsed.data.rating,
      userMessage: parsed.data.userMessage,
      assistantMessage: parsed.data.assistantMessage,
      time: formatNotificationTime(new Date()),
      program: parsed.data.program,
      correlationId: parsed.data.correlationId,
    });

    await sendDiscordWebhook({ kind: webhookKind, embeds: [embed] });

    return NextResponse.json({ message: "Thanks for your feedback!" });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.error("Chat feedback API error", { logId, errMsg });

    if (errMsg.includes("Discord webhook failed")) {
      return jsonError(
        "Could not deliver feedback to Discord. Check DISCORD_WEBHOOK_CHAT_HELPFUL and DISCORD_WEBHOOK_CHAT_NOT_HELPFUL.",
        502
      );
    }
    if (errMsg.includes("DISCORD_WEBHOOK_CHAT_")) {
      return jsonError(
        "Feedback is not configured. Set DISCORD_WEBHOOK_CHAT_HELPFUL and DISCORD_WEBHOOK_CHAT_NOT_HELPFUL in .env.local and restart the dev server.",
        503
      );
    }
    return jsonError("Failed to submit feedback. Please try again.", 500);
  }
}
