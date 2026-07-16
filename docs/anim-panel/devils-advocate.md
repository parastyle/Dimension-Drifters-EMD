# Devil's advocate: springs are guilty until proven readable

## Position

I reject the broad premise that “more independent jiggle” automatically means “more alive.” In a dodge-centric combat game, motion earns its place by communicating intent, mass, contact, and recovery. An oscillator communicates elasticity. Put one on every part and the cast does not become physical; it becomes equally rubbery.

The production proposal should therefore be **rejected** if it means making body, hands, feet, and weapon free spring followers of the root. I would accept a narrower hypothesis: *small, clamped, action-aware residual springs can replace the existing hand/foot inertia trails during locomotion, while authored combat remains the exact base pose and has hard ownership of every gameplay-significant part.* That is an experiment, not yet a direction.

This distinction matters because the current rig is not a frame-animation system waiting to be made procedural. It is already a sliced paper-doll whose separate images are driven by procedural bob, lean, gait, aim, and drift, with no frame animation (`packages/client/src/entities/SpriteRig.ts:94-103`). The question is not “procedural or authored”; it is whether a second procedural system clarifies or muddies the first.

## What the current code makes non-negotiable

- The base body is normalized to 76 px, while optional hands and feet retain manifest-specific offsets; the body is mandatory but rigs may have fewer detachable parts (`packages/client/src/entities/SpriteRig.ts:36-40`, `packages/client/src/entities/SpriteRig.ts:230-261`). Any physics design must tolerate missing hands/feet and cannot assume a fixed skeleton.
- Locomotion already has a semantic clock: gait eases from actual render speed, stride phase accumulates from distance, and a fast/slow velocity difference produces the present inertia signal (`packages/client/src/entities/SpriteRig.ts:608-654`). Hands then combine stride, breathing, inertia, aim, authored swing offsets, turn commit, and brace in that order (`packages/client/src/entities/SpriteRig.ts:1214-1257`); feet combine gait, idle, trail, lift, and pivot (`packages/client/src/entities/SpriteRig.ts:1272-1289`). A spring added after those formulas is not replacing canned animation. It is stacking another source of lag on an already lagged target.
- Combat is not merely a weapon rotation. Style dispatch can alter weapon angle, one or both hand offsets, torso rotation/position/scale, weapon depth, and—in orbit/spin—the positions of both hands and the weapon for the whole pose (`packages/client/src/entities/SpriteRig.ts:783-806`, `packages/client/src/entities/SpriteRig.ts:929-979`, `packages/client/src/entities/SpriteRig.ts:1291-1394`). The normal two-handed constraint also rewrites the back hand from the front hand and weapon angle (`packages/client/src/entities/SpriteRig.ts:1259-1269`). “Combat owns the weapon” is consequently too weak; ownership has to be per part and aware of later override passes.
- The combo pose can be held after its pose window until accepted-cadence grace expires, then all additive contributions release over 120 ms (`packages/client/src/entities/SpriteRig.ts:769-779`, `packages/client/src/entities/SpriteRig.ts:1190-1205`). Handing parts back to springs at `activeEndSeconds` would be early: it would contaminate authored follow-through and the held guard.
- The visible rig is client-cosmetic, but the melee contract is not visually arbitrary. Authoritative damage tests a swept blade segment from wielder to range, with server-tick supersampling and one hit per swing (`packages/shared/src/melee.ts:7-12`, `packages/shared/src/melee.ts:395-410`, `packages/shared/src/melee.ts:432-446`). The client freezes aim at swing start specifically to follow the server arc (`packages/client/src/scenes/ArenaScene.ts:3571-3578`), and orbit rendering explicitly claims that the blade passes through the damaged arc (`packages/client/src/entities/SpriteRig.ts:1297-1303`). A visibly wobbling active weapon is therefore a gameplay lie, not harmless flavor.
- There is already WYSIWYG debt: combo directions and dual/overhead variations are marked presentation-only while server damage remains one centered positive sweep (`packages/client/src/entities/SpriteRig.ts:797-798`), and the shared combo paths are explicitly dormant for later authoritative use (`packages/shared/src/melee.ts:33-35`, `packages/shared/src/melee.ts:54-76`). Spring deviation would enlarge a known mismatch exactly where the code says it intends eventually to close it.

