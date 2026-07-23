# Pet Layer Rendering / Depth Design

## Understanding

The requested feature is a rendering-only two-image pet treatment: one back image and one front image are stacked at distinct visual depths, with the front layer moving against the back so pets inherit the alive, separated-piece bobbing feel of character heads. This design will verify and reuse the existing character `SpriteRig.ts` head-spring, document current pet rendering and part-slot constraints, and specify ordering, motion, performance, reduced-motion, examples, and pipeline handoffs. It will not change product code, assets, or tests.

## Plan

1. Read the durable-report guidance, the character head-rig design, and the real `SpriteRig.ts` spring implementation.
2. Trace current pet data, manifest slots, and draw path from source to renderer.
3. Specify the two-layer depth model, spring reuse, motion tuning, sorting, compatibility, performance, and reduced motion.
4. Separate reused machinery from genuinely new work and define exact handoffs to `pet-layer-pipeline`.
5. Record evidence, assumptions, and implementation-ready recommendations in this report only.

## Assumptions

- “Two layers” means exactly two authored pet image surfaces for the base treatment: a back/far layer and a front/near layer; existing cosmetic/evolution/fusion assembly may feed those surfaces without changing the rendering contract.
- The live game processes on ports 5180/2567 are out of scope and will not be touched.
- Repository inspection is read-only; this report is the only file this Sol will create or modify.

## Findings

### Verified baseline

The repository already contains both halves needed for this feature; the implementation should connect them rather than invent another animation system.

- The character follower is exported from `packages/client/src/entities/SpriteRig.ts`. `FloatingHeadSpringState`, `FloatingHeadSpringInput`, `FLOATING_HEAD_SPRING_TUNING`, and `stepFloatingHeadSpring` are presentation-only scalar state and an allocation-free closed-form step (`SpriteRig.ts:1334-1509`). The shipped values are angular frequency `8.4 rad/s`, damping ratio `0.48`, an elliptical `4 px × 4 px` displacement bound, `72 px/s` velocity bound, `50 ms` timestep cap, and reduced-motion `30 rad/s` critically damped follow with a `0.35 px` bound (`SpriteRig.ts:1377-1389, 1434-1503`). It zeroes authored offsets and impulses under reduced motion, rebases cleanly, removes outward velocity at the bound, and recovers from non-finite state.
- The character does not use a free-running “head animation.” Its locomotion source is the distance-driven stride clock (`SpriteRig.ts:8304`; posture stride lengths are in `packages/client/src/sprites/pose-language.ts:670-772`). `stepBeat = sin(2 × stridePhase)` drives the body while `headBobPx = -stepBeat × postureAmplitude × gait`, so the head is counter-phase to the body/footfall (`pose-language.ts:864-892`). Actual posture amplitudes are `0.60`, `0.75`, `0.90`, and `1.80 px`; the exported generic helper carries `1.15 px` (`SpriteRig.ts:1377-1402`). The final head sync runs late and feeds body-relative socket, movement counter-bob, dash/slide lag, air hang, landing dip, attack lead, acceleration impulses, and reduced-motion/reset state into that one follower (`SpriteRig.ts:7772-7873, 10698-10724`). This confirms the mechanism requested by the owner is real and reusable.
- Current pet gameplay identity is eight stable IDs across three stage bands. Accounts/systems expose only stable logical `core | primary | secondary` slots; those slots are expressly intended to survive later fusion/evolution art replacement (`packages/shared/src/pets.ts:6-33`). They are not render-depth planes and must not become them.
- The generated pet manifest is complete: schema 1 / `PET_SOCKET_FRAME_V1`, root `(512,510)`, body axis `256`, 72 expected and 72 installed PNGs, and no missing, extra, or invalid records (`packages/client/public/sprites/pets/pet-parts-manifest.json:1-137, 7434-7436`). Every render part already carries a logical slot, parent, pivot, receiver anchor, rest angle, mount scale, numeric plane, optional angular spring, alpha bounds, and image dimensions (`packages/client/src/sprites/pet-parts.ts:4-44`). `assemblePetStage` resolves and uniformly scales those loose images to `30 / 37 / 44 px` stage envelopes, sorts by numeric plane, and returns retained local transforms (`pet-parts.ts:80, 141-223`).
- `PetRig` already draws the form as a retained Phaser container with one image per assembled part. The manifest currently yields exactly 2/3/4 images in Hatchling/Awakened/Ascendant. Parts use their numeric child depth and optional angular spring; the whole form also follows, orbits, hovers, darts, flinches, celebrates, mirrors, squashes, tints, fades around its owner, avoids exact telegraphs, sleeps offscreen, and falls back to Hatchling art if the requested band is missing (`packages/client/src/entities/PetRig.ts:281-373, 461-725, 727-914`). No method writes gameplay state.
- Separation alone is not yet the requested rig. Every current form has one physical `body` bitmap plus optional parts; none declares a guaranteed body-owned back/front carrier pair or translational travel envelope. Tagging an optional wing/shell as the second surface would fail when fusion removes that group and could expose unpainted pixels. The completed sibling pipeline therefore correctly requires coordinated body-pair production for each activated v2 form rather than treating current PNG separation as proof of compliance.
- Current whole-pet hover is already a usable carrier: normal motion evaluates `sin(now × 2π × 1.55 + orbitAngle) × 2.5 px`, or `× 1 px` under reduced motion; downed motion uses a separate `1.4 s` period and `1 px` amplitude (`PetRig.ts:619-630`). Because the time-varying `orbitAngle` itself runs at `1/2.8 Hz`, the normal expression's actual cadence is about `1.91 Hz`, not a pure `1.55 Hz`. This design will sample the exact existing carrier value/phase rather than add a second clock or silently retune existing root motion.
- World depth is intentionally atomic. Characters round their grounded screen-Y and put the entire `SpriteRig.root` at that depth (`SpriteRig.ts:3789-3795`; `ArenaScene.ts:9735-9736`). Pets put their entire root at `min(petFollowY - 2, ownerY - 2)`, which keeps a pet behind its owner while still sorting the pet against the world (`PetRig.ts:650-656`). The shadow, pet images, and owner mark are children. Internal image motion therefore must never alter world depth or allow one pet layer to interleave with another entity.

