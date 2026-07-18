# Server architecture audit — 2026-07-18

Scope: static, read-only audit of `packages/server/src/**` on `feat/v0.118-metagame`. I did not run Git, tests, either dev server, or the render fleet. The known repository-wide Biome/CRLF debt is intentionally excluded.

## Responsibility and tick map

`GameRoom` is currently the transport endpoint, account boundary, session registry, run director, simulation coordinator, and almost every gameplay system. Its main responsibility bands are:

| Current span | Responsibility |
| --- | --- |
| `GameRoom.ts:946-1249` | Room fields, private runtime stores, host/dev/action admission |
| `GameRoom.ts:1251-2097` | Room creation and all 29 message registrations |
| `GameRoom.ts:2198-3380` | Arsenal/Drive state, weapon-bank run ledger, gear/pet snapshots, terminal metagame settlement |
| `GameRoom.ts:3396-4184` | Training/restart/run lifecycle, spatial grids, join/leave/session restoration |
| `GameRoom.ts:4188-5004` | Player action gates, Drive, traversal, slide/crouch/pound movement |
| `GameRoom.ts:5116-6121` | Fixed-step accumulator and the full ordered simulation pipeline |
| `GameRoom.ts:6123-8056` | Ultimates, attacks, beams, melee, damage delivery |
| `GameRoom.ts:8057-8778` | Boss-victory and XP-Echo lifecycle, level windows |
| `GameRoom.ts:8780-9440` | Boss adapter/sink and boss-world mutations |
| `GameRoom.ts:9440-12499` | Enemy archetypes, projectiles, loot, zones, belt/spawn directors |
| `GameRoom.ts:12515-12705` | Map minting, portals, extraction, descent/dimension transition |

The current `stepSim()` order contract (`GameRoom.ts:5133-6121`) is:

0. Refresh mutable dev/test POI index; increment tick; advance pet presence; refill budgets; consume/ack newest input; apply one-shot stance input; terminal guard; update boss-add budget/grid; accept traversal launches (`5135-5236`).
1. Integrate living-player movement and impulse (`5238-5379`).
2. Resolve player/player, POI/belt, slide, and pit collisions; then advance Vastaghar victory and XP Echoes (`5381-5524`).
3. Advance run clock plus belt/horde/boss/shifter/extraction/descent directors; age pickup grace (`5526-5570`).
4. Open the Drive transaction, age player combat clocks/vertical state, accept weapon attacks, step swept melee/quakes/ultimates, and commit Drive (the commit is hidden inside `stepUltimates` at `6851-6893`) (`5572-5849`).
5. Advance enemy effects/AI, duelists, boss, spitters, projectiles, zones, enemy collisions, POI/belt correction, and enemy pits (`5851-5981`).
6. Apply enemy contact damage (`5983-6031`).
7. Down/regen players, detect wipe, and advance burn/brand status (`6033-6117`).
8. Advance or time out level/augment windows (`6119-6120`).

Target extraction seams (preserve the order above before changing behavior):

| Module | Move into it | Keep in `GameRoom` |
| --- | --- | --- |
| `net/registerGameMessages.ts` | `onMessage` registration, runtime payload validators, common budget/host/dev admission, command DTOs | `onCreate` calls the registrar with narrow command ports |
| `sessions/PlayerSessions.ts` | Input queues, `freshInputState`, join/leave body reservation, host handoff | Colyseus lifecycle overrides and state attachment |
| `metagame/MetaAccountCoordinator.ts` | Account admission, gear/pet/run snapshots, weapon escrow, revisioned receipts, terminal settlement | Only the terminal outcome signal and owner-message transport |
| `systems/ArsenalDriveSystem.ts` | Slot/bag/pair operations, weapon identity transitions, Drive open/spend/commit, beam resource gates | Ordered calls at phase 4 boundaries |
| `systems/PlayerMotionSystem.ts` | Input consumption after admission, traversal/stance state, movement and player-world collision | Phase ordering and terminal guards |
| `systems/PlayerCombatSystem.ts` plus `systems/UltimateSystem.ts` | Buffered actions, deliveries/receipts, melee/beam/ultimate runtimes | Cross-system damage/terminal result port |
| `systems/XpEchoSystem.ts` | XP drops/flights/cleanup boundaries and level-window progression calls | Boundary-complete callbacks (`extract`, `descent`, boss clear) |
| `systems/EnemySimulation.ts` | Generic AI, duelists, projectiles, zones, collision and ordinary spawn director | Boss step position in phase 5 and terminal checks |
| `boss/GameRoomBossAdapter.ts` | `BossEmitSink` implementation and boss-specific world mutations | One active encounter handle and its phase-5 call |
| `systems/RunDirector.ts` | Training/restart, belt rooms, boss rush, shifters, portal/extraction/descent/map transitions | Authoritative state ownership and terminal outcome entry |

