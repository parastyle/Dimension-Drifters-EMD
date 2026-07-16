# Big-sword combos: technical implementation panel

## Recommendation

Ship this as a Stage-1 visual expansion built on the existing combo clock, not as a melee-balance change. Make combo selection explicit for the intended swords and poleblades, resolve the visual step from the synced `attackSeq`, and keep the server's one centered sweep unchanged. The current `MeleeComboStep` schema and `SpriteRig` channels can express the requested animations; new motion/variant union members are needed, but new numeric pose fields are not.

Do not activate `path.damageMultiplier`, `rangeMultiplier`, `arcMultiplier`, `deltaAngle`, or `knockback` in this pass. Exact signed paths, finisher damage, step-specific quake timing, cadence resets, and prediction correction all require the later accepted-action/accepted-combo protocol.

## Which “long katana” is actually being praised

The code-grounded match is **`driftblade` / Driftblade**, not the weapon whose id literally contains `katana`.

- `packages/shared/src/weapons.ts` calls Driftblade the “really long sword” and a Masamune-homage nodachi. It is 2H, size `XL`, `displayLength: 320`, `gripFrac: 0.05`, and has weapon-data family `sword`.
- `x-sword-neon-katana` / Voltedge is the tempting false match, but its data is 1H, size `M`, and only 125 px long. It plays the `arc`/`hero-spin` sequence: forehand, reverse backhand, charged hero spin. That is also a good combo, but it is not the long sword described by the data.

Driftblade has no authored `swingStyle`, `comboFamily`, or `comboVariant`. Resolution therefore happens through shared fallbacks:

1. `swingStyleFor()` returns `orbit` because the weapon is two-handed.
2. `meleeComboSelectionFor()` matches the special rule `family === "sword" && size === "XL"` and selects combo family `chop`, variant `greatsword`.
3. `MELEE_COMBO_VARIANT_SEQUENCES.greatsword` is not a separate root in `MELEE_COMBO_SEQUENCES`; it composes:
   - `MELEE_COMBO_SEQUENCES.chop[0]`: **shoulder chop**;
   - `POMMEL_BASH_COMBO_STEP`: **pommel bash**;
   - `TRUE_CHARGED_SLAM_COMBO_STEP`: **true charged step-slash**.
4. In `SpriteRig.animate()`, the live `comboPose` overrides the resolved `orbit` pose style with combo family `chop`. Step 1 uses the chop branch; steps 2 and 3 dispatch to `applyPommelBash()` and `applyTrueChargedSlam()`. The ordinary waist-orbit renderer is therefore not what the player is praising during this combo.

That distinction should be locked in tests. A future cleanup of the broad two-handed `orbit` fallback must not silently remove Driftblade's `greatsword` selection.

## Why it feels cool

The result is primarily **step contrast plus continuity**, with the very long blade magnifying both.

### 1. Every beat has a different action verb

This is not three differently signed copies of one slash.

- Step 1 is a broad shoulder-led cut. It coils until normalized `t=.24`, accelerates quadratically into contact at `.52`, compresses the torso, and settles into a low guard.
- Step 2 abruptly shortens the silhouette. `applyPommelBash()` reverses the weapon so the hilt leads, closes the hands from `0.42H` to `0.24H`, strikes over `.12-.30`, then spends `.44-1.0` loading the next overhead. The quick, close beat makes the following long release feel larger.
- Step 3 is a charge, step, fall, contact, and planted recovery. `applyTrueChargedSlam()` draws the weapon behind the body, foreshortens it to 22% length as it turns edge-on, advances the paper art, restores full length into a quadratic fall, compresses at contact, and holds the blade planted before hauling it out.

The contrast is `wide -> compact -> enormous`, not merely `left -> right -> left`.

### 2. The silhouettes are authored for a paper rig

