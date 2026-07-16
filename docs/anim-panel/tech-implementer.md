# Technical implementer: gameplay-excited spring dynamics for `SpriteRig`

## Recommendation

Add a small, stateful spring layer to `SpriteRig`, but do **not** replace the current gait, aim, brace, or melee vocabulary. Those systems should continue producing an authored target pose; springs should describe how each paper-doll part reaches and leaves that target. This is the safest way to get a fluid, non-repeating silhouette without weakening aim or hit readability.

The implementation should be:

- client-only and cosmetic, matching the rig's existing authority boundary (`packages/client/src/entities/SpriteRig.ts:94-103`);
- allocation-free per frame, with spring scalars stored directly on each rig/part record;
- driven by the already-rendered motion, so self prediction, remote snapshot interpolation, enemies, bosses, boss scale, and hit-stop all use the same system;
- hard-constrained by combat during owned windows, with spring influence eased back during recovery;
- rendered through the existing body/hand/foot/weapon Images, with no new art or runtime textures;
- introduced behind a flag and a `0..1` migration blend so `0` is pixel-for-pixel today's trails.

The key design is a target-relative spring. For a part with authored anchor `a`, store spring displacement `r = rendered - a`, relative velocity `u`, and the previous anchor velocity. A change in root or anchor velocity injects energy into `u`; the damped spring then returns `r` to zero. The rendered part is:

```ts
rendered = anchor + (1 - combatOwn) * springDisplacement;
```

That makes two visually identical authored poses recover differently if one arrived from a reversal, landing, hit, or heavy swing. It is actual stateful secondary motion, not a larger bank of pre-programmed poses.

## What the current code actually does

`animate()` currently has a useful target-generation pipeline, but the direct trail writes are interleaved later than the high-level description suggests:

| Order | Current work | Current source | Spring read/write point |
|---|---|---|---|
| 1 | Clamp animation `dt`, expire combo state | `packages/client/src/entities/SpriteRig.ts:591-606` | Reuse this freeze-aware `dt`; reset/sleep on `dt === 0`. |
| 2 | Ease gait, detect turn-commit, smooth fast/slow render velocity, derive `lagX/Y`, accumulate distance gait | `SpriteRig.ts:608-654` | Sanitize root velocity here. Replace `lagX/Y` as the final motion source only after migration; use the sanitized velocity delta to excite springs. |
| 3 | Commit/ease facing and apply uniform root scale | `SpriteRig.ts:656-682` | Convert world-x excitation with committed `facing`, never divide by `facingBlend` while it passes through zero. Boss/tough size remains a root concern (`SpriteRig.ts:112-114`, `:346-350`). |
| 4 | Build base body bob, squash, run/accel lean, recoil, turn plant, and brace dip | `SpriteRig.ts:684-732` | These values are the core anchor, not final output. Do not spring the `Image` yet because combat still mutates it. |
| 5 | Compute weapon rest angle; dispatch arc/orbit/chop/pivot/thrust/spin/punch and the three-step combo pose; add body and per-hand combat offsets | `SpriteRig.ts:734-1207` | Set per-part ownership here from the same swing/step timing. The final body target is known at the end of this block. |
| 6 | Brace overrides weapon angle | `SpriteRig.ts:1208-1212` | Brace raises ownership; then apply the core residual before hand targets are built. |
| 7 | Build each hand target from authored offset, gait, idle, direct aim, legacy trail, swing channel, turn-commit, and brace; write `Image.x/y` | `SpriteRig.ts:1214-1257` | Remove the direct trail only as the feature blend rises. Step the hand spring after the complete `hx/hy` anchor is known and before the image write. |
| 8 | Hard-place the rear hand along a two-handed haft | `SpriteRig.ts:1259-1270` | This constraint remains final. Reseed the rear-hand spring to the constrained point so a later weapon swap cannot reveal stale energy. |
| 9 | Build foot lift/stride/idle/trail/pivot and write feet | `SpriteRig.ts:1272-1289` | Step foot springs after the complete foot anchor is known. Use a stiffer, more damped coefficient while that foot is in stance. |
| 10 | Orbit/spin may overwrite weapon, both hands, body, scale, and depth; otherwise each weapon rigidly follows its hand | `SpriteRig.ts:1291-1410` | Orbit/spin stay authoritative late overrides. Normal weapons inherit the hand spring for free; do not add a translational weapon spring. |
| 11 | Smooth hop, detect landing, lift every art part, add landing squash, update shadow | `SpriteRig.ts:1412-1434` | Move only the hop scalar update and touchdown edge (`:1415-1419`) earlier, immediately after `dt`, so landing can excite springs in the same frame. Keep final art lift/shadow writes last. |

