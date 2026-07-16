# Tech implementation plan: Vastaghar, the World-Tread

## Decision

Make the existing `world-titan` definition the flagship instance. Vastaghar already has the strongest one-fight premise in the project: a screen-filling lower body, four sliced feet, white footstep quakes that can be jumped or parried, and an existing boss definition built around a quickening march. The implementation should turn that premise into one authored dance rather than add another general-purpose boss.

The fight is three readable phrases:

1. **Learn the feet.** Alternating left/right steps teach jump versus parry and create a predictable rhythm.
2. **Turn the world.** The page folds, fault lines appear, and a planted full-revolution heel sweep introduces the painted-edge ribbon and per-revolution hit rule.
3. **Outrun the stride.** Faster steps lead into a two-revolution sweep. Each revolution is a separate dodge/parry problem, followed by a real punish window.

This is an optional tick-scripted encounter layered beside the current module scheduler. The other bosses must remain on their current `AttackModule` behavior until individually migrated. A rewrite of all bosses, a generic cutscene engine, physical camera authority, and a topology-changing arena wall are out of scope.

## What the current framework already gives us

| Capability | Current implementation | Use in Vastaghar |
|---|---|---|
| Deterministic cast geometry | A primitive builds one `CastPlan` from a per-trigger `mixSeeds` RNG stream. Telegraph and payload retain the same world coordinates. | Keep this invariant for every foot, fault, and sweep. |
| HP phases | `BossController.step()` selects the first `BossPhase.hpAbove` match and `enterPhase()` rebuilds module timers. | Preserve `bossPhase` as the public 1-based health phase; add a separate encounter mode. |
| Telegraph lifecycle | Pending casts drive `t` from 0 to 1. A resolved row is retained through one `broadcastGeneration`; a canceled row never reaches 1. | Keep this contract exactly. Presentation can distinguish resolve from cancel without guessing. |
| Telegraph vocabulary | Circle, ring, cone, rectangle, arc sweep, point warning; danger is white/parryable or red/dodge; `kindTag` selects client treatment. | Feet use white circles/arc edges; fault lanes use red rectangles; the sweep uses an exact arc/radial edge. |
| Diegetic anticipation | `TelegraphForeshadowPool` retains one image per row, has bounded milestone particles, and releases at `t=1`. `ArenaScene` also drives a generic boss brace from visible telegraphs. | Reuse the pool and milestone cadence. Replace generic brace inference with an owned, foot-specific action pose. |
| Active server hazards | Beam/ring/dash rows update geometry and damage at 20 Hz. | Copy the runtime shape for the heel sweep, but give it swept-angular hit testing and per-revolution hit sets. |
| Quake counter rules | `GameRoom` makes airborne players immune and a parry negates a footfall while feeding the existing parry chain. | Retain both answers; additionally return a cast-level counter result to the encounter. |
| Melee clock and painted edge | `SwingDescriptor`, `swingEdgeProgress()`, and `bladeAngleAt()` define a shared pose/active clock. `VfxPlayer` feeds that clock into the canonical painted-edge renderer. | Use the same clock/math for the heel sweep and expose one seekable boss ribbon surface. Do not invent a second visual clock. |
| Per-revolution damage precedent | `GameRoom.stepMeleeSwings()` clears a player's hit set when a spin crosses a completed revolution. | Use the same integer-revolution boundary rule for the two-turn enrage sweep. |
| Paper moments | `SpriteRig.playSpawnUnfold()` and `ArenaScene`'s bounded `capturePaperWorldFold()` / `playPaperWorldFold()` already exist, including reduced-motion fallback and keeping exact telegraphs above the page. | Give the titan a longer unfold and reuse the page snapshot machinery during server-safe phase breaks. |
| Resolution spectacle | `playFxPack()` has bounded optional packs including `quake-burst` and `nuke`; procedural exact telegraph effects remain underneath. | Quake accents on feet; one `nuke` accent at the final fold or defeat. Never put a component pack in a wind-up. |
| Boss cleanup/budgets | Projectile/add ceilings, controller `dispose()`, boss/add cleanup, and terminal-room cleanup already exist. | Keep all ceilings. The new action and mutation state must be cleared through the same terminal paths. |
| XP Echo defeat receipt | Boss death already calls `dropXp()` before `clearBoss()`, producing an authoritative high-value Echo. | Treat the existing Echo as the visual core left by the torn titan; do not add mid-fight XP that can open a level-up window during the dance. |

Important latent asset issue: `packages/client/src/sprites/manifest.ts` contains a dedicated `world-titan` body plus `foot-1` through `foot-4`, and `SpriteRig` already instantiates every role starting with `foot`. However, `packages/shared/src/enemies.ts` still maps `world-titan.sprite` to `grull`. The flagship cannot read correctly until that mapping becomes `world-titan`.

