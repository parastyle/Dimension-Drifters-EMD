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

export function corporateGridFloorFor(id: string): CorporateGridFloor | undefined {
  return FLOOR_BY_ID.get(id as CorporateGridFloorId);
}

export function corporateGridTilesetFor(id: string): CorporateGridTileset | undefined {
  return CORPORATE_GRID_MAP.tilesets.find((tileset) => tileset.id === id);
}

export { CORPORATE_GRID_MAP };
