# Pose Language — Later-Wave Implementation Blueprint

This document describes a client-presentation change only. It does not require shared weapon-data edits, protocol changes, hitbox changes, attack-timing changes, or server authority. The smallest useful implementation adds one pure descriptor/sampling module, then lets `SpriteRig` feed its results into spring targets that already exist.

The governing rule is: **pose language proposes an equilibrium; the current action system keeps ownership**. A family pose may move a free hand, bias the body, or widen the feet, but it must not displace a hand or foot that a lunge, combo, signature move, brace, or two-handed constraint currently owns.

## Current capabilities to preserve

| Capability | Existing source | Constraint for the pose layer |
|---|---|---|
| Damped hand and foot motion | `SpriteRig.stepJigglePart()` | Reuse it. Do not add a second spring or tween system. |
| Hard-constrained limbs | `SpriteRig.syncOwnedJigglePart()` and per-part ownership | Attack grips, planted feet, orbit moves, and two-handed geometry remain higher priority. |
| Normal gait and inertia | `SpriteRig.animate()` hand/foot loops | Family targets modify the resting equilibrium; they do not replace distance-driven gait. |
| Aimed gun placement | `firingStanceFamilyFor()`, `firingHandTarget()`, `usesAimedFiringStance()` | Existing muzzle-forward targets, face-line cap, raise/linger/settle timing, and family bands remain authoritative. |
| Melee action clocks | `SpriteRig.triggerSwing()`, combo timing, `actionOwnershipAt()` | Derive anticipation, active, and recovery from these clocks; do not invent a parallel attack state machine. |
| Dagger/claw lunges | `sampleCloseBladePose()` | Keep its hand targets, body drive, foot plant/kick, reach truth, and release timing unchanged. |
| Authored-dual routing | `routeSwingChannels()` and `AUTHORED_DUAL_MELEE_BAR` | Preserve lead/off parity and the Crossfall both-hands beat for one pre-made weapon definition. |
| Two-handed hand truth | late rear-hand geometric constraint using `attackHandSpacing` | The descriptor can suggest a rear support point, but the late constraint remains the final authority. |
| Tome page motion | `prepareTomeVisual()`, `startTomePage()`, `syncTomeVisual()` | Synchronize the off-hand beat to the existing page event; do not add an unrelated page timer. |
| Visibility LOD | `JIGGLE_LOD_MARGIN_PX` and the existing rebase/suppress path | Retain the readable static pose outside full simulation and suppress only micro-motion. |

## One descriptor module

Add `packages/client/src/sprites/pose-language.ts`, next to `firing-stance.ts`. Its public surface should follow the same small table-plus-pure-helper idiom.

```ts
export type WeaponPoseFamily =
  | "one-hand-blade"
  | "close-blade"
  | "one-hand-blunt"
  | "fists"
  | "pistol"
  | "fist-gun"
  | "long-gun"
  | "thrown"
  | "focus"
  | "tome"
  | "two-hand-sword"
  | "two-hand-heavy"
  | "polearm";

export type OffHandVerb =
  | "oppose"
  | "ward"
  | "guard"
  | "recoil-catch"
  | "spot"
  | "frame"
  | "page"
  | "support"
  | "hard-grip";

export interface AimRelativeAnchor {
  /** Positive is toward aim. Units are normalized by body height. */
  forward: number;
  /** Positive is to the character's local right. */
  lateral: number;
}

export interface WeaponPoseSpec {
  family: WeaponPoseFamily;
  offHandVerb: OffHandVerb;
  idle: AimRelativeAnchor;
  moveTighten: AimRelativeAnchor;
  microForward: number;
  microLateral: number;
  microHz: number;
  bodyForward: number;
  bodyLateral: number;
  bodyTurn: number;
  frontFoot: AimRelativeAnchor;
  backFoot: AimRelativeAnchor;
}

export const WEAPON_POSE_SPECS:
  Readonly<Record<WeaponPoseFamily, WeaponPoseSpec>>;

export function weaponPoseFamilyFor(def: WeaponDef): WeaponPoseFamily;
export function weaponPoseSpecFor(def: WeaponDef): WeaponPoseSpec;
```

