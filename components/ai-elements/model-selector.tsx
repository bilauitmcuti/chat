"use client";

import type { ComponentProps } from "react";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

export type ModelSelectorLogoProvider =
  | "moonshotai-cn"
  | "lucidquery"
  | "moonshotai"
  | "zai-coding-plan"
  | "alibaba"
  | "xai"
  | "vultr"
  | "nvidia"
  | "upstage"
  | "groq"
  | "github-copilot"
  | "mistral"
  | "vercel"
  | "nebius"
  | "deepseek"
  | "alibaba-cn"
  | "google-vertex-anthropic"
  | "venice"
  | "chutes"
  | "cortecs"
  | "github-models"
  | "togetherai"
  | "azure"
  | "baseten"
  | "huggingface"
  | "opencode"
  | "fastrouter"
  | "google"
  | "google-vertex"
  | "cloudflare-workers-ai"
  | "inception"
  | "wandb"
  | "openai"
  | "zhipuai-coding-plan"
  | "perplexity"
  | "openrouter"
  | "zenmux"
  | "v0"
  | "iflowcn"
  | "synthetic"
  | "deepinfra"
  | "zhipuai"
  | "submodel"
  | "zai"
  | "inference"
  | "requesty"
  | "morph"
  | "lmstudio"
  | "anthropic"
  | "aihubmix"
  | "fireworks-ai"
  | "modelscope"
  | "llama"
  | "scaleway"
  | "amazon-bedrock"
  | "cerebras"
  | (string & {});

export type ModelSelectorLogoProps = Omit<
  ComponentProps<"img">,
  "src" | "alt"
> & {
  provider: ModelSelectorLogoProvider;
};

export function getModelSelectorLogoUrl(provider: string): string {
  return `https://models.dev/logos/${provider}.svg`;
}

export function ModelSelectorLogo({
  provider,
  className,
  ...props
}: ModelSelectorLogoProps) {
  return (
    <img
      {...props}
      alt={`${provider} logo`}
      className={cn("size-3 dark:invert", className)}
      decoding="async"
      height={12}
      loading="eager"
      src={getModelSelectorLogoUrl(provider)}
      width={12}
    />
  );
}

/**
 * Warm the browser cache so dropdown logos paint without a fetch delay.
 * Warming runs at idle (off the first-paint path) or immediately when `warmNow`.
 */
export function ModelSelectorLogoPreload({
  providers,
  warmNow = false,
}: {
  providers: readonly string[];
  warmNow?: boolean;
}) {
  const providerKey = providers.filter(Boolean).join("|");
  const unique = useMemo(
    () => [...new Set(providerKey.split("|").filter(Boolean))],
    [providerKey]
  );
  const [isWarm, setIsWarm] = useState(false);

  useEffect(() => {
    if (isWarm) return;
    if (warmNow) {
      setIsWarm(true);
      return;
    }
    const warm = () => setIsWarm(true);
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(warm, { timeout: 2000 });
      return () => window.cancelIdleCallback(id);
    }
    const timer = window.setTimeout(warm, 600);
    return () => window.clearTimeout(timer);
  }, [isWarm, warmNow]);

  useEffect(() => {
    if (!isWarm) return;
    if (!document.querySelector('link[rel="preconnect"][href="https://models.dev"]')) {
      const preconnect = document.createElement("link");
      preconnect.rel = "preconnect";
      preconnect.href = "https://models.dev";
      preconnect.crossOrigin = "anonymous";
      document.head.appendChild(preconnect);
    }
    for (const provider of unique) {
      const href = getModelSelectorLogoUrl(provider);
      if (document.querySelector(`link[rel="preload"][href="${href}"]`)) continue;
      const link = document.createElement("link");
      link.rel = "preload";
      link.as = "image";
      link.href = href;
      link.type = "image/svg+xml";
      document.head.appendChild(link);
    }
  }, [isWarm, unique]);

  if (!isWarm || unique.length === 0) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute size-0 overflow-hidden opacity-0"
    >
      {unique.map((provider) => (
        <ModelSelectorLogo key={provider} provider={provider} />
      ))}
    </div>
  );
}

export type ModelSelectorNameProps = ComponentProps<"span">;

export function ModelSelectorName({
  className,
  ...props
}: ModelSelectorNameProps) {
  return (
    <span className={cn("flex-1 truncate text-left", className)} {...props} />
  );
}
