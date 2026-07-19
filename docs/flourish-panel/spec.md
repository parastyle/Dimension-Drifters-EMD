# Weapon Flourishes: implementation specification

## Scope and non-scope

This is a client-presentation layer built from the shipped pose-language idiom. It samples frozen descriptor
data, writes only render targets the paper rig already owns, and hands those targets back to the existing
springs. It does not create a gameplay action, animation queue, Phaser tween chain, new combat clock, new
root motion, or new weapon-facing rule during attacks.

Production edits are restricted to:

- `packages/client/src/sprites/pose-language.ts` - descriptor/classification extensions and pure samplers;
- `packages/client/src/entities/SpriteRig.ts` - retained flourish state, outgoing stow proxies, trigger/cancel
  edges, composition, and spring handoff;
- `packages/client/src/sprites/firing-stance.ts` only if a public existing-family helper is needed; none of
  the canonical firing bands or `90/250/180 ms` raise/linger/settle constants may change;
- the weapon-identity-change region of `packages/client/src/scenes/ArenaScene.ts`, specifically the existing
  `equipWeapons()` convergence point. Do not edit input routing, `sendAttack()`, combat presentation, belt
  selection helpers, or any other scene region.

Tests may be added or appended, but production code outside those seams is out of scope. No edit is needed
in shared combat, network schemas, `weapons.ts`, generated weapon data, VFX, or server code for the flourish
wave. The parallel katana/size-data wave supplies the richer field described below.

## Priority law

From strongest to weakest, final render ownership is:

1. down/death, whole-rig ultimate/boss presentation, scene cut, and LOD rebase;
2. brace/parry, new attack/fire/cast/throw, close-blade absolute pose, signature/orbit, two-hand hard grip,
   Crossfall, and ranged muzzle truth;
3. incoming draw;
4. earned after-attack flourish;
5. idle-settle;
6. size-class stance and base family pose;
7. gait, inertia excitation, authored micro-motion, and springs.

An outgoing stow proxy is independent display residue, not a hand owner. Any priority-1 or priority-2 event
destroys it. Stow never competes with the incoming weapon for a real mitten.

## Descriptor extension

Extend `pose-language.ts`; do not make a parallel classifier module. The types below name the required
semantic surface, not mandatory private field names.

```ts
export type FlourishMoment = "draw" | "stow" | "after-attack" | "idle-settle";
export type FlourishPhase = "anticipation" | "statement" | "catch";
export type BladeSizeClass = "short" | "standard" | "great" | "colossal";

export interface FlourishTiming {
  readonly durationMs: number;
  /** Milliseconds from start; statement begins here. */
  readonly statementAtMs: number;
  /** Milliseconds from start; catch/retraction begins here. */
  readonly catchAtMs: number;
}

export interface FlourishBeatSpec {
  readonly timing: FlourishTiming;
  /** Signed semantic rotation; sampler must expose an unwrapped monotonic value. */
  readonly rotationRad: number;
  readonly overshootRad: number;
  readonly handForward: number;
  readonly handLateral: number;
  readonly bodyForward: number;
  readonly bodyLateral: number;
  readonly bodyTurn: number;
  readonly footForward: number;
  readonly footLateral: number;
  readonly paperHop: number;
  readonly headForwardPx: number;
  readonly headLateralPx: number;
}

export interface WeaponFlourishSpec {
  readonly family: WeaponPoseFamily;
  readonly draw: FlourishBeatSpec;
  readonly stow: FlourishBeatSpec;
  readonly afterAttack: FlourishBeatSpec;
  readonly idleSettle?: FlourishBeatSpec;
  readonly streakThreshold: number;
}

export const WEAPON_FLOURISH_SPECS:
  Readonly<Record<WeaponPoseFamily, WeaponFlourishSpec>>;

export function weaponFlourishSpecFor(def: WeaponDef): WeaponFlourishSpec;
export function bladeSizeClassFor(def: WeaponDef): BladeSizeClass;
```

Reuse `weaponPoseFamilyFor()` and, for ranged refinements, `firingStanceFamilyFor()`. Delivery still beats
painted family; beam and dual remain overlays; per-hand mixed-pair resolution remains mandatory. Freeze all
table roots and nested timing/beat objects. Resolver calls occur on equip, not each frame.

### Default duration table

