# Pet creature and art direction

## Design decision

Pets are small, loyal pieces of dimensional wildlife: one follows a Drifter for the entire run and grows through meta-progression without changing species, role, or personality. They are companions, not pickups, turrets, enemy decoys, or stat-fed branching creatures. A pet's bonus package is set in stone when that pet is chosen; evolution makes that promise more visible instead of rewriting it.

This art roster coordinates directly with `docs/pet-panel/systems-designer.md`: the same eight names, immutable bonus pairs, ten Bond levels, and three stage thresholds. **Verdant Wing is the required green butterfly pet, always grants an HP-regeneration multiplier, and unlocks exactly one additional maximum weapon charge at level 10.** It must never be recolored or remodeled into a different regen mascot.

The collection fantasy is "a strange little witness learned to keep up with me." It is not "I fed numbers into a blob until it became a different blob."

## The follow language

### Shoulder-orbit frame

The pet follows a cosmetic anchor, never the player's collision body. Let `F` be the owner's last stable movement heading, falling back to aim heading and then facing; let `R` be its right-hand perpendicular. The party-slot shoulder sign alternates left/right so clustered players do not put every pet in the same pocket.

`anchor = player - stageRearOffset * F + shoulderSign * 20R + orbit`

`stageRearOffset` is 48/58/68 px for Hatchling/Grown/Apex, producing effective shoulder radii of approximately 52/62/72 px as required by the systems contract. `orbit = 10 cos(theta) R - 6 sin(theta) F`, with a pet-seeded 2.8-second period. This is a small elliptical patrol around the rear shoulder, not a full orbit around the player. The pet may cross behind the owner's head but never passes in front of the weapon hand. Hover height is suggested by a 2.5 px vertical bob at 1.55 Hz, a tiny counter-scale on the shadow, and at most 4 degrees of body roll; there is no baked shadow in the art.

| Motion parameter | Shipping target |
|---|---|
| Perceptual lag | Sample the owner's visual transform 100 ms behind the presentation pose. Smooth heading over 140 ms so aim flicks do not whip the pet around. |
| Follow spring | Second-order position spring at 4.25 Hz, damping ratio `0.78`; regular-flight speed cap 340 world px/s and acceleration cap 2,600 px/s². This gives one soft overshoot without rubber-banding. |
| Rear-shoulder radius | Approximately 52 px Hatchling, 62 px Grown/Awakened, and 72 px Apex/Ascendant after the 10 × 6 px orbit is applied. |
| Normal settle error | Under 5 px within 260 ms after the owner stops; never buzz forever around an exact target. |
| Jiggle inheritance | Root rotation takes only 18% of heading delta. Cutout appendages receive the remainder through `PROCEDURAL_JIGGLE`; no hand-authored flap loop is required for basic flight. |

The root spring and the appendage springs are different layers. Root motion keeps the companion attached to the player; wings, tails, antennae, handles, and frills sell drag. Use four reusable appendage presets: `flutter` 8.5 Hz/0.35 damping, `antenna` 6.5 Hz/0.38, `tail` 5.2 Hz/0.55, and `weighty` 4.8 Hz/0.70. Normal angular travel is 4-7 degrees, celebration may reach 12 degrees, and a hit reaction may fold a part inward for one impulse. Every loose part needs a base pivot and 6-10% overlap beneath its parent so spring rotation never opens a green seam.

### Dash, teleport, and settle

- A dash edge or anchor error above 78 px starts a catch-up dart. The pet compresses toward its root for 60 ms, then travels for 120-170 ms at up to 920 px/s toward a point 14 px behind the live shoulder anchor. Wings/frills trail, the root leans no more than 12 degrees, and at most two low-alpha paper slivers mark the path.
- A teleport never draws the pet streaking across the whole arena. It folds to 0 alpha at the old point in 70 ms, snaps to 64 px behind the destination anchor while hidden, then performs the same short local catch-up dart at 75% alpha.
- Dart arrival switches to a 220 ms settle spring at 6.2 Hz/0.58 damping. One overshoot up to 8 px is desirable; a second is not. The pet then returns to the normal follow spring and its personal orbit phase.
- The dart is cosmetic and has no damage, collision, pickup, or invulnerability meaning. Its trail is suppressed whenever it would cross an active telegraph.