## What must be extended

### 1. An optional scripted encounter, not more independent cooldowns

Independent modules can overlap, but they cannot author a phrase, a phase-entry break, a recovery/punish window, or a safe transition boundary. They also compute phase changes by immediately disposing the old phase, so a health threshold can erase a nearly complete tell.

Add `BossDef.encounter?: BossEncounterDef`. When absent, the current controller path and timing remain unchanged. When present, a small timeline runtime owns:

- `mode`: `intro | combat | transition | stagger`;
- current health phase and a queued next phase;
- `phaseEpochTick`, `sequenceIndex`, `actionIndex`, and `actionSeq`;
- a single foreground `BossActionRuntime` with start, resolve, active-end, and end ticks;
- a phase-local balance counter and fault-paint mutation state;
- the current target id/aim and selected foot.

One foreground action is deliberate. Support danger belongs inside that action's cast plan. This prevents unreviewed combinations and gives the animation, telegraph, camera, and audio one authoritative semantic owner.

The scripted path should be data-driven but narrow. Do not build arbitrary conditions or callbacks into shared data. Required conditions are only health threshold, action completion, successful quake counter, and fixed tick offset.

Proposed shared shapes:

```ts
interface BossEncounterDef {
  introTicks: number;
  phases: readonly BossEncounterPhaseDef[];
}

interface BossEncounterPhaseDef {
  hpFloor: number;
  transitionTicks: number;
  balanceForStagger: number;
  staggerTicks: number;
  loop: readonly BossActionDef[];
  arenaPaint: BossArenaPaintDef;
}

interface BossActionDef {
  id: string;
  kind: "titanFootfall" | "landingZone" | "titanSweep" | "faultPulse" | "rest";
  windupTicks: number;
  activeTicks: number;
  recoveryTicks: number;
  targetPolicy: "boss" | "nearest" | "roundRobinLiving";
  params: Readonly<Record<string, number>>;
  presentation: { foot: number; cue: number; shakeTier: number };
}
```

Store authored time in integer ticks. Seconds may still be accepted by legacy modules, but they must not enter the encounter runtime.

### 2. Safe threshold gates

For this one instance, each health threshold is a gate:

- incoming damage may reduce Vastaghar to the current phase floor, not below it;
- crossing the floor queues the next phase and stops new action scheduling;
- the current action finishes through its authored recovery boundary; it is not silently canceled;
- the boss enters a fixed transition break and is invulnerable during it;
- the next phase begins on an exact tick with its own loop at action zero.

This prevents burst damage from skipping the authored second act. It also avoids the current bad case where `enterPhase()` disposes a telegraph at `t=.95`. Defeat remains immediate after the final phase reaches zero; no server-side unskippable death cutscene is required.

Priority for simultaneous events is: lethal final-phase damage, health transition, then balance stagger. A counter earned on the threshold strike is acknowledged in presentation but does not insert a second stagger before the phase break.

### 3. Cast identity and a sampled action clock

The client currently infers the boss pose by scanning every live telegraph and choosing a high-scoring row. Telegraphs have no owner, so an unrelated horde tell can pose the boss. Append `ownerId` and `castSeq` to `TelegraphState`. `BossController` supplies both when it mints rows.

Append one nested `BossEncounterState` to the end of `ArenaState`; do not repurpose `bossPhase`:

```ts
encounterSeq: uint16
mode: uint8
phase: uint8
phaseStartTick: uint32
maxHp: float32
actionSeq: uint16
actionId: string
actionStartTick: uint32
resolveTick: uint32
activeEndTick: uint32
actionEndTick: uint32
aim: float32
impactX / impactY: float32
foot: uint8
revolutions: uint8
balance: uint8
arenaPaintStep: uint8
arenaPaintRotation: float32
cueSeq: uint16
cueKind: uint8
cueTick: uint32
```

This is state, not a fire-and-forget event stream. A late joiner can sample the current pose from ticks and will not replay an old intro or phase nuke. On first observation, the client seeds its seen `cueSeq` without firing it. Only a later sequence change may emit a one-shot cue.

`maxHp` fixes a separate current defect: the client boss bar divides scaled server HP by the unscaled base HP from `ENEMY_KINDS`, so co-op/depth bars and phase markers can be wrong. The server must sync the exact spawned maximum.

Adding schema fields is append-only and requires `SCHEMA_VERSION` 14 to become 15.

### 4. Authoritative heel sweep

Add a `titanSweep` primitive and active runtime. It is not the existing instantaneous `meleeCombo` wedge and not the existing expanding ring.

