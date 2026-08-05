"use client";

import { useEffect } from "react";
import { ensureCalendarMeta } from "@/lib/calendar-meta";

/**
 * Loads calendar meta for chat program/session dropdowns via `/api/v1/meta?all=true`.
 * Kicks after first paint so apex `/chat` navigation stays off the critical path,
 * then warmers in the composer can share the same in-flight request.
 */
export function ChatCalendarBootstrap() {
  useEffect(() => {
    let cancelled = false;
    let rafId = 0;
    let delayTimer: ReturnType<typeof setTimeout> | null = null;

    rafId = window.requestAnimationFrame(() => {
      delayTimer = setTimeout(() => {
        if (!cancelled) void ensureCalendarMeta();
      }, 0);
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(rafId);
      if (delayTimer != null) clearTimeout(delayTimer);
    };
  }, []);

  return null;
}
