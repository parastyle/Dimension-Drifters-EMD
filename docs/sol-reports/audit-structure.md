# Structural Soundness Audit — Sol `audit-structure`

## Understanding and plan

This is a read-only architecture audit of Dimension Drifters. The review will assess package and dependency boundaries; ownership of authoritative gameplay logic; oversized and over-responsible modules; generated/source discipline and census guards; character-rendering coupling and a clean replacement abstraction; Colyseus schema and message design; dead or retiring systems; and consistency, error-handling, and maintainability footguns.

The audit will:

1. Map package dependencies and imports, checking for cycles, boundary leaks, and client-side duplication of authoritative behavior.
2. Rank the worst god files and identify concrete extraction seams with explicit responsibilities.
3. Trace code-generation inputs, outputs, manifests, validation, and census assumptions for drift or hand-edit risks.
4. Trace player/character rendering from state to visual assembly, including boilerplate-body and gear-bake assumptions.
5. Review server state schemas, nested/flat row design, reflection adapters/getters, and the client/server message surface.
6. Inventory abandoned or retiring systems, especially wardrobe assets and code, and identify safe pruning boundaries.
7. Record prioritized P0/P1/P2 findings with file-and-line evidence, risk, and actionable recommendations.

_Audit completed against the main worktree on 2026-07-23. No code or test files were changed._

## Evidence snapshot

- The nominal package dependency direction is clean at the manifest level: client and server each depend on `@dd/shared`; shared depends only on `@colyseus/schema`; desktop depends on client (`packages/{client,server,shared,desktop}/package.json`). No client/server package dependency or shared-to-client/server dependency is declared.
- The main handwritten modules are substantially larger than the prompt estimate: `ArenaScene.ts` is approximately 15.8k physical lines and contains a 14.6k-line class with 597 members; `GameRoom.ts` is approximately 14.2k lines with a 13.2k-line class and 414 members; `SpriteRig.ts` is approximately 10.9k lines with a 9k-line class and 445 members. The next largest runtime modules are `BossController.ts` (~3.6k), `MenuScene.ts` (~2.9k), and `AudioBus.ts` (~1.8k).
- `pnpm gen:check` currently exits 0 and reports the principal weapon/dimension/card/projectile/VFX/portal outputs in sync. It also explicitly skips the character-roster comparison and one VFX-subject comparison because untracked ArtKit inputs are absent. Thus the green command is not a complete generated-source integrity proof.
- `packages/client/src/sprites/manifest.ts` is a generated file despite lacking a `.generated.ts` suffix (banner at line 1); `packages/shared/src/characters.ts` and `packages/client/src/sprites/card-manifest.ts` follow the same naming exception. This matters because repository conventions alone cannot tell maintainers whether a file is editable.

## Overall assessment

The repository has a sound *nominal* layering model: deterministic rules and registries generally live in `@dd/shared`, the server owns authoritative mutation, the client owns presentation and prediction, and desktop only packages the client. I found no production import from shared into client/server, no client-to-server or server-to-client import, and no runtime dependency cycle. The apparent `weapons.ts`/generated-weapon and `dimensions.ts`/generated-dimension back-edges use `import type`, so they do not form runtime cycles (`packages/shared/src/weapons.ts:23,34`; `packages/shared/src/weapons-expansion.generated.ts:6`; `packages/shared/src/dimensions.ts:10`; `packages/shared/src/dimensions.generated.ts:7-8`).

The architecture is nevertheless high-risk because responsibility is concentrated in three stateful classes, multiple public contracts are stringly typed, code-generation validation can report success without validating outputs, and presentation-derived character scale has crossed into authoritative combat geometry. The current whole-art-character branch is a local exception inside a wardrobe-first rig, not a first-class rendering model.

What is already structurally sound:

- Shared map generation is genuinely single-source: both server and client call `generateArena` (`packages/server/src/rooms/GameRoom.ts:14050-14058`; `packages/client/src/scenes/ArenaScene.ts:4115-4121`) from the deterministic shared implementation (`packages/shared/src/mapgen.ts:5,1207`).
- Prediction imports shared timing, movement, roll, and combat constants (`packages/client/src/net/prediction.ts:1-53`), while the server's fixed-step loop documents and uses the same pure steppers (`packages/server/src/rooms/GameRoom.ts:1043-1045,5281-5294`). The client necessarily mirrors phase ordering, but the numeric primitives are not independently reauthored.
- Gameplay mutation is server-side; the client sends intent and performs cosmetic/predictive work. The cooldown exception in P1.2 is a scheduling/parity leak, not client authority over damage or inventory.
- The shared barrel is broad (`packages/shared/src/index.ts:1-27`) but directionally correct. A future set of subpath exports would improve build boundaries; it is not currently a layer violation.

