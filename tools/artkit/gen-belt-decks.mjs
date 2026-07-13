#!/usr/bin/env node
// artkit/gen-belt-decks.mjs — Codex-paint the §37 themed DECK (walkable floor) textures for the belt levels,
// then MIRROR-FOLD horizontally so they tile seamlessly along the belt. Sky-carrier keeps its authored
// deck.png; the four themed levels each get their own floor strip.
//
//   node tools/artkit/gen-belt-decks.mjs                 # all four
//   node tools/artkit/gen-belt-decks.mjs frost-chasm     # just one
//
// Installs to packages/client/public/belt/deck-<levelId>.png (ArenaScene bakes it into the deck trapezoid).
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { configureCodex, runCodexExec } from "./lib/codex.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(here, "../..");
const OUT = resolve(here, "out/belt-decks");
const PUBLIC = resolve(REPO, "packages/client/public/belt");
mkdirSync(OUT, { recursive: true });
mkdirSync(PUBLIC, { recursive: true });
configureCodex({ perChatRoot: resolve(here, ".artkit-codex-homes"), log: (m) => console.log(m) });

// A walkable FLOOR strip seen at the game's shallow ¾ top-down angle. Quiet + even (characters, enemies and
// neon VFX render on top — it must never distract), no large features, even lighting, uniform detail so the
// horizontal mirror-fold reads as endless deck.
const FRAME = `WIDE LANDSCAPE video-game FLOOR texture strip, seen from a slightly elevated top-down ¾ angle
(the camera of a side-scrolling beat-em-up looking at the ground the characters walk on). QUIET, EVEN, and
LOW-CONTRAST — this is a stage floor that characters and bright neon effects are drawn on top of, so NO large
features, NO objects, NO creatures, NO text, NO borders, no strong vignette, PERFECTLY EVEN LIGHTING with no
long shadows. Uniform fine detail across the whole frame so it reads as an endless walkway. Fill the entire
canvas edge to edge.`;

const DECKS = {
  "frost-chasm": {
    prompt: `${FRAME}
Surface: a GLACIAL ICE SHELF floor — dense blue-grey ancient ice with faint frozen strata, hairline cracks,
patches of packed snow and frost scuffs. Palette: dark desaturated glacial blue-grey (#1c2733 undertone),
almost monochrome, dim.`,
  },
  "verdant-ruin": {
    prompt: `${FRAME}
Surface: an ANCIENT STONE walkway swallowed by jungle — big worn flagstones with moss filling the joints,
faint root tendrils creeping across, scattered leaf litter. Palette: dark mossy green-grey (#1b241a
undertone), desaturated, dim.`,
  },
  "neon-undergrid": {
    prompt: `${FRAME}
Surface: a dark CYBER SERVER-FLOOR — matte steel deck plating with subtle panel seams, hex-bolt heads,
faint ventilation grilles, and the SLIGHTEST hint of dim cyan conduit lines along a few seams (very
restrained, not glowing bright). Palette: near-black blue-grey steel (#16161f undertone).`,
  },
  "ashland-forge": {
    prompt: `${FRAME}
Surface: a SCORCHED FOUNDRY floor — heat-darkened basalt and iron plates, soot stains, faint hairline
ember-orange cracks between a few plates (dim, not bright lava), scattered ash drifts. Palette: dark
charcoal-rust (#191210 undertone), dim.`,
  },
};

// Final strip: 2048 wide (a 1024 gen mirror-folded in X so it tiles horizontally), 1024 tall (the projected
// deck band is ~650 screen px, so no vertical tiling is ever needed).
const GEN = 1024;

async function foldX(rawPath, outPath) {
  const q = await sharp(rawPath).resize(GEN, GEN, { fit: "cover" }).removeAlpha().toBuffer();
  const flop = await sharp(q).flop().toBuffer(); // mirror X → left/right edges of the pair are identical
  await sharp({ create: { width: GEN * 2, height: GEN, channels: 3, background: "#000" } })
    .composite([
      { input: q, left: 0, top: 0 },
      { input: flop, left: GEN, top: 0 },
    ])
    .png({ compressionLevel: 9 })
    .toFile(outPath);
  console.log(`SEAMLESS-X ${outPath} (${GEN * 2}×${GEN})`);
}

const only = process.argv[2];
const names = only ? [only] : Object.keys(DECKS);

const results = await Promise.all(
  names.map(async (name) => {
    const def = DECKS[name];
    if (!def) {
      console.log(`unknown level "${name}" — known: ${Object.keys(DECKS).join(", ")}`);
      return { name, ok: false };
    }
    const raw = resolve(OUT, `${name}-raw.png`);
    console.log(`=== generating deck: ${name} ===`);
    const code = await runCodexExec({
      prompt: def.prompt,
      cwd: REPO,
      label: `belt-deck-${name}`,
      harvestTo: raw,
      stdoutFile: resolve(OUT, `${name}.codex.log`),
    });
    if (code !== 0) {
      console.log(`codex exited ${code} for ${name} — see ${name}.codex.log`);
      return { name, ok: false };
    }
    await foldX(raw, resolve(PUBLIC, `deck-${name}.png`));
    return { name, ok: true };
  }),
);
console.log(`\ndecks done — ${results.filter((r) => r.ok).length}/${names.length} installed to public/belt/`);
