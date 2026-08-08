# BUSINESS_RULES_PENDING — Step 4 (Wallet / VIP / Deposit / Withdrawal)

**Policy:** Admin-configurable defaults shipped for wiring. Do **not** treat African Buffalo screenshot numbers as permanent law. Fail closed when live provider secrets / production thresholds are missing.

| ID | Area | Question | Step 4 handling | Status |
|----|------|----------|-----------------|--------|
| BR-001 | VIP thresholds | Exact deposit/bet/login conditions per VIP 1–6 | Admin `vip_level_config.conditions_json`; seeds null | PENDING |
| BR-002 | VIP validity | Expiry / renew / SUSPENDED | Schema `vip_expires_at`; admin assign | PENDING |
| BR-003 | VIP / activity rewards | Chest & activity MMK amounts | `vip_reward_defs` / `player_activities` / check-in config | PENDING |
| BR-004 | Phone binding | SMS OTP vendor | E.164 stub only | PENDING |
| BR-005 | Deposit presets | Official presets min/max | `wallet_commerce_config.deposit` placeholders + admin upsert | PENDING — wired with replaceable defaults |
| BR-006 | Withdrawal limits | Min/max/daily/fee/VIP gate | `wallet_commerce_config.withdrawal` placeholders + admin upsert | PENDING — wired with replaceable defaults |
| BR-007 | Payment channels | Live KBZ/Wave/TRC20 credentials & callback HMAC | Channels seeded; **live confirm fail-closed** without `AB_ALLOW_TEST_IDENTITY` | PENDING |
| BR-008 | Support SLA | Tickets | Out of Step 4 | PENDING (Step 5+) |
| BR-009 | USDT / multi-currency | Production ISO codes | USDT channel disabled by default until enabled | PENDING |

**Paused as permanent law:** VIP unlock amounts, chest MMK values, deposit preset list, withdrawal fee table, live provider secrets.