One important correction to the shorthand pipeline is that the inertia signal is computed before swing dispatch (`SpriteRig.ts:638-651`), but its trail offsets are not applied until the hand and foot placement loops (`SpriteRig.ts:1224-1229`, `:1284-1288`). Springs belong at those final placement boundaries, after combat has generated its anchors, rather than between gait and swing dispatch.

## State layout: inline scalars, not a typed-array pool

Use inline scalar fields on the records already owned by `SpriteRig`.

The existing hand records contain `{ img, ox, oy, front }` and feet contain `{ img, ox, oy }` (`packages/client/src/entities/SpriteRig.ts:116-123`). They are created once while manifest roles are enumerated (`SpriteRig.ts:247-257`). Extend those same records with:

```ts
// target-relative spring state; all initialized once in the constructor
jx: number;  jy: number;  jr: number;       // displacement x/y/rotation
jvx: number; jvy: number; jvr: number;      // relative velocities
prevAx: number; prevAy: number; prevAr: number;
prevAvx: number; prevAvy: number; prevAvr: number;
prevOwn: number;
springReady: boolean;
```

Keep equivalent core values as private scalar fields alongside the current gait/turn/velocity animation state at `SpriteRig.ts:128-159`. Do not allocate a `SpringState` object in `animate()`, return temporary vectors, or use `map`/`filter` in the hot loop. A small scalar helper should accept numbers and write back to the existing record, or the axis update can be inlined in the two part loops.

A shared typed-array pool is not justified at the current cap. The rig already owns variable-length hand/foot record arrays, including builds with missing parts (`SpriteRig.ts:94-103`), so a global pool would add slot allocation, teardown, maximum-part indexing, and stale-slot failure modes. At a typical body + two hands + two feet, six dynamic values per node are 30 numeric values per rig, or about 240 bytes of raw numeric payload before optional anchor history; 80 rigs are only tens of kilobytes. The server currently caps enemies at 80 (`packages/shared/src/constants.ts:218-222`). Revisit a structure-of-arrays pool only when Tier-2/AoI raises the visible population into several hundreds and profiling identifies property access—not Phaser child transforms—as the bottleneck.

Do not add an independent weapon translation node in the first implementation. A normal weapon already copies its owning hand position (`SpriteRig.ts:1401-1409`), so it inherits loose-wrist translation while preserving the grip. At most, add one bounded angular torsion pair (`jigR/jigVR`) to the existing weapon record (`SpriteRig.ts:164-170`) in a later phase. Guns, active melee, brace, orbit, and spin must set weapon angular ownership to 1.

## Stable variable-`dt` integration

Reuse the animation clock's existing non-negative `[0,100]ms` clamp (`packages/client/src/entities/SpriteRig.ts:593-600`). Because hit-stop skips rig updates while `animClock` is frozen (`packages/client/src/scenes/ArenaScene.ts:1748-1768`), this clock also prevents secondary motion from silently advancing through a freeze.

Prefer the exact exponential state transition for a damped oscillator over naïve explicit Euler. For angular frequency `w`, damping ratio `z`, step `h`, relative displacement `r`, and relative velocity `u`, precompute these coefficients once per `(h, part class)` and use the same four coefficients for x, y, and rotation:

```ts
// under-damped z < 1; critical z === 1 has the cheaper branch below
const wd = w * Math.sqrt(1 - z * z);
const d = Math.exp(-z * w * h);
const c = Math.cos(wd * h);
const s = Math.sin(wd * h);
const zwOverWd = (z * w) / wd;

const a00 = d * (c + zwOverWd * s);
const a01 = d * (s / wd);
const a10 = d * (-(w * w) * s / wd);
const a11 = d * (c - zwOverWd * s);

const nextR = a00 * r + a01 * u;
const nextU = a10 * r + a11 * u;
```

