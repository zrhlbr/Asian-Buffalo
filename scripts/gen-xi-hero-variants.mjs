/**
 * Generate responsive WebP (+ AVIF when possible) hero variants from existing masters.
 * Does NOT invent 4K masters — only downscale / recompress.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "public", "xi", "heroes");
fs.mkdirSync(outDir, { recursive: true });

const jobs = [
  {
    src: path.join(root, "public", "xi", "journey-hero.png"),
    prefix: "journey",
    widths: { low: 320, mobile: 480, tablet: 682, desktop: 682 },
  },
  {
    src: path.join(root, "public", "xi", "heroes", "bull-demon-king.png"),
    prefix: "bdk",
    widths: { low: 480, mobile: 640, tablet: 960, desktop: 1024 },
  },
];

for (const job of jobs) {
  if (!fs.existsSync(job.src)) {
    console.error("missing", job.src);
    continue;
  }
  const meta = await sharp(job.src).metadata();
  console.log(job.prefix, meta.width, meta.height, meta.format);
  for (const [label, width] of Object.entries(job.widths)) {
    const w = Math.min(width, meta.width || width);
    const base = sharp(job.src).resize({ width: w, withoutEnlargement: true });
    const webpPath = path.join(outDir, `${job.prefix}-${label}.webp`);
    await base.clone().webp({ quality: label === "low" ? 62 : 78 }).toFile(webpPath);
    try {
      const avifPath = path.join(outDir, `${job.prefix}-${label}.avif`);
      await base.clone().avif({ quality: label === "low" ? 45 : 55 }).toFile(avifPath);
    } catch (e) {
      console.warn("avif skip", job.prefix, label, e.message);
    }
    console.log("wrote", path.basename(webpPath), w);
  }
}
console.log("done");
