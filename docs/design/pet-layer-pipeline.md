# Pet Layer Pipeline — Art Production and Integration Design

**Sol:** `pet-layer-pipeline`
**Status:** Complete
**Scope:** Design only. This report defines how two-layer pet art is produced and slotted into the existing pet part, evolution, and fusion systems. Rendering and depth animation behavior belong to the sibling `pet-layer-render` Sol.

## Understanding

The owner wants pets to gain the same dimensional bobbing feel as characters by composing two images at different depths. This is an extension of the existing pet art pipeline and part-slot model, not a replacement for either. The design must preserve the manifest-driven promise that art parts can be replaced without account migration, work across Hatchling, Awakened, and Ascendant bands, and remain compatible with evolution and fusion recombination.

This report will establish:

- the smallest compatible depth-layer data model;
- additions to the existing generation, slicing, and review workflow;
- evolution and fusion behavior under that model;
- manifest/census consequences and the future implementation touch-list;
- explicit handoffs to and from `pet-layer-render`.

## Initial assumptions

- A "layer" is a render-depth classification applied to existing composable pet parts, not a new player-owned item or progression dimension.
- Existing stable slot/part identifiers remain the source of cosmetic identity; depth metadata must not require stored-account migration.
- The two exported depth composites may each contain several existing semantic slots. Fusion should continue choosing semantic parts according to its existing rules, then group the chosen parts by depth for rendering.
- Character bobbing-head behavior is precedent for the visual result, but pet production should not copy an implementation detail until the sibling render design defines the runtime contract.
- No product code, assets, tests, generated manifests, or live processes will be changed during this task.

## Work plan

1. Verify the authoritative pet types, manifests, stage bands, and current part slots.
2. Reconcile the delivered generation/slicing, evolution, and fusion designs.
3. Inspect the character bobbing-head precedent and identify the minimum production-facing contract.
4. Specify the depth-layer model, art generation/export additions, review gates, evolution/fusion rules, and compatibility behavior.
5. Record exact future implementation files, census/manifest effects, rollout checks, and render-team handoffs.

---

## Recommendation in one minute

Do **not** create `back` and `front` as new pet-part or fusion slots. Depth and anatomy answer different questions:

- `core / primary / secondary` are the stable coarse compatibility groups in shared code.
- `PET_FORM_SLOTS_V1` (`body`, `face`, `core`, `side`, `rear`, `shell`, and so on) are the semantic evolution/fusion groups.
- `back | front` is a presentation role on each physical render part. It says which of exactly two depth surfaces receives that part; it does not say what the part is or who donated it.

The required `body` source is still one semantic/fusion choice, but its physical art becomes an atomic **depth-carrier pair**: at least one `back` cutout and at least one overlapping `front` cutout. Optional semantic groups may contribute additional cutouts to either surface. The renderer receives two non-empty surfaces for every authored form and every legal fusion, while accounts continue to refer only to stable pet/form/semantic-group identities.

This is the smallest robust model because it adds no player-facing slot, no mechanical pet field, and no account migration. It also avoids a fragile rule such as “negative `plane` means back”: the current numeric planes express ordering, not animation ownership, and a semantic group such as a wing pair may legitimately contain one far/back and one near/front member.

## Verified repository baseline

### Catalog, bands, and account-stable slots

`packages/shared/src/pets.ts` is the shipped catalog of record:

- Eight pet IDs ship today: Verdant Wing, Hearth Newt, Lodestar Moth, Copper Snail, Gilded Gecko, Brass Crab, Pale Firefly, and Slate Tortoise.
- `PetStageBand` is `1 | 2 | 3`: **Hatchling** levels 1–3, **Awakened** levels 4–7, and **Ascendant** levels 8–10.
- `PET_PART_SLOTS` is exactly `core | primary | secondary`. Its source comment explicitly promises that stable normalized slots allow evolution/fusion manifests to replace parts without migrating accounts.
- Pet mechanics resolve from canonical pet ID plus level. Depth layering is therefore appearance data and must not enter `PetMods`, `budgetKey`, Bond XP, or capstone resolution.

The two-layer treatment honors the replacement promise by keeping texture paths, physical part IDs, depth roles, seam geometry, and motion offsets in versioned catalog/manifest data. Existing account rows do not gain a `backPart` or `frontPart` field.

