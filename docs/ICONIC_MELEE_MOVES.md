# Dimension Drifters - Iconic Melee Move Catalog

## Decision

The strongest signature for Dimension Drifters is the **hammer-head fulcrum front-flip into a quake slam**. It turns the paper-doll limitation into the trick: the character and haft rotate *through* the picture plane, represented by signed scale through zero, while the grounded shadow and planted hammer head prove that the apparent vertical motion is intentional. It should replace step 3 only for **two-handed quake maulers**, not every `chop` weapon.

The next best additions are a DMC-style Stinger, a charged one-revolution Zelda spin, and a Dragon's Dogma-style pommel bash. They give thrust, one-handed sword, and heavy two-handed families distinct punctuation without requiring new art. Monster Hunter's True Charged Slash is valuable but needs a dedicated two-handed greatsword override; Leviathan recall and Bloodborne morph attacks are larger weapon-state features, not pose branches.

The camera test used here is strict: at the anticipation endpoint, contact frame, and recovery hold, the move must still be identifiable from a straight-down capture with VFX disabled. Trails, rings, quake art, and hit-stop may reinforce the silhouette, but may not create it.

## Current system and production constraints

### What already exists

- The shared vocabulary has five three-step combo families (`arc`, `chop`, `rake`, `punch`, `thrust`), thirteen motion names, authored timing fractions, hand ownership, and dormant path metadata (`packages/shared/src/melee.ts:31-77`, `packages/shared/src/melee.ts:79-311`).
- Style resolution is shared: authored style wins, then worn gear, quake, piercing family, two-handed, and ordinary arc fallbacks are applied in that order. This means a two-handed quake weapon already resolves to `chop`, while an ordinary two-handed greatsword resolves to `orbit` (`packages/shared/src/melee.ts:334-343`).
- `SwingDescriptor` currently carries effective cooldown, style, pose duration, active start/end, and one impact time, but **not combo family, step, motion, signed path, or weapon state** (`packages/shared/src/melee.ts:313-323`). The style clock is built at `packages/shared/src/melee.ts:351-392`; the server still advances a centered positive blade sweep with `bladeAngleAt()` at `packages/shared/src/melee.ts:395-410`.
- The client predicts its combo step from accepted-cadence timing and snapshots the in-flight step/direction (`packages/client/src/entities/SpriteRig.ts:187-202`, `packages/client/src/entities/SpriteRig.ts:465-510`). It samples normalized pose time as `tt = elapsed / poseSeconds` and dispatches the style pose at `packages/client/src/entities/SpriteRig.ts:758-798`.
- The current pose branches already supply useful pieces: chop lift/drive/squash (`packages/client/src/entities/SpriteRig.ts:807-881`), thrust draw/extension/stick (`packages/client/src/entities/SpriteRig.ts:1069-1115`), signed arc and overhead finishes (`packages/client/src/entities/SpriteRig.ts:1117-1187`), hand-carried weapon offsets and two-handed haft reconstruction (`packages/client/src/entities/SpriteRig.ts:1214-1269`), and orbit foreshortening/depth swaps (`packages/client/src/entities/SpriteRig.ts:1291-1409`).
- The fake-height precedent is sound: visible parts lift while the shadow remains grounded, then the shadow shrinks/fades with height (`packages/client/src/entities/SpriteRig.ts:1412-1434`). The signature moves below need an **attack lift channel** separate from networked `hopPx`, so combat posing does not pretend the player is airborne to gameplay.
- Stage 1 is still presentation-only. The shared step comments explicitly call the path fields dormant (`packages/shared/src/melee.ts:33-35`, `packages/shared/src/melee.ts:69-76`), and the rig notes that reverse/dual/overhead poses still receive the server's one centered positive sweep (`packages/client/src/entities/SpriteRig.ts:797-798`). The server constructs the real descriptor only when `canAct` accepts an attack (`packages/server/src/rooms/GameRoom.ts:1969-1975`) and stores only aim, range, arc, damage, and a hit-once set (`packages/server/src/rooms/GameRoom.ts:2223-2248`).

### Straight-down paper-craft rules

1. **Ground-plane travel uses position and screen rotation.** A slash around the character is an ellipse, not a circle: the existing orbit uses vertical squash `SQ = 0.34`, length foreshortening, and a far-side depth swap (`packages/client/src/entities/SpriteRig.ts:1297-1346`, `packages/client/src/entities/SpriteRig.ts:1387-1393`). Reuse that math for yaw around the body.
2. **Height uses art-shadow separation.** Move all visible rig parts upward by an attack-local `zPx`; move the shadow only along the ground path. At the apex, shrink and fade the shadow. Do not move `root`, because its position is the authoritative ground/depth position.
3. **Pitch through the picture plane uses signed scale.** For a pitch angle `phi`, use `paperY = signedClamp(cos(phi), 0.12)`. The art narrows edge-on, mirrors while inverted, narrows again, and returns upright. Pair it with `z = peak * sin(pi * p)` over a complete vault. Never apply this to `root`: `root.scaleY` is reset to the uniform character scale and the label counter-scales there (`packages/client/src/entities/SpriteRig.ts:669-681`). Apply it to body/hands/feet/weapon only; leave label and shadow readable.
4. **A weapon rotating through the plane foreshortens along its own length.** The ordinary weapon pass currently restores uniform scale every frame (`packages/client/src/entities/SpriteRig.ts:1401-1409`), so add a per-frame signed `weaponLengthScale` and compose it in that pass. A planted-tip move must solve grip position backward from the fixed head/tip, rather than letting the sprite ride the hand.
5. **The shadow is a pose participant, not an altitude meter only.** It may rotate, stretch along aim, shift to the planted foot, or squash at contact. Its final jump update currently overwrites scale and alpha (`packages/client/src/entities/SpriteRig.ts:1431-1434`); multiply jump and attack shadow channels instead of setting either one last.
6. **Large body displacement requires authority.** Hand/weapon offsets may exaggerate reach cosmetically. Moving the entire visible character farther than roughly `0.25H` from the root creates a false hurtbox. A true Stinger dash or recall strike needs an authoritative ground path, not just a displaced paper doll.

### Notation used in the ship specs

