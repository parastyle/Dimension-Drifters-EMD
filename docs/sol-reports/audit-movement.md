# Movement Audit — Understanding and Plan

## Audit scope

This is a read-only audit of Dimension Drifters’ complete in-game movement path: shared authoritative locomotion and movement abilities, server input/tick processing, client prediction and reconciliation, the `stepNetInput` / predictor / `rawFlourishIntent.desiredMoveX/Y` seam, remote interpolation, correction behavior, freeze/hitstop, animation and camera coupling, and the open Galvanic Overcasters character-movement defect.

The evaluation target is a fluid, weighty, snappy top-down co-op bullet-heaven. Findings will be prioritized P0/P1/P2 and will cite exact `file:line` locations. Every finding will state the observable feel or correctness problem, the best-practice standard it violates, and a concrete fix with implementation approach and tuned starting values. The report will identify the single largest feel win and end with an explicit verdict.

## Plan

1. Map movement constants, state, and transitions in `@dd/shared`, including acceleration, friction, speed limiting, pivots, diagonal normalization, dash/roll, slide/slide-hop, jump/ground-pound, crouch jumps, i-frames, momentum, and cancels.
2. Trace input from `ArenaScene` through `rawFlourishIntent.desiredMoveX/Y`, `stepNetInput`, transport, server tick, prediction replay, reconciliation, and render/camera/animation presentation.
3. Trace Galvanic Overcasters-specific effects across shared, server, and client code and isolate the remaining character-movement divergence.
4. Compare behavior with action-game and authoritative-netcode best practices, quantify risk, and append evidence-backed prioritized findings and recommended tuning.
5. Recheck all citations and distinguish verified behavior from inference before writing the final verdict.

---

_Audit completed against the current main workspace tree. This is a read-only code audit; no game code or tests were changed._

## Trace checkpoint

- The authoritative/predicted locomotion seam is `rawFlourishIntent.desiredMoveX/Y` → `ArenaScene.stepNetInput` → sequence-numbered 50 ms commands → the server's drain-to-newest input queue → shared `stepSteeredMovement`/`stepImpulse` → owner rebase and pending-command replay.
- The shipped universal kit is not the older slide-hop/crouch kit: grounded Space launches the committed distance jump, airborne Space requests pound, and Shift/Ctrl starts the fixed roll. Crouch, ordinary hop, higher jump, slide, and slide-hop survive only as tombstones, aliases, stale constants/comments, or cosmetic names.
- The known Overcasters movement failure is reproducible from architecture alone: predicted burst recoil mutates the current impulse velocity from render-time callbacks, but recoil is absent from the pending replay journal. Every authoritative patch can therefore erase, duplicate, or phase-shift a locally predicted round.
- Roll safety is mechanically legible (250 ms invulnerable opening, 150 ms vulnerable tail), but its cancel inputs are not robust: early attack/parry taps are blocked before transport, ordinary attack cancellation is not journaled by the movement predictor, and parry remains invisibly locked after the roll ends.

## Executive assessment

The ordinary WASD core is much healthier than the surrounding movement/action seam. It is deterministic, shared, diagonally normalized, directly responsive on turns, and the previously objectionable direction-switch penalty has already been reduced to near-zero. The fixed roll and distance jump also have unusually clear authored distances and durations.

The largest risks are architectural rather than another round of scalar tuning:

1. owner-authored recoil is applied outside the prediction/replay timeline, which is the likely cause of the still-open Galvanic Overcasters character-movement failure;
2. movement stance transitions and cancels are duplicated between the server and client rather than owned by the shared simulation;
3. roll safety and action cancellation are decided by scattered hit/action call sites, so the same-looking input or attack can produce different results;
4. local hit-stop freezes the rendered owner while prediction and authority continue moving.

**Single biggest FEEL win:** move every owner-authored recoil round into a fixed-tick, receipt-backed prediction event journal and replay it with movement. Firing while strafing is a core loop, and this removes the largest observed owner-body vibration/correction debt at its cause instead of hiding it with presentation clamps. The largest low-risk locomotion-only win is a 100 ms start/stop profile with no additional turn hitch.

## Actual shipped movement contract

