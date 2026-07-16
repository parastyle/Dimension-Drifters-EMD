# Big-Sword Combo Panel — Combat Animation Design

## Decision

Yes: build more big-sword combos to the Driftblade quality bar, but do not distribute the Driftblade's three poses under different weapon art. The current chain is appealing because it changes idea on every beat—diagonal edge, compact pommel, charged forward collapse—while preserving physical continuity between those ideas. Copy that standard of contrast and continuity, not those moves.

The recommended set is:

1. Preserve the current long-nodachi chain as the benchmark, eventually renaming its misleading `greatsword` variant.
2. Add **Momentum** for western greatswords/greatblades: the sword pulls the wielder through three continuously carried turns.
3. Add **Breach** for claymores/zweihanders: formal wide guards, lateral guard-breaking arcs, and a crossguard-led finisher.
4. Add **Compass** for glaives/voulges/fauchards: long-radius cuts made by hand slides and a stationary-body pole orbit.
5. Add **Hookbreak** for bardiches: head-heavy chops, hook-and-haul reversals, and a planted wrench-out.

These are visual combos for the present `CLIENT_VISUAL_COMBOS` stage. Damage remains the single accepted server sweep. Signed/reverse paths, step-specific coverage, and any finisher balance remain part of the accepted combo-step/path protocol backlog.

## 1. The “long katana” is Driftblade

The feedback's active-roster weapon is `driftblade`, displayed as **Driftblade**. Its weapon-data comment calls it the “really long sword” and a “Masamune-homage nodachi.” It is a two-handed, XL `sword` with `displayLength: 320`, `range: 300`, `cooldown: 0.62`, `swingArc: 2.3`, and a grip only five percent from the base. The expansion roster contains longer nodachi/ōdachi cousins, but expansion weapons are explicitly held out of `WEAPON_IDS`; Driftblade is the long katana available to a normal Testing Grounds player.

Driftblade does not author `swingStyle`, `comboFamily`, or `comboVariant`. The shared resolution chain is therefore:

- `swingStyleFor()` sees a two-handed, non-quake weapon and returns `orbit`.
- `meleeComboSelectionFor()` sees a two-handed, non-spin, XL weapon whose data family is exactly `sword`, and selects variant `greatsword`.
- `familyForSignatureVariant("greatsword")` maps that variant to combo family `chop`.
- `MELEE_COMBO_VARIANT_SEQUENCES.greatsword` is exactly:
  1. `MELEE_COMBO_SEQUENCES.chop[0]` — **shoulder chop**;
  2. `POMMEL_BASH_COMBO_STEP` — **pommel bash**;
  3. `TRUE_CHARGED_SLAM_COMBO_STEP` — **true charged step-slash**.
- While a combo pose is live, `SpriteRig` derives `poseStyle` from the combo family, not the underlying `orbit` style. Step 1 therefore uses the chop renderer; steps 2 and 3 jump into the bespoke `applyPommelBash()` and `applyTrueChargedSlam()` branches. Driftblade is not visually orbiting during this chain.

At base stats, each visible pose lasts `0.62 × SWING_WINDOW_FRAC 0.64 = 0.3968 s`. Accepted attacks remain `0.62 s` apart, so the authored end guard occupies the roughly 223 ms cadence gap. The chain grace is `0.35 × 0.62 = 0.217 s`, after which the guard releases to neutral over 120 ms.

### Why it feels cool

The strongest quality is **contrast with causality**. Each step changes attack class, but the previous exit creates the next entry.

| Quality | What the player is actually seeing |
|---|---|
| Step contrast | Step 1 is a readable long-edge diagonal. Step 2 reverses the weapon and makes a short, body-led pommel strike. Step 3 expands back to the full 320 px blade and collapses into a committed forward line. The sequence is large → compact → enormous, not three alternating crescents. |
| Anticipation contrast | The shoulder chop coils for `0.00–0.24`; the pommel fires almost immediately from `0.12–0.30`; the finisher spends `0.00–0.46` loading, trembling, foreshortening, and stepping before its `0.46–0.64` active fall. The middle beat accelerates the phrase and makes the final delay feel intentional rather than sluggish. |
| Silhouette contrast | Step 1 reads as an oblique bar outside the torso. Step 2 points the weapon backward (`aim + π`), compresses the two-hand spacing, and puts the body in front of the blow. Step 3 places the blade behind the character, turns it edge-on, depth-swaps it, then restores it as one long line down aim. These remain different with VFX disabled. |
| Follow-through | Step 1 buries low. After `0.44`, the pommel branch does not return to idle; it deliberately travels into the high load used by the finisher. Step 3 holds the body at `0.88y`, art translated `0.24H` forward, until `0.80`, then only partially unwinds. The weapon always appears to have somewhere it came from and somewhere it is going. |
| Weight curves | The ordinary chop uses an ease-out coil followed by a quadratic fall. The finisher uses smooth charge phases, then a `p²` fall from `0.46–0.61`, a three-percent-pose deformation beat at `0.61–0.64`, and a planted hold. Slow-in/fast-out acceleration plus a non-instant recovery sells mass better than more particles would. |
| Fake 3D | The finisher shrinks weapon length to `0.22×`, swaps it behind/in front of the body, restores it during the fall, changes hand spacing, moves the attack shadow, and gives the weapon a brief length recoil. The long thin art makes those projection changes unusually legible from above. |
| Cadence | The active pose ends before the next legal attack, but `comboHoldPose` preserves its guard through ready time and grace. The next attack starts from a meaningful silhouette instead of teleporting from idle. The short pommel beat also breaks the metronomic feel of three identical 397 ms motions even though the accepted cadence is unchanged. |
| Secondary motion | A combo owns the relevant hands and feet at weight 1 through active motion. From `activeEnd` to `followEnd`, `actionOwnershipAt()` releases that ownership through a smootherstep curve. On the first released frame, the spring inherits the authored point and bounded terminal velocity. The follow-through therefore decays as residual energy instead of snapping into procedural idle. The rear hand remains a hard geometric child of the two-handed haft. |