## P0 findings

No P0 was confirmed in this read-only review. The P1 findings below are release-quality and change-safety risks, but none establishes an immediate security compromise, unrecoverable data loss, or whole-service failure in the audited tree.

## P1 findings

### P1.1 - The three core runtime classes are change-conflict and regression centers

**Evidence:** `packages/client/src/scenes/ArenaScene.ts:1176-15800` is one approximately 14.6k-line class with 597 members. Its largest responsibilities include scene reset (`2013-2332`), creation/HUD construction (`2367-2931`), pickup/entity presentation (`2937-3151`, `4989-7222`), networking (`4204-4862`, `15192-15799`), attacks (`10130-10462`), combat effects (`11631-11861`), and armory/backpack/bag UI (`13507-14932`). `packages/server/src/rooms/GameRoom.ts:1049-14234` combines 30 message registrations in `onCreate` (`1390-2336`), run/account lifecycle, a 1,026-line simulation step (`5306-6331`), player combat (`6476-9220`), enemy AI (`10337-12956`), projectiles (`12957-13225`), and map/belt progression. `packages/client/src/entities/SpriteRig.ts:1929-10911` combines avatar construction, async texture baking, equipment, weapon attachment, effects, every pose vocabulary, and a 2,802-line `animate` method (`8109-10910`).

**Risk:** A routine feature crosses networking, simulation, presentation, and UI in the same class. Mutation ownership is implicit, reviews cannot isolate invariants, and unrelated work collides in the hottest files. The size is not merely stylistic: the attack-cadence and whole-art regressions below occur at seams hidden inside these classes.

**Concrete recommendation:** Extract services with explicit inputs and single mutation owners; do not split the classes into inheritance-based partials.

1. From `ArenaScene`, extract `ArenaConnectionController` (join/dispose/patch/prediction), `ArenaEntityPresenter` (players/enemies/pickups/projectiles/telegraphs), `ArenaCombatPresenter` (predicted attacks, confirmation, hit/VFX), `ArenaHudController`, and a separate `ArmoryOverlay`. The scene should retain Phaser lifecycle and orchestration only.
2. From `GameRoom`, extract a typed message router, run/account lifecycle service, `SimulationPipeline` phase scheduler, player-combat system, enemy/combo system, projectile/zone system, and belt/run director. Each system should receive a narrow room context rather than the whole `GameRoom`.
3. Split `SpriteRig.animate` into a pure `computePoseFrame(input, state)` and a small `applyPoseFrame(frame)`, with weapon, movement, status-effect, and secondary-motion pose composers in separate modules. Move gear/texture leasing behind an optional avatar decorator.
4. Before moving behavior, add characterization tests at each extracted boundary and move one mutation owner at a time. A line-count reduction without ownership boundaries would not address the risk.

### P1.2 - Client attack prediction duplicates an incomplete authoritative cooldown formula

**Evidence:** The client helper returns only `weaponAttackCooldown(weapon) * cooldownMultiplier` (`packages/client/src/scenes/arena/attack-cadence.ts:1-8`), and `ArenaScene.sendAttack` passes only the loot-affix multiplier (`packages/client/src/scenes/ArenaScene.ts:10152-10160`). The server additionally applies class/grip-specific combat modifiers in `weaponRecoveryMult` (`packages/server/src/rooms/GameRoom.ts:3236-3246`) on all accepted attack families (`5860-5968`, `7298-7326`, `8019`). Those modifiers are not theoretical: the wardrobe/identity gear catalog supplies non-default cooldown modifiers (`packages/shared/src/gear.ts:569,701,830,964,1230,1363,1495,1626`).

**Risk:** A cooldown buff makes the client send too slowly, so the player cannot realize the authoritative fire rate; a future debuff can create predicted attacks that authority rejects as ghosts. The comments claim WYSIWYG while the implementations no longer match.

