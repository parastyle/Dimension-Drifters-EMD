# b94 — open arena

Status: **blocked on the brief's locked-lava constraint**. The ordinary arena work is implemented and
the non-lava suite is green. The global arena expansion also changes Lava Foundry because its locked
generator imports `ARENA_WIDTH` / `ARENA_HEIGHT`; keeping those files byte-identical therefore does not
keep lava behaviour unchanged.

## Delivered ordinary-arena changes

- `ARENA_WIDTH` and `ARENA_HEIGHT` are `38_400`, producing a `480 × 480` ordinary map at the unchanged
  `MAP_TILE = 80`. The distance jump remains `620 px/s × 0.6 s = 372 px`; it was not shortened, eased,
  or retuned.
- Ordinary generation now constructs continuous `TILE_GROUND`. Pit target/max/spacing, rejection
  sampling, connectivity-by-jump, repair, damage/grace/recovery, enemy floor deaths, belt holes,
  collision inset, rim/lip/debris rendering, diagnostic probes, flat-floor A/B controls, and authored
  LDtk hole fixtures are removed.
- The gameplay name is now `TILE_LAVA_GAP`. The old `TILE_PIT` spelling survives only as a legacy
  compatibility export because the explicitly locked `lava-dimension.ts` imports that exact name
  through `index-internal.ts`. No ordinary-map consumer reads it.
- `safeSpawnPos` is an identity operation on ordinary maps and retains collision-safe correction only
  for Lava Foundry. Post-boss extract/rift discs still use the full-footprint solver and now derive
  world dimensions from the supplied map.
- All five pre-lava dimensions route through the continuous generator. Their dimension copy, palettes,
  authored LDtk terrain, compiler, generated arena fixtures, server authority, client prediction, pets,
  death recap, and audio/VFX terminology were updated to remove ordinary pits.
- A source-seam test pins the live floor call site, camera clamps, prediction/server bounds, camera-
  relative spawn constants, and map-relative gate placement so a merge cannot restore the retired path.

The diff removes **605 pit-path references** by the following reproducible count: case-insensitive
occurrences on deleted, non-documentation diff lines matching `TILE_PIT`, `MAP_PIT*`,
`MAP_MAX_JUMP_TILES`, `pit(s)`, `pitFall`, `isPitAtPx`, the wash/bake names, or the flat-floor names.
Remaining non-lava search hits are inert art/audio authoring recipes, negative source-seam assertions,
and the two-line compatibility export required by the locked lava import.

## Map generation

Pit generation previously drove repeated whole-grid work. Ordinary generation now allocates the
230,400-byte ground `Uint8Array`, the 230,400-byte expanded zone `Uint8Array`, and computes macro zones
on a deterministic `240 × 240` sample grid before expanding each sample over a `2 × 2` gameplay-tile
block. Ordinary navigation validation exits through the continuous-ground proof; lava alone retains
its gap traversal audit.

`node node_modules/.pnpm/tsx@4.22.4/node_modules/tsx/dist/cli.mjs
tools/b94-open-arena-measure.mjs`, 30 seeded runs after five warmups:

| arena | median | p95 | max |
| --- | ---: | ---: | ---: |
| 4,800 × 4,800 | 0.1292 ms | 0.4795 ms | 2.6019 ms |
| 38,400 × 38,400 | 5.9302 ms | 8.7639 ms | 11.6707 ms |

The expanded generator is well below the owner's approximate 100 ms threshold.

## Floor strategy and allocation

The ordinary arena wash layer is deleted, not chunked:

- `buildMapZoneGround` and its `0.025 / 0.095 / 0.12` passes are gone.
- `bakeStaticFloorGraphics`, `STATIC_FLOOR_BAKE_SCALE`, the static render texture, terrain variants,
  and `installFlatFloorToggle` / `FLAT_FLOOR_*` are gone.
- The base floor is three display objects: themed bed rectangle, one GPU-repeated `tile-ground`
  `tileSprite`, and the boundary rail. The 38,400px display size changes geometry only; it does not
  allocate a 38,400px texture.
- The only generated ordinary-floor texture is the fixed `128 × 128` spawn patch (16,384 pixels,
  approximately 64 KiB RGBA). The shared repeated ground source is the existing `2,048 × 2,048` JPEG
  (4,194,304 GPU pixels, approximately 16 MiB RGBA), and the largest floor decal is `132 × 132`.
  No ordinary-floor texture dimension or pixel count is proportional to arena size.

Thirty mock Phaser object-factory samples measured the CPU construction seam:

| arena | draw setup median | seeded build median | base objects | build objects |
| --- | ---: | ---: | ---: | ---: |
| 4,800 × 4,800 | 0.0004 ms | 0.0173 ms | 3 | 24 |
| 38,400 × 38,400 | 0.0004 ms | 0.1739 ms | 3 | 1,126 |

The extra build objects are shared-texture decorative images distributed over the 64× area, not unique
textures. These are CPU/mock structural measurements, not a live WebGL frame-time claim. The in-app
browser connector was unavailable, so no honest GPU timing was possible.

