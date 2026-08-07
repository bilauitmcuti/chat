# Finding User-Facing Strings in Code

Use this guide during Step 1 (inventory). Read the relevant sections for the
stack you detect in the repo.

---

## i18n / translation files

Check these locations first — many products centralize copy here:

| Pattern | Common stacks |
|---------|---------------|
| `locales/en.json`, `en-US.json` | next-intl, react-i18next, vue-i18n |
| `messages/en.json`, `messages.ts` | next-intl |
| `public/locales/en/` | react-i18next |
| `*.po`, `*.pot` | gettext, Django |
| `strings.xml`, `strings/` | Android |
| `Localizable.strings`, `*.lproj` | iOS / macOS |
| `arb` files | Flutter |
| `translations/` | various |

**Rules when editing i18n files:**
- Change display values only, not keys.
- Preserve `{variables}`, `{{mustache}}`, ICU syntax, and `%s` placeholders.
- Do not rewrite non-target locales unless the user asks.

---

## React / Next.js / frontend components

**Inline JSX text:** string literals between tags, `{t('key')}` calls.

**Props that hold copy:**
```
placeholder=
aria-label=
aria-labelledby=
aria-describedby=
title=
alt=
label=
description=
helperText=
emptyState=
emptyText=
toast(
message=
confirmText=
cancelText=
```

**Next.js metadata:**
- `export const metadata = { title, description, openGraph }`
- `generateMetadata()` return values
- `layout.tsx` default titles

**Route-level files:**
- `app/**/page.tsx`, `layout.tsx`
- `pages/**/*.tsx` (Pages Router)
- `components/**` shared UI

---

## Design system / component libraries

Many strings live in props, not JSX text nodes:

| Library | Where copy hides |
|---------|------------------|
| shadcn / Radix | `DialogTitle`, `DialogDescription`, `AlertDialog`, `Toast` |
| MUI | `label`, `helperText`, `placeholder`, `emptyMessage` |
| Ant Design | `Form.Item label`, `message`, `description` |
| Chakra | `FormLabel`, `FormHelperText`, `EmptyState` |
| React Hook Form | validation `message` in schema/resolver |

Search component usage, not just string files.

---

## Suggested grep patterns

Run from repo root (adjust paths as needed):

```bash
# Form & a11y copy
rg 'placeholder=|aria-label|aria-labelledby|aria-describedby' --glob '*.{tsx,jsx,vue,svelte}'

# Headings & titles
rg '<(h1|h1|title|Title|DialogTitle|CardTitle)' --glob '*.{tsx,jsx}'

# Empty states & feedback
rg 'emptyState|emptyText|EmptyState|toast\(|snackbar|alert\(' --glob '*.{tsx,jsx,ts}'

# SEO & meta
rg 'metadata|meta.*description|openGraph|og:title' --glob '*.{tsx,jsx,ts}'

# i18n keys
rg "t\(['\"]|useTranslations|FormattedMessage" --glob '*.{tsx,jsx,ts}'

# Mobile
rg 'tabBar|TabBar|navigationOptions|headerTitle' --glob '*.{tsx,jsx,ts}'

# Email templates
rg 'subject:|Subject:|preheader' --glob '*.{html,tsx,mjml}'
```

For plain string search:
```bash
rg '"[A-Z][^"]{10,}"' --glob '*.tsx' -l
```
(Use with judgment — catches many non-UI strings.)

---

## Voice & style docs in repo

Before rewriting, search for established guidelines:

```
VOICE.md
CONTENT.md
style-guide.md
brand/
docs/content-guidelines*
.design/
storybook/**/Introduction*
```

Match existing voice; don't override documented standards.

---

## Design system constraints

Before suggesting longer/shorter copy, check:

- Button max-width or truncation in component tokens
- Tab bar width constants
- `maxLength` on inputs (may affect placeholder length)
- Character limits in CMS or store listing configs

Flag `truncation-risk` when rewrites may overflow known constraints.

---

## Large codebases

When inventory exceeds ~50 strings:

1. **Scope one area per pass** — one route, screen, or feature folder.
2. **Ask the user** which area to prioritize if scope is unclear.
3. **Executive summary** per pass; don't dump 200 rows at once.
4. **Screenshot or browser check** when truncation is suspected — use browser
   tools or ask the user for a screenshot before flagging layout issues.

---

## What NOT to inventory

Unless explicitly asked:

- Variable names, function names, type names
- Code comments, TODO comments
- Console logs, debug strings
- Commit messages, PR templates
- Internal admin-only tooling (unless user includes it)
- Test fixture strings (unless testing user-visible output)

---

## Mixed surfaces in one repo

Common monorepo patterns:

| Path pattern | Likely surface / project type |
|--------------|-------------------------------|
| `app/(marketing)/`, `landing/`, `www/` | landing |
| `app/(dashboard)/`, `admin/`, `console/` | dashboard / internal admin |
| `app/(app)/`, `settings/`, `onboarding/` | web-app |
| `apps/mobile/`, `packages/app/` | mobile |
| `app/(shop)/`, `cart/`, `checkout/`, `products/` | e-commerce |
| `seller/`, `vendor/`, `listings/` | marketplace (seller) |
| `docs/`, `content/`, `mdx/` | docs / content |
| `packages/cli/`, `bin/`, `cmd/` | cli |
| `extension/`, `popup/`, `manifest.json` | extension |
| `stripe/`, `billing/`, `subscription/`, `pricing/` | saas / auth-billing |
| `chat/`, `assistant/`, `prompts/` | ai-chat |
| `packages/api/`, `playground/` | dev-tool |

Tag each finding with the correct surface in the output table.

---

## Project-type grep patterns

```bash
# SaaS / billing
rg 'subscription|billing|upgrade|trial|workspace|invite' --glob '*.{tsx,jsx,ts}'

# E-commerce
rg 'cart|checkout|addToCart|shipping|order' --glob '*.{tsx,jsx,ts}'

# Marketplace
rg 'seller|buyer|listing|payout|vendor' --glob '*.{tsx,jsx,ts}'

# Dev tools
rg 'apiKey|api_key|webhook|playground|openapi' --glob '*.{tsx,jsx,ts,md,mdx}'

# Extension
rg 'manifest_version|chrome\.runtime|browser_action' --glob '*.{json,html,js,ts}'

# AI / chat
rg 'chat|prompt|assistant|completion|token' --glob '*.{tsx,jsx,ts}'

# Auth providers
rg 'signIn|signUp|ClerkProvider|Auth0|next-auth' --glob '*.{tsx,jsx,ts}'
```
