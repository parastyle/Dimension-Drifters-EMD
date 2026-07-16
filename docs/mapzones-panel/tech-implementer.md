# Natural Map Zones — Technical Implementer

## Recommendation

Ship one shared, coarse `zoneIds` grid with four broad neighborhoods: **trailhead**, **open country**, **cover country**, and **scar country**. Generate the grid before pits and POIs, then use that same byte array for terrain correlation, server roster weighting, client dressing, and the later danger–loot modifier. Do not create server polygons, client-only masks, or a second zone clock.

Keep the continuous horde player-centered. A zone may change the enemy mix at the already-selected ring spawn, but it must not change the global spawn cadence, entity cap, or compel the squad to travel to a fixed encounter. The current director accumulates time, spawns around living-player anchors on a 720 px ring, and nudges the result off pits/POIs; its cadence already has time/depth scaling and an 80-enemy ceiling. (`packages/server/src/rooms/GameRoom.ts:4074-4131`; `packages/shared/src/constants.ts:250-263`; `packages/shared/src/enemies.ts:711-717`)

The first playable stage should be terrain-only: correlated pits and POIs plus exact procedural ground readability. Zone-aware enemy weights are stage two. The danger–loot hook is stage three and remains off until seeded co-op tests show that the high-risk terrain is not simply the dominant camping spot.

## Ground truth and insertion seams

| Concern | Current truth | Implementation seam |
|---|---|---|
| Shared map | `ArenaMap` contains dimensions, a binary `tiles` array, central spawn, POIs, and the four source seeds; there is no macro-region field. (`packages/shared/src/mapgen.ts:38-66`) | Add `zoneStage`, `zoneIds`, and `zoneSeeds` to this non-networked generated value. |
| Deterministic generation | Server and client both call the same shared `generateArena`; pits and POIs already have separate salted RNG streams. (`packages/shared/src/mapgen.ts:421-454`; `packages/server/src/rooms/GameRoom.ts:4346-4362`; `packages/client/src/scenes/ArenaScene.ts:2350-2363`) | Add a third, independently salted zone stream; do not consume either existing stream. |
| Map scale | The arena is 4,800×4,800 with 80 px cells, hence a 60×60/3,600-cell map. (`packages/shared/src/constants.ts:154-167`; `tests/mapgen.test.ts:249-255`) | A `Uint8Array(3600)` is sufficient for exact region lookup. |
| Pits | Pit sites are deliberately spread, then grown, smoothed, capped, cleared around spawn/border, and repaired for reachability. (`packages/shared/src/mapgen.ts:78-145`; `packages/shared/src/mapgen.ts:421-439`) | Generate zones first and use the zone id only as a pit-site acceptance multiplier; retain every downstream cap and repair. |
| POIs | POIs are independently rejection-sampled on ground with spawn clearance, full-footprint ground checks, and radius-aware walking gaps. (`packages/shared/src/mapgen.ts:356-418`) | Add a zone acceptance multiplier without weakening any existing rejection. |
| Dimensions | A dimension owns its weighted roster, boss, palette, and asset-set keys; its `hazard` is explicitly flavor/future wiring today. (`packages/shared/src/dimensions.ts:27-40`) | Add four dimension-specific `zoneProfiles`; do not pretend black ice, poison, vents, or a live grid have become active mechanics. |
| Normal horde | `spawnEnemy` currently picks from the active dimension roster before choosing an anchor/angle and safe position. (`packages/server/src/rooms/GameRoom.ts:4086-4131`) | Resolve the final spawn neighborhood, then pass that profile's enemy multipliers into the roster picker. |
| Loot | Ordinary kills call `dropLoot` with trash/tough base chance and rarity bonus; the helper rolls identity/rarity/affix and places the pickup safely. (`packages/server/src/rooms/GameRoom.ts:3165-3178`; `packages/server/src/rooms/GameRoom.ts:3213-3249`) | Apply the death neighborhood's bounded multiplier only at this call. |
| Client floor | The client regenerates from synced seeds, destroys the old floor on a new seed/dimension fingerprint, then passes the shared map to `drawArena`, `buildArenaFloor`, and `buildPois`. (`packages/client/src/scenes/ArenaScene.ts:2310-2409`) | Include `zoneStage` in the fingerprint and let the three renderer functions consume `zoneIds`. |
| Name collision | `ArenaState.zones` already means authoritative, short-lived corrosive puddles, and the client also stores those rendered puddles as `zones`. (`packages/shared/src/state.ts:163-169`; `packages/shared/src/state.ts:256-265`; `packages/client/src/scenes/ArenaScene.ts:844-848`) | Call the static geography `zoneIds`/`mapZones`, never `zones` or `ZoneState`. |

