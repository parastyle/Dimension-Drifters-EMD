#!/usr/bin/env node
import { mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { alphaStats } from "./lib/map-art-processing.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(here, "../..");
const PUBLIC = resolve(REPO, "packages/client/public");
const THEMES = ["wild-west", "frostfell", "verdant-ruins", "ashlands", "neon-cyber"];
const DIRS = {
  "wild-west": { pois: resolve(PUBLIC, "pois"), decals: resolve(PUBLIC, "decals") },
  frostfell: { pois: resolve(PUBLIC, "pois/frostfell"), decals: resolve(PUBLIC, "decals/frostfell") },
  "verdant-ruins": { pois: resolve(PUBLIC, "pois/verdant-ruins"), decals: resolve(PUBLIC, "decals/verdant-ruins") },
  ashlands: { pois: resolve(PUBLIC, "pois/ashlands"), decals: resolve(PUBLIC, "decals/ashlands") },
  "neon-cyber": { pois: resolve(PUBLIC, "pois/neon-cyber"), decals: resolve(PUBLIC, "decals/neon-cyber") },
};

const round = (value, places = 3) => Number(value.toFixed(places));
const pngs = (dir) => readdirSync(dir).filter((name) => name.endsWith(".png")).map((name) => resolve(dir, name));
const rel = (file) => file.slice(PUBLIC.length + 1).replaceAll("\\", "/");

async function rgb(file) {
  const { data, info } = await sharp(file).removeAlpha().toColourspace("srgb").raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

function percentile(values, q) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) * q)] ?? 0;
}

function compareEdges(a, b, axis) {
  const deltas = [];
  let total = 0;
  if (axis === "horizontal") {
    if (a.height !== b.height) throw new Error("horizontal edge height mismatch");
    for (let y = 0; y < a.height; y++) {
      const ai = (y * a.width + (a.width - 1)) * 3;
      const bi = y * b.width * 3;
      let pixel = 0;
      for (let channel = 0; channel < 3; channel++) pixel += Math.abs(a.data[ai + channel] - b.data[bi + channel]);
      total += pixel;
      deltas.push(pixel / 3);
    }
  } else {
    if (a.width !== b.width) throw new Error("vertical edge width mismatch");
    for (let x = 0; x < a.width; x++) {
      const ai = ((a.height - 1) * a.width + x) * 3;
      const bi = x * 3;
      let pixel = 0;
      for (let channel = 0; channel < 3; channel++) pixel += Math.abs(a.data[ai + channel] - b.data[bi + channel]);
      total += pixel;
      deltas.push(pixel / 3);
    }
  }
  return { mae: round(total / (deltas.length * 3)), p95: round(percentile(deltas, 0.95)) };
}

function rgbToLab(r8, g8, b8) {
  const linear = (c8) => {
    const c = c8 / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const r = linear(r8);
  const g = linear(g8);
  const b = linear(b8);
  const x = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047;
  const y = r * 0.2126729 + g * 0.7151522 + b * 0.072175;
  const z = (r * 0.0193339 + g * 0.119192 + b * 0.9503041) / 1.08883;
  const f = (v) => (v > 216 / 24389 ? Math.cbrt(v) : (24389 / 27 * v + 16) / 116);
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

async function labHistogram(file) {
  const { data, info } = await sharp(file).ensureAlpha().toColourspace("srgb").raw().toBuffer({ resolveWithObject: true });
  const hist = new Float64Array(512);
  let count = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 32) continue;
    const [l, a, b] = rgbToLab(data[i], data[i + 1], data[i + 2]);
    const lb = Math.max(0, Math.min(7, Math.floor((l / 100) * 8)));
    const ab = Math.max(0, Math.min(7, Math.floor(((a + 128) / 256) * 8)));
    const bb = Math.max(0, Math.min(7, Math.floor(((b + 128) / 256) * 8)));
    hist[(lb * 8 + ab) * 8 + bb]++;
    count++;
  }
  if (count) for (let i = 0; i < hist.length; i++) hist[i] /= count;
  return hist;
}

function jsDistance(a, b) {
  let divergence = 0;
  for (let i = 0; i < a.length; i++) {
    const m = (a[i] + b[i]) / 2;
    if (a[i] > 0) divergence += 0.5 * a[i] * Math.log2(a[i] / m);
    if (b[i] > 0) divergence += 0.5 * b[i] * Math.log2(b[i] / m);
  }
  return Math.sqrt(Math.max(0, divergence));
}

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

async function paletteReport(files) {
  const histograms = await Promise.all(files.map(labHistogram));
  const consensus = new Float64Array(512);
  for (const hist of histograms) for (let i = 0; i < hist.length; i++) consensus[i] += hist[i] / histograms.length;
  const distances = histograms.map((hist) => jsDistance(hist, consensus));
  const center = median(distances);
  const mad = median(distances.map((value) => Math.abs(value - center)));
  return files.map((file, index) => ({
    file: rel(file),
    distance: round(distances[index], 5),
    robustZ: round(mad ? (distances[index] - center) / (1.4826 * mad) : 0, 2),
  })).sort((a, b) => b.robustZ - a.robustZ);
}

