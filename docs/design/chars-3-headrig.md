# Character Head Rig & Silhouette Specification

## 1am summary

This track preserves the existing separated-head secondary-motion technique while retiring interchangeable torso/head assembly: every new character is authored as one coherent identity whose bespoke, face-concealing head is extracted only so it can bob over a no-neck shoulder overlap. The deliverable will pin down the current `SpriteRig` behavior, a roster-wide silhouette and footprint grammar, presentation-only bob invariants, exact generation requirements for riggable whole-character art, and the smallest incremental implementation surface that keeps all approved body combat, combo, tumble, jump, and crouch work intact.

## Verified current rig: keep the follower, replace its wardrobe inputs

The current implementation is already presentation-only: `SpriteRig` documents the container as client-side cosmetic flavor, decoupled from the authoritative simulation (`packages/client/src/entities/SpriteRig.ts:1895-1904`). A gear manifest causes the constructor to build a six-part boilerplate assembly and retain a dedicated `boilerplateHead` image (`SpriteRig.ts:2553-2577`); when all textures are ready, the body/head/limbs are installed atomically and the secondary-motion state is reset (`SpriteRig.ts:2623-2708`). This is useful machinery, but it is currently fed by the wardrobe/boilerplate system rather than by a per-character art record.

Confirmed constants and behavior:

- The remembered scale is exact: `HEAD_MOUNT_SCALE = 0.85` in `packages/client/src/sprites/gear-parts.ts:10`. The final head transform multiplies the body’s final per-frame X/Y scales by the resolved head mount scale (`SpriteRig.ts:7845-7852`). Loadout-specific head normalization can override that default.
- Rest attachment is a socket, not a seam: the rig derives the head target from `gearAssembly.rigSockets.head` relative to `socketFrame.bodyRootSource`, falls back to the boilerplate head assembly position, then rotates/scales that offset through the body’s current final transform (`SpriteRig.ts:7801-7813`). Thus lean, squash, tumble/combat body transforms already carry the socket.
- The retained follower is an exact bounded spring: angular frequency `8.4 rad/s`, damping ratio `0.48`, maximum displacement `4 px` on each axis, maximum velocity `72 px/s`, and a critically damped reduced-motion mode capped at `0.35 px` (`SpriteRig.ts:1319-1488`). Its integration timestep is capped at `50 ms` and it rebases after cuts, pauses, or offscreen LOD sleep.
- Current authored inputs are movement head-bob, dash/slide lag, airborne hang, landing dip, root-motion impulse, large-attack anticipation, and idle-flourish displacement (`SpriteRig.ts:7748-7852`). Final synchronization runs after weapon geometry and the combo-stage transition pass (`SpriteRig.ts:10638-10655`), so the head observes the settled body presentation rather than feeding it.
- The current mix-and-match seam is explicit: `equipGearLoadout(...)` accepts an `alternativeHead`, resolves a loadout head texture, includes that choice in the loadout cache key, assembles arbitrary torso/head gear, and re-resolves sockets (`SpriteRig.ts:2877-2936`; `packages/client/src/sprites/gear-parts.ts:821-888, 1584-1585, 1890-1926`). This selection/normalization/catalog path is what the character pivot removes. The spring state, late pose-sync method, rebase/LOD behavior, reduced-motion behavior, and body-relative socket math are what it keeps.
- Important gap: the existing field comment says the blank-kit head has “no neck/overlap geometry” (`SpriteRig.ts:1925-1930`). The current system prevents runaway separation mathematically, but it does **not** guarantee a visually covered joint. The no-neck shoulder overlap therefore has to become an authored silhouette/socket invariant and a validation gate.

## Verified roster, concept source, and asset pipeline

`data/character-concepts.json` is a 411-line, 50-entry concept bank (`count: 50`), while `packages/shared/src/characters.ts:6-47` is the actual 40-character playable roster: the Drifter plus 39 promoted `cc-*` identities. All 40 `CHARACTER_KITS` rows exist and all five-stat spreads sum to 10 (`characters.ts:53-97`). The concept-only eleven are Greta Ironbraid, Hrothgar Snowfang, Skitch Wren, Vesper Lux, Vellichor the Ash-Robed, Old Quill Grathmar, Old Gen, Snarekeeper Vossel, Doctor Quillane, Warden Ashlock, and Snarlfang. Therefore the prompt track must take an explicit roster/launch-set id list; it must not blindly generate all 50 concepts.