## Shared data contract

This is the target shape, not a request to serialize 3,600 bytes:

```ts
export const MAP_ZONE_COUNT = 4;
export type MapZoneId = 0 | 1 | 2 | 3;

export type MapZoneSeed = Readonly<{
  id: MapZoneId;
  col: number;
  row: number;
}>;

export type ArenaMap = {
  // existing fields
  zoneStage: number;
  zoneIds: Uint8Array;       // row-major, exactly cols * rows
  zoneSeeds: MapZoneSeed[];  // label/debug anchors, not the collision truth
};

export type DimensionZoneProfile = Readonly<{
  name: string;
  danger: 0 | 1 | 2 | 3;
  accent: keyof DimensionPalette;
  tileBag: readonly number[]; // weighted indices, each 0..3
  decalDensity: number;
  poiArtSalt: number;
  enemyWeights: Readonly<Record<string, number>>; // sparse kind-id multipliers
  toughBonus: number;
  lootChanceMult: number;
  lootLukBonus: number;
}>;
```

`zoneIds`, not `zoneSeeds`, is authoritative for lookup. Export `zoneAtTile(map, col, row)` and `zoneAtPx(map, x, y)` from `mapgen.ts`; both clamp to the nearest map cell and return `0` for stage zero. That gives pits, POIs, the server, and the renderer one exact predicate.

Use a fixed tuple `DimensionDef.zoneProfiles[0..3]`, not an object iterated by key. Slot meanings stay structural across dimensions while names, art biases, and roster multipliers are themed:

| Slot | Structural role | Topology bias | Server meaning |
|---:|---|---|---|
| 0 | Trailhead/neutral | Existing baseline; contains central spawn | Baseline roster and loot |
| 1 | Open country | Fewer pits and POIs | Prefer rushers/swarms from that dimension's roster |
| 2 | Cover country | POI-heavy, pit-light | Prefer enemies whose local fight benefits from broken sightlines/tight routes |
| 3 | Scar country | Pit-heavy, POI-light | Prefer zoners/ranged pressure; highest bounded tough and loot tuning |

The per-dimension records belong in `data/dimensions-design.json`, with `tools/artkit/gen-dimensions.mjs` copying them into the generated registry; Wild West stays hand-authored. The generated file explicitly names those data files as its source and says not to edit the output directly. (`tools/artkit/gen-dimensions.mjs:1-19`; `tools/artkit/gen-dimensions.mjs:97-145`; `packages/shared/src/dimensions.generated.ts:1-10`)

Extend the existing registry consistency test so every profile has a non-empty `tileBag`, valid variant indices, finite bounded tuning, and `enemyWeights` keys belonging to that dimension's roster. The current test already turns bad roster/boss ids into build failures. (`tests/data-consistency.test.ts:245-262`)

## Zone generation in `mapgen.ts`

### Layout algorithm