### Decision recorded during investigation

“Two layers” is a **two-motion-plane contract**, not permission to flatten or redraw the assembled pet every frame. A simple authored pet should normally be exactly one back PNG plus one front PNG, matching the owner's literal two-image ask. Evolution/fusion forms may already require several registered cutouts; in that case all selected cutouts are partitioned into one synchronized back plane and one synchronized front plane. The player still sees the same two stacked surfaces, while logical bundles, donor provenance, optional angular springs, and current texture loading remain intact. Dynamic render textures, duplicate full-form draws, masks, filters, and per-part translational springs are rejected.

The back plane is the pet's far/anchor surface. It stays at the assembled rest transform inside `PetRig.root`. The front plane is the pet's near/follower surface. Every front member receives the same bounded local `(x,y)` translation after normal assembly; its own existing pivot rotation may still run. Which art belongs to which plane is authored metadata, not inferred from `core/primary/secondary`, filename, parent, or the sign of the existing numeric `plane` value. This is required for all three intended compositions: `body back + overlay front`, `wing/shell/glow back + body front`, and atomic bundles that span both depths.

The resulting contract is specified below and reconciled with the completed `pet-layer-pipeline` report.

## Rendering specification

### 1. Two-layer model

Each resolved pet form has exactly two possible **depth roles**:

| Role | Meaning | Runtime transform |
|---|---|---|
| `back` | Farther/anchor surface. It establishes the stable mass or field against which separation is read. It may be a body, shell, far wings, aura, tail mass, or another complete cutout. | Existing assembled position/rotation/scale only; shared pet-root transforms still apply. |
| `front` | Nearer/follower surface. It visually overlaps the back surface and is the only surface translated by the bounded layer spring. It may be a body, face/core overlay, near wing, creature emerging from a shell, or another complete cutout. | Existing assembled position/rotation/scale plus the one shared sprung local offset `Δfront`. |

