#!/usr/bin/env node
// Validate that every runtime asset manifest resolves to a file under packages/client/public and that the
// packed sprite atlas agrees with the non-expansion sprite manifests. Expansion weapons use the `x2-` id
// convention and load their loose part files on demand, so they are intentionally excluded from atlas checks.
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const PUBLIC = resolve(ROOT, "packages/client/public");
const manifestPaths = {
  sprites: resolve(ROOT, "packages/client/src/sprites/manifest.ts"),
  cards: resolve(ROOT, "packages/client/src/sprites/card-manifest.ts"),
  pois: resolve(ROOT, "packages/client/src/sprites/poi-manifest.ts"),
  decals: resolve(ROOT, "packages/client/src/sprites/decal-manifest.ts"),
  particles: resolve(ROOT, "packages/client/src/vfx/particle-manifest.ts"),
  weaponVfx: resolve(ROOT, "packages/client/src/vfx/weapon-vfx.generated.ts"),
};
const atlasPath = resolve(PUBLIC, "sprites/dd-sprites.json");

const parseFailures = [];
const missingAssets = new Map();

function readSource(path, label) {
  try {
    return readFileSync(path, "utf8");
  } catch (error) {
    parseFailures.push(`${label}: cannot read ${path} (${error.message})`);
    return "";
  }
}

function parseString(literal, context) {
  try {
    return JSON.parse(literal);
  } catch (error) {
    parseFailures.push(`${context}: invalid string literal ${literal} (${error.message})`);
    return null;
  }
}