1. Stage zero takes the current generation path byte-for-byte and returns an all-zero `zoneIds` grid. Capture golden hashes for several current maps before changing the algorithm; rollback must preserve their tiles and POIs.
2. For stage one or later, create `zoneRng = makeRng(mixSeeds(seedTerrain, seedTheme, ZONE_SALT))`. `makeRng` and `mixSeeds` use fixed 32-bit integer operations and already define the shared deterministic stream. (`packages/shared/src/rng.ts:23-36`; `packages/shared/src/rng.ts:39-52`)
3. Put slot 0 at the center. Put three outer sites on an annulus around it at roughly 120° separation, with a seeded global rotation plus bounded integer row/column jitter. Shuffle profile ids 1–3 across those three sites. This guarantees one neutral center and three large external neighborhoods while making “top-left” mean something different per seed.
4. For every grid cell, assign the id of the nearest site by squared integer distance; ties go to the lower site-array index. Do not use `Math.hypot`, unordered object iteration, or runtime texture state in this pass.
5. Validate that the center is slot 0, every id is `< MAP_ZONE_COUNT`, every site cell owns its id, and each outer zone clears a minimum area (start at 8% of cells). If the jittered layout misses the minimum, deterministically retry with the same stream plus an integer attempt salt; after a small fixed retry count, fall back to unjittered 120° sites.

This is seeded Voronoi, but the stored byte grid is the contract. A future warped boundary can replace step 4 behind a new generation version without changing any consumer.

### Correlate existing terrain; do not add a new damage mask

Generate `zoneIds` before the hazard pass. Extend `pitSites` with a slot multiplier such as neutral `1.0`, open `0.45`, cover `0.45`, scar `1.8`; normalize acceptance so the total requested site count remains driven by `MAP_PIT_TARGET`. The existing two smoothing passes, global pit ceiling, forced safe center/border, and connectivity repair remain after the biased placement. (`packages/shared/src/constants.ts:168-187`; `packages/shared/src/mapgen.ts:429-439`)

Pass `zoneIds` into `placePois`. Draw the candidate coordinates, art `kind`, and zone-acceptance roll before any rejection, then favor cover and suppress scar/open while retaining the current ground, footprint, spawn, and pairwise-spacing checks. The existing code already draws the art roll before rejection to stabilize RNG cadence; preserve that property. (`packages/shared/src/mapgen.ts:373-416`)

Do not add generic zone damage, slow, stagger, collision, or a client clock in this pass. The registry's current themed hazards describe materially different future systems, while the map today has exact authoritative behavior for pits and collidable POIs. (`packages/shared/src/dimensions.generated.ts:23-41`; `packages/shared/src/dimensions.generated.ts:56-74`; `packages/shared/src/dimensions.generated.ts:89-107`; `packages/shared/src/dimensions.generated.ts:122-140`; `packages/server/src/rooms/GameRoom.ts:2090-2131`)

Extend `validateArena` after its existing spawn/border/connectivity checks with the zone shape checks above. The present validator is already called by the server immediately after every map mint, so an invalid layout will fail loudly in the same place. (`packages/shared/src/mapgen.ts:643-661`; `packages/server/src/rooms/GameRoom.ts:4346-4362`)

## Authoritative server consumption

### Normal spawn path

Keep `runSpawnDirector` unchanged. It should continue to own the accumulator, elapsed/depth interval, and entity cap. (`packages/server/src/rooms/GameRoom.ts:4074-4084`)

Change only `spawnEnemy` ordering:

1. Pick the living-player anchor and ring angle as today. (`packages/server/src/rooms/GameRoom.ts:4091-4096`)
2. Compute the ring point and call `safeSpawnPos` once. Use the maximum radius among the active dimension's normal roster for this pre-kind settle, so the later kind cannot overlap a POI. `safeSpawnPos` already performs bounded pit and POI settling and is shared/tested. (`packages/shared/src/mapgen.ts:530-591`; `tests/mapgen.test.ts:214-247`)
3. Read `zoneId = zoneAtPx(this.map, sp.x, sp.y)` and `profile = getDimension(dimensionId).zoneProfiles[zoneId]`.
4. Extend `pickEnemyKind(roll, roster, multipliers?)` so its effective weight is `ENEMY_KINDS[id].weight * (multipliers[id] ?? 1)`. The existing picker already performs a pure weighted choice restricted to the active roster. (`packages/shared/src/enemies.ts:536-549`)
5. Add `profile.toughBonus` to the existing time/player/depth probability, preserving the current non-swarm rule and hard probability cap. Current tough chance already composes those three axes. (`packages/server/src/rooms/GameRoom.ts:4101-4110`; `packages/shared/src/enemies.ts:681-691`)
6. Spawn at the settled point and insert into the spatial grid exactly as today. (`packages/server/src/rooms/GameRoom.ts:4125-4131`)

