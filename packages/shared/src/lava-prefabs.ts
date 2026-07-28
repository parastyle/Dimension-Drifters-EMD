/** Native-source coordinates used by Lava Foundry collision and placement data. */
export type PrefabPoint = Readonly<{ x: number; y: number }>;

export type PrefabCollisionSurface = Readonly<{
  id: string;
  /** Clockwise outer boundary in source-PNG pixels. */
  polygon: readonly PrefabPoint[];
  /** Counter-clockwise exclusions: visible openings, never walkable floor. */
  holes: readonly (readonly PrefabPoint[])[];
}>;

export type PrefabCollision = Readonly<{
  coordinateSpace: "source-pixels";
  provenance: Readonly<{
    kind: string;
    [key: string]: string | number;
  }>;
  surfaces: readonly PrefabCollisionSurface[];
}>;

/**
 * A registered native-scale platform. `file`, dimensions, bounds, collision, tags, and rarity all come
 * from the imported package manifests plus the separately authorable collision data file.
 */
export type PlatformPrefab = Readonly<{
  id: string;
  file: string;
  width: number;
  height: number;
  visibleBounds: readonly [x: number, y: number, width: number, height: number];
  collision: PrefabCollision;
  tags: readonly string[];
  rarity: number;
  nativeScale: 1;
}>;

export type DecorativePrefab = Readonly<{
  id: string;
  file: string;
  width: number;
  height: number;
  tags: readonly string[];
  rarity: number;
  nonColliding: true;
}>;

export type LavaRoomRole = "spawn" | "route" | "branch" | "hub" | "reward" | "exit";

export type LavaRoomNode = Readonly<{
  id: string;
  role: LavaRoomRole;
}>;

export type LavaRoomEdge = Readonly<{
  from: string;
  to: string;
}>;

export type PlacedLavaRoom = Readonly<{
  /** Primary graph node; hero rooms may also host an adjacent authored role without splitting their art. */
  nodeId: string;
  graphNodeIds: readonly string[];
  role: LavaRoomRole;
  prefabId: string;
  /** PNG top-left in world pixels. */
  x: number;
  y: number;
  width: number;
  height: number;
  nativeScale: 1;
  visibleBounds: Readonly<{ x: number; y: number; width: number; height: number }>;
  collisionBounds: Readonly<{ x: number; y: number; width: number; height: number }>;
}>;

export type LavaTraversalEdge = LavaRoomEdge &
  Readonly<{
    gapPx: number;
    maxReachPx: number;
  }>;

export type PlacedLavaDebris = Readonly<{
  prefabId: string;
  x: number;
  y: number;
  scale: number;
  flipX: boolean;
  nonColliding: true;
}>;

export type LavaRoomLayout = Readonly<{
  dimensionId: "lava-foundry";
  graph: Readonly<{
    nodes: readonly LavaRoomNode[];
    edges: readonly LavaRoomEdge[];
  }>;
  rooms: readonly PlacedLavaRoom[];
  traversal: readonly LavaTraversalEdge[];
  debris: readonly PlacedLavaDebris[];
  heroRoomId?: string;
  heroRoomRole?: LavaRoomRole;
  /** Zero is the requested construction; larger values identify the deterministic fallback rung. */
  degradationStep: 0 | 1 | 2 | 3 | 4;
  /** Retained for older diagnostics. Construction never rejects a randomly guessed placement. */
  rejectedPlacements: number;
}>;