| Input | Shipped behavior | Authoritative numbers | Audit reading |
|---|---|---:|---|
| WASD | Direct-heading locomotion with acceleration/release deceleration | 320 px/s; 2,600 px/s² acceleration and deceleration | Correct diagonal normalization and immediate heading; reaches/stops from full speed in three 50 ms samples |
| Shift or Ctrl | Fixed-direction dodge roll | 400 ms, 188 px; speed samples 680/640/580/500/420/340/300/300 | First 250 ms are direct-attack safety; final 150 ms are vulnerable recovery |
| Grounded Space | Immediate distance jump | 620 px/s, 372 px nominal reach, about 59 px apex, 2.5 s cooldown, up to ±27° steering | This is the only player-initiated ground jump |
| Airborne Space | Ground pound request | 100 ms gather, 1,400 px/s descent, 90 px radius, 250 ms recovery | Can cancel the distance-jump flight once above 24 px |
| Crouch / normal hop / higher jump / slide / slide-hop | Not shipped | Retired stance/phase IDs and stale aliases remain | These are not hidden combinations; the current server explicitly says they do not exist |

Evidence: `packages/shared/src/constants.ts:105-143`, `packages/shared/src/constants.ts:507-572`, `packages/client/src/net/prediction.ts:210-249`, `packages/server/src/rooms/GameRoom.ts:4965-4995`.

This matters for interpreting the requested “full kit”: the current code is a three-verb kit—roll, distance jump, pound—not the older crouch/slide-hop ladder. `STANCE_CROUCH` is a tombstone, `STANCE_SLIDE` aliases the roll, and the AIR/LAND_WINDOW slide phases are reserved but never authored (`packages/shared/src/constants.ts:509-516`, `packages/shared/src/constants.ts:574-590`). `JUMP_VELOCITY`, `JUMP_AIRTIME`, and map comments still describe a lower ordinary hop, but no player launch path uses that kick (`packages/shared/src/constants.ts:301-308`, `packages/shared/src/constants.ts:480-505`).

## What already follows best practice

- **Diagonal normalization and turn response are correct.** `steerVelocity` normalizes the input vector before applying speed, so W+D is not faster than W or D. It snaps heading immediately and applies weight only through speed (`packages/shared/src/movement.ts:103-144`). At 320 px/s, a full reversal retains 306.56 px/s for one tick, travels 15.328 px instead of 16 px, and is back at cap on the next tick. The one-tick loss is only 0.672 px. The prior 42% reversal penalty is now 4.2%, a 90% reduction (`packages/shared/src/constants.ts:122-143`). The owner’s previous direction-switch request is satisfied; do not restore the old penalty.
- **Input transport is low-latency without inventing simulation time.** Fresh `rawFlourishIntent.desiredMoveX/Y` is sampled from WASD and passed to `stepNetInput` (`packages/client/src/scenes/ArenaScene.ts:4761-4780`). Direction changes can send immediately, while only the 50 ms heartbeat advances a full prediction tick; one-shot traversal edges retain local-first prediction (`packages/client/src/scenes/ArenaScene.ts:15677-15797`). The server validates monotonic sequence numbers, budgets messages, caps the queue, keeps the newest intent, and preserves one-shot edges while draining (`packages/server/src/rooms/GameRoom.ts:1455-1498`, `packages/server/src/rooms/GameRoom.ts:5315-5388`).
- **The basic reconciliation shape is sound.** The owner rebases from authoritative position, steering velocity, impulse velocity, stance, and height, trims acknowledged commands, then replays pending 50 ms inputs (`packages/client/src/net/prediction.ts:1162-1302`). Explicit teleports use `teleportSeq` instead of trying to infer every reposition (`packages/shared/src/state.ts:162-177`).
- **Remote rendering is bounded rather than speculative.** Remote entities render 120 ms behind a server-tick timeline, interpolate bracketed samples, extrapolate for at most 60 ms, then hold; teleport-sized gaps cut (`packages/shared/src/constants.ts:261-272`, `packages/client/src/net/snapshots.ts:91-185`). That is an appropriate default for authoritative co-op PvE.
- **Roll shape is readable on paper.** Eight exact 20 Hz samples total 188 px, with five safe ticks and three vulnerable ticks (`packages/shared/src/constants.ts:558-572`). Roll immunity is distinct from parry reward state (`packages/shared/src/combat.ts:36-47`), which correctly prevents a dodge from minting parry rewards.
- **Space has an actual buffer.** A 250 ms jump buffer and explicit roll-tail extension prevent a late Space press from being discarded merely because the character is finishing a roll (`packages/shared/src/constants.ts:487-491`, `packages/client/src/net/prediction.ts:675-700`, `packages/server/src/rooms/GameRoom.ts:5373-5383`).

## Prioritized findings

### P0 — Galvanic Overcasters recoil is not replayable movement