The concept bank is valuable identity material, but it is not yet a compliant prompt source. Across the full file, old briefs ask for visible/open profiles, eyes, mouths, beards, jaws, skin, a “thick neck,” neck seals/collars/nooses, attached hats/hoods, fingered hands, held weapons, action poses, and VFX. Some entries already point in the right direction—Kuro-Oni, Yuki, The Hollow Mask, Sable Cipher, Hollowmaw, Iridia, Sir Mordrane, Tinker-Magnus, Crowmantle, and the Drifter-like shadowed gunslingers—but **every** selected brief still needs the new house-law wrapper: face fully concealed, no neck, one character-specific separated head, neutral empty-handed pose, and a closed shoulder roof. This is a pipeline rewrite of the art instructions, not a license to alter the character ids, stat spreads, or quirks.

The character mechanics are separate from this visual migration. `packages/shared/src/character-classes.ts:125-430` declares the complete quirk table with explicit availability: 8 table entries are active, 1 partial, and 32 inert (the extra entry is the `none` fallback). Head separation must not read or branch on stats, lineage, or quirk availability.

Current legacy character assets contain `body.png`, two hands, and two feet; they have no `head.png` (for example `packages/client/public/sprites/cc-cordell-coldsnap-vane/`). Their generated `SpriteManifest` likewise has only those five roles (`packages/client/src/sprites/manifest.ts`; generated by `tools/artkit/harvest-install.mjs`). The generic slicer currently assumes the largest connected component is `body` and classifies every other character component only as a hand or foot (`tools/artkit/guards/slice.mjs:138-166`), so a detached head would currently be mislabeled as a hand. The atlas and runtime preload paths already iterate arbitrary manifest parts, so once `head` is a real role they can carry it without a bespoke loader (`tools/artkit/pack-atlas.mjs:35-42`; `packages/client/src/scenes/ArenaScene.ts:1879-1885`).

The live player creation path also proves where wardrobe coupling must be cut. When synchronized wardrobe strings exist, `ArenaScene.addBlob` discards the selected character sprite, instantiates a Drifter compatibility scaffold with `GEAR_PARTS_MANIFEST`, then equips the arbitrary loadout (`packages/client/src/scenes/ArenaScene.ts:4357-4391`). The 40-character art is only the fallback for rooms without that gear tail (`ArenaScene.ts:8974-8997`). The pivot must always instantiate the selected character id and treat its own head as part of that character; enemy construction remains the ordinary manifest-only path and is unaffected (`ArenaScene.ts:4982-5024`).

## Successor silhouette grammar

Use one normalized coordinate system for generation, installation, and runtime QA:

- `B` is one **body-height unit** before `characterScale`; at runtime `B = TARGET_BODY_H = 76 px` (`SpriteRig.ts:231-232`). Coordinates are rig-local, `+X` faces semantic right, `+Y` points down, and the body root is `(0,0)`.
- The canonical body/source template remains the verified 1024 square with `B_source = 512`, root `(512,512)`, and head socket `(0,-0.38B)` / raw `(512,317.44)` from `tools/artkit/out/gear/gear-parts-manifest.json`. The new manifest stores normalized values so runtime does not depend on a 1024 canvas.
- The runtime head mount remains `0.85` for this template. This is an authoring normalization, not a statement that the visible head is “85% of the body.” A source head is normalized so its **mounted opaque height** is `0.44B-0.48B`, target `0.46B` (about 35 px at 1×). Before the `0.85` mount, that means a source alpha height of roughly `0.52B-0.56B`.