### Idle personality beats

Continuous bob is locomotion, not personality. While the owner has not been hit, dashed, or attacked for 1.8 seconds, schedule one authored beat every **6.0 seconds ± 1.5 seconds**, seeded by pet id and player slot so four companions do not perform together. A beat lasts 0.45-0.75 seconds and may move the root at most 12 px from the follow anchor.

The verb comes from anatomy: Verdant Wing preens one antenna against a wing edge; Hearth Newt chases the tip of its tail; Lodestar Moth checks the compass-eye on one wing; Copper Snail taps its shell rim; Gilded Gecko balances its curled tail like a shop scale; Brass Crab tests each gauge-claw; Pale Firefly combs its ribbon feelers; Slate Tortoise peeks out, then resettles its top shell plate. Resume the ordinary spring from the current transform rather than snapping back to the beginning of a loop.

### Combat reactions

- **Owner hit — recoil, not warning.** On accepted owner damage, the pet jerks 7 px opposite the incoming hit vector for 110 ms, pins loose parts toward the body, then recovers over 190 ms. Rate-limit to one full flinch every 350 ms; further hits add only a 2 px root tremor so damage-over-time cannot turn it into visual noise. No red flash, damage number, or hit ring appears on the pet.
- **Kill streak — one readable victory loop.** Five owner kills inside 2.25 seconds trigger a 0.65-0.85 second celebratory loop: one tight corkscrew/flit around the rear anchor and the pet-specific cheer chirp. Repeat only at each additional ten kills and no more often than once per 3 seconds. Celebration yields immediately to hit, downed, teleport, or telegraph avoidance.
- **Owner downed — dim droop.** The pet drops 7 screen px, slows to a 1.4-second bob, lets its appendages hang, reduces saturation by 35%, and eases to the systems-locked **0.35 alpha**. It stays over the owner's rear shoulder rather than orbiting a reviver, emits no particles, and does not point at safety. On revive it unfolds in 280 ms with no white/green burst that could impersonate a gameplay cue.

### Four-player readability contract

Pets are deliberately quieter than enemies, weapons, and telegraphs.

- **Size ceiling:** world-space visible bounds, including open wings and tails, are capped at 30 px Hatchling, 37 px Grown, and **44 px Apex**—approximately one character head. A runtime particle may reach a 52 px envelope but only one to three particles may be live per pet.
- **Palette ceiling:** 70-80% of each sprite is charcoal, bone, steel, brown, moss, or another dimension material at moderate saturation. A saturated accent occupies at most 8% of the shape and never blooms. Verdant Wing remains unmistakably green through fern, sage, and deep moss rather than chroma-like plasma lime. Friendly silhouettes avoid enemy-red flashes and the full white counter language.
- **Silhouette discipline:** pets use compact, horizontally biased bodies and one signature appendage read. They do not carry weapons, wear full player hats, use enemy health bars, or mimic hostile rusher poses. Their tiny off-white collar stitch is a shared friendly motif, visible only at close scale.
- **Party formation:** shoulder signs alternate by stable party slot; rear distance gains 6 px for slots 2 and 3. When owners overlap, pet roots apply up to 14 px of cosmetic pet-to-pet separation without moving in front of their owners.
- **Depth:** a pet is y-sorted but clamped to at least one actor band behind its owner and all hostile actors. Normal root alpha is 0.88 for the local pet and 0.68 for remote pets. When its bounds overlap an owner or enemy silhouette for more than 80 ms, ease toward 0.42 alpha; restore over 160 ms after separation.
- **Telegraph exclusion:** expand every active red/white truth band by 14 px and project the pet anchor to the nearest outside tangent, with a maximum 28 px cosmetic detour. Disable particles and dart trails within that margin. If the pet cannot leave the expanded shape without a larger displacement—for example, inside a room-wide circle—fade it to 0.12. The telegraph mask renders above the pet and punches pet pixels completely out inside the exact band plus an 8 px feather. **No pet pixel, outline, particle, or shadow may occupy or occlude an exact telegraph band.** Reappear only after the band releases; pet avoidance never changes gameplay position.

## The evolution fantasy

Evolution is a three-panel time lapse of the same creature. The face mark, dominant silhouette, palette, chirp family, and mapping lane remain fixed. There is no feeding-stat body mutation, random colorway, rarity aura, or branch choice.

