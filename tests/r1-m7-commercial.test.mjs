import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

test("M7 commercial shell preserves formal Hud DOM IDs", () => {
  const shell = read("app/game-client.tsx");
  for (const id of [
    "balance",
    "win",
    "bet",
    "btn-spin",
    "btn-auto",
    "btn-turbo",
    "btn-sound",
    "btn-settings",
    "celebration",
    "jackpot-banner",
    "loading",
  ]) {
    assert.match(shell, new RegExp(`id="${id}"`));
  }
  assert.match(shell, /m7-commercial/);
  assert.match(shell, /celebration-rays/);
  assert.match(shell, /commercial-spin/);
});

test("M7 symbol art covers animals, wild/scatter, and letter gems", () => {
  const symbolsDir = join(root, "client/m5/assets/symbols");
  const needed = [
    "buffalo.png",
    "lion.png",
    "elephant.png",
    "antelope.png",
    "zebra.png",
    "wild.png",
    "scatter.png",
    "a.png",
    "k.png",
    "q.png",
    "j.png",
    "ten.png",
    "nine.png",
  ];
  for (const name of needed) {
    assert.ok(existsSync(join(symbolsDir, name)), `missing ${name}`);
  }
  const src = read("client/m5/game/symbols.ts");
  assert.match(src, /ART_URL/);
  assert.match(src, /tenArt/);
  assert.match(src, /nineArt/);
});

test("M7 world includes commercial camera shake and atmosphere", () => {
  const world = read("client/m5/scene/world.ts");
  assert.match(world, /shake\(/);
  assert.match(world, /this\.birds/);
  assert.match(world, /this\.dust/);
  assert.match(world, /GodRaysShader/);
  const game = read("client/m5/game/game.ts");
  assert.match(game, /world\.shake/);
});

test("M7 admin console is wired fail-closed (no wallet/ledger/math mutations)", () => {
  assert.ok(existsSync(join(root, "app/admin/page.tsx")));
  assert.ok(existsSync(join(root, "app/api/admin/[...slug]/route.ts")));
  assert.ok(existsSync(join(root, "lib/admin/admin-api.ts")));
  const api = read("lib/admin/admin-api.ts");
  assert.match(api, /ensureAdminBootstrap/);
  assert.match(api, /no endpoint can modify wallet, ledger, math/i);
  assert.doesNotMatch(api, /UPDATE\s+wallet_/i);
  assert.doesNotMatch(api, /UPDATE\s+ledger_/i);
  assert.doesNotMatch(api, /UPDATE\s+game_math_versions/i);
  const modules = readdirSync(join(root, "app/admin/modules"));
  for (const name of [
    "dashboard.tsx",
    "players.tsx",
    "rounds.tsx",
    "wallet.tsx",
    "ledger.tsx",
    "math.tsx",
    "risk.tsx",
    "system.tsx",
    "admins.tsx",
  ]) {
    assert.ok(modules.includes(name), `missing admin module ${name}`);
  }
});

test("M7 commercial CSS keeps metal/glass mobile-first HUD", () => {
  const css = read("client/m5/styles.css");
  assert.match(css, /top-commercial/);
  assert.match(css, /bottom-commercial/);
  assert.match(css, /commercial-spin/);
  assert.match(css, /celebration-rays/);
  assert.match(css, /hudShake/);
  assert.match(css, /orientation:\s*landscape/);
});
