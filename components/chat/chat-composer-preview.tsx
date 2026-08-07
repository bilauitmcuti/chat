"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowUp02Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import {
  ModelSelectorLogo,
  ModelSelectorName,
} from "@/components/ai-elements/model-selector";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
} from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CHAT_MODEL_GEMMA_4,
  CHAT_MODELS,
} from "@/lib/chat/models";
import { cn } from "@/lib/utils";

const selectorTriggerClassName =
  "text-primary border-none bg-transparent shadow-none px-2 rounded-lg font-medium hover:bg-input hover:text-primary dark:hover:bg-input";

export type ChatComposerPreviewVariant = "default" | "skeleton";

/** Static programme rows — matches live composer dropdown copy. */
const PROGRAM_PREVIEW_GROUP_A = [
  { label: "Foundation/Professional", sessionSummary: null as string | null },
] as const;

const PROGRAM_PREVIEW_GROUP_B = [
  { label: "All", selected: true },
  { label: "Pre-Diploma", selected: false },
  { label: "Diploma", selected: false },
  { label: "Diploma Part-Time", selected: false },
  { label: "Bachelor", selected: false },
  { label: "Bachelor Part-Time", selected: false },
  { label: "Master", selected: false },
  { label: "PhD", selected: false },
] as const;

const PROGRAM_PREVIEW_SESSIONS_LABEL = "Sep 2026 - Feb 2027 (B-20264)";

interface ChatComposerPreviewProps {
  variant?: ChatComposerPreviewVariant;
  programLabel?: string;
  modelLabel?: string;
  inputPreview?: string;
  placeholderText?: string;
  selectedModelId?: string;
  className?: string;
}

