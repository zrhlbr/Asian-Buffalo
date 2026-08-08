/**
 * Hydration + Nav P0 — static / unit guards (no Wallet / Math).
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

test("lobby/hub never init quality from typeof window localStorage", () => {
  const lobby = read("client/xi-lobby/lobby-app.tsx");
  const hub = read("client/xi-lobby/bdk-hub.tsx");
  assert.ok(!/typeof window === ["']undefined["']/.test(lobby));
  assert.ok(!/typeof window === ["']undefined["']/.test(hub));
  assert.ok(!/readStoredQualitySettings\(\)/.test(lobby));
  assert.ok(!/readStoredQualitySettings\(\)/.test(hub));
  assert.ok(lobby.includes("getXiQualityServerSnapshot"));
  assert.ok(hub.includes("getXiQualityServerSnapshot"));
  assert.ok(lobby.includes("particleN = qualityHydrated"));
});

test("navigateXi prefers soft navigator over location.assign", () => {
  const nav = read("client/xi-lobby/nav.ts");
  assert.ok(nav.includes("registerXiNavigator"));
  assert.ok(nav.includes("softNavigator"));
  assert.ok(nav.includes("xi-nav-leave-soft"));
  assert.ok(nav.includes("MIN_MS = 180"));
  assert.ok(nav.includes("MAX_MS = 260"));
  // Hard nav only as fallback after softNavigator check
  const softFirst = nav.indexOf("if (nav)");
  const hardAssign = nav.indexOf("window.location.assign");
  assert.ok(softFirst >= 0 && hardAssign > softFirst);
});

test("XiLayout mounts XiShell without pathname key", () => {
  const layout = read("app/xi/layout.tsx");
  assert.ok(layout.includes("XiShell"));
  assert.ok(!/key=\{.*pathname/.test(layout));
  assert.ok(existsSync(join(root, "client/xi-lobby/xi-shell.tsx")));
  const shell = read("client/xi-lobby/xi-shell.tsx");
  assert.ok(shell.includes("registerXiNavigator"));
  assert.ok(shell.includes("hydrateXiUiStore"));
  assert.ok(shell.includes("prefetchXiRoutes"));
  assert.ok(!/key=\{.*pathname/.test(shell));
});

test("lang server snapshot is deterministic zh-CN", async () => {
  const { getLobbyLangServerSnapshot } = await import("../client/xi-lobby/i18n.ts");
  assert.equal(getLobbyLangServerSnapshot(), "zh-CN");
});

test("ui-store quality server snapshot is defaults", async () => {
  const {
    getXiQualityServerSnapshot,
    getXiHydratedServerSnapshot,
  } = await import("../client/xi-lobby/ui-store.ts");
  const { defaultQualitySettings } = await import("../client/m5/quality.ts");
  assert.deepEqual(getXiQualityServerSnapshot(), defaultQualitySettings());
  assert.equal(getXiHydratedServerSnapshot(), false);
});

test("leave overlay is soft rgba not solid black", () => {
  const css = read("client/xi-lobby/lobby.css");
  assert.ok(css.includes("xi-nav-leave-soft"));
  assert.ok(css.includes("rgba(8, 10, 16, 0.28)"));
  assert.ok(!/^\.xi-nav-leave\s*\{[^}]*background:\s*#0a080c/m.test(css));
  assert.ok(css.includes("xi-nav-busy"));
  assert.ok(css.includes("xi-route-loading"));
});

test("#gl translateZ preserved; no #hud shell translateZ", () => {
  const css = read("client/m5/styles.css");
  assert.ok(/#gl\s*\{[^}]*translateZ\(0\)/s.test(css) || css.includes("translateZ(0)"));
  // Shell rule: never promote full #hud with translateZ
  assert.ok(!/#hud\s*\{[^}]*translateZ\(0\)/s.test(css));
});

test("GameClient singleton + pause/resume hooks", () => {
  const gc = read("app/game-client.tsx");
  assert.ok(gc.includes("activeHandle"));
  assert.ok(gc.includes("xi-game-pause"));
  assert.ok(gc.includes("xi-game-resume"));
  assert.ok(gc.includes("__xiGameClientCount"));
  const boot = read("client/m5/boot.ts");
  assert.ok(boot.includes("pause:"));
  assert.ok(boot.includes("resume:"));
});

test("lobby-app has no hard location.assign", () => {
  const lobby = read("client/xi-lobby/lobby-app.tsx");
  assert.ok(!lobby.includes("location.assign"));
  assert.ok(!lobby.includes("location.href"));
});