`WeaponPoseSpec` contains only quantities the paper-cutout rig can express: hand-center targets, a small periodic offset, body translation/rotation bias, and foot-center targets. It must not encode elbows, fingers, grip roll, wrist articulation, or weapon-independent hand art. Words such as “fist” or “page trace” describe the mitten's screen-space job, not a new hand shape.

The implementation should use frozen record entries and return references to them. Do not construct descriptor objects per animation frame.

### Classification and overlays

`weaponPoseFamilyFor()` should resolve by behavior first, then use concrete family tags to refine melee shape. Reuse the current helpers and laws rather than creating a second taxonomy:

1. Use `firingStanceFamilyFor(def)` for pistol, fist-gun, and long-gun groupings. Its delivery-first resolution already handles mixed or misleading tags.
2. Use `meleeComboSelectionFor(def)`, `swingStyleFor(def)`, and `isWornWeapon(def)` for close blades, fists, two-handed weapons, and polearms.
3. Treat `delivery === "thrown"` as `thrown`, even if a secondary tag resembles a melee family.
4. Resolve tome/book families to `tome`; compact wand, focus, orb, rod, scepter, and one-hand staff casting to `focus` unless the weapon is already a two-hand staff/polearm.
5. Keep `beam` and authored-dual handling as overlays, not base families. A beam still needs its pistol, fist-gun, long-gun, focus, or tome chassis; a pre-made dual still needs concrete lead/off presentation from its one definition.

The family/tag mapping in `pose-language.md` is the exhaustive design source. Unknown future data should fall back conservatively: one-handed ranged to `pistol`, two-handed ranged to `long-gun`, worn melee to `fists`, two-handed thrust/orbit melee to `polearm`, and other melee to `one-hand-blade`. Tests must make this fallback visible rather than silently returning an unposed hand.

## Pure sampler

Keep classification separate from temporal sampling. A small allocation-free sampler makes the design testable without constructing Phaser objects.

```ts
export type PoseActionPhase =
  | "idle"
  | "anticipation"
  | "active"
  | "recovery";

export interface PoseLanguageInput {
  spec: WeaponPoseSpec;
  timeS: number;
  gait: number;
  moveAmount: number;
  phase: PoseActionPhase;
  phaseT: number;
  strikingHand: 0 | 1;
  freeHand: 0 | 1 | -1;
  reducedMotion: boolean;
  beamPhase?: "charging" | "active" | "overheated" | "cooling";
}

export interface PoseLanguageSample {
  offForward: number;
  offLateral: number;
  offBlend: number;
  bodyForward: number;
  bodyLateral: number;
  bodyTurn: number;
  frontFootForward: number;
  frontFootLateral: number;
  backFootForward: number;
  backFootLateral: number;
  footBlend: number;
}

export function createPoseLanguageInput(): PoseLanguageInput;
export function createPoseLanguageSample(): PoseLanguageSample;
export function samplePoseLanguage(
  input: PoseLanguageInput,
  out: PoseLanguageSample,
): PoseLanguageSample;
```

The factory functions are for one-time `SpriteRig` field initialization. `samplePoseLanguage()` mutates `out`, clamps all blends, and returns it; the hot path creates no arrays or objects.

Micro-motion should be one or two phase-shifted sine components, bounded to the amplitudes in the descriptor. Its phase should be deterministic from the rig's existing time/gait inputs, not random per frame. `reducedMotion` sets only the periodic amplitudes to zero; it does not erase the static guard, body attitude, or foot stance.

## `SpriteRig` integration

The later wave should make the smallest changes inside `packages/client/src/entities/SpriteRig.ts`:

- Import `weaponPoseSpecFor`, `createPoseLanguageInput`, `createPoseLanguageSample`, and `samplePoseLanguage`.
- Add preallocated input/sample fields. Optionally cache one descriptor reference per equipped hand so `weaponPoseFamilyFor()` runs on equipment change instead of every frame.
- In `equipWeapon()` and `equipLoadout()`, refresh those descriptor references after `weaponDef` changes. Let the existing `resetSwingCombo()`, `releaseAttackVisuals()`, `resetSecondaryMotion()`, ranged-aim reset, and jiggle rebase paths clear temporal state.
- Do not add a pose timer. In `animate()`, derive the pose phase from the clocks already in use.

