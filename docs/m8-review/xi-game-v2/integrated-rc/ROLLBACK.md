# ROLLBACK — Integrated RC

## Scope of this pass (revert these only)

1. `app/page.tsx` — restore prior `GameClient` mount (or delete redirect)
2. `app/game/page.tsx` — restore prior `GameClient` alias
3. `app/admin/login/page.tsx` — delete
4. `next.config.ts` — remove `/` and `/game` redirect entries (keep `/xi/bdk` if desired)
5. `app/xi/page.tsx` — comment only
6. `client/m5/styles.css` — restore header comment if required
7. `tests/xi-lobby-phase1.test.mjs` / `tests/xi-integrated-rc.test.mjs` — revert / delete
8. `docs/m8-review/xi-game-v2/integrated-rc/**` — delete pack

## Do NOT revert

Steps 1–5 accepted modules (lobby/hub/play/wallet/VIP/admin commerce) — they are independent packages with their own ROLLBACK notes.

## Verify after rollback

- `#gl` translateZ still present; `#hud` shell without translateZ
- `/xi` lobby still loads
- No commit was made in this pass — rollback = filesystem restore only
