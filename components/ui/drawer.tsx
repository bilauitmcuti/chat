"use client"

import * as React from "react"
import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer"

import { useVisualViewportOffset } from "@/lib/use-visual-viewport-offset"
import { cn } from "@/lib/utils"

/** Shared dim + blur for modal drawer/dialog backdrops (app overlays). */
export const overlayBackdropClassName =
  "fixed inset-0 isolate z-50 min-h-dvh bg-black/40 supports-backdrop-filter:backdrop-blur-sm supports-[-webkit-touch-callout:none]:absolute"

/** Default drawer shell: fit content, min 35dvh, no inner scroll (use DrawerScrollRegion when a list overflows). */
export const drawerContentClassName = cn(
  "flex flex-col overflow-hidden overflow-x-hidden",
  "[--drawer-content-height:auto] [--drawer-height:unset]",
  // Auto height while open; lock measured height on close so slide-out can run.
  "data-[swipe-direction=down]:not-data-ending-style:!h-auto data-[swipe-direction=down]:data-ending-style:!h-(--drawer-height,auto) data-[swipe-direction=down]:min-h-[35dvh] data-[swipe-direction=down]:overflow-y-hidden data-[swipe-direction=down]:overscroll-none"
)

/**
 * Activity drawer snap points (Base UI: 0–1 = viewport fraction; px/rem strings only).
 * 0.4 ≈ 40dvh (default), 1 = full height (expanded).
 */
const ACTIVITY_DRAWER_SNAP_POINTS = [0.4, 1] as const
export { ACTIVITY_DRAWER_SNAP_POINTS }
export const ACTIVITY_DRAWER_DEFAULT_SNAP = ACTIVITY_DRAWER_SNAP_POINTS[0]
/** Stable array reference for Drawer.Root (avoid new [] each render). */
export const ACTIVITY_DRAWER_SNAP_POINTS_LIST: Array<
  (typeof ACTIVITY_DRAWER_SNAP_POINTS)[number]
> = [...ACTIVITY_DRAWER_SNAP_POINTS]

/** Short activity lists — same content-fit height model as other drawers (no snap). */
export const activityDrawerContentFitClassName = cn(
  drawerContentClassName,
  "[&_[data-slot=drawer-content]]:overflow-hidden"
)

/** Long activity lists — snap height (not content-fit / !h-auto). */
export const activityDrawerContentClassName = cn(
  "flex flex-col overflow-hidden",
  // Stable iOS track: avoid dvh URL-bar jumps while snapped.
  "data-[swipe-axis=y]:data-snap-points:[--drawer-content-height:100svh]",
  // Snap open hold is in globals.css (closed transform until data-snap-ready).
  "[&_[data-slot=drawer-content]]:flex [&_[data-slot=drawer-content]]:min-h-0 [&_[data-slot=drawer-content]]:flex-1",
  "[&_[data-slot=drawer-body-shell]]:flex [&_[data-slot=drawer-body-shell]]:min-h-0 [&_[data-slot=drawer-body-shell]]:flex-1 [&_[data-slot=drawer-body-shell]]:overflow-hidden"
)

/** Activity drawer body when snapped — header fixed; list scrolls below. */
export const activityDrawerBodyClassName =
  "flex min-h-0 flex-1 flex-col overflow-hidden"

/** Optimistic row count: ~3 rows + header usually exceeds 40dvh on phones. */
export function estimateActivityDrawerNeedsSnap(
  activityCount: number,
  hasWeekBadge: boolean
): boolean {
  return activityCount + (hasWeekBadge ? 1 : 0) >= 3
}