| Stage | Meta moment | Visual growth | Motion growth | Particle budget |
|---|---|---|---|---|
| **Hatchling** | Bond levels 1-3 | 26-30 px, approximately 65% mature scale; roundest proportions; two source parts where anatomy permits; one eye/face mark; muted secondary color. | Faster, slightly nervous 3 px bob; loose part uses 75% of normal angular range; follows at approximately 52 px. | One very faint species wake fleck at a time, never an orbit or aura. |
| **Grown / Awakened** | Bond levels 4-7 | 33-37 px, approximately 85% mature scale; body lengthens 8-12%; one extra separated cutout/shell layer appears; accent reaches its authored saturation without increasing color count. | Normal follow values; idle beat gains its complete preen/flit verb; follows at approximately 62 px. | One restrained orbiting painted mote, suppressed in combat clutter. |
| **Apex / Ascendant** | Bond levels 8-10 | 40-44 px at mature scale; final 2-4-part rig; crown, tail fan, antenna, handle, shell, or frill completes the existing silhouette. At level 10 the already-present core/glyph becomes a small permanently bright flat color shape—this is not a fourth form or bloom. | Catch-up dart gains the species-specific silhouette pose; celebration uses full 12-degree appendage travel; follows at approximately 72 px. | Two restrained orbit motes and one species wake, maximum six live pet motes across the four-player view. No aura or continuous ring. |

Stage swaps occur only on the result/meta screen and apply to the next run, never as a mid-combat flash. In the evolution ceremony, the old silhouette folds flat like a paper card, the new cutout unfolds from the same root pivot, and the added part springs once. Level 10 lights the existing Apex/Ascendant core mark after the same ceremony rather than adding a fourth silhouette. The fanfare may be grand, but the resulting world sprite returns to the quiet palette and particle ceiling.

## Render and asset specification

### World rig sheets

Future `tools/artkit/gen-pets.mjs` should generate one source card per `{pet, stage}` and use an approved earlier stage as an identity reference for later stages. Do not generate all stages in one image; each stage is a fresh isolated ticket with the prior approved stage attached.

- **Raw source:** 1024 × 1024 PNG, full opaque `#00ff00` chroma. One pet rig source card only—no panels, labels, borders, floor, shadow, particle, glow, or pose montage.
- **Camera:** slightly high three-quarter top-down view matching the playable arena, facing screen-right. Show the top plane and the near/front plane; the body axis lies horizontally left-to-right. It is not pure side profile, front view, or isometric. Use the same 0.60-0.65 visual depth compression as the top-down rigs.
- **Style:** HD paper-cutout cel art, heavy slightly uneven black outer contour, simple interior ink, flat base plus one hard shadow band and at most one hard highlight per material, approximately 4-6 meaningful colors. Matte painted card stock with a few decisive edge nicks; no photoreal fibers or soft gradients.
- **Part separation:** draw the root body and every listed appendage as separate, complete cutout islands on the same green field. The root is centered near `(512, 510)` inside a 380 × 380 safe box. Appendages occupy named outer bays near `(225, 255)`, `(799, 255)`, and `(512, 820)`. Keep at least 64 raw pixels of pure green between alpha bounds; no touching, overlap, nesting, duplicated part, or fused paired wing. A paired item is one part only when the roster explicitly calls it a folded pair.
- **Registration:** later stages keep the root centroid, right-facing axis, face mark, and shared part pivots within 12 raw pixels of the previous approved stage. Each separated appendage is painted with 6-10% hidden root material beyond its pivot for overlap after assembly.
- **Processing:** chroma-key and despill first, connected-component slice second, trim each part third, then record source centroid, parent, pivot, rest angle, spring preset, z-order, and stage in a `parts.json`-style manifest. Never resize the full card before component detection. Assemble a contact sheet in tooling for review, not as a generated asset.
- **Runtime scale:** normalize the assembled alpha bounds to the 30/37/44 px stage caps. Preserve full-resolution masters for portraits and later rerenders.
- **Particles:** the table's particle accent names a runtime painted-particle pack. It is not part of the rig sheet and must never be baked around the creature.

Suggested asset stems are `pet-{petId}-s{1|2|3}-rig`, with installed parts under `sprites/pets/{petId}/s{stage}/`. Stage manifests may contain two, three, or four total cutout parts, body included; absence is intentional and must not be filled with generic wings.

