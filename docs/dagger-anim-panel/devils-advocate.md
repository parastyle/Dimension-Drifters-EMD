# Devil's advocate: reach is a contract, not a pose

## Ruling

Reject the obvious patch: do not make daggers and claws look better by throwing the whole paper body a body-length toward the cursor. That would cure a weak silhouette by creating a false position and, for Twin Bowie Fangs, potentially a false reach.

The feedback is valid. The active dual daggers really do animate as props rotating around nearly resting hands. The cause is not procedural-jiggle weight, and it is not the worn-mount code dropping arm motion. It is data classification plus the generic `arc` branch: `dual` decides how many weapon images are attached, but it does not select a dual-hand combat motion. Twin Bowie Fangs have neither `swingStyle` nor `comboFamily`, are not classified as worn, and therefore resolve to the ordinary `arc`/arc-combo path.

A narrow fix is defensible: route held dual short blades to a hand-led attack, make the shoulder, torso, and planted feet support that extension, and solve the visible business end against the authoritative reach. Do not move `root`; do not enlarge the Painted Edge Ribbon; do not borrow the worn mount merely to obtain the worn animation; and do not turn the current Stage-1 cosmetic combo into two or three apparent damage events.

## Diagnosis from the current code

### The relevant data does not form one family

`isWornWeapon()` in `packages/shared/src/melee.ts` is deliberately narrower than “short dual melee.” It returns true for the exact `gauntlet` or `fist` families, or for names containing claw/talon/mitt/glove/vambrace/gauntlet/knuckle/cestus/fist words. The style fallback then maps claw/talon names to `pivot`; every other worn item maps to `punch`. Worn classification also controls the SpriteRig mount: origin `0.4` and weapon-over-hand stacking instead of the authored hilt pivot.

The current entries relevant to this complaint are:

| Weapon | Roster/data home | Data classification | Resolved visual path | Effective server centerline reach | Reach minus literal `PLAYER_RADIUS + TARGET_BODY_H` |
|---|---|---|---|---:|---:|
| Twin Bowie Fangs | Active `BASE_WEAPONS` | `family: "fist-blade"`, `dual`, no style, name has no worn word | **held mount; `arc`; arc combo** | 92 px | **-8 px** |
| Frostfang Rakes | Expansion, excluded from `WEAPON_IDS` | `family: "exotic-melee"`, `dual`, no style; concept explicitly says handheld | held mount; `arc`; arc combo | 108 px | +8 px |
| Wendigo Claws | Expansion | `exotic-melee`, `dual`; name matches claws | **worn mount; `pivot`; rake combo** | 105 px | +5 px |
| Knucklebone Talons | Expansion | `exotic-melee`, `dual`; name matches talons | worn mount; `pivot`; rake combo | 110 px | +10 px |
| Rendclaw Vambrace | Expansion | `exotic-melee`, 1H; vambrace makes it worn and “claw” selects rake | worn mount; `pivot`; rake combo | 120 px | +20 px |
| Revenant Knuckle | Expansion | `family: "mace"`, `dual`; name matches knuckle | worn mount; `punch`; punch combo | 110 px | +10 px |
| Pyreclap Mauler / Thunderhead Stormfists | Expansion, protected regression cases | `family: "gauntlet"`, 2H, quake | worn mount; **heavy `punch` roundhouse**, because worn resolves before quake | 200 px | +100 px |

Expansion entries are merged into `WEAPONS` but filtered out of the active `WEAPON_IDS` roster. The live dagger complaint therefore has one unambiguous active home: `twin-bowie-fangs` in `packages/shared/src/weapons.ts`. The expansion data exposes two future classification traps: “Frostfang Rakes” look claw-adjacent but correctly describe handheld implements and do not match worn; “Revenant Knuckle” lives in the mace family but correctly becomes worn through its name.

Do not “fix” this matrix by broadening `isWornWeapon()` to all `fist-blade`, `dual`, “fang,” or rake entries. Mount type and motion type are separate questions. Twin Bowie Fangs are held knives, so changing them to the worn origin/stack would put the hand inside the hilt and render the blades over the fingers. A data-level motion override can change their attack without lying about how they are equipped.

### Why the dagger hands appear at rest

The failure chain in `SpriteRig.ts` is specific:

1. `swingStyleFor(Twin Bowie Fangs)` falls through to `arc`.
2. `meleeComboSelectionFor()` consequently selects the three-step `arc` sequence.
3. The normal forehand and reverse `arc` poses change `weaponAngle` and add a small torso rotation, but they do not populate `swingOffX/Y` or `swingBackOffX/Y`.
4. The hand pass therefore keeps each hand at its locomotion/aim anchor. With any weapon equipped, the ordinary aim reach is only `0.1 * TARGET_BODY_H`, or 7.6 px.
5. The weapon pass places each image at `w.hand.img.x/y`. Because `backWeaponAngle` remains unset for ordinary arc cuts, the back knife receives the same swing angle as the front knife plus its fixed `0.32` rad pose offset. The result is two blades rotating together around two resting wrists.
6. The overhead third step adds a vertical offset to the front channel, but it still does not create the requested forward attack range or a clean dual-hand alternation.

This is **not weight zero**. During a combo, `actionOwnershipAt()` ramps the selected hand to ownership 1 through its active interval. The rig is faithfully owning an authored hand target that barely moved. Raising ownership cannot create missing translation.

This is also **not a worn-mount bypass**. The worn code changes sprite origin and display order during `equipWeapon()`. Every weapon record still stores its hand, every hand receives `swingOff`/`swingBackOff`, and the final weapon position follows that hand. Matched claws already enter the `pivot` branch, where lead and off hands receive real rake offsets and the scissor step populates both channels.

If a current matched claw still shows literally static hands, that is a separate reproduction, not evidence that all worn mounting skips arms. Confirm the exact weapon id. A name-classification near miss such as Frostfang Rakes will reproduce the dagger-like `arc` problem; Wendigo Claws and Knucklebone Talons should not. Also discard captures from before the new `attackSeq`/`attackTick`/`attackHeld` route: remote accepted attacks now call `triggerSwing()` on a tick-mapped client epoch. The new beat fixes missing remote swings, but it does not make combo step/path authoritative.

## Hitbox truth audit

### “One body length away” has two incompatible meanings

The stable visual body height is `TARGET_BODY_H = 76` px. The authoritative player collision radius is `PLAYER_RADIUS = 24` px.

For Twin Bowie Fangs, the server uses:

```text
meleeReach = max(weapon.range, (1 - gripFrac) * displayLength)
           = max(92, 0.84 * 62)
           = 92 px from the authoritative player center
```

Therefore:

- If “one full body length” means **from the player center/root to the striking tip**, 92 px already exceeds 76 px. The animation can satisfy the request without a balance change, provided the visible blade/tip actually reaches that 92 px line.
- If it means **one full body height beyond the player body**, the conservative collision-body threshold is `24 + 76 = 100` px. Twin Bowie Fangs miss it by 8 px. A literal 100 px attack requires an authoritative reach change and balance review, or the requirement must be restated as center-to-tip.

Do not use `MELEE_BLADE_HALFWIDTH = 21` or the target's radius to wave away that eight-pixel gap. `bladeHitsCircle()` correctly gives the swept segment a rounded tolerance, so a target center can connect beyond the segment endpoint. That tolerance exists to make grazes and circular targets fair. It is not permission to draw the solid knife or hot contact lip beyond the authored centerline and call the hitbox “close enough.”

The worn melee examples have enough authoritative centerline range to clear the conservative 100 px threshold, but their art is short. Worn origin `0.4` leaves only about 60% of `displayLength` in front of the hand; Wendigo's visible claw business end is roughly 35 px while its server line is 105 px. Those weapons need arm extension to *show the reach they already own*. They do not need a body teleport.

### What the server actually damages

On acceptance, `GameRoom.resolveSwing()` records `meleeReach(weapon)`, the frozen aim, `weapon.swingArc`, a 21 px half-width, and the shared `SwingDescriptor`. `stepMeleeSwings()` anchors each sample at the player's **current authoritative position**, advances one centered sweep with `bladeAngleAt()`, super-samples at at most 0.08 rad gaps, and admits each enemy once. Player movement can legitimately carry that origin during the active interval; an animation-only lunge cannot.

The client Painted Edge Ribbon already follows the honest source: `VfxPlayer` supplies `meleeReach`, `swingEdgeProgress`, and `bladeAngleAt` to the canonical renderer. The twin profile adds a dim, delayed second painted lane, but it does not add another server path or hit. The limb animation should be solved toward that ribbon. Moving or lengthening the ribbon to follow a more dramatic hand pose would reverse the dependency and break the truth law.

