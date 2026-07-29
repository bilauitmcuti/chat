import type { MetaResponse } from "@/lib/calendar-api";
import { FALLBACK_DEFAULT_SESSION_MAP } from "@/lib/calendar-api";
import type { ProgramGroup, SessionId } from "@/lib/data";
import { pickSessionIdForDateFromApiOptions } from "@/lib/data";
import { getGroupFromProgram } from "@/lib/session-memory";
import type { ProgramValue } from "@/lib/route-utils";

export function knownSessionIdsForGroup(
  meta: MetaResponse,
  group: ProgramGroup
): Set<string> {
  return new Set(
    meta.sessionOptions.filter((s) => s.group === group).map((s) => s.id)
  );
}

/** Keep session ids that match the group prefix and exist in meta. */
export function filterKnownSessions(
  meta: MetaResponse,
  sessionIds: SessionId[],
  group: ProgramGroup
): SessionId[] {
  const known = knownSessionIdsForGroup(meta, group);
  const unique = Array.from(new Set(sessionIds));
  return unique.filter((id) => id.startsWith(`${group}-`) && known.has(id));
}

function defaultSessionForGroup(
  meta: MetaResponse,
  group: ProgramGroup,
  dateStr: string
): SessionId {
  const fromMap = meta.defaultSession[group];
  const known = knownSessionIdsForGroup(meta, group);
  if (fromMap && known.has(fromMap)) return fromMap;

  if (meta.sessionOptions.length === 0) {
    if (fromMap && fromMap.startsWith(`${group}-`)) return fromMap;
    return group === "A"
      ? FALLBACK_DEFAULT_SESSION_MAP.A
      : FALLBACK_DEFAULT_SESSION_MAP.B;
  }

  return pickSessionIdForDateFromApiOptions(group, dateStr, meta.sessionOptions);
}

export interface ResolveSessionsForProgramParams {
  meta: MetaResponse;
  program: ProgramValue;
  candidates: SessionId[];
  dateStr: string;
}

export interface ResolveSessionsForProgramResult {
  sessions: SessionId[];
  /** True when output differs from in-group candidates (filtered or replaced with default). */
  wasAdjusted: boolean;
}

/**
 * Validate session ids against meta; fall back to date-based default when none are valid.
 */
export function resolveSessionsForProgram(
  params: ResolveSessionsForProgramParams
): ResolveSessionsForProgramResult {
  const group = getGroupFromProgram(params.program);
  const inGroup = params.candidates.filter((id) => id.startsWith(`${group}-`));
  const known = filterKnownSessions(params.meta, inGroup, group);

  if (known.length > 0) {
    const wasAdjusted =
      known.length !== inGroup.length ||
      !inGroup.every((id, i) => known[i] === id);
    return { sessions: known, wasAdjusted };
  }

  const groupOptions = params.meta.sessionOptions.filter((s) => s.group === group);
  if (groupOptions.length === 0) {
    return { sessions: [], wasAdjusted: inGroup.length > 0 };
  }

  return {
    sessions: [defaultSessionForGroup(params.meta, group, params.dateStr)],
    wasAdjusted: inGroup.length > 0,
  };
}
