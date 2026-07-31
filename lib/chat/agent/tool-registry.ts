import {
  messageAsksDayStatus,
  messageAsksNextUpcomingEvent,
} from "@/lib/chat/topic-router";
import { messageLooksLikeExplanationOrOpinion } from "@/lib/chat/response-format";
import { resolveDateScope } from "@/lib/chat/date-scope";
import type { AgentTurnContext, ChatToolName } from "@/lib/chat/agent/types";
import {
  modeDisablesTools,
  modePrefersNoCalendarTools,
  type ChatModeId,
} from "@/lib/chat/modes";

/**
 * Hybrid tool exposure: topic-router narrows which tools the model may call.
 * Chat modes further gate tools (rewrite/translate = none; summarize = minimal).
 */
export function buildToolRegistryForTurn(
  ctx: AgentTurnContext,
  mode: ChatModeId = "ask"
): ChatToolName[] {
  if (modeDisablesTools(mode)) return [];

  if (mode === "summarize") {
    const tools = new Set<ChatToolName>();
    if (
      ctx.topicRoute.topics.includes("academic_calendar") ||
      ctx.activityMatches.length > 0
    ) {
      tools.add("search_calendar_activities");
    }
    if (ctx.topicRoute.topics.includes("public_holiday")) {
      tools.add("get_public_holiday_meta");
      tools.add("get_public_holidays");
    }
    if (messageAsksDayStatus(ctx.message)) {
      tools.add("get_today_status");
    }
    return [...tools];
  }

  if (mode === "plan") {
    const tools: ChatToolName[] = [
      "search_calendar_activities",
      "get_academic_calendar",
      "get_upcoming_events",
      "get_session_timeline",
      "get_lecture_weeks",
      "get_today_status",
    ];
    if (ctx.topicRoute.topics.includes("public_holiday")) {
      tools.push("get_public_holiday_meta", "get_public_holidays");
    }
    return tools;
  }

  const tools = new Set<ChatToolName>();
  const { topics } = ctx.topicRoute;
  const dayScope = resolveDateScope(ctx.message, ctx.todayISO);
  const wantsToday =
    messageAsksDayStatus(ctx.message) || dayScope?.kind === "day";

  if (topics.includes("academic_calendar")) {
    tools.add("search_calendar_activities");
    tools.add("get_academic_calendar");
    tools.add("get_session_timeline");
    if (messageAsksNextUpcomingEvent(ctx.message) || ctx.activityMatches.length === 0) {
      tools.add("get_upcoming_events");
    }
    if (wantsToday) tools.add("get_today_status");
  }

  if (topics.includes("lecture_weeks")) {
    tools.add("get_lecture_weeks");
    if (!tools.has("search_calendar_activities")) {
      tools.add("search_calendar_activities");
    }
  }

  if (topics.includes("public_holiday")) {
    tools.add("get_public_holiday_meta");
    tools.add("get_public_holidays");
  }

  if (
    topics.includes("uitm_general") ||
    messageLooksLikeExplanationOrOpinion(ctx.message) ||
    mode === "explain"
  ) {
    tools.add("search_uitm_knowledge");
  }

  if (mode === "explain" && topics.includes("academic_calendar")) {
    tools.add("search_calendar_activities");
    tools.add("get_academic_calendar");
  }

  if (ctx.activityMatches.length > 0) {
    tools.add("search_calendar_activities");
  }

  if (tools.size === 0 && !modePrefersNoCalendarTools(mode)) {
    tools.add("search_calendar_activities");
    tools.add("get_academic_calendar");
  }

  return [...tools];
}
