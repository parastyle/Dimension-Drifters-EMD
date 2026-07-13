#!/usr/bin/env node
// artkit/gen-belt-backdrops.mjs — Codex-paint the §36 themed BELT LEVEL backdrops (the distant parallax
// background behind the deck), matching the proven sky-carrier set (1672×941 landscape, painterly, DARK
// enough that gameplay + neon VFX read on top).
//
//   node tools/artkit/gen-belt-backdrops.mjs                 # all four
//   node tools/artkit/gen-belt-backdrops.mjs frost-chasm     # just one
//
// Installs to packages/client/public/belt/bg-<levelId>.png (ArenaScene preloads "belt-bg" for the level).
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { configureCodex, runCodexExec } from "./lib/codex.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(here, "../..");
const OUT = resolve(here, "out/belt-backdrops");
const PUBLIC = resolve(REPO, "packages/client/public/belt");
mkdirSync(OUT, { recursive: true });
mkdirSync(PUBLIC, { recursive: true });
configureCodex({ perChatRoot: resolve(here, ".artkit-codex-homes"), log: (m) => console.log(m) });

// Shared framing so all four read as one game: a WIDE painterly side-view BACKGROUND (what you see BEHIND
// the walkable deck), horizon in the upper half, darker + calmer toward the bottom third (the vector deck +
// characters + neon VFX render over it). No characters, no creatures, no text, no UI, no border.
const FRAME = `WIDE 16:9 LANDSCAPE painting, a distant BACKGROUND vista for a side-scrolling video game (the
playable floor is drawn separately in the foreground, so keep the bottom third calm, dark and uncluttered).
Painterly, moody, grounded palette with a few controlled glow accents. NO people, NO creatures, NO text, NO
logos, NO UI, NO frame/border. Fill the entire canvas edge to edge.`;

const BACKDROPS = {
  "frost-chasm": {
    prompt: `${FRAME}
Scene: FROSTFELL DESCENT — the inside of a vast glacier crevasse. Towering blue-white ICE WALLS rise on
both sides into a thin sliver of pale arctic sky far above; hanging icicles, ancient blue ice strata,
faint frozen mist drifting between the walls, a hint of buried dark rock. Cold palette: deep glacial blues
and cyans over near-black shadow (#0e1626 undertone), with the pale sky glow as the accent.`,
  },
  "verdant-ruin": {
    prompt: `${FRAME}
Scene: VERDANT OVERGROWTH — an ancient stone ruin swallowed by deep jungle. Massive moss-covered cyclopean
walls and broken columns draped in vines, a dense green canopy closing overhead with a few god-rays of
warm light breaking through, giant roots gripping the stonework, drifting spores. Palette: deep greens and
mossy darks (#12200f undertone) with the warm light shafts as the accent.`,
  },
  "neon-undergrid": {
    prompt: `${FRAME}
Scene: NEON UNDERGRID — a vast underground cyber server sublevel. Endless ranks of dark server racks and
cable trunks receding into haze, catwalk silhouettes, cooling vapor, thin NEON conduit lines in cyan and
magenta tracing the architecture, small status lights. Palette: near-black blue-purple steel (#141220
undertone) with restrained cyan/magenta neon accents — dark, not a light show.`,
  },
  "ashland-forge": {
    prompt: `${FRAME}
Scene: ASHLAND FORGE — a colossal volcanic foundry. Distant molten METAL POURS and lava falls glowing
orange through ash haze, monolithic furnace machinery and chains in silhouette, drifting embers, a dark
ash-choked sky above. Palette: deep charcoal and rust darks (#1a1210 undertone) with the molten orange
glow (#ff8a2b) as the hot accent.`,
  },
};

const W = 1672;
const H = 941; // matches the sky-carrier backdrop set

const only = process.argv[2];
const names = only ? [only] : Object.keys(BACKDROPS);

// All levels render CONCURRENTLY (each codex exec gets its own isolated home).
const results = await Promise.all(
  names.map(async (name) => {
    const def = BACKDROPS[name];
    if (!def) {
      console.log(`unknown level "${name}" — known: ${Object.keys(BACKDROPS).join(", ")}`);
      return { name, ok: false };
    }
    const raw = resolve(OUT, `${name}-raw.png`);
    console.log(`=== generating backdrop: ${name} ===`);
    const code = await runCodexExec({
      prompt: def.prompt,
      cwd: REPO,
      label: `belt-bg-${name}`,
      harvestTo: raw,
      stdoutFile: resolve(OUT, `${name}.codex.log`),
    });
    if (code !== 0) {
      console.log(`codex exited ${code} for ${name} — see ${name}.codex.log`);
      return { name, ok: false };
    }
    const out = resolve(PUBLIC, `bg-${name}.png`);
    await sharp(raw).resize(W, H, { fit: "cover" }).removeAlpha().png({ compressionLevel: 9 }).toFile(out);
    console.log(`INSTALLED ${out} (${W}×${H})`);
    return { name, ok: true };
  }),
);
console.log(`\nbackdrops done — ${results.filter((r) => r.ok).length}/${names.length} installed to public/belt/`);
