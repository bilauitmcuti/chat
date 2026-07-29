import { formatMatchedActivitiesBlock } from "@/lib/chat/activity-match";
import { buildDataContextForTurn } from "@/lib/chat/build-data-context";
import {
  buildChatAssistantSystemPrompt,
  usesResearchStylePrompt,
} from "@/lib/chat/chat-prompt";
import {
  buildResearchSystemPrompt,
  formatPrimaryCalendarContext,
  formatActivitiesAsContext,
  getFilteredGroupBActivities,
  MAX_PRIMARY_CONTEXT_CHARS_COMPACT,
  MAX_SECONDARY_CONTEXT_CHARS,
} from "@/lib/chat/context";
import { getDefaultSessionForGroup, getActivitiesForSession } from "@/lib/data";
import type { AgentTurnContext } from "@/lib/chat/agent/types";
import type { CalendarContextIntent } from "@/lib/chat/calendar-intent";

export interface CompactFallbackParams {
  ctx: AgentTurnContext;
  sessionListContext: string;
  secondaryContext: string;
  comparisonContext: string;
  includeSecondary: boolean;
  includeUitmSupplement: boolean;
  uitmSupplement: string;
  wantsTableOutput: boolean;
  multipleSessionsSelected: boolean;
  contextIntent: CalendarContextIntent;
  useIntentFilter: boolean;
}

/**
 * Dev-tier / Gemma single-stream fallback when the tool agent is not used.
 * Injects compact API-backed context instead of the full production prompt.
 */
export async function buildCompactFallbackSystemPrompt(
  params: CompactFallbackParams
): Promise<string> {
  const { ctx } = params;
  const useResearchOnly =
    usesResearchStylePrompt(ctx.topicRoute.topics) &&
    !ctx.topicRoute.topics.some(
      (t) => t === "academic_calendar" || t === "lecture_weeks" || t === "public_holiday"
    );

  const { dataContext, publicHolidayDirective } = await buildDataContextForTurn({
    message: ctx.message,
    todayISO: ctx.todayISO,
    route: ctx.topicRoute,
    contextSessionIds: ctx.contextSessionIds,
    primaryGroup: ctx.primaryGroup,
    program: ctx.program,
    queryScope: ctx.queryScope,
    effectiveSessions: ctx.effectiveSessions,
    primaryActivities: ctx.primaryActivities,
    contextIntent: params.contextIntent,
    useIntentFilter: params.useIntentFilter,
  });

  let dataContextFull = dataContext;
  if (params.comparisonContext) {
    dataContextFull = dataContextFull
      ? `${dataContextFull}\n\n=== SESSION COMPARISON ===\n${params.comparisonContext}`
      : params.comparisonContext;
  }
  if (ctx.activityMatches.length > 0) {
    const matched = formatMatchedActivitiesBlock(ctx.activityMatches);
    dataContextFull = matched + (dataContextFull ? `\n\n${dataContextFull}` : "");
  }

  if (useResearchOnly) {
    return (
      buildResearchSystemPrompt(ctx.todayFormatted) +
      (dataContextFull ? `\n\n${dataContextFull}` : "") +
      publicHolidayDirective
    );
  }

  const primaryContext = formatPrimaryCalendarContext(
    ctx.contextSessionIds,
    ctx.program,
    ctx.primaryGroup,
    params.contextIntent,
    { useIntentFilter: params.useIntentFilter }
  );

  let secondaryContext = params.secondaryContext;
  if (params.includeSecondary && !secondaryContext) {
    const secondaryId =
      ctx.primaryGroup === "A"
        ? getDefaultSessionForGroup("B")
        : getDefaultSessionForGroup("A");
    const secondaryGroup = ctx.primaryGroup === "A" ? "B" : "A";
    const acts =
      secondaryGroup === "B"
        ? getFilteredGroupBActivities(ctx.program, [secondaryId])
        : getActivitiesForSession(secondaryId);
    secondaryContext = formatActivitiesAsContext(acts).slice(0, MAX_SECONDARY_CONTEXT_CHARS);
  }

  return (
    buildChatAssistantSystemPrompt({
      programLabel: ctx.programLabel,
      primaryGroup: ctx.primaryGroup,
      secondaryGroup: ctx.secondaryGroup,
      todayFormatted: ctx.todayFormatted,
      sessionListContext: params.sessionListContext,
      primaryContext,
      secondaryContext: params.includeSecondary ? secondaryContext : "",
      dataContext: dataContextFull,
      topics: ctx.topicRoute.topics,
      selectedSessionCount: ctx.effectiveSessions.length,
      forceTableOutput: params.wantsTableOutput,
      multipleSessionsSelected: params.multipleSessionsSelected,
      uitmSupplement: params.includeUitmSupplement ? params.uitmSupplement : "",
      includeSecondaryContext: params.includeSecondary,
      maxPrimaryChars: MAX_PRIMARY_CONTEXT_CHARS_COMPACT,
    }) + publicHolidayDirective
  );
}
