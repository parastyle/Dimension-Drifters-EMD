# ORDER B66 — TWENTY OTHER-DIMENSION WEAPONS

Owner order, 2026-07-26 (verbatim):

> "Overnight, make another 20 weapons. Give them all their own painted ammunition, muzzle flashes if
> needed, the works."

## Purpose and authority

This is the fan-out order for twenty separate implementation Sols. **ONE SOL BUILDS ONE ROW.** No Sol
may batch two subjects, substitute a different concept, borrow another row's silhouette, or merge two
rows into a matched set. If an assignment cannot be built as written, report the conflict instead of
improvising around it.

These are not additions to B63's issue-grade player-force arsenal. They are battered, superstitious,
improvised, fantasy-forward weapons made by the cultures of other dimensions. Wear, repair plates,
wrapped fixed grips, strange ammunition, and locally understood mechanisms are desirable here.

The collision audit used the base definitions in `packages/shared/src/weapons.ts`, the full current
339-row expansion source in `data/weapon-concepts-300.json`, and the older 107-row concept source in
`data/weapon-concepts.json`. Every detailed assignment below names its closest shipped neighbors and
states the silhouette or play lane that keeps it separate.

## B63 amendments carried forward

1. **NEVER NAME A REAL WEAPON in a prompt, theme, `artPrompt`, or prompt-facing note.** Describe the
   shape, construction, and operation. A real model name pulls the image generator toward a catalogue
   photograph and defeats the house style.
2. **DIMENSION = WEAPON CULTURE.** B63 is the well-supplied player force. This order is deliberately
   other-dimensional: frost hunters, ruin gardeners, kiln scavengers, back-alley signal thieves, and
   frontier occultists.
3. **ONE SOL, ONE WEAPON.** Subject batching causes theme and silhouette bleed.
4. Every weapon needs a concrete gamification hook. A mundane tool with an accent colour is not enough.
5. The `FORM` line in each assignment is the prompt-safe shape authority. Keep it free of real-world
   proper nouns and do not replace it with a named reference.

## Standing laws that bind every assignment

1. **No chains, tassels, ropes, straps, loose cords, or anything else that dangles.** We have no
   physics for them. Hinges, pivots, rigid loops, fixed bands, and flush wrapping are allowed.
2. **No player auras, ever.** Attack VFX may exist at the weapon, along the attack path, on the
   projectile, or at the impact point; nothing idles around the player.
3. **Weapon attacks never displace the character.** The character remains planted through melee,
   casts, lunges, and charge releases. Gun recoil is the one sanctioned exception, and it must remain
   a brief recoil response rather than locomotion.
4. **No text, logos, serials, maker's marks, labels, numerals, or readable symbols in weapon art.**
5. **Art contract:** weapon-only sprite; no character, hands, background, baked attack effect, smoke,
   projectile, or muzzle flash; flat orthographic full side-profile; approximately 4–6 colours plus
   bold black ink; faces **RIGHT** — business end/muzzle/blade tip right, grip left.
6. **House render:** near-black base, heavy internal ink, one accent, slight silhouette exaggeration,
   and flat cel planes. Other-dimension wear is painted deliberately, not noisy photoreal texture.
7. **Painted ammunition is mandatory.** Every ranged and caster row gets its own standalone projectile
   sprite, authored as a single readable subject rather than a crop of the held weapon or a recolour of
   an existing projectile. Every melee row gets its own painted signature hit/arc VFX instead. Generic
   bullets, generic orbs, and generic white swing crescents do not satisfy the order.
8. **Muzzle decisions are mandatory.** A weapon with a bore, mouth, or exit slot gets the assigned
   bespoke flash at the visible right-facing emission point. A weapon without a muzzle says so
   explicitly and uses only its named focus/contact VFX.
9. Muzzle derivation follows the installed sprite alpha and the vocabulary already used by the muzzle
   system: `needle`, `crown`, `fork`, `bloom`, `split`, or `shard`. Keep sights, fins, teeth, and
   decorations behind the actual emission point so the rightmost robust barrel band remains legible.
10. Projectile art must match its authoritative travel envelope and preserve its readable horizontal
    facing. Do not make a tiny hit body carry a screen-long painting.

## Implementation bundle per Sol

The assigned Sol owns exactly one complete row: one weapon concept/definition, one held weapon sprite,
one standalone painted projectile or signature melee hit/arc asset, the assigned muzzle flash or
explicit no-muzzle treatment, and the ordinary supporting card/VFX integration required to make that
single weapon feel complete. The Sol must not use another row's ammunition, flash, or accent as a
shortcut.

## Summary roster

