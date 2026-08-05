export type ActivityType = 'registration' | 'lecture' | 'examination' | 'break' | 'other';

// Default filter states - single source of truth
export const DEFAULT_FILTER_STATES = {
  showKKT: false,
  showRegistration: true,
  showLecture: true,
  showSemesterPendek: false,
  showKuliahIntersesi: false,
  showExamination: true,
  showOthersExams: false,
  showBreak: true,
  showCountdown: true,
} as const;

export interface Activity {
  name: string;
  details?: string;
  startDate: string; // YYYY-MM-DD format
  endDate?: string; // YYYY-MM-DD format
  regionalStartDate?: string; // KKT regional variant start date
  regionalEndDate?: string; // KKT regional variant end date
  duration?: string; // e.g., "1 Minggu", "8 Minggu"
  type: ActivityType;
  programs?: string[]; // Applicable programs
  group?: 'A' | 'B'; // Group A (Foundation/Professional) or Group B (Pre-Diploma onwards)
  programType?: 'PreDiploma' | 'Diploma' | 'DiplomaPartTime' | 'Bachelor' | 'BachelorPartTime' | 'Master' | 'PhD'; // For Group B subdivision
  programTypes?: string[]; // Multiple programs (e.g. PreDiploma, Diploma, Bachelor) - show all badges on "All" list, single badge when specific program
  allStudents?: boolean; // True if applies to all Group B students
  general?: boolean; // True = applies to all but hide "All Students" badge (general info)
  states?: string[]; // Applicable states only (used for Kedah, Kelantan, Terengganu)
}

import { getSnapshot as getCalendarSnapshot } from "./calendar-store";
import { FALLBACK_DEFAULT_SESSION_MAP } from "./calendar-api";

export type SessionId = string;

/** When API meta has not loaded yet (SSR / first paint). Group B homepage default. */
export function getDefaultSessionFallback(): SessionId {
  return FALLBACK_DEFAULT_SESSION_MAP.B;
}

export function getSessionOptions(): Array<{ id: string; label: string; group: "A" | "B" }> {
  return getCalendarSnapshot().sessionOptions;
}

export function getProgramOptions(): Array<{ label: string; value: string; group: "A" | "B" }> {
  return getCalendarSnapshot().programOptions;
}

function getSessionsData(): Record<string, { activities: Activity[] }> {
  return getCalendarSnapshot().sessions;
}

function getSessionGroupById(): Map<SessionId, ProgramGroup> {
  return new Map(
    getCalendarSnapshot().sessionOptions.map((session) => [session.id, session.group] as const)
  );
}

function normalizeDateString(dateStr: string): string {
  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/;
  const dmy = /^(\d{2})-(\d{2})-(\d{4})$/;
  const ymdMatch = dateStr.match(ymd);
  if (ymdMatch) return dateStr;
  const dmyMatch = dateStr.match(dmy);
  if (dmyMatch) {
    const [, day, month, year] = dmyMatch;
    return `${year}-${month}-${day}`;
  }
  return dateStr;
}

