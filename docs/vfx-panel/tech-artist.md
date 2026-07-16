# VFX panel — technical-artist implementability assessment

## Recommendation

Replace the three offending procedural renderers **in place** with pooled, painted-texture `Phaser.GameObjects.Rope` strips, using audited frames from the existing `*-wisp` particle sheets. Keep the current `Graphics` implementations as the Canvas/missing-texture fallback. This is the best quality-to-cost option: it puts real painted edge breakup into the moving silhouette, does not invent a new asset, and preserves all existing authored suite ids.

Do not add a generic Mesh layer. Phaser 4.1.0, which is the exact client dependency, exports `Rope` but no general `Mesh` Game Object (`packages/client/package.json:12-16`; `packages/client/node_modules/phaser/src/gameobjects/index.js:25-43`, `:69-125`). The Rope is a textured, deformable strip whose points, vertex colors, and alphas may change every frame (`packages/client/node_modules/phaser/src/gameobjects/rope/Rope.js:17-38`), which is the useful subset of Mesh behavior this effect actually needs.

## What is wrong now

The complaint maps directly to three renderer bodies:

- `blade-trail` builds a 26-segment flat-color crescent, then lays a white arc and several thin arc strokes over it (`packages/client/src/vfx/vfx-render.js:132-157`, `:223-253`).
- `twin-slash` is two five-pixel arc strokes, each capped by a 1.5-pixel white stroke (`packages/client/src/vfx/vfx-render.js:288-299`).
- `thrust-streak` is literally one fading six-pixel line (`packages/client/src/vfx/vfx-render.js:300-311`).

All of those commands enter the one additive `Graphics` object owned by a pooled surface (`packages/client/src/vfx/vfx-render.js:664-685`), and that object is cleared and rebuilt on every VFX tween update (`packages/client/src/vfx/VfxPlayer.ts:319-336`). The fallback resolver assigns those exact ids to dual, long-reach, and small weapons (`packages/client/src/vfx/VfxPlayer.ts:84-123`). This is not an asset-coverage problem; it is the last visibly vector-clean layer sitting over a painted world.

The audit's concrete WYSIWYG bar is also relevant: it treats a visible slash displaced from the authoritative sweep as a defect, not harmless decoration (`docs/GAMEFEEL_AUDIT.md:93-96`). Therefore the replacement should preserve the current `reach`, `sweep`, phase, and spawn transform rather than making a larger, prettier crescent that claims extra hit space. The canonical layer registry and renderer are deliberately shared by live game and Weaponsmith (`packages/client/src/vfx/vfx-layers.js:1-6`; `packages/client/src/vfx/vfx-render.js:1-11`).

## Phaser 4.1.0 capability ruling

### Rope: yes, with two constraints

`Rope` is WebGL-only and maps a texture across a point strip. It supports per-point color/alpha and animated points (`packages/client/node_modules/phaser/src/gameobjects/rope/Rope.js:17-30`). Its geometric half-width is fixed by the texture frame's half-height or half-width, not by an independent width at each point (`packages/client/node_modules/phaser/src/gameobjects/rope/Rope.js:953-986`). Consequently, taper must come from the selected painted frame's transparent silhouette plus per-point alpha; this is acceptable because the existing wisp cells already have brushy tapered ends.

There is no Canvas renderer for Rope (`packages/client/node_modules/phaser/src/gameobjects/rope/RopeCanvasRenderer.js:7-20`). Weaponsmith explicitly runs WebGL (`tools/weaponsmith/public/vfx-engine.js:196-220`), but the game requests `Phaser.AUTO` (`packages/client/src/main.ts:5-7`). The current Graphics bodies must remain callable when the renderer is Canvas or the painted texture is unavailable.

### General Mesh: no shipped API here

The installed 4.1.0 Game Object registry includes `Graphics`, `RenderTexture`, and `Rope`, but not `Mesh`; the WebGL-only extension list also has no Mesh (`packages/client/node_modules/phaser/src/gameobjects/index.js:25-43`, `:129-169`). A custom render node could implement arbitrary triangles, but that would be a renderer subsystem project for a problem the Rope already solves.

### Graphics texture fill: no

