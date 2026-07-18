// artkit/gen-character-concepts.mjs — APPROVAL-STAGE base-character concepts.
//
// Renders N distinct takes on the blank-slate boilerplate Drifter as ASSEMBLED
// characters (one bean body with fused head + two floating hands + two floating
// feet — the proven legacy-kit convention; NO painted legs/arms) so the owner can
// pick the main character BEFORE production part-splitting re-renders.
//
// Usage: node tools/artkit/gen-character-concepts.mjs [--only=<id>] [--force]
// Output: tools/artkit/out/character-concepts/<id>.png + index.html contact sheet.

import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { configureCodex, runCodexExec } from "./lib/codex.mjs";

const ROOT = resolve(import.meta.dirname, "../..");
const OUT = resolve(ROOT, "tools/artkit/out/character-concepts");
const SPRITES = resolve(ROOT, "packages/client/public/sprites");
const LANES = 5;

configureCodex({ perChatRoot: resolve(ROOT, "tools/artkit/.artkit-codex-homes") });

// Style anchors: real legacy kit parts — the convention every concept must obey.
const REFS = [
  resolve(SPRITES, "blade-twins/body.png"),
  resolve(SPRITES, "blade-twins/hand-l.png"),
  resolve(SPRITES, "blade-twins/foot-l.png"),
];

const CONCEPTS = [
  {
    id: "bone-paper-classic",
    name: "Bone-Paper Classic",
    identity:
      "warm bone-paper blank mannequin: matte #ded8c8 card stock with a pale ash #b9b5aa hard shadow band, one tiny charcoal registration notch where a face would be, faint taupe edge wear. Deliberately empty of identity — the cleanest possible dress-up base.",
  },
  {
    id: "stitch-seam-dummy",
    name: "Stitch-Seam Dummy",
    identity:
      "training-dummy blank: oatmeal canvas paper with ONE vertical charcoal stitch seam running up the torso midline and a tiny cross-stitch where a face would be, small patch of slightly darker weave on one shoulder. Ragdoll-earnest, still featureless.",
  },
  {
    id: "slate-agent",
    name: "Slate Agent",
    identity:
      "cool slate-gray blank agent: matte #6b6e78 paper with a near-black hard shadow band and one thin off-white registration notch across the face zone. Reads like a shadow operative before the wardrobe gives it a life.",
  },
  {
    id: "kraft-doll",
    name: "Kraft Doll",
    identity:
      "kraft-brown paper doll: warm #b08d5f card stock, visible paper-cut nicks on the silhouette, one round charcoal ink dot where a face would be, corners slightly worn pale. Handmade-cutout charm, zero gear identity.",
  },
  {
    id: "chalk-golem",
    name: "Chalk Golem",
    identity:
      "chalk-white blank golem: soft #e8e6df chalk body with a dove-gray hard shadow band and two faint horizontal chisel score lines on the torso, stockier rounded mass. Sturdy and neutral, like an unfired clay figure.",
  },
  {
    id: "ashen-drifter",
    name: "Ashen Drifter",
    identity:
      "ash-dusted blank drifter: pale warm-gray #cfc9bd paper with a slightly darker #a49e91 shadow band, a whisper of soot speckle low on the body, one small ember-orange registration notch at the collar. The one that already smells like the arenas.",
  },
];

