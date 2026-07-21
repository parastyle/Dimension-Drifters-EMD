#!/usr/bin/env node
// V6G Codex art pipeline: five painted katana slash languages (derived into per-blade palettes) and six
// painted muzzle flashes. Resumable raw generations live under tools/artkit/out; installed sheets and the
// typed katana assignment manifest are deterministic products of those raws.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { configureCodex, runCodexExec } from "./lib/codex.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(here, "../..");
const OUT = resolve(here, "out/v6g-combat-sheets");
const PUBLIC = resolve(REPO, "packages/client/public/particles");
const GENERATED = resolve(REPO, "packages/client/src/vfx/katana-slash.generated.ts");
mkdirSync(OUT, { recursive: true });
mkdirSync(PUBLIC, { recursive: true });
configureCodex({ perChatRoot: resolve(here, ".artkit-codex-homes"), log: console.log });

const CELL = 96;
const FRAMES = 10;
const MUZZLE_CELL = 192;
const GREEN = `Background: perfectly flat solid #00ff00 chroma green, no gradient, texture, shadow, glow,
or lighting variation in the background. Do not use #00ff00 in the painted subject.`;
const SLASH_COMMON = `Generate an image. Use case: stylized-concept. Asset type: tileable 2D painted katana
slash ribbon for an additive Phaser Rope. Composition: ONE unbroken slender horizontal slash ribbon centered
vertically, running from the LEFT canvas edge to the RIGHT canvas edge at matching height, thickness,
brightness and direction. Generous green clearance above and below. HD hand-painted game VFX, crisp
painterly pigment, readable after reduction to 96px. No weapon, character, scene, grid, separate particles,
text, logo, watermark, border, opaque backing, perfect circle, rectangle, or vertical plume. ${GREEN}`;
const MUZZLE_COMMON = `Generate an image. Use case: stylized-concept. Asset type: one isolated hand-painted
2D gun muzzle flash for a game sprite. Composition: exact ignition point at LEFT-CENTER, flare points RIGHT
and fills the middle 75% of the canvas, with generous green clearance on every edge. White-hot core with warm
amber outer pigment, crisp irregular silhouette, fine painterly texture that survives reduction to 192px.
No gun, casing, smoke cloud, character, scene, grid, text, logo, watermark, border, opaque backing, perfect
circle, regular star, rectangle, or symmetric engine primitive. ${GREEN}`;

const LANGUAGES = [
  { id: "crescent", prompt: "A clean moon-crescent draw cut: broad rising belly, hair-thin trailing wake, dry-brush feathering along one edge." },
  { id: "crosscut", prompt: "A cross-cut language: one dominant horizontal cut braided with a short diagonal counter-cut, reconnecting into the ribbon like torn silk." },
  { id: "ripple", prompt: "A water-ripple cut: layered flowing wavelets, foam-like broken highlights and a calm hollow channel through the stroke." },
  { id: "inkstroke", prompt: "A sumi ink-stroke cut: bold calligraphic pressure changes, ragged bristle gaps, splintered dry-brush tail, luminous pigment instead of black ink." },
  { id: "seam", prompt: "A spatial seam cut: fractured offset edge segments, thin internal void-gaps and crystalline stitch marks, all rejoining as one continuous ribbon." },
];

const KATANAS = [
  ["x2-hailwidow-katana", "crescent", "#9eeaff", "splitting-hail crescent"],
  ["x2-gravechill-nodachi", "seam", "#d9f7ff", "frozen fracture seam"],
  ["x2-voltfang-tachi", "crosscut", "#ffe24a", "forked thunder cross-cut"],
  ["x2-cinderfang-wakizashi-pair", "crosscut", "#ff6a2a", "ember twin cross-cut"],
  ["x2-stormpetal-odachi", "inkstroke", "#ff9ecf", "petal-fiber ink stroke"],
  ["drift-katana-stillwater-edict", "ripple", "#b9e7ff", "stillwater judicial ripple"],
  ["drift-katana-stormthread", "crosscut", "#56a7ff", "blue storm-thread cross-cut"],
  ["drift-katana-riftstep", "seam", "#b14bff", "violet rift-step seam"],
  ["drift-nodachi-pale-horizon", "crescent", "#d8fbff", "pale horizon crescent"],
  ["drift-nodachi-gatebreaker", "inkstroke", "#f1c06a", "gatebreaking dry brush"],
  ["drift-greatkatana-moonwake", "crescent", "#e8e3ff", "lunar wake crescent"],
  ["drift-greatkatana-tempest-regent", "ripple", "#d9b85f", "regent storm ripple"],
  ["drift-colossal-world-seam", "seam", "#ff5eea", "colossal world seam"],
  ["x-sword-neon-katana", "ripple", "#59fff2", "neon plasma ripple"],
];

