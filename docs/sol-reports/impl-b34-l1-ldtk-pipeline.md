# B34 Lane 1 — LDtk Map Pipeline

## Initial model and importer plan

The LDtk project at `data/maps/corporate-grid/corporate_grid_v13_imagegen_material_variants.ldtk`
remains the single authored source of truth. A deterministic map-generation step will parse it
and emit a versioned shared TypeScript model containing:

- floor identifiers, world positions, pixel/grid dimensions, and ordered layer metadata;
- tileset references plus tile instances for the parallax and office-material layers;
- collision IntGrid cells, distinguishing solid value `1` and end-blocker value `3`;
- lane-guide IntGrid cells and the derived playable vertical lane span;
- typed entities for player spawns, enemy wave anchors, camera bounds, end walls, elevators,
  and combat lanes;
- synthesized, evenly spaced enemy wave anchors where the authored markers are too sparse.

The generator will also copy the referenced tileset PNGs into the client public asset tree. Both
the TypeScript output and copied assets will be covered by generation drift checking.

## Planned surfaces

- Workspace generation commands and generation-drift checks.
- A mapkit/artkit importer plus deterministic importer tests.
- Versioned shared generated map model and lookup helpers.
- Belt-only client floor selection, tile/parallax rendering, and entity-safe z ordering.
- Belt-only server collision, projectile blocking, playable-lane clamps, camera clamps, player
  spawns, and wave-anchor selection with a floor-depth direction bias.
- Unit coverage for extraction counts, synthesis, determinism, and right-biased wave selection.
- Private-port live-gate evidence for floor rendering, lane/end/camera clamps, and wave spawning.

## Stage log

- Initialized the implementation report before repository changes, per the lane contract.
- Importer/model stage: added `tools/mapkit/gen-corporate-grid.mjs` plus strict LDtk 1.5.3
  validation and a version-1 generated shared catalog. The generator owns both the TypeScript model and
  byte-for-byte copies of the two referenced PNGs under `packages/client/public/maps/corporate-grid/`;
  `gen:check` checks all three outputs.
- Extraction totals per floor: 598 solid-1 cells, 48 end-blocker-3 cells, 430 lane-center-1
  cells, 516 lane-boundary-2 cells, 1 player spawn, 2 authored enemy spawns, 1 camera bound,
  2 end walls, 3 elevator markers, and 5 combat lanes. Render layers contain 688 parallax
  tiles and 1,548 material tiles.
- Anchor synthesis: each floor retains its 2 authored `EnemySpawn` markers and deterministically
  receives 6 generated anchors by largest-gap subdivision, for 8 wave anchors per floor.
- Runtime-consumption stage: registered `beltLevel=corporate-grid` as floor 1, with direct IDs for
  portrait-hall and marble floors. Added shared lane/end/camera/collision helpers, solid-cell
  projectile blocking, player/enemy navigation clamps, PlayerSpawn placement, explicit depth-biased
  wave-anchor selection, and matching client prediction bounds.
- Render stage: ArenaScene loads only the selected corporate floor's two generator-owned tilesets,
  builds LDtk tile layers bottom-to-top, foreshortens them with the existing belt projection, keeps
  material art below entities, and gives the skyline a 0.35 horizontal scroll factor.
- Focused verification: shared build, importer/model tests, belt helper tests, client/server
  typechecks, and the three new GameRoom corporate-grid authority tests are green.
- End-blocker reconciliation: the importer now derives the playable x band from both
  `Collision_IntGrid` value-3 columns and `EndWall` entity bounds, rejects any disagreement, and
  intersects those with `CameraBounds`. All three authored floors resolve to `x=120..5040`.
- Repository verification: `pnpm gen`, `pnpm gen:check`, `pnpm typecheck`, `pnpm assets:check`,
  client/server production builds, and the full `pnpm test` suite are green. The settled full run
  passed 184 files and 2,296 tests.
- Private live gate: Colyseus `56341` and Vite `56342` booted without touching live owner ports
  `2567`/`5180`. Vite returned the transformed ArenaScene plus both generated tilesets. Real
  Colyseus rooms joined all three direct corporate floor IDs with
  `proto-cowboy-hidden-face`; floor 1 spawned at authored `(420, 780)`, the top-band input probe
  clamped at authoritative `y=2224`, and a 120 ms wave sample placed all four enemies to the right
  of the player.
- Visual gate limitation: the required browser-control runtime reported no available browser
  instances after its prescribed recovery check. Its workflow prohibits substitution with an
  unrelated browser backend, so screenshot/render claims are intentionally not fabricated. The
  live HTTP/server probes and the exact blocker are recorded under the evidence path for the
  orchestrator's screenshot-only re-run.

## Files touched

- Generation/import: `package.json`, `tools/mapkit/corporate-grid-import.mjs`,
  `tools/mapkit/gen-corporate-grid.mjs`, `tests/corporate-grid-import.test.ts`.
- Shared model/sim: `packages/shared/src/corporate-grid-map.generated.ts`,
  `packages/shared/src/corporate-grid-map.ts`, `packages/shared/src/belt-map.ts`,
  `packages/shared/src/belt-map.test.ts`, `packages/shared/src/collision.ts`,
  `packages/shared/src/movement.ts`, `packages/shared/src/index.ts`.
- Client/server: `packages/client/src/scenes/ArenaScene.ts`,
  `packages/client/src/net/prediction.ts`, the two generated PNG copies under
  `packages/client/public/maps/corporate-grid/`, `packages/server/src/rooms/GameRoom.ts`,
  and `packages/server/src/rooms/GameRoom.test.ts`.
- Generated/asset checks: `tools/artkit/check-assets.mjs`, `tools/portal/index.html`.
- Documentation/evidence: this report and
  `docs/owner-notes-audit-v11-evidence/b34-l1-ldtk-pipeline/`.

verdict: importer live; 3 floors are generator-backed, production-built, and live server-loadable, but screenshot proof that all 3 render is BLOCKED by no available browser instance; collision/lanes/camera/spawn-anchors live (per floor: 598 solid-1, 48 end-blocker-3, 430 lane-1, 516 lane-2, 1 PlayerSpawn, 2 authored + 6 synthesized = 8 wave anchors, 1 CameraBounds, 2 EndWall, 3 ElevatorMarker, 5 CombatLane); right-bias waves live; evidence path `docs/owner-notes-audit-v11-evidence/b34-l1-ldtk-pipeline/`; files touched are enumerated above.