/** Static open programme menu — matches composer DropdownMenuContent. */
export function ChatProgramDropdownPreview({
  scrollable = false,
  compact = false,
  className,
}: {
  /** When true, list scrolls inside the walkthrough frame if content is long. */
  scrollable?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const shellPadding = compact
    ? "pt-2.5 pb-2.5 pl-2 pr-2"
    : "pt-4 pb-4 pl-3 pr-3";

  const body = (
    <>
      <div className="-mx-1 px-1">
        <div className={compact ? "mb-1.5" : "mb-2"}>
          <div
            className={cn(
              "px-2 font-semibold text-muted-foreground",
              compact ? "mb-1.5 text-[0.625rem] sm:text-xs" : "mb-2 text-xs"
            )}
          >
            GROUP A
          </div>
          <ul className="flex flex-col">
            {PROGRAM_PREVIEW_GROUP_A.map((opt) => (
              <li
                key={opt.label}
                className={cn(
                  "relative flex min-w-0 cursor-default items-center gap-2 rounded-md px-2 text-left",
                  compact ? "py-1" : "py-1.5"
                )}
              >
                <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
                  <span
                    className={cn(
                      "min-w-0 truncate font-medium text-foreground",
                      compact ? "text-xs" : "text-sm"
                    )}
                  >
                    {opt.label}
                  </span>
                  {opt.sessionSummary ? (
                    <span
                      className={cn(
                        "min-w-0 truncate leading-snug whitespace-nowrap text-muted-foreground",
                        compact ? "text-[0.625rem] sm:text-[0.6875rem]" : "text-xs"
                      )}
                    >
                      {opt.sessionSummary}
                    </span>
                  ) : null}
                </div>
                <HugeiconsIcon
                  icon={ArrowRight01Icon}
                  strokeWidth={2}
                  className={cn(
                    "ml-auto shrink-0 text-muted-foreground",
                    compact ? "size-3.5" : "size-4"
                  )}
                />
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div
        className={cn(
          "h-px bg-border",
          compact ? "my-1.5 -mx-2" : "my-2 -mx-3 w-[calc(100%+1.5rem)]"
        )}
      />
      <div className="-mx-1 px-1">
        <div
          className={cn(
            "px-2 font-semibold text-muted-foreground",
            compact ? "mb-1.5 text-[0.625rem] sm:text-xs" : "mb-2 text-xs"
          )}
        >
          GROUP B
        </div>
        <div
          className={cn(
            "relative flex cursor-default items-center gap-2 rounded-md px-2 text-left",
            compact ? "py-1" : "py-1.5"
          )}
        >
          <div
            className={cn(
              "flex min-w-0 flex-1 flex-col text-left pr-1",
              compact ? "gap-0.5" : "gap-1"
            )}
          >
            <span className={cn("font-medium", compact ? "text-xs" : "text-sm")}>
              Sessions
            </span>
            <span
              className={cn(
                "min-w-0 leading-snug text-balance text-muted-foreground",
                compact ? "text-[0.625rem] sm:text-[0.6875rem]" : "text-xs"
              )}
            >
              {PROGRAM_PREVIEW_SESSIONS_LABEL}
            </span>
          </div>
          <HugeiconsIcon
            icon={ArrowRight01Icon}
            strokeWidth={2}
            className={cn(
              "ml-auto shrink-0 text-muted-foreground",
              compact ? "size-3.5" : "size-4"
            )}
          />
        </div>
        <ul className={cn("flex flex-col", compact ? "mt-1" : "mt-2")}>
          {PROGRAM_PREVIEW_GROUP_B.map((opt, index) => (
            <li
              key={opt.label}
              className={cn(
                "relative cursor-default rounded-sm font-medium",
                compact ? "py-1 pr-7 text-xs" : "py-1.5 pr-8 text-sm",
                index === 0 && "mt-0",
                opt.selected ? "text-primary" : "text-foreground"
              )}
            >
              {opt.label}
              {opt.selected ? (
                <span
                  className={cn(
                    "pointer-events-none absolute top-1/2 flex shrink-0 -translate-y-1/2 items-center justify-center rounded-full border border-primary bg-primary",
                    compact ? "right-1.5 size-2.5" : "right-2 size-3"
                  )}
                  aria-hidden
                />
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </>
  );

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none w-full rounded-md border border-border bg-popover shadow-md dark:bg-[#2A2A2A]",
        compact ? "min-w-[260px] max-w-[min(260px,100%)]" : "min-w-[260px] max-w-[260px]",
        shellPadding,
        scrollable && "flex max-h-full min-h-0 flex-col overflow-hidden",
        className
      )}
    >
      {scrollable ? (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{body}</div>
      ) : (
        body
      )}
    </div>
  );
}

/** Static open model menu — matches composer DropdownMenuContent + items. */
export function ChatModelDropdownPreview({
  selectedModelId = CHAT_MODEL_GEMMA_4,
  compact = false,
  className,
}: {
  selectedModelId?: string;
  compact?: boolean;
  className?: string;
}) {
  const previewModels = CHAT_MODELS.filter((model) => !model.nonProductionOnly);

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none w-full min-w-0 rounded-md border border-border bg-popover shadow-md dark:bg-[#2A2A2A]",
        compact ? "max-w-[min(220px,100%)] pt-2.5 pb-2.5 pl-2 pr-2" : "min-w-[260px] pt-4 pb-4 pl-3 pr-3",
        className
      )}
    >
      <ul className="flex flex-col">
        {previewModels.map((model) => {
          const isSelected = model.id === selectedModelId;
          return (
            <li
              key={model.id}
              data-slot="dropdown-menu-item"
              className={cn(
                "relative flex cursor-default items-start gap-2 rounded-sm text-left",
                compact ? "py-1.5 pr-7" : "py-2 pr-8",
                isSelected ? "text-primary" : "text-foreground"
              )}
            >
              <ModelSelectorLogo
                provider={model.provider}
                className={cn("mt-0.5 shrink-0", compact ? "size-3.5" : "size-4")}
              />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
                <ModelSelectorName
                  className={cn("font-medium", compact ? "text-xs" : "text-sm")}
                >
                  {model.name}
                </ModelSelectorName>
                <span
                  className={cn(
                    "leading-snug text-muted-foreground text-pretty",
                    compact ? "text-[0.625rem] sm:text-[0.6875rem]" : "text-xs"
                  )}
                >
                  {model.description}
                </span>
              </div>
              {isSelected ? (
                <span
                  className={cn(
                    "pointer-events-none absolute top-1/2 flex shrink-0 -translate-y-1/2 items-center justify-center rounded-full border border-primary bg-primary",
                    compact ? "right-1.5 size-2.5" : "right-2 size-3"
                  )}
                  aria-hidden
                />
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ComposerInputArea({
  variant,
  inputPreview,
  placeholderText,
}: {
  variant: ChatComposerPreviewVariant;
  inputPreview?: string;
  placeholderText?: string;
}) {
  if (variant === "skeleton") {
    return (
      <div className="flex min-h-[64px] flex-col gap-2 px-3 pt-3 pb-1">
        <Skeleton className="h-4 w-[78%] rounded-md" />
        <Skeleton className="h-4 w-[52%] rounded-md" />
      </div>
    );
  }

  if (inputPreview) {
    return (
      <p className="min-h-[64px] whitespace-pre-wrap px-3 pt-3 pb-1 text-left text-sm leading-relaxed text-foreground md:text-[0.9375rem]">
        {inputPreview}
      </p>
    );
  }

  if (placeholderText) {
    return (
      <p className="min-h-[64px] px-3 pt-3 pb-1 text-left text-sm leading-relaxed text-muted-foreground md:text-[0.9375rem]">
        {placeholderText}
      </p>
    );
  }

  return <div className="min-h-[64px]" />;
}

function ComposerFooter({
  variant,
  programLabel,
  modelLabel,
}: {
  variant: ChatComposerPreviewVariant;
  programLabel: string;
  modelLabel: string;
}) {
  if (variant === "skeleton") {
    return (
      <InputGroupAddon align="block-end" className="justify-between pt-0">
        <Skeleton className="h-8 w-12 rounded-lg" />
        <div className="flex items-center gap-1">
          <Skeleton className="h-8 w-20 rounded-lg" />
          <Skeleton className="size-8 shrink-0 rounded-full" />
        </div>
      </InputGroupAddon>
    );
  }

  return (
    <InputGroupAddon align="block-end" className="justify-between pt-0">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        tabIndex={-1}
        className={cn(
          "h-8 min-w-0 max-w-[180px] overflow-hidden sm:max-w-[260px] md:max-w-[300px]",
          selectorTriggerClassName
        )}
      >
        <span className="block min-w-0 truncate text-left text-sm md:text-[0.9375rem]">
          {programLabel}
        </span>
      </Button>
      <div className="flex min-w-0 shrink items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          tabIndex={-1}
          className={cn(
            "h-8 min-w-0 max-w-[140px] overflow-hidden sm:max-w-[180px]",
            selectorTriggerClassName
          )}
        >
          <span className="block min-w-0 truncate text-left text-sm md:text-[0.9375rem]">
            {modelLabel}
          </span>
        </Button>
        <InputGroupButton
          type="button"
          variant="default"
          size="icon-sm"
          tabIndex={-1}
          className="shrink-0 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
          aria-hidden
        >
          <HugeiconsIcon icon={ArrowUp02Icon} strokeWidth={2} />
        </InputGroupButton>
      </div>
    </InputGroupAddon>
  );
}

export function ChatComposerPreview({
  variant = "default",
  programLabel = "All",
  modelLabel = "Gemma 4",
  inputPreview,
  placeholderText,
  className,
}: ChatComposerPreviewProps) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none flex w-full min-w-0 flex-col text-left",
        className
      )}
    >
      <InputGroup
        className={cn(
          "h-auto min-h-0 flex-col rounded-[10px] border-border bg-secondary shadow-none dark:bg-secondary",
          "has-[[data-slot=input-group-control]:focus-visible]:ring-0"
        )}
      >
        <ComposerInputArea
          variant={variant}
          inputPreview={inputPreview}
          placeholderText={placeholderText}
        />
        <ComposerFooter
          variant={variant}
          programLabel={programLabel}
          modelLabel={modelLabel}
        />
      </InputGroup>
    </div>
  );
}

/** Loading shell — skeleton composer without dropdown. */
export function ChatComposerLoadingPreview({ className }: { className?: string }) {
  return (
    <ChatComposerPreview
      variant="skeleton"
      className={cn("mx-auto max-w-[600px]", className)}
    />
  );
}
