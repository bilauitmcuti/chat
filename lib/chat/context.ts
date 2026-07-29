import type { CalendarContextIntent } from "@/lib/chat/calendar-intent";
import {
  getActivitiesForSession,
  getDefaultSessionForGroup,
  getGroupFromSession,
  getSessionOptions,
  type Activity,
  type SessionId,
} from "@/lib/data";
import { UITM_GENERAL_INFO } from "@/lib/uitm-info";
import { compilePrompt, getCachedSystemRules } from "@/lib/chat/system-rules";
import { TABLE_OUTPUT_RULE } from "@/lib/chat/intent";
import {
  toComparableDateValue,
  toDateFormat,
  toPromptDate,
} from "@/lib/chat/dates";

export function getActivityDedupeKey(a: Activity): string {
  return [
    a.name,
    a.startDate,
    a.endDate ?? "",
    a.type,
    a.group ?? "",
    a.programTypes?.length ? a.programTypes.join(",") : (a.programType ?? ""),
    a.allStudents ? "1" : "0",
    a.details ?? "",
    a.duration ?? "",
    a.regionalStartDate ?? "",
    a.regionalEndDate ?? "",
  ].join("|");
}

export function dedupeActivities(activities: Activity[]): Activity[] {
  const seen = new Set<string>();
  return activities.filter((a) => {
    const key = getActivityDedupeKey(a);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Align with {@link shouldIncludeActivity} in lib/data.ts: cohort-wide rows have no programType/programTypes.
 */
export function filterActivityByProgram(activity: Activity, program: string): boolean {
  if (program === "All" || program === "Foundation/Professional") return true;
  if (activity.allStudents) return true;
  if (activity.general) return true;
  if (activity.programTypes?.length)
    return activity.programTypes.includes(program);
  if (activity.programType) return activity.programType === program;
  return true;
}

export function getActivitiesFromSessions(
  sessionIds: SessionId[],
  program: string,
  group: "A" | "B"
): Activity[] {
  const all: Activity[] = [];
  for (const sid of sessionIds) {
    if (getGroupFromSession(sid) !== group) continue;
    const acts = getActivitiesForSession(sid).filter((a) => a.group === group);
    all.push(...acts);
  }
  const deduped = dedupeActivities(all);
  if (group === "B") {
    return deduped.filter((a) => filterActivityByProgram(a, program));
  }
  return deduped;
}

export function resolveEffectiveSessions(
  selectedSessions: string[] | undefined,
  primaryGroup: "A" | "B",
  validSessionIds: Set<string>
): SessionId[] {
  if (!selectedSessions || selectedSessions.length === 0) {
    return [getDefaultSessionForGroup(primaryGroup)];
  }
  const valid = selectedSessions.filter(
    (id): id is SessionId => id.length > 0 && validSessionIds.has(id)
  );
  const inGroup = valid.filter((id) => getGroupFromSession(id) === primaryGroup);
  if (inGroup.length === 0) {
    return [getDefaultSessionForGroup(primaryGroup)];
  }
  return inGroup;
}

export function getFilteredGroupBActivities(program: string, sessionIds: SessionId[]): Activity[] {
  const activities = getActivitiesFromSessions(sessionIds, program, "B");
  if (activities.length > 0) return activities;
  const fallback = getActivitiesForSession(getDefaultSessionForGroup("B"));
  return fallback.filter((a) => filterActivityByProgram(a, program));
}

export function formatActivitiesAsContext(activities: Activity[]): string {
  // Oldest → newest so model lists match ascending-date instructions
  const sorted = [...activities].sort(
    (a, b) => toComparableDateValue(a.startDate) - toComparableDateValue(b.startDate)
  );

  return sorted
    .map((a) => {
      let line = `- ${a.name}: ${toPromptDate(a.startDate)}`;
      if (a.endDate) line += ` to ${toPromptDate(a.endDate)}`;
      if (a.duration) line += ` (${a.duration})`;
      if (a.details) line += ` — ${a.details}`;
      if (a.regionalStartDate) {
        line += `\n  Kedah, Kelantan, and Terengganu (regional dates): ${toPromptDate(a.regionalStartDate)}`;
        if (a.regionalEndDate) line += ` to ${toPromptDate(a.regionalEndDate)}`;
      }
      return line;
    })
    .join("\n");
}

/** Key milestones kept when intent filter narrows the primary list. */
export function formatKeyMilestonesContext(activities: Activity[]): string {
  const key = dedupeActivities(activities.filter((a) => isKeyScheduleActivityForReference(a)));
  if (key.length === 0) return "";
  const sorted = [...key].sort(
    (a, b) => toComparableDateValue(a.startDate) - toComparableDateValue(b.startDate)
  );
  return [
    "=== KEY MILESTONES (full session — always check for registration, lecture, exam, break) ===",
    formatActivitiesAsContext(sorted),
  ].join("\n");
}

export function sessionLabelForContext(sessionId: SessionId): string {
  const sess = getSessionOptions().find((s) => s.id === sessionId);
  const short = sess?.label.replace(/^Group [AB]:\s*/, "") ?? "";
  return short ? `${sessionId} (${short})` : sessionId;
}

/** Activities for one session only (no cross-session dedupe), same filters as getActivitiesFromSessions. */
export function getFilteredActivitiesForSession(
  sessionId: SessionId,
  program: string,
  group: "A" | "B"
): Activity[] {
  if (getGroupFromSession(sessionId) !== group) return [];
  let acts = getActivitiesForSession(sessionId).filter((a) => a.group === group);
  if (group === "B") {
    acts = acts.filter((a) => filterActivityByProgram(a, program));
  }
  return dedupeActivities(acts);
}

/** Single merged block for one session; multiple === SESSION === sections when user selected more than one. */
export function formatPrimaryCalendarContext(
  sessionIds: SessionId[],
  program: string,
  group: "A" | "B",
  contextIntent?: CalendarContextIntent,
  options?: { useIntentFilter?: boolean }
): string {
  if (sessionIds.length === 0) return "";
  const allowIntentFilter = options?.useIntentFilter !== false;
  const applyIntent = (acts: Activity[]) => {
    if (!allowIntentFilter) return acts;
    return contextIntent && contextIntent !== "all"
      ? filterActivitiesByContextIntent(acts, contextIntent)
      : acts;
  };

  const narrowIntent =
    allowIntentFilter &&
    contextIntent &&
    contextIntent !== "all" &&
    contextIntent !== "days_until" &&
    contextIntent !== "lecture_count";

  if (sessionIds.length === 1) {
    const sid = sessionIds[0]!;
    const allActs = getFilteredActivitiesForSession(sid, program, group);
    const acts = applyIntent(allActs);
    let out = formatActivitiesAsContext(acts);
    if (narrowIntent && acts.length < allActs.length) {
      const milestones = formatKeyMilestonesContext(allActs);
      if (milestones) out += `\n\n${milestones}`;
    }
    return out;
  }
  const parts: string[] = [];
  for (const sid of sessionIds) {
    const allActs = getFilteredActivitiesForSession(sid, program, group);
    const acts = applyIntent(allActs);
    parts.push(`=== SESSION ${sessionLabelForContext(sid)} ===`, formatActivitiesAsContext(acts));
    if (narrowIntent && acts.length < allActs.length) {
      const milestones = formatKeyMilestonesContext(allActs);
      if (milestones) parts.push(milestones);
    }
  }
  return parts.join("\n\n");
}

export function computeQuickReferenceForSessions(
  sessionIds: SessionId[],
  program: string,
  group: "A" | "B",
  todayISO: string,
  contextIntent?: CalendarContextIntent
): string {
  if (sessionIds.length === 0) return "";
  const applyIntent = (acts: Activity[]) =>
    contextIntent && contextIntent !== "all"
      ? filterActivitiesByContextIntent(acts, contextIntent)
      : acts;

  if (sessionIds.length === 1) {
    const acts = applyIntent(getFilteredActivitiesForSession(sessionIds[0]!, program, group));
    return computeQuickReference(acts, todayISO);
  }
  return sessionIds
    .map((sid) => {
      const acts = applyIntent(getFilteredActivitiesForSession(sid, program, group));
      return `[${sessionLabelForContext(sid)}]\n${computeQuickReference(acts, todayISO)}`;
    })
    .join("\n\n");
}

/**
 * Pre-compute context hints so LLaMA doesn't need to compare dates.
 * This gives immediate answers for common "next break / next exam" questions.
 */
export function computeQuickReference(activities: Activity[], todayISO: string): string {
  const sorted = [...activities].sort(
    (a, b) => toComparableDateValue(a.startDate) - toComparableDateValue(b.startDate)
  );
  const todayValue = toComparableDateValue(todayISO);

  // Find current activities (happening right now)
  const currentActivities = sorted.filter(
    (a) => {
      const start = toComparableDateValue(a.startDate);
      const end = toComparableDateValue(a.endDate ?? a.startDate);
      return start <= todayValue && end >= todayValue;
    }
  );

  // Find next upcoming break (type=break, starts after today)
  const nextBreak = sorted.find(
    (a) => a.type === "break" && toComparableDateValue(a.startDate) > todayValue
  );

  // Find next upcoming exam
  const nextExam = sorted.find(
    (a) => a.type === "examination" && toComparableDateValue(a.startDate) > todayValue
  );

  // Find semester break (Cuti Semester)
  const semesterBreak = sorted.find(
    (a) => a.name.includes("Cuti Semester") && toComparableDateValue(a.startDate) > todayValue
  );

  const lines: string[] = [];

  if (currentActivities.length > 0) {
    const current = currentActivities
      .map((a) => {
        let s = `${a.name} (${toPromptDate(a.startDate)}`;
        if (a.endDate) s += ` to ${toPromptDate(a.endDate)}`;
        s += `)`;
        return s;
      })
      .join(", ");
    lines.push(`CURRENTLY HAPPENING: ${current}`);
  } else {
    lines.push("CURRENTLY HAPPENING: No active event right now");
  }

  if (nextBreak) {
    let s = `NEXT BREAK: ${nextBreak.name} (${toPromptDate(nextBreak.startDate)}`;
    if (nextBreak.endDate) s += ` to ${toPromptDate(nextBreak.endDate)}`;
    s += `)`;
    if (nextBreak.details) s += ` — ${nextBreak.details}`;
    lines.push(s);
  }

  if (nextExam) {
    let s = `NEXT EXAM: ${nextExam.name} (${toPromptDate(nextExam.startDate)}`;
    if (nextExam.endDate) s += ` to ${toPromptDate(nextExam.endDate)}`;
    s += `)`;
    lines.push(s);
  }

  if (semesterBreak && semesterBreak !== nextBreak) {
    let s = `SEMESTER BREAK: ${semesterBreak.name} (${toPromptDate(semesterBreak.startDate)}`;
    if (semesterBreak.endDate) s += ` to ${toPromptDate(semesterBreak.endDate)}`;
    s += `)`;
    lines.push(s);
  }

  return lines.join("\n");
}

/** Context char limits to avoid oversized prompts and reduce latency. */
export const MAX_PRIMARY_CONTEXT_CHARS = 4_500;
export const MAX_PRIMARY_CONTEXT_CHARS_COMPACT = 2_000;
export const MAX_PRIMARY_CONTEXT_CHARS_NARROW = 1_500;
export const MAX_SECONDARY_CONTEXT_CHARS = 1_800;
export const MAX_COMPARISON_CONTEXT_CHARS = 2_000;
/** Calendar prompt: uitm-info.json supplement (system-rules DATA PRIORITY). */
export const MAX_CALENDAR_UITM_SUPPLEMENT_CHARS = 2_000;

export function isKeyScheduleActivityForReference(a: Activity): boolean {
  return (
    a.type === "registration" ||
    a.type === "lecture" ||
    a.type === "examination" ||
    a.type === "break" ||
    a.name.includes("Ujian Pertengahan") ||
    a.name.includes("Cuti Semester") ||
    a.name.includes("Minggu Ulangkaji") ||
    a.name.includes("Peperiksaan Akhir")
  );
}

/** When reference group has very long JSON-backed lists, keep milestone rows so truncation does not hide breaks/exams. */
export function narrowActivitiesForSecondaryReference(activities: Activity[]): Activity[] {
  if (activities.length <= 50) return activities;
  const sorted = [...activities].sort(
    (a, b) => toComparableDateValue(a.startDate) - toComparableDateValue(b.startDate)
  );
  const key = sorted.filter((a) => isKeyScheduleActivityForReference(a));
  const narrowed = key.length > 0 ? key : sorted.slice(0, 60);
  return narrowed.length > 100 ? narrowed.slice(0, 100) : narrowed;
}

/** Filter calendar rows sent to the LLM by detected question intent. */
export function filterActivitiesByContextIntent(
  activities: Activity[],
  intent: CalendarContextIntent
): Activity[] {
  if (intent === "all" || intent === "days_until" || intent === "lecture_count") {
    return activities;
  }

  const filtered = activities.filter((a) => {
    const name = a.name.toLowerCase();
    switch (intent) {
      case "break":
        return a.type === "break" || name.includes("cuti");
      case "exam":
        return (
          a.type === "examination" ||
          name.includes("peperiksaan") ||
          name.includes("ujian") ||
          name.includes("eet") ||
          name.includes("slip")
        );
      case "lecture":
        return a.type === "lecture" || name.includes("kuliah") || name.includes("lecture");
      case "registration":
        return (
          a.type === "registration" ||
          name.includes("pendaftaran") ||
          name.includes("registration") ||
          name.includes("validation") ||
          name.includes("sahkan")
        );
      case "fee":
        return (
          a.type === "registration" ||
          name.includes("gt") ||
          name.includes("rpgt") ||
          name.includes("yuran") ||
          name.includes("fee") ||
          name.includes("penangguhan") ||
          name.includes("deferment") ||
          name.includes("bayaran")
        );
      case "revision":
        return name.includes("ulangkaji") || name.includes("revision");
      case "gugur":
        return name.includes("gugur");
      case "festive":
        return (
          a.type === "break" &&
          (name.includes("raya") || name.includes("aidil") || name.includes("festive"))
        );
      default:
        return true;
    }
  });

  if (filtered.length > 0) return dedupeActivities(filtered);
  const keyRows = activities.filter((a) => isKeyScheduleActivityForReference(a));
  return keyRows.length > 0 ? dedupeActivities(keyRows) : activities;
}

export function buildComparisonContext(
  sessionIds: SessionId[],
  program: string,
  group: "A" | "B"
): string {
  if (sessionIds.length < 2) return "";
    const lines: string[] = [
    "USER SELECTED MULTIPLE SESSIONS — Use this to compare dates across sessions when asked. Each block is one session (id + label):",
  ];
  for (const sid of sessionIds) {
    const sess = getSessionOptions().find((s) => s.id === sid);
    const label = sess?.label.replace(/^Group [AB]:\s*/, "") ?? sid;
    const activities = getActivitiesFromSessions([sid], program, group);
    const sorted = [...activities].sort(
      (a, b) => toComparableDateValue(a.startDate) - toComparableDateValue(b.startDate)
    );
    const keyEvents = sorted.filter(
      (a) =>
        a.type === "lecture" ||
        a.type === "examination" ||
        a.type === "break" ||
        a.name.includes("Ujian Pertengahan") ||
        a.name.includes("Cuti Semester") ||
        a.name.includes("Minggu Ulangkaji") ||
        a.name.includes("Peperiksaan Akhir")
    );
    lines.push(`\n${sid} — ${label}:`);
    for (const a of keyEvents.slice(0, 12)) {
      const range = a.endDate ? `${toDateFormat(a.startDate)} to ${toDateFormat(a.endDate)}` : toDateFormat(a.startDate);
      lines.push(`  - ${a.name}: ${range}`);
    }
  }
  const out = lines.join("\n");
  return out.length > MAX_COMPARISON_CONTEXT_CHARS
    ? out.slice(0, MAX_COMPARISON_CONTEXT_CHARS) + "\n...[truncated]"
    : out;
}

export function buildSessionListContext(
  group: "A" | "B",
  selectedSessionIds: SessionId[]
): string {
  const selected = new Set(selectedSessionIds);
  const sessionsInGroup = getSessionOptions().filter((session) => session.group === group);
  if (sessionsInGroup.length === 0) return "No session options available.";
  return sessionsInGroup
    .map((session) => {
      const label = session.label.replace(/^Group [AB]:\s*/, "");
      const marker = selected.has(session.id) ? " (selected)" : "";
      return `- ${session.id}: ${label}${marker}`;
    })
    .join("\n");
}

export interface CalendarPromptBuildOptions {
  /** Omit secondary group calendar block to shrink prompt (simple questions). */
  includeSecondaryContext?: boolean;
  maxPrimaryChars?: number;
}

export function buildCalendarSystemPrompt(
  programLabel: string,
  primaryGroup: string,
  secondaryGroup: string,
  sessionListContext: string,
  primaryContext: string,
  secondaryContext: string,
  primaryDesc: string,
  secondaryDesc: string,
  todayFormatted: string,
  quickReference: string,
  comparisonContext?: string,
  forceTableOutput?: boolean,
  multipleSessionsSelected?: boolean,
  uitmSupplement?: string,
  selectedSessionCount?: number,
  buildOptions?: CalendarPromptBuildOptions
): string {
  const primaryCap = buildOptions?.maxPrimaryChars ?? MAX_PRIMARY_CONTEXT_CHARS;
  const includeSecondary = buildOptions?.includeSecondaryContext !== false;
  const truncatedPrimary =
    primaryContext.length > primaryCap
      ? primaryContext.slice(0, primaryCap) + "\n...[truncated]"
      : primaryContext;
  const secondaryForPrompt = includeSecondary ? secondaryContext : "";
  const truncatedSecondary =
    secondaryForPrompt.length > MAX_SECONDARY_CONTEXT_CHARS
      ? secondaryForPrompt.slice(0, MAX_SECONDARY_CONTEXT_CHARS) + "\n...[truncated]"
      : secondaryForPrompt;

  const rules = getCachedSystemRules() ?? { schemaVersion: 1, calendarPromptCompact: "", calendarPromptTemplate: "", researchPrompt: "" };
  const template = compilePrompt(rules.calendarPromptCompact);
  let result = template
    .replace(/\{\{programLabel\}\}/g, programLabel)
    .replace(/\{\{primaryGroup\}\}/g, primaryGroup)
    .replace(/\{\{secondaryGroup\}\}/g, secondaryGroup)
    .replace(/\{\{primaryContext\}\}/g, truncatedPrimary)
    .replace(/\{\{secondaryContext\}\}/g, truncatedSecondary)
    .replace(/\{\{primaryDesc\}\}/g, primaryDesc)
    .replace(/\{\{secondaryDesc\}\}/g, secondaryDesc)
    .replace(/\{\{today\}\}/g, todayFormatted)
    .replace(/\{\{quickReference\}\}/g, quickReference);

  result += `\n\n=== SESSION LIST (GROUP ${primaryGroup}) ===\n${sessionListContext}`;

  const n = selectedSessionCount ?? 0;
  result += `\n\n=== SELECTED SESSIONS (USER CHOICE) ===\nRows marked "(selected)" are the user's current session choice(s). Count: ${n}. Unless the user names a different session id explicitly, treat vague wording about semester calendar, sessions, sesi, next/last semester, or Malay equivalents (e.g. kalendar semester, semester depan, semester lepas, sesi seterusnya) as referring to these selected session(s) and the GROUP calendar sections below. With multiple selections, scope or compare answers per session (id + label).`;

  if (comparisonContext && comparisonContext.length > 0) {
    result += `\n\n=== SESSION COMPARISON (user selected multiple sessions) ===\n${comparisonContext}`;
  }
  if (multipleSessionsSelected) {
    result +=
      "\n\nMULTI-SESSION LABELING (MANDATORY): The user selected more than one session in the dropdown. The primary calendar is split into === SESSION sessionId (label) === sections. For every calendar answer, state which session each date or event belongs to—use both the session id and the human-readable label from the SESSION LIST (same format as the section headers). Do not combine dates from different sessions in one sentence without naming each session. For Malay replies, you may write sesi or penggal with the id/label.";
  }
  if (forceTableOutput) {
    result += TABLE_OUTPUT_RULE;
  }
  const uitm =
    uitmSupplement && uitmSupplement.length > 0
      ? uitmSupplement.length > MAX_CALENDAR_UITM_SUPPLEMENT_CHARS
        ? uitmSupplement.slice(0, MAX_CALENDAR_UITM_SUPPLEMENT_CHARS) + "\n...[truncated]"
        : uitmSupplement
      : "";
  if (uitm.length > 0) {
    result +=
      "\n\n=== UITM KNOWLEDGE (SUPPLEMENTARY — from uitm-info.json; use for campuses, faculties, portals, admissions. For dates/schedules prefer GROUP sections and QUICK REFERENCE above.) ===\n" +
      uitm;
  }
  return result;
}

/** Max chars for UiTM info context to avoid oversized prompts. */
export const MAX_UITM_INFO_CHARS = 5_000;

export function buildResearchSystemPrompt(todayFormatted: string): string {
  const rules = getCachedSystemRules() ?? { schemaVersion: 1, calendarPromptCompact: "", calendarPromptTemplate: "", researchPrompt: "" };
  const truncatedInfo =
    UITM_GENERAL_INFO.length > MAX_UITM_INFO_CHARS
      ? UITM_GENERAL_INFO.slice(0, MAX_UITM_INFO_CHARS) + "\n...[truncated]"
      : UITM_GENERAL_INFO;

  return compilePrompt(rules.researchPrompt)
    .replace(/\{\{uitmInfo\}\}/g, truncatedInfo)
    .replace(/\{\{today\}\}/g, todayFormatted);
}
