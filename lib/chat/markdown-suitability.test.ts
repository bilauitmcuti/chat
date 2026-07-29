import { describe, it, expect } from "vitest";
import { contentToMarkdown } from "@/lib/chat/markdown-suitability";

describe("contentToMarkdown", () => {
  it("unwraps [TABLE] blocks into plain GFM tables", () => {
    const input =
      "Senarai cuti:\n[TABLE]\n| Activity | Date |\n| --- | --- |\n| Cuti | 01-01-2026 |\n[/TABLE]";
    const out = contentToMarkdown(input);
    expect(out).not.toContain("[TABLE]");
    expect(out).not.toContain("[/TABLE]");
    expect(out).toContain("| Activity | Date |");
    expect(out).toContain("| Cuti | 01-01-2026 |");
  });

  it("leaves plain content unchanged", () => {
    const input = "Peperiksaan bermula 15-10-2025.";
    expect(contentToMarkdown(input)).toBe(input);
  });
});
