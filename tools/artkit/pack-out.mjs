#!/usr/bin/env node
// pack-out.mjs — build a SLIM copy of the 15GB out/ render scratch for moving to another machine.
//
// Of out/ (~15GB): ~9.9GB is candidate sheets/ + ~3.7GB is review *.preview.png — both are PICK-TIME
// leftovers. What you need to keep working (re-slice / re-install / promote WITHOUT re-rendering) is just the
// promoted refs + card masters + sliced parts. This copies only those into out-transfer/ (~4GB), which you
// then move (USB / LAN / cloud) into the other machine's tools/artkit/out/. See ARTIST_GUIDE.md §3.
//
//   node tools/artkit/pack-out.mjs                 # → tools/artkit/out-transfer/
//   node tools/artkit/pack-out.mjs --with-sheets   # also keep sheets/ (for re-picking candidates) — much bigger
//   node tools/artkit/pack-out.mjs --dest=D:/xfer  # copy somewhere else (e.g. straight onto a USB drive)
import { cpSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT = join(ROOT, "out");
const args = process.argv.slice(2);
const arg = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const WITH_SHEETS = args.includes("--with-sheets");
const DEST = resolve(arg("dest", join(ROOT, "out-transfer")));

// Per-subject files/dirs to KEEP (everything else — notably sheets/ + *.preview.png — is dropped).
const KEEP_FILES = [
  "identity-ref.png",
  "identity-ref.keyed.png",
  "cardart.png",
  "cardart.keyed.png",
  "parts.json",
  "promoted.txt",
];
const KEEP_DIRS = WITH_SHEETS ? ["parts", "sheets"] : ["parts"];

if (!existsSync(OUT)) {
  console.error(`No ${OUT} — nothing to pack.`);
  process.exit(1);
}
mkdirSync(DEST, { recursive: true });

let subjects = 0;
let files = 0;
let bytes = 0;
const copy = (src, dst) => {
  cpSync(src, dst, { recursive: true });
  // tally
  const stack = [dst];
  while (stack.length) {
    const p = stack.pop();
    const st = statSync(p);
    if (st.isDirectory()) for (const e of readdirSync(p)) stack.push(join(p, e));
    else {
      files++;
      bytes += st.size;
    }
  }
};

for (const id of readdirSync(OUT)) {
  const srcDir = join(OUT, id);
  if (!statSync(srcDir).isDirectory()) continue;
  let took = false;
  for (const f of KEEP_FILES) {
    const s = join(srcDir, f);
    if (existsSync(s)) {
      mkdirSync(join(DEST, id), { recursive: true });
      copy(s, join(DEST, id, f));
      took = true;
    }
  }
  for (const d of KEEP_DIRS) {
    const s = join(srcDir, d);
    if (existsSync(s)) {
      mkdirSync(join(DEST, id), { recursive: true });
      copy(s, join(DEST, id, d));
      took = true;
    }
  }
  if (took) subjects++;
}

console.log(
  `pack-out: ${subjects} subject(s), ${files} file(s), ${(bytes / 1e9).toFixed(2)} GB → ${DEST}\n` +
    `Move this folder into the other machine's tools/artkit/out/ (merge into it). See ARTIST_GUIDE.md §3.`,
);
