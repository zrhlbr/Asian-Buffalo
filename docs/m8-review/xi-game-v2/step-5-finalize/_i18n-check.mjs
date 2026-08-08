import fs from "node:fs";
const src = fs.readFileSync("client/xi-lobby/i18n.ts", "utf8");
function keysFor(block) {
  return new Set([...block.matchAll(/"([^"]+)":/g)].map((x) => x[1]));
}
const zh = src.split("en: {")[0];
const en = src.split("en: {")[1].split('"my-MM":')[0];
const my = src.split('"my-MM":')[1];
const kz = keysFor(zh);
const ke = keysFor(en);
const km = keysFor(my);
const miss = (base, other) => [...base].filter((k) => !other.has(k)).sort();
console.log(JSON.stringify({
  counts: { zh: kz.size, en: ke.size, my: km.size },
  missingEn: miss(kz, ke),
  missingMy: miss(kz, km),
  missingZhFromEn: miss(ke, kz),
  newKeys: [...kz].filter((k) =>
    k.includes("notProduction") || k.includes("tempHarness") || k.includes("placeholderLimits"),
  ),
}, null, 2));
