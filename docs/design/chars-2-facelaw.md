# Character Face-Concealment Law (`chars-2-facelaw`)

## 1am summary

Every carried-forward character is authored as one bespoke identity with one matching, separate bobbing head, but no biological face is ever visible: every face zone is replaced by shadow, rigid material, cloth, bone, smoke over an opaque void, or an abstract light. Chars-1's final recommendation retains 32 of the 40 live identities, and those 32 deliberately use 32 different treatments—not 32 hoods—so the hidden head becomes a co-op readability tool: Drifter is the low-brim shadow north star, Kuro-Oni is the horned oni mask, Iridia is the halo-and-nine-veil seer, Cassian is the ash-streaked great-helm, and every other retained character receives an equally character-specific contour. A head fails even if it looks good in a portrait when it exposes anatomy in any pose, depends on a moving hand/body prop to stay covered, turns into an unreadable blob at the current 76 px gameplay body scale, or loses its identity during the existing ±4 px floating-head motion and monochrome roll tell.

## Verification log

- Read `docs/sol-reports/README.md`. It requires the report of record to exist from the start, be updated as work completes, and receive validation results last. This design brief follows that incremental-write regime at the user-specified path. A repository search found no `AGENTS.md` with additional local instructions.
- `packages/shared/src/characters.ts` declares exactly 40 `PLAYABLE_CHARACTERS`: the Drifter plus 39 `cc-*` identities. Every row also has a sum-10 STR/DEX/INT/CON/LUK spread and a named quirk in `CHARACTER_KITS`; the display-name map and per-character scale exceptions are in the same file.
- `data/character-concepts.json` was read in full. It contains 50 rich records dated 2026-06-16 (`name`, `archetype`, `theme`, `palette`, `artBrief`, `flavor`). Thirty-nine correspond to the promoted `cc-*` roster and the Drifter is the fortieth playable; the other eleven are unpromoted legacy concepts. Existing briefs already contain useful concealment seeds, but several promoted characters explicitly or implicitly expose faces (for example Dunkel's open kettle helm, Veyra's raised visor, Mawkin's profile and stitched grin, Corvane's gaunt profile, Pyra's cracked skin, Tendo's uncovered bald head, and several entries with no face instruction). They must be reprompted under this law, not treated as compliant inputs.
- `packages/shared/src/character-classes.ts` maps all 40 identities to non-gating lineages and defines every quirk's `active`, `partial`, or `inert` status. Concealment assignments below use theme and quirk as identity evidence, but do not assume the many declarative/inert mechanics will ship with the art.
- `packages/client/src/entities/SpriteRig.ts` already owns a distinct floating-head image and bounded spring around a head socket. The current tuning is 8.4 rad/s, damping 0.48, at most 4 px displacement per axis, 1.15 px walk bob, 2.2 px dash lag, 2.6 px slide lag, 1.35 px air hang, 1.55 px landing dip, and 2.4 px large-attack lead; reduced motion collapses the bound to 0.35 px. The head also receives body rotation/flip, attack/flourish lead, and the roll's full pale `FILL` tint. The current body target is 76 px high (`SpriteRig.ts` near `TARGET_BODY_H`), while `packages/client/src/sprites/gear-parts.ts` defines `HEAD_MOUNT_SCALE = 0.85` and head normalization. These are real motion/scale review constraints, not portrait-only guidance.
- The current `packages/client/public/sprites/` tree has exactly 40 playable sprite directories and zero character-local `head.png` files, consistent with the requested migration still being planning work. Existing bodies cannot be assumed to satisfy the future body-plus-character-head contract.

## The hard law: an acceptance gate, not a suggestion

**Definition of the face zone.** For a humanoid, the face zone is the complete front/side cranial plane from brow to chin and temple to temple: eyes and eye sockets, nose/bridge/nostrils, cheeks, lips/mouth/teeth, jaw skin, and ears where they would help reconstruct a normal profile. For a non-human, it is the analogous sensory/display plane. Hair, a beard, cosmetics, scars, closed natural eyelids, or camera angle do not remove that zone.

**A character passes only when the face zone contains zero directly rendered living facial anatomy in every delivered image and every in-game pose.** Conceal it with an opaque physical layer, a fully unlit cavity/negative space, or a rigid nonliving replacement. An implementation must never contain a normal face “under” a translucent veil or smoke layer on the theory that it is hard to see. The covering is part of that character's own head art; it has no expression states and is never removed.

Allowed exceptions are intentionally narrow:

- One or two **abstract emissive marks** may occupy the darkness: a flat dot, rune, band, or slit. It has no sclera, iris, pupil, eyelid, lashes, tear duct, skin surround, or brow; intensity may respond to VFX, but it does not blink, squint, or emote.
- A mask may have painted, carved, stitched, or molded eyes, nose, mouth, teeth, or a grin. It must read unmistakably as rigid cloth/wood/metal/bone/ceramic material with an outer edge, strap, hinge, crack, seam, or continuous shell. Holes reveal only opaque darkness or abstract light—never a biological eye or skin.
- A human or animal skull is allowed as a fixed death-mask/nonliving head. It may have bone teeth and cavities, but no soft tissue and no articulated/emoting jaw.
- Constructs, plants, elementals, and void beings may have a head-shaped shell, cavity, or growth instead of a biological face. Their light/slit follows the abstract-emitter rule.
- Semi-transparent lace, gauze, smoke, flame, or glass may be an **outer** accent only when an opaque mask, cloth, liquid, solid shadow, or void independently blocks the entire face zone beneath it.

