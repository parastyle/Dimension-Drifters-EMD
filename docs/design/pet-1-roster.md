# Pet Roster & Form Variety — `pet-1-roster`

## 1am summary

Keep the eight shipped pets and add **16 deliberately different base pets for 24 total**, released through two art waves of eight: the additions range from a cuddly jackalope and ghost-coyote pup to a chapel-backed bison, lantern-abdomen grave beetle, living cowboy boot, moon ooze, iron mule, hovering funeral ray, and eyelid-ringed oracle. Sixteen is enough to give cute, regal, eldritch, creepy, mechanical, elemental, tiny, hulking, aquatic, insectoid, avian, botanical, spectral, amorphous, serpentine, and outright bizarre tastes their own unmistakable silhouette, but it stops before three evolution bands and fusion turn the art queue into an unbounded combinatorial project. Mechanics may overlap; the player's reason to choose is “that one feels like mine.”

## Mandate and working assumptions

This track defines the new base-pet roster that the evolution, fusion, art, and pipeline tracks will build upon. The goal is personal-taste identity through wide form variety: cute, regal, uncanny, mechanical, elemental, aquatic, insectoid, avian, botanical, spectral, hulking, tiny, and bizarre pets may overlap mechanically because silhouette and emotional attachment come first. The eight shipped pets remain untouched. I will recommend a decisive number of additions after verifying the current data model, while accounting for the multiplication of art work caused by three evolution bands and fusion. I assume this is design direction only; I will not modify product code, assets, catalogs, generated files, tests, or the live game.

## Verified facts (running record)

- `packages/shared/src/pets.ts` is the implemented source of truth and contains exactly eight IDs: `verdant-wing`, `hearth-newt`, `lodestar-moth`, `copper-snail`, `gilded-gecko`, `brass-crab`, `pale-firefly`, and `slate-tortoise`. These shipped identities stay.
- That same file defines ten Bond levels and three visual bands: Hatchling (levels 1–3), Awakened (4–7), and Ascendant (8–10). Each pet has a `budgetKey`, one per-level bonus, and one level-10 capstone. The eight existing bonus lanes cover ammo regeneration, healing received, XP reach, earned-pickup reach/bag capacity, sale economy, reload duration, revive reach/HP, and ground-hazard mitigation/pit regeneration. The mandate explicitly permits future pets to overlap these functions.
- `packages/shared/src/pets.ts` also defines stable normalized logical part slots (`core`, `primary`, `secondary`) and says later fusion/evolution manifests can replace parts without account migration. This makes modular mutation a native fit for pets: a new wing, crown, shell, tail, extra limb, or halo is readable as biological/magical growth rather than a failed clothing seam.
- `packages/client/public/sprites/pets/pet-parts-manifest.json` is the installed visual manifest and reports schema version 1 with 72 expected and 72 installed parts. It uses a normalized 1024×1024 socket frame with body-relative attachment sockets, which is concrete evidence that pet forms can share an attachment grammar even when their silhouettes differ.
- The manifest contains the same eight IDs, each with three stages and an exact 2/3/4-part ramp, or nine installed parts per pet. Therefore **8 implemented pets × 9 parts = 72 installed parts**; this is not a 24-pet implementation.
- The generated developer portal at `tools/portal/index.html` does show category label **“Pets 24,”** but its own description is “Every companion stage.” The current 24 is therefore **8 base identities × 3 stage forms**, not 24 implemented base pets. `docs/armory-ui-panel/mock.html` also presents “Pets 24” as portal census copy. Precision for this plan: **8 shipped base pets, 24 installed stage forms, and 72 installed loose parts**. The proposal intentionally makes the future base-pet count 24; at three bands that future portal would have 72 stage forms if it keeps counting cards rather than identities.
- The working branch is `feat/v0.118-metagame`. `docs/sol-reports/README.md` requires a report-of-record to be created first, updated continuously, and finished with validation; this report follows that regime at the user-specified `docs/design/pet-1-roster.md` destination.

