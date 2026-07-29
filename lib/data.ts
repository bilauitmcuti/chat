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

function getDefaultMonthsWindow(count: number = 6): Array<{ month: number; year: number }> {
  const now = new Date();
  const months: Array<{ month: number; year: number }> = [];
  const cursor = new Date(now.getFullYear(), now.getMonth(), 1);
  for (let i = 0; i < count; i += 1) {
    months.push({ month: cursor.getMonth() + 1, year: cursor.getFullYear() });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return months;
}

function getMonthsBetweenDates(startDate: Date, endDate: Date): Array<{ month: number; year: number }> {
  const months: Array<{ month: number; year: number }> = [];
  const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const endMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
  while (cursor <= endMonth) {
    months.push({ month: cursor.getMonth() + 1, year: cursor.getFullYear() });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return months;
}

/**
 * Infer calendar year from session id (e.g. B-20263 → 2026, A-20264 → 2026).
 * Used when activities are not loaded yet so the grid/list month strip matches the session, not "today + 6 months".
 */
export function inferAcademicYearFromSessionId(sessionId: SessionId): number | null {
  const segment = sessionId.split("-")[1];
  if (!segment || segment.length < 5) return null;
  const y = Number(segment.slice(0, 4));
  return Number.isFinite(y) ? y : null;
}

/** Academic-year window: Aug (Y−1) through Jul Y */
export function getAcademicMonthsForSessionYear(year: number): Array<{ month: number; year: number }> {
  const out: Array<{ month: number; year: number }> = [];
  for (let m = 8; m <= 12; m++) out.push({ month: m, year: year - 1 });
  for (let m = 1; m <= 7; m++) out.push({ month: m, year });
  return out;
}

export function getMonthsUnionFromSessionIds(
  sessionIds: SessionId[]
): Array<{ month: number; year: number }> | null {
  const years = new Set<number>();
  for (const sid of sessionIds) {
    const y = inferAcademicYearFromSessionId(sid);
    if (y != null) years.add(y);
  }
  if (years.size === 0) return null;
  const keySet = new Set<string>();
  for (const y of years) {
    for (const m of getAcademicMonthsForSessionYear(y)) {
      keySet.add(`${m.year}-${m.month}`);
    }
  }
  return Array.from(keySet)
    .map((k) => {
      const [year, month] = k.split("-").map(Number);
      return { year: year!, month: month! };
    })
    .sort((a, b) => (a.year !== b.year ? a.year - b.year : a.month - b.month));
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
    /(\w+)\s+(\d{4})\s*[-–]\s*(\w+)\s+(\d{4})/i
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
  const sameYear = text.match(/(\w+)\s*[-–]\s*(\w+)\s+(\d{4})/i);
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

/** Get session for group that contains the given date (YYYY-MM-DD). Falls back to nearest future or last session. */
export function getSessionForCurrentDate(group: ProgramGroup, dateStr: string): SessionId {
  const opts = getSessionOptionsForGroup(group);
  if (opts.length === 0) return getDefaultSessionForGroup(group);
  return pickSessionIdForDateFromApiOptions(group, dateStr, opts);
}

/** Get session options for a group. */
export function getSessionOptionsForGroup(group: ProgramGroup) {
  return getCalendarSnapshot().sessionOptions.filter((s) => s.group === group);
}

// Program badge config for list view - single source of truth for label and colors
export interface ProgramBadgeConfig {
  label: string;
  bgClass: string;
  textClass: string;
}

type ProgramTypeForBadge = NonNullable<Activity['programType']>;

const programBadgeConfigMap: Record<ProgramTypeForBadge, ProgramBadgeConfig> = {
  PreDiploma: {
    label: 'Pre-Diploma',
    bgClass: 'bg-[#D97706]/10 dark:bg-[#FBBF24]/10',
    textClass: 'text-[#D97706] dark:text-[#FBBF24]',
  },
  Diploma: {
    label: 'Diploma',
    bgClass: 'bg-[#0891B2]/10 dark:bg-[#22D3EE]/10',
    textClass: 'text-[#0891B2] dark:text-[#22D3EE]',
  },
  DiplomaPartTime: {
    label: 'Diploma Part-Time',
    bgClass: 'bg-[#65A30D]/10 dark:bg-[#A3E635]/10',
    textClass: 'text-[#65A30D] dark:text-[#A3E635]',
  },
  Bachelor: {
    label: 'Bachelor',
    bgClass: 'bg-[#DB2777]/10 dark:bg-[#F472B6]/10',
    textClass: 'text-[#DB2777] dark:text-[#F472B6]',
  },
  BachelorPartTime: {
    label: 'Bachelor Part-Time',
    bgClass: 'bg-[#65A30D]/10 dark:bg-[#A3E635]/10',
    textClass: 'text-[#65A30D] dark:text-[#A3E635]',
  },
  Master: {
    label: 'Master',
    bgClass: 'bg-[#7C3AED]/10 dark:bg-[#A78BFA]/10',
    textClass: 'text-[#7C3AED] dark:text-[#C4B5FD]',
  },
  PhD: {
    label: 'PhD',
    bgClass: 'bg-[#BE123C]/10 dark:bg-[#FB7185]/10',
    textClass: 'text-[#BE123C] dark:text-[#FDA4AF]',
  },
};

const allStudentsBadgeConfig: ProgramBadgeConfig = {
  label: 'All Students',
  bgClass: 'bg-zinc-100 dark:bg-zinc-800',
  textClass: 'text-zinc-700 dark:text-zinc-200',
};

/** Shared green badge when an activity covers both Diploma and Bachelor Part-Time. */
const mergedPartTimeBadgeConfig: ProgramBadgeConfig = {
  label: 'Part-Time',
  bgClass: programBadgeConfigMap.DiplomaPartTime.bgClass,
  textClass: programBadgeConfigMap.DiplomaPartTime.textClass,
};

export function getProgramBadgeConfig(activity: Activity): ProgramBadgeConfig | null {
  if (activity.allStudents && !activity.general) return allStudentsBadgeConfig;
  if (activity.programType && activity.programType in programBadgeConfigMap) {
    return programBadgeConfigMap[activity.programType];
  }
  return null;
}

/** Collapse Diploma + Bachelor Part-Time into one badge (same color as before the distinct labels). */
function collapsePartTimeBadges(configs: ProgramBadgeConfig[]): ProgramBadgeConfig[] {
  const hasDiplomaPartTime = configs.some((c) => c.label === programBadgeConfigMap.DiplomaPartTime.label);
  const hasBachelorPartTime = configs.some((c) => c.label === programBadgeConfigMap.BachelorPartTime.label);
  if (!hasDiplomaPartTime || !hasBachelorPartTime) return configs;
  return [
    ...configs.filter(
      (c) =>
        c.label !== programBadgeConfigMap.DiplomaPartTime.label &&
        c.label !== programBadgeConfigMap.BachelorPartTime.label
    ),
    mergedPartTimeBadgeConfig,
  ];
}

/** Get badge configs for activities with programTypes. For "All" view returns all; for specific program returns single if in list. */
export function getProgramBadgesConfig(
  activity: Activity,
  selectedProgram: string
): ProgramBadgeConfig[] {
  if (activity.programTypes?.length) {
    if (selectedProgram === 'All') {
      const configs = activity.programTypes
        .filter((pt) => pt in programBadgeConfigMap)
        .map((pt) => programBadgeConfigMap[pt as ProgramTypeForBadge]);
      return collapsePartTimeBadges(configs);
    }
    const match = activity.programTypes.find((pt) => pt === selectedProgram);
    if (match && match in programBadgeConfigMap) {
      return [programBadgeConfigMap[match as ProgramTypeForBadge]];
    }
    return [];
  }
  const single = getProgramBadgeConfig(activity);
  return single ? [single] : [];
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

/**
 * Get activities for a date, filtered and date-matched via shared helpers.
 * Single source for tooltip, day color, dots, ring/border.
 */
export function getActivitiesForDate(
  dateStr: string,
  sessionId: SessionId,
  showKKT: boolean,
  filters: ActivityFilterOptions
): Activity[] {
  const activities = getActivitiesForSession(sessionId);
  const group = getGroupFromSession(sessionId);
  return activities.filter(
    (a) =>
      a.group === group &&
      matchesActivityDate(a, dateStr, showKKT) &&
      shouldIncludeActivity(a, filters)
  );
}

// Get all activities for a specific month. When showKKT=true, consider regional dates for overlap.
export function getActivitiesForMonth(
  year: number,
  month: number,
  sessionId: SessionId,
  showKKT: boolean = false
): Activity[] {
  const activities = getActivitiesForSession(sessionId);
  const group = getGroupFromSession(sessionId);
  return activities.filter((activity) => {
    if (activity.group !== group) return false;

    let startDate: Date;
    let endDate: Date;
    if (showKKT && activity.regionalStartDate && toDateOrNull(activity.regionalStartDate)) {
      startDate = toDateOrNull(activity.regionalStartDate)!;
      endDate = toDateOrNull(activity.regionalEndDate) ?? startDate;
    } else {
      const parsedStart = toDateOrNull(activity.startDate);
      if (!parsedStart) return false;
      startDate = parsedStart;
      endDate = toDateOrNull(activity.endDate) ?? startDate;
    }

    // UTC month bounds — must match matchesActivityDate / toDateOrNull (YYYY-MM-DD = UTC midnight).
    const monthStart = new Date(Date.UTC(year, month - 1, 1));
    const monthEnd = new Date(Date.UTC(year, month, 0));
    return startDate <= monthEnd && endDate >= monthStart;
  });
}

// Format date range in English
export function formatDateRange(startDate: string, endDate?: string): string {
  // Parse dates as UTC to ensure consistency between server and client
  const normalizedStartDate = normalizeDateString(startDate);
  const [startYear, startMonth, startDay] = normalizedStartDate.split('-').map(Number);
  const start = new Date(Date.UTC(startYear, startMonth - 1, startDay));
  
  let end: Date;
  if (endDate) {
    const normalizedEndDate = normalizeDateString(endDate);
    const [endYear, endMonth, endDay] = normalizedEndDate.split('-').map(Number);
    end = new Date(Date.UTC(endYear, endMonth - 1, endDay));
  } else {
    end = start;
  }
  
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  if (!endDate || startDate === endDate) {
    return `${start.getUTCDate()} ${monthNames[start.getUTCMonth()]}`;
  }
  
  if (start.getUTCMonth() === end.getUTCMonth() && start.getUTCFullYear() === end.getUTCFullYear()) {
    return `${start.getUTCDate()} - ${end.getUTCDate()} ${monthNames[end.getUTCMonth()]}`;
  }
  
  if (start.getUTCFullYear() === end.getUTCFullYear()) {
    return `${start.getUTCDate()} ${monthNames[start.getUTCMonth()]} - ${end.getUTCDate()} ${monthNames[end.getUTCMonth()]}`;
  }
  
  return `${start.getUTCDate()} ${monthNames[start.getUTCMonth()]} ${start.getUTCFullYear()} - ${end.getUTCDate()} ${monthNames[end.getUTCMonth()]} ${end.getUTCFullYear()}`;
}

/** Days from today to activity start (UTC-normalized). Returns null if start is today or in the past. */
export function getDaysUntilStart(activity: Activity, todayStr: string, showKKT?: boolean): number | null {
  const startStr = showKKT && activity.regionalStartDate ? activity.regionalStartDate : activity.startDate;
  const normalizedStartStr = normalizeDateString(startStr);
  const normalizedTodayStr = normalizeDateString(todayStr);
  const [startYear, startMonth, startDay] = normalizedStartStr.split('-').map(Number);
  const [todayYear, todayMonth, todayDay] = normalizedTodayStr.split('-').map(Number);
  const start = new Date(Date.UTC(startYear, startMonth - 1, startDay));
  const today = new Date(Date.UTC(todayYear, todayMonth - 1, todayDay));
  const diffMs = start.getTime() - today.getTime();
  const days = Math.floor(diffMs / 86400000);
  return days > 0 ? days : null;
}

export function formatCountdown(days: number): string {
  return days === 1 ? 'In 1 day' : `In ${days} days`;
}

// Get months that should be displayed for a session based on available activities
export interface GetMonthsOptions {
  selectedProgram: string;
  showRegistration?: boolean;
  showLecture?: boolean;
  showExamination?: boolean;
  showOthersExams?: boolean;
  showBreak?: boolean;
  showSemesterPendek?: boolean;
  showKuliahIntersesi?: boolean;
  showKKT?: boolean;
}

export function getMonthsForGroup(
  sessionId: SessionId,
  options: GetMonthsOptions
): Array<{ month: number; year: number }> {
  const {
    selectedProgram,
    showRegistration = true,
    showLecture = true,
    showExamination = true,
    showOthersExams = true,
    showBreak = true,
    showSemesterPendek = true,
    showKuliahIntersesi = true,
    showKKT = false,
  } = options;

  const filters: ActivityFilterOptions = {
    selectedProgram,
    showRegistration,
    showLecture,
    showSemesterPendek,
    showKuliahIntersesi,
    showExamination,
    showOthersExams,
    showBreak,
  };

  // Month strip min/max: use type toggles only; selectedProgram is 'All' so the range matches
  // the session payload in the store (Group B API is already program-scoped). Per-day cells still filter by program.
  const filtersForMonthRange: ActivityFilterOptions = {
    ...filters,
    selectedProgram: 'All',
  };

  const activities = getActivitiesForSession(sessionId);
  const group = getGroupFromSession(sessionId);
  const relevantDates: Date[] = [];

  for (const activity of activities) {
    if (activity.group !== group) continue;
    if (!shouldIncludeActivity(activity, filtersForMonthRange)) continue;

    // Use regional dates if KKT filter is on and regional dates exist
    let startDate: Date;
    let endDate: Date;

    if (showKKT && activity.regionalStartDate) {
      startDate = new Date(activity.regionalStartDate);
      endDate = activity.regionalEndDate ? new Date(activity.regionalEndDate) : startDate;
    } else {
      startDate = new Date(activity.startDate);
      endDate = activity.endDate ? new Date(activity.endDate) : startDate;
    }

    relevantDates.push(startDate);
    relevantDates.push(endDate);
  }

  if (relevantDates.length === 0) {
    const sessionRange = getSessionDateRange(sessionId);
    if (sessionRange) {
      const rangeStart = toDateOrNull(sessionRange.start);
      const rangeEnd = toDateOrNull(sessionRange.end);
      if (rangeStart && rangeEnd) return getMonthsBetweenDates(rangeStart, rangeEnd);
    }
    const fromSessionId = getMonthsUnionFromSessionIds([sessionId]);
    if (fromSessionId && fromSessionId.length > 0) return fromSessionId;
    return getDefaultMonthsWindow();
  }

  // Find min and max dates
  const minDate = new Date(Math.min(...relevantDates.map(d => d.getTime())));
  const maxDate = new Date(Math.max(...relevantDates.map(d => d.getTime())));

  // Generate array of months from min to max
  const months: Array<{ month: number; year: number }> = [];
  const currentDate = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
  const endMonth = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);

  while (currentDate <= endMonth) {
    months.push({
      month: currentDate.getMonth() + 1, // JavaScript months are 0-indexed
      year: currentDate.getFullYear(),
    });
    
    // Move to next month
    currentDate.setMonth(currentDate.getMonth() + 1);
  }

  return months;
}

/** Stable dedupe key for activities. */
function getActivityDedupeKey(a: Activity): string {
  return [
    a.name,
    a.startDate,
    a.endDate ?? '',
    a.type,
    a.details ?? '',
    a.duration ?? '',
    a.regionalStartDate ?? '',
    a.regionalEndDate ?? '',
    a.programType ?? '',
  ].join('|');
}

/** Dedupe activities by stable key, preserving order. */
function dedupeActivities(activities: Activity[]): Activity[] {
  const seen = new Set<string>();
  return activities.filter((a) => {
    const key = getActivityDedupeKey(a);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Get months for multiple sessions (union, sorted ascending). */
export function getMonthsForSessions(
  sessionIds: SessionId[],
  options: GetMonthsOptions
): Array<{ month: number; year: number }> {
  if (sessionIds.length === 0) {
    return getDefaultMonthsWindow();
  }
  const monthSet = new Set<string>();
  for (const sid of sessionIds) {
    const months = getMonthsForGroup(sid, options);
    for (const m of months) {
      monthSet.add(`${m.year}-${m.month}`);
    }
  }
  const months = Array.from(monthSet)
    .map((s) => {
      const [y, m] = s.split('-').map(Number);
      return { year: y!, month: m! };
    })
    .sort((a, b) => (a.year !== b.year ? a.year - b.year : a.month - b.month));
  if (months.length === 0) {
    const fromIds = getMonthsUnionFromSessionIds(sessionIds);
    if (fromIds && fromIds.length > 0) return fromIds;
    const fallbackMonths = getMonthsForGroup(sessionIds[0]!, {
      ...options,
      showRegistration: true,
      showLecture: true,
      showExamination: true,
      showOthersExams: true,
      showBreak: true,
      showSemesterPendek: true,
      showKuliahIntersesi: true,
    });
    return fallbackMonths.length > 0 ? fallbackMonths : getDefaultMonthsWindow();
  }
  return months;
}

/** English month labels for list section headers (UTC grouping). */
export const LIST_MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/**
 * List left column + countdown anchor. Uses regional start only when KKT toggle is on.
 * Section grouping always uses {@link getActivityListGroupMonthKey} (startDate).
 */
export function getActivityListDisplayAnchorDate(activity: Activity, showKKT: boolean): string {
  if (showKKT && activity.regionalStartDate) return activity.regionalStartDate;
  return activity.startDate;
}

/** List section key from activity startDate (UTC calendar date, not regional). */
export function getActivityListGroupMonthKey(activity: Activity): string {
  const normalized = normalizeDateString(activity.startDate);
  const [year, month] = normalized.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, 1));
  return `${LIST_MONTH_NAMES[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

export function parseListMonthKey(key: string): { year: number; month: number } {
  const [name, yearStr] = key.split(' ');
  const month = LIST_MONTH_NAMES.indexOf(name as (typeof LIST_MONTH_NAMES)[number]) + 1;
  return { year: parseInt(yearStr ?? '0', 10), month };
}

function compareActivitiesByStartDate(a: Activity, b: Activity): number {
  const dateCompare = new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
  if (dateCompare !== 0) return dateCompare;
  return a.name.localeCompare(b.name);
}

/**
 * All activities for list view: every row from the store for selected sessions,
 * filtered like grid ({@link shouldIncludeActivity}), deduped across sessions, sorted by startDate.
 */
export function getActivitiesForList(
  sessionIds: SessionId[],
  filters: ActivityFilterOptions
): Activity[] {
  if (sessionIds.length === 0) return [];
  const all: Activity[] = [];
  for (const sid of sessionIds) {
    const group = getGroupFromSession(sid);
    for (const activity of getActivitiesForSession(sid)) {
      if (activity.group === group && shouldIncludeActivity(activity, filters)) {
        all.push(activity);
      }
    }
  }
  return dedupeActivities(all).sort(compareActivitiesByStartDate);
}

/** Group list rows by startDate month (one section per activity, no overlap duplicates). */
export function groupActivitiesByListStartMonth(activities: Activity[]): Record<string, Activity[]> {
  return activities.reduce(
    (acc, activity) => {
      const monthKey = getActivityListGroupMonthKey(activity);
      if (!acc[monthKey]) acc[monthKey] = [];
      acc[monthKey].push(activity);
      return acc;
    },
    {} as Record<string, Activity[]>
  );
}

/** Get activities for a date across multiple sessions (merged, deduped). */
export function getActivitiesForDateMultiSessions(
  dateStr: string,
  sessionIds: SessionId[],
  showKKT: boolean,
  filters: ActivityFilterOptions
): Activity[] {
  if (sessionIds.length === 0) return [];
  const all: Activity[] = [];
  for (const sid of sessionIds) {
    all.push(...getActivitiesForDate(dateStr, sid, showKKT, filters));
  }
  return dedupeActivities(all);
}

/** Get activities for a month across multiple sessions (merged, deduped). */
export function getActivitiesForMonthMultiSessions(
  year: number,
  month: number,
  sessionIds: SessionId[],
  showKKT: boolean = false
): Activity[] {
  if (sessionIds.length === 0) return [];
  const all: Activity[] = [];
  for (const sid of sessionIds) {
    all.push(...getActivitiesForMonth(year, month, sid, showKKT));
  }
  return dedupeActivities(all);
}
