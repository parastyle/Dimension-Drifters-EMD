#!/usr/bin/env node
// artkit/gen-terrain-kits.mjs — CODEX FINAL RUN P0.1: painted TERRAIN KITS for the top-down arenas (the
// PRIMARY mode has exactly one painted floor tile today — everything under every fight is vector fill).
// Per dimension: 4 seamless ground tiles + 1 pit-rim strip, plus one 16:9 menu KEY-ART frame (P0.5).
// Direct renders (no chroma): tiles install to public/tiles/<dim>/, rims to public/tiles/<dim>/rim.png,
// key-art to public/ui/menu/<dim>.jpg. RESUMABLE: skips any render whose raw already exists in out/.
//
//   node tools/artkit/gen-terrain-kits.mjs                # everything
//   node tools/artkit/gen-terrain-kits.mjs frostfell      # one dimension
import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { configureCodex, runCodexExec } from "./lib/codex.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(here, "../..");
const OUT = resolve(here, "out/terrain");
const TILES = resolve(REPO, "packages/client/public/tiles");
const MENU = resolve(REPO, "packages/client/public/ui/menu");
mkdirSync(OUT, { recursive: true });
configureCodex({ perChatRoot: resolve(here, ".artkit-codex-homes"), log: (m) => console.log(m) });

// Shared tile framing: the floor must stay QUIET — entities, VFX, and telegraphs render on top of it.
const TILE_FRAME = `Paint ONE SQUARE image: a TOP-DOWN orthographic GROUND TEXTURE for a video game floor,
viewed from directly overhead. It must be SEAMLESSLY TILEABLE — the left edge continues the right edge and
the top continues the bottom, with NO visible seams, NO vignette, NO lighting gradient, NO border. LOW
CONTRAST and MUTED so characters and effects read clearly on top: no strong shapes, no objects, no creatures,
no text, no shadows from off-screen. Subtle natural variation only, edge to edge.`;
const RIM_FRAME = `Paint ONE WIDE image (roughly 4:1): a horizontal TOP-DOWN strip of a CLIFF RIM — the lip
where solid ground breaks off into a pit below. The TOP HALF is the ground surface meeting the edge; the
BOTTOM HALF falls into darkness. Crisp broken edge with small overhangs and debris, TILEABLE horizontally
(left edge continues right edge). Muted palette, no objects, no creatures, no text, no border.`;
const KEY_FRAME = `WIDE 16:9 LANDSCAPE painting: a dramatic ESTABLISHING VISTA for a video-game level-select
card. Painterly, HD cel-shaded accents, thick value structure, one clear focal landmark, moody controlled
palette with a few glow accents. NO people, NO creatures, NO text, NO logos, NO UI, NO border. Fill the
entire canvas edge to edge.`;

/** Per-dimension art direction: [ground palette/material], the 4 tile variants, the rim, the vista. */
const DIMS = {
  "wild-west": {
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
    ground: "volcanic ashfield: charcoal-grey ash over cooled black lava crust with dying ember veins",
    tiles: [
      "fine grey ash with faint wind ripples and soot mottling",
      "cooled ropey lava crust, matte black with hairline ember cracks",
      "ash-dusted basalt plates with dull orange crack glow",
      "cinder gravel and slag chips on packed ash",
    ],
    rim: "lava-field shelf edge: cracked black basalt lip with ember glow seeping from the fracture over a dark drop",
    vista: `THE ASHLANDS — a smoldering volcanic waste under an ash-choked sky, a distant erupting caldera,
rivers of dull ember light through black rock. Palette: charcoal, soot grey, ember orange, blood red glow.`,
  },
  "neon-cyber": {
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

const only = process.argv[2];
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
      await sharp(raw).resize(1024, 256, { fit: "cover" }).png().toFile(resolve(pubDir, "rim.png"));
    },
  });
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
console.log(`terrain kits: ${done} rendered, ${skipped} already present, ${jobs.length} total jobs`);
