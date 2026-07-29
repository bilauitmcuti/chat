'use client';

import { ThemeProvider as NextThemesProvider, useTheme } from 'next-themes';
import { useEffect, type ComponentProps } from 'react';

const THEME_COLOR = {
  light: '#ffffff',
  dark: '#1a1a1a',
} as const;

function readStoredTheme(): string | null {
  try {
    return localStorage.getItem('theme');
  } catch {
    return null;
  }
}

function isFollowingSystem(stored: string | null): boolean {
  return !stored || stored === 'system';
}

/**
 * Safari + App Router: next-themes can hydrate with theme === undefined, so its
 * prefers-color-scheme listener never re-applies classes (it requires theme === "system").
 * Repair that and keep theme-color / html classes in sync with device appearance.
 */
function SystemThemeSync() {
  const { theme, setTheme, resolvedTheme } = useTheme();

  useEffect(() => {
    if (isFollowingSystem(readStoredTheme())) {
      setTheme('system');
    }
  }, [setTheme]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');

    function syncToDevice() {
      if (!isFollowingSystem(readStoredTheme())) return;
      setTheme('system');
    }

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', syncToDevice);
      return () => media.removeEventListener('change', syncToDevice);
    }

    media.addListener(syncToDevice);
    return () => media.removeListener(syncToDevice);
  }, [setTheme]);

  useEffect(() => {
    if (resolvedTheme !== 'light' && resolvedTheme !== 'dark') return;
    const color = THEME_COLOR[resolvedTheme];
    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
      if (meta.getAttribute('content') !== color) {
        meta.setAttribute('content', color);
      }
    });
  }, [resolvedTheme, theme]);

  return null;
}

export function ThemeProvider({
  children,
  ...props
}: ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider {...props}>
      <SystemThemeSync />
      {children}
    </NextThemesProvider>
  );
}