The honest caveat is that the current PER/VFX is not the reason this chain works. Stage 1 enriches only the rig's local descriptor; Arena/VFX and server geometry retain the original centered sweep. Driftblade's fallback still reads it as a heavy two-handed swing and can add a wide blade trail, cleave flash, and shockwave, but it does not know “pommel” or “true charged step-slash.” The pose is carrying the quality. Step-aware ribbons below should reinforce that pose without pretending the current server path changed.

## 2. Actual big-sword and sword-adjacent roster

The data taxonomy is not the animation taxonomy. There is no `claymore` family; the claymore and zweihander are `broadsword`. One bardiche is `axe`; another is `glaive`. Several surreal objects are tagged `sword`. That is why final routing should be explicit weapon metadata, not another name test inside `SpriteRig`.

`†` denotes an expansion weapon currently present in `WEAPONS` but excluded from the active cycle/gallery/drop pool.

| Weapon id | Display name | Actual data family / size | Current shared style → visual combo | Panel routing |
|---|---|---|---|---|
| `driftblade` | Driftblade | `sword` / XL | `orbit` → `greatsword` | Preserve nodachi benchmark |
| `x2-gravechill-nodachi`† | Gravechill Nodachi | `nodachi` / XL | quake `chop` → `quake-mauler` | Nodachi benchmark; do not hammer-flip |
| `x2-stormpetal-odachi`† | Stormpetal Odachi | `nodachi` / XL | `orbit` → `greatsword` | Nodachi benchmark |
| `tombstone-greatsword` | Tombstone Greatsword | `sword` / L | quake `chop` → `quake-mauler` | Momentum greatsword; quake remaps to its contacts |
| `x-sword-whirlwind` | Dervish Greatblade | `greatsword` / L | explicit `spin` → no combo | Keep continuous two-turn spin; deliberate exception |
| `x-sword-coffin` | Reaper's Lid | `sword` / L | `orbit` → no combo | Momentum greatsword chassis |
| `x-sword-bone` | Wyrmtooth | `sword` / L | `orbit` → no combo | Momentum greatsword chassis |
| `x2-riftcleaver-greatblade`† | Riftcleaver Greatblade | `energy-blade` / L | `orbit` → `greatsword` | Momentum greatsword with energy PER skin |
| `x-sword-anchor` | Drowned Anchor | `sword` / L | `orbit` → no combo | Exclude: build an anchor/mauler chain later |
| `x2-tombwarden-claymore`† | Tombwarden Claymore | `broadsword` / XL | quake `chop` → `quake-mauler` | Breach claymore; do not hammer-flip |
| `x2-dustreaper-zweihander`† | Dustreaper Zweihander | `broadsword` / XL | `orbit` → `greatsword` | Breach claymore |
| `x2-dustdevil-glaive`† | Dustdevil Glaive | `glaive` / L | quake `chop` → `quake-mauler` | Compass glaive; do not hammer-flip |
| `x2-thunderhead-voulge`† | Thunderhead Voulge | `glaive` / XL | `orbit` → no combo | Compass glaive |
| `x2-wickfire-fauchard`† | Wickfire Fauchard | `glaive` / L | `orbit` → no combo | Compass glaive |
| `x2-blightfork-glaive`† | Blightfork Glaive | `glaive` / L | `orbit` → no combo | Compass glaive |
| `x2-permafrost-bardiche`† | Permafrost Bardiche | `axe` / XL | `orbit` → no combo | Hookbreak bardiche |
| `x2-quarry-splitter-bardiche`† | Quarry-Splitter Bardiche | `glaive` / XL | quake `chop` → `quake-mauler` | Hookbreak bardiche; do not hammer-flip |

Two exclusions are intentional. `x-sword-buzzsaw` is two-handed but size M and needs a powered-saw grammar, not artificial greatsword weight. `gravediggers-spade` borrows the Tombstone sprite as placeholder art but is actually family `spade`; it should not inherit a sword combo because of that temporary texture.

The current routing exposes three issues this panel should correct:

1. The existing variant named `greatsword` is really the **Driftblade quality benchmark**, not a sufficient western-greatsword family. Its TCS-inspired third beat is precisely the shape that should not be copied everywhere.
2. The resolver's first rule—two-handed + quake + L/XL—wins before shape. Named nodachi, claymore, glaive, and bardiche weapons can therefore receive the hammer-head fulcrum flip.
3. A two-handed L `sword`, `glaive`, or `axe` that misses a name regex stays `orbit`, and `orbit` has no three-step family. That is why Reaper's Lid, Wyrmtooth, Permafrost Bardiche, and several glaives currently have no combo.

## 3. Shared animation grammar for the new families

Use the same normalized clock as the shipped stack:

- `t = elapsed / poseSeconds`, clamped to `0–1`.
- `H = TARGET_BODY_H = 76 px`.
- `F` is the frozen-aim direction in rig-local screen space; `N` is the rightward perpendicular.
- “Translate” below means attack-art/body-part translation, not movement of `root`. Keep the visible body within `0.18H` of the authoritative root; hands and the blade may use their normal reach channels. The shadow stays on the ground path.
- Every new big-sword step is two-handed. The lead hand drives the authored grip, the rear hand is reconstructed up the haft, and both use action ownership. Vary `attackHandSpacing` to show leverage; do not animate the rear hand as an independent loose spring.
- `activeStart`, `activeEnd`, `impact`, and `followEnd` below are target shared step fractions. At Stage 1 they change presentation only. A quake carrier must remap its visible contact to `swing.impactSeconds / poseSeconds`—normally `0.52` for a `chop` descriptor—just as the fulcrum flip already remaps its canonical contact. Do not let a new pose detonate the old quake on an unrelated frame.

### Jiggle handoff rule

Unless a step explicitly says otherwise, hands and feet ramp to ownership 1 over anticipation, stay exactly authored through `activeEnd`, then release through `followEnd`. “Handoff at 0.58,” for example, means the first frame after `t = 0.58` transfers the authored terminal local velocity to `PROCEDURAL_JIGGLE`; it does not mean the pose stops being authored. The spring is secondary overshoot layered under the continuing follow pose. The cadence hold owns nothing, allowing a small living settle without corrupting the next guard.

### PER ribbon rule

PER must describe the **business edge**, not fill every movement of a long sprite:

- Greatswords get thick, massed ribbons with torn/squared ends.
- Claymores get broad, even guard-breaking planes.
- Glaives get thin outer-radius ribbons with an empty center and a bright head.
- Bardiches get short, head-heavy wedges and hooks; the shaft never paints a sword-width trail.

The shapes specified below are the final accepted-path targets. At the current visual-only stage, a reverse, hook, or near-circle ribbon is cosmetic and must not imply additional hits: clip the full-opacity business edge to the legacy centered sweep and show any out-of-path travel only as a faint motion echo, or hold the full ribbon until accepted paths ship. Never render two equally bright “damage” ribbons for one accepted sweep. Reserve any secondary setup scrape for low alpha and neutral paint; the one contact ribbon remains dominant. Once accepted step paths ship, PER should sample the same signed `angleAt()`/path rather than maintaining a client-only geometry table.

## 4. Family A — Momentum greatsword

**Fantasy:** the blade is a flywheel. The wielder can redirect it, but cannot stop it cleanly. Step 1 creates angular momentum, step 2 carries that same motion behind the body into a rising wheel, and step 3 lets the runaway mass pull the character through a long cleave and skid. Take the committed recovery of a Souls ultra-greatsword, the carried heavy-chain flow of *NieR: Automata*, and Cloud's blade-led poses from *Final Fantasy VII*—without borrowing Driftblade's pommel beat or forward TCS collapse.

**Eligible weapons:** `tombstone-greatsword`, `x-sword-coffin`, `x-sword-bone`, and `x2-riftcleaver-greatblade`. Dervish remains `spin`; Drowned Anchor is not included.

**Three-frame family read:** high outside bar → low wheel behind the hips → enormous C-shaped cleave with a kneeling skid.

### Step 1 — Falling Gate

- **Timing:** anticipation `0.00–0.22`; active `0.22–0.54`; contact `0.50`; follow `0.54–0.78`; low outside guard `0.78–1.00`.
- **Silhouette and motion:** begin with the blade broadside above the weapon shoulder at roughly 45 degrees to aim. Pull the pommel `0.06H` backward while the tip remains visually high, then drive a descending forehand across aim. Use ease-out for the first half of the coil and `p²` for the active fall. At contact, the sword and both arms form one long diagonal through the torso; finish with the tip low and far across the body, not planted forward like Driftblade.
- **Footwork/body:** rear foot is the visual plant. During anticipation, shift visible body art `-0.04H F`; during the fall, pass through root to `+0.10H F + 0.04H N`. Rotate the torso about `0.20 rad` through the cut and compress to `0.90y` at contact. The root/hurtbox does not move.
- **Jiggle:** handoff starts at `0.54`. Preserve the high forward/down terminal velocity through `0.78`; this should make the hands settle a few pixels past the authored low guard. Do not zero the spring at the cadence hold, because step 2 is supposed to look pulled out of this exit.
- **PER ribbon:** one thick tapered wedge over the outer 70 percent of blade radius. Its leading edge is clean; its trailing end is squared and slightly torn, like a heavy paint-loaded palette knife. Peak opacity is `0.46–0.54`; no generic full shockwave ring on ordinary contact.
- **Top-down/small-scale read:** the critical pixels are the long 45-degree blade/body line and the contact squash. Do not make the windup edge-on; a 124–142 px greatblade must still show a broad weapon face before it moves.

