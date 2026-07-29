import { getToolSchema } from "@/lib/chat/agent/tool-schemas";
import { executeChatTool } from "@/lib/chat/agent/tools/execute";
import type { AgentTurnContext, ChatToolName, WorkersAiToolSchema } from "@/lib/chat/agent/types";

/** Human-readable labels for SSE reasoning / status UI. */
export const CHAT_TOOL_STATUS_LABELS: Record<ChatToolName, string> = {
  search_calendar_activities: "Searching calendar activities…",
  get_academic_calendar: "Reading academic calendar…",
  get_upcoming_events: "Finding upcoming events…",
  get_session_timeline: "Loading session timeline…",
  get_lecture_weeks: "Looking up lecture weeks…",
  get_public_holidays: "Reading public holidays…",
  search_uitm_knowledge: "Searching UiTM knowledge…",
};

export function toolStatusLabel(toolName: string): string {
  const label = CHAT_TOOL_STATUS_LABELS[toolName as ChatToolName];
  return label ?? `Using ${toolName}…`;
}

/**
 * Embedded-style tool bindings (schema + local execute) aligned with
 * Cloudflare Workers AI function-calling docs — executed by our traditional
 * agent loop in lib/ai.ts rather than @cloudflare/ai-utils runWithTools.
 */
export interface EmbeddedChatTool {
  name: ChatToolName;
  description: string;
  parameters: WorkersAiToolSchema["parameters"];
  execute: (args: Record<string, unknown>) => Promise<string>;
}

export function buildEmbeddedChatTools(
  ctx: AgentTurnContext,
  availableTools: ChatToolName[]
): EmbeddedChatTool[] {
  return availableTools.map((name) => {
    const schema = getToolSchema(name);
    return {
      name: schema.name,
      description: schema.description,
      parameters: schema.parameters,
      execute: (args) => executeChatTool(name, args, ctx),
    };
  });
}
