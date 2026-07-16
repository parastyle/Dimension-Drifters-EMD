# Map Aesthetic Redo — Environment Art Direction

## Director answer

The map should stop reading as a painted floor with objects dropped onto it. The new target is **one continuous place, organized into grounded set-pieces**: landmarks grow out of a shared terrain skirt, minor props reinforce those landmarks, worn routes connect them, and pits expose the same material as a deep cut rather than replacing it with a vector hole.

This is a recomposition of the existing library, not a request for new renders. Use the five painted terrain kits, their rims, the existing POI/decal PNGs, selected painted particle/FX components, and procedural Phaser geometry/masks only. No new bitmap generation.

The collision map, spawn clearing, and POI positions remain authoritative. The server regenerates the arena from four synced seeds and the client reproduces that map from the same values; this pass may change presentation and deterministic decor derivation, but not the shared geometry contract. `packages/shared/src/mapgen.ts:1-17`, `packages/server/src/rooms/GameRoom.ts:4346-4362`, `packages/client/src/scenes/ArenaScene.ts:2350-2363`

## Diagnosis: why the current map floats

| Failure | What the player sees | Code reality |
|---|---|---|
| Mixed projection without a common ground plane | High-3/4 towers, trees, ruins, crystals, and machines stand on a straight-down painted floor. Their painted bases have local perspective, but the world supplies no shared material transition around them. | POIs are bottom-anchored and scaled from collision radius, then placed directly over the floor. The only procedural grounding is one centered black ellipse. `packages/client/src/scenes/arena/floor-renderer.ts:195-204`, `packages/client/src/scenes/arena/floor-renderer.ts:226-256` |
| Token shadow, not contact grounding | The ellipse reads as a generic UI shadow or dark sticker. It has no light direction, height response, edge feather, terrain color, or base skirt. It can also sort near actors because its depth is `poi.y - 1`, rather than living unambiguously in the floor stack. | Every POI gets exactly one `2.1r × 0.9r`, 28%-black ellipse centered on the anchor. `packages/client/src/scenes/arena/floor-renderer.ts:241-248` |
| “Decal” category mixes flat marks and upright objects | Cracks, mud, and graffiti can rotate freely; skulls, wheels, ribs, circuit boards, crystal piles, grates, and cases cannot. Randomly spinning all of them breaks gravity and the painted light direction. | Every painted decal receives a random angle over the full circle, random scale, and a 50% horizontal flip, with no projection metadata. `packages/client/src/scenes/arena/floor-renderer.ts:398-415` |
| Uniform distribution defeats composition | Equal-weight dust and props produce visual noise everywhere and intentionality nowhere. A windmill, one bone pile, and one wheel do not become a place merely because they share a seed. | Dust centers are sampled across the whole arena; painted decals are separately sampled across the whole arena. Neither pass refers to POIs, paths, pit edges, or other decals. `packages/client/src/scenes/arena/floor-renderer.ts:382-397`, `packages/client/src/scenes/arena/floor-renderer.ts:404-416` |
| Large decals can bridge a pit | A prop whose center is on ground can visibly hang over a hole, reinforcing the “floating collage” read. | Pit rejection tests only each dust/decal center, not the displayed footprint. `packages/client/src/scenes/arena/floor-renderer.ts:388-396`, `packages/client/src/scenes/arena/floor-renderer.ts:405-415` |
| Tile variation has no landscape logic | Four attractive textures become a shuffled quilt. Quarter-turns erase any directional flow, while the 128 px vector grid reasserts a second, unrelated scale over the painting. | Each 512 px slot independently picks one of four tiles and one of four rotations; the vector grid is then drawn above the painted base. `packages/client/src/scenes/arena/floor-renderer.ts:117-155` |
| POI distribution is gameplay-correct but art-isolated | The blockers are deliberately spread apart, so treating each as a solitary hero sprite guarantees islands. Art must create relationships without moving them. | The map places 28 POIs with radius-aware pairwise spacing, a 150 px walking gap, spawn clearance, and a 72 px ground guard ring. `packages/shared/src/constants.ts:189-212`, `packages/shared/src/mapgen.ts:356-418` |
| Pits switch from painting to diagrams | The ground is painterly, but the hole is a grid of flat rectangles with crisp vector bands. Only one edge orientation receives the painted cliff face, so the same pit alternates between “painted chasm” and “outlined black polygon.” | Pit cells are filled as opaque rectangles. Painted rim sprites are built only for segments with `nx = 0, ny = 1`; every other edge receives only the vector rust/amber lines and optional chevron. `packages/client/src/scenes/arena/floor-renderer.ts:284-315`, `packages/client/src/scenes/arena/floor-renderer.ts:317-361` |
| The hop telegraph is region-wide, not crossing-specific | A long narrow chasm can receive a “hop me” edge where the normal-direction span is not actually short. That weakens trust in the edge language. | A whole 4-connected pit region is marked hoppable when the smaller dimension of its bounding box is within jump reach, and that one boolean is copied to all edge segments. `packages/shared/src/mapgen.ts:599-637`, `packages/client/src/scenes/arena/floor-renderer.ts:294-315` |