| # | Weapon | Type / family | Dimension | Distinct play lane | Painted ammunition or melee VFX | Muzzle |
| --- | --- | --- | --- | --- | --- | --- |
| 01 | Whiteout Snowshoe Ram | melee / paddle-club | frostfell | broad guard-breaker | collapsing snow-slab arc | none |
| 02 | Rimegut Ice-Tongs | melee / pincer | frostfell | narrow two-beat pinch | converging jaw arcs | none |
| 03 | Hailbarrel Sledcaster | ranged / puck-launcher | frostfell | slowing straight-line disc | toothed ice puck | icy `shard` |
| 04 | Rimechoir Chime-Rack | caster / resonator | frostfell | charged line pulse | nested sound wedge | none; focus flare |
| 05 | Miremaw Shears | melee / great-shears | verdant-ruins | timed closing crit | crossing leaf-snip arcs | none |
| 06 | Thornhive Seedcaster | ranged / seed-launcher | verdant-ruins | first-hit branch burst | spiral drill-seed | thorn `bloom` |
| 07 | Frogspit Blowpot | ranged / spit-pot | verdant-ruins | delayed toxic pop | tadpole-shaped spit glob | wet `split` |
| 08 | Mossmother Seed-Bowl | caster / bowl-focus | verdant-ruins | travel-grown cast | sprouting seed comet | none; rim sprout |
| 09 | Kilnback Bellows-Ram | melee / compression-ram | ashlands | stored-charge contact burst | bellows wedge impact | none |
| 10 | Cinderwheel Platecaster | ranged / disc-launcher | ashlands | heavy rotating lane shot | cracked kiln plate | sooty `split` |
| 11 | Soot-Scrivener's Brick | caster / tablet-focus | ashlands | every-third-cast rupture | ember brick-stamp | none; face flare |
| 12 | Furnace Oracle Mask | caster / mask-focus | ashlands | close homing triplet | ember moth | mouth `crown` |
| 13 | Deadpixel Crash-Baton | melee / signal-baton | neon-cyber | fast cadence finisher | stepped glitch arc | none |
| 14 | Deadlink Snarecaster | ranged / snare-launcher | neon-cyber | single-target slow | rigid hex jaw | electric `fork` |
| 15 | Deadchannel Error Idol | caster / screen-focus | neon-cyber | slow piercing packet | missing-corner error block | none; square focus bloom |
| 16 | Rainslick Twinflare Spitter | ranged / twin-bore launcher | neon-cyber | convergence sweet spot | paired weaving wedges | electric `split` |
| 17 | Undertaker's Fencepost | melee / beam-club | wild-west | extra-long narrow bruiser | plank-splinter crescent | none |
| 18 | Rattlespur Knucklewheel | melee / wheel-knuckle | wild-west | short precision cadence | six-point wheel arc | none |
| 19 | Coffindust Cardshark | ranged / cardcaster | wild-west | tap-or-fan skirmisher | iron-edged black card | pale `needle` |
| 20 | Jackrabbit Luckfork | caster / forked-bone focus | wild-west | one-correction seeker | spectral hare head | none; fork-tip spark |

Dimension allocation is exact: four `frostfell`, four `verdant-ruins`, four `ashlands`, four
`neon-cyber`, and four `wild-west`.

## Detailed assignments

### 01 — Whiteout Snowshoe Ram

- **Assignment:** `melee`, family `paddle-club`; `frostfell`.
- **Reason to exist / shipped collision:** This is the roster's broad, defensive battering paddle.
  It is not the head-on-a-shaft silhouette of **Frostbite Headstone** or **Menhir Maul**, and it is not
  another sword: almost its entire length is an open oval lattice that reads as a converted survival
  tool. Its attack lane is a wide, slow guard-breaking sweep rather than a compact hammer impact.
- **FORM — prompt-safe shape authority:** A long flattened oval frame filled by a rigid crisscross
  lattice, narrowed into a short two-hand grip on the left, with one thick blunt rim at the right end
  and no loose pieces.
- **CHARACTER:** A frost hunter has iron-bound a travel frame until it can batter ice-armoured beasts;
  packed snow remains wedged in three cells while a single turquoise repair plate marks the owner's
  clan salvage.
- **Painted melee VFX:** No projectile. Author its own wide off-white collapsing snow-slab arc with
  three black crevasse chunks and a thin turquoise lower edge. The effect exists only through the
  swing and contact; it is not a player aura and must not become a generic pale crescent.
- **Muzzle:** Not needed; there is no bore or emission point.
- **Balance intent:** Slow two-hand cadence, very broad half-arc and strong guard/stagger pressure,
  offset by below-maul single-target damage and a long recovery; the player stays planted.

