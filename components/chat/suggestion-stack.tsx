"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const DESKTOP_SUGGESTION_LIMIT = 5;

interface SuggestionStackProps {
  suggestions: string[];
  disabled: boolean;
  onSelect: (suggestion: string) => void;
  className?: string;
  limit?: number;
}

export function SuggestionStack({
  suggestions,
  disabled,
  onSelect,
  className,
  limit = DESKTOP_SUGGESTION_LIMIT,
}: SuggestionStackProps) {
  const stacked = suggestions.slice(0, limit);

  return (
    <div className={cn("min-w-0 w-full max-w-full mt-2", className)}>
      <div className="flex flex-col gap-1">
        {stacked.map((suggestion) => (
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
