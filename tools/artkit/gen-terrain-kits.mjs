#!/usr/bin/env node
// artkit/gen-terrain-kits.mjs — CODEX FINAL RUN P0.1: painted TERRAIN KITS for the top-down arenas (the
// PRIMARY mode has exactly one painted floor tile today — everything under every fight is vector fill).
// Per dimension: 4 seamless ground tiles + 1 pit-rim strip, plus one 16:9 menu KEY-ART frame (P0.5).
// Direct renders (no chroma): tiles install to public/tiles/<dim>/, rims to public/tiles/<dim>/rim.png,
// key-art to public/ui/menu/<dim>.jpg. RESUMABLE: skips any render whose raw already exists in out/.
//
//   node tools/artkit/gen-terrain-kits.mjs                # everything
//   node tools/artkit/gen-terrain-kits.mjs frostfell      # one dimension
//   node tools/artkit/gen-terrain-kits.mjs ashlands --terrain-only
import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { configureCodex, runCodexExec } from "./lib/codex.mjs";
import {
  normalizeCelRim,
  normalizeCelTileValues,
  normalizeRim,
  normalizeTileFamily,
} from "./lib/map-art-processing.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(here, "../..");
const OUT = resolve(here, "out/terrain");
const TILES = resolve(REPO, "packages/client/public/tiles");
const MENU = resolve(REPO, "packages/client/public/ui/menu");
mkdirSync(OUT, { recursive: true });
configureCodex({ perChatRoot: resolve(here, ".artkit-codex-homes"), log: (m) => console.log(m) });

// Shared cel-shaded framing. Floors remain deliberately orthographic because mapgen is a square grid;
// parity with the tunnel comes from treatment, value structure, ink, and one NW key.
const TILE_FRAME = `Paint ONE SQUARE 512x512 image: a TOP-DOWN ORTHOGRAPHIC GROUND TEXTURE for a 2D action
game floor, viewed from directly overhead with ZERO perspective, ZERO foreshortening, and ZERO isometric
skew. Render clean cel-shaded comic environment art: 4-6 FLAT colour planes with hard boundaries plus dark
theme-tinted ink and one restrained accent. NO photographic texture, NO airbrush, NO noise, NO grain, NO
painterly blending, NO soft transitions, and NO gradients.
Draw every material boundary deliberately: 3-4px ink for major joints and 2px ink for minor joints, with no
line thicker than 4px. Give floor-level material joints a 3px light chamfer on their north/top and west/left
edges and a 3px dark chamfer on their south/bottom and east/right edges. Implied relief is no deeper than
4px. One key light comes from the north-west and is expressed ONLY by those flat chamfer planes. NO baked
cast shadow, contact shadow, ambient occlusion, vignette, glow, bloom, reflection, or lighting falloff.
Use a compressed mid-value palette: overall alpha-weighted greyscale mean 70-125, with EVERY pixel,
including ink, chamfers, antialiasing, and accent, held within 18 value points of the mean. There are no
near-black floor pixels and no pale highlights; reserve pure black for entity outlines. The floor must be
lighter than structures and entity-black outlines. Accent covers at most 8% of the image and is point-like
or areal, never a hot continuous line.
It must be SEAMLESSLY TILEABLE TOROIDALLY: left continues right and top continues bottom. Keep luminance,
chroma, and material uniform through the outer 10% on all four sides. No feature may enter that band unless
it continues through the exact opposite edge. NO border, frame, gutter, corner darkening, or edge fade.
The base is PRISTINE and REPEATABLE. No unique scuff, stain, scratch, crack-with-personality, squiggle,
footprint, arrow, directional mark, or memorable feature: this 512px image repeats about 90 times on screen.
No feature wider than 140px. No object, creature, text, debris, obstacle, hazard, pit, hole, ledge, doorway,
circular marking, ring, or bright linear marking.`;
const RIM_FRAME = `Paint ONE 1024x256 image: a horizontal TOP-DOWN CLIFF RIM strip in clean cel-shaded comic
environment art, where solid ground ends and a pit wall drops into darkness.
COMPOSITION IS EXACT: y=0-127 is the ground surface. A straight, unbroken 5-6px dark theme-tinted ink lip
line is centred at EXACTLY y=128 and runs the full width. y=128-255 is a VERTICAL wall face of one consistent
128px slab thickness, not a receding slope. The ground/void split must not wander above or below y=128.
Render 4-6 flat colour planes with hard boundaries and deliberate drawn ink: 2-3px internal wall divisions,
5-6px only for the death-boundary lip. NO photographic texture, NO airbrush, NO noise, NO grain, NO painterly
blending, NO soft gradient, NO glow, and NO bloom. One key comes from the north-west. NO cast shadow, contact
shadow, baked ambient occlusion, vignette, or lighting falloff.
Ground y=0-127 uses the tile-3 material at greyscale value 70-110, stepping to about 60 beside the lip. Wall
face y=128-223 uses discrete flat planes at value 30-60. The bottom void band y=224-255 is value 25 or darker.
Use hard plane changes, never a gradient. Add only small blocky overhangs and square broken teeth.
The strip is TILEABLE HORIZONTALLY: left and right material, lip height, wall depth, and value continue at
identical heights. No crack, root, cable, vine, tooth, or overhang may begin or end in the outer 10%. The top
72px uses HORIZONTAL LINEWORK ONLY, with no diagonals or vertical elements, because the renderer also crops
and vertically squashes that band for side edges.
NO hot accent or glow along the lip because the engine draws the authoritative hazard rail there. No object,
creature, text, debris, border, or frame.`;
const KEY_FRAME = `WIDE 16:9 LANDSCAPE painting: a dramatic ESTABLISHING VISTA for a video-game level-select
card. Painterly, HD cel-shaded accents, thick value structure, one clear focal landmark, moody controlled
palette with a few glow accents. NO people, NO creatures, NO text, NO logos, NO UI, NO border. Fill the
entire canvas edge to edge.`;

