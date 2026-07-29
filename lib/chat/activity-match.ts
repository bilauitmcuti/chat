import type { Activity, SessionId } from "@/lib/data";
import { toPromptDate } from "@/lib/chat/dates";
import { sessionLabelForContext } from "@/lib/chat/context";

export interface MatchedActivity {
  activity: Activity;
  sessionId: SessionId;
  score: number;
}

export interface SearchActivitiesOptions {
  maxResults?: number;
  /** Minimum score to include (default 30 for fuzzy search). */
  minScore?: number;
}

/** High-confidence matches for preload / intent bypass (score >= 50). */
export const HIGH_CONFIDENCE_MATCH_SCORE = 50;

/** Weak candidates shown in closest-matches block (30–49). */
export const WEAK_CANDIDATE_MIN_SCORE = 30;

function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeForSearch(text: string): string[] {
  const normalized = normalizeForMatch(text);
  const stopWords = new Set([
    "bila",
    "when",
    "tarikh",
    "date",
    "the",
    "dan",
    "atau",
    "for",
    "ada",
    "boleh",
    "dari",
    "pada",
    "ini",
    "itu",
    "yang",
    "sem",
    "semester",
    "sesi",
  ]);

  return normalized
    .split(/\s+/)
    .filter((w) => w.length > 1 && !stopWords.has(w));
}

/** Extract parenthetical aliases e.g. "(SuFO)" from official activity names. */
export function extractActivityAliases(activityName: string): string[] {
  const aliases: string[] = [];
  const parenRe = /\(([^)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = parenRe.exec(activityName)) !== null) {
    const inner = m[1]?.trim();
    if (inner && inner.length >= 2) aliases.push(inner);
  }
  return aliases;
}

function scoreNameInMessage(messageNorm: string, nameNorm: string): number {
  if (nameNorm.length < 4) return 0;
  if (messageNorm.includes(nameNorm)) {
    return nameNorm.length >= 12 ? 100 : 80;
  }
  const words = nameNorm.split(" ").filter((w) => w.length > 2);
  if (words.length < 2) return 0;
  const matched = words.filter((w) => messageNorm.includes(w)).length;
  const ratio = matched / words.length;
  if (ratio >= 0.85 && matched >= 3) return 70;
  if (ratio >= 0.7 && matched >= 2) return 50;
  return 0;
}

function scoreTokenOverlap(queryTokens: string[], nameTokens: string[]): number {
  if (queryTokens.length === 0 || nameTokens.length === 0) return 0;
  const nameSet = new Set(nameTokens);
  let hits = 0;
  for (const t of queryTokens) {
    if (nameSet.has(t)) hits += 1;
  }
  if (hits === 0) return 0;
  const queryRatio = hits / queryTokens.length;
  const nameRatio = hits / nameTokens.length;
  if (queryRatio >= 0.5 && hits >= 2) return 55;
  if (queryRatio >= 0.34 && hits >= 1) return 40;
  if (nameRatio >= 0.5 && hits >= 1) return 35;
  return 0;
}

function scoreAliasMatch(messageNorm: string, queryTokens: string[], aliases: string[]): number {
  let best = 0;
  for (const alias of aliases) {
    const aliasNorm = normalizeForMatch(alias);
    if (aliasNorm.length < 2) continue;
    if (messageNorm.includes(aliasNorm)) {
      best = Math.max(best, aliasNorm.length >= 4 ? 90 : 75);
      continue;
    }
    for (const token of queryTokens) {
      if (token.length < 2) continue;
      if (aliasNorm === token || aliasNorm.includes(token) || token.includes(aliasNorm)) {
        best = Math.max(best, 70);
      }
    }
  }
  return best;
}

function scoreAcronymMatch(queryTokens: string[], nameNorm: string, aliases: string[]): number {
  let best = 0;
  const searchable = [nameNorm, ...aliases.map((a) => normalizeForMatch(a))];
  for (const token of queryTokens) {
    if (token.length < 2 || token.length > 8) continue;
    for (const text of searchable) {
      const words = text.split(/\s+/).filter(Boolean);
      if (words.some((w) => w === token)) {
        best = Math.max(best, 65);
      }
      const acronym = words.map((w) => w[0] ?? "").join("");
      if (acronym.length >= 2 && (acronym === token || token.includes(acronym))) {
        best = Math.max(best, 60);
      }
    }
  }
  return best;
}

