import { describe, expect, it } from "vitest";
import {
  cleanAiReply,
  extractFinalAnswerFromPlanning,
  normalizeLatexArtifacts,
} from "@/lib/chat/sanitize";

describe("extractFinalAnswerFromPlanning", () => {
  it("extracts text after Answer:", () => {
    const raw = `Language: English.
Answer: The Peperiksaan Intersesi exam week is from 21-09-2026 to 25-09-2026.
Language: English? Yes.`;
    expect(extractFinalAnswerFromPlanning(raw)).toBe(
      "The Peperiksaan Intersesi exam week is from 21-09-2026 to 25-09-2026."
    );
  });
});

describe("normalizeLatexArtifacts", () => {
  it("converts LaTeX arrows to Unicode arrows", () => {
    const raw =
      "Sesi (Tahun Akademik) $\\rightarrow$ mengandungi $\\rightarrow$ Semester/Penggal (Tempoh Kuliah & Exam) $\\rightarrow$ mengandungi $\\rightarrow$ Minggu Kuliah (Lecture Weeks).";
    expect(normalizeLatexArtifacts(raw)).toBe(
      "Sesi (Tahun Akademik) → mengandungi → Semester/Penggal (Tempoh Kuliah & Exam) → mengandungi → Minggu Kuliah (Lecture Weeks)."
    );
  });
});

describe("cleanAiReply", () => {
  it("strips planning monologue and keeps final answer", () => {
    const raw = `User Question: When is exam?
Language: English.
Answer: Group B (Diploma):

The exam week is 21-09-2026 to 25-09-2026.`;
    const out = cleanAiReply(raw);
    expect(out).toContain("21-09-2026");
    expect(out).not.toContain("User Question");
    expect(out).not.toMatch(/^Language:/m);
  });

  it("strips internal mode tags like (OPINION)", () => {
    const raw =
      "(OPINION) Cadangkan susun jadual dengan minggu ulangkaji lebih awal.\n- Fokus subjek berat dulu\n- Rehat secukupnya";
    const out = cleanAiReply(raw);
    expect(out).not.toMatch(/\(OPINION\)/i);
    expect(out).toContain("Cadangkan susun jadual");
    expect(out).toContain("Fokus subjek berat");
  });

  it("preserves markdown headings for explain/suggest replies", () => {
    const raw =
      "## Kenapa penting\nMinggu ulangkaji membantu ulangkaji sebelum peperiksaan.\n\n## Cadangan\nMulakan awal dan fokus subjek berat.";
    const out = cleanAiReply(raw);
    expect(out).toContain("## Kenapa penting");
    expect(out).toContain("## Cadangan");
  });

  it("promotes list section titles mistaken as bullets", () => {
    const raw = `- Sokongan Persekitaran Multi-repo:
- Cursor boleh dimulakan dalam persekitaran multi-repo.
- #Aliran Kerja Antara Saluran:
- Cursor boleh membaca mesej Slack.`;
    const out = cleanAiReply(raw);
    expect(out).toContain("## Sokongan Persekitaran Multi-repo");
    expect(out).toContain("## Aliran Kerja Antara Saluran");
    expect(out).not.toMatch(/^- Sokongan/m);
    expect(out).toContain("- Cursor boleh dimulakan");
  });

  it("strips planning lines with mode labels", () => {
    const raw = `OPINION: general study tips
Ini cadangan umum untuk pelajar UiTM.`;
    const out = cleanAiReply(raw);
    expect(out).not.toMatch(/^OPINION:/m);
    expect(out).toContain("Ini cadangan umum");
  });

  it("strips MATCHED ACTIVITIES and other context banners from replies", () => {
    const raw = `=== MATCHED ACTIVITIES (authoritative — copy these dates exactly) ===
Cuti Semester ialah 01-06-2026 hingga 12-07-2026.
Jangan rujuk DATA CONTEXT atau search_calendar_activities kepada pengguna.`;
    const out = cleanAiReply(raw);
    expect(out).not.toMatch(/MATCHED\s+ACTIVITIES/i);
    expect(out).not.toMatch(/DATA\s+CONTEXT/i);
    expect(out).not.toContain("search_calendar_activities");
    expect(out).not.toMatch(/^===/m);
    expect(out).toContain("Cuti Semester");
    expect(out).toContain("01-06-2026");
  });

  it("strips API field labels like startDate from replies", () => {
    const raw = "Cuti Semester startDate: 2026-06-01 hingga 12 Jul 2026.";
    const out = cleanAiReply(raw);
    expect(out).not.toContain("startDate");
    expect(out).toContain("Cuti Semester");
  });
});