**Files:** `packages/shared/src/weapons-expansion.generated.ts:14284-14299`; `packages/shared/src/weapons.ts:1050-1064`; `packages/client/src/scenes/ArenaScene.ts:10438-10472`; `packages/client/src/net/prediction.ts:895-902`; `packages/client/src/net/prediction.ts:978-1030`; `packages/client/src/net/prediction.ts:1209-1282`; `packages/server/src/rooms/GameRoom.ts:5527-5535`; `packages/server/src/rooms/GameRoom.ts:10592-10610`; `packages/server/src/rooms/GameRoom.ts:10764-10775`.

**Feel/correctness problem.** Overcasters fires four rounds 50 ms apart with authored recoil `0.0035`. The shared formula turns each round into about 391 px/s of owner impulse (`190 × 0.0035 / 0.0017`), with the burst quickly reaching the 780 px/s impulse cap. Authority applies a round after that tick’s movement integration, so its displacement begins on the next server tick. The client instead calls `SelfPredictor.addPredictedImpulse` immediately and schedules later rounds with Phaser wall-clock `delayedCall` callbacks. `addPredictedImpulse` mutates only the predictor’s current `vx/vy`; the pending journal stores input and stance fields, not recoil events.

Every state patch then overwrites `vx/vy` from authority and replays only pending movement commands. A local recoil round that authority has not yet represented is erased; one authority has represented can be phase-shifted or effectively counted against a different local round. The client follow-ups also sample the current local aim, whereas the server recomputes direction from the authoritative body to the fixed target point on each delayed round (`packages/client/src/scenes/ArenaScene.ts:10444-10456`, `packages/server/src/rooms/GameRoom.ts:10565-10573`). Hard strafes and reversals maximize that phase error.

The projectile regression test proves each server projectile starts at the live authoritative transform; it does not exercise owner prediction/replay (`packages/server/src/rooms/GameRoom.v7-overcasters.test.ts:73-151`). Retained live evidence already measured 444.09 px maximum rig/authority separation, 172.87 px after firing, and a 271.63 px rendered step after the projectile-only fix (`docs/sol-reports/v8-overcasters-redo.md:16-26`). This is the known open movement half.

**Best-practice standard violated.** Any locally predicted force that changes gameplay position must be a deterministic event on the same rollback/replay timeline as locomotion, with an authority receipt that can confirm or reject it. Render-clock callbacks must not directly mutate rollback state.

**Concrete fix.**

1. Represent recoil as `PredictedImpulseEvent { attackSeq, roundIndex, simTick, targetX, targetY, impulse, cap }`, not a call that mutates current state. Journal the trigger round and all scheduled burst rounds.
2. Apply each event after horizontal movement/impulse integration on its fixed 50 ms simulation tick, matching the server order; its positional effect therefore begins on the next tick.
3. Key confirmation to an appended owner receipt such as `{ recoilAttackSeq, recoilRound, recoilTick }`. `attackSeq/attackTick` already exists for the accepted trigger (`packages/shared/src/state.ts:198-205`) but is not enough to distinguish every emitted/cancelled follow-up round. On reconcile, drop confirmed events, remove rejected/cancelled ones, and replay all unconfirmed events with pending input.
4. Derive each round’s aim from its fixed world target and the replayed body at that event tick, matching `GameRoom.aimDir`; do not resample `selfAim` from render time.
5. Extract this event application into `@dd/shared` so the server and owner predictor execute the same order and cap.
6. After the root cause is removed, replace the 1,600 px generic owner hard-snap threshold with a three-band policy: ordinary error under 12 px decays at the current 12/s; 12–64 px settles within 100–200 ms; 64–180 px uses a two-to-three-frame soft cut/afterimage; over 180 px hard-snaps. Never allow a position debt to remain because it points sideways to held input.

**Acceptance gate.** Run at least 10 Overcasters bursts through all four directions and both hard reversals at 100 and 200 ms RTT with jitter. Require peak owner rig/authority error `<=64 px`, steady error `<=32 px`, return to `<=4 px` within 250 ms after firing, no unexplained one-frame displacement above `(MOVE_SPEED + currentImpulseSpeed) × frameDt + 6 px` unless the explicit snap band fires, deterministic replay after every patch, and no impulse from a rejected or cancelled round.

### P1 — The 1,600 px correction threshold and direction-constrained repayment turn divergence into long-lived ghost motion

**Files:** `packages/client/src/net/prediction.ts:372-382`; `packages/client/src/net/prediction.ts:1284-1359`; `packages/client/src/net/prediction.ts:1446-1483`; `packages/shared/src/constants.ts:270-272`.