The floor is already rebuilt as a static, negative-depth stack while entities sort by world Y, so this is a good fit for batched procedural masks, RenderTextures, and a few POI images rather than a new simulation system. `packages/client/src/scenes/arena/floor-renderer.ts:27-35`, `packages/client/src/scenes/ArenaScene.ts:2350-2407`

## Art law: one projection, one sun, one truth

### Projection

- Keep the existing high-3/4 POI art. Treat the ground as an orthographic plane and all POI footlines as touching that plane at `(poi.x, poi.y)`.
- A texture's transparent bounds are not its footprint. Add per-asset `footY`, `baseWidth`, `heightClass`, and `projection` metadata. Scale from `baseWidth`, not total PNG width; anchor at `footY`, not blindly at the bottom trim.
- Use three projection classes for all decal PNGs:
  - `ground`: paint, cracks, puddles, graffiti, stains. Rotation 0–360° is allowed if the motif is direction-neutral; no contact shadow.
  - `low`: rubble, bones, cables, snow piles, small plants. Rotation is limited to authored quarter-turns or ±15°; add tight AO; flip only if the asset's light is symmetric.
  - `upright`: wheels, skulls, ribs, circuit boards, cases, crystal clusters, shrubs. Preserve screen-up, allow at most ±8° yaw-like variation, never rotate the image plane freely, and never mirror directional lighting.

The current aspect-ratio bucket is useful only as a fallback, not an art definition: it labels POIs “squat” or “tall” from total texture dimensions and chooses art from those buckets. `packages/client/src/scenes/arena/floor-renderer.ts:217-237`

### Fake sun

Set one global fake light vector for every dimension:

- Light arrives from **north-west**: `L = (-0.62, -0.78)` in screen space.
- Cast shadows travel **south-east**: `S = (+0.62, +0.78)`.
- Never random-flip a POI merely for variety. The current even-kind flip changes the authored light and must be replaced by per-asset permission. `packages/client/src/scenes/arena/floor-renderer.ts:249-256`
- Painted rims show their full vertical face only where ground is north of the drop. Side and back edges receive reduced treatments, preserving one coherent camera rather than rotating a front-facing cliff around all four sides.

### WYSIWYG

Environment art inherits the combat doctrine: the visible boundary must describe the live boundary. Melee already defines a hit as the swept blade itself and shares a single descriptor clock for presentation and authority; map art should be equally literal. `packages/shared/src/melee.ts:6-17`, `packages/shared/src/melee.ts:609-626`, `packages/shared/src/melee.ts:656-706`

- Do not move, enlarge, or add collidable POIs in this pass. Player and enemy movement are pushed out by the shared POI radii, and projectiles are blocked or ricochet from the same circles. `packages/shared/src/mapgen.ts:470-520`, `packages/server/src/rooms/GameRoom.ts:1788-1794`, `packages/server/src/rooms/GameRoom.ts:2105-2116`, `packages/server/src/rooms/GameRoom.ts:3767-3791`
- The visible base/contact band should match the authoritative diameter within ±10%. Canopies, signs, branches, and elevated structure may overhang; ground-touching mass may not imply a second blocker outside the circle.
- Volumetric support decals must stay inside the POI blocker footprint and visually merge with its base. Anything outside may only be flat, crushable-looking, or clearly surface paint.
- The pit danger line stays on the exact tile boundary. Painted rubble may overhang it, but the hot/cool gameplay rail may deviate by no more than 4 px.
- Derive hop marks per **crossing normal** by counting consecutive pit cells up to the shared jump limit, not from the region bounding box.
- Never use decorative toxic pools, live cracks, black-ice slicks, or powered grid traces unless they are truly hazardous. The dimension registry explicitly describes environmental hazards as flavor pending wiring, while pits already have authoritative fall behavior. `packages/shared/src/dimensions.ts:27-40`, `packages/server/src/rooms/GameRoom.ts:1797-1843`, `packages/server/src/rooms/GameRoom.ts:2119-2131`

