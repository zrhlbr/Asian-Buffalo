# PLAYER_AUTH_1A_MOBILE

**Date:** 2026-08-10

## Changes

- `tel` + `inputMode=tel` / OTP `numeric` max 6  
- Resend countdown 60s（`.xi-auth-resend`）  
- Placeholder `09… / +959…`  
- Auth shell already mobile-first in lobby CSS  

## Viewport targets（360–430）

Code-level: PASS（no horizontal overflow patterns introduced）.  
Headed device screenshot matrix: NOT RUN this phase（SMS blocked stop）.

MOBILE: **PASS**（implementation） / device matrix evidence: PARTIAL
