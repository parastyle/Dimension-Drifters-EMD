# Dagger, Claw, and Worn-Blade Animation Direction

## Panel verdict

The feedback is correct, but there are two different defects hiding under the same symptom.

1. **The shipped dual daggers are in the wrong combat vocabulary.** `Twin Bowie Fangs` are tagged `fist-blade`, are not considered worn, have no authored swing/combo override, and therefore resolve to `arc`. The ordinary arc steps turn the weapon angle while leaving the striking hand at its locomotion/aim position. The rear weapon inherits the same angle while its hand also stays put. This is the exact “weapons move, arms do not” failure.
2. **Recognized claws do own and move their hands, but the target pose is too small.** `Wendigo Claws`, `Knucklebone Talons`, `Rendclaw Vambrace`, and `Wyrmscale Hex-Talon` resolve to `pivot`/`rake`. During the active interval the chosen hand reaches combat ownership weight `1`; this is not a weight-zero or spring-overwrite bug. The rake only adds at most about `0.32H` of forward hand travel, however, while the torso has no forward art translation and the feet have no attack-specific lunge. Most of the visible displacement is still the claw rotating around the hand.

The correction is a full-body, shoulder-led attack system with two related but visibly different languages:

- **Daggers:** narrow, exact, point-first alternating lunges. The two attacks form a clean X over the combo, then finish with a forward pounce and one decisive needle-storm contact.
- **Claws/worn blades:** wider, feral shoulder rakes. The two attacks tear an X with parallel claw marks, then finish in a low pounce-maul with both shoulders committed.

In both languages the striking arm reaches a straight, unmistakable full extension; the body advances behind it; the rear leg kicks back as counterweight; and the hand snaps into recovery with terminal velocity handed to `PROCEDURAL_JIGGLE`. The bright strike point must be at least one body height from the player root and must never exceed the authoritative server reach.

This document uses `H = TARGET_BODY_H = 76 px`, `F = normalized frozen aim`, and `N = perpendicular to aim`. “Body translation” means visible paper-art offset; the root, hurtbox, camera anchor, and server blade origin remain fixed.

## Diagnosis from the current implementation

### Runtime family routing

There is no runtime `dagger` family in `WEAPONS`. The active paired short blade is `Twin Bowie Fangs`; several dagger concepts exist in `data/weapon-concepts.json`, but they are not entries in the runtime weapon table. The relevant defined cases below include expansion entries that are merged into `WEAPONS` but held out of the active `WEAPON_IDS` roster.

| Weapon | Data identity | Mount | Resolved style / combo | Authoritative reach | Current result |
|---|---|---:|---|---:|---|
| Twin Bowie Fangs | `fist-blade`, dual, S | held | `arc` / `arc` | `92 px = 1.21H` | Both knives rotate; normal cuts author no hand extension and never alternate hands. |
| Cinderfang Wakizashi Pair | `katana`, dual, S | held | `arc` / `arc` | `100 px = 1.32H` | Same generic dual-arc failure; useful shortblade coverage case. |
| Frostfang Rakes | `exotic-melee`, dual, S | held | `arc` / `arc` | `108 px = 1.42H` | Claw fantasy, but “Rakes” does not match the worn-word test, so it never enters rake motion. |
| Wendigo Claws | `exotic-melee`, dual, S | worn | `pivot` / `rake` | `105 px = 1.38H` | Correct alternating hand selection, insufficient body/arm projection. |
| Knucklebone Talons | `exotic-melee`, dual, S | worn | `pivot` / `rake` | `110 px = 1.45H` | Correct family, same short projection. |
| Rendclaw Vambrace | `exotic-melee`, 1H | worn | `pivot` / `rake` | `120 px = 1.58H` | The one hand reverses on step 2; still no deep lunge. |
| Wyrmscale Hex-Talon | `gauntlet`, 1H | worn | `pivot` / `rake` | `195 px = 2.57H` | Physical claw art cannot explain the very long edge by itself; it needs an energy/elemental continuation or a later range retune. |

Blunt worn gear is a separate language and should remain so. `Revenant Knuckle`, ordinary gauntlets, gloves, mitts, knuckles, and fists correctly resolve to `punch`; they must not inherit claw rakes merely because they share the worn mounting system.

### Why the hands appear at rest

The failure chain is precise:

