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
  suggestions,
  suggestionsDisabled,
  suggestionsLoading = false,
  onSuggestionSelect,
  composer,
}: ChatEmptyDesktopProps) {
  return (
    <div className="hidden min-h-0 min-w-0 flex-1 flex-col items-center justify-center overflow-hidden px-4 lg:flex">
      <div className="mx-auto flex w-full max-w-[600px] flex-col items-stretch">
        <Empty className="mb-6 flex-none border-none p-0">
          <EmptyHeader>
            <EmptyTitle className="text-2xl sm:text-3xl font-semibold tracking-tight text-balance">
              Ask AI, get instant answers
            </EmptyTitle>
          </EmptyHeader>
          {showTurnstileSlot ? (
            <div className="mx-auto mt-4 flex min-h-[65px] w-full max-w-[320px] items-start justify-center px-3">
              {showTurnstileChallenge ? (
                <TurnstileWidget
                  ref={turnstileRef}
                  key={turnstileNonce}
                  siteKey={turnstileSiteKey}
                  action="chat_message"
                  onToken={onTurnstileToken}
                />
              ) : null}
            </div>
          ) : null}
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