This reads zone weights without pulling encounters toward a fixed quadrant: spawn time, anchor, angle, and ring remain player-centered; only the local roster mix changes. Do not add per-tick zone population balancing or an “underfilled zone” scan. (`packages/server/src/rooms/GameRoom.ts:4074-4127`)

Do not apply macro zones to belt waves. Belt mode is authored floor/room progression with no procedural pits/POIs, and its room state machine replaces the continuous arena director. (`packages/server/src/rooms/GameRoom.ts:479-487`; `packages/server/src/rooms/GameRoom.ts:1845-1867`; `packages/server/src/rooms/GameRoom.ts:4044-4071`)

Also leave bosses, boss-authored adds, and cross-dimensional shifters on their existing paths. Shifters have their own tier/cadence/lifecycle and safe edge spawn, while dimension bosses have a separate selector and spawn routine. (`packages/server/src/rooms/GameRoom.ts:4273-4343`; `packages/server/src/rooms/GameRoom.ts:4201-4256`)

### Danger–loot hook

At stage three only, calculate the death neighborhood in `damageEnemy` immediately before the ordinary `dropLoot` call:

```ts
const profile = dimension.zoneProfiles[zoneAtPx(this.map, enemy.x, enemy.y)];
const chance = baseChance * clamp(profile.lootChanceMult, 0.75, 1.35);
const tier = baseTierLuk + clamp(profile.lootLukBonus, 0, 2);
this.dropLoot(enemy.x, enemy.y, chance, tier);
```

Use death position, not player position, so the visible battlefield that carried the risk also owns the reward. Terrain pit kills already delete non-boss enemies without passing through the normal damage/XP/drop path, so the scar cannot print loot by feeding enemies to pits. (`packages/server/src/rooms/GameRoom.ts:2119-2131`; `packages/server/src/rooms/GameRoom.ts:3120-3178`)

Apply the modifier only to ordinary mystery drops. Do not multiply the guaranteed boss drop, shifter salvage, or an enemy's separate identity-known wielded-weapon roll. Those channels are distinct in the current death path. (`packages/server/src/rooms/GameRoom.ts:3151-3177`; `packages/server/src/rooms/GameRoom.ts:3718-3737`)

Keep initial tuning narrow: neutral/open `1.0`, cover at most `1.1`, scar at most `1.2`; use the schema's wider clamps as corruption guards, not launch values. If seeded playtests show stationary farming, leave stage three disabled rather than compensating with more spawns.

## Client consumption and WYSIWYG

`maybeBuildFloor` already waits for all four seeds, includes the dimension in its rebuild fingerprint, regenerates the shared map, and replaces every floor object. Add `mapZoneStage` to that fingerprint and pass the active `zoneProfiles` into the floor renderer. (`packages/client/src/scenes/ArenaScene.ts:2310-2365`; `packages/client/src/scenes/ArenaScene.ts:2383-2409`)

Implement the visual read with existing assets plus one procedural layer:

- **Exact footprint:** in `buildArenaFloor`, merge horizontal runs of equal `zoneIds` into one low-alpha `Graphics` wash and stroke only inter-zone seams. Add at most one muted name stencil at each `zoneSeed`. Put this below pits and the safe ring; pits already derive their fill/rim/“hop versus go around” marks from exact tile truth. (`packages/client/src/scenes/arena/floor-renderer.ts:262-370`)
- **Painted floor bias:** `drawArena` currently chooses uniformly from four loaded 512 px dimension tiles. Select from `profile.tileBag` using the zone at each image center, retaining the seeded quarter-turn. This changes selection, not texture count. (`packages/client/src/scenes/arena/floor-renderer.ts:117-137`)
- **Decal bias:** `scatterDecor` already draws every random property before checking pits/texture availability. Preserve that fixed cadence, then use `profile.decalDensity` as an acceptance probability and a stable manifest subrange/hash for local prop character. A missing texture must still skip only its own draw. (`packages/client/src/scenes/arena/floor-renderer.ts:374-416`)
- **POI bias:** include `zoneId` in the deterministic art index, but keep the existing squat/tall partition and continue deriving image scale from `poiRadius(kind)`. Collision size and the painted base must remain coupled. (`packages/client/src/scenes/arena/floor-renderer.ts:195-258`; `packages/shared/src/mapgen.ts:331-349`)

