import type { Activity } from "./data";
import type {
  DefaultSessionMap,
  ProgramOptionRow,
  SessionOptionRow,
} from "./calendar-api";
import { FALLBACK_DEFAULT_SESSION_MAP } from "./calendar-api";

export interface CalendarSnapshot {
  version: number;
  sessionOptions: SessionOptionRow[];
  programOptions: ProgramOptionRow[];
  defaultSession: DefaultSessionMap;
  sessions: Record<string, { activities: Activity[] }>;
  /** Merged union of all loaded sessions (legacy; prefer lectureWeekBySession + selected ids). */
  lectureWeekByDate: Record<string, number>;
  lectureWeekBySession: Record<string, Record<string, number>>;
}

function coalesceDefaultSession(
  value: DefaultSessionMap | null | undefined
): DefaultSessionMap {
  return {
    A: value?.A || FALLBACK_DEFAULT_SESSION_MAP.A,
    B: value?.B || FALLBACK_DEFAULT_SESSION_MAP.B,
  };
}

/** Stable empty record for useSyncExternalStore getServerSnapshot (must not allocate per call). */
export const EMPTY_LECTURE_WEEK_BY_DATE: Record<string, number> = {};

/** Stable empty per-session map for useSyncExternalStore getServerSnapshot. */
export const EMPTY_LECTURE_WEEK_BY_SESSION: Record<string, Record<string, number>> = {};

export function getLectureWeekByDateServerSnapshot(
  initialLectureWeekByDate: Record<string, number> | null | undefined
): Record<string, number> {
  return initialLectureWeekByDate ?? EMPTY_LECTURE_WEEK_BY_DATE;
}

const emptySnapshot: CalendarSnapshot = {
  version: 0,
  sessionOptions: [],
  programOptions: [],
  defaultSession: { ...FALLBACK_DEFAULT_SESSION_MAP },
  sessions: {},
  lectureWeekByDate: EMPTY_LECTURE_WEEK_BY_DATE,
  lectureWeekBySession: EMPTY_LECTURE_WEEK_BY_SESSION,
};

let snapshot: CalendarSnapshot = { ...emptySnapshot, sessions: {} };

const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot(): CalendarSnapshot {
  return snapshot;
}

export function setMeta(meta: {
  defaultSession: DefaultSessionMap;
  sessionOptions: SessionOptionRow[];
  programOptions: ProgramOptionRow[];
}): void {
  snapshot = {
    ...snapshot,
    version: snapshot.version + 1,
    defaultSession: coalesceDefaultSession(meta.defaultSession),
    sessionOptions: meta.sessionOptions,
    programOptions: meta.programOptions,
  };
  emit();
}

export function mergeSessions(
  partial: Record<string, { activities: Activity[] }>
): void {
  snapshot = {
    ...snapshot,
    version: snapshot.version + 1,
    sessions: { ...snapshot.sessions, ...partial },
  };
  emit();
}

export function mergeLectureWeekForSession(
  sessionId: string,
  partial: Record<string, number>
): void {
  if (Object.keys(partial).length === 0) return;
  snapshot = {
    ...snapshot,
    version: snapshot.version + 1,
    lectureWeekBySession: {
      ...snapshot.lectureWeekBySession,
      [sessionId]: { ...partial },
    },
  };
  emit();
}

/** @deprecated Use mergeLectureWeekForSession so week data stays scoped per session. */
export function mergeLectureWeekByDate(
  partial: Record<string, number>
): void {
  if (Object.keys(partial).length === 0) return;
  snapshot = {
    ...snapshot,
    version: snapshot.version + 1,
    lectureWeekByDate: { ...snapshot.lectureWeekByDate, ...partial },
  };
  emit();
}

/** Clear cached session activities before loading chat context (avoids stale merges on reused Edge isolates). */
export function resetSessionActivitiesCache(): void {
  snapshot = {
    ...snapshot,
    version: snapshot.version + 1,
    sessions: {},
    lectureWeekByDate: EMPTY_LECTURE_WEEK_BY_DATE,
    lectureWeekBySession: EMPTY_LECTURE_WEEK_BY_SESSION,
  };
  emit();
}

/**
 * Replace entire store without notifying subscribers — safe during React render
 * (e.g. useMemo while hydrating from RSC). Call notifyCalendarStoreListeners in useLayoutEffect.
 */
export function assignCalendarStoreSnapshot(next: CalendarSnapshot): void {
  snapshot = {
    version: next.version,
    sessionOptions: [...next.sessionOptions],
    programOptions: [...next.programOptions],
    defaultSession: coalesceDefaultSession(next.defaultSession),
    sessions: { ...next.sessions },
    lectureWeekByDate: { ...next.lectureWeekByDate },
    lectureWeekBySession: { ...(next.lectureWeekBySession ?? EMPTY_LECTURE_WEEK_BY_SESSION) },
  };
}

/** Flush after assignCalendarStoreSnapshot once the current commit has finished. */
export function notifyCalendarStoreListeners(): void {
  emit();
}
