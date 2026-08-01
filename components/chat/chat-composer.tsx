"use client";

import type { Dispatch, SetStateAction } from "react";
import { useRef, useSyncExternalStore } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowUp02Icon } from "@hugeicons/core-free-icons";
import type { SessionId } from "@/lib/data";
import { getSessionOptionsForGroup } from "@/lib/data";
import type { ProgramValue } from "@/lib/route-utils";
import { sessionSubmenuItemClass } from "@/lib/session-submenu-item-class";
import {
  activateSessionSubmenu,
  handleProgramDropdownRootOpenChange,
  handleSessionSubmenuOpenChange,
} from "@/lib/session-submenu-open-change";
import { SessionSubmenuItemLabel } from "@/components/session-submenu-item-label";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import { ResponsiveOverlayShell } from "@/components/ui/responsive-overlay-shell";
import {
  ModelSelectorLogo,
  ModelSelectorLogoPreload,
  ModelSelectorName,
} from "@/components/ai-elements/model-selector";
import { Kbd } from "@/components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { isDesktopWindowsOrMac } from "@/components/theme-shortcut";
import { cn } from "@/lib/utils";
import { MAX_CHAT_MESSAGE_LENGTH } from "@/components/chat/chat-utils";

function getModelShortcutKbdLabel(): string | null {
  if (!isDesktopWindowsOrMac()) return null;
  const platform =
    (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData
      ?.platform ??
    navigator.platform ??
    "";
  return /Mac/i.test(platform) ? "⌘/" : "Ctrl+/";
}

function useModelShortcutKbdLabel(): string | null {
  return useSyncExternalStore(
    () => () => {},
    getModelShortcutKbdLabel,
    () => null
  );
}

interface ProgramOption {
  value: string;
  label: string;
  group: "A" | "B";
}

interface MentionItem {
  id: SessionId;
  label: string;
  text: string;
}

export interface ChatComposerFormProps {
  input: string;
  placeholder: string;
  /** Wider hint shown from `lg` up; swapped by CSS so first paint never changes text. */
  placeholderDesktop?: string;
  isLoading: boolean;
  waitForTurnstileConfig: boolean;
  requiresTurnstile: boolean;
  turnstileToken: string;
  feedbackError?: string | null;
  showDisclaimer?: boolean;
  mentionHighlightParts: { text: string; isMention: boolean }[];
  isMentionOpen: boolean;
  isMobileMentionPicker: boolean;
  mentionItems: MentionItem[];
  activeMentionIndex: number;
  dropdownOpen: boolean;
  activeSubmenu: string | null;
  currentProgramLabel: string;
  groupAOptions: ProgramOption[];
  groupBOptions: ProgramOption[];
  groupBProgramForSessions: ProgramValue;
  groupBSessionLabel: string;
  selectedProgram: ProgramValue;
  selectedSessions: SessionId[];
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  /** Distinguishes dual empty-shell textareas for the active viewport ref. */
  composerSlot?: "desktop" | "mobile" | "active";
  keepDropdownOpenRef: React.MutableRefObject<boolean>;
  onInputChange: (value: string, caretIndex: number | null) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onSubmit: (e?: React.FormEvent) => void;
  onMentionSelect: (item: MentionItem) => void;
  onMentionOpenChange: (open: boolean) => void;
  onDropdownOpenChange: (open: boolean) => void;
  onActiveSubmenuChange: Dispatch<SetStateAction<string | null>>;
  onSessionToggle: (programValue: ProgramValue, sessionId: SessionId, group: "A" | "B") => void;
  onProgramSelect: (program: ProgramValue) => void;
  formatGroupASessionTriggerLabel: (
    value: ProgramValue,
    selectedProgram: ProgramValue,
    selectedSessions: SessionId[]
  ) => string;
  chatModels: readonly {
    id: string;
    name: string;
    description: string;
    provider: string;
  }[];
  selectedModelId: string;
  selectedModelLabel: string;
  modelDropdownOpen: boolean;
  onModelDropdownOpenChange: (open: boolean) => void;
  onModelSelect: (modelId: string) => void;
  /** Fired when the composer textarea receives focus (e.g. defer Turnstile mount). */
  onTextareaFocus?: () => void;
  /** Warm calendar meta before the programme dropdown opens (hover/focus). */
  onProgramMenuWarm?: () => void;
  /**
   * False for the empty shell that is CSS-hidden at the current breakpoint: its
   * trigger has no box, so an open popup would anchor at the viewport corner.
   */
  popupsEnabled?: boolean;
  /** When programme catalogue is empty: show pending/error row instead of blank sections. */
  programCataloguePending?: "loading" | "unavailable" | null;
  className?: string;
  formClassName?: string;
}

const selectorTriggerClassName =
  "text-primary border-none bg-transparent shadow-none px-2 rounded-lg font-medium hover:bg-input hover:text-primary dark:hover:bg-input aria-expanded:bg-input aria-expanded:text-primary dark:aria-expanded:bg-input";

export function ChatComposerForm({
  input,
  placeholder,
  placeholderDesktop,
  isLoading,
  waitForTurnstileConfig,
  requiresTurnstile: _requiresTurnstile,
  turnstileToken: _turnstileToken,
  feedbackError = null,
  showDisclaimer = false,
  mentionHighlightParts,
  isMentionOpen,
  isMobileMentionPicker,
  mentionItems,
  activeMentionIndex,
  dropdownOpen,
  activeSubmenu,
  currentProgramLabel,
  groupAOptions,
  groupBOptions,
  groupBProgramForSessions,
  groupBSessionLabel,
  selectedProgram,
  selectedSessions,
  textareaRef,
  composerSlot = "active",
  keepDropdownOpenRef,
  onInputChange,
  onKeyDown,
  onSubmit,
  onMentionSelect,
  onMentionOpenChange,
  onDropdownOpenChange,
  onActiveSubmenuChange,
  onSessionToggle,
  onProgramSelect,
  formatGroupASessionTriggerLabel,
  chatModels,
  selectedModelId,
  selectedModelLabel,
  modelDropdownOpen,
  onModelDropdownOpenChange,
  onModelSelect,
  onTextareaFocus,
  onProgramMenuWarm,
  programCataloguePending = null,
  popupsEnabled = true,
  className,
  formClassName,
}: ChatComposerFormProps) {
  const submenuSwitchingRef = useRef(false);
  const modelShortcutKbd = useModelShortcutKbdLabel();
  const cataloguePendingLabel =
    programCataloguePending === "unavailable"
      ? "Sessions unavailable"
      : "Loading sessions…";
  const sendDisabled =
    !input.trim() ||
    isLoading ||
    waitForTurnstileConfig;

  return (
    <div className={cn("mx-auto flex w-full min-w-0 max-w-[600px] flex-col px-2 md:px-0", className)}>
      <ModelSelectorLogoPreload
        providers={chatModels.map((model) => model.provider)}
        warmNow={modelDropdownOpen}
      />
      {feedbackError ? (
        <p className="text-xs text-destructive mb-2 px-1" role="status">
          {feedbackError}
        </p>
      ) : null}
      <form onSubmit={onSubmit} className={cn("relative", formClassName)}>
        <InputGroup
          className={cn(
            "h-auto min-h-0 flex-col rounded-[10px] border-border bg-secondary shadow-none dark:bg-secondary",
            "has-[[data-slot=input-group-control]:focus-visible]:ring-0"
          )}
        >
          <div className="relative w-full">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 z-0 whitespace-pre-wrap break-words px-3 pt-3 pb-1 text-sm leading-relaxed md:text-[0.9375rem]"
            >
              {mentionHighlightParts.map((part, index) =>
                part.isMention ? (
                  <span key={`mention-${index}`} className="text-transparent">
                    {part.text}
                  </span>
                ) : (
                  <span key={`plain-${index}`} className="text-transparent">
                    {part.text}
                  </span>
                )
              )}
            </div>
            {input.length === 0 ? (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 z-0 px-3 pt-3 pb-1 text-sm leading-relaxed text-muted-foreground md:text-[0.9375rem]"
              >
                {placeholderDesktop ? (
                  <>
                    <span className="lg:hidden">{placeholder}</span>
                    <span className="hidden lg:inline">{placeholderDesktop}</span>
                  </>
                ) : (
                  placeholder
                )}
              </div>
            ) : null}
            <InputGroupTextarea
              ref={textareaRef}
              data-composer-slot={composerSlot}
              value={input}
              onChange={(e) => {
                const nextValue = e.target.value.slice(0, MAX_CHAT_MESSAGE_LENGTH);
                onInputChange(nextValue, e.target.selectionStart);
              }}
              maxLength={MAX_CHAT_MESSAGE_LENGTH}
              onClick={(e) =>
                onInputChange(e.currentTarget.value, e.currentTarget.selectionStart)
              }
              onKeyUp={(e) =>
                onInputChange(e.currentTarget.value, e.currentTarget.selectionStart)
              }
              onKeyDown={onKeyDown}
              onFocus={() => onTextareaFocus?.()}
              aria-label={placeholder}
              disabled={isLoading}
              rows={1}
              className="chat-input relative z-10 min-h-[64px] max-h-[130px] resize-none border-0 bg-transparent px-3 pt-3 pb-1 text-sm leading-relaxed shadow-none focus-visible:ring-0 md:text-[0.9375rem]"
            />
          </div>
          <ResponsiveOverlayShell
            open={isMentionOpen && popupsEnabled}
            onOpenChange={onMentionOpenChange}
            isMobile={isMobileMentionPicker}
            title="Mention Session Calendar"
            description="Select a session to insert into your message."
            scrollClassName="flex flex-col gap-2 text-left"
            desktopBodyClassName="max-h-[80vh] overflow-auto flex flex-col gap-2"
          >
            {mentionItems.length > 0 ? (
              mentionItems.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onMentionSelect(item)}
                  className={cn(
                    "flex w-full flex-col items-start rounded-md border border-border px-2 py-2 text-left text-sm text-secondary-foreground transition-colors focus-visible:outline-none focus-visible:ring-0",
                    index === activeMentionIndex
                      ? "bg-secondary/80"
                      : "bg-secondary md:hover:bg-secondary/80"
                  )}
                >
                  <span className="font-medium">{item.label}</span>
                  <span className="text-xs text-muted-foreground">{item.id}</span>
                </button>
              ))
            ) : (
              <div className="px-2 py-2 text-xs text-muted-foreground">No sessions found</div>
            )}
          </ResponsiveOverlayShell>
          <InputGroupAddon align="block-end" className="justify-between pt-0">
            <Tooltip disabled={dropdownOpen}>
              <DropdownMenu
                open={dropdownOpen && popupsEnabled}
                onOpenChange={(open, details) =>
                  handleProgramDropdownRootOpenChange(open, details, {
                    activeSubmenu,
                    keepDropdownOpenRef,
                    setDropdownOpen: onDropdownOpenChange,
                    setActiveSubmenu: onActiveSubmenuChange,
                  })
                }
              >
                <TooltipTrigger
                  render={
                    <DropdownMenuTrigger
                      render={
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className={cn(
                            "h-8 min-w-0 max-w-[180px] sm:max-w-[260px] md:max-w-[300px] overflow-hidden",
                            selectorTriggerClassName
                          )}
                          onPointerEnter={onProgramMenuWarm}
                          onFocus={onProgramMenuWarm}
                        />
                      }
                    />
                  }
                >
                  <span className="block min-w-0 flex-1 truncate text-left text-sm text-primary md:text-[0.9375rem]">
                    {currentProgramLabel}
                  </span>
                </TooltipTrigger>
                <DropdownMenuContent
                  className="min-w-[260px] overflow-visible pt-4 pb-4 pl-3 pr-3 bg-popover dark:bg-[#2A2A2A]"
                  align="start"
                >
                <div className="-mx-1 px-1">
                  <div className="mb-2">
                    <div className="text-xs font-semibold text-muted-foreground mb-2 px-2">
                      GROUP A
                    </div>
                    {groupAOptions.length === 0 && programCataloguePending ? (
                      <DropdownMenuItem disabled className="text-muted-foreground">
                        {cataloguePendingLabel}
                      </DropdownMenuItem>
                    ) : null}
                    {groupAOptions.map((opt) => {
                      const groupASessionSummary = formatGroupASessionTriggerLabel(
                        opt.value as ProgramValue,
                        selectedProgram,
                        selectedSessions
                      );
                      return (
                        <DropdownMenuSub
                          key={opt.value}
                          open={activeSubmenu === opt.value}
                          onOpenChange={(open, details) =>
                            handleSessionSubmenuOpenChange(
                              opt.value,
                              onActiveSubmenuChange,
                              open,
                              details,
                              submenuSwitchingRef
                            )
                          }
                        >
                          <DropdownMenuSubTrigger
                            className="relative w-full max-w-full min-w-0 cursor-pointer items-center justify-between gap-0 rounded-md px-2 py-1.5"
                            onPointerDown={() =>
                              activateSessionSubmenu(
                                opt.value,
                                onActiveSubmenuChange,
                                keepDropdownOpenRef,
                                submenuSwitchingRef
                              )
                            }
                          >
                            <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
                              <span
                                className={cn(
                                  "min-w-0 truncate font-medium text-sm",
                                  opt.value === selectedProgram
                                    ? "text-primary"
                                    : "text-foreground"
                                )}
                              >
                                {opt.label}
                              </span>
                              {groupASessionSummary ? (
                                <span className="min-w-0 truncate text-xs text-muted-foreground leading-snug whitespace-nowrap">
                                  {groupASessionSummary}
                                </span>
                              ) : null}
                            </div>
                          </DropdownMenuSubTrigger>
                          <DropdownMenuPortal>
                            <DropdownMenuSubContent
                              collisionPadding={{ top: 8, right: 28, bottom: 8, left: 8 }}
                              className="min-w-[200px] bg-popover dark:bg-[#2A2A2A]"
                            >
                              {getSessionOptionsForGroup("A").map((sess) => {
                                const isSelected = selectedSessions.includes(sess.id);
                                return (
                                  <DropdownMenuItem
                                    key={sess.id}
                                    closeOnClick={false}
                                    className={sessionSubmenuItemClass(isSelected)}
                                    onClick={() =>
                                      onSessionToggle(opt.value as ProgramValue, sess.id, "A")
                                    }
                                  >
                                    <span
                                      className={cn(
                                        "pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 flex size-3 shrink-0 items-center justify-center rounded-full border",
                                        isSelected
                                          ? "border-primary bg-primary"
                                          : "border-muted-foreground"
                                      )}
                                      aria-hidden
                                    />
                                    <SessionSubmenuItemLabel session={sess} />
                                  </DropdownMenuItem>
                                );
                              })}
                            </DropdownMenuSubContent>
                          </DropdownMenuPortal>
                        </DropdownMenuSub>
                      );
                    })}
                  </div>
                </div>
                <div className="my-2 h-px bg-border -mx-3 w-[calc(100%+1.5rem)]" />
                <div className="-mx-1 px-1">
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground mb-2 px-2">
                      GROUP B
                    </div>
                    <DropdownMenuSub
                      open={activeSubmenu === "group-b-sessions"}
                      onOpenChange={(open, details) =>
                        handleSessionSubmenuOpenChange(
                          "group-b-sessions",
                          onActiveSubmenuChange,
                          open,
                          details,
                          submenuSwitchingRef
                        )
                      }
                    >
                      <DropdownMenuSubTrigger
                        className="cursor-pointer items-start"
                        onPointerDown={() =>
                          activateSessionSubmenu(
                            "group-b-sessions",
                            onActiveSubmenuChange,
                            keepDropdownOpenRef,
                            submenuSwitchingRef
                          )
                        }
                      >
                        <div className="flex min-w-0 flex-1 flex-col gap-1 text-left pr-1">
                          <span className="font-medium text-sm">Sessions</span>
                          <span className="min-w-0 text-xs text-muted-foreground text-balance leading-snug">
                            {groupBSessionLabel}
                          </span>
                        </div>
                      </DropdownMenuSubTrigger>
                      <DropdownMenuPortal>
                        <DropdownMenuSubContent
                          collisionPadding={{ top: 8, right: 28, bottom: 8, left: 8 }}
                          className="min-w-[220px] bg-popover dark:bg-[#2A2A2A]"
                        >
                          {getSessionOptionsForGroup("B").length === 0 &&
                          programCataloguePending ? (
                            <DropdownMenuItem disabled className="text-muted-foreground">
                              {cataloguePendingLabel}
                            </DropdownMenuItem>
                          ) : null}
                          {getSessionOptionsForGroup("B").map((sess) => {
                            const isSelected = selectedSessions.includes(sess.id);
                            return (
                              <DropdownMenuItem
                                key={sess.id}
                                closeOnClick={false}
                                className={sessionSubmenuItemClass(isSelected)}
                                onClick={() =>
                                  onSessionToggle(groupBProgramForSessions, sess.id, "B")
                                }
                              >
                                <span
                                  className={cn(
                                    "pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 flex size-3 shrink-0 items-center justify-center rounded-full border",
                                    isSelected
                                      ? "border-primary bg-primary"
                                      : "border-muted-foreground"
                                  )}
                                  aria-hidden
                                />
                                <SessionSubmenuItemLabel session={sess} />
                              </DropdownMenuItem>
                            );
                          })}
                        </DropdownMenuSubContent>
                      </DropdownMenuPortal>
                    </DropdownMenuSub>
                    {groupBOptions.map((opt, index) => (
                      <DropdownMenuItem
                        key={opt.value}
                        className={cn(
                          "relative cursor-pointer pr-8 font-medium",
                          index === 0 && "mt-2",
                          opt.value === selectedProgram ? "text-primary" : ""
                        )}
                        onClick={() => {
                          onActiveSubmenuChange(null);
                          onDropdownOpenChange(false);
                          onProgramSelect(opt.value as ProgramValue);
                        }}
                      >
                        {opt.label}
                        {opt.value === selectedProgram ? (
                          <span
                            className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 flex size-3 shrink-0 items-center justify-center rounded-full border border-primary bg-primary"
                            aria-hidden
                          />
                        ) : null}
                      </DropdownMenuItem>
                    ))}
                  </div>
                </div>
              </DropdownMenuContent>
              </DropdownMenu>
              <TooltipContent side="top">Choose Programme & Session</TooltipContent>
            </Tooltip>
            <div className="flex min-w-0 items-center gap-1 shrink">
              <Tooltip disabled={modelDropdownOpen}>
                <DropdownMenu
                  open={modelDropdownOpen && popupsEnabled}
                  onOpenChange={onModelDropdownOpenChange}
                >
                  <TooltipTrigger
                    render={
                      <DropdownMenuTrigger
                        render={
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className={cn(
                              "h-8 min-w-0 max-w-[140px] sm:max-w-[180px] overflow-hidden",
                              selectorTriggerClassName
                            )}
                          />
                        }
                      />
                    }
                  >
                    <span className="block min-w-0 truncate text-left text-sm text-primary md:text-[0.9375rem]">
                      {selectedModelLabel}
                    </span>
                  </TooltipTrigger>
                  <DropdownMenuContent
                    className="min-w-[260px] pt-4 pb-4 pl-3 pr-3 bg-popover dark:bg-[#2A2A2A]"
                    align="end"
                  >
                    {chatModels.map((model) => (
                      <DropdownMenuItem
                        key={model.id}
                        className={cn(
                          "relative cursor-pointer flex items-start gap-2 py-2 pr-8",
                          model.id === selectedModelId ? "text-primary" : ""
                        )}
                        onClick={() => onModelSelect(model.id)}
                      >
                        <ModelSelectorLogo
                          provider={model.provider}
                          className="size-4 shrink-0 mt-0.5"
                        />
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
                          <ModelSelectorName className="font-medium text-sm">
                            {model.name}
                          </ModelSelectorName>
                          <span className="text-xs text-muted-foreground leading-snug">
                            {model.description}
                          </span>
                        </div>
                        {model.id === selectedModelId ? (
                          <span
                            className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 flex size-3 shrink-0 items-center justify-center rounded-full border border-primary bg-primary"
                            aria-hidden
                          />
                        ) : null}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <TooltipContent side="top" className="gap-1.5">
                  Switch Model
                  {modelShortcutKbd ? <Kbd>{modelShortcutKbd}</Kbd> : null}
                </TooltipContent>
              </Tooltip>
              <InputGroupButton
                type="submit"
                variant="default"
                size="icon-sm"
                disabled={sendDisabled}
                className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-30 shrink-0"
                aria-label="Send message"
              >
                <HugeiconsIcon icon={ArrowUp02Icon} strokeWidth={2} />
              </InputGroupButton>
            </div>
          </InputGroupAddon>
        </InputGroup>
      </form>
      {showDisclaimer ? (
        <span className="block text-center text-xs text-muted-foreground mt-2">
          AI can make mistakes. Check important info.
        </span>
      ) : null}
    </div>
  );
}

/** Bottom-docked composer for active (non-empty) chat. */
export function ChatComposer(props: ChatComposerFormProps) {
  return (
    <div className="chat-input-area relative min-w-0 shrink-0 overflow-x-hidden pt-1 lg:pt-0.5 pb-6">
      <ChatComposerForm {...props} composerSlot="active" showDisclaimer />
    </div>
  );
}
