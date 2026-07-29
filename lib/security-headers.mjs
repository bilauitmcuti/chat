/** Shared security header values for middleware, next.config, and public/_headers. */

const isDev = process.env.NODE_ENV === "development";

export function buildContentSecurityPolicy(dev = isDev) {
  const scriptSrc = [
    "'self'",
    "'unsafe-inline'",
    ...(dev ? ["'unsafe-eval'"] : []),
    "https://challenges.cloudflare.com",
    "https://static.cloudflareinsights.com",
  ].join(" ");

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https: blob:",
    "font-src 'self' data:",
    "connect-src 'self' https://challenges.cloudflare.com https://static.cloudflareinsights.com https://cloudflareinsights.com",
    "frame-src https://challenges.cloudflare.com",
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
  ].join("; ");
}

export const CONTENT_SECURITY_POLICY = buildContentSecurityPolicy();

/** Ordered entries for Next.js headers() and Cloudflare _headers. */
export const SECURITY_HEADER_ENTRIES = [
  ["Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload"],
  ["X-Content-Type-Options", "nosniff"],
  ["X-Frame-Options", "SAMEORIGIN"],
  ["Referrer-Policy", "origin-when-cross-origin"],
  [
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  ],
  ["Cross-Origin-Opener-Policy", "same-origin"],
  ["Cross-Origin-Resource-Policy", "same-site"],
  ["Content-Security-Policy", CONTENT_SECURITY_POLICY],
];

export const SECURITY_HEADERS = Object.fromEntries(SECURITY_HEADER_ENTRIES);

/** Extra headers only applied via Next.js headers() (not duplicated in _headers). */
export const NEXT_CONFIG_EXTRA_HEADER_ENTRIES = [
  ["X-DNS-Prefetch-Control", "on"],
];