function scoreActivityAgainstQuery(
  messageNorm: string,
  queryTokens: string[],
  activityName: string
): number {
  const nameNorm = normalizeForMatch(activityName);
  const nameTokens = tokenizeForSearch(activityName);
  const aliases = extractActivityAliases(activityName);

  const scores = [
    scoreNameInMessage(messageNorm, nameNorm),
    scoreTokenOverlap(queryTokens, nameTokens),
    scoreAliasMatch(messageNorm, queryTokens, aliases),
    scoreAcronymMatch(queryTokens, nameNorm, aliases),
  ];

  return Math.max(...scores);
}

/**
 * Fuzzy search calendar activities by message or query text.
 * Returns ranked matches with scores (exact, token, alias, acronym).
 */
export function searchActivitiesInMessage(
  message: string,
  activities: Array<{ activity: Activity; sessionId: SessionId }>,
  options?: SearchActivitiesOptions
): MatchedActivity[] {
  const maxResults = options?.maxResults ?? 8;
  const minScore = options?.minScore ?? WEAK_CANDIDATE_MIN_SCORE;
  const messageNorm = normalizeForMatch(message);
  if (messageNorm.length < 2) return [];

  const queryTokens = tokenizeForSearch(message);
  const scored: MatchedActivity[] = [];

  for (const { activity, sessionId } of activities) {
    const score = scoreActivityAgainstQuery(messageNorm, queryTokens, activity.name);
    if (score >= minScore) {
      scored.push({ activity, sessionId, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxResults);
}

/**
 * High-confidence matches for preload, intent bypass, and authoritative injection.
 */
export function matchActivitiesInMessage(
  message: string,
  activities: Array<{ activity: Activity; sessionId: SessionId }>,
  maxResults = 8
): MatchedActivity[] {
  return searchActivitiesInMessage(message, activities, {
    maxResults,
    minScore: HIGH_CONFIDENCE_MATCH_SCORE,
  });
}

export function formatMatchedActivitiesBlock(matches: MatchedActivity[]): string {
  if (matches.length === 0) return "";

  const lines: string[] = [
    "=== MATCHED ACTIVITIES (authoritative — copy these dates exactly) ===",
    "The user's message refers to these official calendar rows. Use ONLY these dates for the named event(s). Do not substitute NEXT BREAK or other events.",
  ];

  for (const { activity, sessionId } of matches) {
    const label = sessionLabelForContext(sessionId);
    let range = toPromptDate(activity.startDate);
    if (activity.endDate) range += ` to ${toPromptDate(activity.endDate)}`;
    lines.push(`- [${label}] ${activity.name}: ${range}`);
    if (activity.details) lines.push(`  Details: ${activity.details}`);
    if (activity.duration) lines.push(`  Duration: ${activity.duration}`);
    if (activity.regionalStartDate) {
      let reg = toPromptDate(activity.regionalStartDate);
      if (activity.regionalEndDate) reg += ` to ${toPromptDate(activity.regionalEndDate)}`;
      lines.push(`  Kedah, Kelantan, and Terengganu: ${reg}`);
    }
  }

  return lines.join("\n");
}

/** Closest official names when search is ambiguous (weak scores). */
export function formatClosestActivitiesBlock(matches: MatchedActivity[]): string {
  if (matches.length === 0) return "";

  const lines: string[] = [
    "=== CLOSEST MATCHES (pick the official row that best fits the user's words) ===",
    "These are the nearest official calendar names — confirm which one the user meant before stating dates.",
  ];

  for (const { activity, sessionId } of matches) {
    const label = sessionLabelForContext(sessionId);
    let range = toPromptDate(activity.startDate);
    if (activity.endDate) range += ` to ${toPromptDate(activity.endDate)}`;
    lines.push(`- [${label}] ${activity.name}: ${range}`);
  }

  return lines.join("\n");
}

/** Flat list of activities with session ids for matching. */
export function flattenActivitiesWithSession(
  sessionIds: SessionId[],
  getActs: (sid: SessionId) => Activity[]
): Array<{ activity: Activity; sessionId: SessionId }> {
  const out: Array<{ activity: Activity; sessionId: SessionId }> = [];
  for (const sid of sessionIds) {
    for (const activity of getActs(sid)) {
      out.push({ activity, sessionId: sid });
    }
  }
  return out;
}
