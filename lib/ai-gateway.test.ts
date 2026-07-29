import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_AI_GATEWAY_ID,
  buildAiGatewayRunOptions,
  isAiGatewayEnabled,
  resolveAiGatewayId,
  resolveAiGatewayIdFromProcessEnv,
} from "@/lib/ai-gateway";

const envKeys = ["AI_GATEWAY_ID", "SKIP_AI_GATEWAY"] as const;

function clearGatewayEnv(): void {
  for (const key of envKeys) delete process.env[key];
}

describe("ai-gateway", () => {
  afterEach(() => {
    clearGatewayEnv();
  });

  it("defaults gateway id when env unset", async () => {
    clearGatewayEnv();
    expect(resolveAiGatewayIdFromProcessEnv()).toBe(DEFAULT_AI_GATEWAY_ID);
    expect(await resolveAiGatewayId()).toBe(DEFAULT_AI_GATEWAY_ID);
    expect(await isAiGatewayEnabled()).toBe(true);
  });

  it("uses AI_GATEWAY_ID when set", async () => {
    process.env.AI_GATEWAY_ID = "my-gateway";
    expect(await resolveAiGatewayId()).toBe("my-gateway");
  });

  it("disables gateway when AI_GATEWAY_ID is off", async () => {
    process.env.AI_GATEWAY_ID = "off";
    expect(await isAiGatewayEnabled()).toBe(false);
    expect(await buildAiGatewayRunOptions()).toBeUndefined();
  });

  it("disables gateway when SKIP_AI_GATEWAY=1", async () => {
    process.env.SKIP_AI_GATEWAY = "1";
    expect(await isAiGatewayEnabled()).toBe(false);
    expect(await buildAiGatewayRunOptions()).toBeUndefined();
  });

  it("builds run options with cache and metadata", async () => {
    const options = await buildAiGatewayRunOptions({
      skipCache: false,
      cacheTtl: 120,
      metadata: { correlationId: "chat-abc", path: "chat" },
    });
    expect(options).toEqual({
      gateway: {
        id: DEFAULT_AI_GATEWAY_ID,
        skipCache: false,
        cacheTtl: 120,
        collectLog: true,
        metadata: { correlationId: "chat-abc", path: "chat" },
      },
    });
  });

  it("omits cacheTtl when skipCache is true", async () => {
    const options = await buildAiGatewayRunOptions({ skipCache: true, cacheTtl: 120 });
    expect(options?.gateway.cacheTtl).toBeUndefined();
    expect(options?.gateway.skipCache).toBe(true);
  });
});