### Current art manifest and renderer

`packages/client/public/sprites/pets/pet-parts-manifest.json` and the artkit output copy both report schema 1 / `PET_SOCKET_FRAME_V1`, **72 expected and 72 installed parts**, no missing/extras/invalid rows, eight pets, and 24 stage forms. The installed cadence is uniformly 2 / 3 / 4 physical cutouts for Hatchling / Awakened / Ascendant.

Every current physical part already has a semantic `slot`, parent/socket registration, full-canvas pivot, numeric `plane`, optional spring, alpha bounds, and image metadata. The existing root sockets are `side.far`, `side.near`, `side.paired`, `rear`, `crown`, `shell`, `dorsal`, and `ventral`; `tailTip` is a child socket. Planes currently range from -20 through +30. `packages/client/src/sprites/pet-parts.ts` sorts assembled parts by that plane, and `PetRig.ts` creates one image per physical part in a common root container.

That is useful groundwork but not yet the requested contract:

- A numeric plane does not state which one of two surfaces moves.
- The body is one bitmap in every current form, so it does not provide the guaranteed overlapping depth-carrier pair needed after optional fusion groups are emptied.
- The schema does not describe a two-layer pivot/rest offset/motion profile or validate that both surfaces are non-empty.
- Texture resolution still assumes every part belongs to the selected canonical pet; pet-3 already identifies donor-aware resolution as required for fusion.

### Reconciliation with the delivered pet panel

`pet-2-evolution.md` correctly separates the account/logical layer from the form/render layer. It keeps account ownership at pet ID plus Bond XP, resolves a `(petId, band, formKey)` recipe from data, and defines `PET_FORM_SLOTS_V1`. Its exact compatibility mapping remains binding:

- shared `core` → `body + face + core`;
- shared `primary` → `side + side.secondary + side.tertiary + shell`;
- shared `secondary` → `rear + crown + dorsal + ventral + rider + orbit.* + aura.*`.

`pet-3-fusion.md` then makes those semantic groups the saved recombination atoms. Side pairs swap atomically; `rear` brings dependent `tailTip` children; every slot is `free` or `withBody`; provenance is flattened to stable donor/form/slot references; selection is same-band; and no account stores a PNG path. The depth-carrier pair nests inside the required body group and therefore preserves all of those rules.

`pet-4-art-pipeline.md` freezes the generation fundamentals that remain in force: canonical form packets, one isolated render job at a time, 1024×1024 registered source canvases, body root `(512,510)`, axis `L=256`, opaque green-to-alpha processing, full-canvas installed textures, fixed pivots/receivers, hidden attachment collars, whole-assembly normalization, immutable attempts, and promotion only after mechanical plus visual review. The depth pass extends that pipeline; it does not replace its semantic slicing or provenance.

## Depth-layer data model

### Three orthogonal identities

Each installed cutout needs three independent labels:

| Concern | Example | Stable/saved? | Purpose |
|---|---|---:|---|
| Coarse compatibility | `primary` | Indirectly stable | Preserves the shipped three-slot evolution/fusion compatibility promise. |
| Semantic form group | `side` | Yes, by donor/form/slot reference | The atom a player selects in evolution/fusion. |
| Depth role | `back` or `front` | No; resolved from current manifest | Routes that physical cutout into one of the two render surfaces. |

Depth must be attached to the **physical manifest part**, not hard-coded on a semantic slot. A `side` group can contain a far wing tagged `back` and a near wing tagged `front`, yet the pair remains one atomic fusion choice. Conversely, `crown` may be front on one anatomy and back on another. `plane` remains as a deterministic order within a depth surface and as migration/debug information; it is not used to infer the role.

### Conceptual manifest shape

The next manifest revision should express the following information. Names are normative design intent; implementation may choose equivalent TypeScript spelling.

```ts
type PetDepthLayer = "back" | "front";

interface PetDepthRigV1 {
  version: 1;
  motionProfile: "pet-bob-v1";       // tuning owned by pet-layer-render
  frontPivotL: { x: number; y: number };
  frontRestOffsetL: { x: number; y: number };
  authoredTravelL: { x: number; y: number }; // production QA envelope, not account state
}

interface PetPhysicalPartV2 {
  id: string;                         // replaceable manifest identity
  semanticSlot: PetFormSlotV1;
  atomicGroupId: string;              // side pair / rear subtree / required body group
  fusionPolicy: "free" | "withBody";
  depthLayer: PetDepthLayer;
  plane: number;                      // ordering inside the selected depth surface
  // existing donor, parent, socket, pivot, scale, spring, texture, and bounds fields continue
}

interface PetFormRecipeV2 {
  petId: PetId;
  band: PetStageBand;
  formKey: string;
  depthRig: PetDepthRigV1;
  parts: PetPhysicalPartV2[];
}
```