## Challenge 1: jiggle can erase weight

**Failure mode — fatal to a universal spring design.** Weight is read from commitment: a foot plants, a torso continues, a weapon resists reversal, then the system settles. Independent overshoot on every part says the opposite: contacts are soft, feet have poor traction, and the core does not transmit force. In a bullet-heaven where players parse threats while dodging, high-frequency silhouette noise also competes with anticipation and recovery. “Floaty = death” is not hyperbole here; if players cannot tell whether a body is changing direction, being knocked back, winding up, or merely ringing, the motion system has spent readability to buy novelty.

The current cues are deliberately low-frequency and event-shaped: hard turns fire a single roughly 0.24 s commit envelope (`packages/client/src/entities/SpriteRig.ts:615-636`), which leans and squashes the torso and yanks both hands (`packages/client/src/entities/SpriteRig.ts:710-715`, `packages/client/src/entities/SpriteRig.ts:1243-1247`). Landing similarly fires a short squash rather than a perpetual bounce (`packages/client/src/entities/SpriteRig.ts:1412-1430`). Those cues imply mass because they have a cause and an end.

**Steelman — manageable under a role hierarchy.** Springs can add life if their compliance follows anatomy and action:

- hands/wrists: loose, modest overshoot;
- feet: strongly damped, almost no motion while planted, limited residual only during the lifted half-step;
- core: no free translation; at most a tiny, heavily damped rotational residual after an impulse;
- weapon: no independent spring at all. It follows its owned hand and authored angle.

This is not four artistic presets per character. It is one semantic hierarchy. It also needs clamped displacement and velocity, no perpetual noise, and no underdamped idle ringing. The source must be acceleration/turn/impact events; random excitation would look alive in a GIF and broken during play.

## Challenge 2: springs can fight the combat vocabulary

**Failure mode — fatal if “active window owns parts” is interpreted literally.** The authoritative descriptor exposes pose duration, active start/end, and impact (`packages/shared/src/melee.ts:313-323`), but the visible vocabulary has wind-up, active, follow-through, and held-guard phases with family-specific timings (`packages/shared/src/melee.ts:54-68`, `packages/shared/src/melee.ts:79-311`). Anticipation before damage and recovery after damage are part of the tell. Releasing a weapon or striking hand to physics outside only the damage interval makes the silhouette least trustworthy at the two moments players use to understand the attack.

The ownership requirement should be:

1. **Weapon, striking hand, support hand, and core are authored for the entire pose and any combo hold/release**, not merely the authoritative damage interval.
2. **Orbit/spin own weapon plus both hands for their entire path.** The existing orbit pass already overrides their positions and changes weapon depth (`packages/client/src/entities/SpriteRig.ts:1296-1394`).
3. **Brace owns both hands, weapon angle, and core for the whole brace envelope.** Brace blends both hands to a common guard and overrides weapon angle (`packages/client/src/entities/SpriteRig.ts:718-732`, `packages/client/src/entities/SpriteRig.ts:1208-1212`, `packages/client/src/entities/SpriteRig.ts:1248-1254`).
4. **A two-handed grip owns its constraint, not two independent hand springs.** The rear hand is derived from the front hand and haft (`packages/client/src/entities/SpriteRig.ts:1259-1269`).
5. **On release, blend the *residual weight* from 0 to 1; do not blend two independently moving transforms.** During ownership, the hidden spring state should track zero residual or be reset. Otherwise the first recovery frame releases stored velocity and produces a snap.

