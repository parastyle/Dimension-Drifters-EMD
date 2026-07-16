# Animation programmer panel: action-owned spring dynamics

## Recommendation

Build a small, local-space spring layer inside `SpriteRig`, but do **not** spring the final combat pose. Keep the existing action vocabulary as a kinematic target generator, give each action explicit per-part ownership, and simulate a residual position/velocity around the unowned target. At the active-to-follow-through boundary, copy the action's displacement and terminal velocity into that residual spring. The action can then surrender control while the limb continues with real stored energy, overshoots, and settles differently according to locomotion, contact, turns, landing, and rig size.

That handoff is the feature that removes the “animation clip ended; return-to-idle tween began” look. The authored move determines intent and hit readability; the spring determines consequence.

This is a spring-damper system, not a general rigid-body or ragdoll solver. The rig is at most a body, two detached hands, two detached feet, and one or two weapon images, normalized around a 76 px body (`packages/client/src/entities/SpriteRig.ts:36-40`, `packages/client/src/entities/SpriteRig.ts:115-123`). A full Verlet chain would add iteration, constraints, and failure cases without any elbow or leg artwork to display the chain. Explicit spring velocity is also exactly what the action-to-physics handoff needs.

## What the current rig is actually doing

The current secondary motion is procedural, but not yet physical:

- `animate()` derives a clamped frame delta and directly writes every part transform in one pass (`packages/client/src/entities/SpriteRig.ts:591-600`).
- Distance advances `strideT`, while two filtered render velocities produce `lagX/lagY` (`packages/client/src/entities/SpriteRig.ts:638-654`). Those lag values are then multiplied into fixed hand, foot, and body offsets (`packages/client/src/entities/SpriteRig.ts:694-696`, `packages/client/src/entities/SpriteRig.ts:1221-1229`, `packages/client/src/entities/SpriteRig.ts:1282-1288`). They look inertial, but they contain no per-part position or velocity state and therefore cannot exchange energy with an action.
- Turn commit is a good event detector, but its response is another decaying scalar added directly to body and hands (`packages/client/src/entities/SpriteRig.ts:615-636`, `packages/client/src/entities/SpriteRig.ts:710-716`, `packages/client/src/entities/SpriteRig.ts:1243-1247`).
- The style dispatch and three-step combo sampler directly mutate weapon angle, hand offsets, body rotation/position, and squash (`packages/client/src/entities/SpriteRig.ts:734-1206`). Combo step and direction are correctly snapshotted when a swing begins (`packages/client/src/entities/SpriteRig.ts:481-509`), and the shared tables expose active, impact, follow, hand, and secondary-hand timing (`packages/shared/src/melee.ts:54-76`, `packages/shared/src/melee.ts:79-311`).
- Hands receive style offsets after locomotion trails, then weapons copy the resulting hand transform (`packages/client/src/entities/SpriteRig.ts:1214-1257`, `packages/client/src/entities/SpriteRig.ts:1291-1410`). Two-handed grip and orbit are hard constraints that already override both hands when necessary (`packages/client/src/entities/SpriteRig.ts:1259-1269`, `packages/client/src/entities/SpriteRig.ts:1296-1359`).
- Jump height is smoothed and touchdown fires a fixed squash scalar (`packages/client/src/entities/SpriteRig.ts:1412-1434`). Damage momentum is a continuous direct body distortion (`packages/client/src/entities/SpriteRig.ts:698-708`). Enemy death detaches the rig from normal animation and runs root/hop tweens (`packages/client/src/entities/SpriteRig.ts:319-343`).

This ordering gives us a clean insertion seam: separate target evaluation from rendering, insert the residual solver and ownership compositor, then keep the existing constraint/render pass.

## Craft target, without cargo culting it