Automatic rejection conditions:

- Any readable biological eye, nose, nostril, cheek, lip, teeth-in-flesh, skin jaw, or recognizable uncovered profile is visible, even if only one feature or only a few pixels survives.
- An open/raised visor, eyewear alone, domino mask alone, lower bandana alone, beard/hair alone, or half-mask leaves a flesh plane visible. Partial covers pass only with a second opaque cover or absolute shadow over the remainder.
- A hand, weapon, fan, book, bottle, lantern, smoke particle, lighting direction, crop, or camera framing is the only thing hiding an otherwise authored face. If it moves, fades, flips, or is unequipped, the character must remain compliant.
- A mask opening or translucent material contains a realistically painted face underneath; “mostly obscured” is a fail.
- A temporary animation, damage state, selection portrait, card, menu preview, downed state, victory pose, mirror-facing frame, afterimage, hit flash, full-fill roll tell, or reduced-motion path reveals or implies the missing anatomy.

### Review checklist

A generation or implementation reviewer answers all of these **yes**; one “no” rejects the asset:

1. At source resolution, is the entire face zone non-biological and permanently concealed?
2. If the primary treatment is partial, transparent, gaseous, luminous, or prop-based, is there an independent opaque/void backstop covering the whole zone?
3. Are every eye-like and mouth-like marks visibly fixed features of a mask/shell/skull, or anatomy-free abstract light?
4. Is the concealment baked into the character-owned head asset and independent of hands, weapons, body accessories, equipment, and transient VFX?
5. With alpha visualized, are there no holes that can expose a body layer, neck, or flesh-colored fallback?
6. At the current 76 px body target and 0.85 head mount, is the concealer still identifiable without zooming in or reading a one-pixel detail?
7. At rest and at all head-spring extremes (±4 px X/Y), does it remain covered with no collar seam, exposed underside, or detached veil edge?
8. Through walk, dash, slide/tumble, jump/landing, attack lead, flourish, downed, tint, mirror-facing, and reduced-motion states, does the same head remain compliant?
9. Under the roll's full pale fill—when interior palette detail disappears—does the head retain its character-specific outer contour?
10. Against its nearest roster neighbors in a four-player gameplay-scale lineup, can the character be identified from head contour plus one stable internal landmark rather than color alone?

This gate applies to raw candidates, promoted identity references, extracted transparent layers, packed sprites, portraits/cards, marketing illustrations, and runtime screenshots. There is no “portrait exception.”

## Face-concealment vocabulary

Risk means production risk at the current top-down-ish gameplay presentation, not whether the device is permitted. “Conditional” entries need the stated backstop; “high” entries should never be the sole cover.

