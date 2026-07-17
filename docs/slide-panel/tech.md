# Slide-hop — technical implementation plan

Panel role: tech implementer. Status: design only; this file authorizes no source or git changes.

## 0. Binding decisions and scope

This plan implements the movement-feel designer's exact economy and the orchestrator's schema/roll assignments:

- `SCHEMA_VERSION = 25` is the slide wave. The reserved ledger remains 21 = classmerge 21a, 22 = roll/21b, 23 = ultimates, 24 = dual-wield, 25 = slide-hop.
- The queued roll keeps `STANCE_ROLL = 4`, Shift keydown, its own schedule, and the separate `rollInvuln` field. Slide is `STANCE_SLIDE = 5` and never writes or reads `rollInvuln` or parry `invuln`.
- Left Ctrl is a dedicated slide input. This is the only no-latency coexistence option identified by the devil's-advocate input audit: sharing Shift would delay the reactive roll or fire a roll before every slide, and sharing grounded Space would collide with the shipped 150 ms tap/hold classifier.
- The speed law is the designer's law: cold slide 544 px/s, `×0.97` per grounded slide tick, `×0.96` once at hop launch, magnitude preserved in air, then `min(544, 0.95 × landingSpeed + 72)` for a valid chain re-slide. The perfect two-tick recurrence and its 465.2 px/s sustained gait are intentional.
- Slide's low profile is cosmetic in this implementation baseline. Body radius, hurt tests, grounded attacks, and projectile tests do not change. The panel conflict about an explicit high/overhead channel is called out in Question 2; it must not be smuggled in as a generic projectile miss.

The slide is a new persistent movement mode, not a reskin of crouch or the distance jump. The existing vertical phases—grounded, rising, apex, falling—remain derived from `height` and `vh`; pound, crouch, dash, roll, and slide remain the explicit authored stance layer.

## 1. The momentum model

### 1.1 What movement does today

The user-facing shorthand that today's movement “re-derives velocity from the current command every tick” is correct about ordinary heading ownership, but the implementation detail matters:

- `steerVelocity` retains `mvx/mvy` between ticks for acceleration, release deceleration, and the hard-turn speed dip, but on every tick with input it derives a new desired heading from that command and recovers only toward the supplied `maxSpeed` (`packages/shared/src/movement.ts:101-143`).
- `stepSteeredMovement` immediately integrates that controller velocity and returns it as the next `vx/vy`; its ordinary server call supplies `MOVE_SPEED = 320`, so it has no independent player-authored carry vector that can remain above the ordinary cap across a stance change or airborne ticks (`packages/shared/src/movement.ts:151-169`, `packages/server/src/rooms/GameRoom.ts:2924-2989`).
- External recoil/knockback is already persistent, but it is a separate `PlayerState.vx/vy` impulse channel with exponential `IMPULSE_FRICTION` and a 780 px/s cap. `stepImpulse` is applied after commanded movement and is not renewable locomotion (`packages/shared/src/movement.ts:178-190`, `packages/shared/src/constants.ts:764-771`).
- The distance jump is the only current faster horizontal mode. It freezes a private direction/speed in `CombatState.dash*`, bypasses ordinary steering while `STANCE_DASH` is active, and drops back to `0.6 × MOVE_SPEED` on landing (`packages/server/src/rooms/GameRoom.ts:2549-2658`). That vector dies with the stance.
- `stepVertical` owns only `height/vh` and the shipped rise/apex/fall gravity zones. It does not carry horizontal state (`packages/shared/src/movement.ts:212-246`).

Therefore the existing `mvx/mvy` persistence is sufficient for ordinary steering feel but not for slide-hop. Slide momentum must outlive the grounded slide, coexist with the normal vertical machine, survive a landing long enough to be chained, and remain distinguishable from hostile impulse. That makes it materially larger than the dash's frozen vector and requires an authoritative rebase representation.

### 1.2 Authoritative representation

Add these private fields to the server's `CombatState`:

| Field | Meaning |
|---|---|
| `momentumX`, `momentumY` | The complete player-authored slide-carry velocity, not an additive bonus and never hostile impulse. Zero means the ordinary controller owns planar movement. |
| `slidePhase` | `OFF`, `GROUND`, `AIR`, or `LAND_WINDOW`. This is a subphase of `STANCE_SLIDE`, not another public stance id. |
| `slidePhaseTick` | Integer tick age of the current phase. All timing gates use this, never wall-clock milliseconds. |
| `slidePrevHeld` | Last consumed `slideHeld`, used to derive a cold Ctrl edge. |
| `slideHopBufferTicks` | Early Space request waiting for ground slide tick 2. |
| `slidePrelandTicks` | Ctrl pre-landing buffer, at most 2 ticks. Held Ctrl also qualifies. |
| `slideSpacePrelandTicks` | Fresh Space edge buffered at most 2 ticks for a chain hop; holding Space never repeats hops. |
| `slideLandWindowTicks` | Post-landing acceptance age, valid through elapsed tick 3. |
| `slideLandMomentumX/Y` | Immutable landing cache used by the retention formula even if ordinary ground normalization has begun. |
| `slideColdArmed`, `slideColdRearmTicks` | Cold-pop anti-spam state. A fresh player is armed; a broken/completed chain needs 6 qualifying ground ticks to re-arm. |
| `slideChainCount` | Presentation-only chirp ladder, reset on any chain break and capped for audio at 3. It must not enter movement math. |
| `lastSlideLandingTick` | Guards retention and `+72` so one physical landing can be consumed only once. |

