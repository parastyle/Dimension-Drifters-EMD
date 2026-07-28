import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  type ArenaMap,
  type DimensionPalette,
  isPitAtPx,
  MAP_MAX_JUMP_TILES,
  MAP_SPAWN_CLEAR_TILES,
  MAP_ZONE_COMMONS,
  MAP_ZONE_COVER,
  MAP_ZONE_SCAR,
  makeRng,
  mixSeeds,
  TILE_PIT,
  zoneAtPx,
} from "@dd/shared";
import type Phaser from "phaser";
import { DECAL_IDS } from "../../sprites/decal-manifest.js";
import { DECAL_IDS_ASHLANDS } from "../../sprites/decal-manifest-ashlands.js";
import { DECAL_IDS_FROSTFELL } from "../../sprites/decal-manifest-frostfell.js";
import { DECAL_IDS_NEON_CYBER } from "../../sprites/decal-manifest-neon-cyber.js";
import { DECAL_IDS_VERDANT_RUINS } from "../../sprites/decal-manifest-verdant-ruins.js";

/**
 * §17 arena floor renderer — the "Dust & The Drop" look, extracted from ArenaScene so the scene stays a
 * thin orchestrator. Every function is a pure renderer: it takes the scene (for the GameObject factory)
 * plus the synced `ArenaMap`, and draws into the world at the established NEGATIVE depths. The scene's
 * `maybeBuildFloor` gate still owns lifecycle (regen map from seeds → build once).
 *
 * Depth stack (back→front): bed(-20) · painted base(-19.5) · patches(-17.4) · dust(-16) · flat
 * litter(-15) · pit/rim/accent(-14…-13.8) · rail(-12) · gate ground(-10). Entities use depth = world
 * Y (≥ 0). Protected gate halo/copy uses
 * the response layer (99990), above every y-sorted world occluder and below telegraphs/HUD.
 */

const PAINTED_TILE_SIZE = 512;

/** QOL-04 depth split: the physical disc remains ground art; only its thin response read is protected. */
export const GATE_GROUND_DEPTH = -10;
export const GATE_PROTECTED_DEPTH = 99990;
export const GATE_LOCATOR_PADDING = 40;

export type GateSafeViewport = Readonly<{
  left: number;
  top: number;
  right: number;
  bottom: number;
}>;

/** Keep an edge locator until the COMPLETE gate circle clears a padded HUD-safe viewport. A fresh-open
 * pulse intentionally overrides visibility for three seconds so an already-on-screen gate is announced. */
/**
 * DEV FLOOR A/B. The painted floor currently reads soft for three stacked reasons: a lossy `ground.jpg`
 * source, trilinear mipmaps (`mipmapFilter` in main.ts) blurring the tile as it minifies at tileScale
 * 0.5, and three low-alpha zone washes over the top. Owner wants to try the Vampire Survivors read
 * instead — an unapologetic, crisp, obviously-repeating tile. These names let the toggle reach both
 * layers without rebuilding the floor or shipping a second code path.
 */
export const FLAT_FLOOR_WASH_NAME = "dev:floor-wash";
export const FLAT_FLOOR_TILE_NAME = "dev:floor-tile";

export function gateNeedsEdgeLocator(
  open: boolean,
  x: number,
  y: number,
  radius: number,
  viewport: GateSafeViewport,
  forcePulse: boolean,
  padding = GATE_LOCATOR_PADDING,
): boolean {
  if (!open) return false;
  if (forcePulse) return true;
  return !(
    x - radius >= viewport.left + padding &&
    x + radius <= viewport.right - padding &&
    y - radius >= viewport.top + padding &&
    y + radius <= viewport.bottom - padding
  );
}

type DecalRole = "flat" | "edge" | "solid";
type DecalProjection = "ground" | "low" | "upright";

export type DecalVisualMeta = Readonly<{
  id: string;
  role: DecalRole;
  projection: DecalProjection;
  footprintPx: number;
  accent: boolean;
  usable: boolean;
  pitOnly: boolean;
}>;

type DimensionFloorBaseStyle = Readonly<{
  skirt: number;
  disturbance: number;
  shadow: number;
  tileBase: readonly number[];
  tileCluster: readonly number[];
  tileEdge: readonly number[];
}>;

type DimensionDecalAlphas = Readonly<{
  decalAlphaFlat: number;
  decalAlphaEdge: number;
  decalAlphaSolid: number;
}>;

type DimensionFloorStyle = DimensionFloorBaseStyle & DimensionDecalAlphas;

const DEFAULT_DECAL_ALPHAS = {
  decalAlphaFlat: 0.18,
  decalAlphaEdge: 0.52,
  decalAlphaSolid: 0.64,
} as const satisfies DimensionDecalAlphas;

const dimensionFloorStyle = (
  style: DimensionFloorBaseStyle,
  decalAlphas: Partial<DimensionDecalAlphas> = {},
): DimensionFloorStyle => ({
  ...style,
  ...DEFAULT_DECAL_ALPHAS,
  ...decalAlphas,
});

export type DimensionPropPack = Readonly<{
  decalIds: readonly string[];
  decalMeta: readonly DecalVisualMeta[];
  decalDir: string;
  style: DimensionFloorStyle;
}>;

const decalMeta = (
  id: string,
  role: DecalRole,
  projection: DecalProjection,
  footprintPx = 132,
  accent = false,
  usable = true,
  pitOnly = false,
): DecalVisualMeta => ({ id, role, projection, footprintPx, accent, usable, pitOnly });

const WILD_WEST_DECAL_META = [
  decalMeta("decal-00", "solid", "low"),
  decalMeta("decal-01", "edge", "upright"),
  decalMeta("decal-02", "edge", "low"),
  decalMeta("decal-03", "solid", "upright", 132, true),
  decalMeta("decal-04", "edge", "upright"),
  decalMeta("decal-05", "edge", "low", 132, true),
  decalMeta("decal-06", "solid", "upright", 132, true),
  decalMeta("decal-07", "solid", "upright", 132, true),
  decalMeta("decal-08", "flat", "ground"),
] as const;

const FROSTFELL_DECAL_META = [
  decalMeta("decal-frostfell-00", "solid", "upright", 126, true),
  decalMeta("decal-frostfell-01", "flat", "low"),
  // A harmless black-ice-looking slick would lie about the unwired dimension hazard.
  decalMeta("decal-frostfell-02", "solid", "ground", 132, false, false),
  decalMeta("decal-frostfell-03", "edge", "upright"),
  decalMeta("decal-frostfell-04", "flat", "ground"),
  decalMeta("decal-frostfell-05", "edge", "low"),
  decalMeta("decal-frostfell-06", "edge", "low", 132, true),
  decalMeta("decal-frostfell-07", "edge", "low", 132, true),
] as const;

