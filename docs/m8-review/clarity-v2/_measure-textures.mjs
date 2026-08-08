import fs from "node:fs";
import path from "node:path";

function pngSize(buf) {
  if (buf.length < 24) return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

function webpSize(buf) {
  if (buf.length < 30) return null;
  const tag = buf.toString("ascii", 12, 16);
  if (tag === "VP8X") {
    return {
      w: 1 + buf[24] + (buf[25] << 8) + (buf[26] << 16),
      h: 1 + buf[27] + (buf[28] << 8) + (buf[29] << 16),
    };
  }
  if (tag === "VP8 ") {
    return {
      w: buf.readUInt16LE(26) & 0x3fff,
      h: buf.readUInt16LE(28) & 0x3fff,
    };
  }
  if (tag === "VP8L") {
    const b = buf.readUInt32LE(21);
    return { w: (b & 0x3fff) + 1, h: ((b >> 14) & 0x3fff) + 1 };
  }
  return null;
}

function list(dir) {
  if (!fs.existsSync(dir)) return;
  console.log(`\n## ${dir}`);
  for (const f of fs.readdirSync(dir).sort()) {
    const p = path.join(dir, f);
    if (!fs.statSync(p).isFile()) continue;
    const buf = fs.readFileSync(p);
    let s = null;
    if (f.endsWith(".png")) s = pngSize(buf);
    else if (f.endsWith(".webp")) s = webpSize(buf);
    console.log(
      `${f.padEnd(28)} ${String(buf.length).padStart(10)} ${s ? `${s.w}x${s.h}` : "?"}`,
    );
  }
}

list("D:/Asian-Buffalo-R1-M8-Cursor-Clean/client/m5/assets/symbols");
list("D:/Asian-Buffalo-R1-M8-Cursor-Clean/docs/m8-review/symbols");
