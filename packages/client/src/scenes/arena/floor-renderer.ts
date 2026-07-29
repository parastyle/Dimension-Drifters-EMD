import {
  type ArenaMap,
  type DimensionPalette,
  MAP_SPAWN_CLEAR_TILES,
  MAP_ZONE_COVER,
  MAP_ZONE_SCAR,
  makeRng,
  mixSeeds,
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
 * Depth stack (back→front): bed(-20) · repeating tile(-19) · spawn patch(-17.4) · flat
 * litter(-15) · spawn rail(-13.8) · boundary rail(-12) · gate ground(-10). Entities use depth = world
 * Y (≥ 0). Protected gate halo/copy uses
 * the response layer (99990), above every y-sorted world occluder and below telegraphs/HUD.
 */

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
}>;

type DimensionFloorBaseStyle = Readonly<{
  skirt: number;
}>;

type DimensionDecalAlphas = Readonly<{
  decalAlphaFlat: number;
}>;

type DimensionFloorStyle = DimensionFloorBaseStyle & DimensionDecalAlphas;

const DEFAULT_DECAL_ALPHAS = {
  decalAlphaFlat: 0.18,
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
): DecalVisualMeta => ({ id, role, projection, footprintPx, accent, usable });

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
  // Glowing cracks would imply a floor hazard that no longer exists.
  decalMeta("decal-ashlands-01", "edge", "ground", 132, true, false),
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
  },
  frostfell: {
    skirt: 0x718da6,
  },
  "verdant-ruins": {
    skirt: 0x596344,
  },
  ashlands: {
    skirt: 0x493a35,
  },
  "neon-cyber": {
    skirt: 0x35404d,
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

/** Base ground bed plus one GPU-repeated texture. Returns every created object so the scene can destroy
 * the floor on a dimension descent. No object or texture count scales with arena area. */
export function drawArena(
  scene: Phaser.Scene,
  map: ArenaMap,
  hasTile: (key: string) => boolean,
  palette: DimensionPalette,
): Phaser.GameObjects.GameObject[] {
  const out: Phaser.GameObjects.GameObject[] = [];
  const arenaWidth = map.cols * map.tileSize;
  const arenaHeight = map.rows * map.tileSize;
  const cx = arenaWidth / 2;
  const cy = arenaHeight / 2;
  // Base ground bed. The spawn safe-ring and seeded decor are added by
  // `buildArenaFloor` once the server's map seeds sync.
  // The whole floor stack lives at NEGATIVE depths so it always renders behind the entities (which use
  // depth = world Y, ≥ 0). Stack, back→front: bed(-20) · repeating tile(-19) · spawn patch
  // (-17.4) · litter(-15) · rail(-12).
  // Colours come from the active dimension palette; Wild West's remain the compatibility defaults.
  out.push(scene.add.rectangle(cx, cy, arenaWidth, arenaHeight, palette.groundBed).setDepth(-20));
  if (hasTile("tile-ground")) {
    // §17 PAINTED ground — a SEAMLESS Codex dust tile (gen-tiles.mjs), GPU-tiled across the arena PLUS a
    // wide margin so 4K/ultrawide viewports always show ground, never the void. One draw, scrolls free.
    const margin = 3200;
    const ts = scene.add
      .tileSprite(cx, cy, arenaWidth + margin * 2, arenaHeight + margin * 2, "tile-ground")
      .setDepth(-19);
    ts.tileScaleX = 0.5;
    ts.tileScaleY = 0.5;
    out.push(ts);
  } else {
    // Fallback (no tile art installed yet): the low-contrast themed grid.
    out.push(
      scene.add
        .grid(
          cx,
          cy,
          arenaWidth,
          arenaHeight,
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
  // Arena boundary — the existing themed rail remains the exact playable-bound semaphore above the shelf.
  out.push(
    scene.add
      .rectangle(cx, cy, arenaWidth, arenaHeight)
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
  return true;
}

function decalRotation(meta: DecalVisualMeta, flowAngle: number, roll: number): number {
  if (meta.projection === "ground") return roll * Math.PI * 2;
  if (meta.projection === "low") return flowAngle + (roll - 0.5) * (Math.PI / 6);
  return (roll - 0.5) * (Math.PI / 22.5);
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

export function buildArenaFloor(
  scene: Phaser.Scene,
  map: ArenaMap,
  dimensionId: string,
  palette: DimensionPalette,
): Phaser.GameObjects.GameObject[] {
  const out: Phaser.GameObjects.GameObject[] = [];
  const pack = dimensionPropPack(dimensionId);
  const floorTextureStem = `floor:${dimensionId}:${map.seeds.seedTerrain}:${map.seeds.seedHazard}:${map.seeds.seedTheme}:${map.seeds.seedDecor}`;
  const spawnRadius = MAP_SPAWN_CLEAR_TILES * map.tileSize;
  out.push(
    makeStaticSpawnPatch(
      scene,
      `${floorTextureStem}:spawn-patch`,
      map.spawnX,
      map.spawnY,
      spawnRadius * 1.04,
      pack.style.skirt,
    ),
  );
  out.push(
    scene.add
      .graphics()
      .lineStyle(3, palette.spawnRingSafe, 0.85)
      .strokeCircle(map.spawnX, map.spawnY, spawnRadius)
      .setDepth(-13.8),
  );
  out.push(...scatterDecor(scene, map, pack));
  return out;
}

export function scatterDecor(
  scene: Phaser.Scene,
  map: ArenaMap,
  pack: DimensionPropPack,
): Phaser.GameObjects.GameObject[] {
  const rng = makeRng(mixSeeds(map.seeds.seedDecor, map.seeds.seedTheme, 0xdec0));
  const out: Phaser.GameObjects.GameObject[] = [];

  // Open floor receives only non-accent flat/low marks.
  const flat = pack.decalMeta.filter((meta) => meta.usable && meta.role === "flat" && !meta.accent);
  const descriptors = new Map<
    string,
    Array<{ x: number; y: number; scale: number; rotation: number }>
  >();
  const groundWidth = map.cols * map.tileSize;
  const groundHeight = map.rows * map.tileSize;
  const areaScale = (groundWidth * groundHeight) / (2400 * 2400);
  for (let i = 0; i < Math.round(7 * areaScale); i++) {
    const x = 60 + rng.next() * (groundWidth - 120);
    const y = 60 + rng.next() * (groundHeight - 120);
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
