#!/usr/bin/env bash
set -euo pipefail
cd /d/Asian-Buffalo-R1-M5-Cursor-Clean
export GIT_TERMINAL_PROMPT=0
git reset HEAD >/dev/null 2>&1 || true

git add -- \
  'app/api/v1/game/rounds/[roundId]/route.ts' \
  app/api/v1/game/sessions/route.ts \
  app/api/v1/game/spins/route.ts \
  app/api/v1/game/wallet/balance/route.ts \
  app/game-client.tsx \
  app/globals.css \
  app/layout.tsx \
  client/m5 \
  lib/runtime-identity.ts \
  lib/dev-test-bootstrap.ts \
  lib/dev-schema-bootstrap.ts \
  lib/route-test-services.ts \
  package.json \
  tests/identity.test.mjs \
  tests/r1-m5-integration.test.mjs \
  tests/r1-m5-identity-gate.test.mjs \
  worker/index.ts

echo "STAGED=$(git diff --cached --name-only | wc -l | tr -d ' ')"
git diff --cached --name-only

mkdir -p docs/m5-integration
git diff --cached --binary > docs/m5-integration/AB-K1-R1-M5-review-v2.patch
git reset HEAD >/dev/null
echo REGEN_OK
