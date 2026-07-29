"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";

/**
 * Cloudflare Turnstile explicit rendering for deterministic SPA behavior.
 * Managed/invisible mode is controlled by the Cloudflare widget setting.
 */
declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, params: Record<string, unknown>) => number;
      remove: (widgetId: number) => void;
      reset: (widgetId?: number) => void;
      execute?: (widgetId?: number) => void;
    };
  }
}

export interface TurnstileWidgetHandle {
  reset: () => void;
  execute: () => void;
}

export interface TurnstileWidgetProps {
  siteKey: string;
  action?: string;
  onToken: (token: string) => void;
  className?: string;
  /** Visual theme for the managed widget. */
  theme?: "auto" | "light" | "dark";
  /** Width behavior for the managed widget. */
  size?: "normal" | "flexible" | "compact";
}

const TURNSTILE_SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

export const TurnstileWidget = forwardRef<TurnstileWidgetHandle, TurnstileWidgetProps>(
function TurnstileWidget({
  siteKey,
  action,
  onToken,
  className,
  theme = "auto",
  size = "flexible",
}: TurnstileWidgetProps, ref) {
  const safeSiteKey = useMemo(() => siteKey?.trim() ?? "", [siteKey]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<number | null>(null);
  const onTokenRef = useRef(onToken);

  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  useImperativeHandle(ref, () => ({
    reset: () => {
      const ts = window.turnstile;
      const widgetId = widgetIdRef.current;
      onTokenRef.current("");
      if (ts && widgetId != null) ts.reset(widgetId);
    },
    execute: () => {
      const ts = window.turnstile;
      const widgetId = widgetIdRef.current;
      if (ts?.execute && widgetId != null) ts.execute(widgetId);
    },
  }), []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!safeSiteKey) return;

    const existing = document.querySelector(
      'script[data-turnstile-script="explicit"]'
    ) as HTMLScriptElement | null;
    if (!existing) {
      const script = document.createElement("script");
      script.src = TURNSTILE_SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.dataset.turnstileScript = "explicit";
      document.head.appendChild(script);
    }

    let cancelled = false;
    const start = Date.now();

    const tryRender = () => {
      if (cancelled) return;
      const ts = window.turnstile;
      const el = containerRef.current;
      if (!ts || !el || widgetIdRef.current != null) return;

      widgetIdRef.current = ts.render(el, {
        sitekey: safeSiteKey,
        action: action ?? undefined,
        theme,
        size,
        callback: (token: string) => onTokenRef.current(token),
        "expired-callback": () => onTokenRef.current(""),
        "error-callback": () => onTokenRef.current(""),
      });
    };

    const poll = () => {
      if (cancelled) return;
      tryRender();
      if (widgetIdRef.current == null && Date.now() - start < 8000) {
        setTimeout(poll, 200);
      }
    };

    poll();

    return () => {
      cancelled = true;
      const ts = window.turnstile;
      if (ts && widgetIdRef.current != null) ts.remove(widgetIdRef.current);
      widgetIdRef.current = null;
    };
  }, [safeSiteKey, action, theme, size]);

  if (!safeSiteKey) return null;

  return (
    <div
      ref={containerRef}
      className={`w-full ${className ?? ""}`.trim()}
    />
  );
});
