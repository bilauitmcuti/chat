import {
  formatClosestActivitiesBlock,
  formatMatchedActivitiesBlock,
  searchActivitiesInMessage,
  flattenActivitiesWithSession,
  HIGH_CONFIDENCE_MATCH_SCORE,
  WEAK_CANDIDATE_MIN_SCORE,
} from "@/lib/chat/activity-match";
import {
  computeQuickReferenceForSessions,
  formatPrimaryCalendarContext,
  formatActivitiesAsContext,
  getFilteredActivitiesForSession,
  MAX_PRIMARY_CONTEXT_CHARS_COMPACT,
  MAX_SECONDARY_CONTEXT_CHARS,
} from "@/lib/chat/context";
import { filterActivitiesByDateScope, resolveDateScope } from "@/lib/chat/date-scope";
import {
  buildLectureWeekQuickReference,
  buildLectureWeeksTableBlock,
  needsLectureWeekTable,
} from "@/lib/chat/lecture-week-context";
import { buildPublicHolidayChatContext } from "@/lib/chat/public-holiday-context";
import { buildQueryScopeBlock, buildSessionTimelineBlock } from "@/lib/chat/query-scope";
import { messageAsksNextUpcomingEvent } from "@/lib/chat/topic-router";
import { toPromptDate } from "@/lib/chat/dates";
import type { AgentTurnContext, ChatToolName } from "@/lib/chat/agent/types";
import { truncateToolOutput } from "@/lib/chat/agent/types";
import { searchUitmKnowledge } from "@/lib/chat/agent/tools/search-uitm-knowledge";
import { getFilteredGroupBActivities } from "@/lib/chat/context";
import { getDefaultSessionForGroup } from "@/lib/data";

function parseToolArgs(args: Record<string, unknown>): Record<string, unknown> {
  return args ?? {};
}

function formatToolMiss(params: {
  tool: string;
  searched: string;
  scope: string;
  suggest: string;
}): string {
  return [
    "=== TOOL RESULT (no exact match) ===",
    `Tool: ${params.tool}`,
    `Scope: ${params.scope}`,
    `Searched: ${params.searched}`,
    "Exact rows: none in this scope.",
    `Next: ${params.suggest}`,
    "You may still answer explain/opinion/justification questions with general UiTM guidance — label uncertainty; do not invent dates.",
  ].join("\n");
}

function formatSearchPartialResult(params: {
  searched: string;
  scope: string;
  closestBlock: string;
  calendarExcerpt: string;
}): string {
  const parts = [
    "=== SEARCH RESULT (no exact single match — use closest rows + calendar below) ===",
    `Searched: ${params.searched}`,
    `Scope: ${params.scope}`,
  ];
  if (params.closestBlock) parts.push(params.closestBlock);
  if (params.calendarExcerpt) parts.push(params.calendarExcerpt);
  parts.push(
    "Answer using the closest official activity name above if it fits the user's words. If still unclear, name the top candidates and state uncertainty. Copy dates only from these rows."
  );
  return parts.filter(Boolean).join("\n\n");
}

function formatActivityNamesList(
  sessionIds: import("@/lib/data").SessionId[],
  program: string,
  group: "A" | "B"
): string {
  const flat = flattenActivitiesWithSession(sessionIds, (sid) =>
    getFilteredActivitiesForSession(sid, program, group)
  );
  const names = [...new Set(flat.map(({ activity }) => activity.name))];
  const lines = names.slice(0, 80).map((n) => `- ${n}`);
  return [
    "=== OFFICIAL ACTIVITY NAMES (browse — use search_calendar_activities with full name for dates) ===",
    ...lines,
  ].join("\n");
}

function sessionScopeLine(ctx: AgentTurnContext): string {
  const sessions =
    ctx.effectiveSessions.length > 0
      ? ctx.effectiveSessions.join(", ")
      : ctx.contextSessionIds.join(", ") || "(default)";
  return `Program ${ctx.programLabel}, GROUP ${ctx.primaryGroup}, session(s) ${sessions}`;
}

function formatStructuredToolOutput(
  rows: Record<string, unknown>[],
  humanText: string
): string {
  if (rows.length === 0) return humanText;
  return `${JSON.stringify({ rows })}\n\n${humanText}`;
}

function matchedActivitiesToRows(matches: import("@/lib/chat/activity-match").MatchedActivity[]) {
  return matches.map(({ activity, sessionId }) => ({
    sessionId,
    name: activity.name,
    start: toPromptDate(activity.startDate),
    end: activity.endDate ? toPromptDate(activity.endDate) : undefined,
  }));
}

