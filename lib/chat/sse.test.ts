import { describe, expect, it, vi } from "vitest";
import {
  consumeChatStream,
  createMarkdownStreamPainter,
  encodeSseEvent,
  parseSseBuffer,
} from "@/lib/chat/sse";

describe("sse helpers", () => {
  it("encodes event lines", () => {
    const line = encodeSseEvent("token", { token: "Hi" });
    expect(line).toContain("event: token");
    expect(line).toContain('"token":"Hi"');
  });

  it("parses buffered events", () => {
    const events: Array<{ event: string; data: unknown }> = [];
    const remainder = parseSseBuffer(
      'event: done\ndata: {"reply":"ok","correlationId":"c1"}\n\n',
      (event, data) => events.push({ event, data })
    );
    expect(remainder).toBe("");
    expect(events).toHaveLength(1);
    expect(events[0]?.event).toBe("done");
  });
});

function streamResponse(chunks: string[]): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8" },
  });
}

describe("createMarkdownStreamPainter", () => {
  it("flushes on sentence boundaries and leaves a short remainder until flush", () => {
    const chunks: string[] = [];
    const painter = createMarkdownStreamPainter((c) => chunks.push(c), {
      maxChunkChars: 64,
    });
    painter.push("Hello there. ");
    painter.push("More");
    expect(chunks).toEqual(["Hello there. "]);
    painter.flush();
    expect(chunks).toEqual(["Hello there. ", "More"]);
  });

  it("flushes early on first chunk before sentence boundary", () => {
    const chunks: string[] = [];
    const painter = createMarkdownStreamPainter((c) => chunks.push(c), {
      maxChunkChars: 32,
      firstFlushChars: 12,
    });
    painter.push("Hello world!");
    expect(chunks).toEqual(["Hello world!"]);
  });

  it("resets buffered partial without painting it", () => {
    const chunks: string[] = [];
    const painter = createMarkdownStreamPainter((c) => chunks.push(c), {
      firstFlushChars: 12,
      maxChunkChars: 64,
    });
    painter.push("partial");
    painter.reset();
    painter.push("Clean answer.");
    painter.flush();
    expect(chunks.join("")).toBe("Clean answer.");
  });
});

describe("consumeChatStream", () => {
  it("emits tokens, status, and done for a complete stream", async () => {
    const res = streamResponse([
      encodeSseEvent("status", { phase: "generating", message: "Writing…" }),
      encodeSseEvent("token", { token: "Hello" }),
      encodeSseEvent("done", { reply: "Hello", correlationId: "c1" }),
    ]);
    const tokens: string[] = [];
    const statuses: string[] = [];
    let done: { reply: string; correlationId: string } | undefined;
    let errored = false;

    await consumeChatStream(res, {
      onToken: (t) => tokens.push(t),
      onDone: (p) => {
        done = p;
      },
      onError: () => {
        errored = true;
      },
      onStatus: (p) => statuses.push(p.message ?? ""),
    });

    expect(tokens).toEqual(["Hello"]);
    expect(statuses).toEqual(["Writing…"]);
    expect(done).toEqual({ reply: "Hello", correlationId: "c1" });
    expect(errored).toBe(false);
  });

  it("reports a 502 error when the stream closes without done/error", async () => {
    const res = streamResponse([encodeSseEvent("token", { token: "partial" })]);
    let error: { error: string; status?: number } | undefined;
    await consumeChatStream(res, {
      onToken: () => {},
      onDone: () => {},
      onError: (p) => {
        error = p;
      },
    });
    expect(error?.status).toBe(502);
    expect(error?.error).toContain("Connection closed");
  });

  it("clears tokens on reset before continuing", async () => {
    const res = streamResponse([
      encodeSseEvent("token", { token: "partial " }),
      encodeSseEvent("reset", {
        reason: "incomplete",
        phase: "retry",
        message: "Completing your answer…",
      }),
      encodeSseEvent("token", { token: "final" }),
      encodeSseEvent("done", { reply: "final", correlationId: "c1" }),
    ]);
    const tokens: string[] = [];
    let resetCount = 0;
    let resetPayload: { message?: string; phase?: string } | undefined;
    let done: { reply: string } | undefined;

    await consumeChatStream(res, {
      onToken: (t) => tokens.push(t),
      onReset: (payload) => {
        resetCount += 1;
        resetPayload = payload;
        tokens.length = 0;
      },
      onDone: (p) => {
        done = p;
      },
      onError: () => {},
    });

    expect(resetCount).toBe(1);
    expect(resetPayload?.phase).toBe("retry");
    expect(resetPayload?.message).toBe("Completing your answer…");
    expect(tokens).toEqual(["final"]);
    expect(done?.reply).toBe("final");
  });

  it("emits a 504 error when the abort signal fires mid-stream", async () => {
    const controller = new AbortController();
    const stream = new ReadableStream<Uint8Array>({
      start(ctrl) {
        const encoder = new TextEncoder();
        ctrl.enqueue(encoder.encode(encodeSseEvent("token", { token: "x" })));
        // Never close — simulate a stalled stream and abort from outside.
        controller.signal.addEventListener("abort", () => {
          try {
            ctrl.close();
          } catch {
            /* ignore */
          }
        });
      },
    });
    const res = new Response(stream, {
      headers: { "Content-Type": "text/event-stream; charset=utf-8" },
    });
    let error: { error: string; status?: number } | undefined;
    const pending = consumeChatStream(
      res,
      {
        onToken: () => {},
        onDone: () => {},
        onError: (p) => {
          error = p;
        },
      },
      { signal: controller.signal }
    );
    controller.abort();
    await pending;
    expect(error?.status).toBe(504);
  });
});

describe("parseSseBuffer reasoning event", () => {
  it("parses reasoning SSE payloads", () => {
    const onReasoning = vi.fn();
    parseSseBuffer('event: reasoning\ndata: {"token":"Planning"}\n\n', (event, data) => {
      if (event === "reasoning") onReasoning(data);
    });
    expect(onReasoning).toHaveBeenCalledWith({ token: "Planning" });
  });
});

describe("consumeChatStream reasoning", () => {
  it("invokes onReasoning for reasoning events", async () => {
    const onReasoning = vi.fn();
    const res = streamResponse([
      encodeSseEvent("reasoning", { token: "Step 1" }),
      encodeSseEvent("done", { reply: "Done", correlationId: "c1" }),
    ]);

    await consumeChatStream(res, {
      onToken: () => {},
      onReasoning,
      onDone: async () => {},
      onError: () => {},
    });

    expect(onReasoning).toHaveBeenCalledWith({ token: "Step 1" });
  });

  it("invokes onReasoning for full paragraph replacements", async () => {
    const onReasoning = vi.fn();
    const paragraph =
      "Everything has been verified. I'm preparing a clear and accurate answer based on the latest official information.";
    const res = streamResponse([
      encodeSseEvent("reasoning", { text: paragraph, replace: true }),
      encodeSseEvent("done", { reply: "Done", correlationId: "c1" }),
    ]);

    await consumeChatStream(res, {
      onToken: () => {},
      onReasoning,
      onDone: async () => {},
      onError: () => {},
    });

    expect(onReasoning).toHaveBeenCalledWith({ text: paragraph, replace: true });
  });
});