### 02 — Rimegut Ice-Tongs

- **Assignment:** `melee`, family `pincer`; `frostfell`.
- **Reason to exist / shipped collision:** This opens a rigid pincer lane absent from the shipped
  roster. It does not share the glove silhouette of **Frostknuckle Rimewrap** or the pole-and-head
  silhouette of **Hoarfrost Piledriver**. Two long arms visibly close on one target, making precision
  timing—not another axe or blade sweep—the identity.
- **FORM — prompt-safe shape authority:** Two narrow rigid arms joined at one large central pivot,
  each arm ending on the right in a short inward-facing triangular jaw, with two closed oval hand
  loops aligned on the left and no hanging hardware.
- **CHARACTER:** Ice-cutters use the tool to lift smoking blue blocks from crevasses; repeated monster
  bites have left the jaws mismatched, one bone-white and one soot-black, with a cold cyan pivot.
- **Painted melee VFX:** No projectile. Author two slim cyan jaw arcs that begin apart, converge on the
  strike centre, and snap into one white diamond-shaped ice fracture with four tiny black chips.
- **Muzzle:** Not needed; there is no bore or emission point.
- **Balance intent:** Medium cadence with two authored beats: light damage on the opening rake and a
  high centre-line bonus when the closing beat lands; narrow coverage and no root movement.

### 03 — Hailbarrel Sledcaster

- **Assignment:** `ranged`, family `puck-launcher`; `frostfell`.
- **Reason to exist / shipped collision:** The roster has frost firearms and siege lobbers, but no
  low, straight disc launcher. Unlike **Permafrost Siege Lobber**, this does not arc a shell, and unlike
  **Frostfang Speargun**, it has no long shaft or tether implication. Its shallow runner-and-drum
  silhouette and flat skimming ammunition own a separate lane.
- **FORM — prompt-safe shape authority:** A squat horizontal cylinder seated on one long curved lower
  runner, with a wide circular bore at the right, a boxy top loading lid, and a rear grip plus short
  lower brace on the left.
- **CHARACTER:** Sled mechanics cut ammunition from pressure-fused lake ice and launch it through a
  hide-scarred drum; an uneven turquoise bore collar is the only bright accent.
- **Painted ammunition:** Its own right-travelling low oval ice puck: a pale-cyan flattened body,
  three dark triangular teeth along the lower edge, two rear notches, a tiny black runner underneath,
  and bold ink separating every plane. Do not reuse the shipped icicle.
- **Muzzle:** Required at the circular bore: a compact icy `shard` flash, white at the centre with two
  cyan forward splinters and a small grey frost-powder puff.
- **Balance intent:** Moderate cooldown and damage, fast straight travel, and a meaningful on-hit slow;
  no ricochet, no explosive radius, and only modest sanctioned gun recoil.

### 04 — Rimechoir Chime-Rack

- **Assignment:** `caster`, family `resonator`; `frostfell`.
- **Reason to exist / shipped collision:** This is a rigid acoustic frame, not another wand, book, orb,
  or staff. **Hailshard Resonator** is a crystal focus, while this row reads as four fixed bars inside a
  carry frame and fires a flat travelling pressure note rather than a crystal projectile.
- **FORM — prompt-safe shape authority:** A narrow rectangular carry frame with a rear horizontal
  handle, four solid bars of descending length pinned rigidly inside it, and a small forked striking
  tab projecting from the right edge; nothing hangs or swings freely.
- **CHARACTER:** Frostfell mourners tune salvaged ice-metal bars to the pitch of a breaking lake. The
  longest bar is bone-white, the frame near-black, and one pinned bar carries a cyan repair sleeve.
- **Painted ammunition:** Its own right-facing sound wedge made from three nested pale-cyan chevrons
  around one small white ice chip, with black gaps between layers and a ragged fractured front edge.
  It must read as a painted object/effect, not a procedural translucent wave.
- **Muzzle:** No ballistic muzzle. Use a brief cyan fork-tip focus flare at the rightmost striking tab;
  do not attach a gun flash or smoke.
- **Balance intent:** Hold-to-charge long line cast; charge increases width and damage but not player
  movement, with a deliberately low uncharged rate so it does not replace rapid bolt casters.

### 05 — Miremaw Shears

- **Assignment:** `melee`, family `great-shears`; `verdant-ruins`.
- **Reason to exist / shipped collision:** No shipped weapon uses a visibly closing two-blade tool.
  **Witchwood Splitter** is still an axe and **Blightfork Glaive** is still a polearm; this row's giant
  central pivot, paired grip loops, and closing-bite timing prevent either collision.
