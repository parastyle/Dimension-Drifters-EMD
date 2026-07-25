# B60 dimension POI deletion

## Scope and result

Implemented the binding R7 deletion ruling from `spec-dimension-art-direction.md`: dimensions no
longer generate, serialize, preload, render, collide with, navigate around, or author POI landmarks.
Decals, tiles, rims, terrain-value work, tunnels, and the corporate LDtk map were not changed.

The wire shape changed because `ArenaMap`/authored-arena POI data and Vastaghar's POI mutation fields
were removed. `SCHEMA_VERSION` is therefore 47, and every exact schema pin was updated.

## Runtime and dead-code cleanup

- Removed `poiIds`/`poiDir`, all five POI pack entries, POI preload/build/scatter, and POI occlusion
  from the floor renderer. Decals and pit dust remain.
- Removed the scene POI preload loop, synced-dimension lazy-load gate, sprite collection, and
  occlusion updates.
- Removed POI placement, instances, collision circles, spatial indexing, point/ray queries, body
  projection, and the three spawn/navigation/collision call paths from map generation and runtime
  simulation. Spawn validity and navigation now evaluate terrain/pits only.
- Removed renderer route/wear drawing that existed only to connect or surround POI clusters.
- Removed POI-aware projectile, beam, enemy, chest, progression, and prediction branches in both
  the monolithic and split room implementations.
- Removed the LDtk `Landmark`/`PoiCluster` entities, cluster enum/references, compiler checks,
  generated fields, and authoring documentation. `PlayerSpawn` is the only gameplay entity in the
  dimension project.
- Removed all POI manifest/generation/QA/remediation inputs and all 31 landmark PNGs.
- Removed Vastaghar's `LandmarkBreak` action, destroyed-POI mask/index, and landmark-target
  bookkeeping because that target class no longer exists. This is the only gameplay change beyond
  the general removal of landmarks: the phase-two action deck now contains `ThreefoldMarch` and
  `ShedMountain` only. Existing `StuckStep` and `WorldTurn` phase-transition paint cues remain.

## Tests deleted versus fixed

No test source file was deleted.

Deleted POI-subject test cases:

- 13 mapgen cases covering POI gap/clearance, scale classes, placement, single/multi-body
  collision, projectile blocking, lookup, spawn push-out, cluster budget, compound cover, and
  spatial-index parity/storage.
- 2 data-consistency cases enforcing POI geometry against the largest colliding body.
- 1 Vastaghar case enforcing two authored POI destructions.
- 3 LDtk fixture cases: dangling landmark references, wrong cluster counts, and the
  overlapping/unsafe-POI handoff.

Fixed remaining tests without weakening their surviving subject:

- Five mapgen cases now pin pit-only spawn validity, terrain/zone determinism, Scar-versus-Cover pit
  risk, zone navigation, and zone golden hashes.
- The chest placement case still proves repeatability, disc safety, solid ground, and a valid zone;
  only the removed POI condition was deleted.
- Authored-arena tests still cover deterministic compilation, canonical generated output,
  authoritative spawn/zone validation, hostile fixtures, and multi-level IID independence; only POI
  fields/mutations and the three obsolete fixtures were removed.
- Server room tests had incidental `map.pois` clearing/index setup removed, pit-only safe-spawn
  signatures fixed, POI-specific comments corrected, and schema pins advanced to 47. Their combat,
  movement, economy, enemy, progression, and boss assertions remain.
- The replicated-module purity description now refers to movement stepping without the deleted POI
  push-out.

In total, 39 test files were updated. The full suite passed with 220 test files: 2,764 passed and 20
skipped (2,784 total).

## Verification

- `pnpm gen`: PASS
- `pnpm gen:check`: PASS
- `pnpm typecheck`: PASS
- `pnpm assets:check`: PASS
- `pnpm test`: PASS — 220 files passed; 2,764 tests passed, 20 skipped
- `git diff --check`: PASS
- Live check: PASS in **Wild West** through the real Vite client and Colyseus server. The rendered
  arena was visually inspected with open terrain/pits and no landmark art. No POI textures or POI
  scene member were present, the browser emitted no errors, and real WASD movement advanced
  163.5–195.5 px in all four directions with no invisible obstruction.