The shared combo `path` fields are not authority yet. `swingDescriptorWithComboStep()` enriches the rig's client-side snapshot, while the server still performs its one centered positive sweep. Consequently, the current reverse rake, dual scissor, range multipliers, and staggered secondary windows are presentation only. The accepted attack beat makes remote swing epochs visible; it does not sync an accepted combo step or make `dual-sweep` real.

## The attacks against a large-lunge solution

### 1. A visual-only body translation lies twice

Moving the whole paper art forward says both “my attack starts here” and “my character is here.” Neither is true. The root, collision circle, damage origin, incoming-projectile target, camera/depth position, and co-op observer state remain at the networked player position. A 30-76 px art lunge would let enemies overlap the real body while the paper body appears elsewhere, and it would shift the apparent dagger endpoint past the server segment.

The iconic melee stack already has explicit `attackArtOff` channels for rare moves such as the Fulcrum Flip and Stinger. Those moves accept this risk for a signature silhouette and are paired with authored path proposals that remain backlog. A 5-7 attacks-per-second dagger is the wrong place to normalize that debt. Iconic exceptions are not a precedent for locomoting the art on every auto attack.

For ordinary fast blades, “lunge” should mean shoulder projection, hip turn, torso profile/stretch, foot plant, and hand travel. `root` remains fixed. The body can lean; it cannot vacate its authoritative location.

### 2. Fast cadence turns a good key pose into a strobe

Twin Bowie Fangs have a 0.18 s base cooldown: 5.56 attacks per second. Their pose lasts `0.18 * 0.64 = 115.2` ms, with the authoritative arc active for only about 66.8 ms. A Swift affix reduces cooldown to 147.6 ms, pose to 94.5 ms, and active time to about 54.8 ms. At 30 fps that active interval is fewer than two frames.

A full-body counter-step, forward launch, contact, and recoil cannot be read cleanly in that window. Repeating it at 6.78 Hz will look like positional jitter, especially while the player is steering in another direction. Preserve attack speed by reducing the number of silhouette reversals, not by compressing a slow lunge into six frames.

The fast-blade solution needs a planted flurry tier:

- below or equal to 0.22 s effective cooldown: no whole-art advance; one shoulder/hand reaches while the torso supplies a small continuous twist;
- 0.22-0.34 s: a plant and restrained body compression are allowed, but the body does not ping-pong with the alternating hand;
- above 0.34 s: a larger commitment can be considered, still within the same root/tip truth caps.

The third visual step may be heavier in squash, overlap, and recovery. It may not reach farther or create a second contact merely because the dormant combo table calls it a finisher.

### 3. Dual alternation easily becomes flailing noise

The present arc bug is synchronized prop rotation. A naive rake conversion replaces it with the opposite failure: two large crossing arm paths, a torso reversal on every accepted attack, and a scissor that appears to hit twice. At Swift cadence the three-step cycle repeats every 443 ms.

One accepted server sweep needs one dominant damage read. A safe dual silhouette has:

- one lead hand whose business end approaches the current authoritative edge;
- one off hand visibly chambered or guarding, not drawing an equally bright contact path;
- alternation that changes ownership, not the authoritative arc direction or range;
- no second hit-stop, hot lip, impact burst, or full-strength painted ribbon for the off hand;
- no scissor contact until the server consumes an accepted `dual-sweep` path.

The current Stage-1 reverse directions are already a known mismatch. Do not make them more salient in the name of fixing reach. Until combo-path authority lands, the strongest acceptable dagger animation follows the server's centered positive sweep on every beat while alternating which arm performs it.

### 4. Player movement and prediction will fight the pose

The server anchors the blade at the live authoritative position, so walking during a swing is legal. Locally, the root is predicted and reconciled; remotely, it is rendered on the delayed snapshot timeline. The new attack tick mapper aligns an accepted remote pose with that interpolated body. An additional animation-only translation composes on top of both systems and has no reconciliation signal.

Adversarial cases are not exotic: attack while sprinting perpendicular to aim, reverse movement during active frames, attack on a prediction correction, jump immediately before contact, or receive a remote acceptance after interpolation starvation. A large forward pose can visually cancel real backward movement, double real forward movement, or make the paper body arrive before its accepted root.

Do not write attack motion into `root.x/y`. If a small cosmetic whole-art offset is retained for slower variants, cap it at `min(0.08H, 0.25 * PLAYER_RADIUS)`—about 6 px—and subtract it from the hand/weapon solve so the business end never crosses `meleeReach`. For Twin Bowie Fangs' fast tier, the cap is zero.

