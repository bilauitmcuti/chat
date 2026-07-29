export const runtime = 'edge';
import type { NextRequest } from "next/server";
import { calendarProxyForwardFromPathSegments } from "@/lib/calendar-proxy-forward";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path } = await context.params;
  const segments = path?.length ? path : [];
  return calendarProxyForwardFromPathSegments(request, segments);
}