### Pet-select portraits

Generate a separate portrait per `{pet, stage}` after the world rig is approved, using the assembled approved rig as Image 1.

- 512 × 512 square source on the same flat opaque `#00ff00` field; downstream keying supplies transparency.
- Assemble the parts into the neutral hover pose at the same right-facing three-quarter top-down angle. The entire pet fits inside a 56 px safe inset and occupies 68-74% of the canvas; face mark sits near the upper-right thirds intersection.
- Portrait rendering may add one extra hard highlight and slightly cleaner edge ink, but no extra anatomy, particle aura, background vignette, floor shadow, card frame, rarity color, text, lock, or stat icon. UI supplies all framing and dimension wash.
- The card uses the current unlocked stage portrait. A locked higher stage is the same portrait shown as a flat charcoal silhouette; do not expose Apex anatomy early through a bespoke locked illustration.
- Export stem: `pet-{petId}-s{stage}-portrait`. At card size, test at 96 × 96 and 48 × 48; the face mark and signature silhouette must survive both.

## Sound hooks

Pet audio is local-player-forward: local chirps play at normal pet mix, remote chirps at 25% gain, and remote idle chirps are omitted during combat. Idle chirps rate-limit to one per 5 seconds globally; celebration may interrupt idle; downed state is silent. Avoid alarm beeps, reload clicks, parry-white chimes, enemy aggro calls, and anything with a long combat-masking tail.

The following ids are ready for `tools/soundkit/sfx-manifest.json` under a new `pet` category. Each chirp is non-looping, 0.25-0.55 seconds, has three variations, and `replaces: null`.

| Manifest id | Chirp family |
|---|---|
| `pet-verdant-wing-chirp` | Soft leaf-wing shuffle ending in one glassy dew pip; airy and nurturing, never fairy-bell sparkles. |
| `pet-hearth-newt-chirp` | Charcoal pebble tick, breathy salamander squeak, and a very short warm-glass ping. |
| `pet-lodestar-moth-chirp` | Cobalt wing brush followed by two low compass-chime notes; kept below parry-white pitch. |
| `pet-copper-snail-chirp` | Tiny brass shell tap, soft magnetic hum, and one damp snail trill; no coin-pickup jingle. |
| `pet-gilded-gecko-chirp` | Dry gecko click over a muted shop-scale tick; no Scrip or cash-register sound. |
| `pet-brass-crab-chirp` | Two asymmetric gauge-claw clacks and a warm clockwork purr; no reload ratchet. |
| `pet-pale-firefly-chirp` | Milk-glass flutter with one soft breathy lantern tone; never a revive-complete chime. |
| `pet-slate-tortoise-chirp` | Low stone-shell knock with a tiny mossy scrape and a calm blue-core hum. |

Shared event ids:

- `pet-follow-dart`: 0.28 s, three variations, dry paper zip with no impact; never plays for remote pets.
- `pet-celebrate-loop`: 0.72 s, two variations, light circular flutter bed; layer the owner's species chirp once at the loop apex.
- `pet-evolve-awakened`: 1.35 s, two-part paper unfold plus rising three-note bone/wood/celesta phrase; no loop.
- `pet-evolve-ascendant`: 2.6 s, the same motif widened with a low dimensional swell, a crisp unfold hit at 1.5 s, and the species chirp as the final identity tag; reuse at level 10 with a shorter 1.2 s intro cut for the existing core/glyph light. No combat siren, choir, or loot-rarity sting.

## Launch roster look-table

