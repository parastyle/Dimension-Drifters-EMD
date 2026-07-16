# Map aesthetic redo — technical implementation brief

## Verdict

Ship the first redo as a client-only floor-composition change. Keep every `map.pois[]` center and every `poiRadius(kind)` unchanged, then make the floor visually grow into those fixed blockers: calibrated contact anchors, one reusable soft-shadow texture, collision-contained prop clusters, sparse path wear, quieter grid lines, and a four-sided pit-edge treatment derived from the existing rim art. This is the fastest route to a grounded map and it preserves server authority. `packages/shared/src/mapgen.ts:49-65`, `packages/shared/src/mapgen.ts:346-349`

Do not move POIs, change their count, or change their collision shape in this first release. Those are shared-mapgen changes and need a lockstep client/server deployment plus determinism and collision tests. `packages/shared/src/mapgen.ts:421-454`, `packages/server/src/rooms/GameRoom.ts:464-467`

No new painted renders are required or proposed. Every treatment below uses the existing dimension tiles, rims, POIs, and decals, plus runtime Canvas/Graphics work.

## What is actually wrong

### Code-level diagnosis

The scene builds the arena in three steps: `drawArena`, then `buildArenaFloor`, then `buildPois`; all returned objects enter `floorObjs` and are destroyed together on the next accepted seed set. `packages/client/src/scenes/ArenaScene.ts:2350-2357`, `packages/client/src/scenes/ArenaScene.ts:2384-2404`

The base is four seeded 512px painted tiles at depth `-19.5`, with a vector grid drawn over them at alpha `0.5`; requiring all four variants means a partial kit takes the legacy fallback. `packages/client/src/scenes/arena/floor-renderer.ts:117-166`

POI presentation is only loosely fitted to collision. Art is split into “squat” and “tall” pools using whole-image aspect ratio, selected from `kind`, scaled from the whole texture width, bottom-anchored with one universal sink amount, and given the same black ellipse regardless of silhouette. `packages/client/src/scenes/arena/floor-renderer.ts:217-256`

That automatic fit is the core grounding failure. Whole-image width is not base width: a crane boom, tree canopy, arch, fountain, tower, and boulder need different contact points and base spans even when their PNG bounds are similar. The existing collision-derived scaling intent is correct, but the measurement is wrong. The collision radius itself is a deterministic S/M/L/XL size class and must remain the visual source of truth. `packages/shared/src/mapgen.ts:331-349`

The current shadow also lives at `poi.y - 1`, not in the negative floor stack. An actor standing north of the POI can therefore be below the shadow in depth even though the shadow is ground paint. `packages/client/src/scenes/arena/floor-renderer.ts:241-253`

Every POI image, including masonry, machinery, ice, and rock, is rotated every frame by the generic wind-sway loop. That tiny motion is appropriate for a dead tree but makes rigid landmarks feel unplanted. `packages/client/src/scenes/ArenaScene.ts:5912-5935`

The pit material is incomplete around its perimeter. The renderer discovers all four edge orientations, but the painted rim pass filters to only `nx === 0 && ny === 1`; all remaining sides receive only the vector rust/lip treatment. `packages/client/src/scenes/arena/floor-renderer.ts:294-338` The exact gameplay edge is already available as the segment centerline, and the hot lip and hop/go-around vocabulary are drawn on that line. `packages/client/src/scenes/arena/floor-renderer.ts:339-368`

Open-floor decals have no semantic distinction between flat stain and apparent obstacle. Each manifest is just an ID array, while `scatterDecor` treats every ID as freely walkable ground litter. `packages/client/src/sprites/decal-manifest.ts:1-13`, `packages/client/src/scenes/arena/floor-renderer.ts:398-416` That is a WYSIWYG problem when a painted boulder, ice crystal, stump, sarcophagus, or machinery crate is placed outside a collision footprint.

There is no separate painted-patch channel in the current client contract: `DimensionPropPack` contains only POI/decal IDs and directories, and the lazy floor-art list loads four tiles, one rim, decals, and POIs. `packages/client/src/scenes/arena/floor-renderer.ts:40-45`, `packages/client/src/scenes/ArenaScene.ts:2320-2337` Treat “patches” in this redo as procedural ground shapes or explicitly `flat` members of the existing decal packs; do not assume an unloaded patch library exists.

