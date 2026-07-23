# Pet 2 — Evolution-Divergence

## 1am summary

Keep Hatchling, Awakened, and Ascendant, but redraw every line as **seed → revealed species → impossible personal legend**: bodies change proportion, wings multiply, limbs/shells/riders/swarms appear, and color is never the main difference. Use versioned modular form slots so old pet IDs and Bond XP survive, keep every transformation cosmetic rather than stronger, and pilot two deliberately opposite Ascendant choices on only four pets; that small branch set provides the PSO2-MAG “this one is mine” feeling without doubling all 24 planned pets’ art.

### Initial assumptions

- The three existing visual bands remain the progression backbone; this proposal enriches their forms rather than changing level thresholds.
- Branches, if recommended, are cosmetic identity commitments rather than power tiers.
- Existing shipped pets are the baseline examples; any additional roster examples will be taken only from pet-1 material actually present in this worktree.
- The final report will distinguish verified implementation from design proposals and will contain no product-code or asset changes.

## Verified baseline

- `packages/shared/src/pets.ts` is the shipped catalog of record: exactly **8 implemented pet IDs** — `verdant-wing`, `hearth-newt`, `lodestar-moth`, `copper-snail`, `gilded-gecko`, `brass-crab`, `pale-firefly`, and `slate-tortoise`. This is not currently a 24-pet shipped catalog.
- The same file fixes three progression bands: **Hatchling** at levels 1–3, **Awakened** at 4–7, and **Ascendant** at 8–10. Bond XP and pet ID are persisted; tuning is resolved from catalog data.
- `PET_PART_SLOTS` in shared code is currently the compact normalized logical set `core`, `primary`, `secondary`, with an explicit comment that stable slots allow later fusion/evolution manifests to replace parts without account migration.
- `packages/client/public/sprites/pets/pet-parts-manifest.json` is valid and complete at **72 installed parts / 72 expected**, with no missing, extra, or invalid entries. Its art-side socket frame is already more expressive than the three logical shared slots: `side.far`, `side.near`, `side.paired`, `rear`, `crown`, `shell`, `dorsal`, and `ventral`, plus child socket `tailTip`; `body` is the root. This report will therefore distinguish **logical save slots** from **render sockets**.
- The reporting rule in `docs/sol-reports/README.md` is to write the mandate first, update as work completes, and append validation last. The requested output path for this panel is `docs/design/pet-2-evolution.md`, so that is the sole report of record for this track.
- `packages/client/src/sprites/pet-parts.ts` loads a stage as an arbitrary ordered `parts[]` assembly; it does **not** enforce “one item per socket” or a fixed count. Each part carries its own parent, receiver socket, scale, plane, and optional spring preset (`flutter`, `antenna`, `tail`, or `weighty`). That is enough foundation for multi-part wings, crests, orbiters, shell layers, and chained appendages, although new behaviors such as orbital motion or swarm separation would need later runtime support.
- The same loader places each full assembly inside stage envelopes of **30 / 37 / 44** units. Thus Ascendant is about 47% larger than Hatchling in maximum on-screen extent, independent of actual anatomy. Dramatic form still needs composition changes; global scaling alone cannot provide them.
- The installed manifest reveals a uniform authored cadence across all eight pets: every Hatchling has **2 parts**, every Awakened has **3**, and every Ascendant has **4**. Stage 2 usually unfolds a paired wing/claw into near/far pieces or adds one accessory; stage 3 adds exactly one crest, halo, rim, ribbon, pan, feeler, or shutter. This regularity is the concrete source of the current visual timidity.
- `tools/artkit/gen-pets.mjs` makes that timidity explicit: its eight Awakened body prompts all say “subtly lengthened” or “subtly broadened/lengthened,” and it hard-fails unless the job list is exactly **72**. The art handoff must replace that hard-coded `2/3/4` cadence and those conservative body-edit instructions, not merely append more pets to them.
- The portal’s visible **24** is also not 24 species. `tools/portal/gen-portal.mjs` builds its `pets` rows by flat-mapping each `PET_ID` across all three `PET_STAGE_DEFS`, so today it means **8 species × 3 stage rows**. Pet-1’s 24 is a future roster recommendation (**8 shipped + 16 proposed**), a different count that the future portal should label separately as species versus forms.
- `docs/design/pet-1-roster.md` recommends 16 named additions for **24 total** (8 shipped + 16 proposed), produced in two waves of eight. Its expansion IDs are `biscuit-jackalope`, `crowned-pronghorn`, `manymoon-oracle`, `little-pallbearer`, `rivet-mule`, `brimstone-imp`, `thimble-deputy`, `chapelback-bison`, `tollwater-ray`, `gravewick-beetle`, `ragwing-vulture`, `rambleroot-tumbleweed`, `ghost-coyote-pup`, `hungry-boot`, `moonmilk-ooze`, and `rattlesmoke-wyrm`. The examples below use pet-1’s exact anchors rather than claiming these are implemented.

## One-minute direction

Keep the three familiar bands, but change their visual sentence from **“small pet → same pet with one more part → same pet with a hat”** to **“seed → revealed species → impossible personal legend.”** Hatchling shows two identity anchors and one promise; Awakened changes anatomy in at least two obvious ways; Ascendant performs one hero mutation that can be recognized as a black thumbnail. The form may become broad, tall, many-winged, many-legged, hollow, mechanical, mounted, spectral, or plural, but it retains two lineage anchors such as the same face notch and core shape. None of these visual paths changes the pet’s bonus lane.

### The silhouette gate handed to pet-4

