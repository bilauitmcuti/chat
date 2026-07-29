"use client";

import { cn } from "@/lib/utils";

interface SuggestionCarouselProps {
  suggestions: string[];
  disabled: boolean;
  onSelect: (suggestion: string) => void;
  className?: string;
}

export function SuggestionCarousel({
  suggestions,
  disabled,
  onSelect,
  className,
}: SuggestionCarouselProps) {
  return (
    <div
      className={cn(
        "mb-2 min-w-0 w-full max-w-full overflow-hidden -mx-4 md:mx-0",
        className
      )}
    >
      <div className="scroll-fade-x no-scrollbar w-full min-w-0 overflow-x-auto">
        <div className="flex w-max gap-2 px-6 py-0.5">
          {suggestions.map((suggestion) => (
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
