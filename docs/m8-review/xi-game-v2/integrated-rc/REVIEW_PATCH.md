# REVIEW_PATCH — Integrated RC

Binary / text patch: `AB-XI-INTEGRATED-RC-review.patch`

## Intent

Unify Steps 1–5 into one navigable system **without rewriting** accepted modules.

## Code deltas (this pass)

| File | Change |
|------|--------|
| `app/page.tsx` | Compat `permanentRedirect` → `/xi/bull-demon-king/play` |
| `app/game/page.tsx` | Same compat redirect |
| `app/admin/login/page.tsx` | **New** — mounts AdminApp |
| `next.config.ts` | Redirects for `/` and `/game` |
| `app/xi/page.tsx` | Comment update |
| `client/m5/styles.css` | CSS comment brand only (牛魔王) |
| `tests/xi-lobby-phase1.test.mjs` | Canonical hub href + login/play files |
| `tests/xi-integrated-rc.test.mjs` | **New** integration gates |
| `docs/.../integrated-rc/*` | Delivery pack + smoke harness |

## SHA256

See `SHA256.txt` for integration-touched files.
