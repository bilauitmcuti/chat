"use client";

import {
  Reasoning,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Tick02Icon,
  Copy01Icon,
  PencilEdit02Icon,
  ThumbsDownIcon,
  ThumbsUpIcon,
  Delete02Icon,
} from "@hugeicons/core-free-icons";
import { useEffect, useState, type CSSProperties } from "react";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { CHAT_ACTION_APPEAR } from "@/components/ui/streamdown-motion";
import {
  Message,
  MessageContent,
  MessageFooter,
} from "@/components/ui/message";
import {
  MessageScrollerItem,
} from "@/components/ui/message-scroller";
import { cn } from "@/lib/utils";
import { type ChatMessageItem, type ChatStreamingDraft } from "@/components/chat/chat-utils";
import { useLiveDurationSec } from "@/components/chat/use-live-duration-sec";
import { useReasoningVisibility } from "@/components/chat/use-reasoning-visibility";
import { CHAT_STREAM_PHASE } from "@/lib/chat/stream-phase";
import { isMinimalConversationalMessage } from "@/lib/chat/intent";
import dynamic from "next/dynamic";

const StreamdownRenderer = dynamic(
  () =>
    import("@/components/ui/streamdown-renderer").then((mod) => mod.StreamdownRenderer),
  {
    ssr: false,
    loading: () => (
      <p className="text-sm leading-relaxed whitespace-pre-wrap break-words text-muted-foreground md:text-[0.9375rem]">
        …
      </p>
    ),
  }
);

interface ChatMessageRowProps {
  message: ChatMessageItem;
  streamingDraft?: ChatStreamingDraft | null;
  scrollAnchor: boolean;
  isLastUserMessage: boolean;
  copiedId: string | null;
  reaction: "up" | "down" | null | undefined;
  onCopy: (msgId: string, content: string) => void;
  onReaction: (msgId: string, type: "up" | "down") => void;
  onEdit: (msgId: string) => void;
  onDelete: (msgId: string) => void;
}