- `t = clamp(elapsedSeconds / swing.poseSeconds, 0, 1)`. Every fraction below is relative to the accepted/predicted `SwingDescriptor.poseSeconds`, not raw wall-clock milliseconds.
- `H = TARGET_BODY_H = 76 px` (`packages/client/src/entities/SpriteRig.ts:36-37`).
- `F = (cos(aimLocal), sin(aimLocal))` is forward and `N = (-sin(aimLocal), cos(aimLocal))` is rightward in rig-local screen space. `qH F + rH N` means an offset of `q` body heights forward and `r` sideways.
- `z` is fake height: subtract `z` from every visible part's screen `y`; do not subtract it from the shadow.
- Scale values multiply the frame's existing gait/look/recoil scale. Rotation values are additive. Weapon angle is absolute unless marked additive.
- `ease` means smoothstep unless a row names another curve. `signedClamp(x, m) = sign(x) * max(abs(x), m)` prevents a one-frame invisible sprite while preserving the through-plane mirror.

### Implementation-size key

- **S** - one rig envelope or modifier; no new shared schema, server path, state, or art. About one engineering day including captures.
- **M** - one shared motion/step plus one rig branch, reusing an existing authoritative path shape. Two to four days including pure pose tests and both facings.
- **L** - a new descriptor/path shape or accepted movement plus rig/VFX/server tests. Roughly one to two engineering weeks.
- **XL** - new persistent weapon state, protocol ownership, alternate art/pivots, or outbound/return projectile lifecycle. Multi-system feature, two or more weeks.

Sizes describe a production-honest move, not a client-only imitation.

## Catalog scorecard

| Reference | Straight-down read | Best Dimension Drifters home | Size | Verdict |
|---|---:|---|---:|---|
| Monster Hunter Great Sword - True Charged Slash | A- | 2H greatsword, step 3 finisher | L | Ship after a greatsword family override exists |
| Dark Souls ultra-greatsword pancake | A | Ultra-greatsword `chop`, step 3 alternate | M/L | Strong reaction move; visually overlaps slam finishers |
| Zelda spin attack | A+ | 1H sword `arc`, step 3 finisher/special | L | Ship; specifically not the current Garen spin |
| Bloodborne trick-weapon transform attack | B+ | Morph-capable weapon, step 2 and/or 3 | XL | Prototype only after alternate-form art/state exists |
| Hades-style special lunge | A | Light spear/rapier `thrust`, step 1 or 2 | M | Good family bread-and-butter, less signature than Stinger |
| God of War Leviathan axe recall | A+ | Recallable thrown axe, outside melee cycle | XL | High-value feature, separate milestone |
| Devil May Cry Stinger | A+ | Long sword/spear `thrust`, step 3 | L | Ship early; current thrust is a strong base |
| Smash forward-smash windup lean | A | Heavy finisher anticipation modifier | S | Ship as a reusable grammar layer, not a named move |
| Dragon's Dogma Pommel Bash | A | 2H sword/warhammer, step 2 | M/L | Ship; fast contrast inside slow combos |
| Dead Cells/director hammer fulcrum flip | A+ | 2H quake mauler `chop`, step 3 replacement | L | First signature move to build |

## Detailed catalog

### 1. Monster Hunter Great Sword - True Charged Slash

**(a) Iconic silhouette beat.** The identity is not merely "large overhead chop." It is the long, dangerous stillness of the charge; the greatsword loaded behind the hunter; a committed step-in/weight transfer; then the whole body collapsing behind a narrow, enormous down-cut. The planted end pose is as important as the fall. The official move language establishes a three-level charged chain culminating in True Charged Slash; for this project, the useful extract is **charge -> step-in -> decisive planted line**, not Monster Hunter's entire input sequence.

**(b) Straight-down paper-craft recipe.** Put the sword behind the body and briefly below it in depth during charge. Separate both hands visibly along the haft. Let the plant foot and shadow advance `0.14-0.18H` down `F` before the torso follows. On the lift, reduce weapon length toward `0.20x` so the blade appears edge-on above the character, then restore it rapidly on the down-cut. The torso stretches to `1.06y` at the end of charge, compresses to `0.86y` at contact, and holds. A two-frame tip recoil (`1.00 -> 0.94 -> 1.00` length) is enough blade flex; do not bend the painted sprite. Keep the damage silhouette narrow and forward. A giant circular VFX would turn it back into a generic quake.

**(c) Family/combo home.** **Two-handed greatsword, combo step 3 finisher**, replacing that variant's ordinary step 3. Do not change every `orbit` weapon: ordinary two-handed definitions fall into orbit today (`packages/shared/src/melee.ts:341-342`), and orbit is also used by anchors, spades, lids, and polearms. Add a weapon-level combo override or a dedicated `greatsword` family. Its step should be something like `charge-step-slam`, active `0.46-0.64`, impact `0.61`, follow end `0.80`, with a narrow forward fan/capsule and one hit per enemy.

**(d) Implementation size.** **L.** The pose is M, but a production version needs weapon-specific family selection, step timing in the accepted descriptor, and a narrow authoritative path instead of the current generic centered sweep. It can reuse two-hand reconstruction and most chop/orbit projection code.

### 2. Dark Souls ultra-greatsword pancake

**(a) Iconic silhouette beat.** A weapon with absurd inertia rises almost vertically, pauses at the impossible top, and drops in one committed line. The attacker ends folded over the weapon while the victim is flattened or knocked down. The "pancake" identity comes from the **vertical line plus victim reaction**, not from swing breadth.

**(b) Straight-down paper-craft recipe.** Start with the weapon broadside and readable behind one shoulder. As it rises out of the ground plane, drive its signed length toward `0.16x` and move it above the body in depth; at the apex only the head/pommel width should remain. Restore full length in 5-7 frames while pulling both hands and chest down `F`. At contact, body `scaleY *= 0.84`, body `y += 0.08H`, the shadow widens to `1.20x` and flattens to `0.72y`, and the weapon stays buried for at least `0.12` of the pose. If the target supports reactions, squash its paper body to `0.72y` for 90-120 ms and recover through a side roll; otherwise call it a "crusher," not a pancake.

**(c) Family/combo home.** **Ultra-greatsword `chop`, combo step 3 alternate**, replacing `execution-slam` for named heavy swords. It can also be the non-quake counterpart to the hammer flip. Preserve the current `fan`/knockback concept on the shared chop finisher (`packages/shared/src/melee.ts:157-170`), but narrow the visual fall and let the landing fan provide forgiveness.

