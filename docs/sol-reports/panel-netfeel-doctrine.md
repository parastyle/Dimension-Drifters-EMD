# Netcode-feel doctrine for 2–4 player co-op action

Research date: 2026-07-25

Scope: Colyseus/WebSocket, 20 Hz authoritative simulation, 60–144 fps presentation

Audit target: current `sol/panel-netfeel-doctrine` worktree, including B42 relaxed movement authority and
B51 motion epochs

Disposition: research only; no runtime code changed

## Executive finding

The 20 Hz server is not, by itself, the feel problem. Twenty hertz can support a small friends-only PvE
game when three clocks are kept separate:

1. the owner presentation clock reacts to input every rendered frame (or in small local microsteps);
2. the remote presentation clock samples a short history of server-time snapshots;
3. the authority clock validates movement and decides combat/economy outcomes.

This stack already has the important architectural pieces: B42 gives the owner bounded movement
authority while retaining server authority over outcomes, B51 gives server-authored displacement a
semantic epoch, self is excluded from the remote snapshot buffer, and remotes use tick-stamped buffered
interpolation with bounded extrapolation.

The decisive local audit result is more nuanced than “self is rendered at 20 Hz”:

- **Ordinary held self movement is not snapshot-interpolated and is redrawn every frame.** The self branch
  calls `renderPos()` and never samples `playerBufs`.
- **The self presentation clock is nevertheless discontinuous at input edges.** A fresh direction
  recomputes the whole elapsed 0–50 ms preview as though that direction had been held since the last
  heartbeat. A full-speed reversal near the end of the interval can remap one frame by about **31.3 px**.
- **Traversal edges can advance a whole 50 ms prediction tick immediately between heartbeats.** The
  accumulator is not consumed by that edge, so the following heartbeat can advance another tick. This can
  present up to one ordinary 16 px movement step immediately and make reported movement depend on
  client/server phase.

That is the relevant “vibraty” class here: not a steady 20 Hz staircase while holding a direction, but a
non-monotonic owner clock that turns common input changes into tick-phase-dependent visual displacement.
The top priority is therefore a single monotonically advancing owner presentation simulation, not a
higher server tick.

The remote path is a good fixed-buffer baseline, not yet a production-complete jitter buffer. Its 120 ms
(2.4 tick) delay, bracketed interpolation, 60 ms extrapolation cap, and hold behavior are sound defaults.
The remaining feel risks are a render clock that can jump when its rolling minimum changes, incomplete
semantic cuts, and pose channels that do not share the delayed position timeline.

## What comparable games and engines actually establish

Public descriptions of shipped games are incomplete, so this section separates confirmed behavior from
inference. Exact movement implementations and tick rates for Deep Rock Galactic and Valheim are not
publicly documented well enough to state as fact.

| Reference | Publicly supported fact | Doctrine implication |
| --- | --- | --- |
| Destiny 2 | Bungie describes a hybrid in which the server owns game progress while each player owns their movement and abilities, explicitly to preserve immediate moving and shooting. | Owner-authored movement with server-owned progression is a proven co-op/action trade, not an anti-pattern. B42 is more conservative because it adds a bounded envelope. |
| Warframe | Digital Extremes changed Operator Transference to client-authoritative to alleviate latency; the action had previously waited on the host. | Latency-critical traversal/state switches should begin locally and be validated afterward. “Begin locally” does not require granting the edge an extra 50 ms of movement time. |
| Deep Rock Galactic | The official wiki confirms a four-player, player-hosted topology with no dedicated gameplay servers. | It is a useful “friends co-op under host latency” comparator. Its exact movement authority, prediction policy, and tick rate remain unverified; do not cargo-cult an invented DRG implementation. |
| Valheim | The official FAQ describes co-op with friends; a community technical wiki says the dedicated process relays while clients claim authority for locally isolated areas. | It is evidence for distributed/owner-authority designs in trust-tolerant co-op, but the authority claim is community/decompiled evidence and its exact movement send rate is not a reliable benchmark. |
| Unreal Character Movement | Epic documents an owning client sending input/state moves, the server acknowledging good moves or returning correction state, and simulated proxies receiving network smoothing. | The established split is owner prediction plus selective correction, versus smoothed remote proxies—not one render policy for all actors. |
| Colyseus Phaser tutorial | Colyseus documents default state updates every 50 ms (20 fps), immediate current-player updates at the frontend rate, and interpolation only for other players. Its deterministic follow-up uses a 60 Hz fixed client step. | This is the closest stack-specific statement of the canonical local/remote split. A 20 Hz state stream is expected to look choppy if directly rendered. |
| Source / Left 4 Dead | Valve’s technical reference lists L4D/L4D2 at 30 simulation ticks/s, a common 20 snapshots/s client update rate, and a default 100 ms entity interpolation period so one missing update can still be bracketed. | Published rates separate simulation rate from snapshot rate. Two update intervals of remote history are a well-established starting point. |
| Snapshot interpolation literature | Fiedler demonstrates delayed snapshot buffers, velocity-aware Hermite interpolation when linear velocity discontinuities show, and the failure modes of extrapolation under nonlinear collision. | Spend a small fixed/adaptive delay on remotes; extrapolate only briefly and only where motion is predictable. |

