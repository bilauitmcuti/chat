import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

interface MenuOpenChangeDetails {
  reason?: string;
  cancel?: () => void;
}

const SUBMENU_CLOSE_IGNORE_REASONS = new Set(['sibling-open', 'focus-out']);

/** Root menu: always honour outside tap / escape even after submenu interaction. */
const ROOT_DISMISS_REASONS = new Set(['outside-press', 'escape-key']);

export function activateSessionSubmenu(
  key: string,
  setActiveSubmenu: Dispatch<SetStateAction<string | null>>,
  keepDropdownOpenRef: MutableRefObject<boolean>,
  switchingRef?: MutableRefObject<boolean>
) {
  keepDropdownOpenRef.current = true;
  if (switchingRef) {
    switchingRef.current = true;
    requestAnimationFrame(() => {
      switchingRef.current = false;
    });
  }
  setActiveSubmenu(key);
}

export function handleSessionSubmenuOpenChange(
  key: string,
  setActiveSubmenu: Dispatch<SetStateAction<string | null>>,
  open: boolean,
  details?: MenuOpenChangeDetails,
  switchingRef?: MutableRefObject<boolean>
) {
  if (open) {
    setActiveSubmenu(key);
    return;
  }
  if (switchingRef?.current) {
    details?.cancel?.();
    return;
  }
  if (details?.reason && SUBMENU_CLOSE_IGNORE_REASONS.has(details.reason)) {
    details?.cancel?.();
    return;
  }
  setActiveSubmenu((current) => (current === key ? null : current));
}

export function handleProgramDropdownRootOpenChange(
  open: boolean,
  details: MenuOpenChangeDetails | undefined,
  opts: {
    activeSubmenu: string | null;
    keepDropdownOpenRef: MutableRefObject<boolean>;
    setDropdownOpen: (open: boolean) => void;
    setActiveSubmenu: Dispatch<SetStateAction<string | null>>;
  }
) {
  const { activeSubmenu, keepDropdownOpenRef, setDropdownOpen, setActiveSubmenu } = opts;
  const reason = details?.reason;

  if (!open && reason && ROOT_DISMISS_REASONS.has(reason)) {
    keepDropdownOpenRef.current = false;
    setDropdownOpen(false);
    setActiveSubmenu(null);
    return;
  }

  if (!open && keepDropdownOpenRef.current) {
    keepDropdownOpenRef.current = false;
    setDropdownOpen(true);
    return;
  }

  if (!open && activeSubmenu && reason === 'item-press') {
    details?.cancel?.();
    return;
  }

  setDropdownOpen(open);
  if (!open) setActiveSubmenu(null);
}
