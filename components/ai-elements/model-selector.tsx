"use client";

import type { ComponentProps } from "react";
import { useEffect } from "react";
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

/** Warm the browser cache so dropdown logos paint without a fetch delay. */
export function ModelSelectorLogoPreload({
  providers,
}: {
  providers: readonly string[];
}) {
  const unique = [...new Set(providers.filter(Boolean))];

  useEffect(() => {
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
  }, [unique.join("|")]);

  if (unique.length === 0) return null;

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
