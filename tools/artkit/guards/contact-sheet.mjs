#!/usr/bin/env node
// artkit/guards/contact-sheet.mjs — tile a subject's keyed candidates into ONE labelled
// image for easy review (more robust to deliver than N separate large PNGs).
//
//   node guards/contact-sheet.mjs --only=drifter [--height=420]
//   node guards/contact-sheet.mjs --all
// Reads out/<id>/sheets/candidate-*.preview.png → writes out/<id>/contact.png

import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT = join(ROOT, "out");
const args = process.argv.slice(2);
const flag = (n, d) => {
  const a = args.find((x) => x.startsWith(`--${n}=`));
  return a ? a.slice(n.length + 3) : d;
};
const H = Number(flag("height", "420"));
const GAP = 16;
const BG = { r: 0x1a, g: 0x13, b: 0x20, alpha: 1 };

async function sheetFor(id) {
  const dir = join(OUT, id, "sheets");
  if (!existsSync(dir)) return false;
  const files = readdirSync(dir)
    .filter((f) => /candidate-\d+\.preview\.png$/.test(f))
    .sort();
  if (!files.length) return false;

  const tiles = [];
  for (const f of files) {
    const n = f.match(/candidate-(\d+)/)?.[1] ?? "?";
    const buf = await sharp(join(dir, f)).resize({ height: H, fit: "contain", background: BG }).toBuffer();
    const meta = await sharp(buf).metadata();
    const label = Buffer.from(
      `<svg width="${meta.width}" height="34"><rect width="100%" height="100%" fill="#22252b"/><text x="${meta.width / 2}" y="24" font-family="sans-serif" font-size="22" fill="#e8e4d8" text-anchor="middle">#${n}</text></svg>`,
    );
    const labelled = await sharp(buf)
      .extend({ bottom: 34, background: BG })
      .composite([{ input: label, left: 0, top: H }])
      .toBuffer();
    tiles.push({ buf: labelled, w: meta.width, h: H + 34 });
  }

  const totalW = tiles.reduce((s, t) => s + t.w, 0) + GAP * (tiles.length + 1);
  const totalH = H + 34 + GAP * 2;
  const composites = [];
  let x = GAP;
  for (const t of tiles) {
    composites.push({ input: t.buf, left: x, top: GAP });
    x += t.w + GAP;
  }
  // Output a FLATTENED JPEG (no alpha) capped to a phone-friendly width — RGBA PNGs were
  // failing to render in the mobile chat client; flattened JPEG renders everywhere.
  const outPath = join(OUT, id, "contact.jpg");
  const capW = Math.min(totalW, 1600);
  const composed = await sharp({
    create: { width: totalW, height: totalH, channels: 4, background: BG },
  })
    .composite(composites)
    .png()
    .toBuffer();
  await sharp(composed).resize({ width: capW }).flatten({ background: BG }).jpeg({ quality: 86 }).toFile(outPath);
  console.log(`contact sheet → ${id}/contact.jpg (${tiles.length} tiles, ${capW}px wide)`);
  return true;
}

async function main() {
  const only = flag("only", null);
  const ids = only ? [only] : readdirSync(OUT).filter((d) => existsSync(join(OUT, d, "sheets")));
  let made = 0;
  for (const id of ids) if (await sheetFor(id)) made++;
  console.log(`done — ${made} contact sheet(s).`);
}

main();