Aligning with the completed `pet-layer-pipeline` handoff, the next manifest revision adds `depthLayer: "back" | "front"` to every physical part of a two-layer form and a stage/form `depthRig` record with profile `pet-bob-v1`, body-axis-normalized `frontPivotL`, `frontRestOffsetL`, and the production-reviewed `authoredTravelL`. Call the part field `depthLayer`, not `plane`, because the existing numeric `plane` remains the fine draw order within a layer. All of this is generated art/render metadata. None is added to `PET_PART_SLOTS`, accounts, public player state, a fusion save, or gameplay catalogs.

Every activated v2 form contains a required, atomic `withBody` **depth-carrier pair**: at least one body-group back cutout and at least one overlapping body-group front cutout. A body donor brings that pair together, so removing optional wings, shell, crown, aura, or other fusion groups can never empty one surface. A simple form normally makes the pair exactly two PNGs. Missing/unknown depth metadata or an old v1 manifest uses the exact current static numeric-plane rendering. It must never duplicate a bitmap, infer a role from `plane > 0`, show half a carrier pair, or drop the pet.

One optional logical bundle may span both depth roles. A wing bundle can contribute a far-wing image to `back` and a near-wing image to `front`; fusion still selects the atomic wing bundle once. Conversely, several semantic parts can share one role and move as one surface. The result remains two motion surfaces even when the assembly has more than two drawables.

`frontRestOffsetL` is converted once as `frontRestOffsetPx = frontRestOffsetL × stage.body.axisLength × assembly.scale` and added to every front member's immutable assembled base position. It is normally zero because coordinated full-canvas layers share registration. `frontPivotL` is the root-relative, semantic-right, `+Y`-down reference point recorded for art proof and any future group rotation; `pet-bob-v1` permits **zero group rotation**, so translation is pivot-independent at runtime. The pipeline converts this renderer's final `±4 px` post-normalization travel into per-form `authoredTravelL`, requiring each axis to be at least `4 / (stage.body.axisLength × assembly.scale)`; runtime never expands beyond that approved envelope.

### 2. Frozen motion law

There is one `FloatingHeadSpringState` and one reused `FloatingHeadSpringInput` per `PetRig`, never one per part. In rig-local screen-pixel coordinates, the back surface stays at `(0,0)` and the front surface uses the spring output. The character integrator and these tuning values remain byte-for-byte/behavior-for-behavior identical:

- angular frequency `8.4 rad/s` (natural frequency about `1.34 Hz`);
- damping ratio `0.48`;
- displacement clamp: the current `4 px × 4 px` ellipse;
- velocity clamp `72 px/s`;
- timestep clamp `50 ms`;
- reduced/downed mode: critically damped at `30 rad/s`, authored offsets/impulses disabled, residual clamp `0.35 px`.

Pet-specific adaptation happens only in the **driver**, not the spring. Let:

```text
C = sin(nowSeconds × 2π × 1.55 + orbitAngle)          // exact current normal-hover carrier
S = clamp(max(assembly.width, assembly.height) / 44, 30/44, 1)
A = FLOATING_HEAD_SPRING_TUNING.walkBobPx × S         // 1.15 px × size scale

authoredOffsetX = 0
authoredOffsetY = -C × A
```

This yields target amplitudes of about `0.78 px` at the current 30 px Hatchling envelope, `0.97 px` at 37 px Awakened, and `1.15 px` at 44 px Ascendant. Those values sit inside the character's proven `0.60–1.80 px` locomotion range without making a tiny pet's split read as a loose joint. Larger future forms remain capped at `1.15 px`; they gain presence from silhouette, not exaggerated separation.

The negative sign is the important character reuse. When the current pet root carrier is positive and the back surface moves down by `+2.5 px`, the front target moves `A` upward relative to it. The front still moves generally with the pet, but less than the far mass and with spring lag. That is the same counter-bob principle as a character head versus a downward footfall: apparent inertia and depth, not a second independent bounce.

Do not call `sampleFloatingHeadWalkBob()` with a fabricated pet stride. Characters have a real distance-driven footfall phase; pets currently have no gait/footfall clock and already have a stable per-rig hover/orbit phase. Reusing the pet's carrier preserves current crowd de-synchronization and avoids a third oscillator. If a future grounded-pet rig exposes real foot contacts, that future rig may supply its distance-driven beat to the same follower; it is not part of this two-layer change.

