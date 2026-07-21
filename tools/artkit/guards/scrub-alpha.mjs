#!/usr/bin/env node
// Remove tiny disconnected alpha islands left by chroma-keyed weapon renders. This is the same
// 64-pixel contract used by gen-gear before registration; genuine weapon parts remain untouched.
import { existsSync, renameSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";
import {
  scrubSmallAlphaComponents,
  VALIDATION_THRESHOLDS,
} from "../lib/gear-replacement-contract.mjs";

const files = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
const minimumPixels = Number(
  process.argv.find((arg) => arg.startsWith("--minimum="))?.slice(10) ?? 64,
);

if (files.length === 0) {
  console.error(
    "Usage: node guards/scrub-alpha.mjs <keyed.png>... [--minimum=64]",
  );
  process.exit(2);
}

for (const input of files) {
  const file = resolve(input);
  if (!existsSync(file)) throw new Error(`Missing keyed image: ${file}`);
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const alpha = new Uint8Array(info.width * info.height);
  for (
    let source = 3, target = 0;
    source < data.length;
    source += 4, target++
  ) {
    alpha[target] = data[source];
  }
  const report = scrubSmallAlphaComponents(
    alpha,
    info.width,
    info.height,
    minimumPixels,
    VALIDATION_THRESHOLDS.visibleAlpha,
  );
  if (report.removedPixels === 0) {
    console.log(`scrubbed ${file} — no alpha specks found`);
    continue;
  }
  for (
    let source = 3, target = 0;
    source < data.length;
    source += 4, target++
  ) {
    if (alpha[target] !== 0 || data[source] === 0) continue;
    data.fill(0, source - 3, source + 1);
  }
  const temporary = `${file}.${process.pid}.tmp.png`;
  try {
    await sharp(data, {
      raw: { width: info.width, height: info.height, channels: 4 },
    })
      .png({ compressionLevel: 9 })
      .toFile(temporary);
    renameSync(temporary, file);
  } finally {
    rmSync(temporary, { force: true });
  }
  console.log(
    `scrubbed ${file} — removed ${report.removedComponentCount} island(s), ${report.removedPixels}px`,
  );
}
