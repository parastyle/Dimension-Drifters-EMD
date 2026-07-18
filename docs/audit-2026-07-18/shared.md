# Shared package + wire audit — 2026-07-18

Scope: `packages/shared/src/**`, the shared package export surface, `tests/purity.test.ts`, and the generators that own shared/weapon wire artifacts. Client/server behavior was not audited; references outside the shared package are used only to prove whether a shared API has a consumer. The known repository-wide Biome/CRLF debt is intentionally omitted.

Verification performed read-only:

- `pnpm --filter @dd/shared typecheck` passes.
- `gen-weapon-expansion.mjs --check` and `gen-dimensions.mjs --check` both report their committed output in sync; no hand-edit drift was found in either shared generated file.
- `build-weapon-vfx.mjs --check` exits successfully without checking its TypeScript output because six local authoring artifacts are absent; that false-green is a finding below.
- The shared import graph has no runtime ESM cycle after type-only edges are removed, but it does have avoidable source/type knots and a root barrel that joins every domain.

## P0

No P0 findings.

## P1

### P1.1 — Plain-object registries accept prototype names as valid IDs

- **Evidence:** `packages/shared/src/augments.ts:37` declares `AUGMENTS` as a plain `Record<string, AugmentDef>`, `packages/shared/src/augments.ts:185-195` adds hidden properties and validates with `value in AUGMENTS`, and `packages/shared/src/dimensions.ts:79-90` indexes another plain registry before applying its fallback. Against the current build, `isAugment("toString")`, `isAugment("__proto__")`, and `isAugment("constructor")` are all `true`, while `getDimension("toString")` returns a function instead of a `DimensionDef`.
- **Why:** An untrusted or stale string can satisfy a shared type guard/resolver while yielding an inherited function/object, invalidating both the runtime contract and the TypeScript narrowing.
- **Fix:** Change `isAugment` to `typeof value === "string" && Object.hasOwn(AUGMENTS, value)` and make it narrow to a real `AugmentId`; change `getDimension` to use `Object.hasOwn(DIMENSIONS, id)` before indexing; add regression cases for `toString`, `constructor`, and `__proto__`; then audit other public `REGISTRY[id]` guards and either use `Object.hasOwn` or assemble frozen null-prototype registries.

### P1.2 — `PlayerState` exposes methods that decoded client rows provably do not have

- **Evidence:** `packages/shared/src/state.ts:240-245` documents that decoded client rows carry only wire fields, but `packages/shared/src/state.ts:246-281` still publishes 18 compatibility getters/setters on the exported `PlayerState` class; `packages/shared/src/state.ts:56-59` supplies a mutable singleton `WeaponResourceState` fallback even though callers receive a mutable return type.
- **Why:** One exported nominal type describes two incompatible runtime shapes, so a type-correct caller can black-screen on a decoded row, and a write through `weaponResource` on a partial constructed row can mutate the process-wide fallback sentinel.
- **Fix:** Mechanically migrate constructed-state callers to `player.ultimate.*` and `player.dualWield.*`, delete all compatibility getters/setters and `DECODE_WINDOW_RESOURCE`, and type client-facing selectors against a structural `PlayerWire`/nested-row interface; add one test fixture made from a decoder-shaped plain object with no prototype so future shared helpers cannot accidentally depend on class methods.

### P1.3 — The 64-field wire ceiling is guarded only at the last index, not by a complete layout contract

- **Evidence:** `packages/shared/src/state.ts:86-239` declares exactly 64 decorated `PlayerState` fields, with `dualWield` at index 63; `packages/server/src/rooms/progression.test.ts:579-589` asserts only `PlayerState[63]`, absence of index 64, and two `DualWieldState` names, while `packages/server/src/rooms/GameRoom.test.ts:6635-6644` separately checks only tail index 7. No test pins the ordered name/type list for indexes 0-62 or for the other 15 schema classes in `state.ts`.
- **Why:** A decorator moved, inserted, deleted, or retyped anywhere before the checked tail can silently change live Colyseus field numbers while every current schema-layout assertion remains green.
- **Fix:** Add one shared wire-layout test that reflects every `Schema` subclass in `state.ts` and snapshots the complete ordered `[index, name, type]` list plus `SCHEMA_VERSION`; assert `PlayerState` has at most 64 entries and make any snapshot edit require the version in the same fixture to change, then replace the scattered partial metadata assertions with that single manifest.