What should remain is deliberately small: Colyseus lifecycle, construction of narrow systems, `ArenaState` ownership, the fixed-step accumulator, the explicit phase list/early-terminal guards, and the single end-of-batch patch broadcast. Do not extract by handing every module the `GameRoom`; use small ports/scratch views, or the monolith merely becomes distributed.

## P0

### P0-1 — Production accepts client-forged v3/v4 metagame accounts and carry selections

Evidence: `packages/server/src/rooms/GameRoom.ts:3939-3948` says production should start from defaults, but the dev gate is applied only to legacy scalar fields; `GameRoom.ts:3959-3977` unconditionally sanitizes and installs any client-supplied v3/v4 account, and `GameRoom.ts:3992-4016` likewise accepts the client's carry transaction against it.

Why: A public client can submit a structurally valid account containing chosen owned gear, pet progress, scrip, prestige, and weapon-bank contents, so sanitization prevents malformed data but provides no ownership authority.

Fix recipe: Introduce one `trustClientMetagame = this.devToolsEnabled()` decision at join admission; when false, ignore `metaAccount`, `carry`, `selectedPetId`, `scrip`, and `up`, construct/load a canonical server-owned v4 account, and generate the empty carry server-side; when true, retain the local-playtest import path. Keep account format separate from trust (a default/authenticated v4 account must still take the gear-seeded path), then add a `NODE_ENV=production` join test that submits a maxed valid v4 blob plus carry and asserts default/server-owned values. Replace the temporary default with an authenticated account-store lookup later without reopening the client-trust path.

## P1

### P1-1 — Run directors and enemy targeting consume a pre-collision player snapshot

Evidence: `packages/server/src/rooms/GameRoom.ts:5382-5392` copies living positions into `bodies`, but player/player, POI/belt, and pit correction subsequently mutate the authoritative positions at `GameRoom.ts:5393-5517`; the stale array is then used for belt/extraction/spawn decisions at `GameRoom.ts:5526-5547` and enemy/boss targeting at `GameRoom.ts:5864-5914`.

Why: A collision push, obstacle correction, or pit snap can leave extraction/channel checks and the entire same-tick AI/boss aim phase acting on a position the player no longer occupies.

Fix recipe: Keep one reusable `playerIds`/`playerTargets` scratch, use it for phase-2 body solving, and refresh each retained `{x,y}` from `PlayerState` after all player-world/pit correction and before phase 3; after ultimates, update membership in both directions (remove newly untargetable Alpha Strike bodies and add bodies whose untargetability ended), then add regressions for a pit snap/extraction edge and a POI push/boss aim in the same tick.

### P1-2 — Gameplay message admission bypasses the declared action-budget invariant

Evidence: `packages/server/src/rooms/GameRoom.ts:1240-1248` defines `takeAction` as the budget for every non-input gameplay RPC, while `bagStore` (`1559`), `bagEquip` (`1580`), `sellWeapon` (`1608`), `buyUpgrade` (`1784`), and the expensive solo `restart` (`2015-2018`) omit it; even `attack` does a beam lookup/early return before spending at `1354-1359`.

Why: A modified client can repeatedly allocate/splice inventory rows, publish account state, or rebuild a solo run between ticks despite the server's stated flood-control policy.

Fix recipe: Add a typed `registerAction(type, {hostOnly, devOnly}, validate, handle)` wrapper that consumes the token before gameplay lookups/mutations and use it for every handler except `input`; immediately add `if (!this.takeAction(client)) return` to the five unbudgeted handlers, move attack's spend before the beam early return, and add a table-driven test asserting that `ACTION_MSGS_PER_TICK + 1` messages of every registered action execute at most the budget.

### P1-3 — Revisioned transaction handlers have incompatible replay and receipt semantics

Evidence: `sellStashEntry` checks its receipt cache before running the revisioned helper (`packages/server/src/rooms/GameRoom.ts:1650-1668`), while `prestigeReset` rejects a now-stale expected revision before looking up the cached request (`GameRoom.ts:1677-1685`), even though successful prestige advances the revision (`packages/server/src/rooms/progression.ts:452-470`); stash failures are also discarded at `GameRoom.ts:1664` although the helper constructs a typed failure result at `progression.ts:417-448`.

Why: Retrying a successfully applied prestige request with its original request ID is silently dropped instead of replaying the receipt, and failed mutations provide no deterministic client response.