const VERDANT_RUINS_DECAL_META = [
  decalMeta("decal-verdant-ruins-00", "solid", "low", 132, true),
  decalMeta("decal-verdant-ruins-01", "solid", "low"),
  decalMeta("decal-verdant-ruins-02", "flat", "low"),
  decalMeta("decal-verdant-ruins-03", "solid", "upright", 132, true),
  decalMeta("decal-verdant-ruins-04", "flat", "low"),
  decalMeta("decal-verdant-ruins-05", "flat", "ground"),
  decalMeta("decal-verdant-ruins-06", "edge", "low"),
  decalMeta("decal-verdant-ruins-07", "flat", "ground"),
  decalMeta("decal-verdant-ruins-08", "solid", "low", 132, true),
] as const;

const ASHLANDS_DECAL_META = [
  decalMeta("decal-ashlands-00", "solid", "low"),
  // Glowing cracks belong only to the real pit edge, never to harmless open ground.
  decalMeta("decal-ashlands-01", "edge", "ground", 132, true, true, true),
  decalMeta("decal-ashlands-02", "solid", "low"),
  decalMeta("decal-ashlands-03", "flat", "ground"),
  decalMeta("decal-ashlands-04", "flat", "ground", 132, true),
  decalMeta("decal-ashlands-05", "edge", "low"),
  decalMeta("decal-ashlands-06", "edge", "low"),
  decalMeta("decal-ashlands-07", "edge", "low"),
  decalMeta("decal-ashlands-08", "solid", "low", 132, true),
  decalMeta("decal-ashlands-09", "edge", "low", 132, true),
  decalMeta("decal-ashlands-10", "flat", "ground"),
] as const;

const NEON_CYBER_DECAL_META = [
  decalMeta("decal-neon-cyber-00", "flat", "low"),
  decalMeta("decal-neon-cyber-01", "flat", "low"),
  decalMeta("decal-neon-cyber-02", "solid", "low", 132, true),
  decalMeta("decal-neon-cyber-03", "solid", "upright", 132, true),
  decalMeta("decal-neon-cyber-04", "edge", "low"),
  decalMeta("decal-neon-cyber-05", "flat", "ground"),
  // Chroma-green source field: retain load order, quarantine every cosmetic placement channel.
  decalMeta("decal-neon-cyber-06", "solid", "upright", 121, true, false),
  decalMeta("decal-neon-cyber-07", "flat", "low"),
  decalMeta("decal-neon-cyber-08", "flat", "ground", 132, true),
  decalMeta("decal-neon-cyber-09", "solid", "upright", 132, true),
] as const;

const FLOOR_STYLES = {
  "wild-west": {
    skirt: 0x8f5a35,
    disturbance: 0xc49a66,
    shadow: 0x493326,
    tileBase: [2, 0],
    tileCluster: [1],
    tileEdge: [1, 0],
  },
  frostfell: {
    skirt: 0x718da6,
    disturbance: 0xc6dce7,
    shadow: 0x283b50,
    tileBase: [1],
    tileCluster: [3],
    tileEdge: [2],
  },
  "verdant-ruins": {
    skirt: 0x596344,
    disturbance: 0x89865e,
    shadow: 0x283126,
    tileBase: [0, 3],
    tileCluster: [2],
    tileEdge: [2],
  },
  ashlands: {
    skirt: 0x493a35,
    disturbance: 0x665148,
    shadow: 0x281e20,
    // B60: ashlands tiles are re-authored to fixed semantic roles — 0 quiet bed, 1 worn route,
    // 2 disturbed cluster, 3 pit approach. Only three roles are wired: `buildWearRoutes` and the
    // "route" material zone were removed with the POI landmarks (48f8f7f) because routes pathed
    // BETWEEN landmarks and lost their anchors. tile-1 is therefore authored but unreferenced.
    // Do NOT fold it into tileBase — its directional sweep would scatter randomly through the
    // commons and read as wallpaper. Restoring routes on non-landmark anchors is a pending call.
    tileBase: [0],
    tileCluster: [2],
    tileEdge: [3],
  },
  "neon-cyber": {
    skirt: 0x35404d,
    disturbance: 0x5d7185,
    shadow: 0x181529,
    tileBase: [0],
    tileCluster: [2],
    tileEdge: [3],
  },
} as const satisfies Readonly<Record<string, DimensionFloorBaseStyle>>;

/** §17 active-dimension decal registry. The original generic manifest is Wild West's authored pack. */
const WILD_WEST_PROP_PACK: DimensionPropPack = {
  decalIds: DECAL_IDS,
  decalMeta: WILD_WEST_DECAL_META,
  decalDir: "decals",
  style: dimensionFloorStyle(FLOOR_STYLES["wild-west"]),
};
export const DIMENSION_PROP_PACKS: Readonly<Record<string, DimensionPropPack>> = {
  "wild-west": WILD_WEST_PROP_PACK,
  frostfell: {
    decalIds: DECAL_IDS_FROSTFELL,
    decalMeta: FROSTFELL_DECAL_META,
    decalDir: "decals/frostfell",
    style: dimensionFloorStyle(FLOOR_STYLES.frostfell),
  },
  "verdant-ruins": {
    decalIds: DECAL_IDS_VERDANT_RUINS,
    decalMeta: VERDANT_RUINS_DECAL_META,
    decalDir: "decals/verdant-ruins",
    style: dimensionFloorStyle(FLOOR_STYLES["verdant-ruins"]),
  },
  ashlands: {
    decalIds: DECAL_IDS_ASHLANDS,
    decalMeta: ASHLANDS_DECAL_META,
    decalDir: "decals/ashlands",
    style: dimensionFloorStyle(FLOOR_STYLES.ashlands),
  },
  "neon-cyber": {
    decalIds: DECAL_IDS_NEON_CYBER,
    decalMeta: NEON_CYBER_DECAL_META,
    decalDir: "decals/neon-cyber",
    style: dimensionFloorStyle(FLOOR_STYLES["neon-cyber"]),
  },
};