| Band | Authoring target | Required visible delta | Typical assembly budget |
|---|---|---|---:|
| **Hatchling** | A compact toy/seed with one “future promise” folded into it | 1 dominant mass, 1 clear face, no more than 1 major appendage card | 2–3 cutouts |
| **Awakened** | The species reveals how it moves and what is strange about it | Change at least **2** of: aspect ratio, appendage count, pose/locomotion, negative space/detached islands, contour texture | 4–6 cutouts |
| **Ascendant** | A poster-form legend, not an accessorized Awakened | Change at least **3** axes and use **1 hero mutation** from the vocabulary below; preserve exactly 2 lineage anchors | 7–10 cutouts; 12-part exception cap |

Art review should flatten each stage to a solid black 64 px thumbnail, remove color/glow/particles, and shuffle the order. If reviewers cannot reliably sort the three bands or distinguish both Ascendant branches, the line fails even if the full-color art is attractive. The existing 30/37/44 runtime envelopes remain a useful legibility ceiling; drama comes from changed proportions and topology inside that ceiling, not ever-growing screen obstruction.

## Evolution vocabulary: named mutations

These are promptable building blocks, not species or power tags. An Awakened usually uses one or two; an Ascendant combines two or three, with the bolded idea in its line serving as the hero mutation.

| Vocabulary name | Concrete transformation | Silhouette impact | Form slots most affected |
|---|---|---|---|
| **Mass Shift** | Replace the juvenile body with a genuinely different proportion: bean becomes long serpent, pebble becomes broad fortress, bud becomes deep thorax. Do not request a percentage upscale. | Changes length/width ratio and center of mass. | `body`, often `ventral` |
| **Pinion Bloom** | Wing buds unfold into a pair, then multiply into two or three pairs, a radial fan, or a cloak of pinions. | Greatly widens the pet; creates repeated lobes and gaps. | `side`, `side.secondary`, optionally `crown` |
| **Limb Chorus** | Add a second/third pair of legs, claws, hands, feelers, or root-limbs; pairs may differ in size or job. | Turns a simple oval into a rhythmic many-point contour. | `side`, `side.secondary`, `side.tertiary` |
| **Crownrise** | Sprout horns, antlers, antennae, ears, crest, parasol, halo-post, or flower crown from the head/top. | Adds height and an unmistakable headward direction. | `crown` |
| **Carapace Forge** | Grow a shell, split plates, layered armor, shield petals, or a hinged shrine around the core. | Makes the center bulky or creates strong scalloped plate edges. | `shell`, `dorsal`, `ventral` |
| **Plume Burst** | Down becomes a mane, skirt, tail fan, beard, or enormous soft plumage. | Replaces clean contour with a feathery/furry starburst; can stay cute. | `dorsal`, `rear`, `crown` |
| **Crystal Accretion** | A core mineralizes into prongs, geode plates, transparent fins, or a floating crystal cage. | Adds hard spikes and angular negative spaces. | `core`, `shell`, `crown`, `orbit` |
| **Eye Constellation** | One face mark buds into a deliberate cluster on a mask, wing cards, or detached eye-orbs; retain one friendly “lead” eye. | Makes the face broader or distributes attention around the silhouette. | `face`, `side`, `orbit` |
| **Tail Unfurl** | A nub/curl becomes one long banner, forked rudder, ribbon train, peacock fan, or nest of multiple tails. | Extends the rear axis and produces follow-through motion. | `rear`, `tailTip` |
| **Mechamorph** | Clockwork or cyber anatomy reconfigures: shell opens, claws telescope, wheel becomes rotor, limbs expose pistons, core becomes a tiny cockpit. | Converts rounded organic masses to readable tools, hinges, and radial machinery. | `body`, `side`, `shell`, `core` |
| **Swarm Split** | One body buds into 3–7 coordinated mini-bodies or reveals that the “body” was their nest. Keep one leader larger. | Changes topology from one connected creature to several islands. | `body`, `orbit.back`, `orbit.front` |
| **Rider Symbiosis** | The pet grows a saddle/platform and a tiny sprout, ghost, beetle, doll, or homunculus becomes its rider—or the Hatchling pilot reveals its mount. | Creates a stacked two-character read and instant story. | `body`, `dorsal`, `rider` |
| **Spectral Unbinding** | Solid mass hollows out into veil, smoke-tail, rib-light, translucent paper, or a mask towing a ghost body. | Introduces holes, taper, and trailing asymmetry; often narrows the body while enlarging its field. | `body`, `rear`, `aura.back`, `aura.front` |
| **Satellite Halo** | Detached stones, seeds, gears, candles, moons, or winglets orbit the main body as a broken ring. | Expands the footprint with intentional empty space and detached components. | `orbit.back`, `orbit.front`, `crown` |
| **Bloom Overgrowth** | Buds erupt into fungus shelves, flowers, vines, fruit, coral, or moss antlers; the host may become a walking garden. | Adds irregular organic tiers and asymmetry. | `dorsal`, `crown`, `rear`, `shell` |
| **Nested Reveal** | A shell, bell, seed, lantern, or armor body opens to reveal a second face/core/creature within. | Creates a new central void and a “container plus inhabitant” read. | `body`, `shell`, `face`, `core` |
| **Locomotion Flip** | Crawler becomes hoverer, flier becomes long-legged walker, snail becomes a rolling wheel, or squat idol becomes a floating procession. | Changes the stance line even when the materials stay constant. | `body`, `side`, `orbit.back` |

Palette shift, glow, particles, markings, and a uniform scale increase are **finish**, never a vocabulary mutation. They may reinforce a transformation but cannot satisfy the silhouette gate by themselves.

## Exact form-slot contract for art and systems

There are two layers, and keeping them distinct is how accounts survive:

1. **Account/logical layer.** Existing accounts continue to own `petId` plus `bondXp`; parts are resolved from catalog/manifest data. The current `core`, `primary`, `secondary` constants can remain coarse compatibility groups. An optional branch choice is the only new per-pet fact proposed later in this report.
2. **Form/render layer.** A stage/branch manifest resolves a stable form recipe into one root plus zero or more cutouts per named slot. Evolution replaces the recipe; it never writes every evolved part into old accounts.