| Vocabulary name | Device and mood | Silhouette implication | Gameplay risk |
|---|---|---|---|
| **Eclipse brim** | Hard, ink-black shadow under a hat brim; solitary, withheld, frontier-mythic. This is the Drifter north star. | A broad horizontal brim over a clearly thick dark wedge, with no face-colored lower edge. | Conditional: a thin portrait shadow collapses at scale; make the wedge at least 3 rendered px high. |
| **Full effigy mask** | One opaque mask over the complete face; ritual authority, theatrical menace, immutable intent. | Strong material oval/plane; add character-owned horns, ears, crest, cracks, or jaw shape. | Low if openings contain only darkness. |
| **Half-mask double-lock** | Beak, jaw, brow, or fan covers half while cowl/shadow/blindfold covers the rest; secrecy and layered intent. | Deliberate asymmetry or projecting jaw/beak plus a second visible blocking band. | Conditional: a half-mask by itself always fails. |
| **Night cowl / hood** | Deep cowl with a truly empty interior; ascetic, cultic, unknowable. | Pointed, round, split, or swept hood rim framing a solid void. | Conditional: generic hoods duplicate quickly and can merge with shoulders. |
| **Closed great-helm** | Opaque medieval helm with black vent/slit; implacable faith or law. | Square, cylindrical, tapering, sallet-swept, or broken crown; crest/plume can dominate. | Low; never author a raised/open state. |
| **Sealed visor helm** | Smooth futuristic or industrial shell with an abstract light band; precision, dehumanization. | Dome/wedge shell plus one bold horizontal, diagonal, or circular luminous geometry. | Low, but differentiate shell contour—not just visor color. |
| **Oracle veil stack** | Several opaque veils and a blindfold erase depth; mystery, serenity, prophecy. | Cascading/fanned cloth planes, ideally paired with halo or crown. | Conditional: lace translucency or soft same-value cloth becomes a blob. |
| **Mourning veil** | Opaque funeral curtain from hat/coronet; grief, judgment, social power. | Tall crown over a rectangular or tapered hanging curtain. | Conditional: must be solid enough that no face is painted behind it. |
| **Bandit cross-lock** | Lower bandana plus total upper-face brim shadow; outlaw speed and anonymity. | Triangular kerchief, rear knot/tails, and a contrasting horizontal brim. | Conditional: bandana alone fails; nose bridge and real eyes may not remain. |
| **Pilgrim wraps / bandages** | Overlapping cloth fully winds around the head; suffering, healing, endurance. | Asymmetric wrap layers, seal/tag, knot, or trailing end interrupt the round head. | Medium: avoid accidental eye/nose gaps and mummy-like sameness. |
| **Ossuary face** | Rigid skull or assembled bone death-mask; mortality, curse, revenance. | Pale jaw, cavities, wired teeth, or broken cranium read against a dark collar. | Low under the fixed-skull exception; no soft tissue or moving jaw. |
| **Animal skull** | Deer, crow, fox, ram, or other trophy/reliquary covers the wearer; hunt, pact, ferality. | Antlers, beak, ears, snout, or horn geometry makes a powerful contour landmark. | Low; sockets show void, never human eyes. |
| **Porcelain / Nō shell** | Bone-pale ceramic with painted expression; uncanny calm, lethal ceremony. | Bright smooth mask plane; ears, cracks, crest, and hood edge must distinguish characters. | Low, but multiple smooth ovals become identical under the roll fill. |
| **Void aperture** | A rim/collar surrounds literal negative-space where a face should be; cosmic loss, absence, dread. | The missing interior and a strong frame are the identity; an optional rune floats inside. | Low if the void is fully opaque black, high if implemented as transparency. |
| **Single beacon / slit** | One non-anatomical light is the only “gaze”; machine focus, monster vigilance. | A bold dot/bar/rune centered or deliberately offset inside a simple dark mass. | Medium: never rely on bloom; the flat core must remain at least 2 px thick. |
| **Smoke or ash shroud** | Dense soot/smoke replaces the face; hex, volatility, immateriality. | Crooked side plume, vertical flame plume, or ring cloud gives the mass a designed contour. | High: requires a solid black head core; particles and alpha alone cannot conceal. |
| **Held-object occluder** | Lantern, scripture, bottle, fan, wanted notice, or relic occupies the face; obsession, vocation, ritual. | The object's outline becomes the frontal head landmark. | High: because hands animate, use only as an outer read over a permanent mask/void, or rigidly mount/bake it into the head. |
| **Reliquary or lantern cage** | A rigid cage, book plate, shrine, or lamp is strapped where the face was; penance, industry, sacred horror. | Geometric frame and contained opaque light/liquid create a non-head contour. | Low-to-medium; cage gaps need a black/opaque backing. |
| **Respirator / gas mask** | Sealed lenses, filters, hoses, or medicine bottles; plague, salvage science, toxic commerce. | Round filters, long canister snout, hose loops, or top-hat pairing project clearly. | Low if every lens is smoked/opaque and no cheek/eye is visible. |
| **Charm/coin/reed curtain** | Many opaque hanging pieces replace the facial plane; mercenary superstition, marsh camouflage, warding. | Repeating discs, reeds, seals, or teeth make a fringed jaw and moving edge. | Medium: spacing cannot open onto a face; use a dark under-mask. |
| **Bloodglass / mirrored plate** | Opaque reflective glass, frozen mirror, or dark liquid fills a faceplate; aristocratic vanity, coldness, contained hunger. | Smooth hard plane bracketed by collar/spikes/icicles; one crack or liquid level remains readable. | Medium: “transparent glass” that reveals anatomy fails. |
| **Nonhuman shell** | Stone, bark, scrap iron, ceramic, or chitin forms the entire head; elemental patience, construct duty. | Material-specific crown, fracture, knot, smokestack, or mandible replaces human proportions. | Low; do not add a human face pattern merely to make it relatable. |
| **Blindfold seal** | Wide talisman, plate, stitched band, or ribbon erases the eyes while another layer seals nose/mouth; restraint, foresight, vows. | Strong lateral band plus knot, script, or trailing ribbons. | Conditional: a blindfold alone leaves a visible face and fails. |

## Gameplay-angle, bobbing-head, and co-op contract

The concept source frequently asks for a right-facing side profile, while the game presents that paper character in a zoomed-out, tilted-ground scene and mirrors it for left-facing action. The concealer therefore needs two simultaneous reads: a bold side-profile contour and a visible top/crown landmark. Fine portrait detail is tertiary.