The combo uses the rig's strongest fake-depth channels: weapon-length foreshortening, front/back depth changes, torso squash/stretch, visible-art translation without root displacement, hand-spacing changes, and a grounded shadow that stretches and compresses. On a 320 px Driftblade, the edge-on-to-full-profile transition is exceptionally legible. The same code on a short weapon would lose much of that payoff.

The finisher also keeps the tip, hands, torso, and shadow moving at different rates. That produces an ordered read—weapon loads, body steps, blade falls, torso arrives—rather than a single sprite rotation.

### 3. The cadence preserves anticipation and the next guard

For an unaffixed Driftblade:

- effective cooldown = `0.62s`;
- non-spin pose = `0.62 * SWING_WINDOW_FRAC(0.64) = 0.3968s`;
- step-2 hilt impact is about `111ms` into its pose;
- step-3 charge lasts to about `183ms`, visible contact is about `242ms`, and the planted follow-through lasts to about `317ms`.

The pose does not snap to idle at 397 ms. `comboHoldPose` holds its `t=1` exit guard through the accepted/predicted ready time plus `comboGraceMs()`. At base speed, that expiry is approximately `620 + 217 = 837ms` after the start, so a legal next attack at 620 ms begins from the authored guard. If the chain lapses, all additive channels blend to idle over `COMBO_HOLD_RELEASE_MS` (120 ms).

This held-guard bridge is as important as the individual poses. It makes the three attacks read as one phrase.

### 4. Curves create weight without slowing input

The hilt punch uses cubic-out motion; the finisher's falling cut uses `p*p`; raises and recoveries use smoothstep variants. The move can therefore reserve much of its short 0.3968 s pose for loading, then spend only about 60 ms on the visibly powered part of the final cut. Attack-speed affixes scale the entire descriptor, so the relative rhythm survives Swift/Heavy variants.

### 5. Combat owns the limbs, then hands energy back to the spring

`actionOwnershipAt()` ramps authored ownership during anticipation, holds it at weight 1 through the active interval, and releases it over follow-through. `stepJigglePart()` detects the transition from exact ownership and seeds the spring with the authored point plus bounded terminal local velocity. Two-handed grip reconstruction also synchronizes the rear hand to the haft. The dangerous pose stays exact, while the exit carries a small physical ring instead of snapping back into procedural gait.

## Actual big-sword roster and current resolution

“Family” below means `WeaponDef.tags.family`; “combo” is the separate `MeleeComboSelection`. Every `x2-*` entry is `expansion: true` and is merged into `WEAPONS` but excluded from the active `WEAPON_IDS` pool until curated.

| Weapon id | Name | Data family / size | Current style | Current combo | Stage-1 disposition |
|---|---|---|---|---|---|
| `driftblade` | Driftblade | `sword` / XL | `orbit` | `chop:greatsword` | Make the existing choice explicit; reference combo |
| `tombstone-greatsword` | Tombstone Greatsword | `sword` / L | `chop` (quake) | `chop:quake-mauler` | Give a sword-specific, quake-aligned finisher |
| `x-sword-whirlwind` | Dervish Greatblade | `greatsword` / L | authored `spin` | none | Keep its bespoke two-revolution spin; do not fold into a 3-step chain |
| `x-sword-bone` | Wyrmtooth | `sword` / L | `orbit` | none | Opt into the existing `greatsword` phrase |
| `x-sword-anchor` | Drowned Anchor | `sword` / L | `orbit` | none | Exclude: family says sword, silhouette/fantasy says anchor |
| `x-sword-coffin` | Reaper's Lid | `sword` / L | `orbit` | none | Exclude: family says sword, silhouette/fantasy says coffin lid |
| `x2-gravechill-nodachi` | Gravechill Nodachi | `nodachi` / XL | `chop` (quake) | `chop:quake-mauler` | Sword-specific, quake-aligned variant; no hammer-head fulcrum logic |
| `x2-tombwarden-claymore` | Tombwarden Claymore | `broadsword` / XL | `chop` (quake) | `chop:quake-mauler` | Sword-specific, quake-aligned variant |
| `x2-riftcleaver-greatblade` | Riftcleaver Greatblade | `energy-blade` / L | `orbit` | `chop:greatsword` | Explicit `greatsword` assignment |
| `x2-dustreaper-zweihander` | Dustreaper Zweihander | `broadsword` / XL | `orbit` | `chop:greatsword` | Explicit `greatsword` assignment |
| `x2-stormpetal-odachi` | Stormpetal Odachi | `nodachi` / XL | `orbit` | `chop:greatsword` | Explicit `greatsword` assignment |

