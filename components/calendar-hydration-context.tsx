"use client";

import { createContext, useContext } from "react";

const CalendarHydrationVersionContext = createContext<number>(0);

export function CalendarHydrationProvider({
  hydrationVersion,
  children,
}: {
  hydrationVersion: number;
  children: React.ReactNode;
}) {
  return (
    <CalendarHydrationVersionContext.Provider value={hydrationVersion}>
      {children}
    </CalendarHydrationVersionContext.Provider>
  );
}

/** Pass to `useSyncExternalStore` as the server snapshot so hydration matches RSC-seeded store. */
export function useCalendarHydrationVersion(): number {
  return useContext(CalendarHydrationVersionContext);
}