Sources:

- Bungie, [This Week at Bungie, 2017-05-25](https://www.bungie.net/7/en/News/article/45919/7_this-week-at-bungie--05252017).
- Digital Extremes, [Veilbreaker: Update 32 — Operator Transference Change](https://forums.warframe.com/topic/1321169-xbox-veilbreaker-update-32/).
- [Official Deep Rock Galactic Wiki: Multiplayer](https://deeprockgalactic.wiki.gg/wiki/Multiplayer).
- Iron Gate, [Valheim FAQ](https://valheim.com/faq/), and the explicitly non-primary
  [Valheim community technical server overview](https://valheim.fandom.com/wiki/Dedicated_servers).
- Epic, [Comparing Mover and Character Movement Component](https://dev.epicgames.com/documentation/en-us/unreal-engine/comparing-mover-and-character-movement-component-in-unreal-engine)
  and [Understanding Networked Movement in Character Movement](https://dev.epicgames.com/documentation/en-us/unreal-engine/understanding-networked-movement-in-the-character-movement-component-for-unreal-engine).
- Colyseus, [Linear Interpolation](https://docs.colyseus.io/learn/tutorial/phaser/linear-interpolation),
  [Client Predicted Input](https://docs.colyseus.io/learn/tutorial/phaser/client-predicted-input), and
  [Fixed Tickrate](https://docs.colyseus.io/learn/tutorial/phaser/fixed-tickrate); its
  [server reference](https://docs.colyseus.io/server) documents TCP/WebSocket as the default transport.
- Valve Developer Community, [Source Multiplayer Networking](https://developer.valvesoftware.com/wiki/Source_Multiplayer_Networking).
- Glenn Fiedler, [Snapshot Interpolation](https://gafferongames.com/post/snapshot_interpolation/) and
  [Fix Your Timestep](https://gafferongames.com/post/fix_your_timestep/).

### Tick-rate conclusion

Published numbers do not support “best-feeling co-op means 60 Hz server.” L4D-class play shipped around
30 Hz simulation; Source commonly delivered 20 entity snapshots/s; Colyseus defaults to a 20 fps state
stream. They hide those rates through owner prediction, delayed remote reconstruction, client animation,
particles/audio, and continuous render transforms.

At 20 Hz, this game has a 50 ms authority quantum. That is acceptable for:

- bounded owner-authored locomotion;
- PvE hit decisions whose local anticipation cue is immediate;
- remote actors reconstructed from history;
- server-owned damage, death, loot, and progression.

It becomes visible when presentation consumes the authority quantum directly, when a one-shot input
creates an extra quantum, or when the interpolation buffer starves. If later measurements show that a
50 ms quantum makes parries or collision admission unfair, first consider a higher-rate action substep,
timestamped action admission, or rewind for that mechanic. Raising every room system and every patch to
60 Hz is not the first feel fix.

## The doctrine

### 1. Treat authority, simulation, publishing, and rendering as separate choices

“Client-authoritative” should describe a narrow capability, not the whole game. For a small friends-only
PvE game:

- The owner may author ordinary locomotion and locally predictable traversal inside speed, continuity,
  navigation, and epoch bounds.
- The server owns enemy state, damage, deaths, cooldown acceptance, invulnerability, loot, economy,
  progression, and world topology.
- The server may author hostile knockback, scripted placement, pits, elevators, revives, and other
  semantic movement cuts.
- Other clients reconstruct the accepted server result; they do not run the owner’s presentation path.

This is exactly the useful part of the “Destiny/Warframe/Valheim class” for this threat model. B42’s
validation envelope is preferable to blind client trust, and B51’s epochs are preferable to guessing
whether a large delta was a correction or authored movement.

### 2. Canonical owner formula

The local body and camera must be driven by one monotonic local timebase:

```text
each render frame:
    I = sample_current_input()
    ownerAccumulator += realFrameDelta
    while ownerAccumulator >= h:          # e.g. h = 1/120 s
        ownerState = sharedStep(ownerState, I, h)
        ownerAccumulator -= h
    draw ownerState (+ a bounded remainder/alpha presentation)

each 50 ms network heartbeat:
    send command sample + owner report at that heartbeat

on accepted server echo:
    discard acknowledged history
    do not replace the current local transform

on rejection / teleport / server-motion edge:
    adopt the authoritative cut or rebase + replay unacknowledged input
    reconcile the effect/presentation with a bounded, non-restarting deadline
```

A render-rate integrator with a maximum `dt` is also valid. A fixed microstep is easier to make stable
across 60–144 Hz and tab stalls. If previous/current-state interpolation is used, its one-microstep delay
should be understood; at 120 Hz it is only 8.3 ms. The non-negotiable property is that changing input now
must not rewrite the trajectory already presented earlier in the current 50 ms network interval.

Network reports are samples of the local simulation, not permission to advance it. An immediate jump,
slide, crouch, or pound message may latch a verb now, but must not mint an additional 50 ms of movement
time. The next heartbeat owns the next network interval.

The server echo has three jobs: acknowledge history, validate the report, and announce semantic authority
changes. It should not be an every-patch render target for an accepted B42 owner.

### 3. Canonical remote formula

Remote players render in server time, deliberately behind the newest estimated server instant:

```text
estimatedServerNow = smoothed_monotonic_clock(clientNow, patch arrivals)
remoteRenderTime   = estimatedServerNow - interpolationDelay

find A, B where A.tickTime <= remoteRenderTime <= B.tickTime
draw interpolate(A, B, fraction)
```

For 20 Hz, start near two ticks (100 ms) plus measured jitter headroom. A 120 ms default is reasonable.
Then adapt slowly:

- increase delay when bracket misses/extrapolation rise;
- decrease it much more slowly after a sustained clean window;
- slew the render clock and delay—never jump either;
- keep a safety floor of about two snapshots for WebSocket clumping;
- cap extrapolation around one tick for players, then hold;
- reset history on a semantic teleport/reposition epoch.

Because Colyseus’ default transport is reliable ordered WebSocket, missing state normally appears as a
late clump rather than an independently lost snapshot. A buffer still helps jitter, but TCP
head-of-line blocking can exhaust it. Brief extrapolation hides the start of a stall; bounded hold avoids
inventing a path through collisions. Transport replacement is a later architectural option, not a reason
to remove buffering.

Position, vertical height, locomotion stance, facing where necessary, and animation phase must be sampled
from the same remote time. A delayed body with current-tick feet or jump height is temporally incoherent
even if every individual channel is smoothed.

### 4. Reconcile events by effect, not by moving a body

The owner predicts latency-critical anticipation: button pose, muzzle flash, attack audio, jump start,
camera impulse, and other reversible cosmetics. The server confirms or rejects the gameplay result.
Damage, death, loot, cooldown consumption, and NPC interactions remain authoritative.

On confirmation:

- deduplicate the predicted local cue using a sequence/prediction key;
- spawn hit/death effects at the current rendered contact or attachment point;
- correct a cosmetic trail, decal, or animation phase if needed;
- do not drag a player or enemy transform to make a hit “look correct.”

For remote events, choose an explicit policy. A useful co-op hybrid is immediate audio/flash/hit reaction
at the currently rendered rig, while continuous body motion stays on the interpolation timeline. If a
whole attack animation must remain body-time coherent, seek it to the appropriate phase when the event
arrives rather than silently adding another 120 ms to every collaboration cue.

Epic’s Gameplay Ability System makes the same separation: locally predicted ability activation can mask
round-trip delay, the server owns interactions with server-owned actors, and Gameplay Cues are the
replicated cosmetic channel. See [Understanding the Gameplay Ability System](https://dev.epicgames.com/documentation/en-us/unreal-engine/understanding-the-unreal-engine-gameplay-ability-system).

## Current stack audit

### What is already right

| Area | Current behavior | Assessment |
| --- | --- | --- |
| 20 Hz contract | `TICK_RATE = 20`, `TICK_MS = 50`; both room and prediction use the shared fixed step. | **Keep.** A clear, deterministic authority/report cadence is valuable. |
| B42 movement authority | Client reports post-step `x/y`, steering and impulse velocity; server checks numeric, speed, continuity, navigation, correction sequence, and motion epoch before adopting. Combat/economy remain server-owned. | **Strong alignment.** This is the right trust posture for friends-only PvE. |
| B51 epochs | Placements open a motion epoch before changing position; predictable recoil/beam/traversal motion was brought into client parity; teleports and server motion are distinguished from client-error correction. | **Strong alignment.** Semantic authority beats distance heuristics. |
| Self selection | `ArenaScene.interpolate()` takes a dedicated self branch, calls the predictor every frame, and returns before the remote buffer. | **Correct.** Self is never intentionally delayed 120 ms or lerped toward network snapshots. |
| Remote core | Tick-stamped ring, bracketed interpolation, 120 ms delay, 60 ms extrapolation cap, then hold; ≥200 px gaps cut. | **Good baseline.** This is recognizably the standard remote-player formula. |
| Correction bands | <3 px silent, medium bounded by 140 ms and non-restarting, ≥200 px cut. | **Good bounded policy.** It prevents endless exponential tails. |
| Local effects | Local attack/muzzle paths predict and suppress duplicate authoritative cues; damage receipts and death presentation are separate from locomotion. | **Mostly aligned.** The remaining issue is cross-timeline consistency for remote events. |

Code anchors:

- Tick and buffer constants:
  [`constants.ts`](../../packages/shared/src/constants.ts#L76).
- Owner rendering versus remote sampling:
  [`ArenaScene.ts`](../../packages/client/src/scenes/ArenaScene.ts#L8409).
- Input accumulator and immediate-edge dispatch:
  [`ArenaScene.ts`](../../packages/client/src/scenes/ArenaScene.ts#L14387).
- Fixed-step prediction and reconciliation:
  [`prediction.ts`](../../packages/client/src/net/prediction.ts#L1391).
- Timeline and snapshot ring:
  [`snapshots.ts`](../../packages/client/src/net/snapshots.ts#L28).
- Server input drain and movement adoption:
  [`room-progression.ts`](../../packages/server/src/rooms/room/room-progression.ts#L3339).
- Design histories:
  [B42 relaxed authority](./impl-b42-relaxed-authority.md) and
  [B51 warp/snap corrections](./impl-b51-warp-fix.md).

### Explicit self-render verdict

The steady-state self path does **not** step at 20 Hz:

1. `stepNetInput()` accumulates real frame time and commits exact 50 ms prediction ticks.
2. Between ticks, `interpolate()` calls `renderPos(curDx, curDy, inputAccMs / 1000)` every frame.
3. `renderPos()` performs a fractional shared movement preview from the committed predicted state.
4. `blob.setPosition()` receives that result every render frame.

At constant input, that produces a continuous 60–144 fps trajectory.

The vibraty failure is at input edges. `renderPos()` is a pure preview recomputed from the last committed
state, but it applies the **new** input to the entire elapsed fraction. With `MOVE_SPEED = 320` and the
95.8% retained-speed reversal:

```text
old preview at fraction f:  pred.x + 320.00 f
new preview after reversal: pred.x - 306.56 f
one-frame remap:             626.56 f

f = 49 ms  -> 30.70 px
f -> 50 ms -> 31.33 px
```

The final directional gate does not stop this: the large displacement points in the newly commanded
direction and the gate limits angle, not magnitude. Starts and releases create smaller forms of the same
retroactive rewrite.

There is also a true fixed-step presentation edge. Movement-only direction changes are correctly
transport-only, but jump, pound, slide, and crouch-start may call `predictor.tick()` immediately. That
function advances an exact 50 ms step; the local accumulator remains intact and can advance its normal
heartbeat afterward. The server drains all received commands into one fixed sample per server tick,
preserving one-shot flags. Depending on relative phase, the client can therefore report a state one
movement quantum ahead or cause a B42 envelope rejection. Even when validation remains clean, the local
body/vertical arc can visibly take a 50 ms step on the action frame.

Relevant anchors:

- Pure fractional recomputation:
  [`prediction.ts`](../../packages/client/src/net/prediction.ts#L1585).
- Immediate heading and reversal dip:
  [`movement.ts`](../../packages/shared/src/movement.ts#L92).
- Angle-only final constraint:
  [`prediction.ts`](../../packages/client/src/net/prediction.ts#L1701).
- Immediate traversal `predictTick` decision:
  [`ArenaScene.ts`](../../packages/client/src/scenes/ArenaScene.ts#L14462).
- `predictTick` always advances a full predictor tick:
  [`ArenaScene.ts`](../../packages/client/src/scenes/ArenaScene.ts#L14334).
- Server drain-to-newest semantics:
  [`room-progression.ts`](../../packages/server/src/rooms/room/room-progression.ts#L3362).

### Explicit remote-buffer verdict

The remote position buffer follows the essential best practice:

- snapshots are stamped in server tick time rather than arrival time;
- rendering is delayed 120 ms, or 2.4 updates at 20 Hz;
- a requested time is bracketed and linearly interpolated;
- starvation extrapolation is bounded to 60 ms and then holds;
- large displacement bands do not extrapolate;
- the owner never passes through this path.

It is safer than “lerp toward the latest state,” because it reconstructs a timeline instead of producing
a frame-rate-dependent trailing spring. It also uses a sensible delay relative to Source’s historical
100 ms / two-update default.

It falls short of best practice in four ways: the clock estimate can jump, delay is fixed rather than
starvation-driven, only `fellSeq` resets the player ring even though `teleportSeq` exists, and only `x/y`
share the buffered time. Those are refinements to a sound architecture, not a reason to replace the ring.

## Ranked feel gaps

Impact ranks combine frequency, screen displacement, input coupling, and the likelihood that a player
attributes the artifact to “bad controls” rather than network conditions.

| Rank | Severity | Gap | Evidence in current stack | Feel impact | Acceptance target |
| ---: | --- | --- | --- | --- | --- |
| 1 | P0 | **Owner presentation time is not monotonic across input/action edges.** A direction change retroactively remaps the current 0–50 ms preview; traversal/crouch edges can mint a whole fixed step without consuming the accumulator. | `renderPos()` rebuilds the fraction from `pred` with current `dx/dy`; reversal math permits ~31.3 px in one frame. Immediate traversal dispatch calls `predictor.tick()`, then the normal heartbeat may do so again. | Common ADAD/reversal input can vibrate even on zero-ping local play. Traversal buttons can pop position/height by a 50 ms quantum and create phase-dependent reports. | At 144 Hz, any ordinary owner render displacement is bounded by authored velocity × actual frame time (plus an explicitly tested impulse); one wall-clock second produces one simulated second regardless of edge timing. |
| 2 | P1 | **Remote render clock can jump backward or forward.** | `TimelineSync` uses the minimum `clientNow - tickTime` over a 3 s ring. When the owning minimum expires, it rescans and applies the new value immediately; a new lower minimum also applies immediately. `renderTime()` has no monotonic clamp or slew. | Every remote actor can hitch or briefly reverse together after a latency-regime change, even while each entity ring is healthy. | Remote render time never decreases and clock-rate correction is bounded/slewed; tests cover minimum expiry and a step change in latency. |
| 3 | P1 | **Remote semantic cuts are incomplete.** | Player rings reset only when `fellSeq` changes. `teleportSeq` is present in `PlayerState` and already drives self cuts, but is not tracked for remotes; <200 px teleports are interpolated as travel. | Blinks, scripted placements, revives, or short warps can visibly slide through walls/unsafe space. Distance thresholds cannot reliably infer intent. | Any remote `teleportSeq` change resets the full pose ring at that tick; distance cut remains only a corruption/fallback guard. |
| 4 | P1 | **Remote pose channels are on different times.** | Remote `x/y` come from `SnapshotBuffer` at `serverNow - 120 ms`; `height`, `vh`, stance, slide phase/tick, and several sequence-driven poses come from current `PlayerState`. Hop has a render lerp, but that smooths a channel approximately 120 ms ahead of the feet. | Feet, shadow, vertical arc, slide/pound pose, and body translation can disagree, producing floating/skating or early pose transitions. | A remote full-pose sample uses one tick bracket/cut policy for position, height, stance, and animation phase; events are handled separately. |
| 5 | P1 | **Accepted B42 echoes still replace and replay the owner transform every patch.** | `reconcile()` unconditionally rebases `pred` from server `x/y/mvx/mvy/vx/vy`, then replays pending commands; `correctionRequested` only gates the visual correction offset. | B42 normally makes the numbers equal, so impact is less frequent than ranks 1–4. But quiet accepted echoes still enter the owner transform path and expose quantization, drain-to-newest, and future parity drift at 20 Hz. | Same-epoch, no-correction accepted echoes only ack/prune history and refresh non-transform authority. Transform rebase occurs only on explicit correction, resync, teleport, or server motion. |
| 6 | P2 | **Remote action/effect timing is mixed rather than doctrinal.** | Remote attack pose epochs deliberately include the interpolation delay, while newly observed projectiles, muzzle flashes/recoil, and sound can begin immediately at the live rendered rig; some audio pans from raw current `PlayerState.x`. | A flash/projectile can precede its swing by ~120 ms, and audio can originate ahead of the visible body by up to ~38 px at full speed. | Every effect declares immediate-receipt or delayed-body-time policy; spatial effects/audio use rendered anchors; scheduled animation can seek/catch up instead of silently adding full buffer delay. |
| 7 | P2 | **The 120 ms remote delay is fixed and unobservable.** | `INTERP_DELAY_MS` is constant. There are no exposed bracket-miss, extrapolated-ms, hold-ms, clock-slew, or buffer-occupancy measures. | Stable friend/LAN sessions always pay 2.4 ticks, while bad Wi-Fi/WebSocket clumps can still exhaust 120 ms. Tuning is guesswork without starvation data. | Keep 120 ms as initial value, then adapt in a bounded range from observed jitter/starvation; ship per-peer netgraph counters and soak thresholds. |
| 8 | P3 | **Remote reconstruction is position-only linear and classifies sub-3 px spans as snaps.** | The ring stores only `t/x/y`; bracketed position is linear. The correction-band reuse snaps any <3 px interval to the newer point and omits velocity even though player `mvx/mvy` are synced. | Slow movement below about 60 px/s can staircase at 20 Hz; linear segment velocity changes can show at authored pivots. This is lower impact for normal 320 px/s players than clock/pose defects. | After ranks 1–7, measure pixel velocity. If visible, store velocity and use monotone/velocity-limited Hermite for smooth spans; keep semantic cuts and avoid overshoot through collision corners. |

## Ordered, independently shippable fix plan

Each item has its own pass/fail boundary. The order avoids tuning remote polish while the owner clock is
still capable of manufacturing large local artifacts.

### 1. Lock down owner-clock invariants with tests and capture

Add deterministic presentation tests at 60, 120, and 144 Hz for:

- hold, start, stop, 90° turn, and full reversal at accumulator phases 0, 1, 25, 49, and 50 ms;
- jump, crouch, slide, and pound at the same phases;
- exactly one second of wall time versus simulated owner time;
- maximum one-frame displacement;
- B42 report continuity and correction count when an edge and heartbeat share one server interval.

Include a local-only overlay/capture for `inputAccMs`, committed owner time, render displacement, pending
count, correction sequence, and action-edge count. This test-only/diagnostic item can ship without
changing feel.

### 2. Stop action messages from minting movement time

Make immediate traversal messages latch the verb and produce immediate cosmetic/stance anticipation
without calling a full 50 ms locomotion step. The next monotonic local step consumes that latch, and the
next 20 Hz heartbeat reports the resulting state. Preserve the server’s one-shot OR behavior and B51
prediction coverage. Pass when edge timing cannot add an extra quantum and jump feedback still begins on
the press frame.

### 3. Give the owner one render-rate or 120 Hz microstep presentation simulation

Advance a retained owner presentation state by real elapsed time; never recompute already presented time
from the last 50 ms commit. The 20 Hz predictor/report history should sample that state at heartbeat
boundaries, not own its display clock. Reuse the shared movement primitives with bounded `dt`/microsteps.
Pass when the rank-1 matrix has frame-sized motion only and produces equivalent reports across render
rates.

This is the top feel change. It should be kept narrowly scoped to owner locomotion/presentation rather
than bundled with tick-rate or transport work.

### 4. Make accepted relaxed-authority echoes acknowledgment-only

Under B42 fields, same motion epoch, unchanged correction sequence, no teleport, and no forced resync:
prune acknowledged commands and adopt server-owned non-transform state, but do not overwrite the live
owner transform. Retain the current hard/medium handling for explicit rejection and B51 authored motion.
Pass with the existing B42/B51 correction harness plus deliberate envelope-rejection cases.

### 5. Wire `teleportSeq` into every remote player pose ring

Track the last remote teleport sequence beside `snapFell`; reset rather than push on any change. Keep
`fellSeq` if it represents a distinct semantic cut, and keep ≥200 px as a fallback. This is small,
low-risk, and independently testable with a <200 px blink.

### 6. Upgrade the remote ring from position to coherent pose

Snapshot at least `x/y`, `height/vh`, move stance, slide phase/tick, and the semantic sequences needed to
choose a pose. Interpolate continuous fields and step discrete fields at an explicit point in the bracket.
Reset all channels together. Pass with jump/slide/pound captures in which feet, shadow, and body occupy the
same server-time sample.

### 7. Replace rolling-min clock jumps with a monotonic slewed estimator

Keep an estimate of server time/offset, reject pathological samples, and adjust offset/rate under bounded
slew. `renderTime` must never decrease. Tests should include 3 s minimum expiry, latency shifting
80→200→80 ms, bursty delivery, tab wake, and reconnect. This can ship while retaining the fixed 120 ms
delay.

### 8. Add remote-buffer telemetry, then adapt delay

Expose per-peer:

- inter-arrival jitter;
- interpolation buffer occupancy;
- bracket hit rate;
- extrapolated and held milliseconds;
- semantic resets;
- clock correction/slew.

Start at 120 ms. Increase delay quickly when bracket misses exceed a threshold; decrease slowly after a
clean interval, with a two-update safety floor. Validate under asymmetric latency, jitter, WebSocket
clumping, and main-thread stalls. Epic recommends testing multiplayer under deliberately harsh lag/loss;
its [Network Emulation guide](https://dev.epicgames.com/documentation/en-us/unreal-engine/using-network-emulation-in-unreal-engine)
uses examples as high as 500 ms RTT and 10% loss.

### 9. Declare and test the event/presentation timeline

Create one routing policy for local predicted cues, remote immediate cues, delayed body-time poses, and
authoritative hit/death receipts. Always spatialize from rendered rigs/attachments, deduplicate by
sequence, and seek scheduled animations when appropriate. Test a remote full-speed shot, melee hit,
knockback, and death under 120 ms interpolation delay. No test should “fix” event disagreement by moving a
body.

### 10. Only then evaluate velocity-aware remote curves

First remove the <3 px snap reuse for ordinary slow authored motion, preserving it for actual correction
dust. If measured velocity discontinuity remains visible, add endpoint velocity and a monotone or
velocity-limited Hermite curve. Never allow a spline to overshoot navigation corners or cross a semantic
cut. This is polish, not the architectural fix.

## Validation bar

The doctrine is complete when captures satisfy all of the following:

- Self at 60/120/144 Hz has no 20 Hz staircase and no input-edge displacement larger than the actual
  frame’s authored motion, except named impulses/teleports.
- Traversal presses do not increase simulated time and do not cause an extra B42 report quantum.
- Accepted B42 traffic produces zero transform correction and zero transform rebase on the owner path.
- Remote render time is monotonic through latency changes and rolling-window expiry.
- At least 99% of ordinary remote frames are bracketed in the target network envelope; extrapolation and
  hold are visible in telemetry rather than inferred from video.
- Any `teleportSeq` edge cuts position and pose together.
- Remote jump/slide/pound feet, height, and stance share one server-time sample.
- Local cues occur on the input frame; authoritative hits/deaths change effects/outcomes, not body
  positions.
- The above is tested with zero latency, asymmetric 40/80/150 ms paths, ±20/50 ms jitter, burst/clump
  delivery, main-thread stalls, and reconnection.

## Final doctrine

Keep the 20 Hz server, B42 bounded owner authority, and B51 semantic epochs. They are compatible with
best-feeling small co-op. Make the owner’s local clock continuous and network-independent; treat the
server echo as validation unless it explicitly changes authority; reconstruct every remote pose from a
short, monotonic server-time history; and reconcile combat through immediate, deduplicated effects rather
than positional correction. Raise tick rate only after instrumentation shows a remaining authority
precision problem that owner prediction, action substeps, or rewind cannot solve.

verdict: 8 gaps ranked, top recommendation: replace the tick-phase-dependent self preview/action stepping with one monotonic render-rate or 120 Hz owner presentation simulation.
