'use client';

import { TooltipProvider } from '@/components/ui/tooltip';

export function TooltipProviderRoot({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TooltipProvider delay={0} closeDelay={0} timeout={400}>
      {children}
    </TooltipProvider>
  );
}
