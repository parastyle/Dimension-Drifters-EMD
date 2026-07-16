# Map Aesthetic Redo — Devil's Advocate

> **Director mandate:** the obstacles look floating and disjointed; redo the map aesthetic, with no visual limits, using only the existing painted library and procedural work.

## Verdict in one sentence

**Approve an aggressive client-side composition and grounding redo; veto any art-driven change to authoritative map geometry until navigation, versioning, and collider-visual verification exist.** The current “floating” read is not caused by a total absence of grounding: every loaded POI already gets one black ellipse and a fixed `0.12r` sink. The problem is that a single generic treatment is being asked to reconcile radically different painted bases, while its depth can also compete with gameplay markings. `packages/client/src/scenes/arena/floor-renderer.ts:238-253`

“No limits” should mean no limits on composition, procedural dressing, theme response, or reuse of the painted library. It cannot mean no limits on gameplay occlusion, traffic flow, or client/server agreement. The game-feel audit already treats a visible/authoritative positional mismatch as a WYSIWYG failure and explicitly calls out reconciliation with server POI push-outs. `docs/GAMEFEEL_AUDIT.md:93-99`

## What is actually on screen now

| Layer | Current contract | Devil's-advocate read |
|---|---|---|
| Floor | Four 512px dimension tiles are selected and quarter-turned from the synced theme/decor seeds, then a 128px vector grid is drawn above them. Missing kits fall back to the legacy painted tile or a vector grid. `packages/client/src/scenes/arena/floor-renderer.ts:117-184` | The base is coherent at arena scale, but it has no awareness of where a landmark meets it. More global texture will not repair a local contact problem. |
| Pits | Pit cells are exact 80px rectangles; every ground-facing edge gets vector rust/hot-lip lines, but the painted high-3/4 rim is emitted only for north-facing edge runs. `packages/client/src/scenes/arena/floor-renderer.ts:284-345`; `packages/shared/src/constants.ts:161-180` | This is internally split between exact top-down gameplay geometry and one-direction painted cliffs. Extending the cliff art indiscriminately around all sides risks making the visible lip disagree with the lethal tile boundary. |
| POIs | Loaded art is bucketed by texture aspect ratio, scaled from the shared circular collision radius, anchored near bottom-centre, depth-sorted at world `y`, and given one hard-coded black ellipse. `packages/client/src/scenes/arena/floor-renderer.ts:217-256` | Scale is radius-aware, but contact is not asset-aware. A tree trunk, monumental head, basalt mound, tower platform, and neon sign do not share one footprint language merely because their texture widths are normalized. |
| Floor dressing | Dust and decals are deterministic and kept off pit sample points; decals do **not** reject POI footprints, spawn space, danger zones, portals, or pickups. `packages/client/src/scenes/arena/floor-renderer.ts:374-415` | Dressing can accumulate under a landmark base and amplify the cut-out/sticker edge. Increasing scatter density would make this worse and add noise exactly where players need to parse cover. |
| Dimension identity | The client has separate Wild West, Frostfell, Verdant Ruins, Ashlands, and Neon-Cyber POI/decal packs, while every dimension supplies a floor/pit/spawn/dust palette. `packages/client/src/scenes/arena/floor-renderer.ts:47-85`; `packages/shared/src/dimensions.ts:12-40`; `packages/shared/src/dimensions.generated.ts:10-141` | There is ample existing material for a redo. The missing piece is a theme- and asset-aware composition system, not another render pass. |

## Attack 1: “Ground it harder” can bury the game

### The attack

The obvious response—bigger shadows, opaque skirts, rubble collars, snowbanks, roots, smoke, fog—solves the screenshot while damaging the match. The current POI shadow is placed at `poi.y - 1`; pickups are fixed at depth `2`, corrosive zones and gates at depth `1`, and exact ground telegraphs at depth `3`. For the normal POI whose world `y` is in the hundreds or thousands, the shadow therefore sorts above all four of those low-depth gameplay objects. Making that shadow larger or darker directly increases the area in which loot, hazards, exits, and tells can be visually buried. `packages/client/src/scenes/arena/floor-renderer.ts:241-244`; `packages/client/src/scenes/ArenaScene.ts:1730-1792`; `packages/client/src/scenes/ArenaScene.ts:4061-4088`; `packages/client/src/scenes/ArenaScene.ts:4107-4130`; `packages/client/src/scenes/ArenaScene.ts:1341-1353`

