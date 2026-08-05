export async function checkEnv(): Promise<{ ok: boolean; ai: "configured" | "missing" }> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { env } = await getCloudflareContext({ async: true });
    const ai = (env as CloudflareEnv | undefined)?.AI;
    if (ai) return { ok: true, ai: "configured" };
  } catch {
    // No Cloudflare context (next dev without platform, etc.)
  }
  return { ok: false, ai: "missing" };
}
