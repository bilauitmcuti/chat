# Bila UiTM Cuti Chat

AI chat for UiTM academic calendar questions.

**Live:** [chat.bilauitmcuti.com](https://chat.bilauitmcuti.com)

Part of [Bila UiTM Cuti](https://bilauitmcuti.com) — helps students ask about semester dates, lecture weeks, holidays, and related UiTM info in English or Malay.

This repository is public for transparency. Contributions and write access are limited to collaborators.

## Features

- Streaming chat UI for academic calendar and UiTM general questions
- Tool-calling agent that looks up session timelines, activities, and related calendar data from the Bila UiTM Cuti API
- Multiple Workers AI models (client picker): Gemma 4, Llama 3.2 3B, Kimi K2.6, GLM 5.2, Nemotron 3 Super
- Session / program scope picker so answers match the user’s campus group and semester
- Markdown replies (tables, code, math, diagrams where relevant)
- Cloudflare Turnstile bot protection on chat
- Optional thumbs feedback routed to Discord webhooks
- Bilingual replies (English / Malay)

## Tech stack

| Area | Choice |
|------|--------|
| App | Next.js (App Router), React, TypeScript |
| UI | Tailwind CSS, shadcn/ui, Base UI |
| Runtime | Cloudflare Workers via `@opennextjs/cloudflare` |
| Inference | Cloudflare Workers AI + AI Gateway |
| Bot protection | Cloudflare Turnstile |
| Calendar data | [api.bilauitmcuti.com](https://api.bilauitmcuti.com) |
| Tests | Vitest |

## Related

- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Contributing](CONTRIBUTING.md) — for collaborators
