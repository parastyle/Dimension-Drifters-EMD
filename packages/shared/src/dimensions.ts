/**
 * §17 DIMENSIONS — the data-driven theme registry. "One big themed room per stage = one dimension"; a run
 * is a chain of these (§6). Each dimension owns a spawn ROSTER (which `ENEMY_KINDS` spawn here — so frost
 * revenants never appear in the desert), a BOSS, an environmental HAZARD, a floor PALETTE (a re-skin of the
 * "Dust & The Drop" language), and client ASSET set keys (ground tile + POI/decal manifests). The active
 * dimension id is synced on `ArenaState.dimensionId`; the server scopes spawns to it and the client picks
 * the palette + asset sets from it. Wild West is dimension 1; the rest are added as their art lands.
 */

import { EXTRA_DIMENSIONS } from "./dimensions.generated.js";

/** Floor/pit/rim/decor colours (hex) — the §17 "Dust & The Drop" slots, re-skinned per theme. Keep the RIM
 *  (rust band + amber lip) a HOT static telegraph, the spawn ring COOL (cyan), both distinct from the
 *  saturated/additive weapon VFX. */
export interface DimensionPalette {
  groundBed: number;
  gridColor1: number;
  gridColor2: number;
  boundaryRail: number;
  pitVoid: number;
  pitRustBand: number;
  pitAmberLip: number;
  spawnRingSafe: number;
  dustDrift: number;
}

export interface DimensionDef {
  id: string;
  name: string;
  tagline: string;
  /** Weighted-spawn enemy kind ids for this dimension's trash/common roster (incl. its named toughs). */
  roster: string[];
  /** The §16 boss kind id, spawned at BOSS_SPAWN_SECONDS. */
  boss: string;
  /** §17 themed environmental hazard (flavour now; hazard wiring later). */
  hazard: { name: string; description: string };
  /** §17 floor palette. */
  palette: DimensionPalette;
  /** Client asset set keys: the ground TILE texture key + the POI/decal manifest set names. */
  assets: { tile: string; poiSet: string; decalSet: string };
}

const WILD_WEST: DimensionDef = {
  id: "wild-west",
  name: "Wild West",
  tagline: "Dust, rust, and the drop.",
  roster: [
    "critter",
    "mote-swarm",
    "pricklepulp",
    "boothill",
    "ronin",
    "gatlin",
    "vault-ronin",
    "dust-ranger",
  ],
  boss: "old-rust",
  hazard: {
    name: "Pitfall mineshafts",
    description: "Collapsed shafts scar the mesa — fall in for a chip + snap-back (§17).",
  },
  palette: {
    groundBed: 0x2a2620,
    gridColor1: 0x2a2620,
    gridColor2: 0x342d22,
    boundaryRail: 0xa8482e,
    pitVoid: 0x0d0a10,
    pitRustBand: 0xa8482e,
    pitAmberLip: 0xf0a73c,
    spawnRingSafe: 0x33e6ff,
    dustDrift: 0xc49a5a,
  },
  assets: { tile: "tile-ground", poiSet: "wild-west", decalSet: "wild-west" },
};

/** All dimensions: the hand-authored Wild West (dimension 1) + the codegen'd themed dimensions (Frostfell,
 *  Verdant Ruins, Ashlands, Neon-Cyber — see dimensions.generated.ts). Wild West stays FIRST so it's the
 *  default + the back-compat fallback. */
export const DIMENSIONS: Record<string, DimensionDef> = {
  "wild-west": WILD_WEST,
  ...EXTRA_DIMENSIONS,
};

/** The dimension a run starts in (and the back-compat default). */
export const DEFAULT_DIMENSION = "wild-west";
export const DIMENSION_IDS = Object.keys(DIMENSIONS);

/** Resolve a (possibly stale/unknown) dimension id to a real `DimensionDef`, falling back to the default. */
export function getDimension(id: string | undefined): DimensionDef {
  return DIMENSIONS[id ?? ""] ?? WILD_WEST;
}
