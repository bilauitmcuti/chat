"use client";

import {
  Collapsible,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useControllableState } from "@/hooks/use-controllable-state";
import { cn } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import type { ComponentProps, ReactNode } from "react";
import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { formatThoughtCompletedLabel, thinkingDurationSecFromTimestamp } from "@/lib/chat/reasoning-gate";
import { shouldScheduleAutoCollapse } from "@/lib/chat/reasoning-collapse";

export { shouldScheduleAutoCollapse } from "@/lib/chat/reasoning-collapse";

interface ReasoningContextValue {
  isStreaming: boolean;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  duration: number | undefined;
}

const ReasoningContext = createContext<ReasoningContextValue | null>(null);

export const useReasoning = () => {
  const context = useContext(ReasoningContext);
  if (!context) {
    throw new Error("Reasoning components must be used within Reasoning");
  }
  return context;
};

export type ReasoningProps = ComponentProps<typeof Collapsible> & {
  isStreaming?: boolean;
  /** When false, render a static thinking row without collapse/chevron. */
  collapsible?: boolean;
  /** Open the reasoning body while thinking (before answer completes). */
  expandReasoning?: boolean;
  /** Collapse reasoning after the final answer is complete. */
  collapseWhen?: boolean;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  duration?: number;
};

const AUTO_CLOSE_DELAY = 1000;

export const Reasoning = memo(
  ({
    className,
    isStreaming = false,
    collapsible = true,
    expandReasoning = false,
    collapseWhen = false,
    open,
    defaultOpen,
    onOpenChange,
    duration: durationProp,
    children,
    ...props
  }: ReasoningProps) => {
    const resolvedDefaultOpen = defaultOpen ?? false;
    const isExplicitlyClosed = defaultOpen === false;

    const [isOpen, setIsOpen] = useControllableState<boolean>({
      defaultProp: resolvedDefaultOpen,
      onChange: onOpenChange,
      prop: open,
    });
    const [duration, setDuration] = useControllableState<number | undefined>({
      defaultProp: undefined,
      prop: durationProp,
    });

    const userDismissedDuringStreamRef = useRef(false);
    const userOpenedManuallyRef = useRef(false);
    const prevCollapseWhenRef = useRef(false);
    const startTimeRef = useRef<number | null>(null);
    const hasCollapsedAfterAnswerRef = useRef(false);

    useEffect(() => {
      if (isStreaming) {
        userDismissedDuringStreamRef.current = false;
        userOpenedManuallyRef.current = false;
        hasCollapsedAfterAnswerRef.current = false;
        prevCollapseWhenRef.current = false;
      }
    }, [isStreaming]);

    useEffect(() => {
      if (durationProp !== undefined) return;
      if (isStreaming) {
        if (startTimeRef.current === null) {
          startTimeRef.current = Date.now();
        }
      } else if (startTimeRef.current !== null) {
        setDuration(thinkingDurationSecFromTimestamp(startTimeRef.current, Date.now()));
        startTimeRef.current = null;
      }
    }, [durationProp, isStreaming, setDuration]);

    useEffect(() => {
      if (
        collapsible &&
        expandReasoning &&
        !isOpen &&
        !isExplicitlyClosed &&
        !userDismissedDuringStreamRef.current
      ) {
        setIsOpen(true);
      }
    }, [collapsible, expandReasoning, isOpen, setIsOpen, isExplicitlyClosed]);

    useEffect(() => {
      const prevCollapseWhen = prevCollapseWhenRef.current;
      const shouldSchedule = shouldScheduleAutoCollapse({
        collapsible,
        collapseWhen,
        prevCollapseWhen,
        isOpen: Boolean(isOpen),
        hasCollapsedAfterAnswer: hasCollapsedAfterAnswerRef.current,
        userOpenedManually: userOpenedManuallyRef.current,
      });
      prevCollapseWhenRef.current = collapseWhen;

      if (!shouldSchedule) return;

      const timer = setTimeout(() => {
        setIsOpen(false);
        hasCollapsedAfterAnswerRef.current = true;
      }, AUTO_CLOSE_DELAY);

      return () => clearTimeout(timer);
    }, [collapsible, collapseWhen, isOpen, setIsOpen]);

    const handleOpenChange = useCallback(
      (newOpen: boolean) => {
        if (newOpen) {
          userOpenedManuallyRef.current = true;
        } else if (isStreaming) {
          userDismissedDuringStreamRef.current = true;
        }
        setIsOpen(newOpen);
      },
      [isStreaming, setIsOpen]
    );

    const contextValue = useMemo(
      () => ({ duration, isOpen, isStreaming, setIsOpen }),
      [duration, isOpen, isStreaming, setIsOpen]
    );

    return (
      <ReasoningContext.Provider value={contextValue}>
        {collapsible ? (
          <Collapsible
            {...props}
            className={cn("not-prose mb-4", className)}
            onOpenChange={(open) => handleOpenChange(open)}
            open={isOpen}
          >
            {children}
          </Collapsible>
        ) : (
          <div className={cn("not-prose mb-4", className)}>{children}</div>
        )}
      </ReasoningContext.Provider>
    );
  }
);