There is a second failure mode behind tall landmarks. Only the image is retained in `PoiSprite`; the separate grounding ellipse is not. The occlusion routine fades and sways the image, but not the ellipse, so any more elaborate separately-created skirt or shadow will remain fully opaque unless it is explicitly grouped into the same occlusion unit. `packages/client/src/scenes/arena/floor-renderer.ts:195-197`; `packages/client/src/scenes/arena/floor-renderer.ts:241-256`; `packages/client/src/scenes/ArenaScene.ts:5798-5822`

The current WYSIWYG sizing is also only an approximation of the visible base. It sets the entire texture width to `2r × 1.3`, regardless of where the opaque pixels actually touch the ground. That is reasonable for canopy overhang but cannot prove that a painted platform, rock pile, or narrow trunk communicates the same circular blocker. `packages/client/src/scenes/arena/floor-renderer.ts:226-253`; `packages/shared/src/mapgen.ts:332-348`

Worst of all, a missing POI texture currently produces no sprite and no shadow: the renderer filters missing textures and skips the instance, while the server continues to resolve players and enemies against every POI in the generated map. A “beautiful when fully loaded” treatment that lacks an unconditional procedural footprint can already degrade into an invisible wall. `packages/client/src/scenes/arena/floor-renderer.ts:210-237`; `packages/server/src/rooms/GameRoom.ts:1775-1794`; `packages/server/src/rooms/GameRoom.ts:2090-2116`

### Steelman

The director is right about the diagnosis. A high-3/4 landmark on straight-down ground needs a transition zone: contact darkening, local material response, and small occluding foreground matter are the visual grammar that says “embedded here,” not “PNG hovering here.” Existing painted POIs often already contain snow, rocks, foliage, platform boards, or rubble at their feet; the renderer should extend those cues into the floor instead of stamping the same black oval underneath every asset.

This can remain entirely cosmetic. The client already receives/reconstructs the authoritative map, then builds the arena floor and POIs from it; a grounding compositor can consume that map read-only without changing collision. `packages/client/src/scenes/ArenaScene.ts:2350-2407`

### Verdict

**Replace the generic ellipse; do not stack more treatment on top of it.** Use three client-only pieces:

1. **Contact kernel:** an asset-profiled procedural ellipse/polygon kept inside the authoritative radius, soft and dark only at the actual foot.
2. **Material response:** low-contrast existing decals plus procedural cracks, frost dust, soot, roots, sand, or circuit traces that radiate outward without pretending to block movement.
3. **Collider cue:** a subtle, quality-invariant footprint/rim that survives missing art and becomes more explicit on proximity, collision, or aim-through-cover.

The profile belongs in client art metadata keyed by POI texture or silhouette family: contact width, contact depth, skirt style, tint family, and which existing decals may be recruited. It must not alter `kind`, `poiRadius`, map seeds, or placement.

### Readability floor — non-negotiable

- **Depth ceiling:** all contact kernels, stains, skirts, and recruited decals stay at depth `≤ 0`. Zones/gates already occupy depth `1`, pickups depth `2`, and exact ground tells depth `3`; this preserves their present ordering while POI art itself can continue to depth-sort at world `y`. `packages/client/src/scenes/ArenaScene.ts:1341-1353`; `packages/client/src/scenes/ArenaScene.ts:1790-1792`; `packages/client/src/scenes/ArenaScene.ts:4080-4088`; `packages/client/src/scenes/ArenaScene.ts:4122-4130`
- **Opacity budget:** one contact kernel may peak around 0.18 alpha; the broader material response should stay at or below the current dust-drift band of 0.03–0.07. No additive bloom in the floor-grounding pass. `packages/client/src/scenes/arena/floor-renderer.ts:388-397`
- **Footprint budget:** dense contact darkness stays within `poiRadius(kind)`; any material outside it must read as walkable and remain low-frequency. The server's obstacle test is the shared circle, not the opaque bounds of the art. `packages/shared/src/mapgen.ts:470-520`
- **Pickup proof:** a pickup's beam, 100×34 halo, spinner, and label must remain readable against every contact profile and every floor kit. Those are the current loot identity channels. `packages/client/src/scenes/ArenaScene.ts:1730-1803`
- **Tell proof:** exact danger edges and the grab highlight must never inherit POI fade, floor tint, reduced-quality removal, or grounding opacity. Their dedicated layers are explicitly quality-invariant/high-priority. `packages/client/src/scenes/ArenaScene.ts:1341-1353`
- **Occlusion unity:** foreground skirt pieces that can cover a player must fade with the POI image; background stains must remain below gameplay. The present fade targets only `p.img`, so new pieces must be grouped or explicitly registered. `packages/client/src/scenes/ArenaScene.ts:5812-5822`
- **Fallback proof:** if any painted texture is absent, draw the procedural contact kernel plus collider rim anyway. An invisible authoritative blocker is a release stop.

