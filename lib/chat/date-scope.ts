/**
 * Detect day / week / month / explicit-range scopes in a chat message so the
 * handler can ship the matching calendar slice (plus key milestones) to the
 * model, instead of dumping every activity or truncating mid-list.
 */

import { normalizeDateString, toComparableDateValue } from "@/lib/chat/dates";
import type { Activity } from "@/lib/data";

export type DateScopeKind = "day" | "week" | "month" | "range";

export interface DateScope {
  kind: DateScopeKind;
  startISO: string;
  endISO: string;
  /** Short human-readable label like "March 2026" or "15 Mar 2026". */
  label: string;
}

const MONTH_TOKENS: Record<string, number> = {
  jan: 1, january: 1, januari: 1,
  feb: 2, february: 2, februari: 2,
  mac: 3, mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5, mei: 5,
  jun: 6, june: 6,
  jul: 7, july: 7, julai: 7,
  ogos: 8, aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  okt: 10, oct: 10, october: 10,
  nov: 11, november: 11,
  dis: 12, dec: 12, december: 12, disember: 12,
};

const MONTH_SHORT_BM = [
  "Jan", "Feb", "Mac", "Apr", "Mei", "Jun",
  "Jul", "Ogos", "Sep", "Okt", "Nov", "Dis",
];
const MONTH_SHORT_EN = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const WEEK_RANGE_RE = /\b(minggu|week)s?\s*\d+\s*(-|to|hingga|sehingga|sampai)\s*\d+\b/i;
const MONTH_NAME_REGEX =
  /\b(jan|feb|mac|march|apr|april|may|mei|jun|jul|julai|ogos|aug|august|sep|sept|september|okt|oct|october|nov|november|dis|dec|december|disember)\b/i;

function ymd(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function parseISO(dateStr: string): Date | null {
  const normalized = normalizeDateString(dateStr);
  const m = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function isoFromDate(d: Date): string {
  return ymd(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
}

/** ISO Monday-start week (UiTM calendars often start Sunday — keep Monday for tests). */
function startOfWeek(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(d, diff);
}

function monthLabel(year: number, month: number, locale: "ms" | "en"): string {
  const months = locale === "ms" ? MONTH_SHORT_BM : MONTH_SHORT_EN;
  return `${months[month - 1]} ${year}`;
}

function detectLocale(message: string): "ms" | "en" {
  if (/\b(bila|tarikh|bulan|minggu|cuti|sesi|kuliah|pendaftaran)\b/i.test(message)) return "ms";
  return "en";
}

/**
 * Parse a single explicit date like "15 Mac 2026" / "March 15" / "15-03-2026".
 */
export function parseExplicitDate(message: string, fallbackYear: number): string | null {
  const dmYear = message.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/);
  if (dmYear) {
    const d = Number(dmYear[1]);
    const m = Number(dmYear[2]);
    const y = Number(dmYear[3]);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) return ymd(y, m, d);
  }

  const dayMonth = message.match(
    /\b(\d{1,2})\s+(jan(?:uari|uary)?|feb(?:ruari|ruary)?|mac|mar(?:ch)?|apr(?:il)?|may|mei|jun(?:e)?|jul(?:y|ai)?|ogos|aug(?:ust)?|sep(?:t(?:ember)?)?|okt|oct(?:ober)?|nov(?:ember)?|dis(?:ember)?|dec(?:ember)?)\b(?:\s+(\d{4}))?/i
  );
  if (dayMonth) {
    const d = Number(dayMonth[1]);
    const m = MONTH_TOKENS[dayMonth[2].toLowerCase()];
    const y = dayMonth[3] ? Number(dayMonth[3]) : fallbackYear;
    if (m && d >= 1 && d <= 31) return ymd(y, m, d);
  }

  const monthDay = message.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mac|mar(?:ch)?|apr(?:il)?|may|mei|jun(?:e)?|jul(?:y)?|ogos|aug(?:ust)?|sep(?:t(?:ember)?)?|okt|oct(?:ober)?|nov(?:ember)?|dis(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:,?\s+(\d{4}))?/i
  );
  if (monthDay) {
    const m = MONTH_TOKENS[monthDay[1].toLowerCase()];
    const d = Number(monthDay[2]);
    const y = monthDay[3] ? Number(monthDay[3]) : fallbackYear;
    if (m && d >= 1 && d <= 31) return ymd(y, m, d);
  }

  return null;
}

/**
 * Pick the strongest date scope expressed in the message (or null).
 * Order: explicit range → month → week → single day.
 */
