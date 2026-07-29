import type { Activity, SessionId } from "@/lib/data";
import {
  flattenActivitiesWithSession,
  formatMatchedActivitiesBlock,
  matchActivitiesInMessage,
} from "@/lib/chat/activity-match";
import { buildQueryScopeBlock, buildSessionTimelineBlock } from "@/lib/chat/query-scope";
import type { ResolvedQueryScope } from "@/lib/chat/query-scope";
import {
  buildLectureWeekQuickReference,
  buildLectureWeeksTableBlock,
  needsLectureWeekTable,
} from "@/lib/chat/lecture-week-context";
import { buildPublicHolidayChatContext } from "@/lib/chat/public-holiday-context";
import {
  messageAsksNextUpcomingEvent,
  type ChatTopic,
  type TopicRouteResult,
} from "@/lib/chat/topic-router";
import {
  computeQuickReferenceForSessions,
  getFilteredActivitiesForSession,
} from "@/lib/chat/context";
import type { CalendarContextIntent } from "@/lib/chat/calendar-intent";
import {
  filterActivitiesByDateScope,
  messageExplicitlyRequestsDateScope,
  resolveDateScope,
} from "@/lib/chat/date-scope";
import { toPromptDate } from "@/lib/chat/dates";

export interface BuildDataContextParams {
  message: string;
  todayISO: string;
  route: TopicRouteResult;
  contextSessionIds: SessionId[];
  primaryGroup: "A" | "B";
  program: string;
  queryScope: ResolvedQueryScope;
  effectiveSessions: SessionId[];
  primaryActivities: Activity[];
  contextIntent: CalendarContextIntent;
  /** Include intent-based row filter only when true. */
  useIntentFilter: boolean;
}

export async function buildDataContextForTurn(
  params: BuildDataContextParams
): Promise<{ dataContext: string; publicHolidayDirective: string }> {
  const {
    message,
    todayISO,
    route,
    contextSessionIds,
    primaryGroup,
    program,
    queryScope,
    effectiveSessions,
    primaryActivities,
    contextIntent,
    useIntentFilter,
  } = params;

  const parts: string[] = [];
  let publicHolidayDirective = "";

  const flatForMatch = flattenActivitiesWithSession(contextSessionIds, (sid) =>
    getFilteredActivitiesForSession(sid, program, primaryGroup)
  );
  const matches = matchActivitiesInMessage(message, flatForMatch);
  const matchedBlock = formatMatchedActivitiesBlock(matches);
  if (matchedBlock) parts.push(matchedBlock);

  if (route.topics.includes("academic_calendar")) {
    const scopeBlock = buildQueryScopeBlock(queryScope, effectiveSessions);
    if (scopeBlock) parts.push(scopeBlock);

    parts.push(buildSessionTimelineBlock(contextSessionIds, primaryGroup));

    if (
      messageAsksNextUpcomingEvent(message) &&
      matches.length === 0 &&
      !route.hasNamedActivity
    ) {
      const nextRef = computeQuickReferenceForSessions(
        contextSessionIds,
        program,
        primaryGroup,
        todayISO,
        useIntentFilter ? contextIntent : "all"
      );
      if (nextRef) {
        parts.push(
          `=== UPCOMING HINTS (today ${todayISO}) ===\n${nextRef}\nUse only if the user asked for next/upcoming and did not name a specific activity.`
        );
      }
    }

    if (messageExplicitlyRequestsDateScope(message)) {
      const dateScope = resolveDateScope(message, todayISO);
      if (dateScope) {
        const scoped = filterActivitiesByDateScope(primaryActivities, dateScope);
        const lines: string[] = [
          `=== SCOPED CALENDAR (${dateScope.kind}: ${dateScope.label}) ===`,
        ];
        if (scoped.length === 0) {
          lines.push("(no rows overlap this period — see full GROUP calendar below)");
        } else {
          for (const a of scoped.slice(0, 24)) {
            let range = toPromptDate(a.startDate);
            if (a.endDate) range += ` to ${toPromptDate(a.endDate)}`;
            lines.push(`- ${a.name}: ${range}`);
          }
        }
        parts.push(lines.join("\n"));
      }
    }
  }

  if (route.topics.includes("lecture_weeks")) {
    const lectureRef = await buildLectureWeekQuickReference(contextSessionIds, todayISO);
    if (lectureRef) parts.push(lectureRef);
    if (needsLectureWeekTable(message)) {
      const table = await buildLectureWeeksTableBlock(contextSessionIds);
      if (table) parts.push(table);
    }
  }

  if (route.topics.includes("public_holiday")) {
    const phCtx = await buildPublicHolidayChatContext(message, todayISO, {
      sessionIds: contextSessionIds,
    });
    publicHolidayDirective = phCtx.directive;
    if (phCtx.block) parts.push(phCtx.block);
  }

  return {
    dataContext: parts.filter(Boolean).join("\n\n"),
    publicHolidayDirective,
  };
}

export function shouldUseCalendarIntentFilter(
  route: TopicRouteResult,
  matchCount: number
): boolean {
  if (route.hasNamedActivity || matchCount > 0) return false;
  return true;
}

export function topicNeedsCalendarPrompt(topics: ChatTopic[]): boolean {
  return (
    topics.includes("academic_calendar") ||
    topics.includes("lecture_weeks") ||
    topics.includes("public_holiday")
  );
}