- **FORM — prompt-safe shape authority:** Two thick opposing crescent blades joined by one oversized
  round pivot, extending left into two rigid oval grip loops and right into a broad open jaw, with the
  upper blade slightly longer than the lower blade.
- **CHARACTER:** Ruin gardeners use these to prune roots that grow through masonry overnight. The
  blades are near-black with moss-green inner bevels, and the pivot is a swollen acid-green seed pod
  locked into an iron ring.
- **Painted melee VFX:** No projectile. Author crossing leaf-green snip arcs that close into a sharp
  almond shape, followed by three dark sap squares and two pale cut-leaf chips at contact.
- **Muzzle:** Not needed; there is no bore or emission point.
- **Balance intent:** Slow opening beat, decisive high-crit closing beat, narrow forward coverage, and
  excellent armour damage; a miss leaves a longer recovery and never drags the player forward.

### 06 — Thornhive Seedcaster

- **Assignment:** `ranged`, family `seed-launcher`; `verdant-ruins`.
- **Reason to exist / shipped collision:** This is a hand-built seed auger rather than another
  blunderbuss or crossbow. **Spore-Spitter Blunderbuss** owns the fungal ground-zone lane and
  **Buckshot Bramble Bow** owns dart spread; this weapon fires one visible drill-seed that branches
  only after its first direct hit.
- **FORM — prompt-safe shape authority:** A thick tapered pod-shaped body with a round open mouth at
  the right, three rigid spiral ribs wrapped flush around the body, a boxy seed hopper above the
  middle, and two root-shaped solid grips on the left.
- **CHARACTER:** The ruin clans hollow carnivorous pods before they ripen and brace them with scavenged
  iron. A single acid-green leaf fin acts as the crude sight while charcoal bruising stains the dark
  pod.
- **Painted ammunition:** Its own right-facing fat drill-seed: brown-black teardrop body, three raised
  spiral ribs, a hard pointed pale tip, and one acid-green rear leaf fin. On first hit, its VFX may
  break into three small painted leaf splinters; the primary projectile remains the named seed.
- **Muzzle:** Required at the pod mouth: a thorn `bloom` flash with a pale centre, five short green
  thorn petals, and two dark husk flecks; no smoke cloud.
- **Balance intent:** Medium-speed precision shot with moderate base damage and a small first-hit
  branch burst; slow enough cadence that it does not become another scatter weapon.

### 07 — Frogspit Blowpot

- **Assignment:** `ranged`, family `spit-pot`; `verdant-ruins`.
- **Reason to exist / shipped collision:** The shipped **Snakebite Dart-Slinger** is a slender dart
  thrower and **Chitin Spitter** is a beast-forged gun. This row is a belly-heavy ceramic pressure pot
  with a thin mouthpipe, firing one delayed-pop glob rather than darts, pellets, or a ground cloud.
- **FORM — prompt-safe shape authority:** A round squat vessel with a flat bottom, one narrow straight
  pipe leaving its upper-right side, a broad sealed cap on top, and a thick rear handle plus small
  pumping grip on the left.
- **CHARACTER:** Bog brewers feed the pot fermented sap and bottled amphibian venom until each squeeze
  coughs out a spiteful living-looking glob. The pot is charcoal clay with moss stains and one
  chartreuse pressure stripe.
- **Painted ammunition:** Its own right-facing tadpole-shaped spit glob: bulbous chartreuse head at the
  front, small black eye-like bubble with no face, forked pale saliva tail, and a heavy irregular black
  outline. It is a glob silhouette, not a generic green sphere.
- **Muzzle:** Required at the pipe opening: a wet `split` flash made of two lime spit prongs, a tiny
  off-white pressure star, and three dark droplets; no flame or conventional smoke.
- **Balance intent:** Low direct damage and quick handling, with one short delayed toxic pop per
  target; limit repeat stacking so the identity is setup timing rather than automatic damage spam.

### 08 — Mossmother Seed-Bowl

- **Assignment:** `caster`, family `bowl-focus`; `verdant-ruins`.
- **Reason to exist / shipped collision:** This gives casters a carried offering bowl rather than
  another orb or censer. **Sporebound Witchglobe** stays a round floating-looking focus and
  **Hollowmother Spore-Totem** stays a vertical idol; the open bowl silhouette and distance-growing
  single seed are separate in both hold and play.
- **FORM — prompt-safe shape authority:** A deep half-round bowl facing upward, held inside three
  rigid root-shaped outer ribs that converge into a short horizontal grip on the left, with one
  shallow pouring lip extending to the right.
