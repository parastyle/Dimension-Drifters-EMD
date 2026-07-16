# Dagger / claw animation panel — technical implementation

## Recommendation

Treat this as two related defects, not a worn-mount failure:

1. Route the held dual knives and every claw/rake definition through the existing `rake` visual combo family explicitly. Do **not** classify held knives as worn gear, and do not add a new shared `SwingStyle`; `SwingStyle` participates in the authoritative descriptor clock.
2. Replace the rake branch's approximate additive hand travel with absolute, reach-capped grip targets. The hands lead, the weapon remains attached to them, the torso and paper art drive forward behind them, and every lunge-only channel returns to identity before `poseSeconds` ends.

One authoritative data change is required if “one full rendered body length beyond the body” is literal: raise `twin-bowie-fangs.range` from `92` to `100`. That is a server gameplay change. The claw definitions already clear the same threshold and do not need range buffs.

## Diagnosis from the current code

### What the affected data actually contains

There is no `dagger` family in the current weapon data. The shipped dagger-like weapon is:

- `twin-bowie-fangs` / Twin Bowie Fangs: `family: "fist-blade"`, `grip: "dual"`, `dual: true`, no authored `swingStyle`, range `92`, cooldown `0.18`.

The close claw/rake set in the expansion data is:

- `x2-wendigo-claws`: dual, range `105`, cooldown `0.30`.
- `x2-knucklebone-talons`: dual, range `110`, cooldown `0.32`.
- `x2-rendclaw-vambrace`: one-handed, range `120`, cooldown `0.36`.
- `x2-frostfang-rakes`: dual held rakes, range `108`, cooldown `0.30`.
- `x2-wyrmscale-hex-talon`: one-handed gauntlet/talon, range `195`, cooldown `0.46`.

The wider worn melee set consists of `fists` plus every exact `gauntlet`/`fist` family and names matched by `isWornWeapon()`. The expansion melee ids currently caught by that classifier are `x2-blightgrip-spore-mitt`, `x2-cinderpalm-brand-glove`, `x2-frostknuckle-rimewrap`, `x2-ironbrand-heatfist`, `x2-knucklebone-talons`, `x2-prismhex-diffraction-gauntlet`, `x2-pyreclap-mauler`, `x2-rendclaw-vambrace`, `x2-revenant-knuckle`, `x2-sparkknuckle-hex-mitt`, `x2-stormcradle-faradaygloves`, `x2-tesla-faradayer`, `x2-thunderhead-stormfists`, `x2-wendigo-claws`, and `x2-wyrmscale-hex-talon`. The claw/talon names resolve to `pivot`; the rest resolve to `punch`.

`x2-frostfang-rakes` is the classification hole in that group. It is intentionally a held pair, so it should not use the worn mount, but its `exotic-melee` family and “Rakes” name also do not select `pivot`. It falls through to `arc` just like Twin Bowie Fangs.

### Why the hands appear stationary

The worn-mount system in `SpriteRig.equipWeapon()` only does two things:

- it changes the weapon origin from `def.gripFrac` to `0.4`, placing the hand inside a glove/claw instead of at its cuff;
- it changes z-order so worn art covers the hand.

It does **not** skip limb animation or detach the weapon from its hand. In the final weapon pass, normal weapons—including worn weapons—are positioned from `w.hand.img.x/y` every frame.

The failure is style routing and target authoring:

- `swingStyleFor(twin-bowie-fangs)` returns `arc`: it has no authored style, is not worn, is not quake/piercing/two-handed, and therefore reaches the fallback.
- `meleeComboSelectionFor()` consequently gives it the `arc` family.
- The ordinary `arc` slash changes `weaponAngle` and torso rotation but supplies no `swingOffX/Y` hand translation. Both knife sprites rotate around resting hand anchors. The rear knife also receives only its small fixed `+0.32 rad` presentation offset.
- `x2-frostfang-rakes` follows the same path.
- The named claw/talon definitions that resolve to `pivot` do enter the rake branch. That branch currently writes `swingOffX/Y` and, for an off-hand or scissor step, `swingBackOffX/Y`; their hands are not at weight zero. Their weakness is that the approximate `0.12H–0.32H` outward offset and mild torso twist can be hidden under the worn art and do not guarantee a readable endpoint across character manifests.

