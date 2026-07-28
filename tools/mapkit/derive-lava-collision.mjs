#!/usr/bin/env node
/**
 * Derive the initial Lava Foundry walkable-surface polygons from the shipping PNGs.
 *
 * This is deliberately NOT part of `pnpm gen`: running it replaces only collision entries whose
 * `provenance.kind` is "derived-alpha-v1", while preserving externally authored entries. The B73 painter
 * can therefore replace any prefab entry without its work being overwritten by ordinary code generation.
 *
 * Usage:
 *   node tools/mapkit/derive-lava-collision.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DATA_DIR = join(ROOT, "data", "lava-foundry");
const PUBLIC_DIR = join(ROOT, "packages", "client", "public", "dimensions", "lava-foundry");
const PLATFORM_MANIFEST = join(DATA_DIR, "metadata", "broken-output-platforms-manifest.json");
const HERO_MANIFEST = join(DATA_DIR, "metadata", "mega-connected-assets-manifest.json");
const OUTPUT = join(DATA_DIR, "collision-surfaces.json");

const CELL = 12;
const ALPHA_THRESHOLD = 40;
const MIN_OUTER_AREA = 60_000;
const MIN_HOLE_AREA = 2_000;
const SIMPLIFY_TOLERANCE = 10;

const manifests = [
  {
    kind: "platform",
    manifest: JSON.parse(readFileSync(PLATFORM_MANIFEST, "utf8")),
    publicDir: "platforms",
    edgeInsetPx: 0,
  },
  {
    kind: "hero-room",
    manifest: JSON.parse(readFileSync(HERO_MANIFEST, "utf8")),
    publicDir: "mega-connected",
    edgeInsetPx: 0,
  },
];

function key(x, y) {
  return `${x},${y}`;
}

function signedArea(points) {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

function pointSegmentDistance(point, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq <= 1e-9) return Math.hypot(point.x - a.x, point.y - a.y);
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq));
  return Math.hypot(point.x - (a.x + dx * t), point.y - (a.y + dy * t));
}

function simplifyClosed(points, tolerance) {
  let out = points.filter((point, index) => {
    const previous = points[(index + points.length - 1) % points.length];
    const next = points[(index + 1) % points.length];
    return (
      (point.x - previous.x) * (next.y - point.y) !== (point.y - previous.y) * (next.x - point.x)
    );
  });
  for (let pass = 0; pass < 8 && out.length > 4; pass++) {
    let changed = false;
    const next = [];
    for (let i = 0; i < out.length; i++) {
      const previous = out[(i + out.length - 1) % out.length];
      const point = out[i];
      const following = out[(i + 1) % out.length];
      if (
        out.length - next.length > 4 &&
        pointSegmentDistance(point, previous, following) <= tolerance
      ) {
        changed = true;
        continue;
      }
      next.push(point);
    }
    out = next;
    if (!changed) break;
  }
  return out;
}

function pointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    const intersects =
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y || 1e-9) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

function erode(mask, cols, rows, radius) {
  let current = mask;
  for (let step = 0; step < radius; step++) {
    const next = new Uint8Array(current.length);
    for (let y = 1; y < rows - 1; y++) {
      for (let x = 1; x < cols - 1; x++) {
        const index = y * cols + x;
        if (
          current[index] &&
          current[index - 1] &&
          current[index + 1] &&
          current[index - cols] &&
          current[index + cols]
        ) {
          next[index] = 1;
        }
      }
    }
    current = next;
  }
  return current;
}

function removeSmallComponents(mask, cols, rows, minCells) {
  const seen = new Uint8Array(mask.length);
  const output = new Uint8Array(mask.length);
  const directions = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || seen[start]) continue;
    const queue = [start];
    const component = [];
    seen[start] = 1;
    for (let head = 0; head < queue.length; head++) {
      const current = queue[head];
      component.push(current);
      const x = current % cols;
      const y = Math.floor(current / cols);
      for (const [dx, dy] of directions) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        const next = ny * cols + nx;
        if (mask[next] && !seen[next]) {
          seen[next] = 1;
          queue.push(next);
        }
      }
    }
    if (component.length >= minCells) {
      for (const index of component) output[index] = 1;
    }
  }
  return output;
}

function traceLoops(mask, cols, rows) {
  const edges = new Map();
  const add = (x1, y1, x2, y2) => {
    const start = key(x1, y1);
    const list = edges.get(start) ?? [];
    list.push({ x1, y1, x2, y2 });
    edges.set(start, list);
  };
  const occupied = (x, y) => x >= 0 && y >= 0 && x < cols && y < rows && !!mask[y * cols + x];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (!occupied(x, y)) continue;
      if (!occupied(x, y - 1)) add(x, y, x + 1, y);
      if (!occupied(x + 1, y)) add(x + 1, y, x + 1, y + 1);
      if (!occupied(x, y + 1)) add(x + 1, y + 1, x, y + 1);
      if (!occupied(x - 1, y)) add(x, y + 1, x, y);
    }
  }

  const loops = [];
  const takeEdge = (start) => {
    const list = edges.get(start);
    const edge = list?.shift();
    if (list?.length === 0) edges.delete(start);
    return edge;
  };
  while (edges.size > 0) {
    const [start, list] = edges.entries().next().value;
    const first = list.shift();
    if (list.length === 0) edges.delete(start);
    const loop = [{ x: first.x1, y: first.y1 }];
    let current = first;
    for (let guard = 0; guard < cols * rows * 8; guard++) {
      loop.push({ x: current.x2, y: current.y2 });
      if (current.x2 === first.x1 && current.y2 === first.y1) break;
      current = takeEdge(key(current.x2, current.y2));
      if (!current) throw new Error(`Open collision contour at ${current?.x2},${current?.y2}`);
    }
    loop.pop();
    loops.push(loop.map((point) => ({ x: point.x * CELL, y: point.y * CELL })));
  }
  return loops;
}

async function derive(asset, options) {
  const fileName = asset.file.split("/").at(-1);
  const path = join(PUBLIC_DIR, options.publicDir, fileName);
  const { data, info } = await sharp(path)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const cols = Math.ceil(info.width / CELL);
  const rows = Math.ceil(info.height / CELL);
  const mask = new Uint8Array(cols * rows);
  let minX = info.width;
  let minY = info.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const alpha = data[(y * info.width + x) * 4 + 3];
      if (alpha < ALPHA_THRESHOLD) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      let opaque = 0;
      let molten = 0;
      let samples = 0;
      const x0 = gx * CELL;
      const y0 = gy * CELL;
      for (let y = y0; y < Math.min(info.height, y0 + CELL); y += 2) {
        for (let x = x0; x < Math.min(info.width, x0 + CELL); x += 2) {
          samples++;
          const offset = (y * info.width + x) * 4;
          const alpha = data[offset + 3];
          if (alpha < ALPHA_THRESHOLD) continue;
          opaque++;
          const r = data[offset];
          const g = data[offset + 1];
          const b = data[offset + 2];
          if (r > 105 && r > g * 1.28 && r > b * 1.48) molten++;
        }
      }
      const enoughAlpha = opaque / Math.max(1, samples) >= 0.28;
      const moltenOpening = molten / Math.max(1, opaque) >= 0.24;
      if (enoughAlpha && !moltenOpening) mask[gy * cols + gx] = 1;
    }
  }

  const insetCells = Math.max(0, Math.round(options.edgeInsetPx / CELL));
  const eroded = erode(mask, cols, rows, insetCells);
  const cleaned = removeSmallComponents(
    eroded,
    cols,
    rows,
    Math.ceil(MIN_OUTER_AREA / (CELL * CELL)),
  );
  const loops = traceLoops(cleaned, cols, rows)
    .map((polygon) => simplifyClosed(polygon, SIMPLIFY_TOLERANCE))
    .filter((polygon) => polygon.length >= 3);
  const outers = loops.filter((polygon) => signedArea(polygon) >= MIN_OUTER_AREA);
  const holes = loops.filter((polygon) => signedArea(polygon) <= -MIN_HOLE_AREA);
  if (outers.length === 0)
    throw new Error(`${asset.id}: alpha derivation produced no walkable surface`);

  // Raised rails and panel seams can briefly disappear from the conservative top-surface mask. They are
  // not lava holes. Only reactor-authored prefabs retain a derived internal opening; their molten core is
  // the one visual void that must remain lethal in the default data.
  const retainedHoles = asset.id.includes("reactor") ? holes : [];
  const surfaces = outers
    .sort((a, b) => Math.abs(signedArea(b)) - Math.abs(signedArea(a)))
    .map((polygon, index) => ({
      id: index === 0 ? "main" : `surface-${index + 1}`,
      polygon,
      holes: retainedHoles.filter((hole) => pointInPolygon(hole[0], polygon)),
    }));
  return {
    id: asset.id,
    visibleBounds: [minX, minY, maxX - minX + 1, maxY - minY + 1],
    entry: {
      coordinateSpace: "source-pixels",
      provenance: {
        kind: "derived-alpha-v1",
        cellPx: CELL,
        alphaThreshold: ALPHA_THRESHOLD,
        edgeInsetPx: options.edgeInsetPx,
        note: "Alpha envelope + molten-opening rejection; body radius is applied by runtime tests.",
      },
      surfaces,
    },
  };
}

let previous = {};
try {
  previous = JSON.parse(readFileSync(OUTPUT, "utf8")).prefabs ?? {};
} catch {
  previous = {};
}

const prefabs = { ...previous };
const visibleBounds = {};
for (const options of manifests) {
  for (const asset of options.manifest.assets) {
    const result = await derive(asset, options);
    visibleBounds[result.id] = result.visibleBounds;
    const current = prefabs[result.id];
    if (!current || current.provenance?.kind === "derived-alpha-v1") {
      prefabs[result.id] = result.entry;
      console.log(`derived ${result.id}: ${result.entry.surfaces.length} surface(s)`);
    } else {
      console.log(`preserved authored ${result.id}`);
    }
  }
}

const output = {
  formatVersion: 1,
  dimensionId: "lava-foundry",
  units: "source-pixels",
  pointConvention: "{x,y}; origin is the PNG top-left; +x right; +y down",
  runtimeRule:
    "A grounded actor is safe only inside a surface polygon and outside its holes. Debris is never read here.",
  authoringRule:
    'Replace one prefabs[id] entry and set provenance.kind to "authored". Keep coordinates at native scale.',
  visibleBounds,
  prefabs,
};
writeFileSync(OUTPUT, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(`wrote ${OUTPUT}`);
