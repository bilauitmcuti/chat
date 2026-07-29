import { describe, expect, it } from "vitest";
import { searchUitmKnowledge } from "@/lib/chat/agent/tools/search-uitm-knowledge";

describe("searchUitmKnowledge", () => {
  it("returns campus-related content for campus query", () => {
    const result = searchUitmKnowledge("kampus uitm selangor");
    expect(result.toLowerCase()).toMatch(/campus|kampus|selangor/i);
  });

  it("returns bounded output", () => {
    const result = searchUitmKnowledge("admission apply uitm");
    expect(result.length).toBeLessThanOrEqual(3100);
  });

  it("returns fee content for yuran/tuition questions", () => {
    const result = searchUitmKnowledge("berapa yuran pengajian degree");
    expect(result.toLowerCase()).toMatch(/student fees|yuran|tuition|degree/i);
  });

  it("handles common typo 'collage fee' as 'college fee'", () => {
    const result = searchUitmKnowledge("collage fee bilik berdua");
    expect(result.toLowerCase()).toMatch(/college|bilik berdua|rm/i);
  });
});
