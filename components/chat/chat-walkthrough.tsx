"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import {
  drawerOutlineButtonClassName,
  drawerPrimaryButtonClassName,
} from "@/components/ui/drawer";
import { ResponsiveOverlayShell } from "@/components/ui/responsive-overlay-shell";
import {
  WALKTHROUGH_LABEL_FINISH,
  WALKTHROUGH_LABEL_NEXT,
  WALKTHROUGH_LABEL_SKIP,
  WALKTHROUGH_SLIDES,
} from "@/components/chat/walkthrough-slides";
import { WalkthroughSlidePreview } from "@/components/chat/walkthrough-slide-preview";
import {
  readWalkthroughSeen,
  writeWalkthroughSeen,
} from "@/lib/chat/walkthrough-storage";
import { usePhoneViewport } from "@/lib/use-mobile-viewport";
import { cn } from "@/lib/utils";

const OPEN_DELAY_MS = 300;
const LAST_STEP_INDEX = WALKTHROUGH_SLIDES.length - 1;

function WalkthroughStepIndicator({
  step,
  onStepSelect,
}: {
  step: number;
  onStepSelect: (index: number) => void;
}) {
  return (
    <div
      data-slot="drawer-no-drag"
      className="flex items-center justify-center gap-0"
      role="group"
      aria-label={`Step ${step + 1} of ${WALKTHROUGH_SLIDES.length}`}
    >
      {WALKTHROUGH_SLIDES.map((_, index) => (
        <button
          key={index}
          type="button"
          tabIndex={-1}
          className="flex size-6 items-center justify-center rounded-full outline-none focus:outline-none"
          aria-label={`Go to step ${index + 1}`}
          aria-current={index === step ? "step" : undefined}
          onClick={() => onStepSelect(index)}
        >
          <span
            className={cn(
              "size-2 rounded-full transition-colors",
              index === step ? "bg-foreground" : "bg-muted-foreground/30"
            )}
          />
        </button>
      ))}
    </div>
  );
}

interface WalkthroughActionsProps {
  step: number;
  isMobile: boolean;
  onSkip: () => void;
  onNext: () => void;
}

function WalkthroughActions({
  step,
  isMobile,
  onSkip,
  onNext,
}: WalkthroughActionsProps) {
  const isLastStep = step === LAST_STEP_INDEX;
  const primaryLabel = isLastStep ? WALKTHROUGH_LABEL_FINISH : WALKTHROUGH_LABEL_NEXT;

  if (isMobile) {
    return (
      <div data-slot="drawer-no-drag" className="flex w-full flex-row gap-2">
        <Button
          type="button"
          variant="outline"
          className={cn(drawerOutlineButtonClassName, "min-w-0 flex-1 basis-0 !w-auto")}
          onClick={onSkip}
        >
          {WALKTHROUGH_LABEL_SKIP}
        </Button>
        <Button
          type="button"
          className={cn(drawerPrimaryButtonClassName, "min-w-0 flex-1 basis-0 !w-auto")}
          onClick={onNext}
        >
          {primaryLabel}
        </Button>
      </div>
    );
  }

  return (
    <DialogFooter className="gap-2 sm:justify-end sm:[&>*]:flex-none">
      <Button type="button" variant="outline" onClick={onSkip}>
        {WALKTHROUGH_LABEL_SKIP}
      </Button>
      <Button type="button" onClick={onNext}>
        {primaryLabel}
      </Button>
    </DialogFooter>
  );
}

export function ChatWalkthrough() {
  const isMobile = usePhoneViewport();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (readWalkthroughSeen()) return;
    const timer = window.setTimeout(() => setOpen(true), OPEN_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  const dismiss = useCallback(() => {
    writeWalkthroughSeen();
    setOpen(false);
  }, []);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        dismiss();
        return;
      }
      setOpen(true);
    },
    [dismiss]
  );

  const handleSkip = useCallback(() => {
    dismiss();
  }, [dismiss]);

  const handleNext = useCallback(() => {
    if (step >= LAST_STEP_INDEX) {
      dismiss();
      return;
    }
    setStep((current) => current + 1);
  }, [step, dismiss]);

  const handleStepSelect = useCallback((index: number) => {
    setStep(index);
  }, []);

  const slide = WALKTHROUGH_SLIDES[step]!;

  return (
    <ResponsiveOverlayShell
      open={open}
      onOpenChange={handleOpenChange}
      isMobile={isMobile}
      title={slide.title}
      description={
        <span className="block min-h-[2.75rem] text-pretty">{slide.description}</span>
      }
    >
      <div className="flex flex-col gap-3">
        <WalkthroughSlidePreview kind={slide.preview} />
        <WalkthroughStepIndicator step={step} onStepSelect={handleStepSelect} />
        <WalkthroughActions
          step={step}
          isMobile={isMobile}
          onSkip={handleSkip}
          onNext={handleNext}
        />
      </div>
    </ResponsiveOverlayShell>
  );
}