### Step 2 — Backswing Wheel

- **Timing:** carry `0.00–0.10`; active rise `0.10–0.49`; contact `0.44`; follow `0.49–0.77`; high rear guard `0.77–1.00`.
- **Silhouette and motion:** start exactly in Falling Gate's low outside guard. The tip continues in the same rotational direction, disappears behind the hips via one depth swap, foreshortens no lower than `0.24×`, and rises on the opposite side. This is not a reverse backhand; the sword makes a continuous moulinet while the body changes which side supports it. End with the blade high behind the opposite shoulder, already loading the finisher.
- **Footwork/body:** both feet pivot in place. Shift visible body art no more than `0.07H N` away from the passing blade, then let it return to center as the blade rises. Torso counter-rotates first, then follows late, producing a two-frame “weapon pulls shoulders” lag.
- **Jiggle:** handoff starts at `0.49`, when the hands still have upward/around-body velocity. Release through `0.77`; the spring's upward overshoot should make the high guard breathe once. The two-handed rear grip remains constrained throughout the depth swap.
- **PER ribbon:** a hooked comma/J ribbon whose middle, behind-body portion is occluded with the weapon. It begins thick at the prior low exit, narrows while edge-on behind the torso, then widens at the rising contact. Do not draw a mirrored generic crescent; the continuous hook is the family's identity.
- **Top-down/small-scale read:** one unmistakable depth swap, one brief short-blade projection, and the low-to-high change are enough. More than one full paper flip will turn it into the Dervish spin.

### Step 3 — Runaway Cleave

- **Timing:** dragged coil `0.00–0.26`; active turn `0.26–0.64`; principal contact `0.54`; follow/skid `0.64–0.86`; exhausted low hold `0.86–1.00`.
- **Silhouette and motion:** the high rear guard pulls the character into a single 220–250-degree ground-plane cleave. The blade leads; hands follow two frames later; shoulders and body follow two frames after that. Use the existing orbit ellipse/depth swap once, but rotate the body only about 110 degrees in paper profile—the sword travels farther than the wielder. The final silhouette is a low extended blade, torso folded toward it, one knee visually sunk.
- **Finisher flourish:** after active contact, keep the tip moving another 35–45 degrees and drag a short ground gouge while the visible body skids `0.15H F + 0.05H N`. Add a two-frame blade-length overshoot (`1.00 → 1.05 → 0.98`) and a restrained spray of painted steel flecks at the tip. This is involuntary inertia, not an explosion or vertical slam.
- **Footwork/body:** front foot catches at `0.52`; the back foot swings around and plants at `0.68`. Shadow stretches along the skid to about `1.16x/0.82y`, then settles. Body squash bottoms near `0.88y`, never fake-jumps.
- **Jiggle:** handoff starts at `0.64` with strong tangential velocity and releases through `0.86`. Let the spring contribute the last few pixels of tip/hand drag, but cap it inside current collision tolerance. The exhausted hold owns zero and should visibly settle once.
- **PER ribbon:** a heavy C ribbon, open behind the character rather than a full ring. It starts narrow, becomes widest over the final third before contact, and ends in two torn paint lobes aligned with the gouge. The gouge is a dim ground mark after `0.64`, not a second active ribbon.
- **Top-down/small-scale read:** the sword's C path and the body's much smaller counter-turn separate this from whirlwind. The kneeling skid is the punctuation mark. With VFX off, capture must still read “the sword dragged me through that.”

## 5. Family B — Breach claymore / zweihander

**Fantasy:** a trained two-handed swordsman breaks space open with broad formal guards. The claymore alternates sides instead of carrying one continuous wheel; its crossguard, wide stance, and lateral body line are the graphic motifs. Steal the huge guard transitions of *For Honor*'s Highlander and the broad crowd-clearing zweihander arcs of Souls games. Do not use Driftblade's compact pommel strike or charge-and-collapse finisher.

**Eligible weapons:** `x2-tombwarden-claymore` and `x2-dustreaper-zweihander`.

**Three-frame family read:** horizontal gate → rising diagonal roof guard → crossguard barricade exploding into one huge crosscut.

### Step 1 — Highland Gate

