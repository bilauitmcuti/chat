import {
  FALLBACK_DEFAULT_SESSION_MAP,
  fetchMetaCached,
  type MetaResponse,
} from "@/lib/calendar-api";
import { getSnapshot, setMeta } from "@/lib/calendar-store";

export type CalendarMetaStatus = "idle" | "loading" | "ready" | "error";

const FALLBACK_META: MetaResponse = {
  defaultSession: { ...FALLBACK_DEFAULT_SESSION_MAP },
  sessionOptions: [],
  programOptions: [],
};

let status: CalendarMetaStatus = "idle";
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function setStatus(next: CalendarMetaStatus): void {
  if (status === next) return;
  status = next;
  for (const listener of listeners) listener();
}

export function getCalendarMetaStatus(): CalendarMetaStatus {
  return status;
}

export function subscribeCalendarMetaStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Load full programme/session catalogue into the calendar store.
 * Concurrent callers share one in-flight request.
 */
export function ensureCalendarMeta(): Promise<void> {
  if (getSnapshot().sessionOptions.length > 0) {
    setStatus("ready");
    return Promise.resolve();
  }
  if (inflight) return inflight;

  setStatus("loading");
  inflight = (async () => {
    try {
      const meta = await fetchMetaCached({ entire: true });
      if (meta.sessionOptions.length > 0) {
        setMeta(meta);
        setStatus("ready");
      } else if (getSnapshot().sessionOptions.length === 0) {
        setMeta(FALLBACK_META);
        setStatus("error");
      } else {
        setStatus("ready");
      }
    } catch {
      if (getSnapshot().sessionOptions.length === 0) {
        setMeta(FALLBACK_META);
        setStatus("error");
      } else {
        setStatus("ready");
      }
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}
