#!/usr/bin/env node
/**
 * Owner-sanctioned one-off surgery for x2-frostbore-scattergun.
 *
 * Both outputs retain the harvested source canvas. Pixels are partitioned at the painted receiver/breech
 * seam so compositing part-2 over part-1 at the original registration is byte-exact in decoded RGBA.
 * The original seam already contains a dark metal lip on each side, so no generated colours are introduced.
 */
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const SPRITE_DIR = path.join(
  ROOT,
  "packages/client/public/sprites/x2-frostbore-scattergun",
);
const PART_1 = path.join(SPRITE_DIR, "part-1.png");
const PART_2 = path.join(SPRITE_DIR, "part-2.png");
const REFERENCE = path.join(
  ROOT,
  "tools/artkit/fixtures/x2-frostbore-scattergun-closed.png",
);
const AUDIT = path.join(
  ROOT,
  "docs/owner-notes-audit-v11-evidence/b32-frostbore-breakaction/sprite-cut.json",
);

export const FROSTBORE_CUT_X = 785;
export const FROSTBORE_HINGE = Object.freeze({ x: 785, y: 243 });

await mkdir(path.dirname(REFERENCE), { recursive: true });
await mkdir(path.dirname(AUDIT), { recursive: true });
try {
  await readFile(REFERENCE);
} catch {
  await copyFile(PART_1, REFERENCE);
}

const { data, info } = await sharp(REFERENCE)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
if (info.width !== 1808 || info.height !== 459 || info.channels !== 4) {
  throw new Error(
    `Unexpected Frostbore source geometry ${info.width}x${info.height}x${info.channels}; expected 1808x459 RGBA`,
  );
}

const receiver = Buffer.from(data);
const barrels = Buffer.from(data);
let receiverPixels = 0;
let barrelPixels = 0;
for (let y = 0; y < info.height; y++) {
  for (let x = 0; x < info.width; x++) {
    const offset = (y * info.width + x) * 4;
    const alpha = data[offset + 3] ?? 0;
    if (x < FROSTBORE_CUT_X) {
      barrels.fill(0, offset, offset + 4);
      if (alpha > 0) receiverPixels++;
    } else {
      receiver.fill(0, offset, offset + 4);
      if (alpha > 0) barrelPixels++;
    }
  }
}

const png = (pixels) =>
  sharp(pixels, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
const [receiverPng, barrelPng] = await Promise.all([png(receiver), png(barrels)]);
await Promise.all([writeFile(PART_1, receiverPng), writeFile(PART_2, barrelPng)]);

const composite = await sharp(receiverPng)
  .composite([{ input: barrelPng, blend: "over" }])
  .ensureAlpha()
  .raw()
  .toBuffer();
let changedBytes = 0;
let maxChannelDelta = 0;
for (let index = 0; index < data.length; index++) {
  const delta = Math.abs((data[index] ?? 0) - (composite[index] ?? 0));
  if (delta > 0) changedBytes++;
  maxChannelDelta = Math.max(maxChannelDelta, delta);
}
if (changedBytes !== 0) {
  throw new Error(
    `Frostbore closed composite drifted: ${changedBytes} channel bytes changed, max delta ${maxChannelDelta}`,
  );
}

await writeFile(
  AUDIT,
  `${JSON.stringify(
    {
      source: path.relative(ROOT, REFERENCE).replaceAll("\\", "/"),
      outputs: [
        path.relative(ROOT, PART_1).replaceAll("\\", "/"),
        path.relative(ROOT, PART_2).replaceAll("\\", "/"),
      ],
      canvas: { width: info.width, height: info.height },
      cutX: FROSTBORE_CUT_X,
      hinge: FROSTBORE_HINGE,
      opaqueCoverage: { receiverPixels, barrelPixels },
      closedComposite: { changedBytes, maxChannelDelta },
      palettePolicy: "source pixels only; no generated colours",
    },
    null,
    2,
  )}\n`,
);
console.log(
  `cut Frostbore at x=${FROSTBORE_CUT_X}; hinge=(${FROSTBORE_HINGE.x},${FROSTBORE_HINGE.y}); closed RGBA diff=0`,
);
