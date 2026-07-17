# Server + shared structure audit (reviewer 1/5)

Scope: server and shared structure only. I read `GameRoom.ts`, `BossController.ts`, and `progression.ts` end to end; inspected every named shared module, the relevant generators, server/shared tests, and recent history. Client source was deliberately excluded. Line counts are physical lines at schema 19; method/property counts come from a TypeScript AST walk. Effort is **S** (hours), **M** (roughly 1–3 days), or **L** (multi-day/sequenced work). Every proposal below is a move/dependency-inversion refactor, not a behavior change.

## Verdict

`GameRoom` is the repository's dominant structural and merge-latency bottleneck: **7,622 lines, 157 callable class members, and 69 class fields** beginning at `packages/server/src/rooms/GameRoom.ts:541`. It currently owns at least **17 distinct responsibilities**. That concentration is already producing concrete wave collisions, not merely theoretical maintainability debt: the combo, integrity, worm, beam, XP, attack-beat, privacy, and safety waves all edited the same room, its one test file, and usually `constants.ts`/`state.ts`.

The good news is that most of the newest systems were written with strong local cohesion and focused tests. Receipts, beams, the authored combo machine, and boss wiring are extraction-ready. The safest strategy is not a rewrite: introduce narrow world ports, move unchanged code into subsystem owners, leave `GameRoom` as the Colyseus lifecycle/composition root, and use the existing golden tick plus focused wave tests as equivalence gates.

The shared package has no literal import of server or client modules, but it is not cleanly layered. It contains Colyseus wire classes, server-private runtime fields, client-only presentation tuning, authoritative simulation math, large authored catalogs, and generated catalogs behind one root barrel. `constants.ts` and `state.ts` are active shared edit hot spots. The weapon-expansion generator now has a good strict source-of-truth contract; the dimension and weapon-VFX pipelines do not yet meet the same standard.

## Measured ownership map

| File | Size/shape | Responsibilities visible in the file |
|---|---:|---|
| `GameRoom.ts` | 7,622 lines; 157 methods; 69 fields | 17 subsystems listed below |
| `GameRoom.test.ts` | 3,337 lines; 40 `describe` blocks; 140 tests | one harness plus every room subsystem from join/leave through schema-19 combos |
| `BossController.ts` | 2,191 lines; 5 classes; 100 methods across those classes | generic bosses, live hazards, worm topology/motion/damage, worm action scheduler, encounter director |
| `BossController.test.ts` | 614 lines; 10 suites; 23 tests | generic phases/hazards/determinism and Serraketh chain laws |
| `progression.ts` | 61 lines; 3 exported operations | already a successful small extraction, though typed directly to the wire schema |
| `constants.ts` | 747 lines; 310 exported declarations | protocol, movement, client presentation, map, XP, economy, combat, boss, worm, combo tuning |
| `state.ts` | 482 lines; 13 schema classes | wire DTOs plus several undecorated server runtime fields |
| `weapons.ts` / generated expansion | 1,324 / 12,955 lines | types, math, base catalog, generated catalog, assembled registries |
| `melee.ts` / `enemies.ts` / `mapgen.ts` | 1,570 / 1,251 / 1,454 lines | respectively presentation+geometry, data+combo grammar+AI, generation+queries+validation |

The 17 `GameRoom` responsibilities are:

1. Colyseus/schema bootstrap and simulation scheduling (`GameRoom.ts:759-1319`).
2. Message registration, payload validation, rate budgets, and dev/host policy (`GameRoom.ts:751-1311`).
3. Join/leave/host ownership (`GameRoom.ts:2051-2183`).
4. Training, gallery, restart, terminal cleanup, and mode transitions (`GameRoom.ts:1325-1385`, `GameRoom.ts:1686-1912`).
5. Input queues, fixed-step orchestration, movement, reconciliation, and vertical motion (`GameRoom.ts:319-346`, `GameRoom.ts:2274-2934`).
6. Spatial grids, player/enemy collision, POIs, belt bounds, and pits (`GameRoom.ts:1916-2049`, `GameRoom.ts:2403-2495`, `GameRoom.ts:2752-2823`).
7. Arsenal slots, bag, shop, weapon-resource persistence, and meta upgrades (`GameRoom.ts:921-1206`, `GameRoom.ts:1391-1672`).
8. Melee, guns, casts, throws, quakes, and combat resources (`GameRoom.ts:2937-3145`, `GameRoom.ts:3739-3916`, `GameRoom.ts:4869-5196`).
9. Beam channel authority (`GameRoom.ts:3151-3737`).
10. Damage, crit, parry, brands/burns, death, receipts, and final-blow attribution (`GameRoom.ts:2192-2238`, `GameRoom.ts:5202-5316`, `GameRoom.ts:5391-5597`, `GameRoom.ts:6593-6712`).
11. Generic, spitter, zoner, legacy-duelist, and authored-combo enemy AI (`GameRoom.ts:2696-2749`, `GameRoom.ts:4821-4867`, `GameRoom.ts:5625-6566`, `GameRoom.ts:7062-7086`).
12. Projectiles and persistent zones (`GameRoom.ts:6780-7114`).
13. XP Echoes, level windows, attribute allocation, augments, and signature offers (`GameRoom.ts:3919-4465`).
14. Loot rolls, mystery identity, pickups, salvage, and provenance (`GameRoom.ts:5354-5387`, `GameRoom.ts:660-673`, `GameRoom.ts:6716-6777`).
15. Generic boss/worm stepping, telegraphs, effects, adds, and the room-side boss adapter (`GameRoom.ts:4471-4818`).
16. Dimension, shifter, belt-room, boss-rush, spawn, extraction, and descent directors (`GameRoom.ts:701-734`, `GameRoom.ts:7119-7621`).
17. Synced timer projection and attack-beat publication (`GameRoom.ts:2242-2257`, `GameRoom.ts:2937-2941`).

## Observed wave contention

