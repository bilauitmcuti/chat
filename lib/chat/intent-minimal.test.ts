import { describe, expect, it } from "vitest";
import { isMinimalConversationalMessage } from "@/lib/chat/intent";

describe("isMinimalConversationalMessage", () => {
  it("treats greetings and random short typing as minimal", () => {
    expect(isMinimalConversationalMessage("hi")).toBe(true);
    expect(isMinimalConversationalMessage("hello")).toBe(true);
    expect(isMinimalConversationalMessage("salam")).toBe(true);
    expect(isMinimalConversationalMessage("thanks")).toBe(true);
    expect(isMinimalConversationalMessage("ok")).toBe(true);
    expect(isMinimalConversationalMessage("test")).toBe(true);
    expect(isMinimalConversationalMessage("what")).toBe(true);
    expect(isMinimalConversationalMessage("hmm")).toBe(true);
    expect(isMinimalConversationalMessage("   ")).toBe(true);
  });

  it("does not treat calendar or UiTM questions as minimal", () => {
    expect(isMinimalConversationalMessage("bila cuti")).toBe(false);
    expect(isMinimalConversationalMessage("yuran")).toBe(false);
    expect(isMinimalConversationalMessage("when is exam")).toBe(false);
    expect(isMinimalConversationalMessage("explain registration")).toBe(false);
    expect(isMinimalConversationalMessage("list all holidays")).toBe(false);
  });
});