### `PET_FORM_SLOTS_V1`

| Form slot | Cardinality | Meaning | Physical render sockets |
|---|---:|---|---|
| `body` | exactly 1 | Root mass, proportions, pose, and locomotion read | existing `body` root |
| `face` | 0–1 | Mask, muzzle, or multi-eye overlay separable from the body | **new** `face` |
| `core` | 0–1 | Gem, pilot, furnace, heart, or nested reveal | **new** `core` (may fall back to existing `ventral`) |
| `side` | 0–2 | Primary paired appendage; one complete paired card is allowed when separate depth/motion is unnecessary | existing `side.paired`, `side.far`, `side.near` |
| `side.secondary` | 0–2 | Second independent wing/limb pair | **new** `side.secondary.paired`, `side.secondary.far`, `side.secondary.near` |
| `side.tertiary` | 0–2 | Third pair, reserved for hero mutations | **new** `side.tertiary.paired`, `side.tertiary.far`, `side.tertiary.near` |
| `rear` | 0–2 | Tail, train, banner, feelers, exhaust, or tail-mounted child | existing `rear`, `tailTip` |
| `crown` | 0–1 | Horns, antennae, crest, halo-post, flower, parasol | existing `crown` |
| `shell` | 0–1 | Major carapace/container mass | existing `shell` |
| `dorsal` | 0–1 | Back plate, plumage, garden, saddle/platform | existing `dorsal` |
| `ventral` | 0–1 | Belly plate, skirt, underside limbs, lens | existing `ventral` |
| `rider` | 0–1 | Tiny mounted secondary character | **new** `rider` |
| `orbit.back` | 0–1 card | Far-plane satellites or swarm cluster; one card may contain several disconnected islands | **new** `orbit.back` |
| `orbit.front` | 0–1 card | Near-plane satellites or swarm cluster | **new** `orbit.front` |
| `aura.back` | 0–1 | Painted spectral/elemental field behind, with no gameplay meaning | **new** `aura.back` |
| `aura.front` | 0–1 | Foreground veil/ring fragments | **new** `aura.front` |

The exact legacy-to-logical mapping is: shared `core` → `body + face + core`; shared `primary` → `side + side.secondary + side.tertiary + shell`; shared `secondary` → `rear + crown + dorsal + ventral + rider + orbit.* + aura.*`. This lets old three-slot assumptions group new anatomy while art/fusion can address meaningful parts.

A manifest recipe should conceptually be `petId / band / formKey → Partial<Record<PET_FORM_SLOTS_V1, partId | partId[]>>`. `body` is the only mandatory slot. Empty slots are valid; activating `crown` or replacing one `side` pair is evolution, not a missing asset. Multiple pieces may share a receiver as the current assembly loop already permits arbitrary ordered parts. Pet-4 should keep the current hidden-collar registration rule; pet-5 should persist a branch/form key, never texture paths or stage-specific part IDs.

### Why modular pets succeed where the wardrobe did not

Clothing swaps imply a precise human seam, anatomy, layer order, and pose match; a bad collar or sleeve reads as an error. A stylized pet’s new shell plate, mismatched wing, floating eye, or exposed hinge reads as growth, magic, fusion, or mutation. The existing full-canvas pivots, hidden collars, body-relative sockets, per-part planes, and springs are therefore not merely an asset optimization: they are the visual language of evolution. The constraint is to preserve connector discipline and identity anchors, not to force every creature into the same anatomy.

## Fully authored evolution lines

The arrows below describe contour, not power. Every endpoint retains its base pet’s existing or assigned function regardless of path. **Bold text** names the hero mutation; bracketed text is the exact slot action for pet-4/pet-5. “Keep” lists the two lineage anchors that must survive every body replacement.

### Retained 1 — Verdant Wing: seed butterfly → fern kite → seraph or atlas

**Keep:** curled proboscis face mark; single pale dew node.

- **Hatchling — Budwing.** A plump round bud with the proboscis drawn like a friendly comma. One compact card of nested fern wings wraps it like cotyledon leaves: almost circular, toy-small, and clearly waiting to open. `[body; side.paired]`
- **Awakened — Fernkite.** The bud is replaced by a narrow, pointed thorax; four independent leaf pinions open in a steep X, the rear pair shorter than the front, with holes between every lobe. Two short fern-curl antennae give it a headward direction. It has changed from bead to kite, not merely grown. **Pinion Bloom + Mass Shift.** `[replace body; side.far/near; add side.secondary.far/near; add crown]`
- **Ascendant A — Canopy Seraph.** Six long wings form three rising tiers like a living fern cathedral. The upper pair bends forward as a canopy, the lower pair streams behind, and three detached dew seeds form a broken halo around the tiny familiar face. The body stays narrow so the wing multiplication owns the silhouette. **Pinion Bloom + Satellite Halo.** `[replace all three side pairs; replace crown; add orbit.back/front]`
- **Ascendant B — Bramble Atlas.** The same four Awakened wings fold downward and fuse visually into a massive veined leaf-shell. A broad beetle-like body and six root feet emerge beneath it; branched antennae become a thorn crown. It is low, hulking, and almost square—the opposite of the Seraph—while the proboscis and dew node remain. **Carapace Forge + Limb Chorus.** `[replace body; map all three side pairs to six root feet; add shell; replace crown]`

`Budwing → Fernkite ↗ Canopy Seraph / ↘ Bramble Atlas` is the reference branch test: if those endpoints could be mistaken for color variants, branching has failed.

### Retained 2 — Hearth Newt: coal pebble → kiln salamander → traveling hearth-wyrm

**Keep:** broad charcoal smile-mask; warm-glass belly coal.

