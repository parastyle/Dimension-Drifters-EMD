# B68 — Silky limbs

Date: 2026-07-26
Branch: `sol/b68-silky-limbs`

## Outcome

The fault was client presentation, as the owner observed: the rendered root, locomotion vector,
attack edge, and secondary-motion writers were not guaranteed to describe the same actor at the same
render time. The local rig could therefore be in perfect agreement with authority while its own root
and limbs disagreed visually. Commit `7baf405` narrowed one instance by feeding self locomotion from
prediction instead of differentiating the rendered root; B68 makes that invariant structural.

B68 now builds exactly one retained `PresentedActorState` for each visible actor before any
per-actor visual consumer runs. Its root, height, locomotion, recoil, stance, aim, attack edge,
attack resources, weapon identity, life/event sequences, and ultimate epochs all share one
`PresentationFrame`. Remote actors sample those fields from one coherent interpolation row rather
than interpolating root while reading newest-state pose fields. Self pose reads fixed-tick predictor
locomotion and sanctioned gun recoil; it never differentiates correction/presentation debt back
into gait.

The rendered root has a final derivative guard. Ordinary debt can advance only at declared
locomotion + recoil speed (plus a small render margin); undeclared excess remains root-space debt.
Declared teleports cut immediately. No attack pose writes actor position, and the only attack motion
admitted to the root budget is existing gun recoil.

No wire shape changed, so `SCHEMA_VERSION` did not change.

## Best-practice findings and decisions