- **Timing:** open guard `0.00–0.18`; active crosscut `0.18–0.58`; contact through aim `0.49`; follow `0.58–0.80`; crossed hip guard `0.80–1.00`.
- **Silhouette and motion:** hold the sword nearly horizontal across the upper body so blade and crossguard form a visible T. Open the elbows, then execute a broad waist-height forehand. Keep weapon length broadside throughout; this family announces coverage rather than hiding depth. End with the blade across the far hip and the pommel close to the near shoulder.
- **Footwork/body:** widen the feet by about `0.05H` each. The lead foot steps `0.08H N` into the cut; body art shifts only `0.06H F`. Torso stays comparatively upright (`0.95y` at contact) so the wide arm span, not a collapse, sells power.
- **Jiggle:** handoff at `0.58`, release through `0.80`. Terminal velocity is mostly lateral. The spring should tug the crossed hip guard sideways, setting up step 2's opposite plant.
- **PER ribbon:** a broad, even-width crescent with a relatively straight leading edge—more like a door being swept open than a tapered katana streak. Keep the inner 30 percent faint so the weapon remains visible over the body.
- **Top-down/small-scale read:** prioritize the horizontal sword/T-shaped crossguard and wide feet. Avoid body foreshortening at contact; it would collapse the family into the greatsword or nodachi silhouette.

### Step 2 — Rising Ward

- **Timing:** heel switch `0.00–0.12`; active reverse diagonal `0.12–0.52`; contact `0.46`; follow `0.52–0.78`; roof guard `0.78–1.00`.
- **Silhouette and motion:** from the crossed hip guard, lead with the pommel and lift a reverse diagonal across aim. The blade arrives after the hilt, producing a guard-breaking “bar then edge” read without making the pommel a separate attack. Finish in a high roof guard: sword diagonal above the head, crossguard clearly outside the torso, point aimed to the rear corner.
- **Footwork/body:** transfer plant to the opposite foot and move visible body art `0.08H` laterally across root. Torso first leans `0.10 rad` away from the blade, then unwinds `0.24 rad` with it. Add a slight `1.05y` stretch at the high follow so the roof guard is not lost against the body.
- **Jiggle:** handoff at `0.52`, release through `0.78`. Preserve upward terminal velocity; one spring overshoot raises the roof guard by two or three pixels, then gravity-like settle restores it.
- **PER ribbon:** a mirrored diagonal plane, narrower at the hilt and broad at the last 40 percent. Add a tiny neutral-steel crossguard spark where the hilt passes aim, but keep it under 25 percent of the main edge opacity so it cannot read as a second hit.
- **Top-down/small-scale read:** the key transition is low far hip to high opposite roof. It should resemble a large opening/closing pair when steps 1 and 2 are played back-to-back.

### Step 3 — Bind, Break, Cast Off

- **Timing:** barricade `0.00–0.18`; bind pressure `0.18–0.30`; active cast-off `0.30–0.66`; principal contact `0.54`; follow `0.66–0.86`; open challenge hold `0.86–1.00`.
- **Silhouette and motion:** lower the roof guard into a horizontal barricade across the chest, crossguard leading toward aim. Compress hand spacing from roughly `0.42H` to `0.28H` during the bind so the hilt visibly becomes the fulcrum. Then slide the rear hand apart and cast the blade into an enormous reverse horizontal cut. The body stays square until the blade launches, making the release feel like a broken bind rather than another windup.
- **Finisher flourish:** at `0.28`, use a small square crossguard flash and a one-frame body recoil, then release the real edge. After contact, the blade finishes fully extended while the rear hand slides back to maximum leverage and the off-side shoulder opens toward camera. The final blade/body lines form a St Andrew's-cross silhouette. No spin, jump, or planted forward slam.
- **Footwork/body:** plant both feet during bind. On release, the rear foot cross-steps only `0.10H N`; body art translates `0.08H N + 0.07H F`. Let the torso scaleX narrow briefly during the bind and pop broad at cast-off, using the paper cutout itself as the guard-break accent.
- **Jiggle:** retain full ownership through `0.66`; release through `0.86`. This later handoff is important—the bind must be rigid. The inherited lateral velocity then produces a controlled sword-tip overshoot without loosening the hilt during the setup.
- **PER ribbon:** a two-part composition with only one dominant attack: a short, low-alpha rectangular “bind scrape” at the center from `0.18–0.30`, followed by one very wide, opaque crosscut from `0.30–0.66`. Together they suggest a broken X, but only the long arc receives painted-edge brightness.
- **Top-down/small-scale read:** the held horizontal barricade must last long enough to register at 76 px body height. The crossguard square and sudden full-radius line are the family finisher; particles are optional.

## 6. Family C — Compass glaive / voulge / fauchard

**Fantasy:** reach through leverage. The blade head travels huge distances while the wielder and shaft remain controlled. Borrow the grounded circular polearm language of *Dynasty Warriors* and the visible grip slides of *Monster Hunter*'s Insect Glaive, but keep both feet on the paper ground and avoid aerial acrobatics. This is not a sword with a longer sprite.

**Eligible weapons:** `x2-dustdevil-glaive`, `x2-thunderhead-voulge`, `x2-wickfire-fauchard`, and `x2-blightfork-glaive`.

**Three-frame family read:** far outside head → shaft compressed across the back → bright blade head orbiting a mostly stationary body.

### Step 1 — Long Reap