- **Hatchling — Coalplip.** A limbless coal-pebble head-body with a heavy blunt tail curled tightly around it, giving a comma silhouette. No emitted fire; the warmth is in the painted belly fleck. `[body; rear]`
- **Awakened — Kiln Salamander.** Replace the pebble with a long low oven-body and unfold four squat firebrick foot-nubs. The tail doubles in length and hooks upward; the belly lens becomes a large round furnace door, and three solid paper-flame fins rise along the spine. **Mass Shift + Limb Chorus.** `[replace body; add side.far/near and side.secondary.far/near as foot pairs; replace rear; add core; add dorsal]`
- **Ascendant — Hearth Wyrm.** The body arches into an S-shaped baby dragon the length of its full envelope. Six oven-foot nubs march beneath it, the spine fins erupt into an enormous soft candle-flame mane, and the tail forks into two coal-tipped hearth pokers. A tiny chimney-crown leans backward over the same smiling mask. It is big and cozy rather than fierce. **Plume Burst + Tail Unfurl + Limb Chorus.** `[replace body; retain two foot pairs and add side.tertiary; replace rear with forked card; replace dorsal; add crown; retain core]`

### Retained 3 — Lodestar Moth: compass seed → four-wing mantle → gravesky cartographer

**Keep:** one friendly cobalt face mark; compass-eye graphic repeated as decoration, never a targeting reticle.

- **Hatchling — Northseed.** A dark cobalt seed-thorax wearing one folded moth-wing blanket. Only one incomplete compass-eye marking shows. `[body; side.paired]`
- **Awakened — Compass Mantle.** Replace the seed with a deep teardrop abdomen. Four broad wings open in a layered diamond; the lower pair is ragged like gravedigger cloth while the upper pair carries the completed compass marks. A small lantern abdomen hangs below as a separate core. **Pinion Bloom + Mass Shift.** `[replace body; side.far/near; add side.secondary.far/near; add core]`
- **Ascendant — Gravesky Cartographer.** Six wings form a wide tattered cloak around a surprisingly tiny thorax. The milk-blue grave lantern lengthens beneath it, while a broken astrolabe of three solid brass arcs and two pebble moons floats around the crown. The wing markings now point in different directions, giving the impression of many watchful eyes without adding literal hostile eyes. **Pinion Bloom + Satellite Halo.** `[replace body; replace two side pairs; add side.tertiary; replace core; add orbit.back/front; add crown]`

This intentionally develops the gravedigger-lantern-moth direction flagged by pet-1 without creating a redundant new moth base.

### Retained 4 — Copper Snail: coin bean → packwheel → caravan or roller

**Keep:** two tiny feeler nubs and friendly face; recessed magnet notch in copper shell.

- **Hatchling — Coinbean.** A low charcoal bean almost hidden under one oversized round copper shell. The shell is the silhouette; the face just peeks past it. `[body; shell]`
- **Awakened — Packwheel.** Replace the bean with a longer sled-like foot and split the shell visually into two offset copper discs around a dark hub. Twin panniers hang low on each side and a tiny compass feeler rises above, creating a layered wheel-and-sled outline. **Carapace Forge + Mass Shift.** `[replace body; replace shell; add ventral; add crown]`
- **Ascendant A — Wayhouse Caravan.** The shell unfolds upward into a three-tier copper awning with straps, bells, and one warm shutter; the body broadens into a six-footed pack-beast. A thimble-sized grub traveler sits on the dorsal saddle holding the original compass feeler. It reads as a moving tiny home, not as a larger snail. **Rider Symbiosis + Limb Chorus.** `[replace body; replace shell; add three side pairs as feet; replace dorsal; add rider; retain crown]`
- **Ascendant B — Lodestone Roller.** The long body tucks into a nearly complete gyroscope made from three perpendicular shell rings; only the face and feelers protrude from the front. Panniers become counterweights on the inner ring, and the creature rolls/levitates instead of crawling. **Mechamorph + Locomotion Flip.** `[replace body; replace shell; clear dorsal/rider; replace ventral; add orbit.back/front for outer rings; retain crown]`

### Retained 5 — Gilded Gecko: counterweight bean → ribbon skink → auric fan basilisk

**Keep:** friendly wedge-shaped eye mark; old-gold curled counterweight tail.

- **Hatchling — Countercurl.** A compact limbless wedge-bean with a blunt tail curled into an almost equal second circle. The paired circles make it instantly toy-like. `[body; rear]`
- **Awakened — Ribbon Skink.** Replace the bean with a long, low S-body and unfold four broad origami toes. The tail becomes longer than the torso, and a connected dorsal ribbon of scales rises like a soft sawtooth. **Mass Shift + Limb Chorus.** `[replace body; add two side pairs; replace rear; add dorsal]`
- **Ascendant — Auric Fan Basilisk.** Six delicate paper feet lift the long body high. The single tail divides into a three-lobed peacock fan; each lobe ends in a tiny dangling balance pan, while dorsal scales bloom into a sunburst collar around the head. No coins, text, or currency symbols are used. **Tail Unfurl + Plume Burst + Limb Chorus.** `[replace body; retain two side pairs and add side.tertiary; replace rear with multi-tail card and tailTip children; replace dorsal; add crown]`

### Retained 6 — Brass Crab: gauge puck → clock skitter → clockwork choir

**Keep:** calm single gauge-face; one cyan timing pip.