## Attack 2: Clusters can turn a bullet-heaven into a traffic jam

### The attack

Set-piece clusters are a persuasive art solution because they create neighborhoods rather than confetti. They are also a mechanical redesign if every visible chunk becomes cover. The current generator deliberately spreads pit seed sites, spaces POIs by both radii plus a 150px walking gap, and reserves a 72px solid-ground clearance ring around every POI. `packages/shared/src/mapgen.ts:78-101`; `packages/shared/src/mapgen.ts:356-416`; `packages/shared/src/constants.ts:199-212`

Even with those rules, the existing validation does not prove navigation after obstacles. Ground connectivity is repaired **before** POIs are placed, and `validateArena` checks spawn, border, and tile reachability only; it never inflates or subtracts POI circles. Therefore a clustered-collider proposal can pass the existing map validator while creating a body-width bottleneck. `packages/shared/src/mapgen.ts:421-454`; `packages/shared/src/mapgen.ts:643-661`; `packages/server/src/rooms/GameRoom.ts:4345-4362`

The combat consequences cut both ways. Players and normal enemies are pushed out of POIs, enemies explicitly bunch and flow around them, and projectiles are absorbed or ricochet from the same cover. Normal enemies that cross a pit die without XP, while bosses ignore both POI collision and pit death. A cluster beside a pit can therefore become either a degenerate no-XP horde grinder/bullet bunker or a player trap that the boss ignores. `packages/server/src/rooms/GameRoom.ts:1775-1794`; `packages/server/src/rooms/GameRoom.ts:2090-2131`; `packages/server/src/rooms/GameRoom.ts:3767-3793`

The order of operations raises the stakes: player POI push-out happens immediately before grounded pit detection. The existing ground-clearance placement rule protects that sequence; an art-authored compound collider or tighter pit skirt that bypasses the rule can push a player directly into the fall test. `packages/server/src/rooms/GameRoom.ts:1775-1828`; `packages/shared/src/mapgen.ts:393-407`

### Steelman

Clusters are still the best composition answer. A landmark with two or three related, **non-colliding** satellite decals, a local patch, and a material trail reads as a site. Repeated motifs can connect sites into lanes and biomes. Nothing about that requires another authoritative circle.

The existing architecture already distinguishes collidable POIs from low-depth decals: POIs come from `map.pois`, while decorative images are scattered by the client and never enter server collision. `packages/shared/src/mapgen.ts:49-65`; `packages/client/src/scenes/arena/floor-renderer.ts:370-415`

### Verdict

**Adopt visual clusters; reject collider clusters for this pass.** Each generated POI remains the sole mechanical obstacle. Build a set-piece around it using existing decals, procedural patches, shallow shadows, and theme-specific connective motifs. Satellites must look crushable, flat, porous, or otherwise nonblocking. If a satellite looks like a second building, the art has lied even if the code is “safe.”

Authoritative compound set-pieces can be a later map-design project, but only after the validator models them and horde simulations demonstrate acceptable flow.

### Cluster guardrails

- **One collider per site:** the existing `map.pois` circle is the only blocker; all added satellites are cosmetic. `packages/shared/src/mapgen.ts:470-520`
- **Protect the current floor:** never reduce the existing 150px surface-to-surface POI gap or 72px POI-to-pit ground clearance. `packages/shared/src/constants.ts:199-212`
- **Two-route rule:** no visual cluster may imply that its non-colliding pieces close a second exit. The readable route and the physical route must agree.
- **Horde-throughput gate:** stress each seed with dense normal enemies at the POI/pit seam. The current server resolves enemy body separation before POI push-outs, then pit deaths; that is the exact sequence the stress test must exercise. `packages/server/src/rooms/GameRoom.ts:2086-2131`
- **Boss-asymmetry gate:** reject any composition that reads as a safe wall against a boss, because bosses currently crush through POIs and do not fall into pits. `packages/server/src/rooms/GameRoom.ts:2090-2124`
- **Cover honesty:** foliage, fog, and skirts cannot make the circle appear wider than the surface that blocks bullets; POIs stop shots in both directions. `packages/server/src/rooms/GameRoom.ts:3767-3793`
- **Spawn and objective halos:** keep all dense cluster dressing out of the guaranteed spawn area and out of dynamic pickup/portal readability. POIs already scale their spawn clearance by their own radius; cosmetics should preserve that intent. `packages/shared/src/mapgen.ts:376-396`

