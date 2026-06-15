#!/usr/bin/env node
// artkit/guards/chroma-key.mjs — Dimension Drifters #00ff00 chroma-key (art bible §4).
//
// The ONE pinned, tested method to get true alpha: we render every subject on a flat
// #00ff00 field and key it out deterministically here — never ask the image model for
// real alpha (retro #2). Produces, next to each source PNG:
//   <name>.keyed.png     — transparent PNG (the real asset)
//   <name>.preview.png   — keyed subject composited on charcoal #22252B (for review)
//
// Usage:
//   node guards/chroma-key.mjs --all            # every png under out/
//   node guards/chroma-key.mjs --only=drifter   # one subject's out/ dir
//   node guards/chroma-key.mjs <file.png>...     # explicit files
//   flags: --tolerance=N (default 90) · --despill=0..1 (default 0.5)

import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT = join(ROOT, "out");
const args = process.argv.slice(2);
const flag = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const TOL = Number(flag("tolerance", "90")); // how green-dominant a pixel must be to key
const DESPILL = Number(flag("despill", "0.5")); // 0..1 green-edge suppression
const BG = { r: 0x22, g: 0x25, b: 0x2b }; // charcoal preview backdrop (palette base)

function isKeyableGreen(r, g, b) {
  // #00ff00 = green channel dominant, red+blue low. Distance-tolerant.
  return g > 140 && g - Math.max(r, b) > TOL && r < 150 && b < 150;
}

/** Skip our own outputs so re-runs are idempotent. */
function listPngs(dir) {
  const out = [];
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.png$/i.test(e.name) && !/\.(keyed|preview)\.png$/i.test(e.name)) out.push(p);
    }
  };
  walk(dir);
  return out;
}

async function keyOne(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const preview = Buffer.from(data); // copy for the composited preview
  let keyed = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (isKeyableGreen(r, g, b)) {
      data[i + 3] = 0; // transparent in the real asset
      // preview: paint the backdrop where we keyed out
      preview[i] = BG.r;
      preview[i + 1] = BG.g;
      preview[i + 2] = BG.b;
      preview[i + 3] = 255;
      keyed++;
    } else if (g > Math.max(r, b)) {
      // despill green fringe on anti-aliased edges
      const target = (r + b) / 2;
      const v = Math.round(target + (g - target) * (1 - DESPILL));
      data[i + 1] = v;
      preview[i + 1] = v;
    }
  }
  const base = file.replace(/\.png$/i, "");
  await sharp(data, { raw: { width, height, channels: 4 } }).png().toFile(`${base}.keyed.png`);
  await sharp(preview, { raw: { width, height, channels: 4 } }).png().toFile(`${base}.preview.png`);
  const pct = ((keyed / (width * height)) * 100).toFixed(1);
  console.log(`keyed ${file.split(/[/\\]/).slice(-2).join("/")} — ${pct}% removed`);
  if (Number(pct) < 5) console.warn(`  ⚠ very little keyed (${pct}%) — check the render had a flat #00ff00 field`);
}

async function main() {
  let files = args.filter((a) => /\.png$/i.test(a) && existsSync(a));
  if (!files.length) {
    const only = flag("only", null);
    const base = only ? join(OUT, only) : OUT;
    if (!existsSync(base)) {
      console.error(`Nothing to key: ${base} does not exist. Run orchestrate.mjs first.`);
      process.exit(2);
    }
    files = statSync(base).isDirectory() ? listPngs(base) : [base];
  }
  for (const f of files) await keyOne(f);
  console.log(`done — keyed ${files.length} file(s).`);
}

main();