The existing density is also higher than the loop constants first suggest. The arena is 4800×4800, and decor counts are scaled from a 2400×2400 reference, so the current area multiplier is `4`: up to 160 dust-drift Ellipse objects and 280 painted-decal candidates are created per floor. `packages/shared/src/constants.ts:158-159`, `packages/client/src/scenes/arena/floor-renderer.ts:384-416`

### Asset-level diagnosis

Visual inspection of the existing files shows the perspective mismatch directly:

- `packages/client/public/tiles/*/tile-0.png` reads as straight-down continuous material.
- `packages/client/public/pois/*/poi-*.png` reads as high three-quarter landmark art, often with a painted rubble, snow, moss, lava, or machine skirt.
- `packages/client/public/tiles/*/rim.png` contains a top-down ground half and a deep, front-facing wall/drop half.
- `packages/client/public/decals/*/decal-*.png` mixes low ground patches with object-like silhouettes.

The art is usable. It needs an explicit projection/contact contract and semantic placement, not more renders.

## Authority boundary: hard rule

`ArenaMap` contains the POI world centers and kinds. The map is generated in shared code from four seeds; the server mints those seeds and holds its own generated map, while the client regenerates from the synced values. `packages/shared/src/mapgen.ts:42-65`, `packages/server/src/rooms/GameRoom.ts:4346-4362`, `packages/client/src/scenes/ArenaScene.ts:2358-2363`

POI placement is currently rejection-sampled in shared mapgen, including spawn clearance, solid-ground footprint clearance, and pairwise walking gaps. `packages/shared/src/mapgen.ts:356-418` The server resolves players and enemies against those circles and tests projectiles against them as cover. `packages/server/src/rooms/GameRoom.ts:1788-1794`, `packages/server/src/rooms/GameRoom.ts:2105-2114`, `packages/server/src/rooms/GameRoom.ts:3767-3785` Local prediction uses the same shared POI collision before rendering the predicted position. `packages/client/src/net/prediction.ts:141-155`, `packages/client/src/net/prediction.ts:202-205`

Therefore:

- Safe client cosmetics may read `map.pois`, `map.tiles`, `poiRadius`, and the synced seeds, but may not mutate them.
- A “cluster” in the first release is dressing around a fixed authoritative POI, not a new obstacle group.
- Any solid-looking cluster decal must fit inside the existing POI circle. Anything outside that circle must read as flat, traversable ground treatment.
- Moving a POI, changing how many are placed, or changing a circle into a compound footprint requires shared mapgen and all collision consumers to change together.

This follows the project’s WYSIWYG doctrine: the audit already treats visible-versus-authoritative position and hit geometry divergence as a gameplay defect, not merely a polish defect. `docs/GAMEFEEL_AUDIT.md:93-96`

## Client-cosmetic implementation — ship first

### 1. Give each painted asset a placement contract

Extend the client-only `DimensionPropPack` in `floor-renderer.ts`; do not extend shared `DimensionPalette` for cosmetic-only data. The current prop pack already owns per-dimension POI/decal IDs and directories, while the shared palette is deliberately limited to floor/pit/rim color slots. `packages/client/src/scenes/arena/floor-renderer.ts:40-85`, `packages/shared/src/dimensions.ts:12-40`

Add client metadata with these concepts:

```ts
type PoiVisualMeta = {
  id: string;
  bucket: "squat" | "structure" | "organic";
  contactX: number;       // source pixel at the ground contact
  contactY: number;       // source pixel at the ground contact
  baseSpanPx: number;     // painted base width, not PNG width
  maxClass: "S" | "M" | "L" | "XL";
  swayRad: number;        // zero unless explicitly organic
  usable: boolean;        // false for a silhouette incompatible with a circle collider
};

type DecalVisualMeta = {
  id: string;
  role: "flat" | "edge" | "solid";
  footprintPx: number;
};
```

This is intentionally hand-authored metadata over the existing manifests. Aspect ratio cannot tell a support footprint from a crane arm or a walk-through-looking arch. Keep selection deterministic by filtering the build-time manifest through metadata, then using the existing `kind`-based selection; never filter by the set of textures that happened to load. The present renderer already preserves deterministic choices by selecting from build-time manifest IDs and skipping only the failed draw. `packages/client/src/scenes/arena/floor-renderer.ts:210-237`, `packages/client/src/scenes/arena/floor-renderer.ts:401-403`