Fix recipe: Centralize the order as `validate bounded requestId -> receipt replay -> account/revision/gate validation -> atomic mutation -> cache result -> send result + canonical account`; cache and send typed failure receipts as well as successes, cap/clear per-session receipt caches on leave/dispose, and test success replay after revision advancement plus stale/invalid failure replay for both stash sale and prestige.

### P1-4 — `GameRoom` has no enforceable subsystem boundaries around its phase-order contract

Evidence: `packages/server/src/rooms/GameRoom.ts:1-516` is a single 500-line dependency preamble, the class starts at `946`, handlers occupy `1251-2097`, and the ordered tick itself spans `5116-6121`; a concrete hidden dependency is Drive commit living inside `stepUltimates` at `6851-6893` rather than at the phase-4 orchestration site.

Why: Changes to inventory, movement, progression, boss logic, or an ultimate can silently reorder unrelated simulation work because shared mutable fields and terminal exits are reachable from almost every method.

Fix recipe: First replace the `stepSim` body with named private phase methods matching the observed 0-8 list without moving statements, and move Drive commit to an explicit `finally`-style phase-4 close; next extract the modules in the seam table in this report, one green test slice at a time, passing narrow ports (`damage`, `spawn`, `settle`, scratch targets) rather than the room object; leave `GameRoom` as lifecycle/phase orchestration only.

## P2

### P2-1 — The 20 Hz path follows allocation discipline inconsistently

Evidence: the room allocates fresh player arrays/vectors every tick at `packages/server/src/rooms/GameRoom.ts:5382-5392`, spreads map keys at `5853`, allocates `fellIn` at `5962`, creates a new collector `Map` at `8717`, creates projectile deletion and per-projectile kill arrays at `11575` and `11676`, spreads zoner keys at `11879`, and allocates zone deletion arrays at `11907`; generic boss hazards rebuild a `survivors` array every active tick at `packages/server/src/rooms/BossController.ts:1969-2023`, while the worm and Vastaghar paths deliberately preallocate scratch.

Why: Horde/projectile density turns routine 20 Hz work into avoidable short-lived garbage, increasing GC jitter precisely in catch-up batches where the fixed-step loop is already under load.

Fix recipe: Add reusable room fields for player IDs/targets, fallen enemies, projectile doomed/kills, zone doomed, and XP per-collector counts (clear lengths/maps, do not replace them); iterate `Map` keys directly when deleting stale entries; compact `BossController.active` in place with a write cursor; add a steady-state allocation benchmark/test around a dense 200-tick room and document that event-edge allocations are allowed but phase loops reuse scratch.

### P2-2 — Boss architecture is three parallel patterns in one append-only file, with dead wrapper surface

Evidence: `packages/server/src/rooms/BossController.ts:1791-2191` contains the generic controller after roughly 1,400 lines of worm runtime/scheduling, then an explicit "Append-only flagship wave" and a second mid-file import begin Vastaghar at `BossController.ts:2193-2211`, whose runtime starts at `2273`; `GameRoom.ts:12368-12421` constructs both a generic `BossController` and a separate Vastaghar runtime, while `GameRoom.ts:8794-8824` bypasses the generic controller for Vastaghar. Unused production APIs remain at `BossController.ts:1804-1815` (`name`, `isWormEncounter`), `1866-1872` (`startWormBurrow`, `acceptWormContact`), and the contact ledger they solely expose at `1641` and `1752-1757`.

Why: Encounter lifecycle, tick allocation, and damage hooks differ by boss type, and Vastaghar pays for a generic controller whose `step` is never its active encounter path.

Fix recipe: Split to `boss/BossEmitSink.ts`, `boss/GenericBossController.ts`, `boss/worm/{WormPathHistory,WormBossRuntime,SegmentedBossActionScheduler,WormEncounterDirector}.ts`, and `boss/vastaghar/VastagharEncounterRuntime.ts`, with a small barrel; replace the room's two nullable fields with one discriminated `ActiveBossEncounter` (`generic | worm | vastaghar`) exposing `step`, `dispose`, and optional damage/parry hooks; remove the generic Vastaghar allocation plus the unused getters/start/contact API, ledger, tests, and `WORM_CONTACT_EPOCH_TICKS` import unless segment contact is intentionally wired as an explicit phase-6 spatial query.

### P2-3 — `progression.ts` mixes three domains and therefore is not a usable boundary

Evidence: player level/allocation/ultimate mutation occupies `packages/server/src/rooms/progression.ts:53-148`, pet Bond banking occupies `150-192`, and revisioned weapon-bank/carry/sale/prestige transactions occupy `194-471`, producing a 51-symbol shared import block at `1-51`.

Why: A room-local "progression" module now couples per-tick player state to persistent account transactions, so changes to one domain pull the others into the same dependency and test surface.

