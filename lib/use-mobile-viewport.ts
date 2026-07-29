'use client';

import { useSyncExternalStore } from 'react';

/** Matches Tailwind `md` — phone-sized viewports use drawer instead of grid tooltips. */
export const MOBILE_VIEWPORT_QUERY = '(max-width: 768px)';

/**
 * Below Tailwind `md` — phones only.
 * Rating/feedback: drawer on phone, dialog on tablet + desktop.
 */
export const PHONE_VIEWPORT_QUERY = '(max-width: 767px)';

/** Matches Tailwind `lg` — desktop chat composer uses wider empty-state placeholder. */
export const DESKTOP_VIEWPORT_QUERY = '(min-width: 1024px)';

function getSnapshot(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(MOBILE_VIEWPORT_QUERY).matches;
}

function getServerSnapshot(): boolean {
  return false;
}

function subscribe(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const mql = window.matchMedia(MOBILE_VIEWPORT_QUERY);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

export function useMobileViewport(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

function getPhoneSnapshot(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(PHONE_VIEWPORT_QUERY).matches;
}

function subscribePhone(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const mql = window.matchMedia(PHONE_VIEWPORT_QUERY);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

/** True on phone widths only — tablet (≥768px) is treated like desktop. */
export function usePhoneViewport(): boolean {
  return useSyncExternalStore(subscribePhone, getPhoneSnapshot, getServerSnapshot);
}

function getDesktopSnapshot(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(DESKTOP_VIEWPORT_QUERY).matches;
}

function subscribeDesktop(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const mql = window.matchMedia(DESKTOP_VIEWPORT_QUERY);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

export function useDesktopViewport(): boolean {
  return useSyncExternalStore(subscribeDesktop, getDesktopSnapshot, () => false);
}
