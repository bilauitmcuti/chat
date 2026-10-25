"use client";

import { Button } from "@/components/ui/button";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { cn } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import { Download01Icon } from "@hugeicons/core-free-icons";
import type { ComponentProps, ReactNode } from "react";
import { useCallback } from "react";

export type ConversationProps = ComponentProps<typeof MessageScroller>;

export const Conversation = ({
  className,
  children,
  ...props
}: ConversationProps) => (
  <MessageScrollerProvider autoScroll>
    <MessageScroller
      className={cn("relative flex-1 overflow-y-hidden", className)}
      role="log"
      {...props}
    >
      {children}
    </MessageScroller>
  </MessageScrollerProvider>
);

export type ConversationContentProps = ComponentProps<
  typeof MessageScrollerContent
>;

export const ConversationContent = ({
  className,
  ...props
}: ConversationContentProps) => (
  <MessageScrollerViewport>
    <MessageScrollerContent
      className={cn("flex flex-col gap-8 p-4", className)}
      {...props}
    />
  </MessageScrollerViewport>
);

export type ConversationEmptyStateProps = ComponentProps<"div"> & {
  title?: string;
  description?: string;
  icon?: ReactNode;
};

export const ConversationEmptyState = ({
  className,
  title = "No messages yet",
  description = "Start a conversation to see messages here",
  icon,
  children,
  ...props
}: ConversationEmptyStateProps) => (
  <div
    className={cn(
      "flex size-full flex-col items-center justify-center gap-3 p-8 text-center",
      className
    )}
    {...props}
  >
    {children ?? (
      <>
        {icon && <div className="text-muted-foreground">{icon}</div>}
        <div className="flex flex-col gap-1">
          <h3 className="font-medium text-sm">{title}</h3>
          {description && (
            <p className="text-muted-foreground text-sm">{description}</p>
          )}
        </div>
      </>
    )}
  </div>
);

export type ConversationScrollButtonProps = ComponentProps<
  typeof MessageScrollerButton
>;

export const ConversationScrollButton = ({
  className,
  ...props
}: ConversationScrollButtonProps) => (
  <MessageScrollerButton className={className} {...props} />
);

interface ConversationMessage {
  role: string;
  parts: Array<{ type: string; text?: string }>;
}

const getMessageText = (message: ConversationMessage): string =>
  message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text ?? "")
    .join("");

export type ConversationDownloadProps = Omit<
  ComponentProps<typeof Button>,
  "onClick"
> & {
  messages: ConversationMessage[];
  filename?: string;
  formatMessage?: (message: ConversationMessage, index: number) => string;
};

const defaultFormatMessage = (message: ConversationMessage): string => {
  const roleLabel =
    message.role.charAt(0).toUpperCase() + message.role.slice(1);
  return `**${roleLabel}:** ${getMessageText(message)}`;
};

export const messagesToMarkdown = (
  messages: ConversationMessage[],
  formatMessage: (
    message: ConversationMessage,
    index: number
  ) => string = defaultFormatMessage
): string => messages.map((msg, i) => formatMessage(msg, i)).join("\n\n");

export const ConversationDownload = ({
  messages,
  filename = "conversation.md",
  formatMessage = defaultFormatMessage,
  className,
  children,
  ...props
}: ConversationDownloadProps) => {
  const handleDownload = useCallback(() => {
    const markdown = messagesToMarkdown(messages, formatMessage);
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }, [messages, filename, formatMessage]);

  return (
    <Button
      className={cn(
        "absolute top-4 right-4 rounded-full dark:bg-background dark:hover:bg-muted",
        className
      )}
      onClick={handleDownload}
      size="icon"
      type="button"
      variant="outline"
      {...props}
    >
      {children ?? <HugeiconsIcon icon={Download01Icon} strokeWidth={2} />}
    </Button>
  );
};
