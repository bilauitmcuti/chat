export const dynamic = "force-dynamic";

export async function GET() {
  const { getTurnstileSiteKey, isTurnstileVerificationRequired } = await import(
    "@/lib/turnstile-config"
  );
  const required = isTurnstileVerificationRequired();
  const siteKey = required ? getTurnstileSiteKey() : "";
  return Response.json(
    { siteKey: siteKey || null, required },
    {
      headers: { "Cache-Control": "no-store" },
    }
  );
}