/** True when list content would exceed the default snap height (needs scroll + snap). */
export function activityDrawerContentNeedsSnap(listEl: HTMLElement): boolean {
  const view = listEl.ownerDocument.defaultView
  const viewportH = view?.innerHeight || listEl.ownerDocument.documentElement.clientHeight
  if (viewportH <= 0) return false

  const snapBudget = ACTIVITY_DRAWER_DEFAULT_SNAP * viewportH
  const body = listEl.closest("[data-grid-activity-drawer-body]") as HTMLElement | null
  const header = body?.querySelector(
    '[data-slot="drawer-no-drag"]'
  ) as HTMLElement | null
  const headerH = header?.offsetHeight ?? 0
  // Swipe handle + bottom safe-area padding inside the sheet.
  const chrome = 64
  return headerH + listEl.scrollHeight + chrome > snapBudget + 1
}
/** Body shell: fit by default; expands only when a DrawerScrollRegion child overflows. */
export const drawerBodyShellClassName = cn(
  "flex w-full shrink-0 flex-col overflow-y-hidden overscroll-none",
  "has-[[data-overflows]]:min-h-0 has-[[data-overflows]]:flex-1 has-[[data-overflows]]:overflow-hidden"
)

/** Body column inside shell (headers + content). */
export const drawerBodyColumnClassName = "flex w-full shrink-0 flex-col"

/** Content region — no scroll unless wrapped in DrawerScrollRegion. */
export const drawerBodyRegionClassName =
  "w-full min-w-0 shrink-0 overflow-y-hidden overscroll-none"

/**
 * Bottom padding under drawer content — max(1rem, safe-area); see globals.css.
 * Prefer on body shell for content-fit drawers; on the list scroller for snap drawers.
 */
export const DRAWER_SAFE_BOTTOM_PADDING =
  "max(1rem, env(safe-area-inset-bottom, 0px))" as const

/** Applied on drawer body shell (non-snap) or activity list scroller (snap). */
export const drawerSafeAreaBottomClassName = "drawer-safe-area-bottom"

export const drawerBodyClassName =
  "flex w-full min-w-0 max-w-full flex-col border-0 bg-popover px-4 pt-0 text-left shadow-none outline-none ring-0 ring-offset-0"

/** Pure white in light theme (see `.responsive-shell-bg` in globals.css). */
export const responsiveShellBgClassName = "responsive-shell-bg"

/** Drawer shell for responsive overlay pairs (engagement prompt, mention picker). */
export const responsiveDrawerShellClassName = cn(
  drawerContentClassName,
  responsiveShellBgClassName
)

/** Drawer shell for mention picker & engagement prompt (desktop dialog uses responsiveShellBg only). */
export const responsiveDrawerContentClassName = cn(
  drawerContentClassName,
  responsiveShellBgClassName
)

/** Pins bottom drawer to visible viewport above the mobile keyboard. */
export const keyboardAwareDrawerContentClassName = cn(
  "data-[swipe-direction=down]:!bottom-[var(--vv-bottom-offset,0px)]",
  "data-[swipe-direction=down]:!max-h-[min(80dvh,calc(100svh-var(--vv-bottom-offset,0px)-2rem))] data-[swipe-direction=down]:!h-auto"
)

/** Body layout for responsive drawer/dialog pairs (mention picker, engagement prompt). */
export const responsiveDrawerBodyClassName = cn(
  "gap-3 text-center md:text-left",
  responsiveShellBgClassName
)

/** Shared visible drawer heading — h4 typography. */
export const drawerTitleClassName =
  "w-full border-0 text-center text-lg font-semibold leading-snug tracking-tight text-foreground shadow-none outline-none ring-0 ring-offset-0"

/** Dialog title/description typography aligned with drawer responsive pairs. */
export const responsiveDialogTitleClassName = drawerTitleClassName

export const responsiveDialogDescriptionClassName =
  "border-0 text-sm text-muted-foreground shadow-none text-center md:text-left"

export const responsiveDrawerDescriptionClassName =
  responsiveDialogDescriptionClassName

/** Full-width primary action — 38px tall (settings shell, drawers). */
export const drawerPrimaryButtonClassName =
  "w-full !h-[38px] justify-center border-border text-center transition-none"