const MUZZLES = [
  ["needle", "A long narrow needle-flare with two hooked side tongues and a pinprick ignition."],
  ["crown", "A squat crown-shaped blast with five uneven flame lobes and a torn lower edge."],
  ["fork", "A lightning-fork flash with one main spear and three asymmetrical rejoining branches."],
  ["bloom", "A wide flower-like combustion bloom made of ragged overlapping flame petals, strongly directional right."],
  ["split", "A split-rail flash: two close parallel hot streaks separated by a dark channel, joined at ignition."],
  ["shard", "A fractured artillery flash made of angular torn-fire shards and a heavy irregular leading wedge."],
];

function hexRgb(hex) {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

async function keyedPixels(rawPath, size, tint) {
  const { data, info } = await sharp(rawPath)
    .ensureAlpha()
    .resize(size, size, { fit: "fill", kernel: sharp.kernel.lanczos3 })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const accent = tint ? hexRgb(tint) : undefined;
  for (let i = 0; i < info.width * info.height; i++) {
    const o = i * 4;
    const r = data[o];
    const g = data[o + 1];
    const b = data[o + 2];
    const dominance = g - Math.max(r, b);
    if (dominance > 85) {
      data[o] = data[o + 1] = data[o + 2] = data[o + 3] = 0;
      continue;
    }
    if (dominance > 35) {
      data[o + 3] = Math.min(data[o + 3], Math.round(255 * (1 - (dominance - 35) / 50)));
      data[o + 1] = Math.max(r, b);
    }
    if (accent && data[o + 3] > 0) {
      const light = Math.max(r, g, b) / 255;
      const hot = Math.max(0, (light - 0.62) / 0.38);
      data[o] = Math.round(accent[0] * (0.34 + light * 0.66) * (1 - hot) + 255 * hot);
      data[o + 1] = Math.round(accent[1] * (0.34 + light * 0.66) * (1 - hot) + 255 * hot);
      data[o + 2] = Math.round(accent[2] * (0.34 + light * 0.66) * (1 - hot) + 255 * hot);
    }
  }
  return data;
}

function shiftedTile(tile, shift) {
  const out = Buffer.alloc(tile.length);
  for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) {
    const source = (y * CELL + ((x + shift) % CELL)) * 4;
    tile.copy(out, (y * CELL + x) * 4, source, source + 4);
  }
  return out;
}

function featherHorizontalSeam(tile) {
  const out = Buffer.from(tile);
  const feather = 12;
  for (let y = 0; y < CELL; y++) for (let x = 0; x < feather; x++) {
    const left = (y * CELL + x) * 4;
    const right = (y * CELL + CELL - 1 - x) * 4;
    const weight = 1 - x / (feather - 1);
    for (let channel = 0; channel < 4; channel++) {
      const average = (tile[left + channel] + tile[right + channel]) / 2;
      out[left + channel] = Math.round(tile[left + channel] + (average - tile[left + channel]) * weight);
      out[right + channel] = Math.round(tile[right + channel] + (average - tile[right + channel]) * weight);
    }
  }
  return out;
}

function ribbonSheet(tile) {
  const width = CELL * FRAMES;
  const out = Buffer.alloc(width * CELL * 4);
  for (let frame = 0; frame < FRAMES; frame++) {
    const shifted = featherHorizontalSeam(
      shiftedTile(tile, Math.round((frame * CELL) / FRAMES)),
    );
    for (let y = 0; y < CELL; y++) {
      const row = y * CELL * 4;
      shifted.copy(out, (y * width + frame * CELL) * 4, row, row + CELL * 4);
    }
  }
  return out;
}