## Treatment 1: contact grounding under every POI

Build one `GroundingGroup` per authoritative POI, parameterized by collision radius `r`. The current client already derives visual scale from the same `poiRadius(kind)` used by shared collision; retain that source of truth. `packages/shared/src/mapgen.ts:332-348`, `packages/client/src/scenes/arena/floor-renderer.ts:226-253`

Layer back to front:

1. **Base-skirt ground patch** — an irregular 14-point ellipse, `3.1r × 1.55r`, with ±8% seeded edge wobble. Fill from the dimension's ground material at 12–22% contrast from the local floor. This is terrain, not shadow. Add two or three clipped `ground` decals or sampled painted tile fragments at very low alpha so the landmark shares texture with the map.
2. **Disturbance ring** — broken arcs between `1.05r` and `1.45r`: dust scuff, compressed snow, displaced leaves, ash bank, or foundation grime. Leave a 70–110° clean opening on the route-facing side so each cluster has an entrance rather than a decorative halo.
3. **Cast shadow** — soft tapered lobe along `S`. Start under the base; length `r × clamp(0.55 + 0.18 × heightClass, 0.65, 1.25)`, width `1.7r`, alpha 0.10–0.18. Tint toward the dimension's pit/ground dark instead of pure black.
4. **Contact AO** — a feathered `2.05r × 0.52r` ellipse centered at `(x, y + 0.04r)`, 0.30 at the core fading to zero. Split or reshape it for assets with multiple feet/pillars.
5. **Base occlusion** — retain a small procedural sink, but drive it from per-asset `footY`; target 0.08–0.12r. Do not bury the painted plinth or root flare.
6. **POI image** — world-Y depth sorting remains on the landmark image only. All skirt/shadow/AO layers live in the static negative floor stack so they never paint over a character who walks behind the landmark.

Use one cached gradient CanvasTexture/RenderTexture for AO and one batched Graphics/RenderTexture for all irregular skirts. Do not create three live tweens or three full GameObjects for every landmark.

Scale review:

- S: skirt alpha 0.12, no long cast lobe, 0–1 support decal.
- M: standard treatment, 1–2 support decals.
- L: wider disturbance ring, 2–3 support decals, one story accent.
- XL: full cast lobe, 3–5 support decals, strongest path connection, 20% more negative space around the silhouette.

The existing dealt class cycle guarantees a recurring XL/M/L/M/S/L/M mix, so every map already supplies a dependable hierarchy to drive this treatment. `packages/shared/src/mapgen.ts:332-354`

## Treatment 2: cluster composition instead of scatter

### Composition graph

Use `map.pois` as immutable cluster anchors and `seedDecor` for deterministic art choices. The current renderer already seeds decor from the synced map and deliberately keeps its random cadence stable across clients; preserve determinism even if the distribution algorithm changes. `packages/client/src/scenes/arena/floor-renderer.ts:374-403`

1. Mark XL and L POIs as hero nodes; mark M and S POIs as support nodes.
2. Build a deterministic nearest-neighbor graph from spawn → hero nodes → support nodes. Find routes over ground tiles, avoiding pits and the POI collision discs.
3. Prune the graph to a readable backbone: one primary route through the arena, two or three secondary branches, and isolated wilderness pockets. Do not connect everything.
4. Draw a broad, feathered wear mask along the retained routes. It is a material shift, never a bright line: 0.9–1.4 tile widths with a broken 25–40% edge.
5. Orient each cluster entrance and its longest ground patch toward the closest retained route. Align loose debris, roots, cables, snow tails, and wind streaks to that local flow.

### Decal budget

Reassign the current painted-decal budget rather than increasing noise. The existing pass aims for 70 painted decals on a 4800² arena. `packages/client/src/scenes/arena/floor-renderer.ts:384-386`, `packages/client/src/scenes/arena/floor-renderer.ts:404-416`

