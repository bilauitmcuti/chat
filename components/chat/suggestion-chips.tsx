"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const CHIP_SKELETON_WIDTHS = [
  "w-28",
  "w-36",
  "w-24",
  "w-40",
  "w-32",
  "w-44",
  "w-28",
  "w-36",
] as const;

interface SuggestionChipsProps {
  suggestions: string[];
  disabled: boolean;
  onSelect: (suggestion: string) => void;
  className?: string;
  isLoading?: boolean;
}

export function SuggestionChips({
  suggestions,
  disabled,
  onSelect,
  className,
  isLoading = false,
}: SuggestionChipsProps) {
  return (
    <div
      className={cn(
        "mb-2 min-h-8 min-w-0 w-full max-w-full overflow-hidden -mx-4 md:mx-0",
        className
      )}
    >
      <div className="scroll-fade-x no-scrollbar w-full min-w-0 overflow-x-auto">
        <div className="flex w-max gap-2 px-6 py-0.5">
          {isLoading
            ? CHIP_SKELETON_WIDTHS.map((width, index) => (
                <Skeleton
                  key={index}
                  className={cn(
                    "h-7 shrink-0 rounded-full border border-transparent",
                    width
                  )}
                  aria-hidden
                />
              ))
            : suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  disabled={disabled}
                  onClick={() => onSelect(suggestion)}
                  className="shrink-0 text-xs px-3 py-1.5 rounded-full border border-border bg-secondary/50 md:hover:bg-secondary text-foreground whitespace-nowrap disabled:opacity-40 disabled:pointer-events-none disabled:cursor-not-allowed"
                >
                  {suggestion}
                </button>
              ))}
        </div>
      </div>
    </div>
  );
}