/** Per-dimension art direction: [ground palette/material], the 4 tile variants, the rim, the vista. */
const DIMS = {
  "wild-west": {
    edgeBase: 0,
    ground: "sun-bleached desert hardpan: dusty tan and pale ochre packed earth",
    tiles: [
      "fine dry dust with faint wind ripples",
      "cracked sun-baked clay, hairline crack web",
      "packed earth with sparse tiny pebbles and pale grass wisps",
      "wind-swept sand drift streaks over hardpan",
    ],
    rim: "dry desert mesa edge: crumbling ochre earth and sandstone lip over a dark drop",
    vista: `WILD WEST FRONTIER at golden hour — a lone mesa town silhouette, red-rock buttes, telegraph
poles marching into heat haze, a huge amber sky. Palette: dusty tan, rust, bone, deep amber.`,
  },
  frostfell: {
    edgeBase: 1,
    ground: "ancient glacial ice and wind-packed snow: pale blue-white with deep blue undertones",
    tiles: [
      "wind-packed snow with faint sastrugi ridges",
      "bare glacial ice, cloudy depth and faint trapped-bubble veins",
      "snow dusted over cracked blue ice plates",
      "hoarfrost crystals feathering across dark ice",
    ],
    rim: "glacier crevasse lip: fractured blue ice shelf edge with snow overhang over an abyssal blue-black drop",
    vista: `FROSTFELL DESCENT — a colossal glacier crevasse yawning under a thin arctic sky, blue ice walls,
frozen waterfalls, drifting ice-mist. Palette: glacial blue, cyan, near-black shadow, pale sky glow.`,
  },
  "verdant-ruins": {
    edgeBase: 0,
    ground: "overgrown ancient stonework: moss-swallowed flagstones in deep greens over grey stone",
    tiles: [
      "moss carpet with faint flagstone seams ghosting through",
      "cracked grey flagstones, moss filling every joint",
      "leaf-litter and clover scattered over dark loam",
      "worn stone with creeping ivy tendrils and lichen spots",
    ],
    rim: "ruin terrace edge: broken mossy flagstone lip with hanging roots and vines over a dark green drop",
    vista: `VERDANT RUINS — a vine-strangled temple city reclaimed by jungle canopy, shafts of green-gold
light, colossal mossy statues half-sunk in foliage. Palette: deep greens, grey stone, gold light.`,
  },
  ashlands: {
    edgeBase: 0,
    valueMeans: [92, 102, 94, 94],
    valueSpread: 9.5,
    normalizeCelRim: true,
    ground: `a lit volcanic ash-grey field in one material family. Palette targets: warm ash-grey base
#665E5A, lighter basalt/chamfer #746A64, mid basalt #6B605B, shadow plane #5A504B, dark warm ink #554A45,
and restrained dull ember #A4572D. Keep every floor pixel between greyscale values 76 and 110 so the exact
min/max remain within +/-18 of a mean near 93. Never use pure black on the floor`,
    tiles: [
      `COMMONS BED / quiet bed: packed grey ash over broad cooled basalt plates. Use the largest, plainest
material units and the fewest joints in the family. Quiet and intentionally boring, internal variation
within +/-12. No wind ripple, mottling, scuff, crack, or distinctive mark`,
      `ROUTE / worn route: the same broad basalt plates and identical palette/history family, compacted by
traffic. Ash is evenly swept back so more smooth plate face is exposed and joints are partly filled.
Shift the mean +8 to +12 lighter than the commons bed. No footprint, arrow, stripe, or directional mark`,
      `DISTURBED CLUSTER: the same ash-covered basalt family disturbed into more numerous material units.
Introduce short anonymous GREY ropey cooled-lava bands and a secondary cinder-crust mosaic between plates.
Distribute both evenly; no isolated blob, island, focal patch, dense pebble field, ember, or orange anywhere.
Richest joint rhythm in the family but still pristine, low-relief, non-object-like, and without a hero feature`,
      `PIT APPROACH / failing ground: the same basalt is fractured into smaller flat plates, with wider
dark warm-ink fissures and sparse dull ember-orange point specks deep in a few gaps. Ember occupies under
4% of area and never forms a continuous line. This must read as structurally disturbed ground at a glance
without depicting a pit, hole, ledge, obstacle, hazard marking, or unique crack`,
    ],
    rim: `a cracked basalt shelf matching ashlands tile-3: ash-dusted warm grey ground band and blocky
columnar-basalt wall planes falling to a near-black void. No ember glow anywhere on the lip. Use warm
ground colours #665E5A/#746A64/#5A504B above y=128, wall planes #3B3230/#302827/#251F20 below it, and
void #171416 only in the bottom band`,
    vista: `THE ASHLANDS — a smoldering volcanic waste under an ash-choked sky, a distant erupting caldera,
rivers of dull ember light through black rock. Palette: charcoal, soot grey, ember orange, blood red glow.`,
  },
  "neon-cyber": {
    edgeBase: 0,
    ground: "megacity rooftop industrial plating: dark gunmetal deck panels with faint grime and paint wear",
    tiles: [
      "brushed gunmetal deck plates with hairline panel seams",
      "worn hazard-painted plating, chevrons scuffed almost away",
      "grated vent panels inset in dark alloy, faint cyan underglow",
      "rain-slick composite tiles with subtle neon reflections",
    ],
    rim: "rooftop deck edge: sheared alloy plating lip with exposed struts and cabling over a neon-lit urban abyss",
    vista: `NEON UNDERGRID — a rain-slick cyberpunk megacity canyon at night, stacked holo-signs, mag-lev
lines, one colossal tower crowned in cyan light. Palette: near-black blues, magenta and cyan neon.`,
  },
};