| Rule | Frozen target | Acceptance band / reason |
|---|---:|---|
| Head socket | `(0, -0.38B)` | Fixed across the player cast. Correct art around the socket; do not move the skeleton per character. |
| Head pivot | `u=0.50, v=0.55` in the trimmed head texture | Current boilerplate uses the same 55%-down anchor intent (`tools/artkit/gen-gear.mjs:603-605`). Permit `u 0.46-0.54`, `v 0.52-0.58` only to center asymmetric headgear around the same socket. |
| Mounted head height | `0.46B` | `0.44B-0.48B`; measures all character-owned head art except a deliberately thin plume/antenna outlier. |
| Mounted head width vs. shoulder/torso width | `0.73` | `0.70-0.77`. The source-art band is `0.82-0.90`; the retained `0.85` mount turns that into `0.70-0.77` onscreen. |
| Resting head/body alpha overlap | `0.18B` | `0.16B-0.20B` (12-15 px at 1×). This supersedes the wardrobe's smaller connector allowance because the new joint is deliberately neckless and has to cover spring travel. |
| Worst-case overlap at any spring extreme | at least `0.10B` vertically and `45%` of the lower-head width horizontally | Sample the complete 3×3 grid `x,y ∈ {-4,0,+4}px`; no transparent daylight is allowed between head and shoulder roof. |
| Body shoulder roof | continuous opaque closed cap | It must extend at least `4 px + 0.025B` beyond each side of the lower-head overlap footprint at 1× (about 6 px per side), covering maximum lateral spring travel plus a visible margin. |
| Torso alpha width:height | target `0.95` | `0.90-1.00`; compact pill/cone, not realistic anatomy or a tall necked figure. Shoulder:hip width remains `0.95-1.05`. |
| Complete planted core | head top to foot bottom `1.18B-1.24B`; assembled body/head width:height target `0.62` | About 90-94 px tall at 1× before a hat/plume exception; accept `0.58-0.68` width:height for identity extremes without changing runtime scale. |
| Feet and shadow relationship | foot centers near `(-0.125B,+0.438B)` and `(+0.125B,+0.438B)`; engine shadow `0.60B × 0.22B` at `y=+0.42B` | These are the existing boilerplate/socket and `SpriteRig` shadow values. Art may change boot contour, not the planted base. |

The overlap is the style, not merely an error allowance. The body draws first and provides a finished collar/pauldron/cowl **roof**; the head draws in front and its closed lower mask/hood/helmet mass sits visibly down over that roof. There is no neck, throat, skin column, peg, connector tab, neck hole, or painted seam in either layer. At the `-4 px` upward extreme the character must still look like one figure, not a head hovering over a body.

Every head-owned feature—hat, helm, mask, hood, short veil, horns, ears, hair mass, and face concealer—belongs entirely to `head.png` and bobs with it. Body-owned features end cleanly behind it. No stroke may bridge the cut: scarf tails, long veils, hair, nooses, pipes, straps, halo supports, and cables must be assigned wholly to one layer or redesigned as two visually independent shapes. A body-side collar may sit behind a head-side cowl, but they may not form a line that has to remain pixel-aligned while the head moves.

The core footprint is normalized at art install, so the new roster should normally use `characterScale(id) = 1`. The existing 16 scale exceptions (`packages/shared/src/characters.ts:161-182`, ranging from 1.06 to 1.25) are evidence of legacy art drift, not targets for the new art. Preserve explicit enemy/tough/boss scale systems, but do not solve a too-small new player by adding another per-character runtime multiplier. Large hats, antlers, plumes, and trailing cloth may extend up to `0.22B` above or `0.15B` laterally beyond the core envelope; they do not change `B`, the head socket, feet, shadow, or hit geometry.

## Bob contract: secondary presentation, never another pose owner

There are three distinct motions and they must not be conflated:

1. **Body-carried motion.** Idle breathing, authored locomotion, jump, crouch, tumble/roll, attack pose, combo transition, squash, and rotation move the body. The head socket is computed from the body's **final** transform, so this motion carries the whole figure coherently.
2. **Authored head offset.** Small gait counter-bob, dash/slide lag, air hang, landing dip, flourish, and major-attack anticipation move the desired head point relative to that final socket.
3. **Spring response.** The existing bounded follower filters the desired point at `8.4 rad/s` (natural frequency about `1.34 Hz`), damping `0.48`, and clamps the result to the current `4 px × 4 px` ellipse and `72 px/s`. Do not increase those bounds; the silhouette contract is built around them.

### Exact cadence and phase