**Feel/correctness problem.** `PRED_HARD_SNAP_PX` evaluates to 1,600 px—five seconds of base movement and eight times the remote-player snap threshold. While input is held, correction is limited to 60% of one frame’s forward budget, 10% reverse, and 5% sideways; at 60 fps, sideways debt can retire at only about 16 px/s and reverse debt at 32 px/s. `constrainRenderStep` then forces the owner’s visible step inside ±10° of the command and folds withheld motion back into the same debt. This avoids a one-frame backward twitch but can leave the rendered body hundreds of pixels from authority for seconds, especially after missing recoil/action events.

**Best-practice standard violated.** Reconciliation smoothing is for small, short-lived error. Large error is a mode transition and must converge under a bounded time budget; presentation constraints cannot be allowed to conceal authoritative divergence indefinitely.

**Concrete fix.** Use the error bands specified in P0, with an explicit maximum settle time of 200 ms for errors up to 64 px and a 180 px hard cut. Remove the input-relative 5%/10% debt caps; instead correct the visual root independently with a critically damped vector and keep gameplay input/predicted state untouched. The camera should follow the uncorrected predicted target so a root correction does not become a camera shove. Instrument current error magnitude, age, cause, and time-to-`<4 px`; fail CI/playtest capture when any non-teleport debt lives longer than 250 ms.

### P1 — Movement stances and cancels are duplicated instead of shared

**Files:** `packages/client/src/net/prediction.ts:551-752`; `packages/server/src/rooms/GameRoom.ts:4765-5105`; `packages/client/src/net/prediction.ts:978-1030`; `packages/server/src/rooms/GameRoom.ts:5397-5520`.

**Feel/correctness problem.** `@dd/shared` owns ordinary steering, impulse integration, vertical physics, and constants, but the actual movement kit—roll acceptance, direction fallback, tick progression, distance-jump launch/steer, pound transition, landing recovery, and cancels—is independently implemented in the client predictor and `GameRoom`. The implementations are currently similar, but action-message cancels and damage-driven cancels live only on the server. Each future tuning or new cancel is therefore a prediction defect waiting to happen.

**Best-practice standard violated.** A deterministic client-predicted movement state machine needs one pure transition function and one phase order. Server-only effects may consume its events, but they should not reimplement its kinematics.

**Concrete fix.** Move a pure `stepPlayerMovementKit(state, command, dt, environment)` into `@dd/shared`. Its serializable state should include steering velocity, impulse velocity, stance, stance tick, roll direction/cooldown, jump/pound buffers, vertical state, recovery, and pending owner-action events. Return effect intents such as `poundLanded`, `rollDodged`, and `stanceCancelled`; the server alone applies damage/VFX receipts. Make both server and predictor call it in the same order. Add golden trace tests that feed 100+ ticks of commands, cancels, collisions, recoil events, and reconciliations and compare every movement field bit-for-bit.

### P1 — The cancel matrix drops taps and disagrees between attack, parry, and pound recovery

**Files:** `packages/client/src/scenes/ArenaScene.ts:10130-10141`; `packages/client/src/scenes/ArenaScene.ts:10575-10590`; `packages/client/src/scenes/ArenaScene.ts:15705-15716`; `packages/client/src/net/prediction.ts:562-568`; `packages/server/src/rooms/GameRoom.ts:1502-1530`; `packages/server/src/rooms/GameRoom.ts:1583-1612`; `packages/server/src/rooms/GameRoom.ts:5087-5103`; `packages/server/src/rooms/GameRoom.ts:5721-5744`; `packages/server/src/rooms/GameRoom.ts:5853-5854`.

**Feel/correctness problem.**

- A quick attack tap in the first 300 ms of roll is returned before transport. Holding the button eventually attacks, but a tap is eaten.
- The server cancels roll when an ordinary attack arrives at/after 300 ms. The predictor only mirrors cancellation through `cmd.fireHeld`, but `stepNetInput` sets that bit only for channel/aura/continuous weapons, not ordinary guns or melee. Authority can therefore cancel the roll while local replay continues it until `stanceSeq` arrives.
- Parry is server-buffered for 200 ms if it arrives during the lock, but the client refuses to send while `slideParryLocked`. A tap never reaches that buffer.
- Roll lasts 400 ms, while parry lock is 500 ms plus the initial tick offset (`packages/shared/src/constants.ts:558-572`, `packages/server/src/rooms/GameRoom.ts:4824-4838`). The player is visibly out of roll but still cannot parry for roughly another 100–150 ms.
- Pound landing writes 250 ms recovery and blocks locomotion, roll, and parry, but `canAct` does not check `recoveryT`, so attacks can execute during that “recovery” without an explicit cancel rule.

**Best-practice standard violated.** Action games need an explicit, input-preserving cancel table. Inputs inside a lock should be buffered through the first legal frame, not silently dropped, and prediction must consume the same action edge as authority.

**Concrete fix.**

