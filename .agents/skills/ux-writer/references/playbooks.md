# Product Surface Playbooks

Identify which surface you are auditing, then weight audit steps accordingly.
If the repo mixes surfaces (e.g. `app/(marketing)/` + `app/(dashboard)/`), tag
each finding with its surface in the output table.

For before/after rewrites, see [examples.md](examples.md).

---

## Project types at a glance

Most repos are one **project type** spanning several **surfaces**. Detect the
project type first, then audit each zone with the right playbook.

| Project type | Typical surfaces | Start here |
|--------------|------------------|------------|
| **SaaS** | landing + web-app + dashboard (+ billing, email) | SaaS playbook; tag each zone |
| **Landing / marketing site** | landing (+ blog, docs) | Landing playbook |
| **Web app** (CRUD, productivity) | web-app (+ dashboard if analytics) | Web app playbook |
| **Dashboard / analytics** | dashboard | Dashboard playbook |
| **Mobile app** | mobile (+ store listing) | Mobile playbook |
| **E-commerce / storefront** | landing + web-app (checkout) + dashboard (admin) | E-commerce playbook |
| **Marketplace** | landing + web-app (buyer + seller flows) | Marketplace playbook |
| **Developer tool / API platform** | landing + docs + dashboard + cli | Dev-tool playbook |
| **CLI / terminal tool** | cli | CLI playbook |
| **Browser extension** | popup + options + store | Extension playbook |
| **Desktop app** (Electron, Tauri) | web-app patterns + native dialogs | Web app + mobile (compact UI) |
| **Internal admin / back-office** | dashboard (+ web-app forms) | Internal admin playbook |
| **AI / chat product** | web-app + dashboard (usage) | AI product playbook |
| **Portfolio / personal site** | landing (lighter voice OK) | Portfolio playbook |
| **Blog / content / CMS** | landing + docs patterns | Content site playbook |
| **Auth / billing** (Stripe, Clerk) | web-app (embedded flows) | Auth & billing playbook |

**SaaS is not one surface** — it is usually marketing site + logged-in app +
operator dashboard. Never audit all three with landing-page voice.

---

## How to detect the surface

| Surface | Signals in code / context |
|---------|---------------------------|
| **Landing page** | `hero`, `pricing`, `features`, `testimonials`, `cta`, marketing routes, SEO meta, single-scroll layout |
| **Web app** | Forms, auth flows, settings, checkout, wizards, onboarding steps, CRUD screens |
| **Dashboard** | Charts, tables, KPI cards, filters, date ranges, sidebar nav, `analytics`, `reports`, admin views |
| **Mobile app** | `tabBar`, `bottomSheet`, `SafeAreaView`, React Native / Flutter / SwiftUI, push notification copy, compact nav |
| **SaaS** (multi-zone) | `(marketing)/` + `(app)/` + `(dashboard)/`, Stripe/Clerk, `workspace`, `billing`, trial copy |
| **E-commerce** | `cart`, `checkout`, `product`, `shop`, Shopify/Snipcart, order confirmation |
| **Marketplace** | `seller`, `buyer`, `listing`, `payout`, dual onboarding flows |
| **Dev tool** | `/docs`, API keys, SDK install, `openapi`, playground, status page |
| **Extension** | `manifest.json`, `popup.html`, `options`, Chrome/Firefox extension APIs |
| **Internal admin** | `admin/`, role-gated routes, bulk actions, audit logs, impersonation |
| **AI / chat** | `prompt`, `chat`, `assistant`, token/usage limits, model selector |
| **Auth & billing** | `sign-in`, `sign-up`, `subscription`, `invoice`, Stripe Checkout UI |
| **Portfolio** | `projects/`, `about`, case studies, contact form, minimal nav |
| **Content / blog** | `blog/`, `posts/`, MDX, tags, RSS, reading time, author bylines |
| **Error page** | `404`, `not-found`, `error.tsx`, status codes in route names |
| **Email / SMS** | `.html` templates, `mjml`, `react-email`, Twilio/SendGrid templates |
| **CLI** | `--help`, `commander`, `yargs`, `clap`, stderr/stdout user messages |
| **Docs site** | `/docs`, MDX content, sidebar nav, versioned API reference |
| **App store listing** | `metadata.json`, store listing copy, screenshot captions |

