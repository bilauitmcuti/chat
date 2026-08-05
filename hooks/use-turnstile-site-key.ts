"use client";

import { createContext, createElement, useContext, useEffect, useState, type ReactNode } from "react";

export interface TurnstileSiteKeyState {
  siteKey: string;
  /** False until inlined env, server prop, or /chat/api/turnstile/config has been resolved. */
  isReady: boolean;
}

const TurnstileSiteKeyContext = createContext<TurnstileSiteKeyState | null>(null);

function resolveInitialTurnstileState(initialSiteKey: string): TurnstileSiteKeyState {
  if (process.env.NODE_ENV !== "production") {
    return { siteKey: "", isReady: true };
  }

  const inlined = (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "").trim();
  if (inlined) return { siteKey: inlined, isReady: true };

  const fromServer = initialSiteKey.trim();
  if (fromServer) return { siteKey: fromServer, isReady: true };

  return { siteKey: "", isReady: false };
}

/**
 * Resolves the Turnstile site key for client pages. Build-inlined NEXT_PUBLIC_* is used
 * first; otherwise optional server `initialSiteKey`, then same-origin config API (runtime env).
 */
export function useTurnstileSiteKey(initialSiteKey = ""): TurnstileSiteKeyState {
  const [state, setState] = useState(() => resolveInitialTurnstileState(initialSiteKey));

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      setState({ siteKey: "", isReady: true });
      return;
    }

    const inlined = (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "").trim();
    if (inlined) {
      setState({ siteKey: inlined, isReady: true });
      return;
    }

    const fromServer = initialSiteKey.trim();
    if (fromServer) {
      setState({ siteKey: fromServer, isReady: true });
      return;
    }

    let cancelled = false;
    fetch("/chat/api/turnstile/config", { credentials: "same-origin" })
      .then(async (res) => {
        if (!res.ok) return { siteKey: null as string | null };
        return res.json() as Promise<{ siteKey?: string | null }>;
      })
      .then((data) => {
        if (cancelled) return;
        setState({ siteKey: (data.siteKey ?? "").trim(), isReady: true });
      })
      .catch(() => {
        if (!cancelled) setState((prev) => ({ ...prev, isReady: true }));
      });

    return () => {
      cancelled = true;
    };
  }, [initialSiteKey]);

  return state;
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