- **Timing:** extend `0.00–0.16`; active reap `0.16–0.58`; contact `0.50`; follow `0.58–0.78`; far-side long guard `0.78–1.00`.
- **Silhouette and motion:** rear hand anchors near the hip; front hand opens hand spacing toward `0.50H`. The shaft starts diagonally behind the body and the blade head draws a 140–160-degree outside arc through aim. The torso counter-leans so the head, shaft, and body form a long zigzag instead of one sword-like line.
- **Footwork/body:** lead foot steps only `0.06H N` toward the outside of the arc. Visible body art shifts `-0.05H N`, opposite the blade head, and rotates at most `0.12 rad`. Reach should come from grip separation and pole angle, not a false dash.
- **Jiggle:** handoff at `0.58`, release through `0.78`. Preserve tangential velocity but keep spring displacement at the hands subtle; the far-away painted head supplies most perceived overshoot.
- **PER ribbon:** a thin crescent restricted to roughly `0.68–1.00` of the weapon radius. Leave the center transparent. Put a compact bright “comet head” at the blade; the shaft gets no ribbon.
- **Top-down/small-scale read:** the empty center and long visible shaft are mandatory. If the ribbon reaches the wielder's hands, it reads as a greatsword.

### Step 2 — Shaft Switch

- **Timing:** choke and pass `0.00–0.12`; active switchback `0.12–0.48`; contact `0.42`; follow `0.48–0.74`; opposite long guard `0.74–1.00`.
- **Silhouette and motion:** compress hand spacing to `0.26H`, draw the blade head behind the body with a single depth swap, then expand the hands as the head snaps through a reverse inside-to-outside cut. Briefly foreshorten the pole to about `0.30×` only while it is edge-on behind the torso. The hands do not literally swap sprites; changing spacing and which elbow leads creates the switch illusion on a bone-lite rig.
- **Footwork/body:** feet remain planted while hips turn under the shaft. Shift visible art `0.05H F` as the head reappears, then `0.04H N` into the opposite guard. The torso counter-rotates against the blade until the last third of active motion.
- **Jiggle:** handoff at `0.48`, release through `0.74`. The spring receives a sharp outward velocity after the hand-spacing expansion, producing a small snap at full reach.
- **PER ribbon:** a narrow reverse hairpin/S: dim and thin during the behind-body pass, bright only as the blade head exits and cuts outward. It must not become two separated crescents.
- **Top-down/small-scale read:** show three unmistakable beats—long pole, brief short projection behind body, long pole on the other side. That projection change is more readable than detailed hand choreography.

### Step 3 — Compass Rose

- **Timing:** rear-foot anchor `0.00–0.24`; active head orbit `0.24–0.68`; principal contact `0.55`; follow/point `0.68–0.88`; forward long guard `0.88–1.00`.
- **Silhouette and motion:** rear hand becomes an almost fixed pivot at the hip while the front hand telescopes from `0.28H` to `0.52H`. The blade head traces about 300 degrees in the ground plane; the body counter-rotates only 70–90 degrees and the shaft depth-swaps once. End with the head forward and the shaft pointing cleanly down aim. Unlike Dervish, the body never performs full paper mirror turns and the rear-hand pivot barely moves.
- **Finisher flourish:** as the head completes its orbit, slide the front hand sharply outward and let the pole “lock” into a forward point. Add a one-frame paper-pop of the blade head, not the whole body, plus a restrained radial dust tick under the rear pivot foot. The flourish is precision after breadth.
- **Footwork/body:** rear foot owns the compass center. Front foot describes a tiny `0.08H` semicircle; visible body translation stays under `0.06H`. Shadow remains centered on the rear foot and rotates/stretch-squashes with the shaft rather than with the head.
- **Jiggle:** handoff at `0.68`, release through `0.88`. The terminal tangential velocity should decay into the forward point; use the hand-spacing lock to prevent a floppy final grip. No spring contribution at the anchored rear hand beyond the normal two-hand constraint.
- **PER ribbon:** the accepted-path target is an annular ribbon only over the outer 22–28 percent of radius, with a deliberate 50–60-degree open gap behind the player. The blade head is a bright traveling teardrop; the completed arc fades progressively behind it. It is one near-circle sweep, not a persistent ring or multi-hit whirlwind. During Stage 1, keep the traveling head readable but restrict the opaque contact segment to the legacy centered arc.
- **Top-down/small-scale read:** a bright head circles a stable body/pivot. If the body spins with the head, the move has failed and become Dervish. If the center is painted solid, it has failed and become a greatsword cleave.

## 7. Family D — Hookbreak bardiche

**Fantasy:** the weapon's mass is concentrated in the head, and the hook is as important as the edge. The combo drops, catches, pulls, then wrenches free. Borrow the planted poleaxe authority of *For Honor*'s Lawbringer and the ugly committed halberd recoveries of Souls games. Keep it grounded and workmanlike; the bardiche is not the glaive's elegant compass.

**Eligible weapons:** `x2-permafrost-bardiche` and `x2-quarry-splitter-bardiche`. Route by explicit variant/name, because their actual data families disagree (`axe` versus `glaive`).

**Three-frame family read:** distant heavy head overhead → body retreating while a hooked head drags inward → shaft across shoulders followed by a violent sideways wrench.

### Step 1 — Headsman's Drop