Procedural-jiggle ownership is not the cause. `ownFront`/`ownBack` are spring weights around the authored hand target:

- weight `1` makes the authored combat point exact;
- weight below `1` permits spring residual around that point;
- it does not create the combat point itself.

An arc hand can therefore have combat ownership while still remaining at its ordinary gait/aim anchor: the arc pose never authored a translated target. For rake combo steps, `actionOwnershipAt()` already gives the named lead/off/both hand full ownership during the active interval and uses the bounded terminal-velocity handoff into `PROCEDURAL_JIGGLE` afterward.

### Authoritative reach and the “one body length” test

The relevant constants are:

- rendered paper body height `H = TARGET_BODY_H = 76 px`;
- authoritative player collision radius `R = PLAYER_RADIUS = 24 px`;
- swept blade half-width `21 px`.

Use an explicit acceptance definition: a weapon endpoint is one rendered body length **past the player's collision boundary** when

```text
meleeReach(def) >= R + H = 24 + 76 = 100 px from the player centre.
```

`meleeReach()` is `max(def.range, (1 - gripFrac) * displayLength)` at the fixed weapon render scale. For all rows below, authored range dominates the sprite-tip floor.

| Weapon id | Current server reach | Reach outside player radius | Outside reach in body heights | Passes 100 px endpoint? |
|---|---:|---:|---:|---|
| `twin-bowie-fangs` | 92 | 68 | `0.895H` | **No; short by 8 px** |
| `x2-wendigo-claws` | 105 | 81 | `1.066H` | Yes |
| `x2-knucklebone-talons` | 110 | 86 | `1.132H` | Yes |
| `x2-rendclaw-vambrace` | 120 | 96 | `1.263H` | Yes |
| `x2-frostfang-rakes` | 108 | 84 | `1.105H` | Yes |
| `x2-wyrmscale-hex-talon` | 195 | 171 | `2.250H` | Yes |

`fists` are adjacent but outside this dagger/claw fix: their reach is `96`, or `72 px = 0.947H` outside the collision radius. If the one-body rule is later made universal for all close-hand attacks, fists need a separate `96 -> 100` balance decision; do not smuggle that into this panel.

The server truth is important:

- `GameRoom.resolveSwing()` freezes aim and stores `range: meleeReach(weapon)` in the accepted swing.
- `GameRoom.stepMeleeSwings()` sweeps a line from the **live authoritative player position** to that endpoint and admits each enemy once. Top-down uses the centered positive `bladeAngleAt()` sweep; belt mode uses the same reach as a forward lane limit.
- Enemy radius plus the `21 px` blade half-width can let an enemy's centre sit beyond the segment endpoint while its body still touches the edge. That collision tolerance is not permission to draw the hand or blade beyond `meleeReach()`; visual endpoint budgeting should use the segment endpoint itself.

The combo paths remain Stage-1 presentation. Reverse and dual rake paths still share one legacy positive server sweep and one hit set; this task must not add a second damage path or claim that both scissor blades are independently authoritative.

## Implementation specification

### 1. Make the visual-family selection explicit

Use the existing `WeaponDef.comboFamily` seam and author `comboFamily: "rake"` for:

- `twin-bowie-fangs`;
- `x2-wendigo-claws`;
- `x2-knucklebone-talons`;
- `x2-rendclaw-vambrace`;
- `x2-frostfang-rakes`;
- `x2-wyrmscale-hex-talon`.

The explicit values on definitions that already derive `rake` are intentional documentation and protect the moves from future renames. The two important routing changes are Twin Bowie Fangs and Frostfang Rakes.

Do not solve this by broadening `isWornWeapon()`:

- Twin Bowie Fangs and Frostfang Rakes are held weapons and should retain `def.gripFrac`, hand-over-hilt z-order, and ordinary held mounting.
- Making `fist-blade` “worn” would mount knives with the hand inside their blades and would then choose `punch`, not `pivot`, unless more name exceptions were added.

Do not set `swingStyle: "pivot"` on Twin Bowie Fangs or Frostfang Rakes for this pass. `swingDescriptorFor()` uses style to select authoritative active fractions (`arc` is `0.16–0.74`; `pivot` is `0.10–0.62`). `comboFamily: "rake"` changes Stage-1 pose selection without silently changing the server clock.

### 2. Give close blades absolute hand targets

Refactor the inline rake path in `SpriteRig.animate()` into a pure close-blade pose sampler. It should return scalar/vector channels only; `animate()` remains the sole transform writer.

Add resettable per-hand target channels rather than increasing the current approximate offsets:

```ts
attackFrontGripX / attackFrontGripY / attackFrontGripBlend
attackBackGripX  / attackBackGripY  / attackBackGripBlend
```

These are hand-authored targets. Apply them in the hand loop after gait/aim base placement and before jiggle integration. The weapon pass continues to copy the final hand point, preserving the invariant “hand owns weapon.” Do not reuse the signature-move `attackGripBlend` semantics in which an anchored weapon supplies the hand; no dagger or claw phase needs inverse ownership.

At the frame of maximum extension, solve the grip from a truthful desired tip instead of adding a guessed number of pixels:

```text
targetTipRadius = min(meleeReach(def), R + H)       // 100 px for every passing close blade
businessLength  = (1 - mountOrigin) * displayLength
mountOrigin     = isWornWeapon(def) ? 0.4 : gripFrac
Ptip            = unit(weaponAngle) * targetTipRadius
Pgrip           = Ptip - unit(weaponAngle) * businessLength - attackArtOff
```

The subtraction of `attackArtOff` matters because that channel is applied late to both hand and weapon. This solve makes the final visible tip land at the target after the whole-paper lunge is composed. Use actual fixed-screen weapon scale and root scale when converting the local target; test the final world/screen endpoint, not an unscaled local approximation.

If `meleeReach(def) < 100`, the sampler must clamp to the shorter truth. Before the proposed range change, Twin Bowie Fangs should visibly fail the one-body acceptance capture at `92`, not fake `100`.

Step behavior remains the existing rake vocabulary:

- step 1 drives the front/lead grip through the positive rake;
- step 2 drives the rear grip for dual weapons and mirrors the front grip for a single claw;
- step 3 drives both grips on staggered scissor paths but still represents one server hit application.

The non-striking hand should not be frozen at idle. Give it a restrained counter-guard of at most `0.12H`, with no tip allowed outside the same reach cap. This makes the silhouette bilateral without presenting a second full-range strike on steps 1 or 2.

### 3. Add torso drive without moving authority

Keep `root.x/y` untouched. The root is the server position, collision body, interpolation anchor, depth-sort anchor, and camera anchor.

Drive the attack with existing resettable channels plus body-local transforms:

- whole visible paper advance: `attackArtOff` peaks at at most `0.10H = 7.6 px` along frozen aim;
- shadow advance: at most `0.04H = 3.0 px`, with a slight aim-aligned stretch so it trails the paper;
- torso twist: up to `0.18 rad`, signed by rake direction and reduced by `cos(aimLocal)` when appropriate;
- torso compression at crossing/contact: `scaleX` down to about `0.90–0.94`, `scaleY` down to `0.94`, and a body-local crouch of at most `0.04H`;
- feet: set attack ownership during the committed interval and suppress the forward plant foot's gait stride rather than translating the authoritative root.

`attackArtOff` moves visible body, hands, feet, and weapons together and is therefore a small paper-space lunge, not movement. The absolute grip target supplies the majority of reach. The `7.6 px` whole-art cap is less than one third of `PLAYER_RADIUS`, stays well below the prior-art `0.25H` false-hurtbox warning, and is fully included in the endpoint solve above.

