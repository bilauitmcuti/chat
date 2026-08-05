"use client";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const DESKTOP_SUGGESTION_LIMIT = 5;

const STACK_SKELETON_WIDTHS = [
  "w-[88%]",
  "w-[72%]",
  "w-[94%]",
  "w-[64%]",
  "w-[80%]",
] as const;

interface SuggestionStackProps {
  suggestions: string[];
  disabled: boolean;
  onSelect: (suggestion: string) => void;
  className?: string;
  limit?: number;
  isLoading?: boolean;
}

export function SuggestionStack({
  suggestions,
  disabled,
  onSelect,
  className,
  limit = DESKTOP_SUGGESTION_LIMIT,
  isLoading = false,
}: SuggestionStackProps) {
  const stacked = suggestions.slice(0, limit);

  return (
    <div className={cn("min-w-0 w-full max-w-full mt-2 min-h-[10rem]", className)}>
      <div className="flex flex-col gap-1">
        {isLoading
          ? STACK_SKELETON_WIDTHS.map((width, index) => (
              <div key={index} className="px-3 py-1.5" aria-hidden>
                <Skeleton className={cn("h-5 rounded-md", width)} />
              </div>
            ))
          : stacked.map((suggestion) => (
              <Button
                key={suggestion}
                type="button"
                variant="ghost"
                disabled={disabled}
                onClick={() => onSelect(suggestion)}
                className="h-auto w-full justify-start px-3 py-1.5 text-left text-sm font-normal whitespace-normal hover:bg-accent hover:text-foreground dark:hover:bg-accent"
              >
                {suggestion}
              </Button>
            ))}
      </div>
    </div>
  );
}