export async function executeChatTool(
  name: ChatToolName,
  args: Record<string, unknown>,
  ctx: AgentTurnContext
): Promise<string> {
  switch (name) {
    case "search_calendar_activities":
      return executeSearchCalendarActivities(args, ctx);
    case "get_academic_calendar":
      return executeGetAcademicCalendar(args, ctx);
    case "get_upcoming_events":
      return executeGetUpcomingEvents(ctx);
    case "get_session_timeline":
      return executeGetSessionTimeline(ctx);
    case "get_lecture_weeks":
      return executeGetLectureWeeks(args, ctx);
    case "get_public_holidays":
      return executeGetPublicHolidays(args, ctx);
    case "search_uitm_knowledge":
      return executeSearchUitmKnowledge(args, ctx);
    default:
      return `(unknown tool: ${name})`;
  }
}

function executeSearchCalendarActivities(
  args: Record<string, unknown>,
  ctx: AgentTurnContext
): string {
  const parsed = parseToolArgs(args);
  const query = String(parsed.query ?? ctx.message).trim();
  const searchText = query || ctx.message;

  if (ctx.activityMatches.length > 0 && !parsed.query) {
    const human = formatMatchedActivitiesBlock(ctx.activityMatches);
    return truncateToolOutput(
      formatStructuredToolOutput(matchedActivitiesToRows(ctx.activityMatches), human)
    );
  }

  const flatPool = flattenActivitiesWithSession(ctx.contextSessionIds, (sid) =>
    getFilteredActivitiesForSession(sid, ctx.program, ctx.primaryGroup)
  );

  const strongMatches = searchActivitiesInMessage(searchText, flatPool, {
    minScore: HIGH_CONFIDENCE_MATCH_SCORE,
  });
  if (strongMatches.length > 0) {
    const human = formatMatchedActivitiesBlock(strongMatches);
    return truncateToolOutput(
      formatStructuredToolOutput(matchedActivitiesToRows(strongMatches), human)
    );
  }

  const dateScope = resolveDateScope(searchText, ctx.todayISO);
  if (dateScope) {
    const scoped = filterActivitiesByDateScope(ctx.primaryActivities, dateScope);
    const lines: string[] = [
      `=== SCOPED CALENDAR (${dateScope.kind}: ${dateScope.label}) ===`,
    ];
    if (scoped.length === 0) {
      lines.push("(no rows overlap this period)");
    } else {
      const rows = scoped.slice(0, 24).map((a) => ({
        name: a.name,
        start: toPromptDate(a.startDate),
        end: a.endDate ? toPromptDate(a.endDate) : undefined,
      }));
      for (const a of scoped.slice(0, 24)) {
        let range = toPromptDate(a.startDate);
        if (a.endDate) range += ` to ${toPromptDate(a.endDate)}`;
        lines.push(`- ${a.name}: ${range}`);
      }
      const human = lines.join("\n");
      return truncateToolOutput(formatStructuredToolOutput(rows, human));
    }
    return truncateToolOutput(lines.join("\n"));
  }

  const weakCandidates = searchActivitiesInMessage(searchText, flatPool, {
    maxResults: 5,
    minScore: WEAK_CANDIDATE_MIN_SCORE,
  }).filter((m) => m.score < HIGH_CONFIDENCE_MATCH_SCORE);

  const closestBlock = formatClosestActivitiesBlock(weakCandidates);
  const calendarExcerpt = executeGetAcademicCalendar(args, ctx, {
    forceFullCalendar: true,
    mode: "full",
  });

  return truncateToolOutput(
    formatSearchPartialResult({
      searched: searchText,
      scope: sessionScopeLine(ctx),
      closestBlock,
      calendarExcerpt,
    })
  );
}

function executeGetAcademicCalendar(
  args: Record<string, unknown>,
  ctx: AgentTurnContext,
  internal?: { forceFullCalendar?: boolean; mode?: "names_only" | "full" }
): string {
  const parsed = parseToolArgs(args);
  const includeSecondary =
    parsed.include_secondary_group === true || ctx.includeSecondary;
  const mode =
    internal?.mode ??
    (parsed.mode === "names_only" || parsed.mode === "full"
      ? (parsed.mode as "names_only" | "full")
      : "full");
  const useIntentFilter = internal?.forceFullCalendar ? false : ctx.useIntentFilter;

  if (mode === "names_only") {
    return truncateToolOutput(
      formatActivityNamesList(ctx.contextSessionIds, ctx.program, ctx.primaryGroup)
    );
  }

  const primary = formatPrimaryCalendarContext(
    ctx.contextSessionIds,
    ctx.program,
    ctx.primaryGroup,
    ctx.contextIntent,
    { useIntentFilter }
  );
  let out = [
    `=== SESSION LIST (GROUP ${ctx.primaryGroup}) ===`,
    ctx.sessionListContext,
    `=== GROUP ${ctx.primaryGroup} ACADEMIC CALENDAR ===`,
    truncateToolOutput(primary, MAX_PRIMARY_CONTEXT_CHARS_COMPACT),
  ].join("\n\n");

  if (includeSecondary) {
    const secondaryId =
      ctx.primaryGroup === "A"
        ? getDefaultSessionForGroup("B")
        : getDefaultSessionForGroup("A");
    const secondaryGroup = ctx.primaryGroup === "A" ? "B" : "A";
    const secondaryActs =
      secondaryGroup === "B"
        ? getFilteredGroupBActivities(ctx.program, [secondaryId])
        : getFilteredActivitiesForSession(secondaryId, ctx.program, "A");
    const secondaryText = truncateToolOutput(
      formatActivitiesAsContext(secondaryActs),
      MAX_SECONDARY_CONTEXT_CHARS
    );
    out += `\n\n=== GROUP ${ctx.secondaryGroup} (reference only) ===\n${secondaryText}`;
  }

  if (ctx.comparisonContext) {
    out += `\n\n=== SESSION COMPARISON ===\n${ctx.comparisonContext}`;
  }

  return truncateToolOutput(out);
}

