import { getDefaultSessionForGroup } from "@/lib/data";
import type { SessionId } from "@/lib/data";
import {
  getFiltersFromCookie,
  setFiltersToCookie,
  type FilterStates,
} from "@/lib/cookie-utils";
import { isProgramValue, type ProgramValue } from "@/lib/route-utils";
import {
  areSessionListsEqual,
  getGroupFromProgram,
  getSessionMemoryKey,
  normalizeSessionsForGroup,
} from "@/lib/session-memory";

export type ProgramSessionMap = Partial<Record<ProgramValue, SessionId[]>>;

export interface ChatHomepageHydration {
  program: ProgramValue;
  sessionsByProgram: ProgramSessionMap;
  selectedSessions: SessionId[];
}

export function resolveSessionsForProgram(
  program: ProgramValue,
  sessionCandidates: SessionId[],
  sessionsByProgram: ProgramSessionMap,
  _dateStr: string
): SessionId[] {
  const group = getGroupFromProgram(program);
  const sessionMemoryKey = getSessionMemoryKey(program);
  const fromCandidates = normalizeSessionsForGroup(sessionCandidates, group);
  if (fromCandidates.length > 0) return fromCandidates;

  const fromProgramMemory = normalizeSessionsForGroup(sessionsByProgram[sessionMemoryKey] ?? [], group);
  if (fromProgramMemory.length > 0) return fromProgramMemory;

  return [getDefaultSessionForGroup(group)];
}

export function normalizeEntriesFromSessionMap(
  raw: Partial<Record<ProgramValue, SessionId[]>> | null | undefined
): ProgramSessionMap {
  const normalized: ProgramSessionMap = {};
  if (!raw || typeof raw !== "object") return normalized;
  for (const [programKey, sessionIds] of Object.entries(raw)) {
    if (!Array.isArray(sessionIds) || sessionIds.length === 0) continue;
    const program = programKey as ProgramValue;
    const group = getGroupFromProgram(program);
    const inGroup = normalizeSessionsForGroup(sessionIds, group);
    if (inGroup.length > 0) normalized[getSessionMemoryKey(program)] = inGroup;
  }
  return normalized;
}

/** Prefer `calendar-filters` cookie (homepage / SSR), then localStorage. */
export function mergeSessionMapsFromHomepage(
  fromLocal: Partial<Record<ProgramValue, SessionId[]>> | null,
  filters: FilterStates
): ProgramSessionMap {
  const localNorm = normalizeEntriesFromSessionMap(fromLocal);
  const cookieNorm = normalizeEntriesFromSessionMap(filters.sessionIdsByProgram ?? null);
  const merged: ProgramSessionMap = { ...localNorm, ...cookieNorm };

  if (filters.sessionIds && filters.sessionIds.length > 0) {
    const prog =
      filters.selectedProgram && isProgramValue(filters.selectedProgram)
        ? filters.selectedProgram
        : "All";
    const memKey = getSessionMemoryKey(prog);
    const group = getGroupFromProgram(prog);
    const ids = normalizeSessionsForGroup(filters.sessionIds as SessionId[], group);
    if (ids.length > 0 && (!merged[memKey] || merged[memKey]!.length === 0)) {
      merged[memKey] = ids;
    }
  }

  return merged;
}

export function getInitialChatSessions(program: string): SessionId[] {
  const group: "A" | "B" = program === "Foundation/Professional" ? "A" : "B";
  return [getDefaultSessionForGroup(group)];
}

export function areProgramSessionMapsEqual(
  left: ProgramSessionMap,
  right: ProgramSessionMap
): boolean {
  const keys = new Set([
    ...Object.keys(left),
    ...Object.keys(right),
  ] as ProgramValue[]);
  for (const key of keys) {
    const leftIds = left[key] ?? [];
    const rightIds = right[key] ?? [];
    if (!areSessionListsEqual(leftIds, rightIds)) return false;
  }
  return true;
}

/** Read cookie + localStorage the same way chat hydrates from the homepage. */
export function resolveHomepageChatHydration(
  dateStr = new Date().toISOString().slice(0, 10)
): ChatHomepageHydration | null {
  if (typeof window === "undefined") return null;
  try {
    const filters = getFiltersFromCookie();
    const raw =
      localStorage.getItem("sessionIdsByProgram") ??
      localStorage.getItem("chatSessionIdsByProgram");
    const parsed = raw
      ? (JSON.parse(raw) as Partial<Record<ProgramValue, SessionId[]>>)
      : null;

    const merged = mergeSessionMapsFromHomepage(parsed, filters);
    const sessionsByProgram: ProgramSessionMap = {
      All: getInitialChatSessions("All"),
      ...merged,
    };

    const storedProgram = localStorage.getItem("selectedProgram");
    const program: ProgramValue =
      filters.selectedProgram && isProgramValue(filters.selectedProgram)
        ? filters.selectedProgram
        : storedProgram && isProgramValue(storedProgram)
          ? storedProgram
          : "All";

    const selectedSessions = resolveSessionsForProgram(
      program,
      [],
      sessionsByProgram,
      dateStr
    );

    return { program, sessionsByProgram, selectedSessions };
  } catch {
    return null;
  }
}

/**
 * Persist chat program/session selection to localStorage + `calendar-filters`
 * cookie (merge existing homepage filter toggles so showKKT etc. are preserved).
 */
export function persistChatProgramSessions(params: {
  program: ProgramValue;
  sessionsByProgram: ProgramSessionMap;
  selectedSessions: SessionId[];
}): void {
  if (typeof window === "undefined") return;
  const { program, sessionsByProgram, selectedSessions } = params;
  if (selectedSessions.length === 0) return;

  try {
    localStorage.setItem("selectedProgram", program);
    localStorage.setItem("sessionIdsByProgram", JSON.stringify(sessionsByProgram));
    localStorage.setItem("chatSessionIdsByProgram", JSON.stringify(sessionsByProgram));
  } catch {
    // Ignore storage errors (private mode / quota).
  }

  const existing = getFiltersFromCookie();
  setFiltersToCookie({
    ...existing,
    sessionId: selectedSessions[0],
    sessionIds: selectedSessions,
    sessionIdsByProgram: sessionsByProgram,
    selectedProgram: program,
  });
}

/** True when homepage sources already match the live chat selection (skip overwrite). */
export function isChatSelectionInSyncWithHomepage(
  current: ChatHomepageHydration,
  fromHomepage: ChatHomepageHydration
): boolean {
  return (
    current.program === fromHomepage.program &&
    areSessionListsEqual(current.selectedSessions, fromHomepage.selectedSessions) &&
    areProgramSessionMapsEqual(current.sessionsByProgram, fromHomepage.sessionsByProgram)
  );
}
