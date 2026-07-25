# B43 Split Monoliths Implementation Report

- Agent: Sol `impl-b43-split-monoliths`
- Branch: `sol/b43-split-monoliths`
- Base: `03b6f43`
- Scope: behavior-preserving, move-only extraction of `SpriteRig.ts` and `GameRoom.ts`

## Result

The two monoliths are now thin state/lifecycle shells whose original import paths and public exports
remain intact. Method implementations live in typed prototype groups. At module initialization the
shells install the original property descriptors in their original order, so call shape, receiver
identity, enumerability, getters, and method dispatch remain unchanged.

The move audit compared all 162 `SpriteRig` method bodies and all 294 `GameRoom` method bodies
against the base blobs byte-for-byte. There were zero missing, extra, or changed bodies. The only
production additions outside those bodies are typed receiver/context declarations, descriptor
wiring, internal static aliases, and source-ownership trace comments required by existing
source-inspection tests.

## Module map and line counts

`SpriteRig.ts` was 12,420 lines at the branch base and is 1,728 lines after extraction.

| Module | Lines | Ownership |
| --- | ---: | --- |
| `packages/client/src/entities/SpriteRig.ts` | 1,728 | State, constructor, callable declarations, public barrel, descriptor installation |
| `packages/client/src/entities/rig/rig-core.ts` | 3,174 | Shared rig types/helpers, skeleton/base transforms, facing/mirror, internal context/statics |
| `packages/client/src/entities/rig/rig-pose.ts` | 3,744 | Pose language, idle/grip anchors, and the atomic per-frame pose writer |
| `packages/client/src/entities/rig/rig-combat.ts` | 3,322 | Combo transforms, melee presentation, attack source presentation |
| `packages/client/src/entities/rig/rig-gun-mechanisms.ts` | 996 | Firing stance and bolt/lever/pump/break/hammer/twirl mechanisms |
| `packages/client/src/entities/rig/rig-flourish.ts` | 654 | Draw/stow/flourish arming, cancellation, and streak state |
| `packages/client/src/entities/rig/rig-gear.ts` | 1,557 | Heads, gear, hats, wrap/glove receivers, render-stack assembly |

`GameRoom.ts` was 14,978 lines at the branch base and is 2,117 lines after extraction.

| Module | Lines | Ownership |
| --- | ---: | --- |
| `packages/server/src/rooms/GameRoom.ts` | 2,117 | Colyseus shell, state fields, lifecycle adapters, callable declarations, descriptor installation |
| `packages/server/src/rooms/room/room-movement.ts` | 1,031 | Fixed movement step, command authority/envelopes, belt clamps, pit movement |
| `packages/server/src/rooms/room/room-combat.ts` | 5,745 | Swing/fire/cast resolution, projectiles/beams/zones, hit envelopes, parry and ult charge |
| `packages/server/src/rooms/room/room-enemies.ts` | 3,438 | Spawn director, enemy tokens/AI, commit-melee families, boss glue |
| `packages/server/src/rooms/room/room-economy.ts` | 1,997 | Chests, relics, pickups, money, disassembly, banking and settlement |
| `packages/server/src/rooms/room/room-progression.ts` | 5,001 | Shared room types/helpers/context, lifecycle wiring, floors/elevators, depth and run lifecycle |

## Boundary deviations

- `rig-core.ts` and `room-progression.ts` are also the internal dependency bases. Shared private
  types, pure helpers, primitive statics, and receiver contracts live there so feature modules never
  import the shell or one another.
- The full `SpriteRig.animate` transform pass remains in `rig-pose.ts`. It is one ordered writer of
  pose, facing, procedural motion, attachment, and final render transforms; subdividing the body
  would have introduced new call boundaries and violated the move-only mandate.
- Projectile, beam, ground-zone, parry, and ultimate-hit helpers remain together in
  `room-combat.ts`. Their hit-envelope and resource-clock state is mutually coupled, so splitting
  that block further would create cross-feature calls or logic edits.
- `room-progression.ts` owns `onCreate`, `stepSim`, and shared run orchestration in addition to
  floors/elevators. The shell retains thin lifecycle adapters required by TypeScript's Colyseus
  override checks; the moved descriptors replace those adapters at runtime.

