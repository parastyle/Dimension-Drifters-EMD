# Robotic Pet Art Gate

## Working understanding

This document will extend the existing pet art and layer-render pipeline with a binding robotic house style and a per-render review gate. Every pet must read as a deliberately built mechanical companion—not a grown creature or an undifferentiated rock, turd, blob, ooze, or shapeless mass. The final design will preserve the existing pipeline structure, add prompt-ready material, lighting, and silhouette rules, define an objective PASS/FAIL checklist requiring clearly visible mechanical evidence, and provide literal single-subject prompt examples.

## Binding constraints

- Owner decision: pets are robotic; organic-lump readings are rejected.
- Reuse the ONE-SUBJECT-PER-AGENT law; prompts and generation jobs must not batch subjects.
- Design documentation only. Do not modify product code, generated assets, or the live game on ports 5180/2567.
- The gate applies to every generated pet render, including revisions and variants.

## Initial assumptions

- This document is an additive design layer over the existing pet generation and compositing documents; it does not replace their established framing, file, or render requirements unless a robotic-style rule explicitly tightens them.
- “Robotic” is judged from visible evidence in the delivered render, not merely from prompt wording, lore, filenames, or reviewer intent.
- The required mechanical-feature count is a minimum gate, not a style target; features must remain legible at intended in-game display size.

## Relationship to the existing pipeline

This is a binding addendum to `pet-4-art-pipeline.md`, `pet-layer-pipeline.md`, and `pet-layer-render.md`. Their registration, modular slicing, six-role palette, `#00ff00` key field, full-canvas export, part/socket provenance, whole-assembly normalization, two-depth carrier pair, seam proof, fusion atomicity, and promotion rules remain in force.

Owner decision 7 overrides the earlier art-pipeline language that allows organic pets. In particular:

- Replace “cute, weird, majestic, organic, spectral, and mechanical forms all belong” with “cute, weird, majestic, spectral-mechanical, and mechanical forms all belong; every form has a visibly manufactured chassis.”
- Read “ordinary creature material,” “creature anatomy,” “body stock,” and similar generic phrases as mechanical chassis material, plated structure, cable, joint, lens, or intentionally fabricated soft component—not flesh, fur, bark, natural stone, mud, slime, or an unmodified animal body.
- A legacy animal, plant, ghost, stone, food, or ooze identity may keep its catalog name and personality, but its visual execution must be a robot, drone, automaton, construct, or contained machine. The source motif is inspiration for engineered geometry, never permission to render the organic source literally.
- Existing literal examples in `pet-4-art-pipeline.md` are not production-ready merely because they passed an earlier document. Velvet jackalope anatomy, a soft living bell, basalt baby-dragon anatomy, stone masses, and ooze forms must be rewritten with visible fabrication evidence before generation or promotion.
- Pet faces remain allowed, but their eyes and expressions are mechanical: optics, shutters, LED/display marks, apertures, grille mouths, hinged beaks, or mask plates. Wet eyeballs, gums, teeth rooted in flesh, skin, and realistic animal anatomy are out.

The gate is cumulative. A robotic render can still fail the existing style, alpha, registration, slice, depth-seam, evolution, gameplay-size, fusion, or promotion checks. Conversely, a mechanically valid file with perfect pivots still fails if the visible result reads as a rock, turd, blob, ooze, or shapeless organic mass.

## ONE-SUBJECT-PER-AGENT production law

The canonical image-generation subject key is:

`{petId}/{band}/{formKey}`

Each subject key gets a fresh image-generation agent/context. An agent may receive the shared robotic house-style block, jig, style board, and promoted images as read-only references, but it must not generate or edit art for any other pet ID, band/form, branch endpoint, VFX subject, character, or weapon. A branch endpoint is its own form and therefore its own subject/agent. Do not place two forms in one prompt, one conversation, one contact-sheet generation request, or one “make variants for these pets” request.

Linked `body.back`, `body.front`, and modular-part jobs for one form remain one subject family because they are coordinated slices of that single registered form. Tooling may execute them as isolated calls, but it must preserve the same subject key and may not use that agent for another form after completion. Cross-form coherence comes only from shared approved references plus the byte-identical house preamble—not from generating multiple subjects in one context.

Dispatch metadata must record `subjectKey`, a unique `agentRunId`, and reference hashes. The compiler rejects a job when an `agentRunId` is already associated with a different `subjectKey`. Review/contact-sheet assembly is deterministic and may compare subjects after generation; it does not authorize a multi-subject image-generation call.