The stage/form record must satisfy these invariants:

1. Every physical part has exactly one depth role.
2. Both roles are non-empty.
3. The required body semantic group contains at least one back and one front part, and all of its pieces share one `atomicGroupId` with `withBody` behavior. The player still sees one body choice.
4. Every other semantic group is selected atomically according to pet-3, even if its physical children span both depth roles.
5. `frontPivotL`, rest offset, and authored travel are body-axis-normalized so changing the 30/37/44 envelope or using a larger authored form does not invalidate registration.
6. The resolved recipe, not the account, supplies all depth metadata. Replacing art or retuning the depth rig is a manifest/catalog patch.

`frontRestOffsetL` describes registration at rest; it is normally `{0,0}` for two cutouts authored on the same full canvas. Non-zero values are allowed for a deliberate floating cap, mask, shell, or satellite field, but they must be visible in the approved composite and included in bounds. `authoredTravelL` records the maximum X/Y displacement the seam was built and reviewed to survive. `pet-layer-render` owns how live acceleration/bob signals move within that envelope and how reduced motion collapses them.

### Why the body owns the guaranteed pair

Relying on an optional shell, wing, crown, or face overlay to provide the front surface fails as soon as fusion selects `Empty`. Making the required body group the carrier guarantees that every legal recipe still has two layers. It also prevents the unsafe interpretation “take the whole back image from parent A and the whole front image from parent B.” A body donor contributes its registered back/front body pair together; other donors contribute their selected semantic groups.

The pair does not require a humanoid head. Depending on the pet, the moving front carrier can be a muzzle/face-mask, shell brow, chest lantern, near cheek, crown-root mass, or leading carapace plate. It should own a recognizable focal feature so the relative motion reads, while remaining broad enough to hide the seam at gameplay scale.

## Additions to the pet-4 art pipeline

### New fields in every canonical form packet

Pet-4's existing identity, evolution, slot, socket, palette, envelope, and fusion fields remain required. Add a **depth split block** before generation:

```text
depth focus: the front-carrier feature whose lag/bob should read at gameplay scale
body depth pair: exact body.back and body.front inventory; one atomic withBody group
depth assignment: back|front for every remaining physical cutout
cut-line: a low-detail interior path that never depends on edge-to-edge registration
seam ownership: which front shape owns the visible rim/outline and which back shape supplies underpaint
rest overlap: measured in L; target 0.18L unless anatomy justifies more
minimum overlap: measured at every authoredTravelL extreme; never below 0.10L or the formula below
front pivot/rest offset: normalized body-axis coordinates
forbidden split reads: doubled outline, exposed green/alpha, hollow socket, sliding facial feature, broken lineage anchor
```

The exact overlap floor is:

`required underlap >= maximum relative travel + registration tolerance + visible safety margin`.

The existing `PET_SOCKET_FRAME_V1` connector tolerance is 4 source pixels / 2 degrees and its ordinary attachment collars are 10–12% of `L`. A moving depth seam needs more stock than an ordinary static graft. Use **0.18L rest overlap** as the default inherited from the character bobbing-head solution, and reject any form that falls below **0.10L at a reviewed motion extreme**. If the renderer's final travel envelope, rotation, or a narrow anatomy needs more, the formula wins and the art grows its underlap; runtime amplitude is never increased beyond approved art clearance.

### Coordinated generation sequence

The body depth pair must look like one drawing. Do not prompt two fresh images independently and hope their costume words match.

