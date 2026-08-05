export const dynamic = "force-dynamic";

export async function GET() {
  const { checkEnv } = await import("@/lib/env");
  const { getDefaultChatModel, CHAT_MODELS } = await import("@/lib/chat/models");
  const { ai } = await checkEnv();
  const checks: Record<string, string | string[]> = {
    status: "ok",
    timestamp: new Date().toISOString(),
    ai,
    model: getDefaultChatModel(),
    models: CHAT_MODELS.map((m) => m.id),
  };

  const healthy = ai !== "missing";
  return Response.json(checks, {
    status: healthy ? 200 : 503,
    headers: { "Cache-Control": "no-cache, no-store, must-revalidate" },
  });
}