## Attack 3: A shared-mapgen “art tweak” can desync the world

### The attack

This project does not stream authoritative tiles or POIs. The server mints four seeds and runs `generateArena`; each client receives the seeds and independently runs the same function. The server then uses its local result for player collision, enemy collision, pit death, projectile cover, and safe spawns. `packages/shared/src/mapgen.ts:1-17`; `packages/server/src/rooms/GameRoom.ts:464-467`; `packages/server/src/rooms/GameRoom.ts:552-555`; `packages/server/src/rooms/GameRoom.ts:1775-1843`; `packages/server/src/rooms/GameRoom.ts:2090-2131`; `packages/server/src/rooms/GameRoom.ts:3767-3793`; `packages/server/src/rooms/GameRoom.ts:4126-4128`; `packages/server/src/rooms/GameRoom.ts:4345-4362`

That is efficient, but it makes generator logic a protocol. Changing RNG cadence, POI rejection order, size-class dealing, pit smoothing, constants, or seed mixing can make an old client draw a different obstacle than the new server collides against. The generator intentionally uses separate hazard and POI streams, and POI candidates draw their art roll before rejection to preserve cadence—evidence that tiny ordering changes are already understood to reshape results. `packages/shared/src/mapgen.ts:376-383`; `packages/shared/src/mapgen.ts:421-443`

The existing join guard does not automatically protect this. It compares `SCHEMA_VERSION`, whose documented trigger is a synced field layout change; the client's floor rebuild key contains only the four seeds and dimension id. **Inference:** a pure mapgen logic change can preserve the schema version and evade this mismatch warning unless the team deliberately versions it. `packages/shared/src/constants.ts:8-13`; `packages/client/src/scenes/ArenaScene.ts:2504-2522`; `packages/client/src/scenes/ArenaScene.ts:2350-2363`

The determinism test is necessary but insufficient for deployment skew: it calls `generateArena` twice from the same build. It proves same-code repeatability, not that a cached client and a newly deployed server share the same algorithm. `tests/mapgen.test.ts:38-46`

### Steelman

Shared generation is the right architecture for authoritative procedural geometry. It gives both sides the same `poiRadius`, collision helpers, pit classification, safe-spawn logic, and validation from one package. `packages/shared/src/mapgen.ts:338-348`; `packages/shared/src/mapgen.ts:457-520`; `packages/shared/src/mapgen.ts:530-661`

The art redo simply does not need to touch that machinery. The client already rebuilds visual floor objects from the reconstructed read-only map and swaps the predictor to the same map. `packages/client/src/scenes/ArenaScene.ts:2350-2407`

### Verdict

**Freeze `packages/shared/src/mapgen.ts`, its geometry constants, and its RNG behavior during the aesthetic redo.** Derive every patch, skirt, cluster satellite, and pit embellishment from the returned `ArenaMap` on the client. Prefer position-hashed cosmetic variation over consuming or reordering any generator stream.

If geometry must change later, treat it as a network migration, not an art commit:

1. Sync an explicit `mapgenVersion` or authoritative map fingerprint.
2. Include it in the client floor key and refuse play on mismatch.
3. Add golden fingerprints for representative seeds, not only same-build repeatability.
4. Deploy client and server atomically or retain the old generator by version for cached clients.
5. Bump the schema handshake if a synced version/hash field is added; synced layout changes already require that. `packages/shared/src/constants.ts:8-13`

## Pit-specific ruling

The pit vocabulary is the strongest existing piece and should remain the gameplay anchor. Every pit/ground edge already gets the exact hot vector band and lip; chevrons distinguish “go around” from the clean “hop me” treatment. The painted rim is an atmospheric underlay, not the collision truth. `packages/client/src/scenes/arena/floor-renderer.ts:294-368`

Do **not** wrap the high-3/4 painted rim around all four directions as if it were a neutral border. Its renderer currently assumes a horizontal source with ground on the top and drop on the bottom, and consequently draws only north-facing runs. `packages/client/src/scenes/arena/floor-renderer.ts:317-338`

