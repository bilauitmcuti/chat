import systemRulesBundled from "@/public/system-rules.json";

export interface SystemRulesJson {
  schemaVersion: number;
  calendarPromptCompact: string | string[];
  calendarPromptTemplate: string | string[];
  researchPrompt: string | string[];
}

const bundledRules = systemRulesBundled as SystemRulesJson;

let _systemRules: SystemRulesJson | null = bundledRules;

export async function getSystemRules(origin: string): Promise<SystemRulesJson> {
  if (_systemRules?.calendarPromptCompact) return _systemRules;
  try {
    const res = await fetch(`${origin}/system-rules.json`);
    if (res.ok) {
      _systemRules = (await res.json()) as SystemRulesJson;
      return _systemRules;
    }
  } catch {
    // fall through to embedded fallback
  }
  _systemRules = bundledRules;
  return _systemRules;
}

export function getCachedSystemRules(): SystemRulesJson {
  return _systemRules ?? bundledRules;
}

export function compilePrompt(sections: string | readonly string[]): string {
  return typeof sections === "string" ? sections : sections.join("\n\n");
}