- Add `attackPressed` and `parryPressed` owner-action edges to the fixed-tick journal; do not infer ordinary attacks from `fireHeld`.
- Roll ticks 0–5: queue attack for tick 6 and queue parry for roll end. Tick 6 onward: attack can cancel immediately. Recommended parry unlock is tick 8/400 ms; if the 500 ms defensive lock is essential, keep a visible 100 ms post-roll recovery pose and always preserve the tap.
- Keep the existing 150 ms attack and 200 ms parry buffer as minimum grace after the legal edge, rather than starting those timers while the action is still locked.
- Define pound recovery explicitly: recommended 150 ms hard commitment, then attack-cancel allowed; roll/parry remain locked for the full 250 ms. Clearing recovery on the accepted attack makes the cancel observable and deterministic.
- Put this matrix in the shared movement-kit transition and unit-test every state/action pair.

### P1 — Roll “i-frames” are resolver-dependent, not a coherent damage policy

**Files:** `packages/shared/src/combat.ts:36-47`; `packages/server/src/rooms/GameRoom.ts:4704-4718`; `packages/server/src/rooms/GameRoom.ts:6212-6247`; `packages/server/src/rooms/GameRoom.ts:9990-10012`; `packages/server/src/rooms/GameRoom.ts:10077-10095`; `packages/server/src/rooms/GameRoom.ts:10225-10266`; `packages/server/src/rooms/GameRoom.ts:11957-11973`; `packages/server/src/rooms/GameRoom.ts:13050-13070`; `packages/server/src/rooms/GameRoom.ts:13405-13417`.

**Feel/correctness problem.** The shared predicate calls the opening “contact-only” immunity. Contact, projectiles, several melee paths, and some Vastaghar attacks manually honor it. Generic boss AoE, beam rectangles, expanding ring bands, and hostile zones call `damagePlayer` without the roll predicate; `damagePlayer` does not centrally know whether a hit is roll-dodgeable. Some of these may intentionally require positional escape, but there is no explicit hit-policy taxonomy for presentation or tests. To a player, the same first-five-tick roll sometimes phases damage and sometimes does not.

The safe/vulnerable boundary is also not clearly presented. Roll VFX/audio still use “slide” names and run for the whole 400 ms (`packages/client/src/scenes/ArenaScene.ts:9940-9970`, `packages/client/src/scenes/ArenaScene.ts:10027-10037`), so the 250 ms safety ending has no distinct cue.

**Best-practice standard violated.** I-frame eligibility should be an explicit property of the incoming hit, evaluated through one avoidance policy. Exceptions must have distinct telegraph language. Safety windows should have audiovisual boundaries that match the authoritative ticks.

**Concrete fix.** Thread a `PlayerHitPolicy` through every hostile hit: `{ rollDodgeable, parryable, airborneAvoidable, persistent, receipt }`. Recommended default: transient projectile, contact, melee, sweep, one-shot AoE, and beam strike are roll-dodgeable; pit falls and persistent puddle/DoT ticks are not. Evaluate roll/parry/pit/lunge immunity in one `resolvePlayerHit` seam before HP, knockback, pressure, or procs. Mark intentionally roll-breaking hazards with unique telegraph/color language. Preserve the current five safe ticks/three vulnerable ticks, but fire a sharp tick-6 cloth/outline change and stop the safety trail at exactly 250 ms. Increment `dodgedSeq` once per attack/hazard receipt, not once per overlap tick.

### P1 — Airborne Space changes meaning near the ground

**Files:** `packages/client/src/net/prediction.ts:210-249`; `packages/client/src/net/prediction.ts:569-584`; `packages/server/src/rooms/GameRoom.ts:4772-4794`; `packages/shared/src/constants.ts:487-505`; `packages/shared/src/constants.ts:534-556`.

**Feel/correctness problem.** The input classifier promises “airborne Space = pound.” Above 24 px that works. At 0.5–24 px, the same pound bit is converted into `jumpBuffer`. During the first rising sliver it usually expires without pounding; during the last falling sliver it can launch a new distance jump after touchdown. The system has changed action identity rather than buffering the intended action.

**Best-practice standard violated.** Buffered input should preserve semantic intent. A pound press may be delayed or rejected, but it should never become a different traversal verb.

**Concrete fix.** Add a separate 120–150 ms `poundBuffer`. If airborne, rising, and below 24 px, consume it as soon as height crosses 24 px. If falling below 24 px, expire it with a quiet denied cue or allow a low-height pound with base damage and the full cooldown/recovery; do not write `jumpBuffer`. Only a new grounded Space edge—or a physically held Space rule that is explicitly tutorialized—may start the next distance jump.

