import { NextRequest, NextResponse } from "next/server";
import { applySecurityHeaders } from "@/lib/security-headers";

/**
 * Bot patterns to block from accessing chat API routes.
 */
const BOT_PATTERNS = [
  "googlebot",
  "bingbot",
  "yandexbot",
  "baiduspider",
  "duckduckbot",
  "gptbot",
  "chatgpt-user",
  "claudebot",
  "anthropic",
  "ccbot",
  "bytespider",
  "curl",
  "wget",
  "httpie",
  "postman",
  "insomnia",
  "scrapy",
  "python-requests",
  "axios",
  "node-fetch",
  "go-http-client",
  "headlesschrome",
  "phantomjs",
];

function isBotUserAgent(ua: string): boolean {
  const lower = ua.toLowerCase();
  return BOT_PATTERNS.some((pattern) => lower.includes(pattern));
}

function hasBrowserHeaders(request: NextRequest): boolean {
  const acceptLanguage = request.headers.get("accept-language");
  const secFetchMode = request.headers.get("sec-fetch-mode");
  const secFetchSite = request.headers.get("sec-fetch-site");
  return !!(acceptLanguage && (secFetchMode || secFetchSite));
}

function hasPageOrigin(request: NextRequest): boolean {
  const referer = request.headers.get("referer");
  const origin = request.headers.get("origin");
  const base = "bilauitmcuti.com";
  return !!(referer?.includes(base) || origin?.includes(base));
}

function isBot(request: NextRequest): boolean {
  const ua = request.headers.get("user-agent") ?? "";
  if (isBotUserAgent(ua)) return true;
  if (!ua.trim() && !hasBrowserHeaders(request)) return true;
  return false;
}

function isLikelyRealBrowser(request: NextRequest, pathname: string): boolean {
  if (pathname !== "/chat/api" && !pathname.startsWith("/chat/api/")) return false;
  return request.method === "POST" && hasPageOrigin(request);
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isChatApiPath =
    pathname === "/chat/api" || pathname.startsWith("/chat/api/");

  if (isLikelyRealBrowser(request, pathname)) {
    return applySecurityHeaders(NextResponse.next());
  }
  if (isBot(request) && isChatApiPath) {
    return applySecurityHeaders(
      NextResponse.json({ error: "Access denied" }, { status: 403 })
    );
  }
  return applySecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:css|js|png|jpg|jpeg|gif|webp|ico|svg|woff2?)$).*)",
  ],
};