### P1.4 — The purity gate omits a live prediction module and cannot cover deterministic RNG because entropy shares its module

- **Evidence:** `tests/purity.test.ts:26-39` checks only eight hand-listed files and omits `belt-map.ts`; `packages/shared/src/belt-map.ts:81-137` contains the belt safe-position/floor/obstacle math used as replicated movement geometry; `packages/shared/src/rng.ts:23-50` contains deterministic `makeRng`/`mixSeeds`, but `packages/shared/src/rng.ts:54-60` puts server entropy (`Math.random`) in the same module, and `mapgen.ts` imports that module at `packages/shared/src/mapgen.ts:39`.
- **Why:** A random/clock dependency added to belt prediction or the deterministic PRNG path can desynchronize authority and replay while the stated purity law still passes.
- **Fix:** Move `randomSeed` to a server-owned entropy module (or a separately named non-replicated shared module), add `rng.ts`, `belt-map.ts`, and `weapon-resource.ts` to the gate, and make the gate walk the transitive shared imports of replicated roots while rejecting `Math.random`, `Date`, `performance`, and environment/engine imports; add fixed-input repeat tests for the belt obstacle and safe-X functions.

## P2

### P2.1 — Importing the package root joins every domain and executes whole-catalog initialization

- **Evidence:** `packages/shared/package.json:8-13` exports only `"."`; `packages/shared/src/index.ts:1-25` re-exports every module including schema, map generation, bosses, weapons, meta, and banking; `packages/shared/src/state.ts:1` loads the Colyseus runtime, while `packages/shared/src/weapon-resource.ts:250-264` eagerly derives profiles for all 316 catalog weapons at module evaluation.
- **Why:** Even a consumer that needs one pure scalar is coupled to schema and giant generated catalogs, increasing initialization/bundle cost and making unrelated domain edits invalidate the entire shared surface.
- **Fix:** Add explicit package subpaths such as `@dd/shared/math`, `/movement`, `/state`, `/weapons`, `/weapon-resource`, and `/meta`; migrate internal consumers to the narrowest subpath while retaining `.` as a compatibility facade for one release, and only declare the package side-effect-free after the import-time mutation/validation loops in the findings below are removed or isolated.

### P2.2 — `enemies.ts` hand-corrects and tunes generated objects by mutating them at import time

- **Evidence:** `packages/shared/src/enemies.ts:1031-1054` says generated data is contradictory and rewrites two generated enemy rows, `packages/shared/src/enemies.ts:1056-1092` attaches combo data and multiplies speed/range/arc on the merged objects, and `packages/shared/src/enemies.ts:513-521` similarly mutates every authored combo definition. Because `packages/shared/src/enemies.ts:593-950` uses a shallow spread of `DIMENSION_ENEMY_KINDS`, the generated export and final runtime registry share those mutated object references.
- **Why:** The checked generated file is not the actual runtime source of truth, and importing another module changes exported catalog objects in place, making values dependent on hidden normalization order.
- **Fix:** Move the Marshal/Riot corrections into `data/dimensions-design.json` or `data/dimension-shifters.json`, replace the three top-level mutation passes with a pure `normalizeEnemyKind`/`normalizeCombo` clone step during registry assembly (including cloned nested `melee`, `combos`, and `return` rows), and freeze the final registry in development/tests so later writes fail loudly.

### P2.3 — Generated artifacts depend back on their assemblers, and the VFX drift check can report success without checking

- **Evidence:** `packages/shared/src/weapons.ts:19-20` imports `weapons-expansion.generated.ts`, which imports `WeaponDef` back from `weapons.ts` at `packages/shared/src/weapons-expansion.generated.ts:6`; `packages/shared/src/dimensions.generated.ts:7-8` similarly imports types from both consuming registries; `packages/client/src/vfx/weapon-vfx.generated.ts:6-24` owns hand-maintained public interfaces as generated text; and `tools/artkit/build-weapon-vfx.mjs:31-54` exits 0 before recomputing/comparing output when local binary artifacts are missing.
- **Why:** Codegen leaves are coupled to consumer modules and one supposedly green check provides no drift assurance on an ordinary checkout missing render artifacts.
- **Fix:** Extract hand-authored leaf contracts to `weapon-types.ts`, `dimension-types.ts`, `enemy-types.ts`, and `weapon-vfx-types.ts`; make generators import only those leaves and emit data with `as const satisfies Readonly<Record<...>>`; split VFX TypeScript generation/comparison from binary copying so `--check` always compares text, and make missing required artifacts a separate explicit failure or separately named skipped check rather than exit-0 success.