The spring also receives restrained root-inertia excitation using data `PetRig` already computes for its angular parts:

```text
springDt = min(deltaSeconds, 0.05)
localAx  = followAccelerationX × rootFacing
localAy  = followAccelerationY × projectionScaleY
signalX  = clamp(localAx / PET_FOLLOW_TUNING.maxAcceleration, -1, 1)
signalY  = clamp(localAy / PET_FOLLOW_TUNING.maxAcceleration, -1, 1)
impulseX = -signalX × 72 × springDt
impulseY = -signalY × 64 × springDt
```

This deliberately reuses the character's `72/64 × dt` X/Y impulse gains (`SpriteRig.ts:7857-7860`) and the pet follow spring's existing `2,600 px/s²` authored acceleration ceiling (`PetRig.ts:28-33`). Mirroring local X before the container transform makes the visible front plane trail the same screen-space direction in both facings. There is no free-running X sway, scale pulse, shear, or independent rotation in this base technique. Existing part-specific angular springs remain optional on top of the one shared translation.

Driver rules by state:

- **Normal follow/orbit/idle:** periodic counter-bob plus acceleration impulses are active.
- **Dart, turn, flinch, personality, celebration:** do not reset the layer spring. Root-carried presentation continues, while legal follow acceleration supplies bounded carry-through. A personality animation does not acquire another pet-specific layer oscillator.
- **Downed:** pass `reducedMotion = true` to this layer follower even when the accessibility setting is off. Periodic offset and impulses stop; the layers critically settle together inside `0.35 px`. Existing whole-pet droop/downed hover remains authoritative.
- **Reduced motion:** use the character's exact reduced path. The existing whole-pet `1 px` hover remains unchanged, but no new relative periodic motion or inertia is added. Do not snap the front to a different anchor.
- **Rebase:** reset on first art install, pet/band/form/recipe replacement, long frame gap (`deltaMs > 180`), offscreen wake, and the hidden teleport relocation. Do not reset on ordinary follow, dart, attack sequence, stage-independent tint, flinch, or celebration. A teleport may keep its current relative pose during the 70 ms fade, then rebase while hidden before the destination dart.

### 3. Local and world depth order

The pet remains one world-sorted object:

```text
PetRig.root  worldDepth = min(followY - 2, ownerY - 2)   [unchanged]
├─ shadow                                                     first
├─ back members     sorted by existing numeric plane, then manifest order
├─ front members    sorted by existing numeric plane, then manifest order; add Δfront
└─ owner mark                                                  last
```

This exact ordering must be created in the container's child list. Phaser 4.1 containers render children in list order and warn that child display depth is not independently flexible (`packages/client/node_modules/phaser/src/gameobjects/container/Container.js:23-42, 61-65`); current correctness comes from `assemblePetStage` sorting parts before `buildParts` adds them, followed by `bringToTop(ownerMark)`. Do not rely on `image.setDepth()` to separate the two depth roles inside the container, and do not add nested back/front containers merely to obtain a group transform. A flat retained list plus `assembly.x/y + frontRestOffset + Δfront` position writes is cheaper and unambiguous.

The front translation is presentation-only and never changes `PetRig.worldX/worldY`, the root world-depth key, owner overlap fading, follow targets, camera state, shadow authority, or any server data. Both surfaces therefore remain together behind their owner and cannot interleave with a player, another pet, an enemy, floor object, pickup, projectile, hazard, or telegraph. The existing paper-world capture sees the same single `PetRig.root`.

For the top-down-ish camera, “front” means the near/occluding painted plane, not a lower world-Y entity. At rest, near details should generally sit lower on the screen and cover a completed far surface. During bob they may reveal only authored underlap, never chroma/transparent holes. Relative motion is screen-local after the pet's world projection, so a `+Y` layer displacement is not permission to re-sort the pet in world space.

Keep two bounds in `PetRig`: the current rest assembly radius for the shadow and owner mark, and a presentation/avoidance radius expanded by the unchanged `4 px` maximum. `ArenaScene.writePetTelegraphAvoidance` must receive the expanded radius so a front extreme cannot enter an exact telegraph band while the root is judged clear. Do not make the shadow breathe from the relative front offset; its current whole-pet hover response remains enough.

