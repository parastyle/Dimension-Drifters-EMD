# Pet Art & Generation Pipeline

**Panel role:** Sol `pet-4-art-pipeline`  
**Status:** Investigation in progress; this report is being expanded as evidence is verified.

## 1am summary

Generate every pet as a registered kit of swappable parts, not as one flattened creature picture: a shared prompt preamble keeps the whole bestiary in one readable, top-down-ish game style, while a pet-and-stage identity block permits cute, strange, majestic, organic, or mechanical silhouettes. Each form is first generated at the size its design needs, then normalized into its visual band's bounding box using a common base jig that locks the ground anchor, foot baseline, facing, and part-slot registration—not the creature's apparent size. Canonical pet specifications feed the established repo generation flow, generation emits separately rendered slot assets with documented overlaps and hidden cut-lines, and automated plus human checks reject art that cannot survive slot swapping, gameplay-scale reduction, evolution, or fusion.

## Mandate understood and working assumptions

This track will specify the bridge from roster/evolution/fusion designs to production-ready modular pet art. It will reuse the repository's existing canonical source → generation → check pattern rather than establish a second art system. The central constraint is part-sliceability: body, wings, tail, crown, aura, and every other verified slot must be independently rendered, registered to a common anchor, and able to overlap safely so evolution and fusion can replace pieces without commissioning every combination as a bespoke flattened image.

The owner's base-model directive is treated as a registration contract, not a size equalizer. The base jig fixes facing, world anchor, foot/hover baseline, canvas coordinates, and attachment sockets. Generation may express a tiny chibi Hatchling or a huge Ascendant freely; a second normalization pass then fits that result into the target band's allowed bounding box without moving its ground anchor or attachment registration. Apparent bigness remains part of the design language while runtime placement remains stable.

Assumptions to verify rather than interrupt the owner:

- The existing pet part manifest and source constants are authoritative for initial slot names and registration behavior.
- The other pet-panel reports will provide canonical roster identities, evolution forms, and fusion rules; this report will define the schema and handoff those concepts must satisfy.
- Pets may have faces and expressive creature anatomy; character-specific facial restrictions do not apply.
- No art will be generated in this design pass, and no product or asset files will be changed.

## Verified codebase facts (working record)

- `docs/sol-reports/README.md` requires an initial report of record, incremental updates, and validation last. The task's stricter output path makes this design document the report of record for this Sol.
- `packages/shared/src/pets.ts` is shipped truth: it contains exactly **8 pet IDs**, not 24. `PET_STAGE_DEFS` maps Hatchling to levels 1–3, Awakened to 4–7, and Ascendant to 8–10. Its stable account-facing replacement slots are exactly `core`, `primary`, and `secondary`; its comment explicitly reserves them for future fusion/evolution replacement without account migration.
- The “24” found in current tests is **24 forms**, not 24 shipped pets: 8 identities × 3 stages. `packages/client/src/sprites/pet-parts.test.ts` says “all 24 forms,” then asserts the manifest has 8 pets.
- `packages/client/public/sprites/pets/pet-parts-manifest.json` is a complete generated runtime manifest: schema 1, `PET_SOCKET_FRAME_V1`, 72 expected/installed PNGs, and zero missing, extra, or invalid files. Every installed texture stays on a 1024×1024 canvas. The fixed body root is `(512,510)` and the normalized body axis is 256 source pixels.
- The manifest's art-mount vocabulary is deliberately more concrete than the three account-facing replacement slots. Root render sockets are `side.far`, `side.near`, `side.paired`, `rear`, `crown`, `shell`, `dorsal`, and `ventral`; `tailTip` is a child socket on a `rear` part. `body` is the root layer. These are **render sockets**, not additional persisted fusion slots.
- The eight current kits prove the intended range: wing cards occupy `side.*`; newt/gecko tails and the firefly ribbon use `rear`; snail/tortoise caps use `shell`; crests/halos/rings use `crown`; plates/panniers/lenses use `dorsal` or `ventral`; and Gilded Gecko's balance pan proves a part can attach to another part through `tailTip`. Depth planes run from far-side `-20`, through rear `-10` and body `0`, to body-top accessories `10`, near-side/child `20`, and crown `30`.
- `packages/client/src/sprites/pet-parts.ts` already performs the owner's required second normalization step. It assembles freely sized alpha bounds around the invariant root/pivots, then scales the largest assembled dimension to **30 px Hatchling, 37 px Awakened, or 44 px Ascendant**. It retains full untrimmed images so pivots remain exact, sorts layers by manifest plane, and resolves both raw body sockets and normalized child sockets. Bigness across stages is therefore already expressed by the band envelope; source-pixel size is not the runtime contract.
- `tools/artkit/gen-pets.mjs` is the existing pet-specific canonical source → generation → validation path. Its source declares identity, exact palette roles, stage descriptions, part IDs, render sockets, parents, spring presets, and semantic bans. It generates stage-first, body-first; later bodies and recurring parts edit the prior-stage master; new parts reference the current body plus the stage-1 identity. Raw masters are resumable, installs remain untrimmed, and the generator emits the machine manifest. This report will extend that idiom rather than propose a parallel generator.
- The wider `tools/artkit` confirms the house idiom. `README.md`, `orchestrate.mjs`, and `lib/prompts.mjs` separate canonical subject/style data from isolated candidate generation and human promotion; an accepted identity image becomes the later reference lock. `gen-vfx-subjects.mjs` derives short asset prompts from canonical weapon behavior and always attaches that weapon's accepted art. `gen-particle-packs.mjs` then shows the deterministic half: chroma key, connected-component dissection, fixed-cell normalization, packaging, and manifest emission. `lib/emit.mjs` and generators' `--check` modes detect drift without writing. Pet production should use the same sequence: **canonical pet-line record → isolated candidates/edits → explicit promotion → deterministic key/register/assemble → machine and human checks → generated manifest/install**.
- `tools/artkit/style.json` is the executable general DD canon, but its character face/build rules cannot be pasted wholesale into pet jobs. The applicable rendering laws are original chunky silhouettes, a heavy imperfect contour, sparse interior ink, flat cel bands, low detail, a restrained dark/material palette, keyable `#00ff00`, and no baked floor/VFX. Creature faces are expressly allowed for this track; human character anatomy and the character no-face law are not pet requirements.
- `tools/artkit/gen-pets.mjs` already has strong mechanical safeguards worth retaining: fresh isolated generation chats, real reference attachments, no code-drawn fallback, stage/part selectors, resumable raw masters, chroma key/despill, alpha bounds, 1024×1024 RGBA validation, sane opaque coverage, pivot-inside-stock validation, a 32 px emergency inset, and manifest accounting. Its socket contract pins connector drift to 4 source pixels / 2 degrees and requires 10–12% hidden painted collar stock.

### Verified gaps the expansion must close

