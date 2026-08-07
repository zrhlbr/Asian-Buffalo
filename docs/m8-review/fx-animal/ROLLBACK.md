# 回滚方案（FX + 动物动态）

```bash
# 在 Asian-Buffalo-R1-M8-Cursor-Clean 工作区
git checkout -- client/m5/game/reels.ts client/m5/scene/buffalo.ts \
  client/m5/game/game.ts client/m5/audio.ts client/m5/quality.ts client/m5/boot.ts
rm -f client/m5/game/symbol-life.ts tests/r1-m8-symbol-life.test.mjs
```

无需数据库 / API / 钱包回滚。
