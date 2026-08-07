# Detailed Audit Steps

Load this file when performing the audit. Split into copy audit (default) and
optional typography/CSS audit.

For rewrite examples, see [examples.md](examples.md).

---

## Part A — Copy audit (default)

Run this on every audit unless the user asks for typography/CSS only.

### A1. Headings (H1, H2, H3) — canonical rules

Headings are navigation. They tell users where they are and what's next.

**Structure:**
- One H1 per page (the main title). Never skip levels (no H1 → H3).
- H2 introduces major sections.
- H3+ breaks down complex sections further.
- Never use headings for styling — use `<strong>` or a styled `<p>` instead.
- Headings should be unique across the page (no duplicate H2 titles).

**H1 (page title):**
- States the page's primary content in plain language.
- 3–8 words for utility screens (web app, dashboard).
- Landing pages: benefit-led OK if it still states what the product is (see
  [playbooks.md](playbooks.md)).
- Bad: "Unleash Your Potential" (what does this page do?)
- Good: "Sales Dashboard" / "Invoice software for freelancers"

**H2 (section title):**
- 2–6 words. Introduces a major topic.
- Bad: "Our Comprehensive Suite of Tools" / "Dive Into Your Data"
- Good: "Available Tools" / "Revenue by Region"

**H3 (subsection):**
- 2–4 words. Avoid H3 without a parent H2.

**Capitalization:**
- Default: sentence case (capitalize first word and proper nouns).
- If design uses Title Case, check consistency — flag mixing.
- All-caps: only for badges/status tags, never for headings.

**Bad hierarchy example:**
```
# Welcome to Our Platform
(page is about viewing reports, not welcoming users)

### Important Notice
(skipped H2, visual weight doesn't match content importance)
```

**Good hierarchy example:**
```
# Sales Report
## Q3 Performance
### Revenue by Region
```

### A2. Body text

**Paragraph structure:**
- One idea per paragraph.
- Keep paragraphs short: 2–4 sentences max.
- Use subheadings to break up long sections.

**Readability:**
- Avoid passive voice where active is shorter.
- Cut redundant words: "very important" → "important"; "currently available" → "available."
- Avoid jargon unless the audience knows it. Define it once if needed.
- Sentences > 20 words get hard to parse — split or rewrite.

**Red flags:**
- Paragraph with 5+ sentences on one topic.
- Passive voice where active would be clearer.

### A3. Labels

**Form labels:**
- One to three words. "Email address" not "Please enter your email address."
- Sentence case: "First name" not "First Name."
- Never use placeholder as the only label.

**Required indicators:**
- Mark required: `Label *` or `Label (required)`, not both.
- Mark optional if most fields are required: `Label (optional)`
- Conditional fields: `Label (only if X is selected)`

**Table column headers:**
- One to four words. Reflect column content.
- Include units if needed: "Time (hours)" not just "Time"
- Sortable columns: visual indicator (arrow), not text alone.

**Helper text (beneath label):**
- Explain *why* or expected format. One sentence max.
- Bad: paragraph explaining every use of the email field.
- Good: "We'll use this to send you account alerts."

**Red flags:**
- Label and placeholder both filled (redundant).
- Label is a question: "What is your email?" → "Email"
- Label longer than 5 words.
- Helper text is a paragraph.

### A4. Button text

**Rules:**
- Start with a verb: "Save," "Send," "Delete," "Learn more."
- 1–4 words. If you need more, add helper text nearby.
- Sentence case: "Save changes" not "Save Changes."

**States:**
- Default: "Save"
- Loading: "Saving..." or spinner only
- Disabled: keep same text; visual state signals off
- Success: "Saved" or checkmark, then revert
- Error: "Try again" or "Retry" — not "Error" in the button

**Secondary buttons:**
- Verb-forward: "Cancel," "Skip," "Learn more"
- "No thanks" / "Maybe later" OK for dismissals (optional prompts, upsells)

**Destructive buttons:**
- Distinct color (usually red).
- "Delete account" when object isn't obvious; short "Delete" OK if modal title
  states what's deleted (see [examples.md](examples.md)).
- Confirmation modal states consequence.

**Exceptions:**
- "Continue" OK in wizards when step context is clear.
- "OK" OK when dialog title provides context.

**Red flags:**
- Full-sentence button text.
- No action verb.
- All-caps button text (not a badge).
- Vague: "Go" without context. "Submit" when multiple actions compete.

### A5. Placeholders

- Show format, not instructions: "MM/DD/YYYY" not "Enter date here."
- Realistic example: "you@example.com" not "email@domain.com."
- Disappear on input. Never replace the label.
- One short phrase max. No jargon without explanation.

**Red flags:**
- Placeholder acts as label.
- Full-sentence placeholder.
- Placeholder conflicts with label.

### A6. Navigation

**Menu items:**
- Consistent capitalization across all items.
- One to three words per item.
- Group related items if > 5 top-level items.

**Breadcrumbs:**
- Show path: `Home > Products > Laptops`
- Each segment a link except current page.
- Don't over-specify last segment.

