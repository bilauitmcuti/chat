import {
  buildAiGatewayRunOptions,
  isAiGatewayEnabled,
  resolveAiGatewayId,
  type AiGatewayRunOptions,
} from "@/lib/ai-gateway";
import {
  formatToolsForModel,
  usesOpenAiFunctionToolFormat,
  type FlatToolDefinition,
} from "@/lib/chat/agent/tool-format";
import { getDynamicRouteModelId, usesDynamicRoute } from "@/lib/chat/dynamic-routes";
import { CHAT_MAX_MESSAGE_LENGTH } from "@/lib/chat/limits";
import { trimHistoryForModel } from "@/lib/chat/history-for-model";
import { logger } from "@/lib/logger";
import {
  CHAT_MODEL_GEMMA_4,
  CHAT_MODEL_LLAMA_32,
  CHAT_MODEL_LLAMA_4_SCOUT,
  CHAT_MODEL_MISTRAL_SMALL,
  DEFAULT_CHAT_MODEL,
  getChatLimits,
  getDefaultChatModel,
  getMaxOutputTokens,
  getModelMaxOutputTokens,
  MAX_OUTPUT_TOKENS,
  modelSupportsFunctionCalling,
  resolveChatModel,
  supportsReasoningUi,
  type ChatLimits,
} from "@/lib/chat/models";

export {
  CHAT_MODEL_GEMMA_4,
  CHAT_MODEL_LLAMA_32,
  CHAT_MODEL_LLAMA_4_SCOUT,
  CHAT_MODEL_MISTRAL_SMALL,
  CHAT_MODELS,
  DEFAULT_CHAT_MODEL,
  getChatLimits,
  getDefaultChatModel,
  getMaxOutputTokens,
  getModelMaxOutputTokens,
  getVisibleChatModels,
  MAX_OUTPUT_TOKENS,
  resolveChatModel,
  supportsReasoningUi,
  type ChatLimits,
  type ChatModelOption,
} from "@/lib/chat/models";

const DEFAULT_TEMPERATURE = 0.2;

/**
 * Progressive token painting is on: client paints SSE `token` events as they
 * arrive. The final `done` event still replaces content with the cleaned full reply.
 */
export function shouldStreamTokensToClient(_requestHost?: string | null): boolean {
  return true;
}

interface WorkersAiTextResponse {
  response?: string;
  choices?: Array<{ message?: { content?: string | null } }>;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function isAiRateLimitError(error: unknown): boolean {
  const status =
    error !== null &&
    typeof error === "object" &&
    "status" in error &&
    typeof (error as { status?: unknown }).status === "number"
      ? (error as { status: number }).status
      : undefined;
  if (status === 429) return true;
  const msg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    msg.includes("429") ||
    msg.includes("rate limit") ||
    msg.includes("too many requests")
  );
}

/** Errors where trying the production backup model may succeed. */
export function isModelFallbackError(error: unknown): boolean {
  if (isAiRateLimitError(error)) return true;
  const status = getAiErrorStatus(error);
  if (status === 500 || status === 502 || status === 503 || status === 504) return true;

  const msg = normalizeAiErrorMessage(error).toLowerCase();
  return (
    msg.includes("503") ||
    msg.includes("500") ||
    msg.includes("502") ||
    msg.includes("504") ||
    msg.includes("loading") ||
    msg.includes("unavailable") ||
    msg.includes("timeout") ||
    msg.includes("timed out") ||
    msg.includes("empty response") ||
    msg.includes("finish_reason") ||
    msg.includes("model") ||
    msg.includes("not found") ||
    msg.includes("unsupported") ||
    msg.includes("econnreset") ||
    msg.includes("network")
  );
}

export async function getAiBinding(): Promise<Ai | null> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { env } = await getCloudflareContext({ async: true });
    return (env as CloudflareEnv | undefined)?.AI ?? null;
  } catch {
    return null;
  }
}

function buildChatGatewayMetadata(correlationId?: string): AiGatewayRunOptions["metadata"] {
  return correlationId
    ? { correlationId, path: "chat" }
    : { path: "chat" };
}

/** Normalize Workers AI flat tools to OpenAI nested function tools for compat. */
function normalizeToolsToOpenAiCompat(tools: unknown[]): unknown[] {
  return tools.map((tool) => {
    if (!tool || typeof tool !== "object") return tool;
    const t = tool as Record<string, unknown>;
    if (t.type === "function" && t.function && typeof t.function === "object") {
      return tool;
    }
    if (typeof t.name === "string") {
      return {
        type: "function",
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      };
    }
    return tool;
  });
}

function normalizeToolCallsToOpenAiCompat(toolCalls: unknown[]): unknown[] {
  return toolCalls.map((call, index) => {
    if (!call || typeof call !== "object") return call;
    const c = call as Record<string, unknown>;
    if (c.type === "function" && c.function && typeof c.function === "object") {
      return call;
    }
    const name = typeof c.name === "string" ? c.name : "";
    if (!name) return call;
    const args = c.arguments ?? c.args ?? {};
    return {
      id: typeof c.id === "string" ? c.id : `call_${name}_${index}`,
      type: "function",
      function: {
        name,
        arguments:
          typeof args === "string" ? args : JSON.stringify(args ?? {}),
      },
    };
  });
}

