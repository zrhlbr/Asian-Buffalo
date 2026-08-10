# ADMIN-1F i18n Report

## Admin chrome

New Content Center keys in ZH / EN / MY — parity tested.

## Content entities

Canonical keys: **zh / en / my** via `admin-content-i18n.ts`.  
Legacy VIP/activity `zh-CN` / `my-MM` normalized on write.

## Publish gate

Incomplete locales → `CONTENT_I18N_INCOMPLETE` (API + UI).

## Player locale selection

APIs return all three locales; client chooses by locale mode. Player announcement incomplete rows filtered out.

| Locale content | Verdict |
|----------------|---------|
| ZH | PASS |
| MY | PASS |
| EN | PASS |