function toDateOrNull(dateStr: string | undefined): Date | null {
  if (!dateStr) return null;
  const normalized = normalizeDateString(dateStr);
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Get activities for a session. Returns empty array if session not found. */
export function getActivitiesForSession(sessionId: SessionId): Activity[] {
  const session = getSessionsData()[sessionId];
  return ((session?.activities ?? []) as Activity[]).map((activity) => ({
    ...activity,
    startDate: normalizeDateString(activity.startDate),
    endDate: activity.endDate ? normalizeDateString(activity.endDate) : undefined,
    regionalStartDate: activity.regionalStartDate ? normalizeDateString(activity.regionalStartDate) : undefined,
    regionalEndDate: activity.regionalEndDate ? normalizeDateString(activity.regionalEndDate) : undefined,
  }));
}

/** Get group from session ID (A-* = A, B-* = B). */
export function getGroupFromSession(sessionId: SessionId): ProgramGroup {
  return getSessionGroupById().get(sessionId) ?? (sessionId.startsWith("A-") ? "A" : "B");
}

/** Get default session for a group from API meta map (synced via store). */
export function getDefaultSessionForGroup(group: ProgramGroup): SessionId {
  const snap = getCalendarSnapshot();
  const fromMap = snap.defaultSession?.[group];
  if (
    fromMap &&
    snap.sessionOptions.some((s) => s.id === fromMap && s.group === group)
  ) {
    return fromMap;
  }
  if (fromMap && fromMap.startsWith(`${group}-`)) return fromMap;

  const opt = snap.sessionOptions.find((s) => s.group === group);
  if (opt) return opt.id;
  const opts = getSessionOptionsForGroup(group);
  if (opts.length > 0) return opts[0]!.id;
  return group === "A"
    ? FALLBACK_DEFAULT_SESSION_MAP.A
    : FALLBACK_DEFAULT_SESSION_MAP.B;
}

/** Min/max dates from loaded API activities for a session (authoritative span). */
export function getSessionActivityDateRange(
  sessionId: SessionId
): { start: string; end: string } | null {
  return getSessionDateRange(sessionId);
}

/** Get session date range from activities (min start, max end). */
function getSessionDateRange(sessionId: SessionId): { start: string; end: string } | null {
  const activities = getActivitiesForSession(sessionId);
  if (activities.length === 0) return null;
  let start = normalizeDateString(activities[0]!.startDate);
  let end = normalizeDateString(activities[0]!.endDate ?? activities[0]!.startDate);
  for (const a of activities) {
    const activityStart = normalizeDateString(a.startDate);
    if (activityStart < start) start = activityStart;
    const e = normalizeDateString(a.endDate ?? a.startDate);
    if (e > end) end = e;
  }
  return { start, end };
}

const SESSION_LABEL_MONTH: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

function sessionLabelTail(label: string): string {
  const idx = label.indexOf(":");
  return (idx >= 0 ? label.slice(idx + 1) : label).trim();
}

function ymd(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function parseMonthToken(token: string): number | null {
  const key = token.trim().toLowerCase().slice(0, 3);
  return SESSION_LABEL_MONTH[key] ?? null;
}

/**
 * Parse timeline from API session `label` when activities are not loaded yet.
 * Supports forms like "Dec 2025 - May 2026", "Jun - Oct 2026", "Sep 2026 - Feb 2027".
 */
export function parseSessionLabelDateRange(label: string): { start: string; end: string } | null {
  const text = sessionLabelTail(label);
  const twoYears = text.match(
    /(\w+)\s+(\d{4})\s*[-â€“]\s*(\w+)\s+(\d{4})/i
  );
  if (twoYears) {
    const m1 = parseMonthToken(twoYears[1]!);
    const y1 = Number(twoYears[2]);
    const m2 = parseMonthToken(twoYears[3]!);
    const y2 = Number(twoYears[4]);
    if (!m1 || !Number.isFinite(y1) || !m2 || !Number.isFinite(y2)) return null;
    return {
      start: ymd(y1, m1, 1),
      end: ymd(y2, m2, lastDayOfMonth(y2, m2)),
    };
  }
  const sameYear = text.match(/(\w+)\s*[-â€“]\s*(\w+)\s+(\d{4})/i);
  if (sameYear) {
    const m1 = parseMonthToken(sameYear[1]!);
    const m2 = parseMonthToken(sameYear[2]!);
    const y = Number(sameYear[3]);
    if (!m1 || !m2 || !Number.isFinite(y)) return null;
    return {
      start: ymd(y, m1, 1),
      end: ymd(y, m2, lastDayOfMonth(y, m2)),
    };
  }
  return null;
}

export interface SessionOptionLike {
  id: string;
  label: string;
  group: ProgramGroup;
}

/**
 * Normalize session label for UI and always append id, e.g. "Mar - Aug 2026 (B-20263)".
 */
export function formatSessionLabelWithId(session: Pick<SessionOptionLike, "id" | "label">): string {
  const baseLabel = session.label.replace(/^Group [AB]:\s*/, "").trim();
  if (baseLabel.includes(session.id)) return baseLabel;
  return `${baseLabel} (${session.id})`;
}

/**
 * Body text and id for responsive session rows: mobile stacks body + id; desktop uses singleLine (same as formatSessionLabelWithId).
 */
export function getSessionLabelAndIdParts(session: Pick<SessionOptionLike, "id" | "label">): {
  body: string;
  id: string;
  singleLine: string;
  canSplit: boolean;
} {
  const id = session.id;
  const singleLine = formatSessionLabelWithId(session);
  const lastOpen = singleLine.lastIndexOf("(");
  const lastClose = singleLine.lastIndexOf(")");
  if (lastOpen >= 0 && lastClose > lastOpen) {
    const inside = singleLine.slice(lastOpen + 1, lastClose).trim();
    if (inside === id) {
      const body = singleLine.slice(0, lastOpen).trim();
      if (body.length > 0) return { body, id, singleLine, canSplit: true };
    }
  }
  return { body: singleLine, id, singleLine, canSplit: false };
}

/**
 * Label for a Group A program submenu row: session text with id(s) when that program is selected; otherwise empty.
 */
export function formatGroupASessionTriggerLabel(
  programValue: string,
  selectedProgram: string,
  selectedSessions: SessionId[]
): string {
  if (selectedProgram !== programValue) return "";
  const labels = selectedSessions
    .filter((sessionId) => sessionId.startsWith("A-"))
    .map((sessionId) => {
      const session = getSessionOptionsForGroup("A").find((item) => item.id === sessionId);
      return session ? formatSessionLabelWithId(session) : sessionId;
    });
  if (labels.length === 0) return "Select sessions";
  if (labels.length === 1) return labels[0];
  return `${labels.length} Selected`;
}

function effectiveSessionRange(
  sessionId: SessionId,
  label: string
): { start: string; end: string } | null {
  const fromActivities = getSessionDateRange(sessionId);
  if (fromActivities) return fromActivities;
  return parseSessionLabelDateRange(label);
}

/**
 * Pick the API session id for `group` that contains `dateStr`, using loaded activities when present
 * and otherwise the session label from meta. Used when cookies/localStorage do not pin a session.
 */
export function pickSessionIdForDateFromApiOptions(
  group: ProgramGroup,
  dateStr: string,
  sessionOptions: SessionOptionLike[]
): SessionId {
  const opts = sessionOptions.filter((s) => s.group === group);
  if (opts.length === 0) {
    return group === "A"
      ? FALLBACK_DEFAULT_SESSION_MAP.A
      : FALLBACK_DEFAULT_SESSION_MAP.B;
  }
  const normalizedDate = normalizeDateString(dateStr);

  for (const s of opts) {
    const range = effectiveSessionRange(s.id, s.label);
    if (range && normalizedDate >= range.start && normalizedDate <= range.end) return s.id;
  }

  const future = opts.find((s) => {
    const range = effectiveSessionRange(s.id, s.label);
    return range && range.start > normalizedDate;
  });
  if (future) return future.id;

  const withRange = opts.filter((s) => effectiveSessionRange(s.id, s.label) != null);
  if (withRange.length > 0) return withRange[withRange.length - 1]!.id;

  return opts[opts.length - 1]!.id;
}

/** Get session options for a group. */
export function getSessionOptionsForGroup(group: ProgramGroup) {
  return getCalendarSnapshot().sessionOptions.filter((s) => s.group === group);
}

export type ProgramGroup = 'A' | 'B';

/**
 * Single source of truth for date matching.
 * When showKKT=true and activity has regional dates, use regional range only.
 * Otherwise use standard start/end dates.
 */
export function matchesActivityDate(
  activity: Activity,
  dateStr: string,
  showKKT: boolean
): boolean {
  const targetDate = toDateOrNull(dateStr);
  if (!targetDate) return false;
  let startDate: Date;
  let endDate: Date;
  if (showKKT && activity.regionalStartDate && toDateOrNull(activity.regionalStartDate)) {
    startDate = toDateOrNull(activity.regionalStartDate)!;
    endDate = toDateOrNull(activity.regionalEndDate) ?? startDate;
  } else {
    startDate = toDateOrNull(activity.startDate) ?? targetDate;
    endDate = toDateOrNull(activity.endDate) ?? startDate;
  }
  return targetDate >= startDate && targetDate <= endDate;
}

export interface ActivityFilterOptions {
  selectedProgram: string;
  showRegistration?: boolean;
  showLecture?: boolean;
  showSemesterPendek?: boolean;
  showKuliahIntersesi?: boolean;
  showExamination?: boolean;
  showOthersExams?: boolean;
  showBreak?: boolean;
}

function isShortSemesterActivity(activity: Activity): boolean {
  return (
    activity.type === "lecture" &&
    (activity.name.includes("Short Semester") || activity.name.includes("Semester Pendek"))
  );
}

function isIntersessionActivity(activity: Activity): boolean {
  return (
    activity.type === "lecture" &&
    (activity.name.includes("Intersession Classes") || activity.name.includes("Intersesi"))
  );
}

function isOthersExamActivity(activity: Activity): boolean {
  return (
    activity.type === "examination" &&
    (activity.name.includes("Khas") ||
      activity.name.includes("English Exit Test") ||
      activity.name.includes("EET Lisan") ||
      activity.name.includes("EET Speaking"))
  );
}

/**
 * Single source of truth for activity visibility based on filter toggles and program.
 * Short-sem / intersession / other-exam use their own toggles (not gated by lecture/exam).
 */
export function shouldIncludeActivity(
  activity: Activity,
  filters: ActivityFilterOptions
): boolean {
  const {
    selectedProgram,
    showRegistration = true,
    showLecture = true,
    showSemesterPendek = true,
    showKuliahIntersesi = true,
    showExamination = true,
    showOthersExams = true,
    showBreak = true,
  } = filters;

  if (activity.type === "registration" && !showRegistration) return false;
  if (activity.type === "break" && !showBreak) return false;

  if (isShortSemesterActivity(activity)) {
    if (!showSemesterPendek) return false;
  } else if (isIntersessionActivity(activity)) {
    if (!showKuliahIntersesi) return false;
  } else if (activity.type === "lecture" && !showLecture) {
    return false;
  }

  if (isOthersExamActivity(activity)) {
    if (!showOthersExams) return false;
  } else if (activity.type === "examination" && !showExamination) {
    return false;
  }

  if (selectedProgram === "All") return true;
  if (activity.programTypes?.length) {
    return activity.programTypes.includes(selectedProgram);
  }
  if (activity.programType && activity.programType !== selectedProgram) return false;
  return true;
}