**Concrete recommendation:** Remove the second formula. If wardrobe modifiers are being retired, first remove them from authoritative combat and then make the client consume the shared accepted-interval descriptor. If they remain temporarily, sync a compact effective recovery multiplier/next-accepted tick owned by the server and let the client use it only to schedule prediction. Put tick quantization and weapon-family branching in one shared pure function (building on `packages/shared/src/combat.ts:89-101`) and cover every weapon delivery family in a parity test.

### P1.3 - Art-derived presentation scale is authoritative gameplay input

**Evidence:** `characterScale` is generated by measuring sprite-part footprints from ignored ArtKit outputs (`tools/artkit/gen-character-roster.mjs:23-24,55-86,147-150`). The client uses it to scale the rig (`packages/client/src/scenes/ArenaScene.ts:4396-4397`), but the server also passes it into authoritative ultimate, beam, gun, and cast muzzle-world calculations (`packages/server/src/rooms/GameRoom.ts:6717-6726,8443-8467,10646-10670,10851-10860`). Melee follows a different policy: the authoritative envelope uses its default scale (`GameRoom.ts:7411-7416`), and `SpriteRig` counter-scales weapon art to keep weapon size fixed across body scale (`packages/client/src/entities/SpriteRig.ts:10400-10401,10632-10633`).

**Risk:** Re-slicing or re-generating character art can silently move authoritative projectile and beam origins while other combat geometry remains fixed. Because the generator's art inputs are untracked and its check can skip, this per-character balance input is neither reviewable from tracked source nor stable across regeneration.

**Concrete recommendation:** Split the concept into `presentationScale` (client-only, art-derived) and tracked `CharacterGameplayGeometry` (collision radius, melee policy, and explicit hand/muzzle socket scale or a deliberate fixed 1.0 value). Authority must use only tracked gameplay geometry. If WYSIWYG requires a larger body's hand to move the projectile origin, author that offset explicitly beside character gameplay data and test it; never infer it from PNG bounds.

### P1.4 - Whole-art characters are an exception inside a boilerplate/wardrobe rig, and the exception is not stable

**Evidence:** `ArenaScene` still defines one `PLAYER_SPRITE = "drifter"` (`packages/client/src/scenes/ArenaScene.ts:377`). Creation identifies whole-art characters by the naming prefix `proto-`, selects either the character or the Drifter, and conditionally attaches gear (`4358-4397`). On subsequent syncs, however, it calls `rig.equipSyncedGear(...)` *before* checking the same prefix (`8993-9017`). With non-empty gear strings, that method calls `equipGearLoadout` (`packages/client/src/entities/SpriteRig.ts:2887-2909`), which requests the boilerplate and retargets the retained body/head/limbs (`2912-2959`, `2597-2743`). The rig itself also contains prefix policy (`2420`), calls a general character head `boilerplateHead` (`1949`, `2480-2484`), and mixes manifest-head and boilerplate-head placement in one pose method (`7823-7861`). The stale player-gallery copy still declares identities “wardrobe-only” (`packages/client/src/scenes/ArenaScene.ts:8979`).

**Risk:** Whole authored characters remain coerced into an articulated body/head/hands/feet contract, while one later reconciliation pass can reinstall the boilerplate/gear path. Every new rendering kind requires edits in the scene and the 10.9k-line rig. Naming convention, state reconciliation, asset completeness, equipment, and pose capability are entangled.

**Concrete recommendation:** Add a generated, tracked `CharacterRenderSpec` keyed by every playable character:

- `kind: "articulated" | "whole"`;
- required assets and bounds;
- explicit weapon/hand/muzzle sockets;
- supported pose capabilities and layer policy;
- `supportsWardrobe: boolean`;
- `presentationScale`.

Create an `AvatarVisual` interface (`root`, `destroy`, `setPose`, `setFacing`, `setWeapon`, `setTint`, socket queries) and a factory with separate `ArticulatedCharacterVisual` and `WholeCharacterVisual` implementations. Make wardrobe an optional decorator available only when the spec permits it; a whole-character implementation must not expose `equipSyncedGear`. `ArenaScene` should reconcile only character ID/spec identity, not prefixes or gear mechanics. Add a generated completeness check for every playable ID and a client integration test proving each resolves an asset and that whole-character reconciliation never requests boilerplate textures.

### P1.5 - `gen:check` can be green while skipping two tracked-output comparisons