These are descriptor defaults, not ranges. Variants may differ by at most `20 ms` without a new design
review and may never exceed the vision ceilings.

| Family | Draw | Stow | After | Idle | Ranged/cast streak threshold |
| --- | ---: | ---: | ---: | ---: | ---: |
| one-hand-blade | 300 | 155 | 360 | 220 | - |
| close-blade | 235 | 135 | 290 | 190 | - |
| one-hand-blunt | 325 | 170 | 330 | 230 | - |
| fists | 210 | 120 | 250 | 180 | - |
| pistol | 270 | 145 | 340 | 210 | 3 per hand |
| fist-gun | 240 | 135 | 290 | 200 | 4 per hand |
| long-gun | 335 | 180 | 315 | 250 | see ranged refinement |
| thrown | 255 | 140 | 350 | 220 | 1 accepted throw |
| focus | 280 | 150 | 320 | 240 | 3 accepted casts |
| tome | 350 | 175 | 320 | 250 | 3 accepted casts |
| two-hand-sword | 360 | 190 | 440 | 290 | - |
| two-hand-heavy | 395 | 195 | 420 | 280 | - |
| polearm | 350 | 180 | 395 | 250 | - |

Two-hand-sword draw is size-adjusted after lookup: `short 320`, `standard 350`, `great 390`, `colossal
420 ms`. Its after-attack duration is `short 380`, `standard 420`, `great 460`, `colossal 480 ms`.

For `long-gun`, refine the streak threshold with the existing firing family: long gun `2`, rapid gun `5`,
scattergun `1`, launcher `1`. This threshold counts accepted edges per semantic firing hand. A beam ignores
shot streaks and becomes eligible once on clean channel end or overheat release; its after beat remains the
base family's non-rotational support catch.

### Phase cuts

Author each default with these integer cuts:

- anticipation ends at `max(40 ms, round(durationMs * 0.15))`;
- statement ends / catch begins at `round(durationMs * 0.74)`;
- catch owns exact placement until `round(durationMs * 0.82)`;
- ownership then fades only while the target retracts, reaching zero at `durationMs`.

Tome draw uses `70/250/350 ms`; tome after uses `55/235/320 ms`. Pistol after uses `50/255/340 ms`.
Great/colossal 2H sword after uses `70 ms` anticipation and begins catch at `76%` so the large circle keeps a
single uninterrupted middle statement. Stow may use only anticipation + statement; its proxy is destroyed
at duration and never springs home.

## Allocation-free sampler

Follow `createPoseLanguageInput()` / `createPoseLanguageSample()` / `samplePoseLanguage()` exactly: one
preallocated input and output per live channel, mutation into caller-owned output, no arrays/objects in
`animate()`.

Required input state:

```ts
export interface FlourishInput {
  spec: FlourishBeatSpec;
  moment: FlourishMoment;
  elapsedMs: number;
  aimLocal: number;
  hand: 0 | 1;
  reducedMotion: boolean;
  rotationSign: -1 | 1;
}
```

Required output channels:

- `active`, phase, normalized phase time, and ownership;
- unwrapped semantic weapon rotation plus catch overshoot;
- aim-relative hand target, body translation/turn, and foot target;
- paper-only lift/hop;
- floating-head authored X/Y offset;
- an outgoing-proxy position/rotation/alpha sample for stow;
- `settleOnly` for reduced motion.

The main rotational statement must be monotonic in its unwrapped angle. Do not derive the curve from a
periodic sine. Use a one-way eased angle, then a separately signed overshoot/retract during catch. The sample
at the exact phase boundaries must be continuous in position and angle. `elapsedMs < 0` and
`elapsedMs >= durationMs` return inactive/final without leaving stale values in the output object.

### Full-motion curves

- Anticipation: cubic/smootherstep into the counterpose; rotation is at most `8%` of total.
- Statement: monotonic ease-in/ease-out across the authored arc. Its derivative may crest once but may not
  reach zero before catch.
- Catch: overshoot once, retract once. No bounce function, yoyo, repeat, or second sinusoidal wobble.
- Body begins `20-35 ms` after the hand and settles `30-60 ms` after the weapon catch through the existing
  spring/pose composition, not a delayed timer.
- Head target begins `25-45 ms` after the weapon's silhouette change and is supplied through
  `FloatingHeadSpringInput.authoredOffsetX/Y`. Clamp authored magnitude to `3.5 px`.

