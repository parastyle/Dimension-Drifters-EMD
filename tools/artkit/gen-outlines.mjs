#!/usr/bin/env node
// artkit/gen-outlines.mjs — install a consistent exterior cartoon rim on character/game sprite PNGs.
//
// The --width value is the dilation radius at a 512px canvas scale. Per image, the actual radius is:
//   max(1, round(width * max(canvasWidth, canvasHeight) / 512))
// Thus the default --width=4 gives 1px at 128px, 2px at 256px, 4px at 512px, and 8px at 1024px.
// Original RGBA bytes are retained at every pixel whose original alpha is nonzero. The #101014 rim is
// written at full alpha only into previously transparent pixels reached by a circular alpha dilation.
//
// Resumable/idempotent: processed.json records original and installed SHA-256 hashes. A matching installed
// hash is never processed twice. Originals are archived at out/outlines/originals/<repo-relative-path>.
//
//   node tools/artkit/gen-outlines.mjs [--width=4] [--dry-run] [--only=<repo-relative-substring>]
//   node tools/artkit/gen-outlines.mjs --restore [--force] [--only=<repo-relative-substring>]
//
// After either outlining or restoring sprite parts, repack the derived atlas:
//   node tools/artkit/pack-atlas.mjs

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const HERE = resolve(dirname(fileURLToPath(import.meta.url)));
const REPO = resolve(HERE, "../..");
const SPRITES = resolve(REPO, "packages/client/public/sprites");
const VFX = resolve(REPO, "packages/client/public/vfx");
const OUT = resolve(HERE, "out/outlines");
const ORIGINALS = resolve(OUT, "originals");
const HISTORY = resolve(OUT, "history");
const MANIFEST_PATH = resolve(OUT, "processed.json");
const DEFAULT_WIDTH = 4;
const REFERENCE_CANVAS = 512;
const OUTLINE_RGBA = [0x10, 0x10, 0x14, 0xff];
const ATLAS_PAGE = /^dd-sprites(?:-\d+)?\.png$/i;

// Object-like hero art only. Effects, glows, gradients, and non-hero sheets stay unmodified.
const VFX_OBJECT_HEROES = new Map([
  ["quake-tombstone.png", "solid quake-stone objects"],
  ["x-sword-buzzsaw.png", "solid buzzsaw and debris hero object"],
  ["x-sword-coffin.png", "solid skeletal-hand hero objects"],
]);
const VFX_SKIP_REASONS = new Map([
  ["driftblade.png", "painted slash/energy arc, not a discrete object"],
  ["rattler-sabre.png", "spectral serpent/energy trail, not a discrete object"],
  ["x-sword-bone-scatter.png", "scatter animation sheet, not a hero image"],
]);

function repoPath(path) {
  return relative(REPO, path).split(sep).join("/");
}

function absoluteRepoPath(path) {
  const absolute = resolve(REPO, path);
  const rel = relative(REPO, absolute);
  if (rel.startsWith(`..${sep}`) || rel === "..") throw new Error(`path escapes repository: ${path}`);
  return absolute;
}

function hashBuffer(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function hashFile(path) {
  return hashBuffer(readFileSync(path));
}

function walkPngs(root) {
  const files = [];
  const walk = (directory) => {
    if (!existsSync(directory)) return;
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile() && entry.name.toLowerCase().endsWith(".png")) files.push(path);
    }
  };
  walk(root);
  return files.sort((a, b) => repoPath(a).localeCompare(repoPath(b)));
}

