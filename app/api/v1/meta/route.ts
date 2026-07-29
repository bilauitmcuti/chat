export const runtime = 'edge';
import type { NextRequest } from "next/server";
import { calendarProxyForward } from "@/lib/calendar-proxy-forward";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  return calendarProxyForward(request, "v1/meta");
}