- `isWornWeapon()` recognizes exact `gauntlet`/`fist` families or words such as claw, talon, glove, vambrace, knuckle, and cestus. It does **not** recognize `fist-blade`, dagger, fang, rake, or generic `exotic-melee` as worn.
- `swingStyleFor()` gives recognized claws/talons `pivot`, other worn gear `punch`, and ordinary one-handed weapons `arc` unless data overrides the style.
- `meleeComboSelectionFor()` derives `arc` from that fallback. Every current arc combo step names the `lead` hand; no step assigns the rear hand.
- The ordinary arc branch changes `weaponAngle` and torso rotation. Its normal forehand/backhand steps do not set `swingOffX/Y` or `swingBackOffX/Y`. Because each weapon is finally positioned on its hand, this produces a knife turning around a hand that never attacks.
- For the second dual weapon, `backWeaponAngle` is unset in the arc branch, so the renderer reuses `weaponAngle` plus a small fixed lean. Both blades perform nearly the same prop rotation while neither arm supplies range.
- Combat ownership does not fix a missing pose. `actionOwnershipAt()` correctly reaches `1` through the active interval, which suppresses spring residual and makes the authored point exact. For an arc step, that exact point is still the resting/aim hand point. The bug is the authored target, not weight.

### The worn mount is not skipping arm animation

`equipWeapon()` mounts worn art at origin `0.4` instead of `gripFrac` and changes the z-stack so glove/claw art covers the hand. It still stores the same hand as the weapon’s parent anchor, and the weapon still follows that hand every frame. The worn path therefore does not bypass combat ownership or hand offsets.

This distinction should become an authoring rule:

> `isWornWeapon` answers **how the art is attached**, not **how the fighter attacks**.

Held claw-rakes and held daggers need the same full-body animation-routing seam as worn claws without being falsely mounted over the hand. Conversely, blunt gauntlets remain worn without becoming slashing weapons.

### Correctly classified rake is still too conservative

The current rake computes a lateral path of up to `0.26H` and a forward component of `0.12H + 0.20H × sin(progress)`. Its maximum forward hand contribution is therefore about `0.32H` (`24 px`). The body only twists/squashes and moves slightly down-screen; it never advances along `F`. `ownFeet` protects the attack interval from spring noise, but there are no strike-specific foot targets, so gait remains the visible leg language.

The existing rake combo does solve one prior problem: step 1 uses the lead/front hand, step 2 uses the off/back hand for a true dual weapon, and the scissor step drives both channels. That ownership and the current terminal-velocity spring seam should be retained. The reach targets, torso travel, and leg targets need replacement.

## Damage truth and the reach contract

### What the server actually hits

The authoritative attack is still one legacy centered sweep:

- `GameRoom.resolveSwing()` records `range = meleeReach(weapon)`.
- `meleeReach()` uses `max(weapon.range, rendered held-tip length)` and the current server calls it at fixed scale `1`.
- `stepMeleeSwings()` samples a line from the live player root to that range while its angle advances from `aim - swingArc/2` to `aim + swingArc/2`.
- The line has `MELEE_BLADE_HALFWIDTH = 21 px`, and each enemy can be hit once per accepted swing.
- The client-authored `comboPath`, signed direction, second rake path, range multiplier, damage multiplier, and knockback are inert presentation data in the current stage.

The good news is that the basic shortblade and claw roster already has more than one body height of real edge reach: `92–120 px` against `H = 76 px`. The server is not the reason Twin Bowie looks short. The animation fails to spend that reach on a connected shoulder–hand–weapon silhouette.

The exception is a long-range outlier such as Wyrmscale (`195 px`). A physical glove pose ending near `1.15H` would under-promise a `2.57H` hit. Its PER must visibly continue from talon tip to authoritative radius as a magical rend, or its future edge range must be reduced while its projectile/scatter layer retains the long reach. Do not make the arm rubber-stretch to `2.57H`.

### Contact-budget equation

At the named strike frame, use:

`C = B + A + W`

where:

- `C` is root-to-bright-contact distance along the current strike ray;
- `B` is visible body-art advance along `F`;
- `A` is body-relative shoulder-to-hand extension along the strike ray;
- `W` is the visible hand-to-business-edge length.

For held weapons, `W = (1 - gripFrac) × displayLength`. For worn art, the current visible mount uses origin `0.4`, so `W = 0.6 × displayLength` even though server `meleeReach()` still uses weapon data. Every pose must satisfy:

`1.00H ≤ C ≤ meleeReach(weapon) - 0.04H`

The `0.04H` inset is a presentation safety margin. PER’s bright endpoint may sit on exact authoritative reach; the opaque hand/weapon silhouette should sit just inside it. Do not count the enemy radius or the server’s `21 px` blade half-width as extra visible range.

Representative budgets at the decisive frame are:

| Chassis | `B` body | `A` arm | `W` visible edge | `C` contact | Server cap |
|---|---:|---:|---:|---:|---:|
| Twin Bowie lead lunge | `0.16H` | `0.30H` | `0.69H` | `1.15H` | `1.21H` |
| Twin Bowie pounce | `0.24H` | `0.24H` | `0.69H` | `1.17H` | `1.21H` |
| Cinderfang lead lunge | `0.16H` | `0.24H` | `0.78H` | `1.18H` | `1.32H` |
| Frostfang held rake | `0.18H` | `0.34H` | `0.64H` | `1.16H` | `1.42H` |
| Wendigo worn rake | `0.21H` | `0.47H` | `0.46H` | `1.14H` | `1.38H` |
| Knucklebone worn rake | `0.22H` | `0.49H` | `0.44H` | `1.15H` | `1.45H` |
| Rendclaw worn rake | `0.20H` | `0.35H` | `0.62H` | `1.17H` | `1.58H` |

These are translation budgets, not scale cheats. Keep weapon length at `1.00` through contact, with at most `0.96 → 1.03 → 1.00` acceleration/recoil deformation. Keep torso scale distortion within roughly `0.92–1.06`; the distance comes from body and hand translation.

## Shared full-body grammar

### Hand and combo semantics

- Combo step `0` always strikes with the rig’s semantic lead/front hand.
- Combo step `1` always strikes with the semantic off/back hand for a real dual weapon. A facing flip changes its screen side but never changes the sequence.
- Combo step `2` uses both hands for dual weapons. A single worn blade repeats the same striking arm while the free hand counterbalances; it must never animate an absent second weapon.
- Keep the existing weapon/family/grace reset rules. The current predicted combo counter is adequate for presentation; the accepted `attackSeq` now lets remote rigs trigger attacks too, while `attackHeld` is only a short latch/catch-up signal. Exact local/remote step parity still requires the accepted combo-step protocol, because neither field carries the step and a coalesced sequence jump currently triggers only one reconstructed pose.

The clean data direction is to separate mount from motion:

- Twin Bowie Fangs, Cinderfang Wakizashi Pair, and future paired daggers: rake-compatible combat family with a **dagger** variant, while remaining held.
- Wendigo, Knucklebone, Rendclaw, Wyrmscale, and Frostfang Rakes: rake-compatible combat family with a **claw** variant; each keeps its correct worn/held mount.
- Blunt gauntlets/knuckles: remain `punch`.

This can be expressed by extending the existing `comboFamily`/`comboVariant` seam. It should not be implemented as weapon-name checks inside `SpriteRig`.

### Shoulder, torso, and legs

The hand may not arrive by itself. Every attack uses this order of motion:

1. Rear/plant foot establishes direction.
2. Hip and body art advance.
3. Shoulder turns into the line.
4. Hand reaches full extension.
5. Weapon edge and PER arrive last.

At full extension the striking shoulder should visually sit behind the hand on one unbroken aim line. Use torso rotation and a small profile squash to imply the missing upper-arm sprite; do not let the detached hand float sideways with no shoulder alignment.

For a deep lunge, the front/plant foot advances `0.14–0.20H F`; the rear foot trails `0.08–0.14H` behind the body and kicks `0.06–0.12H` toward the opposite side of `N`. The foot kick is a counterweight silhouette, not root movement. On near-vertical aim, exaggerate the `N` split so the pose does not collapse into a stack of overlapping parts.

The shadow follows only `60–75%` of the body-art advance and stretches along `F`. That residual gap sells commitment while keeping the grounded root truthful.

### Recovery and jiggle handoff

The selected combat hand owns its authored point at weight `1` through the dangerous interval. Both hands own the finisher’s convergence. The non-striking hand remains spring-active except during the brief counterbrace that establishes the silhouette.

Recovery is a snap-back, not a pose blend to idle:

- Pull the hand back `0.16–0.24H` over the first `8–12%` after active end.
- End authored ownership while the hand still has backward velocity, no faster than the existing `JIGGLE_HANDOFF_MAX_V = 120 px/s` (`1.58H/s`).
- Let the current `prevOwn == 1` terminal-velocity seam seed the underdamped hand spring.
- Hold only a small guard offset after release. Do not keep combat ownership at `1` during combo grace; current hold behavior correctly owns nothing.

The result should be a visible wrist/hand recoil and one damped overshoot, while the weapon remains rigidly attached to the hand. No hand or worn mount may pop when ownership crosses below `1`.

## Dagger language — precise alternating lunges

Daggers are not miniature swords. Their read is **point first, body second, clean stop**. Lateral travel is narrow; shoulder-to-point alignment is exact; the PER has a bright needle lip and short history. Even when the legacy server is sweeping an arc, the decisive silhouette crosses aim as a stab-cut rather than a wrist circle.

### D1 — Lead-hand “Long Point”

| Phase | Pose and silhouette | Reach / legs | PER and truth |
|---|---|---|---|
| `0.00–0.12` outside coil | Lead elbow/hand chambers `0.12H` behind the shoulder and `0.10H N`; torso narrows to about `0.95` and counter-rotates `0.10 rad`. Off dagger guards the sternum. | Weight shifts to the rear foot; lead foot floats only `0.03H`. | No ribbon. A single tip glint may appear in the final `0.03` only. |
| `0.12–0.16` plant | Lead foot stamps `0.16H F`; body starts its `0.16H` advance. Shoulder is already pointing down `F`. | Rear foot drags `0.08H` back and `0.05H` across `N`. | No bright contact before the descriptor’s live interval. |
| `0.16–0.48` drive | Cubic-out body advance; the lead arm straightens to the full budget. The dagger travels from outside guard through aim, with the point leading the hand by one readable frame. | Twin Bowie target: `0.16H body + 0.30H arm + 0.69H edge = 1.15H`. Rear leg kicks `0.08H` opposite the striking shoulder. | One narrow painted blade ribbon, `8–10 px` body, `3–4 px` live lip, history about `0.55` of the S preset. Bright point crosses aim near `t=0.44`. Endpoint never exceeds `R`. |
| `0.48–0.74` stitch / live tail | Hold the straight shoulder–hand line for `0.04`, then allow a compact `≤0.32 rad` cut-through while the body remains forward. Off hand stays protective. | Contact remains at `≥1.0H` until the current legacy active interval closes. | The live lip follows the authoritative centered sweep. The opaque dagger stays inside it. |
| `0.74–0.86` snap out | Hand retracts `0.20H`; torso starts back first but shoulder lags, creating a tight elastic recoil. | Lead foot stays planted until `0.82`; rear foot catches up after. | Ribbon becomes a short, non-live afterimage. Release hand ownership with backward terminal velocity. |
| `0.86–1.00` cross guard | Lead dagger settles low across the body, intentionally feeding D2’s opposite-side chamber. | Body retains no more than `0.03H F`. | No damage-looking trail. |

Top-down read: a long arrowhead silhouette aimed at the target. At cardinal up/down aim, separate the off dagger by `0.12H N` and keep the rear foot kick visible on the other side.

### D2 — Off-hand “Cross Return”

| Phase | Pose and silhouette | Reach / legs | PER and truth |
|---|---|---|---|
| `0.00–0.09` switch | The D1 guard is already across the body. The off shoulder snaps forward as the lead hand recoils to the ribs. Torso twist reverses without returning to neutral. | Off-side foot becomes the plant; old plant foot becomes the trailing kick. | Only a tiny hilt/tip glint identifies the new hand. |
| `0.09–0.16` drop step | Body slips `0.06H N` to expose the opposite diagonal, then begins `0.18H F` advance. | Plant foot reaches `0.18H F`; rear foot kicks `0.10H` to the other side. | No second live band yet. |
| `0.16–0.50` reverse drive | Off arm fully extends from the opposite shoulder. The point crosses aim on the inverse diagonal; lead dagger remains close and clearly non-striking. | Twin Bowie target: `0.18H body + 0.27H arm + 0.69H edge = 1.14H`. | Target protocol: a narrow **signed reverse** ribbon crossing D1’s remembered diagonal to form a crisp X. Current legacy mode must repeat its positive centered live sweep; it may cross the *pose* but must not fake an authoritative reverse ribbon. |
| `0.50–0.74` cut-out | Shoulder overshoots `0.08 rad`, then hand stays long enough for the legacy live edge to finish. Torso is tall and precise, not crouched. | Maintain `≥1.0H` visible contact radius. | Short PER history prevents the two attacks from becoming a broad sword crescent. |
| `0.74–0.85` snap back | Off hand retracts sharply; lead hand opens into the finisher’s two-hand preparation. | Feet narrow into a coiled stance. | Terminal-velocity spring handoff on the off hand. |
| `0.85–1.00` pounce load | Both daggers sit behind the shoulders, tips visible outside the torso. | Crouch to roughly `0.94` body height; no forward offset remains. | No live trail. |