The current structural `quake-mauler` test is shape-blind: any 2H L/XL quake weapon wins before greatsword/nodachi detection. That is why a nodachi, claymore, and glaive can inherit the hammer-head fulcrum flip. Explicit metadata should replace that accidental result for the panel roster.

### Sword-adjacent poleblades

| Weapon id | Name | Data family / size | Current style and combo |
|---|---|---|---|
| `x2-permafrost-bardiche` | Permafrost Bardiche | `axe` / XL | `orbit`, no combo |
| `x2-dustdevil-glaive` | Dustdevil Glaive | `glaive` / L | `chop`, accidental `quake-mauler` |
| `x2-reliquary-halberd` | Reliquary Halberd | `halberd` / XL | `orbit`, no combo |
| `x2-quarry-splitter-bardiche` | Quarry-Splitter Bardiche | `glaive` / XL | `chop`, accidental `quake-mauler` |
| `x2-wickfire-fauchard` | Wickfire Fauchard | `glaive` / L | `orbit`, no combo |
| `x2-saintspar-lochaber` | Saintspar Lochaber | `halberd` / L | `orbit`, no combo |
| `x2-thunderhead-voulge` | Thunderhead Voulge | `glaive` / XL | `orbit`, no combo |
| `x2-blightfork-glaive` | Blightfork Glaive | `glaive` / L | `orbit`, no combo |
| `x2-rimethorn-naginata` | Rimethorn Naginata | `naginata` / L | `orbit`, no combo |
| `x2-riftcaller-naginata` | Riftcaller Naginata | `naginata` / XL | `orbit`, no combo |

Treat this as a separate `poleblade` variant rather than labelling all of them `greatsword`. A practical Stage-1 three-beat phrase is wide reap -> reverse low/haft cut -> guillotine plant. It can reuse the present hand, depth, shadow, and planted-grip channels. Author its finisher contact at normalized `.52` so the two quake poleblades do not visibly land after the existing descriptor's quake beat.

## Stage-1 authoring plan

### Variants

1. Keep `greatsword` as the reference sequence for non-quake blades: shoulder chop -> pommel bash -> true charged step-slash.
2. Add `greatsword-quake`: shoulder chop -> pommel bash -> grounded earthsplitter. The new last motion should preserve the charge/plant virtues of `applyTrueChargedSlam()` but make visible contact at `.52`, matching today's immutable `SwingDescriptor.impactSeconds`.
3. Add `poleblade`: wide reap -> reverse low/haft cut -> guillotine plant. Use both hands for every powered interval, preserve long haft spacing, and let the rear hand remain a hard child of the lead grip.

The broad `meleeComboSelectionFor()` fallbacks should remain compatibility defaults, not roster authoring. Put explicit `comboVariant` metadata on every weapon listed for inclusion. This prevents names such as Anchor, Lid, and future exotic `family: "sword"` entries from acquiring a blade phrase by accident.

### What the current step schema can express

`MeleeComboStep` already expresses everything Stage 1 needs:

- a named renderer dispatch through `motion`;
- signed lead/reverse/opposing intent through `direction`;
- lead/off/both-hand ownership;
- normalized anticipation/active/impact/follow beats;
- an optional second active interval;
- dormant future path kind and arc/range/damage/knockback metadata.

