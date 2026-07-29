import "server-only";

import { applyGroupASessionsToMeta } from "@/lib/group-a-sessions";
import {
  buildUpstreamCalendarUrl,
  lectureWeeksToDateMap,
  parseLectureWeeksResponse,
} from "@/lib/calendar-upstream";
import {
  CalendarApiError,
  normalizeDefaultSession,
  parseCalendarSessionResponse,
  type CalendarSessionResult,
  type FetchCalendarSessionParams,
  type FetchMetaOptions,
  type MetaResponse,
  type ProgramOptionRow,
  type PublicHolidaysResponse,
  type SessionOptionRow,
  parsePublicHolidaysResponse,
} from "@/lib/calendar-api";
import type { LectureWeeksResponse } from "@/lib/calendar-api";

export async function fetchUpstreamJson(
  apiPath: string,
  searchParams?: URLSearchParams
): Promise<unknown> {
  const url = buildUpstreamCalendarUrl(apiPath, searchParams);
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 120 },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text.slice(0, 200) || res.statusText);
  }
  return (await res.json()) as unknown;
}

const lectureWeeksInflight = new Map<string, Promise<LectureWeeksResponse>>();
const lectureWeeksCache = new Map<
  string,
  { data: LectureWeeksResponse; at: number }
>();
const LECTURE_WEEKS_TTL_MS = 5 * 60 * 1000;

/** Server-only upstream fetch for chat / RSC (never exposed to the browser). */
export async function fetchLectureWeeks(
  sessionId: string
): Promise<LectureWeeksResponse> {
  const now = Date.now();
  const cached = lectureWeeksCache.get(sessionId);
  if (cached && now - cached.at < LECTURE_WEEKS_TTL_MS) return cached.data;

  const existing = lectureWeeksInflight.get(sessionId);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const data = await fetchUpstreamJson(
        "v1/lecture-weeks",
        new URLSearchParams({ session: sessionId })
      );
      const result = parseLectureWeeksResponse(data);
      lectureWeeksCache.set(sessionId, { data: result, at: Date.now() });
      return result;
    } finally {
      lectureWeeksInflight.delete(sessionId);
    }
  })();

  lectureWeeksInflight.set(sessionId, promise);
  return promise;
}

const publicHolidaysInflight = new Map<string, Promise<PublicHolidaysResponse>>();
const publicHolidaysCache = new Map<
  string,
  { data: PublicHolidaysResponse; at: number }
>();
const PUBLIC_HOLIDAYS_TTL_MS = 5 * 60 * 1000;

/** Server-only upstream fetch for chat (never routed through the browser proxy). */
export async function fetchPublicHolidays(
  options?: { coverage?: "all"; year?: number }
): Promise<PublicHolidaysResponse> {
  const q = new URLSearchParams({ coverage: options?.coverage ?? "all" });
  if (options?.year != null) q.set("year", String(options.year));
  const cacheKey = q.toString();

  const now = Date.now();
  const cached = publicHolidaysCache.get(cacheKey);
  if (cached && now - cached.at < PUBLIC_HOLIDAYS_TTL_MS) return cached.data;

  const existing = publicHolidaysInflight.get(cacheKey);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const data = await fetchUpstreamJson("v1/public-holiday", q);
      const result = parsePublicHolidaysResponse(data);
      publicHolidaysCache.set(cacheKey, { data: result, at: Date.now() });
      return result;
    } finally {
      publicHolidaysInflight.delete(cacheKey);
    }
  })();

  publicHolidaysInflight.set(cacheKey, promise);
  return promise;
}

function asMetaPayload(data: unknown): MetaResponse {
  if (!data || typeof data !== "object") {
    throw new Error("Calendar API meta: invalid JSON");
  }
  const o = data as Record<string, unknown>;
  const sessionOptions = Array.isArray(o.sessionOptions)
    ? (o.sessionOptions as SessionOptionRow[])
    : [];
  const programOptions = Array.isArray(o.programOptions)
    ? (o.programOptions as ProgramOptionRow[])
    : [];
  return applyGroupASessionsToMeta({
    defaultSession: normalizeDefaultSession(o.defaultSession),
    sessionOptions,
    programOptions,
  });
}