| Pet / dimension / systems mapping lane | Silhouette and idle tell | Hatchling → Grown → Apex | Palette and runtime particle | Stage-3 Apex flourish | `PROCEDURAL_JIGGLE` parts, body included |
|---|---|---|---|---|---|
| **Verdant Wing** — Verdant Ruins; **passive regen multiplier + level-10 extra weapon charge.** | An unequivocal green butterfly: bud thorax, two double-lobed leaf-wing cards that read as four fern wings, short curled proboscis mark, and tiny friendly collar stitch. Never a moth, dragonfly, fairy, or humanoid. It preens an antenna along the near wing. | **H:** plump bud-body with one folded paired-wing card. **G/Awakened:** near/far double-lobed wings separate, gain one fern notch each, and the thorax lengthens. **A/Ascendant:** antenna crest appears and pale dew veins complete the same butterfly outline; level 10 lights one tiny dew node. | Deep moss `#315A3B`, fern `#5F7A46`, sage `#8FA76A`, bone `#CFC6AE`, pale dew `#9FD8E8`; `pet-verdant-wing-dew-mote`. No chroma-like lime. | The four fern lobes open into a soft leaf crown and release two dew-paper beads in a short rear crescent. The level-10 dew node is a flat bright mark, never a healing aura or bloom. | **S1:** body/root + folded-wing (`flutter`). **S2:** body + near-wing + far-wing (both `flutter`). **S3:** add antenna-crest (`antenna`), 4 total. |
| **Hearth Newt** — Ashlands; explicit healing received + descent heal. | Ember-orange shoulder newt with a broad charcoal head-body, warm glass belly, heavy curled tail, and a candle-flame-shaped paper crest rather than realistic legs. It notices and chases its tail tip for half a turn. | **H:** coal-pebble body and thick tail. **G/Awakened:** body lengthens and a separate belly-lens plate appears. **A/Ascendant:** flame-shaped crest rises and the tail hook sharpens; level 10 lights the existing belly coal. | Basalt `#22252B`, ash red `#9E3B36`, lava red `#C0341F`, ember `#FF8A2B`, warm tan `#C49A5A`; `pet-hearth-newt-ember-scale`. | Belly, crest, and tail align into a tiny traveling-hearth silhouette; two painted cinder scales tumble off on celebration. The crest is solid card, not actual flame or baked glow. | **S1:** body/root + tail (`tail`). **S2:** add belly-lens (`weighty`). **S3:** add flame-crest (`flutter`), 4 total. |
| **Lodestar Moth** — Frostfell; XP-mote reach + pre-cleanup XP sweep. | Cobalt moth with broad compass-eye wing markings, a compact dark thorax, and a small astrolabe ring behind its head. It checks one compass-eye, then corrects its hover by a few degrees. | **H:** cobalt seed-thorax and one folded wing card. **G/Awakened:** near/far wings separate and compass-eye markings become complete. **A/Ascendant:** astrolabe ring appears and wing tips gain one cathedral point; level 10 lights the compass needle. | Blue charcoal `#23303F`, cobalt `#2E6E9E`, steel `#5A6472`, frost `#9FD8E8`, bone `#CFC6AE`; `pet-lodestar-moth-star-tick`. | The weighty astrolabe turns one notch while both wing eyes remain graphic markings, not real eyes or a targeting reticle; two star-ticks follow its wake. | **S1:** body/root + folded-wing (`flutter`). **S2:** body + near-wing + far-wing (both `flutter`). **S3:** add astrolabe-ring (`weighty`), 4 total. |
| **Copper Snail** — Wild West; earned-weapon pickup reach + thirteenth bag slot. | Tiny limbless brass snail with a low bean body, two short feeler nubs, magnetized coin-shell, and one strapped pannier card. It taps the compass rim, waits, then leans into the indicated direction. | **H:** soft charcoal body and oversized copper coin-shell. **G/Awakened:** single double-pannier card appears beneath the shell and the shell gains a magnet notch. **A/Ascendant:** compass rim separates above the shell; level 10 lights one north pip. | Gunmetal `#3A4049`, copper rust `#A8482E`, trail tan `#C49A5A`, bone `#CFC6AE`, steel `#5A6472`; `pet-copper-snail-brass-filing`. | Pannier and shell read as a tiny pack animal while the compass rim makes one slow half-turn; two brass filings trail low. No coin shower, bag icon, or pickup arrow. | **S1:** body/root + coin-shell (`weighty`). **S2:** add double-pannier (`weighty`). **S3:** add compass-rim (`antenna`), 4 total. |
| **Gilded Gecko** — Wild West; legitimate earned-sale Scrip rate/cap + larger max-level mint cap. | Limbless gold gecko with a broad wedge head, coin spots, flexible curled tail, and a tiny shopkeeper-scale pan nested at its tip. It balances the tail left/right, then gives one dry satisfied click. | **H:** gold bean-body and blunt curled tail. **G/Awakened:** a separate dorsal coin-ribbon appears and the tail curl deepens. **A/Ascendant:** balance-pan tip appears beneath the curl; level 10 lights one scale-notch. | Charcoal `#22252B`, old gold `#C4B24A`, trail tan `#C49A5A`, rust `#A8482E`, off-white `#E8E4D8`; `pet-gilded-gecko-gold-scale`. | Tail, pan, and dorsal ribbon briefly balance into a clean scale silhouette, then relax. Two dull-gold scales flake away; never use coins, cash-register symbols, or a rarity sparkle. | **S1:** body/root + curled-tail (`tail`). **S2:** add dorsal coin-ribbon (`flutter`). **S3:** add balance-pan (`weighty`), 4 total. |
| **Brass Crab** — Neon-Cyber; gun/thrown reload-refill duration + faster stowed reload/refill debt. | Hovering clockwork crab with a squat brass shell, no walking legs, twin detached gauge-claws, and a thin ticking halo. It checks the near gauge, then the far gauge, never snapping like an enemy. | **H:** round clockwork shell and one closed paired-claw yoke. **G/Awakened:** near/far gauge-claws separate and the shell gains one wind-up notch. **A/Ascendant:** ticking halo appears; level 10 lights one cyan timing pip. | Gunmetal `#3A4049`, brass `#C49A5A`, steel `#5A6472`, charcoal `#22252B`, cyber-cyan `#33E6FF`; `pet-brass-crab-clock-snip`. | Gauge needles oppose each other while the halo advances exactly one tick and releases two rectangular clock snips. It must not resemble a reload icon, crosshair, or cooldown dial in world play. | **S1:** shell/body + closed claw-yoke (`weighty`). **S2:** body + near-claw + far-claw (both `weighty`). **S3:** add ticking-halo (`antenna`), 4 total. |
| **Pale Firefly** — Verdant Ruins; revive-effect reach + increased ally return HP. | Milk-white firefly with a rounded medical-lantern abdomen, dark mask notch, two petal-like wing cases, and paired ribbon feelers. It slowly combs the ribbons beneath its abdomen. | **H:** milk-glass body and one folded wing-case. **G/Awakened:** near/far wings split and the abdomen gains a dull-teal medical band with no cross icon. **A/Ascendant:** paired ribbon-feeler card appears; level 10 lights the existing abdomen core. | Off-white `#E8E4D8`, bone `#CFC6AE`, dull teal `#3C6E6A`, pale cyan `#9FD8E8`, charcoal `#22252B`; `pet-pale-firefly-milk-dust`. | Ribbons form a loose cradle under the lantern abdomen while two milk-paper motes orbit once. No revive ring, health cross, angel wings, or white counter flash. | **S1:** body/root + folded wing-case (`flutter`). **S2:** body + near-wing + far-wing (both `flutter`). **S3:** add paired ribbon-feeler (`tail`), 4 total. |
| **Slate Tortoise** — Verdant Ruins wild egg; pit/ground-hazard mitigation + post-pit regen boost. | Palm-sized limbless rune-stone tortoise: low mask-head peeking from a broad slate shell, moss seams, cairn plates, and a recessed blue core. It peeks out, tests the air, then settles the top stone with a heavy wobble. | **H:** head-body and one rounded slate shell-cap. **G/Awakened:** a separate mossy cairn plate stacks on top and rune seams become readable. **A/Ascendant:** core-shutter appears beneath the plate; level 10 lights the already-present blue core. | Charcoal `#22252B`, slate `#5A6472`, moss olive `#6E7042`, dull teal `#3C6E6A`, pale blue `#9FD8E8`; `pet-slate-tortoise-rune-grit`. | Cairn plates lift one card-thickness, the core-shutter opens, and two rune-grit chips settle downward. No shield bubble, safe-zone ring, or immunity tell. | **S1:** head-body/root + shell-cap (`weighty`). **S2:** add cairn-plate (`weighty`). **S3:** add core-shutter (`weighty`), 4 total. |

