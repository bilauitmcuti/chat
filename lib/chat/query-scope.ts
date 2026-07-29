/**
 * Parse a chat message for explicit session ids and relative-session phrases
 * ("next semester", "semester depan", "previous session", etc.) so the handler
 * can load and label the right calendar data — not just the dropdown selection.
 */

import {
  getDefaultSessionForGroup,
  getSessionActivityDateRange,
  getSessionOptionsForGroup,
  parseSessionLabelDateRange,
  pickSessionIdForDateFromApiOptions,
  type SessionId,
  type SessionOptionLike,
} from "@/lib/data";
import { normalizeDateString, toDateFormat, toPromptDate } from "@/lib/chat/dates";

export type RelativeSession = "next" | "previous" | "current";

const SESSION_ID_RE = /\b([AB])-?(\d{4,6})\b/gi;

const NEXT_HINTS = [
  "next semester",
  "next session",
  "next sesi",
  "semester depan",
  "semester seterusnya",
  "sesi depan",
  "sesi seterusnya",
  "upcoming semester",
  "upcoming session",
  "semester akan datang",
  "sesi akan datang",
  "semester baru",
  "sesi baru",
];

const PREVIOUS_HINTS = [
  "last semester",
  "previous semester",
  "past semester",
  "semester lepas",
  "semester lalu",
  "sesi lepas",
  "sesi lalu",
  "previous session",
  "past session",
  "last session",
];

const CURRENT_HINTS = [
  "this semester",
  "current semester",
  "semester ini",
  "semester sekarang",
  "this session",
  "current session",
  "sesi ini",
  "sesi sekarang",
];

function normalizeSessionId(raw: string): SessionId {
  return raw.toUpperCase().replace(/^([AB])(\d)/, "$1-$2");
}

/** Extract explicit session ids the user mentioned, in order of appearance. */
export function extractMentionedSessionIds(
  message: string,
  validIds: Set<string>
): SessionId[] {
  const found: SessionId[] = [];
  const seen = new Set<string>();
  for (const match of message.matchAll(SESSION_ID_RE)) {
    const id = normalizeSessionId(match[0]);
    if (!validIds.has(id)) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    found.push(id);
  }
  return found;
}

export function detectRelativeSession(message: string): RelativeSession | null {
  const lower = message.toLowerCase();
  if (NEXT_HINTS.some((kw) => lower.includes(kw))) return "next";
  if (PREVIOUS_HINTS.some((kw) => lower.includes(kw))) return "previous";
  if (CURRENT_HINTS.some((kw) => lower.includes(kw))) return "current";
  return null;
}

function sessionTimelineRange(option: SessionOptionLike): {
  start: string;
  end: string;
  fromActivities: boolean;
} | null {
  const fromActs = getSessionActivityDateRange(option.id);
  if (fromActs) {
    return { ...fromActs, fromActivities: true };
  }
  const fromLabel = parseSessionLabelDateRange(option.label);
  if (fromLabel) {
    return { ...fromLabel, fromActivities: false };
  }
  return null;
}

/**
 * Resolve a relative-session phrase against today's date. Prefer activity
 * date spans from the API over session label month ranges (Mar–Aug).
 */
export function resolveRelativeSession(
  group: "A" | "B",
  relative: RelativeSession,
  todayISO: string
): SessionId | null {
  const options = getSessionOptionsForGroup(group);
  if (options.length === 0) return null;

  const today = normalizeDateString(todayISO);

  if (relative === "current") {
    return pickSessionIdForDateFromApiOptions(group, todayISO, options);
  }

  type Entry = { id: SessionId; start: string; end: string };
  const entries: Entry[] = [];
  for (const opt of options) {
    const range = sessionTimelineRange(opt);
    if (range) entries.push({ id: opt.id, start: range.start, end: range.end });
  }

  if (entries.length === 0) {
    return getDefaultSessionForGroup(group);
  }

  entries.sort((a, b) => a.start.localeCompare(b.start));

  if (relative === "next") {
    const future = entries.find((e) => e.start > today);
    return future?.id ?? entries[entries.length - 1]!.id;
  }
  if (relative === "previous") {
    const past = entries.filter((e) => e.end < today);
    if (past.length > 0) return past[past.length - 1]!.id;
    const beforeStart = [...entries].reverse().find((e) => e.start < today);
    return beforeStart?.id ?? entries[0]!.id;
  }

  return pickSessionIdForDateFromApiOptions(group, todayISO, options);
}