## Robotic house-style preamble addendum

The compiler appends the following byte-identical block immediately after `DIMENSION DRIFTERS PET HOUSE STYLE V1` and before `PET IDENTITY`. If wording conflicts, this V2 robotic addendum wins.

```text
# DIMENSION DRIFTERS ROBOTIC PET ADDENDUM V2 — OWNER-BINDING

BUILT, NOT GROWN
- This pet is visibly manufactured: a robot, drone, automaton, mechanical construct, or contained machine. Its source animal/object/ghost/plant motif may shape the design, but the delivered pet must not be flesh, fur, bark, natural stone, mud, slime, food, ooze, or an unmodified living creature.
- Build the silhouette from intentional housings and attached mechanisms. Show a primary chassis plus at least one readable constructed interruption: articulated appendage, sensor mast, optic pod, rotor, wheel/tread, vent stack, exhaust, hinged plate, cable tail, or separate shell module.
- Break large round masses with real panel boundaries, overlaps, bevel steps, hardware, or negative space. A smooth potato, pebble, droplet, coil, loaf, mound, pellet, turd, or single amorphous blob is forbidden even when painted metallic.
- Cute comes from proportion, posture, optic expression, and behavior; never from making the body soft, fleshy, furry, swollen, or boneless. Majestic comes from engineered span and structure; weird comes from unusual mechanisms, not organic deformation.

VISIBLE MECHANICAL EVIDENCE
- The approved whole-form composite and every generated cutout must visibly support the robotic read. Show at least two DISTINCT categories from this list: (1) panel seams or overlapping armor plates, (2) optic/lens/aperture, (3) antenna or sensor, (4) jointed limb/hinge/servo/rotor mount, (5) exhaust/vent/radiator, (6) chrome or metal hard-specular highlight. Repeating one category does not count twice.
- At least one counted category must be structural, not a painted symbol. A highlight counts only when it describes a clearly metallic surface; a bright dot counts as an optic only when it has a bezel, shutter, glass housing, or sensor mount.
- Mechanical evidence must survive the final gameplay-size composite. Do not satisfy the rule with microscopic greebles, text labels, screws, circuitry, or color-only marks that vanish after normalization.

MATERIALS
- Represent fabricated materials within the job's exact six role swatches: brushed or blackened steel, chrome edge plates, aged brass/copper, painted enamel, anodized metal, ceramic armor, smoked lens glass, rubber tread, insulated cable, mesh grille, or composite shell.
- The illustration remains HD 2D matte paper-cutout/dark-comic art. Metal is communicated with one decisive hard specular band, edge chip, or bright planar break—not glossy 3D gradients, photoreal reflections, bloom, or airbrushed shine.
- Use paperLight for controlled metal/chrome glints and core/signature for restrained optics or status lamps. Do not invent extra hues or let emissive color replace chassis construction.

LIGHTING
- Preserve the approved reference's single light direction across body.back, body.front, and every modular part. Use one hard key-light plane, one decisive hard shadow band, and at most one narrow hard metal/specular highlight per material.
- Lens and core illumination stays contained inside a bezel with no painted bloom, cast light, haze, sparks, or floor reflection. Runtime VFX remains separate.
- Highlights must turn across plates and cylinders in a way that explains manufactured volume. Do not use wet shine, subsurface glow, mottled organic shading, or random stone speckle.

ROBOTIC MODULARITY AND DEPTH
- Treat every cut-line as a fabricated overlap: armor lip, bezel rim, collar plate, hinge shroud, chassis flange, or cable boot. Hidden stock is finished mechanical material. No flesh stump, torn hide, bone, root, hollow black socket, or green/alpha gap.
- The required atomic body.back/body.front pair must read as one engineered chassis. The back is fully plated beneath the entire authored travel envelope; the front owns the visible near rim and focal optic/mask/core bezel. Relative bob may reveal only finished underplate.
- Optional wings, tails, ears, horns, leaves, shells, fins, eyes, or feelers are recast as mechanical assemblies: vanes, cable whips, antenna arrays, armor crowns, radiator fins, sensor pods, articulated booms, or plated modules with clear mounts.

AUTOMATIC REJECTION READS
- Reject any result whose first read is rock, stone lump, turd, mud clod, blob, ooze, slime, droplet, shapeless mass, fleshy animal, furry animal, plant growth, food, or boneless mascot.
- Metallic paint on an organic silhouette does not make it robotic. A sphere or rounded drone passes only when its shell divisions, optics/sensors, mounts, vents, or articulated elements are unmistakable at gameplay size.
- Prompt intent, lore, file name, and metadata never rescue an ambiguous image. The pixels must say “built machine companion” before the reviewer reads the name.
```