1. **Freeze the form and seam map.** Approve pet-2's black silhouette, pet-4's whole-form identity reference, exact semantic inventory, body root/baseline, depth focus, and cut-line. The seam should sit inside a broad, low-detail mass—not through an eye, rune, thin limb, high-contrast marking, exterior contour, or lineage anchor.
2. **Back-layer render/edit.** From that locked identity reference, create the registered `body.back` image. It owns the root, base silhouette, and a fully painted closed continuation beneath the entire front travel envelope. Remove front-owned art; reconstruct what motion can reveal with ordinary material/color, not a green hole, dark socket, connector peg, or duplicate exterior outline.
3. **Front-layer render/edit.** Using the same locked reference plus the accepted back image, create `body.front` at the same 1024×1024 registration. It owns the readable front focus and a broad opaque lower/inner collar. Nothing may bridge the boundary with a line, strap, marking, highlight, or shadow that only works at rest.
4. **Generate optional semantic cutouts as pet-4 specifies.** Each isolated part keeps its slot, donor, socket, pivot, spring, and fusion policy, and now receives a declared depth role. Paired far/near pieces may land on opposite depth surfaces while retaining one `atomicGroupId`.
5. **Process and slice.** Key `#00ff00` to real alpha, preserve the untrimmed canvas and registered pivots, and install the body pair as two physical files under the one body group. No destructive crop or non-uniform scale is allowed. If a coordinated full composite was used as source, the back underpaint must be deliberately completed before extraction; simple erase-and-split cannot invent occluded pixels.
6. **Deterministically assemble two proof surfaces.** Composite all accepted `back` cutouts in plane order into `back-surface.png`, and all accepted `front` cutouts in plane order into `front-surface.png`; then stack those into the canonical proof composite. These surface renders are provenance/QA masters, not new semantic parts and not pair-specific fusion art.
7. **Promote the pair atomically.** A body back or front never promotes alone. Their hashes, shared source/reference hashes, seam ID, registration, and review result are one promotion record. Rejection creates new immutable attempts for the affected side and invalidates the composite proof until rebuilt.

The current artkit's “one job → one 1024×1024 PNG” discipline can remain: `body.back` and `body.front` are two linked edit jobs with common references and one promotion gate. A future exploded two-island source is acceptable if tooling can place both outputs back onto the canonical canvas without resampling, but it is not required for this feature.

### Prompt additions

Append the following production law, adapted to the form's named anatomy, after pet-4's identity/geometry blocks:

> This is one half of a registered two-depth pet body, coordinated with the named companion half from the same approved identity reference. Preserve the exact 1024×1024 canvas, body root, axis, baseline, facing, palette, light direction, contour character, and form silhouette. The front layer sits over the back layer and may move within the declared authored-travel envelope. The back must remain fully painted and closed beneath that entire envelope; the front must carry an opaque hidden collar with the declared overlap. Draw no neck, peg, socket hole, cut guide, duplicated rim, floor shadow, VFX, or line/marking that requires the two images to remain pixel-aligned. Render only the declared layer inventory on uniform opaque `#00ff00`.

The part-specific prompt then states whether it is **BACK** or **FRONT**, which exact pixels/features it owns, what the other layer owns, the measured rest overlap, the maximum travel it must survive, and all forbidden content. “Same pet” or “separate layer” without that ownership list is not an adequate job.

### Seam and composition laws

- **Back is finished, not amputated.** Solo back view may look simplified, but it must be a closed creature surface anywhere motion can expose it.
- **Front owns the seam-facing outline.** Never paint matching dark outlines on both sides of the hidden overlap; separation would reveal two parallel cut marks.
- **No edge-to-edge joints.** The front overlaps ordinary painted stock. A fitted puzzle seam, transparent notch, or tiny connector is an automatic reject.
- **No crossing graphics.** Stripes, runes, face marks, straps, highlights, and hard material borders belong wholly to one side or are redesigned as two independent shapes. They may not need pixel-perfect continuation across a moving cut.
- **One focal read.** The front carrier should contain a face/mask, leading shell plate, core bezel, or similarly legible feature. Moving a meaningless sliver technically satisfies two textures but does not satisfy the owner's desired bobbing feel.
- **Shared treatment.** Tint, downed/desaturation treatment, mirroring, normalization, and form-scale changes apply coherently to both surfaces; neither layer may reveal a different palette or light source.
- **Bounds include motion.** The approved envelope is measured across rest plus all front travel extrema and springing optional parts, not only the rest composite.

## Review checklist additions

These gates append to pet-4's eight-section checklist. Failure rejects the form even if each still image looks attractive.

### Depth data and provenance

