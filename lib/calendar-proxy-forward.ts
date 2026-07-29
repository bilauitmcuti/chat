import type { NextRequest } from "next/server";
import {
  getCalendarApiBase,
  lectureWeeksToDateMap,
  parseLectureWeeksResponse,
} from "@/lib/calendar-upstream";

export type CalendarProxyApiSuffix = "v1/meta" | "v1/calendar" | "v1/public-holiday";

/** Allowed upstream API suffixes only — not an open proxy. */
const ALLOWED_PATHS = new Set<string>(["v1/meta", "v1/calendar", "v1/public-holiday"]);

/** Meta: only these are forwarded; other keys (e.g. Next.js `_rsc`) are ignored. */
const META_QUERY_KEYS = ["group", "all"] as const;

/** Calendar: whitelist matches public API OpenAPI. */
const CALENDAR_QUERY_KEYS = [
  "session",
  "group",
  "program",
  "allSessions",
  "type",
] as const;

const PUBLIC_HOLIDAY_QUERY_KEYS = ["coverage", "year"] as const;

function upstreamOrigin(): string {
  return getCalendarApiBase();
}

function normalizeBooleanQuery(raw: string): string | null {
  const v = raw.trim().toLowerCase();
  if (v === "true" || v === "1" || v === "yes") return "true";
  if (v === "false" || v === "0" || v === "no") return "false";
  return null;
}

export function buildForwardedSearch(
  apiSuffix: CalendarProxyApiSuffix,
  request: NextRequest
): string {
  const inParams = request.nextUrl.searchParams;

  if (apiSuffix === "v1/meta") {
    const out = new URLSearchParams();
    for (const key of META_QUERY_KEYS) {
      const v = inParams.get(key);
      if (v === null || v === "") continue;
      if (key === "all") {
        const norm = normalizeBooleanQuery(v);
        if (norm === null) return "__invalid__";
        out.set(key, norm);
      } else {
        out.set(key, v);
      }
    }
    const group = out.get("group");
    if (group !== null && group !== "A" && group !== "B") {
      return "__invalid__";
    }
    const qs = out.toString();
    return qs ? `?${qs}` : "";
  }

  if (apiSuffix === "v1/public-holiday") {
    const out = new URLSearchParams();
    for (const key of PUBLIC_HOLIDAY_QUERY_KEYS) {
      const v = inParams.get(key);
      if (v === null || v === "") continue;
      out.set(key, v);
    }
    const coverage = out.get("coverage");
    if (coverage !== null && coverage !== "all") {
      return "__invalid__";
    }
    const qs = out.toString();
    return qs ? `?${qs}` : "";
  }

  const calendarOut = new URLSearchParams();
  for (const key of CALENDAR_QUERY_KEYS) {
    const v = inParams.get(key);
    if (v === null || v === "") continue;
    if (key === "allSessions") {
      const norm = normalizeBooleanQuery(v);
      if (norm === null) return "__invalid__";
      calendarOut.set(key, norm);
    } else {
      calendarOut.set(key, v);
    }
  }

  const group = calendarOut.get("group");
  if (group !== null && group !== "A" && group !== "B") {
    return "__invalid__";
  }

  const qs = calendarOut.toString();
  return qs ? `?${qs}` : "";
}

async function enrichCalendarBodyWithLectureWeeks(
  request: NextRequest,
  body: string
): Promise<string> {
  const session = request.nextUrl.searchParams.get("session")?.trim();
  if (!session) return body;

  let parsed: Record<string, unknown>;
  try {
    const raw = JSON.parse(body) as unknown;
    if (!raw || typeof raw !== "object") return body;
    parsed = { ...(raw as Record<string, unknown>) };
  } catch {
    return body;
  }

  try {
    const origin = upstreamOrigin();
    const lwRes = await fetch(
      `${origin}/api/v1/lecture-weeks?${new URLSearchParams({ session }).toString()}`,
      {
        headers: { Accept: "application/json" },
        next: { revalidate: 120 },
      }
    );
    if (lwRes.ok) {
      const lwData = await lwRes.json();
      parsed.lectureWeekByDate = lectureWeeksToDateMap(
        parseLectureWeeksResponse(lwData).weeks
      );
    }
  } catch {
    // Keep calendar payload when lecture weeks are unavailable.
  }

  return JSON.stringify(parsed);
}

/**
 * Forwards GET to the upstream calendar API. Same-origin entry points:
 * `/api/v1/meta`, `/api/v1/calendar`, and legacy `/api/calendar-proxy/v1/...`.
 */
export async function calendarProxyForward(
  request: NextRequest,
  apiSuffix: CalendarProxyApiSuffix
): Promise<Response> {
  if (!ALLOWED_PATHS.has(apiSuffix)) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const search = buildForwardedSearch(apiSuffix, request);
  if (search === "__invalid__") {
    return Response.json({ error: "Invalid query" }, { status: 400 });
  }

  const target = `${upstreamOrigin()}/api/${apiSuffix}${search}`;
  const res = await fetch(target, {
    headers: { Accept: "application/json" },
    next: { revalidate: 120 },
  });

  let body = await res.text();
  if (res.ok && apiSuffix === "v1/calendar") {
    body = await enrichCalendarBodyWithLectureWeeks(request, body);
  }

  const baseHeaders: Record<string, string> = {
    "Content-Type": res.headers.get("Content-Type") ?? "application/json",
  };
  if (res.ok) {
    /** Shared caches (CDN) may reuse JSON for a short window; browsers revalidate (max-age=0). */
    baseHeaders["Cache-Control"] =
      "public, max-age=0, s-maxage=60, stale-while-revalidate=300";
  } else {
    baseHeaders["Cache-Control"] = "no-store";
  }
  return new Response(body, {
    status: res.status,
    headers: baseHeaders,
  });
}

/** Legacy catch-all: validate `v1/meta` / `v1/calendar` from path segments. */
export async function calendarProxyForwardFromPathSegments(
  request: NextRequest,
  segments: string[]
): Promise<Response> {
  if (segments.some((s) => s === ".." || s.includes("/"))) {
    return Response.json({ error: "Invalid path" }, { status: 400 });
  }
  const suffix = segments.join("/");
  if (!suffix || !ALLOWED_PATHS.has(suffix)) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return calendarProxyForward(request, suffix as CalendarProxyApiSuffix);
}
