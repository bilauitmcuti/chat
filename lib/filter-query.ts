import type { FilterStates } from "@/lib/cookie-utils";
import type { SessionId } from "@/lib/data";
import { buildSessionQueryString } from "@/lib/session-query";

/** Bare filter keys used as query params, e.g. `lecture`, `short-sem`, `states`. */
export const FILTER_QUERY_KEY_MAP = {
  registration: "showRegistration",
  lecture: "showLecture",
  "short-sem": "showSemesterPendek",
  intersession: "showKuliahIntersesi",
  exam: "showExamination",
  "other-exam": "showOthersExams",
  break: "showBreak",
  states: "showKKT",
} as const;

export type FilterQueryKey = keyof typeof FILTER_QUERY_KEY_MAP;

export type FilterToggleField = (typeof FILTER_QUERY_KEY_MAP)[FilterQueryKey];

const FILTER_QUERY_KEYS = Object.keys(FILTER_QUERY_KEY_MAP) as FilterQueryKey[];

const FIELD_TO_QUERY_KEY: Record<FilterToggleField, FilterQueryKey> = {
  showRegistration: "registration",
  showLecture: "lecture",
  showSemesterPendek: "short-sem",
  showKuliahIntersesi: "intersession",
  showExamination: "exam",
  showOthersExams: "other-exam",
  showBreak: "break",
  showKKT: "states",
};

export function isFilterQueryKey(key: string): key is FilterQueryKey {
  return key in FILTER_QUERY_KEY_MAP;
}

/** Collect known filter bare keys from query (order preserved, deduped). */
export function parseFilterKeysFromSearchParams(
  searchParams: URLSearchParams
): FilterQueryKey[] {
  const seen = new Set<FilterQueryKey>();
  const result: FilterQueryKey[] = [];
  for (const key of searchParams.keys()) {
    if (!isFilterQueryKey(key) || seen.has(key)) continue;
    seen.add(key);
    result.push(key);
  }
  return result;
}

export function hasFilterQueryParams(searchParams: URLSearchParams): boolean {
  return parseFilterKeysFromSearchParams(searchParams).length > 0;
}

/**
 * Whitelist mode: when keys are present, set all 8 event/KKT toggles from key presence.
 * `showCountdown` is preserved from existing cookie/default.
 */
export function applyFilterKeysToFilters(
  existing: FilterStates,
  keys: FilterQueryKey[]
): FilterStates {
  if (keys.length === 0) return existing;

  const enabled = new Set(keys);
  return {
    ...existing,
    showRegistration: enabled.has("registration"),
    showLecture: enabled.has("lecture"),
    showSemesterPendek: enabled.has("short-sem"),
    showKuliahIntersesi: enabled.has("intersession"),
    showExamination: enabled.has("exam"),
    showOthersExams: enabled.has("other-exam"),
    showBreak: enabled.has("break"),
    showKKT: enabled.has("states"),
  };
}

/** Bare filter keys joined for the query string, e.g. `lecture&exam&break`. */
export function buildFilterQueryString(keys: FilterQueryKey[]): string {
  const seen = new Set<FilterQueryKey>();
  const ordered: FilterQueryKey[] = [];
  for (const key of keys) {
    if (!isFilterQueryKey(key) || seen.has(key)) continue;
    seen.add(key);
    ordered.push(key);
  }
  return ordered.join("&");
}

/** Reverse map from filter toggle state to query keys (only toggles that are on). */
export function filtersToQueryKeys(
  state: Pick<FilterStates, FilterToggleField>
): FilterQueryKey[] {
  const keys: FilterQueryKey[] = [];
  for (const field of Object.keys(FIELD_TO_QUERY_KEY) as FilterToggleField[]) {
    if (state[field]) keys.push(FIELD_TO_QUERY_KEY[field]);
  }
  return keys;
}

/** Combine session + filter bare keys into one query string. */
export function buildCalendarQueryString(opts: {
  sessionIds?: SessionId[];
  filterKeys?: FilterQueryKey[];
}): string {
  const parts = [
    opts.sessionIds?.length ? buildSessionQueryString(opts.sessionIds) : "",
    opts.filterKeys?.length ? buildFilterQueryString(opts.filterKeys) : "",
  ].filter(Boolean);
  return parts.join("&");
}

export { FILTER_QUERY_KEYS };