**Evidence:** The root CI runs `pnpm gen:check` as a required gate (`.github/workflows/ci.yml:31-35`; `package.json:20-21`). The character generator exits successfully without comparing `characters.ts` whenever any ignored `out/*/parts/parts.json` is absent (`tools/artkit/gen-character-roster.mjs:23-30`). The VFX-subject generator does the same for missing ignored weapon references (`tools/artkit/gen-vfx-subjects.mjs:69-78`). In this checkout, `pnpm gen:check` exited 0 while explicitly skipping the character comparison for 4 artifacts and the VFX comparison for 10.

**Risk:** CI's green status is weaker than its comments promise. A hand edit or stale generated character/VFX file can merge undetected on a fresh checkout, and the character output includes gameplay kits as well as presentation scale (`tools/artkit/gen-character-roster.mjs:88-150,153-205`).

**Concrete recommendation:** Make every CI generator reconstructible from tracked canonical inputs. Check in compact geometry metadata needed for roster/scale generation (not raw art), and make VFX subject generation consume tracked reference descriptors. A missing prerequisite in `--check` must fail, not skip. If an artifact cannot be reproduced in ordinary CI, remove that artifact from the umbrella “all generated outputs are current” claim and create a separately named, visibly non-green completeness gate until it can.

### P1.6 - The sprite-manifest installer treats generated output as source and fails open to destructive replacement

**Evidence:** `harvest-install.mjs` reads and regex-normalizes the existing generated `manifest.ts` to preserve prior entries (`tools/artkit/harvest-install.mjs:181-195`). Any parse error is swallowed and resets `existing = {}` (`196-198`), after which only the newly harvested entries are written (`201-232`).

**Risk:** A harmless formatting or syntax change in the generated TypeScript can make a one-character install silently erase every other sprite manifest entry. Generated output is acting as an incremental database, so there is no independent canonical source from which to recover or review the intended set.

**Concrete recommendation:** Introduce a tracked JSON manifest (or deterministically scan tracked installed asset metadata) as the only input, generate TypeScript from it, and fail closed on parse/schema errors. Write to a temporary file, validate the full subject census and all referenced assets, then atomically replace the output. Add `--check`; never parse the generated TypeScript to reconstruct source state.

### P1.7 - Schema compatibility is checked too late and does not actually stop an incompatible client

**Evidence:** `ArenaState.schemaVersion` is the first field and comments promise corruption prevention (`packages/shared/src/state.ts:671-675`), but the client checks it only on the first decoded state (`packages/client/src/scenes/ArenaScene.ts:4307-4323`). It ignores `0`/missing versions because of `if (sv && ...)`, and on mismatch merely changes status text and logs; it still applies the dev launch and leaves patch consumers active (`4315-4321`). `SCHEMA_VERSION` is a hand-maintained literal (`packages/shared/src/constants.ts:11-13`).

**Risk:** An incompatible schema may already have been reflected incorrectly before the first field is inspected, and the client continues operating after detecting the mismatch. The documented safety property is false.

**Concrete recommendation:** Reject incompatible clients before state subscription: include protocol/schema version in room metadata or join authentication, validate it in `onAuth`/`onJoin`, and return a structured incompatibility error. As defense in depth, the client must use strict `sv !== SCHEMA_VERSION`, gate every state consumer until accepted, immediately leave the room on mismatch, and present a blocking reload screen. Keep one protocol-version definition and add a compatibility handshake test using mismatched client/server fixtures.

### P1.8 - Message contracts and ingress policy are stringly typed and already inconsistent

**Evidence:** About 30 server handlers are registered inline across `GameRoom.onCreate` (`packages/server/src/rooms/GameRoom.ts:1435-2319`); client sends are scattered through `ArenaScene` (`2788`, `4547-4716`, `10087-10590`, `15146-15162`, `15673`). Owner messages accept `type: string, payload: unknown` (`packages/server/src/rooms/GameRoom.ts:3467-3470`), while most client receivers decode `unknown` (`packages/client/src/scenes/ArenaScene.ts:4251-4289`; `packages/client/src/scenes/MenuScene.ts:695-710`). The server's stated invariant says every gameplay RPC except input spends an action token (`GameRoom.ts:1379-1387`), but `bagStore`, `bagEquip`, `sellWeapon`, and `buyUpgrade` mutate schema/account state without `takeAction` (`1720-1802`, `1961-2008`).

**Risk:** Renames and payload changes have no compile-time coverage across the network boundary. Validation, rate limiting, host/dev gating, and acknowledgements are enforced ad hoc, which has already created an event-loop/account-mutation spam path for modified clients.