- **Hatchling — Ticklet.** A squat round brass puck with a closed blunt claw-yoke, no legs, hovering like a wind-up toy. `[body; side.paired]`
- **Awakened — Gauge Skitter.** The shell splits into upper and lower plates around a visible cyan core. Two large gauge claws detach, and four thin piston legs unfold beneath, turning the puck into a wide mechanical insect. **Mechamorph + Limb Chorus.** `[replace body; side.far/near as claws; add side.secondary.far/near and side.tertiary.far/near as two leg pairs; add core; add shell]`
- **Ascendant — Clockwork Choir.** The shell opens completely into a crescent frame. Four claws of descending size fan to either side like conducting hands; six hairpin legs trail below; three mismatched gear-satellites orbit behind a tall tuning-fork crown. The friendly gauge-face remains centered in the exposed core, making the bizarre machine companionable. **Mechamorph + Satellite Halo + Limb Chorus.** `[replace body; replace all three side pairs; replace core and shell; add crown; add orbit.back/front]`

### Retained 7 — Pale Firefly: milk lantern → petal flier → lantern procession

**Keep:** dark friendly mask notch; milk-glass abdomen with pale-blue center.

- **Hatchling — Milkbud.** A round milk-glass lantern with two folded petal cases hugging its sides. It reads as one pale droplet with a dark face notch. `[body; side.paired]`
- **Awakened — Petal Lantern.** The abdomen lengthens into a hanging lantern and four independent milk-paper wings open like a flower seen from above. Two ribbon feelers trail farther than the body, changing it from bead to cross-shaped kite. **Pinion Bloom + Tail Unfurl.** `[replace body; side.far/near; add side.secondary.far/near; add rear; add core]`
- **Ascendant — Lantern Procession.** The central body opens like a seedpod and releases four tiny milk-lantern young: two float behind and two in front, each echoing the lead mask notch. The leader gains six petal wings in a circular rosette and extremely long paired ribbons. It is simultaneously angelic, insectoid, and cute without using literal angel wings or medical symbols. **Swarm Split + Pinion Bloom.** `[replace body; use three side pairs; replace rear; add orbit.back/front as four-lantern swarm; retain core]`

### Retained 8 — Slate Tortoise: rune pebble → cairn walker → sanctuary or wraith

**Keep:** low friendly mask-head; moss seam crossing the pale recessed core.

- **Hatchling — Mosspebble.** A tiny mask-head peeks from a broad rounded slate shell. It is a two-layer oval with no visible legs. `[body; shell]`
- **Awakened — Cairn Walker.** Replace the body with a wider head-and-chest; four short root-stone legs emerge. The shell becomes three offset cairn tiers, with a visible hollow between the second and third plates. **Carapace Forge + Limb Chorus.** `[replace body; add two side pairs; replace shell; add dorsal; add core]`
- **Ascendant A — Walking Sanctuary.** The creature broadens into a chapel-backed quadruped: four pillar legs, a peaked slate shell with a warm tiny window, moss antlers, and a seed-sized hooded moss rider on top. The face remains low and gentle beneath the architecture. **Rider Symbiosis + Carapace Forge.** `[replace body and two side pairs; replace shell/dorsal; add crown; add rider; retain core]`
- **Ascendant B — Cairn Wraith.** The legs and solid shell disappear. The mask-head floats inside a hollow cage of six separated stone plates, with moss-root ribbons tapering behind and two pale shards circling in front. It is tall, airy, and spectral where the Sanctuary is low and massive. **Spectral Unbinding + Satellite Halo.** `[replace body; clear side pairs; replace shell with orbit.back; replace dorsal with orbit.front; add aura.back/front; replace rear; retain core]`

### Expansion proof 1 — Biscuit Jackalope: ear-pear → springhare → cherub or regent

**Keep:** enormous velvet ears pierced by horseshoe antler tines; bead tail.

- **Hatchling — Biscuit Button.** Pet-1’s fist-sized pear body stands on four nub feet beneath ears wider than everything below them. Tiny tines poke through the ear cloth and the bead tail barely breaks the rear contour. `[body; side.paired as four-feet card; crown; rear]`
- **Awakened — Springhare.** Replace the pear with a slim upright hare body on four long springy legs. Both ears grow to body length and the antlers fork into visible half-crowns; the bead tail blooms into one round powder-puff. **Mass Shift + Crownrise.** `[replace body; split two side pairs as legs; replace crown; replace rear]`
- **Ascendant A — Prairie Cherub.** The body shrinks back to a round mascot while the ears multiply into four enormous floppy pinions, each still pierced by a horseshoe tine. The antlers meet above the head as a floating soft crown and the puff tail divides into three cloud beads. It is aggressively cute and extremely wide. **Pinion Bloom + Crownrise.** `[replace body; map primary and secondary side pairs to four ear-wings; replace crown; replace rear; add orbit.front for floating crown gap]`
- **Ascendant B — Warren Regent.** The Springhare becomes a huge round six-footed burrow guardian. The original ears drape as a royal mantle, while antlers branch outward into a low shade canopy hung with three biscuit-shaped seed pods; the bead tail remains comically tiny. **Mass Shift + Limb Chorus + Bloom Overgrowth.** `[replace body; use three side pairs as feet; replace crown; add dorsal mantle; replace rear]`

### Expansion proof 2 — Crowned Pronghorn: crownlet fawn → lyre runner → horizon sovereign

**Keep:** lifted-chest vertical poise; two horn halves that visually complete one crown.

- **Hatchling — Crownlet Fawn.** A slim, slightly top-heavy fawn on four needle legs with short lyre horns and a narrow tapering muzzle. It is the roster’s deliberate vertical base silhouette. `[body; two side pairs as legs; crown]`
- **Awakened — Lyre Runner.** Replace the body with a long airborne running pose: front legs folded, rear legs stretched, chest plume trailing. Horns triple in height and fork inward, enclosing a clear diamond of sky above the muzzle. **Mass Shift + Crownrise + Locomotion Flip.** `[replace body; replace both side pairs with running-leg cards; replace crown; add dorsal plume]`
- **Ascendant — Horizon Sovereign.** Four long cape-pinions grow from the shoulders and trail backward rather than flapping. The immense lyre horns arc around the whole front half of the pet to make a broken oval crown; legs taper into detached hoof-stars, so the animal appears to stride on the horizon. **Pinion Bloom + Crownrise + Satellite Halo.** `[replace body; retain two leg pairs; add side.tertiary plus dorsal as four cape-pinions; replace crown; add orbit.front as hoof-stars]`

