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
configureCodex({ perChatRoot: resolve(here, ".artkit-codex-homes"), log: (m) => console.log(m) });

const WORK = 1536; // resize the gen to this before labeling (speed); props export much smaller
const MIN_AREA = 2500; // ignore alpha islands smaller than this (chroma fringe / shadow fragments)
const ALPHA = 40; // a pixel counts as "prop" above this alpha

// Each PACK is one Codex call → a whole set of cut-out props. `--pack=<name>` (default decals).
const PACKS = {
  // §17 P4 ground LITTER — small flat top-down props strewn on the floor (cosmetic).
  decals: {
    out: resolve(here, "out/decals"),
    public: resolve(REPO, "packages/client/public/decals"),
    manifest: resolve(REPO, "packages/client/src/sprites/decal-manifest.ts"),
    manifestConst: "DECAL_IDS",
    idPrefix: "decal",
    max: 132,
    keep: 11,
    prompt: `Paint ONE wide image: a SPREAD of about NINE distinct TOP-DOWN Wild-West GROUND PROPS, viewed
from DIRECTLY OVERHEAD (orthographic, looking straight down), arranged loosely across the frame with GENEROUS
EMPTY SPACE between them — every prop a SEPARATE island that does NOT touch any other prop and does NOT touch
the frame edge. Props (one each, varied sizes): a weathered grey boulder; a small cluster of pebbles; a dead
dry scrub bush (brown/olive); a tumbleweed; a bleached cattle SKULL; a little pile of bones; a stubby barrel
CACTUS (muted green); a flat cracked rock slab; a broken wooden wagon wheel. Style: HD cel-shaded, thick dark
outlines, MUTED desaturated Wild-West palette (dusty tan/rust/olive/bone/grey), each prop with a small SOFT
dark contact shadow directly under it. EVEN flat top-down lighting, no long cast shadows. The ENTIRE
background is a FLAT PURE CHROMA GREEN #00ff00 (RGB 0,255,0) with NOTHING else on it — no ground, no texture,
no gradient. Each prop must be fully painted + fully inside the frame, well separated, so they can be cut out
individually.`,
  },
  // §17 P4 POI LANDMARKS — big standing structures placed in the map as cover/orientation. Drawn at a
  // high 3/4 angle (like the §17 side-profile characters) so they read as tall objects in a top-down world.
  pois: {
    out: resolve(here, "out/pois"),
    public: resolve(REPO, "packages/client/public/pois"),
    manifest: resolve(REPO, "packages/client/src/sprites/poi-manifest.ts"),
    manifestConst: "POI_IDS",
    idPrefix: "poi",
    max: 280,
    keep: 7,
    prompt: `Paint ONE wide image: about SIX distinct Wild-West LANDMARK STRUCTURES, each a SEPARATE island
with GENEROUS empty space between them — none touching another or the frame edge. Draw each at a HIGH 3/4
ANGLE (as if standing in a top-down world, seen from above-and-slightly-in-front), with its BASE at the
bottom of the object and the structure rising UP — the same staging as the game's side-profile characters.
Structures (one each): a wooden OIL DERRICK; a farm WINDMILL with a bladed wheel; a tall dead leafless TREE;
a crumbling ADOBE wall ruin; a wooden WATER TOWER on legs; a jagged tall RED-ROCK spire. Style: HD cel-shaded,
thick dark outlines, MUTED desaturated Wild-West palette (weathered wood brown, rust, adobe tan, bleached
grey, red rock), each with a small SOFT dark contact shadow at its base. The ENTIRE background is a FLAT PURE
CHROMA GREEN #00ff00 (RGB 0,255,0) with NOTHING else — no ground, no sky, no gradient. Each landmark fully
painted + fully inside the frame, well separated, so they can be cut out individually.`,
  },
};