/** Normalize chat messages so Dynamic Route compat accepts Workers-shaped tool turns. */
export function normalizeMessagesToOpenAiCompat(messages: unknown[]): unknown[] {
  return messages.map((msg) => {
    if (!msg || typeof msg !== "object") return msg;
    const m = msg as Record<string, unknown>;
    if (m.role === "tool") {
      const out: Record<string, unknown> = {
        role: "tool",
        content: m.content,
      };
      if (typeof m.tool_call_id === "string") out.tool_call_id = m.tool_call_id;
      else if (typeof m.name === "string") out.tool_call_id = `call_${m.name}`;
      return out;
    }
    if (m.role === "assistant" && Array.isArray(m.tool_calls)) {
      return {
        ...m,
        tool_calls: normalizeToolCallsToOpenAiCompat(m.tool_calls),
      };
    }
    return msg;
  });
}

/** Build OpenAI-compat chat/completions query for a Dynamic Route. */
export function buildDynamicRouteCompatQuery(
  dynamicModelId: string,
  input: Record<string, unknown>
): Record<string, unknown> {
  const query: Record<string, unknown> = { model: dynamicModelId };
  if (Array.isArray(input.messages)) {
    query.messages = normalizeMessagesToOpenAiCompat(input.messages);
  }
  if (typeof input.max_tokens === "number") query.max_tokens = input.max_tokens;
  if (typeof input.temperature === "number") query.temperature = input.temperature;
  if (input.stream === true) query.stream = true;
  if (Array.isArray(input.tools) && input.tools.length > 0) {
    query.tools = normalizeToolsToOpenAiCompat(input.tools);
  }
  return query;
}

function buildDynamicRouteGatewayHeaders(
  gatewayOpts?: AiGatewayRunOptions
): Record<string, string | number | boolean | object> {
  const headers: Record<string, string | number | boolean | object> = {
    "cf-aig-collect-log": true,
  };
  const metadata = gatewayOpts?.metadata
    ? Object.fromEntries(
        Object.entries(gatewayOpts.metadata).filter(([, v]) => v !== undefined)
      )
    : undefined;
  if (metadata && Object.keys(metadata).length > 0) {
    headers["cf-aig-metadata"] = metadata;
  }
  if (gatewayOpts?.skipCache) {
    headers["cf-aig-skip-cache"] = true;
  } else if (gatewayOpts?.cacheTtl !== undefined) {
    headers["cf-aig-cache-ttl"] = gatewayOpts.cacheTtl;
  }
  return headers;
}

function adaptInputForGemmaFallback(
  input: Record<string, unknown>
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...input };
  if (Array.isArray(next.tools)) {
    next.tools = normalizeToolsToOpenAiCompat(next.tools);
  }
  if (Array.isArray(next.messages)) {
    next.messages = normalizeMessagesToOpenAiCompat(next.messages);
  }
  next.chat_template_kwargs = { enable_thinking: false, thinking: false };
  return next;
}

