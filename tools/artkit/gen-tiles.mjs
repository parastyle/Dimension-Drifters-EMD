#!/usr/bin/env node
// artkit/gen-tiles.mjs — generate SEAMLESS, TILEABLE terrain textures for the §17 procedural arena via
// Codex image-gen, then make them perfectly tileable (mirror-fold) + install to the client.
//
//   node tools/artkit/gen-tiles.mjs            # all tiles
//   node tools/artkit/gen-tiles.mjs ground     # just one
//
// Pipeline per tile: Codex paints a quiet top-down texture → sharp resizes to a clean square → a 2×2
// MIRROR FOLD makes opposite edges identical (so it tiles with ZERO seams) → install to public/tiles/.
// Mirror-fold is bullet-proof seamless (no inpainting needed) and, for the deliberately QUIET "Dust &
// The Drop" ground, the symmetry is invisible — the neon VFX is the star, the floor is a stage.
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { configureCodex, runCodexExec } from "./lib/codex.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(here, "../..");
const OUT = resolve(here, "out/tiles");
const PUBLIC = resolve(REPO, "packages/client/public/tiles");
mkdirSync(OUT, { recursive: true });
mkdirSync(PUBLIC, { recursive: true });
configureCodex({ perChatRoot: resolve(here, ".artkit-codex-homes"), log: (m) => console.log(m) });

// The art bible in words — keep the floor a QUIET stage so the neon stays the star (§17/§18 "Dust & The
// Drop"). Even, flat, top-down, low-contrast, NO directional light/shadows/border so a mirror-fold tiles
// invisibly. Palette anchored on the ground bed #2a2620 over the near-black #1a1320 void.
const TILES = {
  ground: {
    px: 1024,
    prompt: `Paint ONE square top-down TEXTURE TILE for a video-game FLOOR: dry Wild-West desert DIRT seen
from directly overhead (orthographic, looking straight DOWN). Color = dark dusty earth, base tone #2a2620
(a very dark warm brown-grey), DESATURATED and LOW-CONTRAST. Subtle, sparse detail only: faint hairline dry
cracks, a few tiny scattered pebbles, soft sand grain, the odd slightly-darker patch. ABSOLUTELY NO large
features, NO big rocks, NO plants/cacti, NO tracks, NO writing. PERFECTLY EVEN FLAT LIGHTING — no shadows,
no highlights, no directional light, no vignette, no border. The detail must be uniform across the whole
square so it reads as endless ground. Fill the ENTIRE square frame edge to edge. This is a quiet background
floor that bright neon effects will be drawn on top of — it must NEVER distract. Muted, dim, almost
monochrome dark earth.`,
  },
};

async function makeSeamless(rawPath, outPath, px) {
  // Square crop/resize the raw gen, then MIRROR-FOLD into a 2× tile whose opposite edges are identical.
  const q = await sharp(rawPath).resize(px, px, { fit: "cover" }).removeAlpha().toBuffer();
  const flop = await sharp(q).flop().toBuffer(); // mirror X
  const flip = await sharp(q).flip().toBuffer(); // mirror Y
  const flipflop = await sharp(q).flip().flop().toBuffer();
  await sharp({ create: { width: px * 2, height: px * 2, channels: 3, background: "#000000" } })
    .composite([
      { input: q, left: 0, top: 0 },
      { input: flop, left: px, top: 0 },
      { input: flip, left: 0, top: px },
      { input: flipflop, left: px, top: px },
    ])
    // JPEG (no alpha needed for a floor) keeps the asset ~20× smaller than PNG; high quality so the
    // mirror-fold edges stay seam-free under block compression.
    .jpeg({ quality: 88, mozjpeg: true })
    .toFile(outPath);
  console.log(`SEAMLESS ${outPath} (${px * 2}×${px * 2}, mirror-fold)`);
}

const only = process.argv[2];
const names = only ? [only] : Object.keys(TILES);

for (const name of names) {
  const def = TILES[name];
  if (!def) {
    console.log(`unknown tile "${name}" — known: ${Object.keys(TILES).join(", ")}`);
    continue;
  }
  const raw = resolve(OUT, `${name}-raw.png`);
  console.log(`\n=== generating tile: ${name} ===`);
  const code = await runCodexExec({
    prompt: def.prompt,
    cwd: REPO,
    label: `tile-${name}`,
    harvestTo: raw,
    stdoutFile: resolve(OUT, `${name}.codex.log`),
  });
  if (code !== 0) {
    console.log(`codex exited ${code} for ${name} — see ${name}.codex.log`);
    continue;
  }
  await makeSeamless(raw, resolve(PUBLIC, `${name}.jpg`), def.px);
}
console.log("\ntiles → packages/client/public/tiles/. Re-run after tweaking a prompt.");