**Steelman — manageable with additive residuals.** Compute the exact existing pose first. Treat that as the target and integrate only a small residual offset/rotation around zero. Ownership then sets the residual contribution to zero without changing the base pose. This preserves every authored envelope and makes a spring failure bounded by its clamp. It also fits the current normal weapon pass, where the weapon already rides its hand after hand positioning (`packages/client/src/entities/SpriteRig.ts:1401-1409`).

A full target-following spring or a Verlet ragdoll is the wrong abstraction. Both make authored targets negotiable; Verlet also carries implicit velocity in prior positions, so ownership changes, teleports, equip swaps, and hit-stop require resetting both positions and constraint history. There are no articulated bones to justify iterative constraints—only detached images and a few explicit grip relationships (`packages/client/src/entities/SpriteRig.ts:115-123`, `packages/client/src/entities/SpriteRig.ts:391-463`).

There is also a protocol-sized ownership gap for remote players. `PlayerState` syncs aim, jump height, impulse velocity, and movement reconciliation data but no accepted swing sequence or swing epoch (`packages/shared/src/state.ts:25-42`, `packages/shared/src/state.ts:83-115`). The visible swing trigger is called from local attack prediction, while enemies get a separate `atkSeq` edge (`packages/client/src/scenes/ArenaScene.ts:1821-1837`, `packages/client/src/scenes/ArenaScene.ts:3571-3578`). Therefore “remote players get the same action-constrained springs” is not currently implementable for remote melee ownership. That is **fatal to a production rollout** until the accepted swing/step protocol exists; guessing ownership from aim or cooldown would recreate the very desync the shared descriptor is meant to remove.

## Challenge 3: a wobbling weapon breaks §20

**Failure mode — unconditionally fatal during gameplay-significant phases.** The visible tip cannot deviate from the authored attack path during wind-up, active frames, follow-through, combo hold, brace, orbit, or spin. Zero is the tolerance target. “The server is authoritative” is not a defense when the doctrine says a blade touch should be a hit (`packages/shared/src/melee.ts:7-12`). Even a small angular spring grows into a large tip displacement on a long weapon.

The shared swing clock already scales pose and active seconds from effective cooldown, with style-specific active fractions (`packages/shared/src/melee.ts:351-392`). `SpriteRig` samples that descriptor from the same scene epoch used by its combat effects (`packages/client/src/entities/SpriteRig.ts:758-764`). A spring with a separate clock, or one that continues integrating while combat is frozen/held, creates a second temporal authority.

**Steelman — manageable only by excluding independent weapon physics.** Let the weapon inherit safe hand residual during locomotion at rest; once any attack/brace ownership begins, the hand residual contribution becomes zero and the weapon remains exactly on the authored hand/angle. For guns, aim is already direct and explicitly avoids lag (`packages/client/src/entities/SpriteRig.ts:744-749`, `packages/client/src/entities/SpriteRig.ts:1230-1232`); do not spring the gun hand or barrel. “Loose wrist” is appropriate for an empty/resting hand, not for the muzzle or active edge.

## Challenge 4: mixed provenance can look broken

**Failure mode — manageable, but easy to ship badly.** Rain World-like motion is coherent because pose, constraints, contacts, and reactions all speak the same physical language. Here, an authored torso envelope, distance-driven gait, explicit aim reach, direct two-hand grip, and an independent spring layer can disagree about where force came from. The eye sees detached paper pieces shearing past one another, not muscles yielding.

The current hand target alone already sums five provenances—gait, breathing, velocity lag, aim/action offsets, and turn/brace overrides (`packages/client/src/entities/SpriteRig.ts:1214-1257`). Adding a spring without removing the old `trailX/trailY` is double-secondary motion. The experiment must **replace** the hand/foot lag terms, not augment them; gait, aim, authored offsets, brace, and grip remain the base pose.

**Steelman.** A residual spring can unify rather than fragment the motion if all parts receive the same causal impulse in role-scaled amounts and are pulled toward the already coherent authored pose. A landing can kick hands more than core and almost not move planted feet. A reversal can trail hands opposite acceleration while foot contact clamps vertical residual. This produces related motion, not four unrelated metronomes.