Append sufficient wire state to `PlayerState` in schema 25:

- `momentumX: float32` and `momentumY: float32`;
- `slidePhase: uint8`;
- `slidePhaseTick: uint8`.

`moveStance`, `stanceSeq`, `height/vh`, and the four new fields form the authoritative replay anchor. `slideChainCount` need not be network gameplay state: the local client can derive it from accepted landing/hop edges, and remote pitch is nonessential. The server mirrors `CombatState.momentumX/Y`, phase, and phase tick to `PlayerState` after every authoritative step, just as it mirrors `mvx/mvy` and `vh` now.

`PlayerState.mvx/mvy` continue to mean the effective primary movement velocity seen by animation and enemy lead calculations. While carry is active they mirror `momentumX/Y`; they are not added to it. `PlayerState.vx/vy` remains the separate impulse overlay. This preserves existing queries such as `target.mvx + target.vx` without double-counting.

Every reset that currently calls `zeroMoveVel` must also zero both momentum vectors, clear all slide phases/caches/buffers, reset the held edge, and disarm any stale chain. This covers pit snap-back, revive, run restart, rift descent, training reposition, and teleport hard-resync (`packages/server/src/rooms/GameRoom.ts:5950-5980`). Freeze/down/death and terminal combat teardown use the same clearing helper.

### 1.3 Shared deterministic step

Put the scalar/vector laws in shared pure functions used by both server and predictor. They may live in `movement.ts` or a small `slide-momentum.ts` exported from shared; there must be one implementation of each equation.

The active carry vector is `M = (momentumX, momentumY)`, with `S = |M|` and unit heading `H = M / S`.

Cold acceptance:

1. Sample heading from effective `mvx/mvy`; use non-zero movement input only if the synchronized velocity is degenerate.
2. Set `M = H × 544`. This is assignment, never `oldSpeed + 544`, and the global player-authored slide cap is 544.
3. Enter `GROUND` at phase tick 0. The first horizontal integration uses 544 immediately.

Ground slide tick:

1. Rotate `H` toward non-zero movement input by at most `90°/s = 4.5°` per 50 ms tick. Aim never participates.
2. Integrate position with the current `M` for this tick.
3. If no hop/exit occurred, set `M := 0.97 × M` for the following tick and increment `slidePhaseTick`.

This ordering produces the designer's exact cold movement schedule: 544.0, 527.7, 511.8, 496.5, 481.6, 467.2, 453.1, 439.5, 426.4, and 413.6 px/s; ten integrations cover 238.1 px. An ideal hop at 100 ms launches before integrating a third ground tick, from the twice-decayed 511.8 value.

Hop launch:

1. Set `M := 0.96 × M` once, capped at 544 and preserving heading.
2. Set `vh = 285`, retain `STANCE_SLIDE`, switch subphase to `AIR`, and run the unchanged `stepVertical` gravity law.
3. While airborne, rotate heading toward non-zero input by at most `120°/s = 6°` per tick. Preserve magnitude exactly unless collision or higher-priority displacement removes it. Input never adds magnitude.

The ideal cold hop therefore carries 491.4 px/s, uses the shipped `1250 / 900 / 2200 px/s²` gravity zones, reaches about 33.5 px, and budgets ten airborne ticks/about 245.7 px. Do not tune gravity or infer horizontal speed inside `stepVertical`; vertical remains an independent deterministic channel.

Landing chain acceptance:

1. On the one authoritative air-to-ground edge, cache the pre-landing `M` in `slideLandMomentumX/Y` and stamp `lastSlideLandingTick`.
2. A valid Ctrl buffer/hold may accept on that landing boundary or while `currentTick - landingTick <= 3`.
3. Let `L = |slideLandMomentum|`. Re-slide heading is the cached landing heading, bent only later by the normal carve. Set:

   `nextSlideStart = min(544, 0.95 × L + 72)`

4. Assign `M` to that speed once, clear the landing cache/window, enter `GROUND` tick 0, and increment the presentation chain count.

If no chain is accepted, copy the current effective carry into ordinary `mvx/mvy`, clear `M`, and let shipped `steerVelocity` normalize toward at most 320 using its 2600 px/s² recovery/stop laws. The immutable landing cache survives only through the three-tick opportunity; acceptance uses it rather than the already-normalizing `mvx/mvy`. Expiry clears it and resets the chirp ladder.

### 1.4 Where the shared step runs

The server tick order must remain explicit:

1. Consume the newest acknowledged command and derive slide/jump edges.
2. Resolve stance transitions and any launch that belongs to this command tick.
3. In the horizontal player phase, call the slide carry step when `slidePhase` is `GROUND` or `AIR`; otherwise call the byte-for-byte ordinary `stepSteeredMovement`. Apply beam/root multipliers only to ordinary movement. A rooted action that wins over slide first cancels carry.
4. Resolve bounds, wall/POI/belt, and player-body collision. Project the carry off the same collision normal or replace it with the velocity implied by the accepted displacement. If the remaining grounded slide speed is below 256, break the chain. Server and predictor must call the same world-collision path for static geometry.
5. Apply `stepImpulse` separately after authored movement, as today. Never feed the result back into `M`.
6. Run pit checks with the takeoff/landing guards in §4.2.
7. Run unchanged `stepVertical`; on its air-to-ground edge, call the shared landing-cache/retention transition exactly once.
8. Mirror effective `mvx/mvy`, momentum, phase, phase tick, height, and `vh` to schema state.

