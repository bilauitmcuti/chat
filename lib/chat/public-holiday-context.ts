import { fetchPublicHolidayMeta, fetchPublicHolidays } from "@/lib/calendar-api-server";
import type {
  PublicHolidayMetaResponse,
  PublicHolidayRow,
  PublicHolidaysResponse,
} from "@/lib/calendar-api";
import { normalizeDateString, toComparableDateValue, toDateFormat } from "@/lib/chat/dates";
import {
  getSessionActivityDateRange,
  getSessionOptions,
  parseSessionLabelDateRange,
  type SessionId,
} from "@/lib/data";

const PUBLIC_HOLIDAY_HINTS = [
  "public holiday",
  "public holidays",
  "cuti umum",
  "cuti awam",
  "cuti kebangsaan",
  "cuti negeri",
  "cuti wilayah",
  "hari kelepasan",
  "kelepasan am",
  "malaysia holiday",
  "state holiday",
  "negeri cuti",
  "cuti negeri",
  "is it a holiday",
  "adakah cuti",
  "hari cuti",
  "cuti pada",
  "holiday on",
  "holiday in",
  "kelepasan",
];

const STATE_ALIASES: ReadonlyArray<{ slug: string; patterns: RegExp }> = [
  { slug: "johor", patterns: /\bjohor\b/i },
  { slug: "kedah", patterns: /\bkedah\b/i },
  { slug: "kelantan", patterns: /\bkelantan\b/i },
  { slug: "melaka", patterns: /\b(melaka|malacca)\b/i },
  { slug: "negeri-sembilan", patterns: /\b(negeri\s+sembilan|n\.?\s*sembilan)\b/i },
  { slug: "pahang", patterns: /\bpahang\b/i },
  { slug: "perak", patterns: /\bperak\b/i },
  { slug: "perlis", patterns: /\bperlis\b/i },
  { slug: "pulau-pinang", patterns: /\b(pulau\s+pinang|penang)\b/i },
  { slug: "sabah", patterns: /\bsabah\b/i },
  { slug: "sarawak", patterns: /\bsarawak\b/i },
  { slug: "selangor", patterns: /\bselangor\b/i },
  { slug: "terengganu", patterns: /\bterengganu\b/i },
  { slug: "kuala-lumpur", patterns: /\b(kuala\s+lumpur|kl)\b/i },
  { slug: "labuan", patterns: /\blabuan\b/i },
  { slug: "putrajaya", patterns: /\bputrajaya\b/i },
];

const MONTH_NAMES: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mac: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  mei: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  ogos: 8,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  okt: 10,
  nov: 11,
  november: 11,
  dis: 12,
  dec: 12,
  december: 12,
  disember: 12,
};

const MAX_CONTEXT_LINES = 48;

/** Nationwide when API lists all states/territories on the row. */
const NATIONWIDE_STATE_COUNT = 14;

const STATE_LABEL_BY_SLUG: Record<string, string> = {
  johor: "Johor",
  kedah: "Kedah",
  kelantan: "Kelantan",
  melaka: "Melaka",
  "negeri-sembilan": "Negeri Sembilan",
  pahang: "Pahang",
  perak: "Perak",
  perlis: "Perlis",
  "pulau-pinang": "Pulau Pinang",
  sabah: "Sabah",
  sarawak: "Sarawak",
  selangor: "Selangor",
  terengganu: "Terengganu",
  "kuala-lumpur": "Kuala Lumpur",
  labuan: "Labuan",
  putrajaya: "Putrajaya",
};

/** UiTM academic calendar weekend states — not a public-holiday answer template. */
export const UITM_KKT_STATE_SLUGS = new Set(["kedah", "kelantan", "terengganu"]);