### 5. A global worn refactor would regress the mauler roundhouse

The current resolver's order is meaningful: worn gear is classified before quake and before generic two-handed orbit. That is why two-handed gauntlet maulers use the heavy punch/haymaker vocabulary instead of becoming overhead quake chops or waist orbits. The punch branch also increases reach/commitment for `twoHanded` and supplies the shipped hip-driven roundhouse silhouette.

Do not:

- add `fist-blade` or all `dual` weapons to `isWornWeapon()`;
- reorder quake ahead of worn;
- route all worn items to the new dagger/rake logic;
- replace the punch branch's heavy reach with a shared short-blade constant;
- change worn origin/stacking as part of an animation-only task.

Held daggers need an explicit motion classification. Claws keep worn rake. Non-claw worn gear keeps punch. Two-handed worn maulers keep the roundhouse. These are three separate lanes.

### 6. Jiggle can turn alternation into after-image soup

The current procedural-jiggle contract is good: anticipation ramps ownership in, the active hand is exact at weight 1, follow-through releases ownership, and `stepJigglePart()` hands the bounded authored terminal velocity to the residual spring. The weapon has no independent spring; it follows the hand. Preserve that.

A longer dagger extension increases authored terminal velocity, especially inside a 94 ms Swift pose. If both hands release with high opposing velocity and alternate again before settling, the spring can make the chambering hand cross the next strike or make both weapons appear active. The 22 px hand residual clamp prevents explosion, not semantic confusion.

The striking hand must reach exact ownership by active start. The guard hand must remain on its authored side of the torso. Release each hand once through the existing terminal-velocity seam; do not add a tween, weapon spring, or a second follow-through oscillator. Test repeated alternation until the springs reach steady state, not only the first clean swing after idle.

## Hard guardrails

1. **Define the reach sentence before animation approval.** “One body length from root” is satisfiable by the current 92 px dagger sweep. “One body length beyond the body” requires at least 100 px of authoritative centerline reach. No reviewer may switch definitions between the truth overlay and the beauty capture.

2. **The solid business end never crosses `meleeReach(weapon)`.** Target radius and blade half-width are fairness tolerances, not extra art budget. The newest/hottest ribbon lip stays on the server-sampled edge.

3. **One accepted attack produces one dominant contact.** Until accepted combo paths land, no dual scissor, reverse-path promise, secondary hot lip, second hit-stop, or second full-strength impact burst.

4. **Mount and motion remain orthogonal.** `isWornWeapon` continues to decide origin and z-stack. A held dagger may use a rake-like arm performance without becoming worn. No regex broadening as a shortcut.

5. **No attack writes authoritative-looking locomotion.** Never move `root`. Twin's fast tier receives zero whole-art translation. Any slower cosmetic art offset is at most 6 px, keeps the grounded shadow/root readable, and is included inside the fixed tip budget.

6. **Cadence reduces body amplitude.** Tune from effective cooldown, including Swift/Heavy affixes. No full-body fore/aft reversal more than once per three-hit cycle, and even that third beat cannot claim extra reach or damage in Stage 1.

7. **Hands, not props, own the move.** The selected striking hand reaches weight 1 before the server-active interval. The weapon rides that hand. The off hand has an authored guard/chamber and never inherits the lead weapon angle by accident.

8. **Preserve the worn vocabulary.** Matched claws stay `pivot`/rake; non-claw worn items stay punch; 2H worn maulers retain heavy haymaker/roundhouse behavior; worn sprite origin and display order do not change.

9. **Use the existing jiggle handoff.** No independent weapon spring and no competing tweens. Bound residuals so a released off hand cannot cross the torso centerline or overtake the current striking hand.

10. **Remote parity is mandatory.** Local prediction and remote accepted playback use the same reach-limited pose. `attackSeq` is an epoch edge, not permission to infer authoritative combo geometry that the protocol does not carry.

11. **VFX follows truth, not choreography.** PER continues to use the shared reach, edge progress, and blade angle. Decorative twin paint is subordinate; it never paints future arc or a second damaging contact.

12. **No VFX-dependent silhouette.** With ribbons, particles, shake, and hit-stop disabled, the correct hand, full extension, planted body commitment, and recovery must still be readable at gameplay zoom.

## Ship checklist

### Data and routing

