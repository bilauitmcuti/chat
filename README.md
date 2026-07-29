# Bila UiTM Cuti Chat

AI chat for UiTM academic calendar questions. **Live:** [chat.bilauitmcuti.com](https://chat.bilauitmcuti.com)

## Summary

Chat-only Next.js app powered by Cloudflare Workers AI (via AI Gateway). Answers questions about UiTM academic dates, lecture weeks, public holidays, and general UiTM info in English or Malay. Calendar data comes from `api.bilauitmcuti.com`.

## Stack

- Next.js (App Router) + React + TypeScript
- Cloudflare Workers (`@opennextjs/cloudflare`)
- Workers AI + AI Gateway (`bilauitmcuti-chat`)
- Turnstile bot protection

## Setup

```bash
pnpm install
copy .env.example .env.local   # fill values
npx wrangler login
pnpm dev
```

See [AGENTS.md](AGENTS.md) and [.env.example](.env.example) for API / AI setup.

## Commands

| Command | Purpose |
|---------|---------|
| `pnpm dev` | Local Next.js + Workers AI bindings |
| `pnpm preview` | OpenNext local Workers preview |
| `pnpm deploy` | Deploy to Cloudflare Workers |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).