- Unity animation layers combine body masks, per-layer weights, and explicit Override/Additive
  modes. B68 adopts the mask/claim and weight model. It does not use additive composition when two
  systems want the same limb, because additive attack + locomotion on this flat six-part paper rig
  recreates double-driving instead of useful skeletal detail.
  ([Unity Animation Layers](https://docs.unity3d.com/Manual/AnimationLayers.html))
- Unreal's slots and Layered Blend per Bone provide mutually exclusive action channels over selected
  bones; slot groups allow only one montage to own a group. B68 adopts that exclusivity as one final
  owner per B54 limb channel, without importing a skeletal graph that this sprite rig does not have.
  ([Animation Slots](https://dev.epicgames.com/documentation/en-us/unreal-engine/animation-slots-in-unreal-engine),
  [Layered Animations](https://dev.epicgames.com/documentation/en-us/unreal-engine/using-layered-animations-in-unreal-engine))
- Godot state-machine transitions expose cross-fade time, priority, and synchronized transition
  behavior. B68 adopts declared total priority and retained cross-fades. It rejects a discrete
  locomotion state reset: gait retains its continuous envelope and a `0.001` ownership dead zone, so
  rapid direction changes do not restart phase or chatter owners.
  ([AnimationTree](https://docs.godotengine.org/en/stable/tutorials/animation/animation_tree.html),
  [StateMachineTransition](https://docs.godotengine.org/en/stable/classes/class_animationnodestatemachinetransition.html))
- Gaffer's fixed-timestep guidance separates simulation progress from variable rendering. B68 keeps
  server/predictor physics fixed-tick and gives presentation one monotonic render frame containing
  both absolute time and delta. Hit-stop pauses presentation time; a stall is marked as a cut and
  bounded spring integrators do not consume unbounded catch-up.
  ([Fix Your Timestep](https://gafferongames.com/post/fix_your_timestep/))
- Ryan Juckett's damped-spring treatment motivates stable closed-form spring stepping rather than
  frame-dependent Euler chasing. The rig's exact damped integrators and bounded `dt` remain the
  secondary-motion default; reduced-motion followers use critical damping. Expressive ordinary
  hands/head remain bounded underdamped rather than being cargo-culted to damping ratio 1, because a
  little paper follow-through is intentional and the new owner handoff removes the pop.
  ([Damped Springs](https://www.ryanjuckett.com/damped-springs/))

## One clock: 3 → 1

Before B68 there were three presentation-time paths: the Arena `animClock` passed as an absolute
pose timestamp, caller `deltaMs` plus rendered-root finite differences driving gait/springs, and
direct Phaser `scene.time.now` fallbacks used by combat/flourish/mechanism epochs. They could observe
different motion or freeze history.

`PresentationFrameClock.advance()` is now called exactly once per Arena render frame. The returned
frame carries monotonic `nowMs`, `deltaMs`, `deltaSeconds`, the single sampled wall time used only for
server-timeline conversion, and a cut bit. `animClock` remains a read-only compatibility/probe alias
assigned from `presentationFrame.nowMs`; it is not an independently advancing clock.

| Rig module | Time audit after B68 |
| --- | --- |
| `rig-core` | Pure helpers/integrators only; receives the frame delta supplied by pose. No wall-clock sampling. |
| `rig-pose` | `animate(PresentedActorState)` reads only `state.frame.nowMs` and `state.frame.deltaMs`; gait, stride, hand/foot jiggle, head and gear springs share them. |
| `rig-combat` | `presentationClockNow()` reads the frame-backed compatibility alias; authoritative wall epochs convert through the once-sampled `presentationFrame.wallNowMs`. No `scene.time.now` fallback remains. |
| `rig-gun-mechanisms` | Mechanism triggers use `presentationClockNow()` / `presentationEpochForWallEpoch()`; per-frame tome and mechanism sampling receives pose's `sceneNow`. |
| `rig-flourish` | Arming, start, sample, stow, and idle epochs use `presentationClockNow()` or pose's `sceneNow`. |
| `rig-gear` | Attack/head/gear followers use `presentationClockNow()`, pose `sceneNow`, or the same frame-derived spring delta. |

An audit for `Date.now`, `performance.now`, and `time.now` across all six modules returns no matches.
The pose no longer samples the input pointer either; Arena captures attack intent into the actor
snapshot before the rig consumes it.

## Presented actor boundary

`PresentedActorBuffer` replaces the player root-only interpolation ring. Continuous channels
(root, height, locomotion/recoil vectors, and aim angle) interpolate or boundedly extrapolate
together. Discrete channels (stance, life/event sequences, attack edge/hold/resources, weapon
identity, teleport, and ultimate epochs) switch only when the render cursor reaches their own row.
A unit regression proves that an interpolated root cannot see the next row's attack edge early.

Arena presentation is two-phase:

1. Advance one `PresentationFrame`, fill one retained actor snapshot per player/enemy, and place all
   roots.
2. Drive hop, down/revive, attack dispatch, ultimate pose, pet following, and `SpriteRig.animate`
   from that snapshot.

That ordering prevents one limb from sampling a newer source after another limb or the root has
already rendered.

## Limb priority and blend policy

B54 claims still decide which limb an authored action may own. B68 adds an execution-order-independent
total order:

| Priority | Owner | Examples |
| ---: | --- | --- |
| 600 | `constraint` | downed/ultimate/orbit geometry, required held grip |
| 500 | `attack` | B54 held/combo-beat claimed limbs only |
| 400 | `gun-mechanism` | hammer, lever, bolt/trigger-hand mechanism |
| 300 | `flourish` | active earned flourish channel |
| 200 | `locomotion` | continuous gait envelope |
| 100 | `spring` | default secondary-motion follower |

Every rendered body/head/hand/foot channel passes one final `LimbPriorityResolver` commit gate per
frame and exposes exactly one owner plus a finite `[0,1]` weight. Winner selection uses priority,
never module call order or weight. B54 unclaimed limbs fall through to locomotion/spring.

An ownership edge retains the last rendered transform and blends to the winning target with
smootherstep (zero endpoint velocity): 90 ms when a higher-priority owner enters, 130 ms when it
releases to a lower-priority owner. Interrupted transitions restart from the current rendered pose,
not the previous target, so ADAD/action spam cannot manufacture a cut. The existing continuous gait
envelope and ownership dead zone provide hysteresis; walk phase is never reset on a direction flip.

## Rendered smoothness regression

`e2e/tests/b68-silky-limbs.spec.ts` samples Phaser's post-update world transforms for the root and all
six channels on every rendered frame. Part deltas are measured root-relative, normalized to a 60 Hz
step, and samples separated by more than 250 ms are excluded as external stalls. It covers straight
walking, a hard reversal, moving while attacking, and the owner's ADADADAD + attack repro.

Stated max-step thresholds in pixels at 60 Hz are:

| Scenario | Root | Body | Head | Hand L | Hand R | Foot L | Foot R |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Straight walk | 7 | 1 | 2 | 2 | 2 | 2 | 2 |
| Hard reversal | 7 | 1 | 6 | 3 | 3 | 3 | 3 |
| Walk + attack | 7 | 1 | 4 | 4 | 4 | 4 | 4 |
| Rapid flip + attack | 7 | 1 | 7 | 8 | 4 | 4 | 4 |

Root max / p95 / threshold discontinuities:

| Scenario | Before | After |
| --- | ---: | ---: |
| Straight walk | `6.0641 / 6.0641 / 0` | `6.5072 / 6.5072 / 0` |
| Hard reversal | `7.4571 / 7.4571 / 0` | `6.4195 / 6.4195 / 0` |
| Walk + attack | `7.1755 / 7.1755 / 0` | `6.4187 / 6.4187 / 0` |
| Rapid flip + attack | `9.2030 / 7.8726 / 6` | `6.6365 / 6.4570 / 0` |

Per-limb maximum normalized step, before → after:

| Scenario | Body | Head | Hand L | Hand R | Foot L | Foot R |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Straight walk | `0.2761→0.2329` | `0.8363→0.6774` | `0.6604→0.2906` | `0.2734→0.2451` | `0.3503→0.3231` | `0.3581→0.3237` |
| Hard reversal | `0.2700→0.2426` | `5.0805→2.8860` | `0.7957→0.4860` | `0.4315→0.2838` | `1.1165→1.2321` | `1.1191→1.1532` |
| Walk + attack | `0.2299→0.3411` | `1.5661→1.0977` | `0.7969→0.5496` | `0.4231→0.5029` | `0.3166→0.2959` | `0.3777→0.3067` |
| Rapid flip + attack | `0.3068→0.3199` | `4.7581→5.3105` | `0.8658→0.7049` | `0.4638→0.4784` | `0.9353→1.4564` | `0.7876→1.2326` |

All after values are under their declared thresholds. The after capture contains 12, 19, 12, and
132 rendered frames respectively; all scenarios recorded zero non-monotonic clock edges, zero root
or limb discontinuities, and zero missing/invalid owner-weight resolutions. Raw before/after frames
and limits are in `docs/owner-notes-audit-v12-evidence/b68-silky-limbs/`.

## Verification

- `pnpm gen:check`: passed.
- `pnpm typecheck`: passed.
- `pnpm test`: passed three consecutive times, each at 230 files / 2,796 tests; 20 skipped.
- Focused presentation/priority/panel tests: passed, including coherent remote row, freeze-aware
  monotonic clock, root derivative bound, total-order independence, and smooth attack release.
- Browser rendered-rig regression: passed all four top-down scenarios plus the belt ADAD scenario.
- `tools/diag-rb-telemetry.mts`: completed all 83 scenarios (41 top-down, 42 belt), acceptance passed,
  correction requests `0`, nonzero `0`, silent `0`, smooth `0`, snaps `0`, magnitude `0.000 px`.
- Guardrails: no map owner file, tile, weapon-concepts, subclass taxonomy, or light/laser file changed;
  no aura/modal added; no attack displacement added.

## Iteration 2 — v1 vs v2

Iteration 2 replayed B68 as `7a27e74` on required base `868b89b`, preserving the one-clock,
one-presented-state, root-debt, and total-priority implementation.

### Doubleheader whirlwind

The failed value did not come from two visual-revolution receipts. The two assertions immediately
before the failed damage assertion already proved `damageEnemy` was called once and exactly one
receipt was booked. The sole `10`-damage receipt was exactly `5 × CRIT_MULT` because the shared V5M
fixture retained the independent base `5%` critical chance. That made an authored base-damage
assertion fail randomly one run in twenty.

The V5M fixture now sets `weaponCritChance` to zero for the whole authority fixture, whose tests
measure authored damage and receipt cadence rather than the separately tested crit lane. Expected
damage, receipt-count assertions, production crit behavior, whirlwind timing, and revolution
counting are unchanged. The focused V5M file passed three consecutive runs.

### Top-down and belt, reported separately

The belt ADAD rendered-rig test uses the same rapid-flip-plus-attack input as top-down, samples the
root and all six limbs, and resolves its reset point with belt navigation rather than the top-down
map helper.

| Mode | Root max / p95 px at 60 Hz | Root/limb discontinuities | Clock edges | Priority violations |
| --- | ---: | ---: | ---: | ---: |
| Top-down ADAD | `6.6365 / 6.4570` | `0 / 0` | `0` | `0` |
| Belt ADAD | `6.7782 / 6.3064` | `0 / 0` | `0` | `0` |

The belt body/head/hand-L/hand-R/foot-L/foot-R maxima were respectively
`0.3540 / 3.8667 / 1.7721 / 0.7356 / 0.5978 / 0.5897 px`, all within the same declared rapid-flip
limits used by top-down.

| Telemetry mode | Scenarios | Requests | Applications | Snaps | Sum px | Max px |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Top-down | 41 | 0 | 0 | 0 | `0.000` | `0.000` |
| Belt | 42 | 0 | 0 | 0 | `0.000` | `0.000` |

The earlier `topdown:parry-right requests=1` was a predictor reconciliation request associated with a
movement-correction-sequence edge, not a presentation-rig request; its applied residual was already
zero pixels. On the required rebased source and complete harness it is
`applications=0, b42=1, requests=0, sumPx=0.000, maxPx=0.000`. The full matrix likewise no longer
reproduces the belt rapid-flip correction. B68 does not alter server authority or the predictor's
correction policy, so no unrelated production correction special case was added.

### Reconnect integration verdict

This was the old transport-test race resurfacing, not a B68 regression. B68's dependency diff contains
no server, shared-schema, settlement, database, or transport code. Before hardening, the reconnect
file failed once in ten isolated repetitions: the client socket-close event could arrive before the
server's `onLeave` had registered the Colyseus reconnection token, and immediate retries on the same
SDK client occasionally left the recovered full-state handshake unresolved.

The test now waits at the exact server `allowReconnection()` registration boundary before performing
one public reconnect. It does not increase a timeout or weaken/remove any recovered-state,
run-identity, escrow, or settlement-deduplication assertion. The focused integration file then passed
20 consecutive isolated runs, and it passed in all three final full-suite runs.

### Iteration 2 verification

- `pnpm gen:check`: passed.
- `pnpm typecheck`: passed.
- Full `pnpm test` streak: run 1, run 2, and run 3 each passed `230/230` files and
  `2,796/2,796` tests, with 20 skipped.
- Rendered smoothness: all four top-down cases plus belt ADAD passed.
- Telemetry: 83/83 passed, split 41 top-down and 42 belt, with zero requests, applications, snaps,
  silent/smooth corrections, and correction pixels in each mode.

VERDICT: whirlwind cause+fix = one receipt randomly crit for exactly 2×, so the V5M authored-damage fixture now disables crit while production revolution and damage logic stay unchanged; belt corrections = 0 requests, 0 applications, 0 snaps, 0.000 px; topdown corrections = 0 requests, 0 applications, 0 snaps, 0.000 px including parry-right; 3x test results = 230/230 files and 2,796/2,796 tests passed in each consecutive run; telemetry = 83/83 both modes (41 top-down + 42 belt), all correction counters and pixels zero.
