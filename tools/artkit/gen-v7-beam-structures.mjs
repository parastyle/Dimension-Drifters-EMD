#!/usr/bin/env node
// V7 Codex beam-structure pipeline. Raw image generations, prompts, logs, validation outcomes, and the
// contact sheet stay in the beam evidence lease; only validated 256x96 transparent sheets are installed.
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { configureCodex, runCodexExec } from "./lib/codex.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../..");
const evidence = resolve(repo, "docs/owner-notes-audit-v7-evidence/beams");
const sourceDir = resolve(evidence, "generated-source");
const installed = resolve(repo, "packages/client/public/vfx/beams/v7-structure");
const codexHomes = resolve(evidence, ".codex-homes");
mkdirSync(sourceDir, { recursive: true });
mkdirSync(installed, { recursive: true });
configureCodex({ perChatRoot: codexHomes, log: console.log });

const COMMON = `Use case: stylized-concept
Asset type: Dimension Drifters live beam-structure texture sheet
Scene/backdrop: perfectly flat, fully opaque, uniform pure #00ff00 chroma-key green. No gradient, shadow,
floor, texture, reflected light, haze, or lighting variation in the background.
Style/medium: hand-painted 2D game VFX sprite; crisp readable silhouette at small game scale; bright opaque
energy marks with a controlled hard painted edge, not a photoreal scene.
Composition/framing: exactly ONE long horizontal beam-structure sample centered in a square image, spanning
roughly 80% of the canvas width and no more than 30% of its height. Direction runs LEFT to RIGHT. Generous
uninterrupted green padding on every side. No cropping and no pixels touching the canvas edge.
Constraints: the subject must fit inside one narrow horizontal band. No weapon, character, target, impact
burst, text, border, watermark, checkerboard, black/white backdrop, or cast shadow. Do not use #00ff00 or
chroma-like lime anywhere in the subject. Outside the painted energy marks, the background is pure #00ff00.
Call image_gen exactly once for this asset, then end the turn immediately. The outer artkit alone harvests,
keys, validates, and installs the result.`;

const jobs = [
  {
    id: "segmented-arcs",
    minColumnOccupancy: 0.42,
    maxColumnOccupancy: 0.84,
    prompt: `Primary request: Paint a train of six separate angular electric arc segments. Each segment is a
short crooked red-white lightning plate angled slightly differently, with unmistakable transparent gaps
between segments. The whole sequence advances horizontally; it must not join into one continuous tube.
Color palette: ember red edges, hot scarlet bodies, tiny cream-white electrical cores.
${COMMON}`,
  },
  {
    id: "converging-strands",
    minColumnOccupancy: 0.72,
    maxColumnOccupancy: 0.98,
    prompt: `Primary request: Paint three distinct violet/cyan energy strands entering separately at the LEFT,
weaving toward one another, crossing, and converging into a narrow bright point at the RIGHT. Keep clear
negative space between the strands over most of the length. This is a braided convergence, never a cylinder.
Color palette: deep violet outer strands, arc-cyan inner strands, sparse white crossing highlights.
${COMMON}`,
  },
  {
    id: "pulse-train",
    minColumnOccupancy: 0.34,
    maxColumnOccupancy: 0.72,
    prompt: `Primary request: Paint a horizontal pulse train made from eight discrete luminous compass-diamond
and ring pulses. Alternate larger and smaller pulses with wide unmistakable green gaps between them. A few
hair-thin sparks may imply direction, but no continuous line, bar, trail, or tube may connect the pulses.
Color palette: pale gold, warm ivory, white-hot centers, tiny ochre edge accents.
${COMMON}`,
  },
  {
    id: "flame-tongues",
    minColumnOccupancy: 0.7,
    maxColumnOccupancy: 0.98,
    prompt: `Primary request: Paint a horizontal procession of overlapping forward-lapping flame tongues.
Every tongue has a distinct pointed crest and deep green negative-space notch, creating an irregular sawtooth
outer silhouette from LEFT to RIGHT. It must read as living fire tongues, not a smooth laser or cylinder.
Color palette: dark ember-red rims, saturated orange bodies, yellow-white hot inner lick accents.
${COMMON}`,
  },
  {
    id: "ice-particles",
    minColumnOccupancy: 0.78,
    maxColumnOccupancy: 0.99,
    prompt: `Primary request: Paint a dense horizontal stream made ENTIRELY from many separate ice particles:
faceted cyan crystal shards, tiny white snow motes, frost needles, and a few pale-blue feather-shaped flakes.
Particles overlap enough to make the full path readable, but preserve small green holes between them. There
must be no continuous beam core, ribbon, liquid stroke, cylinder, outline tube, or non-ice energy body.
Color palette: ice white, pale cyan, glacier blue, sparse navy crystal facets.
${COMMON}`,
  },
];