This preserves the present rule that ordinary movement has no sprint layer. Only a non-zero slide carry vector bypasses `MOVE_SPEED`.

## 2. Command stream and prediction

### 2.1 Input protocol

Extend the numbered 20 Hz `input` command with `slideHeld: boolean`. Do not overload `crouchHeld`:

- `crouchHeld` is the output of the grounded Space 150 ms hold classifier and promises the rooted distance-jump charge.
- `slideHeld` is physical/remapped Ctrl state and must be available before, during, and just before landing for edge and buffer logic.
- A speed discriminator is an acceptance gate (`speed >= 256`), not an input discriminator. Reusing `crouchHeld` and branching on speed would let one noisy movement sample choose between a stationary 372 px route leap and an immediate fast slide.
- Do not use Shift tap/hold. The queued roll fires on Shift keydown; delaying it breaks its defensive contract, while firing it immediately contaminates every slide.

`InputCmd`, the server's held input record, client `PredCmd`, input validation, and wire send all gain the flag. The server clamps it to a boolean exactly like `crouchHeld`. A cold slide derives only from `slideHeld && !slidePrevHeld`; holding Ctrl across a denied cold entry does not retry every tick. Landing chains are the explicit exception: held Ctrl may arm them without a new edge.

Arena input rules:

- Grounded outside slide: shipped Space behavior is unchanged—tap emits jump on release; holding 150 ms emits `crouchHeld`; airborne fresh press emits pound.
- While an accepted/predicted `STANCE_SLIDE` is in grounded `GROUND` phase, Space `JustDown` emits `jump` immediately. It bypasses the 150 ms classifier.
- That Space press sets `spaceConsumedUntilRelease`. It cannot be reinterpreted as pound on the following airborne render frame. A later release only clears the latch; a second fresh press above `POUND_MIN_HEIGHT` may pound.
- A Space press during slide ticks 0–1 sets the hop buffer and launches at tick 2. Ticks 2–8 launch immediately. A press after 400 ms does not carry momentum: it fills the ordinary jump buffer and may jump after slide expiry.
- If a new Ctrl edge and the Space hold threshold arrive in the same command while no stance is already accepted, process slide admission first. If crouch was accepted on an earlier command, it owns the player and Ctrl is denied. Once slide owns the player, the fresh Space edge means hop, never crouch charge.

### 2.2 Landing buffers at 20 Hz

All windows use integer authoritative ticks:

- Ctrl edge during the final two airborne ticks sets a two-tick pre-landing buffer. Current `slideHeld = true` on the landing command also qualifies.
- Landing records `landingTick`. Ctrl is valid on the boundary and while `currentTick - landingTick <= 3`; age 4 is the first rejection.
- A fresh Space edge in the final two airborne ticks is retained only when Ctrl is already held/buffered. It is consumed after the landing slide reaches its required 100 ms/tick-2 hop point.
- Holding Space never auto-hops. Each hop needs a fresh edge, even when the edge was accepted before landing.
- Early Ctrl held for the entire flight is allowed and arms at landing. If Ctrl was pressed and released before the two-tick pre-landing zone, it does not leave a stale buffer.

This follows the shipped jump-buffer philosophy but uses tick counters rather than seconds so the server and replay cannot disagree at 149/151 ms.

### 2.3 Predictor state and replay

Extend `PredState` with `momentumX/Y`. Extend `PredStanceState` with every gameplay-relevant slide private field listed in §1.2: phase/tick, previous-held edge, hop/pre-landing/Space buffers, landing window and cached vector, cold arm/re-arm ticks, and last landing tick. `spaceConsumedUntilRelease` belongs to `SpaceGestureClassifier`, not movement physics. `slideChainCount` may remain presentation state.

Every `PendingPredCmd` snapshots, before that command is simulated:

- momentum vector;
- slide stance/subphase and phase tick;
- `slidePrevHeld`;
- all three input buffers and the landing window/cache;
- cold arm/re-arm state;
- last landing tick;
- the existing jump, crouch, dash, pound, recovery, aim, `mvx/mvy`, and impulse state.

`stepPredictionTick` mirrors the server order exactly: consume slide/jump intent, transition/launch, step carry or ordinary controller, resolve shared static collision, step separate impulse, step vertical, and run landing retention. Render preview uses the same carry and vertical functions; it must not extrapolate a slide as ordinary capped walking.

### 2.4 Rebase, denial, and divergence adoption

The current reconcile path always rebases position, ordinary steering velocity, impulse, height, and `vh`, but private stance replay mainly starts from pending snapshots unless `stanceSeq` changed (`packages/client/src/net/prediction.ts:845-956`). That is insufficient for carry: after the causative command is acknowledged, the next pending snapshot can still remember a locally accepted slide that authority denied.

Use these laws:

1. **Authoritative carry always rebases.** For every patch, initialize the replay anchor from server `x/y`, `mvx/mvy`, `vx/vy`, `height/vh`, `moveStance`, `momentumX/Y`, `slidePhase`, and `slidePhaseTick`, then replay only commands newer than `ackSeq`. Do not interpolate or threshold the momentum vector itself; it affects gameplay. Preserve the already-drawn position through the existing error offset, so ordinary corrections glide unless they exceed the snap threshold.
2. **Private anchor reconstruction is explicit.** Wire phase/tick plus the locally known last acknowledged `slideHeld` rebuild `slidePrevHeld`. Buffers/caches that cannot validly exist in the wire phase are zeroed. If a patch lands during `LAND_WINDOW`, reconstruct the landing cache from authoritative momentum fields; alternatively, if implementation cannot represent both current normalized velocity and cached landing vector unambiguously, append the cached vector too. Do not infer phase age from animation time.
3. **Denied slide does not bump `stanceSeq`.** A request that never became authoritative is not a forced cancel. When the command containing the rising Ctrl edge becomes acknowledged and server stance/phase is not slide, adopt the server's zero carry, stop pose/audio, and suppress further cold-slide edges until Ctrl is observed released. Rewrite newer pending slide snapshots from that anchor. Positional residual glides; there is no teleport snap.
4. **Forced cancel does bump once.** Damage with displacement, hostile launch/airkeep, pit fall, freeze/down/death, teleport, or another higher-priority writer cancels an accepted slide and advances the existing uint8 `stanceSeq` once. On that change, adopt wire stance/carry, strip causative slide and buffered hop bits from pending replay, and suppress Ctrl until release so replay cannot resurrect the chain.
5. **Organic transitions do not bump.** Slide expiry/release, hop launch, safe landing re-slide, missed landing window, accepted slide-to-roll cash-out, and player-authored pound are deterministic transitions replayed from commands. They change stance/phase but not `stanceSeq`.
6. **Malformed-state guard.** Server and client clamp non-finite momentum to zero and magnitude to 544 before simulation. A correction above the cap is adopted only after sanitization and should produce telemetry/assertion in development.

The velocity correction is intentionally firmer than the visual correction. Blending `M` would make the next landing formula depend on frame rate and correction duration; rebasing physics immediately and gliding only the rendered positional residual keeps the chain deterministic.

## 3. Stance machine

`MoveStance` becomes `0 NONE, 1 CROUCH, 2 DASH, 3 POUND, 4 ROLL, 5 SLIDE`. `STANCE_SLIDE` covers both the low ground slide and its compressed airborne hop; `slidePhase` plus `height/vh` selects the exact pose and law.

| From / event | Gate and authoritative result | Momentum and `stanceSeq` |
|---|---|---|
| `NONE` grounded + Ctrl edge | Alive, not frozen/down, not in recovery/root/interaction, `pitGrace = 0`, non-zero input, effective speed at least 256, cold arm ready. Enter slide ground tick 0. | Assign 544 along current velocity. No seq bump. |
| `NONE` airborne + Ctrl | Never creates an air slide. It may populate only the final-two-tick landing buffer when this flight is already a slide-hop. | No stance change. |
| `CROUCH`/`DASH`/`POUND` + Ctrl | Denied. No queue survives the committed stance. A same-command fresh slide only wins if no earlier stance was already accepted. | No seq bump for denial. |
| `ROLL` + Ctrl | Denied under roll's authored root. | No seq bump. |
| `SLIDE/GROUND` + early Space | Tick 0–1 buffer; tick 2 launch. | `M ×= 0.96`, `vh = 285`, phase `AIR`; keep stance 5. No seq bump. |
| `SLIDE/GROUND` + Space at ticks 2–8 | Launch immediately as above. | Carry survives. No seq bump. |
| `SLIDE/GROUND` + late Space | Populate ordinary jump buffer; after slide exits, it may become a normal jump with no slide carry. | Slide decays/exits normally. |
| `SLIDE/GROUND` + Ctrl release | Ignore through the first 3 commitment ticks; after that, exit organically. | Hand current speed to ordinary normalization, clear carry/chain. No seq bump. |
| `SLIDE/GROUND` tick 10 | Full slide expires after ten movement integrations. | Same organic break/re-arm law. |
| `SLIDE/GROUND` + Shift roll | If the queued roll's ordinary grounded/cooldown gates pass, cash out immediately into stance 4. | Clear carry/cache/chain before installing the roll's own vector; roll inherits no speed. Organic transition, no seq bump. If roll is unavailable, slide continues and Shift is not buffered. |
| `SLIDE/AIR` + Shift | Roll is grounded-only, so deny and do not buffer. | Carry unchanged. |
| `SLIDE/AIR` + fresh Space above `POUND_MIN_HEIGHT` | Existing pound gate wins. The hop-launch Space must have been released first. | Clear carry/cache, set pound stance/vh law. No forced seq bump because this is a predicted player transition. |
| `SLIDE/AIR` + landing with Ctrl buffer/hold | Terrain-safe landing and one-use landing token required. Enter a chain ground slide. | `M := heading × min(544, 0.95L + 72)`. No seq bump. |
| `SLIDE/AIR` + landing without immediate Ctrl | Enter `LAND_WINDOW` for elapsed ages 0–3; ordinary velocity may normalize while cached `L` remains. Late valid Ctrl starts the chain from the cache. | Expiry clears carry/cache and returns `NONE`, no seq bump. |
| Any slide phase + parry | Parry remains an emergency exit. | Clear chain/carry, normalize toward 320, then open parry. Accepted local transition, no seq bump. |
| Any slide phase + ordinary fire/melee | Allowed; aim remains independent. If the attack itself authors a root/displacement, that writer cancels slide first. | Damage/reach/rate do not scale with speed. |
| Any slide phase + damage only | Damage without knockback does not stand the player up. This deliberately differs from the current crouch/dash-only damage cancel at `GameRoom.ts:2412-2422`. | Carry unchanged. |
| Any slide phase + hostile knockback/launch/airkeep | Higher-priority displacement wins. | Forced clear, one `stanceSeq` bump, then apply external impulse/vh. |
| Any slide phase + pit/freeze/down/death/teleport | Forced cancel/reset. | Clear all carry/buffers; one stance bump if a stance was active; teleport path also bumps `teleportSeq`. |