- 55% cluster support: inside/under POI footprints or as flat skirt material.
- 25% pit-edge debris: always on the ground side, aligned to the edge tangent.
- 10% path punctuation: flat scuffs, mud, cracks, plates, or vegetation.
- 10% wilderness: sparse, flat-only visual rests.

No more than one high-contrast accent per cluster. Repeat common ground matter freely; reserve skulls, skeletons, glowing pieces, graffiti, and machinery remains as story punctuation. A decal placement is accepted only if its full conservative footprint is ground-safe, not merely its center.

### Remove the procedural wallpaper

- Replace 40 independent dust ellipses with 8–12 elongated drifts tied to paths, leeward POI sides, and pit lips. The current 40-center pass is the source to replace. `packages/client/src/scenes/arena/floor-renderer.ts:388-397`
- Remove the universal 128 px grid in Wild West, Frostfell, Verdant Ruins, and Ashlands. In Neon-Cyber, keep only a 6–10% local circuit/grid reveal along route masks; the painted tile already contains its own panel scale.
- Turn the spawn circle into a grounded clearing: a subtle dimension material skirt, then the exact cool safety rail on top. The existing safe radius and color semaphore remain unchanged. `packages/client/src/scenes/arena/floor-renderer.ts:363-368`, `packages/shared/src/dimensions.ts:12-24`

## Treatment 3: pits become cuts through the painted world

### Shape and depth

1. Keep the authoritative tile-edge contour as the gameplay boundary.
2. Build a marching-squares visual contour outside that rail to round tile stair-steps without moving the rail.
3. Fill the interior with a procedural depth field, not one flat value:
   - 0–0.18T from edge: dense contact darkness, 95–100% of `pitVoid`.
   - 0.18–0.75T: dimension-tinted depth gradient, 78–92% darkness.
   - deeper interior: low-frequency mottling at ±3% value, never bright enough to resemble ground.
   - north interior wall: a subtle vertical falloff beneath the painted face to extend its depth.
4. Break the perfectly straight vector edge with painted debris and small material chips, but leave the exact gameplay rail continuous and legible.

### Orientation-aware rim

The installed rim is a horizontal strip with ground in its upper half and the drop below; the current implementation correctly uses it on north-facing ground edges but leaves the other orientations vector-only. `packages/client/src/scenes/arena/floor-renderer.ts:317-338`

- **Ground north / pit south:** full painted rim strip; this is the visible cliff face.
- **East/west returns:** use a cropped top-lip strip rotated 90°, plus narrow AO into the pit. Do not rotate the full cliff face sideways.
- **Ground south / pit north:** use only the painted top slab/cap, a dark inner seam, and debris. Do not vertically flip the full cliff face.
- **Corners:** overlap cap fragments beneath a procedural debris wedge; never butt two rectangular strips into a plus-sign seam.

Retain the two-level edge semaphore, but integrate it into material: a broad dark/rust support band and a thin hot/cool exact rail. Current widths are `0.11T` and `0.045T`; these are good functional starting points. `packages/client/src/scenes/arena/floor-renderer.ts:339-361`

- Hoppable crossing: clean rail plus two short inward notch marks at the actual crossing span.
- Go-around edge: repeated inward teeth, slightly dirtied by the dimension material but never hidden.

### Debris lip

Place 0.18–0.42 scale `low` decals on the ground side every 1.5–3.5 tiles, biased toward concave corners and long edges. Align their long axis to the rim tangent. Keep 35% of every rim completely clear for combat readability. Bone piles, bodies, glowing vents, and bright circuitry are story beats, not the repeating lip material.

## Treatment 4: tile variation becomes flow

All five kits already load four 512 px tiles plus one painted rim, and their POI/decal packs are loaded from the active dimension. The redo should remap those assets rather than add a sixth texture. `packages/client/src/scenes/ArenaScene.ts:1046-1079`, `packages/client/src/scenes/arena/floor-renderer.ts:55-80`

Create a low-resolution deterministic `MaterialZoneMap` with four labels:

- `base`: quiet majority material, 50–65% of ground.
- `route`: worn/compacted material following the composition graph, 15–25%.
- `cluster`: disturbed material under connected POIs, 12–20%.
- `edge`: cracked/eroded material within 0.5–1.25T of pit rims, 8–15%.