## Test split

The 7,426-line `GameRoom.test.ts` was split by complete, unchanged `describe` blocks. Shared imports
and harness helpers were duplicated so each file is independently runnable; assertion text was not
edited.

| Test file | Lines |
| --- | ---: |
| `GameRoom.combat.test.ts` | 1,047 |
| `GameRoom.combat-safety.test.ts` | 1,059 |
| `GameRoom.combat-weapons.test.ts` | 1,453 |
| `GameRoom.economy.test.ts` | 1,405 |
| `GameRoom.economy-bank.test.ts` | 1,378 |
| `GameRoom.economy-pets.test.ts` | 1,192 |
| `GameRoom.enemies.test.ts` | 1,105 |
| `GameRoom.movement.test.ts` | 1,164 |
| `GameRoom.progression.test.ts` | 1,251 |
| `GameRoom.progression-late.test.ts` | 1,431 |

Existing source-inspection fixtures were redirected to the owning extracted modules. Where a
fixture spans several seams it concatenates those sources before running its original assertions.
No unit-test assertion changed.

## Import graph

The extracted graph was enumerated from relative import specifiers:

```text
SpriteRig.ts
├── rig-core.ts
├── rig-pose.ts ───────────────┐
├── rig-combat.ts ─────────────┤
├── rig-gun-mechanisms.ts ─────┼──> rig-core.ts
├── rig-flourish.ts ───────────┤
└── rig-gear.ts ───────────────┘

GameRoom.ts
├── room-progression.ts
├── room-movement.ts ──────────┐
├── room-combat.ts ────────────┤
├── room-enemies.ts ───────────┼──> room-progression.ts
└── room-economy.ts ───────────┘
```

`rig-core.ts` and `room-progression.ts` have no imports within their respective split graphs.
No feature module imports a sibling or its shell. Both graphs are therefore acyclic, with maximum
depth two from the compatibility shell.

## Verification

| Check | Result |
| --- | --- |
| Bisectability | Each of the client extraction, server extraction, test split, and fixture-followup commits passed `pnpm typecheck` |
| `pnpm typecheck` | Pass |
| `pnpm test` | Pass: 205 files, 2,386 tests |
| Assertions | Unchanged; only moved-test/source-fixture ownership paths and harness duplication changed |
| `pnpm gen` | Pass; no tracked diff |
| `pnpm gen:check` | Pass |
| `pnpm assets:check` | Pass: 479 entries / 1,011 parts, 635 atlas frames, 320 cards |
| LF/schema/API | LF diff check clean; no schema change; original shell export paths compile and pass the full suite |

The Playwright sweep used only its managed ephemeral stack; no persistent live stack was booted.
The combined run passed B22, the current B23 successor, B29, and all four B34 tests. Its shared
private ports were client/game `59583`/`59582`; B34's dedicated transition fixture used
`62791`/`62790`. The current repository no longer contains `b23-kungfu-v2-live-gate.spec.ts`;
`b25-kungfu-v3-live-gate.spec.ts` supersedes it and retains explicit B23 cadence baselines, so that
current gate was used for the B23 cross-check.

The black-screen smoke exposed its existing first-run input-readiness race twice: it can observe the
joined player before the Phaser key edge is ready, causing its immediate `H` to open rather than
close the blocking legend. The same assertions passed on an isolated fresh ephemeral stack
(game port `57079`) after a 500 ms pre-key synchronization delay, including the real
`toggleTraining` round trip and dummy synchronization. After removing that diagnostic delay, a final
unchanged stock-spec rerun passed on a fresh ephemeral stack (game port `51099`, 10.1 seconds) once
the source cache was warm. The delay and all evidence-redirection edits were removed after the
sweep; no e2e test change is in this branch.

## Commits

- `dc0d810` — `refactor(client): split SpriteRig prototype modules`
- `9ac832f` — `refactor(server): split GameRoom prototype modules`
- `af090b3` — `test(server): split GameRoom regression suite`
- `29cc802` — `test: follow extracted rig source ownership`

VERDICT: 11 modules extracted, SpriteRig/GameRoom line counts 12,420→1,728 / 14,978→2,117, tests untouched-green, gates green, 36 files touched.