function executeGetUpcomingEvents(ctx: AgentTurnContext): string {
  if (!messageAsksNextUpcomingEvent(ctx.message) && ctx.activityMatches.length > 0) {
    return "(use search_calendar_activities for named events)";
  }
  const ref = computeQuickReferenceForSessions(
    ctx.contextSessionIds,
    ctx.program,
    ctx.primaryGroup,
    ctx.todayISO,
    ctx.useIntentFilter ? ctx.contextIntent : "all"
  );
  if (!ref) {
    return formatToolMiss({
      tool: "get_upcoming_events",
      searched: "next/upcoming events",
      scope: sessionScopeLine(ctx),
      suggest: "call get_academic_calendar or search_calendar_activities for specific event names",
    });
  }
  return truncateToolOutput(
    `=== UPCOMING HINTS (today ${ctx.todayISO}) ===\n${ref}`
  );
}

function executeGetSessionTimeline(ctx: AgentTurnContext): string {
  const parts: string[] = [];
  const scopeBlock = buildQueryScopeBlock(ctx.queryScope, ctx.effectiveSessions);
  if (scopeBlock) parts.push(scopeBlock);
  parts.push(buildSessionTimelineBlock(ctx.contextSessionIds, ctx.primaryGroup));
  return truncateToolOutput(parts.filter(Boolean).join("\n\n"));
}

async function executeGetLectureWeeks(
  args: Record<string, unknown>,
  ctx: AgentTurnContext
): Promise<string> {
  const parsed = parseToolArgs(args);
  const wantTable =
    parsed.full_table === true || needsLectureWeekTable(ctx.message);

  if (wantTable) {
    const table = await buildLectureWeeksTableBlock(ctx.contextSessionIds);
    const human =
      table ||
      formatToolMiss({
        tool: "get_lecture_weeks",
        searched: "full lecture week table",
        scope: sessionScopeLine(ctx),
        suggest: "lecture week API may be unavailable for this session",
      });
    return truncateToolOutput(
      formatStructuredToolOutput([{ mode: "full_table", scope: sessionScopeLine(ctx) }], human)
    );
  }
  const quick = await buildLectureWeekQuickReference(ctx.contextSessionIds, ctx.todayISO);
  const human =
    quick ||
    formatToolMiss({
      tool: "get_lecture_weeks",
      searched: "current lecture week",
      scope: sessionScopeLine(ctx),
      suggest: "try full_table=true if user asked for all weeks",
    });
  return truncateToolOutput(
    formatStructuredToolOutput([{ mode: "current", scope: sessionScopeLine(ctx) }], human)
  );
}

async function executeGetPublicHolidays(
  args: Record<string, unknown>,
  ctx: AgentTurnContext
): Promise<string> {
  const parsed = parseToolArgs(args);
  const query = String(parsed.query ?? ctx.message);
  const ph = await buildPublicHolidayChatContext(query, ctx.todayISO, {
    sessionIds: ctx.contextSessionIds,
  });
  const parts: string[] = [];
  if (ph.block) parts.push(ph.block);
  if (!ph.block) {
    parts.push(
      formatToolMiss({
        tool: "get_public_holidays",
        searched: query,
        scope: `Malaysia public holidays (today ${ctx.todayISO})`,
        suggest: "try a specific month, state, or date in the query",
      })
    );
  }
  return truncateToolOutput(parts.join("\n\n"));
}

function executeSearchUitmKnowledge(
  args: Record<string, unknown>,
  ctx: AgentTurnContext
): string {
  const parsed = parseToolArgs(args);
  const query = String(parsed.query ?? ctx.message).trim();
  return searchUitmKnowledge(query);
}