export function resolveDateScope(message: string, todayISO: string): DateScope | null {
  const today = parseISO(todayISO);
  if (!today) return null;
  const locale = detectLocale(message);
  const fallbackYear = today.getFullYear();
  const lower = message.toLowerCase();

  // Explicit DD-MM-YYYY to DD-MM-YYYY range
  const explicitRange = message.match(
    /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})\s*(?:to|hingga|sampai|sehingga|-|–|until)\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})\b/i
  );
  if (explicitRange) {
    const start = parseExplicitDate(explicitRange[1], fallbackYear);
    const end = parseExplicitDate(explicitRange[2], fallbackYear);
    if (start && end) {
      return { kind: "range", startISO: start, endISO: end, label: `${start} → ${end}` };
    }
  }

  // Month to month range (e.g. "Mac to Mei 2026")
  const monthRange = lower.match(
    /\b(jan(?:uary|uari)?|feb(?:ruary|ruari)?|mac|mar(?:ch)?|apr(?:il)?|may|mei|jun(?:e)?|jul(?:y|ai)?|ogos|aug(?:ust)?|sep(?:t(?:ember)?)?|okt|oct(?:ober)?|nov(?:ember)?|dis(?:ember)?|dec(?:ember)?)\s*(?:to|hingga|sampai|sehingga|-|–|until)\s*(jan(?:uary|uari)?|feb(?:ruary|ruari)?|mac|mar(?:ch)?|apr(?:il)?|may|mei|jun(?:e)?|jul(?:y|ai)?|ogos|aug(?:ust)?|sep(?:t(?:ember)?)?|okt|oct(?:ober)?|nov(?:ember)?|dis(?:ember)?|dec(?:ember)?)(?:\s+(\d{4}))?/i
  );
  if (monthRange) {
    const m1 = MONTH_TOKENS[monthRange[1].toLowerCase()];
    const m2 = MONTH_TOKENS[monthRange[2].toLowerCase()];
    const y = monthRange[3] ? Number(monthRange[3]) : fallbackYear;
    if (m1 && m2) {
      const start = ymd(y, m1, 1);
      const end = ymd(y, m2, lastDayOfMonth(y, m2));
      return {
        kind: "range",
        startISO: start,
        endISO: end,
        label: `${monthLabel(y, m1, locale)} → ${monthLabel(y, m2, locale)}`,
      };
    }
  }

  // Month scope ("Mac 2026", "bulan ini", "next month")
  if (/\b(this month|bulan ini)\b/.test(lower)) {
    const y = today.getFullYear();
    const m = today.getMonth() + 1;
    return {
      kind: "month",
      startISO: ymd(y, m, 1),
      endISO: ymd(y, m, lastDayOfMonth(y, m)),
      label: monthLabel(y, m, locale),
    };
  }
  if (/\b(next month|bulan depan|bulan hadapan)\b/.test(lower)) {
    const next = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const y = next.getFullYear();
    const m = next.getMonth() + 1;
    return {
      kind: "month",
      startISO: ymd(y, m, 1),
      endISO: ymd(y, m, lastDayOfMonth(y, m)),
      label: monthLabel(y, m, locale),
    };
  }
  const namedMonth = lower.match(
    /\b(jan(?:uary|uari)?|feb(?:ruary|ruari)?|mac|mar(?:ch)?|apr(?:il)?|may|mei|jun(?:e)?|jul(?:y|ai)?|ogos|aug(?:ust)?|sep(?:t(?:ember)?)?|okt|oct(?:ober)?|nov(?:ember)?|dis(?:ember)?|dec(?:ember)?)(?:\s+(\d{4}))?\b/i
  );
  const hasMonthIntent = /\b(month|bulan|kalendar|calendar|schedule|jadual|aktiviti|activities|senarai|list)\b/.test(
    lower
  );
  if (namedMonth && hasMonthIntent) {
    const m = MONTH_TOKENS[namedMonth[1].toLowerCase()];
    const y = namedMonth[2] ? Number(namedMonth[2]) : fallbackYear;
    if (m) {
      return {
        kind: "month",
        startISO: ymd(y, m, 1),
        endISO: ymd(y, m, lastDayOfMonth(y, m)),
        label: monthLabel(y, m, locale),
      };
    }
  }

  // Week scope
  if (/\b(this week|minggu ini)\b/.test(lower)) {
    const start = startOfWeek(today);
    const end = addDays(start, 6);
    return {
      kind: "week",
      startISO: isoFromDate(start),
      endISO: isoFromDate(end),
      label: `${isoFromDate(start)} → ${isoFromDate(end)}`,
    };
  }
  if (/\b(next week|minggu depan|minggu hadapan)\b/.test(lower)) {
    const start = addDays(startOfWeek(today), 7);
    const end = addDays(start, 6);
    return {
      kind: "week",
      startISO: isoFromDate(start),
      endISO: isoFromDate(end),
      label: `${isoFromDate(start)} → ${isoFromDate(end)}`,
    };
  }

  // Day scope
  if (/\b(today|hari ini)\b/.test(lower)) {
    return { kind: "day", startISO: todayISO, endISO: todayISO, label: todayISO };
  }
  if (/\b(tomorrow|esok|besok)\b/.test(lower)) {
    const next = isoFromDate(addDays(today, 1));
    return { kind: "day", startISO: next, endISO: next, label: next };
  }
  if (/\b(yesterday|semalam)\b/.test(lower)) {
    const prev = isoFromDate(addDays(today, -1));
    return { kind: "day", startISO: prev, endISO: prev, label: prev };
  }

  const explicitDay = parseExplicitDate(message, fallbackYear);
  if (explicitDay && messageExplicitlyRequestsDayScope(message, explicitDay)) {
    return { kind: "day", startISO: explicitDay, endISO: explicitDay, label: explicitDay };
  }

  return null;
}