- [ ] Every physical cutout has one valid `depthLayer`; both surfaces are non-empty; `plane` ordering is deterministic within each surface.
- [ ] The required body source contains an atomic back/front pair with shared donor, form key, body group, `withBody` policy, source/reference hashes, and seam ID.
- [ ] Front pivot, rest offset, authored travel, rest overlap, minimum overlap, and the reviewed motion-profile version are recorded in normalized units.
- [ ] The canonical composite is rebuilt from promoted source pixels. No separately generated “pretty composite” masks a mismatch between deliverables.

### Solo-layer and seam proof

- [ ] Back-only alpha view is closed throughout the motion reveal zone: no transparency, green fringe, black socket, truncated marking, duplicate rim, or visible production guide.
- [ ] Front-only alpha view contains its complete focal feature and opaque collar, with no stolen body mass or undeclared semantic part.
- [ ] At rest the pair reproduces the approved form, palette, silhouette, root, baseline, and envelope.
- [ ] At every corner/edge/center sample of the renderer-provided travel envelope, plus any allowed rotation extrema, there is no daylight, doubled line, false mouth/eye, detached cap, or suddenly revealed unfinished patch.
- [ ] Worst-case measured overlap satisfies both the declared floor and the travel+tolerance+safety formula.

### Gameplay and accessibility proof

- [ ] Composite passes at actual Hatchling/Awakened/Ascendant extent, mirrored left/right, on representative light/dark arenas, in color, grayscale, and pale/tint/downed treatments.
- [ ] A short rest/follow/turn/dart/settle loop demonstrates readable relative depth without making the front feature look loose or broken. The production review uses the exact motion envelope supplied by `pet-layer-render`.
- [ ] Reduced-motion output preserves the correct rest composite and never snaps to a different registration or exposes a seam.
- [ ] Four-player density and offscreen/LOD wake do not produce a one-frame half-form, stale front transform, or obvious surface swap.

### Evolution and fusion proof

- [ ] Both sides of an evolution transition are complete two-layer recipes; the stage/form swap never mixes old back with new front.
- [ ] Every `free` group has been tested on round, long, and shell/hulk body sentinels in both solo depth-surface views and through the full motion envelope.
- [ ] A group spanning back/front (for example a far/near wing pair) switches donor atomically and preserves parent/child dependencies.
- [ ] A legal recipe with every optional group set to `Empty` still has two valid surfaces because the body carrier pair remains.
- [ ] No fusion preview or saved recipe offers “parent A back / parent B front” as a choice.

## Evolution interaction

Evolution continues to replace a manifest-resolved form recipe. Crossing into Awakened or Ascendant selects the new `(petId, band, formKey)` and therefore replaces, as one visual transaction:

- both body-carrier files;
- every semantic part placement and depth assignment;
- the stage's pivot/rest offset/authored-travel values;
- the target envelope and any form-specific seam metadata.

Nothing is carried forward merely because it occupied `front` in the previous band. Hatchling front art can be a face cap, Awakened front art a near wing/face mass, and Ascendant front art a crown-and-mask plate; the semantic lineage is governed by pet-2's form recipe and identity anchors, not by depth-role continuity.

For pet-2's Ascendant branch pilot, each endpoint owns its own complete two-layer recipe and depth rig. The persisted `branchKey` still resolves to a stable `formKey`; it does not select a texture, depth role, or offset. Rebonding changes the resolved form and atomically rebuilds both surfaces. Both branches retain the same pet function and Bond track.

The evolution ceremony may flip/crossfade old and new complete composites as it does now, but must not reveal the new front before its new back is ready. Missing or partially loaded depth assets fall back to the complete legacy/static form or canonical pet fallback chosen by the systems/render design—never a half-pet.

## Fusion interaction

Fusion remains semantic recombination exactly as pet-3 specifies:

1. Select the required body source and optional `PET_FORM_SLOTS_V1` groups from same-band unlocked forms.
2. Copy each chosen group's flattened donor/form/slot provenance; keep side pairs, rear subtrees, and `withBody` dependencies atomic.
3. Resolve those stable groups through the current manifest into physical parts.
4. Route each resolved physical part to `back` or `front`, preserve deterministic within-surface plane order, and give the two surfaces to `pet-layer-render`.