Slide does not share crouch's timer, aim capture, distance-jump cooldown, automatic launch, fire cancel, or damage cancel. Its only reuse is visual vocabulary.

## 4. Authoritative chain economy and exploit guards

### 4.1 Exact server-side economy

The designer's numbers are authoritative constants, not client feel approximations:

| Law | Value |
|---|---:|
| Entry floor | 256 px/s (`0.80 × MOVE_SPEED`) |
| Cold re-arm | 6 qualifying grounded ticks / 300 ms |
| Cold pop and absolute authored cap | 544 px/s (`1.70 × MOVE_SPEED`) |
| Ground slide decay | `×0.97` after each 50 ms ground integration |
| Ground slide duration | 10 movement ticks / 500 ms |
| Ground commitment | 3 ticks / 150 ms |
| Ground steer | 90°/s |
| Hop window | tick ages 2 through 8 / 100–400 ms |
| Hop vertical kick | 285 px/s |
| Liftoff retention | 96% once |
| Air magnitude decay | none |
| Air steer | 120°/s |
| Ctrl and Space pre-land buffers | 2 ticks each |
| Post-land window | through elapsed age 3 / 150 ms |
| Landing retention and scrape kick | `min(544, 0.95L + 72)` |
| Collision chain-break floor | 256 px/s |
| Broken-chain normalization | shipped 2600 px/s² controller law toward max 320 |

For the ideal two-ground-tick rhythm, takeoff speed `T` follows:

`T(n+1) = 0.97² × (0.95 × 0.96 × T(n) + 72)`

`T(n+1) = 0.8581008 × T(n) + 67.7448`

The fixed point is 477.4 px/s before liftoff. Landing re-slide begins at 507.4; two ground ticks cover about 50.0 px; air carry is 458.3 for about 229.1 px; the 600 ms cycle averages 465.2 px/s, or 1.45× walking. The cold first cycle averages about 498.8 and converges down.

Repeated later plants retain the designer's diminishing economy: 3 ground ticks converge near 392.0 takeoff/385.6 average; 4 near 330.9/329.0; 5 near 285.1/286.7. The enforcement site is the shared ground-decay → one-time air-retention → one-time landing-retention function, called by `GameRoom` and `prediction.ts`. The 544 clamp runs after every player-authored assignment and is the hard anti-sprint/anti-corruption bound. No stamina system or separate soft cap may replace this recurrence.

The cold pop cannot be spammed on flat ground. Accepting a cold slide disarms `slideColdArmed`. A successful chain landing bypasses the cold arm; any completed/broken/missed chain requires six consecutive grounded ticks with non-zero input and effective ordinary speed at least 256. Leaving the ground, falling in a pit, entering a root, or dropping below the floor resets the counter.

### 4.2 Anti-exploit and priority laws

- **Pit grace:** cold and chain slides are denied while `pitGrace > 0`. Pit snap-back calls the expanded `zeroMoveVel`, clearing momentum, landing cache, buffers, and cold run-up. Grace damage immunity never becomes a momentum-preservation window.
- **Takeoff at a pit lip:** a slide hop accepted before the pit phase must use the same takeoff rule as a normal jump. The pit test treats a positive accepted upward `vh`/slide `AIR` phase as airborne for that tick even if `stepVertical` has not yet raised `height`; otherwise horizontal-before-vertical ordering can turn a valid predicted lip hop into a fall.
- **Landing on a pit:** before consuming landing retention, test the authoritative landing center with the existing arena/belt pit query. An unsafe landing cannot re-slide or use the three-tick escape window; clear carry/cache immediately and let the existing pit fall/snap route resolve. This prevents a high-speed landing from skating out during the one tick before the ordinary grounded pit pass.
- **Ground slide over a pit:** remains grounded and falls. The 15% max-HP pit loss and 0.6 s grace are unchanged.
- **Juggle:** slide cannot start airborne. Enemy launcher or airkeep cancels an existing slide-hop, clears renewable carry, bumps `stanceSeq`, then writes its authored `vh` and separate impulse. Touchdown mercy remains independent and cannot re-arm slide during grace/root.
- **Displacement priority:** preserve `POUND > ENEMY JUGGLE > ADDITIVE LAUNCHES/PARRY > JUMP/DASH/SLIDE`. Pound may intentionally cash out a legal slide-hop and then owns vertical state. A higher writer always clears lower slide state before applying its own vector; an external impulse is never copied into carry.
- **Duel token:** sliding, hopping, or breaking a chain never releases a combo enemy's claimed duel token. The target can earn a whiff by leaving locked geometry, but cannot make another enemy claim simultaneously. Existing settle/release ownership remains authoritative.
- **Roll and immunity:** slide never writes `rollInvuln`, parry `invuln`, `parriedSeq`, heal/deflect rewards, or any generic immunity. A slide-to-roll transition clears carry before the roll installs its own schedule and separate-field contact protection. Roll's specified ground-AoE/pit/quake exclusions remain roll laws, not slide laws.
- **Hostile impulse:** recoil/knockback continues in `vx/vy`, is summed only for displacement/lead, and decays under `IMPULSE_FRICTION`. Neither its direction nor magnitude can seed a cold slide heading/speed above what ordinary `mvx/mvy` and the 544 assignment allow.
- **Collision:** bounds and static/body collision remove the blocked carry component. A head-on result below 256 breaks the chain. Repeatedly pressing into a wall cannot retain a hidden 544 vector for later release.
- **One landing, one kick:** `lastSlideLandingTick` and phase transition make the 95% retention and `+72` idempotent. Reconciliation, body separation, or multiple ground contacts in one tick cannot pay twice.
- **No root laundering:** slide entry is denied during crouch, distance dash, pound/gather/recovery, roll, beam-authored roots, interaction/revive/shop, level window, down/death, or terminal outcome. Starting slide cancels a non-rooted beam channel only if the existing action treaty requires planted movement; it must not silently move a planted channel.
- **Interactions:** grab/salvage/revive/shop/interact are denied while slide stance is active. Reaching an interaction faster is the reward; resolving it while moving is not.