### Expansion proof 3 — Manymoon Oracle: eyelid bell → moon jelly → sevenfold orrery

**Keep:** upside-down bell mantle; one lead eyelid that opens toward danger while the others remain gentle/closed.

- **Hatchling — Hushbell.** A hovering inverted bell with three short feelers and one pebble moon above it. A ring of closed eyelids makes the rim scalloped but calm. `[body; ventral as joined feelers; orbit.back]`
- **Awakened — Moon Jelly.** The mantle opens into a wider hollow bell. Six feelers descend in two lengths, three pebble moons orbit at different heights, and the lead eye opens beneath the rim. **Limb Chorus + Satellite Halo + Nested Reveal.** `[replace body; use three side pairs or ventral/rear cards as six feelers; replace orbit.back and add orbit.front; add face]`
- **Ascendant — Sevenfold Orrery.** Three nested bell mantles float inside one another with the smallest turned upside-down, producing a central keyhole void. Seven moons form an incomplete ring; each moon carries one closed lid, while the lead eye remains on the outer mantle. Long translucent paper feelers taper into a spectral skirt. **Nested Reveal + Eye Constellation + Satellite Halo.** `[replace body; replace face; replace feeler cards; replace orbit.back/front; add aura.back/front; add core as innermost bell]`

### Expansion proof 4 — Rivet Mule: wind-up box → gantry mule → walking workshop

**Keep:** dish-shaped mule ears; rear horseshoe flywheel with a visible patch repair.

- **Hatchling — Rivet Foal.** A boxy iron mule with boiler chest, four short spring legs, dish ears, smokestack, and a flywheel nearly as large as its hindquarters. `[body; two side pairs; crown; rear]`
- **Awakened — Gantry Mule.** The boiler body lengthens and lifts high on four telescoping piston legs. Dish ears unfold into asymmetrical listening vanes; the flywheel moves onto an exposed rear gantry and drives a visible belt over the back. **Mechamorph + Mass Shift.** `[replace body; replace two side pairs; replace crown; replace rear; add dorsal belt/gantry; add core]`
- **Ascendant — Walking Workshop.** The gantry unfolds sideways into a broad six-legged repair platform. One foreleg ends in a careful clamp, another in a brush, and the remaining four stay hooves; the great flywheel becomes a rear rotor. A thumb-sized rivet sprite rides the dorsal bench and turns the same patched wheel. **Rider Symbiosis + Mechamorph + Limb Chorus.** `[replace body; use three side pairs; replace rear; replace dorsal; add rider; retain crown/core]`

### Expansion proof 5 — Ghost Coyote Pup: smoke pup → boundary hound → pack of one

**Keep:** oversized loyal ears; translucent rib-constellation always pointing toward the owner.

- **Hatchling — Wisp Pup.** A lean big-eared puppy whose front paws nearly touch the ground while its hindquarters dissolve into one smoke tail. `[body; side.paired as forepaws; rear; aura.back]`
- **Awakened — Boundary Hound.** Replace the puppy with a longer adolescent hound: four distinct floating paws, two forked smoke tails, and a hollow gap beneath the rib-constellation. It now runs in the air beside its owner. **Mass Shift + Tail Unfurl + Locomotion Flip.** `[replace body; two side pairs as paws; replace rear; replace aura.back; add core for ribs]`
- **Ascendant — Pack of One.** The hound becomes the leader of four detached spectral pup echoes arranged in a crescent—two behind, two ahead. Its own tail divides into three long smoke banners, and every echo repeats one rib-star, making the constellation span the whole pack. **Swarm Split + Spectral Unbinding.** `[replace body; replace two paw pairs; replace rear; orbit.back/front as four pups; replace core; aura.back/front]`

### Expansion proof 6 — Hungry Boot: hopping omen → lace crawler → bootleg leviathan

**Keep:** toe opening as a blunt friendly jaw; rowel spur as the single swiveling lead eye.

- **Hatchling — Nibbler Boot.** One upright cowboy boot hops on its heel. The curved toe opens a little when pleased and the rowel eye swivels behind it, giving the roster its unique L-shaped read. `[body; face; rear as spur-eye]`
- **Awakened — Lace Crawler.** The boot tips onto its side and six knotted lace-legs emerge along the sole. The shaft bends like a neck, the toe-jaw grows broad and soft, and the rowel eye rises on a short stalk. **Limb Chorus + Locomotion Flip.** `[replace body; three side pairs as lace-legs; replace face; replace rear/crown eye stalk]`
- **Ascendant — Bootleg Leviathan.** The leather shaft unrolls into a long S-shaped dust serpent made from stitched boot sections. Three heel-legs carry it, three toe-jaws graduate down its underside, and five tiny spur-eyes orbit the original large lead eye like rowel moons. It is an absurd leather centipede/dragon, not a big boot. **Mass Shift + Nested Reveal + Eye Constellation.** `[replace body; replace three side pairs with asymmetric heel/sole appendages; replace face; replace crown/rear; add orbit.back/front]`

These fourteen lines are intentionally not fourteen unique mechanics. They prove that the same bonus lane can support a mascot, beast, shrine, swarm, machine, ghost, or joke because attachment is about taste, not optimization.

## Branching recommendation: yes, but only at Ascendant and only for a pilot subset

Branching is worth doing. It is the clearest way to turn “I leveled the butterfly” into “I raised **this** butterfly.” Do **not** branch every band or every pet at launch. Ship exactly **two Ascendant endpoints** for a four-pet pilot; Hatchling and Awakened remain shared, function and capstone remain identical, and the player can later change the choice without losing the pet or Bond XP.