A fused pet does **not** inherit a monolithic back image from one parent and a monolithic front image from the other. Such a model would make depth a second fusion system, discard pet-3's named part choices, allow incompatible body seams, and require bespoke parent-pair QA. Instead:

- The chosen body parent contributes its body-back and body-front carrier together.
- A chosen wing group can contribute its far/back and near/front pieces together.
- A chosen shell, crown, face, aura, or other free group contributes whichever depth-tagged physical pieces its donor manifest declares.
- A `withBody` group follows the body source even if some of its pieces are on the front surface.
- Setting every optional group to `Empty` leaves the body carrier pair and therefore retains the effect.

The saved fusion record does not gain depth fields. It continues to store stable donor pet ID + form key + semantic slot/group. This is essential to the “replace parts without migrating accounts” contract: a later art patch may move a crown from front to back, replace either body carrier texture, or retune the rest offset by changing the manifest, and every saved fusion resolves safely on next load.

Cross-body review must include seam safety as well as socket fit. If a donor group only works because its pixels complete a particular body's moving seam, it is not `free`; merge it into the donor body's atomic group and mark `withBody`. Fusion should never dynamically repair, repaint, or guess a depth split.

## Manifest and census impact

### Versioning and compatibility

Fold this feature into the same next generated-manifest generation that pet-2 already calls `PET_SOCKET_FRAME_V2`; do not create parallel “layer manifest” files. The next schema adds form keys/semantic groups/fusion metadata plus `depthRig` and per-part `depthLayer`. Both generated copies must remain byte-for-byte/data-equivalent:

- `tools/artkit/out/pets/pet-parts-manifest.json` — production/audit output;
- `packages/client/public/sprites/pets/pet-parts-manifest.json` — runtime copy.

Schema-v1 forms remain a compatibility lane and render as their existing static multi-part assembly with no relative depth motion. Do not infer a production depth split from plane sign at load time: current `body=0`, far parts are negative, and shell/crown/near parts are positive, but those values do not prove a hidden moving seam. A conversion tool may propose assignments for a human to review; promoted schema-v2 data must be explicit.

Activation is per complete form. A form is v2-ready only when both body carriers, all referenced optional parts, the depth rig, and proof metadata pass. A partial rollout must keep using the complete v1 form rather than mixing one new layer with legacy art. This requires no account rewrite because account/fusion references stop above the physical-part layer.

### Physical asset census

The guaranteed body pair adds at least one physical cutout per form relative to pet-4's one-body assumption:

| Scope | Prior physical-part count/estimate | Two-layer minimum | Impact |
|---|---:|---:|---:|
| Current shipped catalog: 8 pets × 3 forms | 72 | **96** | +24 new front carriers; all 24 existing body images also need seam/backing review and usually reauthoring. |
| Pet-4 default target: 24 pets × 3 forms | ~396 | **~468** | +72 body-front placements, about +18% over pet-4's estimate. |
| Four extra Ascendant branch forms | +28–40 | **+32–44** | +1 carrier per extra endpoint. |
| 24-pet defaults plus branch pilot | ~424–436 | **~500–512** | No bespoke fusion-pair images. |

At the currently observed mean of about 139.5 KiB per installed pet PNG, 96 current-format files would be roughly 13 MiB and 500–512 future files roughly 68–70 MiB before atlas/compression changes. These are planning estimates, not budgets; front carriers may compress differently.

The deterministic `back-surface`, `front-surface`, composite, solo-alpha, and travel-grid images are review artifacts under artkit output. They do **not** add semantic slots, count as installed runtime parts, or enter fusion recipes. If `pet-layer-render` keeps the confirmed retained-image implementation, canonical and fused pets simply partition their loaded cutouts into two synchronized planes; there is no runtime pair atlas or generated A+B bitmap census.

### New machine gates

Manifest emission/validation should reject:

- an unknown/missing depth role or a form with an empty surface;
- a body group without both carrier roles or with mismatched donor/form/group/policy;
- duplicate IDs, unresolved parent/child groups, invalid sockets, non-finite pivots/offsets/travel/planes, or depth children preceding their parent;
- expected/installed set inequality, unexpected PNGs, or a proof hash that does not match promoted source pixels;
- rest or motion-extreme bounds outside the approved form envelope;
- insufficient alpha underlap at any sampled extreme;
- a `free` fusion group that depends on a body-owned seam patch.

