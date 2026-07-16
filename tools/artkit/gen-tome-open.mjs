#!/usr/bin/env node
// artkit/gen-tome-open.mjs — OPEN-TOME states (§52): a "held open, pages showing" variant for every book
// weapon so channeling casts can visibly flip pages. RESUMABLE (skips existing raws). Installs to
// public/sprites/<id>/open.png next to part-1.png.
//
//   node tools/artkit/gen-tome-open.mjs
import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { configureCodex, runCodexExec } from "./lib/codex.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(here, "../..");
const OUT = resolve(here, "out/tome-open");
mkdirSync(OUT, { recursive: true });
configureCodex({ perChatRoot: resolve(here, ".artkit-codex-homes"), log: (m) => console.log(m) });

const STYLE = `HD cel-shaded game asset, thick confident dark outlines, painterly rendering, muted grounded
palette with controlled glow accents. Plain solid WHITE background (it will be keyed out). NO text beyond
illegible arcane scribbles, NO logos, NO watermark, NO border. Single object centered, fills ~85% of canvas.`;

const TOMES = [
  ["x2-pyroglyph-spellbook", "a fire-mage's spellbook: scorched leather cover, ember-orange glyph pages, tiny flame wisps curling off the page edges"],
  ["x2-hexbloom-scattergrimoire", "a hex-witch grimoire: dark floral cover, toxic pink-purple blooming glyphs across the open pages, petals drifting off"],
  ["x2-null-grimoire-of-the-hollow-page", "a void grimoire: matte black cover, the open pages are BLANK holes into starless void, faint grey rim light"],
  ["x2-codex-of-forked-tongues", "a serpent codex: scaled green-bronze cover, forked-tongue glyphs on the pages, twin ribbon bookmarks like snake tongues"],
  ["x2-maledict-tome-of-salt-lines", "a curse tome: salt-crusted pale cover, pages showing chalky warding lines and salt spilling from the spine"],
  ["x2-emberleaf-chapbook", "a small thin chapbook: autumn-leaf cover, glowing ember-vein leaf pressed on the open pages, cinders drifting"],
  ["x2-verdigris-grand-grimoire", "a huge ancient grimoire: oxidized copper-green cover with heavy clasps, moss-lit pages with verdant glyphs"],
];

const only = process.argv[2];
let fail = 0;
for (const [id, desc] of TOMES) {
  if (only && id !== only) continue;
  const raw = resolve(OUT, `${id}-open.png`);
  const ref = resolve(REPO, `packages/client/public/sprites/${id}/part-1.png`);
  const dst = resolve(REPO, `packages/client/public/sprites/${id}/open.png`);
  if (!existsSync(raw)) {
    const code = await runCodexExec({
      label: `tome-open-${id}`,
      cwd: REPO,
      prompt: `Generate an image: the SAME book as the attached reference, but now WIDE OPEN, seen from
slightly above (a hero holds it open while casting). Both page spreads visible and glowing with the book's
magic; one page mid-flip lifting off the spread. Keep the exact cover design, colors and materials of the
reference. Subject: ${desc}. ${STYLE}`,
      images: existsSync(ref) ? [ref] : [],
      harvestTo: raw,
      stdoutFile: resolve(OUT, `${id}.log`),
    });
    if (!existsSync(raw)) { console.log(`RENDER FAIL ${id} (exit ${code})`); fail++; continue; }
  }
  // Key out the white bg → trim → cap at 256px to match the closed-sprite install size.
  const img = sharp(raw).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] > 242 && data[i + 1] > 242 && data[i + 2] > 242) data[i + 3] = 0;
  }
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .trim().resize(256, 256, { fit: "inside", withoutEnlargement: true })
    .png().toFile(dst);
  console.log(`INSTALLED ${dst}`);
}
console.log(fail ? `DONE with ${fail} failures` : "DONE all installed");
