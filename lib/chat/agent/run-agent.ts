import {
  resolveChatModel,
  runWorkersAiAgent,
  supportsFunctionCalling,
  type ChatMessage,
} from "@/lib/ai";
import { formatMatchedActivitiesBlock } from "@/lib/chat/activity-match";
import { schemasForTools, toWorkersAiToolsParam } from "@/lib/chat/agent/tool-schemas";
import { buildToolRegistryForTurn } from "@/lib/chat/agent/tool-registry";
import { buildAgentSystemPrompt } from "@/lib/chat/agent/system-prompt";
import { buildEmbeddedChatTools } from "@/lib/chat/agent/embedded-tools";
import type { AgentRunResult, AgentTurnContext, ChatToolName } from "@/lib/chat/agent/types";
import { MAX_AGENT_TOOL_STEPS } from "@/lib/chat/agent/types";
import { DEFAULT_CHAT_MODE, type ChatModeId } from "@/lib/chat/modes";

/** Global kill-switch only — FC models use agent path when not disabled. */
export function isChatAgentEnabled(): boolean {
  const v = process.env.CHAT_USE_AGENT;
  if (v === "0" || v === "false") return false;
  return true;
}

export function agentModeForModelId(modelId: string): "tools" | "compact" {
  if (supportsFunctionCalling(modelId)) return "tools";
  return "compact";
}

/** @deprecated Use agentModeForModelId with user-selected model id. */
export function agentModeForModelChain(modelChain: string[]): "tools" | "compact" {
  if (modelChain.some((id) => supportsFunctionCalling(id))) return "tools";
  return "compact";
}

export interface RunChatAgentOptions {
  userMessage: string;
  history: ChatMessage[] | undefined;
  ctx: AgentTurnContext;
  modelId?: string | null;
  mode?: ChatModeId;
  correlationId?: string;
  maxTokens: number;
  temperature: number;
  extraSystemDirectives?: string;
  /** Trailing LANGUAGE LOCK user message (language-control pipeline). */
  languageLockMessage?: string;
  onToken?: (token: string) => void | Promise<void>;
  onReasoningToken?: (token: string) => void | Promise<void>;
  emitTokensToClient?: boolean;
  onToolStep?: (step: number, maxSteps: number) => void | Promise<void>;
  onToolCall?: (toolName: string) => void | Promise<void>;
  onSynthesis?: () => void | Promise<void>;
}

export async function runChatAgent(options: RunChatAgentOptions): Promise<AgentRunResult> {
  const modelId = resolveChatModel(options.modelId);
  const agentMode = agentModeForModelId(modelId);
  const chatMode = options.mode ?? DEFAULT_CHAT_MODE;

  if (agentMode === "compact") {
    return {
      reply: "",
      toolsUsed: [],
      usedAgentLoop: false,
    };
  }

  let availableTools = buildToolRegistryForTurn(options.ctx, chatMode);
  let extraDirectives = options.extraSystemDirectives ?? "";
  const toolsUsed: string[] = [];

  if (options.ctx.activityMatches.length > 0) {
    const preloadedResult = formatMatchedActivitiesBlock(options.ctx.activityMatches);
    if (preloadedResult) {
      extraDirectives += `\n\n=== PRELOADED CALENDAR MATCH (authoritative — do not re-search same activity) ===\n${preloadedResult}`;
      availableTools = availableTools.filter((t) => t !== "search_calendar_activities");
    }
  }

  const schemas = schemasForTools(availableTools);
  const workersTools = toWorkersAiToolsParam(schemas);

  const systemPrompt = buildAgentSystemPrompt(
    options.ctx,
    availableTools,
    extraDirectives,
    chatMode
  );

  const embeddedTools = buildEmbeddedChatTools(options.ctx, availableTools);

  const reply = await runWorkersAiAgent({
    userMessage: options.userMessage,
    systemPrompt,
    history: options.history,
    languageLockMessage: options.languageLockMessage,
    tools: workersTools,
    modelId: options.modelId,
    correlationId: options.correlationId,
    maxTokens: options.maxTokens,
    temperature: options.temperature,
    maxToolSteps: MAX_AGENT_TOOL_STEPS,
    onToken: options.onToken,
    onReasoningToken: options.onReasoningToken,
    emitTokensToClient: options.emitTokensToClient,
    onToolStep: options.onToolStep,
    onToolCall: options.onToolCall,
    onSynthesis: options.onSynthesis,
    executeTool: async (name, args) => {
      const toolName = name as ChatToolName;
      const embedded = embeddedTools.find((t) => t.name === toolName);
      if (!embedded) {
        return `(tool ${name} is not available for this turn)`;
      }
      toolsUsed.push(toolName);
      return embedded.execute(args);
    },
  });

  return {
    reply,
    toolsUsed: [...new Set(toolsUsed)],
    usedAgentLoop: true,
  };
}