Use the zone map to weight tile variants. Blend zone changes with irregular RenderTexture masks and a second low-alpha pass of another existing tile; never expose a 512 px rectangular transition. Only rotate a variant when its painted flow, panel layout, and lighting survive the turn. The result should read in three scales: quiet floor from across the arena, routes and set-pieces at mid distance, paint texture at combat distance.

## Per-dimension recipes

### Wild West — settlements held down by wind and use

Visual premise: pale compacted routes connect dark, disturbed homestead/mineshaft clusters; loose matter accumulates south-east of structures.

- Tile roles: `tile-2` quiet sand base; `tile-3` wind/path flow aligned to routes; `tile-1` cracked cluster and rim approach; `tile-0` soft transition/wind polish.
- POI skirts: warm umber hardpan, small pebble crescent, strongest dust tail of all dimensions.
- Cluster supports: `decal-02` stones and `decal-08` cracked earth as common matter; `decal-01` scrub and `decal-04` tumbleweed at leeward edges; `decal-06` wheel and `decal-05` bones as rare narrative accents; `decal-03` skull and `decal-07` cactus no more than once per two hero clusters. The available ids are enumerated in `packages/client/src/sprites/decal-manifest.ts:3-13`.
- Pit lip: wild-west painted rim, stone chips, cracked earth; amber rail is dusty but unbroken.
- Ambient: occasional existing `sand-wisp` or `sand-mote` frame drifting along the route direction at low alpha and floor depth. The painted sand family exists in the particle manifest. `packages/client/src/vfx/particle-manifest.ts:58-65`

### Frostfell — compressed snow around monuments, fractured ice at danger

Visual premise: calm pale ice dominates; structures compress snow into blue-grey skirts; fracture density increases toward pits.

- Tile roles: `tile-1` quiet ice base; `tile-0` wind-polished route; `tile-3` snow/frost cluster veil; `tile-2` cracked edge zone.
- POI skirts: cool navy AO, blue-grey cast shadow, clipped snow banks with a clean entrance. Crystal landmarks receive a darker base patch so pale silhouettes do not dissolve into the floor.
- Cluster supports: `decal-frostfell-01` snow bank, `-04` cracked ice, and `-05` snow/rock as common; `-00` crystal and `-06` broken icicle only inside blocker footprints or on pit lips; `-03` frozen shrub and `-07` skeleton as rare accents. The available ids are enumerated in `packages/client/src/sprites/decal-manifest-frostfell.ts:3-12`.
- Pit lip: full ice shelf on north faces, cap-only frost on back edges, dark cobalt depth; place broken icicles pointing into the void.
- Ambient: sparse `frost-wisp`/`frost-mote` frames behind POIs. Do not place bright slick decals as harmless decoration; the dimension's named hazard is black ice. `packages/shared/src/dimensions.generated.ts:11-41`, `packages/client/src/vfx/particle-manifest.ts:34-41`

### Verdant Ruins — masonry routes reclaimed by growth

Visual premise: the strongest existing integrated-base kit becomes the benchmark. Reveal old stone circulation between ruins; let vegetation pool away from traffic and over pit backs.

- Tile roles: `tile-0`/`tile-3` moss field base; `tile-1` revealed stone route; `tile-2` overgrown cluster/edge transition.
- POI skirts: irregular broken flagstone underlay, root/leaf disturbance, soft olive-black AO. Extend existing painted roots and rubble with aligned small decals rather than a round shadow halo.
- Cluster supports: `decal-verdant-ruins-02` fern, `-06` carved rubble, and `-07` flowering vine as common; `-05` mud as route transition; `-01` column fragment and `-08` statue hand only inside large blocker footprints; `-00` tablet and `-03` spore cluster as rare story accents; `-04` vine coil at the leeward skirt. The available ids are enumerated in `packages/client/src/sprites/decal-manifest-verdant-ruins.ts:3-13`.
- Pit lip: painted mossy masonry face, rubble cap, hanging-growth suggestion only on the north face; keep the yellow danger rail visible through vegetation.
- Ambient: extremely sparse `nature-wisp` frames in wilderness pockets. Toxic glow is reserved for a real toxin-spore pool, not generic atmosphere. `packages/shared/src/dimensions.generated.ts:44-74`, `packages/client/src/vfx/particle-manifest.ts:50-57`

### Ashlands — ash plains interrupted by pressure and fracture