### P1 — Local hit-stop freezes the owner transform while movement prediction and authority continue

**Files:** `packages/client/src/scenes/ArenaScene.ts:4802-4838`; `packages/client/src/scenes/ArenaScene.ts:11346-11360`; `packages/client/src/net/prediction.ts:1304-1313`.

**Feel/correctness problem.** During up to 160 ms of local hit-stop, input sampling, network sync, and prediction continue, but owner interpolation, remote interpolation, and rig animation do not. At release, the code measures the frozen rig against the now-advanced predictor and folds that displacement into reconciliation error. At base speed, the maximum freeze alone can accumulate about 51 px before recoil/roll; the player then feels a stopped body followed by correction drag. Camera follow runs every frame against the frozen rig and inherits the catch-up afterward.

Server-authored level-window freeze is different and is handled reasonably: authority zeros steering and the predictor enters a pause on reconciliation (`packages/server/src/rooms/GameRoom.ts:5401-5416`, `packages/client/src/net/prediction.ts:1170-1251`). The defect is the client-only combat hit-stop seam.

**Best-practice standard violated.** In online action games, hit-stop may pause attack pose, particles, and animation clocks, but it should not pause the local player’s locomotion transform while the simulation continues.

**Concrete fix.** Split presentation clocks. Keep owner `interpolate()` and camera target updates running through hit-stop; freeze the rig’s attack/limb animation, enemy poses, particles, and impact VFX. Do not call `foldError` for movement accumulated during cosmetic hit-stop. If a full-world stop is retained, cap it at 40–60 ms and also pause local prediction/input advancement for exactly the same deterministic interval—harder online and therefore not recommended. Keep the existing 45 ms kill crunch as pose/VFX stop, not transform stop.

### P1 — The requested movement-kit vocabulary and the implemented kit have diverged

**Files:** `packages/shared/src/constants.ts:480-522`; `packages/shared/src/constants.ts:534-590`; `packages/server/src/rooms/GameRoom.ts:4965-4995`; `packages/client/src/net/prediction.ts:621-662`; `packages/shared/src/state.ts:213-229`.

**Feel/correctness problem.** There is no separate dash, ordinary jump, higher jump, crouch, slide, slide-hop, crouch-distance-jump, or slide-hop momentum chain in current gameplay. The roll uses `STANCE_SLIDE` and `slide*` schema/runtime names; distance jump uses `STANCE_DASH`; crouch and slide phases remain accepted in types and cancel checks. Audio/VFX still say slide. Stale ordinary-hop constants and map comments make it possible for design, QA, and future code to reason about abilities that players cannot perform.

This is not an argument that the older, larger kit is automatically better. A bullet-heaven benefits from a small set of orthogonal verbs. The current roll/distance-jump/pound trio is easier to read than multiple overlapping dash/slide/jump variants. The problem is that there is no single truthful contract. A roll-tail Space press is buffered into a distance jump, but it does not preserve roll speed; there is no slide-hop or other momentum-amplification tech in the current state machine.

**Best-practice standard violated.** Ability vocabulary, state names, input affordances, tutorials, tests, and netcode must describe the same verbs. Dead compatibility IDs should be isolated at serialization boundaries, not leak into gameplay reasoning.

**Concrete fix.** Treat the three-verb kit as canonical unless the owner explicitly reopens the old movement order. Keep wire IDs append-only, but introduce runtime names `ROLL`, `DISTANCE_JUMP`, and `POUND`, converting to/from old schema fields at one adapter. Remove or quarantine ordinary-hop/crouch tuning from the player kit, correct map/tutorial/audio/VFX language, and publish the cancel/safety table. If the older suite is still a product requirement, track it as a missing feature, not a tuning task: add each verb to the shared movement state machine with distinct input, purpose, safety, momentum ownership, and replay tests before exposing it.

### P2 — Start/stop remains heavier than the target even though pivot penalty is fixed

**Files:** `packages/shared/src/constants.ts:122-143`; `packages/shared/src/movement.ts:103-144`.

**Feel problem.** At the 20 Hz movement tick, 2,600 px/s² produces speeds 130, 260, and 320 over the first three samples. Release produces 190, 60, and 0, leaving about 12.5 px of glide. That is controlled and not mushy, but a full 150 ms discrete start/stop is on the heavy side for a dense bullet-dodge game. The sharp-turn hitch itself is no longer the problem: even a reversal loses less than one pixel and recovers next tick.

Input magnitude is normalized to full speed; that is correct for WASD but would make a future analog stick digital (`packages/shared/src/movement.ts:121-124`).

