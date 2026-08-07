import puppeteer from "puppeteer-core";
import fs from "node:fs";

const OUT = "C:/Users/zhaor/Documents/kimi/workspace/m6-review-assets";
const BASE = process.env.BASE_URL || "http://localhost:3000";
fs.mkdirSync(`${OUT}/frames`, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const result = { fps: {}, metrics: {}, shots: [], warnings: [] };

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: [
    "--window-size=1440,900",
    "--enable-unsafe-swiftshader",
    "--use-angle=swiftshader",
    "--mute-audio",
    "--autoplay-policy=no-user-gesture-required",
  ],
  defaultViewport: { width: 1440, height: 900 },
});

const page = await browser.newPage();
page.setDefaultTimeout(60000);

async function shot(name) {
  const path = `${OUT}/${name}.png`;
  await page.screenshot({ path });
  result.shots.push(`${name}.png`);
}

async function sampleFps(label, seconds = 5) {
  const fps = await page.evaluate(
    (secs) =>
      new Promise((res) => {
        let frames = 0;
        const start = performance.now();
        const tick = () => {
          frames += 1;
          const elapsed = (performance.now() - start) / 1000;
          if (elapsed < secs) requestAnimationFrame(tick);
          else res(Math.round((frames / elapsed) * 10) / 10);
        };
        requestAnimationFrame(tick);
      }),
    seconds,
  );
  result.fps[label] = fps;
  return fps;
}

async function clickLocale(label) {
  await page.evaluate((l) => {
    const btn = [...document.querySelectorAll(".m6-group button")].find(
      (b) => b.textContent.trim() === l,
    );
    btn?.click();
  }, label);
}

async function setQuality(mode) {
  await page.select(".m6-group select", mode);
  await sleep(1200);
}

try {
  await page.goto(BASE, { waitUntil: "networkidle2", timeout: 60000 });
  await sleep(7000); // 等待 three 懒加载 + 场景就绪

  const webglOk = await page.evaluate(() => {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") || c.getContext("webgl"));
  });
  if (!webglOk) result.warnings.push("webgl-unavailable");

  await shot("01-idle-zh");
  await sampleFps("auto-default");

  // 低档 FPS（模拟手机端降级后）
  await setQuality("low");
  await sampleFps("low-tier");
  await setQuality("auto");
  await sleep(1000);

  // SPIN 流程
  await page.click(".spin-button");
  await sleep(900);
  await shot("02-spinning");
  await sleep(3600);
  await shot("03-settled-paylines");

  // AUTO 巡回：捕捉免费旋转与大奖演出
  await page.click(".auto-button");
  let celebrationShots = 0;
  let freeShot = false;
  for (let i = 0; i < 16; i += 1) {
    await sleep(2400);
    const hasCeleb = await page.$(".win-celebration");
    if (hasCeleb) {
      celebrationShots += 1;
      await sleep(1200); // 等标题 slam + 金币雨铺开
      await shot(`04-celebration-${String(celebrationShots).padStart(2, "0")}`);
      await page.click(".win-celebration");
    }
    const hasFree = await page.$(".reel-machine.is-free-spin");
    if (hasFree && !freeShot) {
      await shot("05-free-spin");
      freeShot = true;
    }
    if (celebrationShots >= 2 && freeShot) break;
  }
  await page.evaluate(() => {
    const auto = document.querySelector(".auto-button");
    if (auto?.classList.contains("is-active")) auto.click();
  });
  result.celebrationShots = celebrationShots;
  result.freeSpinShot = freeShot;

  // 三语
  await clickLocale("EN");
  await sleep(500);
  await shot("06-locale-en");
  await clickLocale("မြန်မာ");
  await sleep(500);
  await shot("07-locale-my");
  await clickLocale("中文");
  await sleep(400);

  // 规则弹窗
  await page.click(".rail-button");
  await sleep(600);
  await shot("08-rules-overlay");
  await page.evaluate(() => {
    document.querySelector(".rules-panel header button")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await sleep(400);

  // 演示视频帧：一次完整 SPIN 的 screencast
  const client = await page.createCDPSession();
  const frames = [];
  client.on("Page.screencastFrame", async (event) => {
    frames.push(event.data);
    try {
      await client.send("Page.screencastFrameAck", { sessionId: event.sessionId });
    } catch { /* closing */ }
  });
  await client.send("Page.startScreencast", { format: "jpeg", quality: 72, everyNthFrame: 2 });
  await page.click(".spin-button");
  await sleep(8500);
  await client.send("Page.stopScreencast");
  frames.forEach((data, i) => {
    fs.writeFileSync(`${OUT}/frames/f${String(i).padStart(3, "0")}.jpg`, Buffer.from(data, "base64"));
  });
  result.videoFrames = frames.length;

  // 内存指标
  const m = await page.metrics();
  result.metrics = {
    jsHeapMB: Math.round((m.JSHeapUsedSize / 1048576) * 10) / 10,
    nodes: m.Nodes,
    listeners: m.JSEventListeners,
  };
} catch (err) {
  result.error = String(err && err.message ? err.message : err);
}

await browser.close();
fs.writeFileSync(`${OUT}/capture-result.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