Top-down read: D1 and D2 must be recognizable as opposite diagonals even in a still capture. Daggers cross at one small, intentional aim point; they do not paint a wide fan.

### D3 — “Pounce Stitch” finisher

This is the requested flurry, but the current one-sweep damage rule requires one visually dominant contact. The flurry impression comes from rapid hand preparation, a simultaneous convergence, and post-contact catch motion—not three separate bright hit passes.

| Phase | Pose and silhouette | Reach / legs | PER and truth |
|---|---|---|---|
| `0.00–0.16` predator coil | Torso compresses to `0.90–0.92`; both hands draw behind the shoulder line, one high and one low. Hold the last frame. | Feet spread `0.18H` across `N`, rear heel lifted. | Two dim blade ghosts may quiver inside the body silhouette; no outward streak. |
| `0.16–0.28` launch | Visible body art accelerates forward to `0.14H`; hands remain tucked for the first third so the body visibly powers them. | Lead foot shoots `0.20H F`; trailing foot leaves the ground plane by `0.05H` and kicks back `0.12H`. | Start one narrow authoritative ribbon, not two hits. |
| `0.28–0.54` stitch contact | Body reaches `0.24H F`. Both arms snap forward on slightly different `N` offsets, but the two tips converge within `0.18H` of each other at aim. Lead lip arrives first by at most `0.04` normalized time. | Twin Bowie target per dominant tip: `0.24H body + 0.24H arm + 0.69H edge = 1.17H`. | Target protocol: two needle strips converge into a small X, sharing one hit set. Only the leading strip gets the white/live lip; the other is `≤40%` body alpha. Legacy mode uses one live blade ribbon and treats the second as a dim within-band echo. |
| `0.54–0.74` pass-through | Hands make two tiny `≤0.10H` alternating catch motions behind the contact point while the torso remains committed. These are recoil, not new strikes. | Trailing leg is the widest part of the silhouette; body settles to `0.18H F`. | No repeated lip, spark, hit-stop, or damage-looking restart. The live band completes the one server sweep. |
| `0.74–0.86` violent pullout | Both hands retract `0.22H`; shoulders overshoot backward and the body rebounds to `0.06H F`. | Rear foot lands first and catches the body. | Both hand springs receive bounded backward velocity. One confirmed-hit spark may fire at the single accepted contact identity. |
| `0.86–1.00` split guard | Daggers finish wide and low, making the end silhouette distinct from D1’s cross guard. | Return attack offsets to identity. | PER fully gone. |

Top-down read: a narrow spearhead body with a dramatic trailing leg, followed by a tiny X at the target. It must not resemble a spinning sword or a multi-hit blender.

## Claw and worn-blade language — feral shoulder rakes

Claws are not precision knives. Their read is **elbows wide, shoulder first, several parallel tearing marks, low predatory finish**. The hand still reaches at least one body height, but the path retains more lateral drag and a rougher recovery.

### C1 — Lead-hand “Shoulder Rake”

