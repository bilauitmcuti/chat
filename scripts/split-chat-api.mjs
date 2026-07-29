import fs from "fs";

const lines = fs.readFileSync("lib/chat/_route-full.ts", "utf8").split(/\r?\n/);

const intentStart = lines.findIndex((l) => l.includes("const CALENDAR_STRONG_KEYWORDS"));
const intentEnd = lines.findIndex((l) => l.includes("function getActivityDedupeKey"));
const contextStart = intentEnd;
const contextEnd = lines.findIndex((l) => l.includes("function cleanAiReply"));

const intentBody = lines
  .slice(intentStart, intentEnd)
  .join("\n")
  .replace(/^function /gm, "export function ")
  .replace(/^const TABLE_OUTPUT_RULE/gm, "export const TABLE_OUTPUT_RULE");

const contextBody = lines
  .slice(contextStart, contextEnd)
  .join("\n")
  .replace(/^function /gm, "export function ")
  .replace(/^const MAX_/gm, "export const MAX_");

const contextHeader = `import {
  getActivitiesForSession,
  getDefaultSessionForGroup,
  getGroupFromSession,
  getSessionOptions,
  type Activity,
  type SessionId,
} from "@/lib/data";
import { UITM_GENERAL_INFO } from "@/lib/uitm-info";
import { compilePrompt, getCachedSystemRules } from "@/lib/chat/system-rules";
import { TABLE_OUTPUT_RULE } from "@/lib/chat/intent";

`;

fs.writeFileSync("lib/chat/intent.ts", intentBody);
fs.writeFileSync("lib/chat/context.ts", contextHeader + contextBody.replace(/_systemRules/g, "getCachedSystemRules()"));
console.log("done", intentEnd - intentStart, contextEnd - contextStart);