The installed `Graphics` API can apply four-corner color/alpha gradients. Phaser itself warns that gradients are reliable mainly on rectangles and triangles and are independently repeated across triangulated compound shapes (`packages/client/node_modules/phaser/src/gameobjects/graphics/Graphics.js:338-368`). There is no `beginTextureFill` or equivalent path-texture command in this Graphics implementation. `Graphics.generateTexture` is Canvas-backed and specifically does not preserve `fillGradientStyle` (`packages/client/node_modules/phaser/src/gameobjects/graphics/Graphics.js:1510-1532`). A textured wedge therefore needs Rope, stamped imagery, a mask/filter, or custom rendering—not a Graphics fill flag.

### Runtime-baked smear: yes

`RenderTexture` wraps a `DynamicTexture`, can draw texture frames and Game Objects, and is intended to collapse complex content into a reusable GPU-friendly texture without a new upload on every edit (`packages/client/node_modules/phaser/src/gameobjects/rendertexture/RenderTexture.js:14-43`). Its `stamp` call supports alpha, tint, angle, scale, and origin (`packages/client/node_modules/phaser/src/gameobjects/rendertexture/RenderTexture.js:390-409`). It is technically sound if prewarmed and cached. Its contents are lost on WebGL context restoration unless explicitly redrawn (`packages/client/node_modules/phaser/src/gameobjects/rendertexture/RenderTexture.js:45-60`).

## Existing art that is appropriate to reuse

The 96 particle sheets are equal-cell painted spritesheets and already have a typed manifest (`packages/client/src/vfx/particle-manifest.ts:1-9`, `:10-106`). The `*-wisp` cells are the correct semantic source for a swing smear; `steel-wisp` is the physical default (`packages/client/src/vfx/particle-manifest.ts:74-81`). Live play already queues every particle sheet as `ptcl:<id>` (`packages/client/src/vfx/particles.ts:9-13`).

The other painted inventories should not be forced into this job. The eight 256-pixel, six-frame strips are explicitly impact animations (`packages/client/src/scenes/arena/vfx.ts:15-18`, `:26-47`), and the twelve component packs have bespoke semantic roles such as cores, rings, shrapnel, wisps, and ground decals (`packages/client/src/vfx/fx-composer.ts:17-46`, `:48-66`). Recasting an impact bloom or quake core as a blade trail would trade the white-line problem for semantic noise.

Weaponsmith currently serves the canonical JS and Phaser build but not `packages/client/public/particles` (`tools/weaponsmith/server.mjs:422-445`). Any painted-particle technique therefore needs one small static `/particles/` route or a canonical lazy-loader endpoint before it is genuinely WYSIWYG.

## Ranked candidates

Ranking weights painted-world match first, then WYSIWYG reliability, frame cost, memory, and implementation scope.

### 1. Texture-filled tapered Rope along the sweep — winner

**Rendering.** Use one 8–12-point Rope for `blade-trail` and `thrust-streak`, and two contiguous Ropes for `twin-slash`. Mutate preallocated point objects and call `setDirty`; do not call `setPoints` with a new array every frame. Select one audited, predominantly horizontal wisp cell per element, leave its paint untinted where possible, and drive tail-to-head alpha per Rope point. The artwork supplies the irregular edge and geometric taper the flat strokes lack.

**Renderer cost.** A Rope uses Phaser 4's `BatchHandlerStrip`, while Graphics uses `BatchHandlerTriFlat` (`packages/client/node_modules/phaser/src/renderer/webgl/renderNodes/defaults/DefaultRopeNodes.js:7-11`; `packages/client/node_modules/phaser/src/renderer/webgl/renderNodes/defaults/DefaultGraphicsNodes.js:7-15`). Switching batch handlers flushes the current batch (`packages/client/node_modules/phaser/src/renderer/webgl/renderNodes/RenderNodeManager.js:380-403`). Expect one additional strip draw/batch transition per active surface versus drawing the shape into `gfxAdd`; the two twin strips can share one strip batch if adjacent and identically blended. Keep them ADD to join the existing bright-swing blend convention; avoid NORMAL underlay plus ADD highlight, which would add another transition.