### 4. Three concrete reads

These are target two-layer assignments, not a claim that every current PNG has enough hidden underpaint to move today. The pipeline must inspect/re-author any seam that fails the full travel grid.

| Pet treatment | Back / far surface | Front / near surface | Why the bob reads as depth and life |
|---|---|---|---|
| **Hearth Newt furnace breath** (`body back + overlay front`) | Required `body.back` is a complete coal-dark body underpaint; tail and other optional far parts join it. | Required `body.front` owns the belly/face furnace bezel; optional belly-lens/flame-crest members join the same moving surface and retain their own weighty/flutter rotations. | The warm core gently lags upward when the body settles down, like heat and a soft belly carried inside a heavier stone body. The back carrier must contain finished dark underpaint beneath the full `±4 px` front travel. |
| **Verdant Wing leaf flier** (`wings behind + body front`) | Required `body.back` supplies a closed underbody/wing-root carrier; the selected far-wing cutout adds the broad leaf silhouette behind it. | Required `body.front` is the creature's face/chest mass; selected near wing and antenna crest join it. | The wing silhouette carries the root hover while the body counter-bobs by under a pixel to `1.15 px`, so the creature appears suspended over its leaf planes. The atomic body pair keeps the effect alive even if fusion removes the optional wing bundle; all selected front members share the translation so the near wing does not tear off the body. |
| **Copper Snail carried home** (`shell back + creature front`) | Required `body.back` owns the shell/underbody mass as a `withBody` carrier; optional far pannier art joins it. | Required `body.front` owns the snail face/leading body and near straps/pannier details. | The creature peeks and settles against the steadier carried home rather than the whole icon moving as one sticker. Current shell art uses a positive numeric plane, so this target requires an intentional atomic reslice/repaint and fusion-policy decision, never automatic `plane` sign conversion. |

A glow case uses the same rule without a seam: a future Pale Firefly matte aura/glow card is `back`, while body/near-wing art is `front`. The aura remains spatially calm as the insect counter-bobs over it. Runtime bloom/particles stay outside these two images and follow existing VFX policy.

## Compatibility and non-regression requirements

### Part slots, evolution, and fusion

- Preserve shared `PET_PART_SLOTS = core | primary | secondary` and all stage-band/Bond behavior unchanged. `depthLayer` describes how a selected physical part is drawn; it is never a fourth saved slot, a selectable trait, or a mechanic.
- Preserve all current assembly fields and optional angular springs. A part's numeric `plane` orders it only among members of the same depth role. `depthLayer` takes precedence only for the major back-before-front partition.
- A stage/band art rebuild destroys old images and rebases the one layer spring before showing the new rest geometry. The existing missing-stage-to-Hatchling fallback uses the Hatchling stage's own motion metadata.
- A fusion recipe continues to select logical bundles and donor parts. Its required body donor always brings the complete atomic depth-carrier pair; every other resolved donor part brings its manifest-authored `depthLayer`, which the account does not copy. Atomic paired bundles and parent/child subtrees may span both surfaces but are selected together. A resolver that cannot produce both required carrier surfaces rejects/falls back to the canonical body form before rendering; it never fabricates a duplicate or displays only one half.
- Preserve the current atomic load gate: `syncArt` calls `buildParts` only after every texture in the resolved stage reports ready. A missing desired canonical stage falls back to its complete Hatchling form as today; a failed fusion appearance falls back to its complete canonical Heart/body descriptor. Never keep the previous back with a newly loaded front or reveal either carrier half early.
- The evolution ceremony's `buildStageVisual` may remain static, but its child ordering must use the same back-then-front partition so the rest composite shown in the card matches the world form. It does not need a perpetual spring or tween for this feature.

### Existing pet presentation

