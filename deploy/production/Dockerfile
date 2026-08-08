# XI GAME / 西游戏 — Production image (self-host on zrh-server)
# Independent of ZRHPay / Accounts images and networks.
FROM node:22.14-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
# Lock may lag package.json during emergency prod pack; prefer install over hard ci fail.
RUN npm install --no-audit --no-fund
COPY . .
ENV NODE_ENV=production
RUN npm run build:win

# Reuse build node_modules (includes vinext + better-sqlite3) — avoid second install drift.
FROM build AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8788 \
    HOSTNAME=0.0.0.0
RUN groupadd -r xigame && useradd -r -g xigame -m xigame \
    && mkdir -p /data /logs \
    && chown -R xigame:xigame /app /data /logs
COPY deploy/production/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh
USER xigame
EXPOSE 8788
HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=8 \
  CMD curl -fsS "http://127.0.0.1:8788/xi" >/dev/null || exit 1
ENTRYPOINT ["/docker-entrypoint.sh"]