1. The generator's canonical `PETS` array and `JOBS.length === 72` assertion encode the current eight-pet, 2/3/4-layer cadence. The renderer itself accepts an arbitrary ordered `parts[]`, but its class comment and tests still assume 2–4 parts. Dramatic multi-wing, extra-limb, orbiting, and mega forms need a deliberate layer budget plus updated validation/performance ownership—not another renderer.
2. The runtime normalizer accepts a caller-provided envelope, but production always uses global 30/37/44 defaults. That correctly makes bands grow, yet forces a chibi and a hulk in the same band to the same maximum extent. The art record therefore needs an authored per-form target envelope while keeping 30/37/44 as legacy defaults.
3. The current post-process independently caps bodies at 380 source pixels and other parts at 340, then heuristically finds an anchor from alpha. This is useful containment, but it is not a substitute for an approved whole-form proportion plan. New records need expected extents in body-axis units, a visible base-jig reference, and rejection when a part is wildly out of proportion; independent max-fitting must not silently turn every wing, claw, or crown into the same size.
4. A generated part is installed after one successful call. There is no candidate ledger, winner hash, or required whole-assembly taste gate in `gen-pets.mjs`. The fleet needs the established artkit promote/reject idiom before install, with rejected attempts retained and precise feedback appended to the next isolated job.
5. Current machine checks prove file geometry, not semantic slice quality. They cannot tell that a “body” accidentally contains wings, that a wing lacks enough hidden root stock, that a near/far pair was generated inconsistently, or that a cute pet reads as an enemy at 30 px. Those become explicit assembly/contact-sheet gates below.
6. The manifest records `donorPetId`, but `packages/client/src/sprites/pet-parts.ts` currently builds texture keys and URLs from the selected receiver pet ID. Fusion therefore needs pet-3/pet-5's donor-aware recipe/loader handoff; the art pipeline must preserve donor identity and may not flatten/copy every combination into bespoke receiver folders.

### Neighbor-track decisions consumed

- **Pet-1:** keep all eight shipped pets and add 16 for **24 base identities**, authored in two waves of eight. Wave A is Biscuit Jackalope, Manymoon Oracle, Rivet Mule, Brimstone Imp, Chapelback Bison, Tollwater Ray, Rambleroot, and Ghost Coyote Pup; Wave B is Crowned Pronghorn, Little Pallbearer, Thimble Deputy, Gravewick Beetle, Ragwing Vulture, Hungry Boot, Moonmilk Ooze, and Rattlesmoke Wyrm. The 16 black-silhouette reads are deliberately distinct. At three bands this target means 72 default form rows, not “24 art cards.”
- **Pet-2:** use the exact `PET_FORM_SLOTS_V1` semantic vocabulary and a typical **2–3 / 4–5 / 6–8** cutout gate across Hatchling/Awakened/Ascendant, while budgeting exceptional hero forms up to 11–12 layers and a fleet mean of 16.5 placements per line. Awakened must visibly change at least two axes; Ascendant at least three plus one hero mutation; exactly two lineage anchors survive. Its authored examples supply the names used in the literal prompts below: Biscuit Button, Hushbell/Sevenfold Orrery, and Hearth Wyrm. It also freezes a four-pet/two-endpoint Ascendant pilot for Verdant Wing, Copper Snail, Slate Tortoise, and Biscuit Jackalope.
- **Pet-3:** fusion is same-band, non-destructive, and donor-aware. It stores `donorPetId + formKey + semantic slot`, swaps side pairs/rear subtrees atomically, and marks parts `free` or narrowly `withBody`. Native donor palette mismatch is allowed; restrained whole-form coat wash and neutral tintable aura/orbit/keepsake art provide personalization. No pair-specific raster is ever commissioned.
- **Pet-5:** current loader/runtime work is a real downstream dependency. It must resolve `(petId, band, formKey)`, load each part from its donor path, accept richer part counts/motion, keep old manifest compatibility during rollout, and replace hard-coded 8/24/2–4 tests with catalog↔manifest set equality and declared per-form budgets. `check-assets.mjs` does not currently inspect the pet manifest, so pet completeness must be added rather than assumed.


## Decision: extend the one existing pet artkit path

There should still be one pet generator and one generated pet-parts manifest. The implementation pass should move the hard-coded `PETS` declarations into a versioned canonical art record consumed by `tools/artkit/gen-pets.mjs` (or keep them in that module until the move is convenient), but it must not create a second renderer, second socket frame, or hand-maintained fusion asset tree. The record owns art intent; generation owns attempts; promotion chooses approved sources; deterministic processing owns keying/registration/normalization metadata; the runtime manifest remains generated output.

### Canonical record required for every line

Each pet line must provide these fields before a generation job can compile:

| Record level | Required fields | Why the pipeline needs them |
|---|---|---|
| Pet | stable `id`, display name, one-sentence creature identity, personality/read, material family, exact six role swatches (`ink`, `structureDark`, `structureMid`, `paperLight`, `signature`, `core`), permanent forbidden reads | Keeps identity and palette independent of mechanics; prevents a healing pet becoming a health icon or an XP pet becoming a pickup arrow. |
| Stage | band and named form, transformation thesis, `sizeClass`, authored `targetEnvelopePx`, face/silhouette statement, active logical bundles, full render-part inventory | Makes evolution a visible redesign, not a recolor/upscale. |
| Logical bundle | exactly one of shipped `core`, `primary`, `secondary`; bundle ID; donor identity; dependencies; `fusionPolicy: free|withBody`; render-part IDs; native/neutral-tintable palette policy | This is the stable fusion/save contract. A logical bundle may own several render layers and must swap atomically. |
| Render part | unique ID, pet-2 `PET_FORM_SLOTS_V1` semantic slot, existing or proposed physical receiver, parent, pivot, receiver anchor, depth plane, spring preset, expected component count, expected extent range in `L`, hidden cut-line/collar description, positive visual description, negative content list | Lets one generated raster become a registered, testable rig layer rather than a vague crop from a creature painting. |
| Provenance | prompt/style/socket-frame version, reference hashes, attempt number, rejection note, promoted attempt hash, keyer/normalizer/check versions | Makes a rerun or revision auditable and prevents silent mixed-style fleets. |

`core`, `primary`, and `secondary` are the only shipped coarse replacement slots. They are **bundles**, not necessarily single PNGs. Pet-2's exact mapping is authoritative: logical `core` groups `body + face + core`; logical `primary` groups `side + side.secondary + side.tertiary + shell`; logical `secondary` groups `rear + crown + dorsal + ventral + rider + orbit.* + aura.*`. A winged primary can therefore own far wing + near wing, and a tail subtree transfers with mandatory `tailTip` children. Atomic bundling is how fusion avoids half a pair, a foreground wing without its far mate, or a child ornament whose parent did not transfer.

Pet-2's form vocabulary is the production target: `body`, `face`, `core`, `side`, `side.secondary`, `side.tertiary`, `rear`, `crown`, `shell`, `dorsal`, `ventral`, `rider`, `orbit.back`, `orbit.front`, `aura.back`, and `aura.front`. The existing physical sockets cover only `body`, one `side` pair/paired card, `rear`/`tailTip`, `crown`, `shell`, `dorsal`, and `ventral`. Pet-2 counts **13 new physical receivers** for `face`, `core`, far/near second and third side pairs, `rider`, orbit far/near, and aura far/near. Treat these as proposed `PET_SOCKET_FRAME_V2`, not facts about v1. The current assembler can already place arbitrary parented rows, but the generator, manifest contract, loader, tests, and review compositor must name and validate those receivers before new art is promoted.

