import type { FilterStates } from "@/lib/cookie-utils";
import { isGroupASessionId } from "@/lib/group-a-sessions";
import { type SessionId } from "@/lib/data";
import {
  getGroupFromProgram,
  getSessionMemoryKey,
  normalizeSessionsForGroup,
} from "@/lib/session-memory";
import {
  getProgramFromRoute,
  getRoutePath,
  isProgramValue,
  isValidProgramRoute,
  type ProgramValue,
} from "@/lib/route-utils";

/** Session id format used as query key, e.g. `B-20263`, `A-20264`. */
export const SESSION_ID_QUERY_PATTERN = /^[AB]-\d+$/;

export function isSessionIdQueryKey(key: string): boolean {
  return SESSION_ID_QUERY_PATTERN.test(key);
}

/** Collect session ids from query keys matching `A-20264` / `B-20263`. */
export function parseSessionIdsFromSearchParams(
  searchParams: URLSearchParams
): SessionId[] {
  const seen = new Set<string>();
  const result: SessionId[] = [];
  for (const key of searchParams.keys()) {
    if (!isSessionIdQueryKey(key) || seen.has(key)) continue;
    if (key.startsWith("A-") && !isGroupASessionId(key)) continue;
    seen.add(key);
    result.push(key);
  }
  return result;
}

export function hasSessionQueryParams(searchParams: URLSearchParams): boolean {
  return parseSessionIdsFromSearchParams(searchParams).length > 0;
}

export function buildCleanCalendarUrl(pathname: string): string {
  return pathname || "/";
}

const SITE_ORIGIN = "https://bilauitmcuti.com";

/** Bare session keys joined for the query string, e.g. `B-20263&A-20264`. */
export function buildSessionQueryString(sessionIds: SessionId[]): string {
  return sessionIds.filter(isSessionIdQueryKey).join("&");
}

/** Pathname with optional session (+ filter) query, e.g. `/diploma?B-20263&lecture`. */
export function buildCalendarUrlPath(
  pathname: string,
  sessionIds: SessionId[],
  filterKeys: string[] = []
): string {
  const sessionQs = buildSessionQueryString(sessionIds);
  const filterQs = filterKeys
    .filter((key) => typeof key === "string" && key.length > 0)
    .filter((key, i, arr) => arr.indexOf(key) === i)
    .join("&");
  const qs = [sessionQs, filterQs].filter(Boolean).join("&");
  const path = pathname || "/";
  if (!qs) return path;
  return `${path}?${qs}`;
}

/** Absolute share/og URL for a calendar route + session (+ optional filter) query. */
export function buildCalendarAbsoluteUrl(
  pathname: string,
  sessionIds: SessionId[],
  filterKeys: string[] = []
): string {
  const pathWithQuery = buildCalendarUrlPath(pathname, sessionIds, filterKeys);
  if (pathWithQuery === "/") return SITE_ORIGIN;
  return `${SITE_ORIGIN}${pathWithQuery}`;
}

export function isHomepageCalendarPath(pathname: string): boolean {
  return pathname === "/" || pathname === "/list";
}

export function isCalendarPath(pathname: string): boolean {
  if (isHomepageCalendarPath(pathname)) return true;
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 1) return isValidProgramRoute(segments[0]);
  if (segments.length === 2 && segments[1] === "list") {
    return isValidProgramRoute(segments[0]);
  }
  return false;
}

/** Resolve program from calendar pathname (not query). */
export function resolveProgramFromCalendarPath(pathname: string): ProgramValue {
  const segments = pathname.split("/").filter(Boolean);
  const routeSeg = segments[0] && segments[0] !== "list" ? segments[0] : null;
  if (routeSeg) {
    const fromRoute = getProgramFromRoute(routeSeg);
    if (fromRoute !== "All") return fromRoute;
  }
  return "All";
}

/**
 * Resolve program for session query: path wins; homepage is always Group B (`All`)
 * unless the query contains Group A session ids only (then Foundation/Professional).
 */
export function resolveProgramForSessionQuery(
  pathname: string,
  sessionIds: SessionId[],
  existingSelectedProgram?: ProgramValue
): ProgramValue {
  const fromPath = resolveProgramFromCalendarPath(pathname);
  if (fromPath !== "All") return fromPath;

  const activeSessionIds = sessionIds.filter(
    (id) => !id.startsWith("A-") || isGroupASessionId(id)
  );

  if (isHomepageCalendarPath(pathname)) {
    const hasA = activeSessionIds.some((id) => id.startsWith("A-"));
    const hasB = activeSessionIds.some((id) => id.startsWith("B-"));
    if (hasA && !hasB) return "Foundation/Professional";
    return "All";
  }

  if (existingSelectedProgram && isProgramValue(existingSelectedProgram)) {
    return existingSelectedProgram;
  }
  return "All";
}

/** Clean calendar path after consuming session query; homepage + Group A → program route. */
export function resolveCleanCalendarPath(
  pathname: string,
  program: ProgramValue,
  viewMode: "grid" | "list" = pathname === "/list" ? "list" : "grid"
): string {
  if (isHomepageCalendarPath(pathname) && program !== "All") {
    return getRoutePath(program, viewMode);
  }
  return buildCleanCalendarUrl(pathname);
}

export function normalizeSessionIdsForProgram(
  sessionIds: SessionId[],
  program: ProgramValue
): SessionId[] {
  return normalizeSessionsForGroup(sessionIds, getGroupFromProgram(program));
}

/**
 * Merge session ids from query into existing filter cookie state.
 * If normalized ids are empty for the program group, existing sessions are kept.
 */
export function applySessionIdsToFilters(
  existing: FilterStates,
  sessionIds: SessionId[],
  program: ProgramValue
): FilterStates {
  const targetGroup = getGroupFromProgram(program);
  const sessionMemoryKey = getSessionMemoryKey(program);
  const normalized = normalizeSessionsForGroup(sessionIds, targetGroup);

  if (normalized.length === 0) {
    return { ...existing, selectedProgram: program };
  }

  const nextSessionsByProgram: Partial<Record<ProgramValue, SessionId[]>> = {
    ...(existing.sessionIdsByProgram ?? {}),
    [sessionMemoryKey]: normalized,
  };

  return {
    ...existing,
    sessionId: normalized[0],
    sessionIds: normalized,
    sessionIdsByProgram: nextSessionsByProgram,
    selectedProgram: program,
  };
}
