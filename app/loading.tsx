import { Skeleton } from "@/components/ui/skeleton";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";

const STACK_SKELETON_WIDTHS = ["w-[88%]", "w-[72%]", "w-[94%]", "w-[64%]", "w-[80%]"] as const;

const CHIP_SKELETON_WIDTHS = [
  "w-28",
  "w-36",
  "w-24",
  "w-40",
  "w-32",
  "w-44",
] as const;

function ComposerLoadingFrame() {
  return (
    <div
      aria-hidden
      className="mx-auto flex h-[106px] w-full min-w-0 max-w-[600px] flex-col justify-end rounded-[10px] border border-border bg-secondary px-3 py-2"
    >
      <div className="flex items-center justify-between text-sm font-medium text-primary">
        <span>All</span>
        <span>Gemma 4</span>
      </div>
    </div>
  );
}

function EmptyChatLoadingDesktop() {
  return (
    <div className="hidden min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:flex">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center overflow-hidden px-4">
        <div className="mx-auto flex w-full max-w-[600px] flex-col items-stretch">
          <Empty className="mb-6 flex-none border-none p-0">
            <EmptyHeader>
              <EmptyTitle className="text-2xl sm:text-3xl font-semibold tracking-tight text-balance">
                Ask AI, get instant answers
              </EmptyTitle>
            </EmptyHeader>
          </Empty>
          <ComposerLoadingFrame />
          <div className="mt-2 min-h-[10rem] w-full">
            <div className="flex flex-col gap-1">
              {STACK_SKELETON_WIDTHS.map((width, index) => (
                <div key={index} className="px-3 py-1.5" aria-hidden>
                  <Skeleton className={`h-5 rounded-md ${width}`} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyChatLoadingMobile() {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:hidden">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center overflow-hidden px-4 pb-6">
        <Empty className="mx-auto max-w-[600px] flex-none border-none p-0">
          <EmptyHeader>
            <EmptyTitle className="text-2xl sm:text-3xl font-semibold tracking-tight text-balance">
              Ask AI, get instant answers
            </EmptyTitle>
            <EmptyDescription className="max-w-sm text-balance">
              Ask about academic calendars or public holidays. Select your programme, or type @ to
              mention a calendar.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
      <div className="relative min-w-0 shrink-0 overflow-x-hidden pt-1 pb-6">
        <div className="mb-2 min-h-8 w-full overflow-hidden -mx-4 md:mx-0">
          <div className="flex w-max gap-2 px-6 py-0.5">
            {CHIP_SKELETON_WIDTHS.map((width, index) => (
              <Skeleton
                key={index}
                className={`h-7 shrink-0 rounded-full border border-transparent ${width}`}
                aria-hidden
              />
            ))}
          </div>
        </div>
        <div className="px-2 md:px-0">
          <ComposerLoadingFrame />
        </div>
        <span className="mx-auto mt-2 block w-full min-w-0 max-w-[600px] px-2 text-center text-xs text-muted-foreground md:px-0">
          AI can make mistakes. Check important info.
        </span>
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <div
      className="relative flex h-dvh flex-col overflow-hidden bg-background text-foreground"
      aria-busy="true"
      aria-label="Loading chat"
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-1 md:px-0">
        <EmptyChatLoadingDesktop />
        <EmptyChatLoadingMobile />
      </div>
    </div>
  );
}