Recent history makes the priority concrete. Insertions/deletions below are for the main hot files only.

| Wave | Repeated shared edit surfaces |
|---|---|
| `271140d` tough combos | `GameRoom.ts` +986/−54; `GameRoom.test.ts` +287/−1; `constants.ts` +51/−1; `state.ts` +13 |
| `b17c168` integrity | `GameRoom.ts` +652/−68; `GameRoom.test.ts` +125; `BossController.ts` +360/−3; `state.ts` +30; `progression.ts` +8/−1 |
| `b5c887a` worm boss | `BossController.ts` +1,388/−1; `GameRoom.ts` +452/−20; `GameRoom.test.ts` +71; `constants.ts` +27/−1; `state.ts` +47 |
| `c170e8f` beams | `GameRoom.ts` +683/−5; `GameRoom.test.ts` +152; `constants.ts` +23/−1; `state.ts` +27; generated weapons +476/−274 |
| `8500fb9` XP Echoes | `GameRoom.ts` +516/−53; `GameRoom.test.ts` +132; `constants.ts` +42/−1; `state.ts` +21 |
| `6919ad8` attack beat | `GameRoom.ts` +20; `GameRoom.test.ts` +133; `constants.ts` +6/−1; `state.ts` +8 |
| `785ec3d` privacy/churn | `GameRoom.ts` +98/−17; `GameRoom.test.ts` +60; `state.ts` +27/−8 |
| `6f5641f` strict weapon codegen | generated weapons +615/−360 after the “11 lost kits / 200+ fields” recovery |

This is why the top items are P0 even where runtime behavior is currently correct: they are actively forcing independent waves through the same merge regions and making omissions during integration more likely.

## Extraction-readiness summary

| Subsystem requested by panel | Readiness | Mechanical seam | Main equivalence gate |
|---|---|---|---|
| Input/validation | **High** | all registrations are inside `onCreate`; `takeAction`, host, dev, mode, payload, and proximity checks can become explicit handler policies without moving domain logic | hostile input, seq/ack, safety, production-gate, and arsenal handler suites (`GameRoom.test.ts:591`, `:931`, `:2055`, `:1591`) |
| Receipts | **Very high** | fixed rows + cursor + sequence and a single writer (`GameRoom.ts:695-697`, `:759-768`, `:2204-2238`) | ownership/final-blow regression (`GameRoom.test.ts:2221`) plus beam/worm damage suites |
| Boss wiring | **High** | `BossEmitSink` is already a complete port (`BossController.ts:75-138`); the room adapter is contiguous (`GameRoom.ts:4520-4609`) | `BossController.test.ts:111-613`, room boss/belt/worm suites |
| Beam channels | **High** | cohesive state and a nearly contiguous method island (`GameRoom.ts:3151-3737`) | beam authority suite (`GameRoom.test.ts:2888-2995`) and golden tick |
| New combo AI | **High** | one private state record plus a contiguous authored machine (`GameRoom.ts:456-518`, `:5874-6566`) | combo suite (`GameRoom.test.ts:3116-3332`) and parry commitment suite |
| Arsenal/loot | **Medium** | operations are cohesive but handlers, slot runtime, pickup secrecy, economy, and damage/drop callbacks are separated in the room | loot, arsenal, economy, privacy, integrity suites (`GameRoom.test.ts:1306`, `:1591`, `:2141`, `:2418`) |
| Combat stepping | **Medium-high** | `stepSim` already documents a numbered phase contract and delegates many phase bodies; move orchestration unchanged into a `SimPipeline` after subsystem ports exist | fixed-step catch-up (`GameRoom.test.ts:1030`) and golden digest (`GameRoom.test.ts:1491-1588`) |

## Ranked findings

### P0 — active merge/omission risk

#### P0.1 — `GameRoom` is the common write target for nearly every server feature

**Evidence.** The class owns 69 fields across grids, beam scratch, input/combat state, boss state, projectile metadata, combo state, status maps, counters, and run directors (`packages/server/src/rooms/GameRoom.ts:541-734`), followed by 157 methods through line 7,621. The subsystem map above identifies 17 responsibilities.

**Why it hurts.** Combo, integrity, worm, beam, XP, attack-beat, privacy, safety, grid, terminal, parry, arsenal, and boss waves all modified this class. Even a well-contained feature typically has to add a field, handler, reset, step call, damage hook, and test in the same physical files. Agents cannot integrate independent server waves without rebasing over the same class regions.

**Refactor — L.** Make `GameRoom` the composition root only. Introduce a small `RoomWorld`/`SimContext` of stable ports (state, grids, clock/tick, RNG, entity mutation, damage, telegraph publication), then lift unchanged method islands into `InputRouter`, `BeamSystem`, `EnemyComboController`, `ArsenalService`, `CombatReceiptRing`, `BossWorldAdapter`, `XpEchoSystem`, and eventually `SimPipeline`. Do one subsystem per change; retain delegating wrappers until callers are migrated.

**Safety.** Require the entire existing suite plus a byte/field digest of the golden tick (`packages/server/src/rooms/GameRoom.test.ts:1491-1588`) after every move. The real transport integration test (`packages/server/src/integration.test.ts:90-171`) pins Colyseus behavior. No extraction should alter phase order, iteration order, RNG calls, schema writes, or IDs.

#### P0.2 — message admission and validation are embedded in a 561-line bootstrap method

**Evidence.** `onCreate` spans `GameRoom.ts:759-1319`. Input parsing starts at `:804`, attacks at `:853`, arsenal/economy handlers at `:921-1206`, and dev/host/progression handlers at `:1225-1311`. Admission is expressed as hand-written early returns: for example `takeAction` is applied at `:858`, `:897`, `:986`, and `:998`, while bag/shop handlers begin at `:1015`, `:1033`, `:1058`, and `:1084` with their own different guard paths.