### Pilot branches and stable form keys

| Pet | Awakened care question | Path A → `branchKey` / full `formKey` | Path B → `branchKey` / full `formKey` | Deliberate contrast |
|---|---|---|---|---|
| Verdant Wing | “Teach it the wind, or let it climb?” | `canopy-seraph` / `verdant-wing:s3:canopy-seraph` | `bramble-atlas` / `verdant-wing:s3:bramble-atlas` | tall/airy/six-winged vs low/heavy/shelled |
| Copper Snail | “Make it a home, or follow the needle?” | `wayhouse-caravan` / `copper-snail:s3:wayhouse-caravan` | `lodestone-roller` / `copper-snail:s3:lodestone-roller` | walking inhabited caravan vs compact gyroscope |
| Slate Tortoise | “Give it a pilgrim, or listen to the stones?” | `walking-sanctuary` / `slate-tortoise:s3:walking-sanctuary` | `cairn-wraith` / `slate-tortoise:s3:cairn-wraith` | solid chapel-beast vs hollow spectral orbit |
| Biscuit Jackalope | “Encourage the leap, or build a warren?” | `prairie-cherub` / `biscuit-jackalope:s3:prairie-cherub` | `warren-regent` / `biscuit-jackalope:s3:warren-regent` | tiny body/four giant ear-wings vs round six-footed hulk |

The persisted choice is the short per-pet `branchKey`; catalog data resolves it to a namespaced stable `formKey`, never copy, color, or a texture path. Unbranched pets resolve `default` to their one canonical namespaced stage-3 form (`hearth-newt:s3:hearth-wyrm`, `lodestar-moth:s3:gravesky-cartographer`, and so on). New branch candidates are added only after both endpoints pass the shuffled black-thumbnail test.

### Raise flow: intentional care, not a hidden spreadsheet

1. On entering Awakened at level 4, the companion page reveals two named care paths and black-silhouette previews. The owner may choose immediately or defer.
2. Between levels 4–7, a statless care object/gesture sets the pending path: a wind ribbon versus climbing twig, home charm versus compass needle, pilgrim hood versus listening stone, leap feather versus warren blanket. This is “feeding/raising” ceremony, not an economy or power input.
3. The path remains freely changeable while Awakened. Crossing into level 8 asks for confirmation, then resolves the chosen band-3 form. If no path was chosen, progression and mechanics continue normally, the renderer safely uses that pet’s `default`, and the UI asks at the next safe companion screen rather than silently inferring a form from combat behavior.
4. After commitment, **Rebond** outside a run previews and swaps to the sibling endpoint. It never removes ownership, resets Bond, consumes a source pet, or changes function. A confirmation animation supplies weight; an irreversible choice supplies only regret.

Do not derive the endpoint from weapon use, pet bonus lane, damage taken, wins, or opaque food totals. Those rules make players optimize behavior for art and undermine the explicit form/function separation. A deliberate care path is still a record of how the owner raised the pet, but it remains legible and accessible.

### Persistence and replication handoff

Adopt pet-5’s additive shape: `formChoices?: Partial<Record<"1" | "2" | "3", string>>`, with this pilot using only `formChoices["3"] = branchKey`. Sanitization validates the key against that pet’s branch table; catalog data resolves it to the full form key. Existing `{ bondXp }` rows with no choice remain valid, render `default`, and can be invited to choose later; they are never dropped or reset. This generic band map also avoids another account-shape change if a distant future panel approves a branch in an earlier band.

The server continues to resolve all modifiers from `petId + level`. The branch key resolves **appearance only**. Because `PlayerState` currently exposes only `petId` and `petLevelBand`, remote players need one small public form discriminator (stable compact key/index, or the appearance descriptor already required by fusion). An old client falls back to the canonical form for that pet and band. Branch choice must not enter `budgetKey`, `PetMods`, capstone math, or run-balance snapshots except as display metadata.

## Art prompt packet handed to pet-4

Every stage/branch record should provide the following fields before generation; prose alone is not sufficient:

```text
petId / band / stable formKey
lineage anchors: exactly two visual facts to preserve
transformation thesis: one sentence describing what anatomy changes from prior band
vocabulary: 1–3 named mutations, with one Ascendant hero mutation
silhouette sentence: black-thumbnail outline, aspect, stance, disconnected islands/holes
form-slot recipe: active PET_FORM_SLOTS_V1 entries and exact cutout inventory
branch contrast: sibling endpoint and three ways the contours oppose one another, if branched
target envelope: authored value; 30/37/44 remain safe defaults
fusion policy per form slot: free or withBody
forbidden reads: gameplay icons, enemy posture, pickup/VFX ambiguity, lost lineage anchors
```

Example prompt kernel for `verdant-wing / 3 / canopy-seraph`:

> Preserve the curled proboscis face and single pale dew node. Transform Fernkite into a narrow six-wing fern cathedral using Pinion Bloom and Satellite Halo: three independent near/far wing pairs rise in distinct tiers with black gaps between every lobe; three detached dew seeds form an incomplete ring; the body remains the smallest mass. Render registered cutouts for `body`, all three `side` pairs, `crown`, `orbit.back`, and `orbit.front`. In black at 64 px it must read tall, airy, and many-winged, visibly opposite the low square Bramble Atlas. No healing icon, emitted aura, realistic insect horror, or reliance on green color to separate the forms.

Pet-4’s draft proposes authored per-form envelopes (rather than forcing every pet to the same 30/37/44): Hatchling 26–34, Awakened 33–43, Ascendant 40–54 px. This track supports that direction **after** a four-player bullet-density test; 30/37/44 remain defaults, and only forms whose silhouette needs it should approach 54. A thin ring touching 54 px does not count as a “big” creature—silhouette area and body mass must also be reviewed.