## Files changed

Authoring and documentation:

- `data/arenas/dimension-drifters.ldtk`
- `docs/level-authoring/ldtk.md`
- `docs/sol-reports/b60-poi-delete.md`

Deleted POI assets:

- `packages/client/public/pois/poi-00.png`
- `packages/client/public/pois/poi-01.png`
- `packages/client/public/pois/poi-02.png`
- `packages/client/public/pois/poi-03.png`
- `packages/client/public/pois/poi-04.png`
- `packages/client/public/pois/poi-05.png`
- `packages/client/public/pois/ashlands/poi-ashlands-00.png`
- `packages/client/public/pois/ashlands/poi-ashlands-01.png`
- `packages/client/public/pois/ashlands/poi-ashlands-02.png`
- `packages/client/public/pois/ashlands/poi-ashlands-03.png`
- `packages/client/public/pois/ashlands/poi-ashlands-04.png`
- `packages/client/public/pois/ashlands/poi-ashlands-05.png`
- `packages/client/public/pois/frostfell/poi-frostfell-00.png`
- `packages/client/public/pois/frostfell/poi-frostfell-01.png`
- `packages/client/public/pois/frostfell/poi-frostfell-02.png`
- `packages/client/public/pois/frostfell/poi-frostfell-03.png`
- `packages/client/public/pois/frostfell/poi-frostfell-04.png`
- `packages/client/public/pois/frostfell/poi-frostfell-05.png`
- `packages/client/public/pois/neon-cyber/poi-neon-cyber-00.png`
- `packages/client/public/pois/neon-cyber/poi-neon-cyber-01.png`
- `packages/client/public/pois/neon-cyber/poi-neon-cyber-02.png`
- `packages/client/public/pois/neon-cyber/poi-neon-cyber-03.png`
- `packages/client/public/pois/neon-cyber/poi-neon-cyber-04.png`
- `packages/client/public/pois/neon-cyber/poi-neon-cyber-05.png`
- `packages/client/public/pois/neon-cyber/poi-neon-cyber-06.png`
- `packages/client/public/pois/verdant-ruins/poi-verdant-ruins-00.png`
- `packages/client/public/pois/verdant-ruins/poi-verdant-ruins-01.png`
- `packages/client/public/pois/verdant-ruins/poi-verdant-ruins-02.png`
- `packages/client/public/pois/verdant-ruins/poi-verdant-ruins-03.png`
- `packages/client/public/pois/verdant-ruins/poi-verdant-ruins-04.png`
- `packages/client/public/pois/verdant-ruins/poi-verdant-ruins-05.png`

Client:

- `packages/client/src/entities/rig/rig-combat.ts`
- `packages/client/src/net/prediction.ts`
- `packages/client/src/scenes/ArenaScene.ts`
- `packages/client/src/scenes/arena/floor-renderer.ts`
- `packages/client/src/sprites/poi-manifest.ts` (deleted)
- `packages/client/src/sprites/poi-manifest-ashlands.ts` (deleted)
- `packages/client/src/sprites/poi-manifest-frostfell.ts` (deleted)
- `packages/client/src/sprites/poi-manifest-neon-cyber.ts` (deleted)
- `packages/client/src/sprites/poi-manifest-verdant-ruins.ts` (deleted)

Server:

- `packages/server/src/rooms/BossController.ts`
- `packages/server/src/rooms/GameRoom.ts`
- `packages/server/src/rooms/room/room-combat.ts`
- `packages/server/src/rooms/room/room-economy.ts`
- `packages/server/src/rooms/room/room-enemies.ts`
- `packages/server/src/rooms/room/room-movement.ts`
- `packages/server/src/rooms/room/room-progression.ts`

Shared:

- `packages/shared/src/authored-arenas.generated.ts`
- `packages/shared/src/belt-map.ts`
- `packages/shared/src/boss-primitives.ts`
- `packages/shared/src/boss.ts`
- `packages/shared/src/bosses.ts`
- `packages/shared/src/constants.ts`
- `packages/shared/src/dimensions.generated.ts`
- `packages/shared/src/dimensions.ts`
- `packages/shared/src/mapgen.ts`
- `packages/shared/src/parry-reactions.ts`
- `packages/shared/src/state.ts`

Tests:

- `packages/server/src/rooms/BossController.test.ts`
- `packages/server/src/rooms/GameRoom.b25-kungfu-v3.test.ts`
- `packages/server/src/rooms/GameRoom.b28-weapon-orders.test.ts`
- `packages/server/src/rooms/GameRoom.b3-fans.test.ts`
- `packages/server/src/rooms/GameRoom.b32-frostbore.test.ts`
- `packages/server/src/rooms/GameRoom.b37-art-integrator.test.ts`
- `packages/server/src/rooms/GameRoom.b42-relaxed-authority.test.ts`
- `packages/server/src/rooms/GameRoom.b45-gun-recoil.test.ts`
- `packages/server/src/rooms/GameRoom.b5-attackroot.test.ts`
- `packages/server/src/rooms/GameRoom.b51-warp-fix.test.ts`
- `packages/server/src/rooms/GameRoom.b8-pose.test.ts`
- `packages/server/src/rooms/GameRoom.combat-safety.test.ts`
- `packages/server/src/rooms/GameRoom.combat-weapons.test.ts`
- `packages/server/src/rooms/GameRoom.combat.test.ts`
- `packages/server/src/rooms/GameRoom.economy-bank.test.ts`
- `packages/server/src/rooms/GameRoom.economy-pets.test.ts`
- `packages/server/src/rooms/GameRoom.economy.test.ts`
- `packages/server/src/rooms/GameRoom.enemies.test.ts`
- `packages/server/src/rooms/GameRoom.movement.test.ts`
- `packages/server/src/rooms/GameRoom.nw-caster.test.ts`
- `packages/server/src/rooms/GameRoom.progression-late.test.ts`
- `packages/server/src/rooms/GameRoom.progression.test.ts`
- `packages/server/src/rooms/GameRoom.test.ts`
- `packages/server/src/rooms/GameRoom.v3c-caster.test.ts`
- `packages/server/src/rooms/GameRoom.v3r-ranged.test.ts`
- `packages/server/src/rooms/GameRoom.v5m.test.ts`
- `packages/server/src/rooms/GameRoom.v5r.test.ts`
- `packages/server/src/rooms/GameRoom.v6c.test.ts`
- `packages/server/src/rooms/GameRoom.v6m.test.ts`
- `packages/server/src/rooms/GameRoom.v7-hit.test.ts`
- `packages/server/src/rooms/GameRoom.v7-overcasters.test.ts`
- `packages/server/src/rooms/GameRoom.w4m.test.ts`
- `packages/server/src/rooms/GameRoom.w4r-ranged.test.ts`
- `packages/server/src/rooms/progression.test.ts`
- `tests/authored-arena-import.test.ts`
- `tests/chests.test.ts`
- `tests/data-consistency.test.ts`
- `tests/mapgen.test.ts`
- `tests/purity.test.ts`
- `tests/fixtures/ldtk/dangling-landmark-reference.json` (deleted)
- `tests/fixtures/ldtk/overlapping-unsafe-poi.sol2-handoff.json` (deleted)
- `tests/fixtures/ldtk/wrong-cluster-count.json` (deleted)

Tools:

- `tools/artkit/check-assets.mjs`
- `tools/artkit/final-run-day1.cmd`
- `tools/artkit/gen-decals.mjs`
- `tools/artkit/gen-dimensions.mjs`
- `tools/artkit/map-art-qa.mjs`
- `tools/artkit/remediate-map-art.mjs`
- `tools/b45-gun-recoil-live-capture.mts`
- `tools/diag-rb-telemetry.mts`
- `tools/levels/ldtk-import.mjs`

verdict: 112 files, 31 assets deleted, 39 test files updated, pnpm test PASS (220 files; 2,764 passed, 20 skipped), live-check PASS (Wild West; no landmarks or invisible walls).
