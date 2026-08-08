# Wallet Center — MOBILE_REPORT

## Target

Phone width band **320–430px** (primary), tablet/PC secondary.

## Layout adaptations (CSS)

| Concern | Implementation |
|---------|----------------|
| Narrow width | Single-column asset cards under 640px |
| Tab overflow | Horizontal scroll tabs (`overflow-x: auto`) |
| CTA row | 3-column grid with min-height ≥36px |
| Sheet | Bottom sheet on phone (`align-items: flex-end`, max-height 90vh) |
| Truncation | Tabular amounts with ellipsis |
| Safe scroll | Filters + list inside scrollable sheet |

## Manual QA checklist (pending headed)

- [ ] 320 — no horizontal page crush; tabs scroll  
- [ ] 375 / 390 / 430 — cards + filters usable  
- [ ] Deposit / withdraw / ledger sheets close + backdrop  
- [ ] Language switch zh/en/my without reload break  

Screenshots: see BLOCKED_CAPTURE.md (server/browser unavailable this run).