/** Full-width outline action — 38px tall (settings shell, drawers). */
export const drawerOutlineButtonClassName =
  "w-full h-[38px] justify-center border-border bg-background text-black shadow-xs transition-[opacity,colors] hover:bg-muted hover:text-foreground dark:border-input dark:bg-input/30 dark:text-foreground dark:hover:bg-input/50"

type DrawerContextProps = {
  hasSnapPoints: boolean
  /** First snap point — used to correct Safari open flash before Base UI measures. */
  defaultSnapPoint: NonNullable<DrawerPrimitive.Root.Props["snapPoints"]>[number] | null
  modal: DrawerPrimitive.Root.Props["modal"]
  showSwipeHandle: boolean
  swipeDirection: NonNullable<DrawerPrimitive.Root.Props["swipeDirection"]>
}

const DrawerContext = React.createContext<DrawerContextProps | null>(null)

function useDrawer() {
  const context = React.useContext(DrawerContext)

  if (!context) {
    throw new Error("useDrawer must be used within a Drawer.")
  }

  return context
}

function Drawer({
  modal = true,
  showSwipeHandle = false,
  snapPoints,
  defaultSnapPoint,
  swipeDirection = "down",
  ...props
}: DrawerPrimitive.Root.Props & {
  showSwipeHandle?: boolean
}) {
  const hasSnapPoints = snapPoints != null && snapPoints.length > 0
  const contextValue = React.useMemo(
    () => ({
      hasSnapPoints,
      defaultSnapPoint:
        defaultSnapPoint ?? (hasSnapPoints ? snapPoints![0] : null) ?? null,
      modal,
      showSwipeHandle,
      swipeDirection,
    }),
    [hasSnapPoints, defaultSnapPoint, snapPoints, modal, showSwipeHandle, swipeDirection]
  )

  return (
    <DrawerContext.Provider value={contextValue}>
      <DrawerPrimitive.Root
        data-slot="drawer"
        modal={modal}
        swipeDirection={swipeDirection}
        {...(hasSnapPoints ? { snapPoints } : {})}
        {...(defaultSnapPoint !== undefined ? { defaultSnapPoint } : {})}
        {...props}
      />
    </DrawerContext.Provider>
  )
}

/** Bottom drawer that tracks the visual viewport (mobile keyboard). */
function KeyboardAwareDrawer({
  open,
  showSwipeHandle = true,
  ...props
}: DrawerPrimitive.Root.Props & {
  showSwipeHandle?: boolean
}) {
  useVisualViewportOffset(open === true)

  return (
    <Drawer
      open={open}
      showSwipeHandle={showSwipeHandle}
      swipeDirection="down"
      {...props}
    />
  )
}

function DrawerTrigger({ ...props }: DrawerPrimitive.Trigger.Props) {
  return <DrawerPrimitive.Trigger data-slot="drawer-trigger" {...props} />
}

function DrawerPortal({ ...props }: DrawerPrimitive.Portal.Props) {
  return <DrawerPrimitive.Portal data-slot="drawer-portal" {...props} />
}

function DrawerClose({ ...props }: DrawerPrimitive.Close.Props) {
  return <DrawerPrimitive.Close data-slot="drawer-close" {...props} />
}

function DrawerOverlay({
  className,
  ...props
}: DrawerPrimitive.Backdrop.Props) {
  return (
    <DrawerPrimitive.Backdrop
      data-slot="drawer-overlay"
      className={cn(
        "fixed inset-0 z-50 min-h-dvh bg-black/10 opacity-[max(var(--drawer-overlay-min-opacity,0),calc(1-var(--drawer-swipe-progress)))] transition-opacity duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] select-none data-ending-style:pointer-events-none data-ending-style:opacity-0 data-ending-style:duration-300 data-snap-points:[--drawer-overlay-min-opacity:0.5] data-starting-style:opacity-0 data-swiping:duration-0 supports-backdrop-filter:backdrop-blur-xs supports-[-webkit-touch-callout:none]:absolute",
        className
      )}
      {...props}
    />
  )
}