/** Resolve stale/unknown ids exactly like shared `getDimension`: Wild West is the compatibility fallback. */
export function dimensionPropPack(dimensionId: string): DimensionPropPack {
  return DIMENSION_PROP_PACKS[dimensionId] ?? WILD_WEST_PROP_PACK;
}

/** §17 stable optional-terrain texture keys — shared with ArenaScene's active-dimension preload. */
export function terrainTileKey(dimensionId: string, variant: number): string {
  return `terrain:${dimensionId}:tile-${variant}`;
}

export function terrainRimKey(dimensionId: string): string {
  return `terrain:${dimensionId}:rim`;
}

function groundCell(map: ArenaMap, gx: number, gy: number): boolean {
  return (
    gx >= 0 &&
    gy >= 0 &&
    gx < map.cols &&
    gy < map.rows &&
    map.tiles[gy * map.cols + gx] !== TILE_PIT
  );
}

type MaterialZone = "base" | "edge";

function materialZoneAt(map: ArenaMap, x: number, y: number): MaterialZone {
  const T = map.tileSize;
  const minGX = Math.max(0, Math.floor((x - PAINTED_TILE_SIZE / 2 - T) / T));
  const maxGX = Math.min(map.cols - 1, Math.floor((x + PAINTED_TILE_SIZE / 2 + T) / T));
  const minGY = Math.max(0, Math.floor((y - PAINTED_TILE_SIZE / 2 - T) / T));
  const maxGY = Math.min(map.rows - 1, Math.floor((y + PAINTED_TILE_SIZE / 2 + T) / T));
  for (let gy = minGY; gy <= maxGY; gy++)
    for (let gx = minGX; gx <= maxGX; gx++)
      if (map.tiles[gy * map.cols + gx] === TILE_PIT) return "edge";
  return "base";
}

function zoneVariants(
  style: DimensionFloorStyle,
  material: MaterialZone,
  mapZoneId: number,
): readonly number[] {
  // Macro identity wins at long range; pit approaches still modulate the neutral Commons.
  if (mapZoneId === MAP_ZONE_SCAR) return style.tileEdge;
  if (mapZoneId === MAP_ZONE_COVER) return style.tileCluster;
  if (material === "edge") return style.tileEdge;
  return style.tileBase;
}

/** Base ground bed + material-zoned painted tiles. `hasTile` is the scene's missing-texture guard, so a partial or
 *  absent painted kit takes the EXACT legacy tile-ground path. Returns every created object so the scene
 *  can DESTROY the floor on a §6 rift descent (v0.103 — new dimension mid-run = full floor rebuild). */
export function drawArena(
  scene: Phaser.Scene,
  map: ArenaMap,
  dimensionId: string,
  hasTile: (key: string) => boolean,
  palette: DimensionPalette,
): Phaser.GameObjects.GameObject[] {
  const out: Phaser.GameObjects.GameObject[] = [];
  const cx = ARENA_WIDTH / 2;
  const cy = ARENA_HEIGHT / 2;
  // Base ground bed + material zones. The §17 procedural PITS, the rim telegraph,
  // the spawn safe-ring + seeded decor are baked in `buildArenaFloor` once the server's map seeds sync.
  // The whole floor stack lives at NEGATIVE depths so it always renders behind the entities (which use
  // depth = world Y, ≥ 0). Stack, back→front: bed(-20) · painted tile base(-19.5) · wear/patches
  // (-18.7…-17.4) · dust(-16) · litter(-15) · pits/rim(-14…-13.8) · skirts(-13.6) · rail/AO(-12…-11).
  // Colours come from the active dimension palette; Wild West's remain the compatibility defaults.
  out.push(scene.add.rectangle(cx, cy, ARENA_WIDTH, ARENA_HEIGHT, palette.groundBed).setDepth(-20));
  const paintedKeys = Array.from({ length: 4 }, (_, i) => terrainTileKey(dimensionId, i));
  if (paintedKeys.every(hasTile)) {
    // The authored variants follow macro geography and pit approaches.
    // Do not quarter-turn authored lighting/panel flow: one north-west sun is shared by every dimension.
    const rng = makeRng(mixSeeds(map.seeds.seedTheme, map.seeds.seedDecor, 0x71e5));
    const style = dimensionPropPack(dimensionId).style;
    const groundW = map.cols * map.tileSize;
    const groundH = map.rows * map.tileSize;
    for (let y = 0; y < groundH; y += PAINTED_TILE_SIZE) {
      for (let x = 0; x < groundW; x += PAINTED_TILE_SIZE) {
        const cx = x + PAINTED_TILE_SIZE / 2;
        const cy = y + PAINTED_TILE_SIZE / 2;
        const variants = zoneVariants(style, materialZoneAt(map, cx, cy), zoneAtPx(map, cx, cy));
        const variant = variants[Math.floor(rng.next() * variants.length)] ?? variants[0] ?? 0;
        const key = paintedKeys[variant] ?? paintedKeys[0] ?? terrainTileKey(dimensionId, 0);
        out.push(
          scene.add
            .image(cx, cy, key)
            .setDisplaySize(PAINTED_TILE_SIZE, PAINTED_TILE_SIZE)
            .setDepth(-19.5),
        );
      }
    }
    // The old universal 128px grid competed with the painted kits.
  } else if (hasTile("tile-ground")) {
    // §17 PAINTED ground — a SEAMLESS Codex dust tile (gen-tiles.mjs), GPU-tiled across the arena PLUS a
    // wide margin so 4K/ultrawide viewports always show ground, never the void. One draw, scrolls free.
    const margin = 3200;
    const ts = scene.add
      .tileSprite(cx, cy, ARENA_WIDTH + margin * 2, ARENA_HEIGHT + margin * 2, "tile-ground")
      .setDepth(-19);
    ts.tileScaleX = 0.5;
    ts.tileScaleY = 0.5;
    ts.setName(FLAT_FLOOR_TILE_NAME);
    out.push(ts);
  } else {
    // Fallback (no tile art installed yet): the low-contrast themed grid.
    out.push(
      scene.add
        .grid(
          cx,
          cy,
          ARENA_WIDTH,
          ARENA_HEIGHT,
          128,
          128,
          palette.gridColor1,
          1,
          palette.gridColor2,
          0.5,
        )
        .setDepth(-19),
    );
  }
  // Keep the void beyond the shelf as ONE replaceable layer: a later parallax pass can swap this object
  // without unpicking the painted shelf or the gameplay rail.
  const paintedWidth = Math.ceil((map.cols * map.tileSize) / PAINTED_TILE_SIZE) * PAINTED_TILE_SIZE;
  const paintedHeight =
    Math.ceil((map.rows * map.tileSize) / PAINTED_TILE_SIZE) * PAINTED_TILE_SIZE;
  const overhangX = Math.max(0, paintedWidth - ARENA_WIDTH);
  const overhangY = Math.max(0, paintedHeight - ARENA_HEIGHT);
  const boundaryVoid = scene.add.graphics().setName("arena-boundary-void").setDepth(-14.5);
  boundaryVoid.fillStyle(palette.pitVoid, 1);
  boundaryVoid.fillRect(-overhangX, -overhangY, ARENA_WIDTH + overhangX * 2, overhangY);
  boundaryVoid.fillRect(-overhangX, ARENA_HEIGHT, ARENA_WIDTH + overhangX * 2, overhangY);
  boundaryVoid.fillRect(-overhangX, 0, overhangX, ARENA_HEIGHT);
  boundaryVoid.fillRect(ARENA_WIDTH, 0, overhangX, ARENA_HEIGHT);
  out.push(boundaryVoid);

  // Four synthetic outward-facing runs reuse the active dimension rim: the camera-facing south edge keeps
  // the full wall, while the north/east/west edges use the derived lip.
  const boundarySegments: PitSegment[] = [
    { x1: 0, y1: 0, x2: ARENA_WIDTH, y2: 0, nx: 0, ny: -1, hop: false },
    {
      x1: 0,
      y1: ARENA_HEIGHT,
      x2: ARENA_WIDTH,
      y2: ARENA_HEIGHT,
      nx: 0,
      ny: 1,
      hop: false,
    },
    { x1: 0, y1: 0, x2: 0, y2: ARENA_HEIGHT, nx: -1, ny: 0, hop: false },
    {
      x1: ARENA_WIDTH,
      y1: 0,
      x2: ARENA_WIDTH,
      y2: ARENA_HEIGHT,
      nx: 1,
      ny: 0,
      hop: false,
    },
  ];
  const rimKey = terrainRimKey(dimensionId);
  if (hasTile(rimKey)) out.push(...buildPaintedRims(scene, dimensionId, rimKey, boundarySegments));

  // Arena boundary — the existing themed rail remains the exact playable-bound semaphore above the shelf.
  out.push(
    scene.add
      .rectangle(cx, cy, ARENA_WIDTH, ARENA_HEIGHT)
      .setStrokeStyle(6, palette.boundaryRail)
      .setDepth(-12),
  );
  return out;
}

