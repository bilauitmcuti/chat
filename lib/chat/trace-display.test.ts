import { describe, expect, it } from "vitest";
import {
  coalesceReasoningDisplay,
  finishTraceSteps,
  isRawReasoningAlignedWithQuestion,
  REASONING_TRACE_STEP_ID,
  sanitizeRawReasoningForDisplay,
  upsertTraceStep,
  type ChatTraceStepPatch,
} from "@/lib/chat/trace-display";
import { createTurnTraceEmitter } from "@/lib/chat/trace-emitter";

const QUESTION = "When does the semester break start this year?";
const TEMPLATE = "Template paragraph about semester break dates.";

describe("sanitizeRawReasoningForDisplay", () => {
  it("drops sentences that reveal tools, prompts or internal ids", () => {
    const raw =
      "The student wants the semester break start date. I should call get_academic_calendar with the tool. The system prompt says to answer in English. The break usually follows week 14 of lectures.";
    const cleaned = sanitizeRawReasoningForDisplay(raw);
    expect(cleaned).toBe(
      "The student wants the semester break start date. The break usually follows week 14 of lectures."
    );
  });

  it("removes JSON tool-call lines", () => {
    const raw = '{"name": "get_lecture_weeks", "arguments": {}}\nChecking which lecture week covers next Monday for the student.';
    expect(sanitizeRawReasoningForDisplay(raw)).toBe(
      "Checking which lecture week covers next Monday for the student."
    );
  });

  it("returns null when too little safe text remains", () => {
    expect(sanitizeRawReasoningForDisplay("Use the API tools now.")).toBeNull();
    expect(sanitizeRawReasoningForDisplay("   ")).toBeNull();
  });

  it("caps long reasoning at a word boundary", () => {
    const raw = "The semester break dates matter here. ".repeat(40);
    const cleaned = sanitizeRawReasoningForDisplay(raw)!;
    expect(cleaned.length).toBeLessThanOrEqual(701);
    expect(cleaned.endsWith("…")).toBe(true);
  });
});

describe("isRawReasoningAlignedWithQuestion", () => {
  it("accepts reasoning on the same calendar topic, across languages", () => {
    expect(
      isRawReasoningAlignedWithQuestion(
        "Looking for the semester break window in the official calendar.",
        "Bila cuti semester bermula?"
      )
    ).toBe(true);
  });

  it("rejects reasoning that drifts to another topic", () => {
    expect(
      isRawReasoningAlignedWithQuestion(
        "Listing the public holiday dates for Selangor this year.",
        QUESTION
      )
    ).toBe(false);
  });

  it("falls back to shared keywords when topics are unclassified", () => {
    expect(
      isRawReasoningAlignedWithQuestion("Explaining what the library opening hours are.", "library hours?")
    ).toBe(true);
    expect(isRawReasoningAlignedWithQuestion("Something unrelated entirely here.", "library hours?")).toBe(
      false
    );
  });
});

describe("coalesceReasoningDisplay", () => {
  it("prefers sanitized raw reasoning when aligned", () => {
    const raw = "The student is asking when the semester break starts, so I will confirm the break dates.";
    expect(coalesceReasoningDisplay(TEMPLATE, raw, QUESTION)).toBe(raw);
  });

  it("keeps the template when raw reasoning is private or off-topic", () => {
    expect(coalesceReasoningDisplay(TEMPLATE, "Call the tool via API.", QUESTION)).toBe(TEMPLATE);
    expect(
      coalesceReasoningDisplay(TEMPLATE, "Listing the public holiday dates for Selangor this year.", QUESTION)
    ).toBe(TEMPLATE);
  });
});

describe("upsertTraceStep / finishTraceSteps", () => {
  it("appends new steps, merges patches and ignores incomplete unknown patches", () => {
    let steps = upsertTraceStep([], { id: "tool-1", kind: "tool", title: "Reading public holidays…" });
    expect(steps).toEqual([
      { id: "tool-1", kind: "tool", title: "Reading public holidays…", status: "running" },
    ]);
    steps = upsertTraceStep(steps, { id: "tool-1", status: "done" });
    expect(steps[0]?.status).toBe("done");
    expect(upsertTraceStep(steps, { id: "missing", status: "done" })).toEqual(steps);
  });

  it("settles running steps and trims the ellipsis on success", () => {
    const steps = finishTraceSteps([
      { id: "a", kind: "tool", title: "Reading public holidays…", status: "running" },
      { id: "b", kind: "retry", title: "Verifying dates…", status: "done" },
    ]);
    expect(steps[0]).toMatchObject({ status: "done", title: "Reading public holidays" });
    expect(steps[1]?.title).toBe("Verifying dates…");
    expect(finishTraceSteps([{ id: "c", kind: "tool", title: "X…", status: "running" }], "error")[0]).toMatchObject(
      { status: "error", title: "X…" }
    );
  });
});

describe("createTurnTraceEmitter", () => {
  function setup(showReasoning = true, template = TEMPLATE) {
    const steps: ChatTraceStepPatch[] = [];
    const reasoning: string[] = [];
    let clock = 1_000;
    const emitter = createTurnTraceEmitter({
      userMessage: QUESTION,
      showReasoning,
      template,
      emitStep: (patch) => steps.push(patch),
      emitReasoning: (text) => reasoning.push(text),
      now: () => clock,
    });
    return { emitter, steps, reasoning, advance: (ms: number) => (clock += ms) };
  }

  it("emits template first, then upgrades to aligned raw reasoning", () => {
    const { emitter, steps, reasoning, advance } = setup();
    emitter.start();
    expect(steps[0]).toMatchObject({ id: REASONING_TRACE_STEP_ID, kind: "reasoning", status: "running" });
    expect(reasoning).toEqual([TEMPLATE]);

    advance(300);
    emitter.onReasoningToken("The student asks when the semester ");
    emitter.onReasoningToken("break starts, so I will confirm the break dates.");
    emitter.onAnswerToken();

    expect(reasoning.at(-1)).toBe(
      "The student asks when the semester break starts, so I will confirm the break dates."
    );
    expect(steps.at(-1)).toMatchObject({ id: REASONING_TRACE_STEP_ID, status: "done" });
  });

  it("tracks tool steps and settles them when the answer starts", () => {
    const { emitter, steps } = setup(false);
    emitter.start();
    emitter.onToolCall("get_public_holidays");
    emitter.onAnswerToken();
    expect(steps).toEqual([
      { id: "tool-1", kind: "tool", title: "Reading public holidays…", status: "running" },
      { id: "tool-1", status: "done", title: "Reading public holidays" },
    ]);
  });

  it("replaces drifted reasoning with a neutral line on finish", () => {
    const { emitter, reasoning } = setup(true, "Checking the lecture week schedule for the requested week.");
    emitter.start();
    emitter.finish("Cuti semester bermula 15 Jun 2026 dan semester break berakhir 28 Jun.");
    expect(reasoning.at(-1)).toBe(
      "Reviewing the official information so the answer stays accurate and relevant."
    );
  });
});
