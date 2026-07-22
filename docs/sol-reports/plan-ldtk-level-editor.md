# LDtk level editor — Sol fleet orchestration plan

## Understanding recorded before planning

- This Planner Sol is plan-only on branch feat/v0.118-metagame. Its sole write is this report. The report was created as the first repository action and accumulated findings during investigation; no product, generator, asset, test, or generated output was edited.
- The owner wants a short edit loop: open LDtk, paint the logical arena, place supported gameplay entities, save, run the canonical generator, and launch the authored arena through a familiar development deep link. Procedural generation remains the ordinary game path.
- Read all 1,857 lines of packages/shared/src/mapgen.ts. The replicated contract is not merely a pit bitmap. ArenaMap contains tiles, zoneIds, three zone seeds, spawn coordinates, POIs, exactly six POI macro-clusters, a derived collision index, and the four seeds that continue to drive cosmetic floor detail. Server collision and client rendering/prediction consume the same result.
- generateArena is the load seam. GameRoom.mintMap() currently calls it at GameRoom.ts:14081 after minting the four synced seeds; ArenaScene.maybeBuildFloor() calls it at ArenaScene.ts:4105 after those seeds arrive. An authored arena must extend this shared function, not create a server loader and client loader that can drift.
- validateArena is already stricter than a visual review: connected zone footprints, a Commons centre core, six populated POI clusters, solid spawn, solid border, walk-or-hop reachability of every ground tile, player-radius/POI-aware navigation, every zone reachable, and an approachable route to every cluster. Procedural forceGround/ensureConnected repair is private and happens before POI placement.
- Current V7 work is live in the same worktree. v7-katana-bespoke holds GameRoom/SpriteRig/catalog leases; v7-ranged-orders, v7-melee-caster-orders, and v7-remaining-qualification remain behind it. The compiler half of this program can be completely new-file-only now. The runtime half cannot touch GameRoom or ArenaScene until the entire V7 chain has crossed its qualification barrier.
- The existing development grammar already does the important room-isolation work. Any ?dev= link creates a fresh room, while normal play uses joinOrCreate. The correct authored grammar is ?dev=arena:arena-id, resolved by the server at room creation and inherited by joiners through room state.
- The repository generation law is canonical source → pnpm gen → pnpm gen:check → pnpm assets:check → tests → typecheck. tools/artkit/lib/emit.mjs is the write-or-check sink. The .ldtk file is canonical source; a committed shared TypeScript catalog is derived output and is never hand-edited.
- The owner stack on 5180/2567 is not a test fixture. All permanent live proof uses runArenaSpec/startSpecStack, their ephemeral Vite and Colyseus listeners, serial Playwright, browser/page-error gating, and self-owned teardown.
- Official LDtk documentation confirms the data fit: project files are JSON with jsonVersion; IntGrid intGridCsv is row-major with 0 as empty and authored values beginning at 1; Entity layers expose positioned instances and custom fields. Sources: [LDtk JSON 1.5.3](https://ldtk.io/json/), [JSON overview](https://ldtk.io/docs/game-dev/json-overview/), [layer instances](https://ldtk.io/docs/game-dev/json-overview/layer-instances/), and [entities](https://ldtk.io/docs/general/editor-components/entities/).

## Recommendation

Launch **three Sols**.

1. **ldtk-authoring-compiler** starts immediately and writes only new files. It establishes the LDtk project/schema, deterministic importer, generated shared catalog, author guide, and hostile import fixtures without wiring runtime code.
2. **ldtk-runtime-integration** starts only after V7 qualification releases GameRoom and ArenaScene. One Sol owns the whole replicated sentence: shared generator/validator, state handshake, server selection, client selection, pipeline registration, asset census, and permanent live gate.
3. **ldtk-level-qualification** independently re-runs the source, determinism, invalid-map, co-op, visual, and aggregate gates with all product files read-only.

Three is the minimum I trust. Two would make the author of the replicated runtime also its only spatial/visual judge. Four would split server and client ownership across the exact determinism boundary and create more coordination risk than useful parallelism.

## Tool verdict: LDtk remains the right call

The codebase strengthens the LDtk recommendation for the part that matters. The game renders painted floor treatments and POI sprites over a fixed 60×60 logical grid; it does not render a tilemap. LDtk lets the owner paint only the two logical IntGrids and drag gameplay entities without introducing a tile renderer or a runtime editor dependency. A small repository-owned JSON importer is enough. Tiled's Phaser loader advantage remains irrelevant here.

One part of the shallow recommendation must be corrected. Grid, zones, player spawn, POI cluster anchors, and landmark placement are real current ArenaMap concepts. Static top-down shop placement is not: beltShopX belongs to belt mode. Static rift placement is also not: placeArenaGatePair() chooses the extract/rift pair dynamically from the boss corpse and full-disc safety. M1 must not claim to import shop or rift entities that no current consumer can honor.

The importer supports the documented LDtk JSON surface directly. It does not add an LDtk runtime library, tile assets, AutoLayers, or a Phaser tilemap path. The running server and client never read .ldtk.

## Minimum first deliverable — M1 “Draw → Generate → Deep-Link → Play”

M1 is complete when the owner can:

1. Open data/arenas/dimension-drifters.ldtk and duplicate/edit the included owner-playground level.
2. Paint pits and zones and drag the supported spawn/cluster/landmark entities.
3. Save, run pnpm gen, and receive either a generated shared catalog or a coordinate-specific hard failure.
4. Run pnpm gen:check and pnpm assets:check successfully.
5. Open /?dev=arena:owner-playground and play a fresh authored room through normal server collision, client floor rendering, prediction, enemies, falls, POIs, restart, and co-op join.

No ordinary menu or matchmaking behavior changes in M1. With no authored arena ID, generateArena(seeds) remains procedural. In a development-authored room the resolved arena ID stays fixed across restart and rift descent while newly minted seeds may vary cosmetic decor; normal dimension progression may still re-skin that topology. A later production-routing decision can choose different authored arenas per depth.

## Authored source and import contract

The first project is intentionally narrow:

| LDtk surface | Required contract | Runtime mapping |
|---|---|---|
| Project | Embedded levels only; externalLevels=false; supported jsonVersion pinned; no multi-world or Tile/AutoLayer dependency | Canonical census at data/arenas/dimension-drifters.ldtk |
| Level | Unique normalized ID; exactly 4800×4800 px | One fixed 60×60 ArenaMap |
| Terrain IntGrid | 80 px grid; no offset; empty=Ground, value 1=Pit; other values rejected | TILE_GROUND / TILE_PIT Uint8Array |
| Zones IntGrid | 80 px grid; no offset; empty=Commons, 1=Cover, 2=Scar; other values rejected | MAP_ZONE_COMMONS / COVER / SCAR Uint8Array |
| Gameplay Entities | One PlayerSpawn, exactly six PoiCluster anchors, Landmark entities | spawnX/Y, poiClusters, pois |
| PlayerSpawn | Grid-centred and surrounded by the required ground-clear disc | ArenaMap spawn and server join/restart positions |
| PoiCluster | Grid-centred; zone inferred from Zones | Cluster ID assigned by stable row/column/IID sort |
| Landmark | Grid-centred; valid entity reference to a cluster; Size enum and non-negative Variant | Deterministic kind, clusterId, collision footprint |
| Optional level metadata | Display name and initial DimensionId only | Guide/initial palette selection; not new simulation geometry |

Editor array order is never authority. Levels sort by normalized ID; clusters and landmarks sort by row, column, then IID; entity references resolve by IID; zone seeds derive by a documented integer/row-major rule from each connected zone. All runtime numbers are finite integers except existing deterministic cluster phase, which is fixed for explicitly placed authored landmarks. This makes regeneration stable after harmless LDtk panel/layer reordering.

The compiler reports the level ID plus layer/entity IID and tile coordinate or world coordinate for every failure. It rejects duplicate IDs, wrong layer identifiers/types, offsets, dimensions, unsupported values, missing or duplicate entities, broken cluster references, and non-finite fields before emitting.

## Determinism, validation, and drift laws

### The determinism law

Authored arenas ship as committed data in packages/shared/src/authored-arenas.generated.ts. Both server and client bundle that exact shared module. The public load contract remains generateArena: the procedural one-argument form is preserved, and an optional resolved authored ID selects a generated record. The authored branch copies canonical arrays into fresh Uint8Arrays, derives zone seeds and PoiCollisionIndex deterministically, and returns the same ArenaMap shape used everywhere else. There is still no tile streaming.

The permanent byte-identity law has three layers:

- A focused test creates serverMap and clientMap from the same seeds and authored ID and requires Buffer-level equality for tiles and zoneIds plus deep equality for dimensions, tile size, spawn, zone seeds, clusters, and POIs.
- A shared authority digest covers dimensions, tile size, every tile byte, every zone byte, spawn, ordered zone seeds, ordered clusters, and ordered POIs. The generated record carries its expected revision; regeneration and runtime reconstruction must match it, and a one-byte mutation must change it.
- A GameRoom test creates an authored room, reads the server-resolved arenaId/arenaRevision, reconstructs the client-side map from those synced inputs, and requires the same authority digest. The live two-client gate repeats this through real bundles.

### Validate + repair is a guarantee

**Recommendation: fail authored import loudly; never repair it.** Automatic bridge carving or island dissolution would change the owner's design, and procedural repair cannot by itself correct zone topology, POI footprint clearance, cluster population, or objective-disc capacity.

The importer/build validation must invoke the shared arena laws, not maintain a weaker second definition. It checks:

- exact dimensions, array lengths, legal tile/zone values, and the procedural pit-coverage ceiling;
- the complete MAP_BORDER_TILES ground ring;
- the authored spawn's full MAP_SPAWN_CLEAR_TILES disc and random co-op spawn-jitter envelope;
- every ground cell reachable from spawn by walking or straight hops no wider than MAP_MAX_JUMP_TILES;
- one connected Commons/Cover/Scar footprint each, minimum zone area, and the Commons centre identity core;
- exactly six clusters with 3–6 landmarks each;
- every landmark's collision footprint plus MAP_POI_GROUND_CLEARANCE on ground, radius-aware spacing, spawn clearance, valid cluster, and reachable cluster approach;
- auditArenaNavigation at PLAYER_RADIUS;
- enough full-footprint safe ground for the post-boss extract/rift pair, with representative corpse-position gate-placement probes.

pnpm gen exits non-zero and does not bless an invalid arena. No fallback to procedural generation is allowed when an authored ID was explicitly requested. Unknown IDs also fail room creation rather than quietly launching the wrong map.

### Source/build/runtime drift

There are three separate drift gates:

1. **LDtk format drift:** the importer accepts the pinned jsonVersion and exact project definitions. Saving with a newer/incompatible LDtk schema fails with an upgrade message naming supported and observed versions. The importer is updated deliberately before that editor version is adopted.
2. **Source/generated drift:** pnpm gen regenerates the committed TypeScript catalog through emit.mjs; pnpm gen:check fails if the saved .ldtk and generated output differ. Never hand-edit the generated file.
3. **Server/client bundle drift:** append arenaId and arenaRevision to ArenaState, bump the then-current SCHEMA_VERSION, and include both in the client floor key. The server syncs the generated content revision. A client missing the ID or carrying a different revision stops floor construction and shows the existing hard-reload/version failure path. A stale data-only bundle therefore cannot collide against different geometry under the same schema number.

## Ledger accounting

The twelve closure obligations reconcile as 2 compiler-owned, 9 runtime-owned, and 1 qualification-owned.

| Ledger scope | Owning Sol | Accounting |
|---|---|---:|
| Canonical LDtk project, supported layer/entity schema, starter level, author guide | ldtk-authoring-compiler | 1 |
| Deterministic importer, generated catalog, hostile schema fixtures | ldtk-authoring-compiler | 1 |
| Shared authored ArenaMap construction and full fail-only validation | ldtk-runtime-integration | 1 |
| Same generateArena contract for procedural and authored inputs | ldtk-runtime-integration | 1 |
| Byte-equality, authority digest, and generated revision laws | ldtk-runtime-integration | 1 |
| jsonVersion, gen:check, schema-version, and arenaRevision drift handling | ldtk-runtime-integration | 1 |
| Server room selection, mint/restart/descent behavior, unknown-ID failure | ldtk-runtime-integration | 1 |
| Client synced selection, floor rebuild, prediction/collision convergence | ldtk-runtime-integration | 1 |
| ?dev=arena: ID grammar and procedural coexistence | ldtk-runtime-integration | 1 |
| pnpm gen registration and authored-asset census in assets:check | ldtk-runtime-integration | 1 |
| Permanent two-client visual/spatial/play gate with retained evidence | ldtk-runtime-integration | 1 |
| Independent source-to-live qualification and closure ledger | ldtk-level-qualification | 1 |

Static shop/rift anchors, public content routing, and an in-game editor are deliberately outside these twelve rows and are listed under deferred work rather than hidden as partial delivery.

## Global laws and conductor protocol

1. Every implementation Sol creates its own docs/sol-reports report as its first write and appends validation last.
2. Exclusive leases are path-exact. Every unlisted file is read-only. At each barrier the conductor reads the report, inspects git diff --name-only, rejects out-of-lease edits, runs git diff --check, and commits the completed group before transferring a lease.
3. Group 1 is new-file-only. It may read V7 central surfaces but may not edit package.json, tools/artkit/check-assets.mjs, mapgen.ts, state.ts, constants.ts, GameRoom.ts, ArenaScene.ts, SpriteRig.ts, or any catalog.
4. Group 2 does not begin merely because ArenaScene happens to be momentarily free. It waits for v7-katana-bespoke, v7-ranged-orders, v7-melee-caster-orders, and v7-remaining-qualification to complete and for the conductor to commit that baseline.
5. The replicated map change lands atomically under one runtime Sol. There is no server-only merge, client-only merge, alternate loader, public JSON fetch, or permissive fallback.
6. Canonical order is data/arenas/dimension-drifters.ldtk → pnpm gen → pnpm gen:check → pnpm assets:check → focused/full tests → typecheck → live gate. Generated output is changed only by its generator.
7. assets:check gains an authored-arena census: number of embedded LDtk levels, normalized IDs, and generated registry entries/revisions must be a bijection. It rejects external .ldtkl files, unrecognized arena source files, duplicates, and missing/stale compiled entries.
8. The owner listeners on 5180/2567 are untouchable. Sols do not stop, replace, seize, or kill them. Browser work is serialized through one conductor-controlled lane and uses ephemeral stacks only.
9. “Tests pass” is not visual/spatial closure. M1 requires a committed full-map overview, natural-scale frames, machine-readable runtime evidence, and a permanent Playwright assertion against the authored sample.
10. Explicit authored failures are loud. An invalid map, unknown ID, stale generated catalog, unsupported LDtk version, or revision mismatch never degrades to a procedural arena.

### Central lease transfer order

| Central surface | Exclusive write order |
|---|---|
| packages/server/src/rooms/GameRoom.ts | V7 KATANA → V7 RANGED → V7 MELEE/CASTER → V7 qualification barrier → ldtk-runtime-integration |
| packages/client/src/scenes/ArenaScene.ts | V7 RANGED → V7 MELEE/CASTER → V7 qualification barrier → ldtk-runtime-integration |
| packages/client/src/entities/SpriteRig.ts and weapon catalog/generated catalog | V7 chain only; every LDtk Sol reads these only |
| data/arenas/**, tools/levels/**, packages/shared/src/authored-arenas.generated.ts, docs/level-authoring/ldtk.md | ldtk-authoring-compiler → ldtk-runtime-integration |
| packages/shared/src/mapgen.ts, state.ts, constants.ts | ldtk-runtime-integration only |
| package.json and tools/artkit/check-assets.mjs | ldtk-runtime-integration only |
| e2e live-stack/browser lane | Current V7 gate → ldtk-runtime-integration gate → ldtk-level-qualification |
| Sol reports and evidence directories | Disjoint per Sol; never transferred |

The LDtk program never writes SpriteRig or the weapon catalog. Waiting on those V7 leases is about an honest central-file baseline, not a future need to edit them.

## Launch order and concurrency groups

| Group | Launches | Barrier reason |
|---:|---|---|
| 1 — immediate, parallel with current V7 | ldtk-authoring-compiler | Every write is a new path. It cannot collide with KATANA/RANGED/MELEE runtime or catalog work and uses no browser lane. |
| Barrier A | Conductor review/commit of compiler output | Prove new-file-only diff, generator/check symmetry, hostile import failures, and a generated starter catalog before transfer. |
| V7 barrier | No LDtk runtime Sol | Wait through KATANA, RANGED, MELEE/CASTER, and V7 qualification; commit the V7 baseline and release GameRoom/ArenaScene. |
| 2 — solo | ldtk-runtime-integration | One owner changes the shared contract, wire state, both call sites, generation registration, census, and permanent live gate atomically. |
| 3 — solo | ldtk-level-qualification | Independent read-only product audit after the runtime report and retained evidence are complete. Failures return to the owning Sol. |

File-level disjointness for Group 1 is concrete: every exclusive path below is absent today, while the active V7 report lists existing catalog, GameRoom, SpriteRig, melee/weapon, and V7 gate/evidence paths. Group 1 may not “helpfully” register its generator in package.json; that single existing-file edit belongs to Group 2.

## Sol 1 — ldtk-authoring-compiler

**Mission.** Establish a real LDtk authoring source and deterministic compiler without changing running game behavior. Supply the valid owner-playground level and invalid fixtures that the integration Sol will drive through shared runtime validation.

**Exclusive writes.**

- docs/sol-reports/ldtk-authoring-compiler.md
- docs/level-authoring/ldtk.md
- data/arenas/dimension-drifters.ldtk
- tools/levels/gen-authored-arenas.mjs
- tools/levels/ldtk-import.mjs
- packages/shared/src/authored-arenas.generated.ts
- tests/fixtures/ldtk/**
- tests/authored-arena-import.test.ts

All are new paths at launch. The generated file is produced by the new generator, never typed by hand after the emitter exists.

**Read only.** package.json; tools/artkit/lib/emit.mjs; tools/artkit/check-assets.mjs; packages/shared/src/mapgen.ts, constants.ts, state.ts, index.ts; packages/server/src/rooms/GameRoom.ts; packages/client/src/scenes/ArenaScene.ts and scenes/arena/floor-renderer.ts; all V7 reports/code/evidence; every catalog and SpriteRig file.

**Compiler gate.**

- Parse the official LDtk JSON fields actually used; pin jsonVersion and project definitions.
- Prove stable output across two imports and harmless level/layer/entity array reordering.
- Prove --check detects source/generated drift without writing.
- Reject the structural fixtures now: wrong version, wrong grid, unknown IntGrid value, missing spawn, and broken cluster reference.
- Retain stranded-island, blocked-spawn, pit-border, overlapping/unsafe-POI, disconnected-zone, and insufficient-gate-space fixtures for Group 2. They become required red-to-green tests only after the compiler can invoke the shared ArenaMap validator; Sol 1 must not duplicate that geometry law merely to reject them early.
- Do not claim playable M1 or run a browser. This Sol supplies a compile-ready asset and tests only.

**Risk and mitigation.** A compiler Sol can accidentally invent a second navigation law. Its structural checks may reject malformed LDtk immediately, but authoritative geometry acceptance is finalized in Group 2 by constructing ArenaMap and calling the shared validator. The cross-check fixture must prove every emitted arena passes that shared law before M1 closes.

**Work-order outline.**

- Create the report first, then freeze the exact project/layer/entity definitions in the guide.
- Build owner-playground with a visually unmistakable asymmetric pit/zone motif, six valid clusters, representative size classes, a safe spawn, a comfortable hop lane, and nearby natural-scale live-gate sentinels.
- Implement stable normalization, sorting, revision hashing, diagnostics, output through emit.mjs, and hostile fixtures.
- Run the standalone generator twice plus --check and focused importer tests; append validation last.

## Sol 2 — ldtk-runtime-integration

**Mission.** Deliver M1 atomically after V7: register the compiler, build authored ArenaMaps through generateArena, strengthen shared validation, sync selection/revision, wire the server and client seams, census the new asset type, and prove real two-client play.

**Exclusive writes.**

- docs/sol-reports/ldtk-runtime-integration.md
- docs/ldtk-level-editor-evidence/runtime/**
- the transferred Sol 1 paths under data/arenas/**, tools/levels/**, docs/level-authoring/ldtk.md, tests/fixtures/ldtk/**, tests/authored-arena-import.test.ts, and packages/shared/src/authored-arenas.generated.ts
- package.json
- tools/artkit/check-assets.mjs
- packages/shared/src/mapgen.ts
- packages/shared/src/state.ts
- packages/shared/src/constants.ts
- packages/server/src/rooms/GameRoom.ts
- packages/client/src/scenes/ArenaScene.ts
- new tests/authored-arenas.test.ts
- new packages/server/src/rooms/GameRoom.authored-arena.test.ts
- new e2e/tests/ldtk-authored-arena-live-gate.spec.ts

**Read only.** packages/client/src/entities/SpriteRig.ts; data/weapon-concepts-300.json; all weapon generated/catalog files; packages/shared/src/weapons.ts, melee.ts, weapon-muzzle.ts, hit-envelope.ts; packages/client/src/scenes/arena/floor-renderer.ts; packages/client/src/net/prediction.ts; e2e/helpers/arena-harness.ts and spec-stack.ts; every V7 implementation report/gate/evidence. If the existing ArenaMap consumers cannot render/collide the authored result unchanged, stop and document the violated contract before expanding scope.

**Runtime contract.**

- Preserve generateArena(seeds) exactly as procedural default; add the optional authored ID at the same function boundary.
- Resolve requested IDs server-side only when dev tools are enabled. The server owns canonicalization, initial DimensionId metadata, arenaRevision, and loud unknown-ID rejection.
- Append arenaId and arenaRevision to ArenaState and bump the then-current schema version once. Joiners ignore their own URL choice and reproduce the host's synced selection.
- Parse arena deep links before connection. An arena link creates a fresh room but does not invoke applyDevLaunch's training toggle. Weapon/boss/gear/pet/character deep links remain unchanged.
- Include ID and revision in ArenaScene's floor key. Build the authored map before drawArena/buildArenaFloor/buildPois and pass it to the existing predictor exactly like procgen.
- Keep the chosen authored ID through mintMap on restart/rift; continue minting seeds for deterministic cosmetic variation.

**Focused verification.**

- Importer schema/drift/diagnostic suite.
- Generated-source bijection and revision golden.
- Full shared validator against owner-playground plus adversarial mutations.
- Buffer-level server/client tile and zone equality, complete authority digest equality, mutation sensitivity, and unchanged procedural goldens.
- GameRoom create/join/restart/descent, spawn safety, dev-tools gate, unknown-ID rejection, synced ID/revision, and client-style reconstruction.
- Static client/deep-link tests proving arena links do not toggle training and non-arena links retain current behavior.
- pnpm gen, pnpm gen:check, pnpm assets:check, focused tests, full serial unit suite, and typecheck in the required order.

**Permanent live gate and retained evidence.**

Use runArenaSpec/startSpecStack only. The gate opens host page /?dev=arena:owner-playground, then an ordinary second page that joins the host room. It must prove:

- both clients share one room, the same arenaId/revision/seeds, and the same client authority digest as the server revision;
- both spawn inside the authored clear disc and the room remains in normal playable mode;
- known authored tile/zone/POI sentinels are present and differ from a procedural control;
- a real input sequence walks, performs the authored one/two-cell hop, collides honestly with a known POI, attacks, and advances authoritative state without unexplained fall/reconciliation error;
- a deliberate pit contact triggers the normal fall/chip/reposition rule onto reachable ground;
- the second client can traverse and act on the same topology;
- restart or one controlled re-mint retains the authored ID while changing seeds without changing the geometry digest;
- no browser console error or pageerror occurs.

Retain under docs/ldtk-level-editor-evidence/runtime/: a camera-zoomed full-map overview showing the asymmetric authored motif, natural-scale spawn/hop/POI/co-op frames, and JSON containing room IDs, session IDs, source/revision/digests, sentinel cells, state transitions, falls, and final positions. Restore natural camera settings before interaction; zoom-out is evidence instrumentation, not product behavior.

**Risk and mitigation.** The dangerous failure is a stale client drawing one grid while the server collides against another. State revision comparison happens before floor construction, and the live gate checks real independent bundles. The second danger is changing mapgen guarantees for procedural maps while generalizing spawn/POI validation; retain all procedural samples/goldens and add authored tests in new files rather than weakening existing assertions.

**Work-order outline.**

- Re-read the transferred compiler report and current V7 handoff; record the post-V7 baseline and exact then-current schema number.
- Factor/extend shared construction and validation first, then make the generator validate through that one law and register it in gen/gen:check/assets:check.
- Append state fields and server/client selection as one change; preserve all no-ID behavior.
- Run focused static gates before the permanent ephemeral-stack gate, retain evidence, then run full aggregates and append validation last.

## Sol 3 — ldtk-level-qualification

**Mission.** Independently certify the twelve-row ledger without implementing fixes.

**Exclusive writes.**

- docs/sol-reports/ldtk-level-qualification.md
- docs/ldtk-level-editor-evidence/qualification/**
- new docs/sol-reports/ldtk-level-editor-ledger.json

All product code, data/arenas source, generators, generated output, tests, and runtime evidence are read-only.

**Qualification gate.**

- Verify the compiler and runtime reports were first writes, their diffs stayed within lease, and every ledger row has code/test/evidence closure.
- Make a temporary invalid copy outside canonical paths and prove the importer rejects stranded ground, blocked spawn, pit border, unsafe POI, disconnected zone, wrong jsonVersion, and stale output. Never modify the canonical source during negative testing.
- Independently recompute source and generated censuses and every generated revision.
- Re-run byte-equality/digest laws, procedural regressions, server room tests, the permanent authored live gate, and its two-client same-room assertions.
- Run pnpm gen:check, pnpm assets:check, the full serial unit suite, typecheck, and exact CI=1 pnpm e2e under repository retry policy. Browser runs remain serial and ephemeral.
- Inspect retained screenshots at full-map and natural scale. A green JSON digest without a visibly authored map is a failure.
- Return any failure to ldtk-runtime-integration. The qualifier does not patch product, regenerate sources, weaken a threshold, or reinterpret a missing row as green.

## Deferred and deliberately rejected work

- **No in-game level editor.** LDtk already supplies paint, selection, undo, entity fields, and drag/drop. Rebuilding those inside Phaser would be a second product with much higher validation cost.
- **No automatic repair or --repair mode.** Diagnostics may suggest the failing coordinate/rule, but canonical authored geometry changes only in LDtk.
- **No static shop or rift entities in M1.** There is no top-down shop consumer, and the rift belongs to the dynamic post-boss gate-pair contract. Revisit only with a separate gameplay order that defines precedence, safety, and progression semantics.
- **No variable-size arenas.** World bounds, camera, spawning, rendering, constants, and tests assume 4800×4800 / 60×60 / 80 px.
- **No Tile/AutoLayer rendering, tileset export, or public .ldtk fetch.** Painted floor art continues to consume logical geometry and dimension palettes.
- **No external .ldtkl files or multi-world support in M1.** One embedded project makes the canonical source and census unambiguous. Add them only when merge pressure or level count justifies the complexity.
- **No procedural-to-LDtk exporter.** It is not required to hand-author a level and would encourage treating repaired procgen output as editable source without identity semantics.
- **No public matchmaking/menu selector yet.** The first path is dev-only. Production routing needs a later content decision about dimension/depth rotation, not a hidden query parameter promoted to game design.
- **No portal gallery, filesystem watcher, hot import RPC, or placement tweaker in M1.** The documented save → pnpm gen → deep-link loop is sufficient to measure real friction. Fund a tiny placement tweaker later only if repeated owner sessions show LDtk round-trips are the bottleneck; do not predict that need.
- **No extra Sol for server or client halves.** The replicated sentence and its live proof stay with one integration owner.

## Recommendation and open questions for the owner

Proceed with LDtk and the three-Sol sequence above. The minimum useful shipment is M1, not a general editor platform: one canonical LDtk project, one fail-loud compiler, one shared authored ArenaMap path, one dev deep link, and retained two-client spatial proof.

There are **no blocking owner questions**. The plan records these non-blocking assumptions so implementation can proceed:

- owner-playground is the first committed arena and the visual/live fixture;
- LDtk JSON 1.5.3 and embedded levels are pinned until the importer is deliberately upgraded;
- an authored dev room retains its topology across restart/rift while cosmetic seeds and normal dimension palettes may change;
- production authored-level rotation and static shop/rift semantics are future design decisions, not M1 guesses.

Planning validation: read the reporting guide, V7 central lease/launch plan, complete 1,857-line map generator, both runtime call sites, state handshake, dev-link flow, generation/census scripts, current V7 lease report, and ephemeral live-stack helpers. All required headings and explicit decision phrases are present; the report-only trailing-whitespace scan passed; git status identifies this report as the Planner Sol's only new path. No product test was run because this turn made no product change.
