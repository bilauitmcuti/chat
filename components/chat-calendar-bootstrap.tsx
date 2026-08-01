"use client";

import { useEffect } from "react";
import { fetchMetaCached, FALLBACK_DEFAULT_SESSION_MAP, type MetaResponse } from "@/lib/calendar-api";
import { getSnapshot, setMeta } from "@/lib/calendar-store";

const FALLBACK_META: MetaResponse = {
  defaultSession: { ...FALLBACK_DEFAULT_SESSION_MAP },
  sessionOptions: [],
  programOptions: [],
};

const META_IDLE_TIMEOUT_MS = 2_500;

/**
 * Loads calendar meta for chat program/session dropdowns via `/api/v1/meta?all=true`.
 * Deferred until idle so apex `/chat` navigation stays off the critical path.
 */
export function ChatCalendarBootstrap() {
  useEffect(() => {
    let cancelled = false;
    let idleId: number | null = null;
    let delayTimer: ReturnType<typeof setTimeout> | null = null;

    async function loadMeta() {
      try {
        if (getSnapshot().sessionOptions.length > 0) {
          /* Catalogue already hydrated — skip redundant meta GET. */
        } else {
          const meta = await fetchMetaCached({ entire: true });
          if (cancelled) return;
          if (meta.sessionOptions.length > 0) {
            setMeta(meta);
          } else if (getSnapshot().sessionOptions.length === 0) {
            setMeta(FALLBACK_META);
          }
        }
      } catch {
        if (cancelled) return;
        if (getSnapshot().sessionOptions.length === 0) {
          setMeta(FALLBACK_META);
        }
      }
    }

    const run = () => {
      void loadMeta();
    };

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(run, { timeout: META_IDLE_TIMEOUT_MS });
    } else {
      delayTimer = setTimeout(run, META_IDLE_TIMEOUT_MS);
    }

    return () => {
      cancelled = true;
      if (delayTimer != null) clearTimeout(delayTimer);
      if (idleId != null && typeof window !== "undefined" && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId);
      }
    };
  }, []);

  return null;
}