### Reduced-motion sample

When `reducedMotion` is true:

- force weapon rotation, overshoot, paper hop, dust, and head authored offsets to zero;
- use a direct family placement of `100-140 ms` for draw, `80-110 ms` proxy translation/fade for stow, and
  `120-160 ms` return-to-home for after-attack;
- omit idle-settle completely;
- keep static hand jobs, size stance, body relaxation, and ordinary reduced head spring.

Reduced motion is a distinct sample path, not `durationMs = 0`. The player must see the weapon and body
arrive at the correct semantic endpoint.

## Size-class resolver and stance table

The expected canonical field from the parallel wave is:

```ts
WeaponDef.tags.sizeClass?: "short" | "standard" | "great" | "colossal";
```

Resolution order:

1. `tags.sizeClass` when present;
2. temporary migration truth `def.id === "driftblade" -> "great"`;
3. current `tags.size`: `S -> short`, `M -> standard`, `L -> great`, `XL -> colossal`.

Never classify from name, `range`, `displayLength`, art bounds, cooldown, or damage. Tests may use
`displayLength` to flag suspicious data, but it is not a runtime branch. Delete the Driftblade id override
when its emitted `tags.sizeClass: "great"` lands.

Add a frozen `BLADE_SIZE_STANCES` table beside the pose specs. Required normalized design targets:

| Class | Rest angle from aim | Grip/body targets | Feet and movement |
| --- | --- | --- | --- |
| short | forward `-0.70..-0.44 rad` toward raised weapon side | high compact grip; body turn `0.02..0.04 rad` | narrow split; angular movement trail `5..8 deg` |
| standard | forward `-0.38..-0.14 rad` | mid grip; body turn `0.04..0.06 rad` | balanced split; trail `8..12 deg` |
| great | rear `+2.62..+2.88 rad` | low grip; 2H spacing `0.38H..0.46H`; body lean `0.06..0.09 rad` | rear plant; movement-relative trail `8..14 deg`; optional dust |
| colossal | rear `+2.88..+3.11 rad` | hip grip; widest truthful spacing; body forward up to `0.04H` | rear foot `-0.12H`; trail `12..18 deg`; visually short stride |

Use the sign convention already selected for semantic weapon-side mirroring. The table stores unsigned
intent where possible; the resolver applies hand side. Great/colossal neutral carry may bias toward reverse
movement direction once gait exceeds `0.2`, then blend back toward reverse aim as gait settles. Aim changes
alone must not whip a dragged blade around the body; cap the neutral target's visual angular follow. An
attack, brace, swap, or other stronger owner bypasses that cap and takes exact ownership immediately.

The rear carry is neutral-presentation-only. `forwardMeleeReadyAngle()` remains the target for action
anticipation/recovery, and every current combat descriptor remains untouched. The transition from rear carry
to the authored load happens inside the existing accepted action window; there is no preliminary raise.

Optional drag dust is non-gating. If implemented from an already available SpriteRig-local particle helper,
emit by traveled distance (`18-28 px` spacing), only for great/colossal blades above `0.35` gait, near the
derived business tip, in full motion and full LOD. Do not edit ArenaScene or VFX modules to add it in this
wave.

## `SpriteRig` retained state

Keep fixed scalar/object state allocated with the rig:

- cached lead/off flourish specs and cached blade size class;
- active moment, start epoch, semantic hand/mask, rotation sign, and active/armed booleans;
- per-hand accepted streak count, last accepted edge, and last weapon id;
- terminal-melee flourish arm epoch and earliest-start epoch;
- idle-settle eligible epoch, last-played epoch, and one deterministic per-rig offset;
- at most two outgoing stow proxy records, one per old equipped hand;
- preallocated input/output samples for lead, off, and outgoing proxy;
- one cancel generation/edge so repeated calls are idempotent.

No timers, tweens, promises, per-frame allocations, or random calls. Use the same freeze-aware presentation
clock as swings and tome pages. A clock cut, first frame, LOD wake, scale change, down/death, unequip, and rig
destroy clear active/armed state and stow proxies.

### Start and cancel API behavior

Private method names are flexible; behavior is not:

- `startDraw(...)` may replace after-attack or idle-settle immediately.
- `startStowProxy(...)` snapshots old texture/frame, semantic rotation, origin, scale, and current root-local
  transform before old held images are destroyed. It never retains gameplay `WeaponDef` ownership.
- `cancelFlourish(reason)` is idempotent and clears active draw/after/idle plus outgoing proxies before the
  stronger owner samples. It does not reset the entire jiggle system during ordinary combat cancellation.
- `armAfterAttack(...)` records eligibility only; it does not start until the quiet gate passes.
- another accepted/input attack while armed discards the arm before starting the new action.

Any method that already denotes a stronger action - `triggerSwing`, an advancing `setAttackBeat`, brace,
down/death, ultimate entry, `unequip`, and a new equip edge - cancels first. In `animate()`, movement onset or
a hard direction change after flourish start, dash/slide/jump stance, active aim/fire hold, and LOD
suppression cancel before flourish sampling. A steady gait that predates draw may continue underneath draw;
do not cancel it every frame merely because speed is nonzero.

This provides all cancellation without editing ArenaScene input or attack paths.

## Draw/stow swap hook

All Q/E belt cycling, `1/2/3` selection, bag click swaps, and compatibility `cycleWeapon` flows converge on
the authoritative `player.weapon` change observed by `ArenaScene.equipWeapons()`. That observed identity edge
is the only scene hook.

Required sequence on a real old-id -> new-id change:

1. Before `equipWeapon()` / `equipLoadout()` destroys old images, tell the rig to snapshot and start outgoing
   stow for the old lead/off pieces.
2. Attach the new weapon through the existing equip path and start incoming draw with the same presentation
   epoch. Draw is not scheduled after stow.
3. Update identity bookkeeping so per-frame lazy-art retries cannot restart stow or draw. The transition key
   is at least `(oldLoadoutKey, newWeaponId)` and must be idempotent.
4. If new art is not ready, play stow once, use the existing empty-hands fallback, and start draw exactly
   once when the art becomes attachable. Do not replay stow on each retry.
5. Initial scene construction/spawn and same-id re-equip do not play a swap flourish; the existing paper-pop
   owns spawn. Remote observed swaps use the same rule.

The existing `samplePairCeremony()` must not stack with dual draw. Fold its useful sequential paper-flip/X
idea into the dual draw descriptor or suppress it while draw is active. It must acquire the same cancellation
law and duration ceiling.

## After-attack eligibility

### Melee, thrown, and combo families

Use accepted/predicted descriptor truth already present in `triggerSwing()`:

- ordinary melee arms only when `comboStep === sequence.length - 1` for the active
  `meleeComboSequenceFor()` result;
- the implementation must consume sequence length, not hard-code `2` or `5`; this covers three-step base
  families, a six-beat Driftblade branch bar, and future authored bars;
- paired melee arms only when `pairStep === DUAL_MELEE_PAIR_BAR.length - 1`, after Crossfall's action
  ownership releases;
- thrown arms on each accepted throw because its release/catch is its one-beat sequence;
- close-blade finishers do not start a flourish until `sampleCloseBladePose()` has released all committed
  hand/body/foot ownership.

Set `earliestStart = swingStart + poseSeconds * 1000 + 90 ms`. If another intent/accepted edge occurs before
that epoch, discard eligibility. Combo grace/held guard may remain visible underneath; the after flourish
starts only when action ownership is zero. Never infer terminality from a timer expiring: an abandoned
non-terminal combo earns nothing.

### Guns and casters

`setAttackBeat()` is the common accepted/predicted edge and already has wrap-safe sequence handling. On an
actual forward sequence advance:

1. cancel an active or armed flourish;
2. resolve the semantic firing hand with existing dual parity;
3. if weapon id and hand match the retained streak and the gap is within the streak window, increment;
   otherwise reset that hand to `1`;
4. arm that hand on reaching its descriptor threshold; do not reset it until the flourish plays, the streak
   expires, weapon changes, or a different incompatible action occurs.

The streak gap is:

```text
clamp(effectiveCooldown * 2.2 * 1000, 320 ms, 850 ms)
```

For melee, `effectiveCooldown` is already present on the swing descriptor. For guns/casters, use the held
delivery cadence available in the rig (`def.gun?.fireRate ?? def.cooldown`); the `2.2x` window deliberately
tolerates ordinary affix and snapshot variance without requiring new ArenaScene plumbing.