### Canonical record additions

Every pet/form packet gains these mandatory fields before prompt compilation:

| Field | Requirement |
|---|---|
| `constructionThesis` | One sentence explaining what was built, how it locomotes/hovers, and which motif was mechanically recast. |
| `chassisMaterials` | Two or three fabricated material families mapped to the existing six palette roles. |
| `mechanicalCuePlan` | At least three planned cue categories, including where each remains visible in the normalized whole-form composite. |
| `builtSilhouetteRead` | Plain-language silhouette statement naming the main housing, its attached mechanism, and the negative-space/articulation break. |
| `forbiddenOrganicReads` | Identity-specific additions to the global rock/turd/blob/ooze/shapeless-mass ban. |
| `partCueOwnership` | For each generated cutout, at least two cue categories it visibly owns; cues may overlap across parts, but no part relies only on unseen assembled context. |
| `roboticGateVersion` | `PET_ROBOTIC_GATE_V1`, included in prompt and promotion provenance. |

These fields do not create gameplay data, account slots, or new render layers. They compile into prompt/review evidence alongside the existing identity, palette, jig, semantic slot, `depthLayer`, cut-line, extent, and provenance fields.

## Robotic review gate: PASS/FAIL, never averaged

Apply this gate to every raw candidate, keyed cutout, coordinated body-depth pair, assembled form, revision, evolution endpoint, and fusion sentinel composite. A candidate passes only when every applicable item is YES. A single forbidden organic-mass read is an immediate FAIL; strength in style, registration, or cuteness cannot compensate.

### A. Dispatch and prompt compile

- [ ] Exactly one `subjectKey = petId/band/formKey` is present, with a fresh `agentRunId` unused by any other subject.
- [ ] The prompt contains the byte-identical robotic V2 addendum, `PET_ROBOTIC_GATE_V1`, a construction thesis, chassis materials, built-silhouette read, planned cue locations, and identity-specific organic bans.
- [ ] The request asks for exactly one declared registered cutout/image. It does not ask for another pet, another form/stage/branch, a lineup, grid, montage, variations of multiple subjects, or unrelated VFX.
- [ ] References from other forms are approved read-only identity/style locks; the current agent has not generated or edited those reference subjects.

**FAIL examples:** reused agent context from a different pet form; two pet forms named in TASK; “make these three pets consistent”; old organic-permitted preamble without the override.

### B. Blind primary-read rejection

Review the pixels without displaying the pet name, lore, prompt, or metadata. Show the keyed composite at source scale for two seconds, then at actual target extent on a representative arena for two seconds.

- [ ] The reviewer's first category is `robot`, `drone`, `automaton`, `machine`, or `mechanical construct`.
- [ ] None of these is a plausible primary or co-primary read: rock, stone lump, turd, feces, mud clod, potato, blob, ooze, slime, droplet, mound, pellet, loaf, shapeless mass, fleshy creature, furry creature, plant growth, or food.
- [ ] The robot read comes from visible construction, not from the pet name, metallic color, a single pasted-on screw, or reviewer knowledge of intent.

**Automatic FAIL:** any reviewer or vision check marks the form `organic_lump`, `organic_creature`, or `ambiguous`. Ambiguity is not a soft pass; regenerate or route to explicit human adjudication, which still must answer all boxes YES.

### C. Minimum visible mechanical evidence

Count distinct visible categories, not individual marks:

- [ ] `panel`: a readable chassis seam, overlapping plate, access hatch, or armor break;
- [ ] `optic`: a lens, aperture, shutter-eye, sensor glass, or display face with a physical bezel;
- [ ] `sensor`: an antenna, receiver, probe, dish, whisker sensor, or mast with a visible mount;
- [ ] `joint`: a hinged/jointed limb, servo, axle, gimbal, rotor mount, wheel/tread mount, or articulated cable root;
- [ ] `vent`: an exhaust, grille, radiator, heat sink, intake, or vent stack built into the chassis;
- [ ] `metalHighlight`: a hard chrome/metal specular plane that clearly describes a fabricated surface.

Pass requirements:

- [ ] Every generated cutout visibly shows at least **two distinct categories** from the list above. Repeated seams or multiple lenses count as one category each.
- [ ] The assembled whole form visibly shows at least **two distinct categories** at actual gameplay size in both screen-right and mirrored-left views.
- [ ] At least one counted category is structural (`panel`, `optic`, `sensor`, `joint`, or `vent`); a metal highlight cannot carry the verdict by itself.
- [ ] Each counted cue remains recognizable after whole-form normalization. Microscopic rivets, circuitry, labels, and subpixel grooves do not count.
- [ ] Cue geometry is physically integrated: lenses have bezels, antennae have mounts, joints connect articulated members, vents interrupt a housing, and highlights follow a metal plane.

**Automatic FAIL:** fewer than two distinct categories; two supposed cues that are merely painted icons; “metalHighlight” on a smooth organic potato; an optic dot floating without housing; detail visible only above gameplay size.

### D. Built-not-grown silhouette

- [ ] The outer contour exposes at least one intentional manufactured interruption: mounted sensor/antenna, articulated appendage, rotor, tread/wheel, separate shell housing, exhaust stack, cable tail, fin array, or stepped plate overlap.
- [ ] The main mass has a comprehensible chassis hierarchy: primary housing plus attached or overlapping subsystem. A sphere/egg/rounded body has clear shell divisions and at least one mounted subsystem.
- [ ] Negative space or an articulation break separates important mechanisms where the form thesis allows; limbs/fins/wings do not melt continuously into a boneless body.
- [ ] Animal/plant/object motifs are translated into constructed equivalents. Ears become antenna vanes, feathers/leaves become metal flight vanes, horns become sensor booms or armor spars, a shell becomes a riveted housing, and a tail becomes segmented cable or articulated counterweight.
- [ ] Solid-black 64 px silhouette and actual-size silhouette do not become an undifferentiated pellet, droplet, mound, or stool-like coil. At least one manufactured contour cue survives without color.

**Automatic FAIL:** one smooth unbroken mass; sagging/boneless posture; natural stone chunk with painted eyes; chrome-coated animal anatomy; “ooze in a robot color”; shell/egg with no seam, mount, sensor, vent, or articulation.

### E. Material and lighting proof

- [ ] Dominant exposed surfaces read as fabricated metal, ceramic/composite plate, smoked lens glass, rubber, mesh, insulated cable, or painted enamel—not skin, fur, flesh, bark, mud, porous natural rock, or wet slime.
- [ ] Materials use only the existing six palette roles. Hard metal/chrome glints use the assigned `paperLight`; optic/core light stays restrained inside a bezel.
- [ ] One consistent approved light direction is shared across `body.back`, `body.front`, and optional parts. Plate planes receive one hard shadow band and at most one decisive hard specular highlight.
- [ ] There is no wet shine, subsurface scattering, organic mottling, stone speckle used as the primary material read, glossy 3D gradient, photoreal reflection, painted bloom, or emitted cast light.
- [ ] Distress supports fabrication: sparse edge chips, rubbed enamel, weld/fastener rhythm, or blackened exhaust. It does not resemble sores, veins, scales, pores, dung texture, rot, or biological wounds.

### F. Modular and two-depth construction proof

- [ ] Every part-specific cut-line ends in finished mechanical stock: plate collar, flange, hinge shroud, bezel rim, cable boot, or underplate. No flesh stump, bone, root, torn hide, raw goo, hollow socket, or generic green/black hole.
- [ ] The atomic `body.back`/`body.front` pair reads as one chassis at rest. Back underpaint is complete fabricated structure through all nine `x,y ∈ {-4,0,+4}` proof offsets; front owns the visible seam rim and focal mechanical feature.
- [ ] Motion exposes no alpha/chroma, doubled outline, sliding face, broken cable, disconnected joint, mismatched material, or hidden organic patch.
- [ ] Optional semantic parts preserve their robotic cue ownership when viewed alone and keep their mount legible on round, long, and shell/hulk fusion sentinels.
- [ ] A static aura/orbit card is visibly engineered—segmented ring, emitter rail, holographic projector frame, or mechanical satellite array—and still satisfies the two-cue rule. Free glow, smoke, sparks, and motes remain runtime VFX.

### G. Gameplay-size and companion proof