const args = process.argv.slice(2);
const only = args.find((arg) => !arg.startsWith("--"));
const terrainOnly = args.includes("--terrain-only");
const unknownFlags = args.filter((arg) => arg.startsWith("--") && arg !== "--terrain-only");
if (unknownFlags.length) throw new Error(`unknown option(s): ${unknownFlags.join(", ")}`);
const jobs = [];
for (const [dim, d] of Object.entries(DIMS)) {
  if (only && dim !== only) continue;
  const rawDir = resolve(OUT, dim);
  const pubDir = resolve(TILES, dim);
  mkdirSync(rawDir, { recursive: true });
  mkdirSync(pubDir, { recursive: true });
  d.tiles.forEach((variant, i) => {
    jobs.push({
      label: `tile-${dim}-${i}`,
      raw: resolve(rawDir, `tile-${i}.png`),
      prompt: `${TILE_FRAME}\nMaterial: ${d.ground}. This tile's variation: ${variant}.`,
      install: async (raw) => {
        await sharp(raw).resize(512, 512, { fit: "cover" }).png().toFile(resolve(pubDir, `tile-${i}.png`));
      },
    });
  });
  jobs.push({
    label: `rim-${dim}`,
    raw: resolve(rawDir, "rim.png"),
    prompt: `${RIM_FRAME}\nThis rim: ${d.rim}.`,
    install: async (raw) => {
      const height = d.normalizeCelRim ? 512 : 256;
      await sharp(raw).resize(1024, height, { fit: "fill" }).png().toFile(resolve(pubDir, "rim.png"));
    },
  });
  if (!terrainOnly) {
    jobs.push({
      label: `keyart-${dim}`,
      raw: resolve(rawDir, "keyart.png"),
      prompt: `${KEY_FRAME}\nScene: ${d.vista}`,
      install: async (raw) => {
        mkdirSync(MENU, { recursive: true });
        await sharp(raw).resize(1200, 675, { fit: "cover" }).jpeg({ quality: 88 }).toFile(resolve(MENU, `${dim}.jpg`));
      },
    });
  }
}