function footprintGroundSafe(map: ArenaMap, x: number, y: number, radius: number): boolean {
  if (
    x - radius < 0 ||
    y - radius < 0 ||
    x + radius >= map.cols * map.tileSize ||
    y + radius >= map.rows * map.tileSize
  )
    return false;
  if (isPitAtPx(map, x, y)) return false;
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    if (isPitAtPx(map, x + Math.cos(angle) * radius, y + Math.sin(angle) * radius)) return false;
  }
  return true;
}

function decalRotation(meta: DecalVisualMeta, flowAngle: number, roll: number): number {
  if (meta.projection === "ground") return roll * Math.PI * 2;
  if (meta.projection === "low") return flowAngle + (roll - 0.5) * (Math.PI / 6);
  return (roll - 0.5) * (Math.PI / 22.5);
}

type PitSegment = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  nx: number;
  ny: number;
  hop: boolean;
};

const STATIC_FLOOR_BAKE_SCALE = 0.5;

/**
 * Phaser replays and re-tessellates every retained Graphics command on every WebGL frame. The exact pit
 * depth and lip layers contain thousands of static commands, so retaining them creates a permanent
 * allocation stream even though their pixels never change. Rasterize each once at half resolution (the
 * floor is deliberately low-frequency), then render one ordinary image with no frame-time path churn.
 */
function bakeStaticFloorGraphics(
  scene: Phaser.Scene,
  graphics: Phaser.GameObjects.Graphics,
  textureKey: string,
  depth: number,
): Phaser.GameObjects.Image {
  if (scene.textures.exists(textureKey)) scene.textures.remove(textureKey);
  graphics.setScale(STATIC_FLOOR_BAKE_SCALE);
  graphics.generateTexture(
    textureKey,
    Math.ceil(ARENA_WIDTH * STATIC_FLOOR_BAKE_SCALE),
    Math.ceil(ARENA_HEIGHT * STATIC_FLOOR_BAKE_SCALE),
  );
  graphics.destroy();

  const image = scene.add
    .image(ARENA_WIDTH / 2, ARENA_HEIGHT / 2, textureKey)
    .setDisplaySize(ARENA_WIDTH, ARENA_HEIGHT)
    .setDepth(depth)
    .setName(textureKey);
  image.once("destroy", () => {
    if (scene.textures.exists(textureKey)) scene.textures.remove(textureKey);
  });
  return image;
}

function makeStaticSpawnPatch(
  scene: Phaser.Scene,
  textureKey: string,
  x: number,
  y: number,
  radius: number,
  color: number,
): Phaser.GameObjects.Image {
  const textureSize = 128;
  if (scene.textures.exists(textureKey)) scene.textures.remove(textureKey);
  const texture = scene.textures.createCanvas(textureKey, textureSize, textureSize);
  if (texture) {
    const context = texture.getContext();
    context.clearRect(0, 0, textureSize, textureSize);
    context.fillStyle = `#${color.toString(16).padStart(6, "0")}`;
    context.globalAlpha = 0.045;
    context.beginPath();
    context.arc(textureSize / 2, textureSize / 2, textureSize / 2, 0, Math.PI * 2);
    context.fill();
    texture.refresh();
  }
  const image = scene.add
    .image(x, y, textureKey)
    .setDisplaySize(radius * 2, radius * 2)
    .setDepth(-17.4);
  image.once("destroy", () => {
    if (scene.textures.exists(textureKey)) scene.textures.remove(textureKey);
  });
  return image;
}

function localPitCrossingIsHoppable(map: ArenaMap, segment: Omit<PitSegment, "hop">): boolean {
  const T = map.tileSize;
  const mx = (segment.x1 + segment.x2) / 2;
  const my = (segment.y1 + segment.y2) / 2;
  for (let distance = 0; distance <= MAP_MAX_JUMP_TILES; distance++) {
    const sample = distance + 0.5;
    const gx = Math.floor((mx + segment.nx * T * sample) / T);
    const gy = Math.floor((my + segment.ny * T * sample) / T);
    if (gx < 0 || gy < 0 || gx >= map.cols || gy >= map.rows) return false;
    const pit = map.tiles[gy * map.cols + gx] === TILE_PIT;
    if (!pit) return distance > 0;
  }
  return false;
}

