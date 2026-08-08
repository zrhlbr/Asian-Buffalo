# REVIEW_PATCH — Lobby Banner Remove

## Patch artifact

- File: `AB-XI-LOBBY-BANNER-REMOVE-review.patch`
- Note: `client/xi-lobby/{lobby-app.tsx,lobby.css,i18n.ts}` are **untracked** in the current git index, so the patch is a full-file intent-to-add snapshot of the post-change state (not a tiny delta against a prior committed lobby). Use `BEFORE_AFTER.md` for the logical delta.

## SHA-256

See `SHA256.txt` (files + patch).

## Logical delta (what reviewers should focus on)

1. **Delete** home section `.xi-promo-banner` / `xi-promo-login` / CTA `xi-promo-checkin`
2. **Delete** CSS `.xi-promo-*` and 360px promo overrides
3. **Delete** i18n `lobby.promo.*` (all 3 langs); **keep** `lobby.feat.checkin`
4. **Add** Activity Center check-in entry class + modal button
5. **Polish** `.xi-rec-card.is-soon`, `.xi-quick-*`, topbar 320–430, bottom nav safe-area, LOW hero FX, main bottom padding

## Forbidden confirmation

No edits in this task to Hub / Play / m5 / wallet business / ledger / auth / admin / check-in API.
