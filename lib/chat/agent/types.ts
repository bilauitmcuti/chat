import type { CalendarContextIntent } from "@/lib/chat/calendar-intent";
import type { MatchedActivity } from "@/lib/chat/activity-match";
import type { ResolvedQueryScope } from "@/lib/chat/query-scope";
import type { TopicRouteResult } from "@/lib/chat/topic-router";
import type { Activity, SessionId } from "@/lib/data";

export const CHAT_TOOL_NAMES = [
  "search_calendar_activities",
  "get_academic_calendar",
  "get_upcoming_events",
  "get_session_timeline",
  "get_lecture_weeks",
  "get_public_holidays",
  "search_uitm_knowledge",
] as const;

export type ChatToolName = (typeof CHAT_TOOL_NAMES)[number];

export interface WorkersAiToolSchema {
  name: ChatToolName;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, { type: string; description?: string }>;
    required?: string[];
  };
}

export interface AgentTurnContext {
  message: string;
  todayISO: string;
  todayFormatted: string;
  program: string;
  programLabel: string;
  primaryGroup: "A" | "B";
  secondaryGroup: "A" | "B";
  effectiveSessions: SessionId[];
  contextSessionIds: SessionId[];
  topicRoute: TopicRouteResult;
  activityMatches: MatchedActivity[];
  queryScope: ResolvedQueryScope;
  contextIntent: CalendarContextIntent;
  useIntentFilter: boolean;
  primaryActivities: Activity[];
  sessionListContext: string;
  comparisonContext: string;
  includeSecondary: boolean;
  secondaryActivitiesCount: number;
}

export interface AgentRunResult {
  reply: string;
  toolsUsed: string[];
  usedAgentLoop: boolean;
}

export const MAX_TOOL_OUTPUT_CHARS = 4_000;
/** Agent tool-step ceiling when deterministic prefetch falls back to the tool loop. */
export const MAX_AGENT_TOOL_STEPS = 2;

export function truncateToolOutput(text: string, max = MAX_TOOL_OUTPUT_CHARS): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + "\n...[truncated]";
}