---

## Landing page

**User mindset:** Scanning, skeptical, 5–10 seconds to understand value.

**Prioritize:** Hero H1 + subhead, primary/secondary CTAs, feature section
headings, pricing tier labels, FAQ questions, footer links, meta title/description.

**Voice:** Benefit-led and specific. Confident, not hypey. Sentence case everywhere
except deliberate badges (`NEW`, `BETA`).

**H1 rule:** Benefit-led is OK **if it still states what the product is**.
Bad: "Unleash your potential" (abstract tagline). Good: "Invoice software for
freelancers" (benefit + product). Bad: "The future of work is here."

**Typography:** One clear H1 per page. Hero line length ≤ 60 characters where
possible. CTA buttons 1–3 words. Feature headings 2–5 words.

**Common failures:**
- H1 is a tagline instead of what the product does
- CTA says "Get started" with no context (started with what?)
- Feature blocks use AI vocabulary: seamless, robust, leverage, empower
- Pricing buttons: "Choose plan" → prefer "Start free" / "Contact sales"

---

## Web app

**User mindset:** Task-focused — signing up, configuring, buying, or fixing something.

**Prioritize:** Form labels, placeholders, validation errors, button states,
onboarding steps, empty states, confirmation dialogs, success toasts, settings
section headings.

**Voice:** Instructional and neutral. Explain *why* a field exists. No marketing
language inside utility screens.

**Typography:** Labels 1–3 words. Helper text one sentence. Error messages say
what to fix. H1 names the screen ("Account settings"), not the user ("Your account").

**Common failures:**
- Placeholder used as the only label
- "Submit" / "OK" with no object when context is unclear
- "Continue" flagged when step context is obvious (wizards — OK to keep)
- Errors blame the user ("You entered an invalid email")
- Onboarding walls of text — split into steps with H2 per step

---

## Dashboard

**User mindset:** Scanning data, repeat visits, often power users or operators.

**Prioritize:** Page/view titles, sidebar and tab labels, table column headers
(with units), filter labels, date-range pickers, status badges, empty states,
chart axis labels, export/action buttons, alert banners.

**Voice:** Terse and precise. No greetings, metaphors, or enthusiasm. Numbers
and nouns over adjectives.

**Typography:** H1 = name of the view ("Sales report", "User list"). Column
headers 1–4 words. Badges short and ALL CAPS (`ACTIVE`, `PENDING`). Body text
in tables can be denser but keep headers scannable.

**Common failures:**
- H1: "Welcome back" or "Dashboard" (too generic — name the view)
- Column header "Date" with no format hint when mixed formats exist
- Empty state "No data" with no next action
- Filter label "Status" with options that repeat the label ("Status: Active")

---

## Mobile app

**User mindset:** Distracted, one-handed, small screen, impatient.

**Prioritize:** Tab bar labels (1 word ideal, 2 max), screen titles, primary
CTAs, list row titles/subtitles, bottom sheet headings, alert/dialog copy,
permission prompts, push notification title + body, search placeholders.

**Voice:** Ultra-concise. Action-first. Assume truncation — front-load the verb
or noun. Avoid nested instructions.

**Typography:** Screen titles 1–3 words. Buttons 1–2 words when possible. Helper
text optional — use only when format is non-obvious. Line length limits stricter
than web (≈40–50 characters for primary labels).

**Common failures:**
- Tab labels: "Notifications" truncated to "Notificat…" → shorten to "Alerts"
- Full-sentence buttons ("Tap here to save your changes")
- Permission prompt explains the app, not the benefit ("We need camera access")
- Push notification body repeats the title

---

## Error pages (404, 500, offline)

**User mindset:** Lost or frustrated — needs a clear path back.

