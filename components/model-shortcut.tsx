"use client";

import { useEffect } from "react";
import { isDesktopWindowsOrMac } from "@/components/theme-shortcut";

interface ModelShortcutProps {
  modelIds: readonly string[];
  selectedModelId: string;
  onSelect: (modelId: string) => void;
}

/**
 * Desktop Win/macOS: Ctrl+/ (Windows) or Cmd+/ (macOS) cycles the chat model.
 * Shortcut hint lives in the model trigger tooltip (Kbd), not inline in the composer.
 */
export function ModelShortcut({
  modelIds,
  selectedModelId,
  onSelect,
}: ModelShortcutProps) {
  useEffect(() => {
    if (!isDesktopWindowsOrMac()) return;
    if (modelIds.length < 2) return;

    function handleShortcut(event: KeyboardEvent) {
      if (event.repeat || event.defaultPrevented) return;
      // Primary modifier only: Ctrl (Windows) or Cmd (macOS).
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
      if (event.key !== "/" && event.code !== "Slash") return;

      event.preventDefault();
      const index = modelIds.indexOf(selectedModelId);
      const nextIndex = index < 0 ? 0 : (index + 1) % modelIds.length;
      const nextId = modelIds[nextIndex];
      if (nextId && nextId !== selectedModelId) onSelect(nextId);
    }

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [modelIds, selectedModelId, onSelect]);

  return null;
}