For a matched dual pistol pair, thresholds are per hand: six alternating accepted shots earn both hands'
three-count twirls. On lull, the semantic next-lead hand performs first and the other begins `55 ms` later.
If only one hand reached threshold, only that hand twirls. Mixed aimed pairs retain separate family
thresholds and verbs.

Ranged/cast after-attack starts only when all are true:

- the relevant accepted recoil/action owner has ended (`>=140 ms` after a gun edge, or current page/cast
  owner is zero);
- `fireHeld`/channel/charge is false;
- at least `90 ms` of quiet has passed since action ownership ended;
- no movement/action/swap cancel occurred;
- rig is visible inside the existing paper-view LOD.

Tome Last Word must finish before the existing idle-close deadline where possible; it uses the current page
scheduler and never starts a second page timer. Beam channel end/overheat can arm only one catch and resets on
renewed charge.

## Idle-settle gate

Idle-settle is optional per descriptor and uses no random loop:

- eligible after `1600 ms + deterministicRigOffset`, where offset is `0..700 ms` fixed at rig creation;
- requires gait/movement below `0.12`, no aim/fire/charge/channel, no attack/brace/combo grace, no draw/stow,
  full LOD, and full motion;
- at most once per held loadout per `6500 ms`;
- any actionable input cancels and resets eligibility from that input epoch;
- never bank or replay an offscreen or reduced-motion idle beat.

The endpoint is always the current size/family stance. An idle-settle cannot become the character's new
rest pose and cannot oscillate indefinitely.

## Composition in `SpriteRig.animate()`

Keep the existing attack and family order; add the smallest new seams:

1. Derive cancel intent from current `RigAnim`/move stance before sampling flourishes.
2. Sample base family and size stance as the resting equilibrium.
3. Run existing melee/ranged/tome/beam action sampling unchanged.
4. If no stronger owner is active, sample draw, after-attack, or idle-settle and apply its body/foot/hand
   targets above the family equilibrium.
5. Apply existing aimed firing targets, swing offsets, close-blade targets, brace, signature grips, and
   two-hand late constraints after any lower flourish proposal. A bug in cancellation must therefore still
   fail safe toward combat truth.
6. For exact flourish-owned hands call the existing owned synchronization path. In catch, retract first,
   then lower ownership and let `stepJigglePart()` inherit terminal velocity under the shipped
   `JIGGLE_HANDOFF_MAX_V` cap.
7. Add flourish head X/Y only to the existing floating-head spring authored offset. Do not move or rotate
   the baked head directly; do not create a second spring. Reduced motion supplies zero authored offset.
8. Sample outgoing stow proxies after held weapon placement but before final art-geometry correction/render
   stacking. They use captured art geometry and cannot become a muzzle, hit source, or hand anchor.

Weapon sprite mounting remains hand-first for the incoming held item. Flourish weapon rotation is semantic
rotation before `applyWeaponArtGeometry()`, so painted corrective angles still apply exactly once.

## Dual parity details

- Reuse `DUAL_MELEE_PAIR_BAR`, `dualHandForSeq`, `routeSwingChannels()`, and `poseSupportHandFor()`; do not
  create a screen-left/right parity path.
- Default order is next semantic lead, then off at `+55 ms` for draw/after; stow is off, then lead at
  `+45 ms`.
- Each hand samples its own `weaponFlourishSpecFor(def)`. The shared body sample uses the stronger body
  weight but clamps to the global body bounds.
- A mixed blade+pistol pair may show a lead blade circle followed by an off pistol twirl only if both earned
  their own thresholds. One hand's eligibility never fabricates the other's.
- Crossfall owns both hands during combat and remains unchanged. Its after beat alternates once ownership is
  zero; no simultaneous flourish rotation.
- Hard 2H geometry is not a dual pair. Both hands are one implement and sample one 2H beat.

## Reset and lifecycle law

Clear flourish activity, arms, counters, proxies, and idle eligibility on:

- loadout identity change after the outgoing snapshot has been taken;
- `unequip`, drop/salvage, down/death, revival reset, scene shutdown, and rig destroy;
- clock reversal/cut, large dt rebase, teleport/root cut, and LOD sleep;
- change of weapon id for a retained per-hand streak;
- reduced-motion mode changing while an active full-motion flourish is in progress (convert directly to the
  reduced settle; never continue rotation).