export function ChatMessageRow({
  message,
  streamingDraft = null,
  scrollAnchor,
  isLastUserMessage,
  copiedId,
  reaction,
  onCopy,
  onReaction,
  onEdit,
  onDelete,
}: ChatMessageRowProps) {
  const displayContent =
    streamingDraft?.id === message.id ? streamingDraft.content : message.content;

  const assistantInProgress =
    message.role === "assistant" && message.isComplete === false;
  const [sawStreaming, setSawStreaming] = useState(
    () => message.isComplete === false
  );
  useEffect(() => {
    if (message.isComplete === false) setSawStreaming(true);
  }, [message.isComplete]);
  const answerStreaming = assistantInProgress && displayContent.trim().length > 0;
  const isRegenerating =
    assistantInProgress &&
    !answerStreaming &&
    message.streamPhase === CHAT_STREAM_PHASE.RETRY;
  const progressLabel = message.statusMessage?.trim();
  const isThinkingPhase =
    assistantInProgress && !answerStreaming && !isRegenerating;

  const { showThinking } = useReasoningVisibility(
    isThinkingPhase,
    message.timestamp
  );

  // Pending until answer text exists — clears on first painted content or error.
  const showThinkingUi = isThinkingPhase && showThinking;
  const showLiveRegenerating = isRegenerating && Boolean(progressLabel);
  const liveDurationSec = useLiveDurationSec(
    message.timestamp,
    assistantInProgress && message.thinkingDurationSec === undefined
  );
  const resolvedDurationSec = message.thinkingDurationSec ?? liveDurationSec;
  const isMinimalTurn = isMinimalConversationalMessage(message.userPrompt ?? "");
  /**
   * Pending shimmer for every supported model as soon as the turn is submitted.
   * Reasoning paragraphs (if any) stay gated by reasoningUiSupported + non-minimal.
   */
  const showPendingHeader = showThinkingUi || showLiveRegenerating;
  const showReasoningCapableHeader =
    message.reasoningUiSupported !== false &&
    !isMinimalTurn &&
    Boolean(message.reasoning?.trim());
  const showThoughtHeader = showPendingHeader || showReasoningCapableHeader;

  const enterAnimation =
    message.role === "user"
      ? "animate-in fade-in duration-150 ease-out fill-mode-both motion-reduce:animate-none"
      : undefined;

  if (message.role === "user") {
    return (
      <MessageScrollerItem
        messageId={message.id}
        scrollAnchor={scrollAnchor}
        className={enterAnimation}
      >
        <Message align="end">
          <MessageContent>
            <ContextMenu>
              <ContextMenuTrigger
                render={
                  <Bubble variant="muted" align="end" className="cursor-context-menu select-none" />
                }
              >
                <BubbleContent className="rounded-br-md border-0 whitespace-pre-wrap">
                  {message.content}
                </BubbleContent>
              </ContextMenuTrigger>
              <ContextMenuContent className="w-fit max-w-[200px]">
                {isLastUserMessage && (
                  <ContextMenuItem onClick={() => onEdit(message.id)}>
                    <HugeiconsIcon icon={PencilEdit02Icon} strokeWidth={2} data-icon="inline-start" />
                    Edit
                  </ContextMenuItem>
                )}
                <ContextMenuItem onClick={() => onCopy(message.id, message.content)}>
                  <HugeiconsIcon icon={Copy01Icon} strokeWidth={2} data-icon="inline-start" />
                  Copy
                </ContextMenuItem>
                <ContextMenuItem onClick={() => onDelete(message.id)}>
                  <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} data-icon="inline-start" />
                  Delete
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          </MessageContent>
        </Message>
      </MessageScrollerItem>
    );
  }

  const assistantFinished =
    message.isComplete !== false && displayContent.trim().length > 0;
  const animateActions = assistantFinished && sawStreaming;
  const actionBlurClass = animateActions ? "chat-action-blur-in" : undefined;
  const actionBlurStyle = (index: number): CSSProperties | undefined =>
    animateActions
      ? ({
          animationDelay: `${index * CHAT_ACTION_APPEAR.staggerMs}ms`,
          "--chat-action-blur-duration": `${CHAT_ACTION_APPEAR.durationMs}ms`,
        } as CSSProperties)
      : undefined;

  return (
    <MessageScrollerItem messageId={message.id} scrollAnchor={scrollAnchor}>
      <Message align="start">
        <MessageContent>
          {showThoughtHeader ? (
            <Reasoning
              className="w-full"
              collapsible={false}
              defaultOpen={false}
              duration={resolvedDurationSec}
              isStreaming={showThinkingUi || showLiveRegenerating}
            >
              <ReasoningTrigger
                showChevron={false}
                showDurationLabel={false}
                getThinkingMessage={(isStreaming) => {
                  if (!showLiveRegenerating || !progressLabel) return null;
                  return isStreaming ? (
                    <span className="shimmer text-muted-foreground">{progressLabel}</span>
                  ) : (
                    <span>{progressLabel}</span>
                  );
                }}
              />
            </Reasoning>
          ) : null}
          {displayContent.trim() ? (
            <Bubble variant="ghost">
              <BubbleContent className="px-1 py-1">
                <StreamdownRenderer
                  content={displayContent}
                  isComplete={message.isComplete !== false}
                />
              </BubbleContent>
            </Bubble>
          ) : null}
          {assistantFinished && (
            <MessageFooter className="gap-0 px-0">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onCopy(message.id, displayContent)}
                aria-label="Copy answer"
                className={actionBlurClass}
                style={actionBlurStyle(0)}
              >
                {copiedId === message.id ? (
                  <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} className="text-primary" />
                ) : (
                  <HugeiconsIcon icon={Copy01Icon} strokeWidth={2} />
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onReaction(message.id, "up")}
                aria-label="Thumbs up"
                className={cn(
                  actionBlurClass,
                  "active:scale-[0.97] transition-transform duration-[160ms] ease-out motion-reduce:transition-none",
                  reaction === "up" ? "text-foreground" : "text-muted-foreground"
                )}
                style={actionBlurStyle(1)}
              >
                <HugeiconsIcon
                  icon={ThumbsUpIcon}
                  strokeWidth={2}
                  className={reaction === "up" ? "fill-current" : undefined}
                />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onReaction(message.id, "down")}
                aria-label="Thumbs down"
                className={cn(
                  actionBlurClass,
                  "active:scale-[0.97] transition-transform duration-[160ms] ease-out motion-reduce:transition-none",
                  reaction === "down" ? "text-foreground" : "text-muted-foreground"
                )}
                style={actionBlurStyle(2)}
              >
                <HugeiconsIcon
                  icon={ThumbsDownIcon}
                  strokeWidth={2}
                  className={reaction === "down" ? "fill-current" : undefined}
                />
              </Button>
            </MessageFooter>
          )}
        </MessageContent>
      </Message>
    </MessageScrollerItem>
  );
}
