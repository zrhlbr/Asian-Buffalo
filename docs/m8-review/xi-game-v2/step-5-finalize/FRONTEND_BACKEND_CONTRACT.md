# FRONTEND_BACKEND_CONTRACT — Step 5 update

**Base:** Step 4 contract remains. Additive readiness fields only.

## Additive readiness (BR-005..007)

| Method | Path | Additive fields |
|--------|------|-----------------|
| GET | `/api/v1/game/deposit/channels` | `config.productionReady`, `channels[].readiness`, `readiness` aggregate |
| GET | `/api/v1/game/withdraw` | `config.productionReady`, `channels[].readiness`, `readiness` aggregate |

### `readiness` shape

```json
{
  "status": "NOT_PRODUCTION_READY",
  "productionReady": false,
  "code": "NOT_PRODUCTION_READY",
  "reason": "BR-005/006/007 placeholders or live provider secrets unset — fail closed",
  "testHarnessAllowed": false,
  "brRefs": ["BR-005", "BR-006", "BR-007", "BR-009"],
  "channels": [/* ChannelReadiness */]
}
```

### Channel readiness

| Field | Notes |
|-------|-------|
| `status` | `TEMP` \| `NOT_PRODUCTION_READY` \| `PRODUCTION` |
| `provider` | `TEMP` until live PSP |
| `callbackConfigured` | must be true for PRODUCTION |
| `timeoutMs` / `reconEnabled` | null/false until signed |

## Unchanged invariants

- Auth via `resolveActivePlayer`
- Balance never accepted from client body
- Deposit confirm fail-closed without `AB_ALLOW_TEST_IDENTITY` → `PROVIDER_NOT_CONFIGURED` 503
- Admin mutations require `reason` + audit
