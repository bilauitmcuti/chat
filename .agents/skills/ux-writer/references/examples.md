# Before / After Examples

Use these as calibration when writing rewrites. Do not rewrite copy that
already matches the "After" column — mark those rows `no-change`.

---

## Surface-specific rewrites

### Landing page

| Before | After | Why |
|--------|-------|-----|
| H1: "The future of work is here" | H1: "Team chat for remote companies" | States the product |
| H1: "Revolutionize your workflow today" | H1: "Invoice software for freelancers" | Product description, not hype |
| CTA: "Click here to learn more" | CTA: "See pricing" | Verb-forward, specific |
| Feature H2: "Holistic collaboration suite" | Feature H2: "Built-in video calls" | Names the actual feature |

### Web app

| Before | After | Why |
|--------|-------|-----|
| Label missing; placeholder "Enter email" | Label "Email" + placeholder "you@example.com" | Label persists on focus |
| "Your request has been received" toast | "Got it — we'll email you shortly" | Shorter, warmer |
| H1: "Welcome to settings" | H1: "Settings" | Utility screens skip greetings |

### Dashboard

| Before | After | Why |
|--------|-------|-----|
| H1: "Overview" | H1: "Revenue overview" | Names the specific view |
| H1: "Welcome to your workspace" | H1: "Projects" | Utility view title, no greeting |
| Column: "Amount" | Column: "Amount (USD)" | Adds unit for scanability |
| Empty: "No records found" | Empty: "No orders this month. Change date range or create an order." | State + action |
| Badge: "This user is currently inactive" | Badge: "INACTIVE" | Badge = short tag |

### Mobile app

| Before | After | Why |
|--------|-------|-----|
| Tab: "Account settings" | Tab: "Account" | Fits tab bar width |
| Tab: "Preferences" | Tab: "Settings" | Shorter label avoids truncation |
| Button: "Save changes to your profile" | Button: "Save" | Short; context is obvious |
| Permission: "Allow access to camera" | Permission: "Take photos for your profile" | Benefit, not mechanism |
| Title: "Home" (root tab) | Title: product name or "Feed" | "Home" is vague in apps |
| Push body: "You have a new notification waiting for you in the app" | Push body: "New comment on your post" | Specific, not meta |

### SaaS

| Before | After | Why |
|--------|-------|-----|
| App H1: "Welcome to your workspace" | H1: "Projects" | Utility view, not greeting |
| Upgrade modal: "Unlock premium features" | "Upgrade to Pro — $12/mo" | Names plan and price |
| Trial banner: "Your trial is ending soon" | "Trial ends Mar 12. Add billing to keep Pro." | Date + action |
| Invite: "Enter collaborator information" | Label: "Email" | Shorter label |

### E-commerce

| Before | After | Why |
|--------|-------|-----|
| Cart empty: "No items" | "Your cart is empty. Continue shopping." | State + action |
| Checkout CTA: "Continue" | "Place order" | Specific at payment step |
| Product badge: "Best product ever" | "Best seller" or remove | Factual badge, not hype |

### Developer tool

| Before | After | Why |
|--------|-------|-----|
| API error: "Invalid request" | "Missing `Authorization` header. See auth docs." | Specific + pointer |
| Docs H1: "Supercharge your development" | H1: "Authentication" | Reference title, not marketing |
| API key button: "Click to copy" | "Copy key" | Verb-forward, short |

### AI / chat

| Before | After | Why |
|--------|-------|-----|
| Empty chat: "Start chatting" | "Try: Summarize this URL or draft a reply" | Shows capability |
| Limit toast: "Limit reached" | "Daily limit reached. Resets in 6 hours or upgrade." | When + escape hatch |
| Input placeholder: "Ask me anything" | "Describe what you want to create" | Scoped to product |

### Auth & billing

| Before | After | Why |
|--------|-------|-----|
| Cancel dialog: "Are you sure?" | "Cancel Pro? Access ends Apr 1." | Consequence stated |
| OAuth: "Login with Google" / "Sign in with Google" mixed | Pick one: "Continue with Google" | Consistent across flows |
| Invoice label: "Amount due" with no currency | "Amount due (USD)" | Unit for clarity |

### Browser extension

| Before | After | Why |
|--------|-------|-----|
| Popup: "Welcome to our extension…" (paragraph) | "Block ads on this site" + Enable | One line + action |
| Permission: "Read and change all your data" | "See page URLs to apply rules" | Plain scope, not manifest jargon |

---

## Cross-cutting calibration examples

| Before | After | Why |
|---|---|---|
| H1: "Leverage Our Advanced Analytics Platform" | H1: "Analytics Dashboard" | Actual content, not marketing language |
| Label: "What is your preferred communication method?" | Label: "Preferred contact" | No questions; shorter, clearer |
| Button: "Click here to proceed to the next step" | Button: "Continue" | Verb-forward, scannable, removes redundancy |
| Placeholder as only input guidance, no label | Label + placeholder: Label "Email" / Placeholder "you@example.com" | Placeholder doesn't replace label |
| "ACCOUNT SETTINGS" (heading, no badge purpose) | "Account settings" (sentence case) | All-caps for headings is shouting |
| "An error has occurred while processing your request. Please try again later." | "Couldn't save. Try again?" | Shorter, direct, no blame |
| Empty state: "No items in your list" | Empty state: "You haven't created any items yet. Start one." | Explains state + suggests next action |
| Nav: "Home \| About Our Company \| Explore Our Products \| Contact Us" | Nav: "Home \| About \| Products \| Contact" | Shorter, scannable, consistent style |
| Placeholder: "Please enter your full name here" | Placeholder: "Jane Doe" | Shows format/example, not instructions |
| Helper text: "This field collects your email address so we can send you important notifications and other communications about your account." | Helper text: "We'll use this to send you account updates." | One sentence max, explains *why* |

---

## Placeholder pairings

| Field | Label | Placeholder |
|---|---|---|
| Email | Email | you@example.com |
| Date | Birth date | MM/DD/YYYY |
| Name | Full name | Jane Doe |
| Message | Message | What's on your mind? |

---

## Leave-it-alone examples (no change needed)

Mark these as `no-change` in the output table — do not rewrite for the sake of it.

| Original | Why leave it |
|---|---|
| Button: "Save" on a profile form | Clear verb, correct length, context obvious |
| H1: "Settings" on a settings page | Names the screen; no greeting needed |
| Label: "Email" + placeholder "you@example.com" | Label + format example already correct |
| Badge: "BETA" on a feature flag | Correct all-caps badge usage |
| CTA: "Start free trial" on pricing page | Specific, verb-forward, surface-appropriate |

---

## Context-dependent — not always wrong

Do not flag these unless context makes them genuinely unclear.

| String | When it's OK |
|---|---|
| "Continue" | Multi-step wizard where step title provides context |
| "No thanks" / "Maybe later" | Dismissal of optional prompts, newsletters, or upsells |
| "Delete" (short) | Modal title already states what's deleted ("Delete account?") |
| "Get started" | Landing page CTA when subhead explains the product |
| "OK" | Simple acknowledgment dialogs with clear title ("Saved") |
| "Submit" | Single obvious form action when no competing buttons |