- Whole-pet follow/orbit/dart/teleport, heading mirror, squash, hover, projection, personality, celebration, flinch, downed tint, alpha fading, owner overlap, telegraph avoidance, paper-world capture, and world sorting remain the pose owners. The front follower samples them or layers inside them; it writes back to none of them.
- Tint/alpha/visibility applies identically to every member. The front may not remain bright or visible when the back is downed, hidden, sleeping, or teleported.
- Part angular springs continue to set `assembly.rotation + angle`. Shared front translation is then applied to the part's retained base `assembly.x/y`; it does not accumulate into those bases frame to frame.
- The layer has no collider, hurtbox, pickup radius, pet-mod authority, aim/attack origin, network field, camera anchor, shadow authority, or world-depth authority. Its presence changes zero simulation outcomes and zero steady-state network bytes.

### Performance with many pets

The feature's runtime budget is one small scalar state/input pair and one closed-form spring step per visible pet. Applying the output is one conditional pair of position writes per existing front member during the loop that already visits parts. It creates no steady-state allocations.

Draw calls must not double. A simple form with two authored PNGs draws twice. A modular/evolved/fused form with `N` existing cutouts still draws `N` cutouts, grouped into two depth roles; it never draws two copies of the `N`-part assembly. Do not use a per-pet render texture, canvas composite, mask, filter, shader, blend pass, nested motion container, perpetual Phaser tween, or per-part translational follower. Reuse current selected-form lazy loading and offscreen sleep; on wake, rebase rather than simulate missed time.

Performance acceptance is no measurable regression from the same part census beyond the one spring calculation and coordinate writes: profile the maximum supported visible-pet/cutout scene before activation, with allocation instrumentation showing zero steady allocations. Adopt the broader pet-art ceiling already proposed by the evolution pipeline: at most **12 physical cutouts per resolved form** (therefore at most 11 on either surface because the body pair keeps both non-empty). The four-player stress case is 48 pet images plus existing shadows/marks, not “four pets” with an unspecified layer count. A generated manifest above that ceiling fails asset validation; runtime does not silently omit art. Report CPU/render cost by **resolved image count**, not merely pet count.

## Reused versus genuinely new

| Reused unchanged | Genuinely new |
|---|---|
| The exact closed-form `stepFloatingHeadSpring` math, state/input semantics, `8.4 / 0.48 / 4 / 72`, finite guard, `50 ms` cap, and `30 / 1.0 / 0.35` reduced path. | One manifest/render classification, `depthLayer: back | front`, a `pet-bob-v1` depth-rig record, plus backward-compatible activation/fallback rules. |
| Character counter-bob principle and generic `1.15 px` amplitude constant. | A pet driver that samples the existing pet hover carrier, size-scales only the authored amplitude, and normalizes existing follow acceleration into the proven character impulse gains. |
| Existing `PetRig.root`, whole-pet follow/hover/pose/alpha/tint/LOD, manifest assembly, numeric part planes, texture loading, and optional angular springs. | One shared front-layer state/input per `PetRig`, lifecycle rebases, and non-accumulating application of its offset to every front member. |
| Existing atomic root world depth `min(followY - 2, ownerY - 2)`. | Explicit flat child-list partition `shadow → back → front → owner mark` and a `+4 px` presentation radius for telegraph avoidance. |
| Existing logical `core/primary/secondary`, stage bands, evolution fallback, and proposed donor-aware fusion assembly. | Production/QA proof that every coordinated split remains complete at all nine `x,y ∈ {-4,0,+4}` extrema, mirrored and at gameplay scale. |

To guarantee literal code reuse, implementation should extract the exported `FloatingHeadSpring*` types, constant, sampler, and `stepFloatingHeadSpring` from `SpriteRig.ts` into a small client-only leaf module such as `packages/client/src/sprites/floating-head-spring.ts`; `SpriteRig` and `PetRig` then import the same symbols. Preserve re-exports if current tests import them from `SpriteRig.ts`. This is a code-location refactor, not new spring math. Importing the large `SpriteRig` entity from `PetRig` is an acceptable short-lived bridge only; copying the 170-line integrator is not.

## Implementation blueprint for the build Sol

