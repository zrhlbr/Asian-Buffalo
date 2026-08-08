# REVIEW_PATCH — Xi Performance Quality

**Date:** 2026-08-07  
**Patch file:** `REVIEW_PATCH.patch` (scoped git diff of tracked presentation files; new untracked files listed in `FILE_LIST.md`)  
**Commit:** none (forbidden this round)

## Summary

Extends Clarity V2 quality LOD to **LOW / MEDIUM / HIGH / ULTRA** with AUTO device probe, persisted settings (mode / FX / animal / FPS), mid-phone-friendly DPR caps, degrade-first atmosphere, FPS governor step-down without bounce-up, lobby/hub CSS FX LOD, progressive WebP heroes, and lazy slot prefetch on Start.

## Diff highlights

1. `client/m5/quality.ts` — 4 tiers, caps, settings, probe, governor hysteresis, FramePacer  
2. `client/m5/boot.ts` — applyQualityBundle + audio pause + document attrs  
3. Slot settings modal + Hud hooks for Ultra/FX/animal/FPS  
4. `client/xi-lobby/quality*.tsx` + lobby/hub wiring  
5. Generated `public/xi/heroes/*` variants via sharp  
6. Unit tests green (31 related)

## Forbidden untouched

Math / RTP / RNG / Wallet / Ledger / Round settlement / Admin business / Deposit-Withdraw-VIP rules.