- **Rain World:** take the end-effector and constraint lesson. Its procedural characters get life from simple simulated chunks, fixed relationships, and cosmetic limbs responding to inputs, rather than from a large clip library. The transferable idea here is “targets plus constraints produce varied outcomes,” especially for foot placement and detached extremities. It is not a reason to reproduce the whole creature physics stack in a paper-doll rig. See the developers' [GDC animation-process talk](https://www.gamedeveloper.com/art/video-animating-i-rain-world-i-and-its-many-squishy-stretchy-creatures) and the later [developer description of input-driven cosmetic limbs](https://unity.com/blog/exploring-procedural-design-rain-world).
- **Madness Combat:** use decisive anticipation/contact and continued limb/weapon travel as the timing target. Do not claim that Madness itself is spring-simulated: Krinkels describes a frame-by-frame process and says tween-only motion did not give him the result he wanted. Springs help us reproduce consequence and follow-through in an interactive system; they do not replace posing. See the [creator interview](https://www.patreon.com/2LeftThumbs/posts/krinkels-creator-72497656).
- **Modern runtime secondary motion:** the production pattern is a lightweight per-part solver with external forces, linear/angular constraints, blend alpha, reset-on-teleport behavior, and LOD—not a second gameplay physics world. Unreal's [AnimDynamics documentation](https://dev.epicgames.com/documentation/unreal-engine/animation-blueprint-animdynamics-in-unreal-engine) is a useful analogue. Our solver is simpler because there are no bone chains or collisions.

## The state model

Store state in canonical rig-local pixels, after source-art normalization but before `baseScale`. The constructor already normalizes all manifests through `TARGET_BODY_H / manifest.body.h`, and boss/tough scale is applied later on the root (`packages/client/src/entities/SpriteRig.ts:230-256`, `packages/client/src/entities/SpriteRig.ts:346-350`). This gives every character the same tuning space.

For every dynamic scalar channel, store position and velocity:

```ts
interface Spring1 {
  x: number; // residual translation in px, rotation in rad, or scale delta
  v: number; // units per second
}

interface PartSpring {
  x: Spring1;
  y: Spring1;
  rot: Spring1;
  scaleY?: Spring1; // body/impact squash only
}

interface SpringProfile {
  posHz: number;
  posZeta: number;
  rotHz: number;
  rotZeta: number;
  maxX: number;
  maxY: number;
  maxRot: number;
  inertiaGain: number;
}
```

For residual `r` and velocity `v`, the unforced system is

```text
r'' + 2 ζω r' + ω² r = 0,       ω = 2πf
```

`f` is natural frequency in hertz and `ζ` is damping ratio: `ζ = 1` is critical damping, `< 1` overshoots, and `> 1` is deliberately planted/heavy. Expose these two values, never raw arbitrary “spring strength” and “friction.” They remain meaningful when frame rate or scale changes.

Use a closed-form damped-oscillator step for under-, critical-, and over-damped cases with a target held over the render interval. There are no contacts or coupled chains requiring Euler iteration. The exact step is stable at variable render delta and cheaper than multiple substeps. Clamp a suspension/clock-reset interval before solving; when `dt > 100 ms`, time goes backward, or a teleport is reported, rebase position to the current target and zero velocity. The existing negative/large-delta guard is the right upstream precedent (`packages/client/src/entities/SpriteRig.ts:593-598`).

State is fixed at construction. Extend the existing hand/foot records with their spring state; add one body state and at most two weapon-rotation states. Do not allocate pose objects, vectors, events, or arrays in `animate()`. The scene already reuses two `RigAnim` scratch objects for its hot loops (`packages/client/src/scenes/ArenaScene.ts:245-267`); `SpriteRig` should follow the same pattern.

### Starting profiles at `baseScale = 1`

| Role/state | Position `f`, `ζ` | Rotation `f`, `ζ` | Canonical caps | Character |
|---|---:|---:|---:|---|
| Body/core | `6.5 Hz`, `1.05` | `5.5 Hz`, `0.90` | `x 5 px`, `y 6 px`, `0.14 rad` | Stiff core, small delayed lean; one restrained overshoot in rotation |
| Free or unarmed hand | `4.5 Hz`, `0.55` | `5.0 Hz`, `0.58` | `x 18 px`, `y 20 px`, `0.38 rad` | Loose wrist and visible after-swing wobble |
| One-handed weapon hand | `6.0 Hz`, `0.72` | weapon `5.2 Hz`, `0.60` | `x 13 px`, `y 15 px`, `0.28 rad` | Accurate grip position with a looser rotational wrist |
| Two-handed support hand | `8.5 Hz`, `0.95` | `8.5 Hz`, `1.0` | `x 7 px`, `y 7 px`, `0.12 rad` | Haft constraint wins; only small grip compression |
| Foot, airborne/toe-off | `6.5 Hz`, `0.78` | `7.0 Hz`, `0.82` | `x 10 px`, `y 10 px`, `0.20 rad` | Quick lift with a little toe lag |
| Foot, planted | `10.0 Hz`, `1.15` | `9.0 Hz`, `1.10` | `x 6 px`, `y 4 px`, `0.12 rad` | No rebound while weight-bearing |
| Body squash | `8.0 Hz`, `0.72` | — | `±0.14 scale` | One compression and rebound, not gelatin forever |

These are first-playtest values, not claims of final feel. Put them in a single static profile table. Variant values should be role/state overrides, not fifty enemy-kind animation configs. A stable ID hash can vary free-hand frequency and damping by at most ±5% so a crowd does not settle in lockstep; the constructor already derives a deterministic per-rig phase from ID (`packages/client/src/entities/SpriteRig.ts:287-290`).

Use an elliptical positional limit and angular limit after integration. If a state hits a limit, project it back and remove only outward velocity; a hard per-axis clamp creates visible corners and stuck springs. No simulated part may cross the body centerline by more than its role permits.

### Elbow-less arm compensation

There is no elbow chain to explain arbitrary hand travel. Treat each hand as an end effector attached to an implied shoulder:

1. Derive an implied shoulder from the hand's manifest rest offset and body center.
2. Resolve residual motion into radial and tangential components relative to shoulder-to-hand direction.
3. Allow full tangential looseness, but multiply outward radial residual by roughly `0.55` and clamp the total reach to an ellipse.
4. When a held weapon or aim extends the hand, move the ellipse center with that kinematic target; do not let the spring shorten the authoritative-looking reach during an active attack.

This gives the detached hand a convincing wrist/forearm arc without inventing invisible elbows or doing iterative IK.

## Pose pipeline

Refactor `animate()` conceptually into five allocation-free stages. The style formulas can remain in the same file; their output changes from direct Image mutation to a reused scratch pose.

1. **Measure rendered motion.** Compute render velocity, acceleration/velocity delta, facing, gait blend, distance phase, hop state, and discontinuity. The existing self, remote-player, and enemy paths already feed animation from actual rendered displacement rather than raw input (`packages/client/src/scenes/ArenaScene.ts:2980-3004`, `packages/client/src/scenes/ArenaScene.ts:3456-3548`, `packages/client/src/scenes/ArenaScene.ts:1905-1946`).
2. **Build base anchors `B`.** Rest offsets, body breathing, look, distance-driven gait, combo-held guard, and gun aim produce a kinematic target. Base anchors are intention, not final pixels.
3. **Sample action pose `A`, ownership `w`, and phase.** Extract the current style branches from the existing dispatch (`packages/client/src/entities/SpriteRig.ts:783-1188`). The shared `SwingDescriptor` supplies one pose duration and active/impact times (`packages/shared/src/melee.ts:313-323`, `packages/shared/src/melee.ts:351-392`); the selected combo step supplies its hand mask and follow end (`packages/shared/src/melee.ts:54-68`).
4. **Integrate residual springs and compose.** Apply queued impulses, solve each residual, perform ownership blend, then apply limits/constraints.
5. **Render.** Write body/hands/feet, solve two-handed haft or orbit constraints, attach weapon images to resolved hands, apply jump/base lift, and update shadow. Those existing final responsibilities remain at `packages/client/src/entities/SpriteRig.ts:1259-1434`.

The central composition rule per scalar channel is:

```text
output = B + w(A - B) + (1 - w)r
```

This is deliberately not `lerp(spring(B), A, w)`. `r` is secondary/recovery energy in the target's local frame. At `w = 1`, the action is exact and all spring error is invisible. At `w = 0`, the limb is fully physical around the current base anchor.

## Ownership and the energy handoff

### Ownership envelope

For a part named by the action's hand/body mask:

- Anticipation: `w` rises from `0` to `1` with a smootherstep over start to active start.
- Active: `w = 1`. The contact effector and weapon cannot be displaced by gait, noise, a network correction, or an old spring. This protects silhouette and the WYSIWYG blade path.
- Follow-through: `w` falls from `1` to `0` between active end and `followEnd`.
- Combo hold: ownership is `0`; the authored terminal guard becomes the new base anchor `B` until cadence grace expires. The spring can breathe around the guard. The current hold/release lifetime is already tracked at `packages/client/src/entities/SpriteRig.ts:601-606` and sampled at `packages/client/src/entities/SpriteRig.ts:769-779`; only its current direct 120 ms linear pose blend retires (`packages/client/src/entities/SpriteRig.ts:1190-1205`).

For combo actions, use the currently selected `MeleeComboStep.timing` to match the pose that is actually rendered. For orbit/spin and any non-combo fallback, derive normalized active start/end from the immutable descriptor. Do not pretend Stage 1's visual combo paths are already authoritative: the code explicitly notes that signed reverse/dual/overhead combo presentation still resolves against the server's legacy centered sweep (`packages/client/src/entities/SpriteRig.ts:797-798`). When accepted combo descriptors land, this phase adapter should collapse to that single source.

### Handoff algorithm

On the frame where a channel first leaves full ownership, evaluate the action exactly at the handoff time `t_h`:

```text
r  <- A(t_h) - B(t_h)
v  <- A'(t_h) - B'(t_h) + retainedExternalVelocity
```

Then integrate `r,v` toward zero while `w` falls. Because `r` initially equals the authored displacement, the ownership blend is position-continuous. Because `v` contains the action's terminal relative velocity, recovery keeps moving in the same direction, overshoots, and settles according to the part profile.

Do not estimate `A'` from the last two rendered frames. Hit-stop skips rig updates while scene/network time continues (`packages/client/src/scenes/ArenaScene.ts:1747-1773`), and the current melee sampler reads `scene.time.now` (`packages/client/src/entities/SpriteRig.ts:758-763`). A freeze can cross the boundary without rendering either side. Make the action sampler pure, evaluate `A(t_h ± ε)` into two reused scratches on the one handoff frame, unwrap angles, and take a centered derivative divided by `poseSeconds`. This is cheap, deterministic, and correct even when a boundary was crossed during hit-stop.

If a spin is accepted as a continuous chain, it retains ownership and angular continuity; do not hand off between integer revolutions. The existing spin-chain snapshot is at `packages/client/src/entities/SpriteRig.ts:472-478`, and its continuous angle path is at `packages/client/src/entities/SpriteRig.ts:1316-1329`. Handoff happens only when the chain actually ends.

### Part masks and constraints

| Action | Fully owned during active | Spring-driven/constraint behavior |
|---|---|---|
| Arc/chop/thrust | Lead hand, weapon translation/rotation, body channels written by the style | Free hand remains physical; a `both` step owns support hand; feet receive plant commands |
| Pivot/rake | `pose.hand`; scissor owns both hands and both worn weapons | Non-striking hand remains physical except during scissor |
| Punch | Striking hand and authored hip/body channels | Opposite hand remains loose; rear foot gets a plant, not an authored foot path |
| Orbit/spin | Weapon, both grips, orbit body channels | Existing ellipse, foreshortening, and far-side depth swap remain hard action constraints (`packages/client/src/entities/SpriteRig.ts:1296-1394`) |
| Brace/parry | Both hands, weapon angle, brace body channels through plateau | Recovery uses the same handoff; successful parry adds a contact impulse. Current brace envelope begins at `packages/client/src/entities/SpriteRig.ts:718-732` and overrides hands/weapon at `packages/client/src/entities/SpriteRig.ts:1208-1212`, `packages/client/src/entities/SpriteRig.ts:1248-1254` |
| Gun aim | Barrel rotation and primary grip stay owned at all times | Body, free hand, and small along-barrel recoil remain physical. The existing direct gun aim must stay exact (`packages/client/src/entities/SpriteRig.ts:744-749`, `packages/client/src/entities/SpriteRig.ts:1230-1233`) |

Two-handed grip is a group constraint, not two independent springs. Resolve the lead hand, reconstruct the support grip along the haft, and allow only a small critically damped compression residual along the haft. Otherwise two slightly different oscillators will visibly shear the hands off the weapon. Keep the existing reconstruction point (`packages/client/src/entities/SpriteRig.ts:1259-1269`) and orbit override (`packages/client/src/entities/SpriteRig.ts:1347-1359`) as the final authority.

## Excitation taxonomy

Excitations modify spring velocity directly for impulses and shift the spring equilibrium only for sustained forces. Every event has a stable ID or edge detector so a 20 Hz value held across three render frames does not kick three times.

### 1. Locomotion acceleration and deceleration

Replace direct `lagX/lagY` offsets with a change-of-reference-frame impulse:

```text
Δv_part = -inertiaGain * Δv_rootLocal
```

Use the rendered root trajectory, because that is what the viewer sees. Convert world delta to committed-facing local space and divide by `baseScale`; never divide by eased `facingBlend`, which passes through zero during a turn (`packages/client/src/entities/SpriteRig.ts:656-674`). Clamp impossible snapshot-derived velocity changes before distributing them.

Starting `inertiaGain`: free hand `0.65`, weapon hand `0.45`, airborne foot `0.25`, planted foot `0.05`, body `0.08`. Acceleration, braking, and reversals then naturally produce different overshoot without separate authored cases. The fast/slow velocity filters at `packages/client/src/entities/SpriteRig.ts:646-651` may remain temporarily as a robust excitation estimator, but their output must stop being a final transform.

### 2. Gait and foot plant

Keep gait easing and distance phase; they solve real problems and are not an animation-set lookup (`packages/client/src/entities/SpriteRig.ts:608-613`, `packages/client/src/entities/SpriteRig.ts:652-654`). Change what phase means:

- During stance, save the foot's world-space plant point. Each frame, convert that point back into canonical rig-local coordinates and use it as the stiff foot target while the root passes over it.
- Clamp plant reach to about `0.16 body heights`; forced release at the limit prevents moonwalking.
- During swing, target the existing distance-phase lift/stride arc, but let the airborne foot spring follow it.
- At heel strike, switch to the planted profile and add a small upward body/hand impulse proportional to speed. At toe-off, release the foot with its current velocity.

The current feet are already alternated by distance phase (`packages/client/src/entities/SpriteRig.ts:1272-1289`); this converts that phase from a directly drawn sine into a Rain World-like endpoint/contact controller. The explicit hand `cos(armPh)` swing should retire. If playtest needs more locomotion readability, retain at most 20–30% of it as a moving shoulder/hand anchor; inertia and heel-strike impulses should provide the visible counter-swing.

### 3. Turn yank

Keep the heading/dot/refractory detector at `packages/client/src/entities/SpriteRig.ts:615-636`. On its rising edge:

- Apply physical inertia opposite `Δv_root` to all loose parts.
- Apply a smaller authored “muscle” impulse toward `turnDir` to both hands and body rotation, preserving the “pull the reins” read.
- Force the outside foot into its planted profile for 80–120 ms and give the core a brief scale spring compression.

Remove the hand/body position additions at `packages/client/src/entities/SpriteRig.ts:710-716` and `packages/client/src/entities/SpriteRig.ts:1243-1247`. The event survives; the canned decay response does not.

### 4. Swing anticipation, active travel, contact, and follow-through

Use the descriptor epoch established in `triggerSwing()` (`packages/client/src/entities/SpriteRig.ts:465-510`) and these edges:

- **Trigger/anticipation:** a small opposing impulse goes to the core and non-owned hand. The striking hand is already moving toward action ownership, so no extra visible noise is needed.
- **Active start:** set owned channels to `w = 1`; optionally stiffen the plant foot. No generic “impact” kick fires here.
- **Authored impact:** at `impactSeconds`, add a drive impulse to core/feet only. This is allowed on a whiff because it represents the attacker's exertion, not collision.
- **Confirmed contact:** add a reverse impulse along the blade/fist terminal velocity. Scale by damage band/crit but cap it. A whiff gets none and therefore carries farther through follow-through.
- **Active end:** seed the action displacement and terminal velocity into each releasing channel. This is the primary recovery energy.
- **Follow end:** ownership reaches zero. Combo hold remains a base anchor, not ownership.

The shared descriptor currently provides `activeStartSeconds`, `activeEndSeconds`, and `impactSeconds` (`packages/shared/src/melee.ts:316-323`); combo steps add per-motion `impact`, `followEnd`, and secondary-hand windows (`packages/shared/src/melee.ts:60-68`). Scissor must run separate ownership/handoff clocks for its two hands.

### 5. Landing

The current landing edge (`prevHop > 6`, near-ground target) is a valid detector (`packages/client/src/entities/SpriteRig.ts:1415-1419`). Replace fixed `landSquash = 1` with an impulse whose magnitude comes from estimated downward hop velocity:

- Body `y` and `scaleY`: compression velocity, then spring rebound.
- Feet: immediately plant, high damping, zero outward velocity.
- Hands and weapon rotation: smaller delayed downward impulse, producing one loose wrist bounce.

Local predicted height and remote synced height already converge on the same `setHop()` path (`packages/client/src/scenes/ArenaScene.ts:3517-3523`, `packages/client/src/entities/SpriteRig.ts:305-309`). Therefore landing works for all peers without a new animation packet. Threshold and velocity caps prevent 20 Hz height steps from manufacturing giant impulses.

### 6. Damage flinch and parry contact

Do not make `flash()` secretly kick physics: it is also used for revive and other color-only feedback (`packages/client/src/entities/SpriteRig.ts:555-564`, `packages/client/src/scenes/ArenaScene.ts:3524-3533`). Add an explicit rig impulse entry point.

- Player rigs already receive synced shove velocity through `RigAnim.recoilX/Y` (`packages/client/src/entities/SpriteRig.ts:88-91`, `packages/shared/src/state.ts:90-93`, `packages/client/src/scenes/ArenaScene.ts:3544-3548`). Excite springs from the **change** in shove velocity, not its held value.
- Enemy HP loss is detected in one batched path, and that path already approximates blow direction from the nearest player (`packages/client/src/scenes/ArenaScene.ts:4006-4033`, `packages/client/src/scenes/ArenaScene.ts:4048-4070`). Call `rig.impulseDamage(direction, magnitude, eventId)` there, outside the expensive-VFX budget gate so degraded hits still move the rig.
- Local player hurt is edge-detected from HP at `packages/client/src/scenes/ArenaScene.ts:4106-4123`; use that as a prompt contact event and deduplicate it against the later shove-velocity delta.
- Successful parry already has a synced `parriedSeq` edge (`packages/client/src/scenes/ArenaScene.ts:4081-4093`). Kick both brace-owned hands only after ownership begins falling; during the plateau, store the contact energy and release it into the handoff.

Body receives the largest coherent directional impulse; hands receive the same direction plus small deterministic role offsets; planted feet receive little. Never generate independent random directions that make a single blow look like five unrelated impacts.

### 7. Death/down

Enemy removal currently detaches the rig before `deathPop()` so `animate()` cannot fight the tween (`packages/client/src/scenes/ArenaScene.ts:1840-1886`). Preserve that ownership boundary. At death:

- Cancel combat ownership and foot plants.
- Seed body/hands/feet with the launch vector plus deterministic per-part angular/linear variation.
- Lower damping and frequency for hands/feet during the 520 ms pop; let the core remain the launch reference.
- Advance this tiny death solver from the existing death tween's update callback, because the rig is no longer in the animated set (`packages/client/src/entities/SpriteRig.ts:323-343`).

For a downed player, `setDowned(true)` already resets combo state (`packages/client/src/entities/SpriteRig.ts:537-543`). Add one critically damped slump impulse, then settle; do not run perpetual corpse jiggle. Replace `Math.random()` in the death spin/peak path with the rig's seeded PRNG if capture/replay consistency matters (`packages/client/src/entities/SpriteRig.ts:323-326`).

### 8. Idle micro-motion

Standing still must not freeze, but per-frame random noise will shimmer and is nondeterministic. Use a seeded, band-limited force per part: either two low-amplitude incommensurate sines or cubic-interpolated value noise keyed by `(rigId, partRole, integer noise sample)`.

Starting canonical amplitudes: body `0.15–0.3 px` and `0.004 rad`; hands `0.4–0.9 px` and `0.015 rad`; feet `0.1–0.25 px`. Frequencies should live roughly between `0.45` and `1.7 Hz`. Feed noise into the spring equilibrium/force, not directly into Image transforms. Existing body breathing may remain as a base anchor (`packages/client/src/entities/SpriteRig.ts:688-693`); direct per-hand and per-foot idle sines retire (`packages/client/src/entities/SpriteRig.ts:1222-1229`, `packages/client/src/entities/SpriteRig.ts:1282-1288`). Suppress micro-noise automatically through `(1 - w)` on action-owned channels.

## Rig size and boss behavior

Canonical displacement caps remain proportional to body height because root scale magnifies them with the rig. Slow large rigs by scaling natural frequency, not damping ratio:

```text
sizeFreq = clamp(baseScale^-0.35, 0.42, 1.05)
f_final  = f_profile * sizeFreq
ζ_final  = ζ_profile
```

A `4×` boss runs at about `0.62×` frequency; a `10×` colossus bottoms out near `0.45×`, avoiding a comically fast giant without becoming unresponsive. Convert world-space velocity/acceleration to canonical local units by dividing by `baseScale`, so a camera-space snap does not impart ten times the normalized energy. `setRigScale()` is the only current scale mutation point (`packages/client/src/entities/SpriteRig.ts:346-350`), and colossal framing is a separate art lift that must not excite the solver (`packages/client/src/entities/SpriteRig.ts:311-317`, `packages/client/src/entities/SpriteRig.ts:1420-1429`).

## Remote motion, snapshots, and determinism

### What works with current data

Remote players and enemies already animate from their interpolated render position. Player snapshot sampling is at `packages/client/src/scenes/ArenaScene.ts:2980-3004`; enemy sampling is at `packages/client/src/scenes/ArenaScene.ts:1905-1921`; both animation loops then calculate displacement/speed from the rendered rig (`packages/client/src/scenes/ArenaScene.ts:3502-3515`, `packages/client/src/scenes/ArenaScene.ts:1924-1946`). Therefore locomotion acceleration, turning, gait, foot plant, and landing springs naturally receive the same kind of input for self, remotes, and enemies.

Snapshot cuts need an explicit reset. `SnapshotBuffer.sampleInto()` currently jumps to the newer point when a bracket exceeds `snapGapPx`, but returns only `{x,y}` (`packages/client/src/net/snapshots.ts:140-185`). Extend its scratch result with a discontinuity bit, or propagate teleport/fell sequence into `RigAnim`; then call `resetDynamicsToPose()` before measuring `Δv`. Player pit reset already purges the ring (`packages/client/src/scenes/ArenaScene.ts:5199-5210`). Enemy gap cuts have no parallel sequence, so the sample bit is the safer general solution. A local threshold remains a last defense, not the primary signal.

### Current combat protocol gap

Remote player melee cannot receive identical action ownership today because `PlayerState` has weapon and aim but no accepted swing sequence, start tick, or combo step (`packages/shared/src/state.ts:25-42`, `packages/shared/src/state.ts:100-135`). Local swings are predicted at button-send (`packages/client/src/scenes/ArenaScene.ts:3553-3578`). Enemy duelists do have `atkSeq`, but their client starts the swing at packet-observation time and reconstructs aim from the nearest living player (`packages/shared/src/state.ts:138-160`, `packages/client/src/scenes/ArenaScene.ts:1821-1837`). This is sufficient for a cosmetic swing, not deterministic phase or energy handoff.

The eventual wire contract should carry a compact accepted action snapshot for both players and attacking enemies:

```text
swingSeq, swingStartTick, comboStep, frozenAim, weapon/style identity as needed
```

Local play predicts that tuple and reconciles on acceptance; remotes evaluate it on the server-tick timeline already maintained at patch receipt (`packages/client/src/scenes/ArenaScene.ts:5191-5219`). Do not infer remote attacks from cooldown, position, HP deltas, or weapon motion. Until this protocol exists, ship remote **secondary locomotion** parity and label remote combat handoff as approximate.

### Determinism contract

- Springs are cosmetic and never enter server simulation, hit tests, cooldowns, or input.
- The same rig ID, rendered trajectory, event tuple, and clock should produce the same noise and near-identical spring state across refresh rates. Unit-test at 30/60/120/144 Hz.
- Use stable ID/role hashes and no render-time `Math.random()`.
- Use monotonic event IDs (`swingSeq`, `atkSeq`, `parriedSeq`, HP-patch identity) to edge-fire impulses exactly once.
- Use explicit resets for spawn, character rebuild, weapon swap where necessary, revive/down transitions, teleport, time reversal, and long suspension. Constructor and weapon lifetime boundaries are already centralized (`packages/client/src/entities/SpriteRig.ts:222-291`, `packages/client/src/entities/SpriteRig.ts:371-400`, `packages/client/src/entities/SpriteRig.ts:574-580`).
- Exact cross-client pixel identity is not a gameplay requirement; phase correctness, stable seeds, and absence of divergent explosions are. Do not network spring positions or velocities.

## Performance budget

At 80 rigs, a typical full rig is roughly five dynamic parts plus at most two weapon rotation scalars. This is only a few thousand scalar spring updates per frame. The budget risks are architecture, not arithmetic:

- No Matter bodies, collisions, general constraint graph, or iterative Verlet chains.
- No per-frame allocations, closures, maps, event objects, or dynamic profile lookup.
- Cache profile scalars on the part when loadout/scale/state changes.
- Evaluate terminal derivatives only on ownership handoff, not every frame.
- Continue hard-solving two-handed grip and orbit once, after independent springs.
- Off-screen rigs may integrate one exact large step at 20–30 Hz, but on-screen crowds should run the full solver; an exact step makes that LOD transition safe. Rebase rather than simulate a huge backlog when an off-screen rig becomes visible.

Set an engineering acceptance target of 100 fully populated on-screen rigs at 60 fps with zero hot-loop allocations and no more than a small fraction of the render-frame CPU budget. Measure on the lowest supported desktop, with the existing VFX/projectile load active; an isolated spring microbenchmark is not sufficient.

## Exact integration map

| Integration | Required change | Current seam |
|---|---|---|
| `RigAnim` | Add discontinuity/event inputs only where scene-derived edges cannot call a rig method directly; retain scalar scratch reuse | `packages/client/src/entities/SpriteRig.ts:71-92`; scratch initialization at `packages/client/src/scenes/ArenaScene.ts:245-267` |
| Rig construction | Allocate fixed spring state beside body/hands/feet; seed deterministic noise from ID | `packages/client/src/entities/SpriteRig.ts:222-291` |
| Position/snap | Record root position history and expose `resetDynamicsToPose()` for teleport/cut | `packages/client/src/entities/SpriteRig.ts:293-295`; player and enemy interpolation at `packages/client/src/scenes/ArenaScene.ts:2980-3004`, `packages/client/src/scenes/ArenaScene.ts:1905-1921` |
| Frame measurement | Replace direct lag output with root `Δv` excitation; preserve dt guard, gait, stride, and turn detection | `packages/client/src/entities/SpriteRig.ts:591-654` |
| Base body | Write base pose scratch instead of Image; retain breathing/look as targets | `packages/client/src/entities/SpriteRig.ts:684-716` |
| Action evaluation | Make style/combo sampler write `ActionPoseScratch`, masks, and phase; preserve existing style math | `packages/client/src/entities/SpriteRig.ts:734-1206` |
| Swing trigger | Queue anticipation, snapshot phase identity, and arm handoff edge tracking | `packages/client/src/entities/SpriteRig.ts:465-510`; local caller at `packages/client/src/scenes/ArenaScene.ts:3571-3578`; enemy caller at `packages/client/src/scenes/ArenaScene.ts:1821-1837` |
| Hands | Compose base/action/residual and implied-shoulder constraint; retire direct trails/turn offsets | `packages/client/src/entities/SpriteRig.ts:1214-1257` |
| Two-handed grip | Keep as final group constraint; allow only constrained compression | `packages/client/src/entities/SpriteRig.ts:1259-1269` |
| Feet | Convert distance phase to swing target plus world-space plant; switch profiles at contact | `packages/client/src/entities/SpriteRig.ts:1272-1289` |
| Weapons/orbit | Attach to resolved hand; spring idle rotation only; action owns active path and orbit depth | `packages/client/src/entities/SpriteRig.ts:1291-1410` |
| Jump/landing | Estimate touchdown velocity and queue body/hand/foot impulses; retain art lift/shadow | `packages/client/src/entities/SpriteRig.ts:1412-1434`; input at `packages/client/src/scenes/ArenaScene.ts:3517-3523` |
| Brace/parry | Add brace ownership mask and store/release parry contact energy | `packages/client/src/entities/SpriteRig.ts:515-521`; local trigger at `packages/client/src/scenes/ArenaScene.ts:3692-3708`; confirmed parry edge at `packages/client/src/scenes/ArenaScene.ts:4081-4093` |
| Damage | Add explicit damage impulse; never couple it to tint flash | `packages/client/src/entities/SpriteRig.ts:555-564`; enemy HP edge/direction at `packages/client/src/scenes/ArenaScene.ts:4006-4070`; self hurt at `packages/client/src/scenes/ArenaScene.ts:4106-4123` |
| Death/down | Release constraints and update death springs inside detached tween; one downed slump | `packages/client/src/entities/SpriteRig.ts:319-343`, `packages/client/src/entities/SpriteRig.ts:537-543`; removal caller at `packages/client/src/scenes/ArenaScene.ts:1840-1886` |
| Snapshot discontinuity | Return a cut bit or propagate a sequence; reset before computing acceleration | `packages/client/src/net/snapshots.ts:140-185`; patch ring population at `packages/client/src/scenes/ArenaScene.ts:5191-5219` |
| Remote accepted action | Add accepted sequence/start tick/step/frozen aim; do not infer | Current player schema `packages/shared/src/state.ts:25-135`; enemy `atkSeq` at `packages/shared/src/state.ts:148-149` |

## What retires, and what remains

| Current feature | Decision |
|---|---|
| `velX/velY`, `slowVelX/slowVelY` | Keep only as a temporary/capped root-motion estimator, or replace with direct rendered `Δv`; never render their difference directly |
| `lagX/lagY` hand/foot/body additions | Retire completely after visual parity; spring velocity becomes the inertia state |
| Distance-driven `strideT` and eased `gait` | Keep; use them for foot contact/swing targets and heel-strike events |
| Explicit cosine arm counter-swing | Retire or reduce to a subtle anchor bias; let locomotion inertia and footfalls drive most arm motion |
| Turn-commit detector | Keep as an excitation event generator |
| Turn-commit body/hand decay offsets | Retire; replace with impulses and temporary plant stiffness |
| Breathing body bob | Keep as a low-amplitude base anchor |
| Hand/foot idle sine offsets | Retire; replace with seeded band-limited spring excitation |
| Swing styles and combo sequences | Keep. They are gameplay-readable intent and ownership targets, not the unwanted canned recovery |
| Combo held guard | Keep as a base anchor after follow-through, not full ownership |
| Direct landing squash and direct recoil distortion | Retire after their spring impulses match or improve the read |
| Orbit ellipse, foreshortening, depth swap, and 2H haft | Keep as hard action/constraint logic |

## Rollout and validation

### Phase 0: pose extraction with zero visual change

Extract `BasePoseScratch` and `ActionPoseScratch`, then render their current sum without springs. Capture representative frames for idle, walk, hard turn, jump/land, brace, every swing style, all combo steps, dual/scissor, two-handed, orbit/spin chain, fists, remote enemy, and `10×` boss. This refactor must be pixel-equivalent except for floating-point noise.

### Phase 1: locomotion springs

Add body/hands/feet states, acceleration impulses, idle noise, and foot plant. Put the old trails behind a temporary comparison switch, but never run both at full strength. Remove old trails once parity tests pass.

### Phase 2: ownership and handoff

Add per-part masks, full active ownership, terminal derivative sampling, combo-held anchors, and spin-chain handling. Test whiff versus confirmed contact: a whiff should travel farther; contact should recoil without moving the active blade off its promised path.

### Phase 3: event completeness and remote correctness

Add landing, damage, parry, down/death, snapshot-cut reset, and the accepted-action wire tuple. Remote action protocol is required before claiming full combat parity across peers.

### Automated invariants

- With no excitation, every profile converges to `|r| < 0.01` without NaN/Infinity.
- Critical profile does not overshoot; loose-hand profile does.
- At every active sample, owned output equals action target within `0.01 px`/`0.001 rad`.
- Ownership handoff is C0 continuous and has no more than a small bounded C1 error.
- Results at 30/60/120/144 Hz stay within a defined visual tolerance after one second.
- A teleport, character rebuild, scene clock reset, or 500 ms suspension produces no impulse.
- Repeating an event ID produces no second kick.
- Two-handed grip distance remains within tolerance through locomotion, handoff, facing flip, and boss scale.
- Seeded idle/death motion is repeatable for the same ID and differs for different IDs.
- Hot-loop allocation count is zero after warm-up.

### Playtest matrix

Evaluate at normal, tough, `4×`, and `10×` scales; 30/60/144 Hz; self prediction; two remote players under smooth and bursty snapshots; 80–100 mixed enemies; hit-stop crossing an active-end boundary; rapid weapon swap; spin spam; scissor secondary window; parry chain; jump landing during a swing; aggregate multi-hit patch; teleport/pit reset; and death while a spring is maximally displaced.

The tuning pass should answer three questions, in order: Is the dangerous part exact and readable? Does the recovery preserve incoming energy? Does each role settle with the intended character? “More jiggle” is not itself a pass criterion.

## Devil's-advocate answers

**“This will make combat mushy.”** Not during danger. The striking hand/weapon is mathematically exact at `w = 1`; foot plants and the core are more constrained than today. Only anticipation edges and recovery are loose.

**“It is still pre-programmed because actions have poses.”** Correct—and necessary. A combat game needs authored intent, silhouettes, and active-path truth. The no-clip look comes from stateful entry conditions, input-driven excitation, constrained plants, contact-dependent recoil, and velocity-preserving recovery. Removing authored combat poses would trade recognizability for noise.

**“Why not just put a spring on the action target?”** A following spring would lag the blade during its active window and visually lie about reach. Residual simulation plus ownership gives exact danger and physical recovery.

**“Why not Verlet like Rain World?”** Verlet is excellent for chains and distance constraints. These rigs expose detached endpoints, not drawable limb chains. Independent frequency/damping tuning, explicit velocities, cheap exact stepping, and action handoff favor spring-dampers. Foot plants and two-handed grips still use the constraint lesson.

**“Terminal velocity will be garbage after hit-stop.”** It will be garbage only if derived from rendered frame deltas. Sampling the pure action pose on both sides of the exact boundary avoids that failure.

**“Network jitter will make remote limbs explode.”** The solver reads the already interpolated render path, caps `Δv`, and resets on an explicit snapshot cut. It never differentiates raw 20 Hz positions directly.

**“Bosses will either wobble like jelly or become frozen.”** Canonical displacement preserves proportion, `baseScale^-0.35` slows frequency, and damping ratio stays role-specific. That produces large, slow follow-through without multiplying normalized energy.

**“Five independent springs will tear a two-handed grip apart.”** They would. That is why the haft and orbit remain group constraints after spring composition.

**“The solver will cost too much at horde scale.”** A handful of scalar closed-form steps is far cheaper than the existing image rendering and style trigonometry. The design forbids collision, chains, per-frame allocation, and iterative solve graphs; profiling with 100 full rigs remains a ship gate.

**“Different clients will see different attacks.”** Today they already can: remote player swings have no accepted event, and enemy start time/aim are reconstructed client-side. The spring layer must not hide that protocol gap. Locomotion parity ships from current snapshots; deterministic remote combat needs the accepted action tuple.

## Panel decision

Proceed with the residual spring-damper architecture and make the energy handoff non-negotiable. Preserve gait phase, action vocabulary, combo data, active ownership, two-handed/orbit constraints, and server authority. Retire fixed inertia offsets and scalar decay responses as their spring equivalents come online. Do not advertise full remote combat parity until an accepted swing epoch/sequence is synced.

The visual north star is not “everything wobbles.” It is: every force leaves a trace, every planted part resists appropriately, every dangerous action remains exact, and no recovery starts from rest unless the character truly had no energy.
