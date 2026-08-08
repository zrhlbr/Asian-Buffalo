# VIP_DESIGN.md

## Levels 1–6
Admin-configurable via `vip_level_config` (`conditions_json`). Seed titles are Asian Buffalo originals (Bronze→Imperial). **No screenshot deposit/bet numbers hardcoding** (BR-001).

## Validity
`player_vip`: `level`, `status ∈ {ACTIVE,EXPIRED,PENDING,SUSPENDED}`, `vip_started_at`, `vip_expires_at`.  
ACTIVE past `vip_expires_at` → auto EXPIRED on read.

## FE
`#vip-modal`: level switcher 1–6, unlocked/locked cards, chests section.

## Admin
Module `VIP` — list config + assign player VIP (audited).
