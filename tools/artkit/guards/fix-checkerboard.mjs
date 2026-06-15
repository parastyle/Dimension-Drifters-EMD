#!/usr/bin/env node
// artkit/guards/fix-checkerboard.mjs — repair images that came back FLATTENED
// (opaque RGB with the transparency checkerboard PAINTED IN as light-grey/white
// tiles) instead of true alpha. Image-gen models do this intermittently; the
// reference (identity-ref) is supposed to be true-alpha, so it shows up in a
// game as a white checkered box behind the subject.
//
// Method: border flood-fill. Background pixels are "checker-light" (all
// channels bright, low saturation) AND connected to the image border; the
// chunky dark outlines of the canon style dam the fill so it can't leak into
// the subject. Light pixels INSIDE the subject (white hair, etc.) survive
// because they're enclosed. One feather pass softens the cut edge.
//
//   node guards/fix-checkerboard.mjs --scan         # list flattened (no writes)
//   node guards/fix-checkerboard.mjs --all          # repair every flattened png under out/
//   node guards/fix-checkerboard.mjs --file=<path>  # repair one file in place
//
// Only rewrites when the fill classifies 2–95% of pixels as background
// (sanity window — won't nuke a legit opaque illustration or do nothing).
//
// Requires `sharp` (npm i sharp).

import { existsSync, readdirSync, renameSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "out");
const args = process.argv.slice(2);
const SCAN = args.includes("--scan");
const ALL = args.includes("--all");
const fileArg = args.find((a) => a.startsWith("--file="))?.slice("--file=".length);

const isCheckerLight = (r, g, b) => Math.min(r, g, b) >= 225 && Math.max(r, g, b) - Math.min(r, g, b) <= 14;

async function isFlattened(path) {
  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 3; i < data.length; i += 4) if (data[i] !== 255) return false; // has real alpha → fine
  const w = info.width;
  const corners = [0, (w - 1) * 4, (info.height - 1) * w * 4];
  return corners.some((i) => isCheckerLight(data[i], data[i + 1], data[i + 2]));
}

async function repair(path) {
  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const isBg = new Uint8Array(w * h);
  const queue = [];
  const push = (x, y) => {
    const p = y * w + x;
    if (isBg[p]) return;
    const i = p * 4;
    if (!isCheckerLight(data[i], data[i + 1], data[i + 2])) return;
    isBg[p] = 1;
    queue.push(p);
  };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (queue.length) {
    const p = queue.pop();
    const x = p % w;
    const y = (p / w) | 0;
    if (x > 0) push(x - 1, y);
    if (x < w - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < h - 1) push(x, y + 1);
  }
  let bg = 0;
  for (let p = 0; p < w * h; p++) if (isBg[p]) { data[p * 4 + 3] = 0; bg++; }
  const bgPct = (bg / (w * h)) * 100;
  if (bgPct < 2 || bgPct > 95) return null;
  const aAt = (x, y) => data[(y * w + x) * 4 + 3];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      if (data[i + 3] === 0 || !isCheckerLight(data[i], data[i + 1], data[i + 2])) continue;
      const t = (aAt(x - 1, y) === 0) + (aAt(x + 1, y) === 0) + (aAt(x, y - 1) === 0) + (aAt(x, y + 1) === 0);
      if (t >= 2) data[i + 3] = 0;
      else if (t === 1) data[i + 3] = 120;
    }
  }
  return { data, w, h, bgPct };
}

async function repairFile(path) {
  if (!(await isFlattened(path))) {
    if (fileArg) console.log(`  OK (already has alpha): ${path}`);
    return false;
  }
  const r = await repair(path);
  if (!r) { console.log(`  SKIP (outside 2–95% sanity window): ${path}`); return false; }
  await sharp(r.data, { raw: { width: r.w, height: r.h, channels: 4 } }).png().toFile(`${path}.tmp.png`);
  renameSync(`${path}.tmp.png`, path);
  console.log(`  FIXED (${r.bgPct.toFixed(1)}% bg removed): ${path}`);
  return true;
}

function* pngsUnder(d) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) yield* pngsUnder(p);
    else if (e.name.toLowerCase().endsWith(".png")) yield p;
  }
}

async function main() {
  if (fileArg) { await repairFile(resolve(fileArg)); return; }
  if (!existsSync(OUT)) { console.log("no out/ yet"); return; }
  let found = 0;
  let fixed = 0;
  for (const p of pngsUnder(OUT)) {
    if (!(await isFlattened(p))) continue;
    found++;
    if (SCAN) { console.log(`  FLATTENED: ${p}`); continue; }
    if (ALL && (await repairFile(p))) fixed++;
  }
  console.log(SCAN ? `\n${found} flattened images found.` : `\n${found} flattened, ${fixed} repaired.`);
}

main();
