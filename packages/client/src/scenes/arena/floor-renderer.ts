import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  type ArenaMap,
  classifyPitRegions,
  type DimensionPalette,
  isPitAtPx,
  MAP_SPAWN_CLEAR_TILES,
  makeRng,
  mixSeeds,
  poiRadius,
  poiScale,
  TILE_PIT,
} from "@dd/shared";
import type Phaser from "phaser";
import { DECAL_IDS } from "../../sprites/decal-manifest.js";
import { DECAL_IDS_ASHLANDS } from "../../sprites/decal-manifest-ashlands.js";
import { DECAL_IDS_FROSTFELL } from "../../sprites/decal-manifest-frostfell.js";
import { DECAL_IDS_NEON_CYBER } from "../../sprites/decal-manifest-neon-cyber.js";
import { DECAL_IDS_VERDANT_RUINS } from "../../sprites/decal-manifest-verdant-ruins.js";
import { POI_IDS } from "../../sprites/poi-manifest.js";
import { POI_IDS_ASHLANDS } from "../../sprites/poi-manifest-ashlands.js";
import { POI_IDS_FROSTFELL } from "../../sprites/poi-manifest-frostfell.js";
import { POI_IDS_NEON_CYBER } from "../../sprites/poi-manifest-neon-cyber.js";
import { POI_IDS_VERDANT_RUINS } from "../../sprites/poi-manifest-verdant-ruins.js";

/**
 * §17 arena floor renderer — the "Dust & The Drop" look, extracted from ArenaScene so the scene stays a
 * thin orchestrator. Every function is a pure renderer: it takes the scene (for the GameObject factory)
 * plus the synced `ArenaMap`, and draws into the world at the established NEGATIVE depths. The scene's
 * `maybeBuildFloor` gate still owns lifecycle (regen map from seeds → build once).
 *
 * Depth stack (back→front): bed(-20) · painted base(-19.5) · grid/legacy ground(-19) · dust(-16) ·
 * litter(-15) · pits+painted rim+vector accent(-14…-13.8) · rail(-12). Entities use depth = world Y
 * (≥ 0), so the whole floor sits behind them.
 */

const PAINTED_TILE_SIZE = 512;

export type DimensionPropPack = Readonly<{
  poiIds: readonly string[];
  decalIds: readonly string[];
  poiDir: string;
  decalDir: string;
}>;

/** §17 active-dimension prop registry. The original generic manifests ARE Wild West's authored pack;
 *  every generated theme keeps its manifest order as the stable local kind/index → texture convention. */
