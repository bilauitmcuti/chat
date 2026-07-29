import { describe, expect, it } from "vitest";
import { getRateLimitKey } from "@/lib/rate-limit";

describe("rate-limit", () => {
  it("uses IP directly when known", () => {
    const request = { headers: new Headers({ "user-agent": "Mozilla/5.0" }) } as import("next/server").NextRequest;
    expect(getRateLimitKey("203.0.113.1", request)).toBe("203.0.113.1");
  });

  it("builds stable unknown key from user-agent and accept-language", () => {
    const headers = new Headers({
      "user-agent": "Mozilla/5.0",
      "accept-language": "en-MY",
    });
    const request = { headers } as import("next/server").NextRequest;
    const key = getRateLimitKey("unknown", request);
    expect(key.startsWith("unknown:")).toBe(true);
    expect(getRateLimitKey("unknown", request)).toBe(key);
  });
});
