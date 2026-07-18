# Pose-language research

## Question and method

The question is not merely how to stop an empty mitten from hanging at rest. It is how a small character
can declare weapon, intent, and phase before effects obscure the body.

This review frame-reads public gameplay, official trailers, animation uploads, and sprite references. The
phase descriptions below are visual observations; the design lessons are inferences for Dimension
Drifters. Exact input and move names are cross-checked against game documentation where available. The
target rig is deliberately narrower than most references: one bean body, two floating mitten hands, two
floating feet, no elbows, no fingers, and no new weapon-facing rules. Consequently, the useful evidence is
hand separation, target placement, timing, body pitch, foot split, and held silhouettes - not anatomy.

The four comparison phases are:

- **Idle:** the stable promise of what this weapon does.
- **Move:** how the promise survives locomotion.
- **Attack:** anticipation, contact, and any combo handoff.
- **Recovery:** the pose that proves weight and prepares the next decision.

## Reference findings

### Madness Combat - floating hands as continuous intent

Krinkels' characters are the closest structural reference: the hands visibly float without arms, yet they
rarely read as detached. The original [Madness Combat 4: Apotheosis](https://www.newgrounds.com/portal/view/172771)
and [Madness Combat 5: Depredation](https://www.newgrounds.com/portal/view/226896) are especially useful
for pistol, long-gun, melee, grab, and weapon-transfer sequences. The anatomy itself explicitly uses
[floating hands without visible arms](https://madnesscombat.wiki/index.php?title=Character_anatomy).

| Phase | Observed off-hand language | Why it reads small / DD transfer |
| --- | --- | --- |
| Idle | The empty hand hovers near the chest, face, or weapon line rather than at hip-rest. With a long gun, it becomes a separated forward support point. With a one-hander, it is a compact guard or the next grab. | Two isolated hand dots form a line of intent. A hand near the body says “ready”; one far behind the body says “counterweight.” Neither can be mistaken for a dead limb. |
| Move | Both hands trail, overshoot, and catch up on direction changes, but the guarded relationship survives. The weapon hand owns aim while the free hand has a looser arc. | Different stiffness is enough to imply different jobs. DD already has weapon-hand versus free-hand spring inertia and can exaggerate that difference. |
| Attack | The free hand changes verb: brace the implement, cover the head/chest, reach to seize, or swing opposite the striking hand. It does not mirror the weapon hand by default. | One decisive opposing motion makes the whole body look involved even without arms. |
| Recovery | Hands overshoot contact, recoil into an asymmetric guard, or flow directly into a pickup/reload/grab. The body settles after the hands, not simultaneously. | Staggered settling prevents the “rotating prop on a static bean” read. The next guard is already visible before the body fully rests. |

**Lesson:** hand continuity matters more than anatomical continuity. Each hand needs a current verb, and
the verb may change at anticipation, contact, and recovery.

### Hades - each Infernal Arm rewrites the whole silhouette

Hades is the strongest family-language reference because Zagreus retains the same body while each weapon
changes his stance, locomotion, attack rhythm, and recovery. The move vocabulary is explicit: Stygius has
a Strike-Chop-Thrust combo and Dash-Strike; Exagryph has Fire, Reload, and Bombard
([Stygian Blade](https://hades.fandom.com/wiki/Stygian_Blade),
[Adamant Rail](https://hades.fandom.com/wiki/Adamant_Rail)). Supergiant's patch history also treats
weapon animation as gameplay feedback, including an update to the Heart-Seeking Bow attack animation
([Patch 022](https://hades.fandom.com/wiki/Patch_022)).

| Phase | Observed off-hand language | Why it reads small / DD transfer |
| --- | --- | --- |
| Idle | Stygius leaves an open counterbalancing hand away from the sword line; Varatha and Exagryph make a two-point grip; Malphon raises both fists; Aegis dedicates one side of the body to the shield. | Weapon families are recognizable from hand spacing alone: one open wing, a long two-hand line, twin guards, or a broad defensive side. |
| Move | A one-handed implement trails while the free side pumps/counters; long weapons stay organized around their two-hand axis; fists remain compact instead of turning into a generic run. | Locomotion modulates a stance rather than replacing it. DD should blend gait through the family target, not return the off-hand to universal rest. |
| Attack | Stygius' Strike-Chop-Thrust changes blade path and torso turn across the three beats. Varatha's thrust and Spin Attack spread or compress the two grips. Malphon alternates fists and commits both hands to the uppercut. Exagryph freezes into a braced firing line and makes Reload a separate beat. | The non-leading hand previews the next beat: guard, rear power, or support. Combo readability comes from alternating ownership and retained counterpose, not only the trail. |
| Recovery | Light weapons return to a useful guard quickly; heavier or stationary specials retain a planted follow-through. Reload is visibly different from firing recovery. | Recovery duration and destination communicate commitment. The hand should return to a family guard, never to a generic dangling anchor. |

**Lesson:** the idle pose is a compressed tutorial for the move set. The attack then cashes the promise:
fists alternate, polearms slide, swords counter-rotate, and guns brace.

### Dead Cells - excellent attack punctuation, weak persistent family stance

Dead Cells authors extremely distinct attack sequences. The Balanced Blade, for example, uses a
[six-hit 1.46 second combo](https://deadcells.wiki.gg/wiki/Balanced_Blade), while the weapon guide
explicitly distinguishes light fast weapons from heavy Broadsword-class weapons and notes that most melee
weapons own individual move sets ([official Gear reference](https://deadcells.wiki.gg/wiki/Gear)). The
Assault Shield further separates held block from its forward charge/parry
([Assault Shield](https://deadcells.wiki.gg/wiki/Assault_Shield)).

| Phase | Observed off-hand language | Why it reads small / DD transfer |
| --- | --- | --- |
| Idle | Much of the weapon identity is deferred until use; the Beheaded's base silhouette and scarf do more work than a persistent weapon-specific off-hand. | This is the limitation to avoid. DD renders both mittens and the held weapon continuously, so leaving one at default wastes readable state. |
| Move | The run is strong and elastic but comparatively family-agnostic. Weapons do not require the run cycle to carry all of their identity. | A good generic gait is not enough for DD's paper rig. Preserve the gait energy, but bias the free hand toward its family job. |
| Attack | Fast blades use compact repeated cross-body beats; Broadsword/heavy attacks widen anticipation and plant the body; spear/rapier attacks drive a narrow line; shield use occupies a clear defensive plane. | The contact pose is held just long enough and has an exaggerated action line. DD can create the same read with hand targets, body squash/turn, and feet, even with no elbow frames. |
| Recovery | Light combos snap back; full heavy sequences have conspicuous end lag and a low or extended finish. | Recovery is a price and a silhouette. Preserve the existing accepted cooldown clock and choose a readable family guard at its end. |

**Lesson:** use Dead Cells for attack punctuation and commitment, not as the idle template. DD should add
the persistent family stance that Dead Cells often does not need.

### Enter the Gungeon - aim stability beats off-hand detail

Enter the Gungeon is a valuable small-pixel boundary case. The Marine Sidearm is a ten-round semiautomatic
starter with a 1.2 second reload ([official weapon entry](https://enterthegungeon.wiki.gg/wiki/Marine_Sidearm));
the Marine's identity is explicitly accurate, quick-reloading gunplay
([Marine](https://enterthegungeon.wiki.gg/wiki/The_Marine)). At gameplay scale, the gun/aim pivot, muzzle
flash, recoil, facing, and dodge roll dominate; the free hand remains visually compact and subordinate.

| Phase | Observed off-hand language | Why it reads small / DD transfer |
| --- | --- | --- |
| Idle | The gun establishes the forward line; the other side stays close to the torso/weapon mass and does not create a competing silhouette. | “Compact” is still a job. A chest guard is readable at DD's larger mitten scale without stealing the muzzle line. |
| Move | Feet and body animate under a stable gun aim. The non-aim side does not swing so widely that it breaks targeting clarity. | When aim and locomotion conflict, aim wins in the hands while the feet carry movement. |
| Attack | Muzzle flash and weapon kick are the primary beat; the body remains target-stable. Reload and dodge roll are more distinct than subtle hand acting. | DD should use the free hand to catch/guard on recoil, but keep its amplitude below the gun hand and below the face-line law. |
| Recovery | The gun settles quickly back to aim; reload is a longer separate action. | Keep the existing 250 ms aimed linger and 180 ms settle. Do not make decorative off-hand motion delay barrel truth. |

**Lesson:** a pistol free hand should be compact, not theatrical. Its life comes from a small guarded pulse
and recoil response while the weapon continues to point forward.

### Nuclear Throne - the readable baseline with no off-hand language

Nuclear Throne deliberately separates a tiny mutant body from a large aim-rotated weapon. Its public
gameplay materials show the result clearly ([Steam gameplay and screenshots](https://steamdb.info/app/242680/screenshots/));
even character sprite sheets organize Idle, Walk, Hurt, and Death while the weapon is a separate concern
([Fish sprite reference](https://www.spriters-resource.com/pc_computer/nuclearthrone/asset/81042/)).

| Phase | Observed off-hand language | Why it reads small / DD transfer |
| --- | --- | --- |
| Idle | There is effectively no articulated free-hand statement. The oversized weapon and character-specific body sprite carry identity. | This proves the minimum viable top-down read, but DD visibly owns a second hand. Copying this would make that hand look broken rather than abstracted. |
| Move | Body bob/feet and the independently aimed weapon are enough to show motion plus target. | Preserve independent aim and gait, but use DD's free-hand spring as a bonus silhouette channel. |
| Attack | Weapon flash, shake, sound, and recoil sell the shot. Character abilities such as Y.V.'s “Pop Pop” differentiate cadence more than hand posing. | Effects can sell impact but cannot rescue a visibly limp mitten. The hand pose must remain legible with VFX disabled. |
| Recovery | Fast return to the weapon's aim line; little body-specific recovery is required at this scale. | DD can add only one recovery accent - a chest-guard catch - without muddying the shooter clarity Nuclear Throne protects. |

**Lesson:** weapon rotation plus recoil is readable, but it leaves personality on the table. DD should keep
that clarity and spend its extra limb channel deliberately.

### Hollow Knight - body and trail can substitute for a hidden hand

The Knight carries only an old Nail as its primary weapon in Team Cherry's original description
([Introducing Hollow Knight](https://www.teamcherry.com.au/blog/introducing-hollow-knight)). The basic Nail
can attack in four directions, while Great Slash, Dash Slash, and Cyclone Slash are charged Nail Arts; the
latter is explicitly a spinning all-sides attack with reduced movement
([Cyclone Slash](https://hollowknight.wiki/w/Cyclone_Slash)).

| Phase | Observed off-hand language | Why it reads small / DD transfer |
| --- | --- | --- |
| Idle | The cloak hides hand anatomy and the Nail is stowed/quiet; the horned head and cloak make the base silhouette. | Hidden hands are not dead hands. Hollow Knight avoids the problem by removing the limb from the readable silhouette; DD cannot because both mittens float visibly. |
| Move | The cloak and head lead while the small body follows. Weapon-family information is minimal until attack. | Body tilt and trailing shapes can reinforce a hand pose, but cannot replace it when a separate mitten is present. |
| Attack | Nail Slash uses a huge clean crescent and sharp whole-body opposition; Dash Slash lengthens the body line; Great Slash expands anticipation; Cyclone Slash turns the entire silhouette. | One strong line, a brief extreme, and a clean trail survive tiny scale. DD's body lean and free-hand counterweight should align with that line. |
| Recovery | The Knight returns rapidly to neutral after basic slashes; charged arts carry a larger held finish. | Match recovery size to anticipation size. A light 1H blade needs a small counterweight overshoot, not a heavy stagger. |

**Lesson:** the silhouette should work without seeing fingers, elbows, or even the striking hand. The free
mitten's job is to strengthen the dominant attack line, not add another unrelated gesture.

### Brotato - useful weapon motion, intentionally body-disconnected

Brotato allows most characters to hold up to six weapons, with melee weapons swinging/thrusting and ranged
weapons shooting automatically ([weapon rules](https://brotato.wiki.spellsandguns.com/Weapons)). That
many simultaneous implements require a radial equipment display more than a believable two-hand body.

| Phase | Observed off-hand language | Why it reads small / DD transfer |
| --- | --- | --- |
| Idle | Weapons surround the potato as inventory/readout; there is no single free-hand relationship to preserve. | Excellent for six-weapon build legibility, wrong for a rig whose appeal is two expressive floating hands. |
| Move | The potato and its weapon ring translate together with little weapon-family body change. | Do not let DD's family stance collapse into “props orbit a bean.” |
| Attack | Each weapon independently swings, thrusts, or fires toward a target. | Independent weapon arcs are readable under horde pressure, but body weight and off-hand intent are sacrificed. |
| Recovery | Each weapon returns to its radial slot on its own cadence. | DD should return hands to a shared body guard, not to unrelated inventory slots. |

**What not to copy:** radial symmetry, identical body posture across weapons, and weapon-only attack
motion. Those choices are correct for six simultaneous weapons and wrong for two-hand paper acting.

### Vampire Survivors - effect readability without held-body causality

Vampire Survivors is an even stronger negative control. Its public trailer and screenshots show a stable
character sprite surrounded by scheduled weapon effects
([official Steam page](https://store.steampowered.com/app/1794680/Vampire_Survivors/)). The character does
not need to point, brace, or recover because attacks are largely automatic and omnidirectional.

| Phase | Observed off-hand language | Why it reads small / DD transfer |
| --- | --- | --- |
| Idle | No persistent held-weapon/off-hand relationship is required. | The game communicates build state through HUD/effects, not pose. DD explicitly shows held gear and aim, so this economy would read as lifeless. |
| Move | A short looping walk carries the entire avatar while attacks happen independently. | A universal movement loop is sufficient only when facing and weapon handling are not promises. |
| Attack | Whip, projectile, orbiting, and area effects appear without a matching hand anticipation/contact pose. | Never use VFX as permission for a static body in DD. Test the stance with trails and muzzle effects disabled. |
| Recovery | Often no body recovery exists; the next cooldown is external to the sprite. | DD's visible weapon and mittens need a physical return beat, even if it is only a 120-180 ms settle. |

**What not to copy:** attack effects disconnected from the holder. Dimension Drifters' pose must still
identify family, direction, and phase when every combat VFX layer is hidden.

### Classic fighting games and combat-sport conventions - the unused hand is never unused

Two classic conventions transfer unusually well to floating mittens:

- **Boxing guard:** the non-punching hand protects the chin while the punch extends, then the striking hand
  returns to guard. England Boxing explicitly coaches keeping the rear hand at the side of the chin and
  returning the lead hand to guard ([Boxing Coaching Handbook, p. 73](https://www.englandboxing.org/wp-content/uploads/2026/02/EB_Boxing-Coaching-Handbook-Part-1_09_02_26.pdf)).
- **Fencing trail hand:** the weapon arm establishes the line; the opposite arm counterbalances the lunge
  and the feet return to en garde. Fencing analysis describes the front-foot extension, straightening rear
  leg, balance, and recoverability of the lunge ([biomechanical review](https://pmc.ncbi.nlm.nih.gov/articles/PMC8717994/));
  the FIE maintains a full coaching manual covering footwork and weapon-specific motor skills
  ([FIE manual notice](https://fie.org/articles/618)).

The same language is amplified in fighting games. Ryu's standing guard keeps both hands active, a jab
leaves the rear hand home, and Hadoken/Hashogeki deliberately recruit both hands; the named move set is
documented in a [Street Fighter 6 Ryu guide](https://www.ggrecon.com/guides/street-fighter-6-ryu-character-guide/).
Raphael's rapier silhouette in Soulcalibur VI stays side-on with a clear weapon point and expressive trail
arm; Bandai Namco describes him as a fencer built around fast thrusts and slashes
([official Raphael trailer](https://en.bandainamcoent.eu/soulcalibur/news/raphael-character-announcement-trailer)).

| Phase | Observed off-hand language | Why it reads small / DD transfer |
| --- | --- | --- |
| Idle | Boxing keeps two fists at unequal guard depths; fencing puts the weapon hand forward and trail hand away/back. | A triangle of two hands plus body is more readable than two hands at equal rest. The triangle immediately says boxer or duelist. |
| Move | Guard relationship survives shuffles/steps. The feet move under the pose instead of making the hands pump like a run cycle. | DD should reduce generic arm swing when combat-ready, especially for fists, pistol aim, and thrusting blades. |
| Attack | The inactive boxing hand stays home; a fencing trail hand opens opposite the weapon lunge; Hadoken recruits both hands for a different move category. | “Support” may mean guard, counterweight, or shared emission. It should never mean mirroring every strike. |
| Recovery | Punches snap back to guard; lunges visibly recover to en garde before the next phrase. | Family recovery must have a named destination. This is the cure for the limp return-to-rest hand. |

**Lesson:** choose between guard and counterweight by family. Blunt/fists use boxing guard; precise blades
use a fencing wing. Both are alive, but their silhouette and recovery promise different play.

### Hyper Light Drifter - compressed asymmetry and action switching

Hyper Light Drifter combines sword, gun, and dash in an extremely small top-down sprite. The move set
includes sword deflection and SlashDash ([abilities](https://hyperlightdrifter.fandom.com/wiki/Abilities_and_Upgrades));
advanced play can cancel a gunshot into a sword swing, known as “plinking”
([technique reference](https://hyperlightdrifter.fandom.com/wiki/Plinking)).

| Phase | Observed off-hand language | Why it reads small / DD transfer |
| --- | --- | --- |
| Idle | The Drifter stays compact; the weapon does not permanently widen the silhouette. | A quiet pose can still be asymmetric. Keep DD micro-motion small around a strong target. |
| Move | Coat/scarf trail gives direction while the combat side remains prepared. | Locomotion follow-through can carry energy that the hand target itself should not spend. |
| Attack | Sword slashes turn the whole sprite; shooting changes to a narrow forward line; SlashDash compresses anticipation and extension into a single streak. | One avatar can switch pose grammar per delivery without transition clutter. Classification must resolve the current weapon/action, not character class. |
| Recovery | Short, sharp returns enable slash-shot chaining; the body does not wobble through multiple decorative beats. | One overshoot and one guard catch are sufficient. Micro-motion resumes after the authored action releases ownership. |

**Lesson:** family changes should be immediate and clean. A small action silhouette benefits from one bold
asymmetry, not layered secondary acting.

### Wizard of Legend - the casting hand is the weapon animation

Wizard of Legend is a top-down spell-combat reference where quick movement and spell chaining are the core
promise ([official site](https://wizardoflegend.com/)); PlayStation's description likewise defines combat
around arcana cards and precise spell combinations
([PlayStation Blog](https://blog.playstation.com/2017/11/29/sling-spells-in-wizard-of-legend-out-early-2018-on-ps4/)).

| Phase | Observed off-hand language | Why it reads small / DD transfer |
| --- | --- | --- |
| Idle | Both hands remain available around the robe/body rather than one being treated as a permanent item socket. | A caster silhouette promises two-hand expression even when only one focus is held. |
| Move | Hands trail the fast dash/run but return toward a centered ready shape. | Caster micro-motion should be buoyant and centered, not a soldier's stiff weapon brace. |
| Attack | Arcana use one-hand points, opposing sweeps, or two-hand convergences depending on spell. The non-emitting hand frequently frames or counter-rotates the effect. | A tome/focus off-hand can trace, frame, or release while the held item remains stable. No fingers are needed; path and timing carry the spell. |
| Recovery | The casting hand makes a quick recoil/fold before the next arcana, supporting rapid chains. | DD tome recovery should close the gesture to the page/chest, not drop the hand to hip rest. |

**Lesson:** for caster families, the free hand is not a guard borrowed from melee. It is a second emitter,
page operator, or framing hand.

### Death's Door - family weight through hand spacing and end lag

Death's Door provides a clean isometric comparison across a three-hit sword, faster daggers, heavier
weapons, bow, and projectile spells. Its basic loop starts with sword and bow, and sword hits replenish bow
ammo ([gameplay overview](https://en.wikipedia.org/wiki/Death%27s_Door_%28video_game%29)); the distinct
three-hit sword and faster dagger rhythms, plus punitive pauses after combos, are described in
[GameSpot's review](https://www.gamespot.com/reviews/deaths-door-review-a-murder-of-crows/1900-6417699/).

| Phase | Observed off-hand language | Why it reads small / DD transfer |
| --- | --- | --- |
| Idle | One-hand sword, paired daggers, bow, and heavy implement create visibly different widths and grip counts. | Hand count and separation should be family truth before any attack begins. |
| Move | The Crow's feet/body keep a strong run while weapon mass trails by family. | Use DD's different weapon/free-hand inertia, not a different locomotion system. |
| Attack | Sword uses a measured combo, daggers compress the cadence, bow pulls two hands into a line, and heavy attacks recruit the whole body. | Attack speed changes timing; family and weight change pose size. Do not scale reach or target placement with cooldown affixes. |
| Recovery | Full combos and heavy swings retain punishable end poses, while light attacks recover tightly. | End lag should have a designed silhouette: low heavy finish, compact dagger guard, or bow release - never two mittens falling to rest together. |

**Lesson:** hand spacing is a low-cost weight signal. Recovery pose and duration should agree with that
signal.

## Transferable principles

### 1. Give the off-hand one job, then one verb per phase

The stable jobs are **guard**, **counterweight**, **support grip**, **spot/aim**, and **cast/page**. Idle
declares the job. Move preserves it with gait modulation. Attack changes it to a clear verb. Recovery
returns it to a named family guard.

An off-hand at generic manifest rest has no job. Random bobbing does not fix that; it animates the absence
of intent.

### 2. Build a three-point silhouette

Body plus two hands should form a family-specific triangle:

- narrow front/chest triangle: pistol or boxing guard;
- long axis with separated points: rifle, polearm, or 2H sword;
- open rear wing: 1H duelist blade;
- asymmetric page-and-cast bracket: tome;
- wide equal guard: fists or dual claws.

At small scale, a change of triangle reads sooner than mitten rotation or a tiny texture detail.

### 3. Counterweight and guard are different promises

A counterweight opens away from the attack line and makes speed/precision legible. A guard stays near the
body and makes impact/control legible. Use a fencing wing for 1H blades and a boxing chest guard for fists,
blunt weapons, and pistols. Do not average them into the same halfway hand.

### 4. Anticipation is a silhouette change; recovery is a destination

The free hand should move before contact far enough to be seen: wing closes, guard tightens, page hand
traces, support hand slides, or throwing hand/spot hand oppose. At recovery it should overshoot once, then
land in the family guard. If both hands and body reach neutral on the same frame, the rig looks mechanical.

### 5. Preserve asymmetry through locomotion

The gait can swing or trail a hand, but it must do so around the family target. Aim-critical hands are
stiffer; free counterweights are looser. When aim conflicts with run direction, hands protect aim and feet
communicate locomotion.

### 6. Use micro-motion as punctuation, not proof of life

Idle motion should be bounded and role-specific:

- guard: small inward/outward pulse;
- counterweight: slow lateral float;
- support grip: tiny shared compression along the haft;
- page/cast: intermittent trace or page tap;
- dual/fists: alternating breath, never synchronized bob.

Static placement must already read correctly. Turning micro-motion off for reduced motion or LOD must not
destroy the stance.

### 7. Let the action own exactness, then hand velocity back to the springs

During contact, weapon grips and committed feet are exact authored targets. Anticipation ramps ownership
in; recovery retracts the target before ownership releases. The spring then inherits bounded terminal
velocity and supplies the Madness-style settle. Springs should enrich a pose, not choose it.

### 8. One dominant beat survives horde scale

For each family, choose one personality beat that is visible in a still frame: pistol fist at chest, dagger
forward ward, tome page trace, polearm grip slide, or hammer high guard. Secondary flourishes must not
compete with muzzle, business edge, or authoritative contact.

### 9. Body and feet confirm the hand story

Hands alone can still look like orbiting props. A small body lean and a recognizable foot split confirm
weight:

- side-on split for precision/thrust;
- squared crouch for fists/fist-guns;
- wide rear plant for 2H/heavy recoil;
- narrow mobile base for pistol/caster;
- front plant plus trail kick for close-blade lunge.

The visible paper may lean or shift; the authoritative root never moves for pose alone.

### 10. Effects may amplify, never supply, the pose

Nuclear Throne, Brotato, and Vampire Survivors prove that large weapon/effect motion can remain readable
without body acting. Dimension Drifters has deliberately exposed hands and a held weapon, so its bar is
higher. Every family and phase must pass with muzzle flashes, ribbons, pages, and spell particles hidden.

## Research conclusion

The highest-value change is not a catalog of bespoke animations. It is a small, shared pose grammar:

1. resolve the current weapon to a family and hand role;
2. choose a static family triangle;
3. blend gait around that triangle;
4. let the existing attack clock change the free-hand verb;
5. retract into a named guard and release to the current springs.

That grammar makes a mitten feel intentional without adding elbows, fingers, bones, or new authoritative
movement.
