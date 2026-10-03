import { buildAiGatewayRunOptions } from "@/lib/ai-gateway";
import type { ChatMessage } from "@/lib/ai";
import type { CalendarContextIntent } from "@/lib/chat/calendar-intent";
import { buildClefRunInput, buildClefState } from "@/lib/chat/clef/questions";
import { CHAT_MODEL_CLEF, CLEF_TIMEOUT_MS } from "@/lib/chat/clef/model";
import { parseClefResponse, type ClefUnderstanding } from "@/lib/chat/clef/parse";
import type { TopicRouteResult } from "@/lib/chat/topic-router";
import { logger } from "@/lib/logger";

export interface RunClefUnderstandingInput {
  ai: Ai;
  message: string;
  history?: ChatMessage[];
  heuristicRoute: TopicRouteResult;
  heuristicIntent: CalendarContextIntent;
  hasMatchedActivity: boolean;
  correlationId?: string;
  timeoutMs?: number;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Clef understanding timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

export async function runClefUnderstanding(
  input: RunClefUnderstandingInput
): Promise<ClefUnderstanding | null> {
  const timeoutMs = input.timeoutMs ?? CLEF_TIMEOUT_MS;
  const state = buildClefState({
    message: input.message,
    history: input.history,
    heuristicTopics: input.heuristicRoute.topics,
    heuristicIntent: input.heuristicIntent,
    hasMatchedActivity: input.hasMatchedActivity,
  });
  const body = buildClefRunInput(state);

  try {
    const options = await buildAiGatewayRunOptions({
      skipCache: true,
      metadata: {
        feature: "clef-understanding",
        correlationId: input.correlationId,
      },
    });
    const run = options
      ? input.ai.run(CHAT_MODEL_CLEF, body, options)
      : input.ai.run(CHAT_MODEL_CLEF, body);
    const raw = await withTimeout(Promise.resolve(run), timeoutMs);
    const parsed = parseClefResponse(raw);
    if (!parsed) {
      logger.warn("Clef understanding returned an unusable payload", {
        correlationId: input.correlationId,
      });
    }
    return parsed;
  } catch (error) {
    logger.warn("Clef understanding failed; keeping heuristic route", {
      correlationId: input.correlationId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
