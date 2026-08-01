"use client";

import {
  TurnstileWidget,
  type TurnstileWidgetHandle,
} from "@/components/turnstile-widget";
import {
  ChatComposerForm,
  type ChatComposerFormProps,
} from "@/components/chat/chat-composer";
import { SuggestionStack } from "@/components/chat/suggestion-stack";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";

interface ChatEmptyDesktopProps {
  showTurnstileChallenge: boolean;
  /** Reserve fixed Turnstile height (widget may still be gated until mount). */
  showTurnstileSlot?: boolean;
  turnstileSiteKey: string;
  turnstileNonce: number;
  turnstileRef: React.RefObject<TurnstileWidgetHandle | null>;
  onTurnstileToken: (token: string) => void;
  onTurnstileReady?: () => void;
  suggestions: string[];
  suggestionsDisabled: boolean;
  suggestionsLoading?: boolean;
  onSuggestionSelect: (suggestion: string) => void;
  composer: ChatComposerFormProps;
}

export function ChatEmptyDesktop({
  showTurnstileChallenge,
  showTurnstileSlot = false,
  turnstileSiteKey,
  turnstileNonce,
  turnstileRef,
  onTurnstileToken,
  onTurnstileReady,
  suggestions,
  suggestionsDisabled,
  suggestionsLoading = false,
  onSuggestionSelect,
  composer,
}: ChatEmptyDesktopProps) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center overflow-hidden px-4">
      <div className="mx-auto flex w-full max-w-[600px] flex-col items-stretch">
        <Empty className="mb-6 flex-none border-none p-0">
          {showTurnstileSlot ? (
            <div className="mx-auto mb-4 flex w-full max-w-[320px] items-start justify-center px-3 empty:mb-0 empty:min-h-0">
              {showTurnstileChallenge ? (
                <TurnstileWidget
                  ref={turnstileRef}
                  key={turnstileNonce}
                  siteKey={turnstileSiteKey}
                  action="chat_message"
                  onToken={onTurnstileToken}
                  onReady={onTurnstileReady}
                />
              ) : null}
            </div>
          ) : null}
          <EmptyHeader>
            <EmptyTitle className="text-2xl sm:text-3xl font-semibold tracking-tight text-balance">
              Ask AI, get instant answers
            </EmptyTitle>
          </EmptyHeader>
        </Empty>
        <ChatComposerForm {...composer} composerSlot="desktop" className="px-0" />
        <SuggestionStack
          suggestions={suggestions}
          disabled={suggestionsDisabled}
          isLoading={suggestionsLoading}
          onSelect={onSuggestionSelect}
        />
      </div>
    </div>
  );
}