- [ ] At the authored target extent on light and dark arenas, in color and grayscale, the form reads as a small mechanical companion before it reads as an environmental prop or enemy.
- [ ] At least two counted cues survive rest, bob, turn, mirrored facing, downed tint, reduced motion, and the depth travel grid.
- [ ] The focal optic/display/grille expression feels companionable; it does not become a turret sight, enemy weak point, pickup glow, hazard marker, or targeting reticle.
- [ ] Cute, weird, or majestic personality is present without weakening the built chassis read.

### H. Promotion record

- [ ] The review ledger records the six cue booleans, distinct cue count at source and gameplay scale, blind primary-read label, forbidden-read flags, silhouette result, material result, depth-grid result, reviewer ID/check version, and winner hash.
- [ ] Automated and human proof boards were rebuilt from the promoted cutout hashes, never from a separate “pretty” render.
- [ ] No critical rejection is waived. A failed attempt remains immutable with a precise note such as `organic_lump: smooth single mass; only metalHighlight counted; add panelized chassis plus mounted optic/limb`.
- [ ] Promotion proceeds only after this gate and all pre-existing pet-4 and layer-pipeline gates pass.

## Automated-review contract

Automation may reject freely but may not infer compliance from prompt text. Build its proof input deterministically from one subject's candidate pixels:

1. Source-scale keyed cutout(s), solo `body.back`, solo `body.front`, and assembled rest composite.
2. Actual target-size composite on approved dark and light arena crops, both facings.
3. 64 px black silhouette and grayscale composite.
4. Existing nine-offset depth/seam grid and any fusion sentinel composites.

The vision review returns this schema:

```json
{
  "primaryRead": "robotic|organic_lump|organic_creature|ambiguous",
  "visibleMechanicalCues": {
    "panel": true,
    "optic": true,
    "sensor": false,
    "joint": false,
    "vent": false,
    "metalHighlight": true
  },
  "distinctCueCountAtSource": 3,
  "distinctCueCountAtGameplaySize": 2,
  "hasStructuralCueAtGameplaySize": true,
  "forbiddenReads": [],
  "builtSilhouettePass": true,
  "fabricatedMaterialPass": true,
  "depthGridPass": true,
  "verdict": "PASS|FAIL|HUMAN_REVIEW"
}
```

An automated PASS is valid only when `primaryRead=robotic`, both cue counts are at least 2, a structural cue survives gameplay size, every forbidden flag is false, and silhouette/material/depth proofs pass. Missing output, disagreement between views, low/ambiguous classification, or a forbidden read returns FAIL or HUMAN_REVIEW—never PASS. The existing human promotion review remains authoritative and must use the same checklist; it cannot pass a candidate while leaving a required field unknown.

Deterministic alpha/geometry heuristics may flag excessive convexity, lack of negative space, or a single dominant component for review, but they cannot certify “robotic” on their own. A sphere drone, for example, can be valid when its optics, shell seams, vents, and mounts are visually clear. Semantic pixel review is mandatory.

## Three literal single-subject robotic pet prompts

Each block below is an independent job appended after the existing V1 house preamble and the byte-identical V2 robotic addendum. There are no placeholders inside these example job blocks. Never concatenate them or dispatch more than one to the same image-generation agent.

### Example 1 — Biscuit Jackalope / Biscuit Button / `body.front`