`SpriteRig` already has the needed output channels: lead/rear hand offsets, whole-paper art offset and lift, signed torso scale, weapon length, weapon depth, shadow transform/alpha, explicit grip targets, two-hand spacing, and terminal-velocity spring handoff. Implementing `earthsplitter` and the three poleblade motions as named methods is lower-risk than inventing a generic curve DSL for this pass.

Add only union members and sequence data for Stage 1:

- `MeleeComboVariant`: `"greatsword-quake"`, `"poleblade"`;
- `MeleeComboMotion`: the selected earthsplitter/reap/reverse/guillotine motion ids;
- complete immutable variant sequences in `MELEE_COMBO_VARIANT_SEQUENCES`.

The literal-widening trap is real. Every new union-valued literal—especially `motion`, `direction`, `hand`, and `path.kind`—must stay narrow. Prefer this form:

```ts
const EARTHSPLITTER_STEP = Object.freeze({
  name: "earthsplitter plant",
  motion: "earthsplitter" as const,
  direction: 1 as const,
  hand: "both" as const,
  timing: { activeStart: 0.38, activeEnd: 0.56, impact: 0.52, followEnd: 0.76 },
  path: {
    kind: "fan" as const,
    arcMultiplier: 0.8,
    rangeMultiplier: 1,
    damageMultiplier: 1,
    knockback: 0,
  },
} as const satisfies MeleeComboStep);
```

Do not rely on `Object.freeze()` alone to preserve nested literal types. The shared package's declaration `tsc` sees widened `string`/`number` fields that the client bundler can appear to tolerate.

### What would need new fields, and should not be added now

- Per-step pose duration or cooldown needs explicit `poseScale`/`cooldownScale` semantics and server ownership. It changes cadence and active timing, so it is Stage 2.
- Data-driven arbitrary poses would need a visual sub-schema for entry/exit guards, curve ids, torso channels, weapon foreshortening, and shadow/grip keys. Two new bespoke phrases do not justify that abstraction.
- Root lunges, steps with collision, stagger, guard break, multi-hit, or alternate damage sources need authoritative action fields. Stage-1 `attackArtOffX/Y` must remain visual only.
- Exact combo reset after a cadence lapse needs a server-owned accepted `comboStep` (or combo epoch). A client cannot reconstruct missed history from only the latest beat.

## Clock composition and attack-speed scaling

`swingDescriptorFor(def, effectiveCooldown)` remains the only base clock:

```text
effectiveCooldown = weapon cooldown * lootCooldownMult
poseSeconds       = effectiveCooldown * 0.64       // non-spin
stepSeconds(f)    = poseSeconds * normalizedStepFraction(f)
readyAt           = acceptedStart + effectiveCooldown
```

`SpriteRig` samples `tt = elapsed / poseSeconds`; combo timing fractions shape the pose and ownership envelope. The full effective cooldown, not `poseSeconds`, controls whether the next attack may occur. The exit guard fills the gap.

Important Stage-1 limitation: `swingDescriptorWithComboStep()` copies combo metadata onto the descriptor but deliberately does **not** replace `activeStartSeconds`, `activeEndSeconds`, or `impactSeconds`. The server still uses the base style's active interval and a single positive centered sweep. For Driftblade, the base style is `orbit`, so its authoritative active interval is about 150-286 ms at base speed even though its three visual steps have different danger-looking intervals. The painted edge ribbon also samples the legacy descriptor. Keep it as the damage-truth layer in Stage 1; do not make a reverse ribbon claim reverse damage before the server path changes.

All authored fractions must satisfy:

```text
0 <= activeStart < activeEnd <= followEnd <= 1
activeStart <= impact <= activeEnd, when impact exists
poseSeconds <= effectiveCooldown
```

Test at Swift, normal, and Heavy affix speeds. Fractions should scale, not be re-tuned per affix. `comboGraceMs()` may remain clamped to 120-300 ms.

