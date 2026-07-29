import type { SessionId } from "@/lib/data";

export function buildHydrateKey(
  program: string,
  sessionIds: SessionId[]
): string {
  return `${program}|${[...sessionIds].sort().join(",")}`;
}

/** Session ids embedded in `hydrateKey` (must match client `selectedSessions` order for loadKey). */
export function parseSessionIdsFromHydrateKey(hydrateKey: string): SessionId[] {
  const pipe = hydrateKey.indexOf("|");
  if (pipe < 0) return [];
  const tail = hydrateKey.slice(pipe + 1);
  if (!tail) return [];
  return tail.split(",").filter(Boolean) as SessionId[];
}