- **Timing:** lift `0.00–0.26`; active drop `0.26–0.56`; contact `0.52`; buried follow `0.56–0.74`; hooked low guard `0.74–1.00`.
- **Silhouette and motion:** raise the bardiche head visibly outside the shoulder rather than turning the whole pole edge-on. The shaft remains a diagonal guide into a head-first drop. At contact, body, shaft, and head form a steep line, but the head overhangs to one side so it does not resemble Driftblade's centered TCS. End with the head beyond aim and the hook facing inward.
- **Footwork/body:** front foot stamps `0.07H F`; visible body art advances `0.09H F` and compresses to `0.89y`. Rear hand stays far down the shaft (`0.48H` spacing) to emphasize leverage. Shadow broadens at the stamp but does not emit a generic circular quake tell.
- **Jiggle:** handoff at `0.56`, release through `0.74`. Downward terminal velocity settles the buried head. Keep the hook orientation stable during the spring response so step 2 can visibly catch from it.
- **PER ribbon:** a short, broad cleaver wedge only around the outermost 25–35 percent of reach. It should be almost head-shaped, with a square outer edge and a small inward notch suggesting the hook. The long shaft paints nothing.
- **Top-down/small-scale read:** the colored/painted head must remain large enough to see separately from the shaft. A full-length sword ribbon would erase the bardiche fantasy.

### Step 2 — Hook and Haul

- **Timing:** set hook `0.00–0.10`; active haul `0.10–0.50`; strongest crossing `0.42`; follow `0.50–0.78`; close-side drag guard `0.78–1.00`.
- **Silhouette and motion:** start with the head beyond aim. Rotate it only enough to expose the hook, then pull the head back across the target line while the hands and torso retreat. The head moves toward the wielder as well as sideways, making a J path instead of a mirrored slash. Compress hand spacing from `0.48H` to `0.32H` during the pull, then reopen it for control.
- **Footwork/body:** visible body art backsteps `-0.12H F` and shifts `0.06H N` opposite the hook. Front foot appears planted while the rear foot drags back. This is still cosmetic and remains within the root tolerance; do not move the actual player without authority.
- **Jiggle:** handoff at `0.50`, release through `0.78`. The inherited velocity points backward/inward, so the spring should tug the hands toward the chest before settling into the close guard. This recoil is the step's payoff.
- **PER ribbon:** a J-shaped reverse ribbon: thick at the head, narrow along the inward pull, with torn paint pointing toward the player. Fade before it reaches the root so it cannot imply a damaging shaft/body collision.
- **Top-down/small-scale read:** the simultaneous retreating body and inward-moving head create the hook read. If body and head travel in the same direction, it becomes an ordinary backhand.

### Step 3 — Gallows Turn

- **Timing:** shoulder rack `0.00–0.30`; active turn `0.30–0.64`; principal contact `0.56`; planted wrench `0.64–0.72`; follow/pullout `0.72–0.86`; low side hold `0.86–1.00`.
- **Silhouette and motion:** carry the close guard up until the shaft lies across the shoulders like a yoke and the head hangs outside one side. Turn the hips and cast the head through a 180–210-degree arc. At the far side, hold the head almost fixed for `0.64–0.72` while the hands, shaft, and torso rotate a little farther, creating the illusion that the hook bit and must be freed.
- **Finisher flourish:** wrench the head sideways out of the imaginary catch, with a quick `0.08H N` hand pull, a two-frame head recoil, and a fan of three to five painted chips aligned with the hook—not a radial shockwave. The body remains upright enough that the yoke-to-wrench silhouette survives. No hammer-head plant, front flip, or through-plane body inversion.
- **Footwork/body:** back foot plants at the rack. Front foot steps around `0.10H N`; visible body art follows only `0.12H N + 0.04H F`. Torso twists about `0.24 rad`, pauses against the planted head, then counter-snaps `0.08 rad` on pullout.
- **Jiggle:** normal release begins at `0.64`, but the authored planted-head constraint remains through `0.72`. This lets ownership fall while the visible head stays fixed; the spring collects the hands' terminal velocity and releases it on pullout. Release completes at `0.86` into one heavy side-to-side settle.
- **PER ribbon:** a heavy question-mark/sickle arc. The broad outer head traces the 180–210-degree cut; the last segment hooks inward and stops at the plant. The pullout receives only a dim, short paint tear and chips, never a second bright attack ribbon.
- **Top-down/small-scale read:** the shoulder-yoke setup and momentarily fixed far head are the two required frames. Even with VFX disabled, the viewer must read “hook caught; wielder tore it free.”

## 8. Routing and production contract

### Explicit variant ownership

Do not add more renderer-side weapon-id checks. The shared weapon definition should eventually select an explicit visual variant such as `nodachi-charged`, `greatsword-momentum`, `claymore-breach`, `glaive-compass`, or `bardiche-hookbreak`. The existing `comboVariant` seam is the correct ownership layer; the current union and motion vocabulary would need expansion when implementation begins.

The current `greatsword` sequence should remain byte-for-byte for Driftblade during rollout, then be renamed only when migration can be atomic. A data rename must not accidentally change player feel. Gravechill and Stormpetal can opt into that preserved sequence. Quake is an effect/impact obligation, not an animation family.

