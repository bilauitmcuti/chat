![Chat - Bila UiTM Cuti](public/og/chat.png)

# Bila UiTM Cuti Chat

AI chat for UiTM academic calendar questions — ask in English or Malay and get dated answers from official calendar data.

**Live:** [chat.bilauitmcuti.com](https://chat.bilauitmcuti.com)

Part of [Bila UiTM Cuti](https://bilauitmcuti.com) — the companion chat (sometimes called **UiTM Assistant** / **AI Chat UiTM**) helps students check semester dates, lecture weeks 1–14, fee deferment windows, holidays, exams, and related UiTM info without digging through long calendar PDFs.

This repository is public for transparency. Contributions and write access are limited to collaborators. See [Contributing](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md).

## What it does

Students often need a quick answer: *when is cuti semester?*, *what dates are fee deferment?*, *list week 1–14*, or *is today a holiday?* **Bila UiTM Cuti Chat** turns those questions into a short conversation. Behind the scenes, a tool-calling agent looks up session timelines and activities from the [Bila UiTM Cuti API](https://api.bilauitmcuti.com), then replies with concrete dates scoped to the user’s selected academic session and campus group when relevant.

The product stays focused on calendar and UiTM orientation questions. It is not a general-purpose chatbot for coursework, grades, or unofficial campus rumor.

## Features

- Streaming chat UI for academic calendar and UiTM general questions
- Tool-calling agent that looks up session timelines, activities, and related calendar data from the Bila UiTM Cuti API
- Multiple Workers AI models (client picker): Gemma 4, Llama 3.2 3B, Kimi K2.6, GLM 5.2, Nemotron 3 Super
- Session / program scope picker so answers match the user’s campus group and semester
- Markdown replies (tables, code, math, diagrams where relevant)
- Cloudflare Turnstile bot protection on chat
- Optional thumbs feedback for product improvement
- Bilingual replies (English / Malay)
- Open Graph share card for social previews of the chat product

## Example questions

- Penangguhan yuran — tarikh apa dalam kalendar?
- List week 1–14 for my session
- Bila cuti semester / Mid-Semester Break?
- Tarikh peperiksaan akhir untuk sesi semasa?
- Public holiday this month (by state, when asked)

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

## How chat works (high level)

1. The browser sends the question to the chat API and receives a streamed reply.
2. Topic routing and activity matching decide whether to run the agent or a compact fallback.
3. The agent may look up calendar activities, lecture weeks, holidays, and related UiTM knowledge from the same data the main site uses.
4. Replies are validated before they are shown in the UI.
5. Optional thumbs up/down help improve the product.

Runs in production on Cloudflare Workers at [chat.bilauitmcuti.com](https://chat.bilauitmcuti.com).

## Related

- [Bila UiTM Cuti](https://bilauitmcuti.com) — calendar site
- [API](https://api.bilauitmcuti.com) — academic calendar & holiday data
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Contributing](CONTRIBUTING.md) — for collaborators
