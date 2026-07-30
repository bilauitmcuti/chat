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
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";

interface ChatEmptyMobileProps {
  showTurnstileChallenge: boolean;
  turnstileSiteKey: string;
  turnstileNonce: number;
  turnstileRef: React.RefObject<TurnstileWidgetHandle | null>;
  onTurnstileToken: (token: string) => void;
  suggestions: string[];
  suggestionsDisabled: boolean;
  onSuggestionSelect: (suggestion: string) => void;
  composer: ChatComposerFormProps;
}

export function ChatEmptyMobile({
  showTurnstileChallenge,
  turnstileSiteKey,
  turnstileNonce,
  turnstileRef,
  onTurnstileToken,
  suggestions,
  suggestionsDisabled,
  onSuggestionSelect,
  composer,
}: ChatEmptyMobileProps) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:hidden">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center overflow-hidden px-4 pb-6">
        <Empty className="mx-auto max-w-[600px] flex-none border-none p-0">
          <EmptyHeader>
            <EmptyTitle className="text-2xl sm:text-3xl font-semibold tracking-tight text-balance">
              Ask AI, get instant answers
            </EmptyTitle>
            <EmptyDescription className="max-w-sm text-balance">
              Ask about academic calendars or public holidays. Select your programme, or type @ to
              mention a calendar.
            </EmptyDescription>
          </EmptyHeader>
          {showTurnstileChallenge ? (
            <div className="w-full max-w-[320px] px-3">
              <TurnstileWidget
                ref={turnstileRef}
                key={`mobile-${turnstileNonce}`}
                siteKey={turnstileSiteKey}
                action="chat_message"
                onToken={onTurnstileToken}
              />
            </div>
          ) : null}
        </Empty>
      </div>
      <div className="chat-input-area relative min-w-0 shrink-0 overflow-x-hidden pt-1 pb-6">
        <SuggestionChips
          suggestions={suggestions}
          disabled={suggestionsDisabled}
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
