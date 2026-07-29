import { parseFiltersFromCookie } from "@/lib/cookie-utils";
import {
  calendarProgramQueryForRoute,
  type CalendarSessionResult,
} from "@/lib/calendar-api";
import { fetchCalendarSession } from "@/lib/calendar-api-server";
import { mergeLectureWeekRecords } from "@/lib/lecture-weeks-resolve";
import { resolveSessionsForProgram } from "@/lib/calendar-session-resolve";
import { fetchMetaCachedEntireForRsc } from "@/lib/calendar-server-meta";
import type { CalendarSnapshot } from "@/lib/calendar-store";
import type { Activity, SessionId } from "@/lib/data";
import {
  getGroupFromProgram,
  getSessionMemoryKey,
} from "@/lib/session-memory";
import {
  getProgramFromRoute,
  type ProgramValue,
} from "@/lib/route-utils";
import { buildHydrateKey } from "@/lib/calendar-hydrate-key";

function resolveProgramForServer(
  programFromRoute: string,
  _filters: ReturnType<typeof parseFiltersFromCookie>
): ProgramValue {
  if (programFromRoute && programFromRoute !== "All") {
    const fromRoute = getProgramFromRoute(programFromRoute);
    if (fromRoute !== "All") return fromRoute;
  }
  // `/` and `/list` are always Group B (All); do not restore Foundation/Professional from cookie.
  return "All";
}

/**
 * Mirrors SharedCalendarLayout session resolution using meta only (no activity date ranges).
 */
function resolveInitialSessionIds(
  program: ProgramValue,
  filters: ReturnType<typeof parseFiltersFromCookie>,
  meta: Awaited<ReturnType<typeof fetchMetaCachedEntireForRsc>>,
  currentDateStr: string
): SessionId[] {
  const programGroup = getGroupFromProgram(program);
  const sessionMemoryKey = getSessionMemoryKey(program);

  const nextMap: Partial<Record<ProgramValue, SessionId[]>> = {};
  const rawMap = filters.sessionIdsByProgram;
  if (rawMap && typeof rawMap === "object") {
    for (const [key, value] of Object.entries(rawMap)) {
      if (!Array.isArray(value) || value.length === 0) continue;
      const p = key as ProgramValue;
      const g = getGroupFromProgram(p);
      const normalized = value.filter((id) => id.startsWith(`${g}-`));
      if (normalized.length > 0) nextMap[getSessionMemoryKey(p)] = normalized;
    }
  }

  const fromProgram = nextMap[sessionMemoryKey];
  let candidates: SessionId[];
  if (fromProgram && fromProgram.length > 0) {
    candidates = fromProgram;
  } else {
    const rawCandidates =
      filters.sessionIds && filters.sessionIds.length > 0
        ? filters.sessionIds
        : filters.sessionId
          ? [filters.sessionId]
          : [];
    candidates = rawCandidates.filter((id) => id.startsWith(`${programGroup}-`));
  }

  return resolveSessionsForProgram({
    meta,
    program,
    candidates,
    dateStr: currentDateStr,
  }).sessions;
}

const CALENDAR_HYDRATE_VERSION = 1;

export interface InitialCalendarLoadResult {
  snapshot: CalendarSnapshot | null;
  /** Program used when fetching `snapshot.sessions` (Group B query varies by program). */
  programUsed: ProgramValue | null;
  /** `${program}|${sorted session ids}` — matches client `loadKey` when SSR and client agree. */
  hydrateKey: string | null;
  /** ISO date → lecture week number for header badge SSR (empty when unavailable). */
  lectureWeekByDate: Record<string, number> | null;
}

function buildHydrateKeyForProgram(program: ProgramValue, sessionIds: SessionId[]): string {
  return buildHydrateKey(program, sessionIds);
}

/**
 * Load meta + selected sessions for the calendar shell so the first paint matches cookies/route.
 */
export async function loadInitialCalendarSnapshot(params: {
  programFromRoute: string;
  /** Raw `calendar-filters` cookie value, or null */
  cookieValue: string | null | undefined;
  /** Malaysia (or app) calendar date YYYY-MM-DD for default session when filters omit sessions */
  currentDateStr: string;
}): Promise<InitialCalendarLoadResult> {
  try {
    const meta = await fetchMetaCachedEntireForRsc();
    const filters = parseFiltersFromCookie(params.cookieValue, meta.defaultSession);
    const program = resolveProgramForServer(params.programFromRoute, filters);
    const selectedSessions = resolveInitialSessionIds(
      program,
      filters,
      meta,
      params.currentDateStr
    );
    const hydrateKey = buildHydrateKeyForProgram(program, selectedSessions);
    const group = getGroupFromProgram(program);
    const programQ = calendarProgramQueryForRoute(program);
    const targets = selectedSessions.filter((id) => id.startsWith(`${group}-`));
    const baseSnapshot = {
      version: CALENDAR_HYDRATE_VERSION,
      sessionOptions: meta.sessionOptions,
      programOptions: meta.programOptions,
      defaultSession: meta.defaultSession,
      sessions: {} as Record<string, { activities: Activity[] }>,
      lectureWeekByDate: {} as Record<string, number>,
      lectureWeekBySession: {} as Record<string, Record<string, number>>,
    };

    if (targets.length === 0) {
      return {
        snapshot: { ...baseSnapshot, sessions: {} },
        programUsed: program,
        hydrateKey,
        lectureWeekByDate: null,
      };
    }

    const sessionResults = await Promise.all(
      targets.map(async (sid) => {
        const g = sid.startsWith("A-") ? "A" : "B";
        const result = await fetchCalendarSession({
          sessionId: sid,
          group: g,
          program: g === "B" ? (programQ ?? "All") : undefined,
        }).catch((): CalendarSessionResult => ({ activities: [] }));
        return [sid, result] as const;
      })
    );

    const merges: Record<string, { activities: Activity[] }> = {};
    const lectureWeekBySession: Record<string, Record<string, number>> = {};
    const weekRecords: Record<string, number>[] = [];
    for (const [sid, payload] of sessionResults) {
      merges[sid] = { activities: payload.activities };
      if (payload.lectureWeekByDate) {
        lectureWeekBySession[sid] = payload.lectureWeekByDate;
        weekRecords.push(payload.lectureWeekByDate);
      }
    }

    const lectureWeekByDate = mergeLectureWeekRecords(weekRecords);
    const hasWeeks = Object.keys(lectureWeekByDate).length > 0;

    return {
      snapshot: {
        ...baseSnapshot,
        sessions: merges,
        lectureWeekByDate: hasWeeks ? lectureWeekByDate : {},
        lectureWeekBySession,
      },
      programUsed: program,
      hydrateKey,
      lectureWeekByDate: hasWeeks ? lectureWeekByDate : null,
    };
  } catch {
    return {
      snapshot: null,
      programUsed: null,
      hydrateKey: null,
      lectureWeekByDate: null,
    };
  }
}