function mixColor(a: number, b: number, amount: number): number {
  const t = Math.max(0, Math.min(1, amount));
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;
  return (
    (Math.round(ar + (br - ar) * t) << 16) |
    (Math.round(ag + (bg - ag) * t) << 8) |
    Math.round(ab + (bb - ab) * t)
  );
}

function shadeColor(color: number, factor: number): number {
  const r = Math.max(0, Math.min(255, Math.round(((color >> 16) & 0xff) * factor)));
  const g = Math.max(0, Math.min(255, Math.round(((color >> 8) & 0xff) * factor)));
  const b = Math.max(0, Math.min(255, Math.round((color & 0xff) * factor)));
  return (r << 16) | (g << 8) | b;
}

function drawPitDepth(
  scene: Phaser.Scene,
  map: ArenaMap,
  palette: DimensionPalette,
  segments: readonly PitSegment[],
): Phaser.GameObjects.Graphics {
  const T = map.tileSize;
  const total = map.cols * map.rows;
  const distance = new Int16Array(total);
  distance.fill(-1);
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;
  for (let gy = 0; gy < map.rows; gy++)
    for (let gx = 0; gx < map.cols; gx++) {
      const index = gy * map.cols + gx;
      if (map.tiles[index] !== TILE_PIT) continue;
      if (
        groundCell(map, gx - 1, gy) ||
        groundCell(map, gx + 1, gy) ||
        groundCell(map, gx, gy - 1) ||
        groundCell(map, gx, gy + 1)
      ) {
        distance[index] = 0;
        queue[tail++] = index;
      }
    }
  const neighbours = [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
  ] as const;
  while (head < tail) {
    const current = queue[head++] ?? 0;
    const gx = current % map.cols;
    const gy = Math.floor(current / map.cols);
    for (const [dx, dy] of neighbours) {
      const nx = gx + dx;
      const ny = gy + dy;
      if (nx < 0 || ny < 0 || nx >= map.cols || ny >= map.rows) continue;
      const next = ny * map.cols + nx;
      if (map.tiles[next] !== TILE_PIT || distance[next] !== -1) continue;
      distance[next] = (distance[current] ?? 0) + 1;
      queue[tail++] = next;
    }
  }
  const g = scene.add.graphics().setDepth(-14);
  for (let gy = 0; gy < map.rows; gy++)
    for (let gx = 0; gx < map.cols; gx++) {
      const index = gy * map.cols + gx;
      if (map.tiles[index] !== TILE_PIT) continue;
      const depth = Math.max(0, distance[index] ?? 0);
      const mottleRng = makeRng(mixSeeds(map.seeds.seedDecor, gx, gy, 0xd33f));
      const mottle = (mottleRng.next() - 0.5) * 0.06;
      const tint = mixColor(palette.pitVoid, palette.groundBed, 0.015 + Math.min(5, depth) * 0.012);
      g.fillStyle(shadeColor(tint, 0.79 + Math.min(5, depth) * 0.035 + mottle), 1);
      g.fillRect(gx * T, gy * T, T, T);
    }
  // Dense contact darkness stays inside the lethal tile, while broader bands produce a readable cut.
  for (const band of [
    { offset: 0.36, width: 0.48, alpha: 0.12 },
    { offset: 0.2, width: 0.28, alpha: 0.28 },
    { offset: 0.075, width: 0.15, alpha: 0.72 },
  ]) {
    g.lineStyle(T * band.width, shadeColor(palette.pitVoid, 0.62), band.alpha);
    for (const segment of segments)
      g.lineBetween(
        segment.x1 + segment.nx * T * band.offset,
        segment.y1 + segment.ny * T * band.offset,
        segment.x2 + segment.nx * T * band.offset,
        segment.y2 + segment.ny * T * band.offset,
      );
  }
  // Only the camera-facing north wall gets a vertical falloff; side/back faces remain shallow caps.
  for (const segment of segments) {
    if (segment.nx !== 0 || segment.ny !== 1) continue;
    for (let band = 0; band < 4; band++) {
      g.fillStyle(shadeColor(palette.pitVoid, 0.58 + band * 0.08), 0.52 - band * 0.1);
      g.fillRect(segment.x1, segment.y1 + band * T * 0.14, segment.x2 - segment.x1, T * 0.16);
    }
  }
  return g;
}

type RimRun = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  nx: number;
  ny: number;
};

function mergeRimRuns(segments: readonly PitSegment[]): RimRun[] {
  const groups = new Map<string, PitSegment[]>();
  for (const segment of segments) {
    const horizontal = segment.y1 === segment.y2;
    const fixed = horizontal ? segment.y1 : segment.x1;
    const key = `${segment.nx},${segment.ny},${fixed}`;
    const group = groups.get(key);
    if (group) group.push(segment);
    else groups.set(key, [segment]);
  }
  const runs: RimRun[] = [];
  for (const group of groups.values()) {
    const first = group[0];
    if (!first) continue;
    const horizontal = first.y1 === first.y2;
    group.sort((a, b) => (horizontal ? a.x1 - b.x1 : a.y1 - b.y1));
    for (const segment of group) {
      const previous = runs[runs.length - 1];
      const contiguous =
        previous &&
        previous.nx === segment.nx &&
        previous.ny === segment.ny &&
        (horizontal
          ? previous.y1 === segment.y1 && previous.x2 === segment.x1
          : previous.x1 === segment.x1 && previous.y2 === segment.y1);
      if (contiguous) {
        previous.x2 = segment.x2;
        previous.y2 = segment.y2;
      } else {
        runs.push({ ...segment });
      }
    }
  }
  return runs;
}

function ensureRimLipTexture(
  scene: Phaser.Scene,
  dimensionId: string,
  rimKey: string,
): { key: string; height: number } | undefined {
  const key = `floor:${dimensionId}:rim-lip`;
  if (scene.textures.exists(key)) {
    const source = scene.textures.get(key).getSourceImage() as { height?: number };
    return { key, height: source.height ?? 32 };
  }
  const source = scene.textures.get(rimKey).getSourceImage() as {
    width?: number;
    height?: number;
  };
  const width = Math.max(1, source.width ?? 512);
  const sourceHeight = Math.max(1, source.height ?? 256);
  const cropHeight = Math.max(8, Math.round(sourceHeight * 0.28));
  const height = Math.max(18, Math.round(sourceHeight * 0.18));
  const canvas = scene.textures.createCanvas(key, width, height);
  if (!canvas) return undefined;
  const ctx = canvas.getContext();
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(
    source as unknown as CanvasImageSource,
    0,
    0,
    width,
    cropHeight,
    0,
    0,
    width,
    height,
  );
  canvas.refresh();
  return { key, height };
}

