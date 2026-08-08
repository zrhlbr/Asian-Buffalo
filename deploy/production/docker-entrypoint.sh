#!/usr/bin/env bash
set -euo pipefail

export NODE_ENV=production
export PORT="${PORT:-8788}"
export HOSTNAME="${HOSTNAME:-0.0.0.0}"
export AB_SQLITE_PATH="${AB_SQLITE_PATH:-/data/xigame.sqlite}"
export AB_FORCE_FAIL_CLOSED_IDENTITY="${AB_FORCE_FAIL_CLOSED_IDENTITY:-1}"

# Hard fail-closed money / identity gates — never inherit test bypasses.
unset AB_ALLOW_TEST_IDENTITY || true
unset AB_AUTH_OTP_TEST_MODE || true
unset AB_TEST_PLAYER_ID || true

mkdir -p "$(dirname "$AB_SQLITE_PATH")" /logs

echo "[xigame] starting vinext production server on ${HOSTNAME}:${PORT}"
echo "[xigame] sqlite=${AB_SQLITE_PATH}"
echo "[xigame] money/identity gates: FAIL_CLOSED (test identity/otp unset)"

exec npx vinext start -H "$HOSTNAME" -p "$PORT"