**Why it hurts.** The safety wave (`7859d44`) and integrity wave (`b17c168`) had to edit the same registration block as arsenal, attack, beam-input, level-up, and boss tooling. Because policy is implicit in callback bodies, reviewers must reread hundreds of lines to determine whether a new message is budgeted, production-gated, host-gated, mode-gated, payload-normalized, and proximity-checked. That is an omission surface even if every current difference is intentional.

**Refactor — M.** Extract `registerInputHandlers(room, deps)` and domain registrars (`registerCombatHandlers`, `registerArsenalHandlers`, `registerRunHandlers`). Define a declarative policy wrapper for action budget/dev/host/mode, but first encode the **current** per-message guard matrix exactly; do not normalize behavior during the move. Payload validators should return typed values and domain methods should receive already-admitted commands.

**Safety.** Pin the current matrix with the hostile-input suite (`GameRoom.test.ts:591-630`), seq/ack/flood/wrap suite (`:931-1047`), production and budget gates (`:2055-2138`), and arsenal/shop cases (`:1591-1745`, `:1850-1904`). Add a table-driven test that records whether each message reaches a spy under current host/dev/mode/budget combinations before moving registrations.

#### P0.3 — the fixed-step phase contract is mixed with phase implementation

**Evidence.** `stepSim` is 643 lines (`GameRoom.ts:2292-2934`). It consumes input and rebuilds broad phase (`:2292-2348`), integrates players/collision/pits (`:2349-2495`), steps XP/directors (`:2497-2546`), handles combat resources/actions/beams (`:2548-2663`), melee/quakes (`:2670-2694`), AI/boss/projectiles/zones/collision (`:2696-2823`), then contact/death/status/progression (`:2825-2934`). The comment immediately above it explicitly calls the numbered order a contract (`:2291`).

**Why it hurts.** Nearly every gameplay wave inserts into this same method, so a textual conflict can accidentally become a phase reorder. The beam, XP, worm, combo, terminal, grid, and attack-beat waves all needed a place in this pipeline. Reviewers cannot distinguish an orchestration change from a subsystem implementation change in a large diff.

**Refactor — M.** Extract a `SimPipeline.step(ctx, dt)` whose body remains the same numbered calls in the same order. First turn each inline block into a private phase function without moving ownership; then transfer the orchestrator. Make phase dependencies explicit in `SimContext` and keep iteration/RNG inside the old functions. This is mechanical once low-level subsystem ports exist.

**Safety.** The fixed-step 150 ms catch-up test (`GameRoom.test.ts:1030-1047`) and golden tick digest (`:1491-1588`) are direct phase-order locks. Add a phase-spy test asserting the exact call sequence, including terminal early exit and the single post-batch patch behavior in `GameRoom.update` (`GameRoom.ts:2274-2289`).

#### P0.4 — transient cleanup is a manual cross-system registry

**Evidence.** The comment says adding a new `Map` forces this method to be touched (`GameRoom.ts:1321-1324`). `clearTransients` then clears input/combat, projectiles, zones, pickups, XP, beams, telegraphs, boss state, combo tokens, status maps, quakes, grids, and director state in one block (`:1325-1359`), with related clear helpers immediately after (`:1361-1385`).

**Why it hurts.** Every subsystem wave must remember the reset nexus. Terminal cleanup (`2f2eeba`), integrity, XP, beams, worm, and combos all added or changed transient ownership. A missed map can survive wipe/restart/training transitions; a merge resolving two new clears can silently drop one.

**Refactor — M.** Give every extracted subsystem an idempotent `reset(reason)` and register reset participants once in room construction. `clearTransients` becomes a stable ordered loop plus schema collection cleanup. Preserve the current order initially, especially boss/telegraph disposal and grid teardown.

**Safety.** The terminal quiescence/restart test (`GameRoom.test.ts:2269-2369`), training transition tests (`:1273-1304`), run-chain wipe/descent tests (`:1122-1304`), and worm/beam/combo suites pin cleanup. Add a reset invariant that all private subsystem sizes and all transient schema collections are zero after each reset reason.

#### P0.5 — accepted damage is also the kill, reward, receipt, AI, and run-progression transaction

**Evidence.** `damageEnemy` performs damage/crit math, brand amplification, receipt emission, combo interruption, dummy reset, boss handling, XP creation, loot, shifter cleanup, boss-rush advancement, and portal opening (`GameRoom.ts:5202-5316`). Worm damage separately writes receipts and rewards through `damageWormSlots` (`:5127-5196`). The receipt writer is at `:2204-2238`.

**Why it hurts.** Beams, melee, projectiles, worm anatomy, XP Echoes, loot secrecy, receipts, combos, and boss progression all converge here. The integrity wave and each of the beam/worm/XP/combo waves needed to reason about this transaction. Adding one reward or attribution concern can change ordering for all delivery paths.

**Refactor — L.** Extract a `DamageResolver` with an explicit `DamageRequest` and ordered `DamageResult`/domain-event list. Initially copy the current statements and callbacks exactly: compute accepted damage, write receipt, mutate target, then dispatch the same death consequences in the same sequence. Use a narrow world port for target lookup, XP, loot, boss/run transitions, and combo notification. Unify ordinary and worm entry points only after both are independently moved and equivalence-tested.

**Safety.** The “one damage primitive” suite (`GameRoom.test.ts:434-520`), receipt attribution regression (`:2221-2265`), XP Echo suite (`:2569-2698`), beam suite (`:2888-2995`), worm integration (`:2997-3113`), combo suite (`:3116-3332`), crit tests (`:1748-1784`), and boss-rush tests (`:522-588`) pin ordering and consequences.

#### P0.6 — `constants.ts` is a 310-export cross-domain merge queue

**Evidence.** Schema/tick protocol begins at `packages/shared/src/constants.ts:8`; movement follows at `:20`; explicitly client-only jiggle and camera/interpolation tuning occupies `:47-174`; map/world begins at `:176`; XP occupies `:309-348`; arsenal/economy/receipts starts at `:349`; boss/worm is at `:520-564`; parry/combat continues through `:608-697`; the newest combo laws are appended at `:699-747`.

