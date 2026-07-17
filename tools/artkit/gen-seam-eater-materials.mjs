#!/usr/bin/env node
// artkit/gen-seam-eater-materials.mjs — SERRAKETH dimension material passes (§53, wormboss-panel).
// Per docs/wormboss-panel/designer.md: after canonical geometry approval, EDIT the broad-plate assets
// into five same-anchor material skins — a skin can never change combat silhouette or connector
// alignment, so every render is an edit of the approved master with geometry pinned. RESUMABLE.
// Installs to packages/client/public/sprites/seam-eater/<asset>--<dim>.png (512, chroma-keyed, no trim).
//
//   node tools/artkit/gen-seam-eater-materials.mjs [only-dim]
import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { configureCodex, runCodexExec } from "./lib/codex.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(here, "../..");
const MASTERS = resolve(here, "out/seam-eater");
const OUT = resolve(here, "out/seam-eater-materials");
const DST = resolve(REPO, "packages/client/public/sprites/seam-eater");
mkdirSync(OUT, { recursive: true });
configureCodex({ perChatRoot: resolve(here, ".artkit-codex-homes"), log: (m) => console.log(m) });

const SPEC = `RENDER SPEC (strict): this is an EDIT of the attached master image. Keep the EXACT canvas
(512x512), silhouette, outline weight, connector/registration-collar positions, crack/damage geometry,
and the flat opaque #00ff00 background. ONLY re-material the armor plates and inner layers per the
dimension palette. HD 2D cel-shaded cutout look, 5-6 flat colors, no gradients, no glow, no new details.`;

// The broad-plate assets the designer names for material passes.
const ASSETS = ["seam-eater-body-intact", "seam-eater-body-wounded", "seam-eater-head-armored", "seam-eater-spinner-closed"];

const DIMS = [
  ["wildwest", "Wild West pass: rusted claim-iron plates, dry ochre strata trapped in the chambers, amber seam accent."],
  ["frostfell", "Frostfell pass: steel-grey cathedral plate, glacier-blue ice inner layers, cold-cyan seam accent."],
  ["verdant", "Verdant Ruins pass: mossed jade stone plates, olive root-binding inner layers, plasma-lime seam accent."],
  ["ashlands", "Ashlands pass: black basalt slab plates, dull-red shadowed inner layers, flat ember-orange fissure accent."],
  ["neoncyber", "Neon-Cyber pass: charcoal enforcement plate, gunmetal collar layers, cyan and magenta circuit-break accents."],
];

const only = process.argv[2];
let fail = 0;
for (const [dim, palette] of DIMS) {
  if (only && dim !== only) continue;
  for (const asset of ASSETS) {
    const master = resolve(MASTERS, `${asset}.png`);
    if (!existsSync(master)) { console.log(`SKIP ${asset}--${dim}: master missing`); fail++; continue; }
    const raw = resolve(OUT, `${asset}--${dim}.png`);
    const dst = resolve(DST, `${asset}--${dim}.png`);
    if (!existsSync(raw)) {
      const code = await runCodexExec({
        label: `seam-mat-${asset}-${dim}`,
        cwd: REPO,
        prompt: `Generate an image: a MATERIAL PASS edit of the attached armored-worm segment card. ${palette}\n\n${SPEC}`,
        images: [master],
        harvestTo: raw,
        stdoutFile: resolve(OUT, `${asset}--${dim}.log`),
      });
      if (!existsSync(raw)) { console.log(`RENDER FAIL ${asset}--${dim} (exit ${code})`); fail++; continue; }
    }
    const { data, info } = await sharp(raw).ensureAlpha().resize(512, 512, { fit: "fill" })
      .raw().toBuffer({ resolveWithObject: true });
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (g > 160 && g > r * 1.6 && g > b * 1.6) data[i + 3] = 0;
      else if (g > r && g > b && g - Math.max(r, b) > 24) data[i + 1] = Math.max(r, b);
    }
    await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toFile(dst);
    console.log(`INSTALLED ${dst}`);
  }
}
console.log(fail ? `DONE with ${fail} failures` : "DONE all installed");