An aura is always a separate root-centered far/near secondary layer or an established runtime VFX asset; it is never baked into `body`. A solid matte veil, broken ring, flame-shaped paper field, or spectral cutout is valid `aura.back/front` art. Bloom, free particles, sparks, motes, drifting smoke simulation, and emitted light remain runtime VFX. This preserves pet-2/pet-3's tintable aura slot without freezing an animation into the creature pixels.

## Base jig and two-step scale normalization

The binding reference is `PET_BASE_JIG_V1`, derived from—not replacing—`PET_SOCKET_FRAME_V1`. It is a 1024×1024 authoring guide with the existing body root `(512,510)`, +X/screen-right body axis `L=256`, all eight existing root sockets, the `tailTip` child socket, and a virtual foot/hover baseline at `rootY + 0.5L = 638`. Grounded feet or belly stock meet that baseline; a hover form records a deliberate clear gap above it while its virtual shadow still belongs there. The guide also identifies far/near depth and the non-printing safe region. It is attached as the first geometry reference to every new identity job; tooling strips/keys the output, and any copied guide mark is a rejection.

**The jig does not dictate creature size or silhouette.** It defines the ruler, ground registration, facing, and sockets. A dumpling Hatchling, long eel, broad hulk, and cathedral-winged Ascendant may occupy radically different extents in `L` while their root, baseline, and attachment grammar stay identical. This is exactly why a base anchor and varied size are compatible.

Normalization is two explicit steps:

1. **Generate and register freely.** Produce the body and each part at the proportions demanded by the named form. Key the green, preserve each part's aspect ratio, translate the body anchor/part pivot onto the jig, and reject anatomy outside its authored extent band. Do not independently “make every part 340 px”; that would equalize a tiny ear and a mega wing. Per-part downscaling is only a canvas-overflow safety correction and is recorded as `mountScale`.
2. **Assemble, then normalize once.** Assemble all approved layers around the invariant root, measure the full rotated alpha bounds, and apply one uniform scale `targetEnvelopePx / max(rawWidth, rawHeight)` to the entire form. The target box is registered to the same virtual baseline/root, never centered by eye. No non-uniform stretch and no post-normalization socket movement are allowed.

The existing 30/37/44 px values remain exact defaults for shipped records. New forms author a value inside these initial gameplay-safe bands (pet-5 may tighten them after four-player testing):

| Visual band | Authored maximum extent | Legacy/default | Intended expression |
|---|---:|---:|---|
| Hatchling | 26–34 px | 30 px | tiny charm through chunky baby |
| Awakened | 33–43 px | 37 px | compact adolescent through broad mutation |
| Ascendant | 40–54 px | 44 px | elegant chibi elder through true mega-form |

A line's targets must be monotonic and normally rise by at least 4 px then 5 px. Silhouette area is reviewed alongside maximum extent: a 54 px two-pixel-thin halo does not make a body feel huge, while a 44 px dense stone hulk can. **Bigness is authored expression; the anchor is invariant.** Same-band size variation survives because the per-form target is data, not a single global constant.

## Production flow: canonical source → gen → check → promote

1. **Compile, do not improvise.** Validate every roster/evolution row, palette, logical bundle, render part, socket, parent dependency, extent, stage target, and forbidden read. Unknown keys, missing parents, duplicate render IDs, or a logical slot outside `core|primary|secondary` fail the whole compile in the weapon-expansion strict-mode idiom.
2. **Freeze a fixed reference bundle.** Attach the same jig plus a deterministic bestiary breadth board assembled from approved current art: Verdant Wing for organic/cute, Brass Crab for mechanical, and Slate Tortoise for heavy/stone. These images teach style breadth only; the per-pet identity block owns content. Do not randomly sample anchors between jobs.
3. **Lock the Hatchling identity.** Generate three isolated `core/body` candidates, each with one image call and complete provenance. Machine-invalid attempts never reach review. The promoted body hash is the identity reference for the entire line.
4. **Build one logical bundle at a time.** Generate a bundle's parent/far layer first. Its sibling/child job receives the promoted body, the already approved same-bundle part, the earlier-stage version when one exists, and the fixed jig/style bundle. Every job still renders one declared part (or one declared multi-island slot card) only.
5. **Evolve by edit.** Awakened and Ascendant bodies edit the previous approved body while preserving face identity, root/baseline, material language, and sockets. Recurring parts edit their earlier approved version. New mutations reference the current body plus Hatchling identity. Use two body candidates for Awakened and three for Ascendant; appendages start with one targeted attempt and regenerate only on a recorded failure.
6. **Process deterministically.** Apply the pinned green key/despill; verify component count, alpha, bounds, pivot stock, baseline, extent, palette, and connector tolerance; keep the full untrimmed 1024 canvas; and emit assembly metadata. Never manually nudge the promoted PNG without recording a new derived hash and check result.
7. **Review the rig, not loose beauty shots.** Tooling composites the exact promoted pixels into rest, mirrored, spring-extreme, grayscale, and gameplay-size boards. It also produces an exploded view with tooling-added pivots/cut-lines and a fusion sentinel board. These previews are checks, not independently generated art.
8. **Promote, install, and check drift.** A form installs only when its machine report is green and the named assembly wins human review. Generate the runtime manifest, require zero missing/extra/invalid entries, run the pet-specific validate-only path and asset-existence checks, and retain rejected attempts/logs for resumable revision.

## Prompt system

The compiler concatenates three independently owned blocks: the byte-identical house preamble below, one immutable pet-identity block shared by all three stages, and one stage/part job block. Mechanics may be recorded for traceability but never converted into visual iconography; two pets with the same function should remain free to look completely different.

### Literal house-style preamble