| Phase | Pose and silhouette | Reach / legs | PER and truth |
|---|---|---|---|
| `0.00–0.10` open coil | Lead claw opens high/outside `0.18H N`; shoulder turns back `0.14 rad`; off claw stays low near the ribs. Body crouches to `0.96`. | Rear foot plants wide, lead foot light. | No trail; three short tip glints may fan without leaving the hand. |
| `0.10–0.34` shoulder launch | Body advances first, then the arm whips from outside toward aim. The elbow is implied wide before the hand straightens. | Wendigo budget begins toward `0.21H body + 0.47H arm`. Lead foot reaches `0.18H F`; rear leg kicks `0.08H` outward. | A **three-tooth rake comb**: three parallel ragged wisp strips, `3–4 px` each, total envelope `≤18 px`, short bright caps, longer painted history than daggers. It remains inside the `21 px` server half-width. |
| `0.34–0.52` full tear | Arm reaches a straight line just as the torso/shoulder passes through aim. Hand drags `0.12H` laterally after full reach, never folding back toward the body. | Wendigo contact: `0.21H + 0.47H + 0.46H = 1.14H`. | The comb crosses aim as one damage read. No separate hit per tooth. |
| `0.52–0.62` hooked tail | Wrist/claw hooks only `0.08 rad` while the shoulder stays long; this preserves visible danger until the current pivot descriptor ends. | Contact radius stays `≥1.0H`. | Live cap fades once at active end. |
| `0.62–0.78` rip free | Hand yanks `0.18H` back and `0.10H N`; torso rebounds later than the hand. | Lead foot remains planted, then releases. | Ragged non-live fragments peel off; hand ownership hands backward velocity to jiggle. |
| `0.78–1.00` crossed beast guard | Lead claw finishes across the torso, naturally loading C2. | Low stance, feet still wide. | No bright edge. |

Top-down read: the combed ribbon and wider shoulder/leg silhouette make this a rake, not a dagger thrust. The path has lateral aggression, but the bright tip still reaches beyond one full body height.

### C2 — Off-hand “Back-Rake X”

| Phase | Pose and silhouette | Reach / legs | PER and truth |
|---|---|---|---|
| `0.00–0.09` savage switch | Off claw rises behind the opposite shoulder while the lead claw remains crossed. Body does not pass through neutral. | Weight swaps feet in one sharp beat. | No trail restart. |
| `0.09–0.32` reverse launch | Off shoulder drives forward; body advances `0.20H F` and twists opposite C1. | Wendigo/Knucklebone arm target `0.49H`; plant foot `0.18H F`, rear foot kick `0.10H`. | Target protocol: signed reverse three-tooth comb, crossing C1 into a broad readable X. Legacy mode keeps the one positive authoritative ribbon and uses only pose/shoulder reversal. |
| `0.32–0.50` tear through | Off hand hits full extension; lead hand retracts to a low guard rather than copying the angle. | Knucklebone example: `0.22H + 0.49H + 0.44H = 1.15H`. | Parallel teeth stay narrow enough that the full visual band fits server thickness. |
| `0.50–0.62` shoulder overshoot | Torso rotates an extra `0.08–0.12 rad`; claw remains outside the body. | Keep contact radius honest through descriptor active end. | One fading live cap. |
| `0.62–0.76` snap recovery | Off claw tears back; both elbows then flare to prepare the pounce. | Feet pull into a low spring. | Terminal handoff on the off hand. |
| `0.76–1.00` maul crouch | Chest faces aim, both claws splayed outside the shoulder line. Single-claw users show the free hand low as counterweight. | Body height `0.92–0.94`; no root motion. | No live PER. |

Top-down read: a wider, rougher X than the dagger pair. Dagger X converges at a point; claw X tears across a small torso-width zone.

### C3 — “Pounce Maul” finisher

| Phase | Pose and silhouette | Reach / legs | PER and truth |
|---|---|---|---|
| `0.00–0.16` low stalk | Body drops to `0.88–0.90`; shoulders widen; both claws pull back on unequal diagonals. Single-claw user pulls the free hand forward as a brace. | Feet spread `0.22H N`; rear foot coils. | Dim claw-tip tremor only. Full crouch is a target-protocol anticipation; the legacy-safe fallback must begin visible shoulder motion by the current `0.10` active start. |
| `0.16–0.30` pounce | Body art surges to `0.18H F`; head/shoulder silhouette stays low. Hands lag behind body for the first `0.05`. | Lead foot travels `0.22H F`; rear leg kicks `0.12H` back and `0.10H N`. | Begin one authoritative torn band. |
| `0.30–0.54` twin maul | Body reaches `0.27H F`. Lead claw tears high-to-low; off claw follows by `0.06` on the opposing diagonal. Tips converge inside one `0.18H` contact neighborhood. | Wendigo dominant tip: `0.27H body + 0.45H arm + 0.46H edge = 1.18H`. Rendclaw reduces arm extension to about `0.29H` because its visible blades are longer. | Target protocol: two opposing rake combs with one shared hit set; second comb body alpha `45–55%`, only one live cap at a time. Legacy mode: one comb plus a dim echo inside the `21 px` band. |
| `0.54–0.62` drag lock | Both shoulders stay forward; hands pull apart laterally by `0.10H` while maintaining forward reach. This is the maul hold, not another hit. | Body remains at `0.23H F`. | No new impact pulse. The one live server sweep finishes. |
| `0.62–0.80` recoil flurry | Hands perform one rapid inward/outward recoil of `≤0.08H`, with no forward re-extension. Torso shakes `≤0.035 rad`; rear foot lands hard. | Body rebounds to `0.08H F`. | Painted debris/edge scraps only; no bright ribbons or repeated contact sparks. Both springs inherit backward/lateral velocity. |
| `0.80–1.00` feral finish | Claws finish open and low, torso still crouched at `0.96`, then release to locomotion. | Attack offsets return to identity by `1.00`. | No trail. |