## Decision: add 16 base pets, for 24 total

Add **16 new base pets** and keep all eight shipped pets, producing a clean **24-pet total roster**. Sixteen is the best production ceiling for the first expansion: it supplies one unmistakable anchor for every missing taste family, plus deliberate contrasts inside broad families, while preserving a browseable two-dozen collection. At the current shipped 2/3/4-part stage ramp, 16 additions imply as many as **144 new stage parts** before fusion-specific assets; including the shipped kit yields **216 baseline parts**. Every extra base pet also becomes three evolution-band designs and another fusion donor/receiver, so jumping to 20–24 additions would inflate the downstream combination space before the team learns which silhouettes and mutation sockets actually read well. Conversely, 8–12 additions cannot cover the requested cute-to-eldritch spectrum without double-casting pets into vague hybrids. Sixteen is broad enough to make choice expressive and bounded enough to ship in waves.

Recommended production release: author the 16 as one approved roster, but art them in **two waves of eight**, each wave deliberately spanning different families. Do not gate a pet's shape on a unique bonus. Reuse existing function lanes freely and let presentation, animation, sound, evolution, and fusion compatibility carry identity.

## The 16-pet expansion roster, grouped by form family

The family label names the pet's primary visual promise, not its mechanical class. Each base silhouette must remain recognizable as a small companion at top-down game scale and leave obvious places for pet-2 to make the Awakened and Ascendant forms dramatically diverge. “Distinctive feature” is the non-negotiable recognition hook for pet-4.

### Cute / adorable — soft mascot appeal

| ID | Name | What owning it says about you | Base-stage silhouette | Most distinctive feature |
|---|---|---|---|---|
| `biscuit-jackalope` | **Biscuit Jackalope** | “You chose comfort, mischief, and ears too big for the apocalypse.” | A fist-sized pear body on four nub feet, with a bead tail, huge V-shaped ears, and two tiny antlers; wider above than below. | The velvety ears are each pierced by one horseshoe-shaped antler tine, making a readable ear-and-antler crown even in silhouette. |

### Majestic / regal — poised, aspirational animal

| ID | Name | What owning it says about you | Base-stage silhouette | Most distinctive feature |
|---|---|---|---|---|
| `crowned-pronghorn` | **Crowned Pronghorn** | “You prefer grace that can still outrun the end of the world.” | A slim long-legged fawn with a lifted chest, small tapering muzzle, and tall lyre horns; the only base pet built around vertical poise. | Each horn forks at the tip into half a crown, forming a complete floating-crown read when viewed together. |

### Weird / eldritch — unknowable but companionable

| ID | Name | What owning it says about you | Base-stage silhouette | Most distinctive feature |
|---|---|---|---|---|
| `manymoon-oracle` | **Manymoon Oracle** | “You find companionship in things that should not know your name.” | A hovering upside-down bell mantle with three short feelers beneath and one pebble moon orbiting above; neither vertebrate nor earthly insect. | A ring of closed eyelids circles the mantle rim; only the eyelid facing danger opens. |

### Creepy / unsettling — polite miniature horror

| ID | Name | What owning it says about you | Base-stage silhouette | Most distinctive feature |
|---|---|---|---|---|
| `little-pallbearer` | **Little Pallbearer** | “You like your horror mannerly, quiet, and always at heel.” | A toy-sized coffin carried horizontally on six pale finger-legs, creating a hard rectangle over a skittering fringe. | The coffin-lid seam slowly blinks like one long eyelid; there is no visible face. |

### Mechanical / construct — repaired frontier machine

| ID | Name | What owning it says about you | Base-stage silhouette | Most distinctive feature |
|---|---|---|---|---|
| `rivet-mule` | **Rivet Mule** | “You trust stubborn machines with visible repairs.” | A boxy iron mule with a boiler chest, four spring legs, dish-shaped ears, and a short smokestack; all squares and pistons. | Its rear horseshoe is a spinning flywheel that winds the pet as it trots. |

