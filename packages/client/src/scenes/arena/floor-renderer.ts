import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  type ArenaMap,
  classifyPitRegions,
  isPitAtPx,
  MAP_SPAWN_CLEAR_TILES,
  makeRng,
  mixSeeds,
  TILE_PIT,
} from "@dd/shared";
import type Phaser from "phaser";
import { DECAL_IDS } from "../../sprites/decal-manifest.js";
import { POI_IDS } from "../../sprites/poi-manifest.js";

/**
 * §17 arena floor renderer — the "Dust & The Drop" look, extracted from ArenaScene so the scene stays a
 * thin orchestrator. Every function is a pure renderer: it takes the scene (for the GameObject factory)
 * plus the synced `ArenaMap`, and draws into the world at the established NEGATIVE depths. The scene's
 * `maybeBuildFloor` gate still owns lifecycle (regen map from seeds → build once).
 *
 * Depth stack (back→front), unchanged: bed(-20) · grid/ground(-19) · dust(-16) · litter(-15) ·
 * pits+rim(-14) · rail(-12). Entities use depth = world Y (≥ 0), so the whole floor sits behind them.
 */

/** Base ground bed + low-contrast grid (map-independent), drawn once in create(). `hasTile` is the scene's
 *  missing-texture guard so we fall back to the grid when the painted tile isn't installed. */
export function drawArena(scene: Phaser.Scene, hasTile: (key: string) => boolean): void {
  const cx = ARENA_WIDTH / 2;
  const cy = ARENA_HEIGHT / 2;
  // Base ground bed + low-contrast grid (map-independent). The §17 procedural PITS, the rim telegraph,
  // the spawn safe-ring + seeded decor are baked in `buildArenaFloor` once the server's map seeds sync.
  // The whole floor stack lives at NEGATIVE depths so it always renders behind the entities (which use
  // depth = world Y, ≥ 0). Stack, back→front: bed(-20) · grid(-19) · dust(-16) · litter(-15) · pits+rim
  // (-14, so the telegraph stays visible over litter) · rail(-12).
  scene.add.rectangle(cx, cy, ARENA_WIDTH, ARENA_HEIGHT, 0x2a2620).setDepth(-20);
  if (hasTile("tile-ground")) {
    // §17 PAINTED ground — a SEAMLESS Codex dust tile (gen-tiles.mjs), GPU-tiled across the arena PLUS a
    // wide margin so 4K/ultrawide viewports always show ground, never the void. One draw, scrolls free.
    const margin = 3200;
    const ts = scene.add
      .tileSprite(cx, cy, ARENA_WIDTH + margin * 2, ARENA_HEIGHT + margin * 2, "tile-ground")
      .setDepth(-19);
    ts.tileScaleX = 0.5;
    ts.tileScaleY = 0.5;
  } else {
    // Fallback (no tile art installed yet): the low-contrast earthy grid.
    scene.add
      .grid(cx, cy, ARENA_WIDTH, ARENA_HEIGHT, 128, 128, 0x2a2620, 1, 0x342d22, 0.5)
      .setDepth(-19);
  }
  // Arena boundary — a rusted rail (marks the playable bound; the ground extends past it on big screens).
  scene.add.rectangle(cx, cy, ARENA_WIDTH, ARENA_HEIGHT).setStrokeStyle(6, 0xa8482e).setDepth(-12);
}

/** §17 place the POI landmark sprites — base at the map position (origin bottom-centre), depth = its y so
 *  players + enemies depth-sort around them (walk BEHIND a tower's upper structure, IN FRONT of its base).
 *  Collision is server-authoritative (the static obstacle circle); this is the matching visual. */
export function buildPois(scene: Phaser.Scene, map: ArenaMap): void {
  // Map each landmark's `kind` through the BUILD-TIME manifest so the kind→sprite choice is identical
  // on every client (collision is server-authoritative; this is just the matching visual). A POI whose
  // specific texture failed to load skips its own draw rather than shifting every other POI's sprite.
  const ids: readonly string[] = POI_IDS; // widen the const tuple so the empty-pack guard is honest
  if (ids.length === 0) return;
  for (const poi of map.pois) {
    const id = ids[poi.kind % ids.length] ?? ids[0];
    if (!id || !scene.textures.exists(id)) continue;
    const sc = 0.78 + (poi.kind % 5) * 0.05; // gentle per-landmark size variety
    const img = scene.add.image(poi.x, poi.y, id).setOrigin(0.5, 1).setDepth(poi.y).setScale(sc);
    if (poi.kind % 2 === 0) img.setFlipX(true);
  }
}

/**
 * §17 "Dust & The Drop" floor bake (the panel-winning look): warm-black PIT voids, a rust band + hot
 * amber lip on every pit edge with inward CHEVRON teeth on the wide (go-around) runs and a clean solid
 * lip on the narrow (hoppable) gaps, and a cyan SPAWN safe-ring. All static geometry in ONE Graphics
 * (drawn once, scrolled by the camera for free) at a low depth under the entities.
 */