## Cost: what dramatic evolution actually adds

The tame shipped cadence costs 9 stage-part files per pet (`2 + 3 + 4`). The dramatic target averages about 16.5 (`2.5 + 5 + 9`), using paired/multi-island cards where separate depth is unnecessary and reserving 11–12 sprites for exceptional hero forms such as Clockwork Choir. Applied to pet-1’s 24-pet target, that is roughly **396 stage-part entries/files instead of 216: +180, or about +83%**, before branches. This is the honest price of bodies that change proportions, multiple appendage pairs, orbiters, riders, and swarms.

For the eight retained pets, the 16 Hatchling cutouts can mostly remain. Reauthoring their Awakened and Ascendant bodies/assemblies to average 5 and 9 cutouts yields roughly **112 stage-part entries across those bands instead of the current 56**. Some existing wings, tails, shells, and face language can be edited/reused, but the bodies and hero mutations should be budgeted as new art rather than assumed free.

The four-pet branch pilot adds exactly **4 extra Ascendant assemblies**: 28 forms instead of 24 across the shipped eight (+16.7%), or 76 instead of 72 across a future 24-pet roster (+5.6%). At 7–10 entries each, that is 28–40 additional stage-part placements; because each endpoint deliberately changes its body and hero mutation, expect about 20–30 genuinely new bitmaps after shared lineage parts. This is materially cheaper than two endpoints for every pet, which would add 24 whole Ascendant assemblies and approach a full extra stage’s art/QA cost.

### Engineering and QA cost

- `PET_FORM_SLOTS_V1` retains every current socket but proposes 13 new physical receivers: `face`, `core`, paired/far/near receivers for both second and third side sets, `rider`, two orbit planes, and two aura planes. They require a versioned socket-frame/generator contract, source pivots, depth laws, and tests; they are not claimed as shipped today.
- Static orbit, swarm, and aura clusters can initially be single multi-island cards on far/near planes. True orbiting, independent swarm drift, or a walking rider needs new PetRig motion presets and reduced-motion behavior; those are polish, not prerequisites for a dramatic static silhouette.
- Raise choice requires additive account validation, companion UI, one remote form discriminator, legacy fallback, and branch-aware asset loading. It does not require new combat balance or PetMods.
- Every approved form needs full-color rest, grayscale, black 64 px, spring-extreme, gameplay-scale, four-player stress, and branch-sibling comparison boards. Fusion sentinel composites must also test any slot marked `free`.

## Handoffs to the other four tracks

### Pet-1 — roster and identity

Pet-1 has supplied 16 additions and strong base hooks. For each one, freeze exactly two lineage anchors and name at least two mutation vocabularies it welcomes. Mark anatomy that must stay attached to the body (`withBody` candidates such as Hungry Boot’s boot/jaw, Manymoon’s bell rim, and Moonmilk Ooze’s internal star). Keep the recommended two waves of eight; do not assign unique mechanics merely to justify a silhouette.

### Pet-3 — fusion

Pet-3 has already adopted `PET_FORM_SLOTS_V1`, the coarse `core/primary/secondary` mapping, atomic side pairs/rear subtrees, and `fusionPolicy: free | withBody`. Branch parts should become donors only when that source branch is unlocked; a saved recipe stores the stable `formKey + semantic slot + donorPetId`, never a PNG path. `orbit.*` and `aura.*` are excellent universal donor cards; body-integral nested reveals and swarm leaders should be `withBody`. Rebonding a source pet must not mutate already saved fusion recipes—flatten donor provenance at save time as pet-3 recommends.

### Pet-4 — art and generation pipeline

Compile the prompt packet above into the canonical art record; remove the hard-coded 2/3/4 layer assumption; author per-form extents; generate bodies as real proportion edits rather than “subtly lengthened” prior masters; and promote whole assemblies only after silhouette review. The existing root/pivot/hidden-collar discipline remains binding. Treat the 13 new receivers as a proposed `PET_SOCKET_FRAME_V2`, not as if v1 already supports them. If v2 must phase in, multi-island root cards can deliver static swarms/orbits first, but no field should be baked into `body` merely to dodge the slot contract.

### Pet-5 — systems, accounts, and rollout

Own the namespaced form-key registry, per-pet valid branch table, additive `formChoices["3"]`, sanitizer/migration behavior, care-path UI state, branch-aware resolver, remote appearance discriminator, old-client canonical fallback, and run-boundary lock for display consistency. Continue resolving function from canonical `petId + Bond level`; both endpoints share exactly the same `budgetKey`, per-level bonus, and capstone. Keep part IDs, texture paths, socket coordinates, and resolved recipes out of legacy owned-pet rows.

## Owner questions

None block this direction. The working defaults are: preserve three bands; make Ascendant the only branch point; pilot two endpoints on Verdant Wing, Copper Snail, Slate Tortoise, and Biscuit Jackalope; show explicit care-path previews; allow later Rebond without pet/XP loss; and keep form wholly decoupled from function. The owner can later expand branching pet-by-pet based on attachment and art demand rather than committing now to two Ascendants for all 24.

## Validation

- Verified all ten cited repository/report paths exist.
- Counted **14 fully authored lines**: all 8 retained pets plus 6 pet-1 expansion pets, spanning cute, majestic, weird, spectral, bizarre, organic, and mechanical forms.
- Counted **8 authored branch endpoints** forming the bounded 4-pet / 2-endpoint pilot.
- Confirmed the single fenced contract block is balanced and no `TODO`, `TBD`, `FIXME`, or “in progress” marker remains.
- Confirmed `docs/design/pet-2-evolution.md` is the only file written by this track. No product code, asset, catalog, generated file, test, or live process was changed.