### Elemental — living trouble in a small package

| ID | Name | What owning it says about you | Base-stage silhouette | Most distinctive feature |
|---|---|---|---|---|
| `brimstone-imp` | **Brimstone Imp** | “You are here for trouble, but the pocket-sized kind.” | A triangular coal-black body with long imp ears, two hoof nubs, and a licking flame tail; no wings at base stage. | Two sulfur-yellow flame horns repeatedly merge into one candle flame, then split when excited. |

### Tiny / chibi — scale comedy and oversized attitude

| ID | Name | What owning it says about you | Base-stage silhouette | Most distinctive feature |
|---|---|---|---|---|
| `thimble-deputy` | **Thimble Deputy** | “You believe confidence should be several sizes larger than its owner.” | A pea-sized dust sprite almost completely hidden under a broad cowboy hat, with only two round boots visible beneath. | The hat is five times the body's width and bears a star-shaped bullet hole that shines like a badge. |

### Hulking — protective mass and slow certainty

| ID | Name | What owning it says about you | Base-stage silhouette | Most distinctive feature |
|---|---|---|---|---|
| `chapelback-bison` | **Chapelback Bison** | “You want a companion that feels like shelter.” | A low, broad bison calf with pillar legs, a massive wedge head, and a hump shaped like a tiny chapel roof; the roster's heaviest footprint. | One warm stained-glass window glows from inside its chapel-shaped hump. |

### Aquatic — hovering water-form, not another shoreline crawler

| ID | Name | What owning it says about you | Base-stage silhouette | Most distinctive feature |
|---|---|---|---|---|
| `tollwater-ray` | **Tollwater Ray** | “You carry still water and deep horizons wherever you go.” | A hovering diamond-shaped ray with curled fin tips and a single long trailing tail; broad and flat where the bison is thick. | The tail ends in a tiny chapel bell that swings underwater-slow even on dry land. |

### Insectoid — diligent graveyard worker

| ID | Name | What owning it says about you | Base-stage silhouette | Most distinctive feature |
|---|---|---|---|---|
| `gravewick-beetle` | **Gravewick Beetle** | “You respect diligent little workers, especially the ones tending the dead.” | A low armored oval on six spade-tipped legs, with shovel mandibles in front and an enlarged abdomen behind. | Its abdomen is a warm glass grave lantern with a visible wick that gutters when danger is near. |

This deliberately uses a beetle rather than adding a second moth. The owner's gravedigger-lantern-moth image is preserved more strongly as a flagged evolution direction for the shipped Lodestar Moth below.

### Avian — weathered scavenger dignity

| ID | Name | What owning it says about you | Base-stage silhouette | Most distinctive feature |
|---|---|---|---|---|
| `ragwing-vulture` | **Ragwing Vulture** | “You see dignity in survivors and beauty in the weathered.” | A hunched comma-shaped chick with a long bare neck, heavy hooked beak, and folded blanket-like wings. | Its ragged wing feathers are layered scraps of faded wanted posters, readable as a torn-paper edge rather than ordinary plumage. |

### Plant / tumbleweed — rootless frontier life

| ID | Name | What owning it says about you | Base-stage silhouette | Most distinctive feature |
|---|---|---|---|---|
| `rambleroot-tumbleweed` | **Rambleroot** | “You go where the wind says and make home anyway.” | A near-perfect sphere of thorny root loops on four tiny boot feet, with no fixed front until it looks at something. | One cobalt flower travels around the rolling bramble so it always faces its owner. |

### Spectral — loyal ghost animal

| ID | Name | What owning it says about you | Base-stage silhouette | Most distinctive feature |
|---|---|---|---|---|
| `ghost-coyote-pup` | **Ghost Coyote Pup** | “You value loyalty that can cross any boundary.” | A lean, big-eared coyote puppy whose paws float just above the ground and whose hindquarters taper into a smoke tail. | Its translucent rib marks form a tiny moving constellation that points back toward its owner. |