**Concrete recommendation:** Define versioned `ClientMessages` and `ServerMessages` maps in shared, with runtime validators for every untrusted payload. Wrap registration and sending in generic typed helpers. The registration wrapper should enforce action budget by default and require an explicit `budget: "input" | "action" | "exempt"` declaration plus mode/host/dev policy. Convert the four unbudgeted mutations first, then add a protocol-surface test that every production send/receive pair is typed and every exemption is named.

### P1.9 - Wardrobe retirement crosses account persistence, authority, schema, rendering, UI, assets, and generators

**Evidence:** The “113 pieces” are not isolated content. The shared catalog and runtime occupy `packages/shared/src/gear.ts:93-2358`, with the 113-row census pinned at `packages/server/src/rooms/progression.test.ts:438-450`. Account persistence carries `ownedGear` and `equippedGear` through creation and migration (`packages/shared/src/meta.ts:111-123,175-176,243-313`). Schema publishes wardrobe strings inside `DualWieldState` (`packages/shared/src/state.ts:61-75,249-267`). Server authority retains `gearRuns`, snapshotting, join resolution, combat modifiers, and legacy shop grants (`packages/server/src/rooms/GameRoom.ts:1097-1098,1961-2008,3236-3246,3335-3380,4269-4271,4358-4363`). Client cost includes most of the Menu wardrobe workspace (`packages/client/src/scenes/MenuScene.ts:215-273,1079-2000`), the wardrobe model/layout/preview modules, `SpriteRig`'s boilerplate/gear paths, `packages/client/src/sprites/gear-parts.ts`, `gear-texture-baker.ts`, `ui/remote-gear.ts`, wardrobe input/audio branches (`packages/client/src/input-routing.ts:69,146-150`; `packages/client/src/audio/AudioBus.ts:1668-1669`), 104 tracked gear image files (about 20.5 MB), a 592,719-byte forced-tracked manifest under otherwise ignored `tools/artkit/out`, and `tools/artkit/gen-gear.mjs`.

**Risk:** Deleting the visible wardrobe UI would leave gear-owned stats, account fields, network payload, boilerplate replacement, and codegen alive. Conversely, deleting schema fields in place would shift Colyseus field indexes. Keeping the half-retired system preserves the dominant coupling that blocks whole-character rendering.

**Concrete recommendation:** Retire it in this order:

1. Define the replacement identity/stat source and add a `MetaAccountV5` migration that preserves unrelated scrip, pets, bank, and prestige while dropping `ownedGear`/`equippedGear`.
2. Remove gear-derived combat modifiers, `gearRuns`, join snapshotting, and legacy upgrade grants; publish empty wardrobe strings.
3. Switch all characters to the new render-spec/`AvatarVisual` path, then remove Menu wardrobe modules, remote gear reconciliation, baker/cache, catalog, assets, generator, and wardrobe-only tests.
4. Keep the decorated `gearUpper`/`gearLower` positions as named empty tombstones until a coordinated major schema reset. Do not physically delete or reorder them in the current protocol.
5. After the migration window, retain at most a small old-ID migration table; do not retain the 113-piece gameplay/art catalog.

## P2 findings

### P2.1 - One production client import escapes the package boundary into ignored tool output

**Evidence:** `packages/client/src/sprites/gear-parts.ts:3` imports `../../../../tools/artkit/out/gear/gear-parts-manifest.json`. `.gitignore:11` ignores all of `tools/artkit/out`; this single 592,719-byte file is force-tracked. The package manifests otherwise preserve `shared <- server/client <- desktop` direction (`packages/shared/package.json:2-20`; `packages/server/package.json:2-15`; `packages/client/package.json:2-15`; `packages/desktop/package.json:2-16`).

**Risk:** Client production compilation knows the root tool layout and relies on a path whose parent is documented as disposable output. Moving or packaging the workspace independently can break it, and accidental ignored siblings are invisible to package tooling.

**Concrete recommendation:** While wardrobe remains, generate/copy the validated runtime manifest into `packages/client/src/generated/gear-parts.generated.json` and make the client package own it. Add an export/build check that forbids production imports outside the importing package except declared workspaces. Delete the artifact with the wardrobe retirement.

### P2.2 - State rows mix wire DTOs, server runtime, and unrelated tail concerns