function buildPaintedRims(
  scene: Phaser.Scene,
  dimensionId: string,
  rimKey: string,
  segments: readonly PitSegment[],
): Phaser.GameObjects.GameObject[] {
  const out: Phaser.GameObjects.GameObject[] = [];
  const source = scene.textures.get(rimKey).getSourceImage() as { height?: number };
  const fullHeight = source.height ?? 256;
  const lip = ensureRimLipTexture(scene, dimensionId, rimKey);
  for (const run of mergeRimRuns(segments)) {
    const horizontal = run.y1 === run.y2;
    const length = horizontal ? run.x2 - run.x1 : run.y2 - run.y1;
    const cx = (run.x1 + run.x2) / 2;
    const cy = (run.y1 + run.y2) / 2;
    if (run.nx === 0 && run.ny === 1) {
      const rim = scene.add.tileSprite(cx, cy, length, fullHeight, rimKey).setDepth(-13.9);
      rim.tilePositionX = run.x1;
      out.push(rim);
      continue;
    }
    if (!lip) continue;
    const rotation = run.ny === -1 ? Math.PI : run.nx === 1 ? Math.PI / 2 : -Math.PI / 2;
    const rim = scene.add
      .tileSprite(cx, cy, length, lip.height, lip.key)
      .setRotation(rotation)
      .setDepth(-13.9);
    rim.tilePositionX = horizontal ? run.x1 : run.y1;
    out.push(rim);
  }
  return out;
}

function buildPitDebris(
  scene: Phaser.Scene,
  map: ArenaMap,
  pack: DimensionPropPack,
  segments: readonly PitSegment[],
): Phaser.GameObjects.GameObject[] {
  const common = pack.decalMeta.filter(
    (meta) =>
      meta.usable &&
      !meta.pitOnly &&
      !meta.accent &&
      (meta.projection === "low" || meta.role === "edge"),
  );
  if (common.length === 0) return [];
  const rng = makeRng(mixSeeds(map.seeds.seedDecor, map.seeds.seedTheme, 0x11fdeb12));
  const out: Phaser.GameObjects.GameObject[] = [];
  let untilNext = 1 + Math.floor(rng.next() * 3);
  for (const segment of segments) {
    const idRoll = rng.next();
    const positionRoll = rng.next();
    const scaleRoll = rng.next();
    const rotationRoll = rng.next();
    if (untilNext-- > 0) continue;
    untilNext = 1 + Math.floor(rng.next() * 3);
    const meta = common[Math.floor(idRoll * common.length)] ?? common[0];
    if (!meta) continue;
    const scale = 0.18 + scaleRoll * 0.24;
    const footprint = meta.footprintPx * scale;
    const alongX = segment.x1 + (segment.x2 - segment.x1) * (0.2 + positionRoll * 0.6);
    const alongY = segment.y1 + (segment.y2 - segment.y1) * (0.2 + positionRoll * 0.6);
    // Inward normal points into the pit, so debris centres stay on the opposite, walkable side.
    const x = alongX - segment.nx * (footprint * 0.28 + 3);
    const y = alongY - segment.ny * (footprint * 0.28 + 3);
    if (!footprintGroundSafe(map, x, y, footprint * 0.38)) continue;
    if (!scene.textures.exists(meta.id)) continue;
    const tangent = Math.atan2(segment.y2 - segment.y1, segment.x2 - segment.x1);
    out.push(
      scene.add
        .image(x, y, meta.id)
        .setScale(scale)
        .setRotation(decalRotation(meta, tangent, rotationRoll))
        .setAlpha(decalAlphaForRole(pack.style, meta.role))
        .setDepth(-13.85),
    );
  }
  return out;
}

function decalAlphaForRole(style: DimensionFloorStyle, role: DecalRole): number {
  if (role === "flat") return style.decalAlphaFlat;
  if (role === "edge") return style.decalAlphaEdge;
  return style.decalAlphaSolid;
}

type ZoneBoundarySegment = Readonly<{
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  nx: number;
  ny: number;
}>;

/** One exact, static macro-geography layer. Broad low-alpha washes establish territory at camera scale;
 * the 160px transition band and sparse flat stitches repeat the same shared cell boundary without implying
 * collision or a hot damage phase. Pit lips remain the only danger/solid truth. */
function buildMapZoneGround(
  scene: Phaser.Scene,
  map: ArenaMap,
  palette: DimensionPalette,
  style: DimensionFloorStyle,
): Phaser.GameObjects.Graphics {
  const T = map.tileSize;
  const g = scene.add.graphics().setDepth(-18.9);
  const wash = [
    { color: mixColor(palette.groundBed, palette.spawnRingSafe, 0.32), alpha: 0.025 },
    { color: mixColor(style.skirt, style.disturbance, 0.26), alpha: 0.095 },
    { color: mixColor(style.disturbance, palette.groundBed, 0.18), alpha: 0.12 },
  ] as const;
  for (let row = 0; row < map.rows; row++) {
    let runStart = 0;
    let runZone = map.zoneIds[row * map.cols] ?? MAP_ZONE_COMMONS;
    for (let col = 1; col <= map.cols; col++) {
      const nextZone = col < map.cols ? (map.zoneIds[row * map.cols + col] ?? runZone) : -1;
      if (nextZone === runZone) continue;
      const treatment = wash[runZone] ?? wash[MAP_ZONE_COMMONS];
      g.fillStyle(treatment.color, treatment.alpha);
      g.fillRect(runStart * T, row * T, (col - runStart) * T, T);
      runStart = col;
      runZone = nextZone;
    }
  }
  const boundaries: ZoneBoundarySegment[] = [];
  for (let row = 0; row < map.rows; row++)
    for (let col = 0; col < map.cols; col++) {
      const here = map.zoneIds[row * map.cols + col] ?? MAP_ZONE_COMMONS;
      if (col + 1 < map.cols && map.zoneIds[row * map.cols + col + 1] !== here) {
        const x = (col + 1) * T;
        boundaries.push({ x1: x, y1: row * T, x2: x, y2: (row + 1) * T, nx: 1, ny: 0 });
      }
      if (row + 1 < map.rows && map.zoneIds[(row + 1) * map.cols + col] !== here) {
        const y = (row + 1) * T;
        boundaries.push({ x1: col * T, y1: y, x2: (col + 1) * T, y2: y, nx: 0, ny: 1 });
      }
    }
  // Two-cell transition: a material change, never a wall/hazard rail.
  g.lineStyle(T * 2, style.shadow, 0.032);
  for (const boundary of boundaries)
    g.lineBetween(boundary.x1, boundary.y1, boundary.x2, boundary.y2);
  g.lineStyle(3, style.disturbance, 0.24);
  for (const boundary of boundaries) {
    const mx = (boundary.x1 + boundary.x2) / 2;
    const my = (boundary.y1 + boundary.y2) / 2;
    const marker = mixSeeds(map.seeds.seedTheme, Math.floor(mx / T), Math.floor(my / T), 0xb04de2);
    if (marker % 6 !== 0) continue;
    // A short flat stitch across the band. It is discontinuous by construction, never a fence.
    g.lineBetween(
      mx - boundary.nx * T * 0.2,
      my - boundary.ny * T * 0.2,
      mx + boundary.nx * T * 0.2,
      my + boundary.ny * T * 0.2,
    );
  }
  return g;
}

