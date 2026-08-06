#!/usr/bin/env bash
set -euo pipefail
cd /d/Asian-Buffalo-R1-M5-Cursor-Clean
export GIT_TERMINAL_PROMPT=0
PATCH=docs/m5-integration/AB-K1-R1-M5-review-v2.patch

echo "BYTES=$(wc -c < "$PATCH" | tr -d ' ')"
echo "LINES=$(wc -l < "$PATCH" | tr -d ' ')"
FILES=$(tr -d '\r' < "$PATCH" | grep -c '^diff --git ' || true)
echo "FILES=$FILES"

if tr -d '\r' < "$PATCH" | grep -E '^diff --git .*(AB-K1-R1-M5-review|SHA256SUMS|screenshots/|TEST_REPORT|RISK_REPORT|ROLLBACK|BOUNDARY_JUSTIFICATION|FILE_LIST|hosting\.json|vite\.config\.ts|api-handlers\.ts)'; then
  echo FAIL_DELIVERABLES_IN_PATCH
  exit 2
fi
echo DELIVERABLES_EXCLUDED_OK

node <<'NODE'
const fs = require('fs');
const b = fs.readFileSync('docs/m5-integration/AB-K1-R1-M5-review-v2.patch');
if (b[0] === 0xff && b[1] === 0xfe) throw new Error('utf16le');
if (b[0] === 0xfe && b[1] === 0xff) throw new Error('utf16be');
if (b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) throw new Error('utf8bom');
if (!b.slice(0, 10).toString('utf8').startsWith('diff --git')) throw new Error('bad header');
console.log('PATCH_ENCODING_OK');
NODE

CHECK=/d/Asian-Buffalo-R1-M5-ApplyCheck
rm -rf "$CHECK"
git worktree add --detach "$CHECK" 4049348f4b7673694de16e4ef55fd306c5b390c8
git -C "$CHECK" apply --check "$PWD/$PATCH"
echo APPLY_CHECK_OK
git -C "$CHECK" apply "$PWD/$PATCH"
echo APPLY_OK
git -C "$CHECK" apply -R --check "$PWD/$PATCH"
echo REVERSE_CHECK_OK
git worktree remove --force "$CHECK"

sha256sum "$PATCH"
node -e 'JSON.parse(require("fs").readFileSync("package.json","utf8")); console.log("package_json_ok")'

node <<'NODE'
const fs = require('fs');
const path = require('path');
const bad = [];
function walk(p) {
  const st = fs.statSync(p);
  if (st.isDirectory()) {
    for (const name of fs.readdirSync(p)) walk(path.join(p, name));
    return;
  }
  if (/\.(png|woff2|jpg)$/i.test(p)) return;
  const fd = fs.openSync(p, 'r');
  const buf = Buffer.alloc(3);
  const n = fs.readSync(fd, buf, 0, 3, 0);
  fs.closeSync(fd);
  if (n >= 2 && buf[0] === 0xff && buf[1] === 0xfe) bad.push([p, 'utf16le']);
  if (n >= 2 && buf[0] === 0xfe && buf[1] === 0xff) bad.push([p, 'utf16be']);
  if (n >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) bad.push([p, 'utf8bom']);
}
for (const root of ['app', 'client/m5', 'lib', 'tests', 'worker', 'package.json']) {
  if (fs.existsSync(root)) walk(root);
}
console.log('BOM_ISSUES', JSON.stringify(bad));
if (bad.length) process.exit(3);
NODE
