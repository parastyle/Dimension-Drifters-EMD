import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const INPUT = path.join(import.meta.dirname, "live-per-part-frames.json");
const OUTPUT = path.join(import.meta.dirname, "live-event-counts.json");
const raw = JSON.parse(await readFile(INPUT, "utf8"));

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

function seam(previous, current) {
  if (previous.weaponIds.join("+") !== current.weaponIds.join("+")) return "weapon swap";
  const movement = current.scenario.includes(":movement-");
  if (
    movement &&
    (previous.moveStance !== current.moveStance ||
      ((previous.height ?? 0) <= 0.5 && (current.height ?? 0) > 0.5))
  ) {
    return "movement interrupt";
  }
  if (previous.comboFamily !== "none" && current.comboFamily === "none") {
    return "chain drop/expiry";
  }
  if (
    previous.attackStage === "hold" &&
    current.attackStage === "rest" &&
    current.scenario.includes(":drop")
  ) {
    return "chain drop/expiry";
  }
  if (
    previous.comboStep !== current.comboStep &&
    (previous.attackStage !== "rest" || current.attackStage !== "rest")
  ) {
    return (previous.dual || current.dual) && previous.swingHand !== current.swingHand
      ? "dual-wield hand desync"
      : "combo step boundary";
  }
  if (previous.attackStage !== "attack" && current.attackStage === "attack") {
    return "rest → attack";
  }
  if (previous.attackStage === "attack" && current.attackStage !== "attack") {
    return "attack → rest";
  }
  if (previous.attackStage === "hold" && current.attackStage === "rest") {
    return "attack → rest";
  }
  return "within-pose / no named seam";
}

const groups = new Map();
for (const frame of raw.frames) {
  const key = `${frame.actorId}|${frame.scenario}`;
  const list = groups.get(key) ?? [];
  list.push(frame);
  groups.set(key, list);
}

const records = [];
for (const frames of groups.values()) {
  frames.sort((a, b) => a.frameIndex - b.frameIndex);
  const byPart = new Map();
  for (let index = 1; index < frames.length; index++) {
    const previous = frames[index - 1];
    const current = frames[index];
    const boundarySeam = seam(previous, current);
    for (const [part, now] of Object.entries(current.parts)) {
      const before = previous.parts[part];
      if (!before || (!before.rendered && !now.rendered)) continue;
      const record = {
        actorId: current.actorId,
        actorType: current.actorType,
        scenario: current.scenario,
        frameIndex: current.frameIndex,
        seam: boundarySeam,
        part,
        positionPx: Math.hypot(now.worldX - before.worldX, now.worldY - before.worldY),
        rotationRad: angleDistance(now.worldRotation, before.worldRotation),
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
      const neighbors = list
        .slice(Math.max(0, index - 15), Math.min(list.length, index + 16))
        .filter((candidate) => candidate !== record);
      const positionMedian = median(neighbors.map((candidate) => candidate.positionPx));
      const rotationMedian = median(neighbors.map((candidate) => candidate.rotationRad));
      record.flagged =
        (record.positionPx >= 4 &&
          record.positionPx >= 6 * Math.max(positionMedian, 0.001)) ||
        (record.rotationRad >= 0.12 &&
          record.rotationRad >= 6 * Math.max(rotationMedian, 0.0001));
    }
  }
}

const eventMap = new Map();
for (const record of records) {
  const key = `${record.actorId}|${record.scenario}|${record.frameIndex}`;
  const event = eventMap.get(key) ?? {
    seam: record.seam,
    actorType: record.actorType,
    flagged: false,
    partFlags: 0,
  };
  if (record.flagged) {
    event.flagged = true;
    event.partFlags++;
  }
  eventMap.set(key, event);
}

const counts = {};
for (const event of eventMap.values()) {
  const count = counts[event.seam] ?? { observed: 0, flagged: 0, partFlags: 0 };
  count.observed++;
  if (event.flagged) {
    count.flagged++;
    count.partFlags += event.partFlags;
  }
  counts[event.seam] = count;
}
const events = [...eventMap.values()];
const flaggedEvents = events.filter((event) => event.flagged);
const namedFlaggedEvents = flaggedEvents.filter(
  (event) => event.seam !== "within-pose / no named seam",
);
const actorCounts = Object.fromEntries(
  ["local", "remote"].map((actorType) => [
    actorType,
    {
      observed: events.filter((event) => event.actorType === actorType).length,
      flagged: flaggedEvents.filter((event) => event.actorType === actorType).length,
      namedFlagged: namedFlaggedEvents.filter((event) => event.actorType === actorType).length,
      bySeam: Object.fromEntries(
        Object.keys(counts).map((label) => [
          label,
          {
            observed: events.filter(
              (event) => event.actorType === actorType && event.seam === label,
            ).length,
            flagged: flaggedEvents.filter(
              (event) => event.actorType === actorType && event.seam === label,
            ).length,
          },
        ]),
      ),
    },
  ]),
);
const output = {
  generatedAt: new Date().toISOString(),
  uniqueBoundaryEvents: events.length,
  uniqueFlaggedEvents: flaggedEvents.length,
  uniqueNamedSeamFlaggedEvents: namedFlaggedEvents.length,
  namedShare: namedFlaggedEvents.length / flaggedEvents.length,
  counts,
  actorCounts,
};
await writeFile(OUTPUT, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify(output, null, 2));