**Evidence:** `ArsenalSlot` places decorated wire fields and thirteen undecorated cooldown/bank/provenance fields on the same Schema object (`packages/shared/src/state.ts:9-31`). `PlayerState` similarly mixes 64 direct wire fields, compatibility getters, and server-only identity/allocation state (`86-239`, `240-360`). `DualWieldState` contains dual-wield fields, wardrobe strings, weapon resource, and prestige (`61-75`). This packing exists because PlayerState reached Colyseus's 64-field ceiling (`33`, `61`, `238-245`).

**Risk:** Developers cannot tell from a `PlayerState`/`ArsenalSlot` property access whether it is replicated, client-visible, or server-only. `DualWieldState`'s name lies about most of its data, and adding fields becomes opportunistic rather than domain-driven.

**Concrete recommendation:** Keep nesting, but separate server runtime into plain server-side records/maps keyed by player/slot identity. At the next coordinated schema version, introduce semantically named nested rows such as `CombatLoadoutState`, `PresentationState`, and `ProgressionState`, or at minimum rename the tail to `PlayerTailState`. Generate or lint a wire-field inventory so undecorated properties cannot quietly accumulate on Schema classes.

### P2.3 - Shared Schema classes expose getters that decoded clients provably do not have

**Evidence:** The code documents that joining without a root constructor yields plain reflected rows, so `PlayerState` getters exist only on server-created instances (`packages/shared/src/state.ts:240-245`). The prior unguarded getter use black-screened joins (`packages/client/src/scenes/ArenaScene.ts:4365-4368`), and client code now manually reads `player.dualWield?.…` (`4369-4370`, `9000-9010`).

**Risk:** The exported `PlayerState` type implies a runtime API the client does not receive. Any new client caller can compile against getters and fail only at runtime.

**Concrete recommendation:** Export a structural `DecodedPlayerRow`/`DecodedArenaRow` for client consumption and boundary accessor functions that operate only on wire shape. Keep server helpers on a server-side facade or free functions. Join with a root schema constructor only if Colyseus 0.16 reflection behavior is tested and intentionally adopted; do not rely on prototype getters by type assertion.

### P2.4 - Literal census guards conflate integrity with a historical content milestone

**Evidence:** Importing `weapon-resource.ts` throws unless there are exactly 343 durable weapons and exactly 334 active plus 9 archived (`packages/shared/src/weapon-resource.ts:284,308-320`). The same literals recur in tests and generated portal copy (`tests/w4a-weapon-archive.test.ts:41-47,78-85`; `tests/v61-brutalist-greatswords.test.ts:38-41,138`; `tests/v3x-auto-rifles.test.ts:36`; `tests/weapon-resource.test.ts:22-23`). Gear generation similarly throws unless its launch table is exactly 96 rows (`tools/artkit/gen-gear.mjs:353-354`), while tests separately pin 96 and 113 (`packages/server/src/rooms/progression.test.ts:438-450`).

**Risk:** A legitimate addition crashes module import until unrelated runtime code, tests, portal strings, and generator literals are all updated. Duplicated milestones look like invariants and make drift fixes noisy.

**Concrete recommendation:** Runtime guards should assert relational invariants: unique/stable IDs, every active/archive ID resolves, active and archive sets are disjoint, their union equals durable, and every consumer derives from the same registry. If a release requires an exact marketing/content count, generate one census artifact from the registry and assert it in one release-contract test; derive portal copy and UI sizes from that artifact.

### P2.5 - Generated/source ownership is only partially legible

**Evidence:** Some outputs use `*.generated.ts`, while other generated files use ordinary names with only a banner: `packages/client/src/sprites/manifest.ts:1`, `packages/shared/src/characters.ts:1`, `packages/client/src/sprites/card-manifest.ts:1`, and `projectile-manifest.ts:1`. The generated character file contains a hand-maintained 40-kit table embedded in its generator because an earlier generator erased it (`tools/artkit/gen-character-roster.mjs:88-150`). The root `gen` command covers the main catalogs but not every asset-specific installer/output (`package.json:20-21`).

**Risk:** Maintainers cannot infer edit ownership from the path, and content authorship is hidden in executable generator code. New generated artifacts can miss the umbrella check without detection.

**Concrete recommendation:** Adopt one convention: all output under package-local `generated/` or named `*.generated.*`, with a machine-readable registry listing output, canonical inputs, generator, and check command. Put authored character kits in tracked data, not an `.mjs` body template. Have `gen:check` enumerate the registry and fail if a generated banner is found outside it.

### P2.6 - The message surface contains unpaired legacy endpoints