### Recommended order inside `animate()`

The order matters more than the exact helper placement:

1. Compute aim-local forward/side axes, `gait`, movement amount, and the current attack/ranged phase as today.
2. Sample the base family pose once.
3. Add the descriptor's small body bias after generic idle/run bob and recoil lean, but before stronger brace, lunge, signature, or attack body motion.
4. In each hand loop, compute the normal gait/inertia target first. Add the free-hand family target and micro offset next.
5. Apply the existing aimed firing target, `swingOffX/Y`, `swingBackOffX/Y`, brace, and absolute attack-grip blends afterward. Those systems therefore retain priority.
6. Feed the resulting non-owned target to `stepJigglePart()` using the current free-hand or weapon-hand inertia constants.
7. In each foot loop, add family stance offsets before applying `attackFrontFootX/Y/Blend` and `attackBackFootX/Y/Blend`.
8. Leave late two-hand spacing, orbit/signature constraints, and `syncOwnedJigglePart()` calls where they are.

The pose layer should not set `ownFront`, `ownBack`, or foot ownership merely to hold an idle stance. An idle or moving guard is an equilibrium with `own = 0`, so it retains spring life. Existing attacks continue to raise ownership and can fully override it.

### Aim-relative coordinates

Convert descriptor coordinates with the same local axes already used by weapon aiming:

```ts
worldX = bodyX + aimX * forward + sideX * lateral;
worldY = bodyY + aimY * forward + sideY * lateral;
```

Scale normalized descriptor values by `TARGET_BODY_H` once when sampling or applying. Mirror lateral values through the existing lead/off-hand convention, not through world X, so the silhouette remains correct when aiming left. This also avoids authoring four directional tables.

### Action-specific handoffs

- **Pistols and fist-guns:** keep the firing hand entirely under `firingHandTarget()`. The free hand holds the chest guard, widens slightly during the existing raise window, receives a short opposing impulse on recoil, then returns through the existing linger/settle envelope.
- **Long guns, scatterguns, rapid guns, and launchers:** the off hand is a suggested support point during idle/move, but the aimed firing layer can increase its blend. Do not infer a barrel socket; this remains a readable two-mitten silhouette, not a false exact grip.
- **Thrown:** `ArenaScene.sendAttack()` already calls `triggerSwing()` for non-gun weapons, including thrown weapons. Use that normalized swing clock to produce draw-back, spot, release-open, and recovery phases. No server state or ranged-aim envelope is needed.
- **Tomes:** use the accepted attack beat/page event already routed through `setAttackBeat()` and `prepareTomeVisual()`. The off hand traces during anticipation, taps at the page event, casts during active, and settles with the current tome page/close timing.
- **Close blades:** when `sampleCloseBladePose()` reports its committed lunge/attack blend, reduce the generic pose sample to zero for owned hands/body/feet. Its existing forward ward and support guard remain the source of truth.
- **Two-handed melee:** the descriptor supplies stance and pre-attack anticipation. During active motion, existing front/rear grip targets and the late `attackHandSpacing` constraint own both hands.
- **Dual wield:** sample the base family for each hand, then assign “striking” and “supporting” roles from `routeSwingChannels()`. On alternating beats the non-striking hand performs the guard/counterweight job; on Crossfall both hands transition together and no free-hand target is applied.
- **Beams:** overlay charging focus, active brace, overheat breakaway, and cooling recovery on the base ranged family. The base descriptor remains responsible for the stance.

## State transitions without a new state machine

