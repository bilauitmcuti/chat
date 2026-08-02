"use client";

import { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { useCalendarHydrationVersion } from "@/components/calendar-hydration-context";
import { getSnapshot, subscribe } from "@/lib/calendar-store";
import {
  formatGroupASessionTriggerLabel,
  formatSessionLabelWithId,
  getProgramOptions,
  getSessionOptionsForGroup,
  getGroupFromSession,
} from "@/lib/data";
import type { SessionId } from "@/lib/data";
import type { ProgramValue } from "@/lib/route-utils";
import {
  areSessionListsEqual,
  getGroupFromProgram,
  getSessionMemoryKey,
} from "@/lib/session-memory";
import { trackZarazEvent, ZARAZ_EVENTS } from "@/lib/zaraz";
import { useTurnstileSiteKeyFromContext } from "@/hooks/use-turnstile-site-key";
import type { TurnstileWidgetHandle } from "@/components/turnstile-widget";
import { ChatEmptyMobile } from "@/components/chat/chat-empty-mobile";
import { ChatComposer } from "@/components/chat/chat-composer";
import { ChatTranscript } from "@/components/chat/chat-transcript";
import { ModelShortcut } from "@/components/model-shortcut";
import { getRandomSuggestions } from "@/components/chat/suggestion-data";
import { DESKTOP_VIEWPORT_QUERY } from "@/lib/use-mobile-viewport";
import {
  ensureCalendarMeta,
  getCalendarMetaStatus,
  subscribeCalendarMetaStatus,
} from "@/lib/calendar-meta";

import {
  CHAT_TURNSTILE_COOKIE,
  CHAT_TIMEOUT_MESSAGE,
  CHAT_NETWORK_ERROR_MESSAGE,
  resolveChatErrorMessage,
  FETCH_TIMEOUT_MS,
  FETCH_HEADERS_TIMEOUT_MS,
  FETCH_STREAM_TIMEOUT_MS,
  RETRY_DELAYS_MS,
  escapeRegExp,
  getActiveMentionMatch,
  getChatErrorMessage,
  consumeChatStream,
  createRafMarkdownStreamPainter,
  MAX_CHAT_MESSAGE_LENGTH,
  parseChatResponse,
  prepareHistory,
  type ChatMessageItem,
  type ChatStreamingDraft,
  type MentionMatch,
} from "@/components/chat/chat-utils";
import { CHAT_VERIFICATION_REQUIRED_MESSAGE } from "@/lib/chat/user-messages";
import { captureThinkingMetadata } from "@/lib/chat/reasoning-gate";
import {
  DEFAULT_CHAT_MODEL,
  getChatModel,
  getVisibleChatModels,
  readStoredChatModel,
  supportsReasoningUi,
  writeStoredChatModel,
} from "@/lib/chat/models";
import { ASSISTANT_LIFECYCLE, CHAT_STREAM_PHASE } from "@/lib/chat/stream-phase";
import {
  getInitialChatSessions,
  isChatSelectionInSyncWithHomepage,
  persistChatProgramSessions,
  resolveHomepageChatHydration,
  resolveSessionsForProgram,
  type ProgramSessionMap,
} from "@/lib/chat/session-state";
type Message = ChatMessageItem;

interface PendingSend {
  text: string;
  assistantId: string;
  modelId: string;
  historyMessages: Message[];
}

function withThinkingMetadata(message: Message, now = Date.now()): Message {
  const meta = captureThinkingMetadata(message.timestamp, {
    now,
    hasReasoning: Boolean(message.reasoning?.trim()),
  });
  if (!meta.hadThinking) return message;
  return {
    ...message,
    hadThinking: true,
    thinkingDurationSec: message.thinkingDurationSec ?? meta.thinkingDurationSec,
  };
}

interface MentionItem {
  id: SessionId;
  label: string;
  text: string;
}

export default function ChatPage() {
  const hydrationServerVersion = useCalendarHydrationVersion();
  useSyncExternalStore(
    subscribe,
    () => getSnapshot().version,
    () => hydrationServerVersion
  );

  const pathname = usePathname();
  const showBackButton = pathname === "/chat" || pathname === "/chat/";
  const programOptions = getProgramOptions();
  const calendarDataVersion = getSnapshot().version;
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingDraft, setStreamingDraft] = useState<ChatStreamingDraft | null>(null);
  const [input, setInput] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileNonce, setTurnstileNonce] = useState(0);
  const [isTurnstileSessionVerified, setIsTurnstileSessionVerified] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  /** Mount Turnstile (and load api.js) only after composer focus or first send. */
  const [turnstileMounted, setTurnstileMounted] = useState(false);
  /** Optimistic send waiting for Turnstile execute() callback (deferred challenge / PAT). */
  const pendingSendRef = useRef<PendingSend | null>(null);
  const pendingExecuteRef = useRef(false);
  const turnstileCookieVerified = useSyncExternalStore(
    () => () => {},
    () =>
      document.cookie
        .split(";")
        .some((item) => item.trim().startsWith(`${CHAT_TURNSTILE_COOKIE}=1`)),
    () => false
  );
  const isTurnstileVerified = turnstileCookieVerified || isTurnstileSessionVerified;
  const [selectedProgram, setSelectedProgram] = useState<ProgramValue>("All");
  const [selectedSessions, setSelectedSessions] = useState<SessionId[]>(() =>
    getInitialChatSessions("All")
  );
  const [sessionsByProgram, setSessionsByProgram] = useState<ProgramSessionMap>(() => ({
    All: getInitialChatSessions("All"),
  }));
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState<string>(DEFAULT_CHAT_MODEL);
  const [chatModels, setChatModels] = useState(() =>
    typeof window !== "undefined"
      ? getVisibleChatModels(window.location.hostname)
      : getVisibleChatModels("chat.bilauitmcuti.com")
  );
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);
  const [headerVisible, setHeaderVisible] = useState(true);
  const keepDropdownOpenRef = useRef(false);
  const lastScrollTop = useRef(0);
  const selectionRef = useRef({
    program: selectedProgram,
    sessionsByProgram,
    selectedSessions,
  });
  selectionRef.current = {
    program: selectedProgram,
    sessionsByProgram,
    selectedSessions,
  };
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [reactions, setReactions] = useState<Record<string, "up" | "down" | null>>({});
  const [feedbackSent, setFeedbackSent] = useState<Record<string, boolean>>({});
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const currentGroup = getGroupFromProgram(selectedProgram);
  const suggestionGroup = useMemo((): "A" | "B" => {
    void calendarDataVersion;
    const opt = getProgramOptions().find((p) => p.value === selectedProgram);
    return opt?.group ?? getGroupFromProgram(selectedProgram);
  }, [selectedProgram, calendarDataVersion]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const lastSuggestionGroupRef = useRef<"A" | "B" | null>(null);
  const [isMentionOpen, setIsMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [activeMentionIndex, setActiveMentionIndex] = useState(0);
  const [mentionMatch, setMentionMatch] = useState<MentionMatch | null>(null);
  const [isMobileMentionPicker, setIsMobileMentionPicker] = useState(false);

  const { siteKey: turnstileSiteKey, isReady: isTurnstileConfigReady } =
    useTurnstileSiteKeyFromContext();
  const requiresTurnstile = Boolean(turnstileSiteKey) && !isTurnstileVerified;
  const waitForTurnstileConfig =
    process.env.NODE_ENV === "production" && !isTurnstileConfigReady;
  /**
   * Turnstile UI only after user intent (focus/send) so api.js is off the critical path.
   */
  const showTurnstileSlot =
    turnstileMounted &&
    (waitForTurnstileConfig || (Boolean(turnstileSiteKey) && !isTurnstileVerified));
  const showTurnstileChallenge =
    hasMounted &&
    turnstileMounted &&
    requiresTurnstile &&
    !turnstileToken.trim();

  useLayoutEffect(() => {
    setHasMounted(true);
  }, []);

  useLayoutEffect(() => {
    const host = window.location.hostname;
    setChatModels(getVisibleChatModels(host));
    const stored = readStoredChatModel(host);
    if (stored) setSelectedModelId(stored);
    else setSelectedModelId(DEFAULT_CHAT_MODEL);
  }, []);

  const handleModelSelect = useCallback((modelId: string) => {
    setSelectedModelId(modelId);
    writeStoredChatModel(modelId);
    setModelDropdownOpen(false);
  }, []);

  const selectedModelLabel = getChatModel(selectedModelId)?.name ?? "Gemma 4";

  const hydrateChatFromHomepageSources = useCallback(() => {
    const hydration = resolveHomepageChatHydration();
    if (!hydration) return;
    setSessionsByProgram(hydration.sessionsByProgram);
    setSelectedProgram(hydration.program);
    setSelectedSessions(hydration.selectedSessions);
  }, []);

  const [selectionReady, setSelectionReady] = useState(false);

  // Hydrate before paint; gate persist until the next render so defaults never wipe the cookie.
  useLayoutEffect(() => {
    hydrateChatFromHomepageSources();
    setSelectionReady(true);
  }, [hydrateChatFromHomepageSources]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      const fromHomepage = resolveHomepageChatHydration();
      if (!fromHomepage) return;
      // Apply only when homepage sources differ from live chat (e.g. other tab).
      if (isChatSelectionInSyncWithHomepage(selectionRef.current, fromHomepage)) {
        return;
      }
      setSessionsByProgram(fromHomepage.sessionsByProgram);
      setSelectedProgram(fromHomepage.program);
      setSelectedSessions(fromHomepage.selectedSessions);
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === "sessionIdsByProgram" || e.key === "selectedProgram") {
        hydrateChatFromHomepageSources();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("storage", onStorage);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("storage", onStorage);
    };
  }, [hydrateChatFromHomepageSources]);

  // Persist after hydrate has committed (selectionReady), keeping cookie ↔ homepage in sync.
  useLayoutEffect(() => {
    if (!selectionReady) return;
    persistChatProgramSessions({
      program: selectedProgram,
      sessionsByProgram,
      selectedSessions,
    });
  }, [selectionReady, selectedProgram, sessionsByProgram, selectedSessions]);

  // Sync selectedSessions when program changes using per-program memory.
  useEffect(() => {
    const dateStr =
      typeof window !== "undefined" ? new Date().toISOString().slice(0, 10) : "2026-03-15";
    setSelectedSessions((prev) => {
      const resolved = resolveSessionsForProgram(
        selectedProgram,
        [],
        sessionsByProgram,
        dateStr
      );
      return areSessionListsEqual(prev, resolved) ? prev : resolved;
    });
  }, [selectedProgram, sessionsByProgram]);

  // Fresh suggestion set on every refresh/reopen (shell stays mounted; only list text swaps).
  useLayoutEffect(() => {
    lastSuggestionGroupRef.current = suggestionGroup;
    setSuggestions(getRandomSuggestions(suggestionGroup, []));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only re-roll
  }, []);

  // Re-roll when program group changes after hydrate / user selection.
  useLayoutEffect(() => {
    if (lastSuggestionGroupRef.current === suggestionGroup) return;
    lastSuggestionGroupRef.current = suggestionGroup;
    setSuggestions(getRandomSuggestions(suggestionGroup, []));
  }, [suggestionGroup]);

  const [streamStatusPhrase, setStreamStatusPhrase] = useState("");
  // Skeleton only before suggestions exist — never swap real chips for skeleton during Turnstile wait.
  const suggestionsLoading = suggestions.length === 0;

  const startLoadingState = useCallback(() => {
    setStreamStatusPhrase("Thinking…");
  }, []);

  const handleSessionToggle = useCallback(
    (programValue: ProgramValue, sessionId: SessionId, group: "A" | "B") => {
      const dateStr =
        typeof window !== "undefined" ? new Date().toISOString().slice(0, 10) : "2026-03-15";
      setSelectedProgram(programValue);
      setSelectedSessions((prev) => {
        const baseSessions = resolveSessionsForProgram(
          programValue,
          [],
          sessionsByProgram,
          dateStr
        );
        const inGroup = baseSessions.filter((id) => id.startsWith(`${group}-`));
        const isSelected = inGroup.includes(sessionId);
        if (isSelected && inGroup.length > 1) {
          const next = inGroup.filter((id) => id !== sessionId);
          const sessionMemoryKey = getSessionMemoryKey(programValue);
          setSessionsByProgram((prevMap) => ({ ...prevMap, [sessionMemoryKey]: next }));
          return next;
        }
        if (!isSelected) {
          const next = [...inGroup, sessionId];
          const sessionMemoryKey = getSessionMemoryKey(programValue);
          setSessionsByProgram((prevMap) => ({ ...prevMap, [sessionMemoryKey]: next }));
          return next;
        }
        const sessionMemoryKey = getSessionMemoryKey(programValue);
        setSessionsByProgram((prevMap) => ({ ...prevMap, [sessionMemoryKey]: inGroup }));
        return inGroup;
      });
    },
    [sessionsByProgram]
  );

  const handleProgramSelect = useCallback((program: ProgramValue) => {
    const dateStr =
      typeof window !== "undefined" ? new Date().toISOString().slice(0, 10) : "2026-03-15";
    setSelectedProgram(program);
    const resolved = resolveSessionsForProgram(program, [], sessionsByProgram, dateStr);
    setSelectedSessions(resolved);
  }, [sessionsByProgram]);

  const currentProgramLabel = useMemo(() => {
    const opt = programOptions.find((p) => p.value === selectedProgram);
    return opt?.label ?? "All";
  }, [selectedProgram, programOptions]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);

  const requestComposerWarmup = useCallback(() => {
    void ensureCalendarMeta();
    if (!requiresTurnstile) return;
    setTurnstileMounted(true);
  }, [requiresTurnstile]);

  const handleProgramDropdownOpenChange = useCallback((open: boolean) => {
    if (open) void ensureCalendarMeta();
    setDropdownOpen(open);
  }, []);

  const handleTurnstileReady = useCallback(() => {
    if (!pendingExecuteRef.current) return;
    pendingExecuteRef.current = false;
    turnstileRef.current?.execute();
  }, []);

  const groupAOptions = useMemo(() => programOptions.filter(p => p.group === 'A'), [programOptions]);
  const groupBOptions = useMemo(() => programOptions.filter(p => p.group === 'B'), [programOptions]);
  const calendarMetaStatus = useSyncExternalStore(
    subscribeCalendarMetaStatus,
    getCalendarMetaStatus,
    () => "idle" as const
  );
  const programCataloguePending: "loading" | "unavailable" | null =
    groupAOptions.length === 0
      ? calendarMetaStatus === "error"
        ? "unavailable"
        : "loading"
      : null;
  const groupBProgramForSessions = groupBOptions.some((p) => p.value === selectedProgram)
    ? selectedProgram
    : ("All" as ProgramValue);
  const groupBSessionLabel = useMemo(() => {
    void calendarDataVersion;
    if (currentGroup === "A") return "";
    const labels = selectedSessions
      .filter((sessionId) => sessionId.startsWith("B-"))
      .map((sessionId) => {
        const session = getSessionOptionsForGroup("B").find((item) => item.id === sessionId);
        return session ? formatSessionLabelWithId(session) : sessionId;
      });
    if (labels.length === 0) return "Select sessions";
    if (labels.length === 1) return labels[0];
    return `${labels.length} Selected`;
  }, [currentGroup, selectedSessions, calendarDataVersion]);
  const allMentionTexts = useMemo(() => {
    void calendarDataVersion;
    const groupA = getSessionOptionsForGroup("A").map((session) => formatSessionLabelWithId(session));
    const groupB = getSessionOptionsForGroup("B").map((session) => formatSessionLabelWithId(session));
    return [...groupA, ...groupB].sort((left, right) => right.length - left.length);
  }, [calendarDataVersion]);

  const mentionHighlightPattern = useMemo(() => {
    if (allMentionTexts.length === 0) return null;
    const escaped = allMentionTexts.map((item) => escapeRegExp(item));
    return new RegExp(`(${escaped.join("|")})`, "g");
  }, [allMentionTexts]);
  const mentionItems = useMemo<MentionItem[]>(() => {
    void calendarDataVersion;
    const sessions = getSessionOptionsForGroup(currentGroup);
    const normalizedQuery = mentionQuery.trim().toLowerCase();
    const mapped = sessions.map((session) => ({
      id: session.id,
      label: session.label,
      text: formatSessionLabelWithId(session),
    }));
    if (!normalizedQuery) return mapped;
    return mapped.filter((item) => {
      const haystack = `${item.label} ${item.id} ${item.text}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [currentGroup, mentionQuery, calendarDataVersion]);

  // Auto-resize textarea to fit content up to max height
  const adjustTextareaHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 130)}px`;
  }, []);

  const handleMentionSelect = useCallback((item: MentionItem) => {
    const textarea = textareaRef.current;
    if (!textarea || !mentionMatch) return;
    const nextValue = `${input.slice(0, mentionMatch.start)}${item.text} ${input.slice(mentionMatch.end)}`;
    const nextCaret = mentionMatch.start + item.text.length + 1;
    setInput(nextValue);
    setIsMentionOpen(false);
    setMentionMatch(null);
    setMentionQuery("");
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(nextCaret, nextCaret);
      adjustTextareaHeight();
    }, 0);
  }, [input, mentionMatch, adjustTextareaHeight]);

  const lastUserMsgId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") return messages[i].id;
    }
    return null;
  }, [messages]);

  const showLoadingMarker = false;

  useEffect(() => {
    if (!isLoading) {
      setStreamStatusPhrase("");
    }
  }, [isLoading]);

  useEffect(() => {
    const hasStreamingContent = messages.some(
      (m) =>
        m.role === "assistant" &&
        m.isComplete === false &&
        m.content.trim().length > 0
    );
    const hasReasoning = messages.some(
      (m) =>
        m.role === "assistant" &&
        m.isComplete === false &&
        (m.reasoning?.trim().length ?? 0) > 0
    );
    if (hasStreamingContent || hasReasoning) {
      setStreamStatusPhrase("");
    }
  }, [messages]);

  useEffect(() => {
    adjustTextareaHeight();
  }, [input, adjustTextareaHeight]);

  const handleViewportScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      const el = event.currentTarget;
      const currentScrollTop = el.scrollTop;
      if (dropdownOpen) {
        setDropdownOpen(false);
        setActiveSubmenu(null);
      }
      if (currentScrollTop <= 10 || currentScrollTop < lastScrollTop.current) {
        setHeaderVisible(true);
      } else if (currentScrollTop > lastScrollTop.current) {
        setHeaderVisible(false);
      }
      lastScrollTop.current = currentScrollTop;
    },
    [dropdownOpen]
  );

  const handleBack = useCallback(() => {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    window.location.assign("https://bilauitmcuti.com/");
  }, []);

  const failPendingTurnstile = useCallback(() => {
    const pending = pendingSendRef.current;
    if (!pending) return;
    pendingSendRef.current = null;
    pendingExecuteRef.current = false;
    const errorNow = Date.now();
    setStreamingDraft(null);
    setMessages((prev) =>
      prev.map((m) =>
        m.id === pending.assistantId
          ? {
              ...m,
              content: CHAT_VERIFICATION_REQUIRED_MESSAGE,
              timestamp: errorNow,
              isComplete: true,
              lifecycle: ASSISTANT_LIFECYCLE.ERROR,
              streamPhase: undefined,
              statusMessage: undefined,
            }
          : m
      )
    );
    setIsLoading(false);
    setTurnstileToken("");
    setTurnstileNonce((n) => n + 1);
  }, []);

  const executeChatRequest = useCallback(
    async (
      trimmed: string,
      assistantId: string,
      modelIdForTurn: string,
      activeToken: string,
      historyMessages: Message[]
    ) => {
      let didAttemptFetch = false;

      try {
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          const offlineNow = Date.now();
          setStreamingDraft(null);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    content:
                      "Tiada sambungan internet. Semak rangkaian anda dan cuba lagi. / No internet connection. Check your network and try again.",
                    timestamp: offlineNow,
                    isComplete: true,
                    lifecycle: ASSISTANT_LIFECYCLE.ERROR,
                    streamPhase: undefined,
                    statusMessage: undefined,
                  }
                : m
            )
          );
          return;
        }

        didAttemptFetch = true;
        const history = prepareHistory(historyMessages);

        const body = JSON.stringify({
          message: trimmed,
          program: selectedProgram,
          selectedSessions,
          history,
          stream: true,
          model: modelIdForTurn,
          turnstileToken: activeToken ? activeToken : undefined,
        });
        let content: string | null = null;
        let maxAttempts = 3;
        let chatRequestSucceeded = false;
        let lastErrorStatus: number | undefined;
        const isRetryableStatus = (s: number) =>
          s === 429 || s === 500 || s === 502 || s === 503 || s === 504;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          const controller = new AbortController();
          let timeoutId = setTimeout(() => controller.abort(), FETCH_HEADERS_TIMEOUT_MS);
          try {
            const res = await fetch("/chat/api", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body,
              signal: controller.signal,
              credentials: "include",
            });

            const responseType = res.headers.get("content-type") ?? "";

            if (responseType.includes("text/event-stream")) {
              if (!res.ok) {
                clearTimeout(timeoutId);
                content = getChatErrorMessage(res, "Something went wrong. Please try again.");
                if (isRetryableStatus(res.status) && attempt < maxAttempts - 1) {
                  await new Promise((r) =>
                    setTimeout(
                      r,
                      RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)]
                    )
                  );
                  continue;
                }
                break;
              }

              clearTimeout(timeoutId);
              timeoutId = setTimeout(() => controller.abort(), FETCH_STREAM_TIMEOUT_MS);

              let answerStarted = false;
              let liveDraft: ChatStreamingDraft = {
                id: assistantId,
                content: "",
              };
              const syncDraft = (next: ChatStreamingDraft) => {
                liveDraft = next;
                setStreamingDraft(next);
              };
              const streamPainter = createRafMarkdownStreamPainter(
                (chunk) => {
                  syncDraft({
                    ...liveDraft,
                    content: liveDraft.content + chunk,
                  });
                },
                { maxChunkChars: 8, firstFlushChars: 2 }
              );
              await consumeChatStream(
                res,
                {
                  onReasoning: () => {
                    /* Thinking-only UX — ignore server reasoning paragraphs. */
                  },
                  onToken: (token) => {
                    if (!answerStarted && token.trim()) {
                      answerStarted = true;
                      setMessages((prev) =>
                        prev.map((m) =>
                          m.id === assistantId
                            ? withThinkingMetadata({
                                ...m,
                                lifecycle: ASSISTANT_LIFECYCLE.STREAMING,
                                streamPhase: undefined,
                                statusMessage: undefined,
                              })
                            : m
                        )
                      );
                    }
                    streamPainter.push(token);
                  },
                  onStatus: (payload) => {
                    if (!payload.phase || !payload.message?.trim()) return;
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === assistantId
                          ? {
                              ...m,
                              lifecycle:
                                payload.phase === CHAT_STREAM_PHASE.RETRY
                                  ? ASSISTANT_LIFECYCLE.SUBMITTED
                                  : ASSISTANT_LIFECYCLE.TOOL_CALL,
                              streamPhase: payload.phase,
                              statusMessage: payload.message,
                            }
                          : m
                      )
                    );
                  },
                  onReset: (payload) => {
                    streamPainter.reset();
                    answerStarted = false;
                    syncDraft({ id: assistantId, content: "" });
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === assistantId
                          ? {
                              ...m,
                              content: "",
                              reasoning: undefined,
                              lifecycle: ASSISTANT_LIFECYCLE.SUBMITTED,
                              streamPhase: payload.phase ?? CHAT_STREAM_PHASE.RETRY,
                              statusMessage: payload.message,
                            }
                          : m
                      )
                    );
                  },
                  onDone: (payload) => {
                    streamPainter.flush();
                    content = payload.reply;
                    chatRequestSucceeded = true;
                    const doneAt = Date.now();
                    const replyText = payload.reply ?? "";

                    setStreamingDraft(null);
                    setMessages((prev) => {
                      const hasMsg = prev.some((m) => m.id === assistantId);
                      if (!hasMsg) {
                        return [
                          ...prev,
                          {
                            id: assistantId,
                            role: "assistant",
                            content: replyText,
                            correlationId: payload.correlationId,
                            userPrompt: trimmed,
                            isComplete: true,
                            timestamp: doneAt,
                            lifecycle: ASSISTANT_LIFECYCLE.COMPLETE,
                          },
                        ];
                      }
                      return prev.map((m) => {
                        if (m.id !== assistantId) return m;
                        return withThinkingMetadata(
                          {
                            ...m,
                            content: replyText,
                            reasoning: undefined,
                            correlationId: payload.correlationId,
                            userPrompt: trimmed,
                            isComplete: true,
                            timestamp: m.timestamp ?? doneAt,
                            lifecycle: ASSISTANT_LIFECYCLE.COMPLETE,
                            streamPhase: undefined,
                            statusMessage: undefined,
                          },
                          doneAt
                        );
                      });
                    });
                    setIsTurnstileSessionVerified(true);
                    setTurnstileToken("");
                    turnstileRef.current?.reset();
                  },
                  onError: (payload) => {
                    streamPainter.flush();
                    content = resolveChatErrorMessage(payload.status, payload.error);
                    lastErrorStatus = payload.status;
                    if (payload.status === 503 && maxAttempts === 3) {
                      maxAttempts = 4;
                    }
                  },
                },
                { signal: controller.signal }
              );
              clearTimeout(timeoutId);

              if (chatRequestSucceeded) break;

              if (
                lastErrorStatus &&
                isRetryableStatus(lastErrorStatus) &&
                attempt < maxAttempts - 1
              ) {
                setStreamingDraft({ id: assistantId, content: "" });
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? {
                          ...m,
                          content: "",
                          isComplete: false,
                          lifecycle: ASSISTANT_LIFECYCLE.SUBMITTED,
                          streamPhase: undefined,
                          statusMessage: undefined,
                        }
                      : m
                  )
                );
                await new Promise((r) =>
                  setTimeout(
                    r,
                    RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)]
                  )
                );
                continue;
              }
              break;
            }

            clearTimeout(timeoutId);

            const data = await parseChatResponse(res);

            if (!res.ok) {
              content = data.error || getChatErrorMessage(res, "Something went wrong. Please try again.");
              if (res.status === 503 && maxAttempts === 3) {
                maxAttempts = 4;
              }
              if (isRetryableStatus(res.status) && attempt < maxAttempts - 1) {
                await new Promise((r) =>
                  setTimeout(
                    r,
                    RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)]
                  )
                );
                continue;
              }
            } else {
              const replyText = data.reply || "Sorry, I could not get a response.";
              content = replyText;
              chatRequestSucceeded = true;
              const doneAt = Date.now();
              setStreamingDraft(null);
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? {
                        ...m,
                        content: replyText,
                        correlationId: data.correlationId,
                        userPrompt: trimmed,
                        isComplete: true,
                        timestamp: doneAt,
                        lifecycle: ASSISTANT_LIFECYCLE.COMPLETE,
                        streamPhase: undefined,
                        statusMessage: undefined,
                      }
                    : m
                )
              );
              setIsTurnstileSessionVerified(true);
              setTurnstileToken("");
              turnstileRef.current?.reset();
            }
            break;
          } catch (err) {
            clearTimeout(timeoutId);
            const isAbort = err instanceof Error && err.name === "AbortError";
            content = isAbort
              ? CHAT_TIMEOUT_MESSAGE
              : CHAT_NETWORK_ERROR_MESSAGE;
            if (isAbort && lastErrorStatus === 429) {
              content = resolveChatErrorMessage(429);
            }
            if (attempt < maxAttempts - 1) {
              await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
              continue;
            }
            break;
          }
        }

        if (didAttemptFetch && !chatRequestSucceeded && activeToken) {
          setTurnstileToken("");
          setTurnstileNonce((n) => n + 1);
        }

        if (!chatRequestSucceeded) {
          const assistantNow = Date.now();
          const errorContent = content || "Something went wrong. Please try again.";
          setStreamingDraft(null);
          setMessages((prev) => {
            const hasPlaceholder = prev.some((m) => m.id === assistantId);
            if (hasPlaceholder) {
              return prev.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      content: errorContent,
                      timestamp: assistantNow,
                      isComplete: true,
                      lifecycle: ASSISTANT_LIFECYCLE.ERROR,
                      streamPhase: undefined,
                      statusMessage: undefined,
                    }
                  : m
              );
            }
            return [
              ...prev,
              {
                id: assistantId,
                role: "assistant",
                content: errorContent,
                timestamp: assistantNow,
                isComplete: true,
                lifecycle: ASSISTANT_LIFECYCLE.ERROR,
              },
            ];
          });
        }

        if (chatRequestSucceeded) {
          trackZarazEvent(ZARAZ_EVENTS.chatMessageSent, {
            program: selectedProgram,
            sessionCount: selectedSessions.length,
          });
        }
      } catch {
        const errorNow = Date.now();
        setStreamingDraft(null);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: "Something went wrong. Please try again.",
                  timestamp: errorNow,
                  isComplete: true,
                  lifecycle: ASSISTANT_LIFECYCLE.ERROR,
                  streamPhase: undefined,
                  statusMessage: undefined,
                }
              : m
          )
        );
      } finally {
        setIsLoading(false);
      }
    },
    [selectedProgram, selectedSessions]
  );

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading || waitForTurnstileConfig) return;
      if (trimmed.length > MAX_CHAT_MESSAGE_LENGTH) return;
      void ensureCalendarMeta();

      // Snapshot for this turn — picker changes during streaming apply to the next send only.
      const modelIdForTurn = selectedModelId;
      const historyMessages = messages;
      const willSwapLayout = messages.length === 0;

      const now = Date.now();
      const assistantId = (now + 1).toString();
      const userMessage: Message = {
        id: now.toString(),
        role: "user",
        content: trimmed,
        timestamp: now,
      };

      const assistantPlaceholder: Message = {
        id: assistantId,
        role: "assistant",
        content: "",
        isComplete: false,
        timestamp: now,
        userPrompt: trimmed,
        reasoningUiSupported: supportsReasoningUi(modelIdForTurn),
        lifecycle: ASSISTANT_LIFECYCLE.SUBMITTED,
      };

      // Optimistic UI first — layout + bubble must not wait on Turnstile.
      setMessages([...messages, userMessage, assistantPlaceholder]);
      setStreamingDraft({ id: assistantId, content: "" });
      setInput("");
      setIsLoading(true);
      startLoadingState();

      const activeToken = turnstileToken.trim();
      if (requiresTurnstile && !activeToken) {
        pendingSendRef.current = {
          text: trimmed,
          assistantId,
          modelId: modelIdForTurn,
          historyMessages,
        };
        pendingExecuteRef.current = true;
        // Empty→transcript remounts the widget; wait for onReady instead of executing a dying instance.
        if (turnstileMounted && !willSwapLayout) {
          turnstileRef.current?.execute();
        } else {
          setTurnstileMounted(true);
        }
        return;
      }

      await executeChatRequest(
        trimmed,
        assistantId,
        modelIdForTurn,
        activeToken,
        historyMessages
      );
    },
    [
      isLoading,
      messages,
      requiresTurnstile,
      selectedModelId,
      startLoadingState,
      turnstileToken,
      turnstileMounted,
      waitForTurnstileConfig,
      executeChatRequest,
    ]
  );

  const handleTurnstileToken = useCallback(
    (token: string) => {
      setTurnstileToken(token);
      const pending = pendingSendRef.current;
      if (!pending) return;
      if (!token.trim()) {
        failPendingTurnstile();
        return;
      }
      pendingSendRef.current = null;
      pendingExecuteRef.current = false;
      void executeChatRequest(
        pending.text,
        pending.assistantId,
        pending.modelId,
        token,
        pending.historyMessages
      );
    },
    [executeChatRequest, failPendingTurnstile]
  );

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    await sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (isMentionOpen) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (mentionItems.length === 0) return;
        setActiveMentionIndex((prev) => (prev + 1) % mentionItems.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (mentionItems.length === 0) return;
        setActiveMentionIndex((prev) => (prev - 1 + mentionItems.length) % mentionItems.length);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setIsMentionOpen(false);
        return;
      }
      if ((e.key === "Enter" || e.key === "Tab") && mentionItems.length > 0) {
        e.preventDefault();
        const target = mentionItems[activeMentionIndex] ?? mentionItems[0];
        if (!target) return;
        handleMentionSelect(target);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const updateMentionState = useCallback((value: string, caretIndex: number | null) => {
    if (caretIndex == null) {
      setIsMentionOpen(false);
      setMentionMatch(null);
      setMentionQuery("");
      return;
    }
    const match = getActiveMentionMatch(value, caretIndex);
    if (!match) {
      setIsMentionOpen(false);
      setMentionMatch(null);
      setMentionQuery("");
      return;
    }
    setMentionMatch(match);
    setMentionQuery(match.query);
    setActiveMentionIndex(0);
    setIsMentionOpen(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(max-width: 768px)");
    const sync = () => setIsMobileMentionPicker(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  const mentionHighlightParts = useMemo(() => {
    if (!mentionHighlightPattern || !input) return [{ text: input, isMention: false }];
    const parts: { text: string; isMention: boolean }[] = [];
    let lastIndex = 0;
    input.replace(mentionHighlightPattern, (match, _group, offset) => {
      if (offset > lastIndex) parts.push({ text: input.slice(lastIndex, offset), isMention: false });
      parts.push({ text: match, isMention: true });
      lastIndex = offset + match.length;
      return match;
    });
    if (lastIndex < input.length) parts.push({ text: input.slice(lastIndex), isMention: false });
    return parts;
  }, [input, mentionHighlightPattern]);

  useEffect(() => {
    if (!isMentionOpen) return;
    if (mentionItems.length === 0) {
      setActiveMentionIndex(0);
      return;
    }
    if (activeMentionIndex <= mentionItems.length - 1) return;
    setActiveMentionIndex(0);
  }, [isMentionOpen, mentionItems, activeMentionIndex]);

  const handleCopy = async (msgId: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(msgId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback: ignore if clipboard API fails
    }
  };

  const handleReaction = async (msgId: string, type: "up" | "down") => {
    const nextReaction = reactions[msgId] === type ? null : type;
    setReactions((prev) => ({
      ...prev,
      [msgId]: nextReaction,
    }));

    if (!nextReaction || feedbackSent[msgId]) return;

    const assistantMsg = messages.find((m) => m.id === msgId);
    if (!assistantMsg || assistantMsg.role !== "assistant" || !assistantMsg.content.trim()) {
      setFeedbackError("Feedback is not available for this message yet.");
      return;
    }

    const msgIndex = messages.findIndex((m) => m.id === msgId);
    const userMsg =
      msgIndex > 0 && messages[msgIndex - 1]?.role === "user"
        ? messages[msgIndex - 1]
        : null;
    const userMessage =
      assistantMsg.userPrompt ?? userMsg?.content ?? "";

    try {
      const res = await fetch("/chat/feedback/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          rating: nextReaction,
          correlationId: assistantMsg.correlationId ?? undefined,
          userMessage,
          assistantMessage: assistantMsg.content,
          program: selectedProgram,
          selectedSessions,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setFeedbackError(data.error ?? "Could not send feedback. Please try again.");
        return;
      }
      setFeedbackSent((prev) => ({ ...prev, [msgId]: true }));
      setFeedbackError(null);
      trackZarazEvent(ZARAZ_EVENTS.chatFeedback, { rating: nextReaction });
    } catch {
      setFeedbackError("Could not send feedback. Please try again.");
    }
  };

  const handleDelete = useCallback((msgId: string) => {
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === msgId);
      if (idx === -1) return prev;
      const target = prev[idx];
      const next = prev[idx + 1];
      const removePairedAssistant =
        target.role === "user" && next?.role === "assistant";
      const removeCount = removePairedAssistant ? 2 : 1;
      return [...prev.slice(0, idx), ...prev.slice(idx + removeCount)];
    });
  }, []);

  const handleEdit = useCallback((msgId: string) => {
    const msgIndex = messages.findIndex((m) => m.id === msgId);
    if (msgIndex === -1) return;
    const msg = messages[msgIndex];
    setInput(msg.content);
    setStreamingDraft(null);
    setMessages(messages.slice(0, msgIndex));
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 100);
  }, [messages]);

  const isEmptyChat = messages.length === 0;

  useLayoutEffect(() => {
    if (!isEmptyChat) return;
    if (window.matchMedia(DESKTOP_VIEWPORT_QUERY).matches) {
      textareaRef.current?.focus({ preventScroll: true });
    }
  }, [isEmptyChat]);

  // Warm Turnstile (api.js + render) on empty chat so first send usually only execute()s.
  useEffect(() => {
    if (!hasMounted || !isEmptyChat || !requiresTurnstile) return;
    setTurnstileMounted(true);
  }, [hasMounted, isEmptyChat, requiresTurnstile]);

  const handleSuggestionSelect = useCallback(
    (text: string) => {
      requestComposerWarmup();
      void sendMessage(text);
    },
    [requestComposerWarmup, sendMessage]
  );

  const chatInputPlaceholder = isEmptyChat
    ? "How can I help you today?"
    : "Write a message...";
  const chatInputPlaceholderDesktop = isEmptyChat
    ? "Ask about calendars or holidays. Select your programme, or type @ to mention one."
    : undefined;

  const suggestionsDisabled =
    waitForTurnstileConfig ||
    isLoading;

  const composerFormProps = {
    input,
    placeholder: chatInputPlaceholder,
    placeholderDesktop: chatInputPlaceholderDesktop,
    isLoading,
    waitForTurnstileConfig,
    requiresTurnstile,
    turnstileToken,
    feedbackError,
    mentionHighlightParts,
    isMentionOpen,
    isMobileMentionPicker,
    mentionItems,
    activeMentionIndex,
    dropdownOpen,
    activeSubmenu,
    currentProgramLabel,
    groupAOptions,
    groupBOptions,
    groupBProgramForSessions,
    groupBSessionLabel,
    selectedProgram,
    selectedSessions,
    keepDropdownOpenRef,
    onInputChange: (value: string, caretIndex: number | null) => {
      setInput(value);
      updateMentionState(value, caretIndex);
    },
    onKeyDown: handleKeyDown,
    onSubmit: handleSubmit,
    onMentionSelect: handleMentionSelect,
    onMentionOpenChange: setIsMentionOpen,
    onDropdownOpenChange: handleProgramDropdownOpenChange,
    onActiveSubmenuChange: setActiveSubmenu,
    onSessionToggle: handleSessionToggle,
    onProgramSelect: handleProgramSelect,
    formatGroupASessionTriggerLabel,
    chatModels,
    selectedModelId,
    selectedModelLabel,
    modelDropdownOpen,
    onModelDropdownOpenChange: setModelDropdownOpen,
    onModelSelect: handleModelSelect,
    onTextareaFocus: requestComposerWarmup,
    onProgramMenuWarm: () => {
      void ensureCalendarMeta();
    },
    programCataloguePending,
  };

  const chatModelIds = useMemo(
    () => chatModels.map((model) => model.id),
    [chatModels]
  );

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-background text-foreground" data-nosnippet>
      <ModelShortcut
        modelIds={chatModelIds}
        selectedModelId={selectedModelId}
        onSelect={handleModelSelect}
      />
      {showBackButton ? (
        <div
          className={`chat-header absolute top-0 left-0 right-0 z-10 px-4 md:px-0 ${
            headerVisible ? "translate-y-0" : "-translate-y-full"
          }`}
        >
          <header className="flex items-center gap-3 pt-8 pb-3 mx-auto max-w-[600px] w-full">
            <button
              type="button"
              onClick={handleBack}
              className="flex items-center justify-center w-9 h-9 rounded-full bg-secondary hover:opacity-80"
              aria-label="Back To Home"
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} className="w-5 h-5" />
            </button>
          </header>
        </div>
      ) : null}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-1 md:px-0">
        {isEmptyChat ? (
          <ChatEmptyMobile
            showTurnstileChallenge={showTurnstileChallenge}
            showTurnstileSlot={showTurnstileSlot}
            turnstileSiteKey={turnstileSiteKey ?? ""}
            turnstileNonce={turnstileNonce}
            turnstileRef={turnstileRef}
            onTurnstileToken={handleTurnstileToken}
            onTurnstileReady={handleTurnstileReady}
            suggestions={suggestions}
            suggestionsDisabled={suggestionsDisabled}
            suggestionsLoading={suggestionsLoading}
            onSuggestionSelect={handleSuggestionSelect}
            composer={{
              ...composerFormProps,
              textareaRef,
            }}
          />
        ) : (
          <>
            <ChatTranscript
              messages={messages}
              streamingDraft={streamingDraft}
              isLoading={isLoading}
              showLoadingMarker={showLoadingMarker}
              streamStatusPhrase={streamStatusPhrase}
              lastUserMsgId={lastUserMsgId}
              copiedId={copiedId}
              reactions={reactions}
              showTurnstileChallenge={showTurnstileChallenge}
              turnstileSiteKey={turnstileSiteKey ?? ""}
              turnstileNonce={turnstileNonce}
              turnstileRef={turnstileRef}
              onTurnstileToken={handleTurnstileToken}
              onTurnstileReady={handleTurnstileReady}
              onViewportScroll={handleViewportScroll}
              onCopy={handleCopy}
              onReaction={handleReaction}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
            <ChatComposer {...composerFormProps} textareaRef={textareaRef} />
          </>
        )}
      </div>
    </div>
  );
}
