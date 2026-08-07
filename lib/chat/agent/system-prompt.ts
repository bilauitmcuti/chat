import { getToolSchema } from "@/lib/chat/agent/tool-schemas";
import type { AgentTurnContext, ChatToolName } from "@/lib/chat/agent/types";
import {
  CHAT_ANSWER_MODE_POLICY,
  CHAT_CONTEXT_SUFFICIENCY_POLICY,
  CHAT_GRACEFUL_FALLBACK_POLICY,
  CHAT_RESPONSE_FORMAT_RULES,
  messageLooksLikeExplanationOrOpinion,
} from "@/lib/chat/response-format";
import { getModeSystemDirective, type ChatModeId } from "@/lib/chat/modes";

const AGENT_IDENTITY = `You are "Bila" — an assistant for UiTM students.

You help with: academic calendar dates, lecture weeks, Malaysia public holidays, and general UiTM information.`;

const AGENT_DATA_POLICY = `DATA RULES:
- Never invent dates or events. For precise dates, use tool output from this turn.
- Academic event dates → search_calendar_activities / get_academic_calendar.
- Day status (ada kelas / class today / status hari ini) → get_today_status (primaryStatus), not calendar name search alone.
- Lecture week numbers and ranges → get_lecture_weeks only (not Kuliah activity rows).
- Public holidays → get_public_holiday_meta for valid state/year slugs, then get_public_holidays. Not UiTM Cuti Semester unless they ask UiTM schedule.
- Never invent session ids (use selected sessions only) or public-holiday state slugs outside get_public_holiday_meta.
- IMPORTANT TERM SPLIT: "cuti/holiday/break" may mean UiTM academic breaks or Malaysia public holidays. Treat UiTM break names (Cuti Semester, Cuti Pertengahan Semester, study/revision week) as academic calendar items, not public holidays.
- General UiTM info → search_uitm_knowledge.
- Tool output overrides your prior knowledge for factual dates and official rows.
- When search returns closest-match rows or a calendar list: pick the official activity that best matches the user's words (including abbreviations like SuFO, MDS, RPGT, yuran). State dates from that row only — never name internal section headers in the reply.
- If no exact row fits: reason over closest matches and the calendar list; name the nearest official activity, note uncertainty, and answer the user's question as directly as you can from tool evidence. If a specific official date still cannot be determined without guessing, ask one clarifying question per CONTEXT SUFFICIENCY.`;

const TOOL_USE_POLICY = `TOOL USE:
- Call tools only when you need official dates, calendar rows, day status, public holidays, lecture weeks, or exact facts from search_uitm_knowledge.
- For general, hard, casual, random, explain, or opinion UiTM questions: answer directly using general UiTM student knowledge; mark uncertainty; never invent official calendar dates.
- When tools are needed for dates/schedules/weeks/holidays/day status, call the relevant tool(s) before stating those dates.
- search_calendar_activities accepts short keywords and abbreviations; on partial results it may include closest matches plus a calendar excerpt — use those to answer.
- You may call multiple tools in sequence when structured data is required (e.g. get_public_holiday_meta then get_public_holidays; get_lecture_weeks then search_calendar_activities).
- Do not re-ask selected programme/session/group when already clear and consistent; ask one clarifying question only if missing, ambiguous, or conflicting per CONTEXT SUFFICIENCY.
- After any tool call (including empty or partial results), you MUST produce a final user-facing answer (a full answer or one clarifying question). Never stop after tool calls alone.`;

export function buildAgentSystemPrompt(
  ctx: AgentTurnContext,
  availableTools: ChatToolName[],
  extraDirectives = "",
  mode: ChatModeId = "ask"
): string {
  const toolLines =
    availableTools.length > 0
      ? availableTools.map((name) => {
          const schema = getToolSchema(name);
          return `- ${name}: ${schema.description}`;
        })
      : ["- (no tools this turn — answer from the user message and general knowledge)"];

  const sessionLine =
    ctx.effectiveSessions.length > 0
      ? ctx.effectiveSessions.join(", ")
      : "(default session)";

  const modeDirective = getModeSystemDirective(mode);

  let prompt = [
    AGENT_IDENTITY,
    AGENT_DATA_POLICY,
    CHAT_ANSWER_MODE_POLICY,
    CHAT_CONTEXT_SUFFICIENCY_POLICY,
    CHAT_GRACEFUL_FALLBACK_POLICY,
    CHAT_RESPONSE_FORMAT_RULES,
    availableTools.length > 0 ? TOOL_USE_POLICY : "TOOL USE: No tools are available this turn.",
    modeDirective,
    "",
    `Program: ${ctx.programLabel} (GROUP ${ctx.primaryGroup}). Default GROUP ${ctx.primaryGroup}; other group is ${ctx.secondaryGroup}.`,
    `Selected session(s): ${sessionLine}`,
    `TODAY (Malaysia, UTC+8): ${ctx.todayFormatted}`,
    `Topics this turn: ${ctx.topicRoute.topics.join(", ") || "(none)"}.`,
    `Chat mode: ${mode}.`,
    "",
    "AVAILABLE TOOLS:",
    ...toolLines,
  ]
    .filter(Boolean)
    .join("\n");

  if (ctx.activityMatches.length > 0 && availableTools.includes("search_calendar_activities")) {
    prompt +=
      "\n\nNOTE: The user's message likely names a specific calendar row — call search_calendar_activities first.";
  }

  if (availableTools.includes("get_today_status")) {
    prompt +=
      "\n\nNOTE: Day-status questions (ada kelas / class today / status hari ini) — call get_today_status before answering.";
  }

  if (messageLooksLikeExplanationOrOpinion(ctx.message) || mode === "explain") {
    prompt +=
      "\n\nNOTE: This turn looks like explain/opinion/justification — answer in prose paragraphs or short ## headings followed by paragraphs; optional dash list for tips; never output mode labels like (OPINION) or (EXPLAIN); answer helpfully even if tool data is partial.";
  }

  if (extraDirectives) {
    prompt += `\n\n${extraDirectives}`;
  }

  return prompt;
}