**Why it hurts.** Combo, worm, beam, XP, attack-beat, privacy, safety, map, movement, and client-presentation waves all edit this file. The recent combo/worm/beam/XP waves alone added 51, 27, 23, and 42 lines respectively. Unrelated agents collide at imports and append boundaries, and semantic ownership is obscured (“shared” is being used to mean protocol, server law, and client presentation at once).

**Refactor — M.** Split into `protocol/schema-version.ts`, `protocol/input.ts`, `movement/tuning.ts`, `presentation/{camera,jiggle,interpolation}.ts`, `world/tuning.ts`, `combat/{beam,parry,receipts,combo}.ts`, `progression/xp-echo.ts`, `economy/tuning.ts`, and `boss/{generic,worm}-tuning.ts`. Keep `constants.ts` as a compatibility re-export for one migration cycle, then convert consumers to direct domain imports.

**Safety.** This should be symbol moves only. `pnpm typecheck`, the complete tests, and a temporary test comparing the old barrel's exported key/value set to the new modules pin identity. Constants that are arrays/objects must remain the same singleton and declaration order where consumers derive ordered registries.

#### P0.7 — `state.ts` combines an append-only protocol ledger with server-private runtime

**Evidence.** `ArsenalSlot` contains undecorated server-only resource/cooldown fields (`packages/shared/src/state.ts:14-20`); `PlayerState.flexTimer` is server-only (`:65-69`); `ArenaState.elapsed` is server-only (`:415-418`). In the same file, field-order compatibility is explicitly load-bearing (`:108-110`, `:394-398`), and new top-level collections are appended in sequence—XP, beams, worm, receipts—at `:474-482`.

**Why it hurts.** Schema additions from combo, integrity, worm, beam, attack-beat, XP, and privacy all collided here. Because Colyseus serializes class fields by order, ordinary file reorganization has protocol consequences. Server-private sidecars inside shared wire classes also make it impossible to treat `state.ts` as a pure network contract or to reuse/test server runtime independently.

**Refactor — M/L.** First add a schema-layout fingerprint test. Then split schema classes into `state/player.ts`, `enemy.ts`, `combat.ts`, `boss.ts`, and `arena.ts`, preserving the exact declaration order inside every class and keeping `state.ts` as re-exports. Move undecorated runtime data into server-owned sidecars keyed by player/slot/room only in a later change. Keep `ArenaState` composition and append-only ordering in one clearly owned protocol file.

**Safety.** The real transport test (`packages/server/src/integration.test.ts:90-171`) and schema-19 combo assertion (`GameRoom.test.ts:3308-3332`) provide current coverage, but they are not enough for a file move. Add a golden fingerprint of every schema class's decorated field name, index, wire type, and nesting before extraction; require identical encoded initial state and one representative patch before/after.

#### P0.8 — `GameRoom.test.ts` reproduces the production contention pattern

**Evidence.** One 3,337-line file holds a shared private-member harness (`packages/server/src/rooms/GameRoom.test.ts:49-97`), 40 suites, and 140 tests. Recent features append large islands: XP at `:2569`, attack beat at `:2701`, beams at `:2888`, worm integration at `:2997`, and combos at `:3116`.

**Why it hurts.** Every server wave touches the same test import/harness region and appends near the same tail. The combo, integrity, beam, XP, attack-beat, and worm commits all changed this file. A test-only conflict delays integration even when production extractions have separated cleanly; the monolith also encourages `AnyRoom = any` access to private internals (`:72-96`) rather than subsystem contracts.

**Refactor — S.** Move the current harness unchanged to `rooms/testing/GameRoomHarness.ts`; split suites by authority boundary: `GameRoom.input.test.ts`, `.run.test.ts`, `.combat.test.ts`, `.loot-arsenal.test.ts`, `.boss.test.ts`, `.xp.test.ts`, `.beam.test.ts`, and `.combo.test.ts`. Keep the golden tick in a dedicated `.golden.test.ts`. Do not rewrite assertions during the move.

**Safety.** Test count, names, hooks, seeds, and pass/fail output must be identical before/after. Run the pre-split and post-split file sets with the same Vitest seed and compare the 140 discovered test names. This is the lowest-risk first extraction and immediately gives future waves separate files.

### P1 — high-value structural boundaries

#### P1.1 — beam channels are cohesive but their ownership is scattered around the room

**Evidence.** Beam runtime fields live in `CombatState` (`GameRoom.ts:426-447`) and room scratch arrays (`:553-562`), while beam operations form a contiguous island from held-input/resource bookkeeping through clipping, sweep damage, and receipt flush (`:3151-3737`). Reset, weapon transitions, and the phase-4 call remain elsewhere.

**Why it hurts.** The beam wave put 683 lines into `GameRoom`, then subsequent integrity/combo work had to navigate that region and its shared damage/receipt state. The code is already internally coherent; leaving it in the room only preserves contention.

**Refactor — M.** Move unchanged code into `BeamSystem` with a typed `BeamRuntime` and `BeamWorldPort`: player/input lookup, schema beam row access, POI clipping, grid candidate query, accepted damage, receipt write, and attack-beat notification. Give it `stepPlayer`, `onWeaponTransition`, and `reset`. Preserve the one swept query and current scratch buffers as owned fields.

**Safety.** The authority suite at `GameRoom.test.ts:2888-2995` pins charge gate, actual-dt DPS, one query per tick, overheat/restart, held-input semantics, and action-budget independence. Add a direct `BeamSystem` port-spy test, then retain the room integration and golden tick.

#### P1.2 — authored combo AI is an extraction-ready state machine behind an implicit room port

**Evidence.** `DuelistComboState` is a dedicated state record (`GameRoom.ts:456-518`), room ownership is concentrated in `comboState`/`duelTokens` (`:616-624`), and the authored machine is contiguous from selection/commit through return, landing, air-keep, movement, and resolution (`:5874-6566`), with parry integration at `:6593-6712`.