## 5. Combat, enemy, and route interactions

### 5.1 Negotiated Leap at high target speed

Today `commitCombo` samples the prey's current `mvx/mvy` mainly to choose a facing, then `negotiateComboLanding` fixes a landing marker around the prey's current location. The stored `negotiatedTargetX/Y` is later used by the honest-whiff check (`packages/server/src/rooms/GameRoom.ts:6787-6955`, `6513-6619`). At a 465 px/s sustained gait, the target can travel roughly 300 px during the offer-plus-air promise, making the leap nearly automatic to erase.

Use the designer's bounded lead, not a speed-based validity cap:

1. At Leap Offer/commit, compute effective target velocity as `prey.mvx + prey.vx`, `prey.mvy + prey.vy`. Because `mvx/mvy` mirrors carry, this sees slide momentum without special-casing it; impulse remains a one-time additive prediction only.
2. When effective speed exceeds 400 px/s, forecast target center by 300 ms and cap the lead vector length at 140 px.
3. Run the existing safe/nav landing negotiation around that forecast center. Store that same forecast center in `negotiatedTargetX/Y`, and show the resulting ring/chord from the first offer tick.
4. Freeze it exactly as today. No mid-air retarget, enlarged last-tick footprint, or homing correction is allowed. If no safe forecast landing can be negotiated, decline the leap before offer and select/wait for another authored opener.
5. After a leap settles, combo-capable toughs may weight the designer's broad delayed Gate lane answer with at least 450 ms wind-up. It uses ordinary lock/parry language and does not chase after lock.

A rule that simply invalidates leap whenever target speed is high would make chaining a passive immunity to the archetype and would hide the problem rather than price it. The lead remains bounded and visible, so the player can bend early, leave the lane, parry and lose carry, or cash out to roll. Telemetry must split leap offer/land/whiff rates by target speed band.

### 5.2 Scar, belts, pits, and content pricing

The slide changes the old “no sprint layer” route price by design. The cold ideal air segment is about 245.7 px/3.1 tiles; equilibrium air travel is about 229.1 px, while the committed distance jump remains 372 px/4.65 tiles. Before enabling schema 25 in production:

- simulate all Scar pit lips, optional shortcuts, belt gaps, room gates, and extraction approaches with cold and equilibrium carry;
- preserve ordinary jump/walk connectivity for mandatory routes, boss exits, loot access, regroup paths, and encounter admission;
- treat newly reachable roughly three-tile lines as optional mastery shortcuts, never mandatory progression;
- retain the distance jump's monopoly on four-tile-class planned crossings;
- verify a grounded slide enters every pit it crosses, while only positive-height hop samples clear ground-coupled pits; and
- use quorum/squad-safe encounter triggers so one expert arriving roughly 700–1000 px early cannot start a shared irreversible event for walkers.

This is a re-pricing audit, not permission to inflate enemy speeds, projectile speeds, objective clocks, or map gaps around the expert gait. If Scar loses its risk identity or mixed-skill players lose shared decisions, lower the slide economy rather than taxing ordinary movement.

### 5.3 Quake and attack eligibility

- Grounded `STANCE_SLIDE` is grounded for every red/quake/pool/pit test and receives no dodge benefit.
- A slide-hop clears only attacks whose existing rule checks positive `height` as a feet/ground attack. On the exact launch tick, use the same phase-order rule as ordinary jump; do not invent slide-only mercy.
- Ordinary 2D melee, projectiles, beams, contact, and zones continue to hit an airborne hopper unless their existing implementation is explicitly ground-coupled.
- Slide's compressed silhouette does not shrink `PLAYER_RADIUS = 24`, collision, pickup, melee, or projectile geometry.
- Parry remains available and cancels the chain. Roll remains the only queued movement verb with its separate contact-test invulnerability, and even that does not avoid its spec's ground AoE, pit, or quake channels.

## 6. Client presentation

### 6.1 `SpriteRig`

Add a distinct slide family to `applyJumpFeelPose` and its stance-edge tracking:

- `SLIDE/GROUND`: acceptance-tick fold to 0.62× height, 1.08× width, and 0.14 rad lean along travel. Keep the body/shadow center on the authoritative 24 px circle; do not rotate the whole card edge-on.
- Shape the forward foot as the low leading corner, trail rear foot/weapon, widen the shadow 12% along motion, and compress it 18% across motion.
- `SLIDE/AIR`: unfold only to a compact 0.90× launch compression, then a low forward spear with tucked feet and trailing weapon. Shadow reaches only about 0.90× at apex so it reads lower than standard jump.
- Chain landing: one 50 ms tick at 0.76× height, flowing directly into the next 0.62× fold. Missed chain unfolds under the ordinary pose blend.
- Remote rigs consume `moveStance`, `slidePhase`, height, `vh`, and effective heading. They do not infer stance from speed alone.
- Roll art remains visually distinct: slide never uses the roll's edge-on/reverse-face or i-frame readability.

