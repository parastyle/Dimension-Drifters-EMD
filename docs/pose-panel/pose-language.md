# Dimension Drifters pose language

## Goal

Every visible hand has a job in every weapon state. The pose must identify family and intent with combat
VFX hidden, at the current top-down scale, using only targets the existing paper rig can express:

- two floating hand positions;
- two floating foot positions;
- held-weapon angle and hard grip relationships already owned by `SpriteRig`;
- body-local translation, turn, squash, and lean;
- bounded spring/micro-motion around those authored targets.

This extends the firing-height work in `docs/orientation-panel/firing-stances.md`. It does not replace its
weapon-facing, grip-band, face-line, body-turn, dual-hand, or thrown timing laws.

## Non-negotiable laws

1. **The weapon points forward at neutral and aim.** Melee returns through
   `forwardMeleeReadyAngle(aimLocal)`; firing uses the existing semantic weapon axis. A personality pose
   may cant or chamber a weapon during its authored attack, but never establishes a backward-pointing idle.
2. **Gun grip height remains canonical.** `FIRING_STANCES`, `firingHandTarget()`, the `-0.22H` face line,
   fist-gun chest cap, and the 90/250/180 ms raise-linger-settle envelope remain unchanged.
3. **Two-handed geometry is hard.** When `WeaponDef.twoHanded` owns a haft, the rear hand remains a
   geometric child of the lead grip. A neutral pose may choose spacing; it may not spring the two grips
   independently off the weapon.
4. **Close blades keep their lunge truth.** Dagger/claw grip targets, foot plants, body channels, reach cap,
   `CLOSE_BLADE_RELEASE_T`, and terminal identity remain owned by `sampleCloseBladePose()`.
5. **Dual parity remains exact.** The accepted lead/off/lead/off/lead/both bar and Crossfall's authored
   two-hand convergence remain intact. A lead action cannot freeze or impersonate the off hand.
6. **The root never moves for pose.** Body/paper offsets can sell weight; server position, collision,
   interpolation, camera, and depth-sort anchors remain authoritative.
7. **Micro-motion is dispensable.** Reduced-motion and LOD may remove it while retaining the static family
   silhouette.

## Coordinate and timing language

`H` is the rendered body height (`TARGET_BODY_H = 76 px`). `F` is the aim-forward unit vector in mirrored
rig-local space. `S` is its perpendicular. “Weapon side” and “free side” select the sign of `S` from the
current hand role; they must not be hard-coded to screen left/right.

Placement numbers below are body-height design bands, not new reach or damage. Hand positions are target
regions around the body center; foot figures are offsets from each manifest foot's ordinary anchor.

Micro-motion has three rules:

- idle excursions stay within `0.01H-0.025H` (roughly `0.8-1.9 px`) unless a named intermittent beat says
  otherwise;
- movement derives phase from the existing distance-driven gait and spring inertia, never from a second
  fixed run loop;
- attack targets retract before spring ownership releases, so recovery can inherit velocity without a pop.

## Shared phase grammar

| Phase | Whole-rig rule | Off-hand rule |
| --- | --- | --- |
| Idle | Hold the family triangle. Body breath is small; feet show the family base. | Occupy a named job anchor and run one low-amplitude, role-specific micro-motion. |
| Move | Blend the same family triangle through `gait`. Aim-critical hands stiffen; feet and body carry travel. | Swing around the job anchor, never around generic manifest rest. Free counterweights trail more than support grips or guards. |
| Anticipation | Enlarge the silhouette before contact: coil, close, spread, slide, or trace. | Change from the stable job to the family's attack verb. Do not advertise full reach before the existing action clock allows it. |
| Attack/combo | Existing weapon/hand/contact choreography wins. Body and committed feet confirm its action line. | Guard the body, oppose the strike, support the implement, alternate by parity, or cast. Never mirror by accident. |
| Recovery | Retain one readable overshoot, retract all action-only targets, then land in the family guard. | Return to the named job anchor, not to universal rest. Spring motion resumes only after the target is safe. |

## Per-family pose program

### Complete family table