**Why it hurts.** The combo wave alone changed `GameRoom` by +986/−54 and its test by +287/−1. Future combo grammar work will keep colliding with generic AI, parry, damage, and unrelated room additions unless the current seam becomes a file boundary.

**Refactor — L.** Extract `EnemyComboController` owning combo state and duel/aerial tokens. Define `ComboWorldPort` for enemy/player lookup, stable target selection, safe landing, telegraph upsert/remove, damage/parry notification, movement/grid update, and tick/RNG. Move only the authored machine first; keep legacy duelists delegated from `GameRoom` until the new controller is stable.

**Safety.** The seven schema-19 combo tests (`GameRoom.test.ts:3116-3332`) pin leap negotiation, lock geometry, parry-bait return, juggle limits, mercy, token serialization, and authored literals. The melee commitment test (`:2514-2566`), parry chains (`:296-373`), and golden tick cover shared edges.

#### P1.3 — arsenal, loot, pickup secrecy, and economy form a domain but not an owner

**Evidence.** Message handlers occupy `GameRoom.ts:921-1206`; slot save/restore/transition and grab operations are at `:1391-1672`; private pickup identity/provenance is stored at `:660-673`; loot drop creation is at `:5354-5387`; pickup/drop/grab consequences recur at `:6716-6777` and in damage/death paths.

**Why it hurts.** Arsenal, shop, loot spine, privacy, integrity, beams (stowed resource state), XP/death, and meta waves all cross the same methods. The domain is especially omission-prone because a weapon transition must preserve public slot identity, hidden mystery identity, cooldown/ammo/beam debt, provenance, bag capacity, and schema mirrors.

**Refactor — L in two M steps.** First extract `ArsenalService` owning slot/bag runtime and weapon transitions, with explicit `saveActive`, `equipSlot`, `store`, `sell`, `drop`, and `reset` operations. Then extract `LootService` owning roll/drop/pickup hidden identity and provenance, calling the arsenal through a port. Handler registrars delegate to these services; damage resolver requests a loot event rather than implementing it.

**Safety.** Use loot spine (`GameRoom.test.ts:1306-1489`), arsenal/shop (`:1591-1745`), meta (`:1850-1904`), integrity (`:2141-2265`), privacy (`:2418-2476`), and beam resource tests. Shared loot laws are separately pinned at `tests/loot.test.ts:29-166`.

#### P1.4 — receipts should be a ring object, not room counters plus a writer

**Evidence.** Receipt cursor/sequence are room fields (`GameRoom.ts:695-697`), fixed rows are allocated during bootstrap (`:759-768`), and all mutation is concentrated in `writeCombatReceipt` (`:2204-2238`). Call sites are ordinary and worm accepted-damage paths (`:5162-5174`, `:5230-5242`).

**Why it hurts.** Receipt work is structurally simple but currently forces receipt-related changes into bootstrap, fields, damage, worm, and tests. The integrity wave added the ring while beam/worm/combo waves all need attribution. It is a cheap extraction that removes one recurring cross-cut.

**Refactor — S.** Introduce `CombatReceiptRing(rows, capacity)` owning initialization, cursor, sequence, and `write`. Pass primitive fields or a typed receipt command; preserve row overwrite order and all scalar assignments. `GameRoom` exposes it to damage ports and calls `reset` only if current behavior does so.

**Safety.** The ownership/final-blow regression at `GameRoom.test.ts:2221-2265` is the primary pin. Add unit tests for 32-slot wrap, sequence rollover, zero-direction normalization, crit/final flags, and identical row initialization, then keep beam and worm integrations.

#### P1.5 — the room-side boss adapter already has an explicit interface but remains embedded

**Evidence.** `BossEmitSink` specifies telegraphs, projectile budgets, zones, adds, AoE/melee damage, teleport/move, and target queries (`packages/server/src/rooms/BossController.ts:75-138`). `GameRoom` implements that port as one object factory (`GameRoom.ts:4520-4609`) plus nearby telegraph/effect/damage helpers (`:4612-4818`).

**Why it hurts.** Generic boss, belt boss, worm, footfall quake, integrity, and telegraph-settlement waves edit both controller and room. The existing interface is a strong seam that is not being used as a source-file boundary.

**Refactor — M.** Move the implementation to `boss/GameRoomBossWorld.ts` implementing `BossEmitSink`, with dependencies on state, entity mutation, damage, grid/belt placement, and counters. `GameRoom.stepBoss` supplies tick/depth/RNG and calls the controller. Keep the helper call order and budget checks unchanged.

**Safety.** `BossController.test.ts:111-613` pins phase selection, windup/resolve/cancel, budgets, hazards, determinism, settled rows, and worm chain laws. Room integration suites at `GameRoom.test.ts:170-202`, `:1906-2020`, and `:2997-3113` pin world placement and damage.

#### P1.6 — `BossController.ts` became a second god object during the worm wave

**Evidence.** The file contains `WormPathHistory` (`BossController.ts:203-266`), a 1,149-line `WormBossRuntime` with 62 methods and 52 fields (`:269-1417`), `SegmentedBossActionScheduler` (`:1433-1634`), `WormEncounterDirector` (`:1637-1789`), and the generic `BossController` (`:1791-2191`). Plan emission is also implemented twice: worm scheduler `applyPlan` at `:1596-1614` and generic `applyPayload` at `:2149-2190`.

**Why it hurts.** The worm wave added 1,388 lines here; the immediately following integrity wave edited another 360. Worm topology/motion/damage, worm encounter choreography, and generic boss hazards now share one review and merge surface. The two emission paths can drift on budgets or effect ordering.