## Challenge 5: 20 Hz remote motion is a hostile excitation source

**Failure mode — fatal if spring impulses come from the second derivative of rendered position.** Remote players and enemies are rendered 120 ms behind a tick-stamped server timeline (`packages/shared/src/constants.ts:100-108`). Bracketed samples are linearly interpolated; starvation permits at most 60 ms of extrapolation and then holds (`packages/client/src/net/snapshots.ts:140-182`). That makes positions smooth but velocities piecewise constant. At every new bracket, velocity can change discontinuously. A spring excited from acceleration will convert those slope changes—and an extrapolate-to-hold transition—into visible ringing.

This is not hypothetical wiring: enemy and player animation direction/speed are computed each render frame from the current interpolated rig position minus the prior render position (`packages/client/src/scenes/ArenaScene.ts:1924-1946`, `packages/client/src/scenes/ArenaScene.ts:3502-3515`). The current rig then already low-passes that render velocity at two rates and clamps their difference before using it as limb lag (`packages/client/src/entities/SpriteRig.ts:638-651`). Replacing the clamp with a more resonant system increases the visibility of every upstream discontinuity.

Teleports are another edge. Snapshot sampling cuts across large gaps and fall resets discard history (`packages/client/src/net/snapshots.ts:124-131`, `packages/client/src/net/snapshots.ts:149-178`; `packages/client/src/scenes/ArenaScene.ts:5206-5218`), but the animation input is still derived later from the root displacement. A spring needs its own discontinuity reset; clamping the eventual offset is not enough because stored velocity can ring afterward.

**Steelman — manageable with signal hygiene.** Use the existing filtered render-velocity difference as a bounded *target/impulse hint*, not raw acceleration. Apply a dead zone and low-pass before excitation. Reset residual position and velocity when root displacement crosses the existing player/enemy snap thresholds, on spawn/rebuild, equip swap, down/death, and after a snapshot hold resumes. Event counters should drive discrete swing/hit/landing kicks where available; do not try to rediscover them by differentiating network motion. Local and remote rigs may share the same spring solver and role presets while receiving appropriately sanitized inputs.

The requested excitation vocabulary also lacks one unified input path today. `RigAnim` carries movement, speed, aim, self/remote identity, and optional recoil, but no hit, landing, turn, or action-ownership event (`packages/client/src/entities/SpriteRig.ts:71-92`). Landing is detected privately from smoothed hop state (`packages/client/src/entities/SpriteRig.ts:1412-1419`), swings and braces enter through separate trigger methods (`packages/client/src/entities/SpriteRig.ts:465-520`), and `flash()` carries tint timing but no impact vector (`packages/client/src/entities/SpriteRig.ts:555-563`). This is **manageable** only through explicit, allocation-free event hooks with direction/magnitude and reset semantics. Reconstructing missing hit or swing impulses from root motion is not an acceptable shortcut.

## Challenge 6: variable frame time and hit-stop can destabilize a “real” spring

**Failure mode — fatal for naïve explicit Euler or unreset Verlet.** `animate()` clamps its derived frame delta as high as 100 ms (`packages/client/src/entities/SpriteRig.ts:591-598`). The scene skips interpolation and rig animation during hit-stop, advances the animation clock only on unfrozen frames, while scene time continues to define swing phase (`packages/client/src/scenes/ArenaScene.ts:1747-1773`; `packages/client/src/entities/SpriteRig.ts:758-764`). On the first resumed frame, combat ownership may have advanced or expired while a hidden spring retains pre-freeze energy.

**Steelman — manageable.** Use an analytic damped-spring update or fixed substeps with a hard maximum count; never integrate a stiff spring once over 100 ms. Freeze residual state during hit-stop, and on resume reconcile ownership first. If a part changed owner or its base target jumped, reset residual velocity before blending it back. Deterministic feel matters more than simulating literal elasticity.

## Challenge 7: performance at horde scale

