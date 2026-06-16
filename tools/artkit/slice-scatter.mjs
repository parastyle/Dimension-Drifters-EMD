#!/usr/bin/env node
// artkit/slice-scatter.mjs — "dissect" a painted CLUSTER VFX (e.g. the magma-ball cluster for the
// bone greatsword) into individual entity sprites, then pack them into a single equal-cell spritesheet
// the Weaponsmith/engine can fling as distinct scatter-shot particles (CODE-14, §14).
//
// Connected-component labels the keyed alpha → one blob per ball → crops each → centres each in a
// square cell → lays the cells out in a horizontal strip. Writes scatter/sheet.png + scatter/meta.json.
//
//   node slice-scatter.mjs --id=vfx-x-sword-bone [--src=sheets/candidate-1.keyed.png] [--minarea=200]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const arg = (k, d) => { const h = args.find((a) => a.startsWith(`--${k}=`)); return h ? h.slice(k.length + 3) : d; };
const id = arg("id", "");
if (!id) { console.error("need --id"); process.exit(1); }
const SUBJ = join(ROOT, "out", id);
const SRC = join(SUBJ, arg("src", "sheets/candidate-1.keyed.png"));
const MINAREA = Number(arg("minarea", "200"));
const ALPHA_T = 40; // alpha above this = solid

const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H, channels: C } = info;
const A = (x, y) => data[(y * W + x) * C + 3];

// --- connected-component labelling (4-neighbour BFS over the alpha mask) ---
const seen = new Uint8Array(W * H);
const blobs = [];
const stack = new Int32Array(W * H);
for (let y0 = 0; y0 < H; y0++) {
  for (let x0 = 0; x0 < W; x0++) {
    const i0 = y0 * W + x0;
    if (seen[i0] || A(x0, y0) <= ALPHA_T) continue;
    let sp = 0; stack[sp++] = i0; seen[i0] = 1;
    let minx = x0, maxx = x0, miny = y0, maxy = y0, area = 0;
    while (sp > 0) {
      const i = stack[--sp]; const x = i % W, y = (i / W) | 0; area++;
      if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y;
      const nb = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
      for (const [nx, ny] of nb) {
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const ni = ny * W + nx;
        if (!seen[ni] && A(nx, ny) > ALPHA_T) { seen[ni] = 1; stack[sp++] = ni; }
      }
    }
    if (area >= MINAREA) blobs.push({ minx, miny, w: maxx - minx + 1, h: maxy - miny + 1, area });
  }
}
blobs.sort((a, b) => b.area - a.area); // biggest first (stable, deterministic)
if (!blobs.length) { console.error("no blobs found — wrong src or threshold?"); process.exit(1); }

// --- equal square cell that fits the largest ball, each ball centred in its cell ---
const cell = Math.max(...blobs.map((b) => Math.max(b.w, b.h))) + 4; // small pad
const outDir = join(SUBJ, "scatter");
mkdirSync(outDir, { recursive: true });

const cells = await Promise.all(blobs.map(async (b) => {
  const ball = await sharp(SRC).extract({ left: b.minx, top: b.miny, width: b.w, height: b.h }).toBuffer();
  return sharp({ create: { width: cell, height: cell, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: ball, left: Math.round((cell - b.w) / 2), top: Math.round((cell - b.h) / 2) }])
    .png().toBuffer();
}));

// horizontal strip: N cells side by side
const sheet = sharp({ create: { width: cell * cells.length, height: cell, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite(cells.map((buf, i) => ({ input: buf, left: i * cell, top: 0 })));
await sheet.png().toFile(join(outDir, "sheet.png"));
writeFileSync(join(outDir, "meta.json"), JSON.stringify({ frameWidth: cell, frameHeight: cell, count: cells.length }, null, 2) + "\n");
console.log(`sliced ${cells.length} balls → scatter/sheet.png (cell ${cell}px), meta.json`);