### 4. Phase, recovery, and spring handoff

Sample every distance from normalized `tt = elapsed / swing.poseSeconds`; do not start Phaser tweens for limbs.

Use the actual descriptor danger interval to constrain full extension:

```text
tServerA = activeStartSeconds / poseSeconds
tServerB = activeEndSeconds / poseSeconds
```

Combo timing can choose hand, direction, stagger, and guard shape, but the one-body contact pose may peak only inside `[tServerA, tServerB]`. This prevents an explicit `rake` visual override on an `arc` descriptor from showing maximum reach before the legacy server edge is active.

Required envelope:

1. `0 -> tServerA`: chamber/countermove; no full forward lunge.
2. `tServerA -> contact`: cubic-out hand acceleration and torso drive; contact lies near the middle of the server active interval.
3. `contact -> tServerB`: carry through the authored angle while remaining inside the endpoint cap.
4. `tServerB -> 0.92`: retract hands, whole-art offset, torso translation, and shadow offset with a smooth ease.
5. `0.92 -> 1.00`: lunge-only channels are exactly zero/identity. A compact combo guard may remain, but neither hand may remain at full range.

This last rule is important because `comboHoldPose` can survive beyond the `0.64 * cooldown` pose window. Sampling the held `tt = 1` pose must show a close guard, never an extended hurtbox promise. Weapon swap, down/death, timeout release, or interrupted prediction must also clear the new target blends in `releaseAttackVisuals()`/`resetSwingCombo()`.

Keep `actionOwnershipAt()` and the existing spring contract:

- targeted hands reach weight `1` through the committed active interval;
- the target itself retracts before ownership fades;
- ownership eases to zero by `t = 0.92`;
- `stepJigglePart()` receives the bounded terminal velocity and resumes `PROCEDURAL_JIGGLE` without a position pop;
- the rear hand on a dual weapon gets independent ownership; the two-handed haft hard constraint is unrelated and must remain unchanged.

### 5. Attack-speed scaling

Distance does not scale with attack speed. Time does.

`poseSeconds` is already `effectiveCooldown * 0.64` for these non-spin styles, and both peers include `lootCooldownMult`. Swift is `0.82x`; Heavy is `1.20x`. Twin Bowie Fangs therefore has:

| Affix | Effective cooldown | Pose duration |
|---|---:|---:|
| none | 180.0 ms | 115.2 ms |
| Swift | 147.6 ms | 94.5 ms |
| Heavy | 216.0 ms | 138.2 ms |

All close-blade phase fractions, ownership ramps, torso motion, and recovery use that same normalized clock. Do not impose a minimum limb-animation duration: it would leave arms extended after the authoritative swing ended. If the 94 ms Swift silhouette needs readability, let the existing ribbon/afterimage persist cosmetically; the body and weapon endpoint must still be back inside the `poseSeconds` contract.

The short Swift window makes the terminal-velocity handoff particularly important. Keep velocity clamping in the spring seam; do not reduce travel distance for Swift or increase it for Heavy.

### 6. Remote and prediction behavior

No new wire field is needed for this pass.

The current authoritative path is:

1. `GameRoom.stampAttackBeat()` increments `PlayerState.attackSeq`, records `attackTick`, and raises the three-tick `attackHeld` latch only after `canAct` accepts.
2. `ArenaScene.routePlayerAttacks()` detects a new `attackSeq`, maps `attackTick` to the delayed render epoch, reconstructs the affix-scaled descriptor, and calls `rig.triggerSwing(epoch, player.aimDir, swing)` for a remote player.
3. The owner predicts the same descriptor in `sendAttack()`; confirmation consumes the predicted high-water edge instead of replaying the pose.

The close-blade pose must remain a stateless sample of the stored epoch, aim, descriptor, and snapshotted combo choice. A delayed remote patch may enter at `tt > 0` or even `tt >= 1`; it should render the corresponding current pose immediately and never replay skipped anticipation. `attackHeld` is a late-observer/cosmetic latch, not permission to hold the lunge. At `tt = 1`, the lunge is already zero.