- **Walking/running:** preserve the distance-driven stride clock. `stridePhase += speed / strideLength × 2π`; the relative head target is `-sin(2 × stridePhase) × A × gait`. It therefore produces two head beats per complete left/right stride—one per footfall—and freezes rather than jogging in place when travel stops. At the shipped 320 px/s full speed, the current stride lengths produce approximately 4.51 beats/s melee (`142 px`), 3.86 ranged (`166 px`), 4.27 caster (`150 px`), and 3.33 weighted (`192 px`). Do not replace this with a free-running time oscillator.
- **Footfall phase:** retain the current counter-phase. When `stepBeat = sin(2 × stridePhase)` drives the body downward (`+Y`), the relative head target is upward (`-Y`); at `stridePhase = π/4` the head offset is negative and at `3π/4` it is positive. This is inertial follow-through, not a second body bounce.
- **Amplitude:** the actual runtime source today is `movementPose.headBobPx`, not the exported `sampleFloatingHeadWalkBob()` helper. Preserve the existing posture amplitudes: ranged `0.60 px`, weighted `0.75 px`, melee `0.90 px`, caster `1.80 px` (`packages/client/src/sprites/pose-language.ts:670-772, 856-893`). `FLOATING_HEAD_SPRING_TUNING.walkBobPx = 1.15` is currently only exercised by unit tests; either make it the explicit no-weapon fallback or remove that dead second truth. Do not sum `1.15` on top of the posture value.
- **Idle:** no independent head clock is added. The head follows the existing body breathing oscillator, `sin(t × 2.2)`—about `0.35 Hz`—through the body-relative socket (`SpriteRig.ts:8351-8362`). The stable per-rig id phase prevents a crowd from breathing in exact lockstep. The spring supplies the subtle lag.
- **Dash/slide/jump/landing:** keep the existing maximum authored contributions: dash lag `2.2 px`, slide lag `2.6 px`, air hang `1.35 px`, landing dip `1.55 px`, all still inside the common 4 px clamp. A committed tumble/crouch owns the body; its periodic footfall amplitude is zero, while the follower remains active so the head carries through and settles rather than snapping.
- **Attack and combo:** a major chop/orbit/spin, two-handed strike, or combo may use the existing anticipation lead, maximum `2.4 px`, along aim. It ramps in before active and returns to zero by release (`SpriteRig.ts:7748-7780`). Periodic footfall bob eases to 25% during attack anticipation, is 0 during the authored active/impact and the at-most-80-ms combo-stage bridge, then returns to full over 100 ms of recovery. The stride phase continues accumulating; never reset it on attack or combo-step boundaries, because a reset creates the very visual pop this rule is meant to prevent.
- **Reduced motion:** keep authored offsets at zero, critically damp at the current high response, and cap residual follow to `0.35 px`. Do not disable body-follow or snap the head to a different anchor.

The attack suppression weight is a small incremental guard around the existing input, not a new animation system. If implementation chooses to leave the already-small walk bob active during attacks, it must prove in the 3×3 extreme/slow-motion QA that it never reverses an authored attack head direction or creates a combo-step pop; the frozen default above is safer.

### Invariants for `chars-5-migration` and every future systems change

1. The selected character id implies exactly one body asset and exactly one head asset. There is no head id, head slot, head network field, equipment choice, randomization, or cross-character fallback.
2. The head has no collider, hurtbox, hitbox, targeting point, aim origin, projectile origin, melee origin, shadow authority, camera authority, or server state. Moving or hiding it changes zero simulation outcomes.
3. `applyWeaponArtGeometry()` and `applyComboStageTransition()` remain before final head synchronization (`SpriteRig.ts:10638-10655`). The head samples the committed body; it never writes back into body, hands, weapon, combo clocks, or accepted combat timing.
4. Combo transitions do not interpolate, reset, or re-parent the spring. Lifecycle/root cuts, long frame gaps, asset replacement, and offscreen wake may rebase; ordinary combo steps may not.
5. Tumble, jump, crouch, knockdown, spawn, death, and combat poses own body transforms. The follower layers on the resulting socket and stays bounded; it does not add a competing body pose.
6. The head remains immediately after the body in the render stack and participates in the same tint/fill/death treatment (`SpriteRig.ts:3050-3083, 3937-3941, 5394-5404, 5605-5616`). Any future afterimage may include or omit it deliberately, but may not use a stale world transform.
7. No wardrobe stat, quirk, persistence, or compatibility migration is allowed to gate whether the character-owned head exists. Old `gearUpper/gearLower` may survive a wire-compatibility window, but they become visual no-ops.

## Exact riggability requirement for `chars-4-pipeline`

The preferred generator output is **one coherent exploded character source plate**, not two independently invented characters and not a flattened final composite. At 1920×1080 on uninterrupted `#00ff00`, it contains exactly six disconnected opaque islands from the same design pass: this character's body, this character's own head, two empty mitten hands, and two feet. The head is placed in its designated guide region above the body with at least `0.08B_source` clean key-color clearance from every other island; runtime installation ignores that exploded source offset and uses the fixed normalized socket. This keeps identity, palette, line weight, and lighting coherent while still producing separable pixels.

The prompt compiler must append this literal contract after the character-specific identity text:

> Render one bespoke, coherent Dimension Drifters character in neutral planted side profile facing screen-right. The head shown is this character's permanent head, never generic and never interchangeable. Draw it as its own fully disconnected opaque island above the body, with uninterrupted flat-green clearance around it. Draw no neck, throat, skin column, stump, connector, or collar peg. Finish the head's lower edge as an opaque mask/hood/helmet/shadow mass and finish the body's upper edge as a broad closed opaque shoulder/collar roof; when recomposed at the documented socket, the head must sit down over that roof rather than meet it edge-to-edge. Nothing—hair, scarf, veil, rope, pipe, strap, cable, halo support, outline, shadow, or VFX—may bridge head to body. The whole face zone is permanently concealed by the character-owned head art; no biological eye, nose, mouth, cheek, jaw, skin, or readable profile is visible. Empty hands, no held weapon, no baked shadow, no particles, no text.

For each accepted character, `chars-4` must hand off:

- `identity-ref`: a deterministic proof composite made from the accepted source pixels at the fixed socket—not a separate rerender.
- Transparent `body.png`, `head.png`, `hand-l.png`, `hand-r.png`, `foot-l.png`, and `foot-r.png`. The head output includes all permanent concealment/headwear; body output includes a fully painted underlap/shoulder roof behind it.
- Head-rig metadata: `{ socketXB: 0, socketYB: -0.38, pivotU, pivotV, mountScale: 0.85, overlapB }`, with measured mounted head height/width, body dimensions, and alpha bounds. `overlapB` must be in `0.16-0.20`.
- A gameplay-scale proof sheet at rest, pale full-fill, left/right mirror, and the nine `±4 px` spring samples. Include body-only and head-only alpha views so a hidden neck or missing shoulder pixels cannot pass under the composite.
- Face-law pass from `chars-2`, silhouette/overlap pass from this track, and owner identity approval. Machine checks reject wrong component count, connected head/body pixels, insufficient green gap, out-of-band ratio/socket/overlap, or transparent daylight at any extreme.

If the image generator cannot reliably make the exploded plate, the fallback is two **coordinated extraction/edit outputs** derived from the same approved identity reference: a head-only transparent layer and a headless body plate with the occluded shoulder roof completed. Do not accept two fresh independent generations merely because the costume names match. A documented cut-line on one flat final composite is insufficient when the head occludes pixels that the body must reveal during bob; destructive extraction cannot reconstruct the underlap.

`tools/artkit/guards/slice.mjs` needs a versioned player-v2 classifier or fixed guide regions: largest central component = body, central component above it = head, lateral components = hands, lower components = feet. It must require exactly those six roles for players and reject rather than silently labeling the head as `hand-1`. This is the exact new tooling dependency handed to `chars-4`.

## Incremental implementation plan and cost

The spring integrator and animation order do not need a rewrite. The smallest safe build is:

1. Extend the generated sprite contract with an optional character-owned head descriptor, for example `SpriteManifest.headRig = { partRole, socketXB, socketYB, pivotU, pivotV, mountScale }`. `parts` gains a normal `role: "head"`; old manifests without it continue to work during migration. Source: `tools/artkit/harvest-install.mjs`; generated result: `packages/client/src/sprites/manifest.ts`.
2. In `SpriteRig` construction, detect `headRig`, create the head image from `partTexture`, set its declared pivot, keep it out of the generic body/limb list, and route it into the existing `FloatingHeadSpringState`, late pose sync, render stack, tint, and death paths. Rename `syncBoilerplateHeadPose` to `syncFloatingHeadPose` when the compatibility path is removed. The 170-line spring/sampler block at `SpriteRig.ts:1319-1489` stays unchanged.
3. During the compatibility release, the common head-source adapter prefers `manifest.headRig` and falls back to the old boilerplate assembly. Once all selected characters pass art QA and `ArenaScene` always instantiates `charId`, delete the alternative-head/loadout source: `AlternativeHeadTextureSelection`, `ResolvedLoadoutHeadTexture`, `DEFAULT_LOADOUT_HEAD_TEXTURE`, `resolveLoadoutHeadTexture`, the `alternativeHead` argument/cache signature, torso/head normalization and bake branches in `packages/client/src/sprites/gear-parts.ts` / `gear-texture-baker.ts`, `packages/client/src/sprites/gear-pairs.test-fixture.ts`, their pair tests, and generated `tools/artkit/out/gear/torso-head-{reuse-verdicts,fleet-state}.json` with the rest of wardrobe retirement.
4. Change `ArenaScene.addBlob`/`syncBlobs` to render the selected `charId` regardless of old gear strings. Do not change `PlayerState.character`, character ids, stats, quirks, combat clocks, or enemy rig creation.
5. Add tests beside `packages/client/src/entities/SpriteRig.boilerplate.test.ts` for a generic manifest-owned head: correct texture/pivot/socket/scale, final-body following, no combo reset, reduced-motion bound, 3×3 travel bound, tint/death participation, and absence of a head selection API. Keep the existing spring convergence tests; delete only tests whose product behavior is arbitrary torso/head pairing.

