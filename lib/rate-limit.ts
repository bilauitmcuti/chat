import type { NextRequest } from "next/server";

const RATE_LIMIT_DAILY_MS = 24 * 60 * 60 * 1000;
const RATE_LIMIT_MAX_PER_DAY = 120;
const RATE_LIMIT_MAX_UNKNOWN_PER_DAY = 60;
/** All users combined, per rolling 24h (abuse / cost ceiling). */
const RATE_LIMIT_GLOBAL_MAX_PER_DAY = 5000;

export interface RateLimitResult {
  limited: boolean;
  message: string;
}

export function getRateLimitKey(ip: string, request: NextRequest): string {
  if (ip !== "unknown") return ip;
  const ua = request.headers.get("user-agent") ?? "";
  const lang = request.headers.get("accept-language") ?? "";
  const raw = (ua + lang).replace(/\s/g, "").slice(0, 48);
  try {
    return `unknown:${btoa(encodeURIComponent(raw)).slice(0, 32)}`;
  } catch {
    return `unknown:${raw.slice(0, 32)}`;
  }
}

const rateLimitMap = new Map<string, number[]>();
let globalDailyTimestamps: number[] = [];
const CLEANUP_THRESHOLD = 500;

function cleanupStaleEntries(): void {
  const now = Date.now();
  for (const [key, timestamps] of rateLimitMap.entries()) {
    const valid = timestamps.filter((t) => now - t < RATE_LIMIT_DAILY_MS);
    if (valid.length === 0) rateLimitMap.delete(key);
    else rateLimitMap.set(key, valid);
  }
  globalDailyTimestamps = globalDailyTimestamps.filter((t) => now - t < RATE_LIMIT_DAILY_MS);
}

export function checkRateLimit(ip: string, request: NextRequest): RateLimitResult {
  const now = Date.now();
  if (rateLimitMap.size > CLEANUP_THRESHOLD) cleanupStaleEntries();

  const globalValid = globalDailyTimestamps.filter((t) => now - t < RATE_LIMIT_DAILY_MS);
  if (globalValid.length >= RATE_LIMIT_GLOBAL_MAX_PER_DAY) {
    return { limited: true, message: "Service is at capacity for today. Please try again tomorrow." };
  }

  const key = getRateLimitKey(ip, request);
  const isUnknown = ip === "unknown";
  const timestamps = rateLimitMap.get(key) || [];
  const dailyValid = timestamps.filter((t) => now - t < RATE_LIMIT_DAILY_MS);
  const maxDaily = isUnknown ? RATE_LIMIT_MAX_UNKNOWN_PER_DAY : RATE_LIMIT_MAX_PER_DAY;
  if (dailyValid.length >= maxDaily) {
    return { limited: true, message: "Daily limit reached. Please try again tomorrow." };
  }

  dailyValid.push(now);
  rateLimitMap.set(key, dailyValid);
  globalDailyTimestamps = [...globalValid, now];
  return { limited: false, message: "" };
}