| Transition | Existing signal | Pose response |
|---|---|---|
| Idle → move | eased `gait` / movement amount in `animate()` | Blend from the idle anchor to `moveTighten`; keep the hand's family job while reducing reach. |
| Move → idle | same eased gait, approximately the existing 125 ms response | Let the spring reopen the silhouette; do not snap to the idle target. |
| Idle/move → gun aim | existing 90 ms ranged raise | Firing hand follows the existing stance; free hand anticipates or braces over the same envelope. |
| Gun shot → recovery | recoil plus 250 ms linger and 180 ms settle | Apply one counter-impulse, hold the family job through linger, then spring home. |
| Idle/move → melee attack | current combo/swing time and `actionOwnershipAt()` | Use early unowned time for anticipation; fade the family target wherever attack ownership rises. |
| Melee attack → combo | current combo beat selection | The prior recovery becomes the next anticipation; authored-dual parity selects the new support hand. |
| Melee attack → idle | current 120 ms combo hold/release behavior | Restore the family equilibrium underneath the ownership fade, so release has no pop. |
| Tome beat → page/cast | existing page scheduling state | Align the trace/tap/cast hand beat with the visible page event. |
| Beam phase change | optional client `beamPhase` field | Charge narrows, active braces, overheat breaks the free hand away, cooling settles. |
| Weapon swap | `equipWeapon()` / `equipLoadout()` | Refresh descriptor references and use existing reset/rebase paths; never retain the previous weapon's guard. |

For the optional beam overlay only, add `beamPhase?: BeamPhaseValue` to `RigAnim` and populate it in `ArenaScene` from the beam state already present at the `SpriteRig.animate()` call site. This is client-local presentation data. If that one-field plumbing is considered too broad for the first implementation wave, ship charging/active bracing from `fireHeld` and defer only the overheat breakaway.

## Spring-channel mapping

| Authored signal | Existing channel | How to apply it |
|---|---|---|
| Free-hand placement | hand loop target `ax` / `ay` | Add aim-relative family equilibrium before attack/brace targets. Keep `own = 0`. |
| Free-hand micro-motion | same `ax` / `ay` equilibrium | Add bounded offsets; do not add velocity directly every frame. |
| Recoil catch / attack release beat | hand jiggle impulse/velocity path already used for recoil and swings | Apply one phase-edge impulse, not continuous force. Clamp with existing caps. |
| Weapon-hand placement | existing firing or swing/grip targets | Descriptor only supplies idle anticipation where no higher-priority target is active. |
| Body lean/turn | current body position/rotation composition in `animate()` | Add a low-amplitude base bias before action-specific body motion. |
| Foot stance | normal foot targets before attack foot blend | Add forward/lateral stance offsets; keep gait and springs active. |
| Planted/kicking feet | `attackFrontFoot*` / `attackBackFoot*` and ownership | Existing attack sample overrides the descriptor. |
| Hard two-hand/signature pose | `attackFrontGrip*`, `attackBackGrip*`, late constraint, `syncOwnedJigglePart()` | No change. These remain final. |

The useful distinction is equilibrium versus impulse. Idle breathing, page tracing, trail-hand counterweight, and move tightening are equilibrium changes. A shot kick, hammer catch, thrown release, or tome page tap may add one small impulse at a phase boundary. Continuous velocity injection would make the mittens buzz and would fight the existing damping.

## LOD and reduced motion

Use the rig's existing visibility decisions; do not introduce a second distance system.

| Mode | Static placement | Micro-motion | Springs |
|---|---|---|---|
| Self / in paper view | Full | Full bounded amplitude | Existing full simulation |
| Remote / in paper view | Full | Full or one shared sine component | Existing full simulation |
| Outside `JIGGLE_LOD_MARGIN_PX` | Keep the family target for rebase/readability | Off | Existing suppress/rebase behavior |
| Reduced motion | Full | Off | Existing springs, without authored periodic offsets |

LOD must never make the free hand fall back to the old limp rest location. When simulation is suppressed, rebase it to the current static family target. The action silhouette remains semantically correct; only secondary motion disappears.

## Exact file plan

Required implementation files for the later wave:

- `packages/client/src/sprites/pose-language.ts` — descriptor table, classification, allocation-free sampler.
- `packages/client/src/sprites/pose-language.test.ts` — pure classification, bounds, mirroring, transition, and reduced-motion tests.
- `packages/client/src/entities/SpriteRig.ts` — cache specs, sample them, and compose them into existing body/hand/foot targets.

Append-only integration assertions:

- `packages/client/src/sprites/firing-stance.test.ts`
- `packages/client/src/entities/SpriteRig.ranged.test.ts`
- `packages/client/src/entities/SpriteRig.premade-duals.test.ts`
- `packages/client/src/sprites/close-blade-pose.test.ts`