### Outright bizarre — joke, omen, and icon in one shape

| ID | Name | What owning it says about you | Base-stage silhouette | Most distinctive feature |
|---|---|---|---|---|
| `hungry-boot` | **Hungry Boot** | “You refuse to choose between a bad joke and a bad omen.” | A single upright cowboy boot that hops on its heel; the curved toe opens as a blunt jaw, giving it a unique L-shaped read. | Its rowel spur is one swiveling eyeball, while the boot opening remains an apparently bottomless throat. |

### Amorphous / ooze — gentle shape without anatomy

| ID | Name | What owning it says about you | Base-stage silhouette | Most distinctive feature |
|---|---|---|---|---|
| `moonmilk-ooze` | **Moonmilk Ooze** | “You like soft, quiet things with no need to explain themselves.” | A low milk-white puddle with a domed center and three droplets orbiting close to its surface; it squashes instead of walking. | A single star-shaped inclusion drifts inside and becomes its face only when it turns toward the player. |

### Serpentine / draconic — elegant motion and long-form silhouette

| ID | Name | What owning it says about you | Base-stage silhouette | Most distinctive feature |
|---|---|---|---|---|
| `rattlesmoke-wyrm` | **Rattlesmoke Wyrm** | “You prefer companions too elegant to walk.” | A long S-curved ribbon serpent with a narrow dragon head, two tiny forearms, a smoke-frayed belly, and no legs. | Its rattle is a chain of miniature brass train couplings that clacks without touching the ground. |

## Silhouette checksum

The sixteen base reads are intentionally non-interchangeable: **ear-crown pear, tall lyre fawn, floating bell, walking rectangle, piston mule, horned flame triangle, giant hat, chapel-backed block, diamond ray, lantern oval, hunched comma bird, bramble sphere, smoke-tailed canine, upright boot, puddle dome, and long S-wyrm**. Color removal should not collapse any pair. Mood overlaps are welcome; outline overlap is not.

## The shipped eight stay; enrich their transformations

No shipped ID, ownership row, Bond XP, function, or familiar base identity should be retired. The current installed parts show a uniform and conservative progression: two parts at Hatchling, three at Awakened, four at Ascendant, with the final stage generally adding only one accessory. Pet-2 owns the actual trees, but the following candidates should be prioritized under the new, more transformative direction.

| Priority | Shipped pet | Current installed cadence | Direction to hand to pet-2, not a locked tree |
|---|---|---|---|
| **Highest** | **Lodestar Moth** | Folded wing → two open wings → astrolabe ring | Pay off the owner's **gravedigger-lantern-moth** image: let the body become a grave lantern, antennae become delicate shovel forms, and the Ascendant gain a broad undertaker-wing architecture. Keep “moth + lodestar” recognizable rather than creating a ninth base pet that duplicates it. |
| **Highest** | **Slate Tortoise** | Shell cap → cairn plate → core shutter | Pay off the **little coffin-turtle** image: the shell can lengthen into a coffin/reliquary silhouette, then open or shoulder spectral pallbearer structures. This is a natural shell-slot mutation with a strong cute-to-occult arc. |
| **Highest** | **Verdant Wing** | Folded wing → two open wings → antenna crest | Make “more wings” literal: a shy leaf-wing Hatchling can become a four- or six-wing botanical seraph whose body proportion changes with the wing fan. One added crest is not enough for its Ascendant promise. |
| **High** | **Hearth Newt** | Tail → belly lens → flame crest | Let the round hearth friend stretch into a kiln salamander or miniature stove-dragon, adding crown, dorsal heat vanes, and a visibly reconfigured furnace belly while retaining its welcoming ember center. |
| **High** | **Brass Crab** | Claw yoke → two claws → ticking halo | Push the construct reading: unfold into a walking reliquary or squat clockwork siege-crab with asymmetric tools, raised chassis, and a large mechanical crown. It should change architecture, not merely acquire a halo. |
| **Second pass** | **Pale Firefly** | Folded wing case → two wings → ribbon feeler | Consider an Ascendant that becomes a lantern choir or controlled mini-swarm around one persistent core. This supplies a plural/splitting evolution language no base pet currently owns. |
| **Second pass** | **Copper Snail** | Coin shell → pannier → compass rim | Let the shell unfold into a wagon, observatory, or tiny armored caravan so the silhouette gains height/length and moving panels; keep the patient pack-animal charm. |
| **Second pass** | **Gilded Gecko** | Curled tail → coin ribbon → balance pan | Let the tail become a long articulated balance-serpent or gilded ribbon dragon, changing the rear half of the silhouette while retaining the gecko's quick, acquisitive personality. |