// §47 CODEX FINAL RUN P0.2 — THEMED packs per dimension (the original two packs above are wild-west).
// Same machinery: one render, chroma-key, island-extract. Style line shared so every dim reads as one game.
const STYLE = `Style: HD cel-shaded, thick dark outlines, MUTED desaturated palette, each prop with a small
SOFT dark contact shadow. EVEN flat lighting, no long cast shadows. The ENTIRE background is a FLAT PURE
CHROMA GREEN #00ff00 (RGB 0,255,0) with NOTHING else — no ground, no texture, no gradient. Every prop fully
painted, fully inside the frame, well separated so each can be cut out individually.`;
const themedDecals = (dim, list) => ({
  out: resolve(here, `out/decals-${dim}`),
  public: resolve(REPO, `packages/client/public/decals/${dim}`),
  manifest: resolve(REPO, `packages/client/src/sprites/decal-manifest-${dim}.ts`),
  manifestConst: `DECAL_IDS_${dim.replace(/-/g, "_").toUpperCase()}`,
  idPrefix: `decal-${dim}`,
  max: 132,
  keep: 11,
  prompt: `Paint ONE wide image: a SPREAD of about NINE distinct TOP-DOWN GROUND PROPS viewed from DIRECTLY
OVERHEAD (orthographic), arranged loosely with GENEROUS EMPTY SPACE between them — every prop a SEPARATE
island that does NOT touch any other prop or the frame edge. Props (one each, varied sizes): ${list}.
${STYLE}`,
});
const themedPois = (dim, list) => ({
  out: resolve(here, `out/pois-${dim}`),
  public: resolve(REPO, `packages/client/public/pois/${dim}`),
  manifest: resolve(REPO, `packages/client/src/sprites/poi-manifest-${dim}.ts`),
  manifestConst: `POI_IDS_${dim.replace(/-/g, "_").toUpperCase()}`,
  idPrefix: `poi-${dim}`,
  max: 280,
  keep: 7,
  prompt: `Paint ONE wide image: about SIX distinct LANDMARK STRUCTURES, each a SEPARATE island with GENEROUS
empty space between them — none touching another or the frame edge. Draw each at a HIGH 3/4 ANGLE (standing
in a top-down world, seen from above-and-slightly-in-front), base at the bottom, rising UP. Structures (one
each): ${list}. ${STYLE}`,
});
PACKS["decals-frostfell"] = themedDecals(
  "frostfell",
  `a jagged blue ICE SHARD cluster; a snow-drift mound; a frozen-over small pond slick; a cracked ice plate;
a frost-rimed dead shrub; scattered hail stones; a fallen icicle spear; a snow-buried stone; a pale frozen
bone pile`,
);
PACKS["pois-frostfell"] = themedPois(
  "frostfell",
  `a towering blue GLACIER SPUR; a frozen WATERFALL column; an ancient ice-encased STANDING STONE; a snow-
crushed wooden watchtower ruin; a colossal frost-heaved BOULDER; a leaning frozen PINE`,
);
PACKS["decals-verdant-ruins"] = themedDecals(
  "verdant-ruins",
  `a moss-swallowed fallen COLUMN drum; a cracked stone tablet with worn glyphs; a fern clump; a glowing
green SPORE mushroom cluster; a coiled root knot; scattered temple rubble; a shallow leaf-choked puddle;
a broken statue HAND; a flowering vine tangle`,
);
PACKS["pois-verdant-ruins"] = themedPois(
  "verdant-ruins",
  `a vine-strangled broken TEMPLE ARCH; a colossal mossy STATUE HEAD sunk to the chin; a crumbling stone
STELE; a strangler-fig tree devouring a wall; a collapsed pillar leaning on its base; an overgrown fountain`,
);
PACKS["decals-ashlands"] = themedDecals(
  "ashlands",
  `a cooled ropey LAVA coil; an ember-cracked basalt slab; a charred tree stump; a sulfur-yellow crust
patch; a slag heap; scattered obsidian shards; a smoldering ash pile with faint ember glow; a blackened
ribcage; a heat-split boulder`,
);
PACKS["pois-ashlands"] = themedPois(
  "ashlands",
  `a jagged OBSIDIAN spire; a dormant fumarole CONE venting thin smoke; a charred dead TREE claw; a basalt
column cluster (giant's-causeway style); a half-melted iron mining rig ruin; a cracked lava-rock arch`,
);
PACKS["decals-neon-cyber"] = themedDecals(
  "neon-cyber",
  `a burst steam VENT grate; a tangle of severed glowing CABLES; a shattered holo-sign panel face-up on the
ground; an oil slick with faint neon sheen; a knocked-over traffic drone husk; scattered circuit debris; a
glowing paint-tag GLYPH; a crushed vending crate; a manhole cover ajar with cyan underglow`,
);
PACKS["pois-neon-cyber"] = themedPois(
  "neon-cyber",
  `a rooftop HOLO-BILLBOARD tower (flickering magenta); an industrial AC/vent STACK cluster; a rusted
water-tank on struts wrapped in cabling; a satellite-dish array mast; a neon SHRINE kiosk; a collapsed
crane arm`,
);