In `buildPois`, replace the universal origin and whole-texture-width scale with:

```ts
const sc = (2 * poiRadius(poi.kind)) / meta.baseSpanPx;
img.setOrigin(meta.contactX / tex.width, meta.contactY / tex.height);
img.setPosition(poi.x, poi.y + 0.04 * r);
```

The exact `0.04r` sink is a tuning start, not a geometry change. The acceptance rule is more important: the painted contact footprint should cover approximately the same circle that stops the player. Keep the sprite at depth `poi.y` so actors still walk behind its upper structure and in front of its base; that is the current intended sort model. `packages/client/src/scenes/arena/floor-renderer.ts:195-204`, `packages/client/src/scenes/arena/floor-renderer.ts:249-256`

Set `swayRad = 0` by default and apply sway only when metadata explicitly marks an organic asset. The existing per-frame loop can keep occlusion alpha, but it must stop rotating every POI indiscriminately. `packages/client/src/scenes/ArenaScene.ts:5923-5935`

Exclude an asset from the first-release POI pool when its silhouette promises navigation the circle collider does not provide—for example, a large open arch. Reintroduce it only with a matching shared collision shape in the later mapgen phase.

### 2. Replace the hard oval with one reusable contact-shadow texture

Hook this directly into `buildPois` where the current per-POI Ellipse is created. `packages/client/src/scenes/arena/floor-renderer.ts:241-255`

Create one `128×128` CanvasTexture, once per scene/texture manager, under a stable key such as `floor:contact-shadow`. Paint a black circular radial gradient with a small dense core and a transparent edge, then call `refresh()`; displaying the square texture as a wide, short Image produces the ellipse without clipping the gradient. The project already has a Phaser 4 CanvasTexture + `createRadialGradient` + `refresh()` pattern. `packages/client/src/scenes/ArenaScene.ts:5035-5050`, `packages/client/src/scenes/ArenaScene.ts:5069-5073`

For each POI, add one Image using that texture:

- position: `(poi.x, poi.y + 0.04r)`;
- display size: about `(2.15r, 0.78r)`;
- alpha baked into the gradient, not multiplied by an opaque black oval;
- fixed negative grounding depth, proposed `-11`, so it is above floor paint but below every entity/POI sprite;
- no tween and no per-frame update.

At 40 POIs this costs one nominal 64 KiB RGBA texture and 40 static quads (80 triangles), with one shared texture key and no procedural geometry per POI. Keeping all shadows at one fixed depth and creating them contiguously gives the renderer the best chance to batch them. This is preferable to 40 Graphics objects. A single Graphics containing 40 ellipses would reduce object count further, but it cannot provide the soft radial falloff and is harder to calibrate per base.

The production map currently caps placement at 28 POIs, so a 40-POI benchmark provides useful headroom without changing gameplay. `packages/shared/src/constants.ts:195-212`

Add every shadow Image to `objs`, but do not add it to `PoiSprite[]`; the existing floor teardown will then destroy it on a seed/dimension rebuild, while the reusable texture remains cached. `packages/client/src/scenes/arena/floor-renderer.ts:205-215`, `packages/client/src/scenes/ArenaScene.ts:2350-2357`

### 3. Build a grounding cluster without moving its collider

Still inside `buildPois`, add a `buildPoiGroundingCluster` pass after the shadow and before the landmark Image is returned. It consumes the same fixed `poi` center and radius.

Use an independent stream per POI:

```ts
makeRng(mixSeeds(
  map.seeds.seedDecor,
  map.seeds.seedTheme,
  poi.kind,
  poiIndex,
  0x00c1a57e,
));
```

`makeRng` and `mixSeeds` are explicitly intended to give independent deterministic streams from synced scalars. `packages/shared/src/rng.ts:23-52` Draw every candidate tuple—asset index, angle, radius, rotation, scale, flip—before testing pits, overlap, or texture availability. This fixed-cadence rule matches the existing decor pass and prevents one rejected/missing asset from reshuffling all later candidates. `packages/client/src/scenes/arena/floor-renderer.ts:388-415`

Placement rules:

- `solid` decals: at most three per POI; fit their entire visual footprint inside `0.82r`. These become rubble/root/ice/machine details belonging to the already-collidable landmark.
- `edge` decals: place tangent to the contact skirt but keep any apparent height inside the circle.
- `flat` decals: may extend to about `1.45r`; use them as soot, cracks, bones, snow scuff, moss, cables, sand, or exposed paving because the player may walk over them.
- Reject a candidate if its sampled footprint touches a pit. `isPitAtPx` is the shared tile-truth query already used by ambient scatter. `packages/shared/src/mapgen.ts:457-467`, `packages/client/src/scenes/arena/floor-renderer.ts:395-416`
- Do not create a second collision vocabulary. The shadow communicates the circle; solid dressing stays inside it.

Use a fixed negative depth for all cluster dressing. It is floor integration, not another y-sorted obstacle.

### 4. Add sparse path wear as one static floor pass

Add `buildPathWear(scene, map, dimensionId, palette)` near the start of `buildArenaFloor`, after `T` and the ground predicate are available and before pit objects are created. Return its Graphics in `out` so the existing lifecycle owns it. `packages/client/src/scenes/arena/floor-renderer.ts:267-288`

Path generation is cosmetic and read-only:

1. Make nodes from spawn plus a small landmark subset: all XL/L POIs, then seeded M POIs until there are at most 8–10 destinations.
2. For each destination, choose the nearest already-connected node and route on the existing tile grid with deterministic cardinal A*/BFS.
3. A tile is passable only when it is ground and its center lies outside every POI circle inflated by a small visual margin; accept an edge only when that center-to-center segment also clears the inflated circles. Route each destination to a target tile just outside its own circle. `map.tiles` is the gameplay ground/pit grid, and `poiRadius` is the authoritative blocker radius. `packages/shared/src/mapgen.ts:52-65`, `packages/shared/src/mapgen.ts:470-477`
4. Use a fixed neighbor order and a separate wear salt, for example `mixSeeds(seedDecor, seedTheme, 0x57454152)`. Never use `Math.random`.
5. Render cardinal center-to-center segments with width no greater than `0.32T`; round dots at turns stay inside their ground tile. The later pit fill at depth `-14` also covers any antialias fringe. The pit fill currently sits above all low floor dressing. `packages/client/src/scenes/arena/floor-renderer.ts:284-292`

Draw all wear into one Graphics object in two passes at proposed depths `-18.8` and `-18.6`: a broad low-alpha material change, then a narrower broken center trace. Break strokes with deterministic gaps rather than smoothing a polyline across corners; naive curve smoothing can visibly cut over a diagonal pit.

Keep the style client-only and dimension-specific:

- Wild West: dark compacted dust plus two faint wheel/foot lanes.
- Frostfell: blue-grey scuff exposing darker ice beneath the white surface.
- Verdant Ruins: worn moss revealing desaturated flagstone.
- Ashlands: compressed soot with a dim cooled-crust center.
- Neon-Cyber: greasy traffic wear with sparse low-alpha cyan/magenta trace remnants.

The paths need not claim enemy AI routes. They are historical wear that connects places players can actually reach, so they create composition without changing navigation.

### 5. Make pits part of the material, on all four sides

Keep the flat pit fill and exact segment centerlines. Those are legible and aligned with gameplay truth. The shared classifier already marks pit regions as hoppable for the rim vocabulary; it is explicitly cosmetic. `packages/shared/src/mapgen.ts:594-640`

Replace `topRuns` with orientation-keyed run merging over `(nx, ny)`. The segment list already provides every side and its inward normal. `packages/client/src/scenes/arena/floor-renderer.ts:294-316`

Because the painted rim is perspective-bearing, do not simply rotate the full cliff wall onto every side:

- Camera-facing edge (`nx=0, ny=1`): keep the full existing rim, with its ground half on ground and wall half in the pit.
- Opposite and side edges: derive a shallow `rim-lip` runtime texture by copying only the upper material/lip portion of the loaded rim source into a small CanvasTexture. Tile that strip along the run and rotate/orient it so its ground side remains on ground.
- Add one low-alpha inner darkness stroke just inside every pit edge to connect the shallow strips to the void.
- Keep the current vector rust band, hot exact lip, and chevrons above all painted material. `packages/client/src/scenes/arena/floor-renderer.ts:317-368`

This uses the existing rim paintings without inventing sideways cliff lighting. It also makes the hazard perimeter continuous while preserving the exact “what you see is what falls” edge.

### 6. Quiet the overlays and separate depth bands