Fix recipe: Move the first band to `progression/playerProgression.ts`, pet banking to `metagame/petBondSettlement.ts`, and lines 194-471 to `metagame/weaponBankTransactions.ts` with a private revision/request validator; retain `rooms/progression.ts` as a temporary re-export barrel for one change, update `GameRoom` imports, then delete the barrel once tests import the domain modules directly.

### P2-4 — Several old or unconnected server paths should be pruned now

Evidence: input documentation says jump rides the numbered command and is not separate (`packages/server/src/rooms/GameRoom.ts:569-587`), yet a standalone `jump` handler remains at `1982-1990`; `cycleSlot` exists at `1540-1555` although the production belt path uses indexed `swapSlot`; `sellStashEntry`/`stashSaleReceipt` exist only as server/test protocol at `1637-1669`, and `expeditionAbandonReceipt` is emitted at `4017-4019` without a production consumer. Server-private dead state includes `CombatState.respawn`/`reloadCd` (`724-731`, initialized at `4051-4054` but never read in production), `PetRunRuntime.stageBand`/`catalogVersion` (`657-672`, assigned at `3233-3240` but never read), and the completely uncalled `creditWeaponResource` method (`4298-4304`); `sanitizeMetaAccountV3` is also an unused import at `174`.

Why: Duplicate command routes, test-only protocol, and write-only tombstones falsely enlarge the supported server contract and force future refactors to preserve behavior no production path observes.

Fix recipe: Remove `jump` and `cycleSlot` handlers plus their legacy-only tests; either ship the stash-sale command/receipt in the next release or remove its handler/cache/types now (do not keep a server-only half-feature), and remove the unobserved abandon receipt send while retaining the canonical `metaAccount` update; delete the four dead runtime fields, their initialization/reset assertions, `creditWeaponResource`, and the unused v3 import. Keep shared schema tombstones out of this server-only cleanup unless the schema-owner audit separately authorizes their removal.

### P2-5 — The schema-31 room still carries an open-ended v2/v3 compatibility implementation

Evidence: `packages/server/src/rooms/GameRoom.ts:3904-3913` retains legacy `scrip`/`up` join options, `3943-3961` accepts v3 and builds a v2 fallback, `3980-3985` installs legacy upgrade fields, and `1794-1829` maintains a second `LEGACY_UPGRADE_GRANTS`/`upVitality`/`upFortune`/`upPower` purchase path beside gear-owned accounts.

Why: The compatibility branch duplicates identity/stat/account authority and is the branch that made the P0 trust check easy to misapply.

Fix recipe: After fixing P0, make server admission version 4 only, migrate any supported local v2/v3 data before room join, delete `scrip`/`up` and v2/v3 join sanitization from `GameRoom`, and make every canonical account use `resolveGearLoadout`; then remove the `gearRuns.has` compatibility fork in `buyUpgrade` and server-private legacy upgrade mutations while leaving any shared wire-field removal to the shared-schema owner.

## P3

### P3-1 — The main test harness is a second monolith coupled to private implementation

Evidence: `packages/server/src/rooms/GameRoom.test.ts:49-73` replaces Colyseus with a no-op stub and explicitly aliases the entire room to `any`, while `75-96` drives private `update` and maps; unrelated protocol, pet, gear, combat, boss, and Drive suites continue through at least `GameRoom.test.ts:5424-6782`, while the real transport test covers only matchmaking/input/leave at `packages/server/src/integration.test.ts:123-199`.

Why: The suite gives broad regression coverage but makes extraction mechanically hazardous and cannot type-check the narrow boundaries or most message/receipt behavior against real Colyseus semantics.

Fix recipe: Create typed `RoomTransportPort` and `SimulationClock` fakes, split tests beside the extracted modules (`messages`, `metagame`, `motion`, `combat`, `xp`, `enemy`), keep only lifecycle/order integration cases in `GameRoom.test.ts`, and add real-transport cases for production metagame admission plus one revisioned receipt replay; remove the `AnyRoom` escape as each boundary lands.

## Executive summary

1. P0: production currently trusts valid client-authored v3/v4 metagame and carry data despite comments promising server defaults.
2. P1: refresh player target scratch after collision/pit correction, centralize action admission, and make revisioned receipts replay-first and deterministic.
3. Reduce `GameRoom` to Colyseus lifecycle plus an explicit 0-8 phase coordinator; the table above names the extraction modules and ownership seams.
4. Split the three boss patterns and the three unrelated `progression.ts` domains, while reusing scratch in every steady-state 20 Hz phase.
5. Prune duplicate jump/cycle commands, unconnected receipts, legacy v2/v3 authority, dead runtime tombstones, and test-only boss APIs before adding more metagame surface.