Optional only for the full beam overheat beat:

- the existing `RigAnim` declaration in `SpriteRig.ts`
- the `SpriteRig.animate()` call in `packages/client/src/scenes/ArenaScene.ts`

No changes should be needed in `packages/shared`, weapon definitions, combat simulation, network messages, or server code.

## Append-only test shapes

Keep all current tests and assertions. Add new `describe`/`it` blocks; do not rewrite existing firing, lunge, or Crossfall expectations to accommodate the pose layer.

### `pose-language.test.ts`

- Table-test every concrete family/mechanism combination currently present in the shared weapon catalog. Every entry must resolve to a named pose family and no current weapon may reach an accidental fallback.
- Explicitly cover mixed-tag cases where delivery or grip must beat a misleading family tag.
- Assert every descriptor value is finite, blends remain in `[0, 1]`, and normalized anchors remain inside agreed body-relative bounds.
- Assert left/right aim mirroring changes only the derived world axes, not the authored forward/lateral meaning.
- Assert move tightening preserves the off-hand verb and does not cross the body center unexpectedly.
- Assert `reducedMotion` zeroes periodic displacement while preserving static hand, body, and foot targets.
- Assert sampling reuses the caller-provided output object.
- Assert beam and dual overlays do not change the base family classification.

### `firing-stance.test.ts`

- Append assertions that each aimed family retains its existing firing-hand target band and face-line cap when an off-hand pose is present.
- Confirm thrown weapons remain outside `usesAimedFiringStance()`.
- Confirm a fist-gun still obeys its current chest cap; the new guard must not move the firing mitten upward into the face.

### `SpriteRig.ranged.test.ts`

- Append an idle → raise → shot → linger → settle sampling sequence. The firing hand must match its current envelope while the free hand remains a guard/support hand throughout.
- Verify the recoil-catch impulse occurs once at the shot edge and decays, rather than being reinjected every frame.
- If `beamPhase` ships, verify charging, active, overheated, and cooling preserve the base weapon's muzzle direction and only alter the support/body overlay.

### `close-blade-pose.test.ts`

- Append assertions that generic family blends go to zero as `sampleCloseBladePose()` takes ownership.
- Re-run the current reach, body advance, foot plant/kick, and release-identity expectations with a nonzero idle pose underneath; results must be unchanged during committed action.

### `SpriteRig.premade-duals.test.ts`

- Append lead/off/lead/off samples proving the non-striking hand receives the guard/counterweight role.
- Assert per-hand family parity for mixed compatible pairs.
- Assert the Crossfall “both” beat gives both hands to the existing attack channels and applies no free-hand target.

## Smallest-diff rollout

1. Land the descriptor/classifier, pure sampler, and catalog coverage tests.
2. Compose static idle/move off-hand placement into `SpriteRig`; verify weapon swaps, mirroring, LOD rebase, and reduced motion.
3. Add body and foot biases, still underneath existing action ownership.
4. Add phase-edge personality beats for pistol, thrown, tome, and one-hand melee recovery.
5. Add the optional explicit beam-phase field only if the owner wants the overheat breakaway in the first pose release.

Each step should remain visually and mechanically reviewable. No step should change attack acceptance, combo selection, hit timing, projectile direction, weapon mount direction, or the current firing-stance numbers.

## Review gates

Before implementation is accepted, capture the same character aiming in eight compass directions for each base pose family at idle, move, active, and recovery. The review should check:

- weapon-forward law and existing gun face-line limits;
- a distinct, visible job for every non-owned hand;
- no snap when attack ownership rises or falls;
- unchanged close-blade reach and authored-dual Crossfall geometry;
- stable two-handed spacing;
- no hand/foot buzzing at rest;
- static silhouette retention under reduced motion and outside full jiggle LOD.

The three owner decisions that can alter constants—not architecture—remain in `pose-language.md`: pistol chest fist versus a brief support clasp, duelist-wing versus chest-guard one-hand blades, and whether `tags.grip` or current `twoHanded`/art behavior is authoritative when they disagree.
