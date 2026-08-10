# PLAYER_AUTH_1A_SK_PROVIDER

**Date:** 2026-08-10

## Separation

Auth → `SmsProvider.send()` only.  
SK MultiWan HTML only inside Bridge adapter.

## SK contract (reconfirmed, no blind scan)

- `POST /goip_post_sms.html` + `username`/`password`  
- Wrong path `/goip/sendsms/` excluded  
- Prior errors: `invalid username or password` / `access restricted`

## This phase probe（no secrets printed）

| Check | Result |
|---|---|
| SK TCP `10.1.1.77:80` from Bridge-capable host | YES |
| `SK_SMS_USERNAME` / `SK_SMS_PASSWORD` in ENV | **MISSING** |
| Authorized real send smoke | **NOT EXECUTED** |

**SK PROVIDER code:** YES  
**SK REAL SEND:** BLOCKED（credentials absent — no guessing, no stub fake success）