These flags intentionally describe transformation territory rather than branch names, stage-by-stage recipes, or gameplay rewards. Pet-2 should decide those trees and may reject any motif that duplicates a stronger new-roster line.

## Why pet modularity should be exploited, not feared

The abandoned character wardrobe asked arbitrary human garments and body parts to meet at anatomy-sensitive seams; a sleeve, hand, torso, and head look broken when proportion or cut-line alignment drifts. Pets make the inverse promise. Their shipped manifest already anchors wings, tails, shells, crowns, dorsal plates, and ventral pieces to normalized body-relative sockets. On a stylized creature, an oversized donor wing, a second tail, an off-center halo, a shell plate, or even a floating attachment reads as **growth, magic, machinery, or mutation**. The plan therefore preserves stable identity in data while deliberately allowing authored asymmetry and optional parts in the image assembly. Registration still matters, but visual mismatch can be expressive when pet-3 validates a whole fusion recipe instead of claiming every arbitrary part combination will work.

## Cost and scope guardrails

The roster decision creates real but bounded work:

- **Baseline evolution art:** 16 pets × 3 stage bodies = **48 required body concepts/assets** before any loose appendages. If the current 2/3/4 part cadence were retained, the expansion would be **144 loose-part files including bodies**. That is a floor, not the desired dramatic result.
- **Transformative evolution art:** a representative 3/5/7 part cadence would be **240 files** for the 16 additions. Pet-2 and pet-4 should set per-form budgets rather than force every pet to that average; an ooze may need fewer parts, while a six-wing Ascendant needs more.
- **Fusion multiplication:** a 24-pet roster has **276 unordered parent pairs**. Relative to the existing eight-pet set's 28 pairs, this expansion creates **248 additional pairings** (128 new-to-shipped and 120 new-to-new). Bespoke art per pair is forbidden by scope; fusion must reuse registered parts and authored compatibility/recipe rules.
- **Concept and review load:** each new identity needs one approved base silhouette sheet, then three band compositions and gameplay-scale checks. Approve monochrome silhouettes before palette and part slicing; rejecting a same-y shape late is the most expensive possible correction.
- **Release shape:** Wave A is `biscuit-jackalope`, `manymoon-oracle`, `rivet-mule`, `brimstone-imp`, `chapelback-bison`, `tollwater-ray`, `rambleroot-tumbleweed`, and `ghost-coyote-pup`. Wave B is `crowned-pronghorn`, `little-pallbearer`, `thimble-deputy`, `gravewick-beetle`, `ragwing-vulture`, `hungry-boot`, `moonmilk-ooze`, and `rattlesmoke-wyrm`. Each wave spans warmth, horror, machinery/magic, and radically different geometry, so Wave A alone still feels like a genuine expansion.

Scope guardrails: no unique function is required to justify a form; no bespoke fusion render is commissioned; no extra base pet is added merely to house an appealing evolution that belongs on a shipped pet; and a new silhouette that collapses onto an existing or approved pet in monochrome returns to concept before production.

## Handoffs to the other four tracks

### Pet-2 — evolution divergence