- [ ] Record `isWornWeapon`, `swingStyleFor`, combo family, `dual`, `twoHanded`, and `meleeReach` for every row in the diagnosis table.
- [ ] Give Twin Bowie Fangs an explicit held-short-blade motion route; do not obtain it by changing worn classification.
- [ ] Decide Frostfang Rakes deliberately: held rake motion or ordinary arc, never accidental fallback.
- [ ] Confirm dual manifests provide two weapon parts and two rig hands; degrade a missing rear part to a single clear strike rather than a mirrored phantom.
- [ ] Prove Pyreclap Mauler, Thunderhead Stormfists, bare fists, Revenant Knuckle, and ordinary non-claw gauntlets still enter punch and retain their existing heavy/light behavior.
- [ ] Prove Wendigo Claws, Knucklebone Talons, and Rendclaw Vambrace retain worn origin/stacking and rake selection.

### Spatial truth

- [ ] In a stationary debug capture, overlay root, `PLAYER_RADIUS`, the 76 px body-height ruler, the `meleeReach` centerline endpoint, and the 21 px blade half-width.
- [ ] State whether acceptance uses 76 px from root or 100 px from the collision-body edge. If it is 100 px, change server reach/balance before approving a 100 px solid tip.
- [ ] At aim left/right/up/down and both facings, the lead business end never exceeds the shared endpoint and does not visibly detach from its hand.
- [ ] The off hand never produces an apparent contact outside the one server sweep.
- [ ] The Painted Edge Ribbon and visible lead edge agree at active start, aim crossing, and active end. The ribbon disappears after danger; a held combo guard has no hot edge.
- [ ] Do not consume `comboPath.rangeMultiplier`, reverse direction, secondary active windows, or dual-sweep geometry on the client unless the server consumes the same accepted fields.

### Cadence and dual readability

- [ ] Capture base, Swift, and Heavy at 60 and 30 fps. Include Twin's 115/94 ms base/Swift pose windows in the review sheet.
- [ ] Hold attack for at least five seconds. There is no torso strobe, root jitter, accumulating hand drift, or alternating full-body ping-pong.
- [ ] One paused frame identifies the lead hand. The off hand reads as chamber/guard, not a second simultaneous hit.
- [ ] The third beat is heavier through pose and recovery only; blind reviewers do not infer extra range, damage, or a second hit.
- [ ] With VFX disabled, the tip visibly attacks at the approved body-length threshold.

### Movement, network, and lifecycle

- [ ] Attack while moving in eight directions, while aiming in the opposite direction, and while reversing movement during active frames. Real root motion remains readable beneath the pose.
- [ ] Test jump before/after attack, landing during follow-through, parry brace interruption, weapon swap, down/death, reconnect, and scene restart. No hand or body offset survives its lifetime.
- [ ] Test local prediction and remote playback at 0/100/200 ms RTT, with jitter, an observer joining during `attackHeld`, and a skipped/coalesced `attackSeq` patch. No duplicate swing or manufactured scissor step.
- [ ] Compare owner and observer captures on the tick-mapped epoch. The body remains on the same rendered root while the hand supplies the reach.

### Jiggle and regressions

- [ ] During the active interval, the striking hand is exact at ownership 1. The support hand and planted feet use intentional ownership, not accidental free spring motion.
- [ ] At follow-through release, terminal velocity transfers once and stays within current clamps; the next alternating strike does not inherit the prior hand's crossing residual.
- [ ] No new Phaser tween, spring, GameObject, per-frame allocation, or display-list churn is added for the dagger pose.
- [ ] Re-run matched claws, single worn punches, dual worn punches, bare fists, 2H gauntlet maulers, ordinary one-hand arcs, and two-hand constraints with `PROCEDURAL_JIGGLE` both enabled and disabled.
- [ ] Final approval happens in a four-player melee horde with PER enabled, then with PER disabled. If the fix only reads in an isolated hero GIF, it does not ship.

## Bottom line

The feedback should result in moving arms and a committed body, but not in moving the character. Twin Bowie Fangs need a held dual-blade motion classification and a hand solve that takes the visible edge out to the 92 px server line. Matched claws already have the correct worn/rake route; their remaining job is to make the short claw art visibly occupy the reach they own. If the literal target is one complete 76 px body height beyond the 24 px player body, say so and authorize at least 100 px of server reach first.

Anything else is animation borrowing distance from collision tolerance, prediction error, or VFX—and that is the cardinal hitbox-truth failure this stack was built to prevent.
