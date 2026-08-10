# ADMIN-1E i18n Report

## Coverage

New Risk / Audit UI strings added in ZH / EN / MY in `lib/admin/i18n.ts`:

- Risk tabs, metrics, levels, statuses, filters, evidence, disposition dialog, reason, empty/error
- Audit tabs, immutable hint, export FUTURE, security NOT_AVAILABLE labels

Technical identifiers kept English: ID, IP, API, MMK, USDT, OPEN/REVIEWING/RESOLVED/DISMISSED, HIGH/CRITICAL, etc.

## Parity

`tests/r1-m9-admin-1e.test.mjs` asserts key parity across ZH / EN / MY for ADMIN-1E keys → **PASS**.

Fixed duplicate MY keys `wallet.detail` / `wallet.timeline` (pre-existing collision surfaced by tsc).

## Verdict

| Locale | Pure UI (Risk/Audit keys) |
|--------|---------------------------|
| ZH | PASS |
| MY | PASS |
| EN | PASS |
