## Summary

<!-- What changed and why. -->

## Related issue

<!-- Fixes #123 or "None" -->

## Type of change

- [ ] Bug fix
- [ ] Feature / enhancement
- [ ] Chat / AI pipeline
- [ ] API / Cloudflare Workers
- [ ] Docs / repo housekeeping
- [ ] Refactor

## Test plan

- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] `pnpm run build:worker` (required for app / route changes)

**Manual:**

- [ ] `pnpm dev` — chat UI loads, session picker works
- [ ] Chat — send a message, stream, thumbs feedback (if touched)
- [ ] `pnpm preview` — Workers runtime + AI binding (if chat/API touched)

## Cloudflare / security checklist

- [ ] No secrets or `.env` values committed
- [ ] Calendar traffic stays same-origin (`/api/v1/*`) — no upstream URL in client bundles
- [ ] Turnstile considered for chat paths