For the migration preset's critically damped nodes, avoid trig entirely:

```ts
const d = Math.exp(-w * h);
const a00 = d * (1 + w * h);
const a01 = d * h;
const a10 = d * (-w * w * h);
const a11 = d * (1 - w * h);
```

This exponential form is unconditionally stable for a fixed anchor and produces nearly identical traces at 30, 60, and 120Hz. Treat the anchor as piecewise linear over the frame: compute its velocity from the current/previous anchor, add sanitized root velocity, and subtract the anchor-velocity change from `u` before applying the homogeneous update. That is the physically meaningful excitation: the mass tries to retain motion when its attachment accelerates.

```ts
anchorVx = (ax - prevAx) / h + filteredRootVxLocal;
uX -= inertia * (anchorVx - prevAnchorVx);
// add pending hit/landing/swing impulses, clamp, then apply a00..a11
```

Use wrapped angle deltas for rotation anchors. Clamp displacement and velocity after explicit gameplay impulses, not after ordinary damping, so a teleport or corrupted `dt` cannot make a part disappear. If the team chooses the simpler exponential-damping/semi-implicit Euler split instead, cap substeps at `1/30s` and at most three substeps for the existing 100ms frame clamp; the exact propagator above is preferable because LOD can safely consume an accumulated 33–100ms step without substeps.

The coefficient work is cheap. Three classes (core, hand, foot) require three exponentials per active `dt`; only the loose under-damped classes need sin/cos. Cache by the few LOD cadence buckets if profiling shows the transcendentals matter. Never compute them per axis.

## Excitation and per-part character

The existing authored values become anchors. Physics supplies only target-relative displacement and velocity.

### Locomotion, acceleration, and turns

`animate()` already reconstructs render velocity from `moveX/moveY * speed` and filters it at fast and slow rates (`packages/client/src/entities/SpriteRig.ts:638-651`). Retain the fast channel as the root-velocity input, but calculate a frame-to-frame delta for spring excitation. The existing turn-commit is already a one-shot envelope based on a heading discontinuity (`SpriteRig.ts:615-636`), and its hand target moves by the committed direction (`SpriteRig.ts:1243-1247`); that anchor motion will automatically produce a yank and rebound. Do not also fire a large duplicate turn impulse. A small rotational core impulse at the trigger edge is enough.

Convert world x to local with committed `facing`, and divide only by nonzero `baseScale`. Do not use `facingBlend`: it intentionally crosses zero during the paper turn (`SpriteRig.ts:669-674`). Clamp only the injected delta, leaving the steady velocity available to gait.

### Hands: loose wrists

Hands get the lowest frequency and lowest final damping, the largest displacement cap, and the strongest root/anchor inertia. Their authored target still includes counter-swing, breathing, aim, action offsets, turn-commit, and brace (`SpriteRig.ts:1214-1254`). This means the player keeps the current vocabulary, but a fast reversal or interrupted recovery changes the path through it.

The local player's direct aim and a remote gun's synced angle must remain exact: local aim is selected in `RigAnim` (`SpriteRig.ts:71-92`), remote gun direction is chosen at `SpriteRig.ts:656-663`, and the weapon angle is aimed directly at `SpriteRig.ts:744-750`. While a gun is presented, give the front hand and weapon full ownership or permit only a tiny orthogonal residual; never spring the aim angle itself.

### Feet: planted, not rubbery

Feet use two coefficient sets selected from the existing gait phase. When `sin(ph) <= 0`, the foot is in stance; use high frequency, near-critical damping, a small cap, and a strong root-motion counter-impulse so its world position momentarily plants. During the lifted half, reduce frequency/damping slightly so the foot can trail and catch up. The stance/lift phase already exists at `SpriteRig.ts:1279-1288`; this is not a new animation state.

The two feet must retain separate states. Never average them: their phases differ by pi (`SpriteRig.ts:1282`), so shared state would create synchronized skating.

### Core: stiff and bounded

The body gets a small x/y/rotation residual with the highest frequency and near-critical damping. Apply it after ordinary combat/brace mutations finish (`SpriteRig.ts:1190-1212`) and before hand placement. Keep scale squash/stretch authored; spring only translation and rotation in the first pass. This preserves the deliberate body work—run lean, recoil, turn plant, chop squash, rake twist, punch hip drive, and thrust stretch—already accumulated at `SpriteRig.ts:688-732` and throughout `:797-1205`.

