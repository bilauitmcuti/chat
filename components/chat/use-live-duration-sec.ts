import { useEffect, useState } from "react";
import { thinkingDurationSecFromTimestamp } from "@/lib/chat/reasoning-gate";

/** Elapsed whole seconds since `timestamp`, ticked every second while `active`. */
export function useLiveDurationSec(
  timestamp: number | undefined,
  active: boolean
): number | undefined {
  const [durationSec, setDurationSec] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (!active || timestamp === undefined) {
      setDurationSec(undefined);
      return;
    }

    const update = () =>
      setDurationSec(thinkingDurationSecFromTimestamp(timestamp, Date.now()));

    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, [active, timestamp]);

  return durationSec;
}
