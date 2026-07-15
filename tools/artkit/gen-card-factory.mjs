#!/usr/bin/env node
// artkit/gen-card-factory.mjs — CODEX FINAL RUN P1.1: bespoke CARD ART for every weapon that lacks it
// (17/317 had cards; the rest fall back to sprite thumbnails in the carousel/shop/draft). One portrait
// render per weapon from its authored concept (artPrompt + palette + cardartAction), style-locked to the
// weapon's identity ref when the sprite run left one on disk. RESUMABLE: skips ids whose card already
// exists in public/cards/ OR whose raw exists in out/cards/. Re-run gen-card-manifest.mjs after.
//
//   node tools/artkit/gen-card-factory.mjs           # everything missing
//   node tools/artkit/gen-card-factory.mjs <id>      # one weapon
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { configureCodex, runCodexExec } from "./lib/codex.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(here, "../..");
const OUT = resolve(here, "out/cards");
const PUBLIC = resolve(REPO, "packages/client/public/cards");
mkdirSync(OUT, { recursive: true });
mkdirSync(PUBLIC, { recursive: true });
configureCodex({ perChatRoot: resolve(here, ".artkit-codex-homes"), log: (m) => console.log(m) });

const FRAME = `PORTRAIT weapon CARD ART for a video game (roughly 5:7). ONE hero weapon as the clear focal
subject, dramatic three-quarter presentation filling most of the frame, floating over a moody atmospheric
backdrop that suggests its element/world without competing (soft depth, controlled glow accents, darker
toward the edges where the card UI overlays). HD cel-shaded, thick confident dark outlines, painterly
rendering. NO text, NO logos, NO watermark, NO border, NO hands or characters. Fill the canvas edge to edge.`;

const concepts = JSON.parse(readFileSync(resolve(REPO, "data/weapon-concepts-300.json"), "utf8")).weapons;
const only = process.argv[2];
const jobs = [];
for (const w of concepts) {
  if (!w.id || w.banned) continue;
  if (only && w.id !== only) continue;
  const dst = resolve(PUBLIC, `${w.id}.jpg`);
  if (existsSync(dst) && !only) continue; // bespoke card already shipped (the curated 17 / prior runs)
  const raw = resolve(OUT, `${w.id}.png`);
  const styleRef = resolve(here, `out/${w.id}/identity-ref.png`);
  jobs.push({
    label: `card-${w.id}`,
    raw,
    dst,
    images: existsSync(styleRef) ? [styleRef] : [],
    prompt: `${FRAME}
Weapon: ${w.name}. ${w.artPrompt ?? ""}
Presentation moment: ${w.cardartAction ?? "the weapon at rest, presented like a museum piece with menace"}.
Palette anchors: primary ${w.palettePrimary ?? "muted steel"}, accent ${w.paletteAccent ?? "ember orange"}.
${w.images?.length ? "" : ""}Match the attached reference's design exactly if one is provided.`,
  });
}
console.log(`card factory: ${jobs.length} card(s) to render`);

const CONC = 6;
let done = 0;
async function worker(queue) {
  for (;;) {
    const job = queue.shift();
    if (!job) return;
    if (!existsSync(job.raw)) {
      await runCodexExec({
        label: job.label,
        cwd: REPO,
        prompt: job.prompt,
        images: job.images,
        harvestTo: job.raw,
      });
    }
    if (existsSync(job.raw)) {
      try {
        await sharp(job.raw).resize(600, 840, { fit: "cover" }).jpeg({ quality: 88 }).toFile(job.dst);
        done++;
        console.log(`✓ ${job.label} (${done}/${jobs.length})`);
      } catch (e) {
        console.log(`INSTALL FAIL ${job.label}: ${e.message}`);
      }
    } else {
      console.log(`✗ ${job.label} — no image harvested (re-run to retry)`);
    }
  }
}
const queue = [...jobs];
await Promise.all(Array.from({ length: CONC }, () => worker(queue)));
console.log(`card factory: ${done}/${jobs.length} installed → run gen-card-manifest.mjs`);