- **Head-local ownership:** the complete legal cover and its opaque backstop live in the character's `head` layer. A hand-held fan/book/bottle/lantern may reinforce it but never owns compliance. Hat, mask, horns, short veil, and head-mounted frame move as one character-bound head.
- **No seam dependency:** no neck is drawn. A hanging concealer either ends visibly clear of the shoulders through the whole ±4 px spring range, or follows chars-3's stricter overlap contract: target **0.18 body-height units** at rest (accept 0.16–0.20B, about 12–15 px at the current 76 px body target) and retain at least **0.10B** vertical overlap at every spring extreme. No edge may depend on pixel alignment. Long veils must look intentionally free-hanging when they bob, not stitched to a stationary chest.
- **Minimum gameplay marks at the current target:** the principal shadow/void cavity is at least 3 px thick; an emissive slit/rune has a flat core at least 2 px thick; the identity landmark is either a solid area roughly 4×4 px or a contour that projects at least 4 px beyond the ordinary head mass. Bloom, texture grain, embroidery, and single-pixel holes never count as the landmark.
- **Top/crown read:** a brim needs a visible underside wedge; a veil needs a crown/halo; a smooth mask needs ears/horns/crest/hood edge; a low cowl needs a pointed, split, or swept rim. At least one landmark remains visible when the face plane is foreshortened by the gameplay presentation.
- **Motion envelope:** inspect rest, ±4 px X, ±4 px Y, walk counter-bob, dash/slide lag, airborne hang, landing dip, large-attack lead, flourish lead up to its existing cap, body lean/flip, and the root's tumble rotation. No spring extreme can reveal an authored face, transparent hole, neck nub, or incompatible body seam.
- **Monochrome survival:** `applySlideInkTell()` currently applies a pale full-fill tint to the head, body, gear, and weapon during the protected ground-roll opening. Interior color and surface markings vanish. Every character therefore needs an outer-contour differentiator; “same round hood, different eye color” is not acceptable.
- **Party read:** no two rows below share the same combination of outer contour + facial-plane geometry + top landmark. Palette remains a confirmation channel, not the primary identifier. Review all 32 retained heads as solid silhouettes at the current 76 px body target, then test likely-confusable four-ups (western hats, closed helms, smooth tech heads, masks, and smoky casters) in motion.

Highest-risk treatments at gameplay scale are smoke/ash, a held object, sheer veils, hanging fringe, and low brims: they require the solid backstops and minimum thicknesses above. Long horns/plumes/halos are safer for recognition but risk cropped bounds or exaggerated bob leverage; chars-3 must include their full alpha bounds in the character-owned head socket/footprint. Rigid full masks, closed helms, bone faces, and nonhuman shells are the lowest compliance risk, but still need different outer contours to avoid roster sameness.

### Canonical prompt block for chars-4

The generation pipeline should insert this block unchanged, then fill the five character-specific fields from the assignment table:

```text
FACE LAW — HARD REJECTION RULE:
No directly visible biological face or facial skin, at any resolution or angle. Render no real eye,
eyelid, nose, nostril, cheek, lips, teeth-in-flesh, jaw skin, or uncovered profile. The entire face zone
is permanently replaced by [CONCEALMENT], backed by [OPAQUE BACKSTOP]. Its unmistakable gameplay
landmark is [SIGNATURE CONTOUR]. The only eye-like light allowed is [ALLOWED ABSTRACT LIGHT]; it is a
flat non-anatomical mark with no iris/pupil/sclera/eyelid. [FORBIDDEN LEAK]. Painted/carved features on
a clearly rigid mask are allowed and never animate. Do not author a face beneath smoke, glass, veil,
holes, or shadow. The concealment is part of this character's own separate head layer, never supplied
by a hand, weapon, body layer, crop, or lighting. No neck. The head overlaps/floats above the body and
must stay fully concealed while bobbing 4 px in any direction, mirrored, tumbling, and full-fill tinted.
```

Every raw candidate also receives a literal negative list: `uncovered face, visible facial skin, realistic eye, iris, pupil, eyelid, nose, nostril, lips, mouth, flesh teeth, cheek, ear/profile, raised visor, open helmet, transparent face veil, see-through smoke face, face behind glass, hand as sole face cover, neck`.

## Per-character concealment assignment — retained 32

This is the binding face map for the 32-character carry-forward recommended by `chars-1-roster`. The current code still contains 40 IDs, so the eight cuts are reconciled after the table for migration, but they receive no new prompt/art commission. If the owner restores a cut later, perform a fresh identity review rather than silently transferring a retained character's concealer.