### P2.4 — `constants.ts` is a 455-export dumping ground with confirmed dead tuning knobs

- **Evidence:** `packages/shared/src/constants.ts:13-103` mixes schema, ultimate, tick, and Drive laws; `packages/shared/src/constants.ts:199-257` adds client camera and beam presentation; `packages/shared/src/constants.ts:380-640` mixes session, survival, movement, weapons, and projectiles; and `packages/shared/src/constants.ts:729-961` contains boss/parry/combo tuning. A whole-repository source reference scan found no use outside the declaration for `CAM_LOOKAHEAD` (line 210), `BEAM_DEFAULT_WIDTH` (240), `BEAM_DEFAULT_RANGE` (242), `BEAM_EARLY_CANCEL_HEAT` (249), `BEAM_RELEASE_VISUAL_SECONDS` (257), `RESPAWN_SECONDS` (393), `SLIDE_IFRAME_SECONDS` (580), `SLIDE_ATTACK_CANCEL_TICKS` (581), `SLIDE_PARRY_LOCK_TICKS` (583), `PROJECTILE_SPEED` (629), `PROJECTILE_DAMAGE` (630), `WORM_LOCAL_PROJECTILE_CAP` (775), `WORM_CORE_XP_MIN` (778), or `PARRY_RIPOSTE_DMG` (834).
- **Why:** Unrelated ownership and dead exports make it impossible to tell which laws are live, and every constants import creates a broad change/review blast radius.
- **Fix:** Delete the 14 confirmed unreferenced constants first, then move coherent groups without changing values into leaf modules (`wire-constants`, `drive-constants`, `movement-constants`, `map-constants`, `boss-constants`, `combat-constants`) and let `constants.ts` temporarily re-export them as a compatibility facade while call sites migrate.

### P2.5 — The packed tail is now four domains under the misleading name `DualWieldState`, while obsolete wire tombstones remain

- **Evidence:** `packages/shared/src/state.ts:61-75` puts dual-wield, wardrobe strings, Drive resource, and prestige in one `DualWieldState`; `packages/shared/src/state.ts:118-120` retains `flexTimerLegacy`, `packages/shared/src/state.ts:603-605` retains `elapsedLegacy`, and `packages/shared/src/state.ts:631-647` retains the replaced `bossSlamX/Y/T` triple explicitly at zero forever.
- **Why:** New unrelated features are being appended to a semantic junk drawer while five retired fields remain serialized, leaving the wire harder to reason about and `PlayerState` unnecessarily pinned at its ceiling.
- **Fix:** Do this only in a deliberately incompatible schema epoch after draining old rooms: replace the final direct field with one `PlayerTailState` containing named `dualWield`, `gear`, `resource`, and `progression` subrows, remove the five tombstones and the remaining slam-zero write, bump `SCHEMA_VERSION`, and rebaseline the complete layout manifest from P1.3; do not delete/reorder these fields during a rolling mixed-version deployment.

### P2.6 — Gear modifier composition discards the compiler with string bags and double assertions

- **Evidence:** `packages/shared/src/gear.ts:32-47` defines a precise `RuntimeMods`, but `packages/shared/src/gear.ts:306-325` composes through `Record<string, number | boolean>`, and `packages/shared/src/gear.ts:327-330` plus `packages/shared/src/gear.ts:382-395` cast that bag back with `as unknown as RuntimeMods`.
- **Why:** Adding or renaming a modifier can compile even when its default, numeric/boolean treatment, or composition rule is missing, yielding a malformed object falsely typed as complete.
- **Fix:** Introduce `type MutableRuntimeMods = { -readonly [K in keyof RuntimeMods]: RuntimeMods[K] }`, type `composeMods` against it, constrain `multiplicativeKeys` with `satisfies readonly (keyof MutableRuntimeMods)[]` plus a numeric-key helper, construct from the already complete `DEFAULT_RUNTIME_MODS`, and return `Object.freeze(mods)` directly with no double assertion.

