import {
  fetchMetaCached,
  fetchCalendarSession,
} from "./calendar-api-server";
import type { MetaResponse } from "./calendar-api";
import { FALLBACK_DEFAULT_SESSION_MAP } from "./calendar-api";
import {
  getSnapshot,
  mergeSessions,
  resetSessionActivitiesCache,
  setMeta,
} from "./calendar-store";
import { getDefaultSessionForGroup, type Activity, type SessionId } from "./data";

const FALLBACK_META: MetaResponse = {
  defaultSession: { ...FALLBACK_DEFAULT_SESSION_MAP },
  sessionOptions: [],
  programOptions: [],
};

function metaSignature(meta: MetaResponse): string {
  return JSON.stringify({
    defaultSession: meta.defaultSession,
    sessionOptions: meta.sessionOptions.map((s) => s.id),
    programOptions: meta.programOptions.map((p) => p.value),
  });
}

export async function loadMetaIntoStore(): Promise<MetaResponse> {
  const prevSignature = metaSignature({
    defaultSession: getSnapshot().defaultSession,
    sessionOptions: getSnapshot().sessionOptions,
    programOptions: getSnapshot().programOptions,
  });

  let meta: MetaResponse;
  try {
    meta = await fetchMetaCached({ entire: true });
    if (meta.sessionOptions.length === 0) meta = FALLBACK_META;
    setMeta(meta);
  } catch {
    meta = FALLBACK_META;
    setMeta(meta);
  }

  if (metaSignature(meta) !== prevSignature) {
    resetSessionActivitiesCache();
  }
  return meta;
}

export function validSetsFromMeta(meta: MetaResponse): {
  validSessionIds: Set<string>;
  validPrograms: Set<string>;
} {
  return {
    validSessionIds: new Set(meta.sessionOptions.map((s) => s.id)),
    validPrograms: new Set(meta.programOptions.map((p) => p.value)),
  };
}

async function fetchAndCacheSession(
  sid: SessionId,
  group: "A" | "B",
  program: string
): Promise<{ activities: Activity[] }> {
  try {
    const activities = await fetchCalendarSession({
      sessionId: sid,
      group,
      program: group === "B" ? program : undefined,
    });
    return { activities: activities.activities };
  } catch {
    return { activities: [] };
  }
}

/**
 * Load activities for chat context via the live calendar API (no static bundle).
 */
export async function loadActivitiesIntoStoreForChat(
  selectedProgram: string,
  primaryGroup: "A" | "B",
  effectiveSessionIds: SessionId[]
): Promise<void> {
  const secondaryGroup = primaryGroup === "A" ? "B" : "A";
  const secondaryDefault = getDefaultSessionForGroup(secondaryGroup);

  const needed = new Set<SessionId>();
  for (const sid of effectiveSessionIds) needed.add(sid);
  needed.add(secondaryDefault);

  const results = await Promise.all(
    Array.from(needed).map((sid) => {
      const g = sid.startsWith("A-") ? "A" : "B";
      return fetchAndCacheSession(sid, g, selectedProgram).then(
        (r) => [sid, r] as const
      );
    })
  );

  const merges: Record<string, { activities: Activity[] }> = {};
  for (const [sid, r] of results) merges[sid] = r;
  mergeSessions(merges);
}

/** Ensure session ids are present in the store (from live API). */
export async function ensureSessionsInStore(
  sessionIds: SessionId[],
  selectedProgram: string
): Promise<void> {
  const snap = getSnapshot();
  const toFetch = sessionIds.filter((sid) => {
    const bucket = snap.sessions[sid];
    return !bucket || !Array.isArray(bucket.activities);
  });
  if (toFetch.length === 0) return;

  const results = await Promise.all(
    toFetch.map((sid) => {
      const g = sid.startsWith("A-") ? "A" : "B";
      return fetchAndCacheSession(sid, g, selectedProgram).then(
        (r) => [sid, r] as const
      );
    })
  );

  const merges: Record<string, { activities: Activity[] }> = {};
  for (const [sid, r] of results) merges[sid] = r;
  mergeSessions(merges);
}
