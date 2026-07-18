#!/usr/bin/env node
// Deterministic fallback for installed decal packs whose original pack render
// is unavailable. Idempotent: constrain to max-8, then add four transparent
// pixels on every side and validate alpha >16 at the border.
import { readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { writePaddedCutout } from "./lib/map-art-processing.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(here, "../..");
const root = resolve(REPO, "packages/client/public/decals");
const theme = process.argv.find((arg) => arg.startsWith("--theme="))?.slice(8) ?? "wild-west";
const dir = theme === "wild-west" ? root : resolve(root, theme);
const files = readdirSync(dir).filter((name) => name.endsWith(".png")).sort();

for (const name of files) {
  const file = resolve(dir, name);
  const validation = await writePaddedCutout({ input: file, target: file, maxSize: 132 });
  console.log(`PADDED ${theme}/${name} ${validation.width}x${validation.height} margins=${validation.margins.join("/")}`);
}
console.log(`padded ${files.length} ${theme} decals`);