The current documented floor stack is entirely negative until the y-sorted entities. `packages/client/src/scenes/arena/floor-renderer.ts:27-35` Preserve that architecture, but make the material hierarchy explicit:

| Proposed depth | Treatment |
|---:|---|
| `-20` | ground bed |
| `-19.5` | painted tile base |
| `-19` | grid, reduced from `0.5` alpha to roughly `0.12–0.18` by dimension |
| `-18.8/-18.6` | broad/fine path wear |
| `-17.4` | large procedural ground patches |
| `-16` | dust drift, batched into one Graphics |
| `-15` | flat ambient decals |
| `-14` | pit void |
| `-13.9` | full/shallow painted rim material |
| `-13.8` | exact vector lip, chevrons, spawn ring |
| `-13.6` | POI terrain skirts/clusters |
| `-12` | arena rail |
| `-11` | reusable POI contact shadows |
| `worldY` | POI sprites and actors |

The grid is currently intentionally retained over painted art at `0.5` alpha. Reducing it is a client-only material decision and does not affect tile truth. `packages/client/src/scenes/arena/floor-renderer.ts:138-155`

## Determinism rules for every cosmetic pass

Cosmetic determinism is not required for server collision, but it is required for co-op visual consistency and reproducible screenshots.

1. Give wear, ambient scatter, and each POI cluster independent salted streams. The shared RNG supports this exact separation. `packages/shared/src/rng.ts:39-52`
2. Base candidate counts and iteration order only on synchronized map data and build-time manifests.
3. Draw the full fixed candidate tuple before any rejection.
4. Missing textures skip a draw only; they never remove an ID from the selection pool or alter later RNG cadence. This is already the renderer’s stated contract. `packages/client/src/scenes/arena/floor-renderer.ts:401-415`
5. Never let `scene.textures.exists` decide path topology, candidate count, POI choice, or RNG consumption.
6. Keep all new descriptors pure enough to snapshot in tests: `{textureKey, x, y, scale, rotation, flip, depth}`.

The client rebuild gate keys on all four seeds plus dimension and returns immediately when the key is unchanged, so all these static passes should build once per map—not in `update`. `packages/client/src/scenes/ArenaScene.ts:2350-2357`, `packages/client/src/scenes/ArenaScene.ts:2738-2739`

## Performance and draw-order budget

At the requested 40-POI stress case:

- Contact shadows: 1 CanvasTexture, 40 static Images, 80 triangles, no frame updates.
- Landmark art: 40 y-sorted Images; accept texture switches here because correct actor/landmark depth is more important than batching.
- Grounding clusters: cap at 3 solid/edge Images per POI; group creation by texture key at the same negative depth where overlap order is irrelevant.
- Wear: 1–2 Graphics objects built once.
- Dust: replace the current per-drift Ellipse objects with one Graphics containing all filled ellipses. The current loop can produce 160 separate drift objects on the 4800² arena. `packages/client/src/scenes/arena/floor-renderer.ts:384-397`
- Ambient decals: reduce the current 280-candidate open scatter, retain only `flat` roles, and group the accepted descriptors by texture key before creating Images. The current code assigns every accepted painted decal the same depth, so grouping does not change meaningful occlusion. `packages/client/src/scenes/arena/floor-renderer.ts:404-416`
- Pit fill and vector rim: retain the existing single Graphics objects. `packages/client/src/scenes/arena/floor-renderer.ts:284-292`, `packages/client/src/scenes/arena/floor-renderer.ts:339-345`

Do not bake the entire 4800² floor into one RenderTexture: a full RGBA surface would be about 88 MiB before renderer overhead and would need rebuilding per dimension/seed. The existing tiled base plus a few static Graphics/Images is the better memory trade. `packages/shared/src/constants.ts:158-159`, `packages/client/src/scenes/ArenaScene.ts:2350-2365`

The only POI work that should remain per frame is occlusion alpha, plus opt-in organic sway. The current loop already visits each `PoiSprite`; removing rigid-object rotation avoids adding another update system. `packages/client/src/scenes/ArenaScene.ts:5915-5935`

Profile both WebGL and Canvas fallback with 40 injected client-only POI descriptors. Record floor-build time, steady-state frame time while sweeping the camera, display-list count, and draw calls. Treat “shared texture should batch” as a hypothesis to verify, not an assumption.

## Shared-mapgen phase — only after the cosmetic release