- Build a `SwingDescriptor`-compatible spin clock with an active interval covering the authored sweep.
- Use `swingEdgeProgress()` and `bladeAngleAt(aim, TAU * revolutions, progress)` on server and client.
- Hit-test the angular interval swept between the previous and current 20 Hz samples against a radial band. Supersample the interval when a tick crosses a thin target angle; never test only the end angle.
- Track `hitPlayers` for the current revolution. When `floor(previousAngle / TAU) !== floor(currentAngle / TAU)`, clear it before testing the next portion. A player can be hit at most once in each authored revolution.
- Treat the edge as white/parryable and airborne-avoidable, matching the footstep lesson. A parry applies normal parry-chain behavior. The server owns all damage and counter outcomes.
- Keep a thin exact arc/edge in `TelegraphState`. The painted ribbon is only an accent on that geometry.

The existing `SwingDescriptor` interface and helper functions in `packages/shared/src/melee.ts` should be reused unchanged in the first implementation. If the runtime needs a constructor for a non-weapon descriptor, add a `spinDescriptor(poseSeconds)` helper there; do not loosen the immutable descriptor or change player timings.

### 5. Counter feedback and stagger

Change the quake/sweep sink to return a synchronous `BossCounterSummary` containing unique player ids or counts for `parried`, `airborne`, and `hit`. Only a parry advances balance; jumping is the safe dodge answer. Count a cast once even if several co-op players parry the same shockwave so party size does not multiply stagger rate.

After three countered footfalls in P1/P2, queue a 24-tick (1.2 s) stagger at the next recovery boundary. The boss is planted and attacks stop; damage continues normally. Do not add a new damage multiplier in the first pass—the uninterrupted punish window is already a reliable reward and avoids changing the central damage pipeline. P3 does not stagger; a successful sweep parry suppresses that revolution for the parrying player and earns the existing parry-chain reward.

### 6. Arena mutation is painted state, not invisible collision

At the two phase breaks, persistently paint new page creases/faults around the encounter anchor. `arenaPaintStep`, rotation, and phase epoch are authoritative. Harmful fault pulses still create ordinary red rectangle telegraphs and use the existing exact rectangle hit path. The persistent paper tears never damage, block, or clamp players by themselves.

This produces an arena that visibly changes without adding a second collision boundary to top-down and belt modes. If physical folding/shrinking is wanted later, it needs a separate server movement/collision design. For now the world-titan encounter must fall back to paint-only in belt mode, even if spawned by a dev command.

## Authored fight timeline at 20 Hz

All ranges below use `[start, end)` and all resolves happen once on the named tick. Health controls when a loop is allowed to exit, not the duration of a loop.

| State / loop tick | Duration | Authoritative beat | Client read |
|---|---:|---|---|
| Intro 0–40 | 2.0 s | Plant and invulnerable; no damaging casts. | 620 ms lower-body unfold, title, bounded boss-focused camera nudge, tutorial banner. |
| P1 0–18 | 0.9 s | Left/front foot wind-up; resolve quake at 18. | Selected foot lifts; painted ground foreshadow; white sole glint during ticks 16–17. |
| P1 18–30 | 0.6 s | Recovery. | Foot compresses page; exact quake plus one `quake-burst` accent. |
| P1 30–48 | 0.9 s | Right/front foot; resolve at 48. | Mirrored tell. |
| P1 48–60 | 0.6 s | Recovery. | Punish beat. |
| P1 60–80 | 1.0 s | Two red landing circles; resolve at 80. | No foot glint: this is dodge-only. |
| P1 80–120 | 2.0 s | Long recovery, then loop. | Damage window; balance stagger may replace the first 24 ticks. |
| Transition 1 | 32 ticks / 1.6 s | Health locked at 65%, attacks off, invulnerable, `arenaPaintStep=1`. | Existing bounded page snapshot folds and reopens on new fault paint; exact danger layer stays above it. |
| P2 0–16 | 0.8 s | Left foot; resolve 16. | Faster version of learned tell. |
| P2 26–42 | 0.8 s | Right foot; resolve 42. | The ten-tick gap keeps co-op counter feedback readable. |
| P2 52–70 | 0.9 s | `World Turn` wind-up. | Body/feet plant, white radial edge claims the lane, glint at 68–69. |
| P2 70–94 | 1.2 s | One full heel revolution, one hit maximum per player. | Seekable painted-edge ribbon follows the exact sampled edge. |
| P2 94–116 | 1.1 s | Recovery. | Strong punish window. |
| P2 116–134 | 0.9 s | Two red fault rectangles; resolve 134. Loop ends 144. | Existing rectangle telegraphs over persistent creases. |
| Transition 2 | 36 ticks / 1.8 s | Health locked at 30%, attacks off, invulnerable, rotate paint by PI/4. | Short paper fold; one nuke-tier accent at the fold snap, never during the tell. |
| P3 0–14 | 0.7 s | Left foot; resolve 14. | Fast but still above the 20 Hz readability floor. |
| P3 22–36 | 0.7 s | Right foot; resolve 36. | Alternating selected-foot pose. |
| P3 44–58 | 0.7 s | Final `World Turn` wind-up. | Glint in ticks 56–57. |
| P3 58–90 | 1.6 s | Two revolutions, 16 ticks each; per-player hit set resets at tick 74. | Ribbon completes two readable turns; impact/counter feedback is per revolution. |
| P3 90–112 | 1.1 s | Exhausted recovery, then loop. | Final punish window. |
| Defeat | immediate gameplay result | Existing XP drop, boss cleanup, loot/portal/boss-rush advance remain authoritative. | Cache last kind/position, tear/crumple the paper rig toward the spawned XP Echo, and allow one defeat `nuke` accent if the frame budget accepts it. |

