#!/usr/bin/env bash
set -euo pipefail
cd /d/Asian-Buffalo-R1-M5-Cursor-Clean
git diff --check 4049348 -- \
  app \
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
echo DIFF_CHECK_OK
echo '---SCOPE---'
git diff --name-only 4049348 -- \
  app \
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
git ls-files --others --exclude-standard | grep -E '^(app|client/m5|lib/(runtime|dev-|route-test)|tests/r1-m5|worker/)' || true
# prove hosting/vite/api-handlers untouched
for f in .openai/hosting.json vite.config.ts lib/api-handlers.ts; do
  if git diff --quiet 4049348 -- "$f"; then echo "UNCHANGED $f"; else echo "CHANGED $f"; exit 3; fi
done