**Evidence:** The server still accepts `cycleSlot`, standalone `jump`, and `sellStashEntry` (`packages/server/src/rooms/GameRoom.ts:1700,1804,2185`) with no production client sender found; jumping now rides the sequenced input command (`packages/client/src/scenes/ArenaScene.ts:15673`). The server sends `stashSaleReceipt`, `expeditionAbandonReceipt`, and `weaponArchiveSalvageReceipt` (`GameRoom.ts:1825,1838,4332-4338`) with no production client receiver; active client receivers are listed at `ArenaScene.ts:4251-4289` and `MenuScene.ts:695-710`.

**Risk:** Dead protocol paths remain attack/test surface and obscure which account operations are actually user-visible.

**Concrete recommendation:** Delete endpoints after confirming no supported old client needs them, or mark them explicitly as legacy with an expiry version and compatibility test. The typed protocol registry from P1.8 should fail CI for a sender/receiver with no counterpart unless it carries an audited `oneWay`/`legacy` annotation.

### P2.7 - Secondary oversized modules should be split along already-visible domain boundaries

**Evidence:** `packages/client/src/audio/AudioBus.ts:528-1762` is a 1,235-line `play(event: string)` dispatcher. `packages/server/src/rooms/BossController.ts` combines worm path/runtime (`203-1417`), segmented action scheduling (`1433-1634`), worm direction (`1637-1789`), the generic boss controller (`1791-2191`), and Vastaghar (`2273-3559`). `MenuScene.ts` is approximately 2.9k lines, with wardrobe fields and methods occupying much of `215-2000`.

**Risk:** These files are the next concentration points after the core trio, and `AudioBus` repeats the same string-dispatch weakness as network protocol.

**Concrete recommendation:** Replace the audio switch with typed `AudioEvent -> recipe` tables plus small voice/loop/music managers. Put each bespoke boss encounter and scheduler in its own module and retain `BossController` as the generic orchestrator. Do not spend effort extracting Menu wardrobe code: delete it through P1.9, then reassess the smaller scene.

### P2.8 - Full-state sync has a documented scale ceiling but stale documentation understates current load

**Evidence:** `ArenaState` broadcasts full maps for players, enemies, pickups, projectiles, and zones (`packages/shared/src/state.ts:671-680`). The state comment says Tier 2/3 horde and bullets “come later,” even though projectile/enemy maps are present, and says StateView/AOI is required before a ten-player load test (`77-84`). `tick` intentionally changes every simulation step so every patch sends (`728-732`).

**Risk:** At the intended 2-4-player scope this can be acceptable, but the comment no longer describes the implementation and there is no architectural isolation boundary if enemy/projectile density or player count grows. A global 20 Hz change also prevents fully idle patches.

**Concrete recommendation:** Correct the capacity contract now: record supported player/entity budgets and measure patch bytes/second under the bullet-heaven stress fixture. Before increasing those budgets, introduce StateView/AOI for transient entities or replace per-projectile Schema rows with compact event/batch replication. Keep deterministic seeds and low-churn arena data global.

### P2.9 - Error handling preserves process uptime but can continue a corrupted room

**Evidence:** `GameRoom.onUncaughtException` only logs and returns (`packages/server/src/rooms/GameRoom.ts:5273-5279`), despite exceptions potentially occurring mid-message or mid-simulation mutation. `SpriteRig` throws for missing manifest/body (`packages/client/src/entities/SpriteRig.ts:2414-2415,2477-2478`) and `ArenaScene.addBlob` has no local fallback. Gear bake failures only warn and preserve the prior rig (`SpriteRig.ts:2943-2957`).

**Risk:** A partial authoritative mutation can leave a room running with broken invariants, while one bad character manifest can still turn a content omission into a client scene failure. Logs alone do not define recovery.

**Concrete recommendation:** Distinguish rejected input from invariant failure. Validate payloads before mutation; if an unexpected exception escapes a simulation/message transaction, mark the room unhealthy, stop its simulation, notify/disconnect clients with a stable reason, and emit structured telemetry. On the client, completeness checks should prevent missing avatars, but runtime should still instantiate a conspicuous `MissingAvatarVisual` rather than throwing out of player reconciliation.

### P2.10 - Shelved belt mode remains interleaved with the primary arena mode

