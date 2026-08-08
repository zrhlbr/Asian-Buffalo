/**
 * Phase C —《西游戏》Integrated RC full-chain smoke (same test player).
 * HTTP + optional headed capture. Honest BLOCKED when env cannot run steps.
 */
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.XI_SMOKE_BASE || "http://127.0.0.1:5173";
const outJson = join(__dirname, "smoke-results.json");
const results = [];
const note = (id, ok, detail) => {
  results.push({ id, ok: !!ok, detail: String(detail ?? "").slice(0, 400) });
  console.log(`${ok ? "PASS" : "FAIL"} ${id} — ${String(detail ?? "").slice(0, 160)}`);
};

async function get(path) {
  const res = await fetch(`${BASE}${path}`, { credentials: "include", redirect: "manual" });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* html */
  }
  return { res, text, json, status: res.status };
}

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
    credentials: "include",
    redirect: "manual",
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* */
  }
  return { res, text, json, status: res.status };
}

async function main() {
  // 0) pages
  for (const [id, path, expect] of [
    ["route.xi", "/xi", 200],
    ["route.hub", "/xi/bull-demon-king", 200],
    ["route.play", "/xi/bull-demon-king/play", 200],
    ["route.admin", "/admin", 200],
    ["route.admin.login", "/admin/login", 200],
  ]) {
    try {
      const r = await get(path);
      note(id, r.status === expect, `status=${r.status}`);
    } catch (e) {
      note(id, false, `BLOCKED ${e.message}`);
    }
  }

  // compat redirects
  for (const [id, path] of [
    ["compat.root", "/"],
    ["compat.game", "/game"],
    ["compat.bdk", "/xi/bdk"],
  ]) {
    try {
      const r = await get(path);
      const loc = r.res.headers.get("location") || "";
      const ok =
        (r.status === 308 || r.status === 301 || r.status === 307 || r.status === 302) &&
        (loc.includes("/xi/bull-demon-king") || loc.includes("bull-demon-king"));
      note(id, ok, `status=${r.status} location=${loc}`);
    } catch (e) {
      note(id, false, e.message);
    }
  }

  // brand on lobby HTML
  try {
    const r = await get("/xi");
    const ok = r.status === 200 && (r.text.includes("西游戏") || r.text.includes("XI GAME") || r.text.includes("xi-lobby"));
    note("lobby.brand", ok, r.text.replace(/\s+/g, " ").slice(0, 200));
  } catch (e) {
    note("lobby.brand", false, e.message);
  }

  // identity + balance
  let playerId = null;
  let balanceBefore = null;
  try {
    const bal = await get("/api/v1/game/wallet/balance");
    const ok = bal.status === 200 && typeof bal.json?.balanceMinor === "number";
    playerId = bal.json?.playerId ?? null;
    balanceBefore = bal.json?.balanceMinor ?? null;
    note("wallet.balance", ok, JSON.stringify({ playerId, balanceMinor: balanceBefore, currency: bal.json?.currency }));
  } catch (e) {
    note("wallet.balance", false, e.message);
  }

  try {
    const prof = await get("/api/v1/game/profile");
    const ok = prof.status === 200 && (!playerId || prof.json?.profile?.playerId === playerId || prof.json?.playerId === playerId || !!prof.json);
    note("identity.profile", ok, JSON.stringify(prof.json).slice(0, 240));
  } catch (e) {
    note("identity.profile", false, e.message);
  }

  // session → spin → round
  let sessionId = null;
  let roundId = null;
  try {
    const sess = await post("/api/v1/game/sessions", {});
    sessionId = sess.json?.sessionId ?? sess.json?.session?.sessionId ?? null;
    note("game.session", sess.status === 200 && !!sessionId, JSON.stringify(sess.json).slice(0, 240));
  } catch (e) {
    note("game.session", false, e.message);
  }

  try {
    if (!sessionId) throw new Error("no session");
    const spin = await post("/api/v1/game/spins", {
      sessionId,
      roomBase: 50,
      betLevel: 1,
      betMultiplier: 1,
      idempotencyKey: `rc_spin_${Date.now()}`,
    });
    roundId = spin.json?.roundId ?? spin.json?.round?.roundId ?? null;
    const ok = spin.status === 200 && !!roundId;
    note(
      "game.spin",
      ok,
      JSON.stringify({
        status: spin.status,
        roundId,
        balanceAfter: spin.json?.balanceAfterMinor ?? spin.json?.balanceAfter,
        err: spin.json?.error,
      }).slice(0, 300),
    );
  } catch (e) {
    note("game.spin", false, e.message);
  }

  try {
    if (!roundId) throw new Error("no round");
    const round = await get(`/api/v1/game/rounds/${roundId}`);
    note("game.round", round.status === 200, JSON.stringify(round.json).slice(0, 240));
  } catch (e) {
    note("game.round", false, e.message);
  }

  try {
    const bal2 = await get("/api/v1/game/wallet/balance");
    const ok = bal2.status === 200 && bal2.json?.playerId === playerId;
    note("wallet.balance.afterSpin", ok, JSON.stringify({ playerId: bal2.json?.playerId, before: balanceBefore, after: bal2.json?.balanceMinor }));
  } catch (e) {
    note("wallet.balance.afterSpin", false, e.message);
  }

  // hub surfaces
  try {
    const wins = await get("/api/v1/game/wins?limit=5");
    note("hub.wins", wins.status === 200, JSON.stringify(wins.json).slice(0, 200));
  } catch (e) {
    note("hub.wins", false, e.message);
  }
  try {
    const vip = await get("/api/v1/game/vip");
    note("vip.status", vip.status === 200, JSON.stringify(vip.json).slice(0, 200));
  } catch (e) {
    note("vip.status", false, e.message);
  }

  // deposit test harness
  let orderId = null;
  try {
    const ch = await get("/api/v1/game/deposit/channels");
    const readiness = ch.json?.readiness?.code || ch.json?.readiness?.status;
    note("deposit.channels", ch.status === 200, `readiness=${readiness}`);
    const presets = ch.json?.config?.presetsMinor || ch.json?.presetsMinor || [];
    const amount = Array.isArray(presets) && presets.length ? presets[0] : 1000;
    const channelCode = ch.json?.channels?.[0]?.code || ch.json?.channels?.[0]?.channelCode || "KBZ";
    const dep = await post("/api/v1/game/deposit", {
      channelCode,
      amountMinor: amount,
      idempotencyKey: `rc_dep_${Date.now()}`,
    });
    orderId = dep.json?.order?.id ?? dep.json?.orderId ?? dep.json?.id ?? null;
    note("deposit.create", dep.status === 200 || dep.status === 201, JSON.stringify(dep.json).slice(0, 240));
    if (orderId) {
      const conf = await post("/api/v1/game/deposit/confirm", { orderId });
      note("deposit.confirm", conf.status === 200, JSON.stringify(conf.json).slice(0, 240));
    } else {
      note("deposit.confirm", false, "no orderId");
    }
  } catch (e) {
    note("deposit.create", false, e.message);
    note("deposit.confirm", false, "skipped");
  }

  // withdraw
  try {
    const wch = await get("/api/v1/game/withdraw");
    note("withdraw.readiness", wch.status === 200, JSON.stringify(wch.json?.readiness || {}).slice(0, 200));
    const channelCode = wch.json?.channels?.[0]?.code || wch.json?.channels?.[0]?.channelCode || "KBZ";
    const minMinor = Number(wch.json?.config?.minMinor) || 5000;
    const wd = await post("/api/v1/game/withdraw", {
      channelCode,
      amountMinor: minMinor,
      account: "RC-SMOKE-TEST",
      idempotencyKey: `rc_wd_${Date.now()}`,
    });
    note("withdraw.create", wd.status === 200 || wd.status === 201, JSON.stringify(wd.json).slice(0, 240));
  } catch (e) {
    note("withdraw.create", false, e.message);
  }

  // admin login + query (dev bootstrap: admin / admin123 when test identity gate on)
  let adminToken = null;
  try {
    const login = await post("/api/admin/login", {
      username: process.env.AB_ADMIN_USER || "admin",
      password: process.env.AB_ADMIN_PASS || "admin123",
    });
    adminToken =
      login.json?.token ||
      login.json?.sessionToken ||
      login.json?.session?.token ||
      login.res.headers.get("set-cookie")?.match(/(?:admin_session|ab_admin)=([^;]+)/)?.[1] ||
      null;
    // cookie-based sessions: treat Set-Cookie as success when body ok
    if (!adminToken && login.status === 200 && login.json?.admin) {
      adminToken = "cookie-session";
    }
    note("admin.login", login.status === 200 && !!adminToken, `status=${login.status} body=${JSON.stringify(login.json).slice(0, 160)}`);
  } catch (e) {
    note("admin.login", false, e.message);
  }

  const cookieJar = [];
  // re-login capturing Set-Cookie for subsequent admin GETs
  let adminCookie = "";
  if (adminToken) {
    try {
      const login2 = await fetch(`${BASE}/api/admin/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username: process.env.AB_ADMIN_USER || "admin",
          password: process.env.AB_ADMIN_PASS || "admin123",
        }),
      });
      const raw = typeof login2.headers.getSetCookie === "function"
        ? login2.headers.getSetCookie()
        : [login2.headers.get("set-cookie")].filter(Boolean);
      adminCookie = raw.map((c) => String(c).split(";")[0]).join("; ");
      cookieJar.push(...raw);
      void cookieJar;
    } catch {
      /* keep bearer fallback */
    }
  }

  async function adminGet(path) {
    const headers = {};
    if (adminToken && adminToken !== "cookie-session") {
      headers.authorization = `Bearer ${adminToken}`;
    }
    if (adminCookie) headers.cookie = adminCookie;
    return fetch(`${BASE}${path}`, { headers });
  }

  if (adminToken && playerId) {
    try {
      const detail = await adminGet(`/api/admin/players/${encodeURIComponent(playerId)}`);
      const detailJson = await detail.json().catch(() => ({}));
      const list = await adminGet(`/api/admin/players?search=${encodeURIComponent(playerId)}`);
      const listJson = await list.json().catch(() => ({}));
      const items = listJson?.items || [];
      const hit =
        (detail.status === 200 &&
          (detailJson?.id === playerId || detailJson?.player?.id === playerId || detailJson?.playerId === playerId)) ||
        (list.status === 200 &&
          Array.isArray(items) &&
          items.some((p) => (p.id || p.playerId) === playerId));
      note(
        "admin.players.query",
        hit,
        JSON.stringify({ detailStatus: detail.status, listStatus: list.status, detailJson, listJson }).slice(0, 300),
      );
    } catch (e) {
      note("admin.players.query", false, e.message);
    }
    try {
      const res = await adminGet("/api/admin/deposits?limit=5");
      note("admin.deposits", res.status === 200, `status=${res.status}`);
    } catch (e) {
      note("admin.deposits", false, e.message);
    }
    try {
      const res = await adminGet("/api/admin/withdrawals?limit=5");
      note("admin.withdrawals", res.status === 200, `status=${res.status}`);
    } catch (e) {
      note("admin.withdrawals", false, e.message);
    }
    try {
      const res = await adminGet("/api/admin/logs/admin?limit=5");
      note("admin.audit", res.status === 200, `status=${res.status}`);
    } catch (e) {
      note("admin.audit", false, e.message);
    }
  } else {
    note("admin.players.query", false, "BLOCKED no admin token");
    note("admin.deposits", false, "BLOCKED");
    note("admin.withdrawals", false, "BLOCKED");
    note("admin.audit", false, "BLOCKED");
  }

  // headed capture attempt (prefer system Chrome/Edge; bundled chromium may be absent)
  let headed = { status: "BLOCKED", reason: "playwright not attempted yet" };
  try {
    const pw = await import("playwright").catch(() => null);
    if (!pw) {
      headed = { status: "BLOCKED", reason: "playwright module not installed" };
    } else {
      let browser = null;
      for (const channel of ["chrome", "msedge", undefined]) {
        try {
          browser = await pw.chromium.launch({
            headless: true,
            ...(channel ? { channel } : {}),
          });
          break;
        } catch {
          /* try next */
        }
      }
      if (!browser) {
        headed = { status: "BLOCKED", reason: "no chrome/msedge/chromium executable" };
      } else {
        const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
        const shotDir = join(__dirname, "screenshots");
        mkdirSync(shotDir, { recursive: true });
        await page.goto(`${BASE}/xi`, { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.waitForTimeout(800);
        await page.screenshot({ path: join(shotDir, "01-lobby.png"), fullPage: true });
        await page.goto(`${BASE}/xi/bull-demon-king`, { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.waitForTimeout(600);
        await page.screenshot({ path: join(shotDir, "02-hub.png"), fullPage: true });
        await page.goto(`${BASE}/xi/bull-demon-king/play`, { waitUntil: "domcontentloaded", timeout: 45000 });
        await page.waitForTimeout(2500);
        await page.screenshot({ path: join(shotDir, "03-play.png") });
        await browser.close();
        headed = { status: "OK", shots: ["01-lobby.png", "02-hub.png", "03-play.png"] };
      }
    }
  } catch (e) {
    headed = { status: "BLOCKED", reason: e.message };
  }
  note("headed.capture", headed.status === "OK", JSON.stringify(headed));

  const pass = results.filter((r) => r.ok).length;
  const fail = results.filter((r) => !r.ok).length;
  const payload = {
    base: BASE,
    at: new Date().toISOString(),
    playerId,
    summary: { pass, fail, total: results.length },
    headed,
    results,
  };
  writeFileSync(outJson, JSON.stringify(payload, null, 2));
  console.log(`\nWrote ${outJson} pass=${pass} fail=${fail}`);
  if (fail > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
