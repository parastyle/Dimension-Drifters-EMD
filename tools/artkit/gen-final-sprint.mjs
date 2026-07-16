#!/usr/bin/env node
// artkit/gen-final-sprint.mjs — CODEX FINAL SPRINT (§47): the last-hours render program. Direct renders,
// RESUMABLE (skips existing raws): character PORTRAITS (P2.2), boss intro SPLASHES (P3.1), TITLE key art
// (P3.3) and victory/defeat BANNERS (P3.4). Installs straight into public/.
//
//   node tools/artkit/gen-final-sprint.mjs
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { configureCodex, runCodexExec } from "./lib/codex.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(here, "../..");
const OUT = resolve(here, "out/final-sprint");
mkdirSync(OUT, { recursive: true });
configureCodex({ perChatRoot: resolve(here, ".artkit-codex-homes"), log: (m) => console.log(m) });

const STYLE = `HD cel-shaded, thick confident dark outlines, painterly rendering, muted grounded palette
with controlled glow accents. NO text, NO logos, NO watermark, NO border. Fill the canvas edge to edge.`;

const jobs = [];
const add = (label, raw, prompt, images, install) => jobs.push({ label, raw, prompt, images, install });

// ── P2.2 CHARACTER PORTRAITS — head-and-shoulders for select/HUD, style-locked to the sprite ref. ──
const subjects = JSON.parse(readFileSync(resolve(here, "subjects.concepts.json"), "utf8"));
const subjArr = subjects.subjects ?? subjects;
const PORTRAITS = resolve(REPO, "packages/client/public/ui/portraits");
for (const c of subjArr) {
  if (!c.id || !Array.isArray(c.tags) || !c.tags.includes("character")) continue;
  const raw = resolve(OUT, `portrait-${c.id}.png`);
  const ref = resolve(here, `out/${c.id}/identity-ref.png`);
  add(
    `portrait-${c.id}`,
    raw,
    `SQUARE head-and-shoulders PORTRAIT of a video-game character for a character-select screen. Dramatic
three-quarter face angle, strong silhouette, moody atmospheric backdrop vignetting darker at the edges.
Character: ${c.name}. ${c.prompt ?? ""} ${STYLE} Match the attached reference's design exactly if provided.`,
    existsSync(ref) ? [ref] : [],
    async () => {
      mkdirSync(PORTRAITS, { recursive: true });
      await sharp(raw).resize(512, 512, { fit: "cover" }).jpeg({ quality: 88 }).toFile(resolve(PORTRAITS, `${c.id}.jpg`));
    },
  );
}

// ── P3.1 BOSS SPLASHES — one wide intro frame per boss kind (future boss-intro banner). ──
const BOSSES = [
  ["old-rust", "a colossal rusted junk-golem boss, scrap-iron body, one burning furnace eye"],
  ["verkaln", "an armored void-knight boss wreathed in violet rift energy"],
  ["choirmath", "a many-voiced crystalline choir-construct boss, resonating shard halo"],
  ["corvane", "a carrion crow-sorcerer boss, feathered mantle, bone staff"],
  ["moss-stone-golem", "a moss-covered ancient stone golem boss, glowing green rune veins"],
  ["dimensional-colossus", "a screen-filling dimensional colossus boss, reality cracking around its fists"],
  ["world-titan", "a continent-shouldered stone world-titan boss on the horizon"],
];
const SPLASH = resolve(REPO, "packages/client/public/ui/splash");
for (const [id, desc] of BOSSES) {
  const raw = resolve(OUT, `splash-${id}.png`);
  add(
    `splash-${id}`,
    raw,
    `WIDE 16:9 dramatic BOSS INTRO SPLASH for a video game: ${desc}, low hero-shot camera angle, rim-lit
against its lair, oppressive scale, dark vignette edges ready for a name banner overlay. ${STYLE}`,
    [],
    async () => {
      mkdirSync(SPLASH, { recursive: true });
      await sharp(raw).resize(1280, 720, { fit: "cover" }).jpeg({ quality: 88 }).toFile(resolve(SPLASH, `${id}.jpg`));
    },
  );
}

// ── P3.3/P3.4 TITLE key art ×3 + outcome banners ×2. ──
const UI = resolve(REPO, "packages/client/public/ui");
const TITLES = [
  ["title-a", "the full player posse silhouetted on a mesa at golden hour, dimensional rift tearing the sky open above a frontier town"],
  ["title-b", "a lone drifter mid-swing with a massive greatsword, five dimension vistas fanned out behind like torn playing cards"],
  ["title-c", "top-down hero shot of the four-player party back to back, surrounded by a closing horde, weapons glowing"],
];
for (const [id, scene] of TITLES) {
  const raw = resolve(OUT, `${id}.png`);
  add(`${id}`, raw, `WIDE 16:9 TITLE-SCREEN key art for the co-op bullet-heaven "Dimension Drifters": ${scene}. Epic, painterly, room reserved in the upper third for a logo. ${STYLE}`, [], async () => {
    mkdirSync(UI, { recursive: true });
    await sharp(raw).resize(1920, 1080, { fit: "cover" }).jpeg({ quality: 90 }).toFile(resolve(UI, `${id}.jpg`));
  });
}
for (const [id, mood] of [
  ["banner-victory", "triumphant golden light bursting through parted storm clouds over a battlefield, warm and earned"],
  ["banner-defeat", "cold blue-grey ash falling on dropped weapons in a dark arena, somber but not hopeless"],
]) {
  const raw = resolve(OUT, `${id}.png`);
  add(`${id}`, raw, `WIDE cinematic 21:9 outcome BANNER for a video game result screen: ${mood}. No characters' faces, abstract enough to overlay large text. ${STYLE}`, [], async () => {
    mkdirSync(UI, { recursive: true });
    await sharp(raw).resize(1680, 720, { fit: "cover" }).jpeg({ quality: 88 }).toFile(resolve(UI, `${id}.jpg`));
  });
}

console.log(`final sprint: ${jobs.length} jobs`);
const CONC = 6;
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
    await runCodexExec({ label: job.label, cwd: REPO, prompt: job.prompt, images: job.images, harvestTo: job.raw });
    if (existsSync(job.raw)) {
      await job.install().catch((e) => console.log(`INSTALL FAIL ${job.label}: ${e.message}`));
      done++;
      console.log(`✓ ${job.label} (${done + skipped}/${jobs.length})`);
    } else console.log(`✗ ${job.label} — no image (re-run to retry)`);
  }
}
const q = [...jobs];
await Promise.all(Array.from({ length: CONC }, () => worker(q)));
console.log(`final sprint: ${done} rendered, ${skipped} present, ${jobs.length} total`);