/**
 * Clarifies that session dropdown labels (e.g. Mar–Aug 2026) are shorthand only;
 * API activities for that session may start earlier and end later.
 */
export function buildSessionTimelineBlock(
  sessionIds: SessionId[],
  group: "A" | "B"
): string {
  const options = getSessionOptionsForGroup(group);
  const lines: string[] = [
    "=== SESSION TIMELINE (API data — label months are NOT cut-off dates) ===",
    "Session labels (e.g. Mar–Aug) describe the semester nickname only. Events in GROUP calendar below may start BEFORE the label's first month and end AFTER the last month.",
  ];

  for (const sid of sessionIds) {
    const opt = options.find((o) => o.id === sid);
    if (!opt) {
      lines.push(`- ${sid}: (no meta)`);
      continue;
    }
    const labelShort = opt.label.replace(/^Group [AB]:\s*/, "");
    const labelRange = parseSessionLabelDateRange(opt.label);
    const actRange = getSessionActivityDateRange(sid);
    const labelPart = labelRange
      ? `label months ~ ${toPromptDate(labelRange.start)} – ${toPromptDate(labelRange.end)}`
      : `label: ${labelShort}`;
    const actPart = actRange
      ? `API activities span ${toDateFormat(actRange.start)} – ${toDateFormat(actRange.end)} (use these dates)`
      : "API activities: not loaded";
    lines.push(`- ${sid} (${labelShort}): ${labelPart}; ${actPart}`);
  }

  return lines.join("\n");
}

export interface ResolvedQueryScope {
  /** Sessions explicitly mentioned by id in the message. */
  mentioned: SessionId[];
  /** Relative session resolution (e.g. semester depan → next session id). */
  relativeId: SessionId | null;
  relativeKind: RelativeSession | null;
}

export function resolveQueryScope(
  message: string,
  primaryGroup: "A" | "B",
  validSessionIds: Set<string>,
  todayISO: string
): ResolvedQueryScope {
  const mentioned = extractMentionedSessionIds(message, validSessionIds);
  const relativeKind = detectRelativeSession(message);
  const relativeId = relativeKind
    ? resolveRelativeSession(primaryGroup, relativeKind, todayISO)
    : null;
  return { mentioned, relativeId, relativeKind };
}

/** Union of dropdown sessions, mentioned ids in the same group, and relative target. */
export function mergeSessionsForLoad(
  effective: SessionId[],
  scope: ResolvedQueryScope,
  primaryGroup: "A" | "B",
  getGroup: (id: SessionId) => "A" | "B"
): SessionId[] {
  const out = new Set<SessionId>(effective);
  for (const id of scope.mentioned) {
    if (getGroup(id) === primaryGroup) out.add(id);
  }
  if (scope.relativeId && getGroup(scope.relativeId) === primaryGroup) {
    out.add(scope.relativeId);
  }
  return [...out];
}

const RELATIVE_LABEL: Record<RelativeSession, string> = {
  next: "next session (semester depan / seterusnya)",
  previous: "previous session (semester lepas / lalu)",
  current: "current session (semester ini / sekarang)",
};

/**
 * Short structured block describing how the user's wording resolves to a
 * specific session id, so the model does not have to infer it.
 */
export function buildQueryScopeBlock(
  scope: ResolvedQueryScope,
  effective: SessionId[]
): string {
  const lines: string[] = [];
  if (scope.mentioned.length > 0) {
    lines.push(`MENTIONED SESSION(S): ${scope.mentioned.join(", ")}`);
  }
  if (scope.relativeKind && scope.relativeId) {
    lines.push(
      `RESOLVED ${RELATIVE_LABEL[scope.relativeKind].toUpperCase()}: ${scope.relativeId}`
    );
  } else if (scope.relativeKind) {
    lines.push(
      `RESOLVED ${RELATIVE_LABEL[scope.relativeKind].toUpperCase()}: (no session match — use selected)`
    );
  }
  if (lines.length === 0) return "";
  lines.push(`SELECTED SESSION(S): ${effective.join(", ") || "(default)"}`);
  return `=== QUERY SCOPE ===\n${lines.join("\n")}`;
}