Do not use the lightning/storm component packs or impact flipbooks as persistent zone borders. The composer assets are authored as transient cores, rings, shrapnel, wisps, and ground components, and the impact system is a six-frame combat payoff; repeating them across harmless floor would imply an active hit. (`packages/client/src/vfx/fx-composer.ts:17-66`; `packages/client/src/scenes/arena/vfx.ts:14-35`) The 96 painted particle sheets remain available for later sparse ambience, but they are reinforcement only; the procedural shared footprint must remain readable if optional art fails. (`packages/client/src/vfx/particle-manifest.ts:1-9`; `packages/client/src/vfx/particle-manifest.ts:10-106`)

This is the WYSIWYG gate: zone seams communicate neighborhood identity, while actual danger remains the exact pit tiles, POI collision/cover, and authoritative enemies. The audit already identifies visible-versus-authoritative position disagreement as a melee/terrain-read failure, and current POI rendering explicitly derives visual scale from shared collision radius. (`docs/GAMEFEEL_AUDIT.md:93-96`; `packages/server/src/rooms/GameRoom.ts:2090-2131`; `packages/client/src/scenes/arena/floor-renderer.ts:199-204`)

## Determinism proof

For a fixed `(seedTerrain, seedHazard, seedTheme, seedDecor, zoneStage)`:

1. Server mints and syncs the same four numeric seeds that the client feeds back into shared generation. (`packages/shared/src/state.ts:267-276`; `packages/server/src/rooms/GameRoom.ts:4346-4358`; `packages/client/src/scenes/ArenaScene.ts:2358-2363`)
2. `zoneRng` starts from the same integer `mixSeeds` result and consumes a fixed sequence to make four integer sites and a fixed shuffle. (`packages/shared/src/rng.ts:23-36`; `packages/shared/src/rng.ts:44-52`)
3. Every cell executes the same four integer squared-distance comparisons in row-major order with an explicit tie-break; therefore both sides write the same byte at every `zoneIds[i]`.
4. Zone generation uses its own salt and never consumes the existing hazard or POI RNG streams, so adding renderer tuning cannot perturb topology.
5. Renderer randomness uses a separate salted stream, draws a fixed candidate record before any texture-existence branch, and reads the same `zoneIds`; optional asset failure may remove decoration but cannot move a semantic boundary. The current decal path already follows the draw-before-texture-check pattern. (`packages/client/src/scenes/arena/floor-renderer.ts:388-415`)
6. The spawn director may continue using `Math.random` because spawn decisions are server-authoritative and serialized as enemy state; that randomness never writes `zoneIds`. Enemy state already lives in authoritative `ArenaState.enemies`. (`packages/shared/src/state.ts:256-265`; `packages/server/src/rooms/GameRoom.ts:4086-4131`)

The only new wire value is the rollout stage; the grid itself is regenerated locally and never streamed.

### Test strategy

Extend `tests/mapgen.test.ts`, which already runs 200 seeds, checks repeat generation, and validates terrain/POI guarantees. (`tests/mapgen.test.ts:27-77`; `tests/mapgen.test.ts:122-212`)

