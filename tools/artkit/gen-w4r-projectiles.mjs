#!/usr/bin/env node
// W4R reference-guided projectile art. Codex generates new ammunition silhouettes from the installed
// weapon sprites; this pipeline intentionally never crops the source weapon art.
import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { configureCodex, runCodexExec } from "./lib/codex.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../..");
const out = resolve(here, "out/w4r-projectiles");
const installed = resolve(repo, "packages/client/public/projectiles");
mkdirSync(out, { recursive: true });
mkdirSync(installed, { recursive: true });
configureCodex({ perChatRoot: resolve(here, ".artkit-codex-homes"), log: console.log });

const jobs = [
  {
    id: "widowmaker-arbalest-arrow",
    reference: resolve(repo, "packages/client/public/sprites/x2-widowmaker-arbalest/part-1.png"),
    prompt: `Use case: stylized-concept
Asset type: Dimension Drifters in-flight projectile sprite
Primary request: Generate the picture of an arrow; do not crop from the weapon art. Create one brand-new massive siege-crossbow arrow inspired by Image 1.
Input images: Image 1 is a style, palette, material, and engineering reference only; it is not an edit target and no pixels should be copied or cropped.
Subject: one complete heavy iron arbalest arrow with a broad faceted steel point, thick dark shaft, compact pale fletching, and small brass engineering accents matching the reference weapon.
Style/medium: the game's chunky flat-cel painted sprite style, 4-6 colors, thick slightly uneven charcoal outline, minimal interior detail.
Composition/framing: flat orthographic full side-profile, perfectly horizontal, arrowhead points RIGHT, entire arrow visible with generous padding.
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background.
Constraints: only the loose arrow ammunition; no crossbow, no hands, no character, no duplicated arrows, no text, no watermark, no shadow, no glow; crisp separated silhouette; do not use #00ff00 in the subject.
Pipeline contract: generate the image only; do not copy, install, or edit any repository file because the artkit harvester owns installation.
Avoid: cropping or tracing the loaded bolt in Image 1; photorealism; perspective; background texture.`,
  },
  {
    id: "tidehook-bombarpoon-harpoon",
    reference: resolve(repo, "packages/client/public/sprites/x2-tidehook-bombarpoon/part-1.png"),
    prompt: `Use case: stylized-concept
Asset type: Dimension Drifters in-flight projectile sprite
Primary request: Generate one new loose bomb-harpoon ammunition projectile matching the Tidehook Bombarpoon in Image 1; use the weapon as reference, never as a crop source.
Input images: Image 1 is a style, palette, material, and ammunition-design reference only; it is not an edit target and no pixels should be copied or cropped.
Subject: one complete white-steel harpoon with a large triangular barbed point, compact bulbous depth-charge collar behind the head, short reinforced shaft, dull-teal bands, and tiny solid cyan frost accents.
Style/medium: the game's chunky flat-cel painted sprite style, 4-6 colors, thick slightly uneven charcoal outline, minimal interior detail.
Composition/framing: flat orthographic full side-profile, perfectly horizontal, harpoon tip points RIGHT, entire projectile visible with generous padding.
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background.
Constraints: only the loose harpoon ammunition; no launcher, tanks, stock, trigger, hands, character, cable, duplicated harpoons, text, watermark, shadow, mist, or glow; crisp separated silhouette; do not use #00ff00 in the subject.
Pipeline contract: generate the image only; do not copy, install, or edit any repository file because the artkit harvester owns installation.
Avoid: cropping or tracing Image 1; photorealism; perspective; background texture.`,
  },
];

async function keyGreen(rawPath, outputPath) {
  const { data, info } = await sharp(rawPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let index = 0; index < info.width * info.height; index++) {
    const offset = index * info.channels;
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    const dominance = green - Math.max(red, blue);
    if (dominance > 90) {
      data[offset] = 0;
      data[offset + 1] = 0;
      data[offset + 2] = 0;
      data[offset + 3] = 0;
    }
    else if (dominance > 40) {
      data[offset + 3] = Math.round(255 * (1 - (dominance - 40) / 50));
      data[offset + 1] = Math.max(red, blue);
    }
  }
  const keyed = await sharp(Buffer.from(data), {
    raw: { width: info.width, height: info.height, channels: info.channels },
  })
    .png()
    .toBuffer();
  await sharp(keyed)
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize({ width: 256, height: 112, fit: "inside", withoutEnlargement: true })
    .extend({ top: 8, bottom: 8, left: 8, right: 8, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(outputPath);
  const image = sharp(outputPath).ensureAlpha();
  const metadata = await image.metadata();
  const { data: installedPixels } = await image.raw().toBuffer({ resolveWithObject: true });
  let transparentPixels = 0;
  let greenSpillPixels = 0;
  for (let offset = 0; offset < installedPixels.length; offset += 4) {
    const alpha = installedPixels[offset + 3];
    if (alpha === 0) transparentPixels++;
    if (
      alpha > 64 &&
      installedPixels[offset + 1] - Math.max(installedPixels[offset], installedPixels[offset + 2]) > 40
    )
      greenSpillPixels++;
  }
  if (
    !metadata.hasAlpha ||
    !metadata.width ||
    !metadata.height ||
    metadata.width <= metadata.height * 2 ||
    transparentPixels === 0 ||
    greenSpillPixels > 0
  )
    throw new Error(`${outputPath} did not produce a wide transparent projectile`);
}

for (const job of jobs) {
  const raw = resolve(out, `${job.id}-raw.png`);
  const final = resolve(installed, `${job.id}.png`);
  if (!existsSync(raw)) {
    const code = await runCodexExec({
      prompt: job.prompt,
      images: [job.reference],
      cwd: repo,
      label: `w4r-${job.id}`,
      harvestTo: raw,
      stdoutFile: resolve(out, `${job.id}.codex.log`),
    });
    if (code !== 0 || !existsSync(raw)) throw new Error(`Codex render failed for ${job.id}`);
  }
  await keyGreen(raw, final);
  console.log(`installed ${job.id}.png`);
}