```text
# PET JOB — biscuit-jackalope / stage 1 Hatchling / body.front
# SUBJECT KEY — biscuit-jackalope/1/biscuit-button
# ROBOTIC GATE — PET_ROBOTIC_GATE_V1

DISPATCH LAW
- This agent generates only subject biscuit-jackalope/1/biscuit-button. Do not generate or edit any other pet, stage, branch, character, weapon, or VFX subject.
- Return exactly one registered cutout image: body.front. Do not return variants, a lineup, a contact sheet, or the assembled pet.

REFERENCES
- PET_BASE_JIG_V2 supplies registration only.
- PET_BESTIARY_STYLE_BOARD_V1 supplies 2D contour/cel treatment only.
- The approved biscuit-button body.back supplies exact silhouette, palette, light direction, and overlap registration. Do not redraw body.back.

IDENTITY AND CONSTRUCTION
- Display name: Biscuit Jackalope; form: Biscuit Button.
- Construction thesis: a tiny comfort-companion jackalope automaton built as a biscuit-tan enamel oval chassis, hopping on separate spring-servo feet and listening through separate horseshoe antenna-ear vanes.
- Chassis materials: worn biscuit-tan enamel over dark steel; smoked blue lens glass; narrow paperLight chrome edges.
- Exact palette roles: ink #111318, structureDark #5A4035, structureMid #B8835F, paperLight #E2CFB2, signature #A8482E, core #9FD8E8.
- Built silhouette read: the assembled pet is a compact oval housing interrupted by a mounted V antenna crown, four separate spring feet, and a segmented bead-cable tail; never a furry rabbit body.
- Forbidden reads: organic bunny, velvet/fur, food biscuit, potato, pellet, turd, plush blob, flesh, natural antler, mascot toy.

THIS CUTOUT — FRONT ONLY
- Render the near/front faceplate and chest shell only, registered on the exact 1024x1024 canvas to body root (512,510), +X/screen-right, axis L=256, virtual baseline y=638.
- Shape one shallow biscuit-tan enamel faceplate with a visible horizontal access-panel seam and two small smoked-blue shutter optics in dark physical bezels. Add one narrow paperLight hard metal highlight following the upper-right plate edge and three short structureDark speaker-grille slots below the optics.
- The faceplate overlaps approved body.back by 0.18L at rest and remains over finished back plating through the full normalized ±4px X/Y travel grid. Its hidden rear edge is a broad opaque flange, not a neck, flesh edge, socket hole, or green gap.
- Mechanical cue ownership: panel seam, two bezel optics, grille vent, and metal hard-specular highlight. At least panel plus optics must survive the 29px assembled gameplay composite.
- Do not render antenna ears, antler vanes, feet, tail, fur, mouth, teeth, food crumbs, glow, sparks, floor shadow, guide marks, text, or any other pet part.

OUTPUT
Generate exactly one 1024x1024 PNG on uniform opaque #00ff00 with at least 64px green clearance. Use the exact six swatches, heavy imperfect near-black contour, sparse interior ink, flat cel bands, one hard shadow, and no gradients or bloom. Before returning, verify that the cutout alone visibly contains at least two distinct mechanical cue categories and cannot plausibly read as an organic lump.
```

### Example 2 — Moonmilk Ooze / Ampoule Rover / `body.back`

```text
# PET JOB — moonmilk-ooze / stage 1 Hatchling / body.back
# SUBJECT KEY — moonmilk-ooze/1/ampoule-rover
# ROBOTIC GATE — PET_ROBOTIC_GATE_V1

DISPATCH LAW
- This agent generates only subject moonmilk-ooze/1/ampoule-rover. Do not generate or edit any other subject.
- Return exactly one registered cutout image: body.back. No variants, multi-stage lineup, montage, or assembled pet.

REFERENCES
- PET_BASE_JIG_V2 supplies root, baseline, axis, and facing only.
- PET_BESTIARY_STYLE_BOARD_V1 supplies the house contour and flat cel treatment only.
- No identity master exists; this establishes the approved back chassis for the same subject's later linked body.front edit.

IDENTITY AND CONSTRUCTION
- Display name: Moonmilk Ooze; Hatchling form: Ampoule Rover.
- Construction thesis: the old ooze idea is fully recast as a sealed lunar-fluid sampling rover—a squat ceramic-and-steel containment chassis carrying a closed glass ampoule, never a free blob of liquid.
- Chassis materials: charcoal ceramic armor, blackened steel underframe, smoked containment glass, pale nickel hard highlights.
- Exact palette roles: ink #111318, structureDark #242833, structureMid #747E8C, paperLight #D8D4C5, signature #8D63C7, core #A9E7F0.
- Built silhouette read: a low hexagonal crawler housing with two visible articulated side bogies, a rear radiator stack, and a top ampoule cradle; the housing has stepped corners and clear negative space under the bogies.
- Forbidden reads: free ooze, slime, droplet, puddle, turd, mud clod, moon rock, stone egg, jelly creature, wet organic shine, soft boneless mascot.

THIS CUTOUT — BACK ONLY
- Render the complete far/back chassis and underframe only, registered at body root (512,510), +X/screen-right, L=256, grounded on virtual baseline y=638.
- Build one connected stepped hexagonal structureDark/structureMid housing with a broad closed upper underplate for the future front containment bezel. Include two visible rear/far articulated bogie mounts with circular axle housings, one rear radiator grille, two readable access-panel seams, and a narrow paperLight nickel highlight on the high planes.
- Fully plate every area that body.front can reveal during the normalized ±4px X/Y travel grid. The overlap stock must remain at least 0.10L at every extreme. Do not draw a black cavity, transparent notch, matching duplicate rim, or unfinished erase edge.
- Mechanical cue ownership: panel seams, joint/axle mounts, radiator vent, and metal hard-specular highlight. These cues must read without the future front layer.
- Do not render exposed liquid, droplet silhouette, front optic/bezel, antenna, near bogie, aura, glow, bubbles, smoke, sparks, floor shadow, environment, guide marks, or another creature.

OUTPUT
Generate exactly one 1024x1024 PNG on uniform opaque #00ff00 with at least 64px green clearance. Use only the exact six swatches, heavy imperfect contour, flat cel shading, one consistent hard key light, and no gradient, wet shine, bloom, or photoreal glass. Before returning, verify at least two distinct mechanical cue categories and an unmistakably built crawler silhouette; any rock/blob/ooze reading is a failed result.
```

