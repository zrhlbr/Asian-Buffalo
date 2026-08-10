# ADMIN_1H_CLEAN_RELEASE_REPORT

## Dirty tree classification（摘要）

| Class | Examples | Into release? |
|---|---|---|
| A Production 必需 | admin app/api/lib, player-content, player-commerce-bootstrap | YES |
| B ADMIN-1B～1G | admin modules/tests | YES |
| C ADMIN-1H 修复 | public content routes；M8 lobby sync | YES |
| D Reports | ADMIN_1H_*.md / PRODUCTION_*.md | YES（文档单独纳入） |
| E Local/Test only | `.dev.vars` | **NO** |
| F Unrelated dirty | `client/m5/*` 商业视觉、大量 docs/m8-review | **NO** |
| G Secret/Forbidden | `.dev.vars` secrets | **NO** |

## Release identity chain

| Layer | Value |
|---|---|
| M9 SOURCE COMMIT | （本轮本地 commit SHA，见 FINAL_VERDICT） |
| M8 Lobby COMMIT | （lobby sync 本地 commit SHA） |
| RELEASE TAG | `xigame-admin-prod-20260810` |
| PRODUCTION IMAGE | `sha256:99c9e35443378313b13602cfdf43636fa04d2ae3835caab6153b2b75490cdb59` |
| ROLLBACK IMAGE | `sha256:dc0884cd2947…` + `prod-pre-admin-20260809-232936`；另有 `prod-pre-admin-1h-20260810-202300` |

## Git discipline

- NO Push / Merge / Rebase  
- 禁止 `git add .`  
- 仅 add A/B/C + 1H 报告交付物  

**CLEAN RELEASE = YES**（本地 commit+tag；可复现生产镜像对应 allowlist）