function truncateErrorSnippet(value: string, max = 240): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}…`;
}

async function unwrapGatewayCompatResponse(
  response: Response,
  stream: boolean
): Promise<unknown> {
  if (!response.ok) {
    const bodyText = await response.text().catch(() => "");
    const err = new Error(
      bodyText.trim() || `AI Gateway dynamic route failed (${response.status})`
    );
    Object.assign(err, { status: response.status });
    throw err;
  }
  if (stream) {
    if (!response.body) {
      throw new Error("Empty stream from AI Gateway dynamic route");
    }
    return response.body;
  }

  const contentType = response.headers.get("content-type") ?? "";
  let payload: unknown;
  if (contentType.includes("application/json")) {
    payload = await response.json();
  } else {
    const text = await response.text();
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      payload = text;
    }
  }

  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    if (obj.success === false || obj.error != null) {
      const detail =
        typeof obj.error === "string"
          ? obj.error
          : obj.error && typeof obj.error === "object"
            ? JSON.stringify(obj.error)
            : Array.isArray(obj.errors)
              ? JSON.stringify(obj.errors)
              : "AI Gateway dynamic route returned an error payload";
      const err = new Error(detail);
      Object.assign(err, { status: 500 });
      throw err;
    }
    const choices = obj.choices;
    if (Array.isArray(choices) && choices.length === 0) {
      const err = new Error("Empty response from AI Gateway dynamic route");
      Object.assign(err, { status: 502 });
      throw err;
    }
  }

  return payload;
}

async function runViaDynamicRoute(
  ai: Ai,
  dynamicModelId: string,
  input: Record<string, unknown>,
  gatewayOpts?: AiGatewayRunOptions
): Promise<unknown> {
  const gatewayId = await resolveAiGatewayId();
  const query = buildDynamicRouteCompatQuery(dynamicModelId, input);
  const response = await ai.gateway(gatewayId).run({
    provider: "compat",
    endpoint: "chat/completions",
    headers: buildDynamicRouteGatewayHeaders(gatewayOpts),
    query,
  } as Parameters<ReturnType<Ai["gateway"]>["run"]>[0]);
  return unwrapGatewayCompatResponse(response, input.stream === true);
}

async function runViaAiRun(
  ai: Ai,
  modelId: string,
  input: Record<string, unknown>,
  gatewayOpts?: AiGatewayRunOptions
): Promise<unknown> {
  const options = await buildAiGatewayRunOptions(gatewayOpts);
  if (options) return ai.run(modelId, input, options);
  return ai.run(modelId, input);
}

/**
 * Prefer Dynamic Route when mapped (`dynamic/gemma-4` always; others when
 * CHAT_USE_DYNAMIC_ROUTES is on); otherwise AI.run(primary), then Gemma on
 * model fallback errors (non-Gemma only).
 */
export async function runAiWithGateway(
  ai: Ai,
  modelId: string,
  input: Record<string, unknown>,
  gatewayOpts?: AiGatewayRunOptions
): Promise<unknown> {
  const gatewayEnabled = await isAiGatewayEnabled();
  const dynamicModelId =
    gatewayEnabled && usesDynamicRoute(modelId)
      ? getDynamicRouteModelId(modelId)
      : null;

  if (dynamicModelId) {
    try {
      return await runViaDynamicRoute(ai, dynamicModelId, input, gatewayOpts);
    } catch (error) {
      const status = getAiErrorStatus(error);
      logger.warn("Dynamic route failed; falling back to AI.run", {
        modelId,
        dynamicModelId,
        status,
        error: truncateErrorSnippet(normalizeAiErrorMessage(error)),
      });
    }
  }

  try {
    return await runViaAiRun(ai, modelId, input, gatewayOpts);
  } catch (error) {
    const isGemma =
      modelId === DEFAULT_CHAT_MODEL ||
      modelId === CHAT_MODEL_GEMMA_4 ||
      modelId.includes("gemma-4");
    if (isGemma || !isModelFallbackError(error)) throw error;

    logger.warn("Primary model failed; falling back to Gemma 4", {
      modelId,
      status: getAiErrorStatus(error),
      error: truncateErrorSnippet(normalizeAiErrorMessage(error)),
    });
    return runViaAiRun(
      ai,
      DEFAULT_CHAT_MODEL,
      adaptInputForGemmaFallback(input),
      gatewayOpts
    );
  }
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max) + "...[truncated]";
}

function buildMessages(
  prompt: string,
  systemPrompt: string | undefined,
  history: ChatMessage[] | undefined,
  limits: ChatLimits,
  languageLockMessage?: string
): { role: "system" | "user" | "assistant"; content: string }[] {
  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [];

  if (systemPrompt) {
    messages.push({
      role: "system",
      content: truncate(systemPrompt, limits.maxSystemChars),
    });
  }

  if (history && history.length > 0) {
    const recentHistory = trimHistoryForModel(history, {
      maxMessages: Math.min(4, limits.maxHistoryMessages),
    });
    for (const msg of recentHistory) {
      messages.push({
        role: msg.role,
        content: truncate(msg.content, limits.maxMessageChars),
      });
    }
  }

  messages.push({
    role: "user",
    content: truncate(prompt, limits.maxUserPromptChars),
  });

  // Trailing user LANGUAGE LOCK — high priority for this turn (Workers AI scoped prompts).
  if (languageLockMessage?.trim()) {
    messages.push({
      role: "user",
      content: truncate(languageLockMessage.trim(), limits.maxUserPromptChars),
    });
  }

  return messages;
}

function normalizeReasoningFallback(reasoning: string): string | null {
  const trimmed = reasoning.trim();
  if (!trimmed) return null;
  if (/^[\[{]/.test(trimmed) && /"name"\s*:/.test(trimmed)) return null;
  return trimmed;
}

function extractWorkersAiContentFromObject(
  result: unknown,
  options?: { allowReasoningFallback?: boolean }
): string | null {
  const allowReasoningFallback = options?.allowReasoningFallback !== false;
  if (typeof result === "string" && result.trim()) return result.trim();

  if (!result || typeof result !== "object") return null;

  const data = result as WorkersAiTextResponse;
  if (typeof data.response === "string" && data.response.trim()) return data.response.trim();

  const message = data.choices?.[0]?.message as
    | { content?: string | null; reasoning?: string | null }
    | undefined;
  if (typeof message?.content === "string" && message.content.trim()) {
    return message.content.trim();
  }
  if (
    allowReasoningFallback &&
    (message?.content == null || String(message.content).trim() === "")
  ) {
    if (typeof message?.reasoning === "string") {
      const fromReasoning = normalizeReasoningFallback(message.reasoning);
      if (fromReasoning) return fromReasoning;
    }
  }

  const geminiCandidates = (result as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> })
    .candidates;
  const geminiText = geminiCandidates?.[0]?.content?.parts
    ?.map((p) => (p as { text?: string }).text ?? "")
    .join("");
  if (geminiText?.trim()) return geminiText.trim();

  return null;
}

export function tryExtractWorkersAiReasoning(result: unknown): string | null {
  if (!result || typeof result !== "object") return null;
  const message = (result as WorkersAiTextResponse).choices?.[0]?.message as
    | { reasoning?: string | null }
    | undefined;
  if (typeof message?.reasoning !== "string") return null;
  return normalizeReasoningFallback(message.reasoning);
}

export function tryExtractWorkersAiContent(result: unknown): string | null {
  return extractWorkersAiContentFromObject(result);
}

function extractWorkersAiContent(result: unknown): string {
  const content = extractWorkersAiContentFromObject(result);
  if (content) return content;
  throw new Error("Empty response from model");
}

function isGooglePartnerModelId(modelId: string): boolean {
  return modelId.startsWith("google/");
}

/** Normalize Workers AI / gateway errors (often plain objects, not Error instances). */
export function normalizeAiErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const o = error as Record<string, unknown>;
    if (typeof o.message === "string") return o.message;
    if (typeof o.error === "string") return o.error;
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return String(error);
}

function getAiErrorStatus(error: unknown): number | undefined {
  if (
    error !== null &&
    typeof error === "object" &&
    "status" in error &&
    typeof (error as { status?: unknown }).status === "number"
  ) {
    return (error as { status: number }).status;
  }
  return undefined;
}

function isGemmaThinkingCapableModel(modelId: string): boolean {
  return modelId.includes("gemma-4") || modelId.includes("gemma-3");
}

export type GemmaThinkingPhase = "tool" | "answer";

/** Thinking is off — it burns output tokens and adds latency on Workers AI Gemma. */
function resolveGemmaThinkingOptions(
  _phase: GemmaThinkingPhase
): { enable_thinking: boolean; thinking: boolean } {
  return { enable_thinking: false, thinking: false };
}

function buildModelRunInput(
  modelId: string,
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  max_tokens: number,
  temperature: number,
  stream: boolean,
  thinkingPhase: GemmaThinkingPhase = "answer"
): Record<string, unknown> {
  if (isGooglePartnerModelId(modelId)) {
    return {
      contents: messagesToGeminiContents(messages),
      generationConfig: {
        maxOutputTokens: max_tokens,
        temperature,
      },
      ...(stream ? { stream: true } : {}),
    };
  }
  const input: Record<string, unknown> = {
    messages,
    max_tokens,
    temperature,
  };
  if (isGemmaThinkingCapableModel(modelId)) {
    input.chat_template_kwargs = resolveGemmaThinkingOptions(thinkingPhase);
  }
  if (stream) input.stream = true;
  return input;
}

/** Whether to attempt the next model in the production chain after a failure. */
function shouldTryNextModelInChain(error: unknown, isLast: boolean): boolean {
  if (isLast) return false;
  const status = getAiErrorStatus(error);
  if (status === 401 || status === 403 || status === 413) return false;
  return true;
}

function messagesToGeminiContents(
  messages: { role: "system" | "user" | "assistant"; content: string }[]
): { role: string; parts: { text: string }[] }[] {
  const contents: { role: string; parts: { text: string }[] }[] = [];
  for (const msg of messages) {
    if (msg.role === "system") {
      contents.push({
        role: "user",
        parts: [{ text: `Instructions:\n${msg.content}` }],
      });
      continue;
    }
    contents.push({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    });
  }
  return contents;
}

function isMessagesApiUnsupportedError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    msg.includes("messages") ||
    msg.includes("invalid") ||
    msg.includes("unsupported") ||
    msg.includes("schema") ||
    msg.includes("unexpected")
  );
}

async function workersAiChatCompletion(params: {
  modelId: string;
  messages: { role: "system" | "user" | "assistant"; content: string }[];
  max_tokens: number;
  temperature: number;
  correlationId?: string;
}): Promise<string> {
  const ai = await getAiBinding();
  if (!ai) {
    const err = new Error(
      "Workers AI binding not available. Add an AI binding named AI in Cloudflare Pages, or run pnpm preview locally."
    );
    Object.assign(err, { status: 503 });
    throw err;
  }

  try {
    const input = buildModelRunInput(
      params.modelId,
      params.messages,
      params.max_tokens,
      params.temperature,
      false
    );
    const result = await runAiWithGateway(ai, params.modelId, input, {
      skipCache: false,
      cacheTtl: 120,
      metadata: buildChatGatewayMetadata(params.correlationId),
    });
    return extractWorkersAiContent(result);
  } catch (firstError) {
    const msg = normalizeAiErrorMessage(firstError).toLowerCase();
    if (msg.includes("429") || msg.includes("rate limit")) {
      const err = firstError instanceof Error ? firstError : new Error(msg);
      Object.assign(err, { status: 429 });
      throw err;
    }
    throw firstError;
  }
}

export async function askWorkersAi(
  prompt: string,
  systemPrompt: string | undefined,
  history: ChatMessage[] | undefined,
  options?: {
    maxTokens?: number;
    temperature?: number;
    modelId?: string | null;
    correlationId?: string;
    /** Trailing scoped user message — language lock for this turn. */
    languageLockMessage?: string;
  }
): Promise<string> {
  const limits = getChatLimits();
  const modelChain = [resolveChatModel(options?.modelId)];
  const messages = buildMessages(
    prompt,
    systemPrompt,
    history,
    limits,
    options?.languageLockMessage
  );
  const max_tokens = options?.maxTokens ?? limits.maxOutputTokens;
  const temperature = options?.temperature ?? DEFAULT_TEMPERATURE;

  let lastError: unknown = null;
  for (let i = 0; i < modelChain.length; i++) {
    const modelId = modelChain[i]!;
    const isLast = i === modelChain.length - 1;
    try {
      return await workersAiChatCompletion({
        modelId,
        messages,
        max_tokens,
        temperature,
        correlationId: options?.correlationId,
      });
    } catch (err) {
      lastError = err;
      if (!shouldTryNextModelInChain(err, isLast)) throw err;
    }
  }
  throw lastError;
}

export interface StreamDeltaParts {
  content?: string;
  reasoning?: string;
}

export function extractStreamParts(chunk: unknown): StreamDeltaParts {
  const parts: StreamDeltaParts = {};
  if (typeof chunk === "string") {
    if (chunk) parts.content = chunk;
    return parts;
  }
  if (!chunk || typeof chunk !== "object") return parts;

  const data = chunk as WorkersAiTextResponse & {
    response?: string;
    text?: string;
  };
  if (typeof data.response === "string" && data.response) {
    parts.content = data.response;
    return parts;
  }
  if (typeof data.text === "string" && data.text) {
    parts.content = data.text;
    return parts;
  }

  const choice = (chunk as {
    choices?: Array<{
      delta?: { content?: string; reasoning?: string };
      message?: { content?: string; reasoning?: string };
    }>;
  }).choices?.[0];

  const deltaContent = choice?.delta?.content;
  if (typeof deltaContent === "string" && deltaContent) {
    parts.content = deltaContent;
  }

  const messageContent = choice?.message?.content;
  if (!parts.content && typeof messageContent === "string" && messageContent) {
    parts.content = messageContent;
  }

  const deltaReasoning = choice?.delta?.reasoning;
  if (typeof deltaReasoning === "string") {
    const fromReasoning = normalizeReasoningFallback(deltaReasoning);
    if (fromReasoning) parts.reasoning = fromReasoning;
  }
  const messageReasoning = choice?.message?.reasoning;
  if (!parts.reasoning && typeof messageReasoning === "string") {
    const fromReasoning = normalizeReasoningFallback(messageReasoning);
    if (fromReasoning) parts.reasoning = fromReasoning;
  }

  const geminiParts = (
    chunk as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
  ).candidates?.[0]?.content?.parts;
  if (!parts.content && geminiParts?.length) {
    const text = geminiParts.map((p) => p.text ?? "").join("");
    if (text) parts.content = text;
  }

  if (!parts.content) {
    const fallback = extractWorkersAiContentFromObject(chunk, {
      allowReasoningFallback: false,
    });
    if (fallback) parts.content = fallback;
  }

  return parts;
}

function extractStreamDelta(chunk: unknown): string {
  return extractStreamParts(chunk).content ?? "";
}

function isStreamUnsupportedError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    msg.includes("stream") ||
    msg.includes("unsupported") ||
    isMessagesApiUnsupportedError(error)
  );
}

async function* iterateAiStreamParts(
  result: unknown
): AsyncGenerator<StreamDeltaParts> {
  if (result == null) return;

  if (typeof result === "string") {
    if (result) yield { content: result };
    return;
  }

  if (result instanceof ReadableStream) {
    const reader = result.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === "data: [DONE]") continue;
        const jsonStr = trimmed.startsWith("data:") ? trimmed.slice(5).trim() : trimmed;
        try {
          const parsed = JSON.parse(jsonStr) as unknown;
          const parts = extractStreamParts(parsed);
          if (parts.content || parts.reasoning) yield parts;
        } catch {
          if (jsonStr) yield { content: jsonStr };
        }
      }
    }
    if (buffer.trim()) {
      const parts = extractStreamParts(buffer);
      if (parts.content || parts.reasoning) yield parts;
    }
    return;
  }

  if (typeof (result as AsyncIterable<unknown>)[Symbol.asyncIterator] === "function") {
    for await (const chunk of result as AsyncIterable<unknown>) {
      const parts = extractStreamParts(chunk);
      if (parts.content || parts.reasoning) yield parts;
    }
    return;
  }

  const content = extractWorkersAiContentFromObject(result, {
    allowReasoningFallback: false,
  });
  const reasoning = tryExtractWorkersAiReasoning(result);
  if (content || reasoning) {
    yield { content: content ?? undefined, reasoning: reasoning ?? undefined };
  }
}

async function* iterateAiStream(result: unknown): AsyncGenerator<string> {
  for await (const parts of iterateAiStreamParts(result)) {
    if (parts.content) yield parts.content;
  }
}

async function workersAiChatCompletionStreamParts(params: {
  modelId: string;
  messages: { role: "system" | "user" | "assistant"; content: string }[];
  max_tokens: number;
  temperature: number;
  correlationId?: string;
  thinkingPhase?: GemmaThinkingPhase;
}): Promise<AsyncGenerator<StreamDeltaParts>> {
  const ai = await getAiBinding();
  if (!ai) {
    const err = new Error(
      "Workers AI binding not available. Add an AI binding named AI in Cloudflare Pages, or run pnpm preview locally."
    );
    Object.assign(err, { status: 503 });
    throw err;
  }

  const input = buildModelRunInput(
    params.modelId,
    params.messages,
    params.max_tokens,
    params.temperature,
    true,
    params.thinkingPhase ?? "answer"
  );
  const result = await runAiWithGateway(ai, params.modelId, input, {
    skipCache: true,
    metadata: buildChatGatewayMetadata(params.correlationId),
  });
  return iterateAiStreamParts(result);
}

async function workersAiChatCompletionStream(params: {
  modelId: string;
  messages: { role: "system" | "user" | "assistant"; content: string }[];
  max_tokens: number;
  temperature: number;
  correlationId?: string;
}): Promise<AsyncGenerator<string>> {
  const partsStream = await workersAiChatCompletionStreamParts(params);
  async function* contentOnly(): AsyncGenerator<string> {
    for await (const parts of partsStream) {
      if (parts.content) yield parts.content;
    }
  }
  return contentOnly();
}

export interface StreamWorkersAiOptions {
  maxTokens?: number;
  temperature?: number;
  modelId?: string | null;
  correlationId?: string;
  onToken: (token: string) => void | Promise<void>;
  onReasoningToken?: (token: string) => void | Promise<void>;
  /** When false, model still runs (and may stream internally) but onToken is not called until the end. */
  emitTokensToClient?: boolean;
  /** Trailing scoped user message — language lock for this turn. */
  languageLockMessage?: string;
}

/** Stream tokens from Workers AI; falls back to buffered completion if streaming unsupported. */
export async function streamWorkersAi(
  prompt: string,
  systemPrompt: string | undefined,
  history: ChatMessage[] | undefined,
  options: StreamWorkersAiOptions
): Promise<string> {
  const limits = getChatLimits();
  const modelChain = [resolveChatModel(options.modelId)];
  const messages = buildMessages(
    prompt,
    systemPrompt,
    history,
    limits,
    options.languageLockMessage
  );
  const max_tokens = options.maxTokens ?? limits.maxOutputTokens;
  const temperature = options.temperature ?? DEFAULT_TEMPERATURE;
  const emitTokens = options.emitTokensToClient ?? shouldStreamTokensToClient();

  let lastError: unknown = null;
  for (let i = 0; i < modelChain.length; i++) {
    const modelId = modelChain[i]!;
    const isLast = i === modelChain.length - 1;
    try {
      const stream = await workersAiChatCompletionStreamParts({
        modelId,
        messages,
        max_tokens,
        temperature,
        correlationId: options.correlationId,
        thinkingPhase: "answer",
      });
      let full = "";
      for await (const parts of stream) {
        if (parts.reasoning && options.onReasoningToken) {
          await options.onReasoningToken(parts.reasoning);
        }
        if (parts.content) {
          full += parts.content;
          if (emitTokens) await options.onToken(parts.content);
        }
      }
      if (!full.trim()) {
        full = await workersAiChatCompletion({
          modelId,
          messages,
          max_tokens,
          temperature,
          correlationId: options.correlationId,
        });
        if (full.trim()) {
          if (emitTokens) await options.onToken(full);
          return full;
        }
        const emptyErr = new Error(`Empty response from model (${modelId})`);
        if (!shouldTryNextModelInChain(emptyErr, isLast)) throw emptyErr;
        lastError = emptyErr;
        continue;
      }
      return full;
    } catch (err) {
      if (isStreamUnsupportedError(err)) {
        const full = await workersAiChatCompletion({
          modelId,
          messages,
          max_tokens,
          temperature,
          correlationId: options.correlationId,
        });
        if (emitTokens) await options.onToken(full);
        return full;
      }
      lastError = err;
      if (!shouldTryNextModelInChain(err, isLast)) throw err;
      continue;
    }
  }
  throw lastError;
}

// --- Agent / function calling ---

export interface WorkersAiToolCall {
  name: string;
  arguments: Record<string, unknown>;
  id?: string;
}

export type AgentChatMessage =
  | {
      role: "system" | "user" | "assistant";
      content: string;
      tool_calls?: WorkersAiToolCall[];
    }
  | { role: "tool"; name: string; content: string; tool_call_id?: string };

/** Models that support Workers AI traditional function calling in this app. */
export function supportsFunctionCalling(modelId: string): boolean {
  return modelSupportsFunctionCalling(modelId);
}

export function extractToolCalls(result: unknown): WorkersAiToolCall[] {
  if (!result || typeof result !== "object") return [];
  const r = result as Record<string, unknown>;
  const rawItems: unknown[] = [];

  const topLevel = r.tool_calls ?? r.toolCalls;
  if (Array.isArray(topLevel)) rawItems.push(...topLevel);

  const choiceMessage = (
    r.choices as Array<{ message?: Record<string, unknown> }> | undefined
  )?.[0]?.message;
  if (choiceMessage && typeof choiceMessage === "object") {
    const nested = choiceMessage.tool_calls ?? choiceMessage.toolCalls;
    if (Array.isArray(nested)) rawItems.push(...nested);
  }

  const calls: WorkersAiToolCall[] = [];
  const seen = new Set<string>();
  for (const item of rawItems) {
    const parsed = parseToolCallEntry(item);
    if (!parsed) continue;
    const key = `${parsed.id ?? ""}:${parsed.name}:${JSON.stringify(parsed.arguments)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    calls.push(parsed);
  }
  return calls;
}

