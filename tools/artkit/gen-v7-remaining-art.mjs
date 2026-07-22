#!/usr/bin/env node
// V7 remaining identity-art render farm.
//
// Generates only the bitmap assets leased to v7-generated-identity-art. Each render receives an
// isolated CODEX_HOME and an attempt-local cwd under out/v7-remaining. Existing weapon art is a
// generation reference only; it is never cropped or traced into the new art. A production survivor
// is restored after failed retries, and a candidate is installed only after measured alpha,
// silhouette, spill, aspect, coverage, and game-scale readability checks pass.

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { configureCodex, runCodexExec } from "./lib/codex.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../..");
const manifestPath = resolve(here, "subjects-v7-remaining.json");
const outRoot = resolve(here, "out/v7-remaining");
const evidenceRoot = resolve(repo, "docs/owner-notes-audit-v7-evidence/generated-art");
const outcomesPath = resolve(outRoot, "render-outcomes.json");
const evidenceOutcomesPath = resolve(evidenceRoot, "generation-outcomes.json");
const contactSheetPath = resolve(evidenceRoot, "v7-remaining-contact-sheet.jpg");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const jobs = manifest.jobs;

const options = {
  only: undefined,
  force: false,
  validateOnly: false,
  maxAttempts: 3,
  concurrency: 3,
};
for (const arg of process.argv.slice(2)) {
  if (arg === "--force") options.force = true;
  else if (arg === "--validate-only") options.validateOnly = true;
  else if (arg.startsWith("--only=")) options.only = arg.slice(7);
  else if (arg.startsWith("--max-attempts=")) options.maxAttempts = Number(arg.slice(15));
  else if (arg.startsWith("--concurrency=")) options.concurrency = Number(arg.slice(14));
  else if (arg === "--help" || arg === "-h") {
    console.log(
      "Usage: node tools/artkit/gen-v7-remaining-art.mjs [--only=<id>] [--force] " +
        "[--max-attempts=1..3] [--concurrency=1..3] [--validate-only]",
    );
    process.exit(0);
  } else throw new Error(`Unknown argument: ${arg}`);
}
if (!Number.isInteger(options.maxAttempts) || options.maxAttempts < 1 || options.maxAttempts > 3)
  throw new Error("--max-attempts must be an integer from 1 to 3");
if (!Number.isInteger(options.concurrency) || options.concurrency < 1 || options.concurrency > 3)
  throw new Error("--concurrency must be an integer from 1 to 3");
if (!Array.isArray(jobs) || jobs.length !== 19) throw new Error(`Expected exactly 19 jobs, got ${jobs?.length}`);
if (new Set(jobs.map((job) => job.id)).size !== jobs.length) throw new Error("Duplicate V7 job id");
if (new Set(jobs.map((job) => job.output)).size !== jobs.length) throw new Error("Duplicate V7 output path");

mkdirSync(outRoot, { recursive: true });
mkdirSync(evidenceRoot, { recursive: true });
configureCodex({ perChatRoot: resolve(outRoot, ".codex-homes"), log: console.log });

const toRepoPath = (path) => relative(repo, path).replaceAll("\\", "/");
const absoluteRepoPath = (path) => resolve(repo, path);
const priorOutcomeDocument = existsSync(outcomesPath)
  ? JSON.parse(readFileSync(outcomesPath, "utf8"))
  : { jobs: [] };
const priorById = new Map((priorOutcomeDocument.jobs ?? []).map((entry) => [entry.id, entry]));
const outcomeById = new Map();

