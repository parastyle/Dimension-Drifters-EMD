#!/usr/bin/env node
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(here, "../..");
const TILES = resolve(REPO, "packages/client/public/tiles");
const REQUIRED = ["tile-0.png", "tile-1.png", "tile-2.png", "tile-3.png", "rim.png"];
const dimensions = process.argv.slice(2);

if (!dimensions.length) {
  console.error("Usage: node tools/artkit/check-tile-values.mjs <dimension> [dimension...]");
  process.exit(2);
}

const round = (value, places = 2) => Number(value.toFixed(places));
const luminance = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

function statsForRegion(data, width, { x = 0, y = 0, regionWidth = width, regionHeight, channels }) {
  let alphaTotal = 0;
  let weightedTotal = 0;
  let min = 255;
  let max = 0;
  for (let py = y; py < y + regionHeight; py++) {
    for (let px = x; px < x + regionWidth; px++) {
      const index = (py * width + px) * channels;
      const alpha = channels === 4 ? data[index + 3] / 255 : 1;
      if (alpha <= 0) continue;
      const value = luminance(data[index], data[index + 1], data[index + 2]);
      alphaTotal += alpha;
      weightedTotal += value * alpha;
      min = Math.min(min, value);
      max = Math.max(max, value);
    }
  }
  if (!alphaTotal) return { mean: 0, min: 0, max: 0, spread: 0 };
  const mean = weightedTotal / alphaTotal;
  return {
    mean,
    min,
    max,
    spread: Math.max(mean - min, max - mean),
  };
}

function rgbStatsForRegion(
  data,
  width,
  { x = 0, y = 0, regionWidth = width, regionHeight, channels },
) {
  let alphaTotal = 0;
  const totals = [0, 0, 0];
  for (let py = y; py < y + regionHeight; py++) {
    for (let px = x; px < x + regionWidth; px++) {
      const index = (py * width + px) * channels;
      const alpha = channels === 4 ? data[index + 3] / 255 : 1;
      if (alpha <= 0) continue;
      alphaTotal += alpha;
      for (let channel = 0; channel < 3; channel++) {
        totals[channel] += data[index + channel] * alpha;
      }
    }
  }
  return totals.map((total) => (alphaTotal ? total / alphaTotal : 0));
}

function ashlandsPaletteStats(data, width, height, channels) {
  const inset = 32;
  const nonAccentColours = new Map();
  let accentPixels = 0;
  let pixels = 0;
  for (let y = inset; y < height - inset; y++) {
    for (let x = inset; x < width - inset; x++) {
      const index = (y * width + x) * channels;
      const alpha = channels === 4 ? data[index + 3] / 255 : 1;
      if (alpha <= 0) continue;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      const isAccent = r - Math.max(g, b) >= 35 && r >= g * 1.3;
      if (isAccent) accentPixels++;
      else nonAccentColours.set(`${r},${g},${b}`, [r, g, b]);
      pixels++;
    }
  }
  const ranked = [...nonAccentColours.values()].sort(
    (left, right) => luminance(...left) - luminance(...right),
  );
  const darkest = ranked[0];
  const nextDarkest = ranked[1];
  const inkPresent =
    darkest &&
    nextDarkest &&
    darkest[1] + 6 <= Math.min(darkest[0], darkest[2]) &&
    luminance(...nextDarkest) - luminance(...darkest) >= 3;
  return {
    surfaceColours: nonAccentColours.size - (inkPresent ? 1 : 0),
    inkPresent,
    accentFraction: pixels ? accentPixels / pixels : 0,
  };
}

async function readImage(file) {
  return sharp(file).toColourspace("srgb").raw().toBuffer({ resolveWithObject: true });
}

function formatStats(stats) {
  return `mean=${stats.mean.toFixed(2)} min=${stats.min.toFixed(2)} max=${stats.max.toFixed(2)} spread=±${stats.spread.toFixed(2)}`;
}