**(d) Implementation size.** **M** for attacker-only animation using the existing chop finisher; **L** if "pancake" includes authoritative knockdown and a target reaction. Its main disadvantage is portfolio overlap: the hammer flip and TCS already occupy two premium heavy step-3 slots.

### 3. Zelda spin attack

**(a) Iconic silhouette beat.** A compact charged guard stores energy, then Link releases exactly one clean circular cut and lands in a readable exit pose. The circle is a punctuation mark.

**How it differs from the existing Garen spin.** Dimension Drifters' current `spin` is an authored whirlwind: full revolutions, body mirror-turns, full-pose activity, and chained attacks that deliberately remove spin-up so repeated presses become one continuous motion (`packages/client/src/entities/SpriteRig.ts:1316-1329`, `packages/client/src/entities/SpriteRig.ts:1360-1378`). Zelda's move is **charge-and-release, one revolution, one burst, then recovery**. It must have an anticipatory tuck and a hard exit. Reusing `style: "spin"` would erase that difference because the descriptor makes spin active from `0` to `1` (`packages/shared/src/melee.ts:378-380`).

**(b) Straight-down paper-craft recipe.** During charge, tuck the sword close to the hip, move the front hand `-0.12H F + 0.10H N`, counter-extend the off hand, compress the torso to `0.90y`, and bias the shadow toward the rear foot. On release, reuse the waist-orbit ellipse and far-side depth swap, but run one angle from `theta0` to `theta0 + 2pi` over `0.30-0.66`. Drive torso `scaleX` through signed profile once, not continuously. Keep the shadow centered and grounded: this is rotation, not flight. Finish with sword extended `0.20-0.30 rad` past the start and the torso still twisted for `0.10` of the pose.

**(c) Family/combo home.** **One-handed sword `arc`, combo step 3 finisher** for sword/shield and selected light blades, or an explicit charged special outside the automatic three-hit loop. If it replaces the current overhead diagonal (`packages/shared/src/melee.ts:113-126`), add `motion: "spin-release"` and a full-circle signed path that shares one hit set. Do not give it to cleavers, whips, or all arc weapons.

**(d) Implementation size.** **L.** Client motion can reuse orbit machinery, but the server needs a full-circle path on a non-whirlwind step, and family selection must distinguish one-handed swords from generic arc weapons.

### 4. Bloodborne trick-weapon mid-combo morph

**(a) Iconic silhouette beat.** The weapon changes reach and mass *during an attack*, and the transformation mechanism is itself the strike. A compact form snaps long through a target, or a long form collapses while the hunter uses the changing leverage to continue the combo. The key beat is not a dissolve; it is a mechanical silhouette change with uninterrupted momentum.

**(b) Straight-down paper-craft recipe.** Author two real forms with their own grip pivots, display lengths, and hand spacing. During the transform hit, collapse form A's weapon length through `0.12x`, swap frame/pivot at the edge-on instant, and expand form B from `0.12x` while the hands slide to the new grips. Use 2-3 bright joint sparks at the hinge, not a full-body flash. Depth-swap the extending section behind/in front of the torso as appropriate. The body path must continue monotonically through the swap; if the torso resets at the frame change, the move reads as an equipment pop.

**(c) Family/combo home.** **Morph-capable named weapon only.** A natural cycle is step 1 in compact form, step 2 transform-out attack, step 3 heavy transformed finisher, then the next step 1 transform-back. Another valid weapon can transform on step 3 only. This should be data-authored per weapon, not added to `arc` globally.

**(d) Implementation size.** **XL.** `WeaponDef` has one held sprite/display length/grip and no alternate form state (`packages/shared/src/weapons.ts:17-58`). This needs form art, two pivots, server-owned form state, accepted combo/form reconciliation, and rig-safe hot swapping. A scale crossfade without two mechanically different forms is not a Bloodborne move.

### 5. Hades-style special lunge

**(a) Iconic silhouette beat.** In top-down action language, the Hades lunge is a compressed read: tiny directional tell, a bright weapon-leading line, the character arriving behind it, and a short recovery that keeps combat flowing. The reference phrase is best treated as a **top-down lunge grammar**, not one universal player Special; Hades separates attack, Special, and dash, and its spear/boss lunges use several different mechanics.

**(b) Straight-down paper-craft recipe.** Freeze aim. Pull the hand back only `0.10-0.14H`, narrow the torso in profile, then drive the weapon tip first along `F`; the hand, shoulder, body art, and shadow follow in that order at 2-3 frame offsets. Use a single narrow smear on the tip. Keep vertical squash small (`0.94y`) and recovery short. A Hades-like lunge should feel cancel-friendly even if Dimension Drifters does not add animation cancel rules.

**(c) Family/combo home.** **Light spear/rapier `thrust`, combo step 1 or 2**, replacing `outside-line lunge` for fast weapons or providing a brisk variant of it. The existing thrust step 1 already has draw `0.00-0.14`, active extension `0.14-0.42`, impact `0.42`, and follow end `0.50` (`packages/shared/src/melee.ts:267-280`), so the main gain is staggered body arrival and a sharper exit.

**(d) Implementation size.** **M** if root position remains authoritative and the visible body offset stays under `0.25H`; **L** if the move actually advances the player. It is an excellent baseline family move but less individually ownable than Stinger.

### 6. God of War Leviathan axe recall

**(a) Iconic silhouette beat.** The empty hand is offered before the weapon arrives. The axe streaks back from elsewhere, spins into the palm, and the catch sends a visible jolt through wrist, shoulder, chest, and stance. The recall and catch are separately emphasized; the return can also strike enemies from behind.

**(b) Straight-down paper-craft recipe.** Hide the in-hand weapon after the throw. Hold the front hand open `0.18H` along the incoming direction, turn the torso slightly toward the return path, and render the actual projectile on a shallow curved world-space path. During the last `0.08` of normalized recall, reduce spin, orient the grip to the hand, and transfer rendering from projectile container to rig weapon on one catch frame. On that frame: hand recoil `-0.07H F`, body rotation `-0.12 rad` against the incoming tangent, body `scaleY *= 0.93`, shadow stretch `1.15x` along the catch, then settle. The weapon must never appear both in flight and in hand.

**(c) Family/combo home.** **Recallable thrown axe; outside the melee three-step cycle.** Recall can be a second press, automatic when charges empty, or a named augment. If it damages on return, it is an outbound/return projectile action with one hit set per leg, not an `arc` swing. It can feed a catch follow-up into melee step 1.

