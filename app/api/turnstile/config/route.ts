export const runtime = "edge";
export const dynamic = "force-dynamic";

import { getTurnstileSiteKey, isTurnstileVerificationRequired } from "@/lib/turnstile-config";

export async function GET() {
  const required = isTurnstileVerificationRequired();
  const siteKey = required ? getTurnstileSiteKey() : "";
  return Response.json(
    { siteKey: siteKey || null, required },
    {
      headers: { "Cache-Control": "no-store" },
    }
  );
}