/**
 * §17 "Dust & The Drop" floor bake (the panel-winning look): warm-black PIT voids, a rust band + hot
 * amber lip on every pit edge with inward CHEVRON teeth on the wide (go-around) runs and a clean solid
 * lip on the narrow (hoppable) gaps, and a cyan SPAWN safe-ring. All static geometry in ONE Graphics
 * (drawn once, scrolled by the camera for free) at a low depth under the entities.
 */
export function buildArenaFloor(
  scene: Phaser.Scene,
  map: ArenaMap,
  dimensionId: string,
  hasTile: (key: string) => boolean,
  palette: DimensionPalette,
): Phaser.GameObjects.GameObject[] {
  const out: Phaser.GameObjects.GameObject[] = [];
  const T = map.tileSize;
  const pack = dimensionPropPack(dimensionId);
  const floorTextureStem = `floor:${dimensionId}:${map.seeds.seedTerrain}:${map.seeds.seedHazard}:${map.seeds.seedTheme}:${map.seeds.seedDecor}`;
  // DEV A/B (`FLAT_FLOOR_WASH_NAME`): the three low-alpha zone washes are most of what mutes the tile
  // read. Named so the flat-floor toggle can hide them without rebuilding the floor.
  out.push(
    bakeStaticFloorGraphics(
      scene,
      buildMapZoneGround(scene, map, palette, pack.style),
      `${floorTextureStem}:map-zones`,
      -18.9,
    ).setName(FLAT_FLOOR_WASH_NAME),
  );
  // A quiet material clearing sits below the exact cool safety rail; dense dressing rejects this radius.
  const sr = MAP_SPAWN_CLEAR_TILES * T;
  out.push(
    makeStaticSpawnPatch(
      scene,
      `${floorTextureStem}:spawn-patch`,
      map.spawnX,
      map.spawnY,
      sr * 1.04,
      pack.style.skirt,
    ),
  );

  // Pit-edge segments are exact authoritative tile boundaries. Hop vocabulary is checked along each local
  // normal, not inherited from a connected region's bounding box.
  const seg: PitSegment[] = [];
  const addSegment = (segment: Omit<PitSegment, "hop">): void => {
    seg.push({ ...segment, hop: localPitCrossingIsHoppable(map, segment) });
  };
  for (let y = 0; y < map.rows; y++)
    for (let x = 0; x < map.cols; x++) {
      if (map.tiles[y * map.cols + x] !== TILE_PIT) continue;
      const ox = x * T;
      const oy = y * T;
      if (groundCell(map, x, y - 1))
        addSegment({ x1: ox, y1: oy, x2: ox + T, y2: oy, nx: 0, ny: 1 });
      if (groundCell(map, x, y + 1))
        addSegment({ x1: ox, y1: oy + T, x2: ox + T, y2: oy + T, nx: 0, ny: -1 });
      if (groundCell(map, x - 1, y))
        addSegment({ x1: ox, y1: oy, x2: ox, y2: oy + T, nx: 1, ny: 0 });
      if (groundCell(map, x + 1, y))
        addSegment({ x1: ox + T, y1: oy, x2: ox + T, y2: oy + T, nx: -1, ny: 0 });
    }

  out.push(
    bakeStaticFloorGraphics(
      scene,
      drawPitDepth(scene, map, palette, seg),
      `${floorTextureStem}:pit-depth`,
      -14,
    ),
  );
  const rimKey = terrainRimKey(dimensionId);
  if (hasTile(rimKey)) out.push(...buildPaintedRims(scene, dimensionId, rimKey, seg));
  out.push(...buildPitDebris(scene, map, pack, seg));
  const g = scene.add.graphics().setDepth(-13.8); // exact gameplay lip + spawn, above all painted material
  // Rust support band (under) then uninterrupted hot/cool exact rail (over).
  g.lineStyle(T * 0.11, palette.pitRustBand, 1);
  for (const s of seg) g.lineBetween(s.x1, s.y1, s.x2, s.y2);
  g.lineStyle(T * 0.045, palette.pitAmberLip, 1);
  for (const s of seg) g.lineBetween(s.x1, s.y1, s.x2, s.y2);
  // Inward chevrons mean go around. Locally hoppable spans receive two restrained inward notches.
  g.fillStyle(palette.pitAmberLip, 1);
  for (const s of seg) {
    const mx = (s.x1 + s.x2) / 2;
    const my = (s.y1 + s.y2) / 2;
    const ex = -s.ny; // edge direction (perpendicular to the inward normal)
    const ey = s.nx;
    if (s.hop) {
      g.lineStyle(T * 0.025, palette.pitAmberLip, 1);
      for (const offset of [-0.18, 0.18])
        g.lineBetween(
          mx + ex * T * offset,
          my + ey * T * offset,
          mx + ex * T * offset + s.nx * T * 0.13,
          my + ey * T * offset + s.ny * T * 0.13,
        );
    } else {
      g.fillTriangle(
        mx + s.nx * T * 0.2,
        my + s.ny * T * 0.2,
        mx + ex * T * 0.1,
        my + ey * T * 0.1,
        mx - ex * T * 0.1,
        my - ey * T * 0.1,
      );
    }
  }
  // Cool SPAWN safe-ring (cool = safe — the opposite semaphore to the hot pit lip).
  g.lineStyle(3, palette.spawnRingSafe, 0.85);
  g.strokeCircle(map.spawnX, map.spawnY, sr);
  out.push(bakeStaticFloorGraphics(scene, g, `${floorTextureStem}:pit-lip`, -13.8));

  out.push(...scatterDecor(scene, map, palette, pack, seg));
  return out;
}

