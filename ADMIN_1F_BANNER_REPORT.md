# ADMIN-1F Banner Report

## Schema

`admin_banners` (admin bootstrap sidecar)

Fields: id, title, locales_json (zh/en/my), image_url, target_url, starts_at, ends_at, status, sort_order, text_strategy, version, created_by, updated_by, published_by, published_at.

## Status

DRAFT · SCHEDULED · ACTIVE · PAUSED · EXPIRED  
(ACTIVE/SCHEDULED/EXPIRED computed from stored status + wall clock)

## Lifecycle

Create/Edit (DRAFT) → Publish (`content:publish`) → Unpublish → PAUSED  
Publish requires TRI_LOCALE completeness **or** explicit `IMAGE_ONLY` strategy.

## Media

No file upload service. Rejects `javascript:`, `data:`, `.html/.js/.svg`. HTTPS (or relative `/`) only.

## APIs

- Admin: `GET/POST content/banners`, `POST .../publish|unpublish`
- Player: `GET /api/v1/game/banners` (ACTIVE only)
