"use client";

import {
  TurnstileWidget,
  type TurnstileWidgetHandle,
} from "@/components/turnstile-widget";
import {
  ChatComposerForm,
  type ChatComposerFormProps,
} from "@/components/chat/chat-composer";
import { SuggestionChips } from "@/components/chat/suggestion-chips";
import { SuggestionStack } from "@/components/chat/suggestion-stack";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";

interface ChatEmptyMobileProps {
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

export function ChatEmptyMobile({
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
}: ChatEmptyMobileProps) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:items-center lg:justify-center lg:px-4">
      <div className="mx-auto flex h-full w-full max-w-[600px] flex-col lg:h-auto">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center overflow-hidden px-4 pb-6 lg:mb-6 lg:flex-none lg:px-0 lg:pb-0">
        <Empty className="mx-auto max-w-[600px] flex-none border-none p-0">
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
              Ask Bila about your calendar
            </EmptyTitle>
            <EmptyDescription className="max-w-sm text-balance lg:hidden">
              Ask about academic calendars or public holidays. Select your programme, or type @ to
              mention a calendar.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
      <div className="chat-input-area relative min-w-0 shrink-0 overflow-x-hidden pt-1 pb-6 lg:contents">
        <SuggestionChips
          className="lg:hidden"
          suggestions={suggestions}
          disabled={suggestionsDisabled}
          isLoading={suggestionsLoading}
          onSelect={onSuggestionSelect}
        />
        <ChatComposerForm
          {...composer}
          composerSlot="active"
          showDisclaimer={false}
          className="lg:px-0"
        />
        <SuggestionStack
          className="hidden lg:block"
          suggestions={suggestions}
          disabled={suggestionsDisabled}
          isLoading={suggestionsLoading}
          onSelect={onSuggestionSelect}
        />
        <span className="mx-auto mt-2 block w-full min-w-0 max-w-[600px] px-2 text-center text-xs text-muted-foreground md:px-0 lg:hidden">
          AI can make mistakes. Check important info.
        </span>
      </div>
      </div>
    </div>
  );
}