- Assert same inputs produce byte-identical `zoneIds`, identical `zoneSeeds`, identical POIs, and identical tiles.
- Assert `zoneIds.length === tiles.length`, every id is in range, center is 0, each site's cell owns its id, and each enabled outer zone meets the minimum area.
- Across the 200-seed sample, assert scar has higher aggregate pit density than open, cover has higher aggregate POI density than open, all maps still pass `validateArena`, and every POI footprint remains on ground.
- Add stage-zero golden fingerprints captured before the change; stage zero must match the legacy tile and POI outputs exactly.
- Add fixed golden vectors for several stage-one zone grids, including one tie case and one deterministic fallback-layout case.
- Retain the purity gate: `mapgen.ts` is already scanned for `Math.random`. (`tests/purity.test.ts:20-44`)
- In `GameRoom.test.ts`, set a known map/stage and stub `Math.random` so a spawn point lands in each zone; assert cadence/count stay unchanged while the kind distribution reads the profile multiplier. The harness already exposes private room state through `AnyRoom` and has a seeded golden-tick test. (`packages/server/src/rooms/GameRoom.test.ts:49-70`; `packages/server/src/rooms/GameRoom.test.ts:1491-1554`)
- Add two loot threshold tests with the same base roll in neutral and scar, plus negative tests proving boss, shifter, pit-kill, and wielded-weapon channels are unchanged.
- Extract a pure `planZoneFloor` helper from the renderer and test tile/decal/POI choices without booting Phaser; missing-texture simulation must change only emitted objects, never the plan or boundaries.

The strongest cross-side contract test is: mint a `GameRoom`, read its synced seeds/stage, independently call shared `generateArena` as the client does, and compare a digest of `zoneIds + zoneSeeds + tiles + pois` to `room.map`. That tests the actual server mint seam and the exact client regeneration inputs rather than merely calling the generator twice. (`packages/server/src/rooms/GameRoom.test.ts:1498-1518`; `packages/server/src/rooms/GameRoom.ts:4346-4358`; `packages/client/src/scenes/ArenaScene.ts:2358-2363`)

## Performance and network budget

- Zone construction is `3,600 cells × 4 sites = 14,400` integer distance comparisons, once per map on server and client. Maps are minted at room create/restart/descent, while the client rebuild gate runs only when its seed/dimension fingerprint changes. (`packages/server/src/rooms/GameRoom.ts:4346-4358`; `packages/client/src/scenes/ArenaScene.ts:2350-2363`)
- The grid costs 3,600 bytes plus four tiny seed records per generated map. There is no per-client zone-grid payload because the current map contract already syncs seeds and regenerates locally; the proposed wire addition is only one `uint8` stage. (`tests/mapgen.test.ts:249-255`; `packages/shared/src/state.ts:267-276`)
- Runtime lookup is one multiply/add and byte read. Perform it only on normal spawn, combat kill, and client floor build—not for every enemy on every 20 Hz tick. The authoritative tick is 20 Hz. (`packages/shared/src/constants.ts:15-18`)
- Do not increase floor image count. The painted floor currently creates roughly 100 static 512 px images once; zone logic only changes which key each image uses. (`packages/client/src/scenes/arena/floor-renderer.ts:117-137`)
- Keep existing decor candidate counts and reject by zone rather than allocating more candidates. The current counts already scale with arena area. (`packages/client/src/scenes/arena/floor-renderer.ts:382-405`)
- The normal director is hard-floored at a 0.25 s interval and capped at 80 enemies, so one O(1) zone lookup and a small weighted roster loop per spawn are negligible. (`packages/shared/src/enemies.ts:711-717`; `packages/shared/src/constants.ts:250-263`)
- Render all region fills/seams into one static `Graphics`; do not create one object per 80 px cell.

## Rollout flag

Append `@type("uint8") mapZoneStage = 0` to `ArenaState` and bump `SCHEMA_VERSION`. Colyseus schema fields are order-sensitive and the code explicitly requires a version bump for any synced field change. (`packages/shared/src/constants.ts:8-13`; `packages/shared/src/state.ts:256-260`)

Set it once in `GameRoom.onCreate` from `DD_MAP_ZONES=0|1|2|3`, then pass it to `generateArena`; sync, do not independently read the environment on the client. `GameRoom` already uses a server environment switch for staged dev tooling, so this follows an existing configuration pattern. (`packages/server/src/rooms/GameRoom.ts:502-509`; `packages/server/src/rooms/GameRoom.ts:522-555`)

