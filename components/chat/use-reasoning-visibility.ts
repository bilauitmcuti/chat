import { useEffect, useState } from "react";
import { THINKING_INDICATOR_DELAY_MS } from "@/lib/chat/reasoning-gate";

export function useReasoningVisibility(active: boolean, startedAt?: number) {
  const [showThinking, setShowThinking] = useState(
    () => active && THINKING_INDICATOR_DELAY_MS <= 0
  );

  useEffect(() => {
    if (!active) {
      setShowThinking(false);
      return;
    }

    const start = startedAt ?? Date.now();
    const thinkingDelay = Math.max(0, THINKING_INDICATOR_DELAY_MS - (Date.now() - start));

    if (thinkingDelay === 0) {
      setShowThinking(true);
    } else {
      setShowThinking(false);
    }

    const thinkingTimer =
      thinkingDelay === 0
        ? undefined
        : window.setTimeout(() => setShowThinking(true), thinkingDelay);

    return () => {
      if (thinkingTimer !== undefined) window.clearTimeout(thinkingTimer);
    };
  }, [active, startedAt]);

  return { showThinking };
}
