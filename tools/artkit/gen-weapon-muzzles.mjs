#!/usr/bin/env node
/**
 * Derive held-weapon source points from installed sprite alpha.
 *
 * The checked-in output is runtime/shared data. Explicit points in
 * data/weapon-muzzle-overrides.json win only for silhouettes whose alpha cannot express separate bores.
 */
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const OUTPUT = path.join(ROOT, "packages/shared/src/weapon-muzzles.generated.ts");
const SNAPSHOT = path.join(ROOT, "docs/sol-reports/v7-muzzle-derivation.json");
const TABLE = path.join(ROOT, "docs/sol-reports/v7-muzzle-derivation-table.md");
const OVERRIDES = JSON.parse(
  await readFile(path.join(ROOT, "data/weapon-muzzle-overrides.json"), "utf8"),
);
const CHECK = process.argv.includes("--check");
const ALPHA_THRESHOLD = 48;

// The built shared catalog is the authoritative census. `pnpm gen` already builds shared first in every
// validation path; a direct invocation reports the missing prerequisite honestly.
let WEAPONS;
try {
  // A newly generated gun necessarily appears in the catalog one step before its first derived muzzle.
  // This flag bypasses only that bootstrap completeness assertion in this process; ordinary server/client
  // imports still fail closed if a generated muzzle is missing.
  globalThis.__DD_GENERATING_WEAPON_MUZZLES__ = true;
  ({ WEAPONS } = await import("../../packages/shared/dist/index.js"));
  delete globalThis.__DD_GENERATING_WEAPON_MUZZLES__;
} catch (error) {
  delete globalThis.__DD_GENERATING_WEAPON_MUZZLES__;
  throw new Error("Build @dd/shared before deriving weapon muzzles", { cause: error });
}

function rounded(value) {
  return Math.round(value * 10) / 10;
}

function alphaAt(data, width, x, y) {
  return data[(y * width + x) * 4 + 3] >= ALPHA_THRESHOLD;
}

/**
 * Score horizontal row bands, not the full silhouette. A valid barrel band must carry opaque mass back
 * from its robust front edge; isolated sights/bayonets therefore lose to the thicker connected barrel.
 */
function deriveBarrelTip(data, width, height) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!alphaAt(data, width, x, y)) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX < minX || maxY < minY) throw new Error("sprite has no opaque pixels");

  const radius = Math.max(2, Math.round((maxY - minY + 1) * 0.035));
  const bandHeight = radius * 2 + 1;
  const robustSupport = Math.max(2, Math.ceil(bandHeight * 0.38));
  const allowedGap = Math.max(3, Math.round(width * 0.018));
  const candidates = [];

  for (let y = minY + radius; y <= maxY - radius; y++) {
    const verticalMass = new Uint16Array(maxX - minX + 1);
    for (let x = minX; x <= maxX; x++) {
      let mass = 0;
      for (let sampleY = y - radius; sampleY <= y + radius; sampleY++) {
        if (alphaAt(data, width, x, sampleY)) mass++;
      }
      verticalMass[x - minX] = mass;
    }

    let tipX = -1;
    for (let index = verticalMass.length - 1; index >= 0; index--) {
      if (verticalMass[index] < robustSupport) continue;
      tipX = minX + index;
      break;
    }
    if (tipX < 0) continue;

    let connectedColumns = 0;
    let gap = 0;
    for (let x = tipX; x >= minX; x--) {
      if (verticalMass[x - minX] > 0) {
        connectedColumns++;
        gap = 0;
      } else if (++gap > allowedGap) {
        break;
      }
    }
    const tipSupport = verticalMass[tipX - minX];
    const forwardStart = Math.max(minX, tipX - Math.round((tipX - minX + 1) * 0.4));
    let forwardMass = 0;
    for (let x = forwardStart; x <= tipX; x++) forwardMass += verticalMass[x - minX];
    candidates.push({
      x: tipX,
      y,
      tipSupport,
      score:
        tipX * 1.8 +
        Math.min(connectedColumns, width * 0.55) * 0.9 +
        tipSupport * 3 +
        forwardMass / (bandHeight * 8),
    });
  }

  candidates.sort((left, right) => right.score - left.score || left.y - right.y);
  const best = candidates[0];
  if (!best) throw new Error("sprite has no supported forward barrel band");
  const plateau = candidates.filter(
    (candidate) =>
      Math.abs(candidate.x - best.x) <= 2 && Math.abs(candidate.y - best.y) <= radius * 2,
  );
  let weight = 0;
  let weightedY = 0;
  for (const candidate of plateau) {
    weight += candidate.tipSupport;
    weightedY += candidate.y * candidate.tipSupport;
  }
  return {
    x: rounded(best.x),
    y: rounded(weight > 0 ? weightedY / weight : best.y),
    bandRadius: radius,
  };
}