- **CHARACTER:** Ruin keepers carry soil from the first garden in a chipped black bowl; each cast wakes
  one seed under the surface. A moss-green inner plane is the only accent against the black bowl and
  bone-grey root ribs.
- **Painted ammunition:** Its own right-facing sprouting seed comet: walnut-brown split seed shell,
  bright moss-green shoot leaning forward, two pale root prongs trailing behind, and black ink around
  each plane. Its painted shell visibly opens more with travel rather than becoming a generic orb.
- **Muzzle:** No ballistic muzzle. Use a brief two-leaf green sprout flare on the right pouring lip;
  no smoke and no flash sheet shaped like gunfire.
- **Balance intent:** A slow cast whose projectile grows modestly in size and damage over travel
  distance, weak at point-blank and strongest at mid-to-long range; no player aura or self-motion.

### 09 — Kilnback Bellows-Ram

- **Assignment:** `melee`, family `compression-ram`; `ashlands`.
- **Reason to exist / shipped collision:** This is a compressible rectangular body used as the weapon,
  not a hammer head on a shaft. **Hoarfrost Piledriver** owns the piston-maul silhouette and
  **Anvil-Drop** owns the conventional heavy head; this row stores force in its broad folded chamber
  and releases a short contact wedge while the user remains planted.
- **FORM — prompt-safe shape authority:** A wide accordion-sided rectangular chamber between two
  rigid end plates, with two parallel rear handles on the left and one short broad square-ended ram
  projecting from the right plate.
- **CHARACTER:** Kiln scavengers once used it to wake dead furnaces; now the soot-black folds compress
  around an ember-orange inner plane and blast clinker dust through the striking plate.
- **Painted melee VFX:** No projectile. Author a short bellows-shaped impact wedge: compressed
  orange-red folds expanding right into a white-hot square contact face, with four soot-black square
  fragments behind it. It ends at melee reach and never becomes a ranged fireball.
- **Muzzle:** Not needed. The square end is a striking ram, not a bore; the VFX occurs only on contact.
- **Balance intent:** Charge stores one high-damage contact burst and wider hit-stop, but release range
  stays short and recovery is heavy; compression animates the weapon, never the player's root.

### 10 — Cinderwheel Platecaster

- **Assignment:** `ranged`, family `disc-launcher`; `ashlands`.
- **Reason to exist / shipped collision:** No shipped ranged weapon launches kiln plates from a
  vertical loading wheel. **Boneyard Ricochet Mortar** fires bouncing bombs and **Venomwheel Shuriken**
  throws small stars; this is one large rotating lane projectile from a rectangular slot, without
  ricochet or explosive artillery behaviour.
- **FORM — prompt-safe shape authority:** A squat rectangular housing with a large vertical loading
  wheel exposed above its centre, a short wide exit slot on the right, two rigid cooling fins below,
  and a rear grip plus forward brace on the left.
- **CHARACTER:** Ashland tile cutters stack rejected kiln plates into a hand-cranked thrower. The
  housing is soot-black, the wheel dull iron, and heat leaking through one orange inspection gap
  paints every plate before launch.
- **Painted ammunition:** Its own cracked circular kiln plate: black ceramic rim, dark red face,
  three ember-orange fracture seams, one missing rear wedge, and a thick ink outline. The plate rotates
  in flight but remains a standalone painted asset, not a recoloured chakram or star.
- **Muzzle:** Required at the rectangular exit slot: a low sooty `split` flash with two flat orange
  tongues, a white-hot centre line, and three square black clinker flecks.
- **Balance intent:** Slow, heavy, medium-range disc with a generous painted body and strong damage,
  balanced by conspicuous wind-up, low fire rate, no bounce, and noticeable sanctioned recoil.

### 11 — Soot-Scrivener's Brick

- **Assignment:** `caster`, family `tablet-focus`; `ashlands`.
- **Reason to exist / shipped collision:** Books such as **Tome of Cinders** and **Emberleaf Chapbook**
  own page-casting silhouettes. This is one thick handled slab with no pages, hinges, or writing; its
  cadence hook stamps two small packets before the third ruptures.
- **FORM — prompt-safe shape authority:** A thick rectangular slab with chipped corners held inside a
  rigid rectangular frame, one short horizontal handle projecting from the left edge, and a shallow
  raised square face aimed to the right.
- **CHARACTER:** Kiln clerks record debts by heat and fracture rather than ink. The slab is charred
  clay, its frame near-black, and one orange crack crosses a completely blank face—no glyph, word,
  numeral, or maker mark.
- **Painted ammunition:** Its own right-facing ember brick-stamp: a small plain red-black rectangular
  block with one bright orange centre crack and a square pale heat rim. The face remains blank; it is
  not a rune, page, generic fireball, or reused shell.
