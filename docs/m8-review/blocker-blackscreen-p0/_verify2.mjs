import { chromium } from "playwright";
import fs from "fs";
const out = "docs/m8-review/blocker-blackscreen-p0";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(4500);

const stack = await page.evaluate(() => {
  const gl = getComputedStyle(document.getElementById("gl"));
  const hud = getComputedStyle(document.getElementById("hud"));
  const loading = document.getElementById("loading");
  const spin = document.getElementById("btn-spin");
  const r = spin.getBoundingClientRect();
  const hit = document.elementFromPoint(r.left + r.width/2, r.top + r.height/2);
  return {
    gl: { pe: gl.pointerEvents, z: gl.zIndex, transform: gl.transform },
    hud: { pe: hud.pointerEvents, z: hud.zIndex, transform: hud.transform },
    loadingDone: loading.classList.contains("done"),
    loadingDisplay: getComputedStyle(loading).display,
    spinHit: { id: hit?.id, tag: hit?.tagName, cls: hit?.className },
    hasGame: !!window.__game,
    edge: window.__game?.state?.()?.edge,
    sceneN: window.__game?.world?.scene?.children?.length,
  };
});
await page.screenshot({ path: `${out}/after-idle.png` });

const buttons = {};
async function tap(id, read) {
  const before = await page.evaluate(read);
  await page.evaluate((i) => document.getElementById(i).click(), id);
  await page.waitForTimeout(200);
  const after = await page.evaluate(read);
  buttons[id] = { before, after, ok: JSON.stringify(before) !== JSON.stringify(after) };
}
await tap("btn-turbo", () => ({ turbo: window.__game.state().turbo }));
await tap("bet-plus", () => ({ bet: document.getElementById("bet").textContent }));
await tap("btn-settings", () => ({ open: !document.getElementById("settings-modal").classList.contains("hidden") }));
await page.evaluate(() => document.getElementById("settings-close").click());
await tap("btn-paytable", () => ({ open: !document.getElementById("paytable-modal").classList.contains("hidden") }));
await page.evaluate(() => document.getElementById("paytable-close").click());
const langBefore = await page.evaluate(() => window.__game.state().lang);
await page.evaluate(() => document.querySelector('.lang-btn[data-lang="en"]').click());
const langAfter = await page.evaluate(() => window.__game.state().lang);
buttons.lang = { before: langBefore, after: langAfter, ok: langBefore !== langAfter };
await page.evaluate(() => document.getElementById("btn-sound").click());
buttons.sound = await page.evaluate(() => ({
  cls: document.getElementById("btn-sound").className,
  ok: document.getElementById("btn-sound").classList.contains("off") || document.getElementById("btn-sound").classList.contains("on"),
}));
buttons.back = { ok: await page.evaluate(() => !!document.getElementById("btn-back")) };
await tap("btn-auto", () => ({ auto: window.__game.state().auto }));
// turn auto off if on
if (buttons["btn-auto"]?.after?.auto) {
  await page.evaluate(() => document.getElementById("btn-auto").click());
}

const bal0 = await page.evaluate(() => document.getElementById("balance").textContent);
await page.evaluate(() => document.getElementById("btn-spin").click());
await page.waitForTimeout(500);
const busyMid = await page.evaluate(() => window.__game.state().busy);
for (let i=0;i<20;i++){ await page.waitForTimeout(1000); if(!(await page.evaluate(()=>window.__game.state().busy))) break; }
const bal1 = await page.evaluate(() => document.getElementById("balance").textContent);
const busyEnd = await page.evaluate(() => window.__game.state().busy);
buttons.spin = { bal0, bal1, busyMid, busyEnd, ok: busyMid === true || bal0 !== bal1 };
await page.screenshot({ path: `${out}/after-spin.png` });

const page2 = await browser.newPage({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
await page2.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle", timeout: 60000 });
await page2.waitForTimeout(4000);
await page2.screenshot({ path: `${out}/after-phone-land.png` });
const phone = await page2.evaluate(() => ({
  hasGame: !!window.__game,
  fill: window.__game?.state?.()?.edge?.fill,
  loadingDisplay: getComputedStyle(document.getElementById("loading")).display,
}));
await page2.close();

fs.writeFileSync(`${out}/verify.json`, JSON.stringify({ stack, buttons, phone, errors }, null, 2));
console.log(JSON.stringify({ stack, buttons, phone, errors }, null, 2));
await browser.close();
