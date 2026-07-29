'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ChatError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') console.error('Chat error:', error);

    // First try to recover the route automatically.
    const refreshTimer = window.setTimeout(() => {
      reset();
    }, 1200);

    // If it still fails, move user to home.
    const homeTimer = window.setTimeout(() => {
      router.replace('/');
    }, 3000);

    return () => {
      window.clearTimeout(refreshTimer);
      window.clearTimeout(homeTimer);
    };
  }, [error, reset, router]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border bg-card p-6 text-center">
        <span className="block text-sm font-medium text-foreground">Chat is temporarily unavailable.</span>
        <span className="mt-2 block text-sm text-muted-foreground">
          Refreshing automatically and returning to homepage.
        </span>
      </div>
    </div>
  );
}