Approximate **net-new** surface (wardrobe deletion is counted by `chars-5`, not charged to this head feature):

| Area | Files | Expected change |
|---|---|---:|
| Runtime adapter and late sync | `packages/client/src/entities/SpriteRig.ts` | roughly 70-120 changed lines; spring math retained |
| Player routing | `packages/client/src/scenes/ArenaScene.ts` | roughly 20-40 changed lines |
| Manifest/install/classifier | `tools/artkit/guards/slice.mjs`, `tools/artkit/harvest-install.mjs`, generated `packages/client/src/sprites/manifest.ts` | roughly 80-140 source lines plus generated data |
| Tests | `SpriteRig.boilerplate.test.ts` or a focused `SpriteRig.head.test.ts`, plus an artkit classifier test | roughly 100-180 lines |
| Art | `packages/client/public/sprites/<selected-id>/head.png` plus regenerated existing parts/manifests/atlas | `N` heads and `N` coordinated body plates; 32+32 if the roster recommendation holds, 40+40 if owner keeps all 40 |

This is a small adapter around a working follower. The expensive work is art generation and per-character alpha/overlap QA, not runtime animation code. The generated atlas/preloader already iterates manifest parts, so no new texture transport system is needed.

## Cross-track dependencies and handoffs

- **`chars-1-roster` → this/pipeline:** supplies the final ordered id list and each identity's head/torso signature. Its current recommendation is 32 characters. This spec is cardinality-independent, but art cost is `2N` coordinated head/body outputs plus `N` deterministic composites; do not start unpromoted concepts or its eight cuts accidentally.
- **`chars-2-facelaw` → `chars-4`/QA:** supplies the permanent face-zone acceptance law and character-specific concealment vocabulary. Its rule wins over any legacy brief. This track adds that concealment must reside wholly in `head.png` and pass every spring extreme/full-fill silhouette.
- **This track → `chars-4-pipeline`:** the exact `B`, socket, pivot, `0.85` mount, head ratio, `0.18B` overlap, shoulder-roof, source-island, metadata, and proof-sheet requirements above. `chars-4` owns prompt compilation, generation, chroma/alpha processing, classifier changes, contact sheets, and owner gates.
- **This track → `chars-5-migration`:** the seven invariants above. `chars-5` owns safe persistence/server/wire neutralization, deletion of the 113-piece catalog and pairing artifacts, and activation order. It must switch visual sourcing to `character → own head/body` without introducing a head choice or touching combat geometry.
- **`chars-5-migration` → implementation:** provides the compatibility window in which old gear strings are ignored visually but still decoded safely, and the later deletion point. Head art may be generated before that window, but runtime activation must wait until every selected character has a complete six-role manifest or a deliberate fallback.

There is no genuinely blocking owner question for this track. Assumptions used to proceed: `chars-1`'s final roster count controls `N`; the 1024/512 socket template and `0.85` mount remain the initial authoring standard; new accepted art targets scale 1 rather than new `CHARACTER_SCALE` exceptions; and oversized head ornaments are visual exceptions only, never reasons to change the socket, bob bounds, or gameplay footprint.

## Validation

- Re-ran a read-only census: 50 concept records, 40 playable ids/kits, zero non-sum-10 spreads, and zero character-local `head.png` files before migration.
- Re-derived the geometry from current source data: `TARGET_BODY_H=76`, `HEAD_MOUNT_SCALE=0.85`, socket `y=-0.38B`, mounted boilerplate head height `0.458B`, and measured boilerplate rest overlap `0.193B`. Those measurements land inside this spec's `0.44-0.48B` head-height and `0.16-0.20B` overlap bands.
- Confirmed all required report sections and all referenced source paths exist. Worktree audit shows no product-code, asset, catalog, generated-file, or test change from this track; only the five panel reports are untracked. No runtime test was run because this deliverable is documentation-only and the live game ports were left untouched.
