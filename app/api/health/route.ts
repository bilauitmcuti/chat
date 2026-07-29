export const runtime = 'edge';
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { checkEnv } = await import("@/lib/env");
  const {
    resolveProductionChatModelChain,
    resolveWorkersAiModelTier,
  } = await import("@/lib/ai");
  const { ai } = await checkEnv();
  const host = request.headers.get("host");
  const tier = resolveWorkersAiModelTier(host);
  const models = resolveProductionChatModelChain(host);
  const checks: Record<string, string | string[]> = {
    status: "ok",
    timestamp: new Date().toISOString(),
    ai,
    modelTier: tier,
    models,
  };

  const healthy = ai !== "missing";
  return Response.json(checks, {
    status: healthy ? 200 : 503,
    headers: { "Cache-Control": "no-cache, no-store, must-revalidate" },
  });
}
