import { statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const sharedEntryUrl = new URL("../packages/shared/src/index.ts", import.meta.url).href;
const progressionSuffix = "/packages/server/src/rooms/room/room-progression.ts";

const phaseNames = {
  0: "tick/input/grid/traversal",
  1: "player movement",
  2: "player body collision",
  2.4: "belt player collision",
  2.5: "player pitfalls",
  2.7: "money/victory",
  3: "clock/spawn director",
  4: "player combat/resource",
  4.6: "melee swings",
  4.65: "deferred attacks",
  4.7: "ultimates",
  5: "generic enemy AI",
  5.1: "enemy melee/combo AI",
  5.15: "boss AI",
  5.2: "enemy ranged fire",
  5.3: "projectiles",
  5.4: "zones",
  5.5: "enemy body collision",
  5.55: "belt enemy collision",
  5.6: "enemy pitfalls",
  6: "enemy contact damage",
  7: "regen/death/status cleanup",
};
const expectedPhaseOrder = [
  "0",
  "1",
  "2",
  "2.4",
  "2.5",
  "2.7",
  "3",
  "4",
  "4.6",
  "4.65",
  "4.7",
  "5",
  "5.1",
  "5.15",
  "5.2",
  "5.3",
  "5.4",
  "5.5",
  "5.55",
  "5.6",
  "6",
  "7",
];

function isFile(url) {
  try {
    return statSync(fileURLToPath(url)).isFile();
  } catch {
    return false;
  }
}

function instrumentStepSim(source) {
  const startNeedle = "  stepSim(this: GameRoomContext, dt: number): void {";
  const endNeedle =
    "\n  /** End every threat before the first celebration patch; player clocks/position remain untouched. */";
  const start = source.indexOf(startNeedle);
  const end = source.indexOf(endNeedle, start);
  if (start < 0 || end < 0) {
    throw new Error("b89 profiler could not locate the stepSim contract");
  }

  const before = source.slice(0, start);
  let body = source.slice(start, end);
  const after = source.slice(end);
  const seen = [];

  body = body.replace(/^ {4}\/\/ (\d+(?:\.\d+)*)(?:\.)? .+$/gm, (line, phaseId) => {
    const phaseName = phaseNames[phaseId];
    if (!phaseName) throw new Error(`b89 profiler found unknown stepSim phase ${phaseId}`);
    seen.push(phaseId);
    return `    globalThis.__b89Phase?.(${JSON.stringify(`${phaseId} ${phaseName}`)});\n${line}`;
  });

  if (seen.join(",") !== expectedPhaseOrder.join(",")) {
    throw new Error(
      `b89 profiler phase contract drifted: expected ${expectedPhaseOrder.join(",")}; found ${seen.join(",")}`,
    );
  }

  const closeNeedle = "\n  },";
  const close = body.lastIndexOf(closeNeedle);
  if (close < 0) throw new Error("b89 profiler could not locate the end of stepSim");
  body = `${body.slice(0, close)}\n    globalThis.__b89PhaseEnd?.();${body.slice(close)}`;
  return before + body + after;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "@dd/shared") {
    return { url: sharedEntryUrl, shortCircuit: true };
  }

  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (
      context.parentURL?.startsWith("file:") &&
      specifier.startsWith(".") &&
      specifier.endsWith(".js")
    ) {
      const candidate = new URL(`${specifier.slice(0, -3)}.ts`, context.parentURL);
      if (isFile(candidate)) return { url: candidate.href, shortCircuit: true };
    }
    throw error;
  }
}

export async function load(url, context, nextLoad) {
  if (!url.startsWith("file:") || (!url.endsWith(".ts") && !url.endsWith(".mts"))) {
    return nextLoad(url, context);
  }

  let source = await readFile(fileURLToPath(url), "utf8");
  if (url.replaceAll("\\", "/").endsWith(progressionSuffix)) {
    source = instrumentStepSim(source);
  }

  const output = ts.transpileModule(source, {
    fileName: fileURLToPath(url),
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      experimentalDecorators: true,
      useDefineForClassFields: false,
      esModuleInterop: true,
      skipLibCheck: true,
      sourceMap: false,
    },
  });
  return { format: "module", source: output.outputText, shortCircuit: true };
}