## Deterministic local and remote playback

### Checkout audit

The new beat is wired end to end for basic remote playback. `PlayerState` has `attackSeq`, `attackTick`, and `attackHeld`; `GameRoom.stampAttackBeat()` advances them exactly when an attack is accepted; and server tests cover accepted, buffered, stale, and held-window behavior. On the client, `ArenaScene.routePlayerAttacks()` maps `attackTick` into the delayed render timeline, suppresses a matching local confirmation, and calls `triggerAcceptedRigAttack()` for remote accepted edges. A remote rig therefore does swing in this checkout.

What is not deterministic yet is the **combo step**. `routePlayerAttacks()` does not pass `attackSeq` into the descriptor or rig. `SpriteRig.triggerSwing()` still advances ordinary combo steps from its private `comboStep` plus a client-local expiry timer. A viewer joining during the held latch starts at step 1; an existing viewer may be on step 2 or 3; and a coalesced sequence jump advances the private counter only once. The synced beat fixed remote silence, but it did not become the accepted-combo protocol.

### Stage-1 deterministic rule

Add a pure shared resolver that enriches a descriptor from the accepted/predicted uint32 sequence:

```text
visualStep = normalizedModulo(attackSeq - 1, sequence.length)
```

All viewers must use the same function and the same weapon definition. The sequence number, not `SpriteRig.comboStep`, is the authority for step selection. `comboExpiresAtMs` may still control guard release, but it must not decide which step is next.

This has an accepted Stage-1 compromise: after a long idle or weapon swap, the first attack may be step 2 or 3 because `attackSeq` is global across weapon kinds. It will at least be the same step for every viewer. Correct reset-to-step-1 behavior requires the Stage-2 server combo epoch/step.

Route beats in `ArenaScene` before `blob.animate()`:

1. On first observation, seed `lastAttackSeq`/`lastAttackHeld`. Do not restart the owner's predicted pose; for a remote with a nonzero sequence and a live held latch, catch up directly to the exact sequence-derived step at the mapped phase.
2. On a changed sequence, compute the unsigned delta and always advance the cursor. The changed accepted sequence is sufficient to route the edge; do not require the short held latch as well.
3. If this is a remote melee weapon, build `swingDescriptorFor(weapon, cooldown * affix)`, enrich it from `attackSeq`, freeze `player.aimDir`, and call `triggerSwing()`.
4. Backdate the visual epoch by the wrap-safe age `(state.tick - attackTick) * TICK_MS`, clamped to the pose, rather than pretending the patch arrival is the accepted instant.
5. If several increments were coalesced, never burst-replay the backlog. Resolve the exact latest step from the current sequence and sample at most that one; the mapped epoch naturally makes a pose that is already over invisible.
6. For the local player, predict the next sequence and use the same pure step resolver immediately. A matching accepted beat confirms without restarting the pose. Treat any correction beyond that as Stage-2 work; the present beat has no client action id with which to match rejection or buffering unambiguously.

`attackHeld` is an initial-observation/replay latch (and a tome-open latch), not combo state. Its three-tick/150 ms window is shorter than the cooldown of these weapons and cannot represent a three-hit chain. Ongoing sequence changes should still route from `attackSeq`/`attackTick` after the latch clears.

## LOD and motion accessibility

Keep step selection and beat cursors independent of visual LOD. An off-screen player must still consume `attackSeq`; otherwise re-entering the view can replay a stale finisher.

