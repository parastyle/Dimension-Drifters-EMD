import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../../../..");
const BEFORE = path.join(
  ROOT,
  "docs/owner-notes-audit-v7-evidence/katana-movesets/before/catalog-live-capture.json",
);
const AFTER = path.join(
  ROOT,
  "docs/owner-notes-audit-v7-evidence/katana-movesets/after/catalog-live-capture.json",
);
const OUTPUT = path.join(import.meta.dirname, "katana-commit-comparison.json");
const POSITION_FLOOR_PX = 4;
const ROTATION_FLOOR_RAD = 0.12;
const MULTIPLE = 6;
const LOCAL_RADIUS = 15;

function median(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function angleDistance(a, b) {
  return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
}

function attackStage(frame) {
  const poseMs = Math.max(0, Number(frame.poseSeconds ?? 0) * 1_000);
  const elapsed = Number(frame.sceneNow) - Number(frame.swingStart);
  return elapsed >= -34 && elapsed <= poseMs ? "attack" : "rest";
}

function seam(previous, current) {
  if (previous.comboStep !== current.comboStep) return "combo step boundary";
  const before = attackStage(previous);
  const after = attackStage(current);
  if (before !== "attack" && after === "attack") return "rest → attack";
  if (before === "attack" && after !== "attack") return "attack → rest";
  return "within-pose / no named seam";
}

function points(frame) {
  return {
    root: frame.root,
    "torso/body": frame.body,
    shadow: frame.shadow,
    "weapon:lead": frame.frontWeapon,
    "weapon:off": frame.backWeapon,
    "hand-arm:lead": frame.frontHand,
    "hand-arm:off": frame.backHand,
    "foot:lead": frame.frontFoot,
    "foot:off": frame.backFoot,
  };
}

function analyzeCapture(capture) {
  const frames = capture.frames;
  const records = [];
  const byPart = new Map();
  for (let index = 1; index < frames.length; index++) {
    const previous = frames[index - 1];
    const current = frames[index];
    const beforeParts = points(previous);
    const afterParts = points(current);
    const boundarySeam = seam(previous, current);
    for (const [part, after] of Object.entries(afterParts)) {
      const before = beforeParts[part];
      if (!before || !after || (!before.visible && !after.visible)) continue;
      const record = {
        index,
        frame: index,
        sceneNow: current.sceneNow,
        frameDtMs: current.wallMs - previous.wallMs,
        seam: boundarySeam,
        weapon: capture.id,
        part,
        positionPx: Math.hypot(after.x - before.x, after.y - before.y),
        rotationRad: angleDistance(after.rotation, before.rotation),
        fromStep: previous.comboStep,
        toStep: current.comboStep,
        fromStage: attackStage(previous),
        toStage: attackStage(current),
      };
      records.push(record);
      const list = byPart.get(part) ?? [];
      list.push(record);
      byPart.set(part, list);
    }
  }
  for (const list of byPart.values()) {
    for (let index = 0; index < list.length; index++) {
      const record = list[index];
      const local = list
        .slice(Math.max(0, index - LOCAL_RADIUS), Math.min(list.length, index + LOCAL_RADIUS + 1))
        .filter((candidate) => candidate !== record);
      record.localMedianPositionPx = median(local.map((candidate) => candidate.positionPx));
      record.localMedianRotationRad = median(local.map((candidate) => candidate.rotationRad));
      record.flagged =
        (record.positionPx >= POSITION_FLOOR_PX &&
          record.positionPx >= MULTIPLE * Math.max(record.localMedianPositionPx, 0.001)) ||
        (record.rotationRad >= ROTATION_FLOOR_RAD &&
          record.rotationRad >= MULTIPLE * Math.max(record.localMedianRotationRad, 0.0001));
    }
  }

  const seamPart = new Map();
  for (const record of records) {
    const key = `${record.seam}|${record.part}`;
    const aggregate = seamPart.get(key) ?? {
      seam: record.seam,
      part: record.part,
      opportunities: 0,
      fires: 0,
      positions: [],
      rotations: [],
      worstPositionPx: 0,
      worstRotationRad: 0,
    };
    aggregate.opportunities++;
    aggregate.positions.push(record.positionPx);
    aggregate.rotations.push(record.rotationRad);
    if (record.flagged) aggregate.fires++;
    aggregate.worstPositionPx = Math.max(aggregate.worstPositionPx, record.positionPx);
    aggregate.worstRotationRad = Math.max(aggregate.worstRotationRad, record.rotationRad);
    seamPart.set(key, aggregate);
  }
  const eventMap = new Map();
  for (const record of records) {
    const key = record.index;
    const event = eventMap.get(key) ?? { seam: record.seam, flagged: false };
    event.flagged ||= record.flagged;
    eventMap.set(key, event);
  }
  const events = [...eventMap.values()];
  const cadence = frames.slice(1).map((frame, index) => frame.wallMs - frames[index].wallMs);
  return {
    id: capture.id,
    frames: frames.length,
    medianFrameDtMs: median(cadence),
    uniqueEvents: events.length,
    uniqueFlaggedEvents: events.filter((event) => event.flagged).length,
    uniqueFlagsBySeam: Object.fromEntries(
      [...new Set(events.map((event) => event.seam))].map((label) => [
        label,
        events.filter((event) => event.seam === label && event.flagged).length,
      ]),
    ),
    seamPart: [...seamPart.values()].map((aggregate) => ({
      seam: aggregate.seam,
      part: aggregate.part,
      worstPositionPx: aggregate.worstPositionPx,
      worstRotationRad: aggregate.worstRotationRad,
      medianPositionPx: median(aggregate.positions),
      medianRotationRad: median(aggregate.rotations),
      fires: aggregate.fires,
      opportunities: aggregate.opportunities,
    })),
  };
}

async function analyzeFile(file) {
  const parsed = JSON.parse(await readFile(file, "utf8"));
  const captures = parsed.captures.map(analyzeCapture);
  const aggregateRows = new Map();
  for (const capture of captures) {
    for (const row of capture.seamPart) {
      const key = `${row.seam}|${row.part}`;
      const aggregate = aggregateRows.get(key) ?? {
        seam: row.seam,
        part: row.part,
        worstPositionPx: 0,
        worstRotationRad: 0,
        fires: 0,
        opportunities: 0,
      };
      aggregate.worstPositionPx = Math.max(aggregate.worstPositionPx, row.worstPositionPx);
      aggregate.worstRotationRad = Math.max(aggregate.worstRotationRad, row.worstRotationRad);
      aggregate.fires += row.fires;
      aggregate.opportunities += row.opportunities;
      aggregateRows.set(key, aggregate);
    }
  }
  return {
    phase: parsed.phase,
    weaponCount: captures.length,
    frameCount: captures.reduce((sum, capture) => sum + capture.frames, 0),
    uniqueFlaggedEvents: captures.reduce((sum, capture) => sum + capture.uniqueFlaggedEvents, 0),
    captures,
    aggregateSeamPart: [...aggregateRows.values()],
  };
}

const before = await analyzeFile(BEFORE);
if (global.gc) global.gc();
const after = await analyzeFile(AFTER);
const comparison = {
  generatedAt: new Date().toISOString(),
  sourceCommit: "c072111",
  method: {
    note: "Reanalysis of the commit's checked-in live before/after captures; local transforms because those traces did not retain world matrices.",
    positionThreshold: `>= ${POSITION_FLOOR_PX}px and >= ${MULTIPLE}x local median`,
    rotationThreshold: `>= ${ROTATION_FLOOR_RAD}rad and >= ${MULTIPLE}x local median`,
    localWindow: `${LOCAL_RADIUS} prior + ${LOCAL_RADIUS} following comparable part boundaries`,
  },
  before,
  after,
};
await writeFile(OUTPUT, `${JSON.stringify(comparison, null, 2)}\n`, "utf8");
console.log(
  JSON.stringify(
    {
      output: OUTPUT,
      before: {
        frames: before.frameCount,
        flags: before.uniqueFlaggedEvents,
      },
      after: {
        frames: after.frameCount,
        flags: after.uniqueFlaggedEvents,
      },
    },
    null,
    2,
  ),
);
