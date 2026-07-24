#!/usr/bin/env node

import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { emit, isCheck } from "../artkit/lib/emit.mjs";
import {
  compileCorporateGridProject,
  parseCorporateGridJson,
  renderCorporateGridCatalog,
} from "./corporate-grid-import.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const SOURCE_DIR = resolve(REPO, "data", "maps", "corporate-grid");
const SOURCE = resolve(SOURCE_DIR, "corporate_grid_v13_imagegen_material_variants.ldtk");
const OUTPUT = resolve(REPO, "packages", "shared", "src", "corporate-grid-map.generated.ts");
const PUBLIC_DIR = resolve(REPO, "packages", "client", "public", "maps", "corporate-grid");

function syncAsset(sourcePath, publicPath) {
  const source = resolve(SOURCE_DIR, sourcePath);
  const target = resolve(REPO, "packages", "client", "public", publicPath);
  const sourceBytes = readFileSync(source);
  const matches = existsSync(target) && sourceBytes.equals(readFileSync(target));
  if (isCheck) {
    if (matches) {
      console.log(`✓ ${publicPath} is in sync`);
      return;
    }
    console.error(
      `✗ ${publicPath} is STALE - re-run tools/mapkit/gen-corporate-grid.mjs and commit it`,
    );
    process.exitCode = 1;
    return;
  }
  mkdirSync(PUBLIC_DIR, { recursive: true });
  if (!matches) copyFileSync(source, target);
}

try {
  const source = readFileSync(SOURCE, "utf8");
  const project = parseCorporateGridJson(source, SOURCE);
  const catalog = compileCorporateGridProject(project, { sourceLabel: SOURCE });
  emit(OUTPUT, renderCorporateGridCatalog(catalog), basename(OUTPUT));
  for (const tileset of catalog.tilesets) syncAsset(tileset.sourcePath, tileset.publicPath);
  if (!isCheck) {
    const synthesized = catalog.floors.reduce(
      (total, floor) =>
        total + floor.waveAnchors.filter((anchor) => anchor.source === "synthetic").length,
      0,
    );
    console.log(
      `wrote ${basename(OUTPUT)} - ${catalog.floors.length} floors, ${synthesized} synthesized wave anchors`,
    );
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