If the cosmetic pass still leaves the map composition too uniformly scattered, then change actual POI placement in shared code.

### Permitted shared redesign

Replace independent rejection sampling with deterministic macro-clusters:

- seed 5–7 macro anchors on safe ground;
- deal the existing S/M/L/XL cycle across anchors;
- place one navigation landmark near each anchor and 2–5 satellites around it;
- preserve spawn clearance, pit clearance, and the pairwise walking gap;
- optionally reserve broad negative-space lanes between clusters.

The implementation hook is `placePois`, not `floor-renderer.ts`. Today `placePois` owns the class deal, ground-footprint check, spawn clearance, and radius-aware spacing, and `generateArena` consumes its result. `packages/shared/src/mapgen.ts:351-443`

If centers move but footprints stay circular, `poiAt` and `resolvePoiCollision` can remain structurally unchanged because they already iterate `map.pois`. `packages/shared/src/mapgen.ts:470-520` If an asset needs a noncircular or compound footprint, change `PoiInstance`, `poiAt`, `resolvePoiCollision`, safe spawn handling, projectile carom normal, and client visual/debug tooling together. Server projectile reflection currently derives its normal from the POI center, so a compound shape cannot be introduced as an art-only change. `packages/server/src/rooms/GameRoom.ts:3772-3785`

### Deployment and tests

Changing shared mapgen while old and new clients coexist would make the same four seeds produce different POI truth. The schema handshake catches version mismatches and instructs the client to reload; bump `SCHEMA_VERSION` for a mapgen-contract change even if no serialized field is added. `packages/shared/src/state.ts:256-276`, `packages/shared/src/constants.ts:13`

Expand `tests/mapgen.test.ts` before landing shared clustering:

- The current determinism test compares tiles and spawn but not `pois`; add exact POI-array equality. `tests/mapgen.test.ts:38-45`
- Retain the 80-seed tests for solid-ground footprint, spawn clearance, and pairwise walk gap. `tests/mapgen.test.ts:135-166`
- Retain collision and cover tests for push-out and projectile blocking. `tests/mapgen.test.ts:169-210`
- Add a golden descriptor/digest for cluster membership and class counts.
- Add a server/client compatibility test proving the same seed/version yields the same POI centers, kinds, and radii.

Deploy shared package, server, and client together. Do not ship the server placement change ahead of the client bundle.

## Build order

### Release A — client cosmetic, no authority risk

1. Add POI/decal metadata inside the client floor-renderer module.
2. Calibrate contact pixels/base spans for all five existing dimension packs; opt rigid POIs out of sway.
3. Replace Ellipse shadows with the reusable radial-gradient texture at a fixed floor depth.
4. Reclassify decals: flat ambient scatter versus collision-contained cluster pieces; remove solid-looking open scatter.
5. Add deterministic POI skirts/clusters without changing any center or radius.
6. Add the one-Graphics path-wear network.
7. Extend painted pit integration to all orientations using the full front rim plus derived shallow lip strips.
8. Reduce grid opacity and collapse dust into one Graphics.
9. Validate all five dimensions at several fixed seeds, including pit-adjacent landmarks, S/M/L/XL fits, occlusion, ultrawide camera edges, and a 40-POI stress map.

No server, shared state, mapgen, predictor, or collision code changes belong in Release A.

### Release B — shared placement, only if still needed

1. Design macro-cluster invariants and negative-space targets.
2. Add POI-array determinism and cluster tests first.
3. Change shared `placePois`; keep circles unless art absolutely requires another footprint.
4. Update every collision consumer if footprints change.
5. Bump the compatibility version and deploy client/server/shared atomically.

## Acceptance gates

- At debug-overlay scale, each POI’s painted base and soft shadow communicate the same `poiRadius(kind)` circle that blocks movement.
- A player never collides with empty-looking ground and never walks through a solid-looking open-floor decal.
- Rigid structures do not sway.
- Every pit side has continuous material integration, while the exact vector lip remains on the authoritative tile edge.
- Wear routes never cross a visible pit or blocker and are identical for the same seed/dimension.
- Missing optional art removes only that draw; it never reshuffles positions or path topology.
- Floor dressing is static after the seed-key build; no shadow, wear, cluster, or dust redraw occurs in the frame loop.
- The 40-POI stress case stays within the agreed frame/draw-call budget on the minimum target GPU, measured rather than inferred.