function parseToolCallEntry(call: unknown): WorkersAiToolCall | null {
  if (!call || typeof call !== "object") return null;
  const c = call as Record<string, unknown>;
  const id = typeof c.id === "string" ? c.id : undefined;

  const fn = c.function;
  if (fn && typeof fn === "object") {
    const f = fn as Record<string, unknown>;
    const name = typeof f.name === "string" ? f.name : "";
    if (!name) return null;
    let args: unknown = f.arguments ?? f.args;
    if (typeof args === "string") {
      try {
        args = JSON.parse(args) as unknown;
      } catch {
        args = {};
      }
    }
    const argumentsRecord =
      args && typeof args === "object" && !Array.isArray(args)
        ? (args as Record<string, unknown>)
        : {};
    return { name, arguments: argumentsRecord, id };
  }

  const name = typeof c.name === "string" ? c.name : "";
  if (!name) return null;
  let args: unknown = c.arguments ?? c.args;
  if (typeof args === "string") {
    try {
      args = JSON.parse(args) as unknown;
    } catch {
      args = {};
    }
  }
  const argumentsRecord =
    args && typeof args === "object" && !Array.isArray(args)
      ? (args as Record<string, unknown>)
      : {};
  return { name, arguments: argumentsRecord, id };
}

function ensureToolCallIds(calls: WorkersAiToolCall[]): WorkersAiToolCall[] {
  return calls.map((call, index) => ({
    ...call,
    id: call.id ?? `call_${call.name}_${index}`,
  }));
}