Visual premise: quiet charcoal ash carries the eye; hotter texture and obsidian debris tighten only around POIs and pits.

- Tile roles: `tile-3` quiet ash base; `tile-0` wind/heat flow; `tile-1` compressed volcanic cluster; `tile-2` cracked edge zone.
- POI skirts: soot-dark disturbance with ember-brown cast shadow; a restrained warm seam may touch a true pit boundary, never a harmless POI skirt.
- Cluster supports: `decal-ashlands-03`/`-10` coal and ash as common ground matter; `-05`/`-06`/`-07` obsidian groups inside blocker footprints and at lips; `-08` cracked boulder and `-09` charred ribs as accents; `-00` stump and `-04` sulfur only in sparse story clusters; `-01` glowing crack only on the authoritative pit/hazard edge. The available ids are enumerated in `packages/client/src/sprites/decal-manifest-ashlands.ts:3-15`.
- Pit lip: strongest interior gradient, ember-red underband, orange exact rail, obsidian chips on concave corners.
- Ambient: use the existing ember-eruption smoke/wisp component or a `fire-wisp` frame at very low frequency from deep pit interiors; never run the full eruption as wallpaper. The composer identifies ember smoke as wisp index 4 and the ground crack as index 10. `packages/client/src/vfx/fx-composer.ts:102-114`

### Neon-Cyber — infrastructure bays connected by service lanes

Visual premise: replace organic ellipses with designed foundation slabs, cable runs, maintenance stains, and panel-wear corridors. This dimension should feel assembled, but still physically attached.

- Tile roles: `tile-0` quiet plaza base; `tile-1` service route/hazard stripe; `tile-2` machinery bay and vent cluster; `tile-3` rare color-stained transition.
- POI skirts: procedural chamfered slab or octagonal maintenance pad sized from `r`, with grime underprint, south-east cast shadow, and tight AO under feet. Preserve panel orientation; use 0/90° rotations only where seams align.
- Cluster supports: `decal-neon-cyber-01` cables, `-04` board, `-00` grate, and `-07` access cover as common infrastructure; `-03` wreck and `-09` case inside blocker footprints; `-05` oil spill and `-08` graffiti as flat path punctuation; `-02` powered panel as one hero accent. The available ids are enumerated in `packages/client/src/sprites/decal-manifest-neon-cyber.ts:3-14`.
- Pit lip: full broken-deck face on north edges, thin cap and exposed cable ends elsewhere, cyan exact rail over a violet support band.
- Ambient: `shock-spark` frames and lightning filaments belong only to an active live-grid event. The composer already identifies lightning arcs and the storm pack's flash/wind/rain roles; reuse individual existing components at floor-safe depth rather than calling a full combat burst. `packages/client/src/vfx/fx-composer.ts:75-81`, `packages/client/src/vfx/fx-composer.ts:115-119`, `packages/shared/src/dimensions.generated.ts:110-140`

## Existing-art sanitation and quarantine

Visual inspection of the shipped PNGs found source defects that composition cannot hide:

- `packages/client/public/pois/poi-05.png` — visible chroma-green field.
- `packages/client/public/pois/frostfell/poi-frostfell-05.png` — visible chroma-green field.
- `packages/client/public/pois/neon-cyber/poi-neon-cyber-03.png` — malformed narrow/sliver trim with green residue.
- `packages/client/public/decals/neon-cyber/decal-neon-cyber-06.png` — visible chroma-green field.

Quarantine these four ids from selection for the first pass. This requires no replacement render: use the remaining pack entries and keep kind-to-art choice deterministic. The affected POI/decal ids are currently present in their generated manifests and images are loaded directly, so without an explicit exclusion they remain eligible. `packages/client/src/sprites/poi-manifest.ts:1-3`, `packages/client/src/sprites/poi-manifest-frostfell.ts:1-10`, `packages/client/src/sprites/poi-manifest-neon-cyber.ts:1-11`, `packages/client/src/sprites/decal-manifest-neon-cyber.ts:1-14`, `packages/client/src/scenes/ArenaScene.ts:1068-1079`

If an engineering pass later performs runtime chroma-key cleanup, the asset must still pass alpha-edge, footline, and base-width review before re-entering a pool. Do not solve a bad trim by scaling it until its total width matches collision; current scaling uses total source width, which makes an abnormally narrow image especially dangerous. `packages/client/src/scenes/arena/floor-renderer.ts:238-253`

