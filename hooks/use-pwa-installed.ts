"use client";

import { useSyncExternalStore } from "react";

const STANDALONE_QUERY = "(display-mode: standalone)";

function isPwaInstalled(): boolean {
  if (typeof window === "undefined") return false;
  const isInStandaloneMode = window.matchMedia(STANDALONE_QUERY).matches;
  const isInFullScreenMode = document.fullscreenElement !== null;
  const isInMinimalUIMode =
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return isInStandaloneMode || isInFullScreenMode || isInMinimalUIMode;
}

function getServerSnapshot(): boolean {
  return false;
}

function subscribe(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const mql = window.matchMedia(STANDALONE_QUERY);
  mql.addEventListener("change", onChange);
  document.addEventListener("fullscreenchange", onChange);
  return () => {
    mql.removeEventListener("change", onChange);
    document.removeEventListener("fullscreenchange", onChange);
  };
}

/** Detects whether the app is running as an installed PWA. */
export function usePwaInstalled(): boolean {
  return useSyncExternalStore(subscribe, isPwaInstalled, getServerSnapshot);
}