function renderPrompt(job) {
  const referenceLines = job.references.length
    ? `Input images: ${job.references.map((_, index) => `Image ${index + 1}`).join(", ")} are reference images. ${job.referenceRole}`
    : "Input images: none.";
  return `Use case: stylized-concept
Asset type: Dimension Drifters ${job.kind} production sprite
Primary request: ${job.prompt}
${referenceLines}
Style/medium: ${manifest.style}.
Scene/backdrop: perfectly flat solid ${job.keyColor} chroma-key background for deterministic local removal.
Composition/framing: keep the one complete subject fully visible and separated from every canvas edge with generous uniform padding.
Constraints: the backdrop is one exact flat color with no shadow, gradient, texture, reflection, floor, lighting variation, vignette, checkerboard, or border; do not use ${job.keyColor} in the subject; no watermark; no signature; no readable text; no extra subject; no contact sheet; no baked rectangular background; no soft bloom extending into the backdrop.
Pipeline contract: use Codex's built-in image generation tool to generate the requested raster image. Generate the image only. Do not use Python, SVG, canvas, or procedural drawing. Do not copy, install, crop, trace, edit, or write any repository file because the parent artkit harvester exclusively owns post-processing and installation.`;
}

function disallowedRenderLog(path) {
  if (!existsSync(path)) return false;
  return /moderation_blocked|image generation failed|System\.Drawing\.Bitmap|PIL unavailable|raster script failed|cannot use the image generation tool/i.test(
    readFileSync(path, "utf8"),
  );
}

function keyDominance(red, green, blue, keyColor) {
  if (keyColor.toLowerCase() === "#ff00ff") return Math.min(red, blue) - green;
  return green - Math.max(red, blue);
}