- **Muzzle:** No literal muzzle. The raised square face gives one flat orange square focus flare when
  a packet leaves; no smoke and no gun-shaped flash.
- **Balance intent:** Quick low-damage casts with a clearly authored every-third-cast rupture bonus;
  the first two hits must remain modest so its sustained output does not eclipse dedicated rapid tomes.

### 12 — Furnace Oracle Mask

- **Assignment:** `caster`, family `mask-focus`; `ashlands`.
- **Reason to exist / shipped collision:** The roster has skull reliquaries and fire orbs, but no
  hand-held iron mask that exhales painted creature-shaped casts. **Wyrmskull Reliquary** is a bone
  skull relic and **Pyroglyph Spellbook** is a scatter book; this row uses a flat faceplate, one mouth
  aperture, and a slow close triplet.
- **FORM — prompt-safe shape authority:** A rigid elongated oval faceplate with a high brow ridge, two
  small sealed eye depressions, one wide toothed mouth opening at the right-facing lower edge, and a
  short horizontal rear grip fixed to the left side.
- **CHARACTER:** Furnace tenders read the future in soot drawn through the mask's teeth. The plate is
  near-black iron with bone-grey edge chips and a single ember-orange inner mouth plane.
- **Painted ammunition:** Its own right-facing ember moth: soot-black narrow body, two angular
  orange-red slab wings, a white-hot pointed nose, and bold black separation. Each cast launches three
  copies with slight spacing; do not replace them with generic embers.
- **Muzzle:** Required at the toothed mouth aperture: a compact orange `crown` flash whose short points
  align with the teeth, with a pale centre and one restrained soot puff.
- **Balance intent:** Three slow, mildly seeking close-range moths with low per-moth damage; strong
  only when the full triplet connects, with a cooldown that prevents scatter spam.

### 13 — Deadpixel Crash-Baton

- **Assignment:** `melee`, family `signal-baton`; `neon-cyber`.
- **Reason to exist / shipped collision:** This adds a short blunt signal weapon rather than another
  energy blade. **Voltedge** and **Halcyon Phaseblade** retain continuous cutting silhouettes; this
  row is a thick rectangular bar with a blocky impact cap and a cadence-based digital crash on the
  finisher.
- **FORM — prompt-safe shape authority:** A short thick rectangular bar with three stepped side
  notches, a wider square impact cap on the right, a narrow covered grip on the left, and one small
  rigid guard plate below the grip.
- **CHARACTER:** Back-alley technicians use dead signal repeaters as clubs, leaving the casing
  near-black and rain-scuffed while one magenta fault square refuses to turn off.
- **Painted melee VFX:** No projectile. Author a stepped rectangular magenta arc made from three
  offset solid blocks with black gaps, ending in one pale square crash at contact. It appears
  only during the strike, never as an idle glow or player aura.
- **Muzzle:** Not needed; there is no bore or emission point.
- **Balance intent:** Fast short-reach three-beat cadence with low opening damage and a meaningful
  third-hit burst; less reach and cleave than any sword, with no attack-driven player displacement.

### 14 — Deadlink Snarecaster

- **Assignment:** `ranged`, family `snare-launcher`; `neon-cyber`.
- **Reason to exist / shipped collision:** This is a control launcher with a square toothed mouth, not
  another clean energy carbine. **Hornet Smart-SMG** owns rapid guided fire and **Ghostbolt Crossbow**
  owns phasing arrows; this weapon launches one rigid open jaw that clamps for a slow without pulling
  either target or shooter.
- **FORM — prompt-safe shape authority:** A short rectangular body ending on the right in a wide
  square mouth framed by four fixed inward teeth, with a box cell on top, one rear grip on the left,
  and a rigid lower brace under the centre.
- **CHARACTER:** Signal thieves rebuild broken gate locks into hunter tools. Uneven black housing,
  exposed cyan jaw faces, and two pale worn-metal hinge caps make it valuable-looking but clearly
  scavenged.
- **Painted ammunition:** Its own right-facing rigid hex jaw: hollow cyan six-sided frame, short dark
  inward teeth, two pale rear hinge knots, and a pointed white leading clasp. It travels as one
  painted object and closes only in the impact VFX; no rope, tether, net, or pull.
- **Muzzle:** Required at the square mouth: an electric `fork` flash with two cyan prongs, one pale
  centre spark, and no smoke.
- **Balance intent:** Deliberate single shot with low direct damage and a useful short slow; long
  enough cooldown to make target choice matter, with zero displacement on both sides.

### 15 — Deadchannel Error Idol