| # | Character / id | Assigned concealment and opaque backstop | Co-op silhouette read and prompt-specific prohibition |
|---:|---|---|---|
| 1 | **The Drifter** (`drifter`) | **Eclipse Brim:** broad frontier hat; the entire region from brim to collar is one matte-charcoal shadow wedge. No glow and no face underneath. | Widest clean horizontal brim + empty black wedge. North-star restraint; forbid bandana, eye dots, or a nose/lip edge emerging from shadow. |
| 2 | **Asha the Ash-Walker** (`cc-asha-the-ash-walker`) | **Sutra Swaddle:** cream and pale-sage pilgrim bandages spiral over the whole head, sealed by one vertical cinnabar prayer tag; cloth is fully opaque. | Asymmetric wrap knot + long central talisman. Incense smoke is decoration only; forbid eye gaps, nose ridge, and a face beneath gauze. |
| 3 | **Bastion Vance** (`cc-bastion-vance`) | **Bunker-Slit Helm:** massive rounded gunmetal combat shell with a single narrow cyan visor bar over solid plate/black glass. | Broad armored brow, squared rear block, short flat cyan bar. Forbid a visible eye inside the visor or a generic slim sci-fi helmet. |
| 4 | **Brother Cassian** (`cc-brother-cassian-the-ashen-crusader`) | **Ashen Cross Great-Helm:** tall tapering chapel-shaped great-helm over a mail coif, soot-streaked; cross-shaped vent is backed by black plate. | Narrow vertical helm, roof-like crown, no plume; the crimson cross repeats on the tabard. Forbid the legacy open hooded-coif face and any visible eyes in the cross slit. |
| 5 | **Brother Tendo of the Still Bell** (`cc-brother-tendo-of-the-still-bell`) | **Still-Bell Cowl:** an inverted, weathered bronze temple bell encloses the head, with a black inner rim and a jade prayer-cord “clapper” trailing behind. | Simple dome + flared scalloped bell lip. Forbid the legacy uncovered bald head, monk face, or literal face painted onto the bell. |
| 6 | **Bryda Houndcall** (`cc-bryda-houndcall`) | **White-Hart Skull:** full weathered deer skull mask with deep void sockets and asymmetric salvaged antlers; dark pelt wraps seal every rear/underside gap. | The roster's only branching antler crown + long pale muzzle. Forbid human eyes through sockets or exposed cheeks beneath the skull. |
| 7 | **Cinderpyre** (`cc-cinderpyre`) | **Broken Caldera:** jagged volcanic-stone crown and jaw completely surround a solid charcoal cavity; one flat ember-orange diagonal slit and rock fissures are non-anatomical. | Broken rock crown with high unequal shards. Forbid molten “skin,” a human skull/profile inside, transparent flame, or two natural eyes. |
| 8 | **Cogwarden** (`cc-cogwarden`) | **Anvil Furnace:** flat anvil-shaped scrap-iron head with a single horizontal orange furnace grate and a stub smokestack; solid iron everywhere else. | Low rectangular anvil + vertical smokestack. Forbid a robot mouth/nose layout, eye pair, or smoke as the only head mass. |
| 9 | **Corvane the Crimson Draught** (`cc-corvane-the-crimson-draught`) | **Crimson Decanter:** his needle-high collar clamps a sealed glass vessel where the face was; it is filled edge-to-edge with opaque oxblood and capped by silver lancets. | Smooth dark-red flask oval between two collar spikes, with a visible liquid line. Forbid pale skin, veins on a face, transparency, or a natural red eye. |
| 10 | **Crowmantle Sel** (`cc-crowmantle-sel`) | **Crow Reliquary:** long rigid crow-beak mask with black coin-like lenses, while an opaque feather cowl seals the lower/rear face. | Sharp forward beak + feather-fringed back crown. Forbid a human jaw beneath a “half” beak or eyes behind lenses. |
| 11 | **Dame Veyra of the Thornwatch** (`cc-dame-veyra-of-the-thornwatch`) | **Thornwatch Sallet:** permanently closed silver sallet swept far backward, black visor seam, rose-gold thorn comb, and a narrow ivory plume. | Sleek wedge visor + long swept tail/plume, the fastest knight head. Forbid the legacy raised visor or any elegant exposed profile. |
| 12 | **Doctor Phineas Quill, Esq.** (`cc-doctor-phineas-quill-esq`) | **Patent-Tonic Respirator:** tall battered top hat over a sealed brass-and-rubber gas mask whose bottle-green medicine canisters form an exaggerated snout; smoked amber lenses. | Tallest top hat + twin bottle filters and hose curl. A raised tonic bottle may echo the face shape but is never the cover; forbid visible salesman grin/eyes. |
| 13 | **Elias “Parson” Thorne** (`cc-elias-parson-thorne`) | **Gospel Casket:** flat parson hat above an iron-bound, book-shaped scripture plate hinged permanently before an opaque funeral cowl; cross perforation opens onto black. | Austere flat hat + narrow rectangular book plane and hanging chain. The hand-held Bible is secondary; forbid it from revealing a preacher face when lowered. |
| 14 | **Gravewake** (`cc-gravewake`) | **Wired Gallows Skull:** fixed bone skull with charcoal cavities, jaw wired shut, one dull-teal pinlight in one socket, and severed noose still cinched behind it. | Pale skull, taut jaw wires, vertical rope stub. Allowed only as rigid bone; forbid soft tissue, a slack animated jaw, tongue, fleshy eye, or expression. |
| 15 | **Hollowmaw** (`cc-hollowmaw`) | **Ossuary Cowl:** deep spear-point hood contains a segmented bone jaw/half-mask; every uncovered region is absolute charcoal void with one violet sigil-eye. | Tall pointed hood + pale broken-bone mandible. Forbid a flesh mouth behind the jaw, a second eye, or hood-only genericism. |
| 16 | **Iridia of the Nine Veils** (`cc-iridia-of-the-nine-veils`) | **Ninefold Oracle Shroud:** nine distinct opaque indigo/celestial veil planes fully replace the face, crossed by a solid star-silver blindfold and crowned by a thin gold halo. | Circular halo + fan of staggered veil tails; the blindfold is an outer seal, not the sole cover. Forbid translucency, facial features under cloth, or nine indistinguishable wisps. |
| 17 | **Kuro-Oni, the Demon Mask** (`cc-kuro-oni-the-demon-mask`) | **Temple Oni:** full crimson lacquer oni mask with large black-backed eye shapes, bared brass mask-fangs, and two heavy horns; opaque black wrap behind. | Broad twin horns + projecting brass-fanged jaw. Painted rage is fixed mask decoration; forbid human eyes/skin at edges or an opening mouth. |
| 18 | **Magdalene “The Ledger” Crowe** (`cc-magdalene-the-ledger-crowe`) | **Warrant Mourning Veil:** flat-crowned bounty hat drops an opaque charcoal mourning curtain over the entire face, paneled with blank bone-paper warrant strips and a tin-star clasp. | Tall flat crown + rectangular paper-fringed curtain. Forbid lace transparency, portraits/faces printed on the warrants, or eyes behind mesh. |
| 19 | **Mawkin Sourgrin the Hex-Witch** (`cc-mawkin-sourgrin-the-hex-witch`) | **Sour-Smoke Crook:** a towering crook-tip witch hat contains a solid black missing face; dense bruise-purple smoke curls sideways around it, with one yellow hex-rune and a stitched grin charm hanging outside. | Extreme crooked hat + lateral smoke hook + dangling grin token. Forbid the legacy warted profile, natural eye, skin grin, or smoke without the black core. |
| 20 | **Mei-Ling of the Jade Ribbon** (`cc-mei-ling-of-the-jade-ribbon`) | **Jade Fan Seal:** a fixed half-open war-fan shields nose-to-chin while a wide opaque celadon lotus blindfold seals brow-to-nose; dark cloth joins both with no gap. | Diagonal fan ribs + high lotus knot and ribbon tails. Forbid visible eyes above the fan, lips below it, or reliance on the detachable hand-held combat fan. |
| 21 | **Mirelurk Caine** (`cc-mirelurk-caine`) | **Bog-Reed Drape:** drooping woven reed hat carries a dense curtain of wet reeds, moss, and eel cord over an ink-black under-mask; one teal lure hangs at the curtain tip. | Lowest, widest sagging hat + shaggy dripping fringe. Forbid face glimpses between reeds or transparent water as cover. |
| 22 | **Neon Mirage** (`cc-neon-mirage`) | **Magenta Aero-Shroud:** sharply forward-tapered charcoal aero-helm with a completely black face plane split by one hot-magenta diagonal speed slash; short scarf streams from the rear. | Long forward wedge + rear scarf, deliberately unlike round tech helmets. Forbid one bold biological eye, open cheek panels, or glow bloom without a solid slash. |
| 23 | **“Quickfinger” Odette Lacroix** (`cc-quickfinger-odette-lacroix`) | **Dead Man's Hand Screen:** five lacquered ivory playing cards form a permanent opaque fan over the whole face beneath her tiny feathered hat; suit cutouts are black-backed. | Wide five-card fan + tiny tilted feather, the roster's only radial paper face. Forbid a domino eye mask, exposed gambler smile, or hand-held cards as sole cover. |
| 24 | **Raijin Kō, the Storm Fist** (`cc-raijin-k-the-storm-fist`) | **Thunderhead Cage:** round bronze storm-cage/halo encloses a solid black cloud core bearing one flat fork-shaped cyan lightning slit; static hair spikes are external silhouette only. | Circular bronze ring + radial spikes + lightning fork. Forbid a bare martial-artist face, two eyes, or transparent cloud revealing skin. |
| 25 | **Sōjiro the Wayward Blade** (`cc-s-jiro-the-wayward-blade`) | **Rain-Kasa Curtain:** wide conical straw kasa drops a dense opaque storm-indigo rain-chain/cloth curtain around the full face over a black under-wrap. | Largest clean triangle/cone + straight rain fringe. Forbid simple brim shadow that duplicates Drifter or gaps revealing a ronin profile. |
| 26 | **Sable Cipher** (`cc-sable-cipher`) | **Cipher Blindhood:** seamless matte-black infiltrator hood-mask with an asymmetric cyan circuit lattice, one small triangular optic, and two short data-cable tails. | Low faceless oval broken by twin rear cable prongs; internal mark is triangular, not a visor bar. Forbid a visible cybernetic eye, mouth panel, or Neon-like long aero wedge. |
| 27 | **Sir Mordrane, the Hollow Oath** (`cc-sir-mordrane-the-hollow-oath`) | **Split-Oath Faceplate:** blackened helm with an asymmetrically cracked faceplate opening only onto opaque cyan-lit void; one half of a crown/halo is broken away. | Jagged half-crown + diagonal plate fracture and cyan seam. Forbid a corpse face inside, visible skin at the crack, or a symmetric clean knight helm. |
| 28 | **The Bandida “La Sombra”** (`cc-the-bandida-la-sombra`) | **Sombra Cross-Lock:** low flat hat creates absolute shadow over brow-to-nose; ash-grey bandana seals nose-to-chin, backed by deep-teal cloth with no center gap. | Flat hat + sharp triangular kerchief + two rear knot tails. Forbid real eyes under the brim, a nose bridge, or bandana-only concealment. |
| 29 | **The Hollow Mask** (`cc-the-hollow-mask`) | **Blank Porcelain:** perfectly smooth bone-pale full mask with no holes, one hairline crimson crack, under a knife-point charcoal hood and black wrap. | Bright blank oval inside a narrow blade-like hood; the hood point survives full-fill tint. Forbid eye slits, painted biological features, or a second fox/Nō grin. |
| 30 | **Thornroot** (`cc-thornroot`) | **Bramble Knot Void:** bark, leaves, and thorns form a ragged circular crown around an opaque black tree-knot cavity with a single lime bud-light. | Radial leaf/thorn crown + one shoulder bloom; no humanoid skull proportions. Forbid a carved human face, mouth knot, or transparent hollow. |
| 31 | **Tinker-Magnus Brasswick** (`cc-tinker-magnus-brasswick`) | **Pressure-Bell Helm:** riveted copper diving helm with one large opaque amber goggle, blank bolted opposite plate, and a coiled exhaust pipe; all seams are pressure-sealed. | Bulbous copper sphere + single round lens + pipe coil. Forbid a face through the goggle, twin gas-mask filters, or exposed alchemist skin. |
| 32 | **Yuki the Hollow Smile** (`cc-yuki-the-hollow-smile`) | **Hollow Kitsune:** full bone-white fox mask with sharp upturned ears, vermillion brush marks, and a fixed painted grin; lacquer-black fabric seals every edge. | Twin fox ears + pointed muzzle + fixed smile. Forbid human eyes through mask holes, moving mouth, or Hollow Mask's blank oval silhouette. |

