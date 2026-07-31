import {
  CHAT_RATE_LIMIT_MESSAGE,
  CHAT_TIMEOUT_MESSAGE,
  resolveChatErrorMessage,
} from "@/lib/chat/user-messages";

export const SSE_HEADERS: Record<string, string> = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
};

export function encodeSseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export function sseResponse(
  stream: ReadableStream<Uint8Array>,
  extraHeaders?: Record<string, string>
): Response {
  return new Response(stream, {
    headers: { ...SSE_HEADERS, ...extraHeaders },
  });
}

export interface ChatStreamDonePayload {
  reply: string;
  correlationId: string;
}

export interface ChatStreamErrorPayload {
  error: string;
  status?: number;
}

export interface ChatStreamReasoningPayload {
  token?: string;
  text?: string;
  replace?: boolean;
}

export interface ChatStreamTokenPayload {
  token: string;
}

export interface ChatStreamStatusPayload {
  /** Server-side phase hint: "searching" | "generating" | "retry" | etc. */
  phase?: string;
  message?: string;
}

/** Clears partial assistant content before a server-side regenerate (date/incomplete retry). */
export interface ChatStreamResetPayload {
  reason?: string;
  /** Stream phase hint, e.g. `retry`. */
  phase?: string;
  /** Short user-facing status from server reasoning pools (not hardcoded in UI). */
  message?: string;
}

/** A chunk ending in a bare list / heading / quote / table marker. */
const DANGLING_MARKER_TAIL = /(?:^|\n)[ \t]*(?:[-*+]|\d+[.)]|#{1,6}|>|\|)[ \t]*$/;

/** The marker itself, including trailing spaces. */
const MARKER_PREFIX = /^[ \t]*(?:[-*+]|\d+[.)]|#{1,6}|>|\|)[ \t]*/;

/**
 * Adjust a flush boundary so a chunk never ends with a marker alone ("- ",
 * "1. ", "## "). Extends the cut when the marker's text is already buffered,
 * otherwise cuts before the marker so it waits for its text.
 */
function resolveSafeFlushCut(buf: string, cut: number): number {
  const match = DANGLING_MARKER_TAIL.exec(buf.slice(0, cut));
  if (!match) return cut;

  const markerStart = match[0].startsWith("\n") ? match.index + 1 : match.index;
  const rest = buf.slice(markerStart);
  const prefix = MARKER_PREFIX.exec(rest)?.[0] ?? "";
  const word = /^\S+/.exec(rest.slice(prefix.length))?.[0];
  if (!word) return markerStart;
  return markerStart + prefix.length + word.length;
}

/**
 * Buffers raw model tokens into sentence/paragraph-sized chunks so mid-stream
 * markdown paints less broken while preserving an early first paint.
 */
export function createMarkdownStreamPainter(
  onFlush: (chunk: string) => void,
  options?: { maxChunkChars?: number; firstFlushChars?: number }
): {
  push: (token: string) => void;
  reset: () => void;
  flush: () => void;
} {
  const maxChunkChars = options?.maxChunkChars ?? 8;
  const firstFlushChars = options?.firstFlushChars ?? 2;
  let buf = "";
  let hasFlushed = false;

  function nextFlushCut(): number | null {
    const paraIdx = buf.indexOf("\n\n");
    if (paraIdx >= 0) return paraIdx + 2;

    const sentenceMatch = buf.match(/^[\s\S]{4,}?[.!?…](?:\s+|$)/);
    if (sentenceMatch?.[0]) return sentenceMatch[0].length;

    if (!hasFlushed && buf.length >= firstFlushChars) {
      const window = buf.slice(0, firstFlushChars);
      const breakAt = Math.max(
        window.lastIndexOf("\n"),
        window.lastIndexOf(" "),
        window.lastIndexOf("|")
      );
      return breakAt >= 4 ? breakAt + 1 : firstFlushChars;
    }

    if (buf.length >= maxChunkChars) {
      const window = buf.slice(0, maxChunkChars);
      const breakAt = Math.max(
        window.lastIndexOf("\n"),
        window.lastIndexOf(" "),
        window.lastIndexOf("|")
      );
      return breakAt >= 12 ? breakAt + 1 : maxChunkChars;
    }

    return null;
  }

  function takeFlushablePrefix(): string | null {
    if (!buf) return null;

    const cut = nextFlushCut();
    if (cut == null) return null;

    const safeCut = resolveSafeFlushCut(buf, cut);
    if (safeCut <= 0) return null;

    const chunk = buf.slice(0, safeCut);
    buf = buf.slice(safeCut);
    return chunk;
  }

  return {
    push(token: string) {
      if (!token) return;
      buf += token;
      let chunk = takeFlushablePrefix();
      while (chunk) {
        hasFlushed = true;
        onFlush(chunk);
        chunk = takeFlushablePrefix();
      }
    },
    reset() {
      buf = "";
      hasFlushed = false;
    },
    flush() {
      if (!buf) return;
      hasFlushed = true;
      onFlush(buf);
      buf = "";
    },
  };
}