**Refactor — M.** Split the existing classes without redesign: `boss/worm/WormPathHistory.ts`, `WormBossRuntime.ts`, `WormActionScheduler.ts`, `WormEncounterDirector.ts`, and `boss/BossController.ts`. Extract one ordered `applyBossEmits(plan, policy, sink)` helper used by both paths, with policy flags preserving their current allowed emission subsets and scaling. Keep `BossEmitSink`/shared runtime types in a small `boss/ports.ts`.

**Safety.** Preserve all `BossController.test.ts` suites and add direct snapshot tests for the two current emission paths before deduplication. Worm spacing/split/regrow/contact laws are at `:526-613`; generic hazard and deterministic ordering tests are at `:111-457`.

#### P1.7 — the shared root barrel couples unrelated module loading and hides layer direction

**Evidence.** `packages/shared/src/index.ts:1-22` re-exports every module, while `packages/shared/package.json:8-11` exposes only the root entry. `GameRoom` consequently has a single import spanning `GameRoom.ts:1-294`. Shared has no import path containing `packages/server` or `packages/client`; its only external runtime dependency is `@colyseus/schema` (`packages/shared/package.json:19-20`).

**Why it hurts.** In ESM, importing the root re-export graph evaluates large authored registries and their derived top-level values even when a consumer needs only a few protocol or math symbols. For example `loot.ts` builds class medians and `DROP_POOL` from the full weapon registry at import time (`packages/shared/src/loot.ts:247-298`). The barrel also makes architectural reviews unable to see whether server code depends on protocol, presentation, catalog, or pure simulation.

**Refactor — M.** Add package subpath exports such as `@dd/shared/protocol`, `/combat`, `/movement`, `/world`, `/catalog/weapons`, `/catalog/enemies`, and `/boss`. Convert server imports to those entry points. Keep the root entry for compatibility, then measure startup/typecheck graph before considering removal. Separate pure loot functions from the catalog-bound precomputed drop registry so importing loot math does not necessarily assemble all weapons.

**Safety.** Typecheck and all tests pin public symbols. Add an import-smoke test for every subpath and a module-evaluation probe proving protocol/movement imports do not initialize weapon/enemy catalogs. Preserve object identity and registry iteration order.

#### P1.8 — `weapons.ts` is both the generated type source and generated consumer

**Evidence.** `weapons.ts` imports the generated expansion at `packages/shared/src/weapons.ts:15`; it defines the 280-line `WeaponDef` family at `:19-298`, math/display helpers at `:300-538`, the hand-authored catalog at `:540-1295`, and registry assembly at `:1297-1324`. The generator emits `import type { WeaponDef } from "./weapons.js"` (`tools/artkit/gen-weapon-expansion.mjs:343-351`), producing an erased type cycle back to its consumer.

**Why it hurts.** Any type, calculation, base-data, generated-data, or registry change shares one file. The type-only cycle works after compilation but inverts the source-of-truth layer and makes generator output dependent on the module that imports it. Beam and strict-codegen waves both touched this boundary.

**Refactor — M.** Split `weapon-types.ts`, `weapon-math.ts`, `weapons.base.ts`, `weapons-expansion.generated.ts`, and `weapon-registry.ts`; make both catalogs depend only on `weapon-types`, and make the registry the sole assembler. Keep `weapons.ts` as a compatibility facade. Do not change object contents or enumeration order.

**Safety.** `tests/weapons.test.ts:37-528` pins scaling, sources, requirements, registries, cycles, reach, expansion, and beam laws; `tests/data-consistency.test.ts:54-289` independently checks source/generated fidelity. Add an ordered `Object.keys(WEAPONS)` golden before the move.

#### P1.9 — weapon expansion has a strong validator but a high-churn single-file output

**Evidence.** The generator names one source and one output (`tools/artkit/gen-weapon-expansion.mjs:18-21`), rejects unknown keys and sibling mechanic blocks (`:47-69`, `:158-168`), rejects duplicates/errors before emitting (`:319-351`), and produces a 12,955-line file. The beam wave changed generated output by +476/−274; the strict recovery changed it by +615/−360.

**Why it hurts.** The strict contract successfully fixed the concrete “11 weapons lost their kits / 200+ fields” incident, so validation is not the problem now. The remaining problem is diff and merge amplitude: one authored family change rewrites a giant generated object, and agents cannot safely merge independently generated versions.

**Refactor — M.** Keep the current JSON source, strict validation, and `emit --check`, but emit deterministic shards by stable family/id bucket plus a tiny generated assembler. Sort shard membership explicitly and assemble in the current global insertion order. Record source hash/generator version in banners. Generated files remain never-hand-edited.

**Safety.** `tests/data-consistency.test.ts:99-289`, expansion tests at `tests/weapons.test.ts:356-379`, `pnpm gen:check`, and an exact ordered-registry digest must match. Generate twice from a clean tree and require byte-identical output.

#### P1.10 — dimension data has two sources of truth and permissive codegen

**Evidence.** The dimension generator explicitly leaves Wild West hand-authored while generating other dimensions (`tools/artkit/gen-dimensions.mjs:2-7`). Its numeric helper silently replaces invalid values with defaults (`:21`, `:52-94`), and object assignment at `:100-128` does not reject duplicate dimension/enemy ids. More importantly, `enemies.ts` says generated placeholders contradict the named roster and mutates the merged registry afterward (`packages/shared/src/enemies.ts:1007-1030`).

**Why it hurts.** The generated file is not the effective runtime truth: authored JSON, hand-authored Wild West, and post-merge mutation jointly determine behavior. The combo wave had to patch generated identities in runtime code rather than correct their source. Silent defaults/overwrites can make malformed data pass `gen:check` because the generated snapshot faithfully reproduces the fallback, not the intended design.

**Refactor — M.** Bring this generator to the weapon generator's discipline: schema/key allowlists, finite/range/enum validation, duplicate-id checks across dimensions/shifters/hand-authored reserved ids, aggregate errors, and no output on failure. Move the Marshal/Riot corrections into the JSON source and delete the runtime normalization only after generated output is identical. Either encode Wild West in the same source schema or formally reserve it as a validated base shard.

