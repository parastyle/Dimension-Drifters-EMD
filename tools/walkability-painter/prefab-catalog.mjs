import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PLATFORM_MANIFEST = "broken-output-platforms-manifest.json";
const MEGA_MANIFEST = "mega-connected-assets-manifest.json";
const DISCOVERY_ROOTS = [
  join(ROOT, "packages", "client", "public"),
  join(ROOT, "assets"),
  join(ROOT, "data"),
];
const REPO_ART_ROOTS = [
  join(ROOT, "packages", "client", "public", "dimensions"),
  join(ROOT, "packages", "client", "public", "terrain"),
  join(ROOT, "packages", "client", "public", "prefabs"),
  join(ROOT, "assets", "dimensions"),
  join(ROOT, "assets", "prefabs"),
  join(ROOT, "data", "dimensions"),
  join(ROOT, "data", "prefabs"),
];
const ART_EXCLUSIONS =
  /(?:background|backdrop|overlay|parallax|contact[-_ ]sheet|preview|diagnostic|source|mask)/i;

let catalogCache;
const seedCache = new Map();

function slug(value) {
  return value
    .toLowerCase()
    .replace(/\.png$/i, "")
    .replace(/^\d+[-_ ]*/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function walk(directory, visit, depth = 0) {
  if (!existsSync(directory) || depth > 7) return;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "dist") continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) walk(path, visit, depth + 1);
    else visit(path);
  }
}

function findManifestRoots() {
  const roots = new Set();
  for (const root of DISCOVERY_ROOTS) {
    walk(root, (path) => {
      if (basename(path) === PLATFORM_MANIFEST || basename(path) === MEGA_MANIFEST) {
        roots.add(resolve(dirname(path), ".."));
      }
    });
  }

  const configured = process.env.LAVA_PACKAGE_ROOT;
  if (configured && existsSync(configured)) roots.add(resolve(configured));
  const conceptRoot = join(homedir(), "Documents", "Dicking Around", "concept-art");
  if (existsSync(conceptRoot)) {
    const packages = readdirSync(conceptRoot, { withFileTypes: true })
      .filter(
        (entry) =>
          entry.isDirectory() &&
          /(?:claude-lava-procedural-v9-package|lava-procedural-exploration-prototype-v9)/i.test(
            entry.name,
          ),
      )
      .map((entry) => join(conceptRoot, entry.name))
      .filter((path) => existsSync(join(path, "metadata", PLATFORM_MANIFEST)))
      .sort((left, right) => statSync(right).mtimeMs - statSync(left).mtimeMs);
    if (packages[0]) roots.add(resolve(packages[0]));
  }
  return [...roots];
}

function sourceLabel(path, packageRoot) {
  if (path.startsWith(`${ROOT}${sep}`)) return relative(ROOT, path).replaceAll(sep, "/");
  return `${basename(packageRoot)}/${relative(packageRoot, path).replaceAll(sep, "/")}`;
}

function addManifest(catalog, packageRoot, manifestName, kind) {
  const path = join(packageRoot, "metadata", manifestName);
  if (!existsSync(path)) return;
  const manifest = JSON.parse(readFileSync(path, "utf8"));
  for (const asset of manifest.assets ?? []) {
    const artPath = resolve(packageRoot, asset.file);
    if (!asset.id || !existsSync(artPath) || extname(artPath).toLowerCase() !== ".png") continue;
    const existing = catalog.get(asset.id);
    const repoOwned = artPath.startsWith(`${ROOT}${sep}`);
    if (existing && (!repoOwned || existing.repoOwned)) continue;
    catalog.set(asset.id, {
      id: asset.id,
      name: asset.id.replaceAll("-", " "),
      kind,
      role: asset.role ?? (kind === "mega" ? "hero room" : "platform"),
      path: artPath,
      source: sourceLabel(artPath, packageRoot),
      width: asset.size_px?.[0],
      height: asset.size_px?.[1],
      repoOwned,
    });
  }
}