Do not call `resetSecondaryMotion()` for every flourish completion; ordinary catch must preserve the spring
handoff. Use the full reset only at the lifecycle seams that already use it.

## Test shapes

All tests are append-only. Do not loosen existing pose, firing, close-blade, combo, or dual assertions.

### Pure descriptor/sampler tests

Add `flourish` blocks to `pose-language.test.ts` or a sibling pure test file:

- every current weapon resolves to one flourish family and one blade size result where applicable;
- current `tags.size` fallback maps exactly, and Driftblade resolves to `great` even while its current tag is
  `XL`; explicit `tags.sizeClass` wins when supplied by a fixture;
- all nested descriptors are frozen; all numbers are finite and within full-body bounds;
- sample reuses caller output, clears inactive outputs, and is continuous at phase cuts;
- unwrapped statement angle is monotonic, total rotation is no more than one revolution, and catch has one
  `8-18 degree` overshoot;
- duration ceilings hold for every family and size class;
- reduced motion produces zero rotation/hop/head offset and preserves a nonzero endpoint settle;
- aim mirroring and semantic hand parity do not change authored forward/lateral meaning.

### Spring/cancel integration

Append a focused `SpriteRig` test block:

- sample each active flourish at `1 ms` before and after action/move/brace cancel; active ownership is gone
  before the stronger action's sample and no lockout is observable;
- complete a full catch and assert the target is within `0.03H`/`0.18 rad` before ownership falls, with
  handoff velocity bounded by the existing cap;
- assert no continuous impulse or residual buzz over the next `500 ms`;
- clock cut, root snap, LOD sleep/wake, down/death, and reduced-motion toggle leave no proxy or banked beat.

### Swap flow

At the `ArenaScene.equipWeapons()` seam with a fake rig:

- one authoritative old -> new identity edge calls stow snapshot and draw start once with the same epoch;
- repeated lazy-art polling does not restart either beat;
- incoming attach/draw does not wait for stow completion;
- old proxy is gone by `200 ms`, on combat cancel, and on LOD sleep;
- initial spawn and same-id refresh do not flourish;
- Q/E, `1/2/3`, bag swap, and compatibility cycle still need no separate animation hook because they all
  converge on the observed identity edge.

### Ranged and tome

Append to `SpriteRig.ranged.test.ts`:

- two pistol edges do not arm; the third accepted edge per hand arms; a new edge inside the `90 ms` quiet
  gate discards the pending twirl;
- matched dual pistols require three edges per hand and sample next-lead/off at a `55 ms` offset;
- rapid, long, scatter, and launcher thresholds use `firingStanceFamilyFor()` without changing firing hand
  target bands, face line, fist-gun chest cap, recoil, or `90/250/180 ms` envelope;
- tome trace/page/cast ownership completes before Last Word and the existing page/close scheduler remains the
  only page clock;
- active beam/charge suppresses flourish; one channel-end catch arms and renewed charge cancels it.

### Melee and dual

Append to the combo/dual tests:

- non-terminal sequence steps never arm, even if the combo expires;
- `sequence.length - 1` arms for three-step and six-step fixtures without a hard-coded index;
- the terminal dual pair bar beat arms only after Crossfall releases both hands;
- lead/off route remains exact and mixed pairs retain per-hand family samples;
- great Driftblade idle/move points behind, but the first input frame uses the unchanged accepted attack
  owner and existing descriptor timing;
- hard 2H flourish samples never detach the rear hand from the haft.

## Review capture matrix

Capture self and remote rigs at four cardinal aims plus two diagonals, VFX off, normal and 50% screenshot
scale:

- one representative of all thirteen base pose families;
- short, standard, great Driftblade, and colossal blade stance at idle, move, draw, terminal after, and
  cancel-to-attack;
- single pistol at shot 2, shot 3 armed, quiet-gate twirl, and cancel;
- matched dual pistols and mixed dual blade+pistol;
- tome draw/Last Word and thrown catch;
- full motion, reduced motion, and LOD sleep/wake.

Grade the result against the twelve bars in `vision.md`. A mechanically correct sampler does not pass if the
arc looks timid, the body looks dead, the head does not react, two weapons become a synchronized wheel, or
Driftblade still reads like a raised small sword.