The existing `expectedPartCount`, `installedPartCount`, `missing`, `extras`, and `invalid` census remains useful and must count physical cutouts, including both body carriers. Add per-form summaries such as back count, front count, body-pair validity, and measured minimum overlap so a green aggregate cannot conceal a broken form.

## Character precedent: what carries over and what does not

The owner explicitly identifies the character bobbing head as precedent. The reusable production lessons are:

- two coordinated layers from one identity, not two independent designs;
- a body-relative pivot/socket and bounded relative travel;
- a closed backing surface and an opaque overlapping front surface;
- no neck/peg/edge seam and no graphic that needs pixel alignment;
- review at rest, mirrored, tinted, reduced-motion, and every motion extreme;
- one complete identity loaded and transformed atomically.

The character design targets 0.18 body-height rest overlap and at least 0.10 at its ±4 px extremes; `SpriteRig` moves a character-owned head in counter-phase through a bounded follower. Pets reuse the overlap discipline and two-surface visual logic, expressed in pet body-axis `L`. They do **not** acquire a character head slot, weapon posture, or character-specific cadence. `pet-layer-render` owns the pet follower inputs/tuning and has confirmed that the back plane remains anchored while all front members receive one shared local translation inside the existing pet root.

## Future implementation touch-list

This is the expected implementation surface; this Sol changes none of it.

| Area | File(s) | Future responsibility |
|---|---|---|
| Stable gameplay catalog | `packages/shared/src/pets.ts` | Preserve `PET_PART_SLOTS`, bands, mechanics, and account-stable identity. Touch only if shared visual enums/form registry are intentionally centralized; do not add saved front/back slots. |
| Canonical art compiler/generator | `tools/artkit/gen-pets.mjs` | Replace hard-coded v1/72 assumptions; compile form/depth packets; run linked back/front body jobs; emit v2 semantic, atomic-group, fusion, depth-rig, overlap, and proof metadata; validate both surfaces. |
| Optional slice/alpha guard | `tools/artkit/guards/slice.mjs` or a focused pet-depth guard | Preserve full-canvas registration; validate carrier extraction, alpha stock, seam travel grid, and deterministic proof surfaces. |
| Production artifacts | `tools/artkit/out/pets/**` | Store immutable linked masters/logs/rejections, generated manifest, depth proof surfaces, travel grids, and hashes. |
| Installed assets/data | `packages/client/public/sprites/pets/**` | Install both body carriers plus existing loose semantic cutouts and the single versioned manifest; never install named fusion-pair art. |
| Manifest schema/resolver/assembly | `packages/client/src/sprites/pet-parts.ts` | Parse v2; resolve donor-aware semantic groups; expose two ordered part collections; include front travel in bounds; retain a complete v1 static fallback. |
| Pet presentation | `packages/client/src/entities/PetRig.ts` | `pet-layer-render` owns the anchored back/shared-front transform, existing part springs, root/world depth, lifecycle rebase, tint/mirror/LOD, fallback, and reduced-motion behavior. |
| Descriptor wiring | `packages/client/src/scenes/ArenaScene.ts` | Pass the resolved band/form/fusion appearance descriptor and swap a complete two-surface form atomically. |
| Contract tests | `packages/client/src/sprites/pet-parts.test.ts` plus focused `PetRig` tests | Validate 24+ form resolution, two non-empty planes, atomic body pair/groups, bounds/extrema, v1 fallback, donor textures, load/swap atomicity, and reduced motion. |
| Asset drift gate | `tools/artkit/check-assets.mjs`, root `package.json` scripts | Teach `assets:check`/deterministic validation to parse the pet manifest and verify every installed texture/proof/census; do not make an image-generation run part of ordinary CI. |
| Developer catalog | `tools/portal/gen-portal.mjs` | Stop assuming `sN/body.png` is the whole thumbnail; build/use the deterministic two-layer composite and label species/forms accurately. |

Evolution/branch and fusion persistence/resolver files introduced by the pet-2/pet-3/pet-5 implementation will also consume stable `formKey` and semantic group provenance, but they should not import physical texture IDs or depth offsets into account schemas.

## Explicit handoffs with `pet-layer-render`

### This pipeline hands to the renderer