function DrawerSwipeHandle({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-swipe-handle"
      aria-hidden="true"
      className={cn(
        "relative z-10 mx-auto flex shrink-0 cursor-grab py-3 transition-opacity duration-200 group-data-nested-drawer-open/drawer-popup:opacity-0 group-data-nested-drawer-swiping/drawer-popup:opacity-100 group-data-[swipe-axis=x]/drawer-popup:h-full group-data-[swipe-axis=x]/drawer-popup:w-3 group-data-[swipe-axis=x]/drawer-popup:items-center group-data-[swipe-axis=x]/drawer-popup:py-0 group-data-[swipe-axis=y]/drawer-popup:h-auto group-data-[swipe-axis=y]/drawer-popup:w-full group-data-[swipe-axis=y]/drawer-popup:justify-center group-data-[swipe-direction=left]/drawer-popup:order-last group-data-[swipe-direction=left]/drawer-popup:justify-start group-data-[swipe-direction=right]/drawer-popup:justify-end group-data-[swipe-direction=up]/drawer-popup:order-last after:block after:shrink-0 after:rounded-full after:bg-muted group-data-[swipe-axis=x]/drawer-popup:after:h-[100px] group-data-[swipe-axis=x]/drawer-popup:after:w-1.5 group-data-[swipe-axis=y]/drawer-popup:after:h-1.5 group-data-[swipe-axis=y]/drawer-popup:after:w-[100px] active:cursor-grabbing",
        className
      )}
      {...props}
    />
  )
}