### 6.2 `jump-effects.ts`, camera, and LOD

Extend the retained/pool-owned effect object; no per-hop scene objects or unbounded particle allocation:

- Add a scrape-wake pool: local emits one material-tinted scuff every 100 ms with at most 5 alive; each visible remote emits every 200 ms with at most 2 alive.
- Add exactly two short tapered speed-line slots while effective authored speed is above 400. Lines trail behind the body, never ahead of the hurtbox, never cover protected hostile telegraph depth, and stay at or below depth 99850.
- Add a small forward dust stamp on successful chain landing and a short crease snap on hop. Reuse existing landing/dust pools where their ownership/lifetime fits; do not steal pound streak slots.
- Visibility/LOD gate remote wake before emission. Off-camera remotes receive pose state only. At high actor count, drop remote wake first, then local dust cadence; keep stance silhouette and hostile telegraphs.
- Reduced-motion mode removes animated wake, speed lines, camera zoom/trail, and any hop crease motion. It retains the low pose and one static ground scuff. There is no routine slide/hop/landing camera shake.
- For the local player only, blend a sustained-speed camera envelope from 400 to 544 over 150 ms: at most 2.5% zoom-out and 10 px trail opposite velocity with a 90 ms time constant; return over 250 ms. Belt/authored cameras may opt out.

### 6.3 Audio cue sites

Add manifest-ready samples/recipes without aliasing dodge or roll cues:

- material loops `player-slide-scrape-dust`, `-snow`, `-moss`, `-cinder`, and `-chrome`: 1.0 s seamless loops, 25 ms fade-in, 80 ms fade-out;
- `player-slide-hop-chirp`: 0.18 s, two variations;
- `player-slide-chain-break`: 0.20 s, two variations.

`ArenaScene.presentJumpFeel` owns edge detection and calls `AudioBus`:

- accepted/predicted `GROUND` entry starts the material loop and suppresses discrete footsteps;
- loop rate maps 0.90 at 320 to 1.15 at 544, gain maps 0.45 to 0.75 of local movement bus, and remote gain is 40%; update at tick/quantized cadence, not every render sample;
- hop edge fades the ground scrape and plays chirp; successful chains 2 and 3 add +2 semitones each, then cap;
- chain ground contact restarts the scrape without overlapping duplicate loops;
- expiry/cancel/collision/pit/denial plays the dry chain-break once, resets the ladder, and returns footsteps;
- forced reconciliation stops stale loops immediately while positional correction still glides.

Update `AudioBus` concurrency so one loop exists per player/material family, remote loops virtualize when inaudible, and repeated chirps/breaks cannot crowd combat cues. Add the five loop and two one-shot entries to the soundkit authoring manifest; generated public audio is touched only by the normal audio-render pipeline when assets exist.

## 7. File/touch list and wave plan

This is the implementation touch map, not a change authorization:

| Area | Files / responsibility |
|---|---|
| Shared constants and laws | `packages/shared/src/constants.ts`: schema 25, stance id 5, exact tick/economy constants. `packages/shared/src/movement.ts` or new `slide-momentum.ts`: pure rotation, ground decay, hop transfer, landing retention, cap, and normalization handoff. `packages/shared/src/index.ts`: exports. |
| Schema | `packages/shared/src/state.ts`: append momentum and phase replay-anchor fields after all schema-24 fields; never reorder existing decorators. |
| Server | `packages/server/src/rooms/GameRoom.ts`: command validation/held state, `CombatState`, transition gates, horizontal branch, collision feedback, pit guards, landing retention, forced-reset helper, damage/knockback distinctions, combo lead, and schema mirrors. |
| Prediction/input | `packages/client/src/net/prediction.ts`: command shape, Ctrl/Space classifier treaty, predictor/private snapshots, exact step/replay, authoritative carry rebase, denied-edge adoption, render preview. `packages/client/src/scenes/ArenaScene.ts`: Ctrl binding/remap, command send, ServerView fields, presentation edges, interaction denial, camera/audio hookup. |
| Rig/VFX/audio | `packages/client/src/entities/SpriteRig.ts`, `packages/client/src/vfx/jump-effects.ts`, `packages/client/src/audio/AudioBus.ts`, `tools/soundkit/sfx-manifest.json`, and generated audio only through its existing pipeline. |
| Tests | `packages/client/src/net/prediction.test.ts`, `packages/server/src/rooms/GameRoom.test.ts`, `packages/server/src/integration.test.ts`, plus shared movement tests colocated under the repo's existing test convention. Update sample-bank/audio tests when manifest/recipes land. |
| Content audit | Scar/belt/map fixtures and combo telemetry/tests. Map values change only if the audit finds an unintended mandatory shortcut or broken squad trigger. |

Wave recommendation:

1. Freeze the slide contract after roll wave 21b so stance/input transition tests include the real roll behavior.
2. Pure shared slide math and table-driven tests can be authored in parallel with schema 23/24 because a new isolated module need not touch decorators or room/client state. The Scar route simulation, audio asset work, and pose/VFX prototyping are also parallel-safe.
3. Merge/integrate the protocol only after schema 24 lands, as schema 25. `constants.ts`, `state.ts`, shared exports, `GameRoom.ts`, `prediction.ts`, and `ArenaScene.ts` are high-conflict files with roll/ultimate/dual-wield work and should be serialized or rebased under one owner.
4. After the shared/schema anchor lands, server authority and client prediction can proceed in parallel against the same golden vectors; rig/VFX/audio can proceed independently from the wire phase contract.
5. Ship only when server/predictor golden traces, mixed-latency play, roll coexistence, combo lead, and Scar/belt audit all pass. Do not temporarily consume schema 22–24 or overload stance 4.