### Current-stage honesty

- `attackSeq`/`attackHeld` now gives observers an authoritative accepted attack beat, and remote clients reconstruct the descriptor and call `triggerSwing()` at a mapped server tick. That is sufficient for remote players to see these pose families.
- It is not an accepted combo-step protocol. Local/remote rigs still advance the presentation chain from their own cadence state. Do not attach authoritative damage, coverage, or “finisher confirmed” VFX to a locally inferred step.
- The server and client still derive one base `SwingDescriptor` with shared `poseSeconds`, `activeStartSeconds`, `activeEndSeconds`, and `impactSeconds`. Preserve that clock. New pose branches should sample it; they should not create family-specific wall-clock timers.
- Stage 1 keeps the existing one positive centered server sweep and hit-once set. Reverse/J/near-circle presentation is allowed only as the already-accepted cosmetic mismatch. Stage 2/3 must put accepted family/step/path into the descriptor before PER claims those exact shapes are dangerous.
- Secondary sources do not multiply or repeat. Quake, chain lightning, scatter, and revive remain once per accepted attack. The combo panel changes animation language, not DPS.

### PER implementation order

1. First make every family pass silhouette captures with all VFX disabled.
2. Add a step-aware ribbon profile that can vary radial band, width curve, end shape, occlusion, and signed direction while still consuming descriptor time.
3. Keep setup scrapes/gouges in a separate low-alpha cosmetic channel. Only the accepted edge ribbon receives full paint/lip treatment.
4. When accepted paths land, delete any duplicate client path authoring and drive `edgeProgress`/`angleAt` from the accepted step.

## 9. Review gates

Each step must pass captures at `t = 0`, anticipation end, principal contact, `followEnd`, and held exit, for both facings and at least the four cardinal aim directions. Add diagonal aims for any pose that becomes edge-on against the camera.

Approval criteria:

- With VFX, quake, particles, and hit-stop disabled, a reviewer can identify the family and step from the contact and exit frames alone.
- Step 1's exit is within a few pixels/degrees of step 2's intended entry; step 2's exit similarly loads step 3. No neutral-frame teleport between legal accepted attacks.
- No visible body-art translation exceeds `0.18H`; root, label, hurtbox, and network position remain untouched.
- Two-handed grip coincidence survives both facings, depth swaps, edge-on projection, hit-stop catch-up, and the 120 ms guard release.
- The first spring frame after ownership 1 preserves the authored point and bounded terminal velocity. No hand pop at `activeEnd`; no rear-hand lag off the haft.
- At 76 px body height, no critical read depends on fingers, facial detail, or a one-frame spark. Each move is a composition of blade/shaft line, body tilt, foot plant, and negative space.
- During Stage 1, PER never presents full-opacity contact beyond current server reach/arc tolerance. A hook, reverse, or open ring may continue as a faint motion echo, but its bright business edge stays on the legacy dangerous region until accepted paths make the full shape honest.
- Dervish Greatblade's explicit continuous spin remains unchanged. Hammer/mauler fulcrum flip remains available to true hammer-headed quake weapons, not automatically to every large quake carrier.

## Recommended build order

1. **Momentum greatsword** first: it immediately upgrades three active-roster sword chassis plus Riftcleaver, and it proves carried terminal velocity without reusing the katana's finisher.
2. **Breach claymore** second: only two weapons, but the strongest silhouette contrast and the cleanest test of explicit routing around quake precedence.
3. **Compass glaive** third: largest gain for the expansion set and the most important PER radial-band test.
4. **Hookbreak bardiche** fourth: two id-specific routes, with the most specialized planted-head constraint.

The bar is not “four new finishers.” It is four complete three-beat physical sentences in which every held exit is already the next move's anticipation. That is the quality the Driftblade currently demonstrates.

## Code references reviewed

- `packages/shared/src/weapons.ts` — `WeaponDef`, base roster, Driftblade and active large sword data, expansion gating.
- `packages/shared/src/weapons-expansion.generated.ts` — nodachi, claymore/zweihander, greatblade, glaive/voulge/fauchard, and bardiche definitions.
- `packages/shared/src/melee.ts` — shared descriptor clock, family/variant selection precedence, combo timing/path tables, `greatsword` variant, and Stage-1 snapshot seam.
- `packages/client/src/entities/SpriteRig.ts` — combo cadence/hold, style override, chop branch, pommel/TCS signature branches, two-handed grip reconstruction, depth/foreshortening channels, and terminal-velocity jiggle handoff.
- `packages/client/src/vfx/VfxPlayer.ts` — heavy fallback classification, descriptor-clock playback, and current PER blade-trail runtime.
- `packages/shared/src/state.ts`, `packages/server/src/rooms/GameRoom.ts`, and `packages/client/src/scenes/ArenaScene.ts` — synced accepted attack beat and remote descriptor reconstruction.
- `docs/ANIMATION_REVIEW_AND_COMBOS.md` and `docs/ICONIC_MELEE_MOVES.md` — accepted combo staging, camera rules, and iconic-move prior art.