| Family / hand contract | Idle off-hand placement and micro-motion | Move off-hand behavior | Attack / combo / recovery | Body lean and feet | One personality beat |
| --- | --- | --- | --- | --- | --- |
| **1H blades** - sword, saber, broadsword, energy blade, held cleaver; precise thrusting blades use the same chassis with narrower travel | **Duelist wing:** free hand `0.04H-0.10H` behind the body along `-F` and `0.14H-0.20H` out on the free side. Slow lateral float (`<=0.018H`) opens and closes the triangle. It is visibly higher/closer for rapier than for broad cutting blades. | Wing trails the body by spring, but its mean stays outboard. At full gait it narrows by about 25% so it does not resemble a second weapon. Feet carry most locomotion. | Anticipation closes the wing toward chest as the weapon chambers. On forehand it opens opposite the edge; on reverse it crosses briefly behind the body; on overhead it rises just outside the face line. Combo direction flips opposition. Recovery carries the wing `<=0.04H` past its idle side, then settles to the duelist wing. | Body stays slightly side-on (`0.03-0.06 rad` toward weapon side). Feet form a narrow fencing split: weapon-side foot `+0.05H F`, rear foot `-0.05H F` and `0.05H` free-side. Existing hero-spin/combo body poses override. | The free mitten **fans open opposite every cut**, making a clean blade/hand diagonal in a still frame. |
| **Daggers and claws** - `fist-blade`, dagger/claw combo variants, held rakes, worn claws/talons | At rest the non-leading hand is a **forward ward**, `0.10H-0.14H F` and `0.08H-0.12H` off center; the weapon hand sits lower/closer in a compact chamber. Dual versions alternate a tiny `0.015H` in/out pulse rather than bobbing together. A single claw uses the empty mitten as the ward. | The ward remains forward and relatively stiff; the chamber hand has looser fore-aft trail. Feet shorten the ordinary stride into a stalking split as gait rises. | Keep `sampleCloseBladePose()` as truth: selected hand lunges, support hand guards, feet plant/kick, finisher converges, and every lunge-only channel is identity by `0.92`. Do not add another generic off-hand layer during the sampled pose. On recovery, the striking hand pulls behind the ward; dual parity decides which is now in front. | Low forward compression already comes from the sampler. Preserve its `3-6 px` paper advance cap, reach solve, front plant, trail kick, and body crush. | A dagger gets a **low reverse-grip read with the other mitten already warding forward**; the business end still points forward and honest. |
| **1H blunt / chopping tools** - mace, axe, warhammer, flail, heavy cleaver, one-hand exotic melee | **High chest guard:** free hand within `0.08H-0.12H` of chest, `0.08H-0.13H` on free side, below the protected face line. Micro-motion is a tight `0.012H` guard pulse toward/away from center. | Guard stays compact instead of pumping. On hard turns it lags once and snaps home; it never drops beneath the lower chest while a weapon is readied. | Wind-up tightens the guard at chest. During the blow it punches slightly down/back (`0.08H-0.12H`) as counter-torque; on impact it closes back toward center as if bracing the ribs. Reverse/second combo beats mirror body torque but preserve guard priority. Recovery overshoots outward only `<=0.025H`, then returns high. | Body is more squared than the blade stance and sinks `0.02H-0.05H` on committed hits. Feet use a shoulder-width split; rear foot plants `0.06H-0.10H` behind on chops. Existing quake/chop channels win. | The empty mitten **checks the chest on impact**, giving a compact bruiser silhouette rather than a fencer's wing. |
| **Fists / empty hands** - `fist` and melee gauntlets that are not claw variants | Both mittens form an unequal boxing guard: lead `0.10H-0.15H F`, rear within `0.07H` of chest, separated `0.14H-0.20H`. Alternate vertical breath by `<=0.015H`; never synchronize. | Guard rides over the gait. Generic arm swing is strongly suppressed; the lead hand probes forward `<=0.02H` on each matching foot plant while the rear stays home. | Reuse the jab -> rear cross -> haymaker vocabulary. The non-punching hand remains at chest guard through contact. On Cross/finisher, it may tighten toward center but cannot follow the striking hand. Each punch retracts along its path; recovery swaps which hand is subtly forward without dropping either. | Squared crouch, body turn from hips, and front/rear plant already exist in punch choreography. Neutral feet are broad (`~0.08H` lateral each side) with a slight lead/rear split. | The hand that is not hitting is **always home at the chin/chest line**. Covering one mitten should instantly make the pose look unsafe. |
| **Pistols / compact 1H guns** - existing `pistol` firing family; applies per hand in mixed pairs | Free mitten is a **balled chest guard**: `0.02H-0.06H F`, `0.10H-0.14H` free-side, in the lower half of the pistol grip band. It makes a tiny `0.01H` inward squeeze on a slow, non-synchronized breath. The pistol hand continues to use `FIRING_STANCES.pistol`. | Aim hand remains direct. Free hand trails only half as much as a duelist wing and never crosses the barrel. At high gait it draws `0.02H` closer to center, like protecting the body while running. | Raise/linger/settle remain 90/250/180 ms. On each recoil, the free hand pulses `0.025H-0.04H` toward the weapon wrist, stopping short so the one-hand silhouette survives, then catches at chest. During recovery it falls only back to the chest guard, not manifest rest. | Slight weapon-side turn from the firing stance; feet use a narrow stagger with weapon-side foot `+0.04H F` and rear foot `-0.06H F`. Recoil nudges rear-foot ownership but does not add root motion. | A visible **fist parked at the sternum catches every shot**. It is the smallest, clearest cure for the limp pistol hand. |
| **Fist-guns / worn emitters** - existing `fist-gun` firing family | Single emitter: firing fist at its chest-capped target; empty mitten at the opposite high boxing guard. Dual emitters: both fists own asymmetric chest-level aim anchors. Micro-motion is an alternating `<=0.012H` charge pulse. | Body stays squared. Both hands remain forward; the non-firing hand is allowed gait/inertia only around its guard anchor. No hand approaches the face. | The emitting fist is the muzzle and extends per existing stance. A bare off-hand stays home like boxing. Dual firing alternates recoil by hand parity; sustained fire makes a restrained alternating buzz, not synchronized pumping. Recovery returns both fists to a wide guard. | Squared feet, `0.08H-0.10H` lateral spread and mild crouch. Existing `bodyTurn: 0` remains law. | The whole silhouette says **two-fisted guard**, even when only one gauntlet emits. |
| **Long guns, scatterguns, rapid guns, and launchers** - existing firing families with 2H/mounted geometry | There is no decorative free hand: the second mitten is the forward support grip. Idle micro-motion is a shared `<=0.01H` compression along the weapon axis, with the support hand moving less than the trigger hand. A genuinely compact 1H outlier falls back to the pistol chest guard. | Both hands keep the aim line; stride energy moves feet/body and supplies only bounded weapon-weight lag. Scatter/launcher support is stiffest; rapid tools may buzz `<=0.008H` under sustained fire. | Preserve each `FIRING_STANCES` band and spacing. Scatter/launcher anticipation widens rear plant and tightens support. Rapid fire alternates tiny support compression with recoil. Recovery: trigger hand settles first, support hand follows once; launchers hold the brace longest within the same ranged settle. | Long gun: modest side-on stance. Scatter/launcher: forward lean and wider rear plant. Rapid: compact athletic base. Never translate the whole gun toward the face. | The forward mitten visibly **clamps the fore-end before the shot**, then releases one pixel of compression after recoil. |
| **Thrown implements** - any `delivery: thrown` / `thrown` block, regardless of painted family or grip tag | Free mitten is a forward **spotting hand**, `0.12H-0.17H F` and `0.07H` free-side, with a slow `<=0.018H` aim trace. Held implement remains forward-level at rest; no permanent behind-shoulder pose. | Spot hand stays closer to aim than the throwing hand and has low gait amplitude. A 2H-tagged throwable may bring both hands to the implement only if the authored throw already does so. | Withdrawal: spotting hand reaches `0.03H` farther while throwing hand goes behind shoulder. Delivery: spot hand cuts inward to chest as the implement passes it. Follow-through: spot hand opens to free side and then reacquires the forward point. Never apply the retained 250 ms aimed-gun linger. | Body coils away during withdrawal, drives forward at release, and retains a staggered thrower's base: lead foot `+0.08H F`, rear foot `-0.10H F`. | The free mitten **points at the destination before the throw and snaps shut at release**. |
| **Compact caster foci** - wand, rod, scepter, orb, focus, 1H relic/totem | Focus hand uses the existing wand/aim anchor. Free mitten floats on the opposite side of the focus, `0.08H-0.13H` from center, as a loose **spell frame**. It draws a small vertical ellipse (`<=0.02H`) at 0.55-0.75 Hz. | Both hands float around a centered caster triangle; generic fore-aft swing is reduced. The free hand trails more vertically than laterally so it does not look like a second gun. | Anticipation opens the frame; cast draws the free hand inward across the focus, then releases it `0.08H-0.14H` free-side as the projectile/beam leaves. Combo casts alternate inward and outward framing paths. Recovery folds the hand back beside the focus with one buoyant overshoot. | Body remains tall/centered with only the existing small `bodyAdvance/bodyTurn`. Feet are narrow and parallel enough to read mobile, spreading `0.04H` on charged casts. | The free mitten **cups an invisible spell, then peels away as it launches**. |
| **Tomes** - almanac, bestiary, chapbook, compendium, grimoire, ledger, manuscript, psalter, spellbook, tome | Book remains open/stable at chest. The free mitten owns the page: it rests just above the lower page edge, offset `0.08H-0.12H` from book center, and performs an intermittent two-beat **trace -> tap** rather than constant bob. Existing page art remains separate. | Book hand is aim-stable. Page hand trails within `0.025H` and periodically returns to the page anchor; generic arm swing is suppressed. Feet/body carry travel. | Anticipation traces from page edge toward the target. On cast it leaves the book for the existing `castingHand` target; on repeated beats it alternates short page trace and outward cast so the hand does not teleport. Beam/channel: draw one slow rune loop around the emitter. Recovery makes a final page tap, then settles to the lower edge before the 600 ms close. | Centered body, minimal turn, feet in a shallow open V (`0.06H` lateral each side). Charged cast widens feet and leans only `0.02H F`; the open book stays readable. | The free mitten **reads the page, traces the line, and throws the spell**. This is DD's clearest caster signature. |
| **2H swords** - `twoHanded` sword, greatsword, broadsword, katana/nodachi, energy blade | Both hands are placed on the grip/haft by the current hard constraint. At idle the lead grip is forward-ready and the rear grip breathes through a shared `<=0.008H` axial compression; there is no independent free-hand sway. | The pair moves as one weighted unit. Movement trail is carried through body/weapon angle; the rear grip never detaches. | Existing orbit, chop, greatsword variants, spin, planted-head exceptions, and named combo grip writers own both hands. Anticipation may widen spacing; contact may compress it; recovery preserves both grips until the weapon returns forward. No generic pose layer writes either hand during hard ownership. | Broad rear plant, body slightly weapon-side at idle. Existing full-body combo footwork wins. Neutral feet are split `0.08H F/-0.10H F` with `0.08H` lateral width. | Before a heavy beat the rear mitten **slides one short step down the haft**, visibly loading leverage. |
| **2H heavy tools** - maul, warhammer, mace, axe, cleaver, flail, spade, exotic heavy implements | Both hands remain on a truthful haft when `twoHanded`. Idle spacing is wider than 2H swords (`+0.03H-0.06H`) and the shared micro-motion is a slow downward “weight test” (`<=0.012H`) rather than axial breathing. | Weapon unit trails more strongly, but both grips remain exact relative to each other. Feet shorten stride under the load. | Chops/slams raise both grips; orbit moves remain existing truth. At contact, rear hand closes spacing slightly while body squashes. Recovery holds the low finish for one readable beat, then rear hand leads the lift back to ready. If art is one-handed despite a 2H tag, do not invent a hard grip - see resolver law below. | Deepest neutral crouch of the roster (`0.02H-0.04H`), widest rear plant (`0.12H`). Quake and signature footwork override. | Both mittens perform a tiny **pre-swing weight test**, then the rear hand visibly hauls the tool out of recovery. |
| **Polearms** - glaive, halberd, naginata, partisan, melee spear | Both mittens form a long, separated guide/pivot line. Front hand is `0.10H-0.16H F`; rear hand is `0.12H-0.18H -F`; spacing follows the real haft. Micro-motion is an opposed `<=0.01H` slide - front forward while rear back, then reverse. | Hands keep the axis while feet make a side-on shuffle. Movement may slide both grips together `<=0.02H` along the haft; they never bob independently. | Thrust: front guides while rear drives; trail-side foot plants. Sweep/orbit: rear becomes pivot and front hand slides through a bounded spacing change. Named Compass/Hookbreak/signature grips remain authoritative. Recovery reverses the slide into the long guard, rear hand arriving last. Thrown spears use the thrown row instead. | Most side-on body of the roster; long fencing split with front foot `+0.10H F`, rear `-0.12H F`, `0.06H-0.10H` lateral width. Sweeps widen, thrusts lengthen. | A visible **front-guide/rear-pivot grip slide** makes the shaft feel long without elbows. |
| **Beams** - delivery overlay on gun, fist-gun, focus, staff, or tome | Start from the base family's hand contract. During charge, the non-emitting hand tightens toward its job: fore-end grip, boxing guard, spell frame, or page trace. No universal beam pose. | During channel, hands are aim-stable; locomotion expression moves to feet/body. Apply only a low-amplitude (`<=0.008H`) energy tremor perpendicular to the beam, suppressed for launchers/heavy staves. | Charge opens/locks the family triangle. Channel slowly increases body lean/foot plant without lifting hands toward the face. On overheat or release, the non-emitting hand snaps `0.03H-0.06H` away from the source, then returns through the base family's recovery. Tome beams keep the book stable and loop the cast hand. | Feet widen by `0.03H-0.06H` across charge and remain planted through channel. Compact fist beams stay squared; staff/heavy beams use rear brace; focus/tome beams stay centered. | At overheat the support/casting mitten **breaks away from the beam as if stung**, then carefully re-approaches. |
| **Dual-wield pairs** - overlay for `dual`, two equipped pieces, and mixed eligible pairs | Resolve each hand from its own weapon. Matched melee pairs hold unequal guards: lead slightly forward, off slightly rear/outboard. Matched guns use separate firing targets. Mixed pairs preserve both family jobs and choose a compact shared triangle; the lead family may not overwrite the other. Micro-motion alternates by hand. | Both hands keep their roles while stride phase remains opposite. Do not reintroduce a generic “back weapon lean” as the only distinction; the rear hand needs a real target. | Preserve `DUAL_MELEE_PAIR_BAR`: lead/off/lead/off/lead/**both**. The non-striking hand stays in its family guard and previews its next beat. `routeSwingChannels()` continues to move only the selected hand. Crossfall keeps the authored opposing paths and both-hand convergence. Gun recoil remains hand-indexed. Recovery lands the last striker rearward and the next striker subtly forward. | Feet shift lead/rear emphasis with the semantic striking hand, but do not swap screen-left/right anchors in one frame. Crossfall uses the existing planted two-hand/body beat. | The guard **quietly passes the lead from one mitten to the other**; Crossfall is the one deliberate both-hand exception. |

## Resolver coverage for the shared roster

Family strings alone are insufficient. `delivery`, `classPool`, structured delivery blocks, `twoHanded`,
`dual`, worn classification, and the existing melee combo selection all carry truth. Resolution should use
the following priority and exact coverage.

### Priority

1. Preserve action-specific hard owners: melee tell, brace, ultimate/boss pose, close-blade sampler, named
   signature grip, orbit, or Crossfall.
2. Resolve `thrown` from the structured block or delivery before painted family.
3. Resolve worn gun/beam as fist-gun; worn melee as fists or claws according to existing
   `meleeComboSelectionFor()` / `isWornWeapon()` semantics.
4. Resolve book families before generic caster grip.
5. Resolve ranged firing family with `firingStanceFamilyFor()`; do not duplicate payload/scatter/rapid
   detection.
6. Resolve melee from existing combo/style truth, then grip/shape.
7. Apply beam and dual as overlays without discarding the base family.

### Exact family-string homes

| Pose home | Current `tags.family` values and structural qualifications |
| --- | --- |
| 1H blades | `saber`, `sword`, `broadsword`, `energy-blade`, cutting `cleaver`, plus `katana` only when actually 1H; `rapier` uses the narrower thrusting variant. |
| Daggers/claws | `fist-blade`; existing `comboVariant: dagger\|claw`; rake selection; claw/talon/rake named `exotic-melee` or `gauntlet`. Do not classify every worn gauntlet as claw. |
| 1H blunt | `axe`, `cleaver`, `flail`, `mace`, `warhammer`, non-claw `exotic-melee` when 1H and not delivery-special. |
| Fists | `fist`; melee `gauntlet` and worn punch implements after claw and firing cases. |
| 2H swords | `greatsword`, `nodachi`, `katana`, `sword`, `broadsword`, `energy-blade` when `twoHanded`/truthful 2H art. |
| 2H heavy | `axe`, `cleaver`, `flail`, `mace`, `maul`, `warhammer`, `spade`, heavy `exotic-melee` when truthful 2H art. |
| Polearms | `glaive`, `halberd`, `naginata`, `partisan`, melee `spear`; thrust/sweep comes from existing style/combo selection. |
| Tome | `almanac`, `bestiary`, `chapbook`, `compendium`, `grimoire`, `ledger`, `manuscript`, `psalter`, `spellbook`, `tome`. |
| Compact focus | `wand`, `rod`, `scepter`, `orb`, `focus`, `relic/totem`; compact caster fallbacks selected as `wand` by the firing resolver. |
| Staff / long caster brace | `staff` and long 2H/mounted focus cases selected as `staff` by the firing resolver; melee staff art may instead use the polearm grip grammar without changing its caster delivery. |
| Pistol / long / scatter / rapid / launcher | Reuse `firingStanceFamilyFor()` across `pistol`, `hand-cannon`, `nailgun`, `machine-pistol`, `gun`, `lever-rifle`, `marksman-rifle`, `railgun`, `scrap-cannon`, `shotgun`, `blunderbuss`, `concussion-cannon`, `heavy-ordnance`, and `exotic-ranged`. Structured mechanism wins over the label. |
| Thrown | `thrown`, `harpoon`, and any thrown `axe`, `saber`, `spear`, `warhammer`, `exotic-melee`, or other family. Delivery wins. |
| Fist-gun | Gun/beam/cast delivery on worn `gauntlet`/fist art. It is never promoted toward the face. |
| Beam overlay | Any structured `beam`, including book, focus, gauntlet, machine-pistol, heavy-ordnance, staff, or relic/totem families. |
| Dual overlay | `grip: dual`, `def.dual`, or two independently equipped pair-eligible pieces. Resolve per hand; do not assume matched family. |

This accounts for every current concrete family value in `packages/shared/src/weapons.ts` and
`packages/shared/src/weapons-expansion.generated.ts`. The generated `exotic-*`, `heavy-ordnance`, and
`gauntlet` buckets deliberately remain mechanism/shape resolved because their labels mix incompatible
poses.

## Composition and interruption priority

Late pose writers must compose in this order, from strongest to weakest:

1. death/down/jump/boss/ultimate presentation that deliberately owns the whole rig;
2. brace and enemy telegraph guard;
3. signature weapon grips, orbit, close-blade absolute targets, 2H hard haft, and Crossfall;
4. ordinary attack/combo selected-hand targets;
5. ranged aimed stance and recoil;
6. family idle/move targets;
7. gait, inertia excitation, and micro-motion springs.

“Stronger” means it controls the final target or blend, not that lower layers stop being sampled. On release,
the family target should already be available as the spring's next equilibrium.

## Small-scale acceptance

The pass succeeds only if all of these hold:

- with weapon trails, muzzle flashes, pages, and particles hidden, a still pose distinguishes at least:
  pistol, 1H blade, 1H blunt, fists, tome, 2H heavy, polearm, and close blade;
- a one-handed weapon never leaves the second mitten at manifest rest in idle, move, attack, or recovery;
- covering the off-hand makes the intended safety/weight story visibly worse - chest guard, duelist wing,
  forward ward, spot hand, or page/cast hand;
- at four cardinal aims and diagonals, the off-hand does not cover the face, muzzle, book, or business edge;
- attack-speed changes compress time only; target distance and personality amplitude do not grow with
  Heavy or shrink with Swift;
- reduced motion removes loops/tremor but retains the static family triangle and all combat timing;
- after swap, down/death, LOD sleep, clock cut, or combo expiry, no hand retains an old family target or
  stale spring velocity;
- dual mixed pairs resolve each hand separately, and Crossfall remains the sole authored both-hand finale;
- all 2H art keeps both hands visibly on the implement whenever the current rig's geometric truth says it
  is two-handed.

## Recommended first art-direction capture

Capture the same character and camera with VFX disabled at idle, full run, anticipation, contact, and
recovery for these five stress cases:

1. single pistol - chest fist versus the old limp hand;
2. Rattler Sabre / 1H sword - duelist wing and opposite cut;
3. Twin Bowie Fangs or a single claw - forward ward plus existing lunge;
4. a tome - page trace, cast target, and final page tap;
5. a polearm or 2H heavy - separated grip line and rear-foot plant.

If those reads survive a 50% screenshot scale, the grammar is strong enough to roll across the generated
roster.

## Owner decisions still open

1. **Single-pistol tone:** default to the recommended chest fist (action-hero silhouette), or let pistols
   briefly form a two-hand support clasp on fire (more tactical, less silhouette separation)?
2. **1H blade tone:** default to the recommended open duelist wing, or keep every melee off-hand nearer a
   protective chest guard (safer, but less family contrast)?
3. **2H source of truth:** when generated `tags.grip: "2H"` disagrees with `WeaponDef.twoHanded` or the
   painted art, should the later implementation obey the current geometry boolean (recommended) or promote
   the metadata tag into a hard second grip after an art audit?