function addRepoArt(catalog) {
  for (const root of REPO_ART_ROOTS) {
    walk(root, (path) => {
      if (extname(path).toLowerCase() !== ".png" || ART_EXCLUSIONS.test(path)) return;
      const relativePath = relative(root, path).replaceAll(sep, "/");
      const id = slug(basename(path));
      if (!id) return;
      const existing = catalog.get(id);
      if (existing?.repoOwned) return;
      catalog.set(id, {
        id,
        name: id.replaceAll("-", " "),
        kind: /(?:mega|hero|connected|room)/i.test(relativePath)
          ? "mega"
          : /prop/i.test(relativePath)
            ? "prop"
            : "platform",
        role: /prop/i.test(relativePath) ? "dimension prop" : "repo prefab",
        path,
        source: relative(ROOT, path).replaceAll(sep, "/"),
        width: undefined,
        height: undefined,
        repoOwned: true,
      });
    });
  }
}

export async function loadPrefabCatalog({ refresh = false } = {}) {
  if (catalogCache && !refresh) return catalogCache;
  const catalog = new Map();
  addRepoArt(catalog);
  for (const packageRoot of findManifestRoots()) {
    addManifest(catalog, packageRoot, PLATFORM_MANIFEST, "platform");
    addManifest(catalog, packageRoot, MEGA_MANIFEST, "mega");
  }
  for (const prefab of catalog.values()) {
    if (prefab.width && prefab.height) continue;
    const metadata = await sharp(prefab.path).metadata();
    prefab.width = metadata.width;
    prefab.height = metadata.height;
  }
  catalogCache = [...catalog.values()].sort(
    (left, right) =>
      (left.kind === right.kind ? 0 : left.kind === "platform" ? -1 : 1) ||
      left.name.localeCompare(right.name),
  );
  return catalogCache;
}

function componentMask(data, width, height) {
  const mask = new Uint8Array(width * height);
  for (let index = 0; index < data.length; index += 1) {
    mask[index] = data[index] >= 28 ? 1 : 0;
  }
  const seen = new Uint8Array(mask.length);
  const components = [];
  for (let origin = 0; origin < mask.length; origin += 1) {
    if (!mask[origin] || seen[origin]) continue;
    const queue = [origin];
    const pixels = [];
    seen[origin] = 1;
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const index = queue[cursor];
      pixels.push(index);
      const x = index % width;
      const y = Math.floor(index / width);
      const neighbors = [
        x > 0 ? index - 1 : -1,
        x + 1 < width ? index + 1 : -1,
        y > 0 ? index - width : -1,
        y + 1 < height ? index + width : -1,
      ];
      for (const neighbor of neighbors) {
        if (neighbor >= 0 && mask[neighbor] && !seen[neighbor]) {
          seen[neighbor] = 1;
          queue.push(neighbor);
        }
      }
    }
    components.push(pixels);
  }
  components.sort((left, right) => right.length - left.length);
  const largest = components[0]?.length ?? 0;
  return components.filter(
    (component, index) =>
      index < 4 && component.length >= Math.max(32, Math.round(largest * 0.025)),
  );
}

function perpendicularDistance(point, start, end) {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  if (dx === 0 && dy === 0) return Math.hypot(point[0] - start[0], point[1] - start[1]);
  return (
    Math.abs(dy * point[0] - dx * point[1] + end[0] * start[1] - end[1] * start[0]) /
    Math.hypot(dx, dy)
  );
}

function simplifyLine(points, epsilon) {
  if (points.length <= 2) return points;
  let maximum = 0;
  let split = 0;
  for (let index = 1; index < points.length - 1; index += 1) {
    const distance = perpendicularDistance(points[index], points[0], points.at(-1));
    if (distance > maximum) {
      maximum = distance;
      split = index;
    }
  }
  if (maximum <= epsilon) return [points[0], points.at(-1)];
  return [
    ...simplifyLine(points.slice(0, split + 1), epsilon).slice(0, -1),
    ...simplifyLine(points.slice(split), epsilon),
  ];
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
}

