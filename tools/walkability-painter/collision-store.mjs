import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

export const COLLISION_DATA_PATH = join(ROOT, "data", "prefab-walkability.json");
export const COLLISION_FORMAT_VERSION = 1;
export const COLLISION_COORDINATE_SPACE = "prefab-local-pixels";

function emptyCollisionFile() {
  return {
    version: COLLISION_FORMAT_VERSION,
    coordinateSpace: COLLISION_COORDINATE_SPACE,
    polygonsByPrefab: {},
  };
}

function assertCollisionFile(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Collision data must be a JSON object.");
  }
  if (value.version !== COLLISION_FORMAT_VERSION) {
    throw new Error(`Unsupported collision data version ${String(value.version)}.`);
  }
  if (value.coordinateSpace !== COLLISION_COORDINATE_SPACE) {
    throw new Error(`Unsupported coordinate space ${String(value.coordinateSpace)}.`);
  }
  if (
    !value.polygonsByPrefab ||
    typeof value.polygonsByPrefab !== "object" ||
    Array.isArray(value.polygonsByPrefab)
  ) {
    throw new Error("Collision data must contain a polygonsByPrefab object.");
  }
  return value;
}

export function readCollisionFile(path = COLLISION_DATA_PATH) {
  if (!existsSync(path)) return emptyCollisionFile();
  return assertCollisionFile(JSON.parse(readFileSync(path, "utf8")));
}

export function readPrefabCollision(prefabId, path = COLLISION_DATA_PATH) {
  const file = readCollisionFile(path);
  if (!Object.hasOwn(file.polygonsByPrefab, prefabId)) return undefined;
  return structuredClone(file.polygonsByPrefab[prefabId]);
}

function samePoint(left, right) {
  return left[0] === right[0] && left[1] === right[1];
}

function polygonArea(polygon) {
  let area = 0;
  for (let index = 0; index < polygon.length; index += 1) {
    const point = polygon[index];
    const next = polygon[(index + 1) % polygon.length];
    area += point[0] * next[1] - next[0] * point[1];
  }
  return area / 2;
}

export function normalizePolygons(polygons, imageSize) {
  if (!Array.isArray(polygons)) throw new Error("polygons must be an array.");
  if (polygons.length === 0) throw new Error("At least one walkable polygon is required.");
  if (polygons.length > 128) throw new Error("A prefab may contain at most 128 polygons.");
  const width = Number(imageSize?.width);
  const height = Number(imageSize?.height);
  if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
    throw new Error("A positive integer image width and height are required.");
  }

  return polygons.map((polygon, polygonIndex) => {
    if (!Array.isArray(polygon)) {
      throw new Error(`Polygon ${polygonIndex + 1} must be an array.`);
    }
    if (polygon.length > 512) {
      throw new Error(`Polygon ${polygonIndex + 1} has more than 512 vertices.`);
    }
    const normalized = [];
    for (const [pointIndex, point] of polygon.entries()) {
      if (!Array.isArray(point) || point.length !== 2) {
        throw new Error(`Polygon ${polygonIndex + 1}, point ${pointIndex + 1} must be [x, y].`);
      }
      const x = Math.round(Number(point[0]));
      const y = Math.round(Number(point[1]));
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        throw new Error(`Polygon ${polygonIndex + 1}, point ${pointIndex + 1} is not finite.`);
      }
      if (x < 0 || x > width || y < 0 || y > height) {
        throw new Error(
          `Polygon ${polygonIndex + 1}, point ${pointIndex + 1} is outside ${width}x${height}.`,
        );
      }
      const candidate = [x, y];
      if (!normalized.at(-1) || !samePoint(normalized.at(-1), candidate)) {
        normalized.push(candidate);
      }
    }
    if (normalized.length > 1 && samePoint(normalized[0], normalized.at(-1))) normalized.pop();
    if (normalized.length < 3) {
      throw new Error(`Polygon ${polygonIndex + 1} must contain at least three distinct vertices.`);
    }
    if (Math.abs(polygonArea(normalized)) < 1) {
      throw new Error(`Polygon ${polygonIndex + 1} has no usable area.`);
    }
    return normalized;
  });
}

function serializeCollisionFile(file) {
  const expanded = JSON.stringify(file, null, 2);
  const compactPoints = expanded.replace(/\[\n(\s+)(-?\d+),\n\s+(-?\d+)\n\s+\]/g, "[$2, $3]");
  return `${compactPoints}\n`;
}

export function writePrefabCollision(prefabId, polygons, imageSize, path = COLLISION_DATA_PATH) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(prefabId)) {
    throw new Error("prefabId must be a lowercase kebab-case id.");
  }
  const normalized = normalizePolygons(polygons, imageSize);
  const file = readCollisionFile(path);
  const sortedEntries = Object.entries({
    ...file.polygonsByPrefab,
    [prefabId]: normalized,
  }).sort(([left], [right]) => left.localeCompare(right));
  const next = {
    version: COLLISION_FORMAT_VERSION,
    coordinateSpace: COLLISION_COORDINATE_SPACE,
    polygonsByPrefab: Object.fromEntries(sortedEntries),
  };
  mkdirSync(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.tmp`;
  try {
    writeFileSync(temporaryPath, serializeCollisionFile(next), "utf8");
    renameSync(temporaryPath, path);
  } finally {
    rmSync(temporaryPath, { force: true });
  }
  return structuredClone(normalized);
}
