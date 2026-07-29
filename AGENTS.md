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
  - **Production** (`chat.bilauitmcuti.com`) and **Workers preview** (`*.workers.dev`): **Gemma 4** (`@cf/google/gemma-4-26b-a4b-it`).
  - **Localhost only** (default): **Llama 3.2 3B** (`@cf/meta/llama-3.2-3b-instruct`).
  - Optional localhost Gemma: `WORKERS_AI_USE_PRODUCTION_MODEL=1`. Overrides: `WORKERS_AI_MODEL`, `WORKERS_AI_USE_DEV_MODEL=1`. See [`lib/workers-ai-model-tier.ts`](lib/workers-ai-model-tier.ts).
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY` — required for Turnstile on chat in production. Set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` in build env, or `TURNSTILE_SITE_KEY` at runtime (client loads via `GET /api/turnstile/config`).

## Optional Environment

- `DISCORD_WEBHOOK_CHAT_HELPFUL` / `DISCORD_WEBHOOK_CHAT_NOT_HELPFUL` — chat AI thumbs up/down (`POST /chat/feedback/api`). Do not use `NEXT_PUBLIC_*` or commit URLs.
- `CALENDAR_API_BASE` — optional server-only override for the calendar API origin (default `https://api.bilauitmcuti.com`). Browser uses same-origin `/api/v1/meta` and `/api/v1/calendar`.
- `CHAT_USE_AGENT` — set to `0` or `false` to disable tool-calling agent globally. See [`lib/chat/agent/run-agent.ts`](lib/chat/agent/run-agent.ts).
- `AI_GATEWAY_ID` — AI Gateway name (default `bilauitmcuti-chat`). Declared in [`wrangler.jsonc`](wrangler.jsonc) `vars`. Set to `off` to bypass.
- `SKIP_AI_GATEWAY=1` — chat calls Workers AI directly without gateway.

## Commands

| Command | Purpose |
|---------|---------|
| `pnpm install` | Install dependencies |
| `pnpm lint` | Run ESLint |
| `pnpm typecheck` | Run TypeScript check |
| `pnpm build` | Next.js production build only (`next build`) |
| `pnpm build:worker` | OpenNext Cloudflare Workers bundle → `.open-next/` |
| `pnpm dev` | Next.js dev server (Workers AI via `initOpenNextCloudflareForDev`) |
| `pnpm preview` | OpenNext build + local Workers preview |
| `pnpm deploy` | OpenNext build + deploy to Cloudflare Workers |

## CI

GitHub Actions (`.github/workflows/ci.yml`):

1. `pnpm install --frozen-lockfile`
2. `pnpm lint`
3. `pnpm typecheck`
4. `pnpm test`
5. `pnpm run build:worker`

## Health & Readiness

- `GET /api/health` — returns `{ status, ai }`. 503 if Workers AI binding is not available.
- `GET /api/version` — returns build ID.

## Cloudflare Workers deployment

This app deploys with **`@opennextjs/cloudflare`** (not Pages / next-on-pages).

| Setting | Value |
|---------|--------|
| Worker name | `bilauitmcuti-chat` |
| Custom domain | `chat.bilauitmcuti.com` |
| Compatibility | `nodejs_compat`, date ≥ `2024-09-23` |
| AI binding | `AI` (remote) |
| Gateway var | `AI_GATEWAY_ID=bilauitmcuti-chat` |

Deploy: `pnpm deploy` (or `opennextjs-cloudflare deploy` after build).

Secrets (dashboard or `wrangler secret put`): `TURNSTILE_SECRET_KEY`, Discord webhooks.

**Do not** add a zone Workers route for `bilauitmcuti.com/_next/*` — that steals assets from the apex calendar Pages app.

## Cloudflare AI Gateway (chat)

Chat routes Workers AI through AI Gateway via the third argument to `env.AI.run()`. Implementation: [`lib/ai-gateway.ts`](lib/ai-gateway.ts), wired in [`lib/ai.ts`](lib/ai.ts).

1. **AI → AI Gateway → Create Gateway** — name: `bilauitmcuti-chat`
2. Authentication **On**, log collection **On**
3. Rate limiting / spend limits / caching as needed (suggested cache TTL 120s)

**Verify:** send a chat on production → AI Gateway → `bilauitmcuti-chat` → Logs.

## Chat API

- UI: `/` ( `/chat` redirects to `/` )
- `POST /chat/api` — SSE stream or JSON cache hit
- `POST /chat/feedback/api` — thumbs feedback

Pipeline: topic router → activity match → agent (Gemma) or compact fallback (Llama) → reply validation. See [`lib/chat/handler.ts`](lib/chat/handler.ts).

## Known Limitations

- Chat abuse/cost control is AI Gateway rate/spend limits (no in-app daily chat ceiling).
- Calendar **UI** is not in this repo; calendar **data** APIs remain for chat tools and session picker.