**(d) Implementation size.** **XL.** Dimension Drifters already has thrown definitions and charge/refill data (`packages/shared/src/weapons.ts:63-82`), an authoritative thrown branch (`packages/server/src/rooms/GameRoom.ts:1949-1960`), and a spinning cleaver renderer (`packages/client/src/scenes/ArenaScene.ts:2166-2206`, `packages/client/src/scenes/ArenaScene.ts:2278-2300`). But projectiles expose no owner or outbound/return phase (`packages/shared/src/state.ts:239-253`), the server fires a disposable straight projectile (`packages/server/src/rooms/GameRoom.ts:2998-3017`), and the client currently triggers an in-hand swing for every non-gun including thrown weapons (`packages/client/src/scenes/ArenaScene.ts:3553-3578`). Recall requires lifecycle and protocol work, not just a tween.

### 7. Devil May Cry Stinger

**(a) Iconic silhouette beat.** The sword point appears to pull the fighter across the floor. Feet trail or skate, the body is a narrow line behind the blade, and the attack ends in a hard extended impale rather than a sweep.

**(b) Straight-down paper-craft recipe.** Lock the weapon to `aimLocal`. Start with a small backswing and profile compression; extend the front hand first, then move all visible body parts up to `0.25H` down `F` while the grounded shadow lags at `0.15-0.18H`. Stretch the shadow along the dash and rotate it to aim. At full reach, keep both hands and sword fixed for `0.10-0.12` of the pose, recoil weapon length to `0.96x`, then pull the body back to the authoritative root during recovery. The tip must remain a full broadside silhouette at contact; foreshortening it there makes the move look like a shoulder check.

**(c) Family/combo home.** **Long sword/spear `thrust`, combo step 3 finisher**, replacing `step-through impale` for selected weapons. The existing step 3 timing and both-hand drive are already close (`packages/shared/src/melee.ts:296-309`; rendered at `packages/client/src/entities/SpriteRig.ts:1072-1115`). Keep active `0.24-0.58`, impact/full reach `0.58`, stick to `0.70`, then pull out. Use the dormant `capsule` path, not a fan.

**(d) Implementation size.** **L** for an honest move because the server must consume a growing capsule and, if the body travels beyond the cosmetic allowance, accepted movement. **M** for the restrained `0.25H` visual version once capsule paths are already online.

### 8. Smash forward-smash windup lean

**(a) Iconic silhouette beat.** A forward smash makes the future hit legible by leaning mass *away* from the target and holding an asymmetric charge pose, then reversing the whole silhouette through the target. The held lean is a targeting promise.

**(b) Straight-down paper-craft recipe.** On heavy finishers, shift the chest `-0.06H F + 0.06H N`, shift hands farther back, rotate the torso `0.12-0.18 rad` away from the swing, compress to `0.92y`, and pin the shadow to the rear plant foot. Hold most values steady; only a 1-2 px weapon tremor and subtle shadow pulse should move during charge. Release with a one-frame counter-move (`-0.02H F`) followed by fast acceleration through neutral. This pose works because the rest of the game moves constantly; do not over-animate the windup.

**(c) Family/combo home.** **Reusable heavy-finisher anticipation modifier**, especially `arc` step 3, `chop` step 3, heavy `punch` step 3, and TCS. It is not a separate weapon family. Add it as a pose helper/envelope selected by `size: L/XL`, two-handed, or an authored `smashWindup` flag.

**(d) Implementation size.** **S.** It changes body/hand/shadow anticipation only and can leave timing and geometry intact. This should be built as part of the first signature pass even though it is not ranked as a standalone ship move.

### 9. Dragon's Dogma Pommel Bash

**(a) Iconic silhouette beat.** A huge sword or warhammer abruptly retracts and the "wrong" end punches forward. The blade/head remains conspicuously behind the user while a tiny, fast hilt strike makes the target reel. Speed contrast is the point: it is a quick opening tool inside a slow Warrior kit.

**(b) Straight-down paper-craft recipe.** Keep the weapon broadside so viewers can see the heavy end trailing. Slide both hands and grip `0.20-0.25H F` while the business end counter-swings behind the torso. Collapse hand separation from `0.42H` toward `0.24H` for the short hilt punch, drive the shoulder only `0.08H`, and plant the shadow under the forward foot. Contact comes from the grip/pommel point near the hands, so use a small spark/ring there; a blade-tip trail would communicate the opposite attack. Recover to the loaded overhead guard for step 3.

**(c) Family/combo home.** **Two-handed greatsword or warhammer, combo step 2**, replacing `reverse rising cut` only for a `pommel` variant: shoulder chop -> pommel bash -> TCS/pancake/hammer flip. It needs a short grip-centered capsule, reduced damage, and high stagger/guard-break. The present path data has damage and knockback but no stagger field (`packages/shared/src/melee.ts:69-76`), so gameplay identity needs one additional authoritative result.

**(d) Implementation size.** **M** as a pose using ordinary hit/knockback; **L** with real stagger/guard break. It is still a strong early ship because the client work is localized and it dramatically improves heavy combo rhythm.

### 10. Dead Cells/director hammer fulcrum front-flip

**(a) Iconic silhouette beat.** The hammer head bites into the ground ahead of the character. Hands and body overtake the planted head as though the haft were a vaulting pole; the character turns fully through the picture plane; then body and hammer reunite in a super slam. The three poster frames are **head planted/body behind**, **body inverted above and past the head**, and **body crushed over a buried hammer**.

**(b) Straight-down paper-craft recipe.** This is the move that most needs concrete fake-3D rather than screen rotation:

- Fix a head point at approximately `0.52H F`. Solve the grip backward from that point and the weapon's signed projected length. Do not use the ordinary "weapon rides hand" pass during the plant/vault.
- Over vault progress `p`, use body pitch `phi = 2pi * ease(p)`, visible-part `scaleY *= signedClamp(cos(phi), 0.12)`, and `z = 0.40H * sin(pi * p)`. At quarter/three-quarter progress the doll is edge-on; at the apex it is fully mirrored/inverted and farthest from its shadow.
- Rotate the haft through its vertical plane with signed length `lambda = signedClamp(cos(pi * p), 0.16)`. With the head fixed, compute `grip = head - F * businessLength * lambda`; this makes hands cross the fulcrum instead of orbiting randomly in screen space.
- Let the shadow follow only the ground component to about `0.22H F`; at the apex use `0.58x` size and `0.55` alpha multiplier. On landing, widen it to `1.22x`, flatten it to `0.74y`, and restore full alpha for the contact frame.
- Release the head anchor late enough to lift into the final blow, then restore weapon length to `1.0` and drive the head to `0.54H F` at impact. Body `scaleY` lands at `0.82`, both hands remain on the haft, and the buried pose holds for at least `0.12` of the descriptor.

