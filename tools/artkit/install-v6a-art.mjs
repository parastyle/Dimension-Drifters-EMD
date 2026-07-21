#!/usr/bin/env node
// V6A generated-art installer. Inputs are complete Codex renders from subjects-v6a.json; this script only
// removes their chroma-key whitespace, scales the whole generated subject, and installs it. It never crops
// or copies pixels from an existing weapon/book asset.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../..");
const publicDir = resolve(repo, "packages/client/public");
const outcomeDir = resolve(here, "out/v6a-art");

const jobs = [
  {
    id: "headsman-proto-1-radiant-edge",
    source: "out/v6a-headsman-proto-1-radiant-edge/sheets/candidate-1.keyed.png",
    output: "vfx/headsman-prototypes/radiant-verdict.png",
    width: 512,
    height: 176,
  },
  {
    id: "headsman-proto-2-ghost-blade",
    source: "out/v6a-headsman-proto-2-ghost-blade/sheets/candidate-1.keyed.png",
    output: "vfx/headsman-prototypes/pale-procession.png",
    width: 512,
    height: 176,
  },
  {
    id: "headsman-proto-3-particle-weave",
    source: "out/v6a-headsman-proto-3-particle-weave/sheets/candidate-1.keyed.png",
    output: "vfx/headsman-prototypes/woven-litany.png",
    width: 512,
    height: 176,
  },
  {
    id: "headsman-proto-4-cathedral-glass",
    source: "out/v6a-headsman-proto-4-cathedral-glass/sheets/candidate-1.keyed.png",
    output: "vfx/headsman-prototypes/cathedral-ruin.png",
    width: 512,
    height: 176,
  },
  {
    id: "twin-whisper-page",
    source: "out/v6a-twin-whisper-page/sheets/candidate-1.keyed.png",
    output: "projectiles/twin-whisper-page.png",
    width: 176,
    height: 144,
  },
  {
    id: "verdigris-grand-page",
    source: "out/v6a-verdigris-grand-page/sheets/candidate-1.keyed.png",
    output: "projectiles/verdigris-grand-page.png",
    width: 224,
    height: 176,
  },
];

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
  if (visiblePixels < 180) failures.push(`only ${visiblePixels} visible pixels`);
  if (greenSpillPixels) failures.push(`${greenSpillPixels} green-spill pixels`);
  return {
    valid: failures.length === 0,
    failures,
    width: metadata.width ?? 0,
    height: metadata.height ?? 0,
    visiblePixels,
  };
}

async function scrubResidualGreen(path) {
  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let offset = 0; offset < data.length; offset += info.channels) {
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    const dominance = green - Math.max(red, blue);
    if (dominance > 90) {
      data[offset] = 0;
      data[offset + 1] = 0;
      data[offset + 2] = 0;
      data[offset + 3] = 0;
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

async function install(job) {
  const source = resolve(here, job.source);
  const output = resolve(publicDir, job.output);
  if (!existsSync(source)) return { id: job.id, status: "MISSING_SOURCE", source: job.source };
  mkdirSync(dirname(output), { recursive: true });
  const scrubbed = await scrubResidualGreen(source);
  await sharp(scrubbed)
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize({ width: job.width, height: job.height, fit: "inside", withoutEnlargement: false })
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

async function writeContactSheet() {
  const ids = [
    ["Radiant Verdict", "vfx/headsman-prototypes/radiant-verdict.png"],
    ["Pale Procession", "vfx/headsman-prototypes/pale-procession.png"],
    ["Woven Litany", "vfx/headsman-prototypes/woven-litany.png"],
    ["Cathedral Ruin", "vfx/headsman-prototypes/cathedral-ruin.png"],
  ];
  if (ids.some(([, path]) => !existsSync(resolve(publicDir, path)))) return false;
  const tileW = 600;
  const tileH = 225;
  const gap = 20;
  const composites = [];
  for (let index = 0; index < ids.length; index++) {
    const [name, path] = ids[index];
    const art = await sharp(resolve(publicDir, path))
      .resize({ width: tileW - 32, height: tileH - 64, fit: "contain" })
      .toBuffer();
    const label = Buffer.from(
      `<svg width="${tileW}" height="44"><text x="${tileW / 2}" y="31" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="#f4e8bf">${index + 1}. ${name}</text></svg>`,
    );
    const left = gap + (index % 2) * (tileW + gap);
    const top = gap + Math.floor(index / 2) * (tileH + gap);
    const meta = await sharp(art).metadata();
    composites.push({ input: art, left: left + Math.round((tileW - (meta.width ?? 0)) / 2), top: top + 8 });
    composites.push({ input: label, left, top: top + tileH - 50 });
  }
  const width = tileW * 2 + gap * 3;
  const height = tileH * 2 + gap * 3;
  const output = resolve(repo, "docs/assets/headsman-prototypes-contact-sheet.jpg");
  mkdirSync(dirname(output), { recursive: true });
  await sharp({
    create: { width, height, channels: 4, background: { r: 26, g: 19, b: 32, alpha: 1 } },
  })
    .composite(composites)
    .flatten({ background: { r: 26, g: 19, b: 32 } })
    .jpeg({ quality: 90 })
    .toFile(output);
  return true;
}

const outcomes = [];
for (const job of jobs) outcomes.push(await install(job));
const contactSheet = await writeContactSheet();
mkdirSync(outcomeDir, { recursive: true });
writeFileSync(
  resolve(outcomeDir, "render-outcomes.json"),
  `${JSON.stringify({ outcomes, contactSheet }, null, 2)}\n`,
);
console.table(outcomes.map(({ id, status, width, height, failures }) => ({
  id,
  status,
  size: width && height ? `${width}x${height}` : "-",
  failures: failures?.join("; ") ?? "",
})));
console.log(`headsman contact sheet: ${contactSheet ? "VALID" : "MISSING"}`);
if (outcomes.some((outcome) => outcome.status !== "VALID") || !contactSheet) process.exitCode = 1;
