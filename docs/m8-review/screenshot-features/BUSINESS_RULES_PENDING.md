# BUSINESS_RULES_PENDING.md

**Rule:** Asian Buffalo Development Rule V1.1 — when frozen money/math/ops rules are unclear, pause that sub-item only and record here. Do not invent production thresholds from African Buffalo screenshots.

| ID | Area | Question | Impact if guessed | Status |
|----|------|----------|-------------------|--------|
| BR-001 | VIP thresholds | Exact deposit / bet / login conditions per VIP 1–6 for Myanmar ops | Wrong VIP unlock → unfair rewards | PENDING — admin-configurable; seed placeholders only |
| BR-002 | VIP validity | Default VIP expiry days / renew rules / SUSPENDED criteria | Wrong expire/credit | PENDING — schema supports expiresAt; default seed 30d |
| BR-003 | VIP reward amounts | Daily/weekly/monthly/level/event chest amounts (MMK minor) | Ledger credits wrong | PENDING — amounts from `vip_reward_defs` config only |
| BR-004 | Phone binding | SMS OTP vendor, rate limits, rebind cooldown, KYC | Compliance risk | PENDING — API stub validates E.164 format; no SMS send |
| BR-005 | Deposit presets | Official depositPresets[] amounts & min/max | Wrong rails | PENDING — Step 4 wired via `wallet_commerce_config.deposit` + admin upsert; placeholders only |
| BR-006 | Withdrawal limits | Min/max, daily cap, fee, VIP gate | Money loss / abuse | PENDING — Step 4 wired via `wallet_commerce_config.withdrawal` + admin upsert; placeholders only |
| BR-007 | Payment channels | Live KBZ/Wave/TRC20 credentials & callback secrets | Fraud | PENDING — channels seeded; live confirm fail-closed unless `AB_ALLOW_TEST_IDENTITY` harness |
| BR-008 | Support SLA | Ticket priority / response time | Ops only | PENDING — Phase 8 |
| BR-009 | Supported currencies beyond MMK | Which ISO codes live in production | Wallet mismatch | PENDING — profile lists MMK + config; balance stays player.currency |

**Paused sub-items (do not hardcode screenshot numbers):** VIP unlock amounts, chest MMK values, deposit preset list, withdrawal fee table.
