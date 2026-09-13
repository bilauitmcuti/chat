import { FALLBACK_DEFAULT_SESSION_MAP, type MetaResponse } from "./calendar-api";

/** Group A (Foundation/Professional) sessions served by this app. */
export const GROUP_A_SESSION_IDS = ["A-20264", "A-20272"] as const;

/** Group B sessions hidden from the program dropdown (passed semesters). */
export const EXCLUDED_DROPDOWN_SESSION_IDS = ["B-20262"] as const;

export type GroupASessionId = (typeof GROUP_A_SESSION_IDS)[number];

export const GROUP_A_DEFAULT_SESSION_ID: GroupASessionId = "A-20264";

const GROUP_A_SESSION_ID_SET = new Set<string>(GROUP_A_SESSION_IDS);
const EXCLUDED_DROPDOWN_SESSION_ID_SET = new Set<string>(EXCLUDED_DROPDOWN_SESSION_IDS);

export function isGroupASessionId(sessionId: string): sessionId is GroupASessionId {
  return GROUP_A_SESSION_ID_SET.has(sessionId);
}

export function isExcludedDropdownSessionId(sessionId: string): boolean {
  return EXCLUDED_DROPDOWN_SESSION_ID_SET.has(sessionId);
}

/** Keep only configured Group A sessions from API meta; drop excluded Group B sessions. */
export function applyGroupASessionsToMeta(meta: MetaResponse): MetaResponse {
  const sessionOptions = meta.sessionOptions.filter(
    (s) =>
      !isExcludedDropdownSessionId(s.id) &&
      (s.group !== "A" || isGroupASessionId(s.id))
  );

  const defaultSession = { ...meta.defaultSession };
  if (!isGroupASessionId(defaultSession.A)) {
    defaultSession.A = GROUP_A_DEFAULT_SESSION_ID;
  }
  if (isExcludedDropdownSessionId(defaultSession.B)) {
    defaultSession.B = FALLBACK_DEFAULT_SESSION_MAP.B;
  }

  return { ...meta, sessionOptions, defaultSession };
}