const options = { force: false, installOnly: false, only: undefined };
for (const argument of process.argv.slice(2)) {
  if (argument === "--force") options.force = true;
  else if (argument === "--install-only") options.installOnly = true;
  else if (argument.startsWith("--only=")) options.only = argument.slice("--only=".length);
  else if (argument === "--help" || argument === "-h") {
    console.log(
      "Usage: node tools/artkit/gen-v7-beam-structures.mjs [--only=<family>] [--force] [--install-only]",
    );
    process.exit(0);
  } else throw new Error(`Unknown argument: ${argument}`);
}

function renderFailed(logPath) {
  if (!existsSync(logPath)) return false;
  return /moderation_blocked|image generation failed|raster script failed|no image generated/i.test(
    readFileSync(logPath, "utf8"),
  );
}

async function removeChroma(rawPath, candidatePath) {
  const { data, info } = await sharp(rawPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let pixel = 0; pixel < info.width * info.height; pixel++) {
    const offset = pixel * info.channels;
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    const dominance = green - Math.max(red, blue);
    if (dominance > 88 && green > 128) {
      data[offset] = 0;
      data[offset + 1] = 0;
      data[offset + 2] = 0;
      data[offset + 3] = 0;
    } else if (dominance > 34 && green > 108) {
      const alpha = Math.max(0, Math.min(255, Math.round(255 * (1 - (dominance - 34) / 54))));
      data[offset + 1] = Math.max(red, blue);
      data[offset + 3] = Math.min(data[offset + 3], alpha);
    }
  }
  const keyed = await sharp(Buffer.from(data), {
    raw: { width: info.width, height: info.height, channels: info.channels },
  })
    .png()
    .toBuffer();
  await sharp(keyed)
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize({ width: 240, height: 80, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({ top: 8, bottom: 8, left: 8, right: 8, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(candidatePath);
  // Lanczos can reintroduce a handful of green-dominant antialias pixels after the first matte pass.
  // Despill the resized production pixels before validation; alpha and geometry remain unchanged.
  const resized = await sharp(candidatePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let pixel = 0; pixel < resized.info.width * resized.info.height; pixel++) {
    const offset = pixel * resized.info.channels;
    const red = resized.data[offset];
    const green = resized.data[offset + 1];
    const blue = resized.data[offset + 2];
    const neutralCeiling = Math.max(red, blue);
    if (green - neutralCeiling > 12) resized.data[offset + 1] = neutralCeiling;
  }
  const despilled = await sharp(Buffer.from(resized.data), {
    raw: {
      width: resized.info.width,
      height: resized.info.height,
      channels: resized.info.channels,
    },
  })
    .png({ compressionLevel: 9 })
    .toBuffer();
  writeFileSync(candidatePath, despilled);
}

async function validateSheet(filePath, job) {
  const image = sharp(filePath).ensureAlpha();
  const metadata = await image.metadata();
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  const columnActive = new Uint8Array(info.width);
  const columnAlphaMass = new Uint32Array(info.width);
  let visiblePixels = 0;
  let greenSpillPixels = 0;
  let minX = info.width;
  let minY = info.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const offset = (y * info.width + x) * info.channels;
      const alpha = data[offset + 3];
      if (alpha <= 48) continue;
      visiblePixels++;
      columnAlphaMass[x] += alpha;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      if (data[offset + 1] - Math.max(data[offset], data[offset + 2]) > 34) greenSpillPixels++;
    }
  }
  // A lone antialias glint does not make a longitudinal slice energetically occupied. Three opaque-pixel
  // equivalents is still sensitive to narrow strands while preserving the pulse/segment negative space.
  for (let x = 0; x < info.width; x++) columnActive[x] = columnAlphaMass[x] >= 3 * 255 ? 1 : 0;
  const occupiedColumns = columnActive.reduce((sum, value) => sum + value, 0);
  const columnOccupancy = occupiedColumns / Math.max(1, info.width);
  const failures = [];
  if (!metadata.hasAlpha) failures.push("missing alpha channel");
  if (info.width !== 256 || info.height !== 96) failures.push(`expected 256x96, got ${info.width}x${info.height}`);
  if (visiblePixels < 450) failures.push(`only ${visiblePixels} visible pixels`);
  if (greenSpillPixels > 0) failures.push(`${greenSpillPixels} green-spill pixels`);
  if (minX < 7 || minY < 7 || maxX > 248 || maxY > 88)
    failures.push(`alpha bounds ${minX},${minY}..${maxX},${maxY} breach the 7px inset`);
  if (columnOccupancy < job.minColumnOccupancy || columnOccupancy > job.maxColumnOccupancy)
    failures.push(
      `column occupancy ${columnOccupancy.toFixed(3)} outside ${job.minColumnOccupancy}-${job.maxColumnOccupancy}`,
    );
  return {
    valid: failures.length === 0,
    failures,
    width: info.width,
    height: info.height,
    visiblePixels,
    greenSpillPixels,
    alphaBounds: { minX, minY, maxX, maxY },
    columnOccupancy,
    columnSignature: Array.from(columnActive).map((value) => (value ? "1" : "0")).join(""),
  };
}

async function processJob(job) {
  const raw = resolve(sourceDir, `${job.id}-raw.png`);
  const candidate = resolve(sourceDir, `${job.id}-candidate.png`);
  const logPath = resolve(sourceDir, `${job.id}.codex.log`);
  const finalPath = resolve(installed, `${job.id}.png`);
  const survivor = resolve(sourceDir, `${job.id}-accepted-survivor.png`);

  if (!options.force && existsSync(finalPath)) {
    const current = await validateSheet(finalPath, job);
    if (current.valid)
      return { id: job.id, status: "VALID_EXISTING", prompt: job.prompt, acceptedCandidate: finalPath, ...current };
  }
  if (existsSync(finalPath)) copyFileSync(finalPath, survivor);
  if (options.force) {
    rmSync(raw, { force: true });
    rmSync(candidate, { force: true });
  }
  if (!existsSync(raw) && !options.installOnly) {
    const code = await runCodexExec({
      prompt: job.prompt,
      cwd: repo,
      label: `v7-beam-${job.id}`,
      harvestTo: raw,
      stdoutFile: logPath,
    });
    if (code !== 0 || !existsSync(raw) || renderFailed(logPath)) {
      if (existsSync(survivor)) copyFileSync(survivor, finalPath);
      return {
        id: job.id,
        status: "GENERATION_FAILED",
        prompt: job.prompt,
        sourceReference: "text-only Codex generation",
        acceptedCandidate: existsSync(survivor) ? survivor : null,
        failures: [`Codex generation failed with exit ${code}`],
      };
    }
  }
  if (!existsSync(raw)) {
    return {
      id: job.id,
      status: "MISSING_RAW",
      prompt: job.prompt,
      sourceReference: "text-only Codex generation",
      acceptedCandidate: null,
      failures: ["install-only requested but raw source is missing"],
    };
  }
  try {
    await removeChroma(raw, candidate);
    const validation = await validateSheet(candidate, job);
    if (!validation.valid) {
      if (existsSync(survivor)) copyFileSync(survivor, finalPath);
      return {
        id: job.id,
        status: "REJECTED",
        prompt: job.prompt,
        sourceReference: "text-only Codex generation",
        rawSource: raw,
        acceptedCandidate: existsSync(survivor) ? survivor : null,
        ...validation,
      };
    }
    copyFileSync(candidate, finalPath);
    rmSync(survivor, { force: true });
    return {
      id: job.id,
      status: "VALID",
      prompt: job.prompt,
      sourceReference: "text-only Codex generation",
      rawSource: raw,
      acceptedCandidate: finalPath,
      ...validation,
    };
  } catch (error) {
    if (existsSync(survivor)) copyFileSync(survivor, finalPath);
    return {
      id: job.id,
      status: "PROCESSING_FAILED",
      prompt: job.prompt,
      sourceReference: "text-only Codex generation",
      rawSource: raw,
      acceptedCandidate: existsSync(survivor) ? survivor : null,
      failures: [error instanceof Error ? error.message : String(error)],
    };
  }
}

async function buildContactSheet(outcomes) {
  const valid = outcomes.filter((outcome) => outcome.valid && outcome.acceptedCandidate);
  if (valid.length === 0) return null;
  const rowHeight = 132;
  const width = 640;
  const composites = [];
  for (let index = 0; index < valid.length; index++) {
    const outcome = valid[index];
    const top = index * rowHeight;
    const png = await sharp(outcome.acceptedCandidate)
      .resize({ width: 512, height: 96, fit: "fill" })
      .png()
      .toBuffer();
    composites.push({ input: png, left: 112, top: top + 28 });
    const label = Buffer.from(
      `<svg width="640" height="132"><text x="12" y="22" fill="#f4f4f4" font-family="monospace" font-size="16">${outcome.id} · occupancy ${outcome.columnOccupancy.toFixed(3)}</text></svg>`,
    );
    composites.push({ input: label, left: 0, top });
  }
  const target = resolve(evidence, "generated-structure-contact-sheet.png");
  await sharp({
    create: { width, height: valid.length * rowHeight, channels: 4, background: "#161220" },
  })
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toFile(target);
  return target;
}

const selected = options.only ? jobs.filter((job) => job.id === options.only) : jobs;
if (selected.length === 0) throw new Error(`Unknown beam structure family: ${options.only}`);
writeFileSync(
  resolve(evidence, "generated-structure-prompts.json"),
  `${JSON.stringify(selected.map(({ id, prompt }) => ({ id, prompt })), null, 2)}\n`,
);
const outcomes = [];
for (const job of selected) outcomes.push(await processJob(job));
const contactSheet = await buildContactSheet(outcomes);
writeFileSync(
  resolve(evidence, "generated-structure-outcomes.json"),
  `${JSON.stringify({ generatedAt: new Date().toISOString(), contactSheet, outcomes }, null, 2)}\n`,
);
console.table(
  outcomes.map(({ id, status, width, height, columnOccupancy, failures }) => ({
    id,
    status,
    size: width && height ? `${width}x${height}` : "-",
    occupancy: columnOccupancy?.toFixed(3) ?? "-",
    failures: failures?.join("; ") ?? "",
  })),
);
if (outcomes.some((outcome) => !outcome.valid)) process.exitCode = 1;
