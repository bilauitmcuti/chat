/**
 * Heuristics for detecting AI replies that were cut off mid-thought.
 *
 * Triggers a single retry with a higher token budget and a completion nudge.
 * Keep checks conservative — false positives waste a retry, false negatives
 * leave the user with a half-finished list.
 */

const TRAILING_DASH_RE = /(^|\n)-\s*$/;
const TRAILING_NUMBER_RE = /(^|\n)\d+\.\s*$/;
const TRAILING_OPEN_PAREN_RE = /\(\s*$/;
const SENTENCE_END_RE = /[.!?\]"')]\s*$/;

const MIN_REPLY_LENGTH_FOR_LIST_CHECK = 40;

export interface IncompletenessReason {
  reason:
    | "trailing-dash"
    | "trailing-number"
    | "trailing-paren"
    | "unclosed-table"
    | "no-sentence-end";
}

/**
 * Best-effort check that the reply ends in a usable place.
 *
 * @param reply Cleaned reply text (post `cleanAiReply`).
 * @param expectsList Set when the question asked for a list/schedule answer.
 */
export function detectIncompleteReply(
  reply: string,
  expectsList: boolean
): IncompletenessReason | null {
  const trimmed = reply.trimEnd();
  if (trimmed.length === 0) return null;

  const openTable = (trimmed.match(/\[TABLE\]/gi) ?? []).length;
  const closeTable = (trimmed.match(/\[\/TABLE\]/gi) ?? []).length;
  if (openTable > closeTable) return { reason: "unclosed-table" };

  if (TRAILING_DASH_RE.test(trimmed)) return { reason: "trailing-dash" };
  if (TRAILING_NUMBER_RE.test(trimmed)) return { reason: "trailing-number" };
  if (TRAILING_OPEN_PAREN_RE.test(trimmed)) return { reason: "trailing-paren" };

  if (
    expectsList &&
    trimmed.length >= MIN_REPLY_LENGTH_FOR_LIST_CHECK &&
    !SENTENCE_END_RE.test(trimmed) &&
    !/(^|\n)\s*-\s+\S/.test(trimmed.split("\n").slice(-2).join("\n"))
  ) {
    return { reason: "no-sentence-end" };
  }

  return null;
}

export const REPLY_COMPLETION_RETRY_NUDGE =
  "\n\nCRITICAL: Your previous reply was cut off (ended at a header, colon, dash, or unfinished sentence). Re-answer the user's question with the COMPLETE response — fill every list item, close every section, and finish every sentence with proper punctuation. Do not stop until the answer is finished.";