## Painted VFX: environment use, not visual noise

The library is ample: the component composer registers 12 packs, the particle manifest contains 96 element/shape packs, and the impact loader handles eight six-frame strips. `packages/client/src/vfx/fx-composer.ts:17-46`, `packages/client/src/vfx/particle-manifest.ts:9-106`, `packages/client/src/scenes/arena/vfx.ts:21-33`, `packages/client/src/scenes/arena/vfx.ts:363-390`

Use it with restraint:

- Ambient floor dressing may reuse individual `wisp`, `mote`, `ground`, rain, smoke, or wind textures at negative world depth. Maximum two ambient motions in the camera view; 4–7 second seeded intervals; alpha 0.08–0.22; no additive core.
- Do not call `playFxPack` as persistent ambience. Its components use high combat depths, independent self-destroying tweens, and a per-frame combat budget of ten. `packages/client/src/vfx/fx-composer.ts:183-204`, `packages/client/src/vfx/fx-composer.ts:239-290`
- Keep the eight additive impact flipbooks for actual impacts or authoritative terrain reactions. They play above the world at the damaged diameter and would read as false combat if looped decoratively. `packages/client/src/scenes/arena/vfx.ts:392-428`
- Ambient timing and placement use `seedDecor`; no `Math.random()` in the static floor bake.

## Implementation order

1. Add art metadata and quarantine: `projection`, `footY`, `baseWidth`, `heightClass`, allowed rotations/flips, cluster role, conservative footprint.
2. Replace the uniform decal/dust pass with the deterministic composition graph, route mask, cluster allocation, and full-footprint ground test.
3. Build the batched base-skirt/cast-shadow/contact-AO grounding stack under all POIs; keep POI image depth sorting and authoritative scales.
4. Build the `MaterialZoneMap`, weight/blend the four existing tile variants, and remove the universal grid outside Neon-Cyber.
5. Replace flat pit rectangles with the masked depth field, orientation-aware painted rim, crossing-specific hop telegraph, and debris lip.
6. Apply the five dimension recipes and only then add restrained ambient component reuse.

This order makes the highest-value change—objects visibly touching the floor—reviewable before pit and atmosphere polish.

## Acceptance gate

Capture the same seed in all five dimensions at gameplay camera scale and pass every item:

1. Every POI has a visible material skirt, directional cast shadow where appropriate, and tight AO. No landmark relies on the old centered black ellipse alone.
2. The visible ground-touching base matches the authoritative collision diameter within ±10%; test S, M, L, and XL.
3. A player can walk behind and in front of every landmark without a floor shadow drawing over the rig.
4. No `upright` decal is plane-rotated or mirrored; no flat decal casts a hovering shadow.
5. At least 80% of decal instances belong to a cluster, route, or pit lip; wilderness scatter is visibly sparse.
6. No decal or dust footprint crosses a pit unless deliberately clipped as rim debris.
7. Routes connect set-pieces without crossing pits, blockers, or the spawn safety rail.
8. The pit rail matches live fall geometry; “hop” notches appear only where that normal-direction gap is within shared jump reach.
9. Every pit has a continuous depth read and painted north face; side/back treatments do not rotate the cliff perspective incorrectly.
10. Wild West, Frostfell, Verdant Ruins, and Ashlands no longer show a universal vector grid. Neon-Cyber uses grid/panel reveal as local infrastructure, not wallpaper.
11. Quarantined green/sliver assets never appear.
12. Ambient painted VFX never resemble an unearned hit, hazard, pickup, or enemy tell.
13. Two clients on the same seeds produce identical cluster, route, debris, and ambient placement.
14. Floor rebuild/descent destroys every generated floor object cleanly; the scene currently owns that lifecycle through `floorObjs`. `packages/client/src/scenes/ArenaScene.ts:2350-2357`, `packages/client/src/scenes/ArenaScene.ts:2383-2407`

## Final art target

From far away: four to six memorable terrain districts, not 28 unrelated obstacles.

At combat distance: every base compresses, stains, cracks, roots into, or bolts onto the floor; every pit has a lip, wall, and depth; paths explain why props are where they are.

In motion: one north-west light, one stable projection, one authoritative boundary language. The player should never need to guess whether a mark is decoration, cover, or danger.
