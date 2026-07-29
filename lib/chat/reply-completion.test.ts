import { describe, expect, it } from "vitest";
import { detectIncompleteReply } from "@/lib/chat/reply-completion";

describe("detectIncompleteReply", () => {
  it("does not flag replies ending with a header colon", () => {
    expect(detectIncompleteReply("Group B (Diploma):", true)).toBeNull();
  });

  it("does not flag replies ending with a trailing comma", () => {
    expect(detectIncompleteReply("Cuti bermula 01-03-2026,", false)).toBeNull();
  });

  it("flags replies ending on a dangling dash", () => {
    const result = detectIncompleteReply("Some intro\n- ", true);
    expect(result?.reason).toBe("trailing-dash");
  });

  it("flags unclosed [TABLE] blocks", () => {
    const result = detectIncompleteReply(
      "Group B:\n[TABLE]\n| Activity | Date |\n| --- | --- |\n| Lecture | 01-03-2026 |",
      true
    );
    expect(result?.reason).toBe("unclosed-table");
  });

  it("does not flag a complete sentence", () => {
    expect(
      detectIncompleteReply(
        "Next break starts on 15-03-2026 and ends on 21-03-2026.",
        false
      )
    ).toBeNull();
  });

  it("does not flag a complete dash list", () => {
    const reply = [
      "Group B (Diploma):",
      "- Pendaftaran: 01-03-2026 to 07-03-2026",
      "- Kuliah: 08-03-2026 to 14-06-2026.",
    ].join("\n");
    expect(detectIncompleteReply(reply, true)).toBeNull();
  });

  it("flags list answers ending mid-thought without punctuation", () => {
    const reply = [
      "Group B (Diploma):",
      "Senarai aktiviti yang berkaitan dengan kalendar akademik adalah seperti berikut bagi minggu kuliah",
    ].join("\n");
    expect(detectIncompleteReply(reply, true)?.reason).toBe("no-sentence-end");
  });
});
