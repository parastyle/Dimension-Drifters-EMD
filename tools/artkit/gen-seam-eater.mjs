#!/usr/bin/env node
// artkit/gen-seam-eater.mjs — SERRAKETH THE SEAM-EATER segment renders (§53, wormboss-panel).
// Modular source images per docs/wormboss-panel/designer.md: 512×512, #00ff00 chroma field, spine
// horizontal y=256 facing RIGHT, registration collars preserved. MASTERS first, then VARIANTS edited
// from the master reference so silhouette/connectors never drift. RESUMABLE (skips existing raws).
// Installs full-canvas (NO trim — connector registration is canvas-position dependent) to
// packages/client/public/sprites/seam-eater/<asset>.png
//
//   node tools/artkit/gen-seam-eater.mjs [only-asset-id]
import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { configureCodex, runCodexExec } from "./lib/codex.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(here, "../..");
const OUT = resolve(here, "out/seam-eater");
const DST = resolve(REPO, "packages/client/public/sprites/seam-eater");
mkdirSync(OUT, { recursive: true });
mkdirSync(DST, { recursive: true });
configureCodex({ perChatRoot: resolve(here, ".artkit-codex-homes"), log: (m) => console.log(m) });

const IDENTITY = `Serraketh, the Seam-Eater — an original extradimensional armored wyrm built from separate
paper-cutout body cards, with a sideways hinged shear-maw, registration-collar joints, stolen world strata
trapped inside its body chambers, rotating toothed shear organs, and a long stitch-needle tail. Void-charcoal
and gunmetal armor over bone-paper inner layers, one flat rift accent, broad readable shapes, grim HD cel
shading, heavy black contour, no legs, no generic round sandworm mouth, no baked VFX.`;

const SPEC = `RENDER SPEC (strict): 512x512 canvas. Background is a FLAT FULLY OPAQUE pure green #00ff00
field — no floor, shadow, particles, text, UI, or environment. The creature segment's spine runs
HORIZONTALLY through y=256 and the front/head direction is RIGHT. Three-quarter top-down view (show enough
top plane to read armor and cracks; not a pure side profile). HD 2D cel-shaded cutout look, NOT pixel art:
bold simple silhouette, one heavy slightly uneven black outline, flat base + one shadow band + at most one
hard highlight per material. Roughly 5-6 colors total: void-charcoal, gunmetal, bone/off-white paper, one
dimension material color, one rift accent, optional wound dark. No soft gradients, no photoreal texture, no
bloom, no baked glow. Two-ended segments keep front and rear connector centers at the same authored points
with overlapping registration collars. Original and trademark-distinct: do NOT imitate the Terraria
Eater/Destroyer silhouettes, Dune sandworms, or a real centipede.`;

