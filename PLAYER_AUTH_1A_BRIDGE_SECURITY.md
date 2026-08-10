# PLAYER_AUTH_1A_BRIDGE_SECURITY

**Date:** 2026-08-10

| Control | Status |
|---|---|
| Private bind default `127.0.0.1` | PASS（code） |
| Unrestricted `0.0.0.0` Production default | FORBIDDEN |
| Service Token Bearer | YES |
| Tailscale ACL | OPS（recommended; not auto-applied） |
| Rate limit phone / IP / daily | YES |
| Request timeout | YES |
| Structured errors | YES |
| Idempotency `requestId` | YES（15m） |
| SK password only Bridge ENV | YES |
| Log OTP / password / full phone / token | FORBIDDEN |

**BRIDGE PRIVATE design:** PASS  
**Bridge deployed + ACL live:** NOT TESTED / OPS pending
