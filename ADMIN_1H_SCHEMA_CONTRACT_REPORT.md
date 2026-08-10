# ADMIN_1H_SCHEMA_CONTRACT_REPORT

**Date (UTC):** 2026-08-10  
**Mode:** Read-only compare → additive-only known fix already applied  

## Critical P0 (Players)

| Column | Expected | Actual | Result |
|---|---|---|---|
| `player_profiles.email` | required by admin players SQL | present | **MATCH** |

## Admin sidecar tables

| Table | Result |
|---|---|
| admin_users / sessions / audit_logs | MATCH |
| admin_risk_events / notes | MATCH |
| admin_banners | MATCH |
| admin_tickets / ticket_messages | MATCH |
| admin_recommended_games | MATCH（代码用 `enabled`，非 `status` — 命名差异非缺列） |

## Core game/ledger naming vs naive expect list

| Area | Notes | Risk |
|---|---|---|
| game_rounds / sessions | 生产列名与简化 expect 不同（如 `total_bet_minor` vs `bet_minor`） | Admin queries 使用实际生产列 — **非 P0 drift** |
| ledger_* | 生产用 `player_id`/`kind` 等 | Admin 查询已对齐 — **非 P0** |
| player_activities | 用 `enabled` 非 `status` | 对齐代码 — **非 P0** |

## Verdict

| Gate | Result |
|---|---|
| PRODUCTION SCHEMA CONTRACT | **PASS** |
| DB MIGRATION this round | 无新破坏性 migration；email 加性 ALTER 已在前一轮落地 |
| DROP/TRUNCATE | **NO** |