async function existingPartFiles(spriteId) {
  const directory = path.join(ROOT, "packages/client/public/sprites", spriteId);
  const files = [];
  for (let part = 0; part < 2; part++) {
    const file = path.join(directory, `part-${part + 1}.png`);
    try {
      await access(file);
      files.push(file);
    } catch {
      if (part === 0) throw new Error(`missing held sprite part: ${path.relative(ROOT, file)}`);
    }
  }
  return files;
}

const definitions = {};
const snapshot = [];
const ranged = Object.values(WEAPONS)
  .filter(
    (weapon) =>
      weapon.gun ||
      weapon.beam ||
      weapon.cast ||
      weapon.hybridProjectile ||
      weapon.impactMuzzle ||
      weapon.firingFrame,
  )
  .sort((left, right) => left.id.localeCompare(right.id));

for (const weapon of ranged) {
  const spriteId = weapon.sprite ?? weapon.id;
  const installedPartFiles = await existingPartFiles(spriteId);
  const partFiles =
    weapon.dual || weapon.impactMuzzle ? installedPartFiles : installedPartFiles.slice(0, 1);
  const derivedParts = [];
  for (let part = 0; part < partFiles.length; part++) {
    const { data, info } = await sharp(partFiles[part])
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const derived = deriveBarrelTip(data, info.width, info.height);
    derivedParts.push({ part, width: info.width, height: info.height, ...derived });
  }

  const override = OVERRIDES[weapon.id];
  const sourcePoints = override?.points ?? derivedParts.map(({ part, x, y }) => ({ part, x, y }));
  const points = sourcePoints.map((point) => {
    const derived = derivedParts[point.part];
    if (!derived) throw new Error(`${weapon.id}: override references missing part ${point.part}`);
    return {
      part: point.part,
      x: point.x,
      y: point.y,
      derived: { x: derived.x, y: derived.y },
      ...(override?.reason ? { overrideReason: override.reason } : {}),
    };
  });
  const partDimensions = derivedParts.map(({ width, height }) => ({ width, height }));
  const salvoMode = override?.salvoMode ?? (weapon.dual && partFiles.length > 1 ? "cycle" : "parallel");
  const barrelMode = override?.barrelMode ?? "parallel";
  definitions[weapon.id] = {
    sprite: spriteId,
    parts: partDimensions,
    points,
    salvoMode,
    barrelMode,
  };
  snapshot.push({
    id: weapon.id,
    name: weapon.name,
    sprite: spriteId,
    derived: derivedParts.map(({ part, x, y }) => ({ part, x, y })),
    points: points.map(({ part, x, y }) => ({ part, x, y })),
    override: override?.reason ?? null,
    salvoMode,
    barrelMode,
  });
}

const generated = `// AUTO-GENERATED by tools/artkit/gen-weapon-muzzles.mjs — do not edit by hand.\n` +
  `import type { WeaponArtMuzzleDefinition } from "./weapon-muzzle.js";\n\n` +
  `export const WEAPON_ART_MUZZLES = ${JSON.stringify(definitions, null, 2)} as const satisfies Readonly<Record<string, WeaponArtMuzzleDefinition>>;\n`;
const snapshotText = `${JSON.stringify(snapshot, null, 2)}\n`;
const pointList = (points) =>
  points.map(({ part, x, y }) => `part-${part + 1} (${x}, ${y})`).join("<br>");
const tableText = `${[
  "# V7 Muzzle Derivation Table",
  "",
  `Generated from sprite alpha for all ${snapshot.length} active projectile, beam, and authored melee-impact definitions. Coordinates are source-PNG pixels.`,
  "",
  "| Weapon | Derived barrel tip | Authored muzzle point(s) | Override |",
  "| --- | --- | --- | --- |",
  ...snapshot.map(
    (entry) =>
      `| \`${entry.id}\` (${entry.name.replaceAll("|", "\\|")}) | ${pointList(entry.derived)} | ${pointList(entry.points)} | ${entry.override ? `Yes - ${entry.override.replaceAll("|", "\\|")}` : "No"} |`,
  ),
  "",
].join("\n")}\n`;

if (CHECK) {
  const [current, currentSnapshot, currentTable] = await Promise.all([
    readFile(OUTPUT, "utf8").catch(() => ""),
    readFile(SNAPSHOT, "utf8").catch(() => ""),
    readFile(TABLE, "utf8").catch(() => ""),
  ]);
  if (current !== generated || currentSnapshot !== snapshotText || currentTable !== tableText) {
    console.error("weapon muzzle derivation is stale; run node tools/artkit/gen-weapon-muzzles.mjs");
    process.exitCode = 1;
  }
} else {
  await mkdir(path.dirname(SNAPSHOT), { recursive: true });
  await Promise.all([
    writeFile(OUTPUT, generated),
    writeFile(SNAPSHOT, snapshotText),
    writeFile(TABLE, tableText),
  ]);
  console.log(`derived ${snapshot.length} projectile/beam muzzle definitions`);
}
