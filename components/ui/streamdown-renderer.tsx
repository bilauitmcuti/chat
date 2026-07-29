"use client";

import type { Components } from "react-markdown";
import { Streamdown } from "streamdown";
import "streamdown/styles.css";
import { Component, type ReactNode, useSyncExternalStore } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { contentToMarkdown } from "@/lib/chat/markdown-suitability";
import { cn } from "@/lib/utils";

export interface StreamdownRendererProps {
  content: string;
  className?: string;
  isComplete?: boolean;
}

/** Word-by-word blur while the assistant reply streams in. */
export const CHAT_STREAM_ANIMATION = {
  animation: "blurIn",
  duration: 80,
  easing: "ease-out",
  sep: "word",
} as const;

/** Faster blurIn for Copy / thumbs after the answer stream completes. */
export const CHAT_ACTION_APPEAR = {
  durationMs: 150,
  staggerMs: 30,
} as const;

function subscribeReducedMotion(onStoreChange: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", onStoreChange);
  return () => mq.removeEventListener("change", onStoreChange);
}

function getReducedMotionSnapshot() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getReducedMotionServerSnapshot() {
  return false;
}

function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot
  );
}

function PlainTextFallback({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  const trimmed = content.trim();
  if (!trimmed) return null;
  return (
    <p
      className={cn(
        "text-sm leading-relaxed whitespace-pre-wrap break-words md:text-[0.9375rem]",
        className
      )}
    >
      {trimmed}
    </p>
  );
}

class StreamdownErrorBoundary extends Component<
  { content: string; className?: string; children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    if (process.env.NODE_ENV === "development") {
      console.error("Streamdown render failed:", error);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <PlainTextFallback
          content={this.props.content}
          className={this.props.className}
        />
      );
    }
    return this.props.children;
  }
}

function isSafeExternalHref(href: string | undefined): boolean {
  if (!href?.trim()) return false;
  try {
    const protocol = new URL(href, "https://bilauitmcuti.com").protocol;
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}

/** Behavioral overrides only — typography comes from `.typeset` / `.typeset-chat`. */
const COMPONENTS: Components = {
  h1: ({ children }) => <h1>{children}</h1>,
  h2: ({ children }) => <h2>{children}</h2>,
  h3: ({ children }) => <h3>{children}</h3>,
  h4: ({ children }) => <h4>{children}</h4>,
  h5: ({ children }) => <h5>{children}</h5>,
  h6: ({ children }) => <h6>{children}</h6>,
  a: ({ children, href }) => {
    if (!isSafeExternalHref(href)) {
      return <span>{children}</span>;
    }
    return (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  },
  img: () => null,
  table: ({ children }) => (
    <div className="not-typeset mt-2 overflow-hidden rounded-lg border border-border first:mt-0">
      <Table>{children}</Table>
    </div>
  ),
  thead: ({ children }) => <TableHeader>{children}</TableHeader>,
  tbody: ({ children }) => <TableBody>{children}</TableBody>,
  tr: ({ children }) => <TableRow>{children}</TableRow>,
  th: ({ children }) => (
    <TableHead className="text-xs font-semibold">{children}</TableHead>
  ),
  td: ({ children }) => <TableCell className="text-xs">{children}</TableCell>,
};

export function StreamdownRenderer({
  content,
  className,
  isComplete = true,
}: StreamdownRendererProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const trimmed = content.trim();
  if (!trimmed) return null;

  const markdown = contentToMarkdown(trimmed);
  const isStreaming = !isComplete;
  const shouldAnimate = isStreaming && !prefersReducedMotion;

  return (
    <StreamdownErrorBoundary content={trimmed} className={className}>
      <div className={cn("typeset typeset-chat break-words", className)}>
        <Streamdown
          mode={isStreaming ? "streaming" : "static"}
          isAnimating={shouldAnimate}
          animated={shouldAnimate ? CHAT_STREAM_ANIMATION : false}
          components={COMPONENTS}
          disallowedElements={["img"]}
          unwrapDisallowed
        >
          {markdown}
        </Streamdown>
      </div>
    </StreamdownErrorBoundary>
  );
}