function agentMessageToApi(msg: AgentChatMessage, modelId: string): Record<string, unknown> {
  if (msg.role === "tool") {
    if (usesOpenAiFunctionToolFormat(modelId)) {
      return {
        role: "tool",
        tool_call_id: msg.tool_call_id ?? `call_${msg.name}`,
        content: msg.content,
      };
    }
    return { role: "tool", name: msg.name, content: msg.content };
  }
  const out: Record<string, unknown> = { role: msg.role, content: msg.content };
  if (msg.role === "assistant" && msg.tool_calls?.length) {
    if (usesOpenAiFunctionToolFormat(modelId)) {
      out.tool_calls = msg.tool_calls.map((tc, index) => ({
        id: tc.id ?? `call_${tc.name}_${index}`,
        type: "function",
        function: {
          name: tc.name,
          arguments: JSON.stringify(tc.arguments),
        },
      }));
    } else {
      out.tool_calls = msg.tool_calls.map((tc) => ({
        name: tc.name,
        arguments: tc.arguments,
      }));
    }
  }
  return out;
}

/** Map agent tool loop messages to Gemini contents (functionCall / functionResponse). */
export function agentMessagesToGeminiContents(
  messages: AgentChatMessage[]
): { role: string; parts: Record<string, unknown>[] }[] {
  const contents: { role: string; parts: Record<string, unknown>[] }[] = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      contents.push({
        role: "user",
        parts: [{ text: `Instructions:\n${msg.content}` }],
      });
      continue;
    }

    if (msg.role === "user") {
      contents.push({
        role: "user",
        parts: [{ text: msg.content }],
      });
      continue;
    }

    if (msg.role === "assistant") {
      const parts: Record<string, unknown>[] = [];
      if (msg.content.trim()) {
        parts.push({ text: msg.content });
      }
      if (msg.tool_calls?.length) {
        for (const tc of msg.tool_calls) {
          parts.push({
            functionCall: {
              name: tc.name,
              args: tc.arguments,
            },
          });
        }
      }
      if (parts.length > 0) {
        contents.push({ role: "model", parts });
      }
      continue;
    }

    if (msg.role === "tool") {
      let responsePayload: unknown = { output: msg.content };
      try {
        responsePayload = JSON.parse(msg.content) as unknown;
      } catch {
        /* keep text wrapper */
      }
      contents.push({
        role: "user",
        parts: [
          {
            functionResponse: {
              name: msg.name,
              response: responsePayload,
            },
          },
        ],
      });
    }
  }

  return contents;
}

