const RESPONSE_CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes
const MAX_RESPONSE_CACHE_ITEMS = 120;
const responseCache = new Map<string, { reply: string; expiresAt: number }>();

export function generateCorrelationId(): string {
  return `chat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getCachedReply(cacheKey: string): string | null {
  const item = responseCache.get(cacheKey);
  if (!item) return null;
  if (item.expiresAt <= Date.now()) {
    responseCache.delete(cacheKey);
    return null;
  }
  return item.reply;
}

export function setCachedReply(cacheKey: string, reply: string): void {
  const now = Date.now();
  for (const [key, value] of responseCache.entries()) {
    if (value.expiresAt <= now) responseCache.delete(key);
  }
  if (responseCache.size >= MAX_RESPONSE_CACHE_ITEMS) {
    const oldestKey = responseCache.keys().next().value;
    if (oldestKey) responseCache.delete(oldestKey);
  }
  responseCache.set(cacheKey, { reply, expiresAt: now + RESPONSE_CACHE_TTL_MS });
}
