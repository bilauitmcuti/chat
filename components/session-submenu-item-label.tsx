'use client';

import { getSessionLabelAndIdParts } from '@/lib/data';

export interface SessionSubmenuItemLabelProps {
  session: { id: string; label: string; group: 'A' | 'B' };
}

/** Session row text: date range on first line, id on second (all breakpoints when splittable). */
export function SessionSubmenuItemLabel({ session }: SessionSubmenuItemLabelProps) {
  const parts = getSessionLabelAndIdParts(session);
  if (!parts.canSplit) {
    return <span className="min-w-0 flex-1 text-balance font-medium text-sm">{parts.singleLine}</span>;
  }
  return (
    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className="text-balance font-medium text-sm">{parts.body}</span>
      <span className="session-submenu-session-id text-xs tabular-nums text-muted-foreground group-focus/dropdown-menu-item:!text-muted-foreground group-data-[highlighted]/dropdown-menu-item:!text-muted-foreground md:group-focus/dropdown-menu-item:!text-primary md:group-data-[highlighted]/dropdown-menu-item:!text-primary">
        {parts.id}
      </span>
    </span>
  );
}