function metaCacheKey(options?: FetchMetaOptions): "default" | "entire" {
  return options?.entire ? "entire" : "default";
}

const metaInflight = new Map<"default" | "entire", Promise<MetaResponse>>();
const metaCache = new Map<
  "default" | "entire",
  { meta: MetaResponse; at: number }
>();
const META_CACHE_TTL_MS = 5 * 60 * 1000;

export async function fetchMeta(options?: FetchMetaOptions): Promise<MetaResponse> {
  const key = metaCacheKey(options);
  const existing = metaInflight.get(key);
  if (existing) return existing;

  const search = options?.entire
    ? new URLSearchParams({ all: "true" })
    : undefined;

  const promise = (async () => {
    try {
      const data = await fetchUpstreamJson("v1/meta", search);
      return asMetaPayload(data);
    } finally {
      metaInflight.delete(key);
    }
  })();

  metaInflight.set(key, promise);
  return promise;
}

export async function fetchMetaCached(
  options?: FetchMetaOptions
): Promise<MetaResponse> {
  const key = metaCacheKey(options);
  const now = Date.now();
  const hit = metaCache.get(key);
  if (hit && now - hit.at < META_CACHE_TTL_MS) return hit.meta;
  const meta = await fetchMeta(options);
  metaCache.set(key, { meta, at: now });
  return meta;
}

const calendarSessionInflight = new Map<string, Promise<CalendarSessionResult>>();
let sessionResultCache: Map<
  string,
  { result: CalendarSessionResult; at: number }
> | null = null;
const SESSION_CACHE_TTL_MS = 5 * 60 * 1000;
const SESSION_CACHE_MAX_KEYS = 48;

function getSessionFromCache(url: string): CalendarSessionResult | null {
  if (!sessionResultCache) return null;
  const hit = sessionResultCache.get(url);
  if (!hit) return null;
  if (Date.now() - hit.at >= SESSION_CACHE_TTL_MS) {
    sessionResultCache.delete(url);
    return null;
  }
  return hit.result;
}

function putSessionInCache(url: string, result: CalendarSessionResult): void {
  if (!sessionResultCache) sessionResultCache = new Map();
  if (
    sessionResultCache.size >= SESSION_CACHE_MAX_KEYS &&
    !sessionResultCache.has(url)
  ) {
    const first = sessionResultCache.keys().next().value as string | undefined;
    if (first) sessionResultCache.delete(first);
  }
  sessionResultCache.set(url, { result, at: Date.now() });
}

/** Upstream calendar + lecture weeks for RSC / chat (never routed through the browser). */
export async function fetchCalendarSession(
  params: FetchCalendarSessionParams
): Promise<CalendarSessionResult> {
  const q = new URLSearchParams();
  q.set("session", params.sessionId);
  q.set("group", params.group);
  if (params.group === "B" && params.program !== undefined && params.program !== "") {
    q.set("program", params.program);
  }
  const cacheKey = buildUpstreamCalendarUrl("v1/calendar", q);

  const cached = getSessionFromCache(cacheKey);
  if (cached) return cached;

  const existing = calendarSessionInflight.get(cacheKey);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const [calendarData, lectureWeekData] = await Promise.all([
        fetchUpstreamJson("v1/calendar", q),
        fetchUpstreamJson(
          "v1/lecture-weeks",
          new URLSearchParams({ session: params.sessionId })
        ).catch(() => null),
      ]);

      const result = parseCalendarSessionResponse(calendarData);
      if (lectureWeekData) {
        const weekMap = lectureWeeksToDateMap(
          parseLectureWeeksResponse(lectureWeekData).weeks
        );
        if (Object.keys(weekMap).length > 0) {
          result.lectureWeekByDate = weekMap;
        }
      }

      putSessionInCache(cacheKey, result);
      return result;
    } catch (error) {
      if (error instanceof Error) {
        throw new CalendarApiError(500, error.message);
      }
      throw error;
    } finally {
      calendarSessionInflight.delete(cacheKey);
    }
  })();

  calendarSessionInflight.set(cacheKey, promise);
  return promise;
}
