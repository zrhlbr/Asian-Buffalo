# PLAYER_AUTH_1A_SMS_ARCHITECTURE

**Date:** 2026-08-10 · **Product:** XI GAME only（非 ZRHPay）

## Target path

```
Player Browser (HTTPS)
  → www.xibull.com XI GAME API
  → SmsProvider.send() / SmsBridgeClient
  → Secure SMS Bridge (Tailscale private)
  → SK Device 10.1.1.77:80 /goip_post_sms.html
```

## Forbidden

- Browser → SK  
- XI GAME API → `http://10.1.1.77/...`  
- Public Port-Forward of SK :80  
- ZRHPay identity coupling  

## Components (M8)

| Component | Path | SK password |
|---|---|---|
| Auth Domain | `lib/player-otp.ts`, `lib/player-auth-service.ts` | NO |
| SmsProvider | `lib/otp-providers.ts` → `SmsBridgeOtpAdapter` | NO |
| Bridge Client | `lib/sms/bridge-client.ts` | NO |
| SMS Bridge | `deploy/sms-bridge/` | YES（host ENV only） |
| SK Adapter | `deploy/sms-bridge/sk-adapter.mjs` | ENV only |

## Bridge contract

`POST /internal/v1/sms/send`  
Request: `requestId`, `purpose` (`REGISTER_OTP`|`LOGIN_OTP`|`RESET_PASSWORD`), `phone`, `message`  
Response: `requestId`, `accepted`, `provider`, `providerMessageId`, `errorCode`  
Never returns SK password or raw device body.

## Network

| From | To SK | Result |
|---|---|---|
| Tailscale node `100.105.217.7` | `10.1.1.77:80` | Reachable |
| zrh-server | `10.1.1.77` | Unreachable → Bridge required |

## ENV

XI GAME: `AB_SMS_BRIDGE_URL`, `AB_SMS_BRIDGE_TOKEN`（无 SK 密码）  
Bridge host: `BRIDGE_SERVICE_TOKEN`, `SK_SMS_BASE_URL`, `SK_SMS_USERNAME`, `SK_SMS_PASSWORD`