Target selection for any target-relative support action is `roundRobinLiving` over session ids sorted lexicographically. The selected id is fixed when the action starts. Reordering the input array or a player moving during wind-up must not retarget a settled footprint.

At the start of each server sub-step, the timeline derives elapsed time with unsigned tick subtraction. An action starts its telegraphs at `t=0`; progress is derived from tick endpoints, not accumulated floating seconds. On `resolveTick`, rows are set to `t=1`, payload fires once, and the existing one-broadcast-generation retention rule applies. Active windows are `[resolveTick, activeEndTick)`, recovery is `[activeEndTick, actionEndTick)`. Catch-up substeps therefore execute the same ticks in the same order as real-time steps.

The existing room update order means player melee can cross a threshold before `stepBoss()` in the same tick, while a friendly projectile processed later is observed by the boss timeline on the next tick. Preserve and test that one-tick distinction; do not add a second ad-hoc phase scan inside projectile processing.

## Client spectacle and sync rules

Create a small `BossPresentationDirector` that samples `BossEncounterState` against the room render timeline. `ArenaScene` should stop deriving Vastaghar's semantic pose from telegraph score. Telegraphs still draw exact danger; owned `actionSeq` drives the attacker.

Presentation layers, in order:

1. **Exact layer:** current `buildTelegraphGeometry()` and ground/edge Graphics. Never optional and never obscured by paper capture.
2. **Attacker layer:** `SpriteRig.setBossActionPose()` lifts the selected one of four feet, plants the other feet, and samples anticipation/impact/recovery directly from action ticks. At the last two wind-up ticks, the selected foot gets a single white glint. Repeated calls must be idempotent; do not use `triggerBrace()` milestones as an approximate clock.
3. **Paint layer:** one reserved, seekable painted-edge surface keyed by `(encounterSeq, actionSeq)`. It receives the same `SwingDescriptor`, aim, arc, reach, and elapsed seconds as the server's sweep. It must not consume or steal one of the 12 ordinary player swing surfaces.
4. **Resolve layer:** exact procedural quake/ring first, optional `quake-burst` second. `nuke` is allowed only at transition 2 or defeat. Missing packs or a spent composer frame budget result in no accent, not lost gameplay information.
5. **Paper layer:** use the existing world snapshot fold during server transition modes. Intro uses a 620 ms `playSpawnUnfold`; defeat uses the existing paper-death path and the authoritative XP Echo as the visual core. Reduced-paper-motion uses the existing short fade.

Camera direction remains a client interpretation of a server semantic cue. The server syncs cue kind, tick, and world focus; it never syncs screen offsets, zoom, or a forced camera transform. The director may:

- intro: fit player and titan if possible, with at most an 80 px boss-biased nudge;
- phase break: a 250 ms nudge toward the boss, canceled if it would push the local player outside the central safe 70% of the viewport;
- attacks: no pans or zooms—only bounded shake;
- reduced motion: no nudge, half-duration flash, and no snapshot hinge motion.

The current `shakeCam()` only arbitrates by current strength; repeated quakes can restart a stronger shake indefinitely. Add a boss-only rolling impulse budget before calling it:

| Cue | Requested shake | Budget rule |
|---|---:|---|
| Normal footfall | 220 ms at .018 | Tier 2 |
| Successful quake parry | 90 ms at .008 | Tier 1; does not suppress local parry feedback |
| Heel sweep edge | 120 ms at .010 | At most once per revolution |
| Phase fold snap | 320 ms at .024 | Tier 3; one token per transition |
| Defeat | 420 ms at .030 | Tier 3; replaces remaining boss impulses |

Cap boss-originated `intensity * duration` to 14 intensity-ms in a rolling second and allow only one tier-3 request in that window. Local player hurt, parry, and level-up channels keep their existing priorities; the boss budget must never mute direct player feedback.

