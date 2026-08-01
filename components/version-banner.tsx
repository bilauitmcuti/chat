"use client";

import { useEffect, useRef, useState } from "react";

const INITIAL_BUILD_ID = (process.env.NEXT_PUBLIC_BUILD_ID ?? "").trim();

interface VersionResponse {
  buildId?: string;
}

/** Production only; longer interval to cut noise and server load. */
const POLL_INTERVAL_MS = 60_000;
/** Defer first version check so it stays off the critical navigation path. */
const FIRST_CHECK_DELAY_MS = 12_000;

/**
 * Quiet deploy notice: no countdown, no auto-reload (avoids tab-resume flicker).
 * Shows only when API buildId differs from the inlined client id.
 */
export function VersionBanner() {
  const [remoteBuildId, setRemoteBuildId] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const announcedIdRef = useRef<string | null>(null);

  const isVisible =
    Boolean(remoteBuildId) && remoteBuildId !== INITIAL_BUILD_ID;

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!INITIAL_BUILD_ID) return;

    let delayTimer: ReturnType<typeof setTimeout> | null = null;
    let idleId: number | null = null;

    function clearPoll() {
      if (intervalRef.current != null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    async function checkVersion() {
      try {
        const res = await fetch("/chat/api/version", { cache: "no-store" });
        if (!res.ok) return;
        const { buildId } = (await res.json()) as VersionResponse;
        const nextId = (buildId ?? "").trim();
        if (!nextId || nextId === INITIAL_BUILD_ID) return;
        // Avoid re-setting the same mismatch (prevents needless re-renders / flash).
        if (announcedIdRef.current === nextId) return;
        announcedIdRef.current = nextId;
        setRemoteBuildId(nextId);
        clearPoll();
      } catch {
        // network error, skip
      }
    }

    function startPoll() {
      clearPoll();
      if (typeof document === "undefined" || document.visibilityState !== "visible") {
        return;
      }
      intervalRef.current = setInterval(checkVersion, POLL_INTERVAL_MS);
    }

    function beginChecks() {
      if (document.visibilityState !== "visible") return;
      void checkVersion();
      startPoll();
    }

    function scheduleFirstCheck() {
      const run = () => {
        beginChecks();
      };
      if (typeof window !== "undefined" && "requestIdleCallback" in window) {
        idleId = window.requestIdleCallback(run, { timeout: FIRST_CHECK_DELAY_MS });
      } else {
        delayTimer = setTimeout(run, FIRST_CHECK_DELAY_MS);
      }
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        void checkVersion();
        startPoll();
      } else {
        clearPoll();
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    scheduleFirstCheck();

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      clearPoll();
      if (delayTimer != null) clearTimeout(delayTimer);
      if (idleId != null && typeof window !== "undefined" && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId);
      }
    };
  }, []);

  function handleRefresh() {
    window.location.reload();
  }

  if (!isVisible || !remoteBuildId) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-3 bg-muted px-3 py-2 text-sm text-foreground">
      <span>New version available.</span>
      <button
        type="button"
        onClick={handleRefresh}
        className="rounded-md bg-primary px-2 py-0.5 text-primary-foreground hover:opacity-90"
      >
        Refresh
      </button>
    </div>
  );
}