### Landings, hits, and action impulses

- **Landing:** move the hop scalar update/touchdown edge from `SpriteRig.ts:1415-1419` to the top of `animate()` after `dt`; keep the final lift at `:1420-1434`. On the touchdown edge, add a small downward core/hand velocity and a shorter, heavily damped foot compression. This fires once, not for all 110ms of `landSquash`.
- **Hits:** add an allocation-free `kickSecondary(localX, localY, amount)` accumulator on `SpriteRig`. Enemy damage is already detected next to `rig.flash()` at `packages/client/src/scenes/ArenaScene.ts:4006-4033`; self damage is detected at `ArenaScene.ts:4106-4121`. Call the kick at those event edges. Player recoil is also supplied every frame in `RigAnim` (`ArenaScene.ts:3536-3547`), but the explicit event prevents a sustained synced impulse from injecting energy every frame. If hit direction is unavailable, use a deterministic upward/alternating rotational kick derived from the rig's stable `phase`, not `Math.random()`.
- **Swings:** action anchors already change through `swingOffX/Y` and the rear channel (`SpriteRig.ts:1234-1241`). On the active-to-recovery ownership edge, seed a bounded carry velocity from the just-finished anchor velocity. Heavy chop/overhead/impale impacts may also kick the core/plant foot once at their authored impact fraction. Do not add a new timer: use the shared descriptor or selected combo step described below.

## Combat ownership and recovery

The current combat dispatch must remain the source of truth. `triggerSwing()` snapshots the accepted/predicted descriptor, combo family, step, hand direction, and held pose (`packages/client/src/entities/SpriteRig.ts:465-509`). `animate()` then selects that same step from `MELEE_COMBO_SEQUENCES` (`SpriteRig.ts:761-781`). Spring ownership must be calculated inside that path, not inferred later from weapon angle or image position.

Use scalar envelopes declared beside `weaponAngle`—for example `ownCore`, `ownFront`, `ownBack`, `ownFeet`, and `ownWeapon`—initialized to zero each frame at `SpriteRig.ts:734-743`.

The timing source is already shared and should not be duplicated:

- Non-combo styles use `SwingDescriptor.activeStartSeconds`, `activeEndSeconds`, and `poseSeconds` (`packages/shared/src/melee.ts:313-323`, `:351-392`).
- Combo families use the selected `MeleeComboStep.hand` and normalized `timing.activeStart/activeEnd/followEnd` (`packages/shared/src/melee.ts:54-68`), which the rig already reads at `SpriteRig.ts:766-779`.
- Combo continuity and the three-step snapshot already use effective cooldown plus grace (`SpriteRig.ts:481-502`); held guards and their 120ms release are already blended at `SpriteRig.ts:769-779`, `:1190-1205`. Ownership should multiply by that existing `poseBlend`, not introduce another release clock.

Recommended ownership matrix:

| Action | Full ownership | Recovery |
|---|---|---|
| Gun aim | Front hand + weapon while presented; aim angle always direct | No angular spring. A very small wrist residual may return only when not firing. |
| Arc/chop/thrust | Weapon and the step's `lead`/`off`/`both` hand from wind-up through active end; core partially owned | Ease hand/core ownership from 1 to 0 over `activeEnd..followEnd`; seed bounded carry at the edge. |
| Pivot/rake and punch | Hand selected by `MeleeComboStep.hand`; both for scissor/both | Same authored recovery window. The non-owning hand remains physically live. |
| Brace | Both hands + weapon at 1, core about 0.8, feet planted | Existing brace envelope already eases out (`SpriteRig.ts:718-731`, `:1208-1212`, `:1248-1254`). |
| Two-handed grip | Rear hand is a hard geometric child of the front grip | Keep the final haft override at `SpriteRig.ts:1259-1269`; reseed rear spring every owned frame. |
| Orbit/spin | Weapon, both hands, and body at 1 | Preserve the late orbit pass byte-for-byte. It currently overwrites hand positions and body pose at `SpriteRig.ts:1296-1394`; synchronize hidden spring state to those final anchors so exit cannot pop. |
| Foot plant on chop/overhead/impale | The stance foot only, near the impact window | Release rapidly into the high-damped stance spring. Ordinary foot motion remains free. |

