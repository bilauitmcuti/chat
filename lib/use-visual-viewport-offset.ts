'use client';

import { useEffect } from 'react';

const VV_BOTTOM_OFFSET_VAR = '--vv-bottom-offset';

function updateVisualViewportOffset(): void {
  const vv = window.visualViewport;
  if (!vv) {
    document.documentElement.style.setProperty(VV_BOTTOM_OFFSET_VAR, '0px');
    return;
  }

  const offset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
  document.documentElement.style.setProperty(VV_BOTTOM_OFFSET_VAR, `${offset}px`);
}

function resetVisualViewportOffset(): void {
  document.documentElement.style.setProperty(VV_BOTTOM_OFFSET_VAR, '0px');
}

/** Pins bottom-fixed drawers to the visible viewport when the mobile keyboard opens. */
export function useVisualViewportOffset(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      resetVisualViewportOffset();
      return;
    }

    const vv = window.visualViewport;
    if (!vv) return;

    updateVisualViewportOffset();
    vv.addEventListener('resize', updateVisualViewportOffset);
    vv.addEventListener('scroll', updateVisualViewportOffset);

    return () => {
      vv.removeEventListener('resize', updateVisualViewportOffset);
      vv.removeEventListener('scroll', updateVisualViewportOffset);
      resetVisualViewportOffset();
    };
  }, [enabled]);
}