```text
# DIMENSION DRIFTERS PET HOUSE STYLE V1 — BINDING

Create one original modular creature-art source for Dimension Drifters, a top-down co-op bullet-heaven. It must look drawn for the same bestiary as the fixed pet reference board, while copying none of those creatures' content.

COMPANION READ
- This is a loyal creature companion and a personal-expression choice. It must not read as an enemy, boss, pickup, loot item, weapon, turret, targeting reticle, combat telegraph, or stat icon.
- Pet faces ARE ALLOWED. Use a simple expressive creature face when the identity calls for it: bold eyes, beak, mouth, whiskers, mask markings, or strange non-human sensory organs are valid. The playable-character no-face law does not apply. Never drift into a realistic human face or human anatomy.
- Cute, weird, majestic, organic, spectral, and mechanical forms all belong. Keep the named creature identity stronger than the broad category.

SHAPE AND DETAIL
- Original, trademark-distinct, silhouette-first creature design. Favor 2–4 large readable shape groups over many small details. Exaggerated wings, tails, shells, extra creature limbs, horns, crowns, and odd mutations are welcome when declared by the job.
- HD 2D matte paper-cutout / dark-comic game art; never pixel art, photorealism, soft anime, glossy 3D, polished toy, or mascot merchandise.
- One heavy, slightly uneven hand-inked outer contour in the job's ink swatch: approximately 7–10 source pixels around a 250–400 px cutout. Interior marks are sparse and approximately 3–5 source pixels. Do not use hairline detail that disappears at gameplay size.
- Flat cel shading only: base swatch plus one decisive hard shadow band and at most one hard highlight per material. No gradients, airbrush, ambient occlusion, soft volumetric light, bloom, or baked glow.
- Matte painted card stock with restrained edge wear and a few nicks. Importance is expressed by silhouette and scale, not increased rendering detail.

PALETTE
- Use only the six exact role swatches supplied by the pet job: ink, structureDark, structureMid, paperLight, signature, and core. Do not invent near-duplicate hues. Antialiased edge pixels are processing artifacts, not permission for extra painted colors.
- Keep 70–80% of visible area in dark or materially muted roles. Signature plus core normally occupy at most 8% and must remain readable without bloom. A lighter cute pet may use paperLight broadly but still keeps one dark contour and clear value grouping.

CAMERA AND POSE
- Slightly high three-quarter top-down arena view with about 0.62 visual depth compression, facing +X / screen-right. Show top and near/front planes. Not side profile, front view, or isometric.
- Neutral follow/rest anatomy. No attack, lunge, run, snap, celebration, dramatic action pose, motion trail, or wind-blown cloth.
- Match PET_BASE_JIG_V1 for direction, root/baseline, source ruler L, and registration only. Do not copy the jig's neutral silhouette or any guide marks. Apparent size comes from the named form and its later target-envelope normalization.

MODULAR ART LAW
- Render ONLY the one declared render part or declared slot-card component set. Do not include the assembled pet and do not paint anatomy owned by another render part.
- Every physical attachment ends in ordinary painted structureMid/structureDark root stock covering its declared pivot and continuing 10–12% behind the documented cut-line. No visible socket hole, ball joint, guide, pivot dot, assembly label, or generic mechanical plug.
- The owning occluder must cover that root stock at rest, mirror, and the declared ±4 source-pixel / ±2-degree connector tolerance. A narrow species-specific stitch or scar may cross the seam; never use glow to hide it.
- Static aura geometry, if this job explicitly declares it, is a separate matte solid veil/ring/flame-paper layer with no bloom. Free sparks, motes, trails, emitted light, and simulated drifting smoke are runtime VFX and are never painted into a creature part.

OUTPUT
- Exactly one 1024x1024 PNG source on a perfectly uniform, fully opaque #00ff00 field. Never use #00ff00 or chroma-like lime in the art.
- Keep at least 64 source pixels of uninterrupted green between all visible alpha bounds and every canvas edge. No floor, contact shadow, reflection, environment, frame, caption, text, logo, watermark, checkerboard, or transparency request.
- Return one standalone image, never a grid, montage, turntable, multi-stage lineup, contact sheet, or card.
```

### Per-pet / per-stage / per-part template

```text
# PET JOB — {petId} / stage {band} {stageName} / {partId}

REFERENCE ORDER — BINDING
- Image 1: PET_BASE_JIG_V1. Geometry/ruler only; never copy guide pixels.
- Image 2: PET_BESTIARY_STYLE_BOARD_V1. Rendering breadth only; never copy creature content.
- Image 3: {promoted current-stage body or "none; this job establishes the Hatchling body"}.
- Image 4: {approved earlier-stage version of this same part, if recurring}.
- Image 5: {approved same-bundle sibling/parent, if required}.

PET IDENTITY — IMMUTABLE ACROSS ALL STAGES
- Display name: {displayName}
- Identity sentence: {species/material/personality identity}
- Recognition locks: {two or three features that must survive every stage}
- Exact palette roles: {six-role JSON object}
- Permanent forbidden reads: {identity-specific negatives}
- Runtime-only VFX: {particle/aura IDs or "none"}; DO NOT PAINT IT.

STAGE IDENTITY — THIS FORM
- Band: {1 Hatchling | 2 Awakened | 3 Ascendant}
- Named form: {formName}
- Transformation thesis: {one dramatic silhouette change, not recolor/upscale}
- Target envelope after assembly: {targetEnvelopePx}px maximum extent; size class {compact|standard|hulking|mega}.
- Body/foot law: root (512,510), +X axis L=256, virtual baseline y=638; {ground-contact or authored hover gap}.
- Whole-form read at gameplay size: {plain-language silhouette sentence}.
- Active logical bundles: core={bundle}; primary={bundle}; secondary={bundle or empty}.
- Full render inventory: {all part IDs, so this job knows what it must NOT duplicate}.

THIS LOGICAL BUNDLE
- Logical slot: {core|primary|secondary}
- Bundle ID: {bundleId}; swap atomically with: {part IDs}.
- Dependency contract: requires {receiver/socket/parent}; provides {child sockets or none}.
- Fusion seam policy: {native donor palette | neutral tintable aura/orbit/keepsake}; collar role {structureMid/structureDark}; fusionPolicy {free|withBody}.

THIS RENDER PART ONLY
- Positive description: {literal shape/material/face description}.
- Render socket: {real socket}; parent: {part ID or null}; depth plane: {integer}; spring: {preset or none}.
- Source pivot: ({x},{y}); receiver anchor: {raw and normalized}; rest angle: {degrees}; mount scale: {value}.
- Expected alpha components: {integer}; expected extent: width {minL}–{maxL} L, height {minL}–{maxL} L.
- Documented cut-line: {which edge enters which occluder, collar shape, minimum hidden stock, who draws the visible seam}.
- Part-specific forbidden content: {body/other appendages/VFX/icons/etc.}.

TASK
Generate exactly one 1024x1024 PNG for {partId}. Preserve every identity and geometry lock above. Before returning, verify the declared component count, screen-right top-down view, pivot inside opaque root stock, clean cut-line, exact palette, pure green field, and absence of every other inventory part.
```

## Sliceability contract — the production-saving rule

The cheap unit is a **promoted logical bundle of registered render layers**, never a flattened stage painting. A beautiful whole-pet render that cannot be separated is a failed source, not “concept art we will somehow cut later.” The per-part generator path already used by `gen-pets.mjs` is the correct default because it prevents the model from inventing ambiguous overlaps on a combined sheet.

Concretely:

- **Body job:** render the root body only. It must contain continuous ordinary creature material beneath every occupied socket zone and enough silhouette to occlude donor collars, but no wing, tail, crown, shell-top, aura, or other swappable anatomy. A pattern can imply anatomy; a protruding detachable silhouette cannot.
- **Appendage job:** render the complete appendage only, with the full visible tip and a deliberately boring root collar extending behind the pivot. Do not crop at the visible seam and do not include a patch of body to make the picture look finished.
- **Paired anatomy:** far/near pieces are two render PNGs inside one atomic logical bundle. Generate the far piece first; generate the near piece against it so material, vein/plate rhythm, and silhouette family agree while perspective and depth remain distinct. A deliberately fused Hatchling yoke may be one `side.paired` card, as the current manifest already demonstrates.
- **Extra limbs or multiplied wings:** either use individually registered far/near layers or one declared yoke card whose hidden connected stock makes all visible lobes one swappable primary. Do not create four unrelated files with no shared attachment logic.
- **Floating eyes/orbiters/swarms:** use one slot card with an explicit component count and fixed relative layout when the elements move as a unit; use separate registered children only when they require independent springs. “Any number of random motes” is VFX, not pet anatomy.
- **Aura:** keep it out of the body. A static occult ring is its own root-centered/back-plane secondary with an exact component count; a glow, haze, particle orbit, or pulsing field belongs to the established VFX/particle pipeline and receives the same pet identity/palette reference.
- **Cut-line metadata:** every attachment records pivot, receiver, occluder, collar extent, and the part responsible for the visible seam/scar/stitch. Review tooling adds guides to previews; generated/installed art never contains guides.
- **Dependent children:** a `tailTip` ornament cannot travel without a primary that provides `tailTip`, unless the fusion recipe substitutes a documented fallback receiver. The compiler must close dependencies or reject the recipe; it may not leave a child floating.
- **Fusion sentinel test:** before promotion, swap each `free` primary/secondary bundle onto at least one round body, one long body, and one shell/hulk body in the same band. Keep the donor palette natively mismatched as pet-3 intends, then test the restrained whole-assembly coat wash and neutral tintable aura/orbit mode, mirrored and at spring extremes. The aim is not to pre-render every combination; it is to prove the reusable cut-line contract.

This is where pets are the opposite of the abandoned character wardrobe. A human shirt/head/hand seam carries a strict expectation of matching anatomy, tailored proportion, and continuous clothing; a mismatch reads as a broken avatar. A grafted moth wing on a stone tortoise, an off-center crown on an eel, or a brass tail on a plush blob reads as intentional evolution or mutation—as long as its pivot, overlap, depth, and palette seam are controlled. Creature asymmetry and additive anatomy make modularity a visual strength, while atomic bundles and covered collars keep it from becoming random broken assembly.

## Three literal example prompts

Each example below is the **literal job text appended directly to the literal house preamble above**. That concatenation is the complete generation prompt: there are no omitted placeholders. These are art-direction examples, not generated assets or final palette approvals.

### Cute / sliceable — Biscuit Jackalope, Biscuit Button crown

```text
# PET JOB — biscuit-jackalope / stage 1 Hatchling / ear-antler-crown

REFERENCE ORDER — BINDING
- Image 1: PET_BASE_JIG_V1. Geometry/ruler only; never copy guide pixels.
- Image 2: PET_BESTIARY_STYLE_BOARD_V1. Rendering breadth only; never copy creature content.
- Image 3: the promoted Biscuit Button Hatchling body. It establishes this pet's pear proportions, face, materials, palette, and lighting direction. Do not render that body.
- No earlier-stage version exists. No sibling part is needed.

PET IDENTITY — IMMUTABLE ACROSS ALL STAGES
- Display name: Biscuit Jackalope
- Identity sentence: A cuddly fist-sized frontier jackalope made of worn biscuit-tan velvet, comfort-first and mischievous, with enormous soft ears pierced by small horseshoe-shaped antler tines.
- Recognition locks: the two ears are wider than the body beneath them; each ear is pierced by one unmistakable horseshoe tine; the tail is a tiny bead, never a rabbit pom-pom.
- Exact palette roles: {"ink":"#111318","structureDark":"#5A4035","structureMid":"#B8835F","paperLight":"#E2CFB2","signature":"#A8482E","core":"#9FD8E8"}
- Permanent forbidden reads: no ordinary unpierced bunny ears, no realistic deer skull, no weapon antlers, no human clothing, no angel icon, no food item or biscuit pickup.
- Runtime-only VFX: none. DO NOT PAINT particles, dust, glow, or motion.

STAGE IDENTITY — THIS FORM
- Band: 1 Hatchling
- Named form: Biscuit Button
- Transformation thesis: a tiny pear-shaped comfort creature whose comically huge ear-and-antler crown promises later wing and canopy mutations.
- Target envelope after assembly: 29px maximum extent; size class compact.
- Body/foot law: root (512,510), +X axis L=256, virtual baseline y=638; four nub feet touch the baseline through one separate joined foot-yoke card.
- Whole-form read at gameplay size: an ear-crown pear—wide V ears above a small round body, four nubs below, one bead behind.
- Active logical bundles: core=Biscuit Button body; primary=joined four-nub-foot yoke; secondary=ear-antler-crown plus bead-tail.
- Full render inventory: body, four-nub-foot-yoke, ear-antler-crown, bead-tail.

THIS LOGICAL BUNDLE
- Logical slot: secondary
- Bundle ID: biscuit-button-crown; swap atomically with: ear-antler-crown.
- Dependency contract: requires the existing crown receiver on a closed body roof; provides no child socket.
- Fusion seam policy: native donor palette; collar role structureMid; fusionPolicy free.

THIS RENDER PART ONLY
- Positive description: One complete paired crown card: two enormous velvety V-shaped jackalope ears joined below by a broad hidden biscuit-tan scalp yoke. Each ear has exactly one small rounded antler tine shaped like a horseshoe passing through the velvet, with a neat dark stitched ring around the piercing. The ears droop slightly at their tips and remain sweet, soft, and blunt. This is one alpha-connected piece of creature anatomy, not a hat.
- Render socket: existing crown; parent: body; depth plane: 30; spring: antenna.
- Source pivot: (512,896); receiver anchor: raw (576,458.8), normalized (xL=0.25,yL=-0.20); rest angle: 0 degrees; mount scale: 1.
- Expected alpha components: 1; expected extent: width 0.85–1.20 L, height 0.90–1.25 L.
- Documented cut-line: the bottom 10–12% is a shallow convex scalp yoke centered on the pivot. It continues behind the body roof; the body owns the visible brow seam and fully occludes the yoke at rest and tolerance extremes. Keep both ear bases joined inside this hidden stock.
- Part-specific forbidden content: no pear body, eyes, muzzle, feet, bead-tail, aura, floating crown, separate second take, socket mark, pivot dot, or green hole between ear roots.

TASK
Generate exactly one 1024x1024 PNG for ear-antler-crown. Preserve every identity and geometry lock above. Before returning, verify one connected crown card, two and only two ears, one horseshoe tine through each ear, screen-right top-down view, pivot inside opaque scalp stock, clean hidden cut-line, exact palette, pure green field, and absence of the body, feet, and tail.
```

### Weird / eldritch — Manymoon Oracle, Hushbell body

