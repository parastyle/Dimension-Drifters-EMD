#!/usr/bin/env node
// V6.1 brutalist-greatsword extension installer. Inputs are complete Codex renders from
// subjects-v6-1-brutalist-greatswords.json. This only removes chroma whitespace, scales each generated
// treatment as a whole, and validates the installed alpha asset; it never synthesizes replacement art.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../..");
const publicDir = resolve(repo, "packages/client/public");
const outcomeDir = resolve(here, "out/v6-1-brutalist-greatswords");

const jobs = [
  ["frost-crystal-edge", "frost"],
  ["roaring-flame-blade", "fire"],
  ["crackling-arc-edge", "shock"],
  ["hollow-void-rim", "void"],
  ["radiant-daylight-blade", "light"],
  ["jagged-stone-blade", "rock"],
].map(([file, source]) => ({
  id: source,
  source: `out/v6-1-greatsword-extension-${source}/sheets/candidate-1.keyed.png`,
  output: `vfx/brutalist-greatswords/${file}.png`,
}));

async function scrubResidualGreen(input) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let offset = 0; offset < data.length; offset += info.channels) {
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    const dominance = green - Math.max(red, blue);
    if (dominance > 90) {
      data.fill(0, offset, offset + 4);
    } else if (dominance > 40) {
      data[offset + 3] = Math.round(data[offset + 3] * (1 - (dominance - 40) / 50));
      data[offset + 1] = Math.max(red, blue);
    }
  }
  return sharp(Buffer.from(data), {
    raw: { width: info.width, height: info.height, channels: info.channels },
  })
    .png()
    .toBuffer();
}

async function validate(path) {
  const image = sharp(path).ensureAlpha();
  const metadata = await image.metadata();
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  let transparentPixels = 0;
  let visiblePixels = 0;
  let greenSpillPixels = 0;
  for (let offset = 0; offset < data.length; offset += info.channels) {
    const alpha = data[offset + 3];
    if (alpha === 0) transparentPixels++;
    if (alpha > 64) visiblePixels++;
    if (alpha > 64 && data[offset + 1] - Math.max(data[offset], data[offset + 2]) > 40)
      greenSpillPixels++;
  }
  const failures = [];
  if (!metadata.hasAlpha) failures.push("missing alpha");
  if (!metadata.width || !metadata.height) failures.push("empty dimensions");
  if (!transparentPixels) failures.push("no transparent pixels");
  if (visiblePixels < 320) failures.push(`only ${visiblePixels} visible pixels`);
  if (greenSpillPixels) failures.push(`${greenSpillPixels} green-spill pixels`);
  if ((metadata.width ?? 0) <= (metadata.height ?? 0) * 2.5) failures.push("extension is not wide enough");
  return {
    valid: failures.length === 0,
    failures,
    width: metadata.width ?? 0,
    height: metadata.height ?? 0,
    visiblePixels,
  };
}

async function install(job) {
  const source = resolve(here, job.source);
  const output = resolve(publicDir, job.output);
  if (!existsSync(source)) return { id: job.id, status: "MISSING_SOURCE", source: job.source };
  mkdirSync(dirname(output), { recursive: true });
  const scrubbed = await scrubResidualGreen(source);
  await sharp(scrubbed)
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize({ width: 512, height: 144, fit: "inside", withoutEnlargement: false })
    .extend({ top: 8, bottom: 8, left: 8, right: 8, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(output);
  const validation = await validate(output);
  return {
    id: job.id,
    status: validation.valid ? "VALID" : "INVALID",
    source: job.source,
    output: job.output,
    ...validation,
  };
}

const outcomes = [];
for (const job of jobs) outcomes.push(await install(job));
mkdirSync(outcomeDir, { recursive: true });
writeFileSync(
  resolve(outcomeDir, "extension-render-outcomes.json"),
  `${JSON.stringify({ outcomes }, null, 2)}\n`,
);
console.table(
  outcomes.map(({ id, status, width, height, failures }) => ({
    id,
    status,
    size: width && height ? `${width}x${height}` : "-",
    failures: failures?.join("; ") ?? "",
  })),
);
if (outcomes.some((outcome) => outcome.status !== "VALID")) process.exitCode = 1;