**Prioritize:** Headline, short explanation, primary recovery action, secondary link.

**Voice:** Plain and helpful. No jokes unless the brand already uses humor.
No blame ("You broke something").

**Common failures:**
- "Oops!" with no explanation or next step
- Technical error codes shown to users (`Error 500`)
- Only a "Go home" link when the user was mid-task

**Guidance:**
- H1: what happened ("Page not found")
- Body: one sentence + action ("Check the URL or go back to the dashboard.")
- Primary CTA: most useful recovery ("Back to dashboard")
- Secondary: "Contact support" if appropriate

---

## Email / SMS templates

**User mindset:** Scanning quickly; subject line decides open rate.

**Prioritize:** Subject/preheader, headline, primary CTA, unsubscribe/footer copy.

**Voice:** Match product voice but slightly more formal than in-app toasts.
Subject lines: specific, not clickbait.

**Constraints:**
- Subject ~40–60 characters for mobile preview
- Preheader complements subject, doesn't repeat it
- One primary CTA per email
- SMS: ultra-short; include opt-out where required

**Common failures:**
- Subject: "Important update from us"
- Body repeats the subject line verbatim
- CTA: "Click here"

---

## CLI help text

**User mindset:** At a terminal; wants fast answers.

**Prioritize:** Command descriptions, flag help, error messages, success output.

**Voice:** Terse and precise. Imperative for actions. No marketing language.

**Common failures:**
- "An error occurred" with no fix hint
- Flag descriptions that repeat the flag name
- Inconsistent tense across commands

**Guidance:**
- Command description: one line, starts with verb ("List all projects")
- Errors: what failed + what to try ("Unknown flag '--verbose'. Run --help.")
- Success: minimal ("Saved config to ~/.app/config")

---

## Docs sites

**User mindset:** Learning or looking up reference — not buying.

**Prioritize:** Page titles, sidebar labels, procedural headings, code-adjacent
explanations, search placeholder, "On this page" nav.

**Voice:** Clear and instructional. More detail than dashboards, less hype than
landing pages. Active voice for steps.

**Differs from landing page:**
- H1 can be longer if it's a guide title ("Install the CLI")
- OK to use technical terms the audience expects
- Avoid benefit-led hero copy in reference pages

**Common failures:**
- Marketing language in API reference
- Vague sidebar labels ("Overview" everywhere)
- Step headings that don't match the action ("Getting started" for step 3)

---

## App Store / Play Store listings

**User mindset:** Comparing apps; scanning screenshots and subtitle.

**Prioritize:** App name, subtitle/tagline, description first paragraph, screenshot
captions, permission strings, what's new.

**Constraints:**
- iOS subtitle: 30 characters
- Short description fields have hard limits — count characters before rewriting
- Screenshot captions: 2–5 words each

**Voice:** Benefit-led like landing pages, but every word must fit character limits.

**Common failures:**
- Subtitle repeats app name
- Description opens with "Welcome to [App Name]!"
- Screenshot captions describe UI instead of user benefit

---

## SaaS (multi-surface product)

**What it is:** Subscription software — usually marketing site + logged-in app +
settings/billing + optional admin dashboard. Examples: Notion-like tools, B2B
platforms, dev platforms with free tier.

**User mindset by zone:**
- Marketing: evaluating, comparing plans
- App: completing jobs, collaborating
- Billing/settings: cautious, wants clarity on cost and data
- Admin dashboard (if present): operating the product or managing a team

**Prioritize by zone:**
- **Marketing:** hero, pricing tiers, feature comparison, social proof, trial CTA
- **App:** onboarding checklist, empty states, invite teammates, workspace/project naming
- **Billing:** plan names, upgrade/downgrade, trial end, payment failed, invoice labels
- **Dashboard:** usage metrics, seat counts, API usage (see Dashboard playbook)

**Voice:**
- Marketing: benefit-led but specific (see Landing)
- App & settings: neutral, instructional — no hype
- Billing: precise; state amounts, dates, and consequences plainly