- **Assignment:** `caster`, family `screen-focus`; `neon-cyber`.
- **Reason to exist / shipped collision:** **Permafrost Data-Tome** and **Glacier Codex** are pristine
  future books, while **Veil-Piercer Holo-Focus** is a clean projection device. This row is a damaged
  blank-faced carry box that ejects one solid missing-corner packet, establishing a trash-tech caster
  lane rather than another polished cop-dimension tool.
- **FORM — prompt-safe shape authority:** A compact rectangular case with a recessed blank square face
  angled toward the right, one missing lower corner exposing two rigid inner plates, a thick rear
  handle on the left, and one short fixed fin on top.
- **CHARACTER:** Alley diviners keep dead public screens that show only colour blocks and fractures.
  Its case is near-black, the blank face soot-grey, and one hot-magenta fault plane cuts through an
  exposed pale-metal corner; absolutely no letters, icons, numbers, or interface marks.
- **Painted ammunition:** Its own right-facing error block: flat black-edged magenta square with the
  lower-rear corner missing, a dark inner square offset forward, and one white leading pixel-like
  block. No text, glyph, face, or generic orb treatment.
- **Muzzle:** No literal muzzle. The recessed face emits a square magenta `bloom`-like focus flare,
  kept flat to the screen plane; do not add smoke or a ballistic flash.
- **Balance intent:** Slow, medium-long piercing packet with high line damage but a narrow body and
  pronounced cast recovery; it rewards alignment rather than fire rate.

### 16 — Rainslick Twinflare Spitter

- **Assignment:** `ranged`, family `twin-bore launcher`; `neon-cyber`.
- **Reason to exist / shipped collision:** **Twin Voltaire Carbines** are two separate pristine
  weapons and **Frostbite Volley-Gun** sends a four-shot volley. This is one junk-built body with two
  stacked bores that fires a simultaneous paired payload; the two wedges weave toward one mid-range
  convergence point instead of producing a fan.
- **FORM — prompt-safe shape authority:** A long narrow housing with two parallel rectangular bores
  stacked at the right, a single thick rear grip on the left, a shallow top feed block, and three
  mismatched rigid plates enclosing the middle.
- **CHARACTER:** Rain-market scavengers splice two incompatible emitters into one casing and call the
  doubled glare a sight. The near-black plates never align, with bright cyan on the upper bore and
  pale cyan on the lower bore.
- **Painted ammunition:** Its own paired projectile sprite containing two separate black-edged wedges:
  bright cyan above, pale cyan below, each with a white nose and a complementary rear notch. They weave once
  and meet at the authored sweet spot; neither wedge may reuse an existing bolt.
- **Muzzle:** Required at both rectangular bores: one synchronized electric `split` flash with a bright
  cyan upper tongue, pale cyan lower tongue, and a narrow white centre gap. Derive and verify both emission
  points.
- **Balance intent:** Two low-damage lanes that deliver premium damage only near their mid-range
  convergence; weak point-blank and after crossing, with light sanctioned recoil.

### 17 — Undertaker's Fencepost

- **Assignment:** `melee`, family `beam-club`; `wild-west`.
- **Reason to exist / shipped collision:** **Carrion Cudgel** is a short bone club and
  **Gravewarden Buster** is a broad digging tool. This row is an extra-long square timber beam with a
  narrow forward hit lane, trading sweep coverage for reach and blunt timing rather than becoming
  another greatsword.
- **FORM — prompt-safe shape authority:** A long straight square-section beam with one thick iron
  endcap on the right, a shorter iron sleeve around the middle, and two rigid inset handholds cut into
  the left half, with no protruding loose hardware.
- **CHARACTER:** Frontier grave crews pull storm-cured posts from abandoned plots and cap them with
  scrap iron. The timber is near-black brown, the cap soot-grey, and one faded rust-red side plane is
  all that remains of its boundary paint.
- **Painted melee VFX:** No projectile. Author a long narrow tan plank-splinter crescent with a flat
  outer edge, three black wood chips, and two rust-red contact ticks at the capped end.
- **Muzzle:** Not needed; there is no bore or emission point.
- **Balance intent:** Very long melee reach and high poise damage in a narrow arc, balanced by slow
  startup, modest crowd coverage, and heavy recovery; no lunge or root displacement.

### 18 — Rattlespur Knucklewheel

- **Assignment:** `melee`, family `wheel-knuckle`; `wild-west`.
- **Reason to exist / shipped collision:** **Buzzcutter** is a two-hand powered saw-like sword and
  **Twin Regent Stilettos** are paired fist blades. This is one unpowered hand guard with a single
  oversized toothed wheel that rolls only through the punch arc, creating a compact precision lane
  without continuous auto damage.
