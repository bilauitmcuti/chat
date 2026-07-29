export { collectAllowedDateTokens } from "@/lib/chat/allowed-dates";

const DATE_IN_REPLY_RE = /\b(\d{2}-\d{2}-\d{4})\b/g;

/**
 * True when the reply cites at least one DD-MM-YYYY not found in the activity set.
 * Skips validation when there are no dates in the reply or no allowed tokens loaded.
 */
export function replyHasUnknownCalendarDates(
  reply: string,
  allowedDates: Set<string>
): boolean {
  if (allowedDates.size === 0) return false;
  const matches = reply.match(DATE_IN_REPLY_RE);
  if (!matches?.length) return false;
  return matches.some((d) => !allowedDates.has(d));
}

export const DATE_VALIDATION_RETRY_NUDGE =
  "\n\nCRITICAL: Your previous answer included dates not present in the context blocks (GROUP calendar, LECTURE WEEKS, MALAYSIA PUBLIC HOLIDAYS, or QUICK REFERENCE). Reply again copying dates exactly from those API-backed blocks. Do not invent dates or infer from session label month ranges alone.";
