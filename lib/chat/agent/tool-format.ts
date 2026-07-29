import type { WorkersAiToolSchema } from "@/lib/chat/agent/types";

export interface FlatToolDefinition {
  name: string;
  description: string;
  parameters: WorkersAiToolSchema["parameters"];
}

/** Gemma 4 / OpenAI-compatible chat completions expect nested `function` tools. */
export function usesOpenAiFunctionToolFormat(modelId: string): boolean {
  return modelId.includes("gemma-4") || modelId.includes("gemma-3");
}

export function isGooglePartnerModelId(modelId: string): boolean {
  return modelId.startsWith("google/");
}

export function formatToolsForModel(
  modelId: string,
  tools: FlatToolDefinition[]
): unknown[] {
  if (tools.length === 0) return [];

  if (usesOpenAiFunctionToolFormat(modelId)) {
    return tools.map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));
  }

  if (isGooglePartnerModelId(modelId)) {
    return [
      {
        functionDeclarations: tools.map((t) => ({
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        })),
      },
    ];
  }

  // Workers AI traditional (flat) tool schema
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  }));
}
