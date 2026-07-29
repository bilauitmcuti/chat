import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  calendarTitleH1Class,
  calendarTitleH1Style,
} from "@/lib/calendar-title-styles";

export const metadata: Metadata = {
  title: "Page not found - Bila UiTM Cuti",
  description: "The page you are looking for does not exist on Bila UiTM Cuti.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-12 text-foreground">
      <div className="flex w-full max-w-md flex-col items-center gap-6 text-center">
        <h1
          className={`${calendarTitleH1Class} text-4xl sm:text-5xl`}
          style={calendarTitleH1Style}
        >
          Bila <span className="text-[#8b5cf6]">UiTM</span> Cuti
        </h1>

        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">
            Halaman ini tidak wujud. The page you requested could not be found.
          </p>
        </div>

        <Button render={<Link href="/" />} nativeButton={false} variant="outline">
          Back To Calendar
        </Button>
      </div>
    </main>
  );
}
