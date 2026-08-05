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

const CHAT_SUBDOMAIN = "chat.bilauitmcuti.com";

function normalizeHostname(hostHeader: string | null): string {
  return (hostHeader ?? "").replace(/^www\./, "").split(":")[0].toLowerCase();
}

function isChatSubdomain(hostname: string): boolean {
  return hostname === CHAT_SUBDOMAIN;
}

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
  if (pathname !== "/chat/api") return false;
  return request.method === "POST" && hasPageOrigin(request);
}

function rewritePath(request: NextRequest, pathname: string): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  return applySecurityHeaders(NextResponse.rewrite(url));
}

function redirectPath(request: NextRequest, pathname: string): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  return applySecurityHeaders(NextResponse.redirect(url, 308));
}

/**
 * Dual-host path mapping (no Next basePath):
 * - Assets: /chat/_next/* is served by Workers Assets after post-build mirror
 *   (see scripts/mirror-chat-assets.mjs). Rewrite below is a fallback only if
 *   a request reaches the Worker without a matching asset file.
 * - Chat-only browser APIs under /chat/api/... → /api/... (not calendar/public-holiday)
 * - Apex UI: /chat → /
 * - Subdomain: /chat → redirect /
 */
function dualHostResponse(request: NextRequest): NextResponse | null {
  const hostname = normalizeHostname(request.headers.get("host"));
  const pathname = request.nextUrl.pathname;

  if (pathname.startsWith("/chat/_next/")) {
    return rewritePath(request, pathname.slice("/chat".length));
  }

  if (pathname.startsWith("/chat/api/turnstile/")) {
    return rewritePath(request, pathname.replace(/^\/chat\/api/, "/api"));
  }
  if (pathname === "/chat/api/version") {
    return rewritePath(request, "/api/version");
  }
  if (pathname === "/chat/api/health") {
    return rewritePath(request, "/api/health");
  }

  if (pathname === "/chat" || pathname === "/chat/") {
    if (isChatSubdomain(hostname)) {
      return redirectPath(request, "/");
    }
    // Apex + local/preview: rewrite so /chat serves the UI (URL stays /chat)
    return rewritePath(request, "/");
  }

  return null;
}

export function middleware(request: NextRequest) {
  const dual = dualHostResponse(request);
  if (dual) return dual;

  const pathname = request.nextUrl.pathname;
  const isChatApiPath = pathname === "/chat/api";

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
    // Must run for assetPrefix URLs (otherwise .js/.css are excluded below)
    "/chat/_next/:path*",
    "/chat",
    "/chat/",
    "/chat/api/:path*",
    "/chat/feedback/:path*",
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:css|js|png|jpg|jpeg|gif|webp|ico|svg|woff2?)$).*)",
  ],
};