export const PUBLIC_HOLIDAY_REPLY_STYLE =
  "PUBLIC HOLIDAY REPLY STYLE (user-facing): Use a dash list (holiday name + date) or 1–2 short sentences. Applies to every Malaysian state and federal territory in the dataset (Johor, Sabah, Sarawak, Kedah, Selangor, Kuala Lumpur, etc.). Do not write \"yes in {state}\", \"not in {state}\", or repeat API slugs. Context rows are already filtered to the user's state(s) and period—do not re-confirm scope per line. Single-date: Yes/No, then holiday name if yes. State or multi-state list: use the state name(s) the user asked for in the header (if any)—never substitute another state. UiTM KKT dual-date headings are only for UiTM semester calendar, not for cuti umum/public holiday lists.";

export interface PublicHolidayQueryIntent {
  /** Set when exactly one state/territory is named. */
  stateSlug: string | null;
  /** All states/territories detected in the message (one or more). */
  stateSlugs: string[];
  singleDate: string | null;
  rangeStartISO: string | null;
  rangeEndISO: string | null;
  wantsList: boolean;
  wantsNextOnly: boolean;
}

function isoYearMonthDay(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function lastDayOfMonthISO(year: number, month: number): string {
  const last = new Date(year, month, 0);
  return isoYearMonthDay(last.getFullYear(), last.getMonth() + 1, last.getDate());
}

function firstDayOfMonthFromISO(todayISO: string): string {
  const [y, m] = normalizeDateString(todayISO).split("-");
  return `${y}-${m}-01`;
}

function resolveMonthNumber(token: string): number | null {
  const key = token.toLowerCase();
  return MONTH_NAMES[key] ?? null;
}

/** Infer period bounds from natural language (Malay + English). */
export function parseDateRangeFromMessage(
  message: string,
  todayISO: string,
  defaultYear: number
): { start: string | null; end: string | null } {
  const lower = message.toLowerCase();
  let start: string | null = null;
  let end: string | null = null;
  const yearMatch = message.match(/\b(20\d{2})\b/);
  const year = yearMatch ? parseInt(yearMatch[1], 10) : defaultYear;

  const monthUntil =
    lower.match(
      /(?:this month|bulan ini|current month).{0,40}?(?:until|to|through|hingga|sampai|sehingga)\s+(jan(?:uary)?|feb(?:ruary)?|mac|mar(?:ch)?|apr(?:il)?|may|mei|jun(?:e)?|jul(?:y)?|ogos|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|okt|nov(?:ember)?|dis(?:ember)?|dec(?:ember)?)/i
    ) ??
    lower.match(
      /(?:from|starting|start|sejak|dari)\s+(?:this month|bulan ini).{0,40}?(?:until|to|hingga|sampai)\s+(jan(?:uary)?|feb(?:ruary)?|mac|mar(?:ch)?|apr(?:il)?|may|mei|jun(?:e)?|jul(?:y)?|ogos|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|okt|nov(?:ember)?|dis(?:ember)?|dec(?:ember)?)/i
    );
  if (monthUntil) {
    const endMonth = resolveMonthNumber(monthUntil[1]);
    if (endMonth) {
      start = firstDayOfMonthFromISO(todayISO);
      end = lastDayOfMonthISO(year, endMonth);
    }
  }

  const fromTo = lower.match(
    /(?:from|between|dari)\s+(jan(?:uary)?|feb(?:ruary)?|mac|mar(?:ch)?|apr(?:il)?|may|mei|jun(?:e)?|jul(?:y)?|ogos|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|okt|nov(?:ember)?|dis(?:ember)?|dec(?:ember)?)\s+(?:to|until|hingga|-|–)\s+(jan(?:uary)?|feb(?:ruary)?|mac|mar(?:ch)?|apr(?:il)?|may|mei|jun(?:e)?|jul(?:y)?|ogos|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|okt|nov(?:ember)?|dis(?:ember)?|dec(?:ember)?)/i
  );
  if (fromTo) {
    const startMonth = resolveMonthNumber(fromTo[1]);
    const endMonth = resolveMonthNumber(fromTo[2]);
    if (startMonth && endMonth) {
      start = isoYearMonthDay(year, startMonth, 1);
      end = lastDayOfMonthISO(year, endMonth);
    }
  }

  const untilOnly = lower.match(
    /(?:until|to|through|hingga|sampai|sehingga)\s+(jan(?:uary)?|feb(?:ruary)?|mac|mar(?:ch)?|apr(?:il)?|may|mei|jun(?:e)?|jul(?:y)?|ogos|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|okt|nov(?:ember)?|dis(?:ember)?|dec(?:ember)?)(?:\s+(20\d{2}))?/i
  );
  if (untilOnly && !end) {
    const endMonth = resolveMonthNumber(untilOnly[1]);
    const endYear = untilOnly[2] ? parseInt(untilOnly[2], 10) : year;
    if (endMonth) {
      if (!start) start = firstDayOfMonthFromISO(todayISO);
      end = lastDayOfMonthISO(endYear, endMonth);
    }
  }

  if (/\b(this month|bulan ini|current month)\b/i.test(lower) && !start) {
    start = firstDayOfMonthFromISO(todayISO);
    const [y, m] = start.split("-");
    end = lastDayOfMonthISO(parseInt(y, 10), parseInt(m, 10));
  }

  if (/\b(rest of (the )?year|selebih tahun|hingga akhir tahun)\b/i.test(lower) && !end) {
    start = start ?? todayISO;
    end = `${year}-12-31`;
  }

  return { start, end };
}

export function resolveStateSlugsFromMessage(
  message: string,
  meta?: PublicHolidayMetaResponse | null
): string[] {
  const found: string[] = [];
  for (const { slug, patterns } of STATE_ALIASES) {
    if (patterns.test(message)) found.push(slug);
  }
  if (meta?.stateOptions.length) {
    const allowed = new Set(meta.stateOptions.map((s) => s.value));
    const fromMetaLabels: string[] = [];
    const lower = message.toLowerCase();
    for (const opt of meta.stateOptions) {
      if (allowed.has(opt.value) && lower.includes(opt.label.toLowerCase())) {
        fromMetaLabels.push(opt.value);
      }
    }
    const merged = [...new Set([...found, ...fromMetaLabels])].filter((s) => allowed.has(s));
    return merged.length > 0 ? merged : found.filter((s) => allowed.has(s));
  }
  return found;
}

const MIN_PUBLIC_HOLIDAY_YEAR = 2020;
const MAX_PUBLIC_HOLIDAY_YEAR = 2035;
const MAX_PUBLIC_HOLIDAY_YEARS_FETCH = 3;

function addCalendarYearsInRange(startISO: string, endISO: string, years: Set<number>): void {
  const startY = parseInt(startISO.slice(0, 4), 10);
  const endY = parseInt(endISO.slice(0, 4), 10);
  if (!Number.isFinite(startY) || !Number.isFinite(endY)) return;
  for (let y = startY; y <= endY; y++) {
    if (y >= MIN_PUBLIC_HOLIDAY_YEAR && y <= MAX_PUBLIC_HOLIDAY_YEAR) years.add(y);
  }
}

function addYearsFromSessionSpan(sessionId: SessionId, years: Set<number>): void {
  const option = getSessionOptions().find((s) => s.id === sessionId);
  if (!option) return;
  const range =
    getSessionActivityDateRange(sessionId) ?? parseSessionLabelDateRange(option.label);
  if (!range) return;
  addCalendarYearsInRange(range.start, range.end, years);
}

function extractExplicitYearsFromMessage(message: string): number[] {
  const years: number[] = [];
  const seen = new Set<number>();
  for (const match of message.matchAll(/\b(20\d{2})\b/g)) {
    const y = parseInt(match[1]!, 10);
    if (y < MIN_PUBLIC_HOLIDAY_YEAR || y > MAX_PUBLIC_HOLIDAY_YEAR) continue;
    if (seen.has(y)) continue;
    seen.add(y);
    years.push(y);
  }
  return years;
}

/** Calendar year(s) to load from API (`year=` query) for this turn. */
export function resolvePublicHolidayYears(
  message: string,
  todayISO: string,
  sessionIds?: SessionId[],
  meta?: PublicHolidayMetaResponse | null
): number[] {
  const years = new Set<number>();
  const todayYear = parseInt(todayISO.slice(0, 4), 10);
  const allowedYears =
    meta?.yearOptions.length && meta.yearOptions.length > 0
      ? new Set(meta.yearOptions.map((y) => y.value))
      : null;

  const isAllowed = (y: number) =>
    y >= MIN_PUBLIC_HOLIDAY_YEAR &&
    y <= MAX_PUBLIC_HOLIDAY_YEAR &&
    (allowedYears == null || allowedYears.has(y));

  for (const y of extractExplicitYearsFromMessage(message)) {
    if (isAllowed(y)) years.add(y);
  }

  if (sessionIds?.length) {
    for (const sid of sessionIds) addYearsFromSessionSpan(sid, years);
  }

  const provisionalDefault =
    years.size > 0
      ? Math.min(...years)
      : allowedYears?.has(meta?.defaultYear ?? todayYear)
        ? (meta?.defaultYear ?? todayYear)
        : todayYear;
  const intent = resolvePublicHolidayQueryIntent(
    message,
    todayISO,
    provisionalDefault,
    meta
  );

  if (intent.singleDate) {
    const y = parseInt(intent.singleDate.slice(0, 4), 10);
    if (isAllowed(y)) years.add(y);
  }
  if (intent.rangeStartISO) {
    const y = parseInt(intent.rangeStartISO.slice(0, 4), 10);
    if (isAllowed(y)) years.add(y);
  }
  if (intent.rangeEndISO) {
    const y = parseInt(intent.rangeEndISO.slice(0, 4), 10);
    if (isAllowed(y)) years.add(y);
  }

  if (years.size === 0) {
    if (isAllowed(todayYear)) years.add(todayYear);
    else if (meta?.defaultYear != null && isAllowed(meta.defaultYear)) {
      years.add(meta.defaultYear);
    }
    if (intent.wantsNextOnly && isAllowed(todayYear + 1)) years.add(todayYear + 1);
  } else if (intent.wantsNextOnly) {
    const maxYear = Math.max(...years);
    if (maxYear === todayYear && isAllowed(todayYear + 1)) years.add(todayYear + 1);
  }

  // Drop years not in meta allowlist when present
  for (const y of [...years]) {
    if (!isAllowed(y)) years.delete(y);
  }

  const sorted = [...years].sort((a, b) => a - b);

  if (sorted.length <= MAX_PUBLIC_HOLIDAY_YEARS_FETCH) return sorted;
  const explicit = extractExplicitYearsFromMessage(message).filter(isAllowed);
  if (explicit.length > 0) {
    return explicit.slice(0, MAX_PUBLIC_HOLIDAY_YEARS_FETCH).sort((a, b) => a - b);
  }
  return sorted.slice(-MAX_PUBLIC_HOLIDAY_YEARS_FETCH);
}

/** Default year for parsing dates in the user message when the year is omitted. */
export function resolvePrimaryPublicHolidayYear(
  years: number[],
  message: string,
  todayISO: string
): number {
  const explicit = extractExplicitYearsFromMessage(message);
  if (explicit.length === 1) return explicit[0]!;
  if (explicit.length > 1) return explicit[explicit.length - 1]!;

  const todayYear = parseInt(todayISO.slice(0, 4), 10);
  if (years.includes(todayYear)) return todayYear;
  if (years.length === 0) return todayYear;
  return years[years.length - 1]!;
}

export function resolvePublicHolidayQueryIntent(
  message: string,
  todayISO: string,
  defaultYear: number,
  meta?: PublicHolidayMetaResponse | null
): PublicHolidayQueryIntent {
  const lower = message.toLowerCase();
  const stateSlugs = resolveStateSlugsFromMessage(message, meta);
  const stateSlug = stateSlugs.length === 1 ? stateSlugs[0]! : null;
  const singleDate = parseDateFromMessage(message, defaultYear);
  const { start, end } = parseDateRangeFromMessage(message, todayISO, defaultYear);
  const hasNextPhrase = /\b(next|upcoming|seterusnya|akan datang)\b/i.test(lower);
  const wantsList =
    !hasNextPhrase &&
    (/\b(list|senarai|show|nama|semua|all\b|full)\b/i.test(lower) ||
      /\b(public holidays?|cuti umum)\b/i.test(lower));
  const wantsNextOnly = hasNextPhrase && !wantsList && !start && !end;

  return {
    stateSlug,
    stateSlugs,
    singleDate,
    rangeStartISO: start,
    rangeEndISO: end,
    wantsList,
    wantsNextOnly,
  };
}

export function needsPublicHolidayContext(message: string): boolean {
  const lower = message.toLowerCase();
  if (PUBLIC_HOLIDAY_HINTS.some((h) => lower.includes(h))) return true;
  if (/\b(cuti|holiday)\b/.test(lower) && /\b(malaysia|negeri|state|umum|awam)\b/.test(lower)) {
    return true;
  }
  if (/\b(uitm|universiti)\b/.test(lower) && /\b(cuti|holiday|kelepasan)\b/.test(lower)) {
    const hasDate =
      /\d{1,2}[-/]\d{1,2}/.test(lower) ||
      /\b(jan|feb|mac|mar|apr|may|mei|jun|jul|ogos|aug|sep|oct|okt|nov|dis|dec)\b/.test(lower);
    if (hasDate) return true;
  }
  return false;
}

export function resolveStateSlugFromMessage(
  message: string,
  meta?: PublicHolidayMetaResponse | null
): string | null {
  const slugs = resolveStateSlugsFromMessage(message, meta);
  return slugs.length === 1 ? slugs[0]! : null;
}

function formatStateScopeLabels(
  stateSlugs: string[],
  meta?: PublicHolidayMetaResponse | null
): string {
  return stateSlugs.map((s) => stateLabelFromSlug(s, meta)).join(", ");
}

function publicHolidayStateScopeNote(
  stateSlugs: string[],
  meta?: PublicHolidayMetaResponse | null
): string {
  if (stateSlugs.length === 0) {
    return "- State: Malaysia — all states and federal territories in the dataset (nationwide + state/regional rows below).";
  }
  if (stateSlugs.length === 1) {
    const label = stateLabelFromSlug(stateSlugs[0]!, meta);
    const kkt = UITM_KKT_STATE_SLUGS.has(stateSlugs[0]!);
    return kkt
      ? `- State: ${label} only. Public holiday list for ${label} (rows below). UiTM KKT dual-date layout is for semester calendar only—not for this cuti umum list.`
      : `- State: ${label} only. List holidays observed in ${label} from rows below. Do not use Kedah/Kelantan/Terengganu (KKT) headings—those are for UiTM academic calendar, not ${label} public holidays.`;
  }
  return `- States: ${formatStateScopeLabels(stateSlugs, meta)}. Include each row below that applies to any of these states. Do not merge into a KKT heading unless the user asked for UiTM semester calendar.`;
}

/** Best-effort ISO date (YYYY-MM-DD) from user text; uses defaultYear when year omitted. */
export function parseDateFromMessage(message: string, defaultYear: number): string | null {
  const iso = message.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const dmy = message.match(/\b(\d{1,2})[-/](\d{1,2})[-/](\d{4})\b/);
  if (dmy) {
    const day = dmy[1].padStart(2, "0");
    const month = dmy[2].padStart(2, "0");
    return `${dmy[3]}-${month}-${day}`;
  }

  const dmMonth = message.match(
    /\b(\d{1,2})\s*[-/]?\s*(jan(?:uary)?|feb(?:ruary)?|mac|mar(?:ch)?|apr(?:il)?|may|mei|jun(?:e)?|jul(?:y)?|ogos|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|okt|nov(?:ember)?|dis(?:ember)?|dec(?:ember)?)(?:\s+(\d{4}))?\b/i
  );
  if (dmMonth) {
    const day = dmMonth[1].padStart(2, "0");
    const monthKey = dmMonth[2].toLowerCase();
    const month = MONTH_NAMES[monthKey];
    if (!month) return null;
    const year = dmMonth[3] ? parseInt(dmMonth[3], 10) : defaultYear;
    return `${year}-${String(month).padStart(2, "0")}-${day}`;
  }

  return null;
}

export function stateLabelFromSlug(
  slug: string,
  meta?: PublicHolidayMetaResponse | null
): string {
  const fromMeta = meta?.stateOptions.find((s) => s.value === slug)?.label;
  if (fromMeta) return fromMeta;
  return STATE_LABEL_BY_SLUG[slug] ?? slug.replace(/-/g, " ");
}

function formatStateLabelsForLine(states: string[]): string {
  return [...states]
    .map((slug) => stateLabelFromSlug(slug))
    .sort((a, b) => a.localeCompare(b))
    .join(", ");
}

/** Context line for the model (not copied verbatim to the user). */
export function formatPublicHolidayLine(h: PublicHolidayRow, stateSlug: string | null): string {
  const dateLabel = `${toDateFormat(h.date)} (${h.day})`;
  const changeNote = h.isSubjectToChange ? " [subject to change]" : "";
  let line = `- ${h.name}: ${dateLabel}`;

  if (!stateSlug && h.states.length > 0 && h.states.length < NATIONWIDE_STATE_COUNT) {
    line += ` — ${formatStateLabelsForLine(h.states)}`;
  }

  return `${line}${changeNote}`;
}

function filterHolidaysForTurn(
  data: PublicHolidaysResponse,
  intent: PublicHolidayQueryIntent,
  todayISO: string
): PublicHolidayRow[] {
  let rows = [...data.holidays];

  if (intent.stateSlugs.length > 0) {
    rows = rows.filter((h) =>
      intent.stateSlugs.some((slug) => h.states.includes(slug))
    );
  }

  if (intent.singleDate && !intent.rangeStartISO) {
    const onDate = rows.filter(
      (h) => normalizeDateString(h.date) === normalizeDateString(intent.singleDate!)
    );
    if (onDate.length > 0) return onDate;
  }

  if (intent.rangeStartISO || intent.rangeEndISO) {
    const startVal = intent.rangeStartISO
      ? toComparableDateValue(intent.rangeStartISO)
      : Number.NEGATIVE_INFINITY;
    const endVal = intent.rangeEndISO
      ? toComparableDateValue(intent.rangeEndISO)
      : Number.POSITIVE_INFINITY;
    rows = rows.filter((h) => {
      const d = toComparableDateValue(h.date);
      return d >= startVal && d <= endVal;
    });
  } else if (intent.wantsNextOnly) {
    const todayVal = toComparableDateValue(todayISO);
    rows = rows.filter((h) => toComparableDateValue(h.date) >= todayVal);
  }

  rows.sort((a, b) => toComparableDateValue(a.date) - toComparableDateValue(b.date));
  if (rows.length > MAX_CONTEXT_LINES) {
    rows = rows.slice(0, MAX_CONTEXT_LINES);
  }
  return rows;
}

function formatIntentSummary(
  intent: PublicHolidayQueryIntent,
  year: number,
  meta?: PublicHolidayMetaResponse | null
): string[] {
  const lines: string[] = [
    "USER QUESTION INTERPRETATION (apply every word—public holidays only, not UiTM semester calendar):",
    publicHolidayStateScopeNote(intent.stateSlugs, meta),
  ];

  if (intent.singleDate && !intent.rangeStartISO) {
    lines.push(`- Date: ${toDateFormat(intent.singleDate)} (single-day check).`);
  } else if (intent.rangeStartISO || intent.rangeEndISO) {
    const startLabel = intent.rangeStartISO ? toDateFormat(intent.rangeStartISO) : "start of year";
    const endLabel = intent.rangeEndISO ? toDateFormat(intent.rangeEndISO) : "end of year";
    lines.push(`- Period: ${startLabel} through ${endLabel} (inclusive). Include only rows in this window.`);
  } else if (intent.wantsNextOnly) {
    lines.push("- Period: next upcoming holiday(s) from today onward.");
  } else if (intent.wantsList) {
    lines.push(`- Period: full year ${year} unless a period line above narrows it.`);
  }

  lines.push(
    "- Reply: dash list (name + date), oldest → newest. Use ONLY matching rows below; do not invent dates or merge UiTM GROUP calendar/KKT sections."
  );

  return lines;
}

/** Per-turn directive so the model reads state, period, and scope (not hardcoded answers). */
export function getPublicHolidayUnderstandingDirective(
  message: string,
  todayISO: string,
  defaultYear: number
): string {
  const intent = resolvePublicHolidayQueryIntent(message, todayISO, defaultYear);
  const parts = [
    "\n\nTHIS TURN — MALAYSIA PUBLIC HOLIDAYS: Read the user's exact wording. Topic is official public holidays (cuti umum / public holiday), NOT UiTM semester breaks unless they also ask UiTM schedule.",
  ];

  if (intent.stateSlugs.length === 1) {
    const label = stateLabelFromSlug(intent.stateSlugs[0]!);
    const kkt = UITM_KKT_STATE_SLUGS.has(intent.stateSlugs[0]!);
    parts.push(
      kkt
        ? ` They asked about ${label} public holidays. Answer for ${label} only using rows in the MALAYSIA PUBLIC HOLIDAYS block—not UiTM KKT semester-calendar format.`
        : ` They asked about ${label}. Answer for ${label} only from the MALAYSIA PUBLIC HOLIDAYS block. Do not title the answer Kedah, Kelantan, dan Terengganu (KKT)—that is UiTM academic calendar only.`
    );
  } else if (intent.stateSlugs.length > 1) {
    parts.push(
      ` They asked about ${formatStateScopeLabels(intent.stateSlugs)}. List public holidays that apply to those states from the block—one combined list, oldest to newest.`
    );
  } else {
    parts.push(
      " No single state named—use nationwide and state/regional rows in the block for Malaysia-wide questions."
    );
  }

  if (intent.rangeStartISO || intent.rangeEndISO) {
    const startLabel = intent.rangeStartISO ? toDateFormat(intent.rangeStartISO) : "…";
    const endLabel = intent.rangeEndISO ? toDateFormat(intent.rangeEndISO) : "…";
    parts.push(
      ` They asked for a date range (${startLabel} to ${endLabel}). List only holidays in that period—do not list the whole year or omit holidays inside the range.`
    );
  } else if (intent.wantsList) {
    parts.push(" They asked for a list—return every matching row in scope as a dash list.");
  } else if (intent.wantsNextOnly) {
    parts.push(" They asked for the next upcoming holiday—give the nearest one(s) from today.");
  } else if (intent.singleDate) {
    parts.push(` They asked about ${toDateFormat(intent.singleDate)}—Yes/No then name if yes.`);
  }

  parts.push(
    " Copy dates and names from context rows only; ascending date order; no yes-in-state phrasing."
  );

  return parts.join("");
}

export function formatPublicHolidayBlock(
  data: PublicHolidaysResponse,
  message: string,
  todayISO: string,
  meta?: PublicHolidayMetaResponse | null
): string {
  const intent = resolvePublicHolidayQueryIntent(message, todayISO, data.year, meta);
  const rows = filterHolidaysForTurn(data, intent, todayISO);
  const lineStateFilter = intent.stateSlug;

  const lines = rows.map((h) => formatPublicHolidayLine(h, lineStateFilter));
  const truncated =
    data.holidays.length > rows.length
      ? `\n(showing ${rows.length} of ${data.holidays.length} holidays for this turn; ask for a state or date to narrow)`
      : "";

  return [
    `=== MALAYSIA PUBLIC HOLIDAYS (${data.year}) ===`,
    PUBLIC_HOLIDAY_REPLY_STYLE,
    ...formatIntentSummary(intent, data.year, meta),
    "Official public holiday data. Holiday rows below are oldest → newest (internal context only).",
    "For whether UiTM is off on a date: check GROUP calendar break/cuti rows for the selected session AND this block.",
    `Rows in this turn: ${rows.length} (API year total: ${data.total}).`,
    ...lines,
    truncated,
  ]
    .filter(Boolean)
    .join("\n");
}

export function formatPublicHolidayMetaBlock(meta: PublicHolidayMetaResponse): string {
  const years = meta.yearOptions
    .slice(0, 12)
    .map((y) => `- ${y.value}: ${y.label}`)
    .join("\n");
  const coverage = meta.coverageOptions
    .map((c) => `- ${c.value}: ${c.label}`)
    .join("\n");
  const states = meta.stateOptions
    .map((s) => `- ${s.value}: ${s.label}`)
    .join("\n");
  return [
    "=== PUBLIC HOLIDAY META (filter options) ===",
    `Default year: ${meta.defaultYear}`,
    "Year options:",
    years || "(none)",
    "Coverage options:",
    coverage || "(none)",
    "State slugs (use these exact values with get_public_holidays):",
    states || "(none)",
    "Do not invent state slugs or years outside this list.",
  ].join("\n");
}

export interface PublicHolidayChatContext {
  block: string;
  directive: string;
}

export interface BuildPublicHolidayChatContextOptions {
  sessionIds?: SessionId[];
}

export async function buildPublicHolidayChatContext(
  message: string,
  todayISO: string,
  options?: BuildPublicHolidayChatContextOptions
): Promise<PublicHolidayChatContext> {
  const empty = {
    block: "=== MALAYSIA PUBLIC HOLIDAYS ===\n(public holiday data unavailable)",
    directive: "",
  };
  try {
    const meta = await fetchPublicHolidayMeta().catch(() => null);
    const years = resolvePublicHolidayYears(
      message,
      todayISO,
      options?.sessionIds,
      meta
    );
    if (years.length === 0) return empty;
    const primaryYear = resolvePrimaryPublicHolidayYear(years, message, todayISO);
    const intent = resolvePublicHolidayQueryIntent(
      message,
      todayISO,
      primaryYear,
      meta
    );
    const singleState = intent.stateSlugs.length === 1 ? intent.stateSlugs[0]! : null;

    const datasets = await Promise.all(
      years.map((year) =>
        singleState
          ? fetchPublicHolidays({ year, state: singleState })
          : fetchPublicHolidays({ coverage: "all", year })
      )
    );
    const blocks = datasets
      .filter((data) => data.holidays.length > 0)
      .map((data) => formatPublicHolidayBlock(data, message, todayISO, meta));
    if (blocks.length === 0) return empty;
    return {
      block: blocks.join("\n\n"),
      directive: getPublicHolidayUnderstandingDirective(message, todayISO, primaryYear),
    };
  } catch {
    return empty;
  }
}

/** @deprecated Use buildPublicHolidayChatContext */
export async function buildPublicHolidayQuickReference(
  message: string,
  todayISO: string
): Promise<string> {
  const ctx = await buildPublicHolidayChatContext(message, todayISO);
  return ctx.block;
}