function smoothEnvelope(points) {
  return points.map(([x], index) => [
    x,
    median(points.slice(Math.max(0, index - 2), index + 3).map((point) => point[1])),
  ]);
}

function componentPolygon(component, width, height, nativeScale, nativeWidth, nativeHeight) {
  const columns = new Map();
  for (const index of component) {
    const x = index % width;
    const y = Math.floor(index / width);
    const column = columns.get(x) ?? { top: height, bottom: -1 };
    column.top = Math.min(column.top, y);
    column.bottom = Math.max(column.bottom, y);
    columns.set(x, column);
  }
  const minimumSpan = Math.max(3, Math.round(16 * nativeScale));
  const usable = [...columns.entries()]
    .filter(([, column]) => column.bottom - column.top >= minimumSpan)
    .sort(([left], [right]) => left - right);
  if (usable.length < 3) return undefined;

  const horizontalInset = Math.max(1, Math.round(10 * nativeScale));
  const firstX = usable[0][0] + horizontalInset;
  const lastX = usable.at(-1)[0] - horizontalInset;
  const insetTop = Math.max(2, 18 * nativeScale);
  const insetBottom = Math.max(2, 20 * nativeScale);
  const envelope = usable
    .filter(([x]) => x >= firstX && x <= lastX)
    .map(([x, column]) => {
      const top = column.top + insetTop;
      const bottom = column.top + (column.bottom - column.top) * 0.82 - insetBottom;
      return { x, top, bottom };
    })
    .filter((column) => column.bottom - column.top >= Math.max(2, 12 * nativeScale));
  if (envelope.length < 3) return undefined;

  const top = smoothEnvelope(envelope.map((column) => [column.x, column.top]));
  const bottom = smoothEnvelope(envelope.map((column) => [column.x, column.bottom])).reverse();
  const toNative = ([x, y]) => [
    Math.max(0, Math.min(nativeWidth, Math.round(x / nativeScale))),
    Math.max(0, Math.min(nativeHeight, Math.round(y / nativeScale))),
  ];
  const polygon = [...simplifyLine(top, 2), ...simplifyLine(bottom, 2)].map(toNative);
  const deduped = polygon.filter(
    (point, index) =>
      index === 0 || point[0] !== polygon[index - 1][0] || point[1] !== polygon[index - 1][1],
  );
  return deduped.length >= 3 ? deduped : undefined;
}

export async function deriveAlphaSeed(prefab) {
  const stats = statSync(prefab.path);
  const key = `${prefab.path}:${stats.mtimeMs}:${stats.size}`;
  if (seedCache.has(key)) return structuredClone(seedCache.get(key));
  const width = prefab.width;
  const height = prefab.height;
  const scale = Math.min(1, 256 / width);
  const sampleWidth = Math.max(1, Math.round(width * scale));
  const sampleHeight = Math.max(1, Math.round(height * scale));
  const { data, info } = await sharp(prefab.path)
    .ensureAlpha()
    .extractChannel(3)
    .resize(sampleWidth, sampleHeight, { fit: "fill", kernel: "lanczos3" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const polygons = componentMask(data, info.width, info.height)
    .map((component) => componentPolygon(component, info.width, info.height, scale, width, height))
    .filter(Boolean);
  if (polygons.length === 0) {
    const insetX = Math.max(1, Math.round(width * 0.08));
    const insetY = Math.max(1, Math.round(height * 0.08));
    polygons.push([
      [insetX, insetY],
      [width - insetX, insetY],
      [width - insetX, Math.round(height * 0.78)],
      [insetX, Math.round(height * 0.78)],
    ]);
  }
  seedCache.set(key, polygons);
  return structuredClone(polygons);
}
