"use client";

import { createContext, createElement, useContext, useEffect, useState, type ReactNode } from "react";

export interface TurnstileSiteKeyState {
  siteKey: string;
  /** False until inlined env, server prop, or /api/turnstile/config has been resolved. */
  isReady: boolean;
}

const TurnstileSiteKeyContext = createContext<TurnstileSiteKeyState | null>(null);

/**
 * Resolves the Turnstile site key for client pages. Build-inlined NEXT_PUBLIC_* is used
 * first; otherwise optional server `initialSiteKey`, then same-origin config API (runtime env).
 */
export function useTurnstileSiteKey(initialSiteKey = ""): TurnstileSiteKeyState {
  const [siteKey, setSiteKey] = useState("");
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      setSiteKey("");
      setIsReady(true);
      return;
    }

    const inlined = (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "").trim();
    if (inlined) {
      setSiteKey(inlined);
      setIsReady(true);
      return;
    }

    const fromServer = initialSiteKey.trim();
    if (fromServer) {
      setSiteKey(fromServer);
      setIsReady(true);
      return;
    }

    let cancelled = false;
    fetch("/api/turnstile/config", { credentials: "same-origin" })
      .then(async (res) => {
        if (!res.ok) return { siteKey: null as string | null };
        return res.json() as Promise<{ siteKey?: string | null }>;
      })
      .then((data) => {
        if (cancelled) return;
        setSiteKey((data.siteKey ?? "").trim());
        setIsReady(true);
      })
      .catch(() => {
        if (!cancelled) setIsReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [initialSiteKey]);

  return { siteKey, isReady };
}

export function TurnstileSiteKeyProvider({
  initialSiteKey = "",
  children,
}: {
  initialSiteKey?: string;
  children: ReactNode;
}) {
  const value = useTurnstileSiteKey(initialSiteKey);
  return createElement(TurnstileSiteKeyContext.Provider, { value }, children);
}

export function useTurnstileSiteKeyFromContext(): TurnstileSiteKeyState {
  const ctx = useContext(TurnstileSiteKeyContext);
  if (!ctx) {
    throw new Error("useTurnstileSiteKeyFromContext must be used within TurnstileSiteKeyProvider");
  }
  return ctx;
}
