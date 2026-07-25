# Panel research: fixed-tick procedural animation doctrine

**Date:** 2026-07-25

**Scope:** read-only research and code audit; no runtime or test code changed

**Target:** DDv2's 20 Hz authoritative simulation, 60 fps Phaser 4 presentation, and six-part
procedural character rig

## Executive answer

There is a best-practice formula, but it is not a magic bob equation:

> Sample one complete actor state at one presentation-time instant, evaluate one local pose from that
> sample on the render frame, add bounded secondary motion last, and write each part transform once.

The simulation and the visual rig have different jobs:

1. The **authoritative simulation** advances only in fixed 50 ms ticks.
2. The **local owner** predicts those same fixed ticks and renders a fractional preview of the current
   unconsumed tick.
3. A **remote actor** renders a complete buffered snapshot at
   `estimatedServerTime - interpolationDelay`; position, velocity, aim, height, stance, and action state
   must all come from the same bracket.
4. The **pose evaluator** runs every render frame. Continuous locomotion phase never resets; its
   amplitude fades when the actor stops.
5. **Secondary motion** is a render-frame damped spring around the final authored socket. It receives
   impulses only on event edges and is reset, not excited, by teleports and clock cuts.
6. A **transform hierarchy or equivalent pure pose graph** composes root, socket, authored action,
   locomotion, secondary motion, and constraints in a fixed order before a single final apply.

DDv2 already implements much of this correctly: fixed prediction ticks, buffered remote root
interpolation, a continuous distance-driven stride accumulator, exact damped-spring solvers, cut/LOD
rebasing, authored ownership masks, and late head/gear composition. The springs themselves are not the
first thing to retune.

The largest defect is immediately before the rig. Remote `x/y` is sampled on a 120 ms delayed server
timeline, but `height`, vertical velocity, stance, slide phase, aim, recoil, held-fire state, and several
event fields are read from the newest Colyseus row. The renderer is therefore asking one body to portray
two different server instants. The next largest defect is that locomotion/inertia velocity is recovered
by differentiating the already-presented root using Phaser's smoothed delta. Any interpolation
correction, hold, clock adjustment, or hit-stop catch-up becomes false acceleration and is fed into the
limbs and floating head.

The direct recommendation is to introduce one per-frame `PresentedActorState` for both self and remote
actors and make `SpriteRig.animate()` consume only that object. Do not start with more damping; cleaner
inputs will make the existing analytic springs behave as designed.

## What is known, what is inferred

Most named games do not publish their internal timestep, interpolation buffer, or animation-clock
implementation. This report does not reverse-engineer private code or turn trailer observation into
engine fact.

- **Published** below means developer documentation, first-party notes, or a direct developer answer.
- **Observable inference** means the shipped presentation supports the conclusion, but does not prove
  the underlying clock or networking implementation.
- **Unknown** means exactly that. A game's polish is not evidence that it uses Gaffer interpolation,
  wall-clock animation, springs, or a retained part hierarchy.

That distinction matters because several close visual references use authored sprite sequences instead
of a live procedural rig. Their strongest lesson for DDv2 is pose timing and readability, not their
runtime data structure.

## Comparable-game evidence

