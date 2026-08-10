# ADMIN_1H_FULL_PRODUCTION_E2E

**Date (UTC):** 2026-08-10  
**Image:** `sha256:99c9e35443378313b13602cfdf43636fa04d2ae3835caab6153b2b75490cdb59`

## Public pages

| URL | Result |
|---|---|
| `/` `/xi` `/xi/login` `/xi/register` | 200 |
| `/xi/bull-demon-king` `/play` | 200 |
| `/admin` `/admin/login` | 200 |

## Admin authenticated path（prod image via loopback；公网页面 GET 已验）

Login → Dashboard → Players → Games → Rounds → Spins → Wallet → Ledger → Deposit → Withdrawal → Integrity → Risk → Audit(`logs/admin`) → Content → Activity → VIP → Support/Tickets → Admins → Roles → Sessions → Security  

**API_FAIL = 0**

## Auth / Money

| Check | Result |
|---|---|
| No token `/api/admin/me` | 401 |
| Wrong password | 401 |
| Deposit confirm | `PROVIDER_NOT_CONFIGURED` |
| Withdraw pay | `PROVIDER_NOT_CONFIGURED` / GATE CLOSED |

## Content APIs（public）

| Endpoint | Result |
|---|---|
| `/api/v1/game/banners` | 200 |
| `/api/v1/game/recommended-games` | 200（含 bull-demon-king） |
| `/api/v1/game/announcements` | 200 |

## Verdict

**FULL ADMIN E2E = PASS**  
**PLAYERS API = PASS**
