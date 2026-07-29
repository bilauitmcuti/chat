"use client";

import {
  TurnstileWidget,
  type TurnstileWidgetHandle,
} from "@/components/turnstile-widget";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";

interface ChatEmptyStateProps {
  showTurnstileChallenge: boolean;
  turnstileSiteKey: string;
  turnstileNonce: number;
  turnstileRef: React.RefObject<TurnstileWidgetHandle | null>;
  onTurnstileToken: (token: string) => void;
}

export function ChatEmptyState({
  showTurnstileChallenge,
  turnstileSiteKey,
  turnstileNonce,
  turnstileRef,
  onTurnstileToken,
}: ChatEmptyStateProps) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center overflow-hidden px-4 pb-6 lg:flex-none lg:pb-0">
      <Empty className="mx-auto max-w-[600px] flex-none border-none p-0">
        <EmptyHeader>
          <EmptyTitle className="text-2xl sm:text-3xl font-semibold tracking-tight text-balance">
            Ask AI, get instant answers
          </EmptyTitle>
          <EmptyDescription className="max-w-sm text-balance lg:hidden">
            Ask about academic calendars or public holidays. Select your programme, or type @ to mention a calendar.
          </EmptyDescription>
        </EmptyHeader>
        {showTurnstileChallenge ? (
          <div className="w-full max-w-[320px] px-3">
            <TurnstileWidget
              ref={turnstileRef}
              key={turnstileNonce}
              siteKey={turnstileSiteKey}
              action="chat_message"
              onToken={onTurnstileToken}
            />
          </div>
        ) : null}
      </Empty>
    </div>
  );
}
