# Cloud Agent Onboarding

Instructions for AI agents and Cloudflare Workers deployment.

## Setup (minimal, idempotent)

```bash
pnpm install
copy .env.example .env.local   # Windows — fill values before pnpm dev
# cp .env.example .env.local   # macOS/Linux
npx wrangler login             # required for local Workers AI binding
```

## Required Environment

- **Workers AI binding** — required for chat. Declared in [`wrangler.jsonc`](wrangler.jsonc) as `ai.binding: "AI"`. No API key secret for inference. Access via `getCloudflareContext()` from `@opennextjs/cloudflare`.
  - **Default model:** Gemma 4 (`@cf/google/gemma-4-26b-a4b-it`) on all environments.
  - **Client model picker:** users can choose from 4 Workers AI models in the chat composer (Gemma 4, Llama 4 Scout, Mistral Small 3.1, Nemotron 3 Super). See [`lib/chat/models.ts`](lib/chat/models.ts).
  - Optional server default override: `WORKERS_AI_MODEL` (must be an allowlisted model id).
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY` — required for Turnstile on chat in production. Set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` in build env, or `TURNSTILE_SITE_KEY` at runtime (client loads via `GET /chat/api/turnstile/config`).

## Optional Environment

- `DISCORD_WEBHOOK_CHAT_HELPFUL` / `DISCORD_WEBHOOK_CHAT_NOT_HELPFUL` — chat AI thumbs up/down (`POST /chat/feedback/api`). Do not use `NEXT_PUBLIC_*` or commit URLs.
- `CALENDAR_API_BASE` — optional server-only override for the calendar API origin (default `https://api.bilauitmcuti.com`). Browser uses same-origin `/api/v1/meta` and `/api/v1/calendar` (unchanged; shared calendar API surface, not under `/chat`).
- `CHAT_USE_AGENT` — set to `0` or `false` to disable tool-calling agent globally. See [`lib/chat/agent/run-agent.ts`](lib/chat/agent/run-agent.ts).
- `AI_GATEWAY_ID` — AI Gateway name (default / production: `buc-chat`). Declared in [`wrangler.jsonc`](wrangler.jsonc) `vars` and local `.env.local`. Set to `off` to bypass.
- `SKIP_AI_GATEWAY=1` — chat calls Workers AI directly without gateway.
- `CHAT_USE_DYNAMIC_ROUTES=1` — opt-in AI Gateway Dynamic Routes (`dynamic/*`) for non-Gemma. Default **off** (compat currently returns 400 Bad input); chat uses `AI.run` + app Gemma fallback instead.

## Commands

| Command | Purpose |
|---------|---------|
| `pnpm install` | Install dependencies |
| `pnpm lint` | Run ESLint |
| `pnpm typecheck` | Run TypeScript check |
| `pnpm build` | OpenNext Cloudflare Workers bundle → `.open-next/` |
| `pnpm build:worker` | Alias for `pnpm build` (same OpenNext bundle) |
| `pnpm dev` | Next.js dev server (Workers AI via `initOpenNextCloudflareForDev`) |
| `pnpm preview` | OpenNext build + local Workers preview |
| `pnpm deploy` | OpenNext build + deploy to Cloudflare Workers |
| `pnpm upload` | OpenNext build + upload preview version (non-prod branches) |

## CI

GitHub Actions (`.github/workflows/ci.yml`):

1. `pnpm install --frozen-lockfile`
2. `pnpm lint`
3. `pnpm typecheck`
4. `pnpm test`
5. `pnpm run build:worker`

## Health & Readiness

- `GET /api/health` (or `/chat/api/health` via dual-host rewrite) — returns `{ status, ai }`. 503 if Workers AI binding is not available.
- `GET /api/version` (or `/chat/api/version`) — returns build ID.

## Cloudflare Workers deployment

This app deploys with **`@opennextjs/cloudflare`** (not Pages / next-on-pages).

| Setting | Value |
|---------|--------|
| Worker name | `chat` |
| Custom domain | `chat.bilauitmcuti.com` (UI at `/`) |
| Apex path route | `bilauitmcuti.com/chat*` and `www.bilauitmcuti.com/chat*` (UI at `/chat`) |
| Compatibility | `nodejs_compat`, date ≥ `2024-09-23` |
| AI binding | `AI` (remote) |
| Gateway var | `AI_GATEWAY_ID=buc-chat` |
| Asset prefix | `/chat` (HTML references `/chat/_next/*`; post-build mirrors `.open-next/assets/_next` → `chat/_next` for Workers Assets) |

Local / CLI: `pnpm deploy` (runs OpenNext build, then deploy).

Secrets (dashboard or `wrangler secret put`): `TURNSTILE_SECRET_KEY`, Discord webhooks.

### DNS and Worker routes

Zone `bilauitmcuti.com`:

- **Keep** apex / `www` DNS on the calendar **Pages** app (do not point the whole apex at this Worker).
- **Keep** `chat.bilauitmcuti.com` as Worker custom domain (no extra DNS for path hosting).
- [`wrangler.jsonc`](wrangler.jsonc) routes:

```jsonc
{ "pattern": "chat.bilauitmcuti.com", "custom_domain": true },
{ "pattern": "bilauitmcuti.com/chat*", "zone_name": "bilauitmcuti.com" },
{ "pattern": "www.bilauitmcuti.com/chat*", "zone_name": "bilauitmcuti.com" }
```

**Do not** add a zone Workers route for `bilauitmcuti.com/_next/*` — that steals assets from the apex calendar Pages app. Chat assets are only under `/chat/_next/*`.

`assetPrefix: "/chat"` only changes HTML URLs. OpenNext still emits static files under `.open-next/assets/_next`. Build runs [`scripts/mirror-chat-assets.mjs`](scripts/mirror-chat-assets.mjs) so Workers Assets also has `chat/_next`. Middleware rewrite alone is not enough — Assets match the request path before the Worker, and a Next rewrite does not re-fetch the ASSETS binding.

Calendar Pages must not also claim `/chat`.

Turnstile widget hostnames: `chat.bilauitmcuti.com`, `bilauitmcuti.com`, `www.bilauitmcuti.com`.

### Dual-host URL behaviour

| Host | UI | Notes |
|------|-----|--------|
| `chat.bilauitmcuti.com` | `/` | `/chat` redirects to `/` |
| `bilauitmcuti.com` | `/chat` | Path route; browser APIs under `/chat/api/...` |

No subdomain → apex redirect yet. Canonical SEO stays on `https://chat.bilauitmcuti.com`.

### Workers Builds (Git deploy) — required settings

Dashboard: Worker **`chat`** → **Settings → Build**.

| Setting | Value |
|---------|--------|
| Build command | `pnpm run build` or `pnpm run build:worker` |
| Deploy command | `npx wrangler deploy` |
| Non-production deploy | `npx wrangler versions upload` (or `pnpm run upload` to build+upload in one step) |

Both scripts run `opennextjs-cloudflare build` and create `.open-next/`. [`open-next.config.ts`](open-next.config.ts) sets `buildCommand: "next build"` so the OpenNext step does not re-invoke `pnpm build` (infinite recursion). If the build step skips OpenNext entirely, deploy fails with:

`Could not find compiled Open Next config, did you run the build command?`

Build variables (as needed): `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, etc. under **Build variables and secrets**. Runtime secrets stay under **Variables & Secrets** / `wrangler secret`.

After changing settings, **Retry** the failed build (or push a new commit).

**Success log markers:** Build step completes `opennextjs-cloudflare build` (`.open-next/` present), then deploy runs without the “compiled Open Next config” error. Smoke: `GET /api/health` on the Worker URL.

## Cloudflare AI Gateway (chat)

Chat routes Workers AI through AI Gateway via the third argument to `env.AI.run()`. Implementation: [`lib/ai-gateway.ts`](lib/ai-gateway.ts), wired in [`lib/ai.ts`](lib/ai.ts).

1. **AI → AI Gateway → Create Gateway** — name: `buc-chat`
2. Authentication **On**, log collection **On** (required for Dynamic Routing)
3. Rate limiting / spend limits / caching as needed (suggested cache TTL 120s)

### Dynamic Routing (non-Gemma fallback → Gemma 4)

**Default path:** non-Gemma models use `AI.run(selectedModel)` through the gateway binding, then one app-level retry with **Gemma 4** on timeout/unavailable/5xx. Gemma always uses `AI.run` only.

**Opt-in Dynamic Routes:** set `CHAT_USE_DYNAMIC_ROUTES=1` to try `dynamic/<name>` via `env.AI.gateway("buc-chat").run({ provider: "compat", … })` first. Compat currently fails with HTTP 400 Bad input for Workers AI models (audio schema), so leave the flag off until Cloudflare/BYOK/compat is fixed. When enabled and the compat call fails, the app still falls back to `AI.run` then Gemma.

| Route | Primary | Fallback |
|-------|---------|----------|
| `gemma-4` | Gemma 4 | — (defined for symmetry; app does not call it) |
| `llama-scout` | Llama 4 Scout | Gemma 4 |
| `mistral-small` | Mistral Small 3.1 | Gemma 4 |
| `nemotron` | Nemotron 3 Super | Gemma 4 |

App mapping: [`lib/chat/dynamic-routes.ts`](lib/chat/dynamic-routes.ts). Routes may remain deployed on Cloudflare (`buc-chat` → Dynamic Routes) but are unused while the flag is off.

**Verify:** non-Gemma chats complete without `Dynamic route failed` warnings when the flag is off. With the flag on, check AI Gateway logs / `cf-aig-model` once compat stops returning 400.

## Chat API

- UI: `/` ( `/chat` redirects to `/` )
- `POST /chat/api` — SSE stream or JSON cache hit
- `POST /chat/feedback/api` — thumbs feedback

Pipeline: topic router → activity match → agent (Gemma) or compact fallback (Llama) → reply validation. See [`lib/chat/handler.ts`](lib/chat/handler.ts).

## Known Limitations

- Chat abuse/cost control is AI Gateway rate/spend limits (no in-app daily chat ceiling).
- Calendar **UI** is not in this repo; calendar **data** APIs remain for chat tools and session picker.
