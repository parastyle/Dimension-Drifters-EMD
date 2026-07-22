#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { emit, isCheck } from "../artkit/lib/emit.mjs";
import { compileLdtkProject, parseLdtkJson, renderGeneratedCatalog } from "./ldtk-import.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const DEFAULT_SOURCE = resolve(REPO, "data", "arenas", "dimension-drifters.ldtk");
const DEFAULT_OUTPUT = resolve(REPO, "packages", "shared", "src", "authored-arenas.generated.ts");

function parseArgs(argv) {
  let sourcePath = DEFAULT_SOURCE;
  let outputPath = DEFAULT_OUTPUT;
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === "--check") continue;
    if (arg === "--source" || arg === "--out") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`${arg} requires a path`);
      if (arg === "--source") sourcePath = resolve(value);
      else outputPath = resolve(value);
      index++;
      continue;
    }
    throw new Error(`unknown argument ${arg}`);
  }
  return { sourcePath, outputPath };
}

async function loadSharedContract() {
  try {
    return await import("../../packages/shared/dist/index.js");
  } catch (error) {
    throw new Error(
      "the shared build is unavailable; run `pnpm --filter @dd/shared build` before the LDtk generator" +
        ` (${error instanceof Error ? error.message : String(error)})`,
    );
  }
}

try {
  const { sourcePath, outputPath } = parseArgs(process.argv.slice(2));
  const shared = await loadSharedContract();
  const source = readFileSync(sourcePath, "utf8");
  const project = parseLdtkJson(source, sourcePath);
  const records = compileLdtkProject(project, { shared, sourceLabel: sourcePath });
  const output = renderGeneratedCatalog(records);
  emit(outputPath, output, basename(outputPath));
  if (!isCheck)
    console.log(
      `wrote ${basename(outputPath)} — ${records.length} authored arena${records.length === 1 ? "" : "s"}: ` +
        records.map((record) => `${record.id}@${record.revision.slice(7, 19)}`).join(", "),
    );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
