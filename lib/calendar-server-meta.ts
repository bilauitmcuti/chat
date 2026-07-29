import { cache } from "react";
import { fetchMetaCached } from "@/lib/calendar-api-server";

/**
 * Deduplicates `fetchMetaCached({ entire: true })` within a single RSC render
 * (e.g. parallel prefetches or nested server components).
 */
export const fetchMetaCachedEntireForRsc = cache(() =>
  fetchMetaCached({ entire: true })
);