**Best-practice standard violated.** A snappy top-down dodge game normally reaches useful evasive speed in the first rendered/simulation sample and full speed within roughly 50–100 ms, while preserving a short release plant.

**Concrete fix.** A/B test `MOVE_RECOVER_ACCEL = 4,000` and `MOVE_STOP_DECEL = 4,800`: speeds become 200 then 320 over 100 ms; release becomes 80 then 0 with about 4 px of glide. Set `MOVE_HITCH_DIP = 0` for the first test; if visual weight is lost, restore at most `0.02` (98% reversal retention). Keep heading direct and diagonal normalization unchanged. If analog input is added, multiply top speed by clamped stick magnitude after a 0.15–0.20 radial dead zone.

### P2 — Traversal exit momentum is hard-coded rather than derived from exit intent

**Files:** `packages/server/src/rooms/GameRoom.ts:4936-4954`; `packages/server/src/rooms/GameRoom.ts:5092-5100`; `packages/client/src/net/prediction.ts:708-718`; `packages/client/src/net/prediction.ts:742-748`; `packages/client/src/net/prediction.ts:478-548`.

**Feel problem.** The fixed roll integrates exactly 188 px, then unconditionally seeds a full 320 px/s locomotion velocity in the roll direction. With no held input, normal release friction adds another 12.5 px of uncommanded coast after the advertised sentence; with new input, the next tick pivots that seeded velocity. Distance jump instead lands at 192 px/s (60% base speed) in its flight direction, while pound lands rooted. External recoil/knockback impulse correctly remains a separate additive layer through all three stances.

These different handoffs can be authored choices, but the roll’s full-speed injection is especially at odds with a fixed-distance, visibly completed dodge and makes momentum feel like an implementation residue rather than a readable rule.

**Best-practice standard violated.** A committed move should end in an explicit, player-readable exit state. Its advertised distance should not be followed by hidden movement merely because the ordinary locomotion velocity was seeded for continuity.

**Concrete fix.** At roll end, seed locomotion from current held intent: no input → `0 px/s`; held input → `min(300, MOVE_SPEED)` along the held direction, then let ordinary acceleration reach 320. Keep distance jump’s 192 px/s forward skid only while its landing-skid presentation is active; no input should plant to zero at skid end. Pound remains zero. If momentum tech is deliberately reintroduced, represent it as an explicit carry scalar/event with a cap—recommended maximum `1.15 × MOVE_SPEED` for 150 ms—not as an accidental stance-exit velocity.

### P2 — There is input buffering but no pit-edge coyote time

**Files:** `packages/server/src/rooms/GameRoom.ts:5397-5401`; `packages/server/src/rooms/GameRoom.ts:5591-5640`; `packages/client/src/net/prediction.ts:675-700`; `packages/shared/src/constants.ts:604-609`.

**Feel problem.** A same-tick jump wins because traversal acceptance precedes pit sampling and positive launch velocity skips the fall. Once grounded movement crosses the pit sample, however, the server immediately damages and teleports the player. `PIT_FALL_GRACE = 0.6` is post-fall mercy, not pre-edge coyote time. A Space press one render frame after visually leaving a lip can therefore lose despite a 250 ms input buffer.

**Best-practice standard violated.** Edge-based traversal should tolerate a short mismatch between visible contact and authoritative ground contact, especially at a 50 ms server tick.

**Concrete fix.** Record `lastSafeGroundTick/position` and allow a buffered distance jump for two ticks/100 ms after first crossing a pit edge, provided the body is within `PLAYER_RADIUS + 8 px` of the last-safe lip. During grace, clamp the grounded body to the lip rather than allowing free travel over the pit. If no jump is accepted by the second tick, resolve the existing fall/snap. Mirror the grace field in prediction and add tests for presses at -50, 0, +50, +100, and +150 ms around the edge.

### P2 — Camera and owner pose are coupled to two different motion truths

**Files:** `packages/client/src/scenes/ArenaScene.ts:9071-9107`; `packages/client/src/scenes/ArenaScene.ts:9408-9427`; `packages/client/src/scenes/ArenaScene.ts:9477-9547`; `packages/client/src/scenes/ArenaScene.ts:9623-9636`; `packages/client/src/scenes/ArenaScene.ts:9714-9727`; `packages/shared/src/constants.ts:199-213`.

**Feel problem.** Gait direction/speed correctly derives from actual rendered displacement, and self height/stance comes from prediction. Recoil lean, however, reads synced authoritative `player.vx/vy`, so the local pose can lag or snap relative to the predicted root—most visible under burst recoil. The camera follows the rendered rig with a 130 ms time constant, so reconciliation and post-hit-stop root correction become camera motion. Constants/documentation promise 74 px look-ahead, while the implementation explicitly disables look-ahead after playtest; the unused contract is misleading.

