"use client";

import { useEffect } from "react";
import { ensureCalendarMeta } from "@/lib/calendar-meta";

const CALENDAR_META_IDLE_TIMEOUT_MS = 2000;

/**
 * Loads calendar meta for chat program/session dropdowns via `/api/v1/meta?all=true`.
 * Waits for idle (or 2s) so the fetch stays off Chrome's window.load / tab spinner.
 * Composer warmers share the same in-flight request via ensureCalendarMeta().
 */
export function ChatCalendarBootstrap() {
  useEffect(() => {
    let cancelled = false;
    let idleId = 0;
    let delayTimer: ReturnType<typeof setTimeout> | null = null;

    const run = () => {
      if (!cancelled) void ensureCalendarMeta();
    };

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(run, {
        timeout: CALENDAR_META_IDLE_TIMEOUT_MS,
      });
    } else {
      delayTimer = setTimeout(run, CALENDAR_META_IDLE_TIMEOUT_MS);
    }

    return () => {
      cancelled = true;
      if (idleId && typeof window !== "undefined" && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId);
      }
      if (delayTimer != null) clearTimeout(delayTimer);
    };
  }, []);

  return null;
}