const DrawerScrollRegion = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(function DrawerScrollRegion({ className, children, ...props }, forwardedRef) {
  const ref = React.useRef<HTMLDivElement | null>(null)
  const [overflows, setOverflows] = React.useState(false)

  const setRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      ref.current = node
      if (typeof forwardedRef === "function") forwardedRef(node)
      else if (forwardedRef) forwardedRef.current = node
    },
    [forwardedRef]
  )

  React.useLayoutEffect(() => {
    const el = ref.current
    if (!el) return

    const measure = () => {
      if (el.scrollHeight > el.clientHeight + 1) {
        setOverflows(true)
        return
      }

      const popup = el.closest('[data-slot="drawer-popup"]') as HTMLElement | null
      if (!popup) {
        setOverflows(false)
        return
      }

      const header = el.previousElementSibling as HTMLElement | null
      const headerHeight = header?.offsetHeight ?? 0
      const shell = el.closest(
        '[data-slot="drawer-body-shell"]'
      ) as HTMLElement | null
      const shellTop = shell?.offsetTop ?? 0
      const available = popup.clientHeight - headerHeight - shellTop
      setOverflows(el.scrollHeight > available + 1)
    }

    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    for (const child of el.children) {
      ro.observe(child)
    }
    const popup = el.closest('[data-slot="drawer-popup"]')
    if (popup) ro.observe(popup)
    return () => ro.disconnect()
  }, [children])

  return (
    <div
      ref={setRef}
      data-overflows={overflows ? "" : undefined}
      className={cn(
        "min-h-0 shrink overscroll-contain",
        overflows && "flex-1 overflow-y-auto",
        !overflows && "overflow-y-hidden",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
})

function DrawerContent({
  className,
  children,
  keyboardAware = false,
  ...props
}: DrawerPrimitive.Popup.Props & {
  keyboardAware?: boolean
}) {
  const { hasSnapPoints, modal, showSwipeHandle, swipeDirection } = useDrawer()
  const swipeAxis =
    swipeDirection === "down" || swipeDirection === "up" ? "y" : "x"
  const [popupEl, setPopupEl] = React.useState<HTMLDivElement | null>(null)
  const [snapReady, setSnapReady] = React.useState(!hasSnapPoints)

  // Wait until Base UI has measured and applied the default snap offset (>0).
  // Showing at offset 0px paints full height (the Safari flash). Poll via rAF +
  // MutationObserver — Base UI updates the CSS var inside Popup without
  // re-rendering this parent, so attempt-count on layoutEffect never advances
  // in production. Time failsafe so the drawer never stays invisible.
  //
  // Once ready for an open cycle, never clear snapReady until the *next* open.
  // Open uses an optimistic snap offset in CSS until Base UI measures, so content
  // stays visible during the slide-up (no closed-transform hold).
  // Swipe-to-dismiss zeros --drawer-snap-point-offset / removes data-open while
  // the exit animation still runs — do not re-hide during that.
  React.useLayoutEffect(() => {
    if (!hasSnapPoints) {
      setSnapReady(true)
      return
    }

    const el = popupEl
    if (!el) return

    let cancelled = false
    let rafId = 0
    let failsafeId = 0
    let watching = false
    let wasOpen = el.hasAttribute("data-open")
    const popup = el

    function readOffset() {
      return (
        Number.parseFloat(
          popup.style.getPropertyValue("--drawer-snap-point-offset")
        ) || 0
      )
    }

    function stopWatching() {
      if (rafId) cancelAnimationFrame(rafId)
      if (failsafeId) window.clearTimeout(failsafeId)
      rafId = 0
      failsafeId = 0
      watching = false
    }

    function markReady() {
      if (cancelled) return
      stopWatching()
      setSnapReady(true)
    }

    function pollUntilReady() {
      if (cancelled || !watching) return
      if (!popup.hasAttribute("data-open")) {
        stopWatching()
        return
      }
      // Default snap leaves a large offset; 0px means "not measured yet".
      if (readOffset() > 1) {
        markReady()
        return
      }
      rafId = requestAnimationFrame(pollUntilReady)
    }

    function startWatching() {
      if (cancelled || watching) return
      watching = true
      setSnapReady(false)
      if (readOffset() > 1) {
        markReady()
        return
      }
      rafId = requestAnimationFrame(pollUntilReady)
      failsafeId = window.setTimeout(markReady, 150)
    }

    if (wasOpen) startWatching()
    else setSnapReady(false)

    const observer =
      typeof MutationObserver === "function"
        ? new MutationObserver(() => {
            if (cancelled) return
            const isOpen = popup.hasAttribute("data-open")
            if (!isOpen) {
              stopWatching()
              wasOpen = false
              // Keep snapReady through exit / swipe-dismiss (no opacity flash).
              return
            }
            if (!wasOpen) {
              wasOpen = true
              startWatching()
              return
            }
            // Still open: only promote to ready. Never re-hide — swipe-to-close
            // can briefly zero the snap offset while the sheet is still visible.
            if (readOffset() > 1) markReady()
          })
        : null

    observer?.observe(popup, {
      attributes: true,
      attributeFilter: ["style", "data-open"],
    })

    return () => {
      cancelled = true
      stopWatching()
      observer?.disconnect()
    }
  }, [hasSnapPoints, popupEl])

  const { ref: propsRef, ...popupProps } = props as DrawerPrimitive.Popup.Props & {
    ref?: React.Ref<HTMLDivElement>
  }

  // Stable callback; read latest forwarded ref from a box updated in layout effect
  // (avoids React Compiler "modified hook argument" + "refs during render").
  const forwardedRefRef = React.useRef(propsRef)
  React.useLayoutEffect(() => {
    forwardedRefRef.current = propsRef
  })

  const setPopupRef = React.useCallback((node: HTMLDivElement | null) => {
    setPopupEl(node)
    const forwarded = forwardedRefRef.current
    if (typeof forwarded === "function") forwarded(node)
    else if (forwarded && typeof forwarded === "object") {
      ;(forwarded as React.MutableRefObject<HTMLDivElement | null>).current = node
    }
  }, [])

  return (
    <DrawerPortal data-slot="drawer-portal">
      {modal === true && (
        <DrawerOverlay data-snap-points={hasSnapPoints ? "" : undefined} />
      )}
      <DrawerPrimitive.Viewport
        data-slot="drawer-viewport"
        data-modal={modal}
        className="pointer-events-none fixed inset-0 z-50 select-none data-[modal=true]:pointer-events-auto"
      >
        <DrawerPrimitive.Popup
          data-slot="drawer-popup"
          data-swipe-axis={swipeAxis}
          data-snap-points={hasSnapPoints ? "" : undefined}
          className={cn(
            // Edge-attached (not floating) — flush to viewport; top corners only.
            "[--drawer-inset:0px]",
            // Base — springy bottom-sheet motion (open/close from bottom).
            "group/drawer-popup pointer-events-auto fixed z-50 flex h-(--drawer-content-height) max-h-(--drawer-content-max-height,none) min-h-0 w-(--drawer-content-width,auto) transform-[translate3d(var(--translate-x,0px),var(--translate-y,0px),0)_scale(var(--stack-scale))] flex-col overflow-hidden bg-popover text-sm text-popover-foreground transition-[transform,height,opacity,filter] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] will-change-transform outline-none select-none [interpolate-size:allow-keywords]",
            // Nested.
            "data-nested-drawer-open:overflow-hidden data-nested-drawer-open:brightness-95",
            // Bleed.
            "after:pointer-events-none after:absolute after:bg-(--drawer-bleed-background,var(--color-popover)) data-[swipe-axis=x]:after:inset-y-0 data-[swipe-axis=x]:after:w-(--bleed) data-[swipe-axis=y]:after:inset-x-0 data-[swipe-axis=y]:after:h-(--bleed) data-[swipe-direction=down]:after:top-full data-[swipe-direction=left]:after:right-full data-[swipe-direction=right]:after:left-full data-[swipe-direction=up]:after:bottom-full",
            // Sizing.
            "[--drawer-content-height:var(--drawer-height,auto)] data-[swipe-axis=x]:[--drawer-content-width:75%] data-[swipe-axis=y]:[--drawer-content-max-height:calc(100dvh-6rem)] data-[swipe-axis=y]:data-snap-points:[--drawer-content-height:100dvh] data-[swipe-axis=x]:sm:[--drawer-content-width:24rem]",
            // Stack.
            "[--bleed:3rem] [--peek:1rem] [--stack-height:var(--drawer-frontmost-height,var(--drawer-height,0px))] [--stack-peek-offset:max(0px,calc((var(--nested-drawers)-var(--stack-progress))*var(--peek)))] [--stack-progress:clamp(0,var(--drawer-swipe-progress),1)] [--stack-scale-base:max(0,calc(1-(var(--nested-drawers)*var(--stack-step))))] [--stack-scale:clamp(0,calc(var(--stack-scale-base)+(var(--stack-step)*var(--stack-progress))),1)] [--stack-shrink:calc(1-var(--stack-scale))] [--stack-step:0.05]",
            // Transitions — open slides up from --closed-transform; close slides down.
            "data-starting-style:transform-(--closed-transform) data-ending-style:transform-(--closed-transform) data-ending-style:opacity-[0.9999]",
            // Axis: y.
            "data-[swipe-axis=y]:inset-x-0 data-[swipe-axis=y]:data-nested-drawer-open:h-(--stack-height)",
            // Axis: x.
            "data-[swipe-axis=x]:inset-y-0 data-[swipe-axis=x]:flex-row",
            // Direction: down — flush bottom sheet, top corners rounded.
            "data-[swipe-direction=down]:bottom-0 data-[swipe-direction=down]:origin-bottom data-[swipe-direction=down]:rounded-t-xl data-[swipe-direction=down]:[--closed-transform:translate3d(0,calc(100%+1rem),0)] data-[swipe-direction=down]:[--translate-y:calc(var(--drawer-snap-point-offset,0px)+var(--drawer-swipe-movement-y)-var(--stack-peek-offset)-(var(--stack-shrink)*var(--stack-height)))]",
            // Direction: up.
            "data-[swipe-direction=up]:top-0 data-[swipe-direction=up]:origin-top data-[swipe-direction=up]:rounded-b-xl data-[swipe-direction=up]:[--closed-transform:translate3d(0,calc(-100%-1rem),0)] data-[swipe-direction=up]:[--translate-y:calc(var(--drawer-snap-point-offset,0px)+var(--drawer-swipe-movement-y)+var(--stack-peek-offset)+(var(--stack-shrink)*var(--stack-height)))]",
            // Direction: left.
            "data-[swipe-direction=left]:left-0 data-[swipe-direction=left]:origin-left data-[swipe-direction=left]:rounded-r-xl data-[swipe-direction=left]:[--closed-transform:translate3d(calc(-100%-1rem),0,0)] data-[swipe-direction=left]:[--translate-x:calc(var(--drawer-swipe-movement-x)+var(--stack-peek-offset)+(var(--stack-shrink)*100%))]",
            // Direction: right.
            "data-[swipe-direction=right]:right-0 data-[swipe-direction=right]:origin-right data-[swipe-direction=right]:rounded-l-xl data-[swipe-direction=right]:[--closed-transform:translate3d(calc(100%+1rem),0,0)] data-[swipe-direction=right]:[--translate-x:calc(var(--drawer-swipe-movement-x)-var(--stack-peek-offset)-(var(--stack-shrink)*100%))]",
            keyboardAware && keyboardAwareDrawerContentClassName,
            className
          )}
          {...popupProps}
          ref={setPopupRef}
          data-snap-ready={hasSnapPoints && snapReady ? "" : undefined}
        >
          {showSwipeHandle && <DrawerSwipeHandle />}
          <DrawerPrimitive.Content
            data-slot="drawer-content"
            className={cn(
              "flex min-h-0 flex-1 flex-col overflow-hidden overscroll-contain rounded-[inherit] transition-opacity duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] select-text group-data-nested-drawer-open/drawer-popup:opacity-0 group-data-nested-drawer-swiping/drawer-popup:opacity-100 group-data-swiping/drawer-popup:select-none"
            )}
          >
            <div
              data-slot="drawer-body-shell"
              className={cn(
                "pt-3",
                // Content-fit: pad shell. Snap: pad the list scroller instead
                // so last rows can scroll clear of the home indicator.
                !hasSnapPoints && drawerSafeAreaBottomClassName,
                // Snap drawers must shrink into the snap height; shrink-0
                // lets long lists force the old content-sized height.
                hasSnapPoints
                  ? "flex min-h-0 w-full flex-1 flex-col overflow-hidden"
                  : drawerBodyShellClassName
              )}
            >
              {children}
            </div>
          </DrawerPrimitive.Content>
        </DrawerPrimitive.Popup>
      </DrawerPrimitive.Viewport>
    </DrawerPortal>
  )
}

function DrawerHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-header"
      className={cn(
        "flex shrink-0 flex-col gap-0.5 p-4 pb-0 group-data-[swipe-axis=y]/drawer-popup:text-center md:gap-1.5 md:text-left",
        className
      )}
      {...props}
    />
  )
}

function DrawerFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-footer"
      className={cn("mt-auto flex shrink-0 flex-col gap-2 p-4 pt-0", className)}
      {...props}
    />
  )
}

function DrawerTitle({
  className,
  render,
  ...props
}: DrawerPrimitive.Title.Props) {
  return (
    <DrawerPrimitive.Title
      data-slot="drawer-title"
      render={render ?? <h4 />}
      className={cn(
        "font-heading text-lg font-semibold leading-snug tracking-tight text-foreground",
        className
      )}
      {...props}
    />
  )
}

function DrawerDescription({
  className,
  ...props
}: DrawerPrimitive.Description.Props) {
  return (
    <DrawerPrimitive.Description
      data-slot="drawer-description"
      className={cn("text-sm text-balance text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Drawer,
  KeyboardAwareDrawer,
  DrawerPortal,
  DrawerOverlay,
  DrawerSwipeHandle,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerScrollRegion,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
}