**Common failures:**
- App screens use landing hype ("Unlock powerful workflows")
- Pricing page vague tiers ("Pro" with no who-it's-for line)
- Upgrade modal: "Upgrade now" with no plan name or price hint
- Trial banner: "Your trial is ending soon" with no date or action
- "Workspace" vs "Organization" vs "Team" used interchangeably

**Cross-links:** Landing (marketing), Web app (core product), Dashboard (analytics/admin), Auth & billing (Stripe flows)

---

## E-commerce / storefront

**User mindset:** Browsing, comparing, trusting payment — anxiety at checkout.

**Prioritize:** Product titles, price display, cart labels, checkout steps, shipping
options, order confirmation, return policy links, stock/availability badges.

**Voice:** Clear and reassuring at checkout. Product copy can be descriptive but
avoid fluff in cart/checkout. No marketing superlatives on payment screens.

**Typography:** Checkout steps numbered and scannable. Button: "Pay $49.00" or
"Place order" — not "Complete purchase journey."

**Common failures:**
- Checkout button: "Continue" (continue what?)
- "Shipping" with no delivery estimate when data exists
- Empty cart: "No items" with no "Browse products" action
- Error: "Payment failed" with no retry or support path
- Admin product form uses consumer marketing tone

**Cross-links:** Web app (checkout forms), Dashboard (inventory/orders admin), Landing (shop homepage)

---

## Marketplace (two-sided)

**User mindset:** Different for buyers vs sellers — audit each flow separately.

**Prioritize:**
- **Buyer:** search, filters, listing detail, trust signals, checkout, disputes
- **Seller:** onboarding, listing creation, payout setup, earnings dashboard, policy violations
- **Shared:** role switcher labels, notification copy for both sides

**Voice:** Neutral platform voice. Second person ("your listing") per role.
Avoid assuming everyone is a seller or buyer.

**Common failures:**
- Seller empty state written for buyers
- "Submit" on listing form (submit what?) → "Publish listing"
- Payout errors with no next step ("Verification required" → say what to verify)
- Generic H1 "Dashboard" for seller earnings vs buyer orders

**Cross-links:** E-commerce (checkout), Dashboard (seller analytics), Web app (onboarding)

---

## Developer tools / API platform

**User mindset:** Developers — impatient, precise, allergic to marketing fluff in
docs and console UIs.

**Prioritize:** Docs sidebar, quickstart steps, API key labels, error codes with
fix hints, SDK install commands, rate-limit messages, webhook status, playground
placeholder text.

**Voice:** Technical but plain. Imperative in guides ("Run `npm install`").
No " seamlessly integrate" in API reference.

**Common failures:**
- Docs hero sounds like landing page ("Revolutionize your API workflow")
- Error: "Invalid request" with no field or docs link
- API key UI: "Copy" with no warning about secrecy
- Dashboard metric names without units ("Requests" → "Requests (24h)")

**Cross-links:** Docs site, Dashboard, CLI (if ships CLI), Landing (developer landing only on `/` marketing)

---

## Browser extension / desktop utility

**User mindset:** Interrupted context — popup must communicate in 2 seconds.

**Prioritize:** Popup title, primary action, permission explanation, options page
labels, install/update notices, toolbar tooltip.

**Voice:** Ultra-concise like mobile. Benefit in permission prompts.

**Constraints:** Popup width ~300–400px — treat like mobile for length.

**Common failures:**
- Popup explains the whole product in a paragraph
- Options page uses dashboard-density labels
- "Enable extension" with no benefit statement

**Cross-links:** Mobile (length limits), Web app (options/settings pages), Store listing

---

## Internal admin / back-office

**User mindset:** Operators, support staff, power users — speed over polish.

**Prioritize:** Bulk action labels, filter names, audit log columns, impersonation
warnings, destructive confirmations, role/permission labels.

**Voice:** Terse like dashboard. Warnings must be explicit for destructive ops.

**Common failures:**
- "Delete" without object on bulk delete
- Impersonation banner too subtle ("Viewing as user" → "You are viewing as [name]. Exit")
- Friendly marketing tone in admin tables

**Cross-links:** Dashboard playbook (primary). Flag `wrong-surface` if consumer copy appears.

---

## AI / chat product

**User mindset:** Experimenting or task-focused; unclear what the AI can/can't do.

**Prioritize:** Empty chat state, suggested prompts, input placeholder, model
selector labels, token/limit warnings, error when model unavailable, export/share
copy, system disclaimer if required.

**Voice:** Conversational but bounded. Set expectations ("Can make mistakes").
Avoid anthropomorphizing unless brand requires it.

**Common failures:**
- Empty state: "Start a conversation" with no example prompts
- Placeholder: "Ask me anything" (too vague) → "Summarize this doc or draft an email"
- Usage limit: "Limit reached" with no reset time or upgrade path
- Error blames user ("Bad prompt") → "Couldn't process that. Try shortening your message."

**Cross-links:** Web app (chat UI), SaaS (usage billing), Dashboard (usage analytics)

---

## Auth & billing flows

**User mindset:** Security-conscious; hates surprise charges.

**Prioritize:** Sign-in/up labels, OAuth button text, password requirements, MFA
labels, plan selection, proration notes, cancel flow, payment method labels,
invoice line items.

**Voice:** Plain and trustworthy. State what happens next. No dark patterns.

**Common failures:**
- "Continue with Google" vs inconsistent "Sign in with Google" across pages
- Cancel subscription: vague "Are you sure?" → "Cancel Pro? You'll lose access on [date]."
- Free trial: hidden renewal wording (flag for clarity, not legal rewrite)
- "Billing" nav item opens unrelated settings page

**Cross-links:** Web app, SaaS billing zone. Leave legal ToS/refund policy formal.

---

## Portfolio / personal site

**User mindset:** Evaluating a person — quick scan of work and credibility.

**Prioritize:** Hero/name line, project titles, case study headings, contact CTA,
about section, resume/skills labels.

**Voice:** Can be warmer and more personality than B2B SaaS. Still avoid AI hype
and empty taglines. First person OK ("I design…") if consistent.

**Common failures:**
- H1: "Creative visionary" → H1: "Product designer" or name + role
- Project cards: "Project 1" → actual project name
- Contact: "Get in touch" only → "Email me" or "Book a call"

**Cross-links:** Landing (structure) but allow personal voice.

---

## Blog / content site

**User mindset:** Reading or searching — not buying (unless monetized).

**Prioritize:** Post titles, excerpt/meta, category/tag labels, author byline,
read time, newsletter signup, search placeholder, pagination ("Older posts").

**Voice:** Clear headlines. Sentence case titles unless house style is Title Case
(check consistency). Newsletter: value prop, not "Subscribe to our newsletter."

**Common failures:**
- Category label "Misc" everywhere
- "Read more" without context (OK in card grids if title is visible — prefer title link)
- SEO title duplicates H1 with site name twice

**Cross-links:** Landing (homepage), Docs (long-form structure)

---

## Cross-surface rules

- **Landing page copy in a dashboard or admin** → flag as `wrong-surface` and rewrite.
- **SaaS repos:** audit `(marketing)`, `(app)`, and `(dashboard)` separately — never one voice for all.
- **Checkout / billing / auth** → precise and calm; no hype or urgency dark patterns.
- **Dashboard density on mobile or extension popups** → flag strings over ~25 characters in primary actions.
- **Web app forms on landing pages** → only newsletter/signup — keep fields minimal; lead with value prop nearby.
- **Developer docs** → no landing-page hype; link errors to docs where possible.
- **Marketplace** → tag findings `buyer` or `seller` in Why column when relevant.
- **Legal/compliance copy** (terms, privacy, disclaimers) → leave formal language; flag only if truly unclear.
- **Loading states** → "Loading…" or specific ("Saving…"); avoid "Please wait while we process your request."
- When unsure which surface applies, **ask once**: "Is this marketing, the logged-in app, admin, or checkout?"
