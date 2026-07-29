import { performance } from "node:perf_hooks";

import {
  generateLavaLayout,
  LAVA_HERO_ROOM_RATE,
  LAVA_MAX_TRAVERSAL_GAP_PX,
  LAVA_MIN_PLATFORM_CLEARANCE_PX,
  measureLavaRoomClearance,
} from "@dd/shared";

const SEED_COUNT = 2_000;

function sample(index) {
  return {
    seedTerrain: Math.imul(index, 2_654_435_761) >>> 0,
    seedHazard: Math.imul(index, 97) >>> 0,
    seedTheme: Math.imul(index, 7_919) >>> 0,
    seedDecor: Math.imul(index, 104_729) >>> 0,
  };
}

const failures = [];
let heroLayouts = 0;
let destinationHeroes = 0;
const started = performance.now();

for (let index = 1; index <= SEED_COUNT; index++) {
  let layout;
  try {
    layout = generateLavaLayout(sample(index));
  } catch (error) {
    failures.push(`seed ${index} threw: ${String(error)}`);
    continue;
  }
  if (layout.rejectedPlacements !== 0)
    failures.push(`seed ${index}: ${layout.rejectedPlacements} rejected placements`);
  for (let first = 0; first < layout.rooms.length; first++) {
    for (let second = first + 1; second < layout.rooms.length; second++) {
      const a = layout.rooms[first];
      const b = layout.rooms[second];
      const clearance = measureLavaRoomClearance(a, b);
      if (clearance + 0.01 < LAVA_MIN_PLATFORM_CLEARANCE_PX)
        failures.push(
          `seed ${index}: ${a.nodeId}/${b.nodeId} clearance ${clearance} < ${LAVA_MIN_PLATFORM_CLEARANCE_PX}`,
        );
    }
  }
  for (const edge of layout.traversal) {
    if (edge.gapPx < LAVA_MIN_PLATFORM_CLEARANCE_PX || edge.gapPx > LAVA_MAX_TRAVERSAL_GAP_PX)
      failures.push(
        `seed ${index}: ${edge.from}->${edge.to} gap ${edge.gapPx} outside ` +
          `${LAVA_MIN_PLATFORM_CLEARANCE_PX}..${LAVA_MAX_TRAVERSAL_GAP_PX}`,
      );
  }
  if (layout.heroRoomId) {
    heroLayouts++;
    const instances = layout.rooms.filter((room) => room.prefabId === layout.heroRoomId);
    if (instances.length !== 1)
      failures.push(`seed ${index}: hero ${layout.heroRoomId} has ${instances.length} instances`);
    if (layout.heroRoomRole !== "hub") destinationHeroes++;
  }
}

const heroRate = heroLayouts / SEED_COUNT;
const destinationHeroRate = destinationHeroes / SEED_COUNT;
if (LAVA_HERO_ROOM_RATE !== 0.5)
  failures.push(`hero-room constant changed to ${LAVA_HERO_ROOM_RATE}`);
if (heroRate < 0.48) failures.push(`hero-room rate ${heroRate} < 0.48`);
if (destinationHeroRate < 0.2)
  failures.push(`destination hero-room rate ${destinationHeroRate} < 0.2`);

const result = {
  seeds: SEED_COUNT,
  elapsedMs: Math.round((performance.now() - started) * 1_000) / 1_000,
  rejectedPlacements: 0,
  touchingSurfaceFailures: failures.filter((failure) => failure.includes("clearance")).length,
  unjumpableEdgeFailures: failures.filter((failure) => failure.includes(" gap ")).length,
  heroRate,
  destinationHeroRate,
  failures,
};
console.log(JSON.stringify(result, null, 2));
if (failures.length > 0) process.exitCode = 1;
