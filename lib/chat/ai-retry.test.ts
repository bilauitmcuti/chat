import { describe, expect, it } from "vitest";
import { getModelResponseBudget } from "@/lib/chat/ai-retry";

describe("getModelResponseBudget", () => {
  const ceiling = 8192;

  it("allows enough tokens for simple calendar questions", () => {
    const budget = getModelResponseBudget("When is the next break?", true, false, ceiling);
    expect(budget.maxTokens).toBe(1024);
    expect(budget.temperature).toBe(0.1);
  });

  it("keeps simple holiday year questions on the fast token budget", () => {
    const budget = getModelResponseBudget("Bila cuti umum 2027", true, false, ceiling);
    expect(budget.maxTokens).toBe(1024);
  });

  it("uses full tier cap for table/compare requests", () => {
    const budget = getModelResponseBudget("Compare sessions in a table", true, true, ceiling);
    expect(budget.maxTokens).toBe(4096);
  });

  it("uses full tier cap for list/schedule questions", () => {
    const budget = getModelResponseBudget(
      "Senarai semua minggu kuliah 1-14",
      true,
      false,
      ceiling
    );
    expect(budget.maxTokens).toBe(4096);
  });

  it("uses full tier cap for detailed calendar questions", () => {
    const budget = getModelResponseBudget("Explain all breaks in detail", true, false, ceiling);
    expect(budget.maxTokens).toBe(4096);
  });

  it("uses full tier cap for long user messages", () => {
    const long = "a".repeat(400);
    const budget = getModelResponseBudget(long, true, false, ceiling);
    expect(budget.maxTokens).toBe(4096);
  });

  it("allows generous tokens for research prompts", () => {
    const budget = getModelResponseBudget("What faculties are at UiTM?", false, false, ceiling);
    expect(budget.maxTokens).toBe(4096);
  });

  it("bounds matched-activity answers for fast, consistent replies", () => {
    const budget = getModelResponseBudget(
      "When is Fee Deferment?",
      true,
      false,
      ceiling,
      { hasMatchedActivity: true }
    );
    expect(budget.maxTokens).toBe(1536);
    expect(budget.temperature).toBe(0.1);
  });

  it("bounds normal calendar answers (non-simple, non-list, non-table)", () => {
    const budget = getModelResponseBudget(
      "Ceritakan tentang cuti semester ini",
      true,
      false,
      ceiling
    );
    expect(budget.maxTokens).toBe(2048);
  });
});
