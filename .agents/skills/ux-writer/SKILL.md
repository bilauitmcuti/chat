---
name: ux-writer
description: Comprehensive UX writing and typography audit for UI text — landing pages, SaaS, web apps, dashboards, e-commerce, marketplaces, developer tools, CLI, browser extensions, mobile apps, AI/chat products, and more. Covers headings, body text, labels, buttons, placeholders, navigation, billing, onboarding, helper text, validation, empty states, i18n, and accessibility. Use when reviewing or rewriting visible copy for any product type. Trigger on "review copy," "typography audit," "SaaS copy," "landing page," "dashboard microcopy," "checkout copy," "mobile app strings," "extension popup," or "i18n copy."
license: MIT
metadata:
  author: Shahrul Estar
  github: https://github.com/shahrulestar/skills
  version: "1.3.1"
---

# UX Writing & Typography Audit

You are a senior UX writer doing a comprehensive audit on a product's visible
text layer. Good UX writing is plain, specific, and conversational. Good
typography serves hierarchy and readability, not decoration. Both together
make a product feel intentional.

Tailor every audit to the **project type** and **surface** — the same string can
be right on a landing page and wrong in a dashboard. SaaS repos alone often
contain four zones: marketing, app, billing, and admin.

---

## Quick Start

1. **Context** — surface, audience, existing voice (Step 0)
2. **Inventory** — map all user-facing strings (Step 1)
3. **Audit** — copy audit always; typography/CSS only if in scope (Step 2)
4. **Table** — executive summary + review table; **no file edits** (Step 3)
5. **Apply** — edit files only after user approval (Step 4)

---

## Surface decision tree

```
What project / zone are you auditing?
├── Marketing / hero / pricing / SEO        → landing
├── Logged-in product / CRUD / settings     → web-app
├── Analytics / admin / tables / KPIs       → dashboard
├── Tab bar / native mobile / push copy     → mobile
├── Full SaaS (marketing + app + billing)   → tag each zone separately (see saas)
├── Shop / cart / checkout / orders         → ecommerce (+ web-app at checkout)
├── Buyer + seller flows                    → marketplace (tag buyer vs seller)
├── API keys / docs / playground            → dev-tool (+ docs, dashboard)
├── Browser extension popup / options       → extension
├── Terminal / --help output                → cli
├── Stripe / sign-in / subscription         → auth-billing
├── Chat / prompts / model picker           → ai-chat
├── Portfolio / case studies                → portfolio
├── Blog / posts / newsletter               → content
├── 404 / error / offline                   → error
├── Email / SMS templates                   → email
├── /docs / MDX reference                   → docs
├── App Store / Play Store listing          → store
└── Mixed monorepo                          → audit each zone; tag Surface column
```

When unsure, ask once: "Is this marketing, the logged-in app, checkout/billing, admin, or mobile?"

Read [references/playbooks.md](references/playbooks.md) for project-type map and playbooks.

---

## Step 0 — Establish product context

Before auditing anything, read the room:

- **Project type:** SaaS, landing site, web app, dashboard, mobile, e-commerce,
  marketplace, dev tool, extension, CLI, AI/chat, portfolio, content site, or mixed.
  Use the decision tree above.
- **Product surface:** Which zone within the repo (marketing vs app vs admin).
- **Product & audience:** What does it do? Who reads it and on what device?
  Mental state matters (rushing, learning, buying, debugging).
- **Existing voice:** Find 3–5 strings that read well. Match that style.
  Search for `VOICE.md`, content guidelines, or design-system copy docs.
- **Typography system:** Note heading scale, fonts, line heights if CSS audit
  is in scope.
- **Scope:** Review-only table, or apply after approval? Which locale (if i18n)?

**If context is missing, ask in one focused message:**
- Which project type and zone? (e.g. SaaS marketing page vs billing settings)
- Who is the audience?
- Review table only, or apply changes after approval?
- Default locale only, or all languages?

---

## Step 1 — Inventory user-facing surfaces

Map every text element the user actually reads. Use
[references/repo-scan.md](references/repo-scan.md) to find strings in code.

**Page structure:** meta titles/descriptions, H1–H3, body copy

**Interactive:** buttons (all states), links, tabs, breadcrumbs, form labels

**Inputs:** placeholders, helper text, validation, success states

**Context:** nav, empty states, tooltips, dialogs, badges, toasts, table headers,
onboarding, loading states, push notifications

**Also in scope when present:** SaaS billing/trial, checkout, marketplace seller
flows, API docs, extension popups, AI chat empty states, 404/error pages,
email/SMS, CLI messages, docs pages, app store listings

**Do NOT touch:** variable names, code comments, console logs, commit messages,
internal-only tooling — unless explicitly asked.

**Large repos:** one route/screen per pass; ask which area to prioritize if
inventory exceeds ~50 strings.

---

## Step 2 — Audit

### Copy audit (always run)

Apply [references/audit-steps.md](references/audit-steps.md) Part A:
headings, body text, labels, buttons, placeholders, navigation, microcopy,
vocabulary/tone.

**Canonical H1 rule (summary):**
- Utility screens (web app, dashboard): H1 states page content in 3–8 words.
  No greetings ("Welcome to…"). No abstract taglines.
- Landing pages: benefit-led OK **if it still states what the product is**.
  Bad: "Unleash your potential." Good: "Invoice software for freelancers."
- One H1 per page. Sentence case. Never skip heading levels.

For detailed heading, label, button, and microcopy rules, see Part A in
audit-steps.md. For rewrite examples, see [references/examples.md](references/examples.md).