**Memory.** No incremental texture memory in live play because the particle sheets are already preloaded. Two pooled Rope objects per VFX surface means at most 24 small point/vertex arrays under the existing 12-surface cap (`packages/client/src/vfx/VfxPlayer.ts:151-155`, `:231-258`), comfortably below 100 KiB of working data. A Weaponsmith that lazy-loads only the selected 96-pixel-cell sheet pays roughly 0.35–0.45 MiB decoded for that sheet; loading all eight combat palettes would be about 3–4 MiB.

**Implementation size.** Approximately 10–18 lines of schema/default changes in `vfx-layers.js`; 120–170 lines in `vfx-render.js` for asset selection, two pooled Ropes, reset/hide handling, point sampling, and retained Graphics fallbacks; 10–20 lines in `VfxPlayer.ts` to pass a numeric paint-set index; and about 10 lines in the Weaponsmith server for the particle route. `vfx-engine.js` needs no technique-specific fork if `attachSurface` and `renderLayers` own the Rope lifecycle, as they already own shared surface setup (`tools/weaponsmith/public/vfx-engine.js:12-26`, `:165-194`).

**Schema/preview.** Keep `reach`, `sweep`, `thick`, and `color`; add integer `paint` (steel/fire/frost/shock/holy/toxic/void/arcane). Physical and frost cannot be safely inferred from the existing hue because their fallback hues are nearly identical (`packages/client/src/vfx/VfxPlayer.ts:29-38`). Remove `lines` from the visible `blade-trail` schema after migration; an ignored slider would violate the preview contract.

**Risk.** Rope has constant geometric width and can over-stretch a poorly chosen square wisp cell. Audit and pin a frame index per paint set; do not randomize it between swings. The Canvas fallback is mandatory, not optional.

### 2. Runtime-baked crescent from existing wisp art

**Rendering.** At preload/first use, stamp 6–10 frames from one element's wisp sheet around a 256×256 arc into a shared DynamicTexture, then render one pooled Image per swing. Bake separate arc and thrust shapes; do not rebake per attack. A single static crescent can fade and rotate, but a convincing progressive reveal needs either 3–4 baked phase frames or a WebGL mask/filter.

**Renderer cost.** After prewarm, the effect is one textured quad submission. It changes from the current Graphics triangle handler to the Image quad handler (`packages/client/node_modules/phaser/src/renderer/webgl/renderNodes/defaults/DefaultImageNodes.js:7-14`), so nested per-surface ordering will usually produce one batch transition. The bake itself binds a framebuffer and draws every stamp; doing it on the first combat swing risks a visible hitch. Prewarm during scene creation.

**Memory.** One 256×256 RGBA cache is 256 KiB. Eight palettes × two shapes is about 4 MiB; three shapes is about 6 MiB. Four progressive phase frames raise that to roughly 16–24 MiB, which is the point where Rope becomes clearly preferable. A RenderTexture per one of the 12 pooled surfaces would waste another ~3 MiB per cached shape and should be rejected.

**Implementation size.** Roughly 6–12 schema lines, 140–220 renderer/cache lines, 10–20 preview routing/prewarm lines, plus context-restore redraw. It fits the shared renderer but is materially more machinery than Rope.

**Weaponsmith compatibility.** Good after the same `/particles/` route is added: the canonical renderer can build the exact same cache in both hosts. Preview startup must wait for the cache or show the retained Graphics fallback until ready.

**Risk.** The cheapest one-frame version reads as a rotated decal rather than a blade moving through space; the good multi-frame version spends much more texture memory. Context restoration also needs an explicit rebuild.

### 3. Sprite-stamped afterimages of the weapon itself

**Rendering.** Pool 2–4 Images per hand, reuse the source weapon texture/frame, and copy world transforms at spaced swing phases. This reuses the most weapon-specific painted pixels and adds no source texture. It is feasible: the rig already owns one or two weapon Images, but they are private (`packages/client/src/entities/SpriteRig.ts:162-170`), while the Weaponsmith attack preview already owns and poses `S.aWeapon` (`tools/weaponsmith/public/vfx-engine.js:20-26`, `:125-146`).

**Renderer cost.** Two to eight quad submissions for single/dual weapons. Contiguous ADD ghosts can batch into one quad draw on a common texture; NORMAL ghosts preserve the paint better but introduce ADD→NORMAL→ADD transitions around the existing VFX objects. The current surface already interleaves ADD and NORMAL emitters (`packages/client/src/vfx/vfx-render.js:669-685`), so placement in the container matters more than raw Image count.

