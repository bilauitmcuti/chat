"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { trackZarazPageView } from "@/lib/zaraz";

/**
 * Sends GA4 pageviews via Zaraz on Next.js client navigations.
 * Skips the first render — Zaraz automatic Pageviews handles the initial load.
 */
export function ZarazPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const isFirstRender = useRef(true);

  useEffect(() => {
    const path = search ? `${pathname}?${search}` : pathname;

    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    trackZarazPageView(path);
  }, [pathname, search]);

  return null;
}