1. **Share the proven primitive.** Extract/re-export the character spring without changing its tests or results. Add focused equivalence/bounds/reduced/reset tests around the shared module.
2. **Extend manifest types compatibly.** Add optional `depthLayer` to `PetManifestPart` and optional `depthRig` to a stage/form; have the pipeline emit them only for an atomically complete, validated carrier pair. Old records remain valid. Keep numeric `plane` and all slot/parent/spring fields.
3. **Resolve render order once per art build.** For a valid depth rig, partition active assembly members by declared role and produce stable `back(plane,index) → front(plane,index)` order. With absent/incomplete v2 metadata, preserve today's pure `(plane,index)` v1 order and disable translation. Add children flat to `PetRig.root` between shadow and owner mark.
4. **Install one layer state.** Store one spring state/input, enabled flag, size-scaled amplitude, and rebase-pending flag in `PetRig`. Reset on the lifecycle cuts specified above. Do not allocate them in `update()`.
5. **Drive late, apply once.** After the current follow/root carrier and acceleration are known, step the shared follower. During the existing part loop, set each image position from immutable assembly coordinates plus the shared offset only if it is `front`; continue the current angular rotation logic. Never integrate positions from their prior frame.
6. **Preserve world contracts.** Leave `ArenaScene.updatePetRigs`, network descriptors, root depth, shadow, and gameplay untouched. Return `restRadius + 4` for telegraph avoidance while retaining rest radius for shadow/mark layout.
7. **Verify proportionately.** Unit-test grouping/fallback, exact counter-phase samples, `4 px`/`0.35 px` bounds, mirror-direction inertia, resets, no position accumulation, and unchanged logical/world coordinates. Visual QA covers every band at rest, both facings, normal bob, dart/turn, downed, reduced motion, and the 3×3 extrema. Profile the maximum supported cutout census with multiple pets and confirm no steady allocations or added draw passes.

Expected future runtime touch surface is narrow: shared spring leaf/existing `SpriteRig` imports, `packages/client/src/sprites/pet-parts.ts`, `packages/client/src/entities/PetRig.ts`, focused unit tests, and generated manifest/tooling owned by the pipeline. `ArenaScene`, shared pet mechanics, server schemas, assets, and live services need no rendering-arm change.

## Exact handoffs to `pet-layer-pipeline`

### Rendering arm → pipeline arm

1. Emit the pipeline's frozen per-physical-part `depthLayer: "back" | "front"` plus stage/form `depthRig: { version: 1, motionProfile: "pet-bob-v1", frontPivotL, frontRestOffsetL, authoredTravelL }`. Keep these independent from logical slot, parent, receiver, and numeric `plane`.
2. Every activated form supplies an atomic `withBody` carrier pair with both roles non-empty; a body donor always transfers that pair together. Prefer exactly one coordinated back PNG plus one coordinated front PNG for a simple form. Where evolution/fusion/independent angular springs require loose parts, keep those cutouts and assign each one to one synchronized surface. Do not commission flattened pair-specific fusion images or ask runtime to composite render textures.
3. Author the front as the near/occluding plane in the top-down-ish camera. Its boundary must cover completed back underpaint through the full `4 px × 4 px` ellipse. No contour, strap, cable, vein, highlight, or shadow may require pixel-perfect alignment across the moving split.
4. Produce automated/rest-review composites for the nine offsets `x,y ∈ {-4,0,+4}`, both facings, pale fill/silhouette, and actual 30/37/44 px gameplay sizes. Require no transparent daylight, severed outline, duplicated feature, exposed chroma, or false detached joint. Glow/aura splits still pass bounds/legibility even when they have no physical seam.
5. Include front/back alpha bounds in pipeline QA and ensure the union expanded by `4 px` remains inside the form's accepted presentation/telegraph envelope. Existing assets are not automatically compliant merely because they are already separate PNGs; Copper Snail's current positive-plane shell is the concrete warning.
6. Preserve bundle provenance, donor identity, `core/primary/secondary`, evolution form keys, paired/child dependency rules, and current optional angular springs. `depthLayer` and `depthRig` are catalog/manifest truth; they are not persisted per fusion account.
7. Gate activation per stage. A manifest may ship old/static v1 stages alongside validated two-layer v2 stages, but a declared v2 stage must atomically resolve its complete body carrier pair and all required textures before becoming visible. Unknown/absent v2 metadata deliberately renders the old form statically; invalid/half-loaded v2 art falls back atomically rather than displaying one surface.
8. `pet-bob-v1` has a final group-translation envelope of `±4 px` X/Y and **0° group rotation** after normalization. `frontPivotL` is the root-relative semantic-right/`+Y`-down registration reference; it has no transform effect until a future profile permits rotation. Convert `frontRestOffsetL` through resolved axis scale once, and author/validate `authoredTravelL` to cover the `±4 px` screen-space envelope for that form.

