import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const PART_NAMES = ["body", "head", "hand-front", "hand-back", "foot-front", "foot-back", "weapon"];
const FRAME_60_MS = 1000 / 60;
const MAX_NORMALIZED_ROOT_STEP_PX = 11.5;
const MAX_NORMALIZED_PART_POP_PX = 6;

const label = process.argv[2];
if (!label) throw new Error("usage: node tools/b53-summarize-trace.mjs <before|after>");
const evidencePath = path.resolve(
  "docs/owner-notes-audit-v12-evidence/b53-flip-warp",
  `${label}-per-frame-trace.json`,
);

function round(value) {
  return Number(value.toFixed(4));
}

function analyzeSteps(frames, pointAt, thresholdPx) {
  const discontinuities = [];
  let samples = 0;
  let maxStepPx = 0;
  let maxNormalizedStepPx = 0;
  let maxEvent;
  for (let index = 1; index < frames.length; index++) {
    const previous = frames[index - 1];
    const current = frames[index];
    if (!previous.flipActive && !current.flipActive && previous.facing === current.facing) continue;
    const a = pointAt(previous);
    const b = pointAt(current);
    if (!a || !b) continue;
    samples += 1;
    const dtMs = Math.max(0.001, current.sceneMs - previous.sceneMs);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const stepPx = Math.hypot(dx, dy);
    const normalizedStepPx = stepPx * Math.min(1, FRAME_60_MS / Math.max(FRAME_60_MS, dtMs));
    const event = {
      frame: current.frame,
      sceneMs: round(current.sceneMs),
      dtMs: round(dtMs),
      dx: round(dx),
      dy: round(dy),
      stepPx: round(stepPx),
      normalizedStepPx: round(normalizedStepPx),
      facing: current.facing,
      facingBlend: round(current.facingBlend),
      flipProgress: round(current.flipProgress),
    };
    maxStepPx = Math.max(maxStepPx, stepPx);
    if (normalizedStepPx > maxNormalizedStepPx) {
      maxNormalizedStepPx = normalizedStepPx;
      maxEvent = event;
    }
    if (normalizedStepPx > thresholdPx) discontinuities.push(event);
  }
  return {
    samples,
    maxStepPx: round(maxStepPx),
    maxNormalizedStepPx: round(maxNormalizedStepPx),
    maxEvent,
    discontinuities,
  };
}

function reanalyze(trace) {
  const parts = {};
  for (const name of PART_NAMES) {
    const stats = analyzeSteps(
      trace.frames,
      (frame) => {
        const part = frame.parts[name];
        return part ? { x: part.x - frame.root.x, y: part.y - frame.root.y } : undefined;
      },
      MAX_NORMALIZED_PART_POP_PX,
    );
    if (stats.samples > 0) parts[name] = stats;
  }
  return {
    ...trace,
    root: analyzeSteps(
      trace.frames,
      (frame) => ({ x: frame.root.x, y: frame.root.y }),
      MAX_NORMALIZED_ROOT_STEP_PX,
    ),
    parts,
    targetChanges: trace.frames.flatMap((frame, index) =>
      index > 0 && frame.facing !== trace.frames[index - 1].facing
        ? [
            {
              frame: frame.frame,
              facing: frame.facing,
              facingBlend: round(frame.facingBlend),
              flipProgress: round(frame.flipProgress),
            },
          ]
        : [],
    ),
  };
}

function summarize(trace) {
  return {
    scenario: trace.scenario,
    frames: trace.frames.length,
    targetChanges: trace.targetChanges,
    root: {
      maxStepPx: trace.root.maxStepPx,
      maxNormalizedStepPx: trace.root.maxNormalizedStepPx,
      discontinuities: trace.root.discontinuities,
    },
    parts: Object.fromEntries(
      Object.entries(trace.parts).map(([name, stats]) => [
        name,
        {
          maxStepPx: stats.maxStepPx,
          maxNormalizedStepPx: stats.maxNormalizedStepPx,
          maxEvent: stats.maxEvent,
          discontinuities: stats.discontinuities,
        },
      ]),
    ),
  };
}

const evidence = JSON.parse(await readFile(evidencePath, "utf8"));
evidence.measurement =
  "World-space part pivot motion relative to the rendered root during facing-flip windows, normalized to a 60 Hz frame; raw world positions and raw steps are retained.";
evidence.thresholds = {
  normalizedRootStepPx: MAX_NORMALIZED_ROOT_STEP_PX,
  normalizedPartPopPx: MAX_NORMALIZED_PART_POP_PX,
};
evidence.traces = evidence.traces.map(reanalyze);
evidence.summary = evidence.traces.map(summarize);
await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