function parseOptions(argv) {
  const options = { width: DEFAULT_WIDTH, restore: false, dryRun: false, force: false, only: null };
  for (const arg of argv) {
    if (arg === "--restore") options.restore = true;
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--force") options.force = true;
    else if (arg.startsWith("--width=")) options.width = Number(arg.slice(8));
    else if (arg.startsWith("--only=")) options.only = arg.slice(7).replaceAll("\\", "/");
    else if (arg === "--help" || arg === "-h") {
      console.log("Usage: node tools/artkit/gen-outlines.mjs [--width=4] [--dry-run] [--only=path]");
      console.log("       node tools/artkit/gen-outlines.mjs --restore [--force] [--only=path]");
      process.exit(0);
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!Number.isFinite(options.width) || options.width <= 0 || options.width > 64) {
    throw new Error(`--width must be greater than 0 and at most 64; got ${options.width}`);
  }
  if (options.restore && options.dryRun) throw new Error("--restore and --dry-run cannot be combined");
  if (options.force && !options.restore) throw new Error("--force is accepted only with --restore");
  return options;
}

function loadManifest() {
  if (!existsSync(MANIFEST_PATH)) {
    return {
      schemaVersion: 1,
      outlineColor: "#101014",
      widthScaleRule: "radiusPx=max(1,round(baseWidth*max(canvasWidth,canvasHeight)/512))",
      files: {},
    };
  }
  const parsed = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
  if (parsed.schemaVersion !== 1 || !parsed.files || typeof parsed.files !== "object") {
    throw new Error(`unsupported outline manifest: ${repoPath(MANIFEST_PATH)}`);
  }
  return parsed;
}

function saveManifest(manifest) {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
}

function discoverTargets(only) {
  const targets = [];
  const skips = [];
  for (const path of walkPngs(SPRITES)) {
    const rel = repoPath(path);
    if (ATLAS_PAGE.test(path.slice(path.lastIndexOf(sep) + 1)) && dirname(path) === SPRITES) {
      skips.push({ path: rel, reason: "derived atlas page; regenerated after loose parts" });
    } else {
      targets.push({ path, rel, kind: "sprite", reason: "character/game sprite part" });
    }
  }
  // The requested VFX scope is public/vfx/*.png (top-level hero images), not recursive particle packs.
  for (const path of walkPngs(VFX).filter((candidate) => dirname(candidate) === VFX)) {
    const rel = repoPath(path);
    const name = path.slice(path.lastIndexOf(sep) + 1);
    const reason = VFX_OBJECT_HEROES.get(name);
    if (reason) targets.push({ path, rel, kind: "vfx-object-hero", reason });
    else skips.push({
      path: rel,
      reason: VFX_SKIP_REASONS.get(name) ?? "unreviewed VFX image; object-hero allowlist only",
    });
  }
  const selectedTargets = only ? targets.filter((item) => item.rel.includes(only)) : targets;
  const selectedSkips = only ? skips.filter((item) => item.path.includes(only)) : skips;
  return { targets: selectedTargets, skips: selectedSkips };
}

function actualRadius(baseWidth, width, height) {
  return Math.max(1, Math.round(baseWidth * Math.max(width, height) / REFERENCE_CANVAS));
}

function circularKernel(radius) {
  const size = radius * 2 + 1;
  const kernel = [];
  for (let y = -radius; y <= radius; y++) {
    for (let x = -radius; x <= radius; x++) kernel.push(x * x + y * y <= radius * radius ? 1 : 0);
  }
  return { width: size, height: size, kernel, scale: 1 };
}

async function renderOutline(input, baseWidth) {
  const decoded = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { data: original, info } = decoded;
  const { width, height } = info;
  const radius = actualRadius(baseWidth, width, height);
  const { data: dilated } = await sharp(original, { raw: { width, height, channels: 4 } })
    .extractChannel(3)
    .threshold(1)
    .convolve(circularKernel(radius))
    .threshold(1)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const output = Buffer.from(original);
  let visibleBefore = 0;
  let opaqueBefore = 0;
  let rimPixels = 0;
  for (let pixel = 0, offset = 0; pixel < width * height; pixel++, offset += 4) {
    const alpha = original[offset + 3];
    if (alpha > 0) visibleBefore++;
    if (alpha === 255) opaqueBefore++;
    // Strictly outside the original alpha silhouette: even a 1/255 antialias pixel remains untouched.
    if (alpha === 0 && dilated[pixel] > 0) {
      output[offset] = OUTLINE_RGBA[0];
      output[offset + 1] = OUTLINE_RGBA[1];
      output[offset + 2] = OUTLINE_RGBA[2];
      output[offset + 3] = OUTLINE_RGBA[3];
      rimPixels++;
    }
  }
  if (visibleBefore === 0) throw new Error("image has no visible alpha silhouette");

  const png = await sharp(output, { raw: { width, height, channels: 4 } }).png().toBuffer();
  const check = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (check.info.width !== width || check.info.height !== height) throw new Error("outline changed canvas dimensions");
  for (let offset = 0; offset < original.length; offset += 4) {
    if (original[offset + 3] === 0) continue;
    if (
      check.data[offset] !== original[offset]
      || check.data[offset + 1] !== original[offset + 1]
      || check.data[offset + 2] !== original[offset + 2]
      || check.data[offset + 3] !== original[offset + 3]
    ) throw new Error(`original art pixel changed at RGBA byte offset ${offset}`);
  }
  return {
    png,
    width,
    height,
    radius,
    rimPixels,
    visibleBefore,
    visibleAfter: visibleBefore + rimPixels,
    opaqueBefore,
    opaqueAfter: opaqueBefore + rimPixels,
  };
}

function knownOutlinedHash(entry, hash) {
  return entry?.outlinedHash === hash || entry?.history?.some((item) => item.outlinedHash === hash);
}

function archiveCurrent(target, currentHash, entry) {
  const archive = resolve(ORIGINALS, target.rel);
  if (existsSync(archive)) {
    const archiveHash = hashFile(archive);
    if (archiveHash !== currentHash) {
      const historyPath = resolve(HISTORY, archiveHash, target.rel);
      if (!existsSync(historyPath)) {
        mkdirSync(dirname(historyPath), { recursive: true });
        copyFileSync(archive, historyPath);
      }
    }
  }
  mkdirSync(dirname(archive), { recursive: true });
  copyFileSync(target.path, archive);
  if (hashFile(archive) !== currentHash) throw new Error(`archive hash mismatch for ${target.rel}`);
  return { archive, priorHistory: entry ? [...(entry.history ?? []), {
    originalHash: entry.originalHash,
    outlinedHash: entry.outlinedHash,
    processedAt: entry.processedAt,
  }] : [] };
}

async function processTargets(options, manifest, targets, skips) {
  let processed = 0;
  let alreadyOutlined = 0;
  let failed = 0;
  let rimPixels = 0;
  const widthCounts = new Map();
  console.log(
    `OUTLINE CONFIG color=#101014 baseWidth=${options.width} scale=`
      + "max(1,round(baseWidth*max(canvasWidth,canvasHeight)/512))",
  );
  console.log(`DISCOVERED targets=${targets.length} policySkips=${skips.length}`);
  for (const skip of skips) console.log(`SKIP ${skip.path}: ${skip.reason}`);

  for (const [index, target] of targets.entries()) {
    try {
      const input = readFileSync(target.path);
      const currentHash = hashBuffer(input);
      const entry = manifest.files[target.rel];
      if (knownOutlinedHash(entry, currentHash)) {
        alreadyOutlined++;
        continue;
      }
      const rendered = await renderOutline(input, options.width);
      widthCounts.set(rendered.radius, (widthCounts.get(rendered.radius) ?? 0) + 1);
      if (options.dryRun) {
        processed++;
        rimPixels += rendered.rimPixels;
        continue;
      }

      let archive = resolve(ORIGINALS, target.rel);
      let history = entry?.history ?? [];
      if (!entry || currentHash !== entry.originalHash || !existsSync(archive) || hashFile(archive) !== currentHash) {
        const archived = archiveCurrent(target, currentHash, entry);
        archive = archived.archive;
        history = archived.priorHistory;
      }
      const outlinedHash = hashBuffer(rendered.png);
      const nextEntry = {
        kind: target.kind,
        selectionReason: target.reason,
        originalHash: currentHash,
        outlinedHash,
        archive: repoPath(archive),
        widthBaseAt512: options.width,
        radiusPx: rendered.radius,
        width: rendered.width,
        height: rendered.height,
        rimPixels: rendered.rimPixels,
        visibleBefore: rendered.visibleBefore,
        visibleAfter: rendered.visibleAfter,
        opaqueBefore: rendered.opaqueBefore,
        opaqueAfter: rendered.opaqueAfter,
        processedAt: new Date().toISOString(),
        ...(history.length > 0 ? { history } : {}),
      };
      // Commit the predicted output hash before installation. If interrupted between these writes, the
      // originalHash state is safely reprocessed; if interrupted afterward, outlinedHash is safely skipped.
      manifest.files[target.rel] = nextEntry;
      manifest.lastRunAt = nextEntry.processedAt;
      manifest.lastBaseWidth = options.width;
      saveManifest(manifest);
      writeFileSync(target.path, rendered.png);
      if (hashFile(target.path) !== outlinedHash) throw new Error("installed outline hash mismatch");
      processed++;
      rimPixels += rendered.rimPixels;
      if ((index + 1) % 50 === 0 || index + 1 === targets.length) {
        console.log(`PROGRESS ${index + 1}/${targets.length} processed=${processed} already=${alreadyOutlined}`);
      }
    } catch (error) {
      failed++;
      console.error(`FAIL ${target.rel}: ${error.message}`);
    }
  }
  const widths = [...widthCounts].sort(([a], [b]) => a - b).map(([radius, count]) => `${radius}px:${count}`).join(", ");
  console.log(
    `OUTLINE ${options.dryRun ? "DRY-RUN " : ""}SUMMARY processed=${processed} alreadyOutlined=${alreadyOutlined} `
      + `policySkipped=${skips.length} failed=${failed} addedOpaquePixels=${rimPixels} radii=[${widths}]`,
  );
  if (!options.dryRun) console.log(`RESTORE ARCHIVE ${repoPath(ORIGINALS)}/<same-relative-path>`);
  if (failed > 0) process.exitCode = 1;
}

function restoreTargets(options, manifest) {
  const entries = Object.entries(manifest.files)
    .filter(([rel]) => !options.only || rel.includes(options.only))
    .sort(([a], [b]) => a.localeCompare(b));
  let restored = 0;
  let alreadyOriginal = 0;
  let modifiedSkipped = 0;
  let missing = 0;
  for (const [rel, entry] of entries) {
    const target = absoluteRepoPath(rel);
    const archive = absoluteRepoPath(entry.archive);
    if (!existsSync(archive)) {
      console.error(`RESTORE MISSING ${repoPath(archive)}`);
      missing++;
      continue;
    }
    const archiveHash = hashFile(archive);
    if (archiveHash !== entry.originalHash) {
      console.error(`RESTORE MISSING ${repoPath(archive)}: archive hash does not match manifest`);
      missing++;
      continue;
    }
    const currentHash = existsSync(target) && statSync(target).isFile() ? hashFile(target) : null;
    if (currentHash === entry.originalHash) {
      alreadyOriginal++;
      continue;
    }
    if (!options.force && currentHash !== null && currentHash !== entry.outlinedHash) {
      console.log(`RESTORE SKIP ${rel}: target changed since outlining (use --force to replace it)`);
      modifiedSkipped++;
      continue;
    }
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(archive, target);
    if (hashFile(target) !== entry.originalHash) throw new Error(`restore hash mismatch for ${rel}`);
    restored++;
  }
  manifest.lastRestoreAt = new Date().toISOString();
  saveManifest(manifest);
  console.log(
    `RESTORE SUMMARY restored=${restored} alreadyOriginal=${alreadyOriginal} `
      + `modifiedSkipped=${modifiedSkipped} missing=${missing}`,
  );
  console.log("Re-run node tools/artkit/pack-atlas.mjs to rebuild the atlas from restored loose sprites.");
  if (missing > 0) process.exitCode = 1;
}

const options = parseOptions(process.argv.slice(2));
const manifest = loadManifest();
if (options.restore) {
  if (!existsSync(MANIFEST_PATH)) throw new Error(`nothing to restore; missing ${repoPath(MANIFEST_PATH)}`);
  restoreTargets(options, manifest);
} else {
  const { targets, skips } = discoverTargets(options.only);
  if (targets.length === 0) throw new Error("no outline targets matched");
  await processTargets(options, manifest, targets, skips);
}
