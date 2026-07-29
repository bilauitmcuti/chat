'use client';

import { useTheme } from 'next-themes';
import { useEffect } from 'react';

interface NavigatorWithUserAgentData extends Navigator {
  userAgentData?: {
    platform?: string;
  };
}

function isDesktopWindowsOrMac(): boolean {
  if (typeof window === 'undefined') return false;

  const navigatorWithUserAgentData = navigator as NavigatorWithUserAgentData;
  const platform = navigatorWithUserAgentData.userAgentData?.platform ?? navigator.platform ?? '';
  const isSupportedPlatform = /Win|Mac/i.test(platform);
  const isMobileDevice = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  return isSupportedPlatform && !isMobileDevice;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;

  const tagName = target.tagName.toLowerCase();
  return tagName === 'input' || tagName === 'textarea' || target.isContentEditable;
}

export function ThemeShortcut() {
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    if (!isDesktopWindowsOrMac()) return;

    function handleShortcut(event: KeyboardEvent) {
      if (event.repeat || event.defaultPrevented) return;
      if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      if (event.key.toLowerCase() !== 'd') return;
      if (isTypingTarget(event.target)) return;

      // Instant snap for keyboard-initiated theme (100+/day frequency)
      document.documentElement.dataset.keyboardTheme = '1';
      setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
      window.setTimeout(() => {
        delete document.documentElement.dataset.keyboardTheme;
      }, 0);
    }

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [setTheme, resolvedTheme]);

  return null;
}