// Concurrency 4 — the render is the bottleneck, the installs are instant. Resumable: existing raws skip.
const CONC = 4;
let done = 0;
let skipped = 0;
async function worker(queue) {
  for (;;) {
    const job = queue.shift();
    if (!job) return;
    if (existsSync(job.raw)) {
      skipped++;
      await job.install(job.raw).catch((e) => console.log(`INSTALL FAIL ${job.label}: ${e.message}`));
      continue;
    }
    await runCodexExec({ label: job.label, cwd: REPO, prompt: job.prompt, harvestTo: job.raw });
    if (existsSync(job.raw)) {
      await job.install(job.raw).catch((e) => console.log(`INSTALL FAIL ${job.label}: ${e.message}`));
      done++;
      console.log(`✓ ${job.label} (${done + skipped}/${jobs.length})`);
    } else {
      console.log(`✗ ${job.label} — no image harvested (re-run to retry)`);
    }
  }
}
const queue = [...jobs];
await Promise.all(Array.from({ length: CONC }, () => worker(queue)));
for (const [dim, d] of Object.entries(DIMS)) {
  if (only && dim !== only) continue;
  const pubDir = resolve(TILES, dim);
  const tileFiles = [0, 1, 2, 3].map((index) => resolve(pubDir, `tile-${index}.png`));
  const rimFile = resolve(pubDir, "rim.png");
  if (tileFiles.every(existsSync)) {
    if (d.valueMeans) {
      await normalizeCelTileValues({
        files: tileFiles,
        targetMeans: d.valueMeans,
        maxSpread: d.valueSpread,
      });
    }
    await normalizeTileFamily({ files: tileFiles, baseFile: tileFiles[d.edgeBase], strip: 32 });
    console.log(`NORMALIZED ${dim} tile family from quiet tile-${d.edgeBase}`);
  }
  if (existsSync(rimFile)) {
    if (d.normalizeCelRim) await normalizeCelRim(rimFile);
    await normalizeRim(rimFile, 32);
    console.log(`NORMALIZED ${dim} rim`);
  }
}
console.log(`terrain kits: ${done} rendered, ${skipped} already present, ${jobs.length} total jobs`);