- **FORM — prompt-safe shape authority:** A horizontal grip enclosed by a thick half-loop guard, with
  one oversized six-toothed wheel mounted vertically at the right end and one small rigid palm plate
  closing the left side.
- **CHARACTER:** A frontier pit fighter enlarged a boot-wheel into a hand weapon, filing every other
  tooth blunt to make its rhythm unpredictable. The guard and hub are near-black, and the wheel's
  tarnished rust-gold plane supplies the accent.
- **Painted melee VFX:** No projectile. Author a compact six-point rust-gold wheel arc with alternating
  long and short teeth, a white hub spark at ideal contact, and four ochre dust ticks. It must not look
  like Buzzcutter's continuous powered sweep.
- **Muzzle:** Not needed; there is no bore or emission point.
- **Balance intent:** Very short reach, quick recovery, and a cadence-based precision bonus on every
  alternate ideal hit; low cleave and low base damage keep it out of the automatic melee lane.

### 19 — Coffindust Cardshark

- **Assignment:** `ranged`, family `cardcaster`; `wild-west`.
- **Reason to exist / shipped collision:** Trick-shot sidearms such as **Carom King** and
  **Tumbleweed Skipper** still fire conventional rounds and ricochet. This is a spring-loaded flat box
  with a wide slit, offering an accurate single card or a short charged fan; its ammunition neither
  bounces nor resembles bullets, darts, or thrown stars.
- **FORM — prompt-safe shape authority:** A flat rectangular box with clipped corners, a wide thin
  exit slit across the right edge, a visible stack of rigid flat plates in a top opening, one angled
  rear grip on the left, and a short winding tab fixed flush to the side.
- **CHARACTER:** Frontier cheats armour discarded game cards with coffin iron and hide the launcher
  under dust-black plating. A dull iron spring plane and one crimson diamond inset give it swagger
  without letters, suits, numbers, logos, or maker marks on the weapon.
- **Painted ammunition:** Its own right-facing iron-edged black card: clipped corners, one small plain
  crimson diamond at centre, a pale sharpened leading edge, and a thick black outer ink line. No
  numerals, letters, suit set, face art, or copied throwing-blade sprite.
- **Muzzle:** Required at the exit slit: a very thin pale `needle` flash with one crimson spark
  and two tiny paper-dust flecks; no large firearm bloom.
- **Balance intent:** Tap fires one accurate moderate-damage card; a short planted charge fans three
  lower-damage cards with capped overlap, creating a choice rather than a strictly stronger shotgun.

### 20 — Jackrabbit Luckfork

- **Assignment:** `caster`, family `forked-bone focus`; `wild-west`.
- **Reason to exist / shipped collision:** **Vagrant's Wishing Marble** is an orb and **Coyote
  Trickster's Sparkmitt** is a ricochet glove. This is a compact rigid fork focus that sends one
  creature-shaped seeking cast with a single course correction, not a bouncing shot or another lucky
  sphere.
- **FORM — prompt-safe shape authority:** A compact fork with two long upward-curving prongs joined to
  a thick central stem, fixed into a short horizontal handle on the left, with one rigid oval guard
  around the join and no loose bindings.
- **CHARACTER:** Frontier charmers carve the fork from pale burrow-beast bone and fit it into a
  soot-black iron handle; a turquoise seam between the prongs is believed to point toward whichever
  escape route luck has left open.
- **Painted ammunition:** Its own right-facing spectral hare-head projectile: lean turquoise head and
  long swept-back ears, one off-white eye dot, a white wedge nose, and bold black silhouette breaks. It is
  one painted magical payload, not a character, generic spirit orb, or reused animal asset.
- **Muzzle:** No literal muzzle. Use one small turquoise fork-tip spark bridging the two prongs at
  release; no smoke, gun flash, or persistent glow.
- **Balance intent:** Mid-range moderate-damage seeker with exactly one mild course correction and no
  chain or bounce; reliable against movers but lower raw output than straight precision casts.

## Fan-out checksum

- Rows: **20**, numbered `01`–`20`, with one subject per row.
- Type split: **7 melee / 7 ranged / 6 caster**.
- Dimensions: **5 represented**, exactly four rows each.
- Painted identity coverage: **13 standalone projectile assignments + 7 signature melee hit/arc
  assignments = 20/20**.
- Muzzle coverage: **8 bespoke muzzle flashes assigned; 12 explicit no-muzzle decisions**, with focus
  or contact treatment named where applicable.
- Collision coverage: **20/20 detailed rows identify shipped neighbors and a non-colliding shape or
  play lane**.
