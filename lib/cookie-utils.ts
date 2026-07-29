import { getSnapshot } from './calendar-store';
import {
  DEFAULT_FILTER_STATES,
  getDefaultSessionFallback,
} from './data';
import type { DefaultSessionMap } from './calendar-api';
import { isProgramValue, type ProgramValue } from './route-utils';

/** Prefer API defaultSession.B when store is hydrated; else static fallback (SSR-safe). */
function getDefaultSessionForCookie(): string {
  const d = getSnapshot().defaultSession?.B;
  if (d) return d;
  return getDefaultSessionFallback();
}

function resolveDefaultSessionId(
  defaultSessionWhenMissing?: string | DefaultSessionMap
): string {
  if (typeof defaultSessionWhenMissing === 'string' && defaultSessionWhenMissing) {
    return defaultSessionWhenMissing;
  }
  if (
    defaultSessionWhenMissing &&
    typeof defaultSessionWhenMissing === 'object' &&
    typeof defaultSessionWhenMissing.B === 'string' &&
    defaultSessionWhenMissing.B
  ) {
    return defaultSessionWhenMissing.B;
  }
  return getDefaultSessionForCookie();
}

export interface FilterStates {
  showKKT: boolean;
  showRegistration: boolean;
  showLecture: boolean;
  showSemesterPendek: boolean;
  showKuliahIntersesi: boolean;
  showExamination: boolean;
  showOthersExams: boolean;
  showBreak: boolean;
  showCountdown: boolean;
  sessionId?: string;
  sessionIds?: string[];
  sessionIdsByProgram?: Partial<Record<ProgramValue, string[]>>;
  /** Last selected program (used on `/` / `/list` refresh when URL does not encode one). */
  selectedProgram?: ProgramValue;
}

export const CALENDAR_FILTERS_COOKIE = 'calendar-filters';
export const CALENDAR_FILTERS_MAX_AGE = 365 * 24 * 60 * 60; // 1 year

const COOKIE_NAME = CALENDAR_FILTERS_COOKIE;
const COOKIE_MAX_AGE = CALENDAR_FILTERS_MAX_AGE;

export function serializeFiltersCookieValue(filters: FilterStates): string {
  return encodeURIComponent(JSON.stringify(filters));
}

/** Read raw value of `calendar-filters` from `document.cookie` (client only). */
function getCalendarFiltersCookieRaw(): string | null {
  if (typeof document === 'undefined') return null;
  const escaped = COOKIE_NAME.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${escaped}=([^;]*)`));
  return m?.[1] ?? null;
}

/**
 * Parse filter states from cookie value (decoded cookie value, not full cookie string).
 * @param defaultSessionWhenMissing — API `defaultSession` map or Group B id when parsing before the client store exists.
 */
export function parseFiltersFromCookie(
  cookieValue: string | null | undefined,
  defaultSessionWhenMissing?: string | DefaultSessionMap
): FilterStates {
  const resolveDefaultSession = (): string =>
    resolveDefaultSessionId(defaultSessionWhenMissing);

  if (!cookieValue) {
    return { ...DEFAULT_FILTER_STATES };
  }

  try {
    const decoded = decodeURIComponent(cookieValue);
    const parsed = JSON.parse(decoded);
    const sessionIds = Array.isArray(parsed.sessionIds) && parsed.sessionIds.length > 0
      ? parsed.sessionIds
      : parsed.sessionId
        ? [parsed.sessionId]
        : [resolveDefaultSession()];
    const sessionIdsByProgram =
      parsed.sessionIdsByProgram && typeof parsed.sessionIdsByProgram === 'object'
        ? Object.fromEntries(
            Object.entries(parsed.sessionIdsByProgram)
              .filter(([, value]) => Array.isArray(value) && value.length > 0)
              .map(([key, value]) => [key, value as string[]])
          ) as Partial<Record<ProgramValue, string[]>>
        : undefined;
    const selectedProgram =
      typeof parsed.selectedProgram === 'string' && isProgramValue(parsed.selectedProgram)
        ? parsed.selectedProgram
        : undefined;
    return {
      showKKT: parsed.showKKT ?? DEFAULT_FILTER_STATES.showKKT,
      showRegistration: parsed.showRegistration ?? DEFAULT_FILTER_STATES.showRegistration,
      showLecture: parsed.showLecture ?? DEFAULT_FILTER_STATES.showLecture,
      showSemesterPendek: parsed.showSemesterPendek ?? DEFAULT_FILTER_STATES.showSemesterPendek,
      showKuliahIntersesi: parsed.showKuliahIntersesi ?? DEFAULT_FILTER_STATES.showKuliahIntersesi,
      showExamination: parsed.showExamination ?? DEFAULT_FILTER_STATES.showExamination,
      showOthersExams: parsed.showOthersExams ?? DEFAULT_FILTER_STATES.showOthersExams,
      showBreak: parsed.showBreak ?? DEFAULT_FILTER_STATES.showBreak,
      showCountdown: parsed.showCountdown ?? DEFAULT_FILTER_STATES.showCountdown,
      sessionId: sessionIds[0],
      sessionIds,
      sessionIdsByProgram,
      selectedProgram,
    };
  } catch {
    return {
      ...DEFAULT_FILTER_STATES,
      sessionId: resolveDefaultSession(),
      sessionIds: [resolveDefaultSession()],
    };
  }
}

/**
 * Set filter states to cookie (client-side only)
 */
export function setFiltersToCookie(filters: FilterStates): void {
  if (typeof window === 'undefined') return;

  try {
    const cookieValue = serializeFiltersCookieValue(filters);
    const expires = new Date();
    expires.setTime(expires.getTime() + COOKIE_MAX_AGE * 1000);
    const securePart =
      process.env.NODE_ENV === "production" ? "; Secure" : "";
    document.cookie = `${COOKIE_NAME}=${cookieValue}; expires=${expires.toUTCString()}; path=/; SameSite=Lax${securePart}`;
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.warn("Failed to set filters cookie:", e);
    }
  }
}

/**
 * Get filter states from cookie (client-side only).
 * Reads the `calendar-filters` entry only — not the whole `document.cookie` string.
 */
export function getFiltersFromCookie(): FilterStates {
  if (typeof window === 'undefined') {
    return DEFAULT_FILTER_STATES;
  }

  const raw = getCalendarFiltersCookieRaw();
  return parseFiltersFromCookie(raw, getDefaultSessionFallback());
}