**Active state:**
- Visually distinct (bold, color, underline) — not color alone.

**Link text:**
- Descriptive: "Read the FAQ" not "click here"
- New tab: indicate with text or icon.

**Red flags:**
- Mixed Title Case / sentence case in nav.
- Vague links: "read more," "here," "click here."
- Breadcrumbs too long or too many levels.

### A7. Microcopy

**Helper text:** explains why or format; scannable lists for password rules.

**Validation errors:** specific fix, neutral tone, never blame user.
- Bad: "Invalid email" / "You didn't enter a password"
- Good: "Email must include an @" / "Password is required"

**Success messages:** brief, warm, no false enthusiasm.
- Bad: "Your account has been successfully created!"
- Good: "Account created." / "All set!"

**Empty states:** what's missing + suggested action.
- Bad: "No data available"
- Good: "You haven't created any projects yet. Start a new one."

**Confirmation dialogs:** state action + consequence.
- Bad: "Are you sure?"
- Good: "Delete account? This cannot be undone."

**Tooltips:** 1–2 sentences max. Shorter than the label.

**Badges:** short, ALL CAPS (`BETA`, `PENDING`, `ACTIVE`). Text + color, not color alone.

**Error recovery:** specific + actionable + escape hatch.
- Bad: "Something went wrong."
- Good: "Couldn't save. Check your connection and try again, or contact support."

### A8. Vocabulary & tone

**AI-sounding vocabulary** (flag as `ai-vocab`):
`leverage, seamless, robust, unlock, empower, elevate, streamline,
comprehensive, holistic, tailored, dive into, delve, navigate, landscape,
ecosystem, game-changer, cutting-edge, revolutionize, harness, embark,
unleash, foster, in today's [fast-paced/digital] world, moreover,
furthermore, it's worth noting, in conclusion, at the end of the day`

**Overly formal** (except legal/compliance):
"Please enter a valid email address" → "Enter a valid email"

**Marketing speak in utility UI** (flag as `wrong-surface` or `tone`):
"Unlock your potential," "Seamless experience," "Comprehensive solution"

---

## Part B — Typography / CSS audit (optional)

**Skip Part B** unless the user asks for typography/CSS audit or styles are
explicitly in scope. Copy-only audits should not flag `font-weight` values.

**Heading structure (visual):**
- Headings: font-weight 600–700. Body: 400–500. Avoid 300 for body.
- Line-height: 1.5x+ for body; 1.2–1.3x for headings.
- Emphasize with bold or size, not ALL CAPS or color alone.

**Line length & spacing:**
- Optimal body line length: 50–75 characters.
- Line-height: 1.5x–1.8x for body (e.g. 16px → 24–28px line-height).
- Letter-spacing: normal unless design requires tracking for all-caps labels.

**Red flags:**
- Line length > 75 characters (hard to scan).
- Line height < 1.4x (cramped, especially mobile).
- Heading with regular/light weight (reads as body).
- H1 and H2 visually indistinguishable.
- Mixed capitalization styles mid-page.
- Font size < 14px for body on mobile.
- Line length > 100 characters.

**Color contrast:**
- WCAG AA: 4.5:1 normal text, 3:1 large text.
- Light gray on white fails readability.

---

## Part C — Accessibility checklist

Flag issues as `a11y` in the output table.

- **Contrast:** text passes WCAG AA (see Part B).
- **aria-label:** matches visible text intent; not redundant or misleading.
- **Icon-only buttons:** must have accessible name (`aria-label` or visible tooltip).
- **Error messages:** linked to field via `aria-describedby` or equivalent.
- **Badges/status:** text + color (or icon + text), never color alone.
- **Link purpose:** descriptive text for screen readers ("Learn more about pricing" or visible "See pricing").
- **New tab links:** announced to assistive tech.

---

## Part D — i18n

Flag issues as `i18n-risk` where applicable.

- **Scope:** only rewrite the locale the user requested (usually default English).
- **Do not change:** translation keys, only display string values.
- **Preserve interpolation:** `{name}`, `{{count}}`, `%s`, ICU plurals (`{count, plural, ...}`).
- **Preserve HTML/markup** in translated strings unless explicitly refactoring.
- **Flag:** tone inconsistency across locale files for the same key.
- **Flag:** English rewrites that break layout in RTL locales or languages with
  longer average word length (German, Finnish) — note expansion risk.
- **Do not flatten** established multilingual voice (e.g. BM/English mix) into generic English.

---

## Part E — SEO (landing pages)

Apply when auditing marketing/landing surfaces.

- **Title tag:** ~50–60 characters; primary keyword + brand if room.
- **Meta description:** ~150–160 characters; specific benefit, not tagline fluff.
- **H1:** one per page; aligns with page topic (not identical to title required, but consistent).
- **OG/social:** title and description should work when shared — not "Home."

**Red flags:**
- Title: "Home" or "Welcome"
- Meta description repeats H1 verbatim
- Missing or duplicate meta descriptions across pages
