Chat - Bila UiTM Cuti

# Bila UiTM Cuti Chat

An AI chat assistant that answers UiTM academic calendar questions, providing accurate dates and information for students.

**Live:** [bilauitmcuti.com/chat](https://bilauitmcuti.com/chat)

Part of [Bila UiTM Cuti](https://bilauitmcuti.com) — the companion chat (sometimes called **UiTM Assistant** / **AI Chat UiTM**) helps students check semester dates, lecture weeks, fee deferment windows, holidays, exams, and related UiTM info in a short conversation.

## What it does

Students often need quick answers to questions like: when is semester break, what are the fee deferment dates, which dates correspond to weeks 1 to 14, or whether today is a holiday. Bila UiTM Cuti Chat provides these answers in a conversational format, based on the academic session and campus group chosen by the user.

The product stays focused on calendar and UiTM orientation questions. It is not a general-purpose chatbot for coursework, grades, or unofficial campus rumor.

## Models & capabilities

Users can pick a Cloudflare Workers AI model in the chat composer. All picker models support **function calling** (tool use).

Models

The chat composer lets users pick from multiple Cloudflare Workers AI models, including Gemma 4 (default), Llama 4 Scout, Mistral Small 3.1, and Nemotron 3 Super. All available models support function calling, enabling the assistant to look up academic facts before answering.

Function calling lets the assistant look up the right academic facts before answering. Reasoning-capable models can show a short thinking/reasoning section in the chat UI for harder questions.

## Features


| Feature                      | Description                                                     |
| ---------------------------- | --------------------------------------------------------------- |
| Streaming chat               | For academic calendar and UiTM general questions                |
| Tool-calling agent           | Supports function calling across all model pickers              |
| Reasoning                    | Available for Gemma 4 and Nemotron 3 Super models               |
| Session/program scope picker | Ensures answers match the user’s campus group and semester      |
| Markdown replies             | Supports tables, code, math, and diagrams where relevant        |
| Cloudflare Turnstile         | Provides bot protection on chat                                 |
| Adaptive language            | Shared language-control pipeline across every model (see below) |




### Adaptive language (English / Malaysian Malay / mixed)

Replies follow the **same language behaviour on every picker model** (Gemma 4, Llama 4 Scout, Mistral Small 3.1, Nemotron 3 Super) — switching models should not change how language is chosen.

- **Match the user** — English stays English; Bahasa Melayu Malaysia stays BM; natural Malay–English mix is mirrored when you code-switch.
- **Loanwords are fine** — Asking in English with UiTM terms like *cuti* or *sesi* still gets an English answer.
- **Malaysian Malay, not Indonesian** — BM replies use Malaysian wording and month names (e.g. Mac, Ogos), not Indonesian forms.
- **Conversation memory** — Short follow-ups (“Next”, “Okay”, “Lepas tu”) keep the thread’s language; a clear full-sentence switch (or “reply in English” / “jawab dalam BM”) updates the preference for that turn.
- **Quiet quality check** — If a reply is clearly the wrong language, the server regenerates once before you see it. Detection is never explained in the chat UI.



## Tech stack


| Area           | Choice                                          |
| -------------- | ----------------------------------------------- |
| App            | Next.js (App Router), React, TypeScript         |
| UI             | Tailwind CSS, shadcn/ui, Base UI, ai-elements   |
| Runtime        | Cloudflare Workers via `@opennextjs/cloudflare` |
| Inference      | Cloudflare Workers AI + AI Gateway              |
| Bot protection | Cloudflare Turnstile                            |
| Tests          | Vitest                                          |




## How chat works (high level)

1. User submits a question via the chat interface.
2. The system detects the user's preferred language (English, Malaysian Malay, or mixed) for this turn, automatically adapting if you switch during the conversation.
3. The chat engine determines whether to use the tool-calling agent for in-depth answers or a simpler direct response.
4. If the tool-calling agent is used, the model may access tools and generate a draft answer; models with reasoning skills can show their thought process in the UI.
5. The reply is checked for accuracy—including language and calendar date correctness—before displaying to the user.
6. Users can provide feedback with a thumbs up or down to help refine future responses.



## Related

- [Bila UiTM Cuti](https://bilauitmcuti.com) — calendar
- [Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/)

This repository is public for transparency. Contributions and write access are limited to collaborators. See [Contributing](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md).