/** Coalesce stream painter flushes to one update per animation frame. */
export function createRafMarkdownStreamPainter(
  onFlush: (chunk: string) => void,
  options?: { maxChunkChars?: number; firstFlushChars?: number }
) {
  let pending = "";
  let rafId: number | null = null;
  const inner = createMarkdownStreamPainter((chunk) => {
    pending += chunk;
    if (rafId !== null) return;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      if (!pending) return;
      const chunkToFlush = pending;
      pending = "";
      onFlush(chunkToFlush);
    });
  }, options);

  return {
    push: inner.push,
    reset() {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      pending = "";
      inner.reset();
    },
    flush() {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      inner.flush();
      if (pending) {
        onFlush(pending);
        pending = "";
      }
    },
  };
}

/** Parse SSE lines from a chunk buffer (handles partial lines across reads). */
export function parseSseBuffer(
  buffer: string,
  onEvent: (event: string, data: unknown) => void
): string {
  const parts = buffer.split("\n\n");
  const remainder = parts.pop() ?? "";
  for (const block of parts) {
    const lines = block.split("\n");
    let event = "message";
    let dataLine = "";
    for (const line of lines) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) dataLine = line.slice(5).trim();
    }
    if (dataLine) {
      try {
        onEvent(event, JSON.parse(dataLine));
      } catch {
        onEvent(event, dataLine);
      }
    }
  }
  return remainder;
}

export interface ChatStreamHandlers {
  onToken: (token: string) => void;
  onDone: (payload: ChatStreamDonePayload) => void | Promise<void>;
  onError: (payload: ChatStreamErrorPayload) => void;
  onStatus?: (payload: ChatStreamStatusPayload) => void;
  onReasoning?: (payload: ChatStreamReasoningPayload) => void;
  /** Fired before a server regenerates so the UI can drop partial tokens. */
  onReset?: (payload: ChatStreamResetPayload) => void;
}

export async function consumeChatStream(
  response: Response,
  handlers: ChatStreamHandlers,
  options?: { signal?: AbortSignal }
): Promise<void> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/event-stream")) {
    const text = await response.text();
    try {
      const data = JSON.parse(text) as {
        reply?: string;
        error?: string;
        correlationId?: string;
      };
      if (!response.ok) {
        handlers.onError({ error: data.error ?? "Request failed", status: response.status });
        return;
      }
      if (data.reply != null) {
        handlers.onDone({
          reply: data.reply,
          correlationId: data.correlationId ?? "",
        });
      }
    } catch {
      handlers.onError({ error: "Invalid response from server", status: response.status });
    }
    return;
  }

  if (!response.body) {
    handlers.onError({ error: "Empty stream", status: response.status });
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let donePromise: Promise<void> | undefined;
  let receivedDone = false;
  let receivedError = false;
  let lastErrorStatus: number | undefined;

  const handleEvent = (event: string, data: unknown) => {
    if (event === "token") {
      const payload = data as ChatStreamTokenPayload;
      if (payload.token) handlers.onToken(payload.token);
    } else if (event === "done") {
      receivedDone = true;
      donePromise = Promise.resolve(
        handlers.onDone(data as ChatStreamDonePayload)
      );
    } else if (event === "error") {
      receivedError = true;
      const payload = data as ChatStreamErrorPayload;
      lastErrorStatus = payload.status;
      handlers.onError(payload);
    } else if (event === "reset") {
      handlers.onReset?.(data as ChatStreamResetPayload);
    } else if (event === "status") {
      handlers.onStatus?.(data as ChatStreamStatusPayload);
    } else if (event === "reasoning") {
      const payload = data as ChatStreamReasoningPayload;
      if (payload.replace && payload.text) {
        handlers.onReasoning?.(payload);
      } else if (payload.token) {
        handlers.onReasoning?.(payload);
      }
    }
  };

  const signal = options?.signal;
  const onAbort = () => {
    try {
      reader.cancel().catch(() => undefined);
    } catch {
      /* ignore */
    }
  };
  if (signal) {
    if (signal.aborted) {
      onAbort();
      handlers.onError({
        error: resolveChatErrorMessage(lastErrorStatus, undefined),
        status: lastErrorStatus ?? 504,
      });
      return;
    }
    signal.addEventListener("abort", onAbort, { once: true });
  }

  try {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        buffer = parseSseBuffer(buffer, handleEvent);
      }
    } catch {
      /* read rejected (e.g. abort) — fall through to terminal-state check */
    }

    if (buffer.trim()) {
      parseSseBuffer(`${buffer}\n\n`, handleEvent);
    }

    if (donePromise) await donePromise;

    if (!receivedDone && !receivedError) {
      if (signal?.aborted) {
        handlers.onError({
          error: resolveChatErrorMessage(lastErrorStatus, undefined),
          status: lastErrorStatus ?? 504,
        });
      } else {
        handlers.onError({
          error: "Connection closed before response completed. Please try again.",
          status: 502,
        });
      }
    }
  } finally {
    if (signal) signal.removeEventListener("abort", onAbort);
  }
}