Other unrelated fixed-size bakes remain: belt deck plating uses authored chunks no wider than 2,048px;
card/HUD/gear presentation bakes are fixed to their UI/part frames; Lava Foundry retains its existing
`128 × 128` spawn-ring canvas. None is an ordinary arena-sized allocation.

## Size-sensitive evidence

- Camera: `centerCam` clamps against `ARENA_WIDTH` / `ARENA_HEIGHT`; the literal live call sites are
  pinned by test.
- Prediction and server bounds: both clamp against the expanded constants and player radius; literal
  authority seams are pinned by test.
- Spawn/extract: ordinary spawn remains at map centre. Gate placement uses `map.cols * map.tileSize` and
  `map.rows * map.tileSize`; eight seeded edge-case pairs pass full-footprint validation.
- Minimap: there is no minimap/radar implementation in the client repository, so there was no scale
  path to update.
- Five dimensions: all five pre-lava ids generate, validate, and contain zero lava-gap tile values.
  A private 5,181/2,568 client/server stack booted cleanly from this worktree. The browser connector was
  unavailable, so I did not claim manual play verification.

## Enemy density

The measurement runs the real authoritative `GameRoom.stepSim` at 20 Hz for 60 seconds. Each paired
trial pins one living player to the map centre, uses identical deterministic RNG, preserves enemy AI,
samples a `1,280 × 720` world viewport every tick, and disables boss/shifter interference. Twenty trials
were run at each size:

| arena | mean visible enemies | trial range | max visible | mean final enemies |
| --- | ---: | ---: | ---: | ---: |
| 4,800 × 4,800 | 15.622375 | 15.440000–15.786667 | 34 | 34 |
| 38,400 × 38,400 | 15.622375 | 15.441667–15.793333 | 34 | 34 |

Measured density change is **0.000%**. Arena area does not thin the camera-relative spawn director.

## Lava lock and failing required verification

The protected files are byte-identical to `HEAD`:

- `lava-dimension.ts`: `9ee19201f0fe60612107c1ffd33fe7c32efba4cc`
- `lava-prefabs.ts`: `d226fd1637a417dca40c5446e33ad946ba7c696b`
- `collision-surfaces.json`: `d5ab315d0d9326f3e0182949d457f453b2794686`

That source equality is not behavioural equality. The locked generator imports the changed globals at
normalisation, debris placement, bounds assertions, and collision raster allocation. At 38,400 it builds
a `1,920 × 1,920` 20px collision raster (3,686,400 cells). The evidence seed took 6,539.9 ms and produced
12,305 platform cells, 3,674,095 gap cells, six rooms, and five traversal edges. Its graph/platform test
passes only with a raised command-line test timeout (9,075 ms versus Vitest's 5,000 ms default).

`node tools/b94-lava-sweep.mjs` reran the exact 2,000 seeded layout construction:

- elapsed: 55,117.989 ms
- rejected placements: 0
- touching-surface failures: 0
- unjumpable-edge failures: 0
- hero-room rate: 50.85%
- destination hero-room rate: **19.8%**, failing the existing `>= 20%` invariant

Therefore the required b90 sweep is red even though its two geometric invariants remain green. Full
`pnpm test` cannot be green twice under the current instructions: ordinary suites pass, but a single
Lava Foundry map already exceeds default test timeouts and the 2,000-seed sweep has a real invariant
failure. Increasing timeouts would hide only the runtime symptom and would not repair the rate.

The clean next decision needs owner authority because it changes a G9-locked file: either keep Lava
Foundry as its original 4,800px logical world and make all lava bounds/camera/spawn consumers map-relative,
or explicitly scale Lava Foundry to 38,400 and authorize re-deriving its construction/raster contract.
I did neither silently.

## Verification ledger

- `pnpm gen:check`: pass.
- `pnpm typecheck`: pass.
- Open-arena/map/floor/source targeted tests: 3 files, 12 tests passed.
- Full suite excluding the two lava-generating files: 248 files, 2,904 passed, 20 skipped; passed twice.
- Full `pnpm test` twice: **not achieved — locked-lava conflict above**.
- Lava evidence graph: passes with `--testTimeout 20000`; 12 unrelated lava tests skipped in that command.
- b90 2,000-seed sweep: geometric invariants pass; overall sweep fails destination hero-room rate
  (19.8% < 20%).
- Live visual/play grading: unavailable because no in-app browser was attached; private client/server
  startup passed.

verdict: BLOCKED — pit refs removed 605, arena 38,400×38,400, floor strategy one repeated 2,048² tile + fixed 128² spawn patch/no wash or arena bake, mapgen median 0.1292 ms at 4,800 vs 5.9302 ms at 38,400, spawn density 15.622375 before/15.622375 after, lava sweep 0 touching + 0 unjumpable but FAIL 19.8% destination heroes, tests non-lava 2× PASS (2,904/20 skipped each) / full 2× NOT ACHIEVED
