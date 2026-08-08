/**
 * Hub↔Play silk P1 — static / unit guards (no Wallet / Math / Round).
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

test("play-shell does not mount GameClient inline", () => {
  const play = read("client/xi-lobby/play-shell.tsx");
  assert.ok(!play.includes('import GameClient'));
  assert.ok(play.includes("XiGameHost") || play.includes("persistent"));
});

test("XiShell mounts persistent XiGameHost + keep-alive", () => {
  const shell = read("client/xi-lobby/xi-shell.tsx");
  assert.ok(shell.includes("XiGameHost"));
  assert.ok(shell.includes("XiLayerKeepAlive"));
  assert.ok(existsSync(join(root, "client/xi-lobby/game-host.tsx")));
  assert.ok(existsSync(join(root, "client/xi-lobby/game-lifecycle.ts")));
  assert.ok(existsSync(join(root, "client/xi-lobby/layer-keepalive.tsx")));
});

test("optimistic layer + sync DOM swap for Hub↔Play", () => {
  const nav = read("client/xi-lobby/nav.ts");
  assert.ok(nav.includes("setOptimisticXiLayer"));
  assert.ok(nav.includes("applyOptimisticDom"));
  assert.ok(nav.includes("resolveEffectiveXiLayer"));
});

test("lifecycle state machine tokens present", () => {
  const life = read("client/xi-lobby/game-lifecycle.ts");
  for (const s of [
    "UNINITIALIZED",
    "PRELOADING",
    "READY",
    "ACTIVE",
    "SUSPENDED",
    "DISPOSING",
    "DISPOSED",
  ]) {
    assert.ok(life.includes(s), `missing ${s}`);
  }
  assert.ok(life.includes("suspendGameLifecycle"));
  assert.ok(life.includes("activateGameLifecycle"));
  assert.ok(life.includes("warmGameClient"));
  assert.ok(life.includes("routeClickAt"));
  assert.ok(life.includes("transitionEnd"));
});

test("boot supports deferBootstrap and FX release on pause", () => {
  const boot = read("client/m5/boot.ts");
  assert.ok(boot.includes("deferBootstrap"));
  assert.ok(boot.includes("ensureBootstrap"));
  assert.ok(boot.includes("releaseHeavyFx"));
});

test("navigateXi suspends play leave without dispose wait", () => {
  const nav = read("client/xi-lobby/nav.ts");
  assert.ok(nav.includes("suspendGameLifecycle"));
  assert.ok(nav.includes("markXiPerf"));
  assert.ok(nav.includes("clickFeedbackAt"));
  assert.ok(!/await\s+.*dispose/i.test(nav));
});

test("hub idle prefetch + hover warmup without spin API", () => {
  const hub = read("client/xi-lobby/bdk-hub.tsx");
  assert.ok(hub.includes("prefetchPlayCoreAssets") || hub.includes("prefetchPlayCoreByTier"));
  assert.ok(hub.includes("warmGameClient"));
  assert.ok(hub.includes("onMouseEnter"));
  assert.ok(hub.includes("onTouchStart"));
  assert.ok(!hub.includes("/api/v1/game/spins"));
  assert.ok(!hub.includes("/api/v1/game/sessions"));
});

test("i18n lobby.play.loading in zh/en/my", () => {
  const i18n = read("client/xi-lobby/i18n.ts");
  const matches = i18n.match(/"lobby\.play\.loading"/g) ?? [];
  assert.equal(matches.length, 3);
});

test("#gl translateZ preserved; no #hud shell translateZ; host no translateZ", () => {
  const m5 = read("client/m5/styles.css");
  assert.ok(m5.includes("translateZ(0)"));
  assert.ok(!/#hud\s*\{[^}]*translateZ\(0\)/s.test(m5));
  const lobby = read("client/xi-lobby/lobby.css");
  assert.ok(lobby.includes(".xi-game-host"));
  assert.ok(lobby.includes("xi-play-loading"));
  assert.ok(!/\.xi-game-host[^{]*\{[^}]*translateZ\(0\)/s.test(lobby));
});

test("GameClient registers boot bridge + singleton counters", () => {
  const gc = read("app/game-client.tsx");
  assert.ok(gc.includes("registerBootBridge"));
  assert.ok(gc.includes("__xiGameClientCount"));
  assert.ok(gc.includes("deferBootstrap"));
});