function buildAgentModelRunInput(
  modelId: string,
  messages: AgentChatMessage[],
  tools: FlatToolDefinition[],
  max_tokens: number,
  temperature: number,
  stream = false,
  thinkingPhase: GemmaThinkingPhase = "tool"
): Record<string, unknown> {
  const formattedTools = formatToolsForModel(modelId, tools);

  if (isGooglePartnerModelId(modelId)) {
    const input: Record<string, unknown> = {
      contents: agentMessagesToGeminiContents(messages),
      generationConfig: {
        maxOutputTokens: max_tokens,
        temperature,
      },
    };
    if (formattedTools.length > 0) input.tools = formattedTools;
    if (stream) input.stream = true;
    return input;
  }
  const input: Record<string, unknown> = {
    messages: messages.map((m) => agentMessageToApi(m, modelId)),
    max_tokens,
    temperature,
  };
  if (formattedTools.length > 0) input.tools = formattedTools;
  if (isGemmaThinkingCapableModel(modelId)) {
    input.chat_template_kwargs = resolveGemmaThinkingOptions(thinkingPhase);
  }
  if (stream) input.stream = true;
  return input;
}

export const AGENT_SYNTHESIS_NUDGE =
  "Write your complete final answer for the student now using the tool results above. You must always respond with a helpful answer — never leave the reply empty. Copy dates only from official calendar rows in tool output. If the user used a short name or abbreviation, map it to the closest official activity name from CLOSEST MATCHES or the calendar list before answering. If no exact row fits, name the nearest official candidates, state what is uncertain, and still answer the question as directly as the tool evidence allows. If tool data is missing, say so clearly and offer related context or general UiTM student guidance.";

