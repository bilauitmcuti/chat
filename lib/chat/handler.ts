import { NextRequest, NextResponse } from "next/server";
import {
  getAiBinding,
  getModelMaxOutputTokens,
  resolveChatModel,
  shouldStreamTokensToClient,
  type ChatMessage,
} from "@/lib/ai";
import {
  applyLanguageToTurn,
  buildLanguageRetryNudge,
  verifyReplyLanguage,
  type LanguageProfile,
} from "@/lib/chat/language";
import { normalizeAssistantTables } from "@/lib/format-ai-table";
import {
  ensureSessionsInStore,
  loadActivitiesIntoStoreForChat,
  loadMetaIntoStore,
  validSetsFromMeta,
} from "@/lib/chat-calendar-load";
import {
  getActivitiesForSession,
  getDefaultSessionForGroup,
  getGroupFromSession,
  getProgramOptions,
  type SessionId,
} from "@/lib/data";
import {
  addDatesFromContextText,
  collectAllowedDateTokens,
} from "@/lib/chat/allowed-dates";
import { mergeSessionsForLoad, resolveQueryScope } from "@/lib/chat/query-scope";
import { UITM_GENERAL_INFO } from "@/lib/uitm-info";
import {
  getClientIpForTurnstile,
  getTurnstileExpectedHostname,
  verifyTurnstileToken,
} from "@/lib/turnstile";
import { isTurnstileVerificationRequired } from "@/lib/turnstile-config";
import { jsonError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import {
  getModelResponseBudget,
  streamAiWithRetry,
  askAiWithRetry,
  askAgentWithRetry,
} from "@/lib/chat/ai-retry";
import { runDeterministicPrefetch } from "@/lib/chat/agent/deterministic-prefetch";
import {
  buildRetryStatusLine,
} from "@/lib/chat/reasoning-status";
import { CHAT_STREAM_PHASE } from "@/lib/chat/stream-phase";
import {
  buildReasoningComplexityInput,
  isComplexReasoningTurn,
} from "@/lib/chat/reasoning-gate";
import {
  agentModeForModelId,
  buildAgentTurnContext,
  buildCompactFallbackSystemPrompt,
  isChatAgentEnabled,
} from "@/lib/chat/agent";
import {
  buildComparisonContext,
  buildResearchSystemPrompt,
  buildSessionListContext,
  formatActivitiesAsContext,
  formatPrimaryCalendarContext,
  getActivitiesFromSessions,
  getFilteredActivitiesForSession,
  getFilteredGroupBActivities,
  MAX_PRIMARY_CONTEXT_CHARS,
  narrowActivitiesForSecondaryReference,
  resolveEffectiveSessions,
} from "@/lib/chat/context";
import { resolveCalendarContextIntent } from "@/lib/chat/calendar-intent";
import {
  buildDataContextForTurn,
  shouldUseCalendarIntentFilter,
  topicNeedsCalendarPrompt,
} from "@/lib/chat/build-data-context";
import {
  flattenActivitiesWithSession,
  matchActivitiesInMessage,
} from "@/lib/chat/activity-match";
import {
  buildChatAssistantSystemPrompt,
  usesResearchStylePrompt,
} from "@/lib/chat/chat-prompt";
import { routeChatTopics, type ChatTopic } from "@/lib/chat/topic-router";
import {
  mergeFollowUpTopics,
  resolveFollowUpTurn,
} from "@/lib/chat/follow-up-context";
import { buildPublicHolidayChatContext } from "@/lib/chat/public-holiday-context";
import {
  getCalendarUnderstandingDirective,
  getCompletionInstruction,
  getMinimalChitchatInstruction,
  isComparisonQuestion,
  isMinimalConversationalMessage,
  isSimpleCalendarQuestion,
  isTableFormatRequested,
  messageAsksDetail,
  messageNeedsListOrSchedule,
  needsSecondaryGroupContext,
  needsUitmKnowledgeSupplement,
} from "@/lib/chat/intent";
import {
  DATE_VALIDATION_RETRY_NUDGE,
  replyHasUnknownCalendarDates,
} from "@/lib/chat/reply-validation";
import {
  detectIncompleteReply,
  REPLY_COMPLETION_RETRY_NUDGE,
} from "@/lib/chat/reply-completion";
import {
  CHAT_TURNSTILE_COOKIE,
  CHAT_TURNSTILE_COOKIE_MAX_AGE_SECONDS,
  MAX_BODY_SIZE_BYTES,
  parseChatRequest,
} from "@/lib/chat/parse-request";
import { generateCorrelationId, getCachedReply, setCachedReply } from "@/lib/chat/response-cache";
import { cleanAiReply, sanitizeMessage } from "@/lib/chat/sanitize";
import { getSystemRules } from "@/lib/chat/system-rules";
import { getTodayISO, toPromptDate } from "@/lib/chat/dates";
import { encodeSseEvent, SSE_HEADERS } from "@/lib/chat/sse";
import { mapChatError } from "@/lib/chat/map-error";
import { trimHistoryForModel } from "@/lib/chat/history-for-model";
import {
  CHAT_EMPTY_REPLY_FALLBACK,
  CHAT_TIMEOUT_MESSAGE,
  isEmptyModelReplyError,
} from "@/lib/chat/user-messages";
import { getModeSystemDirective, resolveModeFromMessage } from "@/lib/chat/modes";

/** Soft deadline for single_stream turns (under Workers ~30s wall; I/O-bound AI). */
const CHAT_SERVER_DEADLINE_MS = 28_000;
/** Slightly longer budget for rare tool-agent turns. */
const CHAT_AGENT_DEADLINE_MS = 30_000;
/** Skip date/incomplete retries when the turn already consumed this much time. */
const RETRY_BUDGET_SKIP_MS = 24_000;

const AGENT_CALENDAR_TOOLS = new Set([
  "search_calendar_activities",
  "get_academic_calendar",
  "get_upcoming_events",
  "get_session_timeline",
  "get_lecture_weeks",
  "get_today_status",
  "get_public_holiday_meta",
  "get_public_holidays",
]);

function agentUsedCalendarTools(toolsUsed: string[]): boolean {
  return toolsUsed.some((tool) => AGENT_CALENDAR_TOOLS.has(tool));
}

export { replaceReasoningParagraph } from "@/lib/chat/reasoning-status";

export type ChatExecutionMode = "single_stream" | "agent";

export interface ChatExecutionModeInput {
  isAgentToolsPath: boolean;
  /** Matched activity or simple date Q — one LLM call, no tool loop. */
  preferSingleStream?: boolean;
}

/**
 * FC models may use the tool agent unless preferSingleStream short-circuits
 * (matched, simple, calendar-only, uitm_general, or unrouted topics).
 */
export function resolveChatExecutionMode(
  input: ChatExecutionModeInput
): ChatExecutionMode {
  if (!input.isAgentToolsPath) return "single_stream";
  if (input.preferSingleStream) return "single_stream";
  return "agent";
}

/** Soft deadline for a chat turn — same for every picker model. */
export function getChatTurnDeadlineMs(executionMode: ChatExecutionMode): number {
  return executionMode === "agent"
    ? CHAT_AGENT_DEADLINE_MS
    : CHAT_SERVER_DEADLINE_MS;
}

/**
 * Prefer one LLM call with deterministic prefetch.
 * Hard/random uitm_general and unrouted topics stay on single_stream so
 * non-Gemma models do not fail in the tool-agent loop.
 */
const CALENDAR_ONLY_TOPICS = new Set<ChatTopic>([
  "academic_calendar",
  "lecture_weeks",
  "public_holiday",
]);

function isCalendarOnlyTopics(topics: ChatTopic[]): boolean {
  return topics.length > 0 && topics.every((topic) => CALENDAR_ONLY_TOPICS.has(topic));
}

/**
 * Prefer one LLM call with deterministic prefetch for typical student questions.
 * Use the FC agent loop for complex multi-topic turns so the model can choose tools.
 */
export function shouldPreferSingleStream(input: {
  hasMatchedActivity: boolean;
  isSimple: boolean;
  topics: ChatTopic[];
  isComplexTurn: boolean;
}): boolean {
  if (input.hasMatchedActivity || input.isSimple) return true;
  if (input.topics.length === 0) return true;
  // uitm_general alone → prefetch / single stream
  if (input.topics.length === 1 && input.topics[0] === "uitm_general") return true;
  // Single calendar topic → prefetch (even if complex)
  if (isCalendarOnlyTopics(input.topics) && input.topics.length === 1) return true;
  // Complex or multi-topic → FC agent loop
  if (input.isComplexTurn || input.topics.length > 1) return false;
  if (isCalendarOnlyTopics(input.topics)) return true;
  return true;
}

async function runWithServerDeadline<T>(
  deadlineMs: number,
  task: () => Promise<T>
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutError = new Error(CHAT_TIMEOUT_MESSAGE);
  Object.assign(timeoutError, { status: 504 });
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(timeoutError), deadlineMs);
  });
  try {
    return await Promise.race([task(), deadline]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function jsonChatReply(
  reply: string,
  correlationId: string,
  path: "cache" | "llm"
): NextResponse {
  return NextResponse.json({ reply, correlationId, path });
}

export async function POST(request: NextRequest) {
  let correlationId = "unknown";
  let shouldSetVerifiedCookie = false;
  const withVerifiedCookie = (response: NextResponse): NextResponse => {
    if (!shouldSetVerifiedCookie) return response;
    response.cookies.set({
      name: CHAT_TURNSTILE_COOKIE,
      value: "1",
      maxAge: CHAT_TURNSTILE_COOKIE_MAX_AGE_SECONDS,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      httpOnly: false,
    });
    return response;
  };
  let chatModelId: string | undefined;
  try {
    const contentType = request.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      return jsonError("Content-Type must be application/json", 415);
    }

    const contentLength = request.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE_BYTES) {
      return jsonError("Request body too large", 413);
    }

    correlationId = generateCorrelationId();

    const rawBody = await request.json();

    const bodyStr = JSON.stringify(rawBody);
    if (bodyStr.length > MAX_BODY_SIZE_BYTES) {
      return jsonError("Request body too large", 413);
    }

    const requestHostname = request.headers.get("host") ?? "";
    const parseResult = parseChatRequest(rawBody, requestHostname);
    if (!parseResult.success) {
      return jsonError(parseResult.error, 400);
    }

    const {
      message,
      program,
      selectedSessions: rawSelectedSessions,
      history,
      turnstileToken,
      model: requestedModel,
      stream: wantStream,
    } = parseResult.data;
    const isTurnstileRequired = isTurnstileVerificationRequired();
    const hasVerifiedCookie =
      request.cookies.get(CHAT_TURNSTILE_COOKIE)?.value === "1";

    if (isTurnstileRequired && !hasVerifiedCookie) {
      if (!turnstileToken?.trim()) {
        return jsonError("Please complete verification first.", 403);
      }
      const turnstileResult = await verifyTurnstileToken({
        token: turnstileToken,
        expectedAction: "chat_message",
        expectedHostname: getTurnstileExpectedHostname(requestHostname),
        remoteip: getClientIpForTurnstile(request),
      });
      if (!turnstileResult.success) {
        return jsonError("Access was blocked. Please refresh and try again.", 403);
      }
      shouldSetVerifiedCookie = true;
    }

    chatModelId = resolveChatModel(requestedModel, requestHostname);
    const origin = new URL(request.url).origin;

    type StreamHooks = {
      enqueue: (text: string) => void;
      emitReasoningParagraph: (paragraph: string) => void;
      emitStatus: (phase: string, message: string) => void;
      onToken: (token: string) => void;
      onReasoningToken: (token: string) => void;
      onToolCall: (toolName: string) => void;
      onSynthesis: () => void;
      onRetry: (reason: string, statusMessage: string) => void;
    };

    const executeChatTurn = async (streamHooks?: StreamHooks): Promise<string> => {
    const modelId = chatModelId!;
    const turnStartMs = Date.now();
    const meta = await loadMetaIntoStore();
    const { validSessionIds, validPrograms } = validSetsFromMeta(meta);

    const selectedProgram =
      program && validPrograms.has(program) ? program : "All";
    const sanitizedMessage = sanitizeMessage(message);
    const chatMode = resolveModeFromMessage(sanitizedMessage);

    const programMeta = getProgramOptions().find((p) => p.value === selectedProgram);
    const programLabel = programMeta?.label || selectedProgram;
    const primaryGroup = (programMeta?.group || "B") as "A" | "B";
    const secondaryGroup = primaryGroup === "A" ? "B" : "A";

    const effectiveSessions = resolveEffectiveSessions(
      rawSelectedSessions,
      primaryGroup,
      validSessionIds
    );

    const todayISO = getTodayISO();
    const todayFormatted = toPromptDate(todayISO);

    const queryScope = resolveQueryScope(
      sanitizedMessage,
      primaryGroup,
      validSessionIds,
      todayISO
    );
    const loadSessions = mergeSessionsForLoad(
      effectiveSessions,
      queryScope,
      primaryGroup,
      getGroupFromSession
    );

    await loadActivitiesIntoStoreForChat(
      selectedProgram,
      primaryGroup,
      loadSessions
    );

    let contextSessionIds: SessionId[] = loadSessions;
    let primaryActivities = getActivitiesFromSessions(
      loadSessions,
      selectedProgram,
      primaryGroup
    );
    if (primaryActivities.length === 0) {
      const fallbackId =
        primaryGroup === "A"
          ? getDefaultSessionForGroup("A")
          : getDefaultSessionForGroup("B");
      contextSessionIds = [fallbackId];
      await ensureSessionsInStore(contextSessionIds, selectedProgram);
      primaryActivities =
        primaryGroup === "A"
          ? getActivitiesForSession(fallbackId)
          : getFilteredGroupBActivities(selectedProgram, [fallbackId]);
    }

    const contextIntent = resolveCalendarContextIntent(sanitizedMessage);

    const flatPool = flattenActivitiesWithSession(contextSessionIds, (sid) =>
      getFilteredActivitiesForSession(sid, selectedProgram, primaryGroup)
    );
    const activityMatches = matchActivitiesInMessage(sanitizedMessage, flatPool);
    const hasMatchedActivity = activityMatches.length > 0;

    const sanitizedHistory: ChatMessage[] = trimHistoryForModel(
      (history ?? []).map((msg) => ({
        role: msg.role,
        content:
          msg.role === "user" ? sanitizeMessage(msg.content) : msg.content,
      }))
    );

    const followUp = resolveFollowUpTurn({
      message: sanitizedMessage,
      history: sanitizedHistory,
    });
    const isMinimalTurn =
      isMinimalConversationalMessage(sanitizedMessage) &&
      !followUp.suppressMinimalTurn;

    let topicRoute = routeChatTopics(sanitizedMessage, hasMatchedActivity, {
      isMinimalTurn,
    });
    if (followUp.suppressMinimalTurn && followUp.carriedTopics.length > 0) {
      topicRoute = {
        topics: mergeFollowUpTopics(
          followUp.carriedTopics,
          sanitizedMessage,
          hasMatchedActivity
        ),
        hasNamedActivity: hasMatchedActivity,
      };
    }
    const effectiveQuery = followUp.effectiveQuery;
    const useIntentFilter = shouldUseCalendarIntentFilter(topicRoute, activityMatches.length);

    const useAgentPath = isChatAgentEnabled();
    const agentMode = useAgentPath ? agentModeForModelId(modelId) : "compact";
    const isAgentToolsPath = useAgentPath && agentMode === "tools";

    const multipleSessionsSelected = effectiveSessions.length > 1;
    const wantsTableOutput =
      (multipleSessionsSelected && isComparisonQuestion(sanitizedMessage)) ||
      isTableFormatRequested(sanitizedMessage);
    const isSimple = isSimpleCalendarQuestion(sanitizedMessage, { hasMatchedActivity });
    const asksDetail = messageAsksDetail(sanitizedMessage);
    const needsList = messageNeedsListOrSchedule(sanitizedMessage);
    const isComplexTurn =
      !isMinimalTurn &&
      isComplexReasoningTurn(
        buildReasoningComplexityInput({
          isSimple,
          wantsTableOutput,
          multipleSessionsSelected,
          asksDetail,
          needsList,
          topics: topicRoute.topics,
        })
      );
    const executionMode = resolveChatExecutionMode({
      isAgentToolsPath,
      preferSingleStream: shouldPreferSingleStream({
        hasMatchedActivity,
        isSimple,
        topics: topicRoute.topics,
        isComplexTurn,
      }),
    });
    const useAgentTools = executionMode === "agent";

    /** Status-only retry UX — no reasoning paragraphs or extra LLM calls. */
    const emitStreamRetry = (retryReason: "dates" | "incomplete" | "language") => {
      if (!streamHooks) return;
      const statusMessage = buildRetryStatusLine({
        message: sanitizedMessage,
        topics: topicRoute.topics,
        sessionCount: effectiveSessions.length,
        hasMatchedActivity,
        retryReason,
      });
      streamHooks.onRetry(retryReason, statusMessage);
    };

    const cacheKey = [
      modelId,
      `mode:${chatMode}`,
      useAgentPath ? `agent:${agentMode}` : "legacy",
      executionMode,
      isComplexTurn ? "complex" : "simple",
      todayISO,
      selectedProgram,
      effectiveSessions.join(","),
      topicRoute.topics.join("+"),
      hasMatchedActivity ? "matched" : "nomatch",
      wantsTableOutput ? "table" : "normal",
      sanitizedMessage,
      JSON.stringify(sanitizedHistory),
    ].join("||");

    const cachedReply = getCachedReply(cacheKey);
    if (cachedReply) {
      return cachedReply;
    }

    const aiBindingPromise = getAiBinding();

    const aiBinding = await aiBindingPromise;
    if (!aiBinding) {
      const noAi = mapChatError(
        Object.assign(new Error("Workers AI binding not available"), { status: 503 })
      );
      throw Object.assign(new Error(noAi.message), { status: noAi.status });
    }

    const useCalendarPrompt = topicNeedsCalendarPrompt(topicRoute.topics);
    const includeSecondary =
      useCalendarPrompt && needsSecondaryGroupContext(sanitizedMessage, primaryGroup);
    const includeUitmSupplement =
      topicRoute.topics.includes("uitm_general") ||
      needsUitmKnowledgeSupplement(sanitizedMessage);
    const maxPrimaryChars = MAX_PRIMARY_CONTEXT_CHARS;
    const useResearchOnly =
      usesResearchStylePrompt(topicRoute.topics) && !useCalendarPrompt;

    let dataContextFull = "";
    let publicHolidayDirective = "";
    let primaryContext = "";
    let secondaryContext = "";
    let sessionListContext = "";
    let comparisonContext = multipleSessionsSelected
      ? buildComparisonContext(effectiveSessions, selectedProgram, primaryGroup)
      : "";
    let systemPrompt = "";

    if (useAgentTools) {
      sessionListContext = buildSessionListContext(primaryGroup, effectiveSessions);

      if (topicRoute.topics.includes("public_holiday")) {
        const phCtx = await buildPublicHolidayChatContext(
          effectiveQuery,
          todayISO,
          { sessionIds: contextSessionIds }
        );
        publicHolidayDirective = phCtx.directive;
      }
    } else {
      const secondaryActivitiesRaw =
        primaryGroup === "A"
          ? getFilteredGroupBActivities(selectedProgram, [getDefaultSessionForGroup("B")])
          : getActivitiesForSession(getDefaultSessionForGroup("A"));
      const secondaryActivities = narrowActivitiesForSecondaryReference(secondaryActivitiesRaw);

      primaryContext = formatPrimaryCalendarContext(
        contextSessionIds,
        selectedProgram,
        primaryGroup,
        contextIntent,
        { useIntentFilter }
      );
      secondaryContext = formatActivitiesAsContext(secondaryActivities);
      sessionListContext = buildSessionListContext(primaryGroup, effectiveSessions);

      const [dataCtx] = await Promise.all([
        buildDataContextForTurn({
          message: effectiveQuery,
          todayISO,
          route: topicRoute,
          contextSessionIds,
          primaryGroup,
          program: selectedProgram,
          queryScope,
          effectiveSessions,
          primaryActivities,
          contextIntent,
          useIntentFilter,
        }),
        getSystemRules(origin),
      ]);

      publicHolidayDirective = dataCtx.publicHolidayDirective;
      dataContextFull = dataCtx.dataContext;
      if (comparisonContext) {
        dataContextFull = dataContextFull
          ? `${dataContextFull}\n\n=== SESSION COMPARISON ===\n${comparisonContext}`
          : comparisonContext;
      }

      const buildLegacyContextSystemPrompt = () =>
        useResearchOnly
          ? buildResearchSystemPrompt(todayFormatted) +
            (dataContextFull ? `\n\n${dataContextFull}` : "")
          : buildChatAssistantSystemPrompt({
              programLabel,
              primaryGroup,
              secondaryGroup,
              todayFormatted,
              sessionListContext,
              primaryContext,
              secondaryContext: includeSecondary ? secondaryContext : "",
              dataContext: dataContextFull,
              topics: topicRoute.topics,
              selectedSessionCount: effectiveSessions.length,
              forceTableOutput: wantsTableOutput,
              multipleSessionsSelected,
              uitmSupplement: includeUitmSupplement ? UITM_GENERAL_INFO : "",
              includeSecondaryContext: includeSecondary,
              maxPrimaryChars,
            });

      if (useAgentPath) {
        systemPrompt = await buildCompactFallbackSystemPrompt({
          ctx: buildAgentTurnContext({
            message: sanitizedMessage,
            effectiveQuery,
            todayISO,
            todayFormatted,
            program: selectedProgram,
            programLabel,
            primaryGroup,
            secondaryGroup,
            effectiveSessions,
            contextSessionIds,
            topicRoute,
            activityMatches,
            queryScope,
            contextIntent,
            useIntentFilter,
            primaryActivities,
            sessionListContext,
            comparisonContext,
            includeSecondary,
          }),
          sessionListContext,
          secondaryContext,
          comparisonContext,
          includeSecondary,
          includeUitmSupplement,
          uitmSupplement: UITM_GENERAL_INFO,
          wantsTableOutput,
          multipleSessionsSelected,
          contextIntent,
          useIntentFilter,
          mode: chatMode,
        });
      } else {
        systemPrompt =
          buildLegacyContextSystemPrompt() + getModeSystemDirective(chatMode);
      }
    }

    const agentTurnContext = buildAgentTurnContext({
      message: sanitizedMessage,
      effectiveQuery,
      todayISO,
      todayFormatted,
      program: selectedProgram,
      programLabel,
      primaryGroup,
      secondaryGroup,
      effectiveSessions,
      contextSessionIds,
      topicRoute,
      activityMatches,
      queryScope,
      contextIntent,
      useIntentFilter,
      primaryActivities,
      sessionListContext,
      comparisonContext,
      includeSecondary,
    });

    let prefetchDirective = "";
    if (useAgentPath && !useAgentTools) {
      const prefetch = await runDeterministicPrefetch(
        agentTurnContext,
        () => {},
        chatMode
      );
      if (prefetch.outputBlock) {
        prefetchDirective = `\n\n=== PREFETCHED TOOL DATA (authoritative) ===\n${prefetch.outputBlock}`;
      }
    }

    const maxOutputTokens = getModelMaxOutputTokens(modelId);
    const modelBudget = isMinimalTurn
      ? {
          maxTokens: Math.min(512, maxOutputTokens),
          temperature: 0.35,
        }
      : getModelResponseBudget(
          sanitizedMessage,
          !useResearchOnly,
          wantsTableOutput,
          maxOutputTokens,
          { hasMatchedActivity }
        );
    // Language-control pipeline: profile + adapted history + trailing LANGUAGE LOCK
    // (scoped user message). Do not dump a long language directive into system prompt.
    const languageTurn = await applyLanguageToTurn({
      message: sanitizedMessage,
      history: sanitizedHistory,
      modelId,
      correlationId,
    });
    const languageProfile: LanguageProfile = languageTurn.profile;
    const modelHistory = languageTurn.history;
    const languageLockMessage = languageTurn.languageLockMessage;

    logger.info("Chat language profile", {
      correlationId,
      replyLanguage: languageProfile.replyLanguage,
      confidence: languageProfile.confidence,
      stickyFromHistory: languageProfile.stickyFromHistory,
      usedLlmClassify: languageProfile.usedLlmClassify,
    });

    const understandingDirective =
      !isMinimalTurn &&
      !useResearchOnly &&
      topicRoute.topics.includes("academic_calendar")
        ? getCalendarUnderstandingDirective(sanitizedMessage)
        : "";

    const completionSuffix = isMinimalTurn
      ? getMinimalChitchatInstruction()
      : getCompletionInstruction(isSimple, asksDetail, needsList, hasMatchedActivity) +
        understandingDirective +
        publicHolidayDirective;

    const systemPromptWithCompletion =
      systemPrompt + prefetchDirective + completionSuffix;

    let cachedLegacyFallbackBase: string | null = null;
    const getLegacyFallbackPromptWithCompletion = async (
      extraSuffix = ""
    ): Promise<string> => {
      if (!useAgentTools) return "";
      if (!cachedLegacyFallbackBase) {
        await getSystemRules(origin);
        const secondaryActivitiesRaw =
          primaryGroup === "A"
            ? getFilteredGroupBActivities(selectedProgram, [getDefaultSessionForGroup("B")])
            : getActivitiesForSession(getDefaultSessionForGroup("A"));
        const secondaryActivities =
          narrowActivitiesForSecondaryReference(secondaryActivitiesRaw);
        const fallbackPrimaryContext = formatPrimaryCalendarContext(
          contextSessionIds,
          selectedProgram,
          primaryGroup,
          contextIntent,
          { useIntentFilter }
        );
        const fallbackSecondaryContext = formatActivitiesAsContext(secondaryActivities);
        const fallbackSessionListContext = buildSessionListContext(
          primaryGroup,
          effectiveSessions
        );
        const { dataContext } = await buildDataContextForTurn({
          message: effectiveQuery,
          todayISO,
          route: topicRoute,
          contextSessionIds,
          primaryGroup,
          program: selectedProgram,
          queryScope,
          effectiveSessions,
          primaryActivities,
          contextIntent,
          useIntentFilter,
        });
        let fallbackDataContextFull = dataContext;
        if (comparisonContext) {
          fallbackDataContextFull = fallbackDataContextFull
            ? `${fallbackDataContextFull}\n\n=== SESSION COMPARISON ===\n${comparisonContext}`
            : comparisonContext;
        }
        cachedLegacyFallbackBase = useResearchOnly
          ? buildResearchSystemPrompt(todayFormatted) +
            (fallbackDataContextFull ? `\n\n${fallbackDataContextFull}` : "")
          : buildChatAssistantSystemPrompt({
              programLabel,
              primaryGroup,
              secondaryGroup,
              todayFormatted,
              sessionListContext: fallbackSessionListContext,
              primaryContext: fallbackPrimaryContext,
              secondaryContext: includeSecondary ? fallbackSecondaryContext : "",
              dataContext: fallbackDataContextFull,
              topics: topicRoute.topics,
              selectedSessionCount: effectiveSessions.length,
              forceTableOutput: wantsTableOutput,
              multipleSessionsSelected,
              uitmSupplement: includeUitmSupplement ? UITM_GENERAL_INFO : "",
              includeSecondaryContext: includeSecondary,
              maxPrimaryChars,
            });
      }
      return cachedLegacyFallbackBase + completionSuffix + extraSuffix;
    };

    const validationActivityPool = !useResearchOnly
      ? getActivitiesFromSessions(loadSessions, selectedProgram, primaryGroup)
      : [];
    const allowedDates = !useResearchOnly
      ? collectAllowedDateTokens(validationActivityPool)
      : new Set<string>();
    if (!useResearchOnly) {
      addDatesFromContextText(allowedDates, dataContextFull);
      addDatesFromContextText(allowedDates, primaryContext);
    }

    const streamTokensToClient = shouldStreamTokensToClient();

    const modelCallOpts = {
      modelId,
      correlationId,
      languageLockMessage,
    };

    const runPromptRetry = async (
      promptSuffix: string,
      onToken: (token: string) => void | Promise<void>,
      budget = modelBudget
    ): Promise<string> => {
      const prompt = systemPromptWithCompletion + promptSuffix;
      if (wantStream) {
        return streamAiWithRetry(
          sanitizedMessage,
          prompt,
          modelHistory,
          {
            ...budget,
            ...modelCallOpts,
            onToken,
            emitTokensToClient: streamTokensToClient,
          }
        );
      }
      return askAiWithRetry(sanitizedMessage, prompt, modelHistory, {
        ...budget,
        ...modelCallOpts,
      });
    };

    const runLegacyLlm = async (
      prompt: string,
      onToken: (token: string) => void | Promise<void>,
      budget = modelBudget
    ): Promise<string> => {
      if (wantStream) {
        return streamAiWithRetry(
          sanitizedMessage,
          prompt,
          modelHistory,
          {
            ...budget,
            ...modelCallOpts,
            onToken,
            emitTokensToClient: streamTokensToClient,
          }
        );
      }
      return askAiWithRetry(sanitizedMessage, prompt, modelHistory, {
        ...budget,
        ...modelCallOpts,
      });
    };

    const resolveAgentReplyWithFallback = async (
      agentReply: string,
      toolsUsed: string[],
      onToken: (token: string) => void | Promise<void>,
      extraSuffix = ""
    ): Promise<string> => {
      if (agentReply.trim()) return agentReply;
      const legacyPrompt = await getLegacyFallbackPromptWithCompletion(extraSuffix);
      if (legacyPrompt.trim()) {
        logger.warn("Chat agent empty reply, using legacy context fallback", {
          correlationId,
          toolsUsed,
        });
        const legacyReply = await runLegacyLlm(legacyPrompt, onToken);
        if (legacyReply.trim()) return legacyReply;
      }
      logger.warn("Chat agent empty reply, using friendly fallback message", {
        correlationId,
        toolsUsed,
      });
      await onToken(CHAT_EMPTY_REPLY_FALLBACK);
      return CHAT_EMPTY_REPLY_FALLBACK;
    };

    const ensureNonEmptyReply = async (
      reply: string,
      onToken: (token: string) => void | Promise<void>
    ): Promise<string> => {
      if (reply.trim()) return reply;
      if (!useAgentTools) {
        const legacyPrompt = await getLegacyFallbackPromptWithCompletion();
        if (legacyPrompt.trim()) {
          logger.warn("Chat empty reply, using legacy context fallback", {
            correlationId,
            executionMode,
          });
          try {
            const legacyReply = await runLegacyLlm(legacyPrompt, onToken);
            if (legacyReply.trim()) return legacyReply;
          } catch (legacyErr) {
            if (!isEmptyModelReplyError(legacyErr)) throw legacyErr;
          }
        }
      }
      logger.warn("Chat empty reply, using friendly fallback message", {
        correlationId,
        executionMode,
      });
      await onToken(CHAT_EMPTY_REPLY_FALLBACK);
      return CHAT_EMPTY_REPLY_FALLBACK;
    };

    const runLlm = async (
      onToken: (token: string) => void | Promise<void>,
      onProgress?: {
        onReasoningToken?: (token: string) => void | Promise<void>;
        onToolCall?: (toolName: string) => void | Promise<void>;
        onSynthesis?: () => void | Promise<void>;
        /** Clear client partial content before a regenerate. */
        onRetry?: (reason: string) => void | Promise<void>;
      }
    ): Promise<string> => {
      const turnStartMs = Date.now();
      let turnToolsUsed: string[] = [];
      let rawReply: string;
      try {
        if (useAgentTools) {
          const agentResult = await askAgentWithRetry({
            userMessage: sanitizedMessage,
            history: modelHistory,
            ctx: agentTurnContext,
            modelId: modelId,
            mode: chatMode,
            correlationId,
            maxTokens: modelBudget.maxTokens,
            temperature: modelBudget.temperature,
            extraSystemDirectives: systemPromptWithCompletion,
            languageLockMessage,
            onToken,
            onReasoningToken: onProgress?.onReasoningToken,
            emitTokensToClient: streamTokensToClient,
            onToolCall: onProgress?.onToolCall,
            onSynthesis: onProgress?.onSynthesis,
          });
          turnToolsUsed = agentResult.toolsUsed;
          logger.info("Chat agent reply", {
            correlationId,
            agentMode,
            executionMode,
            toolsUsed: agentResult.toolsUsed,
            durationMs: Date.now() - turnStartMs,
          });
          rawReply = await resolveAgentReplyWithFallback(
            agentResult.reply,
            agentResult.toolsUsed,
            onToken
          );
        } else if (wantStream) {
          rawReply = await streamAiWithRetry(
            sanitizedMessage,
            systemPromptWithCompletion,
            modelHistory,
            {
              ...modelBudget,
              ...modelCallOpts,
              onToken,
              onReasoningToken: onProgress?.onReasoningToken,
              emitTokensToClient: streamTokensToClient,
            }
          );
        } else {
          rawReply = await askAiWithRetry(
            sanitizedMessage,
            systemPromptWithCompletion,
            modelHistory,
            { ...modelBudget, ...modelCallOpts }
          );
        }

        rawReply = await ensureNonEmptyReply(rawReply, onToken);
      } catch (err) {
        if (!isEmptyModelReplyError(err)) throw err;
        logger.warn("Chat empty model error, recovering with fallback", {
          correlationId,
          executionMode,
        });
        rawReply = await ensureNonEmptyReply("", onToken);
      }

      if (
        Date.now() - turnStartMs < RETRY_BUDGET_SKIP_MS &&
        !useResearchOnly &&
        !hasMatchedActivity &&
        allowedDates.size > 0 &&
        !(useAgentTools && agentUsedCalendarTools(turnToolsUsed)) &&
        replyHasUnknownCalendarDates(rawReply, allowedDates)
      ) {
        await onProgress?.onRetry?.("dates");
        try {
          if (useAgentTools) {
            rawReply = await runPromptRetry(DATE_VALIDATION_RETRY_NUDGE, onToken);
          } else if (wantStream) {
            rawReply = await streamAiWithRetry(
              sanitizedMessage,
              systemPromptWithCompletion + DATE_VALIDATION_RETRY_NUDGE,
              modelHistory,
              {
                ...modelBudget,
                ...modelCallOpts,
                onToken,
                emitTokensToClient: streamTokensToClient,
              }
            );
          } else {
            rawReply = await askAiWithRetry(
              sanitizedMessage,
              systemPromptWithCompletion + DATE_VALIDATION_RETRY_NUDGE,
              modelHistory,
              { ...modelBudget, ...modelCallOpts }
            );
          }
          rawReply = await ensureNonEmptyReply(rawReply, onToken);
        } catch (err) {
          if (!isEmptyModelReplyError(err)) throw err;
          rawReply = await ensureNonEmptyReply(rawReply, onToken);
        }
      }

      let cleanedFirst = normalizeAssistantTables(cleanAiReply(rawReply));
      let retried: "incomplete" | "language" | undefined;
      const incomplete =
        Date.now() - turnStartMs < RETRY_BUDGET_SKIP_MS &&
        detectIncompleteReply(cleanedFirst, needsList || asksDetail);
      if (incomplete) {
        await onProgress?.onRetry?.("incomplete");
        const bumpedBudget = {
          ...modelBudget,
          maxTokens: maxOutputTokens,
        };
        try {
          let retryReply: string;
          if (useAgentTools) {
            retryReply = await runPromptRetry(
              REPLY_COMPLETION_RETRY_NUDGE,
              onToken,
              bumpedBudget
            );
          } else if (wantStream) {
            retryReply = await streamAiWithRetry(
              sanitizedMessage,
              systemPromptWithCompletion + REPLY_COMPLETION_RETRY_NUDGE,
              modelHistory,
              {
                ...bumpedBudget,
                ...modelCallOpts,
                onToken,
                emitTokensToClient: streamTokensToClient,
              }
            );
          } else {
            retryReply = await askAiWithRetry(
              sanitizedMessage,
              systemPromptWithCompletion + REPLY_COMPLETION_RETRY_NUDGE,
              modelHistory,
              { ...bumpedBudget, ...modelCallOpts }
            );
          }
          retryReply = await ensureNonEmptyReply(retryReply, onToken);
          const cleanedRetry = normalizeAssistantTables(cleanAiReply(retryReply));
          if (cleanedRetry.length >= cleanedFirst.length) {
            cleanedFirst = cleanedRetry;
            retried = "incomplete";
          }
        } catch (err) {
          if (!isEmptyModelReplyError(err)) throw err;
        }
      }

      const languageCheck = verifyReplyLanguage(cleanedFirst, languageProfile);
      if (
        !languageCheck.ok &&
        Date.now() - turnStartMs < RETRY_BUDGET_SKIP_MS &&
        cleanedFirst.trim()
      ) {
        await onProgress?.onRetry?.("language");
        const languageNudge = buildLanguageRetryNudge(languageProfile, languageCheck);
        try {
          let langRetry: string;
          if (useAgentTools) {
            langRetry = await runPromptRetry(languageNudge, onToken);
          } else if (wantStream) {
            langRetry = await streamAiWithRetry(
              sanitizedMessage,
              systemPromptWithCompletion + languageNudge,
              modelHistory,
              {
                ...modelBudget,
                ...modelCallOpts,
                onToken,
                emitTokensToClient: streamTokensToClient,
              }
            );
          } else {
            langRetry = await askAiWithRetry(
              sanitizedMessage,
              systemPromptWithCompletion + languageNudge,
              modelHistory,
              { ...modelBudget, ...modelCallOpts }
            );
          }
          langRetry = await ensureNonEmptyReply(langRetry, onToken);
          const cleanedLang = normalizeAssistantTables(cleanAiReply(langRetry));
          if (cleanedLang.trim()) {
            cleanedFirst = cleanedLang;
            retried = "language";
            logger.info("Chat language retry applied", {
              correlationId,
              reason: languageCheck.reason,
              replyLanguage: languageProfile.replyLanguage,
            });
          }
        } catch (err) {
          if (!isEmptyModelReplyError(err)) throw err;
        }
      }

      logger.info("Chat turn completed", {
        correlationId,
        executionMode,
        toolsUsed: turnToolsUsed,
        retried,
        durationMs: Date.now() - turnStartMs,
      });
      if (cleanedFirst.trim()) return cleanedFirst;
      await onToken(CHAT_EMPTY_REPLY_FALLBACK);
      return CHAT_EMPTY_REPLY_FALLBACK;
    };

    if (streamHooks) {
      const streamedReply = await runWithServerDeadline(
        getChatTurnDeadlineMs(executionMode),
        () =>
          runLlm((token) => {
            streamHooks.onToken(token);
          }, {
            onRetry: (reason) => {
              const retryReason =
                reason === "dates"
                  ? "dates"
                  : reason === "language"
                    ? "language"
                    : "incomplete";
              emitStreamRetry(retryReason);
            },
          })
      );

      setCachedReply(cacheKey, streamedReply);
      return streamedReply;
    }

    const bufferedReply = await runLlm(() => undefined);
    setCachedReply(cacheKey, bufferedReply);
    return bufferedReply;
    };

    if (wantStream) {
      const aiBinding = await getAiBinding();
      if (!aiBinding) {
        const noAi = mapChatError(
          Object.assign(new Error("Workers AI binding not available"), { status: 503 })
        );
        return withVerifiedCookie(jsonError(noAi.message, noAi.status));
      }

      const sseStream = new ReadableStream<Uint8Array>({
        async start(controller) {
          const encoder = new TextEncoder();
          const enqueue = (text: string) => controller.enqueue(encoder.encode(text));
          try {
            const emitStatus = (phase: string, statusMessage: string) => {
              enqueue(encodeSseEvent("status", { phase, message: statusMessage }));
            };
            const streamHooks: StreamHooks = {
              enqueue,
              emitReasoningParagraph: () => {},
              emitStatus,
              onToken: (token) => enqueue(encodeSseEvent("token", { token })),
              onReasoningToken: () => {},
              onToolCall: () => {},
              onSynthesis: () => {},
              onRetry: (reason, statusMessage) => {
                enqueue(
                  encodeSseEvent("reset", {
                    reason,
                    phase: CHAT_STREAM_PHASE.RETRY,
                    message: statusMessage,
                  })
                );
                enqueue(
                  encodeSseEvent("status", {
                    phase: CHAT_STREAM_PHASE.RETRY,
                    message: statusMessage,
                  })
                );
              },
            };

            const reply = await executeChatTurn(streamHooks);
            enqueue(
              encodeSseEvent("done", {
                reply,
                correlationId,
              })
            );
            controller.close();
          } catch (error) {
            const mapped = mapChatError(error);
            logger.error("Chat stream error", {
              correlationId,
              errMsg: mapped.message,
              status: mapped.status,
              cause: error instanceof Error ? error.message : String(error),
              model: chatModelId,
            });
            enqueue(encodeSseEvent("error", { error: mapped.message, status: mapped.status }));
            controller.close();
          }
        },
      });

      const response = new NextResponse(sseStream, { headers: SSE_HEADERS });
      return withVerifiedCookie(response);
    }

    const reply = await executeChatTurn();
    return withVerifiedCookie(jsonChatReply(reply, correlationId, "llm"));
  } catch (error: unknown) {
    if (error instanceof SyntaxError || (error instanceof Error && error.message?.includes("JSON"))) {
      return withVerifiedCookie(jsonError("Invalid JSON in request body", 400));
    }
    const mapped = mapChatError(error);
    const { getDefaultChatModel } = await import("@/lib/chat/models");
    logger.error("Chat API error", {
      correlationId,
      errMsg: mapped.message,
      status: mapped.status,
      cause: error instanceof Error ? error.message : String(error),
      model: chatModelId ?? getDefaultChatModel(),
    });
    return withVerifiedCookie(jsonError(mapped.message, mapped.status));
  }
}