- Inside the camera plus the existing `JIGGLE_LOD_MARGIN_PX` margin: run the full pose, both-hand constraints, shadow/depth changes, and spring handoff.
- Outside that margin: update beat/step cursors but skip starting swing VFX and allow the pose to be omitted. The existing jiggle LOD rebase must remain so re-entry cannot inject a large terminal velocity.
- Painted-ribbon VFX should be viewport-gated for remotes. `VfxPlayer` already caps surfaces at 12 and reduces ribbon subdivisions from 12 to 8 to 4 as pressure rises; retain that degradation. Do not allocate one surface per missed attack.
- In a 10-player pile, prioritize local, on-screen remote, then off-screen. Never simplify the weapon/hand silhouette of an on-screen accepted melee beat merely because particles are saturated.
- Reduced-motion treatment may lower secondary tremor, depth flips, and shadow pulsing, but it must keep the three key silhouettes and the same deterministic step. It must not alter attack timing or sequence state.

## Exact implementation touch list

### Stage 1: visual-only ship

1. **`packages/shared/src/melee.ts`**
   - Extend `MeleeComboVariant` and `MeleeComboMotion`.
   - Add frozen `greatsword-quake` and `poleblade` step constants/sequences using `as const satisfies MeleeComboStep`.
   - Update `familyForSignatureVariant()`/`meleeComboSequenceFor()` for the new variants.
   - Add a pure wrap-defined `comboStepForAttackSeq()` (and preferably `swingDescriptorForAttackSeq()`) so scene, tests, and any VFX caller cannot implement different modulo rules.
   - Keep `swingDescriptorWithComboStep()` non-gameplay in Stage 1.

2. **`packages/shared/src/weapons.ts`**
   - Add explicit base-roster assignments: Driftblade and Wyrmtooth to `greatsword`; Tombstone Greatsword to `greatsword-quake`.
   - Leave Dervish Greatblade on authored `spin` and leave Drowned Anchor/Reaper's Lid out.
   - Consider moving the combo metadata declaration next to `WeaponDef` in a later cycle; the current module augmentation in `melee.ts` is sufficient for this pass and avoids a circular runtime import.

3. **`data/weapon-concepts-300.json`**, **`tools/artkit/gen-weapon-expansion.mjs`**, regenerated **`packages/shared/src/weapons-expansion.generated.ts`**
   - The generated file is not an authoring surface. Add validated `comboVariant` support to the generator's allowed keys and emitter.
   - Assign `greatsword`, `greatsword-quake`, or `poleblade` to the expansion ids enumerated above.
   - Regenerate and require `gen:check` clean.

4. **`packages/client/src/entities/SpriteRig.ts`**
   - Make `triggerSwing()` consume an already-enriched `swing.comboStep` snapshot when present; do not independently increment a private step for synced beats.
   - Add `applyEarthsplitter()` and the selected poleblade motion samplers, using the existing resettable signature channels.
   - Preserve `actionOwnershipAt()`, rear-haft hard constraint, `comboHoldPose`, and terminal-velocity handoff.
   - Keep all body advance in `attackArtOffX/Y`; do not move `root`.

5. **`packages/client/src/scenes/ArenaScene.ts`**
   - Retain the existing `routePlayerAttacks()`/`attackClientEpoch()` remote playback and local-confirmation logic, but enrich the swing with the sequence-derived step before `triggerAcceptedRigAttack()` calls the rig.
   - Keep the current late-patch phase mapping and collapse missed increments to the exact newest sequence-derived step rather than incrementing the rig once.
   - Use the same sequence resolver for the existing `localPredictedAttackSeq` high-water path.
   - Pass the enriched descriptor to the rig. Keep the Stage-1 painted ribbon on legacy damage geometry; viewport-gate remote VFX.

6. **Tests**
   - Add shared combo tests and focused Arena beat-routing tests as described below. Existing server attack-beat tests should be extended, not replaced.

### Stage 2: accepted action/geometry protocol

These items must not be smuggled into the visual pass:

- server-owned resettable `comboStep`/combo epoch and accepted weapon id/variant snapshot;
- robust local prediction confirmation/correction with an action identity;
- accepted step-specific `activeStart`, `activeEnd`, and `impact`, including quake scheduling;
- signed reverse paths, `fan`, `dual-sweep`, growing `capsule`, and exact `deltaAngle` sampling on the server;
- step damage/range multipliers, knockback, stagger/guard break, or multi-hit;
- authoritative root motion/collision;
- step-specific painted ribbon paths that claim the new authoritative danger geometry.

