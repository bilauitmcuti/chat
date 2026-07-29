"use client";

import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  KeyboardAwareDrawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  drawerBodyClassName,
  drawerBodyColumnClassName,
  drawerBodyRegionClassName,
  responsiveDrawerBodyClassName,
  responsiveDrawerDescriptionClassName,
  responsiveDrawerShellClassName,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

interface ResponsiveOverlayShellProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isMobile: boolean;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  scrollClassName?: string;
  desktopBodyClassName?: string;
}

export function ResponsiveOverlayShell({
  open,
  onOpenChange,
  isMobile,
  title,
  description,
  children,
  scrollClassName,
  desktopBodyClassName,
}: ResponsiveOverlayShellProps) {
  if (isMobile) {
    return (
      <KeyboardAwareDrawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent keyboardAware className={responsiveDrawerShellClassName}>
          <div
            className={cn(
              drawerBodyClassName,
              responsiveDrawerBodyClassName,
              drawerBodyColumnClassName,
              "gap-3"
            )}
          >
            <div data-slot="drawer-no-drag" className="w-full shrink-0">
              <DrawerTitle>{title}</DrawerTitle>
              {description ? (
                <DrawerDescription className={responsiveDrawerDescriptionClassName}>
                  {description}
                </DrawerDescription>
              ) : null}
            </div>
            <div
              data-slot="drawer-no-drag"
              className={cn(drawerBodyRegionClassName, scrollClassName)}
            >
              {children}
            </div>
          </div>
        </DrawerContent>
      </KeyboardAwareDrawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader className="gap-3 text-left">
          <DialogTitle className="text-left text-lg font-semibold leading-snug tracking-tight">
            {title}
          </DialogTitle>
          {description ? (
            <DialogDescription className="text-left text-sm text-muted-foreground">
              {description}
            </DialogDescription>
          ) : null}
        </DialogHeader>
        {desktopBodyClassName ? (
          <div className={desktopBodyClassName}>{children}</div>
        ) : (
          children
        )}
      </DialogContent>
    </Dialog>
  );
}