async function propReport(file) {
  const decoded = await sharp(file).ensureAlpha().toColourspace("srgb").raw().toBuffer({ resolveWithObject: true });
  const { data, info } = decoded;
  const alpha = alphaStats(data, info.width, info.height, 16);
  let dark = 0;
  let bandVisible = 0;
  const darkColumns = new Set();
  if (alpha.bbox) {
    const box = alpha.bbox;
    const bandTop = Math.max(box.y0, box.y1 - Math.max(4, Math.round((box.y1 - box.y0 + 1) * 0.18)) + 1);
    for (let y = bandTop; y <= box.y1; y++) {
      for (let x = box.x0; x <= box.x1; x++) {
        const i = (y * info.width + x) * 4;
        if (data[i + 3] <= 16) continue;
        bandVisible++;
        const max = Math.max(data[i], data[i + 1], data[i + 2]);
        const min = Math.min(data[i], data[i + 1], data[i + 2]);
        const luma = data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722;
        if (luma < 92 && max - min < 48) {
          dark++;
          darkColumns.add(x);
        }
      }
    }
  }
  const bboxWidth = alpha.bbox ? alpha.bbox.x1 - alpha.bbox.x0 + 1 : 1;
  const darkNeutralBand = bandVisible ? dark / bandVisible : 0;
  const horizontalSpan = darkColumns.size / bboxWidth;
  return {
    file: rel(file),
    bytes: statSync(file).size,
    width: info.width,
    height: info.height,
    channels: info.channels,
    hasAlpha: info.channels === 4,
    visible: alpha.visible,
    borderVisiblePixels: alpha.borderVisiblePixels,
    margins: alpha.margins,
    alphaGate: alpha.visible > 0 && alpha.borderVisiblePixels === 0 && alpha.margins.every((value) => value >= 4),
    shadowRisk: round(darkNeutralBand * horizontalSpan, 4),
    darkNeutralBand: round(darkNeutralBand, 4),
    horizontalSpan: round(horizontalSpan, 4),
  };
}

const report = {
  label: process.argv.find((arg) => arg.startsWith("--label="))?.slice(8) ?? "map-art-qa",
  generatedAt: new Date().toISOString(),
  seams: {},
  props: [],
  palette: {},
};

for (const theme of THEMES) {
  const tileFiles = [0, 1, 2, 3].map((index) => resolve(PUBLIC, `tiles/${theme}/tile-${index}.png`));
  const decoded = await Promise.all(tileFiles.map(rgb));
  const self = decoded.map((tile, index) => ({
    file: rel(tileFiles[index]),
    lr: compareEdges(tile, tile, "horizontal"),
    tb: compareEdges(tile, tile, "vertical"),
  }));
  const cross = [];
  for (let a = 0; a < decoded.length; a++) for (let b = 0; b < decoded.length; b++) {
    if (a === b) continue;
    cross.push({ from: a, to: b, horizontal: compareEdges(decoded[a], decoded[b], "horizontal"), vertical: compareEdges(decoded[a], decoded[b], "vertical") });
  }
  const rimFile = resolve(PUBLIC, `tiles/${theme}/rim.png`);
  const rim = await rgb(rimFile);
  report.seams[theme] = {
    self,
    worstHorizontal: [...cross].sort((a, b) => b.horizontal.mae - a.horizontal.mae)[0],
    worstVertical: [...cross].sort((a, b) => b.vertical.mae - a.vertical.mae)[0],
    rim: { file: rel(rimFile), ...compareEdges(rim, rim, "horizontal") },
  };

  const propFiles = [...pngs(DIRS[theme].pois), ...pngs(DIRS[theme].decals)];
  report.props.push(...(await Promise.all(propFiles.map(propReport))));
  report.palette[theme] = await paletteReport([...tileFiles, rimFile, ...propFiles]);
}

const ground = await sharp(resolve(PUBLIC, "tiles/ground.jpg")).metadata();
report.ground = { width: ground.width, height: ground.height, format: ground.format, channels: ground.channels, hasAlpha: ground.hasAlpha };
report.summary = {
  tileGateFailures: Object.values(report.seams).flatMap((theme) => theme.self).filter((tile) => tile.lr.mae > 2 || tile.lr.p95 > 6 || tile.tb.mae > 2 || tile.tb.p95 > 6).length,
  crossGateFailures: Object.values(report.seams).filter((theme) => theme.worstHorizontal.horizontal.mae > 4 || theme.worstHorizontal.horizontal.p95 > 12 || theme.worstVertical.vertical.mae > 4 || theme.worstVertical.vertical.p95 > 12).length,
  rimGateFailures: Object.values(report.seams).filter((theme) => theme.rim.mae > 2 || theme.rim.p95 > 6).length,
  props: report.props.length,
  alphaGateFailures: report.props.filter((prop) => !prop.alphaGate).length,
  borderTouching: report.props.filter((prop) => prop.borderVisiblePixels > 0).length,
  paletteExtremeCount: Object.values(report.palette).flat().filter((asset) => asset.robustZ >= 3.5).length,
};

console.log(JSON.stringify(report.summary, null, 2));
for (const theme of THEMES) {
  const seam = report.seams[theme];
  console.log(`${theme}: worst H ${seam.worstHorizontal.from}->${seam.worstHorizontal.to} ${seam.worstHorizontal.horizontal.mae}/${seam.worstHorizontal.horizontal.p95}; worst V ${seam.worstVertical.from}->${seam.worstVertical.to} ${seam.worstVertical.vertical.mae}/${seam.worstVertical.vertical.p95}; rim ${seam.rim.mae}/${seam.rim.p95}`);
}
const jsonArg = process.argv.find((arg) => arg.startsWith("--json="));
if (jsonArg) {
  const output = resolve(REPO, jsonArg.slice(7));
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`wrote ${output}`);
}