### Eight live IDs not commissioned in the 32-character plan

Chars-1 cuts Cordell, Buzzard, Dunkel, Deepfall, Halcyon-7, Grix, Pyra, and Sir Galloway as identity overlaps. Do not spend prompt or review cycles on new concealment for them. Until chars-5 removes/remaps those live IDs, their existing face status is migration evidence only: Cordell, Deepfall, Halcyon-7, and Galloway already have a shadow/sealed-head seed; Buzzard, Dunkel, Grix, and Pyra expose anatomy and therefore may **not** be routed through the new renderer as temporary art. Use chars-1's cosmetic fallback aliases during migration (Cordell→Drifter, Buzzard→Bandida, Dunkel→Cassian, Deepfall→Bastion, Halcyon→Sable, Grix→Bastion, Pyra→Cinderpyre, Galloway→Cassian) rather than shipping a face-law exception.

## Concrete execution plan for the face-law track

1. **Freeze `FACE_LAW_V1` with the 32-row map.** Each `data/character-art-plan` job owned by chars-4 must carry five explicit face fields: concealment, opaque backstop, allowed abstract light (including “none”), signature contour, and character-specific forbidden leak. A missing field fails job compilation. The eight cuts have no job row.
2. **Lock the Drifter first.** Review four Drifter attempts as chars-4 proposes. The approved one freezes the face-void value, minimum brim-shadow wedge, absence of eye lights, top-plane read, and full-fill contour. It is the semantic reference for “shadow,” but its hat/void construction is not copied to the rest of the cast.
3. **Prove range with Kuro-Oni and Iridia.** Kuro-Oni proves a wide rigid full mask with painted features; Iridia proves opaque cloth/halo treatment without a hidden face or gameplay blob. Approval of all three anchors is required before fleet production.
4. **Run the eight-character stress pilot already proposed by chars-4:** Drifter, Kuro-Oni, Iridia, The Hollow Mask, Cinderpyre, Bastion, Neon, and Cassian. This covers shadow, ritual full mask, veils, porcelain, nonhuman void, tech visor, aero shroud, and great-helm before volume generation.
5. **Generate the remaining 24 as three face-risk batches of eight:**
   - Soft/partial covers: Asha, Hollowmaw, Magdalene, Mawkin, Mei-Ling, Mirelurk, Sōjiro, Bandida.
   - Rigid/ritual faces: Tendo, Bryda, Veyra, Phineas, Gravewake, Odette, Raijin, Yuki.
   - Material/tech faces: Cogwarden, Corvane, Crowmantle, Elias, Sable, Mordrane, Thornroot, Tinker-Magnus.
