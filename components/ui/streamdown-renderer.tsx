"use client";

import type { Components } from "react-markdown";
import { Streamdown } from "streamdown";
import "streamdown/styles.css";
import { Component, type ReactNode, useSyncExternalStore } from "react";

import { ScrollArea } from "@/components/ui/scroll-area";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { contentToMarkdown } from "@/lib/chat/markdown-suitability";
import { cn } from "@/lib/utils";
import { CHAT_STREAM_ANIMATION } from "@/components/ui/streamdown-motion";

const MARKER_ONLY_FRAGMENT = /^(?:[-*+]|\d+[.)]|#{1,6}|>|\|)+$/;

const TABLE_CELL_MAX =
  "h-auto min-h-10 max-w-[12rem] sm:max-w-[16rem] whitespace-normal break-words align-top";

export interface StreamdownRendererProps {
  content: string;
  className?: string;
  isComplete?: boolean;
}

export {
  CHAT_ACTION_APPEAR,
  CHAT_STREAM_ANIMATION,
} from "@/components/ui/streamdown-motion";

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
      <ScrollArea className="w-full">
        <table
          data-slot="table"
          className="w-max min-w-full caption-bottom text-sm"
        >
          {children}
        </table>
      </ScrollArea>
    </div>
  ),
  thead: ({ children }) => <TableHeader>{children}</TableHeader>,
  tbody: ({ children }) => <TableBody>{children}</TableBody>,
  tr: ({ children }) => <TableRow>{children}</TableRow>,
  th: ({ children }) => (
    <TableHead className={cn("text-xs font-semibold", TABLE_CELL_MAX)}>
      {children}
    </TableHead>
  ),
  td: ({ children }) => (
    <TableCell className={cn("text-xs", TABLE_CELL_MAX)}>{children}</TableCell>
  ),
};

export function StreamdownRenderer({
  content,
  className,
  isComplete = true,
}: StreamdownRendererProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const trimmed = content.trim();
  if (!trimmed) return null;

  const isStreaming = !isComplete;
  // A structure-only first token ("-", "1.", "##") would paint a stray marker.
  if (isStreaming && MARKER_ONLY_FRAGMENT.test(trimmed)) return null;

  const markdown = contentToMarkdown(trimmed);
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