Top-down read: a low triangular predator silhouette, wide shoulders and a high trailing kick. It is more horizontal and ragged than the dagger pounce, with a wider X and no needlepoint freeze.

## PER ribbon direction

The canonical renderer currently offers painted `blade`, `twin`, and `thrust` profiles. It samples the base `SwingDescriptor`; the local combo enrichment occurs inside `SpriteRig`, so `VfxPlayer` does not receive combo step or direction. In addition, current `twin-slash` is a delayed second lobe on the same angular path, not two signed diagonals. `routePlayerAttacks()` now reconstructs remote rig swings from `attackTick`, but `spawnSlash()`/`playSwing()` still run from the local attack-send path, so remote pose parity does not yet imply remote PER parity. These are the present limits, not art-direction choices.

### Required silhouettes

| Move | PER shape | History / width | Live-edge rule |
|---|---|---|---|
| D1 Long Point | Single narrow blade ribbon ending in a radial needle lip | `8–10 px`, short history (`~0.55 × S`) | One bright tip, aim crossing at the named point. |
| D2 Cross Return | Same narrow strip with signed reverse travel | Short; old D1 may persist only as very faint history | One bright reverse tip. Full X waits for accepted direction. |
| D3 Pounce Stitch | Two converging needle strips, `≤0.18H` apart | Lead full alpha, second `≤40%` | Only one live lip/contact identity. |
| C1 Shoulder Rake | Three parallel ragged wisp strips | Total `≤18 px`, history `0.85–1.0 × S` | Teeth share one cap/contact. |
| C2 Back-Rake X | Reverse three-strip comb | Same width; faint prior diagonal may linger | One signed reverse cap after protocol. |
| C3 Pounce Maul | Two opposing combs converging, then separating laterally | Primary full, second `45–55%`; no restarts | Shared hit set and no second impact pulse. |

The PER origin remains the player root because that is where the server segment starts. For ordinary short weapons, hide the visually empty inner section by beginning opaque paint near the physical tip, while keeping the bright endpoint at authoritative reach. For magical reach outliers, add a continuous elemental tear from claw tip to `R`; never leave an invisible damaging gap.

### Safe presentation before accepted paths

Stage 1 can ship the full body/hand/leg work without making damage less honest, provided that:

- the bright ribbon continues to use the existing centered positive server sweep;
- reverse/X information lives in pose silhouette, dim afterimage, and shoulder direction—not a second bright damage path;
- dual tips converge within the `21 px` authoritative band during the finisher;
- the finisher produces one contact flash, one hit-stop opportunity, and one damage number per target;
- body/hand/weapon contact is capped by `meleeReach()`.

True signed D2/C2 ribbons, opposing X paths, step-specific active timing, and dual-sweep finishers unlock only when the accepted combo step/path is shared with the server and VFX. The dormant `comboPath` data is the right home, but it is not truth today.

## Dagger-versus-claw parity rules

Both classes receive equal production value—three steps, alternating hands, full-body reach, pounce finisher, leg counterweight, spring recovery—but never the same silhouette.