| Stage | Enabled behavior |
|---:|---|
| 0 | Exact legacy pit/POI generation, all-zero zone grid, baseline renderer/director/loot |
| 1 | Zone layout, correlated pits/POIs, procedural footprint, tile/decal/POI art bias |
| 2 | Stage 1 plus zone-aware normal-roster and tough weights; unchanged cadence/location/cap |
| 3 | Stage 2 plus bounded ordinary mystery-drop modifier |

Read the flag only when the room is created; do not switch a live map's stage. Rolling back to 0 then affects new rooms without asking clients to infer a different map from unchanged seeds.

## Build order

1. **Freeze rollback goldens.** Record legacy tile/POI fingerprints for fixed seeds in `tests/mapgen.test.ts`; no production logic yet.
2. **Add the shared flag contract.** Append `mapZoneStage`, bump `SCHEMA_VERSION`, include the stage in the client's seed key, and make stage 0 explicitly reproduce legacy output. The client already detects and reports a schema-version mismatch. (`packages/client/src/scenes/ArenaScene.ts:2517-2522`)
3. **Add registry data.** Define `DimensionZoneProfile`, hand-author Wild West, extend the JSON source and generator for the four generated dimensions, regenerate, and strengthen data-consistency tests. Do not hand-edit `dimensions.generated.ts`. (`packages/shared/src/dimensions.ts:27-40`; `tools/artkit/gen-dimensions.mjs:104-145`)
4. **Generate the shared zone grid.** Add sites, grid helpers, zone validation, and the independent RNG salt. Land determinism/area/golden tests before terrain bias.
5. **Correlate existing topology.** Feed slot weights into pit-site and POI acceptance while preserving the pit cap, safe center/border, connectivity repair, POI ground footprint, and walking gaps. Re-run the full 200-seed suite. (`packages/shared/src/mapgen.ts:429-443`; `tests/mapgen.test.ts:54-77`; `tests/mapgen.test.ts:135-167`)
6. **Make stage 1 readable.** Add the one-Graphics footprint and bias the already-loaded tile/decal/POI sets. Validate with assets present, individual textures missing, and the legacy `tile-ground` fallback; current rendering already has explicit optional-art fallbacks. (`packages/client/src/scenes/arena/floor-renderer.ts:97-184`; `packages/client/src/scenes/ArenaScene.ts:2317-2349`)
7. **Enable stage 2 server ecology.** Reorder normal spawn resolution, extend the pure roster picker, and add focused plus golden-tick server tests. Belt, bosses, adds, and shifters remain unchanged.
8. **Playtest stage 2 before economy.** Required observations: players can name all four neighborhoods from the floor; at least two are defensible fight locations; split co-op does not produce incoherent pressure; and no profile dominates merely because of its enemy mix.
9. **Wire stage 3, still default-off.** Add the ordinary-drop hook and its exclusion tests. Enable only after kill/drop-by-zone samples show the bounded premium pays for actual terrain risk rather than stationary farming.
10. **Roll forward 1 → 2 → 3.** A failed stage rolls back to the previous integer; a determinism, WYSIWYG, connectivity, or schema-handshake failure rolls all the way to 0.

## Acceptance gates

- Same seeds and stage yield identical `zoneIds`, topology, POIs, and deterministic dressing plan on server and client.
- Every stage-one map passes existing spawn, border, connectivity, pit, POI-footprint, and walking-gap guarantees.
- The active gameplay footprint is never inferred from decals or transient FX.
- Normal horde cadence, player-centered ring spawn, and entity cap are unchanged at stage two.
- Belt, boss, boss-add, and shifter paths show no zone-dependent behavior.
- Stage zero matches captured legacy fingerprints.
- Stage three cannot affect terrain kills, guaranteed boss rewards, shifter salvage, or wielded-weapon drops.

That sequence grounds the director's “stay away from the top-left because X” in one shared spatial truth: the top-left can be visibly scarred, actually contain more pits, produce a recognizable local enemy mix, and—only after that risk proves real—pay a small authoritative premium.