## Exact files and functions

### Shared contract

- `packages/shared/src/boss-encounter.ts` **(new):** define encounter/action/arena-paint types, mode/action enums, tick sampling helpers, and `BossCounterSummary`. Keep this file free of Colyseus and Phaser.
- `packages/shared/src/bosses.ts`: add optional `BossDef.encounter`; replace only `WORLD_TITAN`'s independent modules with the authored timeline above. Do not alter `BOSS_DEF_IDS` or other definitions.
- `packages/shared/src/boss-primitives.ts`: add a named `ActiveKind` enum without renumbering 0/1/2, `TitanSweepSpec`, `titanFootfall`, `titanSweep`, and pure `pointInSweptAnnularArc()` geometry. Move client-visible `kindTag` values to a shared enum while preserving every current numeric value.
- `packages/shared/src/melee.ts`: reuse `SwingDescriptor`, `swingEdgeProgress()`, and `bladeAngleAt()`. Only add a pure non-weapon `spinDescriptor()` factory if construction otherwise duplicates timings; player descriptor behavior is locked.
- `packages/shared/src/state.ts`: append `ownerId`/`castSeq` fields to `TelegraphState`; add `BossEncounterState`; append its instance after `xpEchoes` in `ArenaState`.
- `packages/shared/src/constants.ts`: bump `SCHEMA_VERSION` from 14 to 15 and add named flagship tick/budget constants only if they are not kept in the encounter data.
- `packages/shared/src/enemies.ts`: change `ENEMY_KINDS["world-titan"].sprite` from `grull` to `world-titan`.
- `packages/shared/src/index.ts`: export `boss-encounter.ts`.

### Server authority

- `packages/server/src/rooms/BossTimeline.ts` **(new):** implement the optional pure tick scheduler: phase-floor gate, safe transition queue, action start/resolve/active/recovery boundaries, deterministic target policy, balance/stagger, and a serializable current snapshot.
- `packages/server/src/rooms/BossController.ts`:
  - keep the current module scheduler as `stepLegacy()` with unchanged semantics;
  - branch from `step()` to `stepEncounter()` only when `def.encounter` exists;
  - add `startEncounterAction()`, `stepTitanSweep()`, and `settleEncounterAction()`;
  - extend `dispose()` to release owned action telegraphs and active sweep state;
  - expose `capIncomingDamage(hp, rawDamage)` / `isVulnerable` and `encounterSnapshot` to the room;
  - preserve `applyPayload()` and settled-broadcast behavior for legacy casts.
- `packages/server/src/rooms/GameRoom.ts`:
  - `spawnBoss()`: construct the controller with a recorded deterministic spawn seed and sync exact maximum HP;
  - `stepBoss()`: pass stable `{id,x,y}` targets, advance the encounter, and copy `encounterSnapshot` into state;
  - `bossSink`: stamp telegraph ownership, return quake/sweep counter summaries, and route swept-annular damage through existing parry/airborne/damage/knockback rules;
  - `damageEnemy()`: apply the controller's threshold cap/vulnerability gate only to the scripted flagship before mutating HP;
  - `clearBoss()`: clear encounter state and delete only telegraphs owned by that boss instead of every non-melee telegraph;
  - retain current `dropXp()`, boss loot, portal, and boss-rush progression order.
- `packages/server/src/rooms/BossController.test.ts`: extend the existing injected mock-sink pattern for tick actions, returned counter summaries, retention, and sweep geometry.
- `packages/server/src/rooms/GameRoom.test.ts`: add full room regressions for gates, parry/jump results, exact max HP, cleanup, boss-rush progression, and late-patch state.

### Client presentation

- `packages/client/src/scenes/arena/boss-presentation.ts` **(new):** pure action-frame sampler, cue de-duplication, arena-paint interpolation, and boss shake-budget ledger. Unit test it without Phaser.
- `packages/client/src/scenes/ArenaScene.ts`:
  - replace `resolveBossTelegraphPose()` / Vastaghar's `applyBossTelegraphPose()` path with owned encounter sampling while leaving legacy bosses on the current fallback;
  - `renderTelegraphs()`: use shared tags/owner metadata and keep resolve-versus-cancel behavior;
  - `updateRunState()`: use synced `maxHp`, start the longer titan intro, consume transition/defeat cues once, and remove the existing client-only assumption that a newly seen titan is immediately in combat;
  - factor `playPaperWorldFold()` so a boss-phase announcement can reuse the capture/pool without pretending a dimension descent occurred;
  - route titan entrance, quake, sweep, transition, and defeat shakes through the boss budget before `shakeCam()`.
