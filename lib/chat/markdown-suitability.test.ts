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

  it("strips unpaired [TABLE] markers during streaming", () => {
    const input =
      "Jadual:\n[TABLE]\n| Activity | Date |\n| --- | --- |\n| Lecture | 01-03-2026 |";
    const out = contentToMarkdown(input);
    expect(out).not.toContain("[TABLE]");
    expect(out).not.toContain("[/TABLE]");
    expect(out).toContain("| Activity | Date |");
    expect(out).toContain("| Lecture | 01-03-2026 |");
  });

  it("strips a lone closing [/TABLE] marker", () => {
    const input = "| A | B |\n| --- | --- |\n| 1 | 2 |\n[/TABLE]";
    const out = contentToMarkdown(input);
    expect(out).not.toContain("[/TABLE]");
    expect(out).toContain("| A | B |");
  });

  it("leaves plain content unchanged", () => {
    const input = "Peperiksaan bermula 15-10-2025.";
    expect(contentToMarkdown(input)).toBe(input);
  });

  it("strips MATCHED ACTIVITIES leakage while streaming", () => {
    const input =
      "=== MATCHED ACTIVITIES (authoritative) ===\nCuti Semester: 01-06-2026 hingga 12-07-2026.";
    const out = contentToMarkdown(input);
    expect(out).not.toMatch(/MATCHED\s+ACTIVITIES/i);
    expect(out).not.toMatch(/^===/m);
    expect(out).toContain("Cuti Semester");
    expect(out).toContain("01-06-2026");
  });

  it("promotes title-like list lines to headings above real bullets", () => {
    const input = [
      "- Sokongan Persekitaran Multi-repo:",
      "- Cursor boleh dimulakan dalam persekitaran multi-repo yang dinamakan.",
      "- Cursor boleh dipindahkan antara persekitaran.",
      "- #Aliran Kerja Antara Saluran:",
      "- Cursor boleh membaca dan menghantar mesej ke saluran Slack.",
      "- Cursor boleh mencipta saluran dan thread baharu.",
    ].join("\n");
    const out = contentToMarkdown(input);
    expect(out).toContain("## Sokongan Persekitaran Multi-repo");
    expect(out).toContain("## Aliran Kerja Antara Saluran");
    expect(out).not.toMatch(/^- Sokongan Persekitaran Multi-repo/m);
    expect(out).not.toMatch(/^- #Aliran Kerja/m);
    expect(out).toContain(
      "- Cursor boleh dimulakan dalam persekitaran multi-repo yang dinamakan."
    );
    expect(out).toContain("- Cursor boleh membaca dan menghantar mesej ke saluran Slack.");
  });

  it("leaves bare lists without section titles unchanged", () => {
    const input = "- Cuti Semester: 01-06-2026\n- Peperiksaan: 15-10-2026";
    expect(contentToMarkdown(input)).toBe(input);
  });
});