| Game | Published evidence | What may safely be inferred | Transferable lesson for DDv2 |
|---|---|---|---|
| **Brotato** | Its developer describes it as a Godot top-down arena shooter with up to six simultaneous weapons; it was his first Godot game ([Blobfish devlog](https://www.blobfish.dev/my-new-game-brotato/)). | The shipped potato, appendage offsets, and orbiting weapons prioritize cheap readable cosmetics around one simple actor root. The sim/render clocks and any interpolation policy are not public. | A six-weapon silhouette does not require six authoritative bodies. Keep appendages cosmetic and root-owned, as DDv2 already does. |
| **Vampire Survivors** | Phaser states that the original game was built with Phaser ([Phaser](https://phaser.io/news/2024/12/create-a-game-like-vampire-survivors)). | The early game's sparse directional sprite animation and dense object field favor low-cost per-frame presentation. No credible public source establishes its fixed step, interpolation, or current engine internals. | Dense bullet-heaven load argues for allocation-free sampling and one pose evaluation per actor, not for simulation-tick animation. |
| **Hades** | A Supergiant developer says the game does not render the characters as real-time 3D: the team renders and animates 3D characters during production, then generates thousands of 2D frames from many angles for a crisp, responsive result ([developer answer](https://steamcommunity.com/app/1145360/discussions/0/1738883810796606862/)). | Runtime character motion is authored frame playback rather than a six-part procedural spring rig. Public sources do not disclose its exact simulation/render clock split. | Author the important attack silhouettes and contacts. Procedural layers should preserve, not blur, the pose that communicates gameplay. |
| **Dead Cells** | Motion Twin's artist describes a 3D skeleton exported to PNG sequences. Attacks are pose-to-pose: first make key poses and timing work with the fewest frames, then add interpolation frames only before or after keyframes, while VFX carries movement and impact ([developer deep dive](https://www.gamedeveloper.com/production/art-design-deep-dive-using-a-3d-pipeline-for-2d-animation-in-i-dead-cells-i-)). | This is authored frame animation, not runtime part springs. | Protect authored contact frames with action ownership. Do not let bob or jiggle average away anticipation, impact, or recovery. DDv2's ownership suppression is directionally correct. |
| **Rivals of Aether** | The original workshop manual defines strip-based sprites, named state animations, and a per-frame `animation.gml` that chooses `sprite_index`/`image_index` ([sprites](https://rivalsofaether.com/sprites/), [scripts](https://rivalsofaether.com/scripts/), [states](https://rivalsofaether.com/player-states/)). Rivals 2 separately documents 60 fps-authored animations and hitpause freeze-frame requirements ([Rivals 2 animation states](https://rivals2.com/workshop/knowledge-base/miscellaneous/animation-states/)). | The public contract makes gameplay state and visible animation state explicit and frame-addressable. It does not establish an independent render interpolation layer for the original. | Every discrete gameplay transition needs an explicit visible state/epoch. A held hit-stop frame must be intentionally authored, and the action clock must not drift from the accepted action tick. |
| **Duck Game** | Official patch notes include “Improved duck animation sync when playing online” and fixes for online appearance offsets and authority initialization ([official announcements](https://steamcommunity.com/app/312530/announcements/)). The creator describes a fast, accessible multiplayer game with very short rounds ([developer interview](https://gamecritics.com/john-vanderhoef/an-interview-with-duck-game-developer-landon-podbielski/)). | Its frame-snapped sprites, equipment, ragdoll reactions, and breathing are stateful presentation. The exact synchronization scheme is not public. | “Position sync” is not enough; animation state and appearance offsets are network presentation state too. This is the closest published warning to DDv2's split remote timelines. |
| **Nuclear Throne** | The long-standing public FAQ recorded the original 30 fps design with game speed tied to frame rate ([FAQ](https://steamcommunity.com/app/242680/discussions/0/357284131789926784/)). Update 100 now officially supports 60+ fps while retaining 30 fps ([official update notes](https://store.steampowered.com/news/?appgroupname=nuclear+throne&appids=242680&feed=steam_community_announcements&headlines=0)). | The old coupling was workable and stylistically coherent, but expensive to modernize. Public notes do not disclose the new internal clock design. | Frame-count timing can ship a great game, but coupling gameplay speed to render rate is debt. DDv2 should retain fixed authority and repair presentation coherence rather than move animation into the 20 Hz tick. |
| **Enter the Gungeon** | Dodge Roll's designer says one artist hand-drew more than 200,000 sprites, the gameplay programmer wrote a pixel-perfect physics system, and co-op introduced the most bugs ([developer interview](https://gameranx.com/features/id/48447/article/enter-the-gungeon-interview-with-dodge-rolls-dave-crooks-the-past-present-and-future/)). | Character/dodge states are heavily authored; guns and effects are visibly composited around them. The game shipped local, not online, co-op, and no public source establishes its render interpolation. | Spend authored frames on verbs that must read instantly; treat weapon/FX layers as sockets. Do not cite Gungeon as proof of network interpolation or procedural springs. |
| **MADNESS: Project Nexus** | Krinkels' alpha notes call out unique weapon animation sets, layered weapon-hold blending that could become “erratic and twitchy,” and an object-parenting defect; the project is a 3D remake of the Flash design ([first-party alpha notes](https://krinkels.newgrounds.com/news/post/986001), [creator interview](https://www.patreon.com/2LeftThumbs/posts/krinkels-creator-72497656)). | This is the closest fiction/silhouette reference and an actual skeletal/parented production, but it is 3D and its timing internals are not public. | The reference itself encountered the two relevant failure classes: blend ownership and parenting. Keep one winner per pose channel and make socket ancestry explicit. |

### Public clock/interpolation disclosure ledger

This is the direct answer to the requested sim-tick/render-frame comparison. “Not disclosed” must not be
silently upgraded to “probably fixed timestep.”

| Game | Sim tick vs render frame | Network interpolation/extrapolation | Animation clock / rig structure |
|---|---|---|---|
| Brotato | Not publicly disclosed. | Not publicly disclosed; current co-op internals were outside this evidence set. | Godot and six-weapon premise published; runtime appendage clock/graph not disclosed. |
| Vampire Survivors | Not publicly disclosed. | Not publicly disclosed. | Original Phaser provenance published; exact animation clock and present engine internals not disclosed. |
| Hades | Not publicly disclosed. | Not publicly disclosed. | Published as large authored 2D frame sets rendered offline from 3D animation; no public procedural part rig. |
| Dead Cells | Not publicly disclosed. | Not publicly disclosed. | Published pose-to-pose authored PNG sequences with VFX carrying impact; no public runtime part springs. |
| Rivals of Aether | Workshop gameplay and animation callbacks are documented per frame, but a separate render interpolation layer is not documented. | Not publicly disclosed. | Published state-named sprite strips and per-frame animation selection; Rivals 2 separately authors at 60 fps. |
| Duck Game | Not publicly disclosed. | Online animation synchronization is explicitly patched, but its algorithm is not disclosed. | Published evidence that animation/appearance authority needs synchronization; clock details unknown. |
| Nuclear Throne | Historical public record says the original game's speed was coupled to 30 fps; Update 100 now supports 60+ fps, but the revised separation is not disclosed. | Not publicly disclosed. | Sprite timing implementation not disclosed. The historical coupling is a caution, not a model. |
| Enter the Gungeon | Physics ownership is published; sim/render frequency is not. | Not applicable to shipped local co-op as an online-remote comparison. | More than 200,000 hand-drawn sprites published; exact runtime frame clock not disclosed. |
| MADNESS: Project Nexus | Not publicly disclosed. | Not publicly disclosed for its local/split-screen co-op presentation. | 3D animation sets, blending, and parenting issues are published; evaluator clock details unknown. |

### Synthesis from the games

The common successful pattern is **not** “animate every part with a spring”:

- Hades, Dead Cells, Gungeon, and Rivals spend heavily on authored state and key poses.
- Brotato and Vampire Survivors keep high-volume presentation cheap and readable.
- Duck Game treats animation synchronization as a distinct online concern.
- Nuclear Throne demonstrates why render-rate gameplay coupling is not a future-proof shortcut.
- Project Nexus demonstrates why layered blends and informal parenting become twitchy.

For DDv2, the right hybrid is authored combo/contact poses plus continuous procedural locomotion and
bounded secondary motion, all downstream of a coherent presentation sample.

## Canonical timing doctrine

### 1. Fixed simulation, interpolated presentation

Glenn Fiedler's canonical accumulator keeps simulation step `h` constant and renders between the two
states that surround the remaining accumulator time ([Fix Your Timestep](https://www.gafferongames.com/post/fix_your_timestep/)):

```text
accumulator += boundedRealFrameTime

while accumulator >= h:
    previous = current
    current = simulate(current, h)
    accumulator -= h

alpha = accumulator / h
rendered = lerp(previous, current, alpha)
```

For DDv2, `h = 0.05 s`. The formula applies differently by actor:

- **Authority:** the server alone advances canonical world state at 20 Hz.
- **Self:** the client predicts the same 50 ms commands, then previews the unconsumed fraction
  `inputAccumulator / h` without permanently integrating that preview.
- **Remote:** the client does not run the remote player's full simulation. It reconstructs a delayed
  visual sample from server snapshots.

The existing self predictor already follows the important shape: fixed-tick permanent state plus a pure
fractional `renderPos()` preview.

### 2. Remote snapshot interpolation is a complete-state operation

Choose one remote render instant:

```text
Tr = estimatedServerTime(clientNow) - interpolationDelay
```

Find snapshots `Si` and `Si+1` with timestamps bracketing `Tr`:

```text
alpha = clamp((Tr - ti) / (ti+1 - ti), 0, 1)
```

Then sample every continuous render field from that same pair:

```text
position = lerp(pi, pi+1, alpha)
velocity = lerp(vi, vi+1, alpha)        // or the bracket tangent
height   = lerp(hi, hi+1, alpha)
aim      = angleLerpShortest(ai, ai+1, alpha)
```

Discrete fields are not numerically blended. They step at their authoritative tick boundary:

```text
stance, alive, held, actionId, actionSeq =
    Tr < transitionTick * h ? oldState : newState
```

Fiedler describes buffering snapshots and trading a small amount of latency for smoothness in
[Snapshot Interpolation](https://www.gafferongames.com/post/snapshot_interpolation/). More pointedly,
his networked-avatar write-up found jitter when avatar state was sampled on a different time basis from
physics; the fix was to preserve the render/physics time relationship and reconstruct avatar state at
the correct buffered instant
([Networked Physics in Virtual Reality](https://www.gafferongames.com/post/networked_physics_in_virtual_reality/)).

Short extrapolation may use the newest coherent velocity, but only for continuous fields and only for a
bounded time. A stance, attack edge, landing, teleport, or facing discontinuity should hold or cut; it
should not be guessed. DDv2's 60 ms extrapolation ceiling is reasonable.

### 3. Use explicit clock domains

DDv2 needs named clocks, not one ambiguous `now`:

| Clock | Advances when | Owns |
|---|---|---|
| `simTick` | exact 50 ms authority/prediction steps | gameplay, accepted action ticks, collision |
| `spatialNow` / `spatialDt` | each visible render frame, including online hit-stop | root sampling, displayed velocity, camera |
| `remoteRenderTime` | monotonic estimate of server time minus delay | complete remote actor sample |
| `poseNow` / `poseDt` | render frames; may pause for authored hit-stop | combos, bob amplitude filters, local springs, cosmetic flourishes |
| real wall time | regardless of game pause | networking arrival timestamps, UI, diagnostics only |

Converting a server action tick to a pose epoch is valid, but the conversion must happen once and the
result must live entirely in the pose-clock domain. Ordinary procedural motion must not use a raw
timestamp for its target and a smoothed delta for its derivative.

Phaser calls `Scene.update(time, delta)` once per game step
([Scene API](https://docs.phaser.io/api-documentation/class/scene)), but its documented `delta` is a
**clamped and smoothed average**, while the browser heartbeat can pause and resume
([TimeStep API](https://docs.phaser.io/api-documentation/class/core-timestep)). Therefore:

- use the update `time` or a deliberately selected raw monotonic source to define spatial time;
- derive a bounded spatial delta from that same source;
- advance the freeze-aware pose clock explicitly;
- do not divide a displacement sampled with one clock by a delta produced by another.

### 4. Locomotion phase is continuous and distance-driven

For stride length `L` and rendered travel distance `ds`:

```text
phase = wrap(phase + 2*pi*ds/L)
```

Equivalently, with a coherent displayed speed `v`:

```text
phase = wrap(phase + 2*pi*v*poseDt/L)
```

Do not reset phase when entering idle or changing action state. Fade the gait amplitude instead:

```text
gait += (targetGait - gait) * (1 - exp(-response * poseDt))
targetGait = clamp(speed / nominalMoveSpeed, 0, 1)
```

Use one shared phase for the whole locomotion layer:

```text
leftFoot  = walkCurve(phase)
rightFoot = walkCurve(phase + pi)
bodyBob   = bobCurve(2*phase)
headBob   = smallCounterCurve(2*phase)
```

Idle breathing can use a pose-clock phase, but its amplitude should crossfade with `1 - gait`. A
per-character stable phase offset prevents crowd lockstep. DDv2 already does all of these important
things.

### 5. Secondary motion is an exact, bounded damped spring

Around a time-varying target `xt`, let `y = x - xt`:

```text
y'' + 2*zeta*omega*y' + omega^2*y = 0
```

- `omega` is angular frequency: how quickly the follower returns.
- `zeta < 1` is underdamped and lively.
- `zeta = 1` is critically damped and readable.
- `zeta > 1` is overdamped and heavy.

An analytic solution updates position and velocity without explicit-Euler instability. Ryan Juckett
derives the underdamped, critical, and overdamped coefficients and their reusable update matrix in
[Damped Springs](https://www.ryanjuckett.com/damped-springs/). DDv2's `stepJigglePart()` and
`stepFloatingHeadSpring()` implement this family correctly.

Operational rules matter as much as the equation:

- spring the **local offset around the final socket**, never the authoritative root;
- add a one-time velocity impulse on a detected event edge;
- treat a teleport, spawn, LOD wake, clock cut, or equipment rebuild as a rebase with zero energy;
- cap local offset and velocity to preserve silhouette and collision readability;
- when an authored action owns a limb, either suppress the spring or synchronize hidden spring state to
  the authored pose before handing ownership back;
- apply the same elapsed-time/stall policy to all secondary parts.

Recommended character defaults are not universal, but a useful starting classification is:

- head: `zeta = 0.7-1.0` for readability, or mildly underdamped only with a very small offset ceiling;
- free hand: `zeta = 0.45-0.75`;
- planted foot: close to critical and vertically clamped at the ground plane;
- loose gear: lower damping is acceptable because it does not carry an aiming or contact constraint.

DDv2's current floating head (`omega = 8.4`, `zeta = 0.48`, maximum 3 px by 1.75 px) is deliberately
lively but tightly bounded. That can work. It should be retuned only after its targets and time deltas are
coherent.

### 6. Compose a pose graph, not a sequence of competing writers

The conceptual 2D transform chain is:

```text
MpartWorld =
    MactorRoot
  * Mbody
  * Msocket
  * MbaseArt
  * Mlocomotion
  * Maction
  * Msecondary
  * Mconstraint
```

In practice, some channels are additive translations/rotations and some are multiplicative scale. They
need not all be literal matrices, but their ownership and order must be explicit.

A robust evaluator has two phases:

1. Build a pure `RigLocalPose` from stable base data.
2. Apply each final local transform to Phaser objects once.

Suggested ownership order:

```text
base sockets
  -> locomotion additive layer
  -> authored stance/action layer and ownership masks
  -> secondary springs on unowned channels
  -> hard constraints (two-hand grip, planted foot, orbit)
  -> art-only global lift/squash
  -> head/gear socket inheritance
  -> final GameObject writes
```

The central principle is that a child consumes the final parent transform for the same frame. A head
must not follow yesterday's body rotation, and gear must not follow a pre-spring head.

## Where each layer belongs in Phaser

### Network patch callback

Do only capture and event journaling:

- timestamp the server tick;
- append one complete immutable remote presentation snapshot;
- detect teleports/cuts and reset that actor's ring;
- journal action/event sequence edges with their server ticks;
- reconcile the owner predictor.

Do not mutate live rig parts from the patch callback.

### `ArenaScene.update`

The ideal order is:

```text
1. Read update timestamp; derive one bounded spatialDt.
2. Read input and advance the fixed 50 ms owner-prediction accumulator.
3. Ingest/synchronize scene entities; do not pose them yet.
4. Compute remoteRenderTime once.
5. Produce one PresentedActorState per actor:
     self   = predictor sample + pure fractional preview
     remote = complete buffered snapshot sample
6. Apply actor roots and camera from spatial presentation state.
7. Advance poseNow/poseDt unless the authored pose layer is held by hit-stop.
8. Evaluate the complete local rig pose and analytic springs once.
9. Apply final part transforms, projection, and depth before render.
```

Phaser's `postupdate` is a suitable place for debug assertions or final depth bookkeeping, but it should
not become a second pose writer.

### Hit-stop

For online play, keep spatial roots and camera sampling alive while hit-stop holds the authored action,
enemy pose, particles, and impact effects. Otherwise authority/prediction and the remote render timeline
advance while the displayed actor does not, producing a catch-up step on release.

If a full spatial freeze is mandatory, pause the actor's spatial presentation clock too, then resume
from the paused instant; never let wall time advance the sample cursor behind a frozen root.

## DDv2 audit: what already matches the doctrine

| Area | Current behavior | Assessment |
|---|---|---|
| Fixed authority | `TICK_RATE = 20`, `TICK_MS = 50` (`packages/shared/src/constants.ts:75-78`). | Correct foundation. |
| Owner prediction | `stepNetInput()` permanently advances exact 50 ms predictor ticks; `renderPos()` provides a pure fractional preview (`ArenaScene.ts:14387-14465`, `prediction.ts:1585-1665`). | Correct fixed-step/render-preview split. |
| Remote root | Tick-stamped `x/y` rings render 120 ms behind server time with 60 ms bounded extrapolation (`snapshots.ts:99-200`, `ArenaScene.ts:8409-8453`). | Correct basic snapshot-interpolation structure, incomplete state. |
| Timeline stamps | Patches are stamped as `state.tick * TICK_MS`, not receive time (`ArenaScene.ts:13936-13964`). | Correct; avoids burst-compressed motion. |
| Continuous gait | `strideT` accumulates distance-derived phase and only wraps at a very large bound (`rig-pose.ts:643-678`). | Strong implementation; no idle/action phase reset. |
| Coherent walk curves | Body, feet, hands, and head consume one movement posture/stride phase (`rig-pose.ts:604-758`, `pose-language.ts:1251-1288`). | Correct composition principle. |
| Gait amplitude | Speed target uses an exponential approach instead of binary moving/idle (`rig-pose.ts:604-609`). | Correct frame-rate form. |
| Spring math | Head and limbs use exact under/critical/overdamped transition matrices with bounded offsets and velocities (`rig-core.ts:1660-1742`, `rig-core.ts:1932-2052`). | Strong; not the primary suspected defect. |
| Cuts/ownership | Teleports, clock cuts, first frame, and LOD sleep rebase springs; authored limbs suppress or synchronize jiggle (`rig-pose.ts:441-465`, `rig-core.ts:1887-1974`). | Correct energy/ownership doctrine. |
| Head ancestry | The head socket is computed from the current body position, scale, and rotation, then gear inherits the final head (`rig-gear.ts:1275-1365`). | Correct result, though manually composed. |
| Single live pose entry | Arena applies roots, then calls `blob.animate()` once on unfrozen frames (`ArenaScene.ts:4942-4954`, `ArenaScene.ts:9265`). | Good top-level ownership. |
| Action epoch translation | Remote accepted attack ticks are deliberately mapped onto the delayed pose timeline; wall epochs are translated to the freeze-aware animation clock (`ArenaScene.ts:3421-3429`, `rig-combat.ts:532-549`). | Thoughtful and directionally correct. |

## Ranked gaps

| Rank | Gap and evidence | User-visible consequence | Doctrine fix |
|---:|---|---|---|
| **1 — Critical** | **Remote actor state is sampled from two server instants.** `onPatch()` buffers only `x/y` (`ArenaScene.ts:13936-13953`; `snapshots.ts:23-26`). `interpolate()` samples those at delayed `rt` (`ArenaScene.ts:8416-8452`), but `animateBlobs()` reads newest `height`, `vh`, stance, slide phase/tick, aim, `vx/vy`, held attack/charge, alive, and event sequences from `pl` (`ArenaScene.ts:9140-9252`). | A delayed body can instantaneously receive a future jump, recoil, facing, charge, or stance. Each new 20 Hz patch can move the body socket or ownership regime without moving the delayed root. This is the strongest architectural candidate for part-level pops on remote actors. | Buffer a complete `RemotePresentationSnapshot` and sample all continuous/discrete pose drivers at one `remoteRenderTime`. Interpolate aim on the shortest arc; step discrete fields at their authoritative tick. |
| **2 — High** | **Rig velocity is the derivative of an already-corrected root, not a sampled presentation field.** `animateBlobs()` computes `mx/my = blob - renderPrev` and divides by the frame delta (`ArenaScene.ts:9122-9135`). That velocity drives gait, the fast/slow inertia signal, turn commits, head/limb impulses, and body posture (`rig-pose.ts:604-678`). | Any root hold, extrapolation boundary, correction, timeline adjustment, or catch-up is interpreted as acceleration. The root may look mostly smooth while hands/head vibrate because the rig amplifies its first derivative. This is the best candidate for “vibraty” secondary motion and can affect self and remote actors. | Make the actor sampler return coherent displayed velocity/tangent. For self, expose predictor steering/impulse velocity without reconciliation debt. For remotes, interpolate snapshot velocity or use the current bracket tangent. Feed the rig that field directly. |
| **3 — High** | **Client hit-stop freezes roots while prediction and the remote timeline continue.** Input/sync run, but `interpolate()` and all rig animation are skipped until unfreeze (`ArenaScene.ts:4928-4958`). Self folds the accrued difference into correction; remotes simply sample the newer render time on release. | Release can produce a spatial catch-up followed by a false speed/inertia impulse. A dramatic hit can therefore cause the next walking head/hand frame to kick, even though the spring solver is stable. | Keep actor root interpolation, owner prediction presentation, and camera updates running during online hit-stop. Freeze only `poseNow` and selected VFX/action layers. |
| **4 — Medium-high** | **Spatial sampling and pose integration use different frame clocks.** Remote root sampling uses `this.time.now`; `animClock`, gait filters, finite-difference speed, and spring deltas use accumulated Phaser `deltaMs` (`ArenaScene.ts:4942-4951`, `ArenaScene.ts:8416`, `rig-pose.ts:440-451`). Phaser documents that delta as clamped and smoothed. | Under variable frame pacing, background/resume, or delta clamping, the sampled distance and the time used to interpret it can disagree. The distance phase partly cancels this mathematically, but velocity filters, time-based bob, actions, and springs do not. | Create an explicit per-frame clock bundle. Derive spatial timestamp and spatial delta from one monotonic source; advance a separate freeze-aware pose clock from a deliberate bounded delta. Pass the bundle/sample into the rig. |
| **5 — Medium** | **Secondary parts do not share one stall policy.** Rig `dtMs` is capped at 100 ms, general jiggle may integrate that full value, but the floating head clamps again to 50 ms (`rig-pose.ts:441-455`, `rig-core.ts:1681`). A zero pose delta is also promoted to 1 ms for locomotion filters/phase (`rig-pose.ts:647`). | A 50-100 ms frame can advance hands/feet farther in spring time than the head; zero-time re-evaluations can still advance locomotion phase. This creates part-only temporal divergence after a hitch even with exact solvers. | Centralize one `poseDt`/cut policy. Use the exact solver over the same bounded elapsed time for all parts, or substep all secondary targets identically. Rebase above the common stall threshold and keep zero delta exactly zero. |
| **6 — Medium-low** | **The hierarchy is correct by convention, not represented as a pose graph.** Body, head, hands, and feet are sibling images in one root container (`SpriteRig.ts:930-1095`). A 3,000+ line in-place evaluator writes and rewrites local transforms, then manually reconstructs head ancestry and late constraints (`rig-pose.ts:3428-3640`, `rig-gear.ts:1275-1365`). | Current head ancestry is carefully implemented, but a new late body writer, equipment mode, or ownership transition can make one child consume an earlier parent pose. This is a high regression surface for “only one part snaps.” | Add a pure `RigLocalPose`/socket result and apply final Phaser transforms once. Migrate the body→head→headgear chain first; keep hard constraints as the final pose-graph stage. |
| **7 — Low-medium** | **Remote timeline correction can jump and buffer health is invisible.** `TimelineSync` uses a three-second sliding minimum; when the minimum expires it immediately rescans and substitutes a new offset (`snapshots.ts:29-84`). Delay is fixed at 120 ms, with no interpolation/extrapolation/hold telemetry. | A new minimum can move `remoteRenderTime` discontinuously. Worsening jitter can repeatedly cross interpolate/extrapolate/hold boundaries, which gap 2 then converts into pose impulses. The current code cannot quantify how often this happens. | Make render time monotonic and slew clock-offset corrections. Instrument bracket/extrapolate/hold ratios and headroom first; adapt delay slowly within a bounded range only if measurements require it. |
| **8 — Low, high prevention value** | **Tests verify formulas, not whole-actor continuity.** Snapshot/predictor and floating-head unit tests are substantial, but there is no 20 Hz snapshot → 30/60/120 fps full-rig trace that asserts root/pose time coherence, phase continuity, or maximum per-part frame delta. | A mathematically correct spring and a mathematically correct snapshot ring can still compose into a snap. That integration failure currently reaches playtest first. | Add deterministic presentation-trace tests and optional live telemetry for sample bracket/tick, phase, local head offset, and part velocity. Gate legal cuts separately from continuity failures. |

### Likely symptom chain

The reported head snap should be classified as self-only, remote-only, or both before changing tuning.
The code supports these likely chains:

```text
remote patch at 20 Hz
  -> newest recoil/stance/aim enters an actor whose root is 120 ms older
  -> body/socket target changes at the patch edge
  -> floating head follows the changed target
```

and:

```text
root interpolation/correction/hold/hit-stop catch-up
  -> per-frame root finite difference spikes
  -> fast-minus-slow inertia signal changes
  -> head/hand spring impulse
  -> part motion is more visible than the root discontinuity
```

Neither chain is improved fundamentally by lowering head bob amplitude again. More damping may mask it,
but it also removes intended weight and leaves the time inconsistency available to every future
attachment.

## Concrete ordered fix plan

Each item is intended to be independently shippable and reviewable.

1. **Add presentation trace telemetry without changing behavior.** For each sampled actor, record
   self/remote, spatial timestamp, remote bracket ticks, interpolation/extrapolation/hold mode, root
   position, derived velocity, pose timestamp, stance tick, stride phase, head local target/offset, and
   whether the frame was a legal cut. Sample to a fixed ring enabled by a debug flag.

2. **Add a deterministic whole-actor continuity fixture.** Feed a constant-speed and turn/stop/jump trace
   as 20 Hz snapshots, render it at 30/60/120 fps with jitter and one lost patch, and run the actual
   pose/spring evaluator or a thin extracted evaluator. Assert that all fields in one actor sample share
   a bracket and that no non-cut part exceeds its continuity threshold.

3. **Define `PresentedActorState` and adapt the current paths to populate it.** Include root, coherent
   displayed velocity, aim, height/vh, stance/phase, action/held fields, event epochs, sample mode, and
   cut flag. Initially preserve output; the value is architectural ownership, not a behavior change.

4. **Extend the remote player snapshot ring atomically.** Capture the complete render-relevant row at
   `state.tick * TICK_MS`. Keep visual-only fields out of authority; this is a client buffer, not a
   schema redesign. Add shortest-arc angle interpolation and tick-boundary stepping for discrete fields.

5. **Switch remote rigs to the coherent sample.** Remove direct `pl.*` reads from `animateBlobs()` for
   buffered pose drivers. Keep inventory/art identity changes on their existing lifecycle path, but map
   their visible transition to a sampled tick or an explicit presentation event.

6. **Replace root finite-difference motion input.** Return velocity/tangent from the remote sample. Expose
   the owner's displayed steering and impulse velocity from `SelfPredictor`, excluding reconciliation
   error. Drive gait, turn commit, recoil lean, and spring excitation from those fields. Keep
   distance-accumulated `strideT`.

7. **Let spatial presentation continue through hit-stop.** Move self/remote root sampling and camera
   following outside the visual-freeze branch. Keep combo pose, paper animation, particles, and selected
   enemy presentation on the freeze-aware pose clock. Remove the unfreeze displacement fold that exists
   only because the owner root was held.

8. **Introduce one explicit frame-clock bundle.** In `ArenaScene.update`, derive a monotonic
   `spatialNow/spatialDt`, compute `remoteRenderTime` once, and advance `poseNow/poseDt` deliberately.
   Pass these values, not ad hoc `this.time.now` plus `deltaMs`, to samplers and rig evaluation.

9. **Unify spring elapsed-time policy.** Give head, hands, feet, and loose gear the same bounded `poseDt`.
   Use the existing exact update over that duration or common target substeps. Rebase all at the same
   long-stall threshold; remove the hidden 50 ms head-only clamp and 1 ms zero-delta floor.

10. **Slew the remote clock estimate and instrument delay.** Preserve the existing 120 ms delay initially.
    Enforce monotonic `remoteRenderTime`; rate-limit offset changes. Only after telemetry, consider a
    slowly adaptive 100-180 ms delay targeting fewer than 1% hold frames.

11. **Extract the body/head socket pose first.** Build a small pure `RigLocalPose` result for body, head
    socket, head spring, and headgear, then apply those nodes once. This is the symptom-critical hierarchy
    and can ship before hands, feet, weapons, and combo channels migrate.

12. **Migrate remaining limbs by ownership slice.** Move base locomotion, authored action, secondary
    motion, and hard constraints into explicit stages one limb family at a time. Preserve the current
    exact springs, continuous stride, authored ownership masks, and final two-hand/plant constraints.

13. **Tune only after the coherence gates pass.** Then A/B head damping. Start with the current offset
    ceilings; compare `zeta = 0.48` against `0.65` and `0.8` using identical captured traces. Choose on
    silhouette/readability, not as a workaround for patch edges.

## Acceptance gates

The fix series should not be judged only by “looks smoother on my machine.”

- **Sample coherence:** every remote field reports the same snapshot bracket/render tick in a frame.
- **Constant velocity:** with a 20 Hz source and 60 fps render, root increments remain uniform except at
  declared cuts; secondary impulse stays near zero after the acceleration transient.
- **Frame-rate equivalence:** the same five-second trace at 30/60/120 fps ends within 0.01 rad of stride
  phase and 0.5 px of each secondary local offset.
- **Stop/start:** gait amplitude fades, but stride phase does not reset or teleport.
- **Angle wrap:** aim interpolation from `+179°` to `-179°` takes the 2° path.
- **Discrete state:** jump/stance/action changes occur once at the sampled authoritative tick, never at
  patch receipt time.
- **Hit-stop:** no spatial catch-up step or false secondary impulse occurs on release.
- **Cuts/LOD:** teleports and wakes rebase with zero spring energy and are tagged as legal discontinuities.
- **Buffer health:** under the target network profile, hold frames remain below 1%; extrapolation remains
  within 60 ms; delay changes do not reverse or jump render time.
- **Single writer:** debug builds assert that every rig node is finalized once after pose evaluation.

## Final doctrine

DDv2 should preserve its 20 Hz authority and 60 fps procedural rig. Moving bob or springs into the
simulation tick would make them visibly coarser and would waste network/state budget on cosmetics.
Likewise, changing every animation to wall-clock sine waves would make action timing and hit-stop
incoherent.

The formula is:

```text
fixed authority/prediction
  -> one coherent actor sample at presentation time
  -> continuous locomotion phase with faded amplitude
  -> authored pose ownership
  -> analytic bounded secondary motion
  -> explicit socket/constraint composition
  -> one final transform write per render frame
```

DDv2 has the hard mathematical pieces. Its priority is to make their inputs agree about **which instant**
they are rendering.

verdict: 8 gaps ranked, top recommendation: create one coherent PresentedActorState per render frame and drive the root, velocity, aim, stance, action, and all six rig parts exclusively from that sample.
