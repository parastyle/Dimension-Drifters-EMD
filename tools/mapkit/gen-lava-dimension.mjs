#!/usr/bin/env node
/**
 * Compile the imported Lava Foundry manifests and externally authorable collision file into the shared
 * runtime registry. Source PNG dimensions are verified here so runtime scale=1 is an audited invariant.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { emit, isCheck } from "../artkit/lib/emit.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DATA = join(ROOT, "data", "lava-foundry");
const PUBLIC = join(ROOT, "packages", "client", "public");
const OUT = join(ROOT, "packages", "shared", "src", "lava-dimension.generated.ts");
const PUBLIC_PREFIX = "dimensions/lava-foundry";

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const platformManifest = readJson(join(DATA, "metadata", "broken-output-platforms-manifest.json"));
const heroManifest = readJson(join(DATA, "metadata", "mega-connected-assets-manifest.json"));
const debrisManifest = readJson(join(DATA, "metadata", "broken-bridge-pieces-manifest.json"));
const masterManifest = readJson(join(DATA, "metadata", "v9-master-manifest.json"));
const collisionData = readJson(join(DATA, "collision-surfaces.json"));

if (collisionData.formatVersion !== 1) {
  throw new Error(
    `collision-surfaces.json: unsupported formatVersion ${collisionData.formatVersion}`,
  );
}
if (collisionData.dimensionId !== "lava-foundry") {
  throw new Error(`collision-surfaces.json: expected dimensionId lava-foundry`);
}

function fileName(path) {
  return String(path).replaceAll("\\", "/").split("/").at(-1);
}

function publicPath(group, sourceFile) {
  return `${PUBLIC_PREFIX}/${group}/${fileName(sourceFile)}`;
}

function assertPoint(point, context, width, height) {
  if (
    !point ||
    !Number.isFinite(point.x) ||
    !Number.isFinite(point.y) ||
    point.x < 0 ||
    point.y < 0 ||
    point.x > width ||
    point.y > height
  ) {
    throw new Error(`${context}: point must be inside the ${width}x${height} source PNG`);
  }
}

function collisionFor(asset) {
  const [width, height] = asset.size_px;
  const collision = collisionData.prefabs?.[asset.id];
  if (!collision) throw new Error(`${asset.id}: missing collision entry`);
  if (collision.coordinateSpace !== "source-pixels") {
    throw new Error(`${asset.id}: collision coordinates must be source-pixels`);
  }
  if (!Array.isArray(collision.surfaces) || collision.surfaces.length === 0) {
    throw new Error(`${asset.id}: collision must define at least one surface`);
  }
  for (const surface of collision.surfaces) {
    if (!surface.id || !Array.isArray(surface.polygon) || surface.polygon.length < 3) {
      throw new Error(`${asset.id}: surface must have an id and a 3+ point polygon`);
    }
    for (const point of surface.polygon)
      assertPoint(point, `${asset.id}/${surface.id}`, width, height);
    for (const hole of surface.holes ?? []) {
      if (!Array.isArray(hole) || hole.length < 3) {
        throw new Error(`${asset.id}/${surface.id}: every hole needs 3+ points`);
      }
      for (const point of hole) assertPoint(point, `${asset.id}/${surface.id}/hole`, width, height);
    }
  }
  return collision;
}

function visibleBoundsFor(asset) {
  const [width, height] = asset.size_px;
  const bounds = collisionData.visibleBounds?.[asset.id];
  if (
    !Array.isArray(bounds) ||
    bounds.length !== 4 ||
    bounds.some((value) => !Number.isFinite(value)) ||
    bounds[0] < 0 ||
    bounds[1] < 0 ||
    bounds[2] <= 0 ||
    bounds[3] <= 0 ||
    bounds[0] + bounds[2] > width ||
    bounds[1] + bounds[3] > height
  ) {
    throw new Error(`${asset.id}: visibleBounds must fit inside its ${width}x${height} source PNG`);
  }
  return bounds;
}

async function assertPng(asset, group) {
  const file = publicPath(group, asset.file);
  const absolute = join(PUBLIC, file);
  if (!existsSync(absolute)) throw new Error(`${asset.id}: missing ${file}`);
  const metadata = await sharp(absolute).metadata();
  const [width, height] = asset.size_px;
  if (metadata.width !== width || metadata.height !== height) {
    throw new Error(
      `${asset.id}: manifest ${width}x${height}, PNG ${metadata.width}x${metadata.height}`,
    );
  }
}

const platformPrefabs = {};
for (const asset of platformManifest.assets) {
  await assertPng(asset, "platforms");
  const [width, height] = asset.size_px;
  const visibleBounds = visibleBoundsFor(asset);
  const mega = asset.role === "mega";
  platformPrefabs[asset.id] = {
    id: asset.id,
    file: publicPath("platforms", asset.file),
    width,
    height,
    visibleBounds,
    collision: collisionFor(asset),
    tags: ["platform", asset.role, ...(mega ? ["rare", "mega"] : [])],
    rarity: asset.role === "rare" ? 0.35 : mega ? 0.08 : 1,
    nativeScale: 1,
  };
}

for (const asset of heroManifest.assets) {
  await assertPng(asset, "mega-connected");
  const [width, height] = asset.size_px;
  const visibleBounds = visibleBoundsFor(asset);
  platformPrefabs[asset.id] = {
    id: asset.id,
    file: publicPath("mega-connected", asset.file),
    width,
    height,
    visibleBounds,
    collision: collisionFor(asset),
    tags: ["platform", "rare", "hero-room", "mega-connected", asset.orientation],
    rarity: 0.06,
    nativeScale: 1,
  };
}

const registeredCollisionIds = Object.keys(platformPrefabs).sort();
const suppliedCollisionIds = Object.keys(collisionData.prefabs ?? {}).sort();
if (JSON.stringify(suppliedCollisionIds) !== JSON.stringify(registeredCollisionIds)) {
  throw new Error(
    "collision-surfaces.json prefab ids must exactly match all platform and hero manifest ids",
  );
}

const decorativePrefabs = {};
for (const asset of debrisManifest.assets) {
  await assertPng(asset, "debris");
  const [width, height] = asset.size_px;
  decorativePrefabs[asset.id] = {
    id: asset.id,
    file: publicPath("debris", asset.file),
    width,
    height,
    tags: ["decorative-debris", asset.category, asset.usage],
    rarity: asset.category === "small" ? 1 : asset.category === "medium" ? 0.7 : 0.45,
    nonColliding: true,
  };
}

for (const [name, path] of Object.entries({
  background: `${PUBLIC_PREFIX}/lava/lava-background-4k-loop.png`,
  flow: `${PUBLIC_PREFIX}/lava/lava-flow-overlay-v1.png`,
})) {
  if (!existsSync(join(PUBLIC, path))) throw new Error(`missing lava ${name}: ${path}`);
}

const expected = masterManifest.counts;
if (
  platformManifest.assets.length !== expected.platforms ||
  heroManifest.assets.length !== expected.mega_connected_rooms ||
  debrisManifest.assets.length !== expected.decorative_debris
) {
  throw new Error("v9 master-manifest counts do not match imported manifests");
}

const banner =
  "// AUTO-GENERATED by tools/mapkit/gen-lava-dimension.mjs — DO NOT EDIT.\n" +
  "// Sources: data/lava-foundry/metadata/*.json + data/lava-foundry/collision-surfaces.json.\n" +
  "// Platform/hero art is always rendered at nativeScale: 1; debris is decorative and non-colliding.\n";
const body =
  `import type { DecorativePrefab, PlatformPrefab } from "./lava-prefabs.js";\n\n` +
  `export const LAVA_BACKGROUND_FILE = "${PUBLIC_PREFIX}/lava/lava-background-4k-loop.png";\n` +
  `export const LAVA_FLOW_FILE = "${PUBLIC_PREFIX}/lava/lava-flow-overlay-v1.png";\n\n` +
  `export const LAVA_PLATFORM_PREFABS: Readonly<Record<string, PlatformPrefab>> = ${JSON.stringify(platformPrefabs, null, 2)};\n\n` +
  `export const LAVA_DECORATIVE_PREFABS: Readonly<Record<string, DecorativePrefab>> = ${JSON.stringify(decorativePrefabs, null, 2)};\n`;
emit(OUT, `${banner}\n${body}`, "lava-dimension.generated.ts");

if (!isCheck) {
  console.log(
    `wrote lava-dimension.generated.ts — ${Object.keys(platformPrefabs).length} platform/hero prefabs, ` +
      `${Object.keys(decorativePrefabs).length} decorative prefabs`,
  );
}
