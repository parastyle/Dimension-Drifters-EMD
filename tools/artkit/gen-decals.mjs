#!/usr/bin/env node
// artkit/gen-decals.mjs — Codex DECAL PROP-PACK: one image-gen paints a SPREAD of distinct top-down
// Wild-West ground props on a #00ff00 field; we chroma-key it, then CONNECTED-COMPONENT extract each
// prop as its own trimmed transparent decal → public/decals/ + a manifest.
//
//   node tools/artkit/gen-decals.mjs
//
// This is the agent-sprite-forge `extract_prop_pack.py` idea (MIT) adapted to our pipeline: ONE Codex
// call for a whole pack of decals instead of one call per prop. Robust to imperfect placement — props
// are found as separate alpha islands, not sliced on a rigid grid.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { configureCodex, runCodexExec } from "./lib/codex.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(here, "../..");
const OUT = resolve(here, "out/decals");
const PUBLIC = resolve(REPO, "packages/client/public/decals");
const MANIFEST = resolve(REPO, "packages/client/src/sprites/decal-manifest.ts");
mkdirSync(OUT, { recursive: true });
mkdirSync(PUBLIC, { recursive: true });
configureCodex({ perChatRoot: resolve(here, ".artkit-codex-homes"), log: (m) => console.log(m) });

const WORK = 1536; // resize the gen to this before labeling (speed); decals export much smaller
const DECAL_MAX = 132; // max px of an exported decal (game-res; they're tiny on screen)
const MIN_AREA = 2500; // ignore alpha islands smaller than this (chroma fringe / shadow fragments)
const KEEP = 11; // keep the biggest N islands (drop the smallest noise/shadow blobs)
const ALPHA = 40; // a pixel counts as "prop" above this alpha

const PROMPT = `Paint ONE wide image: a SPREAD of about NINE distinct TOP-DOWN Wild-West GROUND PROPS, viewed
from DIRECTLY OVERHEAD (orthographic, looking straight down), arranged loosely across the frame with GENEROUS
EMPTY SPACE between them — every prop a SEPARATE island that does NOT touch any other prop and does NOT touch
the frame edge. Props (one each, varied sizes): a weathered grey boulder; a small cluster of pebbles; a dead
dry scrub bush (brown/olive); a tumbleweed; a bleached cattle SKULL; a little pile of bones; a stubby barrel
CACTUS (muted green); a flat cracked rock slab; a broken wooden wagon wheel. Style: HD cel-shaded, thick dark
outlines, MUTED desaturated Wild-West palette (dusty tan/rust/olive/bone/grey), each prop with a small SOFT
dark contact shadow directly under it. EVEN flat top-down lighting, no long cast shadows. The ENTIRE
background is a FLAT PURE CHROMA GREEN #00ff00 (RGB 0,255,0) with NOTHING else on it — no ground, no texture,
no gradient. Each prop must be fully painted + fully inside the frame, well separated, so they can be cut out
individually.`;

function isGreen(r, g, b) {
  return g > 140 && g - Math.max(r, b) > 90 && r < 150 && b < 150; // matches guards/chroma-key.mjs
}

/** Chroma-key (green→alpha 0, light despill) and return a raw RGBA buffer. */
async function keyToRaw(file) {
  const { data, info } = await sharp(file)
    .resize(WORK, WORK, { fit: "inside" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (isGreen(r, g, b)) {
      data[i + 3] = 0;
    } else if (g > Math.max(r, b)) {
      const t = (r + b) / 2;
      data[i + 1] = Math.round(t + (g - t) * 0.5); // despill fringe
    }
  }
  return { data, width: info.width, height: info.height };
}

/** Label connected alpha islands (8-connected) → list of { x0,y0,x1,y1, area }. */
function components(data, width, height) {
  const seen = new Uint8Array(width * height);
  const comps = [];
  const stack = new Int32Array(width * height);
  for (let p = 0; p < width * height; p++) {
    if (seen[p] || data[p * 4 + 3] <= ALPHA) continue;
    let sp = 0;
    stack[sp++] = p;
    seen[p] = 1;
    let x0 = width;
    let y0 = height;
    let x1 = 0;
    let y1 = 0;
    let area = 0;
    while (sp > 0) {
      const q = stack[--sp];
      const qx = q % width;
      const qy = (q / width) | 0;
      area++;
      if (qx < x0) x0 = qx;
      if (qx > x1) x1 = qx;
      if (qy < y0) y0 = qy;
      if (qy > y1) y1 = qy;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = qx + dx;
          const ny = qy + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const n = ny * width + nx;
          if (!seen[n] && data[n * 4 + 3] > ALPHA) {
            seen[n] = 1;
            stack[sp++] = n;
          }
        }
    }
    if (area >= MIN_AREA) comps.push({ x0, y0, x1, y1, area });
  }
  // reading order (top→bottom, left→right) for stable names
  comps.sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
  return comps;
}

async function main() {
  const raw = resolve(OUT, "pack-raw.png");
  if (process.argv.includes("--reextract")) {
    console.log("=== re-extracting from cached pack-raw.png (skipping Codex) ===");
  } else {
    console.log("=== generating decal prop-pack ===");
    const code = await runCodexExec({
      prompt: PROMPT,
      cwd: REPO,
      label: "decal-pack",
      harvestTo: raw,
      stdoutFile: resolve(OUT, "pack.codex.log"),
    });
    if (code !== 0) return console.log(`codex exited ${code} — see pack.codex.log`);
  }

  const { data, width, height } = await keyToRaw(raw);
  await sharp(data, { raw: { width, height, channels: 4 } }).png().toFile(resolve(OUT, "pack.keyed.png"));

  // Find alpha islands, keep the biggest KEEP (drop shadow/fringe fragments), then name in reading order.
  const comps = components(data, width, height)
    .sort((a, b) => b.area - a.area)
    .slice(0, KEEP)
    .sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
  console.log(`extracting ${comps.length} props`);
  const ids = [];
  for (let i = 0; i < comps.length; i++) {
    const c = comps[i];
    const pad = 3;
    const left = Math.max(0, c.x0 - pad);
    const top = Math.max(0, c.y0 - pad);
    const w = Math.min(width, c.x1 + 1 + pad) - left; // the component bbox IS the trim — no sharp .trim()
    const h = Math.min(height, c.y1 + 1 + pad) - top;
    if (w < 6 || h < 6) continue;
    const id = `decal-${String(ids.length).padStart(2, "0")}`;
    try {
      await sharp(data, { raw: { width, height, channels: 4 } })
        .extract({ left, top, width: w, height: h })
        .resize(DECAL_MAX, DECAL_MAX, { fit: "inside", withoutEnlargement: true })
        .png()
        .toFile(resolve(PUBLIC, `${id}.png`));
      ids.push(id);
    } catch (e) {
      console.log(`  skip ${id} (${w}×${h}): ${e.message}`);
    }
  }

  writeFileSync(
    MANIFEST,
    `// AUTO-GENERATED by tools/artkit/gen-decals.mjs — Codex decal prop-pack (§17 P4 ground dressing).\n` +
      `// Each id is a trimmed transparent PNG in public/decals/, scattered on the floor by ArenaScene.\n` +
      `export const DECAL_IDS = [\n${ids.map((d) => `  ${JSON.stringify(d)},`).join("\n")}\n] as const;\n`,
    "utf8",
  );
  console.log(`installed ${ids.length} decals → public/decals/ + decal-manifest.ts`);
}

main();