// [id, master-or-null, subject description]
const ASSETS = [
  ["seam-eater-head-armored", null, "Oversized wedge HEAD segment: sideways-hinged upper and lower shear jaws CLOSED around a dark seam, armored brow, one small asymmetric rift eye, rear neck connector collar only (no front connector — this is the front of the creature). Mouth plates fully hide the core. Strong right-facing silhouette."],
  ["seam-eater-head-exposed", "seam-eater-head-armored", "EDIT of the attached armored head master, exact same canvas bounds and rear connector: the sideways shear jaws SPRUNG OPEN around a torn off-white rift core. Do not enlarge total reach; do not move the rear connector."],
  ["seam-eater-head-critical", "seam-eater-head-exposed", "EDIT of the attached exposed head: near-death state — missing brow corner and one large readable crack across the armor. No extra gore or noisy detail; the silhouette difference must read at small game scale."],
  ["seam-eater-neck-armored", null, "Short heavy NECK segment: a compact registration collar with layered locking plates, front and rear connectors at the standard authored points. More armored and compact than a body segment; no weapon teeth."],
  ["seam-eater-neck-cracked", "seam-eater-neck-armored", "EDIT of the attached neck master, exact anchors and silhouette footprint: locking plates shifted apart with one visible inner bone-paper ligament exposed."],
  ["seam-eater-body-intact", null, "Broad BODY segment: a stolen-world chamber with overlapping dorsal armor plates and a visibly softer off-white seam membrane at the center. Front and rear connectors at the standard authored points. The primary weak-point silhouette; less armored than neck or spinner."],
  ["seam-eater-body-wounded", "seam-eater-body-intact", "EDIT of the attached body master, same anchors: one huge decisive diagonal plate crack exposing rift membrane. One clean crack, not noisy damage texture."],
  ["seam-eater-body-regrown", "seam-eater-body-intact", "EDIT of the attached body master, same anchors and collision silhouette: freshly regrown state — paler folded plates with curled paper edge tabs. Reads fresh/unstable without transparency or glow."],
  ["seam-eater-spinner-closed", null, "SPINNER body-ring segment: a thick armored ring around the spine with six blunt shear teeth folded BACKWARD along the body. Teeth stay inside the standard segment collision silhouette while closed. Front and rear connectors at the standard authored points."],
  ["seam-eater-spinner-open", "seam-eater-spinner-closed", "EDIT of the attached spinner master, same connectors: shell petals and the six shear teeth rotated OUTWARD, exposing a bright flat rift bearing at the hub."],
  ["seam-eater-spinner-wounded", "seam-eater-spinner-open", "EDIT of the attached open spinner: two broken teeth and one large crack across the rift bearing. Preserve connector points and outer bounds."],
  ["seam-eater-tail-armored", null, "Tapered TAIL segment ending in a long flat stitch-needle laid along the spine pointing LEFT (rearward). Front connector only at the standard authored point. The needle reach and pivot must be clean enough to match melee geometry."],
  ["seam-eater-tail-exposed", "seam-eater-tail-armored", "EDIT of the attached tail master: the needle guard split open with bone-paper ligament visible. Do NOT paint white glow on the needle — the parry glint is engine VFX."],
  ["seam-eater-stump-front", null, "Small torn FRONT-facing connector cap: covers the headward side of a chain break. Off-white fibrous paper center, dark registration rim. Compact, centered on the standard connector point."],
  ["seam-eater-stump-rear", "seam-eater-stump-front", "Matching REAR-facing connector cap for the tailward side of a break, edited from the attached front cap: must overlap every neck/body/spinner connector cleanly. Mirrored orientation."],
  ["seam-eater-regrowth-bud", null, "REGROWTH BUD: a compact curled strip containing one tiny folded body plate, about to unfurl into a new segment. A targetable object with a strong simple silhouette — not an egg cliche."],
  ["seam-eater-regrowth-bud-wounded", "seam-eater-regrowth-bud", "EDIT of the attached bud master, exact same footprint: partly uncurled and split for a truthful damage state."],
];

const only = process.argv[2];
let fail = 0;
for (const [id, masterId, desc] of ASSETS) {
  if (only && id !== only) continue;
  const raw = resolve(OUT, `${id}.png`);
  const dst = resolve(DST, `${id}.png`);
  if (!existsSync(raw)) {
    const refs = [];
    if (masterId) {
      const m = resolve(OUT, `${masterId}.png`);
      if (!existsSync(m)) { console.log(`SKIP ${id}: master ${masterId} missing`); fail++; continue; }
      refs.push(m);
    }
    const code = await runCodexExec({
      label: `seam-${id}`,
      cwd: REPO,
      prompt: `Generate an image: one MODULAR SEGMENT source card for a video-game boss. ${desc}\n\nCreature identity: ${IDENTITY}\n\n${SPEC}`,
      images: refs,
      harvestTo: raw,
      stdoutFile: resolve(OUT, `${id}.log`),
    });
    if (!existsSync(raw)) { console.log(`RENDER FAIL ${id} (exit ${code})`); fail++; continue; }
  }
  // Chroma-key the green field with despill. NO trim/resize: connector registration is canvas-authored.
  const { data, info } = await sharp(raw).ensureAlpha().resize(512, 512, { fit: "fill" })
    .raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (g > 160 && g > r * 1.6 && g > b * 1.6) data[i + 3] = 0;
    else if (g > r && g > b && g - Math.max(r, b) > 24) data[i + 1] = Math.max(r, b); // edge despill
  }
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toFile(dst);
  console.log(`INSTALLED ${dst}`);
}
console.log(fail ? `DONE with ${fail} failures` : "DONE all installed");