## P3

### P3.1 — Scalar geometry and weapon power math have parallel implementations

- **Evidence:** canonical `clamp` exists at `packages/shared/src/math.ts:7-13`, but `packages/shared/src/weapon-resource.ts:83-85` redefines it with reversed argument order; point-to-segment projection is repeated at `packages/shared/src/collision.ts:16-26`, `packages/shared/src/mapgen.ts:811-827`, and `packages/shared/src/melee.ts:1546-1563`; the same quake/chain/scatter weights are independently encoded in `packages/shared/src/weapons.ts:372-395` and `packages/shared/src/weapon-resource.ts:108-117`.
- **Why:** A future boundary rule or weapon mechanic can be fixed in one copy while collision, pairing, map clearance, or Drive pricing silently keeps another formula.
- **Fix:** Reuse `math.ts`'s `clamp`, export one allocation-free `pointSegmentDist2` from a leaf geometry module and call it from all three sites, and extract the overlapping authored damage-budget calculation to `weapon-math.ts` with explicit options for pair versus resource-only factors; pin current numeric outputs before replacing the copies.

### P3.2 — Compatibility-only exports and dissolved-system metadata have no production consumer

- **Evidence:** `packages/shared/src/constants.ts:501-502` keeps the old single-gravity alias and only `tests/movement.test.ts` imports it; `packages/shared/src/melee.ts:17-20` marks `meleeSwingActive` deprecated and only `tests/melee.test.ts` calls it; repository source search found no consumer for `quakeImpactDelaySec` (`constants.ts:808-812`), `swingEdgeActive` (`melee.ts:1537-1539`), the empty `GEAR_CLASS_BONUSES` table (`gear.ts:261-268`), `BOILERPLATE_SPRITE_ID` (`characters.ts:49-51`), or `telegraphDanger` (`boss-primitives.ts:807-810`). `packages/shared/src/character-classes.ts:76-121` also retains the dissolved class-lineage table, and its resolver at lines 436-439 has no product caller; only a progression test checks the table.
- **Why:** These exports preserve obsolete concepts and tests as if they were live contracts, increasing the public surface and obscuring which replacement systems are authoritative.
- **Fix:** Update the two legacy tests to the current three-zone gravity and `SwingDescriptor` APIs, then delete `GRAVITY`, `meleeSwingActive`, `quakeImpactDelaySec`, `swingEdgeActive`, `GEAR_CLASS_BONUSES`, `BOILERPLATE_SPRITE_ID`, and `telegraphDanger`; delete `CharacterLineage`, `CHARACTER_LINEAGE`, `lineageForCharacter`, and their table-only assertion unless a named migration/UI consumer is added now.

### P3.3 — Pet ownership is hidden behind the unrelated meta module

- **Evidence:** `packages/shared/src/meta.ts:59-60` re-exports `pets.ts` solely to keep an older index stable, then imports the same module again at `packages/shared/src/meta.ts:72-78`; `packages/shared/src/index.ts:20-25` exports `meta.ts` but never exports `pets.ts` directly.
- **Why:** Consumers discover pet APIs through meta-progression by accident, and the public module graph claims ownership that the file organization does not reflect.
- **Fix:** Add `export * from "./pets.js"` directly to `index.ts` (and a `/pets` package subpath under P2.1), migrate imports, then remove the compatibility re-export from `meta.ts` while retaining its ordinary pet imports for account composition.

## Executive summary

- No P0 issue or runtime ESM cycle was found, and the shared package typechecks.
- The highest correctness risks are prototype-name registry lookups and `PlayerState` methods that decoded rows do not possess.
- `PlayerState` is exactly at 64 fields, but current tests do not pin the complete wire layout.
- Purity/codegen boundaries need narrower modules: belt prediction is ungated, entropy shares `rng.ts`, generated enemy data is mutated, and VFX checking can false-green.
- The next cleanup should prune five schema tombstones, 14 dead constants, dissolved-lineage metadata, and the listed compatibility-only exports.
