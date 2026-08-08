#!/usr/bin/env bash
set -euo pipefail
STAMP="${1:?stamp required}"
APP=/home/zrh-admin/xigame-prod/app
LOGDIR=/home/zrh-admin/xigame-prod/logs
mkdir -p "$LOGDIR"
date -u +%Y-%m-%dT%H:%M:%SZ > "$LOGDIR/rebuild-${STAMP}.begin"

echo "[1] verify theme + stages + utf8 lobby.css"
test -f "$APP/client/xi-lobby/theme-red-gold.css"
test -f "$APP/client/xi-lobby/theme-tokens.css"
test -f "$APP/public/xi/stages/nantianmen-portrait-phone.webp"
python3 - <<'PY'
from pathlib import Path
p = Path('/home/zrh-admin/xigame-prod/app/client/xi-lobby/lobby.css')
data = p.read_bytes()
data.decode('utf-8')
print(f'lobby.css utf8_ok bytes={len(data)}')
PY
grep -n "theme-red-gold" "$APP/client/xi-lobby/xi-shell.tsx"
grep -n "xi-red-primary" "$APP/client/xi-lobby/theme-tokens.css" | head -5

echo "[2] docker compose build + up"
cd "$APP/deploy/production"
docker compose build xigame-web
docker compose up -d xigame-web

echo "[3] wait healthy"
for i in $(seq 1 24); do
  st=$(docker inspect -f '{{.State.Health.Status}}' xigame-web 2>/dev/null || echo missing)
  echo "health=$st ($i)"
  if [ "$st" = "healthy" ]; then
    break
  fi
  sleep 10
done

echo "[4] identity + local probe"
docker inspect -f 'image={{.Image}} created={{.Created}} status={{.State.Status}} health={{.State.Health.Status}}' xigame-web
curl -fsS -o /tmp/xi.html -w 'local_xi=%{http_code} bytes=%{size_download}\n' http://127.0.0.1:18130/xi
grep -oE '/assets/[^" ]+\.css' /tmp/xi.html | sort -u
curl -fsSI "http://127.0.0.1:18130/xi/stages/nantianmen-portrait-phone.webp" | head -8 || true
css=$(grep -oE '/assets/lobby-[^" ]+\.css' /tmp/xi.html | head -1 || true)
if [ -n "$css" ]; then
  echo "lobby_css=$css"
  curl -fsS "http://127.0.0.1:18130$css" -o /tmp/lobby.css
  echo -n "has_xi_red_primary="; grep -c -- '--xi-red-primary' /tmp/lobby.css || true
  echo -n "has_E32619="; grep -ci -- '#e32619' /tmp/lobby.css || true
  echo -n "has_nantianmen="; grep -c -- 'nantianmen' /tmp/lobby.css || true
fi

date -u +%Y-%m-%dT%H:%M:%SZ > "$LOGDIR/rebuild-${STAMP}.end"
echo "REBUILD_DONE stamp=$STAMP"
