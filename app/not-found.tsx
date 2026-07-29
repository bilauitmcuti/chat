import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Page not found — Bila UiTM Cuti Chat",
  description: "The page you are looking for does not exist.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-12 text-foreground">
      <div className="flex w-full max-w-md flex-col items-center gap-6 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Page not found
        </h1>
        <p className="text-sm text-muted-foreground">
          Halaman ini tidak wujud. The page you requested could not be found.
        </p>
        <Button render={<Link href="/" />} nativeButton={false} variant="outline">
          Back to chat
        </Button>
      </div>
    </main>
  );
}