**Memory.** Essentially zero texture memory; about 24–48 additional pooled Images plus transform snapshots at the 12-surface cap. Do not capture each ghost into its own RenderTexture.

**Implementation size.** About 8–12 schema lines and 90–140 canonical-renderer lines, but another 50–90 lines of live wiring: expose safe rig weapon sources, extend `spawnSlash`/`playSwing`, transform from rig world space into the VFX surface, and handle dual frames and facing. The current `spawnSlash` passes only weapon data and strike geometry, not the rig Image (`packages/client/src/scenes/ArenaScene.ts:5121-5140`). Preview needs 20–40 lines to expose its already-loaded weapon source consistently.

**Weaponsmith compatibility.** Superficially easy because the preview has `aWeapon`, but its generic preview swing is not the live rig's style-specific pose. A preview-authored afterimage cadence can therefore differ from live arc, thrust, pivot, chop, and orbit motion even while sharing the same renderer.

**Risk.** Duplicate blades can read as extra weapons, especially for dual gear, and the live/preview pose mismatch weakens the exact doctrine this panel is trying to protect. This is better reserved as an authored accent for spectral/energy weapons, not the mass fallback.

### 4. Pure Graphics gradient wedge

**Rendering.** Replace the white highlight and line fan with 6–10 filled triangles, using per-vertex color and alpha to create a broad head, transparent tail, colored core, and ragged deterministic edge. This is a polish pass on the current filled crescent, not a new material solution—the renderer already has the tapered segmented wedge (`packages/client/src/vfx/vfx-render.js:132-157`).

**Renderer cost.** Lowest of all candidates. It remains inside `S.gfxAdd`, creates no Game Object, no texture, and no blend-mode transition. It can use fewer segments than the current 26 while keeping similar triangle count.

**Memory.** No persistent GPU texture and negligible command-buffer growth.

**Implementation size.** About 4–8 schema lines and 35–60 renderer lines; Weaponsmith compatibility is automatic because it already calls the canonical renderer.

**Risk.** Highest product risk despite lowest engineering risk. Phaser gradients repeat per triangle on a compound path, so seams are likely, and the result remains mathematically smooth vector color against painted assets. It may make the “MS Paint” streak more sophisticated without making it belong in the world. Keep this only as the Canvas/missing-art fallback.

## Build order and exact layer ids

1. Audit the existing `steel`, `fire`, `frost`, `shock`, `holy`, `toxic`, `void`, and `arcane` wisp sheets and pin one long-axis cell per paint set. No image generation or new bitmap is required.
2. Add a numeric `paint` mapping beside `ELEMENT_HUE`, and pass it into the three fallback suite entries. Preserve `color` for the retained Graphics fallback. Do not derive paint from hue.
3. Serve `packages/client/public/particles` to Weaponsmith and make the shared renderer lazy-load the selected `ptcl:<element>-wisp` sheet when it is not already cached. Live play continues to benefit from its existing all-pack preload.
4. In `attachSurface`, create two hidden, additive Rope objects per pooled surface, adjacent in display order. Add one shared per-frame reset that hides both before dispatch, so a disabled/finished layer cannot leak a prior strip.
5. Implement one allocation-free ribbon sampler: arc points for blade/twin, straight-to-slightly-bowed points for thrust, per-point alpha for tail decay, and the audited frame's own alpha for edge taper. Preserve the old phase windows and spatial envelope.
6. Move the existing three Graphics bodies behind a Canvas/texture-missing branch. This also covers asynchronous preview loading and optional-asset failure.
7. Test the Weaponsmith attack preview and live Testing Grounds at anticipation end, contact, and recovery for physical/frost differentiation, dual crossing, long anchor reach, DPR 1/2, Canvas fallback, and 12 concurrent pooled surfaces. Capture the render graph to confirm no more than one new strip batch per active surface and verify there are no per-frame arrays or Game Objects.
8. Remove `lines` from the visible `blade-trail` schema after saved-suite migration; keep unknown stored fields harmless. Do not change draw order or the fallback selection hierarchy.

**Layer-id decision: add no ids; replace the renderer implementations behind `blade-trail`, `twin-slash`, and `thrust-streak`, while retaining those exact ids for authored-suite and generated-data compatibility.**
