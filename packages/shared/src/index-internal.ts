/**
 * Cycle-safe implementation imports for optional dimension generators. Public consumers use `index.ts`;
 * this module exists so lava-dimension.ts can share existing primitives without importing that barrel.
 */
export {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  LAVA_ARENA_HEIGHT,
  LAVA_ARENA_WIDTH,
  DIST_JUMP_REACH,
  PLAYER_RADIUS,
} from "./constants.js";
export type {
  LavaRoomEdge,
  LavaRoomLayout,
  LavaRoomNode,
  PlacedLavaRoom,
  PlatformPrefab,
  PrefabPoint,
} from "./lava-prefabs.js";
export type { ArenaMap, ArenaMapSeeds } from "./mapgen.js";
export {
  generateArena,
  MAP_ZONE_COMMONS,
  MAP_ZONE_COVER,
  MAP_ZONE_SCAR,
  TILE_GROUND,
  TILE_LAVA_GAP,
  TILE_PIT,
} from "./mapgen.js";
export { makeRng, mixSeeds } from "./rng.js";
