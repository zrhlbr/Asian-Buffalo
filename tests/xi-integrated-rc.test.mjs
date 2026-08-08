/**
 * 《西游戏》Integrated RC — route / identity / wallet / P0 / brand gates.
 * Does not rewrite Steps 1–5 modules; asserts unification invariants.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { getLobbyCatalog } from "../lib/lobby-catalog.ts";
import { assertLobbyI18nComplete, tLobby } from "../client/xi-lobby/i18n.ts";

const root = process.cwd();
const read = (rel) => readFileSync(join(root, rel), "utf8");

test("final routes: canonical pages exist; / and /game are compat redirects", () => {
  const home = read("app/page.tsx");
  const gameAlias = read("app/game/page.tsx");
  const cfg = read("next.config.ts");
  assert.match(home, /permanentRedirect\(["']\/xi\/bull-demon-king\/play["']\)/);
  assert.match(gameAlias, /permanentRedirect\(["']\/xi\/bull-demon-king\/play["']\)/);
  assert.doesNotMatch(home, /<GameClient/);
  assert.doesNotMatch(gameAlias, /<GameClient/);
  assert.match(cfg, /source:\s*["']\/["']/);
  assert.match(cfg, /destination:\s*["']\/xi\/bull-demon-king\/play["']/);
  for (const rel of [
    "app/xi/page.tsx",
    "app/xi/bull-demon-king/page.tsx",
    "app/xi/bull-demon-king/play/page.tsx",
    "app/admin/page.tsx",
    "app/admin/login/page.tsx",
  ]) {
    assert.equal(existsSync(join(root, rel)), true, `missing ${rel}`);
  }
});

test("single GameClient stack: play shell mounts GameClient; no second formal provider boot", () => {
  const shell = read("client/xi-lobby/play-shell.tsx");
  const boot = read("client/m5/boot.ts");
  assert.match(shell, /from\s+["'].*game-client/);
  assert.match(boot, /FormalGameProvider|formal-provider/);
  assert.doesNotMatch(boot, /from\s+["'].*mock-provider/);
});

test("lobby catalog live BDK points at canonical hub", () => {
  const catalog = getLobbyCatalog();
  const bdk = catalog.games.find((g) => g.id === "bdk");
  assert.ok(bdk);
  assert.equal(bdk.href, "/xi/bull-demon-king");
});

test("brand user-visible: 西游戏 / 牛魔王; no Asian Buffalo product title in UI sources", () => {
  assert.equal(tLobby("zh-CN", "lobby.brand"), "西游戏");
  assert.equal(tLobby("zh-CN", "lobby.games.bdk.subtitle"), "西游戏之牛魔王");
  assert.equal(tLobby("zh-CN", "lobby.page.bdkPlay"), "牛魔王");
  const m5 = read("client/m5/i18n.ts");
  assert.match(m5, /gameTitle:\s*["']牛魔王["']/);
  assert.doesNotMatch(m5, /Asian Buffalo|亚洲水牛|非洲水牛/);
  const lobbyI18n = read("client/xi-lobby/i18n.ts");
  assert.doesNotMatch(lobbyI18n, /Asian Buffalo|亚洲水牛|非洲水牛/);
  const css = read("client/m5/styles.css");
  assert.doesNotMatch(css, /Asian Buffalo/);
});

test("i18n lobby parity zh/en/my", () => {
  const check = assertLobbyI18nComplete();
  assert.equal(check.ok, true);
  assert.deepEqual(check.missing, []);
});

test("P0 compositor: #gl translateZ; #hud shell without translateZ", () => {
  const css = read("client/m5/styles.css");
  assert.match(css, /#gl\s*\{[\s\S]*?transform:\s*translateZ\(0\)/);
  assert.doesNotMatch(css, /#hud\s*\{[^}]*transform:\s*translateZ\(0\)/);
});

test("admin login route mounts same AdminApp as /admin", () => {
  const admin = read("app/admin/page.tsx");
  const login = read("app/admin/login/page.tsx");
  assert.match(admin, /AdminApp/);
  assert.match(login, /AdminApp/);
});

test("wallet balance API is shared projection path (no client-authored balance)", () => {
  const balanceRoute = read("app/api/v1/game/wallet/balance/route.ts");
  const lobbyApi = read("client/xi-lobby/api.ts");
  const formal = read("client/m5/formal-provider.ts");
  assert.match(lobbyApi, /\/api\/v1\/game\/wallet\/balance/);
  assert.match(formal, /\/api\/v1\/game\/wallet\/balance/);
  assert.match(balanceRoute, /resolveActivePlayer|createRuntimeIdentityProvider|getTrustedPlayerContext|PLAYER_AVAILABLE|balanceMinor/);
  assert.doesNotMatch(balanceRoute, /body\.balance|req\.balanceMinor/);
});