let failed = false;
for (const dimension of dimensions) {
  const dir = resolve(TILES, dimension);
  const missing = REQUIRED.filter((name) => !existsSync(resolve(dir, name)));
  if (missing.length) {
    console.error(`${dimension}: FAIL missing ${missing.join(", ")}`);
    failed = true;
    continue;
  }

  console.log(`${dimension}:`);
  const tileMeans = [];
  let familyAccentFraction = 0;
  for (let index = 0; index < 4; index++) {
    const name = `tile-${index}.png`;
    const decoded = await readImage(resolve(dir, name));
    const { data, info } = decoded;
    const stats = statsForRegion(data, info.width, {
      regionHeight: info.height,
      channels: info.channels,
    });
    const reasons = [];
    if (info.width !== 512 || info.height !== 512) reasons.push(`expected 512x512, got ${info.width}x${info.height}`);
    if (info.channels === 4) {
      for (let offset = 3; offset < data.length; offset += 4) {
        if (data[offset] !== 255) {
          reasons.push("must be fully opaque");
          break;
        }
      }
    }
    if (stats.mean < 70 || stats.mean > 125) reasons.push("mean outside 70-125");
    if (stats.spread > 18) reasons.push("spread exceeds ±18");
    const rgb = rgbStatsForRegion(data, info.width, {
      regionHeight: info.height,
      channels: info.channels,
    });
    let paletteSummary = "";
    if (dimension === "ashlands" && info.width === 512 && info.height === 512) {
      const palette = ashlandsPaletteStats(data, info.width, info.height, info.channels);
      familyAccentFraction += palette.accentFraction;
      if (palette.surfaceColours < 4 || palette.surfaceColours > 6) {
        reasons.push(`expected 4-6 surface colours, got ${palette.surfaceColours}`);
      }
      if (!palette.inkPresent) reasons.push("distinct dark warm-purple ink is absent");
      if (palette.accentFraction > 0.08) {
        reasons.push(`accent covers ${(palette.accentFraction * 100).toFixed(2)}%, exceeds 8%`);
      }
      paletteSummary =
        ` rgb=(${rgb.map((channel) => channel.toFixed(2)).join(",")})` +
        ` palette=${palette.surfaceColours}+ink accent=${(palette.accentFraction * 100).toFixed(3)}%`;
    }
    const pass = reasons.length === 0;
    if (!pass) failed = true;
    tileMeans.push(stats.mean);
    console.log(
      `  ${name.padEnd(10)} ${formatStats(stats)}${paletteSummary} ${pass ? "PASS" : `FAIL (${reasons.join("; ")})`}`,
    );
  }
  if (dimension === "ashlands" && familyAccentFraction <= 0) {
    console.log("  palette     FAIL (theme accent is absent from all four tiles)");
    failed = true;
  }

  const familyMean = tileMeans.reduce((sum, value) => sum + value, 0) / tileMeans.length;
  const familyDrift = Math.max(...tileMeans.map((value) => Math.abs(value - familyMean)));
  const familyPass = familyDrift <= 12;
  if (!familyPass) failed = true;
  console.log(
    `  family     mean=${familyMean.toFixed(2)} max-drift=±${familyDrift.toFixed(2)} ${familyPass ? "PASS" : "FAIL (exceeds ±12)"}`,
  );

  const rimDecoded = await readImage(resolve(dir, "rim.png"));
  const { data: rimData, info: rimInfo } = rimDecoded;
  const rimWhole = statsForRegion(rimData, rimInfo.width, {
    regionHeight: rimInfo.height,
    channels: rimInfo.channels,
  });
  const rimReasons = [];
  if (rimInfo.width !== 1024 || rimInfo.height !== 256) {
    rimReasons.push(`expected 1024x256, got ${rimInfo.width}x${rimInfo.height}`);
  } else {
    const ground = statsForRegion(rimData, rimInfo.width, {
      y: 0,
      regionHeight: 125,
      channels: rimInfo.channels,
    });
    const lip = statsForRegion(rimData, rimInfo.width, {
      y: 126,
      regionHeight: 5,
      channels: rimInfo.channels,
    });
    const wall = statsForRegion(rimData, rimInfo.width, {
      y: 131,
      regionHeight: 93,
      channels: rimInfo.channels,
    });
    const voidBand = statsForRegion(rimData, rimInfo.width, {
      y: 224,
      regionHeight: 32,
      channels: rimInfo.channels,
    });
    const centreRow = statsForRegion(rimData, rimInfo.width, {
      y: 128,
      regionHeight: 1,
      channels: rimInfo.channels,
    });
    const neighbourRows = [125, 131].map(
      (y) =>
        statsForRegion(rimData, rimInfo.width, {
          y,
          regionHeight: 1,
          channels: rimInfo.channels,
        }).mean,
    );
    const splitPass = centreRow.mean < Math.min(...neighbourRows);
    if (ground.mean < 70 || ground.mean > 125) rimReasons.push(`ground mean ${round(ground.mean)} outside 70-125`);
    if (wall.mean < 30 || wall.mean > 60) rimReasons.push(`wall mean ${round(wall.mean)} outside 30-60`);
    if (voidBand.mean > 25) rimReasons.push(`pit void mean ${round(voidBand.mean)} exceeds 25`);
    if (!splitPass) rimReasons.push("dark lip/split is not centred at y=128");
    console.log(
      `  rim bands  ground=${ground.mean.toFixed(2)} lip@128=${centreRow.mean.toFixed(2)} wall=${wall.mean.toFixed(2)} void=${voidBand.mean.toFixed(2)}`,
    );
    console.log(`  rim lip    y=126..130 mean=${lip.mean.toFixed(2)} split=y128 ${splitPass ? "PASS" : "FAIL"}`);
  }
  if (rimInfo.channels === 4) {
    for (let offset = 3; offset < rimData.length; offset += 4) {
      if (rimData[offset] !== 255) {
        rimReasons.push("must be fully opaque");
        break;
      }
    }
  }
  const rimPass = rimReasons.length === 0;
  if (!rimPass) failed = true;
  console.log(
    `  rim.png    ${formatStats(rimWhole)} ${rimPass ? "PASS" : `FAIL (${rimReasons.join("; ")})`}`,
  );
}

process.exitCode = failed ? 1 : 0;