// §48 BESPOKE WEAPON-FX COMPONENT PACKS — one render per effect, every component a SEPARATE island so
// each piece (core, ring, SHRAPNEL shards, debris) cuts out individually and can be animated on its own
// timeline later. Painted on chroma green like everything else; additive-friendly (hot cores, glows).
const FX_STYLE = `Style: HD painted game VFX, crisp silhouettes, hot luminous cores with controlled glow,
thick value structure. EVERY component is a SEPARATE island with GENEROUS empty space — nothing touches
anything else or the frame edge. The ENTIRE background is FLAT PURE CHROMA GREEN #00ff00 with NOTHING else.
No text, no border, no characters. Each component fully painted and fully inside the frame.`;
const fxPack = (name, keep, list) => ({
  out: resolve(here, `out/fx-${name}`),
  public: resolve(REPO, `packages/client/public/vfx/packs/${name}`),
  manifest: resolve(REPO, `packages/client/src/vfx/fx-pack-${name}.ts`),
  manifestConst: `FX_${name.replace(/-/g, "_").toUpperCase()}`,
  idPrefix: `fx-${name}`,
  max: 220,
  keep,
  prompt: `Paint ONE wide image: the SEPARATED COMPONENTS of a video-game "${name}" effect, laid out like a
sprite-sheet exploded view. Components (each its OWN island): ${list}. ${FX_STYLE}`,
});
PACKS["fx-nuke"] = fxPack("nuke", 11, `a blinding white-hot detonation CORE flash; a small rising MUSHROOM
CLOUD (early, tight column); a large fully-bloomed MUSHROOM CLOUD with fire underlighting; an expanding
white SHOCKWAVE RING seen top-down; a scorched black ground DISC with ember cracks; a curved DUST WALL arc;
FOUR separate tumbling burnt DEBRIS chunks of different sizes; one drifting ash-smoke puff`);
PACKS["fx-lightning-ball"] = fxPack("lightning-ball", 11, `a crackling plasma BALL core (white-cyan);
a hollow electric SHOCK RING; THREE separate jagged ARC FILAMENTS of different lengths; SIX separate small
electric SHRAPNEL sparks/shards flying (distinct shapes, clearly separated for individual animation);
one fading afterglow wisp`);
PACKS["fx-frost-nova"] = fxPack("frost-nova", 12, `a bursting ICE CORE (pale blue starburst); an expanding
frost RING; SIX separate flying ICE SHARD shrapnel pieces of varied sizes; a ground FROST PATCH disc with
crystalline edge; two drifting snow-mist puffs`);
PACKS["fx-void-implosion"] = fxPack("void-implosion", 10, `a collapsing VOID CORE (black sphere rimmed in
violet); an INVERTED ring pulling inward (visible directionality); FIVE separate obsidian-purple SHARD
fragments; two thin void TENDRIL wisps; a faint distortion halo`);
PACKS["fx-holy-smite"] = fxPack("holy-smite", 10, `a vertical PILLAR OF LIGHT segment (top-fading);
a golden HALO ring; FOUR separate radiant gold SHARD slivers; three floating light MOTES; one soft feather`);
PACKS["fx-toxic-burst"] = fxPack("toxic-burst", 11, `a bursting GAS CLOUD core (sickly green); two smaller
separate gas puffs; FIVE separate flying GOO GLOB shrapnel drops with trails; a bubbling ground POOL disc;
a small bubble cluster`);
PACKS["fx-ember-eruption"] = fxPack("ember-eruption", 11, `an erupting MAGMA CORE burst; THREE separate
arcing LAVA GOUT tongues; FIVE separate glowing EMBER CHUNK shrapnel rocks; a rising dark smoke column puff;
a cracked ground GLOW disc`);
PACKS["fx-storm-call"] = fxPack("storm-call", 10, `a dark STORM CLOUD puff (anvil-shaped, underlit);
THREE separate jagged LIGHTNING BOLTS of different shapes (thick trunk to fine tip); a rain STREAK sheet
patch; two wind SWIRL wisps; one distant flash glow`);
PACKS["fx-buzzsaw-wake"] = fxPack("buzzsaw-wake", 10, `a circular spinning BLADE BLUR disc (motion-streaked
rim); FOUR separate hot friction SPARK bursts; THREE separate torn ragged METAL SHARD pieces; a thin cut
LINE streak; one small smoke wisp`);
PACKS["fx-tide-crash"] = fxPack("tide-crash", 10, `a crashing WAVE CROWN splash (crown-shaped water burst);
an expanding foam RING; FIVE separate flying water DROPLET globs with trails; a wet ground SLICK disc;
one mist puff`);
PACKS["fx-quake-burst"] = fxPack("quake-burst", 10, `an upheaved ROCK SLAB cluster core; FOUR separate
tumbling STONE CHUNK shrapnel pieces; a radial ground CRACK STAR (top-down); an expanding dust RING;
one dust plume puff`);
PACKS["fx-grave-call"] = fxPack("grave-call", 10, `an eerie teal SOUL FLAME core; a ghostly expanding
RING; FOUR separate flying BONE SHARD pieces; two drifting spirit WISP trails; a small tombstone-crack
ground patch`);