export type ReasoningTriggerProps = ComponentProps<
  typeof CollapsibleTrigger
> & {
  getThinkingMessage?: (
    isStreaming: boolean,
    duration?: number,
    showDurationLabel?: boolean
  ) => ReactNode;
  showChevron?: boolean;
  /** When true after completion, show "Thought for X …" on the thinking row. */
  showDurationLabel?: boolean;
};

const defaultGetThinkingMessage = (
  isStreaming: boolean,
  duration?: number,
  showDurationLabel = false
) => {
  if (isStreaming) {
    return <span className="shimmer text-muted-foreground">Thinking…</span>;
  }
  if (showDurationLabel && duration !== undefined) {
    return <span>{formatThoughtCompletedLabel(duration)}</span>;
  }
  return null;
};

const thinkingRowClassName =
  "flex w-full items-center gap-2 text-muted-foreground text-sm md:text-[0.9375rem]";

export const ReasoningTrigger = memo(
  ({
    className,
    children,
    getThinkingMessage = defaultGetThinkingMessage,
    showChevron = true,
    showDurationLabel = false,
    ...props
  }: ReasoningTriggerProps) => {
    const { isStreaming, isOpen, duration } = useReasoning();

    const message =
      getThinkingMessage(isStreaming, duration, showDurationLabel) ??
      defaultGetThinkingMessage(isStreaming, duration, showDurationLabel);

    const resolvedMessage =
      message ??
      (showChevron && isStreaming ? (
        <span className="shimmer text-muted-foreground">Thinking…</span>
      ) : null);

    const label = (
      <span className="flex min-w-0 items-center gap-1.5 text-left">
        {resolvedMessage}
        {showChevron && resolvedMessage ? (
          <span className="relative size-4 shrink-0" aria-hidden>
            <HugeiconsIcon
              icon={ArrowRight01Icon}
              strokeWidth={2}
              className={cn(
                "absolute inset-0 size-4 transition-opacity duration-[160ms] ease-out",
                isOpen ? "opacity-0" : "opacity-100"
              )}
            />
            <HugeiconsIcon
              icon={ArrowDown01Icon}
              strokeWidth={2}
              className={cn(
                "absolute inset-0 size-4 transition-opacity duration-[160ms] ease-out",
                isOpen ? "opacity-100" : "opacity-0"
              )}
            />
          </span>
        ) : null}
      </span>
    );

    if (!showChevron || !resolvedMessage) {
      return (
        <div className={cn(thinkingRowClassName, className)}>
          {children ?? resolvedMessage}
        </div>
      );
    }

    return (
      <CollapsibleTrigger
        className={cn(
          thinkingRowClassName,
          "transition-colors md:hover:text-foreground",
          className
        )}
        {...props}
      >
        {children ?? label}
      </CollapsibleTrigger>
    );
  }
);

Reasoning.displayName = "Reasoning";
ReasoningTrigger.displayName = "ReasoningTrigger";