function prompt(concept) {
  return `# CHAT ISOLATION — BASE CHARACTER CONCEPT ${concept.id}
Generate ONE standalone raster source image for Dimension Drifters: a CANDIDATE main-character identity for owner approval.

EXECUTION
- Produce exactly one 1024x1024 PNG in this chat.
- Solid pure chroma green #00ff00 background filling every non-art pixel.

REFERENCE IMAGES
- Images 1-3: a real in-game character kit's body, hand, and foot cutouts. MATCH their rig convention, paper materials, contour weight, viewpoint, and scale language exactly. They are style law, not subjects — do not copy their colors or costume.

Use case: stylized-concept
Asset type: assembled main-character identity candidate
Primary request: ${concept.identity}
RIG CONVENTION — NON-NEGOTIABLE (matches the references): ONE compact bean/egg body with the head FUSED into the top of the bean (no separate head, no neck), exactly TWO detached floating mitten-bean hands and exactly TWO detached floating wedge feet with clear green gaps to the body. NO painted arms, legs, shoulders, or hips. No clothing, hat, hair, face features beyond the stated notch, weapon, shadow, or prop.
Pose: neutral confident idle, semantic facing screen-right, slightly high three-quarter top-down view; hands relaxed at the sides; feet planted a body-width apart.

HOUSE STYLE — NON-NEGOTIABLE
- Original HD 2D Flash-era paper-cutout arena art: bold compact silhouette, matte painted card stock, a few paper edge nicks, heavy slightly uneven near-black exterior contour.
- Flat cel shading only: base color plus ONE hard shadow band and AT MOST ONE hard highlight per material. No gradients, airbrush, bloom, or rim light.
- About 4-6 decisive colors. Not pixel art, soft anime, photorealism, 3D, or vector-flat clipart.

Before returning verify: one bean body with fused head, two detached hands, two detached feet, green gaps, screen-right 3/4 view, flat green field, no legs/arms/gear/face/shadow/text/VFX.`;
}

function buildSheet(done) {
  const cards = done
    .map(
      (c) => `<figure style="margin:0;background:#181820;border:1px solid #333;border-radius:10px;overflow:hidden">
  <img src="${c.id}.png" style="width:100%;display:block;background:#222" />
  <figcaption style="padding:10px 12px;color:#ddd;font:600 15px system-ui">${c.name}<br/><span style="color:#888;font:400 12px system-ui">${c.id}</span></figcaption>
</figure>`,
    )
    .join("\n");
  writeFileSync(
    resolve(OUT, "index.html"),
    `<!doctype html><meta charset="utf-8"><title>DD base character concepts</title>
<body style="background:#0f0c14;margin:24px;font-family:system-ui">
<h1 style="color:#eee">Dimension Drifters — base character candidates</h1>
<p style="color:#999">Raw renders on chroma green. Pick one (or mix notes) — production part-split renders follow the winner.</p>
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:18px;max-width:1400px">${cards}</div>`,
  );
}

const args = process.argv.slice(2);
const only = args.find((a) => a.startsWith("--only="))?.slice(7);
const force = args.includes("--force");
mkdirSync(OUT, { recursive: true });

const jobs = CONCEPTS.filter((c) => !only || c.id === only);
let next = 0;
async function lane(n) {
  await new Promise((r) => setTimeout(r, n * 20_000));
  for (;;) {
    const job = jobs[next++];
    if (!job) return;
    const dst = resolve(OUT, `${job.id}.png`);
    if (existsSync(dst)) {
      if (!force) {
        console.log(`SKIP ${job.id} (exists)`);
        continue;
      }
      rmSync(dst);
    }
    console.log(`RENDER ${job.id}`);
    for (let attempt = 1; attempt <= 3 && !existsSync(dst); attempt++) {
      if (attempt > 1) await new Promise((r) => setTimeout(r, 60_000 * attempt));
      await runCodexExec({
        prompt: prompt(job),
        images: REFS,
        cwd: ROOT,
        label: `concept-${job.id}`,
        harvestTo: dst,
        stdoutFile: resolve(OUT, `${job.id}.log`),
      });
    }
    console.log(existsSync(dst) ? `DONE ${job.id}` : `FAILED ${job.id} after retries`);
  }
}

await Promise.all(Array.from({ length: Math.min(LANES, jobs.length) }, (_, n) => lane(n)));
buildSheet(CONCEPTS.filter((c) => existsSync(resolve(OUT, `${c.id}.png`))));
console.log(`SHEET ${resolve(OUT, "index.html")}`);