| Axis | Daggers | Claws / worn blades |
|---|---|---|
| Intent | Surgical penetration and exact seam cutting | Predatory tearing and dragging |
| Torso | Taller, narrower profile; `0.14–0.24H` advance | Lower, wider shoulders; `0.20–0.27H` advance |
| Arm path | Straightens early, narrow lateral offset | Elbow opens wide, then straightens into a lateral drag |
| Contact | Small point or tight X | Torso-width rake zone / ragged X |
| Weapon pose | Point leads; off dagger guards center | Talons fan; off claw stays low/wide |
| PER | One narrow strip and bright needle lip | Three-tooth comb, ragged painted history |
| Recovery | Clean pullout and precise cross guard | Rip-free yank, shoulder overshoot, open feral guard |
| Finisher | Narrow pounce, one stitched contact | Low pounce-maul, converging twin rakes |

If VFX is disabled, a still image at anticipation, contact, and recovery must still identify the class.

## Acceptance and capture checklist

### Pose truth

- At named contact, root-to-bright-contact distance is `≥76 px` and `≤meleeReach - 3 px` for every relevant weapon.
- The striking hand is visibly farther along `F` than its resting point; no accepted frame may consist only of weapon rotation.
- Shoulder, hand, and point form one readable line at full extension.
- Twin Bowie and Cinderfang visibly alternate lead/off hands on steps 1/2; step 3 uses both.
- Wendigo/Knucklebone alternate hands; Rendclaw/Wyrmscale reuse their one weapon without inventing an off-hand copy.
- Worn art remains over the hand with origin `0.4`; held daggers and Frostfang retain held pivots.

### Full-body weight

- Body art advances at least `0.14H` for daggers and `0.20H` for baseline worn claws, adjusted downward only when longer weapon art fills the honest reach budget.
- A plant foot is established before full extension, and the trailing leg kick is visible at all four cardinal aims.
- The root and hurtbox never translate for this presentation pass.
- Shadow follows less than the paper body and returns to baseline without a pop.

### Ownership and recovery

- The selected hand is at combat ownership `1` throughout the dangerous pose; non-striking hand remains physical.
- The hand retracts before ownership release and enters the spring at `≤120 px/s` local terminal velocity.
- No one-frame jump occurs at active end, combo hold, grace expiry, facing flip, weapon swap, down/death, or procedural-jiggle LOD rebase.
- Weapon and hand remain coincident through spring overshoot; the worn mount never lags independently.

### VFX and network parity

- With PER off, every move remains legible.
- With PER on, no opaque or bright edge exceeds authoritative range.
- Before accepted paths, reverse steps do not display a bright signed path that the server is not sampling.
- Finishers show one authoritative contact, even when two hands or several claw teeth are visible.
- Local prediction and remote accepted rendering show the same semantic hand order during an uninterrupted chain.
- After the accepted-sequence protocol lands, test packet coalescing/reconnect and assert the server-provided combo step, rather than reconstructed cadence, selects the hand and PER direction.

### Required captures

Capture each of the six moves at `t = 0`, anticipation end, active start, aim crossing/contact, active end, ownership release, and `t = 1` for:

- aim left, right, up, down, and both diagonal quadrants;
- both character facings;
- Swift/base/Heavy cooldowns;
- local prediction and remote accepted playback;
- PER disabled and enabled;
- Twin Bowie, Cinderfang, Frostfang, Wendigo, Knucklebone, Rendclaw, and Wyrmscale;
- idle and full locomotion, including a hard turn immediately before attack;
- confirmed hit, whiff, and finisher contact.

Reject the pass if the hand can be covered and the move still appears unchanged, if a claw reads as a precision dagger, if a dagger reads as a broad sword crescent, or if any bright mark promises space the authoritative edge cannot hit.

## Production order

1. **Classification:** route held daggers and held claw-rakes through explicit combat variants; do not broaden `isWornWeapon` to solve animation.
2. **Reach pass:** add body, hand, and foot targets using the adaptive `B + A + W` budget. This is the player-feedback fix.
3. **Recovery pass:** preserve exact combat ownership and tune terminal-velocity jiggle handoff.
4. **Legacy-safe PER:** one centered live path, class-specific narrow needle versus claw comb, one finisher contact.
5. **Accepted combo protocol:** sync combo step/variant and let remote/local/VFX consume the same snapshot.
6. **Authoritative path unlock:** enable signed reverse sweeps, true X ribbons, and shared-hit-set dual finishers. Only then advertise the complete cross-slash/flurry geometry as WYSIWYG.

The non-negotiable first milestone is simple: on every dagger or claw attack, the arm and shoulder must visibly travel with the weapon, and the connected strike point must land at least one full body height from the character without outrunning the server’s real edge.
