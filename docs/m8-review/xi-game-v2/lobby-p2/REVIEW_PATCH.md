# REVIEW_PATCH — Lobby P2

**Patch file:** `AB-XI-LOBBY-P2-review.patch`  
**Generated:** 2026-08-08 via `git add --intent-to-add` + `git diff` (then unstaged; **no commit**)

## Summary of delta

1. Honest announcement ticker (API-backed; empty/error states; no fake winners)
2. Recommended cards: BDK HOT + real image; others Coming Soon; jackpot only if real
3. Rankings modal → `RankingsPanel`; CS → Coming Soon (not dead)
4. Daily login CTA opens server check-in entry
5. Progressive hero srcset labels 720/1080/1440; mobile object-position
6. LOW/MED cut bloom/blur/particles; session cache for profile/balance
7. i18n keys + duplicate key cleanup

## Apply (local only)

```bash
git apply docs/m8-review/xi-game-v2/lobby-p2/AB-XI-LOBBY-P2-review.patch
```

Do not push/merge/deploy without Zhao approval.