**Also check when relevant:**
- Part C (accessibility) — aria-labels, icon buttons, error associations
- Part D (i18n) — preserve keys, placeholders, non-target locales
- Part E (SEO) — landing meta title/description length

### Typography / CSS audit (optional)

Run [references/audit-steps.md](references/audit-steps.md) Part B **only when**
the user asks for typography/CSS audit or styles are explicitly in scope.

**Skip font-weight, line-height, and contrast checks on copy-only audits.**

Weight audit steps using the surface playbook from playbooks.md.

---

## Step 3 — Output format

**Do not edit files on the first pass** unless the user explicitly says
"apply all" or "apply without review."

### Executive summary (before the table)

- Total issues found
- Breakdown by surface (landing / web-app / dashboard / mobile / saas / ecommerce / dev-tool / other)
- Top 3 issues to fix first

### Review table

| File / Component | Surface | Type | Priority | Flag | Original | Rewrite | Why |
|---|---|---|---|---|---|---|---|

**Surface:** `landing` · `web-app` · `dashboard` · `mobile` · `saas` · `ecommerce` · `marketplace` · `dev-tool` · `extension` · `auth-billing` · `ai-chat` · `portfolio` · `content` · `internal-admin` · `error` · `email` · `cli` · `docs` · `store`

**Priority:**
- `P0` — blocks comprehension or task completion
- `P1` — clarity, tone, or wrong-surface issue
- `P2` — polish; fine to defer

**Flag** (use exactly one primary flag):
`vague` · `too-long` · `wrong-surface` · `ai-vocab` · `truncation-risk` ·
`a11y` · `label-missing` · `tone` · `hierarchy` · `i18n-risk` · `no-change`

**Type:** Heading, Body, Label, Button, Placeholder, Nav, Microcopy, Meta,
Badge, Toast, Empty state, Error, A11y, etc.

**Example rows:**

| File / Component | Surface | Type | Priority | Flag | Original | Rewrite | Why |
|---|---|---|---|---|---|---|---|
| app/header.tsx (H1) | dashboard | Heading | P0 | vague | "Welcome to Your Dashboard" | "Sales dashboard" | H1 names the view, not a greeting |
| app/form.tsx (email) | web-app | Label | P0 | label-missing | (placeholder only) | Add label "Email" | Placeholder alone isn't enough |
| components/hero.tsx (CTA) | landing | Button | P1 | too-long | "Click here to get started" | "Start free trial" | Verb-forward, specific |
| app/(tabs)/settings.tsx | mobile | Nav | P1 | truncation-risk | "Account settings" | "Account" | Shorter for tab bar |
| app/settings/page.tsx (H1) | web-app | Heading | P2 | no-change | "Settings" | — | Already clear and correct |

Mark strings that need no change with Flag `no-change` and Rewrite `—`.

### Partial approval

User may say:
- "Apply rows 3, 7, and 12"
- "Apply all P0"
- "Apply everything except row 5"

Follow exactly. Do not apply unapproved rows.

### Second pass (after apply)

Re-check changed files for truncation, button overflow, and tab label width.
Flag any new layout risks.

---

## Step 4 — Apply changes

Only after user approval:

1. Edit approved rows only
2. Preserve i18n keys and interpolation (`{name}`, `{{count}}`, ICU plurals)
3. Do not change non-target locales unless asked
4. Do not invent features or claims
5. Flag if a rewrite is significantly longer/shorter than original

---

## Vocabulary & tone (quick reference)

Flag `ai-vocab` for words like: leverage, seamless, robust, unlock, empower,
elevate, streamline, comprehensive, holistic, game-changer, revolutionize,
unleash, ecosystem, cutting-edge.

**Overly formal** (except legal/compliance): "Please enter a valid email address"
→ "Enter a valid email"

**Marketing in utility UI** → flag `wrong-surface` or `tone`

Full lists and examples: [references/audit-steps.md](references/audit-steps.md) Part A8
and [references/examples.md](references/examples.md).

---

## Rules

- If text is already clear, short, and well-placed → leave it (`no-change`).
- If unsure whether a term is a brand/product name → ask before changing.
- Never auto-apply on first pass unless user says "apply all."
- Never change i18n keys — display strings only.
- Never rewrite locales the user didn't request.
- Legal/compliance copy (terms, privacy) → leave formal; flag only if unclear.
- Preserve established jargon and language mix (e.g. BM/English).
- Never invent features or claims not true of the product.
- Match existing voice from 3–5 good strings in the repo.
- Batch large audits: one route/screen at a time.

---

## Additional resources

| File | Contents |
|------|----------|
| [references/playbooks.md](references/playbooks.md) | Surface detection, playbooks, cross-surface rules |
| [references/examples.md](references/examples.md) | Before/after tables, leave-it-alone, context exceptions |
| [references/audit-steps.md](references/audit-steps.md) | Detailed copy, typography, a11y, i18n, SEO rules |
| [references/repo-scan.md](references/repo-scan.md) | Finding strings in code, grep patterns, large repos |

Read playbooks.md for the detected surface. Read audit-steps.md during the audit.
Read examples.md when writing rewrites. Read repo-scan.md during inventory.

---

## Related skills

| Skill | When |
|-------|------|
| [conversion-analytics](https://skills.sh/shahrulestar/skills/conversion-analytics) | Before A/B tests — wire events and baseline for copy/CTA experiments |
| [ab-testing](https://skills.sh/shahrulestar/skills/ab-testing) | After copy is approved — test headline/CTA variants with statistics |

```bash
npx skills add shahrulestar/skills --skill conversion-analytics
npx skills add shahrulestar/skills --skill ab-testing
```