function alignMuzzleCell(cell) {
  let minX = MUZZLE_CELL;
  let minY = MUZZLE_CELL;
  let maxY = -1;
  for (let y = 0; y < MUZZLE_CELL; y++)
    for (let x = 0; x < MUZZLE_CELL; x++) {
      if (cell[(y * MUZZLE_CELL + x) * 4 + 3] < 12) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  if (maxY < 0) return cell;
  const dx = 6 - minX;
  const dy = Math.round(MUZZLE_CELL / 2 - (minY + maxY) / 2);
  const aligned = Buffer.alloc(cell.length);
  for (let y = 0; y < MUZZLE_CELL; y++)
    for (let x = 0; x < MUZZLE_CELL; x++) {
      const tx = x + dx;
      const ty = y + dy;
      if (tx < 0 || tx >= MUZZLE_CELL || ty < 0 || ty >= MUZZLE_CELL) continue;
      const source = (y * MUZZLE_CELL + x) * 4;
      cell.copy(aligned, (ty * MUZZLE_CELL + tx) * 4, source, source + 4);
    }
  return aligned;
}

async function renderRaw(id, prompt) {
  const raw = resolve(OUT, `${id}-raw.png`);
  if (existsSync(raw)) return raw;
  const code = await runCodexExec({
    label: id,
    cwd: REPO,
    prompt,
    harvestTo: raw,
    stdoutFile: resolve(OUT, `${id}.codex.log`),
  });
  if (code !== 0 || !existsSync(raw)) throw new Error(`${id} Codex render failed (${code})`);
  return raw;
}

const only = process.argv[2] ?? "all";
if (only === "all" || only === "katana") {
  const raws = new Map();
  for (const language of LANGUAGES)
    raws.set(language.id, await renderRaw(`katana-${language.id}`, `${SLASH_COMMON}\n${language.prompt}`));
  for (const [weaponId, language, color] of KATANAS) {
    const pixels = await keyedPixels(raws.get(language), CELL, color);
    const sheet = ribbonSheet(pixels);
    await sharp(sheet, { raw: { width: CELL * FRAMES, height: CELL, channels: 4 } })
      .png({ compressionLevel: 9 })
      .toFile(resolve(PUBLIC, `katana-slash-${weaponId}.png`));
    console.log(`INSTALLED katana-slash-${weaponId}.png (${language}, ${color})`);
  }
  const rows = KATANAS.map(([weaponId, language, color, label]) =>
    `  ${JSON.stringify(weaponId)}: Object.freeze({ language: ${JSON.stringify(language)}, color: ${JSON.stringify(color)}, label: ${JSON.stringify(label)}, key: ${JSON.stringify(`katana-slash:${weaponId}`)}, url: ${JSON.stringify(`particles/katana-slash-${weaponId}.png`)} }),`,
  ).join("\n");
  writeFileSync(
    GENERATED,
    `// AUTO-GENERATED by tools/artkit/gen-v6g-combat-sheets.mjs.\nexport interface KatanaSlashAssignment { readonly language: string; readonly color: string; readonly label: string; readonly key: string; readonly url: string; }\nexport const KATANA_SLASH_ASSIGNMENTS = Object.freeze({\n${rows}\n}) satisfies Readonly<Record<string, KatanaSlashAssignment>>;\n`,
  );
}

if (only === "all" || only === "muzzle") {
  const cells = [];
  for (const [id, description] of MUZZLES) {
    const raw = await renderRaw(`muzzle-${id}`, `${MUZZLE_COMMON}\n${description}`);
    cells.push(alignMuzzleCell(await keyedPixels(raw, MUZZLE_CELL)));
  }
  const width = MUZZLE_CELL * MUZZLES.length;
  const sheet = Buffer.alloc(width * MUZZLE_CELL * 4);
  cells.forEach((cell, frame) => {
    for (let y = 0; y < MUZZLE_CELL; y++) {
      const row = y * MUZZLE_CELL * 4;
      cell.copy(sheet, (y * width + frame * MUZZLE_CELL) * 4, row, row + MUZZLE_CELL * 4);
    }
  });
  await sharp(sheet, { raw: { width, height: MUZZLE_CELL, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(resolve(PUBLIC, "v6g-muzzle-flashes.png"));
  console.log(`INSTALLED v6g-muzzle-flashes.png (${MUZZLES.length} x ${MUZZLE_CELL}px)`);
}