**Best-practice standard violated.** The local root, gait, lean, and camera should derive from one presentation-space motion estimate. Reconciliation should not masquerade as player acceleration or camera input.

**Concrete fix.** Expose displayed steering and impulse velocity from the predictor and drive all self animation from it; low-pass recoil lean over 30–50 ms. Drive camera focus from the committed predicted position before `errX/errY`, with reconciliation root correction rendered inside the view rather than moving the camera. A/B `CAM_FOLLOW_TAU` at 0.08–0.10 s. Respect the prior no-look-ahead playtest decision by removing the stale `CAM_LOOKAHEAD` contract; if retested later, start at only 24–40 px velocity lead, not 74 px.

### P2 — Co-op body collision is authority-only and can sustain a 35–70 px owner offset

**Files:** `packages/client/src/net/prediction.ts:437-442`; `packages/server/src/rooms/GameRoom.ts:5538-5560`.

**Feel problem.** The predictor intentionally omits player-player collision and documents a stable 35–70 px penetration offset under sustained contact. In narrow belt lanes, allied crowding can therefore show overlap followed by persistent reconciliation pressure. This is not classic oscillating rubber-band, but it weakens body readability and compounds the correction-policy issue.

**Best-practice standard violated.** Either co-op allies are non-blocking, or the owner predicts the same local contact constraint used by authority. A knowingly stable visual penetration is still an input-to-render mismatch.

**Concrete fix.** The best bullet-heaven feel option is non-blocking allied bodies. If body blocking is a hard design rule, predict owner push-out against delayed remote snapshot bodies, cap the local correction to 8 px per tick, and let authority resolve symmetry. Test two players head-on, side-by-side in the belt depth band, and one player stationary under 100/200 ms RTT; require owner/authority separation under 24 px and no sign-flipping correction.

### P2 — Remote timing is sensible but should be adaptive and observable

**Files:** `packages/client/src/net/snapshots.ts:20-89`; `packages/client/src/net/snapshots.ts:140-185`; `packages/shared/src/constants.ts:261-269`.

**Feel problem.** `TimelineSync` uses the minimum arrival offset in a three-second window and a fixed 120 ms render delay. This is a valid simple clock estimator, and 60 ms bounded extrapolation prevents runaway prediction. Under a path whose jitter distribution worsens for several seconds, though, the old minimum can put render time ahead of the newest snapshot repeatedly, producing extrapolate/hold micro-stutter with no adaptation or telemetry.

**Best-practice standard violated.** Snapshot delay should cover current jitter with a bounded latency budget, and buffer starvation should be measurable before tuning.

**Concrete fix.** Instrument the percentage of frames interpolated, extrapolated, and held plus newest-snapshot headroom. Keep 120 ms while hold frames remain below 1%. If they exceed 1%, use an EWMA/PLL clock estimate plus a rolling 90th–95th percentile jitter margin, clamped to 100–180 ms; adjust delay no faster than about 10 ms/s so the camera does not breathe.

## Recommended implementation order

1. **Fix Overcasters/general owner recoil prediction** with fixed-tick events and per-round receipts; add the real RTT/jitter acceptance gate.
2. **Extract the shared movement-kit state machine** and place attack/parry/pound cancel rules in it.
3. **Centralize hostile-hit policy** and make the roll’s five safe ticks visibly exact.
4. **Separate hit-stop animation time from owner transform time.**
5. **Bound reconciliation by error age/magnitude**, then decouple camera and pose from correction debt.
6. **Tune only after correctness:** test 4,000/4,800 accel/decel, add 100 ms pit coyote, and decide allied body blocking.
7. **Canonicalize the movement vocabulary** so the shipped three-verb kit—or a deliberately reintroduced larger kit—is truthful in code, tutorial, audio, tests, and schema adapters.

## Validation performed

Focused read-only tests passed: `tests/movement.test.ts`, `packages/client/src/net/prediction.test.ts`, and `packages/server/src/rooms/GameRoom.v7-overcasters.test.ts`—3 files, 58 tests. These verify shared locomotion, substantial predictor behavior, and authoritative burst projectile origins. They do not provide a live owner-rig/authority movement gate for recoil, cancel taps, hit-stop, camera coupling, or source-dependent roll immunity; those are the missing acceptance layers identified above.

Verdict: Core WASD and fixed traversal shapes are fundamentally sound, but movement is not ready to be called best-practice netcode until owner recoil becomes replayable, cancels and i-frames become shared explicit policies, and local hit-stop stops manufacturing reconciliation debt.
