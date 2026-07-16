#!/usr/bin/env node
// artkit/gen-sprint2.mjs — §48 last-window odds and ends: per-element IMPACT FLIPBOOK strips (P3.2),
// the SHOPKEEPER (P2.4), and the missing wild-west belt vista pair. Direct renders, RESUMABLE.
//   node tools/artkit/gen-sprint2.mjs
import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { configureCodex, runCodexExec } from "./lib/codex.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(here, "../..");
const OUT = resolve(here, "out/sprint2");
mkdirSync(OUT, { recursive: true });
configureCodex({ perChatRoot: resolve(here, ".artkit-codex-homes"), log: (m) => console.log(m) });

const jobs = [];
const add = (label, raw, prompt, install) => jobs.push({ label, raw, prompt, install });

// ── P3.2 per-element IMPACT FLIPBOOKS: one horizontal 6-frame strip each (hit connects → dissipates). ──
const IMPACTS = {
  fire: "an igniting fire hit-burst (flash → flame lick → embers → smoke wisp)",
  frost: "a crystallizing frost hit (flash → ice spikes → shard scatter → mist)",
  shock: "an electric hit (flash → forked arcs → sparks → fading static)",
  void: "a void hit (dark implosion → violet rim → collapsing shards → wisp)",
  holy: "a radiant hit (gold flash → halo bloom → light slivers → motes)",
  toxic: "a toxic hit (splash → gas puff → dripping globs → bubbles)",
  arcane: "an arcane hit (violet flash → rune ring → glyph sparks → fade)",
  steel: "a physical steel hit (white impact star → hot sparks → chips → dust)",
};
const FLIP = resolve(REPO, "packages/client/public/vfx/impacts");
for (const [el, desc] of Object.entries(IMPACTS)) {
  const raw = resolve(OUT, `impact-${el}.png`);
  add(
    `impact-${el}`,
    raw,
    `Paint ONE very wide image: a 6-FRAME video-game hit-impact FLIPBOOK laid out left to right in SIX
EQUAL COLUMNS, each column one animation frame of ${desc}, the effect centred in its column at identical
scale, evolving frame by frame from first flash (frame 1) to dissipation (frame 6). HD painted game VFX,
hot luminous core, crisp silhouettes. The ENTIRE background is FLAT PURE CHROMA GREEN #00ff00. No text,
no borders, no column dividers.`,
    async () => {
      mkdirSync(FLIP, { recursive: true });
      await sharp(raw).resize(1536, 256, { fit: "fill" }).png().toFile(resolve(FLIP, `${el}.png`));
    },
  );
}

// ── P2.4 shopkeeper + wild-west belt completion. ──
const misc = [
  ["shopkeeper", resolve(REPO, "packages/client/public/ui/shopkeeper.jpg"), 512, 512,
   `SQUARE portrait of a Wild-West travelling SHOPKEEPER NPC for a trade screen: a weathered, sly, kindly
merchant in a patched duster hung with trinkets, gold tooth glint, behind a fold-out counter of wares.
HD cel-shaded, thick outlines, muted frontier palette. No text, no border.`],
  ["bg-wild-west", resolve(REPO, "packages/client/public/belt/bg-wild-west.png"), 1672, 941,
   `WIDE 16:9 LANDSCAPE painting, a distant BACKGROUND vista for a side-scrolling game (bottom third calm,
dark, uncluttered): a WILD-WEST canyon rim at dusk — red-rock walls, a distant rail trestle, telegraph
poles, first stars. Painterly, moody. No people, no creatures, no text, no border.`],
  ["deck-wild-west", resolve(REPO, "packages/client/public/belt/deck-wild-west.png"), 1672, 320,
   `WIDE horizontal strip: weathered WOODEN BOARDWALK planking seen at a slight top-down angle, sun-bleached
wood with iron nails and dust drifts, tileable horizontally. Muted frontier palette. No objects, no text.`],
];
for (const [id, dst, w, h, prompt] of misc) {
  const raw = resolve(OUT, `${id}.png`);
  add(id, raw, prompt, async () => {
    mkdirSync(dirname(dst), { recursive: true });
    const isJpg = dst.endsWith(".jpg");
    const pipe = sharp(raw).resize(w, h, { fit: "cover" });
    await (isJpg ? pipe.jpeg({ quality: 88 }) : pipe.png()).toFile(dst);
  });
}

console.log(`sprint2: ${jobs.length} jobs`);
const CONC = 5;
let done = 0;
let skipped = 0;
async function worker(q) {
  for (;;) {
    const job = q.shift();
    if (!job) return;
    if (existsSync(job.raw)) {
      skipped++;
      await job.install().catch((e) => console.log(`INSTALL FAIL ${job.label}: ${e.message}`));
      continue;
    }
    await runCodexExec({ label: job.label, cwd: REPO, prompt: job.prompt, harvestTo: job.raw });
    if (existsSync(job.raw)) {
      await job.install().catch((e) => console.log(`INSTALL FAIL ${job.label}: ${e.message}`));
      done++;
      console.log(`✓ ${job.label} (${done + skipped}/${jobs.length})`);
    } else console.log(`✗ ${job.label} — no image (re-run to retry)`);
  }
}
const q = [...jobs];
await Promise.all(Array.from({ length: CONC }, () => worker(q)));
console.log(`sprint2: ${done} rendered, ${skipped} present, ${jobs.length} total`);
