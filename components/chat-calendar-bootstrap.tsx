"use client";

import { useEffect } from "react";
import { fetchMetaCached, FALLBACK_DEFAULT_SESSION_MAP, type MetaResponse } from "@/lib/calendar-api";
import { getSnapshot, setMeta } from "@/lib/calendar-store";

const FALLBACK_META: MetaResponse = {
  defaultSession: { ...FALLBACK_DEFAULT_SESSION_MAP },
  sessionOptions: [],
  programOptions: [],
};

/**
 * Loads calendar meta for chat program/session dropdowns via `/api/v1/meta?all=true`.
 */
export function ChatCalendarBootstrap() {
  useEffect(() => {
    let cancelled = false;

    void (async () => {
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
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
