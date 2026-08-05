import { describe, expect, it, vi } from "vitest";
import { resolveLanguageProfile } from "@/lib/chat/language/profile";
import type { ChatMessage } from "@/lib/ai";

describe("resolveLanguageProfile", () => {
  it("returns en for English + loanword without LLM", async () => {
    const profile = await resolveLanguageProfile({
      message: "When is cuti semester?",
      skipLlm: true,
    });
    expect(profile.replyLanguage).toBe("en");
    expect(profile.locale).toBe("en");
    expect(profile.usedLlmClassify).toBe(false);
  });

  it("returns ms-MY for Malay questions", async () => {
    const profile = await resolveLanguageProfile({
      message: "Bila cuti semester?",
      skipLlm: true,
    });
    expect(profile.replyLanguage).toBe("ms-MY");
    expect(profile.locale).toBe("ms-MY");
  });

  it("sticks to prior Malay on short follow-up", async () => {
    const history: ChatMessage[] = [
      { role: "user", content: "Bila cuti semester diploma?" },
      { role: "assistant", content: "Cuti semester bermula 15 Mac 2026." },
    ];
    const profile = await resolveLanguageProfile({
      message: "Next",
      history,
      skipLlm: true,
    });
    expect(profile.replyLanguage).toBe("ms-MY");
    expect(profile.stickyFromHistory).toBe(true);
  });

  it("switches to English after BM thread when user asks in English", async () => {
    const history: ChatMessage[] = [
      { role: "user", content: "Bila cuti semester?" },
      {
        role: "assistant",
        content: "Cuti semester untuk diploma bermula pada 15 Mac 2026 hingga 20 April 2026.",
      },
    ];
    const profile = await resolveLanguageProfile({
      message: "What about lecture week 1 for that session?",
      history,
      skipLlm: true,
    });
    expect(profile.replyLanguage).toBe("en");
    expect(profile.stickyFromHistory).toBe(false);
  });

  it("uses sticky on short follow-up without calling LLM", async () => {
    const classifyLlm = vi.fn().mockResolvedValue({
      replyLanguage: "en",
      locale: "en",
      codeSwitch: false,
      confidence: 0.8,
    });
    const profile = await resolveLanguageProfile({
      message: "Next",
      history: [
        { role: "user", content: "Bila start semester ni week berapa?" },
        { role: "assistant", content: "Minggu 1 bermula 10 Mac 2026." },
      ],
      classifyLlm,
    });
    expect(profile.replyLanguage).toBe("mixed");
    expect(profile.stickyFromHistory).toBe(true);
    expect(classifyLlm).not.toHaveBeenCalled();
  });

  it("calls LLM classify for ambiguous non-follow-up when provided", async () => {
    const classifyLlm = vi.fn().mockResolvedValue({
      replyLanguage: "mixed",
      locale: "ms-MY",
      codeSwitch: true,
      confidence: 0.8,
    });
    const profile = await resolveLanguageProfile({
      message: "ok week tu for diploma group?",
      history: [{ role: "user", content: "Bila start semester ni week berapa?" }],
      classifyLlm,
    });
    expect(classifyLlm).toHaveBeenCalled();
    expect(profile.replyLanguage).toBe("mixed");
    expect(profile.usedLlmClassify).toBe(true);
  });

  it("is model-agnostic (same profile regardless of modelId)", async () => {
    const a = await resolveLanguageProfile({
      message: "When is registration?",
      modelId: "@cf/google/gemma-4-26b-a4b-it",
      skipLlm: true,
    });
    const b = await resolveLanguageProfile({
      message: "When is registration?",
      modelId: "@cf/meta/llama-4-scout-17b-16e-instruct",
      skipLlm: true,
    });
    const c = await resolveLanguageProfile({
      message: "When is registration?",
      modelId: "@cf/mistralai/mistral-small-3.1-24b-instruct",
      skipLlm: true,
    });
    const d = await resolveLanguageProfile({
      message: "When is registration?",
      modelId: "@cf/nvidia/nemotron-3-120b-a12b",
      skipLlm: true,
    });
    expect(a.replyLanguage).toBe("en");
    expect(b.replyLanguage).toBe(a.replyLanguage);
    expect(c.replyLanguage).toBe(a.replyLanguage);
    expect(d.replyLanguage).toBe(a.replyLanguage);
  });
});
