"use client";

import { useEffect, useRef } from "react";
import { useMessageScroller } from "@/components/ui/message-scroller";
import type { ChatMessageItem, ChatStreamingDraft } from "@/components/chat/chat-utils";

interface ChatScrollSyncProps {
  messages: ChatMessageItem[];
  streamingDraft?: ChatStreamingDraft | null;
}

export function ChatScrollSync({ messages, streamingDraft = null }: ChatScrollSyncProps) {
  const { scrollToEnd } = useMessageScroller();
  const lastMessageIdRef = useRef<string | null>(null);
  const lastContentLengthRef = useRef(0);

  useEffect(() => {
    if (messages.length === 0) {
      lastMessageIdRef.current = null;
      lastContentLengthRef.current = 0;
      return;
    }

    const last = messages[messages.length - 1];
    const lastId = last.id;
    const contentLength =
      streamingDraft?.id === lastId ? streamingDraft.content.length : last.content.length;

    if (lastId !== lastMessageIdRef.current) {
      lastMessageIdRef.current = lastId;
      lastContentLengthRef.current = contentLength;

      if (last.role === "user") {
        scrollToEnd({ behavior: "smooth" });
      }
      return;
    }

    if (
      last.role === "assistant" &&
      last.isComplete === false &&
      contentLength !== lastContentLengthRef.current
    ) {
      lastContentLengthRef.current = contentLength;
      scrollToEnd({ behavior: "smooth" });
    }
  }, [messages, streamingDraft, scrollToEnd]);

  return null;
}