function appendAgentSynthesisNudge(
  messages: AgentChatMessage[],
  nudge: string
): AgentChatMessage[] {
  if (!nudge.trim()) return messages;
  return [...messages, { role: "user", content: nudge }];
}

async function runAgentCompletionWithOptionalStream(params: {
  ai: Ai;
  modelId: string;
  messages: AgentChatMessage[];
  maxTokens: number;
  temperature: number;
  correlationId?: string;
  onToken?: (token: string) => void | Promise<void>;
  onReasoningToken?: (token: string) => void | Promise<void>;
  emitTokens?: boolean;
  synthesisNudge?: string;
}): Promise<string> {
  const {
    ai,
    modelId,
    messages,
    maxTokens,
    temperature,
    correlationId,
    onToken,
    onReasoningToken,
    emitTokens,
    synthesisNudge = AGENT_SYNTHESIS_NUDGE,
  } = params;
  const synthesisMessages = appendAgentSynthesisNudge(messages, synthesisNudge);

  // Single-path synthesis: stream first; only fall back to a buffered call when
  // streaming itself throws. An empty (but successful) stream is treated as a
  // hard error so we don't silently chain into a second inference + legacy fallback.
  try {
    const streamInput = buildAgentModelRunInput(
      modelId,
      synthesisMessages,
      [],
      maxTokens,
      temperature,
      true,
      "answer"
    );
    const streamResult = await runAiWithGateway(ai, modelId, streamInput, {
      skipCache: false,
      cacheTtl: 120,
      metadata: buildChatGatewayMetadata(correlationId),
    });
    const stream = iterateAiStreamParts(streamResult);
    let full = "";
    for await (const parts of stream) {
      if (parts.reasoning && onReasoningToken) await onReasoningToken(parts.reasoning);
      if (parts.content) {
        full += parts.content;
        if (emitTokens && onToken) await onToken(parts.content);
      }
    }
    if (full.trim()) return full.trim();
    throw new Error("Empty response from model");
  } catch (streamError) {
    if (
      streamError instanceof Error &&
      streamError.message === "Empty response from model"
    ) {
      throw streamError;
    }
    /* streaming threw — retry once as a buffered (non-stream) completion */
  }

  const input = buildAgentModelRunInput(
    modelId,
    synthesisMessages,
    [],
    maxTokens,
    temperature,
    false,
    "answer"
  );
  const result = await runAiWithGateway(ai, modelId, input, {
    skipCache: false,
    cacheTtl: 120,
    metadata: buildChatGatewayMetadata(correlationId),
  });
  const full = tryExtractWorkersAiContent(result);
  if (full?.trim()) {
    if (emitTokens && onToken) await onToken(full);
    return full;
  }
  throw new Error("Empty response from model");
}

