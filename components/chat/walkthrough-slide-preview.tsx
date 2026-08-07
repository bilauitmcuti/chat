"use client";

import type { ReactNode } from "react";
import {
  ChatProgramDropdownPreview,
  ChatModelDropdownPreview,
} from "@/components/chat/chat-composer-preview";
import type { WalkthroughPreviewKind } from "@/components/chat/walkthrough-slides";
import { StreamdownRenderer } from "@/components/ui/streamdown-renderer";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Message, MessageContent } from "@/components/ui/message";
import { cn } from "@/lib/utils";

const CHAT_PREVIEW_TURNS = [
  {
    user: "When does lecture start?",
    reply: "Lecture 1 starts **3 Mar 2026** (Group B, Session B-20263).",
  },
  {
    user: "What about mid-semester break?",
    reply: "Mid-semester break is **14–18 Aug 2026** for Group B.",
  },
] as const;

const SUGGESTION_PREVIEW_LABELS = [
  "Kuliah semester ni start bila?",
  "Cuti Pertengahan Semester tarikh apa?",
  "Cuti umum Selangor bulan depan?",
] as const;

function ChatPreviewUserBubble({ text }: { text: string }) {
  return (
    <Message align="end">
      <MessageContent>
        <Bubble align="end" variant="muted">
          <BubbleContent className="rounded-br-md border-0 px-3 py-1.5 text-xs leading-snug whitespace-pre-wrap">
            {text}
          </BubbleContent>
        </Bubble>
      </MessageContent>
    </Message>
  );
}

function ChatPreviewAssistantBubble({ markdown }: { markdown: string }) {
  return (
    <Message align="start">
      <MessageContent>
        <Bubble variant="ghost">
          <BubbleContent className="min-h-[2.25rem] px-1 py-0.5 text-left">
            <StreamdownRenderer
              content={markdown}
              isComplete
              className="text-xs [&_p]:text-xs [&_p]:leading-snug"
            />
          </BubbleContent>
        </Bubble>
      </MessageContent>
    </Message>
  );
}

function ChatPreviewMock() {
  return (
    <div className="pointer-events-none flex h-full min-h-0 w-full flex-col justify-center overflow-hidden text-left">
      <div className="flex w-full flex-col gap-1.5">
        {CHAT_PREVIEW_TURNS.map((turn) => (
          <div key={turn.user} className="flex flex-col gap-1.5">
            <ChatPreviewUserBubble text={turn.user} />
            <ChatPreviewAssistantBubble markdown={turn.reply} />
          </div>
        ))}
      </div>
    </div>
  );
}

function SuggestionsPreviewMock() {
  return (
    <div className="pointer-events-none flex h-full min-h-0 w-full flex-col items-center justify-center gap-3 overflow-hidden">
      <div className="flex w-full flex-wrap justify-center gap-2">
        {SUGGESTION_PREVIEW_LABELS.map((label) => (
          <span
            key={label}
            className="shrink-0 rounded-full border border-border bg-secondary/50 px-3 py-1.5 text-xs text-foreground whitespace-nowrap"
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Slide 3 — programme picker: centred menu (same shell as slide 4). */
function ComposerPreviewMock() {
  return (
    <div className="flex h-full min-h-0 w-full items-center justify-center overflow-hidden py-3 sm:py-4">
      <ChatProgramDropdownPreview
        scrollable
        compact
        className="mx-auto max-h-full min-h-0 w-[260px] max-w-full shrink-0"
      />
    </div>
  );
}

/** Slide 4 — model picker: compact dropdown only. */
function ModelsPreviewMock() {
  return (
    <div className="flex h-full min-h-0 w-full items-center justify-center overflow-hidden">
      <ChatModelDropdownPreview compact className="mx-auto" />
    </div>
  );
}

const PREVIEW_MOCKS: Record<WalkthroughPreviewKind, () => ReactNode> = {
  chat: ChatPreviewMock,
  suggestions: SuggestionsPreviewMock,
  composer: ComposerPreviewMock,
  models: ModelsPreviewMock,
};

const PREVIEW_FRAME_INNER_CLASS: Record<WalkthroughPreviewKind, string> = {
  chat: "justify-center",
  suggestions: "justify-center",
  composer: "justify-center",
  models: "justify-center",
};

/** Keeps preview slot height stable while slide content swaps. */
const PREVIEW_FRAME_CLASS =
  "relative w-full aspect-video shrink-0 overflow-hidden rounded-lg border border-border bg-muted/20";

interface WalkthroughSlidePreviewProps {
  kind: WalkthroughPreviewKind;
}

export function WalkthroughSlidePreview({ kind }: WalkthroughSlidePreviewProps) {
  const Mock = PREVIEW_MOCKS[kind];

  return (
    <div aria-hidden className={cn(PREVIEW_FRAME_CLASS)}>
      <div
        className={cn(
          "absolute inset-0 flex min-h-0 flex-col px-3 text-left sm:px-4",
          PREVIEW_FRAME_INNER_CLASS[kind]
        )}
      >
        <Mock />
      </div>
    </div>
  );
}