// §48 UI ICON + EMOTE packs (P2.3/P3.5) — small glyphs, same island extraction.
const ICON_STYLE = `Style: crisp HD game UI ICONS, bold readable silhouettes at small sizes, thick dark
outlines, subtle inner glow, consistent visual weight across all icons. Each icon a SEPARATE island with
generous spacing, none touching each other or the frame. ENTIRE background FLAT PURE CHROMA GREEN #00ff00.
No text, no numbers, no border.`;
const iconPack = (name, keep, list) => ({
  out: resolve(here, `out/icons-${name}`),
  public: resolve(REPO, `packages/client/public/ui/icons/${name}`),
  manifest: resolve(REPO, `packages/client/src/sprites/icon-manifest-${name}.ts`),
  manifestConst: `ICONS_${name.replace(/-/g, "_").toUpperCase()}`,
  idPrefix: `icon-${name}`,
  max: 90,
  keep,
  prompt: `Paint ONE wide image: a SET of distinct video-game UI ICONS, exploded-view layout. Icons (one
each): ${list}. ${ICON_STYLE}`,
});
PACKS["icons-stats"] = iconPack("stats", 10, `a flexing ARM (strength); a winged BOOT (dexterity); an
arcane EYE (intelligence); a stout SHIELD-HEART (constitution); a four-leaf CLOVER die (luck); a plain
LEVEL-UP chevron burst; a small XP crystal; a heart (health); a lightning charge (stamina); a skull (danger)`);
PACKS["icons-classes"] = iconPack("classes", 9, `crossed SWORDS (melee class); a long RIFLE (ranged class);
a glowing STAFF-ORB (caster class); a coin stack (scrip currency); a gear-wrench (salvage); an open HAND
(grab); a downward arrow into a slot (drop); two curved arrows in a circle (swap); a padlock (locked)`);
PACKS["icons-rarity"] = iconPack("rarity", 8, `SIX faceted GEMSTONES of identical cut but escalating
splendor: plain grey stone, green peridot, blue sapphire, purple amethyst, orange fire-opal, radiant gold
diamond with rays; plus a mystery QUESTION-MARK rune tile; a boss SKULL-CROWN sigil`);
PACKS["emotes"] = iconPack("emotes", 8, `chunky comic-style co-op PING emotes: a sword pointing down
(attack here); an exclamation mark (danger); a question mark (what); a raised open hand (wait); a boot
with motion lines (retreat); a plus-cross (need healing); a treasure chest glint (loot here); a thumbs-up`);

const packName = (process.argv.find((a) => a.startsWith("--pack=")) ?? "--pack=decals").split("=")[1];
const PACK = PACKS[packName];
if (!PACK) {
  console.log(`unknown pack "${packName}" — known: ${Object.keys(PACKS).join(", ")}`);
  process.exit(1);
}
mkdirSync(PACK.out, { recursive: true });
mkdirSync(PACK.public, { recursive: true });

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
  const raw = resolve(PACK.out, "pack-raw.png");
  if (process.argv.includes("--reextract")) {
    console.log(`=== re-extracting ${packName} from cached pack-raw.png (skipping Codex) ===`);
  } else {
    console.log(`=== generating ${packName} pack ===`);
    const code = await runCodexExec({
      prompt: PACK.prompt,
      cwd: REPO,
      label: `${packName}-pack`,
      harvestTo: raw,
      stdoutFile: resolve(PACK.out, "pack.codex.log"),
    });
    if (code !== 0) return console.log(`codex exited ${code} — see pack.codex.log`);
  }

  const { data, width, height } = await keyToRaw(raw);
  await sharp(data, { raw: { width, height, channels: 4 } }).png().toFile(resolve(PACK.out, "pack.keyed.png"));

  // Find alpha islands, keep the biggest (drop shadow/fringe fragments), then name in reading order.
  const comps = components(data, width, height)
    .sort((a, b) => b.area - a.area)
    .slice(0, PACK.keep)
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
    const id = `${PACK.idPrefix}-${String(ids.length).padStart(2, "0")}`;
    try {
      await sharp(data, { raw: { width, height, channels: 4 } })
        .extract({ left, top, width: w, height: h })
        .resize(PACK.max, PACK.max, { fit: "inside", withoutEnlargement: true })
        .png()
        .toFile(resolve(PACK.public, `${id}.png`));
      ids.push(id);
    } catch (e) {
      console.log(`  skip ${id} (${w}×${h}): ${e.message}`);
    }
  }

  writeFileSync(
    PACK.manifest,
    `// AUTO-GENERATED by tools/artkit/gen-decals.mjs (--pack=${packName}) — Codex prop-pack (§17 P4).\n` +
      `// Each id is a trimmed transparent PNG in public/${PACK.idPrefix}s/, placed on the floor by ArenaScene.\n` +
      `export const ${PACK.manifestConst} = [\n${ids.map((d) => `  ${JSON.stringify(d)},`).join("\n")}\n] as const;\n`,
    "utf8",
  );
  console.log(`installed ${ids.length} ${packName} → ${PACK.public} + ${PACK.manifest}`);
}

main();
