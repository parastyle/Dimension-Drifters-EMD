#!/usr/bin/env node
// artkit/gen-ribbon-sheets.mjs — bespoke Painted Edge Ribbon (PER) wisp sheets for the four
// Driftblade-model adopters. RESUMABLE (skips harvested raws), renders serially, chroma-keys to RGBA,
// and installs exact 10 × 96px horizontal spritesheets at public/particles/per-wisp-<identity>.png.
//
//   node tools/artkit/gen-ribbon-sheets.mjs
//   node tools/artkit/gen-ribbon-sheets.mjs per-wisp-gravechill
import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { configureCodex, runCodexExec } from "./lib/codex.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(here, "../..");
const OUT = resolve(here, "out/ribbon-sheets");
const PUBLIC = resolve(REPO, "packages/client/public/particles");
mkdirSync(OUT, { recursive: true });
mkdirSync(PUBLIC, { recursive: true });
configureCodex({ perChatRoot: resolve(here, ".artkit-codex-homes"), log: (m) => console.log(m) });

const CELL = 96;
const FRAMES = 10;
const SHEET_WIDTH = CELL * FRAMES;
const EDGE_FEATHER = 12;

const COMMON = `Use case: stylized-concept
Asset type: horizontally tileable 2D painted melee-ribbon texture for an additive Phaser Rope
Composition: ONE unbroken, slender horizontal VFX ribbon centered vertically. It runs fully from the LEFT
canvas edge to the RIGHT canvas edge, meeting both edges at exactly the same height, thickness, brightness,
and direction so it is SEAMLESSLY TILEABLE HORIZONTALLY. Keep generous flat-green clearance above and below.
Style: HD hand-painted game VFX matching crisp painterly particle sprites; clean silhouette; luminous pigment;
fine internal texture that survives reduction to 96x96; strong horizontal flow and tapered internal marks.
Background: perfectly flat solid #00ff00 chroma green, with no gradient, texture, shadow, glow, or lighting
variation in the background. Do not use #00ff00 in the ribbon.
Constraints: no weapon, character, scene, frame grid, separate particles, text, logo, watermark, border, black
opaque backing, radial burst, circle, or vertical plume. The ribbon may contain identity details, but they must
remain joined into one readable left-to-right strip and must not touch the top or bottom canvas edges.`;

const SHEETS = [
  {
    id: "per-wisp-gravechill",
    prompt: `Cold Court / freeze-and-shatter identity: a pale cyan and ice-white frost ribbon with a cold-blue
core, embedded angular frost crystals, and small faceted ice-shard splinters pointing along the horizontal
flow. The body looks briefly frozen solid before breaking, with crisp crystalline edges and sparse hoarfrost.`,
  },
  {
    id: "per-wisp-stormpetal",
    prompt: `Petalfall identity: an airy ivory, blush-pink, and muted magenta wind ribbon assembled from torn
petal silhouettes and ragged petal fibers. The joined strip should feel weightless and wind-pulled, with small
notches and translucent gaps inside the band, but it must remain one continuous horizontal ribbon.`,
  },
  {
    id: "per-wisp-hailwidow",
    prompt: `Splitting-hail identity: a terse blue-white hail streak with a hard icy core that splits into two
close parallel needle-streaks, reconnects, and sheds a few tiny angular hail chips along the flow. Crisp,
staccato, narrow, and glassy rather than smoky; restrained pale-cyan glow only inside the ribbon.`,
  },
  {
    id: "per-wisp-voltfang",
    prompt: `Fang, Then Thunder identity: a jagged yellow-white lightning-crack ribbon with sharp cyan forks
and a dim violet-blue echo offset just behind the main crack, expressing a bright electrical fang followed by
a softer delayed body. Branches stay short and rejoin the horizontal strip; electric, fractured, and taut.`,
  },
];

async function chromaKeyTile(rawPath) {
  const { data, info } = await sharp(rawPath)
    .ensureAlpha()
    .resize(CELL, CELL, { fit: "fill", kernel: sharp.kernel.lanczos3 })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const channels = info.channels;
  for (let i = 0; i < info.width * info.height; i++) {
    const offset = i * channels;
    const r = data[offset];
    const g = data[offset + 1];
    const b = data[offset + 2];
    const greenDominance = g - Math.max(r, b);
    if (greenDominance > 90) {
      data[offset] = 0;
      data[offset + 1] = 0;
      data[offset + 2] = 0;
      data[offset + 3] = 0;
    } else if (greenDominance > 40) {
      data[offset + 3] = Math.min(
        data[offset + 3],
        Math.round(255 * (1 - (greenDominance - 40) / 50)),
      );
      data[offset + 1] = Math.max(r, b);
    }
  }
  return data;
}

function shiftTile(tile, shift) {
  const shifted = Buffer.alloc(tile.length);
  for (let y = 0; y < CELL; y++) {
    for (let x = 0; x < CELL; x++) {
      const sourceX = (x + shift) % CELL;
      const source = (y * CELL + sourceX) * 4;
      const target = (y * CELL + x) * 4;
      tile.copy(shifted, target, source, source + 4);
    }
  }
  return shifted;
}

/** Make opposing U edges pixel-identical, feathering the correction inward. PER currently ping-pongs U
 * instead of wrapping, but this keeps each 96px cell safe under filtering and future wrap-style plumbing. */