```text
# PET JOB — manymoon-oracle / stage 1 Hatchling / body

REFERENCE ORDER — BINDING
- Image 1: PET_BASE_JIG_V1. Geometry/ruler only; never copy guide pixels.
- Image 2: PET_BESTIARY_STYLE_BOARD_V1. Rendering breadth only; never copy creature content.
- No creature identity reference exists. This body establishes the canonical Hushbell identity master.

PET IDENTITY — IMMUTABLE ACROSS ALL STAGES
- Display name: Manymoon Oracle
- Identity sentence: A companionable unknowable creature shaped like a hovering upside-down ritual bell, with a scalloped rim made from gentle eyelids and pebble moons that gather as it evolves.
- Recognition locks: the mantle is always an inverted bell rather than a jellyfish dome; one lead eyelid at the screen-right/front rim is the directional face while every other lid stays softly closed.
- Exact palette roles: {"ink":"#111318","structureDark":"#22252B","structureMid":"#5A6472","paperLight":"#CFC6AE","signature":"#B14BFF","core":"#9FD8E8"}
- Permanent forbidden reads: no hostile all-seeing eye monster, no targeting reticle, no human face, no church bell object, no realistic jellyfish, no enemy health bar, no cosmic background.
- Runtime-only VFX: quiet moon-orbit motion and a faint reduced-motion-safe core pulse. DO NOT PAINT bloom, star particles, rays, or space fog.

STAGE IDENTITY — THIS FORM
- Band: 1 Hatchling
- Named form: Hushbell
- Transformation thesis: one calm inverted bell and one pebble moon foreshadow a nested seven-moon orrery without making the baby form visually busy.
- Target envelope after assembly: 30px maximum extent; size class standard.
- Body/foot law: root (512,510), +X axis L=256, virtual baseline y=638; the mantle underside hovers 0.14 L above that baseline and the runtime shadow remains on the virtual baseline.
- Whole-form read at gameplay size: a single hovering bell scalloped by a quiet eyelid rim, three short feelers below, one moon above.
- Active logical bundles: core=Hushbell body with inseparable eyelid rim; primary=empty; secondary=joined ventral feelers plus one orbit.back moon card.
- Full render inventory: body, joined-three-feeler-card, pebble-moon-back.

THIS LOGICAL BUNDLE
- Logical slot: core
- Bundle ID: hushbell-body; swap atomically with: body.
- Dependency contract: this is the root and provides the existing receiver frame; the eyelid rim is inseparable identity anatomy.
- Fusion seam policy: native donor palette; fusionPolicy withBody.

THIS RENDER PART ONLY
- Positive description: Render only a squat hovering inverted bell mantle made of dark matte slate-violet card stock. Its top is softly domed, its hollow underside is visible in the high three-quarter view, and its lower rim forms seven broad scallops. Each scallop carries one simple closed eyelid line. The screen-right/front scallop has one tiny pale-blue lead lid opened only a narrow friendly sliver. Paint continuous closed underside stock behind the future ventral-feeler receiver and closed mantle stock beneath the orbit/crown zones. The creature is strange but calm, curious, and clearly a companion.
- Render socket: body root; parent: null; depth plane: 0; spring: none.
- Source pivot: (512,510); receiver anchor: raw (512,510), normalized (xL=0,yL=0); rest angle: 0 degrees; mount scale: 1.
- Expected alpha components: 1; expected extent: width 0.85–1.10 L, height 0.62–0.88 L.
- Documented cut-line: none on the root itself. The body must provide opaque structureDark/structureMid occluder stock around the ventral, crown, side, and root-centered orbit/aura receiver zones; do not draw socket marks.
- Part-specific forbidden content: no feelers, pebble moon, orbit ring, aura, loose eye-orbs, rays, floor shadow, second bell, labels, or body guide.

TASK
Generate exactly one 1024x1024 PNG for body. Preserve every identity and geometry lock above. Before returning, verify one connected inverted-bell body, seven calm rim scallops, only the lead lid slightly open, screen-right top-down view, alpha centroid registered to the root with the authored hover baseline, exact palette, pure green field, and no feelers, moon, aura, or VFX.
```

### Ascendant mega-form — Hearth Newt, Hearth Wyrm body

```text
# PET JOB — hearth-newt / stage 3 Ascendant / body

REFERENCE ORDER — BINDING
- Image 1: PET_BASE_JIG_V1. Geometry/ruler only; never copy guide pixels.
- Image 2: PET_BESTIARY_STYLE_BOARD_V1. Rendering breadth only; never copy creature content.
- Image 3: the promoted Awakened Kiln Salamander body. EDIT from it; preserve the exact broad charcoal smile-mask, furnace material language, root, baseline, socket registration, light direction, and outline character.
- Image 4: the promoted Hatchling Coalplip body. It is the lineage identity check, not a size or silhouette limit.

PET IDENTITY — IMMUTABLE ACROSS ALL STAGES
- Display name: Hearth Newt
- Identity sentence: A big-hearted charcoal traveling hearth creature with a broad friendly smile-mask, warm painted furnace coal, firebrick anatomy, and no dangerous emitted flame.
- Recognition locks: the broad charcoal smile-mask never becomes a predator face; the warm-glass belly coal remains the quiet center of every form.
- Exact palette roles: {"ink":"#111318","structureDark":"#22252B","structureMid":"#9E3B36","paperLight":"#C49A5A","signature":"#C0341F","core":"#FF8A2B"}
- Permanent forbidden reads: no hostile dragon, no lizard realism, no weapon, no turret, no healing cross, no pickup glow, no real fire, no oven appliance with no creature identity.
- Runtime-only VFX: pet-hearth-newt-ember-scale. DO NOT PAINT sparks, smoke, flame, heat haze, bloom, or emitted light.

STAGE IDENTITY — THIS FORM
- Band: 3 Ascendant
- Named form: Hearth Wyrm
- Transformation thesis: the coal pebble and low kiln become a long S-arched baby hearth-dragon with six oven-foot nubs, a huge soft solid-paper candle mane, and a forked poker tail. Hero mutation: Plume Burst; supporting mutations: Tail Unfurl and Limb Chorus.
- Target envelope after assembly: 52px maximum extent; size class mega.
- Body/foot law: root (512,510), +X axis L=256, virtual baseline y=638; three separate paired foot-yoke cards place all six blunt feet on that line. The long torso grows upward and rearward, not below the baseline.
- Whole-form read at gameplay size: a cozy S-shaped traveling hearth, long enough to fill the mega envelope, with six rhythmic feet beneath, an enormous flame-shaped mane above, and a forked tail behind.
- Active logical bundles: core=Hearth Wyrm body plus furnace-core; primary=three paired foot yokes; secondary=forked poker tail plus dorsal candle mane plus chimney crown.
- Full render inventory: body, front-foot-yoke, middle-foot-yoke, rear-foot-yoke, forked-poker-tail, furnace-core, solid-candle-mane, chimney-crown.

THIS LOGICAL BUNDLE
- Logical slot: core
- Bundle ID: hearth-wyrm-core; swap atomically with: body and furnace-core when the core overlay is marked withBody.
- Dependency contract: the body is the root, provides all three side-pair receivers plus rear, dorsal, crown, and core receivers, and must be closed beneath every optional graft.
- Fusion seam policy: native donor palette; body is required; furnace-core fusionPolicy withBody.

THIS RENDER PART ONLY
- Positive description: Render only the mature root torso and head: one long, thick, friendly baby-wyrm body arching in a clear horizontal S from a heavy rear oven mass to the familiar broad charcoal smile-mask at screen right. Its anatomy is matte basalt and muted firebrick, built from two or three huge clean segments rather than many scales. The belly contains a closed dark bezel/backing plate for the separate furnace-core overlay, but no bright coal. The back provides a broad closed roof beneath the future solid candle-mane; the underside provides three wide ordinary firebrick occluder zones for the separate foot yokes; the rear ends in closed stock for the separate forked tail. Preserve the exact friendly mask proportions from the references. Make the body visibly denser and longer than Kiln Salamander while remaining cozy, rounded, and pet-like.
- Render socket: body root; parent: null; depth plane: 0; spring: none.
- Source pivot: (512,510); receiver anchor: raw (512,510), normalized (xL=0,yL=0); rest angle: 0 degrees; mount scale: 1.
- Expected alpha components: 1; expected extent: width 1.55–2.05 L, height 0.72–1.05 L.
- Documented cut-line: none on the root. The body owns visible seam lips and provides at least 0.12 L of opaque closed backing around every foot, rear, dorsal, crown, and core receiver. No connector may be a hole or exposed generic joint.
- Part-specific forbidden content: no feet, tail, mane, crown, bright furnace coal, actual flame, sparks, smoke, aura, emitted light, floor shadow, or second creature.

TASK
Generate exactly one 1024x1024 PNG for body. Preserve every identity and geometry lock above. Before returning, verify one connected long S-body, exact friendly smile-mask, root and virtual baseline unchanged from the earlier bodies, all receiver zones closed, screen-right top-down view, exact palette, pure green field, and no feet, tail, mane, crown, core glow, or VFX. The source may be huge; do not shrink it to the Hatchling. The later whole-form normalizer, not this generation step, fits the approved assembly to the 52px Ascendant target envelope.
```