- `packages/client/src/entities/SpriteRig.ts`: retain manifest role ids for feet and add `setBossActionPose(frame)` / `clearBossActionPose()`. Pose the selected foot directly; never infer which foot from nearest telegraph geometry.
- `packages/client/src/vfx/VfxPlayer.ts`: add one reserved seekable external painted-edge surface. Reuse the canonical PER suite and clock; do not change player `playSwing()` or its 12-surface pressure behavior.
- `packages/client/src/scenes/arena/vfx.ts`: extend `TelegraphForeshadowPool` recipes for named titan foot/sweep tags. Its existing 12-image and 18-particle-per-frame caps remain hard.
- `packages/client/src/vfx/fx-composer.ts` and `packages/client/src/vfx/vfx-render.js`: no first-pass edit. Their existing public composer and PER renderer are sufficient. Only reopen these files if capture proves a missing seek operation that cannot live in `VfxPlayer`.

## Test strategy

Follow the current `BossController.test.ts` style: tiny bespoke `BossDef`s, a synchronous mock sink with call arrays, and repeated 0.05-second room steps. For scripted tests, authored expectations are tick numbers, not approximate elapsed seconds.

### Pure/controller tests

- Legacy parity: an encounter-less definition produces the same phase, cast, movement, RNG, terminal telegraph, active-hazard, projectile-cap, and add-cap calls as before.
- Intro: no payload or boss movement before tick 40; action zero begins exactly at 40.
- Threshold during wind-up: damage floors at 65%, the visible cast reaches `t=1`, recovery completes, then transition begins. It must not disappear at `t<1`.
- Threshold during active sweep: finish the current authored revolution/action before transition; start no subsequent action.
- Floor protection: an arbitrarily large hit cannot skip P2 or P3; final-phase lethal damage is not clamped.
- Settled broadcast: an encounter action that resolves during a catch-up batch retains `t=1` through a later broadcast generation exactly as legacy casts do.
- Deterministic targets: reordering target input produces the same sorted round-robin ids and fixed cast coordinates.
- Counter summary: airborne avoids without balance, parry avoids and advances balance once per cast, grounded/unparried takes damage, two co-op parries still add one balance.
- Stagger: the third counter queues at recovery, lasts exactly 24 ticks, schedules no attack, then resumes the next loop action.
- Sweep geometry: no angular tunneling at 20 Hz; inner/outer band edges agree; a player is hit once in P2; P3 resets the hit set exactly at tick 74 and permits one hit in each revolution.
- Dispose: pending, settled, active sweep, arena paint, and action state all clear once; no post-death payload.
- RNG: running the same spawn seed, HP schedule, target positions, and counter responses yields an identical action/telegraph digest; a different seed may change only explicitly random support positions.

Add a pinned flagship digest for at least 1,200 ticks. Record only semantic authority: tick, mode, phase, action id/seq, telegraph id/geometry/progress, mutation step, boss position, and player HP/parry sequence. Do not include Phaser cosmetics or `Math.random`-based particles.

### Room integration tests

- Spawn `world-titan`; assert synced `maxHp` equals the actual scaled enemy HP and the client-facing base mismatch is gone.
- Verify melee damage crossing a floor is visible to `stepBoss()` that tick, while projectile damage later in the update is latched next tick.
- Grounded quake hit, airborne immunity, parry immunity/chain, and balance feedback should extend the current footfall tests rather than replace them.
- Kill during each mode and assert owned telegraphs/action state clear, unrelated melee/horde telegraphs remain, XP Echo drops before portal/boss-rush advance, and no active sweep damages after clear.
- Boss rush must advance past the threshold-gated titan by stepping its transition breaks, then preserve the expected total roster count and reward.
- Dev-spawn in belt mode must remain deck-clamped and use paint-only mutation; all existing “every dimension boss survives 60 belt ticks” coverage stays green.
- Reconnect/late-join during wind-up, active sweep, recovery, and phase break: snapshot samples the current action; intro/nuke cues do not replay.

### Client/presentation tests

- Pure action sampler returns identical normalized phases from server ticks and delayed render ticks, including wrap-safe tick subtraction.
- First observed cue seeds state without playing; each subsequent `cueSeq` plays once.
- Boss pose ignores a higher-progress telegraph owned by a horde enemy.
- Selected foot lift/glint/impact clears on cancel, action change, boss removal, and rig reuse.
- Seekable ribbon sampled mid-revolution starts at the current edge rather than replaying from zero and never steals a player VFX surface.
- Shake budget accepts one major fold, clamps repeated quake impulses, permits local hurt/parry feedback, and honors reduced motion.
- Paper fold failure or missing FX assets leaves the exact telegraph and transition state readable.
- Add a manual four-client capture checklist at normal and reduced motion: intro framing, P1 teaching, threshold during near-resolve, P2 one-turn, P3 two-turn, death Echo/portal, and a late join in each phase.