6. **Fail closed before owner review.** Machine checks may verify alpha closure, solid void coverage, head locality, minimum feature thickness, bounds, and chars-3's nine spring extremes. A human must judge anatomy: stylized face detection is not sufficient. Use reason codes `FACE_LEAK`, `BACKSTOP_MISSING`, `PROP_DEPENDENCY`, `BOB_REVEAL`, `TINT_COLLAPSE`, and `SILHOUETTE_COLLISION`; reject and regenerate the complete attempt rather than paint over it downstream.
7. **Run adversarial co-op collision tests.** At 76 px, show each four-up first in normal color, then grayscale, then solid/full-fill silhouette, with labels hidden during review. These eight sets intentionally group near-neighbors rather than easy contrasts:
   - Drifter / Bandida / Magdalene / Elias
   - Phineas / Mawkin / Sōjiro / Mirelurk
   - Bastion / Cassian / Veyra / Mordrane
   - Kuro-Oni / The Hollow Mask / Yuki / Bryda
   - Cinderpyre / Hollowmaw / Thornroot / Sable
   - Tendo / Raijin / Tinker-Magnus / Odette
   - Asha / Iridia / Mei-Ling / Crowmantle
   - Gravewake / Corvane / Cogwarden / Neon

   Any identity that requires its color label, lore, weapon, or a zoomed portrait to disambiguate fails. Adjust that head's gross contour—not merely a tiny emblem—and rerun both its cluster and the full 32-head sheet.