## Generation review checklist

A candidate is rejected at the first failed section; attractive rendering does not waive an earlier rig or gameplay gate.

### 1. Canonical job and provenance

- [ ] Stable pet ID, band, form key/name, exactly two lineage anchors, transformation thesis, size class/target envelope, logical bundle, `PET_FORM_SLOTS_V1` slot, `fusionPolicy`, and full inventory all match the frozen pet-1/pet-2 records.
- [ ] Prompt/style/jig/socket versions and reference file hashes are recorded; reference order matches the prompt; this attempt has its own raw, log, rejection note, and hash.
- [ ] The job's function is not used as a health/ammo/XP/economy/revive icon. Mechanical overlap does not alter art direction.

### 2. File and alpha mechanics

- [ ] Raw is one 1024×1024 PNG on uniform opaque `#00ff00`; keyed derivative is 1024×1024 RGBA with real transparency, no checkerboard, and no green fringe inside the creature.
- [ ] Alpha bounds retain at least 32 px emergency inset after registration (the prompt asks for 64 px before processing); opaque coverage is within declared sane range; alpha component count equals the part record exactly.
- [ ] No floor/contact shadow, environment, guide, pivot mark, text, watermark, baked particles, bloom, or undeclared extra island.
- [ ] Pivot lies in opaque stock (`alpha >= 64`), parent exists earlier in assembly order, receiver is known, plane/rest angle/mount scale/spring are finite, and no dependency is unresolved.

### 3. Anchor, baseline, and normalization

- [ ] Body root is `(512,510)`, faces +X, and uses `L=256`; grounded contact or the declared hover gap is within 4 source pixels of virtual baseline `y=638`.
- [ ] Existing connectors remain within 4 source pixels / 2 degrees of their approved references. Registration moved the cutout; it did not redraw or non-uniformly stretch it.
- [ ] The unnormalized assembled form preserves authored relative part extents. One uniform whole-form scale produces `targetEnvelopePx ± 0.25 px`; root remains `(0,0)` in the runtime assembly and the baseline does not wander.
- [ ] Shipped forms remain exactly 30/37/44 unless deliberately re-authored; a new compact/hulking/mega value lies within its approved band and is monotonic across that line.

### 4. Slice and seam quality

- [ ] The part contains only its declared anatomy. Compare against the full inventory: body has no detachable wing/tail/crown/aura; appendage has no patch of body; orbit card has only its declared satellites.
- [ ] Body art is closed and attractive with every optional `free` part removed. `withBody` parts are correctly inseparable and cannot leave a hole in a legal recipe.
- [ ] Attachment root covers its pivot with 10–12% ordinary hidden stock; documented occluder covers it at rest, mirrored, at ±4 px/±2°, and through the full spring angle. No daylight, green wedge, severed outline, or generic ball-joint read appears.
- [ ] Near/far pieces agree in material, motif rhythm, and scale but retain correct perspective and far/near depth. Paired parts, multi-tail trees, and parent/child ornaments move atomically.
- [ ] Tool-generated exploded view makes every ownership boundary and cut-line obvious; the normal composite hides every production seam.

### 5. House style and identity

- [ ] Beside the fixed Verdant/Brass/Slate breadth board, the part belongs to the same game: chunky original silhouette, one heavy imperfect near-black contour, sparse interior ink, matte stock, base + one hard shadow + at most one hard highlight.
- [ ] Only the six declared palette roles carry meaningful painted color; bright signature/core area is restrained; no gradients, airbrush, soft anime, glossy 3D, photoreal, pixel, or over-rendered micro-detail drift.
- [ ] Creature face is intentional and identity-specific. It may be cute, strange, or many-eyed; it is neither an accidental human face nor erased merely because the character roster has a no-face rule.
- [ ] Companion warmth/curiosity survives the form. Even a coffin, eye-orbit, or giant machine does not read first as enemy, boss, pickup, turret, telegraph, or combat target.

### 6. Evolution and gameplay-size read

- [ ] In a shuffled **64 px solid-black silhouette** test, reviewers can place Hatchling, Awakened, and Ascendant in order without color, glow, labels, or VFX.
- [ ] Hatchling reads as one compact promise; Awakened changes at least two of aspect ratio, appendage count, locomotion, negative space/islands, or contour texture; Ascendant changes at least three and clearly performs its named hero mutation. Exactly two lineage anchors remain.
- [ ] Both color and grayscale composites read at their actual target extent (legacy 30/37/44 or authored target), on representative dark and light arenas, moving screen-right and mirrored left. The faceward direction, major appendages, and form name's visual promise survive reduction.
- [ ] At four-player density the pet is not confused with the owner, projectiles, pickups, hazards, enemies, or another approved pet silhouette. No critical feature depends on subpixel lines or a tiny color-only symbol.
- [ ] Rest bob, follow tilt, downed tint, reduced motion, spring motion, and shadow placement do not open seams or turn detached satellites into visual noise.

### 7. Fusion readiness