## 8. Verification strategy

### 8.1 Shared deterministic golden tests

- Assert all ten cold speeds and 238.1 px full-slide distance at 50 ms.
- Assert hop at tick 2 produces 511.8 pre-transfer and about 491.4 post-transfer; verify `vh = 285` and the same discrete height/vh trace on server and predictor.
- Run at least 1,000 ideal chains from several headings. Assert recurrence `0.8581008T + 67.7448`, convergence to 477.4 takeoff/507.4 slide start, and no value above 544.
- Repeat 3-, 4-, and 5-ground-tick rhythms and compare 392.0, 330.9, and 285.1 takeoff equilibria within explicit float tolerance.
- Rotate at exactly 4.5° ground and 6° air per tick; prove input cannot add magnitude and reversal cannot snap the vector.
- Prove ordinary movement traces are byte/numerically unchanged when momentum is zero.

### 8.2 Buffer and stance boundary tests

- Space on slide ticks 0/1 buffers to 2; ticks 2 and 8 carry; tick 9/after 400 ms becomes ordinary buffered jump without carry.
- Ctrl edge at two and one airborne ticks before landing, held-through-flight Ctrl, landing-tick Ctrl, and post-land ages 1/2/3 all accept; age 4 rejects. Early press released before the pre-window rejects.
- Fresh buffered Space chains after the new slide reaches tick 2; held Space never repeats. The consumed launch press cannot become pound; a release/new press above 24 can.
- Same-command Ctrl edge plus new crouch threshold deterministically chooses slide; already accepted crouch denies slide. Slide never inherits crouch aim/timer/cooldown.
- Release during commitment, expiry at ten integrations, six-tick cold re-arm, collision below 256, parry, roll cash-out, pound cash-out, and every forced cancel have exact stance/sequence outcomes.
- Server-denied slide leaves `stanceSeq` unchanged, stops local slide when its edge is acked, and requires Ctrl release before a new cold edge. Forced cancel advances once and pending replay cannot resurrect it.

### 8.3 Reconciliation and network tests

- Generate identical command traces through shared/server/predictor at 0, 50, 100, 200, and jittered latency with packet batching. Compare position, `mvx/mvy`, momentum, phase/tick, height/vh, caches, and stance after every replay.
- Correct during ground decay, hop launch, apex, final pre-land buffer, landing retention, and the three-tick late window. Physics adopts authoritative momentum immediately while visual position uses the normal residual glide.
- Deny for entry speed, pit grace, roll/root, stale held Ctrl, and cold re-arm; verify no phantom chirp/loop or repeated retry.
- Reconcile a collision normal and a landing on a pit. The client must shed the same component/cache and must not wall-rubber-band with preserved hidden carry.
- Teleport/pit snap/freeze/down/resume clear carry and buffers; schema-25 reconnect/hard resync cannot inherit pre-disconnect chain state.
- Quantize/cap malformed NaN, infinity, and >544 states identically.

### 8.4 Combat, content, and performance tests

- Damage-only hits preserve slide; every hostile displacement writer clears it before impulse/launch. External impulse never appears in a later re-slide formula.
- Duel token remains claimed throughout slide whiffs. Juggle priority, pound ownership, mercy, and `stanceSeq` match the existing laws.
- Grounded slide is hit by quakes/red ground areas/pools/projectiles/contact; positive-height hop clears only existing ground-coupled channels. Slide never emits parry/roll rewards.
- Slide-to-roll begins the exact roll schedule at its own speed, consumes its own cooldown, uses only `rollInvuln`, and inherits zero carry. Airborne Shift is denied.
- Negotiated Leap above 400 uses a 300 ms/140 px visible lead, never retargets, and falls back before offer when navigation cannot validate the forecast marker. Compare walker and hopper offer/whiff telemetry.
- Simulate cold/equilibrium hops across every Scar and belt gap; flag newly reachable mandatory triggers, four-tile crossings, and any landing re-slide that escapes a pit.
- Four-player soak with all players chaining: no pool growth, no per-tick allocations, no loop leaks, remote wake respects 200 ms/2-alive limits, local wake respects 100 ms/5-alive, and telegraph depth/visibility remain intact. Repeat with reduced motion and off-camera teammates.

## 9. Three questions required before implementation

1. **Roll/input treaty:** Does the orchestrator's queued-roll assignment override the advocate's recommendation to remove roll—meaning Shift remains roll/stance 4 and dedicated Left Ctrl plus `slideHeld` is approved for slide/stance 5, including grounded slide-to-roll cash-out?
2. **Profile channel:** Is the designer's cosmetic-only low profile binding for v1, or must this wave also add the advocate's explicitly tagged high/overhead attack channel and at least one readable authored exam? Generic projectile immunity and radius shrink are rejected either way.
3. **Leap response:** Is the designer's visible 300 ms lead capped at 140 px approved for high-speed Negotiated Leap targets, or should combo AI suppress Leap Offer above the speed threshold and select another opener as the advocate recommends? The implementation cannot safely ship both policies implicitly.
