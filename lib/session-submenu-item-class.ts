import { cn } from '@/lib/utils';

/** Session rows in program dropdown: accent hover on desktop only; session id stays separate via .session-submenu-session-id. */
export function sessionSubmenuItemClass(isSelected: boolean) {
  return cn(
    'relative cursor-pointer items-start pl-8 bg-transparent',
    'focus:bg-transparent focus-visible:bg-transparent data-[highlighted]:bg-transparent',
    'md:focus:bg-accent md:focus-visible:bg-accent md:data-[highlighted]:bg-accent',
    /* Inherit row color except .session-submenu-session-id (id color handled in SessionSubmenuItemLabel) */
    'focus:[&_*:not(.session-submenu-session-id)]:!text-inherit data-[highlighted]:[&_*:not(.session-submenu-session-id)]:!text-inherit',
    isSelected
      ? 'text-primary focus:text-primary data-[highlighted]:text-primary'
      : 'text-foreground focus:text-foreground data-[highlighted]:text-foreground'
  );
}