- [ ] Every `free` group is assembled on round, long, and shell/hulk sentinel bodies in the same band; `withBody` is used only for a real closed-anatomy dependency, never to avoid doing a clean cut.
- [ ] Native donor colors remain legible without forced matching; the restrained coat wash preserves ink/value hierarchy; only neutral aura/orbit/keepsake layers accept spark tint cleanly.
- [ ] Side pairs and rear subtrees remain complete, required receiver/provided child sockets resolve, and maximum-extent warning is honest. No part is copied into a receiver-specific bespoke raster.
- [ ] Manifest retains `donorPetId`, stable `formKey`, semantic slot, parent/child group, source texture path, and promotion hash so the runtime can resolve the donor directly.

### 8. Promotion

- [ ] Machine report is green; all required preview boards exist; reviewer recorded pass/fail for style, identity, slice, scale, gameplay, and fusion sentinels.
- [ ] The named winner hash—not “candidate 2” generically—is approved. Rejection opens a new immutable attempt with precise feedback; it never overwrites a raw or silently edits installed pixels.
- [ ] Generated manifest has zero missing, extra, or invalid rows and agrees by set equality with the canonical roster/forms/parts. Pet asset paths participate in the repository asset check before release.

## Cost and production volume

Pet-2's recommended 2–3 / 4–5 / 6–8 cutout cadence means **12–16 installed PNGs per unbranched three-band line**; use 15 as the planning mean. Therefore:

| Scope | Installed part estimate | Notes |
|---|---:|---|
| 16 pet-1 additions | 192–256; **240 planning** | Matches pet-1's representative 3/5/7 estimate. |
| All 24 default lines at the new cadence | 288–384; **360 planning** | Includes dramatically refreshed shipped lines rather than assuming all 72 old files satisfy the new trees. Reuse is a review decision, not a quota. |
| Each extra Ascendant branch | +6–8 | Pay only for pet-2's frozen branch endpoints; never multiply every line by default. |
| Fusion pairs | **0 new creature PNGs** | 24 identities create 276 unordered pairs; art cost remains registered donor groups plus a small neutral keepsake/aura set. |

The current 72 installed PNGs total 9.81 MiB, averaging about 139.5 KiB each. At that observed compression, 240 expansion files are roughly **33 MiB** and a 360-file default fleet roughly **49 MiB**, before branches; multi-island cards may be larger. Runtime still loads only the selected form's loose textures, but 6–8 Ascendant layers versus today's maximum four doubles per-pet draw calls and must pass pet-5's four-player/LOD budget.

Generation-call budget uses the existing one-image, isolated-job discipline:

- Per line, body identity work is 3 Hatchling + 2 Awakened + 3 Ascendant candidates = 8 calls.
- Non-body render parts start with one call apiece and are regenerated only from a specific failed gate.
- For 16 additions at the 240-file planning count: 128 body calls + 192 non-body calls = **320 initial calls**. Reserve 25–40% for seam, silhouette, palette, and semantic failures: **400–448 calls**.
- For all 24 lines at 360 planned files: 192 body calls + 288 non-body calls = **480 initial**, or roughly **600–672 with reserve**. Each branch adds about 8–10 more calls under the same policy.

At the 2–6 machine minutes per isolated generation observed in adjacent artkit planning, Wave A/B production is about **13–45 serial machine-hours** for the additions before queue/rate-limit delays. Human review is the expensive portion: 48 new default forms × roughly 15–25 minutes for silhouette, assembly, gameplay, and sentinel decisions is **12–20 hours**, plus approximately 4–8 hours for style lock, palette assignment, branch/fusion boards, rejection feedback, and final wave regression—about **16–28 human production hours** for the 16 additions.

One-time pipeline engineering is approximately **5–8 engineering days**: strict canonical compiler and dependency graph; fixed jig/reference/provenance/promotion flow; `PET_FORM_SLOTS_V1` socket-frame/manifest extension; component/palette/baseline/extent/assembly/fusion checks; contact sheets; and pet integration into asset/check drift gates. Pet-5's account/protocol/UI/runtime migration is separate and not hidden inside this estimate.

## Handoffs needed from the other four tracks

| Track | Binding input this pipeline needs | Cost if late or changed |
|---|---|---|
| **pet-1 roster** | Freeze all 24 IDs, wave order, base silhouette phrase, distinctive recognition feature, permanent forbidden read, material intent, and palette direction. The 16 names and two waves in its report are the current baseline. | An ID or primary hook change after Hatchling promotion strands all three stages and fusion provenance. Palette direction missing at compile time forces inconsistent ad-hoc swatches. |
| **pet-2 evolution** | Freeze `PET_FORM_SLOTS_V1`, stable form keys, branch count, exact per-form recipe, two lineage anchors, transformation/hero mutation, `free|withBody` candidates, cutout budget, and size class/target envelope. | Socket/form-key drift invalidates prompts, manifests, saved fusion sources, and approved composites. Branches are a direct +6–8 PNG cost each. |
| **pet-3 fusion** | Freeze atomic group/subtree rules, same-band donor policy, adversarial receiver set, palette/tint contract, `fusionPolicy`, neutral aura/orbit requirements, and launch keepsake list. | Over-broad “anything swaps individually” breaks pairs/dependencies; late palette policy forces rerendering collars/aura masks or multiplies QA. |
| **pet-5 systems** | Versioned form/socket/manifest schema; donor-aware texture resolver; `(petId, band, formKey)` selection; per-form envelope/baseline consumption; new receiver and motion behavior; declared layer/performance limits; manifest-v1 fallback; catalog↔manifest and asset checks. | Art can be generated and reviewed out of runtime, but cannot be declared fusion-ready or installed safely without donor resolution, form keys, and performance/compatibility gates. |

Owner involvement is concentrated into taste decisions, not mechanical triage: approve `PET_BASE_JIG_V1` plus the three-pet breadth board, approve each wave's black-silhouette/form board and new palettes, then select mechanically valid promoted assemblies in batches. The owner never needs to inspect invalid alpha, connector, or dependency attempts.

## Assumptions; no blocking owner question

- Proceed with pet-1's **24 total identities in two waves**, while reporting the current shipped truth as 8 identities / 24 stage forms / 72 parts.
- Treat pet-2's named forms and `PET_FORM_SLOTS_V1` as design authority, but do not pretend its new physical sockets already ship. The implementation pass versions them through the existing assembler/manifest path.
- Preserve 30/37/44 for legacy forms. To honor the owner's explicit chibi-to-hulk scale direction, allow the per-form target ranges in this report and provisionally cap an Ascendant mega at 54 px; pet-5 may lower the cap after four-player obstruction tests, in which case silhouette mass must carry the “mega” read.
- The example Biscuit/Manymoon palettes are production-direction proposals because pet-1 freezes identities, not exact swatches. They enter the canonical record only after the wave palette board is approved.
- Static matte aura cards are part art; emitted glow/particles remain VFX. No visual slot carries stats.
- No owner choice blocks the pipeline design. Ascendant branch count, final palette picks, and saved-fusion limits can be frozen at their respective roster/art/system gates without changing the architecture.
