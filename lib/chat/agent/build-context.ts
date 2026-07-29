import type { MatchedActivity } from "@/lib/chat/activity-match";
import type { CalendarContextIntent } from "@/lib/chat/calendar-intent";
import type { ResolvedQueryScope } from "@/lib/chat/query-scope";
import type { TopicRouteResult } from "@/lib/chat/topic-router";
import type { AgentTurnContext } from "@/lib/chat/agent/types";
import type { Activity, SessionId } from "@/lib/data";

export function buildAgentTurnContext(params: {
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
}): AgentTurnContext {
  return {
    message: params.message,
    todayISO: params.todayISO,
    todayFormatted: params.todayFormatted,
    program: params.program,
    programLabel: params.programLabel,
    primaryGroup: params.primaryGroup,
    secondaryGroup: params.secondaryGroup,
    effectiveSessions: params.effectiveSessions,
    contextSessionIds: params.contextSessionIds,
    topicRoute: params.topicRoute,
    activityMatches: params.activityMatches,
    queryScope: params.queryScope,
    contextIntent: params.contextIntent,
    useIntentFilter: params.useIntentFilter,
    primaryActivities: params.primaryActivities,
    sessionListContext: params.sessionListContext,
    comparisonContext: params.comparisonContext,
    includeSecondary: params.includeSecondary,
    secondaryActivitiesCount: 0,
  };
}
