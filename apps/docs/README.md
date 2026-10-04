# Paraape docs

Fumadocs site for the protocol. The engineering spec stays at `docs/PRD.md` in the repo root. This app is the public reference: how cover works, the contracts, and how to run the stack.

```bash
cd apps/docs
pnpm dev
```

The public site is [docs.paraape.xyz](https://docs.paraape.xyz). `/` redirects to `/docs`.

Pages live in `content/docs`. Sidebar order is the `meta.json` next to them.

```bash
pnpm --filter docs build
pnpm --filter docs check-types
```
