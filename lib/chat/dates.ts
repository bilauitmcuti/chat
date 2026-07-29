const MALAYSIA_TIME_ZONE = "Asia/Kuala_Lumpur";

/** Calendar date YYYY-MM-DD in Malaysia (UTC+8), not server local/UTC. */
export function getTodayISO(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: MALAYSIA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Short weekday + day/month for calendar PWA header (SSR-safe). */
export function getMalaysiaDateHeaderParts(now: Date = new Date()): {
  dayShort: string;
  dateLabel: string;
} {
  const dayShort = new Intl.DateTimeFormat("en-MY", {
    weekday: "short",
    timeZone: MALAYSIA_TIME_ZONE,
  }).format(now);
  const dateLabel = new Intl.DateTimeFormat("en-MY", {
    day: "numeric",
    month: "short",
    timeZone: MALAYSIA_TIME_ZONE,
  }).format(now);
  return { dayShort, dateLabel };
}

/** Human-readable Malaysia date/time for AI prompts. */
export function getMalaysiaNowFormatted(now: Date = new Date()): string {
  const datePart = new Intl.DateTimeFormat("en-GB", {
    timeZone: MALAYSIA_TIME_ZONE,
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(now);
  const timePart = new Intl.DateTimeFormat("en-GB", {
    timeZone: MALAYSIA_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
  return `${datePart}, ${timePart} MYT`;
}

export function normalizeDateString(dateStr: string): string {
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

export function toComparableDateValue(dateStr: string): number {
  const normalized = normalizeDateString(dateStr);
  const value = new Date(normalized).getTime();
  return Number.isNaN(value) ? Number.POSITIVE_INFINITY : value;
}

export function toDateFormat(dateStr: string): string {
  const normalized = normalizeDateString(dateStr);
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    return `${match[3]}-${match[2]}-${match[1]}`;
  }
  return dateStr;
}

export function toReadableDate(dateStr: string): string {
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const normalized = normalizeDateString(dateStr);
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const day = parseInt(match[3], 10);
    const monthIdx = parseInt(match[2], 10) - 1;
    return `${String(day).padStart(2, "0")} ${months[monthIdx]} ${match[1]}`;
  }
  return dateStr;
}

/**
 * Token-efficient date for chat prompts: "DD Mon YYYY" with a 3-letter month
 * (English: Jan, Feb, Mar, ...). The model translates to "Mac/Ogos/Dis" for
 * Bahasa Melayu replies; keeping a single spelling in context keeps the prompt
 * compact and reduces date-format hallucinations.
 */
export function toPromptDate(dateStr: string): string {
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const normalized = normalizeDateString(dateStr);
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const day = parseInt(match[3], 10);
    const monthIdx = parseInt(match[2], 10) - 1;
    return `${String(day).padStart(2, "0")} ${months[monthIdx]} ${match[1]}`;
  }
  return dateStr;
}