/** Avoid treating session ids (B-20263) or casual mentions as a day-scope filter. */
function messageExplicitlyRequestsDayScope(message: string, parsedISO: string): boolean {
  const lower = message.toLowerCase();
  if (/\b(today|hari ini|tomorrow|esok|besok|yesterday|semalam)\b/.test(lower)) {
    return true;
  }
  if (/\b(on|pada)\s+\d{1,2}\b/.test(lower)) return true;
  if (/\b(tarikh|date)\s+\d{1,2}[-\/]/.test(lower)) return true;
  if (/\b(bila|when)\b/.test(lower) && message.includes(parsedISO.slice(0, 4))) {
    return false;
  }
  if (/\b(bila|when|ada|any)\b/.test(lower) && /\d{1,2}[-\/]\d{1,2}[-\/]\d{4}/.test(message)) {
    return true;
  }
  if (/^\s*\d{1,2}[-\/]\d{1,2}[-\/]\d{4}\s*\??\s*$/i.test(message.trim())) {
    return true;
  }
  return false;
}

/**
 * True when the user is asking about a specific day/week/month/range — not a
 * general calendar question that happens to mention a year or session id.
 */
export function messageExplicitlyRequestsDateScope(message: string): boolean {
  const lower = message.toLowerCase();
  if (/\b(today|hari ini|tomorrow|esok|besok|yesterday|semalam)\b/.test(lower)) {
    return true;
  }
  if (/\b(this week|minggu ini|next week|minggu depan|minggu hadapan)\b/.test(lower)) {
    return true;
  }
  if (/\b(this month|bulan ini|next month|bulan depan|bulan hadapan)\b/.test(lower)) {
    return true;
  }
  if (WEEK_RANGE_RE.test(lower)) return true;
  if (
    MONTH_NAME_REGEX.test(lower) &&
    /\b(senarai|list|jadual|schedule|aktiviti|activities|kalendar|calendar|semua|all|every|setiap|bulan|month)\b/.test(
      lower
    )
  ) {
    return true;
  }
  const explicitDay = parseExplicitDate(message, new Date().getFullYear());
  if (explicitDay && messageExplicitlyRequestsDayScope(message, explicitDay)) {
    return true;
  }
  if (
    /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})\s*(?:to|hingga|sampai|sehingga|-|–|until)\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})\b/i.test(
      message
    )
  ) {
    return true;
  }
  return false;
}

/** Activity overlaps the inclusive scope range. */
function activityOverlapsScope(a: Activity, startISO: string, endISO: string): boolean {
  const aStart = toComparableDateValue(a.startDate);
  const aEnd = toComparableDateValue(a.endDate ?? a.startDate);
  const sStart = toComparableDateValue(startISO);
  const sEnd = toComparableDateValue(endISO);
  return aEnd >= sStart && aStart <= sEnd;
}

export function filterActivitiesByDateScope(
  activities: Activity[],
  scope: DateScope
): Activity[] {
  return activities.filter((a) => activityOverlapsScope(a, scope.startISO, scope.endISO));
}