### Example 3 — Copper Snail / Relay Caravel / `body.front`

```text
# PET JOB — copper-snail / stage 3 Ascendant / body.front
# SUBJECT KEY — copper-snail/3/relay-caravel
# ROBOTIC GATE — PET_ROBOTIC_GATE_V1

DISPATCH LAW
- This agent generates only subject copper-snail/3/relay-caravel. Do not generate or edit any other pet form or subject.
- Return exactly one registered cutout image: body.front. No second take, variants, lineup, contact sheet, or complete flattened pet.

REFERENCES
- PET_BASE_JIG_V2 supplies geometry and registration only.
- PET_BESTIARY_STYLE_BOARD_V1 supplies rendering treatment only.
- The promoted Relay Caravel body.back is the immutable chassis, palette, lighting, root, and overlap reference. Preserve its registration exactly and do not repaint it.
- The promoted earlier Copper Snail forms are lineage references for the copper spiral-shell motif only; do not copy organic snail anatomy.

IDENTITY AND CONSTRUCTION
- Display name: Copper Snail; Ascendant form: Relay Caravel.
- Construction thesis: a patient copper courier automaton whose spiral shell is a riveted radio housing carried by a low articulated crawler chassis with a friendly twin-optic sensor prow.
- Chassis materials: oxidized copper plate, dark steel servo frame, smoked teal optics, restrained brass/chrome edge highlights.
- Exact palette roles: ink #111318, structureDark #263038, structureMid #A4613C, paperLight #D6B77A, signature #3E8D84, core #8FE7DD.
- Built silhouette read: broad riveted spiral housing behind, low segmented crawler prow in front, two mounted sensor stalks above, exhaust vane behind, and visible articulation/negative space between chassis modules.
- Forbidden reads: organic snail, soft slug, turd coil, rock shell, flesh eyestalks, slime trail, wet skin, mollusk realism, tank turret, enemy vehicle.

THIS CUTOUT — FRONT ONLY
- Render the near/front crawler prow and sensor face only on the exact 1024x1024 registered canvas at root (512,510), +X/screen-right, L=256, virtual baseline y=638.
- Shape a low overlapping copper prow made from three stepped armor plates over a dark steel servo neck shroud. Mount exactly two short jointed sensor stalks, each ending in one smoked-teal optic with a dark bezel. Add one small side exhaust grille, two readable plate seams, exposed hinge circles at the prow articulation, and one narrow paperLight hard specular edge.
- The broad rear flange overlaps the approved body.back underplate by 0.18L at rest and never falls below 0.10L through the full normalized ±4px X/Y travel grid. The visible rim belongs only to this front cutout. No contour, rivet row, cable, or highlight may require pixel-perfect continuation across the moving seam.
- Mechanical cue ownership: panel seams, bezel optics, joint/hinge, exhaust vent, and metal hard-specular highlight. At least two remain unambiguous in the 54px Ascendant composite.
- Do not render the spiral shell housing, far chassis, slime, organic foot, flesh, mouth, natural eyestalks, aura, antenna sparks, radio waves, floor shadow, guide marks, or any unrelated part.

OUTPUT
Generate exactly one 1024x1024 PNG on uniform opaque #00ff00 with at least 64px green clearance. Use only the six exact swatches, heavy imperfect contour, sparse interior ink, flat cel shading, and the approved single light direction. No gradients, glossy 3D, bloom, emitted light, or wet material. Before returning, verify the cutout is a manufactured sensor prow with at least two distinct visible mechanical cue categories and no plausible slug, rock, coil, turd, or blob reading.
```

## Placement in the existing generation/promotion sequence