## Codex render-prompt template

```text
# CHAT ISOLATION — ONE PET, ONE STAGE, ONE ASSET
This ticket targets only `{PET_ID}`, stage `{STAGE_NUMBER}` (`{STAGE_NAME}`), asset mode `{ASSET_MODE}`. Disregard visual concepts from other image-generation turns. If an approved previous-stage or world-rig image is attached, it is the canonical identity reference and must be matched exactly for species, face mark, silhouette family, palette, materials, right-facing orientation, and paper-cutout rendering. Do not blend in any other pet.

Generate ONE PNG source image for Dimension Drifters, an HD 2D top-down co-op bullet-heaven with a grim paper-cutout cel-shaded identity.

PET
- Display name: `{DISPLAY_NAME}`
- Dimension origin: `{DIMENSION}`
- Immutable systems/identity lane: `{MAPPING_LANE}`
- Identity lock: `{IDENTITY_LOCK}`
- This stage only: `{STAGE_DESCRIPTION}`
- Silhouette lock: `{SILHOUETTE_LOCK}`
- Palette, exact and limited: `{PALETTE}`
- Runtime-only particle reference (DO NOT PAINT IT): `{PARTICLE_PACK_ID}`

HOUSE STYLE — NON-NEGOTIABLE
- Original, trademark-distinct creature; compact, weird, body-first, and no human anatomy or human face.
- HD paper-cutout game art, NOT pixel art, NOT a polished toy/collectible mascot, NOT soft anime, NOT photoreal.
- One heavy slightly uneven hand-inked black outer contour; only a few simple interior ink marks.
- Flat cel shading only: base color plus ONE hard shadow band and AT MOST ONE hard highlight per material. No gradients, ambient occlusion, soft airbrush, bloom, or baked glow.
- Approximately 4-6 meaningful colors. Keep most of the creature dark or materially muted; saturated accent covers at most 8% of its area.
- No weapon, item, hat from the player roster, text, logo, UI, frame, floor, cast shadow, environment, aura, trail, dust, sparks, spores, snow, pixels, or particles.

CAMERA AND POSE
- Slightly high THREE-QUARTER TOP-DOWN game view matching the arena rigs, facing SCREEN-RIGHT. Show the top plane and near/front plane. Body axis runs left-to-right.
- Visual ground-depth compression is about 0.62. This is NOT pure side profile, NOT front-facing, and NOT isometric.
- Neutral hovering rest pose only. No attack, running, lunging, dramatic action, or celebration pose.
- Preserve `{REGISTRATION_LOCK}` from the approved prior stage/reference. The face mark, body root, and shared appendage pivots may not drift.

OUTPUT FORMAT
- Canvas exactly `{CANVAS}`. Background is a perfectly flat, fully opaque, uniform pure green `#00ff00` field. Never use `#00ff00` or chroma-like near-green in the creature.
- Return ONE standalone image, not a grid, montage, contact sheet, multi-stage lineup, turntable, or card.