const WILD_WEST_PROP_PACK: DimensionPropPack = {
  poiIds: POI_IDS,
  decalIds: DECAL_IDS,
  poiDir: "pois",
  decalDir: "decals",
};
export const DIMENSION_PROP_PACKS: Readonly<Record<string, DimensionPropPack>> = {
  "wild-west": WILD_WEST_PROP_PACK,
  frostfell: {
    poiIds: POI_IDS_FROSTFELL,
    decalIds: DECAL_IDS_FROSTFELL,
    poiDir: "pois/frostfell",
    decalDir: "decals/frostfell",
  },
  "verdant-ruins": {
    poiIds: POI_IDS_VERDANT_RUINS,
    decalIds: DECAL_IDS_VERDANT_RUINS,
    poiDir: "pois/verdant-ruins",
    decalDir: "decals/verdant-ruins",
  },
  ashlands: {
    poiIds: POI_IDS_ASHLANDS,
    decalIds: DECAL_IDS_ASHLANDS,
    poiDir: "pois/ashlands",
    decalDir: "decals/ashlands",
  },
  "neon-cyber": {
    poiIds: POI_IDS_NEON_CYBER,
    decalIds: DECAL_IDS_NEON_CYBER,
    poiDir: "pois/neon-cyber",
    decalDir: "decals/neon-cyber",
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

/** Base ground bed + low-contrast grid. `hasTile` is the scene's missing-texture guard, so a partial or
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
  // Base ground bed + low-contrast grid (map-independent). The §17 procedural PITS, the rim telegraph,
  // the spawn safe-ring + seeded decor are baked in `buildArenaFloor` once the server's map seeds sync.
  // The whole floor stack lives at NEGATIVE depths so it always renders behind the entities (which use
  // depth = world Y, ≥ 0). Stack, back→front: bed(-20) · painted tile base(-19.5) · grid/legacy ground
  // (-19) · dust(-16) · litter(-15) · pits/rim(-14…-13.8) · rail(-12). Colours come from the active §17
  // dimension palette (a re-skin of the "Dust & The Drop" slots) — Wild West's are the defaults.
  out.push(scene.add.rectangle(cx, cy, ARENA_WIDTH, ARENA_HEIGHT, palette.groundBed).setDepth(-20));
  const paintedKeys = Array.from({ length: 4 }, (_, i) => terrainTileKey(dimensionId, i));
  if (paintedKeys.every(hasTile)) {
    // §17 DIMENSION TERRAIN: cover the synced map's ground rectangle in 512px Images. Images are the cheap
    // fit here (≈100 static objects, built once); unlike a Blitter bob they support the seeded quarter-turns.
    // The final row/column deliberately overhangs the rail, matching the legacy TileSprite's outside margin.
    const rng = makeRng(mixSeeds(map.seeds.seedTheme, map.seeds.seedDecor, 0x71e5));
    const groundW = map.cols * map.tileSize;
    const groundH = map.rows * map.tileSize;
    for (let y = 0; y < groundH; y += PAINTED_TILE_SIZE) {
      for (let x = 0; x < groundW; x += PAINTED_TILE_SIZE) {
        const key = rng.pick(paintedKeys);
        const quarterTurns = Math.floor(rng.next() * 4);
        out.push(
          scene.add
            .image(x + PAINTED_TILE_SIZE / 2, y + PAINTED_TILE_SIZE / 2, key)
            .setDisplaySize(PAINTED_TILE_SIZE, PAINTED_TILE_SIZE)
            .setRotation(quarterTurns * (Math.PI / 2))
            .setDepth(-19.5),
        );
      }
    }
    // Keep the existing 128px vector grid LINES above the painting; omit its opaque fallback cell fill so
    // the new art remains visible. Stroke colour + alpha are the same as the legacy grid path below.
    out.push(
      scene.add
        .grid(
          cx,
          cy,
          ARENA_WIDTH,
          ARENA_HEIGHT,
          128,
          128,
          undefined,
          undefined,
          palette.gridColor2,
          0.5,
        )
        .setDepth(-19),
    );
  } else if (hasTile("tile-ground")) {
    // §17 PAINTED ground — a SEAMLESS Codex dust tile (gen-tiles.mjs), GPU-tiled across the arena PLUS a
    // wide margin so 4K/ultrawide viewports always show ground, never the void. One draw, scrolls free.
    const margin = 3200;
    const ts = scene.add
      .tileSprite(cx, cy, ARENA_WIDTH + margin * 2, ARENA_HEIGHT + margin * 2, "tile-ground")
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
  // Arena boundary — a themed rail (marks the playable bound; the ground extends past it on big screens).
  out.push(
    scene.add
      .rectangle(cx, cy, ARENA_WIDTH, ARENA_HEIGHT)
      .setStrokeStyle(6, palette.boundaryRail)
      .setDepth(-12),
  );
  return out;
}

/** A placed landmark sprite + its collision radius, returned to the scene so it can run the per-frame
 *  occlusion fade (an XL is taller than the viewport — fade it when the local player walks behind it). */
export type PoiSprite = { img: Phaser.GameObjects.Image; x: number; y: number; r: number };

/** §17 place the POI landmark sprites — base at the map position (origin bottom-centre), depth = its y so
 *  players + enemies depth-sort around them (walk BEHIND a tower's upper structure, IN FRONT of its base).
 *  v0.102 WYSIWYG: each sprite's scale is derived FROM its collision radius (`poiRadius(kind)` — the same
 *  size-class function the server collides with), so the art's base width ≈ the blocker you bump into.
 *  Art is PARTITIONED by class (squat art → S accents, tall art → M/L/XL structures) so the same windmill
 *  never appears at both 0.8× and 1.9× in one arena, and a soft shadow ellipse grounds every base. */
export function buildPois(
  scene: Phaser.Scene,
  map: ArenaMap,
  dimensionId: string,
): { sprites: PoiSprite[]; objs: Phaser.GameObjects.GameObject[] } {
  // Map each landmark's `kind` through the active dimension's BUILD-TIME manifest so the choice is identical
  // on every client (collision is server-authoritative; this is just the matching visual). A POI whose
  // specific texture failed to load skips its own draw rather than shifting every other POI's sprite.
  const ids = dimensionPropPack(dimensionId).poiIds;
  const out: PoiSprite[] = [];
  const objs: Phaser.GameObjects.GameObject[] = [];
  if (ids.length === 0) return { sprites: out, objs };
  // Partition the pack by silhouette: SQUAT art (aspect < 1.4 — boulders/ruins) suits the S accents; TALL
  // art (towers/trees) suits the M/L/XL structures. Falls back to the whole pack if a bucket is empty.
  const squat: string[] = [];
  const tall: string[] = [];
  for (const id of ids) {
    if (!scene.textures.exists(id)) continue;
    const t = scene.textures.get(id).getSourceImage() as { width: number; height: number };
    (t.height / Math.max(1, t.width) < 1.4 ? squat : tall).push(id);
  }
  // Sprites are wider at the canopy/structure than at the trunk/base — size the TEXTURE width a bit past
  // the collision diameter so the standable base visually matches the circle you collide with.
  const BASE_OVERHANG = 1.3;
  for (const poi of map.pois) {
    const pool = (poiScale(poi.kind) <= 0.8 ? squat : tall).length
      ? poiScale(poi.kind) <= 0.8
        ? squat
        : tall
      : [...squat, ...tall];
    // The class lives in kind%7 (fixed per slot) — pick art from the UPPER bits so it stays varied.
    const id = pool[Math.floor(poi.kind / 7) % pool.length];
    if (!id || !scene.textures.exists(id)) continue;
    const r = poiRadius(poi.kind);
    const tex = scene.textures.get(id).getSourceImage() as { width: number; height: number };
    const sc = (r * 2 * BASE_OVERHANG) / Math.max(1, tex.width);
    // Grounding shadow — centred ON the anchor so its south rim always covers the sprite's sink-in.
    objs.push(
      scene.add.ellipse(poi.x, poi.y, r * 2.1, r * 0.9, 0x000000, 0.28).setDepth(poi.y - 1),
    );
    // Sink the base a FIXED 0.12r into the ground regardless of the art's aspect (a flat origin fraction
    // sank tall towers ~0.38r — past their own shadow). originY = 1 − sink/displayHeight.
    const displayH = tex.height * sc;
    const originY = 1 - (r * 0.12) / Math.max(1, displayH);
    const img = scene.add
      .image(poi.x, poi.y, id)
      .setOrigin(0.5, originY)
      .setDepth(poi.y)
      .setScale(sc);
    if (poi.kind % 2 === 0) img.setFlipX(true);
    objs.push(img);
    out.push({ img, x: poi.x, y: poi.y, r });
  }
  return { sprites: out, objs };
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
  const cls = classifyPitRegions(map);
  const ground = (gx: number, gy: number): boolean =>
    gx >= 0 &&
    gy >= 0 &&
    gx < map.cols &&
    gy < map.rows &&
    map.tiles[gy * map.cols + gx] !== TILE_PIT;

  // PIT FILL — the warm-black void (the §17 "absence" read). The painted GROUND tile fills the floor;
  // pits stay a clean flat void — it reads better than a busy texture, and a near-black pit tile is
  // visually indistinguishable from this anyway.
  const pitG = scene.add.graphics().setDepth(-14); // pit void, above the ground + the litter
  out.push(pitG);
  pitG.fillStyle(palette.pitVoid, 1);
  for (let y = 0; y < map.rows; y++)
    for (let x = 0; x < map.cols; x++)
      if (map.tiles[y * map.cols + x] === TILE_PIT) pitG.fillRect(x * T, y * T, T, T);

  // Pit-edge segments (a pit-cell side bordering ground) + whether the run is hoppable.
  const seg: Array<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    nx: number;
    ny: number;
    hop: boolean;
  }> = [];
  for (let y = 0; y < map.rows; y++)
    for (let x = 0; x < map.cols; x++) {
      if (map.tiles[y * map.cols + x] !== TILE_PIT) continue;
      const hop = cls.hoppable[cls.regionOf[y * map.cols + x] ?? -1] ?? false;
      const ox = x * T;
      const oy = y * T;
      if (ground(x, y - 1)) seg.push({ x1: ox, y1: oy, x2: ox + T, y2: oy, nx: 0, ny: 1, hop });
      if (ground(x, y + 1))
        seg.push({ x1: ox, y1: oy + T, x2: ox + T, y2: oy + T, nx: 0, ny: -1, hop });
      if (ground(x - 1, y)) seg.push({ x1: ox, y1: oy, x2: ox, y2: oy + T, nx: 1, ny: 0, hop });
      if (ground(x + 1, y))
        seg.push({ x1: ox + T, y1: oy, x2: ox + T, y2: oy + T, nx: -1, ny: 0, hop });
    }
  // §17 PAINTED PIT RIM: the source is a horizontally tileable top-down strip (ground on its top half,
  // drop on its bottom), so merge adjacent north-facing pit segments into runs. It sits over the flat void
  // but under the established vector rust/lip/chevrons, which remain the crisp gameplay telegraph.
  const rimKey = terrainRimKey(dimensionId);
  if (hasTile(rimKey)) {
    const topRuns: Array<{ x1: number; x2: number; y: number }> = [];
    for (const s of seg) {
      if (s.nx !== 0 || s.ny !== 1) continue;
      const prev = topRuns[topRuns.length - 1];
      if (prev && prev.y === s.y1 && prev.x2 === s.x1) prev.x2 = s.x2;
      else topRuns.push({ x1: s.x1, x2: s.x2, y: s.y1 });
    }
    const rimSource = scene.textures.get(rimKey).getSourceImage() as { height?: number };
    const rimH = rimSource.height ?? 256;
    for (const run of topRuns) {
      const rim = scene.add
        .tileSprite((run.x1 + run.x2) / 2, run.y, run.x2 - run.x1, rimH, rimKey)
        .setDepth(-13.9);
      rim.tilePositionX = run.x1; // world-anchor the repeat so separate runs do not all restart at x=0
      out.push(rim);
    }
  }
  const g = scene.add.graphics().setDepth(-13.8); // legacy vector rim + spawn, above the painted rim
  out.push(g);
  // Rust band (under) then hot amber lip (over) — opaque + static, so it reads as TERRAIN under the neon.
  g.lineStyle(T * 0.11, palette.pitRustBand, 1);
  for (const s of seg) g.lineBetween(s.x1, s.y1, s.x2, s.y2);
  g.lineStyle(T * 0.045, palette.pitAmberLip, 1);
  for (const s of seg) g.lineBetween(s.x1, s.y1, s.x2, s.y2);
  // Inward chevron teeth on the wide runs ("go around"); narrow gaps keep the clean lip ("hop me").
  g.fillStyle(palette.pitAmberLip, 1);
  for (const s of seg) {
    if (s.hop) continue;
    const mx = (s.x1 + s.x2) / 2;
    const my = (s.y1 + s.y2) / 2;
    const ex = -s.ny; // edge direction (perpendicular to the inward normal)
    const ey = s.nx;
    g.fillTriangle(
      mx + s.nx * T * 0.2,
      my + s.ny * T * 0.2,
      mx + ex * T * 0.1,
      my + ey * T * 0.1,
      mx - ex * T * 0.1,
      my - ey * T * 0.1,
    );
  }
  // Cool SPAWN safe-ring (cool = safe — the opposite semaphore to the hot pit lip).
  const sr = MAP_SPAWN_CLEAR_TILES * T;
  g.fillStyle(palette.spawnRingSafe, 0.06);
  g.fillCircle(map.spawnX, map.spawnY, sr);
  g.lineStyle(3, palette.spawnRingSafe, 0.85);
  g.strokeCircle(map.spawnX, map.spawnY, sr);

  out.push(...scatterDecor(scene, map, palette, dimensionPropPack(dimensionId).decalIds));
  return out;
}

/** Seeded ground litter (dust drifts + rocks/scrub), kept OFF the pits. Seeded from the map so every
 *  client dresses the floor identically. Low depth — players + enemies render over it. */
export function scatterDecor(
  scene: Phaser.Scene,
  map: ArenaMap,
  palette: DimensionPalette,
  decalIds: readonly string[],
): Phaser.GameObjects.GameObject[] {
  const rng = makeRng(mixSeeds(map.seeds.seedDecor, 0xdec0));
  const between = (a: number, b: number): number => a + rng.next() * (b - a);
  // Densities were authored on the original 2400² arena — scale the counts with the area so a bigger
  // arena stays as dressed (not sparser). Deterministic: AREA is a build-time constant on every client.
  const AREA = (ARENA_WIDTH * ARENA_HEIGHT) / (2400 * 2400);
  const out: Phaser.GameObjects.GameObject[] = [];
  for (let i = 0; i < Math.round(40 * AREA); i++) {
    // Draw the full RNG sequence first (fixed cadence → deterministic across clients), THEN decide.
    const dx = rng.next() * ARENA_WIDTH;
    const dy = rng.next() * ARENA_HEIGHT;
    const w = between(160, 360);
    const h = between(110, 240);
    const a = between(0.03, 0.07);
    if (isPitAtPx(map, dx, dy)) continue; // keep the haze centre off the void (matches "kept OFF the pits")
    out.push(scene.add.ellipse(dx, dy, w, h, palette.dustDrift).setAlpha(a).setDepth(-16));
  }
  // §17 P4 painted Codex DECALS (rocks/scrub/bones/skull/cactus/wheel) — seeded scatter OFF the pits,
  // each with a random rotation/scale/flip so the same 9 props never read as repeated (decal
  // "tile-bombing"). Falls back to the procedural rock/scrub shapes if the pack isn't authored.
  // Determinism: branch + index off the active dimension's BUILD-TIME manifest, never the runtime-loaded
  // set — so the RNG draw sequence is identical on every client even if one client missed a texture
  // load. A texture that failed to load just skips its own draw; positions stay in lockstep.
  if (decalIds.length > 0) {
    for (let i = 0; i < Math.round(70 * AREA); i++) {
      const x = between(60, ARENA_WIDTH - 60);
      const y = between(60, ARENA_HEIGHT - 60);
      const id = decalIds[Math.floor(rng.next() * decalIds.length)] ?? decalIds[0];
      const sc = between(0.4, 0.82);
      const rot = rng.next() * Math.PI * 2;
      const flip = rng.next() < 0.5;
      if (isPitAtPx(map, x, y) || !id || !scene.textures.exists(id)) continue;
      const img = scene.add.image(x, y, id).setScale(sc).setRotation(rot).setDepth(-15);
      if (flip) img.setFlipX(true);
      out.push(img);
    }
  } else {
    for (let i = 0; i < Math.round(90 * AREA); i++) {
      const x = between(60, ARENA_WIDTH - 60);
      const y = between(60, ARENA_HEIGHT - 60);
      if (isPitAtPx(map, x, y)) continue; // no litter floating in a pit
      if (rng.next() < 0.4) {
        const r = between(10, 20);
        out.push(
          scene.add
            .ellipse(x, y, r * 1.4, r * 2.1, 0x6e7042)
            .setStrokeStyle(3, 0x22251b)
            .setDepth(-15),
        );
      } else {
        const r = between(12, 30);
        out.push(
          scene.add
            .ellipse(x, y + r * 0.4, r * 1.7, r * 0.7, 0x1f1c17)
            .setAlpha(0.5)
            .setDepth(-15),
        );
        out.push(
          scene.add
            .ellipse(x, y, r * 1.5, r, rng.next() < 0.5 ? 0x3a4049 : 0x5a6472)
            .setStrokeStyle(3, 0x22252b)
            .setDepth(-15),
        );
      }
    }
  }
  return out;
}
