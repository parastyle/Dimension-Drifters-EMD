import { CORPORATE_GRID_MAP } from "./corporate-grid-map.generated.js";

export type CorporateGridEntityType =
  | "PlayerSpawn"
  | "EnemySpawn"
  | "CameraBounds"
  | "EndWall"
  | "ElevatorMarker"
  | "CombatLane";

export interface CorporateGridBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface CorporateGridLaneBounds {
  minY: number;
  maxY: number;
}

export interface CorporateGridEntity {
  type: CorporateGridEntityType;
  iid: string;
  x: number;
  y: number;
  width: number;
  height: number;
  pivotX: number;
  pivotY: number;
  bounds: CorporateGridBounds;
}

export interface CorporateGridWaveAnchor {
  id: string;
  x: number;
  y: number;
  source: "authored" | "synthetic";
}

export interface CorporateGridTileset {
  id: string;
  sourcePath: string;
  publicPath: string;
  width: number;
  height: number;
  gridSize: number;
  cols: number;
  rows: number;
}

export interface CorporateGridTileLayer {
  id: "parallax-city-backdrop" | "office-material-tiles";
  tilesetId: string;
  indices: readonly number[];
  flips: readonly number[];
}

export interface CorporateGridFloor {
  id: "office-red-carpet-gallery" | "office-random-dude-portrait-hall" | "office-marble-gallery";
  sourceIdentifier: string;
  floorIndex: number;
  iid: string;
  width: number;
  height: number;
  gridSize: number;
  cols: number;
  rows: number;
  renderLayers: readonly CorporateGridTileLayer[];
  collisionGrid: readonly number[];
  laneGrid: readonly number[];
  laneBounds: CorporateGridLaneBounds;
  playableBounds: Pick<CorporateGridBounds, "minX" | "maxX">;
  cameraBounds: CorporateGridBounds;
  playerSpawns: readonly CorporateGridEntity[];
  authoredEnemySpawns: readonly CorporateGridEntity[];
  waveAnchors: readonly CorporateGridWaveAnchor[];
  endWalls: readonly CorporateGridEntity[];
  elevatorMarkers: readonly CorporateGridEntity[];
  combatLanes: readonly CorporateGridEntity[];
}

export interface CorporateGridMapCatalog {
  modelVersion: number;
  tilesets: readonly CorporateGridTileset[];
  floors: readonly CorporateGridFloor[];
  revision: string;
}

export type CorporateGridFloorId = CorporateGridFloor["id"];

const FLOOR_BY_ID = new Map(CORPORATE_GRID_MAP.floors.map((floor) => [floor.id, floor] as const));
const FLOOR_INSTANCE_CACHE = new Map<string, CorporateGridFloor>();

/** Owner-locked endless-tower material order. Depth is one-based everywhere the player sees it. */
export const CORPORATE_GRID_FLOOR_LOOP = [
  "office-red-carpet-gallery",
  "office-random-dude-portrait-hall",
  "office-marble-gallery",
] as const satisfies readonly CorporateGridFloorId[];

export const CORPORATE_GRID_VARIANTS = ["short", "standard", "long"] as const;
export type CorporateGridVariant = (typeof CORPORATE_GRID_VARIANTS)[number];

export const CORPORATE_ELEVATOR_PHASE = Object.freeze({
  sealed: 0,
  ready: 1,
  countdown: 2,
  departing: 3,
  arriving: 4,
} as const);
export type CorporateElevatorPhase =
  (typeof CORPORATE_ELEVATOR_PHASE)[keyof typeof CORPORATE_ELEVATOR_PHASE];
export const CORPORATE_ELEVATOR_COUNTDOWN_TICKS = 60;
export const CORPORATE_ELEVATOR_DEPART_TICKS = 12;
export const CORPORATE_ELEVATOR_ARRIVAL_TICKS = 100;
export const CORPORATE_ELEVATOR_INTERACT_X = 240;

/** Module-aligned playable spans measured from the authored x=120 left blocker. */
export const CORPORATE_GRID_VARIANT_SPANS: Readonly<Record<CorporateGridVariant, number>> =
  Object.freeze({
    short: 3_000,
    standard: 3_960,
    long: 4_920,
  });

/** Stable project seed. It intentionally maps F1/F2/F3 to standard/short/long for gate coverage. */
export const CORPORATE_GRID_VARIANT_SEED = 53;

function mixVariantSeed(value: number): number {
  let x = value >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
  return (x ^ (x >>> 16)) >>> 0;
}

export function corporateGridFloorIdForDepth(depth: number): CorporateGridFloorId {
  const normalized = Math.max(1, Math.floor(Number.isFinite(depth) ? depth : 1));
  const floorId = CORPORATE_GRID_FLOOR_LOOP[(normalized - 1) % CORPORATE_GRID_FLOOR_LOOP.length];
  if (!floorId) throw new Error("corporate-grid floor loop is empty");
  return floorId;
}

export function corporateGridVariantForDepth(
  depth: number,
  seed = CORPORATE_GRID_VARIANT_SEED,
): CorporateGridVariant {
  const normalized = Math.max(1, Math.floor(Number.isFinite(depth) ? depth : 1));
  const variant = CORPORATE_GRID_VARIANTS[mixVariantSeed((seed >>> 0) ^ normalized) % 3];
  if (!variant) throw new Error("corporate-grid variant table is empty");
  return variant;
}

export function corporateGridVariantCode(variant: CorporateGridVariant): number {
  return CORPORATE_GRID_VARIANTS.indexOf(variant);
}

export function corporateGridVariantFromCode(code: number): CorporateGridVariant {
  return CORPORATE_GRID_VARIANTS[Math.max(0, Math.min(2, Math.floor(code)))] ?? "standard";
}

