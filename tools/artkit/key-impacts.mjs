#!/usr/bin/env node
// artkit/key-impacts.mjs — §48 chroma-key the impact FLIPBOOK strips in place (gen-sprint2 installs them
// resized but unkeyed; the flipbooks must be transparent before the client can additively blend them).
import { readdirSync, renameSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const DIR = resolve(here, "../../packages/client/public/vfx/impacts");
for (const f of readdirSync(DIR).filter((f) => f.endsWith(".png"))) {
  const p = resolve(DIR, f);
  const { data, info } = await sharp(p).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (g > 90 && g > r * 1.6 && g > b * 1.6) data[i + 3] = 0; // hard chroma green → fully transparent
    else if (g > 70 && g > r * 1.25 && g > b * 1.25) {
      // fringe: feather alpha + kill the green spill so glows blend clean
      data[i + 3] = Math.min(data[i + 3], 90);
      data[i + 1] = Math.min(g, Math.max(r, b));
    }
  }
  await sharp(data, { raw: info }).png().toFile(`${p}.tmp`);
  renameSync(`${p}.tmp`, p);
  console.log(`keyed ${f}`);
}