IF `{ASSET_MODE}` = `RIG_SHEET`:
- This is one exploded rig source card. Draw exactly these total cutout parts and no others: `{PART_LIST_WITH_PARENT_PIVOT_SPRING_AND_BAY}`.
- Root body centered near `(512, 510)` inside a 380 × 380 safe box on the 1024 × 1024 canvas. Place appendages only in their assigned outer bays near `(225,255)`, `(799,255)`, and `(512,820)`.
- Every part is a separate complete opaque paper island, fully outside every other part, with at least 64 raw pixels of uninterrupted `#00ff00` between alpha bounds. No touching, overlap, nesting, fusion, duplicate, or hidden part.
- Paired near/far wings, fins, leaves, or cases must be two separate cutouts unless the part list explicitly says `paired` or `folded` for this stage.
- Paint 6-10% hidden parent material beyond each authored pivot so runtime rotation can overlap cleanly. Do not draw pivot marks, labels, boxes, guides, particles, or assembly lines.

IF `{ASSET_MODE}` = `PORTRAIT`:
- Canvas exactly 512 × 512. Assemble the approved rig exactly; do not invent, omit, fuse, or reshape parts.
- Entire creature fits within a 56 px safe inset and occupies 68-74% of the canvas. Put the face mark near the upper-right thirds intersection.
- Neutral hover, current stage only, same camera and palette. No background vignette, card frame, lock icon, rarity color, stat icon, particles, or additional anatomy.

Before returning, verify: one pet; correct stage; screen-right; top-down 3/4; exact part count; green gaps clean; no baked VFX; no shadow/floor; no extra anatomy; no text; identity unchanged.
```