At that point the server should select the combo step when `canAct` succeeds, call `swingDescriptorWithComboStep()` itself, store the enriched immutable descriptor in `meleeSwings`, and publish the accepted snapshot. `SpriteRig`, `VfxPlayer`, quake timing, and `stepMeleeSwings()` can then sample one descriptor rather than maintaining presentation and damage interpretations.

## Test and acceptance strategy

### Pure/shared tests

Add `tests/melee-combos.test.ts` with:

- all sequences are three steps, frozen, and satisfy normalized timing invariants;
- every union-bearing new step survives the shared declaration build;
- `comboStepForAttackSeq()` is deterministic for initial values, large uint32 values, and the documented wrap behavior;
- Driftblade resolves to `chop:greatsword` explicitly;
- Wyrmtooth/Riftcleaver/Dustreaper/Stormpetal resolve to `greatsword`;
- Tombstone/Gravechill/Tombwarden resolve to `greatsword-quake`;
- the enumerated glaive/bardiche/halberd/naginata ids resolve to `poleblade`;
- Dervish stays `spin`, while Anchor and Lid stay excluded;
- no Stage-1 test expects path damage/range/knockback to affect combat.

### Client beat-routing tests

Extract a small pure beat reducer if necessary and cover:

- first observation never restarts the owner; a live remote latch catches up once at the exact sequence-derived step, while a stale latch only seeds;
- one fresh remote increment starts one pose at the sequence-derived step;
- a coalesced delta starts at most the newest pose and advances the cursor;
- an increment observed after `attackHeld` clears still resolves from `attackSeq`/`attackTick`, and an epoch older than the pose produces no fresh replay;
- local matching confirmation does not restart prediction;
- weapon swap and mid-run join produce the documented deterministic Stage-1 result;
- off-screen consumption prevents stale replay on re-entry.

### Server tests

Retain the existing `GameRoom.test.ts` attack-beat coverage and add a melee-specific assertion that `attackSeq` advances once at `canAct`, not at request arrival, and that the stamped `attackTick` is the descriptor epoch. No combo multiplier or alternate path should appear in Stage 1.

### Visual/performance matrix

In Testing Grounds, capture Driftblade plus one weapon from each new variant at Swift, normal, and Heavy speed, at 30/60/144 fps. Review:

- the end guard of step N is continuous with the first frame of step N+1;
- both hands stay on long hafts through powered intervals;
- the weapon never vanishes at an edge-on scale or jumps depth on recovery;
- full length, compressed torso, planted shadow, and visible contact coincide on finishers;
- hit-stop resumes at current descriptor phase without a hard limb snap;
- two clients under 0/100/200 ms RTT show the same combo step for each accepted sequence;
- join mid-chain, dropped patches, weapon swap, down/revive, and uint32-near-wrap fixtures do not replay or bank a finisher;
- ten on-screen players attacking do not exceed the VFX surface cap, allocate backlog effects, or destabilize jiggle on LOD re-entry.

Required checks after implementation:

```text
pnpm --filter @dd/shared build
pnpm --filter @dd/client typecheck
pnpm vitest run tests/melee-combos.test.ts packages/server/src/rooms/GameRoom.test.ts
pnpm gen:check
```

## Ship decision

The high-return Stage-1 release is explicit roster assignment, two new visual variants, and sequence-derived remote playback. It gives other large blades Driftblade's defining strengths—contrast, charged silhouette, planted follow-through, and guard continuity—without changing one point of damage.

Do not call Stage 1 WYSIWYG combo combat. Until Stage 2, the combo pose is visual choreography layered over one legacy server sweep, and the painted ribbon remains the most honest indication of that sweep.