**Failure mode — manageable for scalar springs, fatal for a miniature physics engine.** The server-side enemy cap is 80 before players are counted (`packages/shared/src/constants.ts:218-224`), and the client calls `animate()` once per visible player and enemy on every unfrozen render frame (`packages/client/src/scenes/ArenaScene.ts:1761-1769`, `packages/client/src/scenes/ArenaScene.ts:1924-1946`, `packages/client/src/scenes/ArenaScene.ts:3502-3549`). The hot path already takes care to reuse shared animation/sample objects (`packages/client/src/scenes/ArenaScene.ts:245-267`), avoid unchanged depth writes that force resorting (`packages/client/src/entities/SpriteRig.ts:126-127`, `packages/client/src/entities/SpriteRig.ts:297-303`), and atlas ordinary rig parts to reduce texture binds (`packages/client/src/entities/SpriteRig.ts:15-18`). A spring implementation that allocates objects, dispatches per-part closures, adds GameObjects, or iterates a constraint graph would violate the existing performance posture.

**Steelman.** Four or five 2D residuals per fully sliced rig are not inherently expensive if represented as fixed numeric state, updated allocation-free, and applied through the transforms already written each frame. Memory and arithmetic are likely manageable; that is an inference, not a benchmark result. Preserve the current number of Phaser objects and transform passes. Verlet constraints, general collision, and per-character graphs receive no such presumption.

The go/no-go performance gate should be measured on the target low-spec machine with 80 enemies plus four players:

- p95 client update-time regression no greater than **0.35 ms** and p99 regression no greater than **0.75 ms** versus baseline;
- no new steady-state allocations attributed to rig animation;
- no increase in visible GameObjects or texture changes;
- no additional missed 16.7 ms frame-budget events in a fixed 120 s replay beyond run-to-run noise.

Failing any gate is fatal to rollout, even if a hero-only capture looks better.

## Challenge 8: tuning combinatorics and scale

**Failure mode — fatal to schedule if tuning becomes per character × part × action × scale.** Rig-local art is normalized from manifest body height and then the root can be uniformly scaled for toughs and bosses (`packages/client/src/entities/SpriteRig.ts:230-256`, `packages/client/src/entities/SpriteRig.ts:346-350`). Current enemy definitions include ordinary boss scales around 2.6–2.9, a 6.4-scale colossus, and a 13-scale giant (`packages/shared/src/enemies.ts:198-206`, `packages/shared/src/enemies.ts:221-241`, `packages/shared/src/enemies.ts:269-289`, `packages/shared/src/enemies.ts:345-370`); toughs use a separate 1.7 multiplier (`packages/shared/src/constants.ts:334-339`). Meanwhile weapon image scale explicitly counters root scale to stay fixed on screen, even though its hand position still comes through the scaled container (`packages/client/src/entities/SpriteRig.ts:1291-1296`, `packages/client/src/entities/SpriteRig.ts:1401-1409`). One unexamined “local pixels” amplitude will not mean the same thing across those silhouettes.

**Steelman — manageable with normalization and very few knobs.** Tune by role, not sprite:

- one hand preset;
- one planted-foot preset and one lifted-foot multiplier;
- one optional stiff-core rotational preset;
- one global impulse scale per event class (locomotion, turn, landing/hit);
- amplitudes expressed as a fraction of the normalized 76 px body height, with a clamped/sublinear root-scale response.

No per-enemy values are allowed in the first implementation. Missing-part rigs simply skip absent roles, as the constructor already does (`packages/client/src/entities/SpriteRig.ts:247-261`). If a sprite needs a bespoke stiffness to stop looking broken, that is evidence the abstraction is failing, not an invitation to add a tuning table.

## Minimal experiment I would accept

Build one reversible, client-only A/B behind a rollback switch alongside the existing visual-combo boundary; that existing boundary demonstrates a cosmetic client switch with no gameplay reader (`packages/client/src/entities/SpriteRig.ts:45-48`). The B condition must:

1. Keep every current base pose, stride, aim, combo, brace, grip, hop, and orbit calculation unchanged.
2. **Replace only** hand and foot `lagX/lagY` offsets with bounded additive residual springs. Do not add body or independent weapon springs.
3. Use an analytic damped update, fixed numeric fields, no allocations, no new Phaser objects, and no iterative constraints.
4. Excite residuals from filtered locomotion change, the existing turn-commit edge, and landing. A hit impulse may be added only through an explicit event, never inferred from remote positional acceleration.
5. Set residual contribution to exactly zero for both hands during any melee pose, combo hold/release, brace, orbit/spin, two-handed grip ownership, or gun aim. Track/reset the hidden residual so release cannot dump stored energy. In the first experiment it is acceptable to own *more* parts for *longer* than ultimately necessary.
6. Reset residual position/velocity on spawn, rig rebuild, equip/unequip, down/death, teleport/snapshot discontinuity, and hit-stop ownership changes.
7. Clamp spring-only hand displacement to **0.08 body heights** (6.08 px at the normalized 76 px body) and foot displacement to **0.035 body heights** (2.66 px); disallow downward residual on a planted foot. These are safety ceilings, not targets.

Test identical seeded replays in baseline A and spring B:

- start/stop, 90° cut, 180° reversal, and figure-eight locomotion;
- aim while strafing, gun aim, jump/landing, hit-stop, and teleport;
- all swing families, all three combo steps, brace, orbit, and spin;
- local prediction, clean remote interpolation, bursty delivery, extrapolate/hold/resume, and packet-latency variation;
- normal scale, 1.7 tough scale, an approximately 2.7 boss, and the 6.4/13 outliers;
- 80 enemies plus four players for the performance replay.

## Measurable feel and correctness gates

Use a blind, randomized A/B with at least 20 players who are not told which condition contains physics. After short clips and after a live dodge/combat task, require all of the following:

- At least **70%** choose B as “more alive/reactive.”
- No more than **15%** describe B unprompted as “broken,” “rubbery,” “floaty,” “drunk,” or “laggy,” and that rate may not exceed A by more than **5 percentage points**.
- “Feels heavy/committed” preference must be non-inferior: B may trail A by at most **5 percentage points**.
- In a forced visible-hit/no-hit judgment test, B's false-safe plus false-hit rate may not exceed A by more than **2 percentage points**.
- During every owned combat frame, automated capture must show **zero difference from A** in weapon-tip position/angle and owned-hand position, within floating-point/render rounding (operational tolerance: **≤1 px and ≤0.5°**). Any systematic deviation is a WYSIWYG failure.
- Spring-only planted-foot slip stays **≤2 px**, and 95% of locomotion impulses settle below 10% of peak residual within **180 ms**. More than one visible direction reversal after the causal event counts as ringing.
- Remote B must not be identified as “more broken/laggy” than local B by more than **5 percentage points** under clean interpolation; under burst/hold recovery it must return to the same bound within **250 ms**.
- All performance gates above pass.

The qualitative question is deliberately blunt: **ALIVE or BROKEN?** If players merely notice “more motion,” the experiment has failed. If “alive” rises but “heavy,” hit judgment, remote stability, or frame time falls, the experiment has also failed.

## Final recommendation

Do not promise “real jiggle physics on every part.” Promise a bounded investigation into **secondary residual motion with authored ownership**. The current code already has strong procedural causality and a dense combat language; the highest-value outcome may be a better spring-shaped replacement for two trail terms, not a new animation architecture.

The fatal lines are clear:

- no independent active-weapon spring;
- no release at damage-window end;
- no raw acceleration from snapshot-interpolated positions;
- no naïve variable-step oscillator;
- no per-character tuning matrix;
- no constraint solver or steady-state allocation in the rig hot path.

Everything else is manageable only if the minimal A/B proves that players call the result **alive**, still call the combat **heavy and honest**, and never have to learn that the wobbling picture is lying.