The new global `attackSeq` is an accepted attack beat, not yet an accepted combo-step protocol. Coalesced patches can still make a remote observer miss intermediate visual steps, and local rejected prediction is not fully reconciled. Do not expand this task into the backlog Stage-2 `accepted comboStep/motion` protocol. The required guarantee here is narrower: every observed accepted beat produces the same reach-capped pose sample on local and remote rigs, with no root motion and no timer local to the observing client.

## Authoritative data change — explicit sign-off required

Change only:

```text
twin-bowie-fangs.range: 92 -> 100
```

This is an `8 px` / `8.7%` reach increase. It changes gameplay in both server modes:

- top-down: the swept segment endpoint becomes `100`;
- belt: the forward lane limit becomes `100`.

Damage, cooldown, half-arc, swing arc, blade width, and hit-once behavior remain unchanged. The change is necessary for the stated one-body endpoint. If balance does not approve it, cap the visual tip at `92` and mark the one-body requirement unfulfilled; there is no honest client-only workaround.

No range changes are recommended for the five claw/rake ids in the table. They are already `105–195`. The larger punch-gauntlet ranges (`110–200`) also exceed the minimum; their broader visual-versus-authority calibration is a separate roster pass.

## File and function touch list

### Required implementation edits

- `packages/shared/src/weapons.ts`
  - `BASE_WEAPONS["twin-bowie-fangs"]`: add `comboFamily: "rake"`; change `range` to `100` only with gameplay sign-off.
- `data/weapon-concepts-300.json`
  - add explicit `comboFamily: "rake"` metadata to the five `x2-*` claw/rake source records listed above.
- `tools/artkit/gen-weapon-expansion.mjs`
  - validate and emit optional `comboFamily`; do not hard-code weapon ids in the generator.
- `packages/shared/src/weapons-expansion.generated.ts`
  - regenerate; never hand-edit.
- `packages/client/src/entities/SpriteRig.ts`
  - `animate()`: replace inline approximate `rakePath` hand offsets with the pure sampled close-blade pose and apply absolute per-hand targets before jiggle.
  - reset new channels with the existing swing channels each frame.
  - `releaseAttackVisuals()`: generalize it beyond `signatureMotion` (the current early return is valid only while ordinary styles never use `attackArtOff`), undo any applied close-blade art offset, and clear the per-hand target blends.
  - `resetSwingCombo()`: guarantee identity at weapon/down/death/timeout lifecycle boundaries.
  - leave `equipWeapon()`'s worn origin/z-order logic intact.
  - leave orbit/two-hand hard constraints intact.
- Recommended new pure helper: `packages/client/src/entities/close-blade-pose.ts`
  - own the phase envelope, direction/hand selection, grip-tip solve, torso/art/shadow channels, and reach clamp without Phaser objects.

### Existing paths to verify, not rewrite

- `packages/shared/src/melee.ts`
  - `isWornWeapon()`, `swingStyleFor()`, `meleeComboSelectionFor()`, `swingDescriptorFor()`, and `MELEE_COMBO_SEQUENCES.rake`.
  - Do not add a new style or enable dormant dual authoritative paths.
- `packages/client/src/scenes/ArenaScene.ts`
  - `routePlayerAttacks()`, `triggerAcceptedRigAttack()`, and `sendAttack()` already provide remote accepted epochs and local prediction. Only change signatures if the pure sampler needs an optional beat id for diagnostics/deduplication; no protocol field is required.
- `packages/server/src/rooms/GameRoom.ts`
  - no sweep logic change. `resolveSwing()` consumes the new Twin Bowie range automatically; `stepMeleeSwings()` remains the legacy one-sweep authority.

### Tests