function recordAsset(reference, source) {
  const clean = reference.split(/[?#]/, 1)[0].replaceAll("\\", "/").replace(/^\/+/, "");
  if (!clean || /^[a-z][a-z\d+.-]*:\/\//i.test(reference)) {
    parseFailures.push(`${source}: asset path must be local to packages/client/public: ${reference}`);
    return;
  }

  const fullPath = resolve(PUBLIC, clean);
  const fromPublic = relative(PUBLIC, fullPath);
  if (/^\.\.(?:[\\/]|$)/.test(fromPublic) || isAbsolute(fromPublic)) {
    parseFailures.push(`${source}: asset path escapes packages/client/public: ${reference}`);
    return;
  }

  let existsAsFile = false;
  try {
    existsAsFile = existsSync(fullPath) && statSync(fullPath).isFile();
  } catch {
    existsAsFile = false;
  }
  if (!existsAsFile) {
    const sources = missingAssets.get(clean) ?? new Set();
    sources.add(source);
    missingAssets.set(clean, sources);
  }
}

function extractArrayStrings(source, exportName, label) {
  const pattern = new RegExp(`export\\s+const\\s+${exportName}\\s*=\\s*\\[([\\s\\S]*?)\\]\\s*as const`);
  const match = source.match(pattern);
  if (!match) {
    parseFailures.push(`${label}: could not find export const ${exportName} = [...] as const`);
    return [];
  }
  return [...match[1].matchAll(/"(?:\\.|[^"\\])*"/g)]
    .map((item) => parseString(item[0], label))
    .filter((item) => item != null);
}

function extractPropertyStrings(source, properties, label) {
  const names = properties.join("|");
  const pattern = new RegExp(`\\b(?:${names})\\s*:\\s*("(?:\\\\.|[^"\\\\])*")`, "g");
  return [...source.matchAll(pattern)]
    .map((match) => parseString(match[1], label))
    .filter((item) => item != null);
}

function parseSprites(source) {
  const starts = [...source.matchAll(/^ {2}(?:"([^"]+)"|([A-Za-z_$][\w$]*)):\s*\{\s*$/gm)];
  if (starts.length === 0) {
    parseFailures.push("sprites/manifest.ts: could not find any SPRITES entries");
    return [];
  }

  return starts.map((start, index) => {
    const key = start[1] ?? start[2];
    const block = source.slice(start.index, starts[index + 1]?.index ?? source.length);
    const idLiteral = block.match(/^ {4}id:\s*("(?:\\.|[^"\\])*")/m)?.[1];
    const id = idLiteral ? parseString(idLiteral, `sprites/manifest.ts entry ${key}`) : null;
    if (!id) parseFailures.push(`sprites/manifest.ts entry ${key}: missing id`);
    else if (id !== key) parseFailures.push(`sprites/manifest.ts entry ${key}: id is ${id}`);

    const parts = [...block.matchAll(/\{\s*role:\s*("(?:\\.|[^"\\])*"),\s*file:\s*("(?:\\.|[^"\\])*")/g)]
      .map((match) => ({
        role: parseString(match[1], `sprites/manifest.ts ${key} role`),
        file: parseString(match[2], `sprites/manifest.ts ${key} file`),
      }))
      .filter((part) => part.role != null && part.file != null);
    if (parts.length === 0) parseFailures.push(`sprites/manifest.ts entry ${key}: no parts found`);
    return { id: id ?? key, parts, expansion: (id ?? key).startsWith("x2-") };
  });
}

const spriteSource = readSource(manifestPaths.sprites, "sprites/manifest.ts");
const sprites = parseSprites(spriteSource);
const declaredFrames = new Set();
const requiredAtlasFrames = new Set();
let spritePartCount = 0;
let expansionPartCount = 0;
for (const sprite of sprites) {
  for (const part of sprite.parts) {
    spritePartCount++;
    if (sprite.expansion) expansionPartCount++;
    recordAsset(`sprites/${sprite.id}/${part.file}`, `sprites/manifest.ts ${sprite.id}/${part.role}`);
    const frame = `${sprite.id}/${part.role}`;
    declaredFrames.add(frame);
    if (!sprite.expansion) requiredAtlasFrames.add(frame);
  }
}

const cards = extractArrayStrings(
  readSource(manifestPaths.cards, "card-manifest.ts"),
  "CARD_ART_IDS",
  "card-manifest.ts",
);
for (const id of cards) recordAsset(`cards/${id}.jpg`, `card-manifest.ts ${id}`);

const pois = extractArrayStrings(
  readSource(manifestPaths.pois, "poi-manifest.ts"),
  "POI_IDS",
  "poi-manifest.ts",
);
for (const id of pois) recordAsset(`pois/${id}.png`, `poi-manifest.ts ${id}`);

const decals = extractArrayStrings(
  readSource(manifestPaths.decals, "decal-manifest.ts"),
  "DECAL_IDS",
  "decal-manifest.ts",
);
for (const id of decals) recordAsset(`decals/${id}.png`, `decal-manifest.ts ${id}`);

const particleUrls = extractPropertyStrings(
  readSource(manifestPaths.particles, "particle-manifest.ts"),
  ["url"],
  "particle-manifest.ts",
);
for (const url of particleUrls) recordAsset(url, "particle-manifest.ts");

const weaponVfxUrls = extractPropertyStrings(
  readSource(manifestPaths.weaponVfx, "weapon-vfx.generated.ts"),
  ["hero", "url"],
  "weapon-vfx.generated.ts",
);
for (const url of weaponVfxUrls) recordAsset(url, "weapon-vfx.generated.ts");

let atlasFrames = [];
try {
  const atlas = JSON.parse(readFileSync(atlasPath, "utf8"));
  for (const texture of atlas.textures ?? []) {
    if (Array.isArray(texture.frames)) {
      atlasFrames.push(...texture.frames.map((frame) => frame.filename).filter((name) => typeof name === "string"));
    } else if (texture.frames && typeof texture.frames === "object") {
      atlasFrames.push(...Object.keys(texture.frames));
    }
  }
  if (atlasFrames.length === 0) parseFailures.push("sprites/dd-sprites.json: no frames found");
} catch (error) {
  parseFailures.push(`sprites/dd-sprites.json: cannot parse ${atlasPath} (${error.message})`);
}

const atlasFrameSet = new Set(atlasFrames);
const missingFrames = [...requiredAtlasFrames].filter((frame) => !atlasFrameSet.has(frame)).sort();
const orphanFrames = [...atlasFrameSet].filter((frame) => !declaredFrames.has(frame)).sort();

for (const frame of orphanFrames) console.warn(`⚠ orphan sprite-atlas frame: ${frame}`);

const missingEntries = [...missingAssets.entries()].sort(([a], [b]) => a.localeCompare(b));
if (parseFailures.length > 0 || missingEntries.length > 0 || missingFrames.length > 0) {
  console.error("✗ asset check FAILED");
  for (const failure of parseFailures.sort()) console.error(`  parse: ${failure}`);
  for (const [path, sources] of missingEntries) {
    console.error(`  missing file: packages/client/public/${path} (${[...sources].sort().join(", ")})`);
  }
  for (const frame of missingFrames) console.error(`  missing atlas frame: ${frame}`);
  process.exitCode = 1;
} else {
  console.log(
    `✓ asset check passed — ${sprites.length} sprite entries / ${spritePartCount} parts ` +
      `(${expansionPartCount} expansion parts checked loose), ${atlasFrames.length} atlas frames, ` +
      `${cards.length} cards, ${pois.length} POIs, ${decals.length} decals, ` +
      `${particleUrls.length} particle URLs, ${weaponVfxUrls.length} weapon-VFX URLs` +
      `${orphanFrames.length > 0 ? `; ${orphanFrames.length} orphan frame warning(s)` : ""}`,
  );
}
