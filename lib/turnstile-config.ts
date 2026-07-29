/**
 * Turnstile site key: NEXT_PUBLIC_* is inlined at build; TURNSTILE_SITE_KEY works at
 * runtime on Cloudflare Pages when only set as an encrypted variable (no NEXT_PUBLIC).
 */
export function getTurnstileSiteKey(): string {
  return (
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ||
    process.env.TURNSTILE_SITE_KEY?.trim() ||
    ""
  );
}

export function getTurnstileSecretKey(): string {
  return process.env.TURNSTILE_SECRET_KEY?.trim() ?? "";
}

/** Require verification only when production and both keys are configured. */
export function isTurnstileVerificationRequired(): boolean {
  if (process.env.NODE_ENV !== "production") return false;
  return Boolean(getTurnstileSecretKey() && getTurnstileSiteKey());
}