Run the focused suites first, then the repository gates:

```text
pnpm vitest run packages/server/src/rooms/BossController.test.ts
pnpm vitest run packages/server/src/rooms/GameRoom.test.ts
pnpm test
pnpm typecheck
pnpm build
```

## Existing-test break risks

Every item below needs an explicit before/after assertion; none should be dismissed as “just tuning.”

- **Schema compatibility:** adding encounter/ownership fields changes Colyseus field order. Append only, bump `SCHEMA_VERSION`, and update handshake/schema expectations. Inserting fields before `xpEchoes` can corrupt old/new patch decoding.
- **Structural sink mocks:** changing `BossEmitSink.addTelegraph`, `applyQuake`, or adding sweep methods breaks every typed mock immediately. Update the common test sink in the same locked wave.
- **Legacy phase timing:** moving current code into `stepLegacy()` can change first-delay, cooldown decrement, movement planting, RNG fire counters, or the settled broadcast generation by one tick. Characterization tests must land before extraction.
- **Transition cancellation:** changing `enterPhase()` globally would break tests that currently expect phase disposal/cancel. Safe-boundary behavior is scripted-path-only.
- **Immediate first fires:** adding a universal intro or phase delay would break definitions/tests whose `firstDelay=0` fires immediately. Intro exists only on the flagship encounter.
- **Boss-rush instant-kill assumptions:** threshold floors prevent a single test hit from killing Vastaghar. Boss-rush tests and any debug helper that assumes one-shot advancement must step phases or use an explicit test-only authority method—not bypass gameplay in production code.
- **Boss bar/UI:** replacing base max HP changes co-op/depth bar ratios and screenshot expectations. Phase dividers must still read the public `bossPhase`/definition thresholds.
- **Boss name lookup:** `ArenaScene` currently indexes `BOSSES[state.bossKind]`; mapped dimension bosses use `bossDefFor()`. Touching the bar is an opportunity to fix this, but doing so can change name snapshots outside Vastaghar. Keep it a separate assertion/commit.
- **Telegraph cleanup scope:** `clearBoss()` currently removes every non-melee telegraph. Narrowing by owner can leave old unowned boss rows unless all boss rows are stamped, and can change terminal/horde cleanup tests. Add a compatibility cleanup for legacy unowned ids tracked by the controller.
- **Telegraph `t=1` retention:** phase/cue work must not remove a terminal row in the resolving broadcast. Existing resolve, cancel, and integration tests are sensitive to one generation.
- **Boss pose fallback:** removing telegraph inference globally can regress the eleven legacy bosses. Dispatch to encounter pose only when `encounterSeq` belongs to the current boss; retain the existing resolver otherwise.
- **Dedicated art proportions:** switching from Grull to the four-foot titan changes body bounds, depth ordering, lower-body lift, shadow size, and paper snapshot object count. Capture before tuning hit geometry; never derive server foot coordinates from client pixels.
- **Movement planting:** the current controller plants only pending melee casts. Scripted foot/sweep actions must plant explicitly. Accidentally planting legacy projectile bosses changes belt-clamp movement tests and difficulty.
- **Damage order:** centralizing phase checks inside `damageEnemy()` can alter the melee-before-boss/projectile-after-boss ordering and deterministic digests. Gate only damage magnitude there; queue phase from the established controller step.
- **Parry plumbing:** returning counter results can double-increment `parriedSeq` or parry-chain state if the encounter also applies feedback. `GameRoom` remains the only owner of player parry consequences; the controller consumes a summary only.
- **Per-revolution boundary:** a `>=`/`>` error can double-hit at the exact wrap or miss a target when one 50 ms step spans it. Pin boundary ticks and preserve player spin behavior in `stepMeleeSwings()`.
- **Arena modes:** persistent physical walls would break belt deck clamping, fall checks, spawns, and the 60-tick dimension-boss sweep. This plan uses non-colliding paint and ordinary harmful telegraphs specifically to avoid that change.
- **Paper fold ownership:** `ArenaScene` has one paper snapshot/pool for dimension descent. A boss transition must not overlap, destroy, or mis-announce a descent fold; acquisition must cancel/finish the older owner deterministically.
- **Page capture visibility:** the capture excludes exact telegraphs intentionally and temporarily raises the ground layer. Failure paths must restore depth or later danger can render under the floor.
- **FX frame budget:** `playFxPack()` may reject a nuke when ten packs already played that frame. Tests must accept the exact fallback, not require the optional pack. Do not bypass the global budget for the boss.
- **VFX surface pressure:** adding the boss ribbon to the current 12-surface round-robin can steal player swing trails or be stolen mid-sweep. Reserve one separately and destroy/release it on scene teardown.
- **Shake feel:** routing every camera shake through the new boss budget would silently alter player hurt, weapon, and level-up feedback. Only identified boss-originated calls use it.
- **XP/level window:** spawning XP during counters can freeze players while the boss continues. Use only the existing defeat Echo. Any future mid-fight reward needs an encounter pause policy first.
- **Spawn determinism:** boss anchor/angle currently use `Math.random`; replacing that source can invalidate tests that mock random spawn locations. Inject/record the seed and update only boss-spawn assertions. The existing three-second golden digest should remain unchanged because it never reaches a boss.
- **Registry count:** do not add a new boss id. `BOSS_DEF_IDS` drives boss-rush length and reward tests.
- **Terminal cleanup:** restart, defeat, extraction, descent, and room disposal all call boss/telegraph cleanup through different paths. New encounter schema, paper cue, ribbon, and active sweep must be idempotently reset in every path.