### Pipeline arm → rendering arm

The implementation needs the pipeline report to freeze:

- the final schema/version location of `depthLayer`/`depthRig` and compatibility rule for v1 records;
- a complete physical role assignment for every activated pet/band/form, including the atomic body carrier pair and optional logical bundles spanning roles;
- confirmation whether each simple form is two PNGs or a multi-cutout/two-motion-plane assembly;
- validated rest assembly, pivots, sockets, numeric within-role planes, alpha bounds, and 3×3 seam proof;
- confirmation that body-pair atomicity keeps both surfaces non-empty under every legal fusion, plus canonical fallback for an unresolved/invalid pair;
- the exact list of legacy parts that can be metadata-retrofitted versus those needing coordinated redraw/reslice.

No other art-production decision blocks the rendering technique.

## Final assumptions and risks

- The owner's “one image on top of another” is satisfied literally for simple authored forms and perceptually/transform-wise for modular forms. Requiring exactly two drawables after arbitrary fusion would force destructive runtime flattening or combinatorial pre-renders, so the stable contract is exactly two **motion planes**, not universally two draw calls.
- The current normal-hover carrier, including its time-varying `orbitAngle` and approximately `1.91 Hz` effective cadence, is accepted as existing pet behavior. This feature samples it exactly. Decoupling orbit phase from hover frequency is a separate feel retune and should be judged separately.
- Existing separated pet assets were designed for socketed angular motion, not necessarily `±4 px` translational separation. Pipeline QA/redraw is a real dependency; runtime bounds cannot repair missing underpaint.
- All layer motion remains cosmetic and local. If a future design makes rendered pet pixels authoritative for collection, attacks, or hazard avoidance, it must define a new simulation contract rather than reading this spring.

## Validation

- Followed the durable-report regime: the first write created this report with understanding, plan, and assumptions; findings and decisions were appended during the evidence pass; validation is last.
- Re-read the character design and inspected the real `SpriteRig` spring, cadence source, late pose sync, reset/reduced path, bounds, and render ordering. Confirmed `8.4 rad/s`, `0.48`, `4 px`, `72 px/s`, `50 ms`, and reduced `30 rad/s` / `0.35 px` from source rather than prose alone.
- Parsed the installed pet manifest read-only: schema 1 / `PET_SOCKET_FRAME_V1`, 8 pets, 24 forms, 72 expected/72 installed parts, and zero missing, extra, or invalid rows. Inspected shared slots, the full pet assembler/loader, `PetRig` construction/update/part loop, `ArenaScene` depth/update call sites, and Phaser 4.1 container child-order behavior.
- Visually inspected representative installed Copper Snail, Verdant Wing, Hearth Newt, and Pale Firefly cutouts. They confirm that useful loose art exists, but do not prove a completed underlap or guaranteed atomic body carrier pair; the report does not mislabel current assets as translation-ready.
- Re-read the completed sibling `docs/design/pet-layer-pipeline.md` and reconciled the contract to its `depthLayer`, `pet-bob-v1` depth rig, normalized pivot/rest/travel metadata, and required atomic body-pair model. The render arm supplies the authoritative `±4 px`, `0°` group-rotation, phase, local-axis, reduced-motion, rebase, order, failure, and performance rules it requested.
- Structural audit found all requested sections, six balanced Markdown fence markers, no replacement characters, no stale `motionLayer` name, and all cited source paths present.
- Scope audit: `git status --short -- docs/design/pet-layer-render.md` reports only this new report for this track. No product code, asset, manifest, generated file, or test was edited; no generator/product test was run because this is a design-only deliverable; the live game and ports 5180/2567 were not touched.