- Two non-empty ordered collections for every resolved form: all physical back parts and all physical front parts.
- One required atomic body carrier pair, common registered coordinate frame, front pivot/rest offset, and form envelope.
- `depthLayer` on every physical cutout; original `plane`, parent/socket, pivot, scale, spring, donor, tint/policy, and semantic group metadata remain available.
- The maximum X/Y/rotation envelope the art was reviewed to survive, plus measured overlap and bounds at every extreme.
- An atomic readiness rule: neither a canonical evolution form nor a fusion becomes visible until both surfaces and all required groups are ready.
- V1 fallback status for forms not yet reauthored.

### The renderer hands to this pipeline

- The authoritative `pet-bob-v1` displacement/rotation clamp and every sample point the art grid must test.
- The exact definition of front pivot, local axes under mirroring, how existing root hover/follow/dart/flinch signals feed the follower, and whether any rotation is permitted.
- Reduced-motion rest/settle bounds, lifecycle rebase behavior, offscreen/LOD wake behavior, and evolution/descriptor-swap behavior.
- The fixed render-order law: back and front remain inside one pet root/world-depth atom; optional per-part angular springs do not escape their assigned plane.
- Texture/load failure behavior and the performance ceiling for maximum physical children per plane.

The sibling's current verified direction already fixes the key boundary: back is the anchored plane; every front member gets the same bounded local translation after ordinary assembly; existing per-part pivot rotation may continue; the whole pet remains one world-depth unit; no dynamic render textures, masks, duplicate full-form draw, or per-part translational followers are required. If its final numeric envelope differs from a provisional art packet, the renderer's final envelope is authoritative and art must be rechecked—not silently clamped beyond its reviewed seam.

## Assumptions and non-goals

- `PET_FORM_SLOTS_V1` and the same-band, atomic-group, `free | withBody` fusion policy from pet-2/pet-3 are the design authority even though they are not all shipped in schema v1.
- The robust target converts all 24 currently shipped stage forms to an internal body depth pair. A legacy form may remain static during rollout, but a v2 form does not claim compliance by moving an arbitrary existing accessory with an unreviewed seam.
- The front carrier is presentation-only. It has no collider, hitbox, target point, gameplay depth, stat, unlock, inventory entry, or independent player choice.
- Painted aura/orbit cards remain semantic cutouts and can be assigned to a plane. Runtime particles/VFX are not baked into either carrier merely to make the separation obvious.
- Art owns seam viability and declared travel tolerance; `pet-layer-render` owns animation math. Neither track changes the existing server-authoritative pet identity/function model.
- There is no blocking owner question. The simplest compatible default is explicit per-physical-part depth metadata, an atomic body carrier pair, and semantic fusion before depth partitioning.

## Validation

- Re-read `packages/shared/src/pets.ts` and verified the eight canonical IDs, exact `core | primary | secondary` constants, three level bands, and the manifest-replacement/account-compatibility intent.
- Parsed the installed JSON rather than relying on prose: schema 1 / `PET_SOCKET_FRAME_V1`, 8 pets, 24 forms, 72 expected/72 installed physical parts, and zero missing, extra, or invalid rows. The artkit output copy reports the same census.
- Reconciled the exact form-slot mapping and branch behavior in `pet-2-evolution.md`, the same-band atomic donor/`free | withBody`/flattened provenance rules in `pet-3-fusion.md`, and the generation, registration, slicing, seam, review, and projected 396-part pipeline in `pet-4-art-pipeline.md`.
- Inspected `packages/client/src/sprites/pet-parts.ts`, `packages/client/src/entities/PetRig.ts`, `tools/artkit/gen-pets.mjs`, the current manifest/test, and the character `SpriteRig`/`chars-3-headrig` precedent. Confirmed that numeric planes and angular part springs exist today, while two explicit motion planes and a body carrier pair do not.
- Re-read the sibling `pet-layer-render` report during drafting and aligned the interface with its verified direction: anchored back plane, one shared local front translation, existing per-part rotation retained, atomic pet world depth, no dynamic render textures/masks/per-part translational followers.
- Structural check: 391 report lines, four balanced Markdown fence markers, every requested section present, and no accidental product-code language presented as shipped implementation.
- Scope audit over every named implementation file reports only `docs/design/pet-layer-pipeline.md` as changed by this track. No generator, formatter, asset write, product test, server/client command, or live-game request was run; ports 5180/2567 were not touched.