## Work waves and file locks

The locks below are exclusive for the entire named wave. A Sol may add its listed new files, but must not “help” in another Sol's locked integration file.

| Wave | Sol / outcome | Exclusive file locks | Merge gate |
|---|---|---|---|
| 0 | Characterization Sol pins legacy behavior and current Vastaghar baseline. | `packages/server/src/rooms/BossController.test.ts`, relevant baseline sections of `GameRoom.test.ts` | Focused tests green before production extraction. |
| 1A | Shared-contract Sol adds encounter data/types/schema/tags and fixes titan art mapping. | `shared/src/boss-encounter.ts`, `bosses.ts`, `boss-primitives.ts`, `state.ts`, `constants.ts`, `enemies.ts`, `index.ts` | Shared build/typecheck; schema version test; primitive geometry tests. |
| 1B | Server-runtime Sol builds the pure scheduler against the frozen Wave 1A interface. | new `server/src/rooms/BossTimeline.ts` and its new test file only | Tick/phase/action digest green; no `BossController.ts` edit yet. |
| 1C | Client-director Sol builds pure sampling, cue de-dup, paint interpolation, and shake ledger. | new `client/src/scenes/arena/boss-presentation.ts` and its test only | Client typecheck and pure tests. |
| 1D | Ribbon Sol adds the reserved seekable PER surface. | `client/src/vfx/VfxPlayer.ts` and a dedicated test/harness; `vfx-render.js` remains locked unless an interface review approves it | Player `playSwing()` characterization plus seek/release pressure test. |
| 2A | Server integration Sol wires authority, damage gates, counters, ownership, and cleanup. | `server/src/rooms/BossController.ts`, `server/src/rooms/GameRoom.ts`, `BossController.test.ts`, `GameRoom.test.ts` | Focused server suites, 1,200-tick digest, all terminal cleanup cases. |
| 2B | Rig Sol implements four-foot semantic poses. | `client/src/entities/SpriteRig.ts` | Static pose harness for all action phases and art scales. |
| 2C | Telegraph VFX Sol adds shared titan recipes only. | `client/src/scenes/arena/vfx.ts` | Pool caps and cancel/resolve tests. |
| 3 | Client integration Sol owns the high-collision scene and paper/camera wiring. | `client/src/scenes/ArenaScene.ts` | Client typecheck/build; normal/reduced-motion captures; late-join checks. |
| 4 | Tuning/QA Sol changes only encounter numbers after architecture freezes. | `shared/src/bosses.ts` plus new flagship expectation fixtures; no engine files | Four-client playtest, full `pnpm test`, `typecheck`, `build`, assets check. |

If Wave 1A changes a contract after another Sol starts, stop and rebase the contract consumers before integration; do not let each consumer invent a local copy. `ArenaScene.ts`, `GameRoom.ts`, and `BossController.ts` are deliberate single-owner bottlenecks.

## Definition of done

- A first-time player can identify the selected foot, choose jump or parry, and understand why they were hit without reading UI text.
- Health thresholds cannot delete a near-resolved tell or skip a phase.
- Server damage, parry, airborne immunity, targets, sweep angle, per-revolution reset, and phase timing are deterministic at 20 Hz.
- A late joiner sees the correct current foot/sweep/phase pose and never replays stale paper or nuke cues.
- Exact telegraphs remain readable with all optional art missing, reduced motion enabled, or FX/shake budgets exhausted.
- The dedicated four-foot titan art ships, the boss bar uses exact scaled max HP, and legacy bosses retain their current scheduler and pose fallback.
- Defeat still produces the existing XP Echo, loot/portal or boss-rush continuation, and complete idempotent cleanup.
- Focused regressions, the flagship digest, full tests, typecheck, and build are green.
