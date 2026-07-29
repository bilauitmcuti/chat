"use client";

import {
  TurnstileWidget,
  type TurnstileWidgetHandle,
} from "@/components/turnstile-widget";
import { Marker, MarkerContent } from "@/components/ui/marker";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { ChatMessageRow } from "@/components/chat/chat-message-row";
import { ChatScrollSync } from "@/components/chat/chat-scroll-sync";
import type { ChatMessageItem, ChatStreamingDraft } from "@/components/chat/chat-utils";

interface ChatTranscriptProps {
  messages: ChatMessageItem[];
  streamingDraft?: ChatStreamingDraft | null;
  isLoading: boolean;
  showLoadingMarker: boolean;
  streamStatusPhrase: string;
  lastUserMsgId: string | null;
  copiedId: string | null;
  reactions: Record<string, "up" | "down" | null>;
  showTurnstileChallenge: boolean;
  turnstileSiteKey: string;
  turnstileNonce: number;
  turnstileRef: React.RefObject<TurnstileWidgetHandle | null>;
  onTurnstileToken: (token: string) => void;
  onViewportScroll: (event: React.UIEvent<HTMLDivElement>) => void;
  onCopy: (msgId: string, content: string) => void;
  onReaction: (msgId: string, type: "up" | "down") => void;
  onEdit: (msgId: string) => void;
  onDelete: (msgId: string) => void;
}

export function ChatTranscript({
  messages,
  streamingDraft = null,
  isLoading,
  showLoadingMarker,
  streamStatusPhrase,
  lastUserMsgId,
  copiedId,
  reactions,
  showTurnstileChallenge,
  turnstileSiteKey,
  turnstileNonce,
  turnstileRef,
  onTurnstileToken,
  onViewportScroll,
  onCopy,
  onReaction,
  onEdit,
  onDelete,
}: ChatTranscriptProps) {
  return (
    <MessageScrollerProvider autoScroll defaultScrollPosition="end">
      <ChatScrollSync messages={messages} streamingDraft={streamingDraft} />
      <MessageScroller className="flex-1 min-h-0">
        <MessageScrollerViewport onScroll={onViewportScroll}>
          <MessageScrollerContent
            aria-busy={isLoading}
            className="mx-auto w-full max-w-[600px] gap-6 pt-14 pb-6 px-2 md:px-0"
          >
            {showTurnstileChallenge ? (
              <MessageScrollerItem>
                <div className="w-full max-w-[320px]">
                  <TurnstileWidget
                    ref={turnstileRef}
                    key={turnstileNonce}
                    siteKey={turnstileSiteKey}
                    action="chat_message"
                    onToken={onTurnstileToken}
                  />
                </div>
              </MessageScrollerItem>
            ) : null}
            {messages.map((msg) => (
              <ChatMessageRow
                key={msg.id}
                message={msg}
                streamingDraft={streamingDraft?.id === msg.id ? streamingDraft : null}
                scrollAnchor={false}
                isLastUserMessage={msg.id === lastUserMsgId}
                copiedId={copiedId}
                reaction={reactions[msg.id]}
                onCopy={onCopy}
                onReaction={onReaction}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
            {showLoadingMarker ? (
              <MessageScrollerItem messageId="__loading__">
                <Marker role="status" aria-live="polite">
                  <MarkerContent className="shimmer text-sm text-muted-foreground select-none">
                    {streamStatusPhrase || "Thinking…"}
                  </MarkerContent>
                </Marker>
              </MessageScrollerItem>
            ) : null}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton />
      </MessageScroller>
    </MessageScrollerProvider>
  );
}