export function buildArenaFloor(scene: Phaser.Scene, map: ArenaMap): void {
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
  const g = scene.add.graphics().setDepth(-14); // pit void + rim + spawn, above the ground + the litter
  g.fillStyle(0x0d0a10, 1);
  for (let y = 0; y < map.rows; y++)
    for (let x = 0; x < map.cols; x++)
      if (map.tiles[y * map.cols + x] === TILE_PIT) g.fillRect(x * T, y * T, T, T);

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
  // Rust band (under) then hot amber lip (over) — opaque + static, so it reads as TERRAIN under the neon.
  g.lineStyle(T * 0.11, 0xa8482e, 1);
  for (const s of seg) g.lineBetween(s.x1, s.y1, s.x2, s.y2);
  g.lineStyle(T * 0.045, 0xf0a73c, 1);
  for (const s of seg) g.lineBetween(s.x1, s.y1, s.x2, s.y2);
  // Inward chevron teeth on the wide runs ("go around"); narrow gaps keep the clean lip ("hop me").
  g.fillStyle(0xf0a73c, 1);
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
  // Cyan SPAWN safe-ring (cool = safe — the opposite semaphore to the hot pit lip).
  const sr = MAP_SPAWN_CLEAR_TILES * T;
  g.fillStyle(0x33e6ff, 0.06);
  g.fillCircle(map.spawnX, map.spawnY, sr);
  g.lineStyle(3, 0x33e6ff, 0.85);
  g.strokeCircle(map.spawnX, map.spawnY, sr);

  scatterDecor(scene, map);
}

/** Seeded ground litter (dust drifts + rocks/scrub), kept OFF the pits. Seeded from the map so every
 *  client dresses the floor identically. Low depth — players + enemies render over it. */
export function scatterDecor(scene: Phaser.Scene, map: ArenaMap): void {
  const rng = makeRng(mixSeeds(map.seeds.seedDecor, 0xdec0));
  const between = (a: number, b: number): number => a + rng.next() * (b - a);
  for (let i = 0; i < 40; i++) {
    // Draw the full RNG sequence first (fixed cadence → deterministic across clients), THEN decide.
    const dx = rng.next() * ARENA_WIDTH;
    const dy = rng.next() * ARENA_HEIGHT;
    const w = between(160, 360);
    const h = between(110, 240);
    const a = between(0.03, 0.07);
    if (isPitAtPx(map, dx, dy)) continue; // keep the haze centre off the void (matches "kept OFF the pits")
    scene.add.ellipse(dx, dy, w, h, 0xc49a5a).setAlpha(a).setDepth(-16);
  }
  // §17 P4 painted Codex DECALS (rocks/scrub/bones/skull/cactus/wheel) — seeded scatter OFF the pits,
  // each with a random rotation/scale/flip so the same 9 props never read as repeated (decal
  // "tile-bombing"). Falls back to the procedural rock/scrub shapes if the pack isn't authored.
  // Determinism: branch + index off the BUILD-TIME manifest `DECAL_IDS`, never the runtime-loaded
  // set — so the RNG draw sequence is identical on every client even if one client missed a texture
  // load. A texture that failed to load just skips its own draw; positions stay in lockstep.
  if (DECAL_IDS.length > 0) {
    for (let i = 0; i < 70; i++) {
      const x = between(60, ARENA_WIDTH - 60);
      const y = between(60, ARENA_HEIGHT - 60);
      const id = DECAL_IDS[Math.floor(rng.next() * DECAL_IDS.length)] ?? DECAL_IDS[0];
      const sc = between(0.4, 0.82);
      const rot = rng.next() * Math.PI * 2;
      const flip = rng.next() < 0.5;
      if (isPitAtPx(map, x, y) || !id || !scene.textures.exists(id)) continue;
      const img = scene.add.image(x, y, id).setScale(sc).setRotation(rot).setDepth(-15);
      if (flip) img.setFlipX(true);
    }
  } else {
    for (let i = 0; i < 90; i++) {
      const x = between(60, ARENA_WIDTH - 60);
      const y = between(60, ARENA_HEIGHT - 60);
      if (isPitAtPx(map, x, y)) continue; // no litter floating in a pit
      if (rng.next() < 0.4) {
        const r = between(10, 20);
        scene.add
          .ellipse(x, y, r * 1.4, r * 2.1, 0x6e7042)
          .setStrokeStyle(3, 0x22251b)
          .setDepth(-15);
      } else {
        const r = between(12, 30);
        scene.add
          .ellipse(x, y + r * 0.4, r * 1.7, r * 0.7, 0x1f1c17)
          .setAlpha(0.5)
          .setDepth(-15);
        scene.add
          .ellipse(x, y, r * 1.5, r, rng.next() < 0.5 ? 0x3a4049 : 0x5a6472)
          .setStrokeStyle(3, 0x22252b)
          .setDepth(-15);
      }
    }
  }
}
