"use client";

import { useEffect, useRef, useState } from "react";

const INITIAL_BUILD_ID = (process.env.NEXT_PUBLIC_BUILD_ID ?? "").trim();
const DISMISS_STORAGE_KEY = "chat_version_dismissed";

interface VersionResponse {
  buildId?: string;
}

/** Production only; longer interval to cut noise and server load. */
const POLL_INTERVAL_MS = 60_000;

function readDismissedBuildId(): string {
  try {
    return sessionStorage.getItem(DISMISS_STORAGE_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

function writeDismissedBuildId(buildId: string) {
  try {
    sessionStorage.setItem(DISMISS_STORAGE_KEY, buildId);
  } catch {
    // private mode / quota — ignore
  }
}

/**
 * Quiet deploy notice: no countdown, no auto-reload (avoids tab-resume flicker).
 * Shows only when API buildId differs from the inlined client id.
 */
export function VersionBanner() {
  const [remoteBuildId, setRemoteBuildId] = useState<string | null>(null);
  const [dismissedId, setDismissedId] = useState<string>("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const announcedIdRef = useRef<string | null>(null);

  const isVisible =
    Boolean(remoteBuildId) &&
    remoteBuildId !== INITIAL_BUILD_ID &&
    remoteBuildId !== dismissedId;

  useEffect(() => {
    setDismissedId(readDismissedBuildId());
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!INITIAL_BUILD_ID) return;

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
        const dismissed = readDismissedBuildId();
        if (nextId === dismissed) return;
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

    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        void checkVersion();
        startPoll();
      } else {
        clearPoll();
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    if (document.visibilityState === "visible") {
      void checkVersion();
      startPoll();
    }

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      clearPoll();
    };
  }, []);

  function handleRefresh() {
    window.location.reload();
  }

  function handleDismiss() {
    if (!remoteBuildId) return;
    writeDismissedBuildId(remoteBuildId);
    setDismissedId(remoteBuildId);
    setRemoteBuildId(null);
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
      <button
        type="button"
        onClick={handleDismiss}
        className="rounded-md px-2 py-0.5 text-muted-foreground underline-offset-2 hover:underline"
      >
        Dismiss
      </button>
    </div>
  );
}