**Safety.** `tests/data-consistency.test.ts:292-341` pins roster/boss/shifter references; `tests/mapgen.test.ts:38-495` pins deterministic world generation; the room dimension and combo tests pin runtime identity. Add generator-negative fixtures for invalid numbers, unknown keys, and duplicate ids, plus an exact `ENEMY_KINDS` digest before moving corrections.

#### P1.11 — weapon-VFX `gen:check` can report success without checking generated output

**Evidence.** The root `gen:check` includes `build-weapon-vfx.mjs --check` (`package.json:21`). The tool declares assignments plus overrides as source of truth (`tools/artkit/build-weapon-vfx.mjs:18-24`), but imports a client-side layer registry for defaults (`:26-29`) and explicitly exits 0 when untracked art artifacts are unavailable (`:32-54`).

**Why it hurts.** A green aggregate generator check does not prove `weapon-vfx.generated.ts` matches assignments/overrides on a normal checkout lacking local painted/scatter artifacts. The contract is therefore environment-dependent. This is the same class of stale/generated drift that strict weapon codegen was introduced to prevent.

**Refactor — M.** Split deterministic metadata generation from asset installation. A metadata-only generator must derive and compare the committed TS snapshot from committed assignments, overrides, and a shared committed layer-default manifest without requiring pixels. A separate asset install/availability command may skip or fail according to environment, but it must not stand in for generated-code verification. Keep client source out of the generator dependency direction by moving layer schema/defaults to tooling/shared data.

**Safety.** Add a test that intentionally perturbs an in-memory generated value and proves `--check` exits nonzero with no art output directory. Existing cross-reference coverage at `tests/data-consistency.test.ts:31-97` pins assignment/override targets. A clean-checkout CI job should run the complete metadata check.

#### P1.12 — `melee.ts` mixes authoritative hit geometry with a large presentation choreography catalog

**Evidence.** Presentation-oriented combo motion/ribbon types and sequences begin at `packages/shared/src/melee.ts:31-162` and continue through the authored catalog to roughly `:1334`; authoritative `SwingDescriptor` and swept-blade geometry begin at `:1335-1570`.

**Why it hurts.** Server combat needs geometry/timing helpers but reaches them through a module dominated by presentation choreography. Animation/combo authoring and authoritative hitbox work therefore share one file and module-evaluation boundary. Recent swing-clock, animation, and combo waves all have reason to touch it.

**Refactor — M.** Split `melee/model.ts` (shared descriptor and timing), `melee/geometry.ts` (pure authoritative hit tests), and `melee/presentation.ts` (motion/ribbon sequences and selection). Re-export from `melee.ts` temporarily. Server imports only model/geometry; catalog ordering stays untouched.

**Safety.** Geometry is directly pinned at `tests/melee.test.ts:11-94`, reach/math at `tests/weapons.test.ts:438-474`, and live integration at `GameRoom.test.ts:204-227`, `:2374-2415`, and the golden tick. Add an ordered choreography-catalog snapshot to protect presentation data during the move.

### P2 — cleanup and future scale

#### P2.1 — `progression.ts` is small but unnecessarily coupled to Colyseus `PlayerState`

**Evidence.** All three operations accept and mutate `PlayerState` imported from shared schema (`packages/server/src/rooms/progression.ts:1-11`, `:19-61`). The calculations themselves need only a small set of numeric/class fields.

**Why it hurts.** This otherwise good extraction cannot be unit-tested or reused without constructing a network schema object, and protocol field changes can ripple into pure progression. The integrity wave touched it while fixing system behavior.

**Refactor — S.** Define a structural `ProgressionPlayer` interface containing only fields read/written by `allocate`, `consumeFlex`, and `levelUpPlayer`; accept that interface. `PlayerState` satisfies it without an adapter or runtime change.

**Safety.** The 11 focused tests in `packages/server/src/rooms/progression.test.ts:18-138` pin XP remainder, multi-level grants, cap, allocation, flex windows, and class growth. Typecheck proves `PlayerState` compatibility.

#### P2.2 — `enemies.ts` combines catalog data, combo grammar, registry mutation, and pure AI helpers

**Evidence.** Core enemy types begin at `packages/shared/src/enemies.ts:42`; combo grammar and decks occupy `:161-500`; the catalog begins at `:569`; post-merge mutation/normalization occurs at `:928-1032`; exported pure selection/movement helpers follow at `:1063-1246`.

**Why it hurts.** Enemy-data, combo-design, dimension-codegen, and server-AI changes share one 1,251-line module. The combo wave added hundreds of lines here and also needed the generated-identity patch. The current layout makes a pure helper import initialize and mutate the complete registry.

**Refactor — M.** Split `enemy-types.ts`, `enemy-defs.base.ts`, `enemy-combos.ts`, generated dimension defs, `enemy-registry.ts`, and `enemy-ai.ts`. Registry assembly/validation happens once; AI helpers consume `EnemyKind` without importing catalogs. Move runtime post-merge patches to sources as described in P1.10.

**Safety.** Preserve an ordered deep digest of `ENEMY_KINDS` and `TOUGH_COMBOS`, data-consistency tests (`tests/data-consistency.test.ts:292-341`), room AI/parry/combo suites, and deterministic golden tick.

#### P2.3 — `mapgen.ts` owns generation, collision queries, and navigation audit in one module

**Evidence.** Map generation/data shaping spans approximately `packages/shared/src/mapgen.ts:103-1074`, POI/pit collision and lookup helpers `:1075-1238` (with collision types also at `:584-602`), and navigation classification/audit/validation `:1239-1454`.

**Why it hurts.** The natural-zones wave added a large block to the same file used by hot authoritative collision queries and offline validation. Future map authoring, server collision, and audit work will continue to conflict even though their dependency direction is clear.