function crossfadeHorizontalEdges(tile) {
  const result = Buffer.from(tile);
  for (let y = 0; y < CELL; y++) {
    for (let x = 0; x < EDGE_FEATHER; x++) {
      const left = (y * CELL + x) * 4;
      const right = (y * CELL + (CELL - 1 - x)) * 4;
      const weight = 1 - x / (EDGE_FEATHER - 1);
      for (let channel = 0; channel < 4; channel++) {
        const average = (tile[left + channel] + tile[right + channel]) / 2;
        result[left + channel] = Math.round(
          tile[left + channel] + (average - tile[left + channel]) * weight,
        );
        result[right + channel] = Math.round(
          tile[right + channel] + (average - tile[right + channel]) * weight,
        );
      }
    }
  }
  return result;
}

function buildSheet(tile) {
  const sheet = Buffer.alloc(SHEET_WIDTH * CELL * 4);
  for (let frame = 0; frame < FRAMES; frame++) {
    const shifted = shiftTile(tile, Math.round((frame * CELL) / FRAMES));
    const seamless = crossfadeHorizontalEdges(shifted);
    for (let y = 0; y < CELL; y++) {
      const source = y * CELL * 4;
      const target = (y * SHEET_WIDTH + frame * CELL) * 4;
      seamless.copy(sheet, target, source, source + CELL * 4);
    }
  }
  return sheet;
}

async function verifyInstalledSheet(dst) {
  const image = sharp(dst);
  const metadata = await image.metadata();
  if (
    metadata.width !== SHEET_WIDTH ||
    metadata.height !== CELL ||
    metadata.channels !== 4 ||
    !metadata.hasAlpha
  ) {
    throw new Error(
      `format mismatch: expected ${SHEET_WIDTH}x${CELL} RGBA, got ${metadata.width}x${metadata.height} ` +
        `${metadata.channels ?? "?"}ch alpha=${metadata.hasAlpha}`,
    );
  }
  const { data } = await image.raw().toBuffer({ resolveWithObject: true });
  let alphaMin = 255;
  let alphaMax = 0;
  let painted = 0;
  let maxSeamDelta = 0;
  for (let y = 0; y < CELL; y++) {
    for (let x = 0; x < SHEET_WIDTH; x++) {
      const alpha = data[(y * SHEET_WIDTH + x) * 4 + 3];
      alphaMin = Math.min(alphaMin, alpha);
      alphaMax = Math.max(alphaMax, alpha);
      if (alpha > 16) painted++;
    }
    for (let frame = 0; frame < FRAMES; frame++) {
      const left = (y * SHEET_WIDTH + frame * CELL) * 4;
      const right = (y * SHEET_WIDTH + frame * CELL + CELL - 1) * 4;
      for (let channel = 0; channel < 4; channel++) {
        maxSeamDelta = Math.max(maxSeamDelta, Math.abs(data[left + channel] - data[right + channel]));
      }
    }
  }
  const coverage = painted / (SHEET_WIDTH * CELL);
  if (alphaMin !== 0 || alphaMax < 200 || coverage < 0.01 || coverage > 0.8 || maxSeamDelta !== 0) {
    throw new Error(
      `invalid alpha/tile result: alpha=${alphaMin}-${alphaMax}, coverage=${coverage.toFixed(3)}, ` +
        `seamDelta=${maxSeamDelta}`,
    );
  }
  console.log(
    `VERIFIED ${dst} — ${SHEET_WIDTH}x${CELL} RGBA, ${FRAMES} cells, ` +
      `alpha ${alphaMin}-${alphaMax}, coverage ${coverage.toFixed(3)}, seam delta ${maxSeamDelta}`,
  );
}

const only = process.argv[2];
const todo = only ? SHEETS.filter((sheet) => sheet.id === only) : SHEETS;
if (!todo.length) {
  console.error(`unknown ribbon sheet "${only}"`);
  process.exit(1);
}

let failures = 0;
for (const sheet of todo) {
  const raw = resolve(OUT, `${sheet.id}-raw.png`);
  const dst = resolve(PUBLIC, `${sheet.id}.png`);
  try {
    if (!existsSync(raw)) {
      console.log(`=== render ${sheet.id} ===`);
      const code = await runCodexExec({
        label: sheet.id,
        cwd: REPO,
        prompt: `Generate an image. ${sheet.prompt}\n\n${COMMON}`,
        harvestTo: raw,
        stdoutFile: resolve(OUT, `${sheet.id}.codex.log`),
      });
      if (code !== 0 || !existsSync(raw)) {
        throw new Error(`render failed (exit ${code})`);
      }
    } else {
      console.log(`RESUME ${sheet.id} — using ${raw}`);
    }
    const tile = await chromaKeyTile(raw);
    const pixels = buildSheet(tile);
    await sharp(pixels, {
      raw: { width: SHEET_WIDTH, height: CELL, channels: 4 },
    })
      .png({ compressionLevel: 9 })
      .toFile(dst);
    await verifyInstalledSheet(dst);
  } catch (error) {
    failures++;
    console.error(`FAIL ${sheet.id}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failures) process.exitCode = 1;
console.log(failures ? `DONE with ${failures} failures` : `DONE ${todo.length}/${todo.length} installed`);