function ellipseGroundSafe(
  map: ArenaMap,
  x: number,
  y: number,
  rx: number,
  ry: number,
  rotation: number,
): boolean {
  if (isPitAtPx(map, x, y)) return false;
  for (let i = 0; i < 16; i++) {
    const angle = (i / 16) * Math.PI * 2;
    const lx = Math.cos(angle) * rx;
    const ly = Math.sin(angle) * ry;
    const px = x + lx * Math.cos(rotation) - ly * Math.sin(rotation);
    const py = y + lx * Math.sin(rotation) + ly * Math.cos(rotation);
    if (
      px < 0 ||
      py < 0 ||
      px >= map.cols * map.tileSize ||
      py >= map.rows * map.tileSize ||
      isPitAtPx(map, px, py)
    )
      return false;
  }
  return true;
}

function fillRotatedEllipse(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  rx: number,
  ry: number,
  rotation: number,
): void {
  g.beginPath();
  for (let i = 0; i < 18; i++) {
    const angle = (i / 18) * Math.PI * 2;
    const lx = Math.cos(angle) * rx;
    const ly = Math.sin(angle) * ry;
    const px = x + lx * Math.cos(rotation) - ly * Math.sin(rotation);
    const py = y + lx * Math.sin(rotation) + ly * Math.cos(rotation);
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.closePath();
  g.fillPath();
}

/** Deterministic composition cleanup: a single drift batch plus sparse, flat-only wilderness marks. */
export function scatterDecor(
  scene: Phaser.Scene,
  map: ArenaMap,
  palette: DimensionPalette,
  pack: DimensionPropPack,
  pitSegments: readonly PitSegment[],
): Phaser.GameObjects.GameObject[] {
  const rng = makeRng(mixSeeds(map.seeds.seedDecor, map.seeds.seedTheme, 0xdec0));
  const out: Phaser.GameObjects.GameObject[] = [];
  const dust = scene.add.graphics().setDepth(-16);
  out.push(dust);
  let drifts = 0;
  // More candidates than the 8–12 budget are described, because full-footprint pit rejection may cull them.
  for (let i = 0; i < 24 && drifts < 10; i++) {
    const sourceRoll = rng.next();
    const indexRoll = rng.next();
    const positionRoll = rng.next();
    const jitterRoll = rng.next();
    const widthRoll = rng.next();
    const heightRoll = rng.next();
    const alphaRoll = rng.next();
    // Retain only the pre-existing pit-edge dust branch.
    if (sourceRoll < 0.86 || pitSegments.length === 0) continue;
    const segment = pitSegments[Math.floor(indexRoll * pitSegments.length)] ?? pitSegments[0];
    if (!segment) continue;
    const x =
      segment.x1 + (segment.x2 - segment.x1) * positionRoll - segment.nx * map.tileSize * 0.55;
    const y =
      segment.y1 + (segment.y2 - segment.y1) * positionRoll - segment.ny * map.tileSize * 0.55;
    const angle = Math.atan2(segment.y2 - segment.y1, segment.x2 - segment.x1);
    void jitterRoll;
    const width = 120 + widthRoll * 150;
    const height = 32 + heightRoll * 54;
    if (!ellipseGroundSafe(map, x, y, width / 2, height / 2, angle)) continue;
    dust.fillStyle(palette.dustDrift, 0.03 + alphaRoll * 0.025);
    fillRotatedEllipse(dust, x, y, width / 2, height / 2, angle);
    drifts++;
  }

  // Open floor receives only non-accent flat/low marks.
  const flat = pack.decalMeta.filter(
    (meta) => meta.usable && !meta.pitOnly && meta.role === "flat" && !meta.accent,
  );
  const descriptors = new Map<
    string,
    Array<{ x: number; y: number; scale: number; rotation: number }>
  >();
  const AREA = (ARENA_WIDTH * ARENA_HEIGHT) / (2400 * 2400);
  for (let i = 0; i < Math.round(7 * AREA); i++) {
    const x = 60 + rng.next() * (ARENA_WIDTH - 120);
    const y = 60 + rng.next() * (ARENA_HEIGHT - 120);
    const idRoll = rng.next();
    const scaleRoll = rng.next();
    const rotationRoll = rng.next();
    const flipRoll = rng.next();
    const acceptanceRoll = rng.next();
    const meta = flat[Math.floor(idRoll * flat.length)] ?? flat[0];
    if (!meta) continue;
    const zoneId = zoneAtPx(map, x, y);
    const density = zoneId === MAP_ZONE_COVER ? 1 : zoneId === MAP_ZONE_SCAR ? 0.32 : 0.55;
    if (acceptanceRoll >= density) continue;
    const scale = 0.24 + scaleRoll * 0.22;
    const footprint = meta.footprintPx * scale;
    if (!footprintGroundSafe(map, x, y, footprint / 2)) continue;
    const spawnClear = MAP_SPAWN_CLEAR_TILES * map.tileSize + footprint / 2 + map.tileSize * 0.35;
    if ((x - map.spawnX) ** 2 + (y - map.spawnY) ** 2 < spawnClear * spawnClear) continue;
    // Missing art skips only this draw; it never changes descriptors or RNG cadence.
    if (!scene.textures.exists(meta.id)) continue;
    const descriptor = {
      x,
      y,
      scale,
      rotation: decalRotation(meta, 0, rotationRoll),
    };
    const list = descriptors.get(meta.id);
    if (list) list.push(descriptor);
    else descriptors.set(meta.id, [descriptor]);
    void flipRoll;
  }
  for (const [id, items] of descriptors)
    for (const descriptor of items)
      out.push(
        scene.add
          .image(descriptor.x, descriptor.y, id)
          .setScale(descriptor.scale)
          .setRotation(descriptor.rotation)
          .setAlpha(pack.style.decalAlphaFlat)
          .setDepth(-15),
      );
  return out;
}