Treat each row's base silhouette and distinctive feature as the inherited identity test across Hatchling, Awakened, and Ascendant; transformation may distort either, but should not erase both. Design three-stage compositions and any cosmetic branches within variable part budgets. The highest-priority retained lines are Lodestar Moth, Slate Tortoise, and Verdant Wing. Useful mutation openings in the new set include the Jackalope's ear/antler crown, Pronghorn's forked crown, Oracle's eye rim and moon, Pallbearer's lid and finger legs, Mule's flywheel, Imp's split flame horns, Deputy's hat, Bison's chapel hump, Ray's bell tail, Beetle's lantern abdomen, Vulture's paper wings, Rambleroot's traveling flower, Coyote's constellation ribs, Boot's eye spur, Ooze's internal star, and Wyrm's coupling rattle.

### Pet-3 — fusion as expression

Use these identities as donor families, not guaranteed arbitrary pairwise kits. Some recognition hooks are natural swappable parts: ears/horns, wings, crowns, tails, shell/hump structures, flowers, lantern abdomens, bells, halos, and orbiters. Others are **core-bound** because removing them destroys the creature: the Pallbearer's walking coffin, Hungry Boot's L-shaped body, Moonmilk Ooze's puddle anatomy, and Manymoon Oracle's bell mantle. Fusion should inherit those only when that parent supplies the core. Validate recipes at whole-creature scale and keep function selection independent of visual ancestry.

### Pet-4 — art and generation pipeline

Turn this roster into canonical silhouette briefs and reject color-first sameness. Preserve the current normalized ground/root registration and render sockets, but do not preserve the uniform 2/3/4 part count as an aesthetic law. Confirm each signature feature at actual 30 px Hatchling scale before completing later bands. Wave A is the calibration set: it intentionally stress-tests fur/ears, non-anatomical eyes, hard-surface construction, emissive flame, hulking mass, flat hovering anatomy, bramble transparency, and spectral translucency in one bounded batch.

### Pet-5 — systems and integration

Use the exact 16 kebab-case IDs in this report as the proposed catalog keys and treat **24 base pets as the target total, not current shipped truth**. Preserve the eight existing IDs and account rows. Mechanical assignments may duplicate any shipped `budgetKey`/bonus lane and should be decided for balance and clarity, never to rationalize a silhouette. Plan selection/collection UI for two dozen readable identities, stage/fusion recipe references, compatible-client handling for newly recognized IDs, manifest/portal census updates, and rollout by the two eight-pet waves. Fix the portal label at the same time: either show **24 identities / 72 forms** as separate counts or rename its card count to **Pet Forms 72**, so the present 8-vs-24 ambiguity cannot recur.

## Owner decisions and assumptions

No owner question blocks this roster. I am proceeding with three explicit assumptions: 24 total is a target collection size rather than a requirement to expose every pet simultaneously; evolution branches are cosmetic identity choices rather than mandatory new power packages; and fusion uses reusable registered parts/recipes rather than bespoke art for all 276 pairs. If later production data shows the 240-file illustrative evolution envelope is too large, cut branch or appendage count—not base-form families—so taste coverage survives.

## Validation

- Re-read the executable census: `packages/shared/src/pets.ts` contains 8 base IDs; the installed manifest contains 8 pets, 24 stage forms, and 72 expected/72 installed parts; `tools/portal/index.html` says “Pets 24” while explicitly describing companion **stages**. The report's shipped-versus-proposed counts match those facts.
- Verified exactly **16 unique new kebab-case IDs** appear once each as roster table rows, with all six required fields represented by the family heading plus ID, name, vibe, base silhouette, and distinctive-feature columns. None of the 16 IDs collides with product code, tools, catalogs, or assets. Their appearance in the concurrently written pet-2 report is expected handoff uptake, not a catalog collision.
- Confirmed the required summary, verified-facts, concrete grouped roster, shipped-eight flags, costs, four handoffs, owner-assumption, and validation sections are present. The report has no trailing whitespace.
- `git status --short` shows only the five panel reports as new files. This track wrote only `docs/design/pet-1-roster.md`; it did not edit product code, assets, catalogs, generated files, tests, or the other four reports, and it did not touch the live game or its ports.