**Evidence:** Menu code states belt is shelved and URL/dev-only (`packages/client/src/scenes/MenuScene.ts:441-445,501`) but still launches it at `2772-2900`. Belt-specific state, UI, camera, progression, shops, and simulation branches remain spread throughout `ArenaScene` and `GameRoom` rather than behind a mode interface (`packages/shared/src/state.ts:742-760` begins the belt state tail).

**Risk:** This is not proven dead code, but a shelved mode continues multiplying branches in both god files and complicates every extraction.

**Concrete recommendation:** Make an owner decision. If belt remains a testable alternate mode, isolate it behind `RunMode` client/server strategies and exclude it from arena-only systems. If it is abandoned, remove its messages, state consumers, map/runtime code, and tests in one protocol-versioned deletion; keep any occupied schema indexes as tombstones until the major reset.

## Naming and consistency notes

- `DualWieldState` is a packed player-tail envelope, not a dual-wield model (`packages/shared/src/state.ts:61-75`); rename it on the next schema break.
- `boilerplateHead` can hold an authored character head (`packages/client/src/entities/SpriteRig.ts:1949,2480-2484`); the name encodes an obsolete rendering assumption.
- Generated `characters.ts` describes roster entries as cosmetic/purely visual (`tools/artkit/gen-character-roster.mjs:153-156`), but the same output owns stat spreads/quirks and `runCharacter` drives combat progression (`packages/shared/src/characters.ts:54-156`; `packages/server/src/rooms/progression.ts:77-105`). Rewrite the contract when moving authored kit data.
- `packages/client/vite.config.ts:15-17` says shared is consumed as TypeScript source, but `@dd/shared` exports only `dist/index.js`/`dist/index.d.ts` (`packages/shared/package.json:6-12`) and root development scripts build/watch that dist (`package.json:12-15`). Correct the comment or add an explicit source alias; do not leave build behavior implicit.
- Wire tombstones such as `flexTimerLegacy`, `elapsedLegacy`, and `bossSlamX/Y/T` are not ordinary dead code (`packages/shared/src/state.ts:118-122,692-695,720-737`). Keep them until the coordinated schema reset, but label them uniformly and exclude them from domain APIs.

## Pruning inventory

Prune after dependencies/migrations are removed:

- the full wardrobe catalog/runtime (`packages/shared/src/gear.ts`), account gear fields/migrations in `meta.ts`, server gear snapshots/modifiers/grants, Menu wardrobe workspace, `ui/wardrobe/{model,layout,preview}.ts`, `ui/remote-gear.ts`, `sprites/gear-parts.ts`, `sprites/gear-texture-baker.ts`, wardrobe input/audio routes, wardrobe-specific tests, `tools/artkit/gen-gear.mjs`, `tools/artkit/lib/gear-replacement-contract*`, `tools/artkit/out/gear/gear-parts-manifest.json`, and `packages/client/public/sprites/gear/**`;
- unpaired `cycleSlot`, standalone `jump`, and `sellStashEntry` handlers plus the three unconsumed receipts, subject to an explicit supported-old-client check;
- stale wardrobe-only gallery copy and obsolete schema/tier comments;
- either the shelved belt system as a coordinated removal, or its conditional branches from shared core classes after it becomes an isolated strategy.

Do **not** prune decorated schema tombstones in place. Do not delete `gearUpper`, `gearLower`, `flexTimerLegacy`, `elapsedLegacy`, or `bossSlamX/Y/T` until a major protocol reset allows field-index replacement.

## Top 5 structural moves, in order

1. Land the explicit `CharacterRenderSpec` + `AvatarVisual` abstraction, separate gameplay geometry from presentation scale, and route whole-art characters completely outside wardrobe/boilerplate code.
2. Execute the wardrobe retirement as a persistence-to-authority-to-client migration, preserving current wire indexes as empty tombstones.
3. Introduce a typed, runtime-validated, versioned message registry and enforce the schema version before state subscription; centralize action-budget policy in registration.
4. Split `GameRoom`, `ArenaScene`, and `SpriteRig` at the concrete ownership seams above, with characterization tests and one mutation owner per system.
5. Make generation closed and reproducible from tracked canonical inputs, fail on missing prerequisites, replace output-as-input manifests, and derive censuses/copy from one registry.

Verdict: The package layering is fundamentally salvageable, but the current runtime is structurally brittle; character rendering, wardrobe retirement, protocol typing, god-file decomposition, and reproducible codegen should be treated as one ordered stabilization program before the next major content wave.