export interface RunWorkersAiAgentParams {
  userMessage: string;
  systemPrompt: string;
  history?: ChatMessage[];
  preloadMessages?: AgentChatMessage[];
  /** Trailing scoped user message after the user turn (language lock). */
  languageLockMessage?: string;
  tools: FlatToolDefinition[];
  modelId?: string | null;
  correlationId?: string;
  maxTokens: number;
  temperature: number;
  maxToolSteps: number;
  executeTool: (name: string, args: Record<string, unknown>) => Promise<string>;
  onToken?: (token: string) => void | Promise<void>;
  onReasoningToken?: (token: string) => void | Promise<void>;
  emitTokensToClient?: boolean;
  /** Notified at the start of each tool step so callers can emit progress. */
  onToolStep?: (step: number, maxSteps: number) => void | Promise<void>;
  /** Notified when a tool call is selected for execution. */
  onToolCall?: (toolName: string) => void | Promise<void>;
  /** Notified when synthesis (final answer generation) begins. */
  onSynthesis?: () => void | Promise<void>;
}

/** Tool-call steps only need room for JSON; keep answer budget for synthesis. */
const AGENT_TOOL_STEP_MAX_TOKENS = 1024;

/** Tool-calling agent loop; uses the first FC-capable model in the host chain. */
export async function runWorkersAiAgent(params: RunWorkersAiAgentParams): Promise<string> {
  const ai = await getAiBinding();
  if (!ai) {
    const err = new Error(
      "Workers AI binding not available. Add an AI binding named AI in Cloudflare Pages, or run pnpm preview locally."
    );
    Object.assign(err, { status: 503 });
    throw err;
  }

  const modelId = resolveChatModel(params.modelId);

  if (!supportsFunctionCalling(modelId)) {
    throw new Error("No function-calling model available for this turn");
  }

  const limits = getChatLimits();
  const emitTokens = params.emitTokensToClient ?? shouldStreamTokensToClient();
  const toolMaxTokens = Math.min(AGENT_TOOL_STEP_MAX_TOKENS, params.maxTokens);

  const workingMessages: AgentChatMessage[] = [
    {
      role: "system",
      content: truncate(params.systemPrompt, limits.maxSystemChars),
    },
  ];

  if (params.history?.length) {
    const recent = trimHistoryForModel(params.history, {
      maxMessages: Math.min(4, limits.maxHistoryMessages),
    });
    for (const msg of recent) {
      workingMessages.push({
        role: msg.role,
        content: truncate(msg.content, limits.maxMessageChars),
      });
    }
  }

  if (params.preloadMessages?.length) {
    workingMessages.push(...params.preloadMessages);
  }

  workingMessages.push({
    role: "user",
    content: truncate(params.userMessage, limits.maxUserPromptChars),
  });

  if (params.languageLockMessage?.trim()) {
    workingMessages.push({
      role: "user",
      content: truncate(params.languageLockMessage.trim(), limits.maxUserPromptChars),
    });
  }

  let lastAssistantContent: string | null = null;
  for (let step = 0; step < params.maxToolSteps; step++) {
    if (params.onToolStep) await params.onToolStep(step, params.maxToolSteps);
    const input = buildAgentModelRunInput(
      modelId,
      workingMessages,
      params.tools,
      toolMaxTokens,
      params.temperature,
      false,
      "tool"
    );
    const result = await runAiWithGateway(ai, modelId, input, {
      skipCache: true,
      metadata: buildChatGatewayMetadata(params.correlationId),
    });

    const stepReasoning = tryExtractWorkersAiReasoning(result);
    if (stepReasoning && params.onReasoningToken) {
      await params.onReasoningToken(stepReasoning);
    }

    const toolCalls = ensureToolCallIds(extractToolCalls(result));
    if (toolCalls.length === 0) {
      const content = extractWorkersAiContentFromObject(result, {
        allowReasoningFallback: false,
      });
      if (content?.trim()) {
        if (emitTokens && params.onToken) await params.onToken(content);
        return content;
      }
      break;
    }
    // Capture any content emitted alongside tool calls — if the loop exhausts
    // maxToolSteps, this lets us return a meaningful answer without a 6th
    // synthesis call (faster, more consistent).
    const stepContent = extractWorkersAiContentFromObject(result, {
      allowReasoningFallback: false,
    });
    if (stepContent?.trim()) lastAssistantContent = stepContent;
    workingMessages.push({
      role: "assistant",
      content: stepContent ?? "",
      tool_calls: toolCalls,
    });
    for (const call of toolCalls) {
      if (params.onToolCall) await params.onToolCall(call.name);
    }
    const toolResults = await Promise.all(
      toolCalls.map(async (call) => ({
        call,
        content: await params.executeTool(call.name, call.arguments),
      }))
    );
    for (const { call, content } of toolResults) {
      workingMessages.push({
        role: "tool",
        name: call.name,
        tool_call_id: call.id,
        content,
      });
    }
  }

  // The tool budget is exhausted but the last step already produced a usable
  // answer — return it directly instead of paying for an extra synthesis call.
  if (lastAssistantContent && lastAssistantContent.trim()) {
    if (emitTokens && params.onToken) await params.onToken(lastAssistantContent);
    return lastAssistantContent;
  }

  if (params.onSynthesis) await params.onSynthesis();
  return runAgentCompletionWithOptionalStream({
    ai,
    modelId,
    messages: workingMessages,
    maxTokens: params.maxTokens,
    temperature: params.temperature,
    correlationId: params.correlationId,
    onToken: params.onToken,
    onReasoningToken: params.onReasoningToken,
    emitTokens,
  });
}
