"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt(): Promise<void>;
}

export type PwaPromptOutcome = "accepted" | "dismissed" | "unavailable";

/**
 * Captures `beforeinstallprompt` for later use.
 * Call `promptInstall()` only from a user gesture (e.g. Install app click).
 * After `prompt()`, the event cannot be reused — wait for a new event.
 */
export function usePwaInstallPrompt() {
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [canPrompt, setCanPrompt] = useState(false);

  useEffect(() => {
    function onBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      deferredPromptRef.current = event as BeforeInstallPromptEvent;
      setCanPrompt(true);
    }

    function onAppInstalled() {
      deferredPromptRef.current = null;
      setCanPrompt(false);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<PwaPromptOutcome> => {
    const deferred = deferredPromptRef.current;
    if (!deferred) return "unavailable";

    // Single-use event — clear ref before prompt so it cannot be reused.
    deferredPromptRef.current = null;

    try {
      // Invoke prompt() synchronously in the user-gesture stack, then await.
      const promptPromise = deferred.prompt();
      setCanPrompt(false);
      await promptPromise;
      const { outcome } = await deferred.userChoice;
      return outcome;
    } catch {
      setCanPrompt(false);
      return "unavailable";
    }
  }, []);

  return { canPrompt, promptInstall };
}
