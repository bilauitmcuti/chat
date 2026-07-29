import { buildToolRegistryForTurn } from "@/lib/chat/agent/tool-registry";
import { executeChatTool } from "@/lib/chat/agent/tools/execute";
import type { AgentTurnContext, ChatToolName } from "@/lib/chat/agent/types";

export interface DeterministicPrefetchResult {
  toolsUsed: ChatToolName[];
  outputBlock: string;
  failed: boolean;
}

/**
 * Run topic-router tools in parallel before a single-stream LLM call.
 * Replaces multi-step agent loops for typical student questions.
 */
export async function runDeterministicPrefetch(
  ctx: AgentTurnContext,
  onToolStart?: (toolName: ChatToolName) => void
): Promise<DeterministicPrefetchResult> {
  const tools = buildToolRegistryForTurn(ctx);
  const toolsUsed: ChatToolName[] = [];
  let failed = false;

  const results = await Promise.all(
    tools.map(async (toolName) => {
      onToolStart?.(toolName);
      try {
        const output = await executeChatTool(toolName, {}, ctx);
        if (output.trim()) toolsUsed.push(toolName);
        return { toolName, output };
      } catch {
        failed = true;
        return { toolName, output: "" };
      }
    })
  );

  const outputBlock = results
    .filter((r) => r.output.trim())
    .map((r) => `=== ${r.toolName} ===\n${r.output.trim()}`)
    .join("\n\n");

  return { toolsUsed, outputBlock, failed };
}