function shiftedEntity(entity: CorporateGridEntity, x: number): CorporateGridEntity {
  const dx = x - entity.x;
  return {
    ...entity,
    x,
    bounds: {
      ...entity.bounds,
      minX: entity.bounds.minX + dx,
      maxX: entity.bounds.maxX + dx,
    },
  };
}

function cropGridColumns(
  source: readonly number[],
  sourceCols: number,
  rows: number,
  targetCols: number,
): number[] {
  const output = new Array<number>(targetCols * rows);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < targetCols; col++) {
      // The final two 60 px modules are the authored right EndWall. Copying them to the cropped edge
      // makes the rendered wall, collision blocker, and camera stop agree at every length.
      const sourceCol = col >= targetCols - 2 ? sourceCols - (targetCols - col) : col;
      output[row * targetCols + col] = source[row * sourceCols + sourceCol] ?? 0;
    }
  }
  return output;
}

/**
 * Produce one runtime floor instance. All geometry is transformed together so neither authority nor
 * prediction can observe the discarded tail. The authored source model remains immutable.
 */
export function cropCorporateGridFloor(
  source: CorporateGridFloor,
  variant: CorporateGridVariant,
): CorporateGridFloor {
  const minX = source.playableBounds.minX;
  const maxX = minX + CORPORATE_GRID_VARIANT_SPANS[variant];
  const width = maxX + source.gridSize * 2;
  const cols = width / source.gridSize;
  if (!Number.isInteger(cols))
    throw new Error(`corporate-grid ${variant} width ${width} is not module-aligned`);

  const rightWall = source.endWalls[source.endWalls.length - 1];
  const leftWall = source.endWalls[0];
  const rightDoor = source.elevatorMarkers[source.elevatorMarkers.length - 1];
  const leftDoor = source.elevatorMarkers[0];
  const middleDoor = source.elevatorMarkers[1];
  if (!leftWall || !rightWall || !leftDoor || !middleDoor || !rightDoor)
    throw new Error(
      `corporate-grid floor ${source.id} is missing its three-door/end-wall contract`,
    );

  const safeMax = maxX - source.gridSize * 2;
  const waveAnchors = source.waveAnchors.filter(
    (anchor) => anchor.x >= minX + source.gridSize && anchor.x <= safeMax,
  );
  if (waveAnchors.length === 0)
    throw new Error(`corporate-grid ${source.id}/${variant} crop removed every wave anchor`);

  const middleX =
    middleDoor.bounds.maxX <= maxX
      ? middleDoor.x
      : minX +
        Math.round((CORPORATE_GRID_VARIANT_SPANS[variant] * 0.65) / source.gridSize) *
          source.gridSize;
  const rightWallX = rightWall.x + (maxX - source.playableBounds.maxX);
  const rightDoorX = rightDoor.x + (maxX - source.playableBounds.maxX);

  const renderLayers = source.renderLayers.map((layer) => ({
    ...layer,
    indices: cropGridColumns(layer.indices, source.cols, source.rows, cols),
    flips: cropGridColumns(layer.flips, source.cols, source.rows, cols),
  }));
  const playerSpawns = source.playerSpawns.map((spawn) =>
    shiftedEntity(spawn, Math.max(minX + source.gridSize * 2, Math.min(safeMax, spawn.x))),
  );
  const authoredEnemySpawns = source.authoredEnemySpawns.filter(
    (spawn) => spawn.bounds.minX >= minX && spawn.bounds.maxX <= maxX,
  );
  const combatLanes = source.combatLanes.map((lane) => ({
    ...lane,
    x: minX + CORPORATE_GRID_VARIANT_SPANS[variant] / 2,
    width: CORPORATE_GRID_VARIANT_SPANS[variant],
    bounds: { ...lane.bounds, minX, maxX },
  }));

  return {
    ...source,
    width,
    cols,
    renderLayers,
    collisionGrid: cropGridColumns(source.collisionGrid, source.cols, source.rows, cols),
    laneGrid: cropGridColumns(source.laneGrid, source.cols, source.rows, cols),
    playableBounds: { minX, maxX },
    // Camera content includes both 120 px end-wall modules so the wall-set arrival/exit doors remain
    // fully readable while player navigation stays clamped to the inner playable band.
    cameraBounds: { ...source.cameraBounds, minX: 0, maxX: width },
    playerSpawns,
    authoredEnemySpawns,
    waveAnchors,
    endWalls: [leftWall, shiftedEntity(rightWall, rightWallX)],
    elevatorMarkers: [
      leftDoor,
      shiftedEntity(middleDoor, middleX),
      shiftedEntity(rightDoor, rightDoorX),
    ],
    combatLanes,
  };
}

export function corporateGridFloorInstanceForDepth(
  depth: number,
  variant = corporateGridVariantForDepth(depth),
): CorporateGridFloor {
  const id = corporateGridFloorIdForDepth(depth);
  const cacheKey = `${id}:${variant}`;
  const cached = FLOOR_INSTANCE_CACHE.get(cacheKey);
  if (cached) return cached;
  const source = corporateGridFloorFor(id);
  if (!source) throw new Error(`generated corporate-grid floor is missing: ${id}`);
  const instance = cropCorporateGridFloor(source, variant);
  FLOOR_INSTANCE_CACHE.set(cacheKey, instance);
  return instance;
}

export function corporateGridFloorFor(id: string): CorporateGridFloor | undefined {
  return FLOOR_BY_ID.get(id as CorporateGridFloorId);
}

export function corporateGridTilesetFor(id: string): CorporateGridTileset | undefined {
  return CORPORATE_GRID_MAP.tilesets.find((tileset) => tileset.id === id);
}

export { CORPORATE_GRID_MAP };
