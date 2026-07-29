import type { NextResponse } from "next/server";
import {
  CONTENT_SECURITY_POLICY,
  SECURITY_HEADERS,
} from "./security-headers.mjs";

export { CONTENT_SECURITY_POLICY, SECURITY_HEADERS };

export function applySecurityHeaders<T extends NextResponse>(response: T): T {
  for (const [key, value] of Object.entries(SECURITY_HEADERS) as [string, string][]) {
    response.headers.set(key, value);
  }
  return response;
}