Safe redo: retain that north cliff, add procedural side bevels, under-edge occlusion, cracks/frost/roots/embers/circuit breaks on the other orientations, and keep the exact vector lip above all painted treatment. Do not move, blur, scallop, or visually widen the lethal edge. Pit fill remains exact tile geometry on the server, and grounded players fall when their authoritative centre samples a pit tile. `packages/client/src/scenes/arena/floor-renderer.ts:284-315`; `packages/server/src/rooms/GameRoom.ts:1797-1843`

One caution: `classifyPitRegions` labels an entire connected region hoppable from its minimum bounding-box span, and the renderer applies that boolean to every segment in the region. It is explicitly cosmetic. The redo must not upgrade this coarse regional cue into a stronger promise at a specific crossing without a local straight-gap test. `packages/shared/src/mapgen.ts:594-640`; `packages/client/src/scenes/arena/floor-renderer.ts:294-307`; `packages/client/src/scenes/arena/floor-renderer.ts:346-362`

## Collider-visual contract

This is the art pass's hard specification:

1. **Authority:** for every POI, the blocker remains the circle centred at `(poi.x, poi.y)` with radius `poiRadius(poi.kind)`. `packages/shared/src/mapgen.ts:470-520`
2. **Visible base:** the contact kernel and strongest base mass must cover that circle convincingly; decorative canopy/height may overhang, but must read as overhead, porous, or nonblocking.
3. **No invisible failure:** a procedural footprint and outline render even when painted art is missing. The current painted draw can skip while server collision remains active, so this is a required correction, not optional polish. `packages/client/src/scenes/arena/floor-renderer.ts:210-237`; `packages/server/src/rooms/GameRoom.ts:1788-1794`
4. **Gameplay above grounding:** all ground integration stays at depth `≤ 0`; hazards, objectives, loot, and exact ground tells retain their higher layers. `packages/client/src/scenes/ArenaScene.ts:1341-1353`; `packages/client/src/scenes/ArenaScene.ts:1790-1792`; `packages/client/src/scenes/ArenaScene.ts:4080-4130`
5. **Unified occlusion:** any foreground component capable of covering a player shares the POI image's fade state; stains and contact shadows do not need to fade because they cannot cover gameplay at depth `≤ 0`.
6. **Projectile honesty:** the visible footprint must communicate that cover blocks friendly and hostile shots alike. `packages/server/src/rooms/GameRoom.ts:3767-3793`
7. **Push-out safety:** no visual or mechanical cluster may invalidate the solid-ground clearance used by the server's POI push-out-then-pit sequence. `packages/shared/src/mapgen.ts:393-407`; `packages/server/src/rooms/GameRoom.ts:1775-1828`
8. **Pit truth:** the uninterrupted vector lip is the exact hazard boundary; atmosphere may support it but never replace it. `packages/client/src/scenes/arena/floor-renderer.ts:294-368`

## Acceptance gates

- Capture every POI in every dimension on all four tile variants, with normal art, one missing texture, a pickup at its foot, an active zone crossing the base, and a player behind it.
- Run combat-density captures with full projectile clutter and at least one boss. Judge in motion and grayscale, not only in clean beauty shots.
- Overlay authoritative POI circles and pit cells in a debug review. Reject any base that appears materially wider/narrower than its circle or any pit treatment that moves the perceived lip.
- Run the existing 200-seed map guarantee suite unchanged; it currently exercises validation across 200 samples and POI placement across 80. `tests/mapgen.test.ts:34-36`; `tests/mapgen.test.ts:54-77`; `tests/mapgen.test.ts:135-167`
- Add visual assertions for fallback footprints, grounding depth, and decor exclusion around POI bases. These are absent from the current geometry-focused map tests. `tests/mapgen.test.ts:122-212`
- Fail review if `mapgen.ts`, geometry constants, or authoritative collision paths changed as part of this aesthetic batch.

## Final panel position

The map should stop looking like isolated stickers. Make each obstacle a small, theme-responsive site; connect sites with patches and motif trails; give pits orientation-aware material breakup; let composition become bolder than the current uniform scatter. But preserve four hard reads at all times: **where I can walk, where I will fall, what blocks my shot, and what I can pick up.**

The winning formulation is: **no limits on visual cohesion; strict limits on hidden geometry and occluded information.**
