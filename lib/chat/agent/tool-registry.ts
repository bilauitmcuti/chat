import { messageAsksNextUpcomingEvent } from "@/lib/chat/topic-router";
import type { AgentTurnContext, ChatToolName } from "@/lib/chat/agent/types";

/**
 * Hybrid tool exposure: topic-router narrows which tools the model may call.
 */
export function buildToolRegistryForTurn(ctx: AgentTurnContext): ChatToolName[] {
  const tools = new Set<ChatToolName>();
  const { topics } = ctx.topicRoute;

  if (topics.includes("academic_calendar")) {
    tools.add("search_calendar_activities");
    tools.add("get_academic_calendar");
    tools.add("get_session_timeline");
    if (messageAsksNextUpcomingEvent(ctx.message) || ctx.activityMatches.length === 0) {
      tools.add("get_upcoming_events");
    }
  }

  if (topics.includes("lecture_weeks")) {
    tools.add("get_lecture_weeks");
    if (!tools.has("search_calendar_activities")) {
      tools.add("search_calendar_activities");
    }
  }

  if (topics.includes("public_holiday")) {
    tools.add("get_public_holidays");
  }

  if (topics.includes("uitm_general")) {
    tools.add("search_uitm_knowledge");
  }

  if (ctx.activityMatches.length > 0) {
    tools.add("search_calendar_activities");
  }

  const hasUitmScope =
    topics.includes("academic_calendar") ||
    topics.includes("lecture_weeks") ||
    topics.includes("public_holiday") ||
    topics.includes("uitm_general");

  if (hasUitmScope && !tools.has("search_uitm_knowledge")) {
    tools.add("search_uitm_knowledge");
  }

  if (tools.size === 0) {
    tools.add("search_calendar_activities");
    tools.add("get_academic_calendar");
  }

  return [...tools];
}