**(c) Family/combo home.** **Two-handed quake maulers, `chop` combo FINISHER replacing step 3.** This is intentionally narrower than `def.quake -> chop`: one-handed quake gauntlets and non-mauler quake swords keep their current finishers. Add `motion: "fulcrum-flip"` and select it from a weapon-level combo variant. Proposed timing: plant `0.00-0.18`, vault/load `0.18-0.50`, active super-slam `0.50-0.66`, impact `0.66`, buried follow `0.66-0.82`, wrench/recover `0.82-1.00`. Quake must detonate at the step impact rather than the global `0.52`; the current quake queues `swing.impactSeconds` (`packages/server/src/rooms/GameRoom.ts:2309-2324`) and the client does the same (`packages/client/src/scenes/ArenaScene.ts:3601-3624`), so the descriptor must carry the accepted step's impact.

**(d) Implementation size.** **L.** No new character art is required, but it needs a new combo variant, per-part signed pitch, an attack lift/shadow channel, planted-head inverse placement, a later accepted impact, and an impact fan/quake test. The exact Dead Cells attribution in the brief should be treated as production shorthand: public reference material clearly identifies Flint as a charged warhammer, but the implementer should follow the director-specified fulcrum-vault silhouette above rather than assume a one-to-one Flint frame extraction.

## Integration checklist and tests

### Shared/server

- Extend `MeleeComboMotion` at `packages/shared/src/melee.ts:37-50` and author variant steps near the existing family entries, without replacing the defaults for unrelated weapons.
- Either extend `SwingDescriptor` at `packages/shared/src/melee.ts:316-323` or add an accepted `MeleeActionDescriptor` containing `{ comboStep, motion, active/impact timing, paths, movement }`. The descriptor must be frozen at the server acceptance point, not trusted from the attack payload.
- Keep the hit-once contract in `GameRoom.meleeSwings` (`packages/server/src/rooms/GameRoom.ts:395-409`). Full-circle spin, dual paths, flip fan, and return legs must state explicitly whether they share or separate hit sets.
- Generalize sampling at `packages/server/src/rooms/GameRoom.ts:2365-2437`: signed sweep uses absolute angular distance for sample count; capsule samples radial growth; fan samples its authored landing window; accepted movement collision-resolves before committing player position.
- Quake step impact must replace the global descriptor impact for signature finishers. Today both peers correctly schedule from `impactSeconds`; preserve that single clock and change its accepted value, not the timer call sites.

### Rig

- Snapshot variant/motion with the existing `swingStep` and direction so timeout cannot rewrite an in-flight signature (`packages/client/src/entities/SpriteRig.ts:187-202`).
- Add special-motion dispatch before the broad style branch at `packages/client/src/entities/SpriteRig.ts:783-807`; otherwise a `fulcrum-flip` still falls into ordinary chop and a `spin-release` into ordinary arc.
- Maintain the invariant that hands own ordinary weapons (`packages/client/src/entities/SpriteRig.ts:1401-1406`). Break it only for explicitly anchored-tip phases, then solve hands from the weapon grip and return ownership cleanly on the following phase.
- Preserve minimum visible two-hand spacing during foreshortening, following the orbit precedent at `packages/client/src/entities/SpriteRig.ts:1347-1358`.
- Do not sign-flip the root or label. Apply pitch to visible parts only and restore every multiplier to identity at `t=1`, weapon swap, death/down, timeout, and interrupted prediction.

### Capture matrix

For each shipped move, capture `t=0`, anticipation end, active start, impact/aim crossing, active end, follow end, and `t=1` with:

- aim left/right/up/down and both character facings;
- Swift and Heavy effective cooldowns;
- local prediction plus 100/200 ms remote acceptance;
- VFX disabled, then enabled;
- smallest and largest representative weapon art;
- jump occurring immediately before/after the move to prove attack lift composes with `hopPx` and shadow shrink;
- hit-stop on confirmed contact and no hit-stop on whiff.

Reject a move if any boundary pops, either hand leaves a two-handed haft, the shadow lifts with the body, the weapon duplicates, the visual danger precedes the accepted active interval, or the silhouette needs its VFX to be named.

## Reference identity notes

These links anchor move identity and input behavior; the choreography below is an adaptation for Dimension Drifters rather than a frame-copy:

- [Capcom Monster Hunter Generations Great Sword manual](https://game.capcom.com/manual/MH_Gen/en/page-101.html) and [Monster Hunter Now Great Sword help](https://niantic.helpshift.com/hc/en/39-monster-hunter-now/faq/4501-great-sword/)
- [Nintendo Breath of the Wild Explorer's Guide](https://zelda.nintendo.com/breath-of-the-wild/assets/pdfs/ExplorersGuide.pdf)
- [Bloodborne mid-combo transformation attack overview](https://www.gamespot.com/articles/seven-advanced-bloodborne-tips-you-may-have-missed/1100-6426309/)
- [Dead Cells official wiki - Flint](https://deadcells.wiki.gg/wiki/Flint)
- [Leviathan recall animation design summary](https://powerup-gaming.com/2018/05/03/recalling-the-leviathan-axe-god-of-war/)
- [Hades spear/lunge combat reference](https://hades.fandom.com/wiki/Hades/Combat)
- [DMC Stinger move reference](https://devilmaycry.fandom.com/wiki/Stinger)
- [Dragon's Dogma Pommel Bash move reference](https://dragonsdogma.fandom.com/wiki/Pommel_Bash)
- [Smash forward-smash reference](https://www.ssbwiki.com/Forward_smash)
- [Dark Souls 3 combat reaction taxonomy](https://darksouls3.wikidot.com/combat-game-mechanics)

## Ranked SHIP LIST - implementation choreography

### Required shared seam before move work

Do this once rather than hard-coding weapon names inside `SpriteRig`:

1. Add a weapon-level combo selector/variant (for example `comboFamily` plus `comboVariant`) to `WeaponDef`. Current `comboFamilyFor()` sees only resolved style, so every weapon of a style receives the same sequence (`packages/client/src/entities/SpriteRig.ts:50-57`).
2. Add the selected `comboStep`/motion and step timing/path to the accepted descriptor. `triggerSwing()` currently selects a client-predicted step after it receives a descriptor (`packages/client/src/entities/SpriteRig.ts:481-503`), while the server descriptor has no step field. Server acceptance must remain the authority.
3. Generalize server path sampling from only `bladeAngleAt(aim, arc, p)` (`packages/server/src/rooms/GameRoom.ts:2417-2437`) to the already-authored `sweep`, `fan`, `dual-sweep`, and `capsule` kinds. Preserve the existing `hit` set so full circles and multi-path moves still hit each enemy once.
4. Add resettable client channels beside the existing swing offsets (`packages/client/src/entities/SpriteRig.ts:734-743`): `attackArtOff`, `attackLiftPx`, per-part `attackScaleY`, `weaponLengthScale`, `weaponDepth`, and attack shadow position/rotation/scale/alpha. Blend them through the existing combo release path (`packages/client/src/entities/SpriteRig.ts:1190-1205`).
5. Apply visible-part lift after hand/weapon placement, as jump lift already does (`packages/client/src/entities/SpriteRig.ts:1420-1429`), but keep attack lift independent of `hopPx`. Compose the shadow channel with jump shrink/fade rather than replacing it.

### 1. Fulcrum Flip Quake - 2H quake-mauler step 3

**Shared step:** `motion: "fulcrum-flip"`, `hand: "both"`, `direction: 1`, timing `{ activeStart: 0.50, activeEnd: 0.66, impact: 0.66, followEnd: 0.82 }`, path `fan`, proposed `arcMultiplier: 1.15`, `rangeMultiplier: 1.08`, `damageMultiplier: 1.25`, `knockback: 110`. Secondary quake damage does not inherit the edge multiplier.

| `t` / phase | Body / visible parts | Hands | Weapon | Shadow / gameplay beat |
|---|---|---|---|---|
| `0.00-0.08` catch | Shift `-0.03H F`; rotate `-0.12*cos(aimLocal)`; `scaleY 1 -> 0.94`. | Both hands close to `0.30H` haft spacing and draw back `0.10H F`. | Swing head toward `Phead = 0.52H F`; full length, above body until the last 2 frames. | Shadow shifts `-0.03H F`, `scale 1.05x/0.92y`. No active damage. |
| `0.08-0.18` plant | Body advances to `0.06H F`, crouch `0.90y`; hold one frame on plant. | Solve both hands from the anchored grip; rear hand remains `0.30H` up the haft. | Head reaches and locks at `Phead`; weapon angle aligns to `F`; small `1.00 -> 0.94` length compression on the bite. Move weapon below body at final plant frame. | Shadow advances to `0.05H F`, flattens `1.12x/0.82y`. Spawn only a small dirt bite, not quake. |
| `0.18-0.50` vault | Let `p=(t-.18)/.32`; ground component `0.06 -> 0.40H F`; `z=0.40H*sin(pi*p)`; multiply every visible part's Y scale by `signedClamp(cos(2pi*ease(p)), .12)`. Add at most `0.08 rad` screen rotation so it reads as a front flip, not a cartwheel. | Follow planted-tip inverse grip. At apex the hands visually cross the head/fulcrum; keep separation at least `0.18H` so both remain visible. | Keep head anchored through `p=.72`. Signed length `lambda=signedClamp(cos(pi*ease(p)),.16)`; grip is `Phead - F*businessLength*lambda`. After `p=.72`, release the anchor and lift the head for the downstroke. | Shadow follows only `0.05 -> 0.22H F`; scale reaches `0.58` and alpha multiplier `0.55` at apex. The root/hurtbox does not leave the ground. |
| `0.50-0.66` super-slam ACTIVE | Finish pitch upright; descend `z -> 0`; ground art returns `0.40 -> 0.28H F`. In last 35% use quadratic acceleration; contact body `scaleY *= 0.82`, `y += 0.08H`, rotation `+0.22*cos(aimLocal)`. | Both hands drive to `0.34H F`; keep rear grip reconstructed, no hand lag on impact. | Restore signed length to `+1`; head lands at `0.54H F`; angle settles to `aimLocal + 0.10`. One-frame length recoil to `0.94` after contact. | At `t=.66`, shadow `1.22x/0.74y`, alpha `1.15`; accepted impact fan, quake, shake, and hit-stop fire here. |
| `0.66-0.82` buried hold | Hold `0.84-0.88y`, body over weapon; only a 2 px recoil breathe. | Lock both hands to haft. | Hold head planted, length back to `1.0`; optional `0.03 rad` vibration decays in 3 cycles. | Shadow settles to `1.08x/0.90y`. Damage is over; quake cannot fire twice. |
| `0.82-1.00` wrench/recover | Ease art ground offset to `0.08H F`, scales/rotation to baseline. | Pull back together, then restore normal `0.42H` haft spacing. | Rotate `-0.18 rad` to wrench free, lift `0.06H`, finish in low guard for combo reset. | Shadow returns to jump-composed baseline. No root teleport. |

**Acceptance capture:** at `t=.34`, the body must be visibly separated from the shadow and either edge-on or inverted; at `t=.50`, it must have passed the planted head; at `t=.66`, head, hands, compressed torso, shadow, quake epicenter, and authoritative impact must coincide.

### 2. Stinger - selected thrust step 3

**Shared step:** replace `step-through impale` for the `stinger` variant. Keep timing `{ activeStart: 0.24, activeEnd: 0.58, impact: 0.58, followEnd: 0.70 }`; `hand: "both"`; path `capsule`, `rangeMultiplier: 1.20`, `damageMultiplier: 1.22`, `knockback: 80`. If player displacement is authorized, cap it at `min(0.35H, 0.22*weapon.range)` and collision-resolve it server-side.

| `t` / phase | Body | Hands | Weapon | Shadow / gameplay beat |
|---|---|---|---|---|
| `0.00-0.12` line-up | Shift `-0.04H F`; profile `scaleX *= .90`, `scaleY *= 1.03`; rotation `-0.08*cos(aimLocal)`. | Front hand draws `-0.12H F`; rear hand closes to `0.30H` spacing. | Absolute angle `aimLocal`; length `0.92`; tip remains visible beside torso. | Shadow shifts `-0.03H F`, rotates to aim, `0.92x/1.04y`. |
| `0.12-0.24` compression | Crouch to `.90y`, counter-move another `-0.02H F`; hold final frame. | Both hands set directly behind tip; no idle/gait lag. | Draw to `-0.18H` hand offset, length `.88`. | Shadow widens crosswise, alpha unchanged. No active hit. |
| `0.24-0.58` dash-thrust ACTIVE | Cubic-out art travel `0 -> 0.25H F`; if server movement exists, root supplies the first part and art offset supplies at most `0.12H`. Torso narrows to `.84x`, remains `.92y`, and arrives 2 frames after hand. | Front hand travels to `0.62H F`; rear hand follows at `35%` of that offset, matching the current both-hand thrust convention (`packages/client/src/entities/SpriteRig.ts:1102-1107`). | Angle locked; length `.88 -> 1.08`, then `1.00` at impact. Tip is the leading silhouette. | Shadow follows only to `0.18H F`, rotates to aim, stretches `1.42x/.66y`. Growing accepted capsule is dangerous. |
| `0.58-0.70` stick | Freeze forward silhouette; body recoil `-0.02H F`, `scaleX .84 -> .90`. | Lock for 2 frames, then pull `0.04H`. | Length `1.00 -> .96 -> 1.00`; angle unchanged. | Shadow snaps to `1.12x/.84y`. Contact hit-stop only on confirmed hit. |
| `0.70-1.00` pullout | Ease art offset to `0.05H F`; scales/rotation baseline. | Pull both hands to a compact outside guard. | Retract along aim, never rotate into a slash; finish at `-0.20` extension guard. | Shadow returns to baseline. |

**Acceptance capture:** the blade tip must lead hand, shoulder, body, and shadow in that order. A side target inside `swingArc` but outside blade width must not be hit once capsule authority is enabled.

### 3. Charged Hero Spin - 1H sword arc step 3

**Shared step:** `motion: "spin-release"`, `hand: "lead"`, timing `{ activeStart: 0.30, activeEnd: 0.66, impact: 0.48, followEnd: 0.78 }`, path `sweep` with `arcMultiplier: 2pi / weapon.swingArc` (store an explicit `deltaAngle: 2pi` rather than this derived form in final data), `rangeMultiplier: 1.03`, `damageMultiplier: 1.18`, `knockback: 64`. One shared hit set across the revolution.

| `t` / phase | Body | Hands | Weapon | Shadow / gameplay beat |
|---|---|---|---|---|
| `0.00-0.18` tuck | Shift `-0.03H F - 0.05H N`; torso rotation `-0.16` opposite release; `scaleY *= .91`. | Lead hand tucks to hip at `-0.10H F + 0.12H N`; off hand opens `-0.10H N` as counterweight. | Sword draws close, angle `aimLocal - 2.15`; length `.94`; render above body. | Shadow pins `-0.04H F - .03H N`, `1.08x/.86y`. |
| `0.18-0.30` charged hold | Almost still: 1 px hand tremor at 18 Hz, body value changes under 2%. | Hold asymmetric silhouette. | Angle changes under `.03 rad`; optional charge glint at tip only. | Pulse scale by at most `+/-3%`; no spin ring yet. |
| `0.30-0.66` ONE REVOLUTION ACTIVE | `p=(t-.30)/.36`; `theta=theta0+2pi*(1-(1-p)^3)`. Multiply torso `scaleX` by signed profile based on `cos(theta)` with floor `.18`; `scaleY *= .91`; add `.05*sin(2theta)` wobble. Exactly one paper turn. | Lead hand rides existing orbit grip ellipse. Off hand stays visibly opposite the blade at `-0.14H` radial, rather than gripping an imaginary haft. | Reuse `SQ=.34`, projected radial length, and far-side depth swap from orbit. Start from tucked angle, cross aim early, finish `0.22 rad` past start. | Centered, grounded shadow `1.14x/.78y`; rotate gently at half weapon angular rate, never shrink/fade. Server advances full-circle signed path only in this interval. |
| `0.66-0.78` overshoot | Stop body turn with torso still twisted `+0.12 rad`; `scaleX` positive and at least `.92`. | Lead hand extends; off hand catches balance. | Overshoot `0.22 -> 0.28 rad`, length full; no second revolution. | Shadow returns to `1.04x/.92y`. Damage ended. |
| `0.78-1.00` exit | Ease to a low cross-body guard, not immediate idle. | Lead hand returns last, preserving follow-through. | Angle settles to opposite-side low guard. | Baseline by `t=1`. |

**Acceptance capture:** charge must read with no VFX; angle traveled during active must be exactly one revolution; body and weapon must end positive-facing so no mirror pop occurs on recovery. Re-triggering starts another charged move, never a seamless whirlwind.

### 4. Pommel Bash - heavy 2H step 2

**Shared step:** `motion: "pommel-bash"`, `hand: "both"`, timing `{ activeStart: 0.12, activeEnd: 0.30, impact: 0.28, followEnd: 0.44 }`, path `capsule`, proposed `rangeMultiplier: 0.55`, `damageMultiplier: 0.75`, `knockback: 28`, plus an explicit high stagger/guard-break scalar if that system is added. It replaces step 2 only for `pommel` heavy variants.

| `t` / phase | Body | Hands | Weapon | Shadow / gameplay beat |
|---|---|---|---|---|
| `0.00-0.12` snatch | Torso rises from step-1 low guard, rotates `-0.10*cos(aimLocal)`, then shifts `0.02H F`. | Both hands slide toward the pommel; haft spacing `.42H -> .24H`. | Keep broadside. Heavy head/blade swings visibly behind body while grip aligns to `F`. | Shadow moves under forward foot `0.03H F`, `0.96x/1.06y`. |
| `0.12-0.30` hilt punch ACTIVE | Shoulder/body drive only `0.08H F`; rotation reverses to `+0.10*cos(aimLocal)`; `scaleX *= .92`. | Grip/pommel point punches `0.24H F`; rear hand remains close and visible. | Weapon translates with hands but counter-rotates `0.18 rad` so the business end trails. No tip smear. | Shadow compresses to `1.08x/.86y`; small contact marker appears at hands at `t=.28`. Short grip-centered capsule. |
| `0.30-0.44` recoil | Body returns `0.03H`; retain upright readiness. | Hands recoil `0.05H`, then begin separating. | Heavy end swings outward by only `.10 rad`, selling inertia without becoming a slash. | Shadow rebounds once to `.94x/1.04y`. |
| `0.44-1.00` load finisher | Lift/stretch to `1.04y`, body `-0.10 rad` into the next overhead. | Restore `.42H` spacing and raise both hands. | Carry weapon to the starting guard required by its selected step 3 (TCS, pancake, or flip). | Shadow recenters; the long hold is intentional combo anticipation. |

**Acceptance capture:** at impact, the visible blade/head must be behind the hands and the spark must be at the hilt. The next finisher's first frame must be continuous from this loaded guard.

### 5. True Charged Step-Slash - 2H greatsword step 3

**Shared step:** `motion: "true-charged-slam"`, `hand: "both"`, timing `{ activeStart: 0.46, activeEnd: 0.64, impact: 0.61, followEnd: 0.80 }`, path `fan` or forward capsule plus narrow fan, proposed `arcMultiplier: 0.72`, `rangeMultiplier: 1.12`, `damageMultiplier: 1.25`, `knockback: 96`. Use a greatsword-specific combo override; do not globally replace orbit.

| `t` / phase | Body | Hands | Weapon | Shadow / gameplay beat |
|---|---|---|---|---|
| `0.00-0.22` charge I | Draw `-0.04H F`, torso rotation `-0.14*cos(aimLocal)`, crouch `.94y`. | Both hands pull behind shoulder, full `.42H` separation. | Broadside behind body, angle approximately `aimLocal + pi - .35`; render far side/below body. | Rear-weighted `-0.04H F`, `1.05x/.90y`. |
| `0.22-0.34` charge II / smash lean | Stretch torso `1.06y`, deepen counter-lean, then hold. | Hands rise `0.08H`; 1 px decaying tremor. | Lift toward edge-on: length `1.0 -> .22`; move above body at the narrowest frame. | Shadow tightens `.90`, alpha `.88`; no fake height over `.05H`. |
| `0.34-0.46` step-in | Ground art advances `0.16H F`; torso begins returning through neutral. | Front hand leads; rear hand remains on haft and closes to `.34H`. | Length `.22 -> .72`; angle aligns into the narrow forward fall. | Shadow, not root, advances only `0.12H F` unless accepted movement is added; rotate/stretch along `F`. |
| `0.46-0.61` accelerating cut ACTIVE | Quadratic fall; body `1.04y -> .86y`, art advances another `.08H F`, rotation crosses to `+.20*cos(aimLocal)`. | Both hands drive downward/forward together. | Length `.72 -> 1.04`; head/tip describes a narrow line centered on aim. | Shadow widens `1.18x/.76y`. Accepted narrow path crosses targets. |
| `0.61-0.64` contact tail ACTIVE | Hold compressed silhouette; 2 px body recoil only. | Lock. | Length `1.04 -> .94 -> 1.0`; blade remains planted. | Impact at `.61`; active closes `.64`. Confirmed hit-stop and contact VFX only. |
| `0.64-0.80` planted follow | Body stays `.88y`, folded over sword. | Hands locked, then loosen after `.74`. | Planted angle; no bounce into another swing. | Shadow settles `1.08x/.88y`. |
| `0.80-1.00` haul out | Ease to `.05H F`, `.94y`, low guard rather than full idle. | Separate to normal haft spacing. | Wrench `-.12 rad`, lift `.05H`, finish low. | Baseline/combo release. |

**Acceptance capture:** charge duration must visibly exceed release duration; step/plant must occur before active damage; at contact the blade must be full length and the body compressed behind it. Test at Swift and Heavy affix speeds using the same normalized fractions.

### 6. Leviathan Recall Catch - recallable thrown axe follow-up

This is ranked sixth because it is highly iconic and the project already has thrown projectiles, but it should not block the five rig-native moves above.

**Action descriptor:** introduce a server-owned recall action rather than inserting it into `MELEE_COMBO_SEQUENCES`. Let `poseSeconds = clamp(returnDistance / returnSpeed + 0.16, 0.32, 0.70)`. Define normalized `tCatch = clamp((returnDistance / returnSpeed) / poseSeconds, 0.55, 0.80)`. Return damage is sampled by the actual projectile path; animation time follows its accepted phase.

| `t` / phase | Body | Hand(s) | Weapon | Shadow / gameplay beat |
|---|---|---|---|---|
| `0.00-0.14` summon | Turn chest toward incoming tangent by up to `.10 rad`; body shifts `-0.02H` against it. | Front hand opens at `0.18H` along incoming tangent; off hand braces near torso. | In-hand image hidden. Authoritative projectile changes to `returning`; no clone. | Shadow rotates/stretch `1.08x/.90y` along incoming tangent. |
| `0.14-tCatch-.06` flight | Mostly held silhouette; add no more than 2 px anticipatory drift. | Open hand tracks predicted catch point, not current projectile position. | Projectile follows server-owned return curve/segments and continues its existing spin; optional narrow wake. It may hit on the return leg once per enemy. | Grounded and stable so the incoming axe supplies motion. |
| `tCatch-.06-tCatch` catch align | Counter-rotate chest `.05 rad`; crouch to `.96y`. | Hand moves `0.04H` into the axe, fingers implied by a 1-frame hand squash. | Reduce spin over final 6% and orient grip to hand. Transfer projectile -> rig ownership exactly at `tCatch`. | Shadow stretches to `1.15x/.82y`. |
| `tCatch-tCatch+.06` catch shock | Body recoils `-0.07H` along incoming tangent, rotation `-0.12 rad`, `scaleY *= .93`. | Front hand snaps back `0.07H`; off hand counter-moves `0.03H`. | Held image visible at grip; projectile row is gone/hidden. One-frame weapon length compression `.96`, then `1`. | Shadow squash `1.20x/.74y`, alpha `1.10`; catch sound and camera tick. No extra damage at the hand. |
| `tCatch+.06-1.00` settle | Return offset/rotation to baseline through cubic-out. | Move to melee-ready guard. | Axe finishes held and may seed melee combo step 1 on the next accepted attack. | Baseline. |

**Acceptance capture:** throw hides the held axe; recall never duplicates it; an axe recalled from behind crosses targets on the real return path; catch shock occurs on the exact ownership-transfer frame under 0/100/200 ms RTT.