8. **Keep a permanent regression board.** The final evidence is one 32-head source close-up board, one 76 px body+head board, one grayscale silhouette board, one pale-fill board, and nine-position bob strips for every accepted head. Any later prompt, outline, scale, socket, tint, or palette change reruns the affected row against all prior neighbors.

## Cost and handoffs to the other four tracks

The face law eliminates expression production—**zero** blink, mouth, eye-direction, or emotion variants—but it adds deliberate identity and QA work. The selected plan needs 32 unique concealment specifications and 32 character-owned heads. A complete review card contains one source face close-up, one 76 px color view, one grayscale silhouette, one mirrored rest view, one pale-fill view, and nine spring extremes: **14 face-relevant views per character, 448 view cells total**, composited rather than necessarily rendered as separate files. It also adds eight adversarial four-player sheets and one full-cast comparison. Chars-1's eight cuts avoid eight prompt/review cycles and 16 final body/head layers relative to a 40-character fleet; restoring any cut later costs a fresh unique treatment and the full regression pass.

| Track | Required handoff / dependency | Cost of getting it wrong or changing it late |
|---|---|---|
| **`chars-1-roster`** | Authoritative retained IDs, rank, player fantasy, body silhouette, and visual signature. Its current answer is 32 retained / 8 cut. Chars-1's identity call remains authoritative; this report's exact face construction supersedes provisional face suggestions where they differ. | A restored or swapped ID requires a new concealment row, collision review, generation attempts, and owner approval; reusing another character's head language breaks cast legibility. |
| **`chars-3-headrig`** | Authoritative `B` geometry, 0.85 mount, fixed socket/pivot, head bounds, 0.16–0.20B rest overlap, ≥0.10B worst-case overlap, ±4 px extreme compositor, and alpha ownership for horns/halos/veils/pipes. | A late geometry change can invalidate every opacity, overlap, minimum-pixel, crop, and bob verdict. This report defers to chars-3 wherever geometry is stricter. |
| **`chars-4-pipeline`** | Copy the semantic law and each row's positive construction/forbidden leaks into the locked prompt/art-plan record; preserve the opaque backstop through keying/slicing; generate the close-up, gameplay, tint, mirror, bob, and collision evidence; require human face review. | A normal face authored beneath a veil/smoke/glass layer cannot be repaired by extraction. A changed face instruction invalidates that character's attempts and approval hash. |
| **`chars-5-migration`** | Switch atomically to character-owned body+head pairs; a missing/rejected head must fail closed or use the compliant Drifter pair, never a blank pale face. Apply the eight cut aliases before any noncompliant legacy art enters the new renderer. Remove wardrobe face receivers and alternative-head selection without removing the retained spring/tint paths. | A mixed-version fallback, missing texture, or body-only frame can expose a generic/legacy face and violate the law even when all promoted art is valid. |

## Assumptions and owner questions

No owner question blocks this plan. Assumptions recorded for implementation:

- Chars-1's 32-character recommendation is the production baseline; the current 40-ID code state is a migration concern, not a request to commission eight extra characters.
- “No face” means no living facial anatomy, not “no face-like symbol.” The mandate explicitly calls for skull/bone faces and allows mask-painted features, so rigid skulls, mask fangs/grins, and abstract lights are legal under the fixed/nonliving exceptions above.
- Chars-3's frozen geometry is authoritative. The current 76 px body target, 0.85 mount, and ±4 px spring values are verified starting facts; proportional thresholds must be recomputed if that track deliberately changes them before production.
- The face treatment is permanent across gameplay, portraits, cards, marketing art, damage/downed states, and future skins. A future cosmetic may change a whole character identity only by passing the same gate; it may never uncover the underlying face.
- Emissive marks may pulse as non-expressive VFX but do not blink, look around, form brows/mouths, or become a substitute facial-animation system.

## Validation results

- Read the reporting README, all 50 complete concept records, the complete 40-ID roster/kit file, the full character-class/quirk module, the relevant floating-head construction/spring/final-sync/tint/tumble paths, the current head-scale normalization, and the evolving reports from chars-1, chars-3, chars-4, and chars-5. Reconciled this report to chars-1's final 32-character recommendation and chars-3's stricter overlap geometry.
- Programmatically compared the assignment-table IDs with `PLAYABLE_CHARACTERS` minus the eight named cuts: **32 rows, 32 unique IDs, 32 expected, 0 missing, 0 unexpected, 0 duplicates**.
- Parsed the assignment treatments: **32 rows and 32 unique treatment names**. The vocabulary explicitly covers all mandated families: hard brim shadow, full/half masks, cowls/hoods, helms/visors, veils, bandanas, bandages, skull/bone and animal skulls, void/negative space, abstract eye/slit, smoke/ash, held or mounted object occlusion, porcelain/Nō masks, gas masks, and mourning veils.
- Markdown checks found 32 well-formed assignment rows, no `TODO`/`TBD`/`FIXME` markers, and no whitespace errors (`git diff --check`; only the workspace's LF→CRLF warning was emitted).
- This track wrote only `docs/design/chars-2-facelaw.md`. It generated no images, changed no code/assets/catalogs/tests, and did not inspect, stop, replace, or bind the live game services.