async function scrubChroma(rawPath, candidatePath, job) {
  const { data, info } = await sharp(rawPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let offset = 0; offset < data.length; offset += info.channels) {
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    const dominance = keyDominance(red, green, blue, job.keyColor);
    if (dominance >= 86) {
      data[offset] = 0;
      data[offset + 1] = 0;
      data[offset + 2] = 0;
      data[offset + 3] = 0;
    } else if (dominance > 34) {
      const remaining = Math.max(0, Math.min(1, (86 - dominance) / 52));
      data[offset + 3] = Math.round(data[offset + 3] * remaining);
      if (job.keyColor.toLowerCase() === "#ff00ff") {
        const neutral = Math.max(green, Math.min(red, blue));
        data[offset] = Math.min(data[offset], neutral);
        data[offset + 2] = Math.min(data[offset + 2], neutral);
      } else {
        data[offset + 1] = Math.min(data[offset + 1], Math.max(red, blue));
      }
    }
  }
  const keyed = await sharp(Buffer.from(data), {
    raw: { width: info.width, height: info.height, channels: info.channels },
  })
    .png()
    .toBuffer();
  await sharp(keyed)
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize({
      width: job.maxWidth,
      height: job.maxHeight,
      fit: "inside",
      withoutEnlargement: false,
      kernel: sharp.kernel.lanczos3,
    })
    .extend({ top: 8, bottom: 8, left: 8, right: 8, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(candidatePath);
}

function alphaBounds(data, info, threshold = 64) {
  let minX = info.width;
  let minY = info.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const alpha = data[(y * info.width + x) * info.channels + 3];
      if (alpha <= threshold) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX < minX || maxY < minY) return null;
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

async function gameScaleMeasure(path) {
  const { data, info } = await sharp(path)
    .ensureAlpha()
    .resize({ width: 64, height: 64, fit: "contain" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  let visiblePixels = 0;
  for (let offset = 0; offset < data.length; offset += info.channels)
    if (data[offset + 3] > 64) visiblePixels++;
  return { width: info.width, height: info.height, visiblePixels, alphaBounds: alphaBounds(data, info) };
}

async function validateAsset(path, job) {
  if (!existsSync(path)) return { valid: false, failures: ["missing file"] };
  const image = sharp(path).ensureAlpha();
  const metadata = await image.metadata();
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  let transparentPixels = 0;
  let visiblePixels = 0;
  let keySpillPixels = 0;
  for (let offset = 0; offset < data.length; offset += info.channels) {
    const alpha = data[offset + 3];
    if (alpha === 0) transparentPixels++;
    if (alpha > 64) {
      visiblePixels++;
      if (keyDominance(data[offset], data[offset + 1], data[offset + 2], job.keyColor) > 40)
        keySpillPixels++;
    }
  }
  const bounds = alphaBounds(data, info);
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  const aspect = bounds ? bounds.width / bounds.height : 0;
  const coverage = bounds ? visiblePixels / (bounds.width * bounds.height) : 0;
  const cornerOffsets = [
    3,
    (info.width - 1) * info.channels + 3,
    ((info.height - 1) * info.width) * info.channels + 3,
    (info.height * info.width - 1) * info.channels + 3,
  ];
  const cornerAlpha = cornerOffsets.map((offset) => data[offset]);
  const gameScale = await gameScaleMeasure(path);
  const failures = [];
  if (!metadata.hasAlpha) failures.push("missing alpha");
  if (!width || !height || !bounds) failures.push("empty dimensions or alpha bounds");
  if (bounds && (aspect < job.minAspect || aspect > job.maxAspect))
    failures.push(`alpha aspect ${aspect.toFixed(3)} outside ${job.minAspect}-${job.maxAspect}`);
  if (width > job.maxWidth + 16 || height > job.maxHeight + 16)
    failures.push(`oversize ${width}x${height} beyond content cap ${job.maxWidth}x${job.maxHeight} + padding`);
  if (transparentPixels === 0) failures.push("no transparent pixels");
  if (cornerAlpha.some((alpha) => alpha > 8)) failures.push(`nontransparent corner alpha ${cornerAlpha.join(",")}`);
  if (visiblePixels < job.minVisiblePixels)
    failures.push(`only ${visiblePixels} visible pixels; need ${job.minVisiblePixels}`);
  if (coverage < job.minCoverage)
    failures.push(`alpha coverage ${coverage.toFixed(3)} below ${job.minCoverage}`);
  if (keySpillPixels > 0) failures.push(`${keySpillPixels} ${job.keyColor} spill pixels`);
  if (gameScale.visiblePixels < job.minGameScalePixels)
    failures.push(`only ${gameScale.visiblePixels} visible pixels at 64px game-scale probe; need ${job.minGameScalePixels}`);
  return {
    valid: failures.length === 0,
    failures,
    width,
    height,
    aspect,
    visiblePixels,
    transparentPixels,
    coverage,
    keyColor: job.keyColor,
    keySpillPixels,
    cornerAlpha,
    alphaBounds: bounds,
    gameScale,
  };
}

function outcomeDocument(extra = {}) {
  return {
    schemaVersion: 1,
    program: manifest.program,
    sourceOrder: manifest.sourceOrder,
    generatedAt: new Date().toISOString(),
    generationMode: manifest.generationMode,
    supplierLiveGate: "none; consuming Sol must prove installed texture live with measured motion/geometry",
    jobs: jobs.map((job) => outcomeById.get(job.id) ?? priorById.get(job.id) ?? {
      id: job.id,
      name: job.name,
      status: "PENDING",
      prompt: renderPrompt(job),
      sourceReferences: job.references,
      acceptedCandidate: null,
      attempts: [],
    }),
    ...extra,
  };
}

function persistOutcomes(extra = {}) {
  const document = outcomeDocument(extra);
  const json = `${JSON.stringify(document, null, 2)}\n`;
  writeFileSync(outcomesPath, json);
  writeFileSync(evidenceOutcomesPath, json);
}

async function renderJob(job) {
  const productionPath = absoluteRepoPath(job.output);
  const jobRoot = resolve(outRoot, job.id);
  const survivorPath = resolve(jobRoot, "accepted-survivor.png");
  mkdirSync(jobRoot, { recursive: true });
  const prior = priorById.get(job.id);
  const prompt = renderPrompt(job);
  const existingValidation = await validateAsset(productionPath, job);
  if (!options.force && existingValidation.valid) {
    return {
      ...(prior ?? {}),
      id: job.id,
      name: job.name,
      kind: job.kind,
      weaponId: job.weaponId,
      order: job.order,
      status: "VALID_EXISTING",
      prompt,
      sourceReferences: job.references,
      referenceRole: job.referenceRole,
      output: job.output,
      acceptedCandidate: prior?.acceptedCandidate ?? job.output,
      attempts: prior?.attempts ?? [],
      finalValidation: existingValidation,
    };
  }

  if (existingValidation.valid) copyFileSync(productionPath, survivorPath);
  const attempts = [...(prior?.attempts ?? [])];
  let lastValidation = existingValidation;
  const attemptOrder = job.preferredAttempt
    ? [
        job.preferredAttempt,
        ...Array.from({ length: options.maxAttempts }, (_, index) => index + 1).filter(
          (attempt) => attempt !== job.preferredAttempt,
        ),
      ]
    : Array.from({ length: options.maxAttempts }, (_, index) => index + 1);
  for (const attempt of attemptOrder) {
    const attemptRoot = resolve(jobRoot, `attempt-${attempt}`);
    const rawPath = resolve(attemptRoot, "raw.png");
    const candidatePath = resolve(attemptRoot, "candidate.png");
    const logPath = resolve(attemptRoot, "codex.log");
    const reportPath = resolve(attemptRoot, "codex-report.md");
    mkdirSync(attemptRoot, { recursive: true });
    if (options.force) {
      rmSync(rawPath, { force: true });
      rmSync(candidatePath, { force: true });
      rmSync(logPath, { force: true });
      rmSync(reportPath, { force: true });
    }
    let exitCode = 0;
    if (!existsSync(rawPath)) {
      console.log(`RENDER ${job.id} attempt ${attempt}/${options.maxAttempts}`);
      exitCode = await runCodexExec({
        prompt,
        images: job.references.map(absoluteRepoPath),
        cwd: attemptRoot,
        label: `v7-remaining-${job.id}-a${attempt}`,
        harvestTo: rawPath,
        reportFile: reportPath,
        stdoutFile: logPath,
      });
    }
    const attemptRecord = {
      attempt,
      raw: existsSync(rawPath) ? toRepoPath(rawPath) : null,
      candidate: null,
      outcome: "RENDER_FAILED",
      exitCode,
      failures: [],
      validation: null,
    };
    if (exitCode !== 0 || !existsSync(rawPath) || disallowedRenderLog(logPath)) {
      attemptRecord.failures = [`Codex render failed or was disallowed (exit ${exitCode})`];
      attempts[attempt - 1] = attemptRecord;
      continue;
    }
    try {
      await scrubChroma(rawPath, candidatePath, job);
      const validation = await validateAsset(candidatePath, job);
      lastValidation = validation;
      attemptRecord.candidate = toRepoPath(candidatePath);
      attemptRecord.validation = validation;
      attemptRecord.outcome = validation.valid ? "ACCEPTED" : "REJECTED";
      attemptRecord.failures = validation.failures;
      attempts[attempt - 1] = attemptRecord;
      if (!validation.valid) {
        console.log(`REJECT ${job.id} attempt ${attempt}: ${validation.failures.join(", ")}`);
        continue;
      }
      mkdirSync(dirname(productionPath), { recursive: true });
      copyFileSync(candidatePath, productionPath);
      rmSync(survivorPath, { force: true });
      console.log(`VALID ${job.id} attempt ${attempt} -> ${validation.width}x${validation.height}`);
      return {
        id: job.id,
        name: job.name,
        kind: job.kind,
        weaponId: job.weaponId,
        order: job.order,
        status: "VALID",
        prompt,
        sourceReferences: job.references,
        referenceRole: job.referenceRole,
        output: job.output,
        acceptedCandidate: toRepoPath(candidatePath),
        attempts,
        finalValidation: validation,
      };
    } catch (error) {
      attemptRecord.outcome = "PROCESSING_FAILED";
      attemptRecord.failures = [error.message];
      attempts[attempt - 1] = attemptRecord;
      console.log(`REJECT ${job.id} attempt ${attempt}: ${error.message}`);
    }
  }

  if (existsSync(survivorPath)) {
    mkdirSync(dirname(productionPath), { recursive: true });
    copyFileSync(survivorPath, productionPath);
    rmSync(survivorPath, { force: true });
    const restoredValidation = await validateAsset(productionPath, job);
    return {
      id: job.id,
      name: job.name,
      kind: job.kind,
      weaponId: job.weaponId,
      order: job.order,
      status: restoredValidation.valid ? "VALID_SURVIVOR" : "FAILED",
      prompt,
      sourceReferences: job.references,
      referenceRole: job.referenceRole,
      output: job.output,
      acceptedCandidate: job.output,
      attempts,
      finalValidation: restoredValidation,
    };
  }
  return {
    id: job.id,
    name: job.name,
    kind: job.kind,
    weaponId: job.weaponId,
    order: job.order,
    status: "FAILED",
    prompt,
    sourceReferences: job.references,
    referenceRole: job.referenceRole,
    output: job.output,
    acceptedCandidate: null,
    attempts,
    finalValidation: lastValidation,
  };
}

async function normalizedAlphaMask(path, size = 64) {
  const trimmed = await sharp(path)
    .ensureAlpha()
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize({ width: size, height: size, fit: "contain" })
    .extractChannel("alpha")
    .raw()
    .toBuffer();
  return Uint8Array.from(trimmed, (value) => (value > 64 ? 1 : 0));
}

async function validateStarDistinctness() {
  const starJobs = jobs.filter((job) => job.starFamily);
  const masks = new Map();
  for (const job of starJobs) {
    const path = absoluteRepoPath(job.output);
    if (!existsSync(path)) continue;
    masks.set(job.id, await normalizedAlphaMask(path));
  }
  const pairs = [];
  for (let left = 0; left < starJobs.length; left++) {
    for (let right = left + 1; right < starJobs.length; right++) {
      const a = masks.get(starJobs[left].id);
      const b = masks.get(starJobs[right].id);
      if (!a || !b || a.length !== b.length) {
        pairs.push({ a: starJobs[left].id, b: starJobs[right].id, valid: false, reason: "missing mask" });
        continue;
      }
      let intersection = 0;
      let union = 0;
      let xor = 0;
      for (let index = 0; index < a.length; index++) {
        if (a[index] && b[index]) intersection++;
        if (a[index] || b[index]) union++;
        if (a[index] !== b[index]) xor++;
      }
      const iou = union ? intersection / union : 1;
      const xorRatio = union ? xor / union : 0;
      pairs.push({
        a: starJobs[left].id,
        b: starJobs[right].id,
        iou,
        xorRatio,
        valid: iou < 0.82 && xorRatio > 0.12,
      });
    }
  }
  return { valid: pairs.length === 6 && pairs.every((pair) => pair.valid), pairs };
}

function escapeSvg(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function writeContactSheet() {
  if (jobs.some((job) => !existsSync(absoluteRepoPath(job.output)))) return false;
  const columns = 4;
  const tileWidth = 320;
  const tileHeight = 230;
  const gap = 16;
  const rows = Math.ceil(jobs.length / columns);
  const composites = [];
  for (let index = 0; index < jobs.length; index++) {
    const job = jobs[index];
    const path = absoluteRepoPath(job.output);
    const art = await sharp(path)
      .resize({
        width: tileWidth - 32,
        height: tileHeight - 72,
        fit: "inside",
      })
      .toBuffer();
    const artMeta = await sharp(art).metadata();
    const productionMeta = await sharp(path).metadata();
    const label = Buffer.from(
      `<svg width="${tileWidth}" height="58">` +
        `<rect width="100%" height="100%" rx="7" fill="#22252b"/>` +
        `<text x="${tileWidth / 2}" y="22" text-anchor="middle" font-family="Arial, sans-serif" font-size="15" font-weight="700" fill="#f4e8bf">${escapeSvg(`${index + 1}. ${job.id}`)}</text>` +
        `<text x="${tileWidth / 2}" y="43" text-anchor="middle" font-family="Arial, sans-serif" font-size="13" fill="#8fe7ff">${escapeSvg(`${job.kind} · ${productionMeta.width}x${productionMeta.height}`)}</text>` +
        `</svg>`,
    );
    const column = index % columns;
    const row = Math.floor(index / columns);
    const left = gap + column * (tileWidth + gap);
    const top = gap + row * (tileHeight + gap);
    composites.push({
      input: art,
      left: left + Math.round((tileWidth - (artMeta.width ?? 0)) / 2),
      top: top + Math.round((tileHeight - 68 - (artMeta.height ?? 0)) / 2),
    });
    composites.push({ input: label, left, top: top + tileHeight - 62 });
  }
  const width = columns * tileWidth + (columns + 1) * gap;
  const height = rows * tileHeight + (rows + 1) * gap;
  await sharp({
    create: { width, height, channels: 4, background: { r: 26, g: 19, b: 32, alpha: 1 } },
  })
    .composite(composites)
    .flatten({ background: { r: 26, g: 19, b: 32 } })
    .jpeg({ quality: 90, chromaSubsampling: "4:4:4" })
    .toFile(contactSheetPath);
  return true;
}

async function validateAllProduction() {
  for (const job of jobs) {
    const prior = outcomeById.get(job.id) ?? priorById.get(job.id) ?? {};
    const finalValidation = await validateAsset(absoluteRepoPath(job.output), job);
    outcomeById.set(job.id, {
      ...prior,
      id: job.id,
      name: job.name,
      kind: job.kind,
      weaponId: job.weaponId,
      order: job.order,
      status: finalValidation.valid ? (prior.status?.startsWith("VALID") ? prior.status : "VALID") : "INVALID",
      prompt: renderPrompt(job),
      sourceReferences: job.references,
      referenceRole: job.referenceRole,
      output: job.output,
      acceptedCandidate: prior.acceptedCandidate ?? (finalValidation.valid ? job.output : null),
      attempts: prior.attempts ?? [],
      finalValidation,
    });
  }
}

const selected = options.only ? jobs.filter((job) => job.id === options.only) : jobs;
if (options.only && selected.length !== 1) throw new Error(`Unknown V7 asset id ${options.only}`);

if (!options.validateOnly) {
  let nextJob = 0;
  async function worker() {
    for (;;) {
      const job = selected[nextJob++];
      if (!job) return;
      const outcome = await renderJob(job);
      outcomeById.set(job.id, outcome);
      persistOutcomes();
    }
  }
  await Promise.all(Array.from({ length: Math.min(options.concurrency, selected.length) }, worker));
}

await validateAllProduction();
const starDistinctness = await validateStarDistinctness();
const contactSheet = await writeContactSheet();
persistOutcomes({
  contactSheet: contactSheet ? toRepoPath(contactSheetPath) : null,
  starDistinctness,
});

const outcomes = jobs.map((job) => outcomeById.get(job.id));
console.table(
  outcomes.map(({ id, status, acceptedCandidate, finalValidation }) => ({
    id,
    status,
    size:
      finalValidation?.width && finalValidation?.height
        ? `${finalValidation.width}x${finalValidation.height}`
        : "-",
    accepted: acceptedCandidate ?? "-",
    failures: finalValidation?.failures?.join("; ") ?? "",
  })),
);
console.log(`contact sheet: ${contactSheet ? toRepoPath(contactSheetPath) : "MISSING"}`);
console.log(`four-star silhouette distinctness: ${starDistinctness.valid ? "VALID" : "INVALID"}`);
if (
  outcomes.some((outcome) => !outcome.finalValidation?.valid) ||
  !contactSheet ||
  !starDistinctness.valid
)
  process.exitCode = 1;