**Refactor — M.** Split `mapgen/types.ts`, `generator.ts`, `collision.ts`, and `validation.ts`; generation may use validation, runtime collision depends only on types, and validation can depend on both. Keep `mapgen.ts` as a compatibility facade.

**Safety.** `tests/mapgen.test.ts:38-495` already pins seed determinism, 200-seed guarantees, pit/POI queries, zones, navigation, compound landmarks, and golden descriptors. `tests/data-consistency.test.ts:326-341` pins body/POI geometry constraints.

#### P2.4 — the shared boss catalog will repeat the same contention pattern as weapons/enemies

**Evidence.** `packages/shared/src/bosses.ts` defines boss types at `:32-72`, then keeps every authored boss in one catalog through `:1031`, with the registry at `:1032-1069`. `boss-primitives.ts` is a separate, reasonably cohesive 723-line pure primitive registry (`packages/shared/src/boss-primitives.ts:41-164`, `:193-723`), while `boss.ts` holds segmented/worm protocol types (`packages/shared/src/boss.ts:9-126`).

**Why it hurts.** Generic boss, belt finale, Serraketh, and future boss waves all add to one authored data file. The current separation of primitives is good, but catalog entries remain a shared append/edit surface and generic versus segmented naming is ambiguous.

**Refactor — M.** Keep `boss-primitives.ts` intact; split authored definitions by boss or dimension under `bosses/defs/`, with a small deterministic registry assembler. Rename the small `boss.ts` role to `boss-protocol.ts` or `segmented-boss-types.ts` via re-export so layer purpose is obvious.

**Safety.** `tests/boss.test.ts:4-68`, `tests/boss-primitives.test.ts:41-233`, `BossController.test.ts:111-613`, and room finale tests (`GameRoom.test.ts:1988-2020`) pin phase laws, primitive determinism, registry completeness, and runtime reachability. Preserve ordered boss IDs.

## Shared modules that should remain small boundaries

Not every shared file needs extraction. `collision.ts` (56 lines) is a clean pure body-resolution primitive and is directly covered by `tests/collision.test.ts:8-50`. `movement.ts` (201 lines) is cohesive pure movement/impulse/vertical integration with broad coverage at `tests/movement.test.ts:19-249`. `leveling.ts` (80 lines) is also a focused model/math boundary. `combat.ts` (203 lines) now contains beam descriptors, receipt delivery tags, chain selection, and quake geometry, but those are still small pure contracts; split it only if the beam/receipt ports reveal a real import-cycle need. `augments.ts` (315 lines) mixes definitions and tuning but remains one bounded gameplay catalog, so it is lower priority than the demonstrated hot spots. `loot.ts` has good pure roll/math coverage; its only immediate structural correction is to separate catalog-bound top-level registry construction from pure functions as part of P1.7/P1.3.

## Sequenced extraction roadmap for wave-based work

1. **Wave 0 — freeze equivalence, not feature work.** Add the schema-layout fingerprint, ordered registry digests, phase-order spy, and test-name manifest. Record the current golden tick and `pnpm gen:check` result. During this short wave, no feature agent edits `GameRoom.ts`, `state.ts`, or `constants.ts`.
2. **Wave 1 — split `GameRoom.test.ts` first (P0.8).** One owner moves the harness and suites with zero assertion changes. This immediately gives beam, combo, boss, XP, input, and arsenal waves independent test files. Other agents can work in non-server files, but should not append new tests until the move lands.
3. **Wave 2 — fan out the two shared merge queues (P0.6/P0.7).** One protocol owner preserves schema field order while splitting `state.ts`; a separate constants owner can split domain constants in parallel because the files do not overlap after coordination. Land compatibility re-exports before converting imports. Feature waves then add new fields/constants to owned domain files, not the facades.
4. **Wave 3 — extract message registrars and the reset registry (P0.2/P0.4).** This removes the two regions every new subsystem currently has to touch. Preserve the current guard matrix and reset order exactly. Make future feature ownership: registrar file + subsystem file + focused test file.
5. **Wave 4 — take the cheapest complete seams: receipts and boss world adapter (P1.4/P1.5).** They already have explicit data/port boundaries and strong tests. Land them as separate sequential moves from `GameRoom` so merge history remains reviewable; after landing, receipt or boss waves should no longer edit the room except for composition.
6. **Wave 5 — move beams, then authored combo AI (P1.1/P1.2).** Both are contiguous and well-tested, but both currently touch damage/telegraphs. Define their ports first; use one `GameRoom.ts` extraction owner at a time. Once moved, beam and enemy-combo agents can work concurrently in separate subsystem/test files.
7. **Wave 6 — extract arsenal, then loot/pickup ownership (P1.3).** Do slot/resource persistence before loot because beam debt and hidden pickup identity depend on it. Keep handlers as delegates and keep damage callbacks intact until the service tests are green.
8. **Wave 7 — extract the damage transaction and fixed-step orchestrator (P0.5/P0.3).** With receipts, beams, combos, boss wiring, and loot behind ports, `DamageResolver` and `SimPipeline` become moves over narrow interfaces rather than speculative redesigns. This is the highest-risk wave; require golden tick, transport, full server tests, and registry/schema digests after each sub-move.
9. **Wave 8 — split `BossController.ts` and shared catalogs (P1.6, P2.2–P2.4).** Physical class/catalog moves can now proceed without competing with room work. Deduplicate boss emission only after both current emission paths have snapshots.
10. **Wave 9 — finish shared entry points and generators (P1.7–P1.12).** Add subpath exports, split melee/weapons layers, shard generated weapons, harden dimensions, and make VFX metadata checks artifact-independent. Run these as generator/catalog waves, not alongside authored weapon/dimension waves, so generated diffs have a single owner.

For every wave, use a **move-only commit first**, then any cleanup in a second commit; assign exactly one owner to each compatibility facade and to `GameRoom.ts`; and do not let feature agents “help” by opportunistically reformatting or renaming extracted code. That sequencing reduces future file contention before attempting the deeper architectural splits.