The extended pet pipeline is:

1. Compile the canonical pet/form packet, including the robotic fields and existing identity, palette, geometry, semantic-slot, depth, seam, evolution, and fusion data.
2. Enforce the one-subject dispatch key before an image call. Shared approved references are attached; another form is never generated in that context.
3. Generate exactly one registered cutout. Before keying, run blind primary-read, mechanical-cue, silhouette, material, and forbidden-read checks on the raw source.
4. Key/despill/register with the existing deterministic path. Re-run the same semantic gate on the keyed cutout; processing can expose a blob contour or erase a thin antenna/joint that appeared adequate in the raw.
5. Assemble the promoted candidate parts into the deterministic back/front/rest/travel proof surfaces. Run the whole-form robotic gate at source and actual gameplay sizes, both facings, alongside the existing seam, alpha, extent, evolution, and fusion sentinel checks.
6. Record automated structured output, then perform the existing human taste/promotion review using the same non-waivable boxes.
7. Promote the named hashes atomically only after all gates are green. Emit/install/check manifests as already designed.

Robotic failures route to art revision, not post-process disguise:

- `organic_lump` or shapeless silhouette → regenerate the chassis hierarchy and contour; do not add a metallic texture, painted screw, floating antenna, or glow to the rejected mass.
- Fewer than two cues → redesign the cutout with integrated hardware that survives normalization. If a cutout is too small to own two cues, combine it into an authored connected/yoke card or redesign the part; there is no small-part waiver.
- Organic material read → replace the depicted material and its shading with fabricated plate/glass/rubber/cable treatment while preserving the exact six-role palette.
- Cue disappears at gameplay size → enlarge/simplify the cue or alter the normalized silhouette; source-scale detail does not pass.
- Depth seam reveals organic/unfinished stock → repaint coordinated mechanical underplate/collar and rebuild all proof views; runtime clamping or bloom may not hide it.

## Final assumptions and non-goals

- Catalog IDs and personality concepts may remain even when their nouns are organic. “Moonmilk Ooze” can stay a name, but its pixels become a sealed machine; this report does not rename roster entries.
- “Robotic” includes friendly drones, clockwork automatons, ceramic constructs, strange sensor devices, and majestic machines. It does not require one industrial faction, militarized styling, humanoid anatomy, or photoreal hard-surface rendering.
- Fabricated flexible elements such as rubber bellows, insulated cables, brush seals, or synthetic fabric can appear when mounted to a chassis. They cannot dominate the silhouette or imitate flesh/fur.
- A spectral identity remains valid only when a visible manufactured chassis/projector/containment rig carries it. Free ghost, fog, or amorphous glow is VFX, not the pet body.
- Controlled hard highlights reconcile the chrome/metal requirement with the existing matte paper-cutout house rendering. This addendum changes the represented material, not the established 2D medium.
- The per-cutout two-cue rule is intentionally stricter than a whole-form-only rule. It prevents fusion, evolution, or layer separation from exposing a part that suddenly reads organic or generic.
- This design does not generate art, approve palettes, alter the roster, change gameplay mechanics, add account data, or modify the runtime. It defines prompt compilation, production isolation, semantic QA, and promotion policy only.

## Validation

- First write created this report with the mandate, binding constraints, and initial assumptions before the evidence pass.
- Re-read owner decision item 7 and the standing one-image-generation-subject-per-agent law in `OWNER-DECISIONS-characters-pets.md`.
- Re-read `pet-4-art-pipeline.md`, including the literal V1 preamble, canonical packet/template, one-part output law, modular slice contract, examples, eight-section review gate, and promotion sequence. This addendum explicitly supersedes its organic allowances while preserving its registration and production machinery.
- Re-read `pet-layer-pipeline.md` and `pet-layer-render.md`. The robotic gate covers the atomic `body.back`/`body.front` carrier pair, per-part `depthLayer`, finished underpaint, `±4 px` nine-offset proof, gameplay normalization, evolution/fusion atomicity, and v1 fallback without changing their render model.
- Structural audit: 370 lines, ten balanced Markdown fence markers, zero replacement characters, zero trailing-whitespace lines, three independent filled literal example jobs, and all required gate categories present.
- Direct whitespace/content checks reported no errors. Scope status reported this report as a single new untracked design file; no product code, asset, manifest, generated output, sibling report, test, or service was touched.
- No image generator, product command, server/client command, or request to ports 5180/2567 was run.
