# VIP_ACTIVITY_REPORT

## VIP — PARTIAL
- Levels list (`vip_level_config`); assign player VIP with reason + audit.
- Level upsert API exists; UI still minimal (assign-focused).
- Config amounts marked BUSINESS_RULES_PENDING — not hardcoded screenshot law.
- Read-heavy if product freezes rule edits.

## Activities — PARTIAL
- Admin upsert definitions (Draft/enabled via enabled flag + dates).
- Player claim credits only through MoneyService + ledger (not admin balance button).
- Check-in claim path is player-side; admin sees activity defs.