When ownership rises to 1, render the authored anchor exactly and synchronize the spring's previous anchor. When it falls below 1, stop kinematic synchronization, seed carry once, integrate normally, and render `anchor + (1-own)*r`. Because the multiplier begins at zero, recovery cannot pop even if the stored residual is nonzero.

This preserves the current WYSIWYG hierarchy: hand action offsets are applied before the weapon follows (`SpriteRig.ts:1234-1241`, `:1401-1409`), two-hand and orbit constraints remain later final writers, and authored combat continues to own active silhouettes.

## Remote snapshots: remove network edges before they become spring energy

Remote players and enemies already render from fixed-delay, tick-stamped snapshot rings, with linear interpolation, bounded extrapolation, and teleport cuts (`packages/client/src/net/snapshots.ts:3-12`, `:140-185`). ArenaScene samples those rings before animation (`packages/client/src/scenes/ArenaScene.ts:1905-1921`, `:2980-3004`) and derives animation speed from per-frame rendered displacement (`ArenaScene.ts:1924-1946`, `:3502-3548`). That is the correct source, but its derivative still changes abruptly at 50ms segment boundaries or when extrapolation begins/holds.

Use a two-stage guard:

1. **Remote-only velocity conditioning.** Before deriving spring acceleration, low-pass the sampled render velocity with an exponential coefficient such as `1 - exp(-14 * dt)` (about a 71ms time constant), versus the current fast `26/s` response for self/predicted motion (`SpriteRig.ts:646-649`). Gait may continue to use its existing eased raw speed; only spring excitation needs the quieter derivative. Clamp remote `deltaVelocity` before applying per-part inertia. Remote players and all enemies naturally take this branch because `RigAnim.isSelf` is false (`SpriteRig.ts:85-91`, `ArenaScene.ts:1942-1946`, `:3536-3547`).
2. **Explicit discontinuity reset.** A snapshot gap over the configured threshold cuts directly to the newer point (`snapshots.ts:161-168`, `:171-182`), and remote pit falls reset the ring (`ArenaScene.ts:5199-5210`). That cut must zero relative displacement/velocity and reseed all previous anchors; it must not become a giant acceleration. Have the interpolation caller compare the sampled position with the rig's prior render position using the same `INTERP_SNAP_PLAYER/ENEMY` threshold and call `rig.resetSecondaryMotion(x, y)` before `setPosition`, or extend the caller-owned `SnapshotPoint` scratch with a `cut` flag. Also reset `renderPrevX/Y`, which currently feed the next animation derivative (`ArenaScene.ts:1929-1941`, `:3503-3515`).

Do not add a second world-position lerp inside `SpriteRig`. The snapshot buffer already owns position smoothing; the spring filter only protects secondary excitation. A second root lerp would reintroduce the movement lag the snapshot system was built to remove.

## Feature flag and initial tuning block

Put a single tuning block beside the existing rig constants and `CLIENT_VISUAL_COMBOS` flag at `packages/client/src/entities/SpriteRig.ts:36-48`. Move the current literal trail amplitudes into this block so blend `0` can retain their exact values (`SpriteRig.ts:1226-1227`, `:1284-1288`). Suggested starting values:

```ts
const RIG_SECONDARY_SPRINGS = false; // rollback: false is today's exact path
const RIG_SPRING_BLEND = 0;          // ship 0; tune 0 -> 1 in controlled steps
const RIG_SPRING_DEBUG = false;

// rad/s and damping ratio. Migration is deliberately near-critical.
const CORE_W = 28;
const CORE_Z = 1.0;
const HAND_W = 18;
const HAND_Z_MIGRATION = 0.95;
const HAND_Z_TARGET = 0.62;
const FOOT_W_AIR = 22;
const FOOT_Z_AIR = 0.82;
const FOOT_W_PLANT = 34;
const FOOT_Z_PLANT = 1.0;

// Local offsets are multiplied by existing `s`; root `baseScale` still sizes bosses.
const CORE_MAX_XY = 6;
const CORE_MAX_R = 0.09;
const HAND_MAX_X = 36;
const HAND_MAX_Y = 30;
const HAND_MAX_R = 0.24;
const FOOT_MAX_X = 20;
const FOOT_MAX_Y = 12;
const FOOT_MAX_R = 0.18;

const REMOTE_ROOT_FILTER = 14;
const SELF_ROOT_FILTER = 26;
const SPRING_MAX_DT_S = 0.1; // matches animate()'s existing 100ms clamp
```

