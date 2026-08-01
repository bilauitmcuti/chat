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
import { cn } from "@/lib/utils";
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
  className?: string;
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
  className,
}: ChatEmptyMobileProps) {
  return (
    <div
      className={cn(
        "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
        className
      )}
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center overflow-hidden px-4 pb-6">
        <Empty className="mx-auto max-w-[600px] flex-none border-none p-0">
          {showTurnstileSlot ? (
            <div className="mx-auto mb-4 flex w-full max-w-[320px] items-start justify-center px-3 empty:mb-0 empty:min-h-0">
              {showTurnstileChallenge ? (
                <TurnstileWidget
                  ref={turnstileRef}
                  key={`mobile-${turnstileNonce}`}
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
            <EmptyDescription className="max-w-sm text-balance">
              Ask about academic calendars or public holidays. Select your programme, or type @ to
              mention a calendar.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
      <div className="chat-input-area relative min-w-0 shrink-0 overflow-x-hidden pt-1 pb-6">
        <SuggestionChips
          suggestions={suggestions}
          disabled={suggestionsDisabled}
          isLoading={suggestionsLoading}
          onSelect={onSuggestionSelect}
        />
        <ChatComposerForm
          {...composer}
          composerSlot="mobile"
          showDisclaimer
        />
      </div>
    </div>
  );
}
