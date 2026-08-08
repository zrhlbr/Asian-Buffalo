import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const root = join(dir, "../../../..");
const files = [
  "client/xi-lobby/game-lifecycle.ts",
  "client/xi-lobby/game-host.tsx",
  "client/xi-lobby/layer-keepalive.tsx",
  "client/xi-lobby/xi-shell.tsx",
  "client/xi-lobby/play-shell.tsx",
  "client/xi-lobby/bdk-hub.tsx",
  "client/xi-lobby/nav.ts",
  "client/xi-lobby/quality.ts",
  "client/xi-lobby/i18n.ts",
  "client/xi-lobby/lobby.css",
  "app/game-client.tsx",
  "client/m5/boot.ts",
  "client/m5/audio.ts",
  "client/m5/game/symbols.ts",
  "tests/xi-hub-play-silk-p1.test.mjs",
];

const fileList = [
  "# FILE_LIST — Hub↔Play Silk P1",
  "",
  "## Code",
  "",
  ...files.map((f) => `- \`${f}\``),
  "",
  "## Docs",
  "",
  "- `docs/m8-review/xi-game-v2/hub-play-silk-p1/**`",
  "",
].join("\n");
writeFileSync(join(dir, "FILE_LIST.md"), fileList);

const patch = execSync(`git diff --no-color -- ${files.join(" ")}`, {
  cwd: root,
  encoding: "utf8",
  maxBuffer: 32 * 1024 * 1024,
});
// Include untracked new files in patch via git diff --no-index when needed
let extra = "";
for (const f of [
  "client/xi-lobby/game-lifecycle.ts",
  "client/xi-lobby/game-host.tsx",
  "client/xi-lobby/layer-keepalive.tsx",
  "tests/xi-hub-play-silk-p1.test.mjs",
]) {
  const abs = join(root, f);
  if (!existsSync(abs)) continue;
  try {
    execSync(`git ls-files --error-unmatch ${f}`, { cwd: root, stdio: "ignore" });
  } catch {
    try {
      const empty = process.platform === "win32" ? "NUL" : "/dev/null";
      extra += execSync(`git diff --no-color --no-index -- ${empty} ${f}`, {
        cwd: root,
        encoding: "utf8",
        maxBuffer: 16 * 1024 * 1024,
      });
    } catch (e) {
      // git diff --no-index exits 1 when differences exist
      extra += e.stdout || "";
    }
  }
}
const patchPath = join(dir, "AB-XI-HUB-PLAY-SILK-P1-review.patch");
writeFileSync(patchPath, patch + extra);
const hash = createHash("sha256").update(readFileSync(patchPath)).digest("hex");
writeFileSync(
  join(dir, "SHA256.txt"),
  `${hash}  AB-XI-HUB-PLAY-SILK-P1-review.patch\n`,
);

const status = execSync(
  `git status --short -- ${files.join(" ")} docs/m8-review/xi-game-v2/hub-play-silk-p1`,
  { cwd: root, encoding: "utf8" },
);
writeFileSync(join(dir, "GIT_STATUS.txt"), status);
console.log("SHA256", hash);
console.log("patch bytes", readFileSync(patchPath).length);
console.log(status);