Those hand/foot caps intentionally start from today's trail magnitudes, not a new look. At migration blend `b`:

```ts
legacyTrail *= 1 - b;
renderedResidual *= b;
```

Begin with `HAND_Z_MIGRATION` and high ownership so the new trace settles similarly to today's fast-minus-slow velocity trail. Once parity is accepted, lower only hand damping toward `HAND_Z_TARGET`; keep feet/core near critical. This gives the director loose wrists without turning the whole rig into gelatin.

## LOD and hot-loop budget

ArenaScene currently animates every enemy rig every rendered frame (`packages/client/src/scenes/ArenaScene.ts:1924-1946`) even though the authoritative enemy cap is 80 (`packages/shared/src/constants.ts:218-222`). Add a numeric LOD/cadence decided by ArenaScene using the camera world view. The code already uses `cameras.main.worldView.contains(rig.x, rig.y)` to prioritize visible horde effects (`ArenaScene.ts:3998-4030`), so reuse that exact visibility convention with a one-body-height margin to prevent edge popping.

Recommended tiers:

- **LOD 0, 60Hz:** self, all player rigs, visible enemies, and any rig currently swinging, bracing, jumping, landing, or just hit.
- **LOD 1, 30Hz:** enemies within one expanded viewport outside the visible rectangle. Accumulate `dt` and run one exact spring step every other frame; root snapshot position still updates every frame.
- **LOD 2, 10Hz or sleep:** distant/offscreen enemies with no active action. Either step springs at 10Hz without Phaser child writes, or sleep after 300ms. On wake, analytically consume at most 100ms and reseed anchors if older; never replay seconds of hidden impulses.

Keep combat clocks based on scene time, as they are now (`SpriteRig.ts:758-781`), so an offscreen rig re-entering during a swing samples the correct current authored pose. LOD changes only secondary integration and child writes, never authoritative state or swing timing.

Budget, using the common body + two hands + two feet rig:

- 5 nodes x 80 rigs = 400 nodes;
- x/y/rotation = 1,200 spring axes;
- about 16–20 scalar operations per axis including excitation, matrix update, ownership blend, and clamps = roughly 19,000–24,000 scalar operations/frame;
- at 60fps, roughly 1.2–1.4 million scalar operations/second;
- a rare body + three hands + four feet build is 8 nodes, or about 2.3 million operations/second at the same conservative count.

That arithmetic is small. The meaningful cost remains Phaser child transform writes already performed at `SpriteRig.ts:1255-1256`, `:1286-1288`, and `:1344-1409`; LOD should therefore skip invisible writes as well as spring steps. The hot path must allocate zero arrays, vectors, closures, or descriptors per rig/frame.

## Test and instrumentation strategy

The checked-in client tests currently run in Node and include `packages/**/src/**/*.test.ts` (`vitest.config.ts:3-10`). There is no checked-in `SpriteRig` trace test in this worktree; the closest established patterns are deterministic multi-step movement traces (`tests/movement.test.ts:52-132`) and allocation-free snapshot interpolation tests, including jitter bursts and teleport resets (`packages/client/src/net/snapshots.test.ts:17-34`, `:80-108`). Keep the numeric spring step in a pure, Phaser-free helper so it can use the same test style; the state itself still lives on `SpriteRig`.

Add deterministic traces with fixed inputs and golden scalar samples, not screenshot-only assertions:

1. **Frame-rate equivalence:** run the same accelerate -> cruise -> stop trace at 30/60/120Hz and compare displacement/velocity at shared timestamps. Require sub-pixel position and small velocity tolerance; also run a single 100ms step and assert finite/bounded output.
2. **Gameplay excitation:** idle settle, start/stop, 90-degree turn, 180-degree reversal, landing, recoil/hit, and repeated impulse cap. Trace both normal scale and a boss root scale; local spring values should match while final world motion scales uniformly, consistent with `setRigScale()` (`SpriteRig.ts:346-350`).
3. **Remote jitter:** feed a 20Hz constant-velocity snapshot stream with variable arrivals and a burst like the existing timeline tests (`snapshots.test.ts:80-100`). Assert that spring energy stays under a small threshold. Then insert a teleport/reset and assert exactly zero added energy.
4. **Combat ownership:** for every style and every combo step, assert the owned hand/weapon equals the authored anchor throughout the active interval. Assert off-hand freedom for lead/off steps, both-hand ownership for scissor/impale, hard two-hand spacing, brace ownership, and orbit/spin late overrides. Drive timing from the shared descriptor and combo table (`packages/shared/src/melee.ts:54-68`, `:313-323`), not duplicated fixtures.
5. **Recovery continuity:** sample one frame before/at/after ownership release; assert no position jump, bounded velocity, then settle. Cover combo hold/grace and its 120ms release (`SpriteRig.ts:769-779`, `:1190-1205`).
6. **LOD wake:** compare a visible 60Hz trace with a 30Hz accumulated trace, then sleep/wake offscreen. Assert the wake frame is bounded and active combat samples the correct scene-time pose.
7. **Allocation/performance probe:** run 80 representative five-part rigs for 10 seconds with a scripted movement/combat trace. Require no per-frame heap growth attributable to springs and record `animateEnemies` CPU before/after. Run once with all visible and once with the proposed LOD distribution.

Add a debug-only jiggle energy meter. For each free node, compute relative mechanical energy up to an irrelevant constant:

```ts
E = 0.5 * (uX*uX + uY*uY + rotScale*uR*uR)
  + 0.5 * w*w * (rX*rX + rY*rY + rotScale*rR*rR);
```

Do not compute it when `RIG_SPRING_DEBUG` is false. Track per-rig sum/max and optional injected energy. Tests with a frozen anchor and no new impulses should assert finite, monotonically falling energy and these provisional settle gates:

- core below 1% of peak by 220ms;
- planted feet below 1% by 300ms;
- migration hands below 2% by 450ms;
- tuned loose hands below 2% by 600ms;
- all nodes below both their displacement/velocity caps on every sample.

For moving/gait anchors, measure energy relative to anchor velocity; otherwise ordinary authored motion will look like a false failure. Expose the meter through the existing live debug readout only in development—the scene already reports FPS/entity counts (`packages/client/src/scenes/ArenaScene.ts:5177-5188`).

## Ranked implementation phases

1. **P0 — Pure solver, state, reset path, and shadow instrumentation.** Add inline state, exact integration, energy metric, teleport reset, deterministic traces, constants, and the disabled flag. Integrate in shadow mode but render exactly the legacy trail. This proves stability and allocations before appearance changes.
2. **P1 — Hands/feet locomotion parity plus remote conditioning.** Build complete authored anchors, feed sanitized self/snapshot motion, add stance-vs-air feet, and raise `RIG_SPRING_BLEND` only in development. Tune near-critical damping until old/new peak offsets and settle times are close.
3. **P2 — Combat ownership and constraints.** Wire descriptor/combo-step ownership, brace, gun aim, two-handed grip, combo holds, and orbit/spin synchronization. This phase is a release blocker: springs must not ship visibly before all active windows are proven direct.
4. **P3 — Event impulses and stiff core.** Move touchdown detection earlier; wire hit, landing, swing-carry, and small core rotation impulses. Keep every impulse one-shot and capped. Add optional weapon angular torsion only after the hand/weapon WYSIWYG tests pass.
5. **P4 — LOD, performance gate, and staged rollout.** Add 60/30/10Hz-or-sleep tiers, run the 80-rig probe, then roll blend from 0 toward 1. Tune wrists toward lower damping last; keep a one-line rollback to the old trails until a full combat/remote/boss playtest passes.

The acceptance criterion is not “more motion.” It is: identical authored contact poses during owned windows; bounded, history-dependent recovery outside them; no snapshot-cut explosions; no per-frame allocation; and the 80-rig frame budget remaining dominated by rendering rather than spring arithmetic.