- `tests/weapons.test.ts`: explicit family/style/reach assertions and the `100 px` close-blade endpoint contract.
- `tests/melee.test.ts`: endpoint clamp and no-hit-beyond-tip pure geometry checks.
- `packages/server/src/rooms/GameRoom.test.ts`: accepted Twin Bowie reach in top-down and belt modes, hit once only, and unchanged attack-beat behavior.
- Recommended new `packages/client/src/entities/close-blade-pose.test.ts`: pure pose continuity and visual-truth matrix.

## Test and capture strategy

### Shared/data tests

- `isWornWeapon(twin-bowie-fangs) === false`; its mount must remain held.
- `meleeComboSelectionFor(twin-bowie-fangs).family === "rake"` while `swingStyleFor(twin-bowie-fangs) === "arc"`; this proves the visual override did not change server active fractions.
- The same explicit family assertion for `x2-frostfang-rakes`; it also remains a held mount.
- The other four named claw/talon/vambrace definitions remain worn where applicable and resolve to the rake family.
- For every target id, `meleeReach(def) >= 100`; before gameplay sign-off, keep a deliberately failing/pending assertion for Twin rather than weakening the requirement.
- Generated expansion output is reproducible with `gen-weapon-expansion.mjs --check`.

### Pure client-pose tests

At `t = 0`, server active start, maximum extension, server active end, `0.92`, and `1.0`, assert for every combo step:

- final visible tip radius never exceeds `meleeReach(def)`;
- with an approved range pass, maximum tip radius reaches at least `100 px` for each target id;
- `root.x/y`, root scale, and authoritative-facing state are unchanged by the sample;
- `abs(attackArtOff) <= 7.6 px` and it is exactly zero at `t >= 0.92`;
- front/back grip selection is lead/off/both as authored;
- weapon grip and hand point coincide after jiggle and after facing mirroring;
- worn mount origin is `0.4`; held mount origin remains `gripFrac`;
- all target blends, torso deltas, shadow deltas, and scales are finite and identity at `t = 1`;
- the active-to-spring handoff has no position discontinuity and velocity remains within `JIGGLE_HANDOFF_MAX_V`.

Run the matrix for aim left/right/up/down, both facings, smallest/largest character rig scale, worn and held mounts, one- and two-part weapon manifests, and `PROCEDURAL_JIGGLE` on/off.

### Server/integration tests

- Inspect the accepted Twin Bowie swing and assert stored `sw.range === 100` after the data change.
- Top-down: a zero-radius pure target at the `100 px` endpoint connects and one beyond the endpoint does not. Keep enemy-radius/blade-width tolerance out of the endpoint assertion.
- Belt: a target inside the forward `100 px` lane connects; one outside the lane does not after accounting for its radius.
- Dual/scissor presentation still damages a given enemy once per accepted attack.
- Swift and Heavy affect descriptor times but never registered reach.
- `attackSeq` increments only on acceptance, and a remote reconstructed descriptor uses the same affix-scaled `poseSeconds` as the server.

### Visual/network captures

Capture Twin Bowie Fangs, Wendigo Claws, Frostfang Rakes, Rendclaw Vambrace, and Wyrmscale Hex-Talon at:

- chamber end, full extension, cross-through, active end, `t = 0.92`, and held `t = 1`;
- no affix, Swift, and Heavy;
- local prediction and remote observation at 0/100/200 ms latency with jitter;
- a remote join while `attackHeld` is true but the short Twin pose is already over;
- walking, hard turning, jumping, and landing during the strike;
- VFX disabled first, then ribbon/VFX enabled.

Reject the implementation if the silhouette needs VFX to reveal the lunge, a tip exceeds authoritative reach, a hand separates from its weapon, the full-body paper offset exceeds `7.6 px`, a held combo pose remains extended, a remote late patch replays from `t = 0`, or the spring pops when combat ownership releases.

## Scope guard

This pass fixes limb participation, readable close-blade reach, and the one-body minimum for the named dagger/claw set. It does not make Stage-1 reverse/scissor visuals authoritative, add accepted combo-step protocol, add a second damage sweep, change finisher damage, or move the player root. Those remain separate server/protocol work.
