# Client frame-time and jank audit (reviewer 4/5)

## Scope and confidence

This review is against committed `HEAD` `271140d`. `ArenaScene.ts`, `AudioBus.ts`, `SpriteRig.ts`, and VFX code were read with `git show HEAD:<path>` so the other agent's uncommitted work is not judged. No source was changed. The target is the stated worst case: four players, about 50 enemies, concurrent beams/motes, and the 12-slot worm.

All timings below are estimates, not measurements. Steady estimates assume a mid-range desktop at 60 Hz and roughly 1600×900 CSS pixels; DPR, GPU, browser, effect mix, and visible Text width can move them substantially. CPU and GPU ranges are not additive when they overlap. The ranking weights recurring combat cost ahead of a larger but one-time loading-screen stall.

The main risk is a split bottleneck:

- At DPR 2 or a 4K CSS viewport, back-buffer fill and upload bandwidth can dominate.
- At DPR 1/1080p, procedural rigs, immediate-mode Graphics, canvas Text re-rasterization, and full display-list sorting are more likely to dominate.
- Belt mode has a materially worse UI baseline than arena mode, even with the bag closed.

## Per-frame path and allocation ranking

`ArenaScene.update()` first scans pickup proximity, processes input, and reconciles blobs, enemies, pickups, projectiles, zones, and portals. On non-hit-stop frames it then interpolates players/enemies/worm/projectiles, animates both rig sets, projects belt objects, and draws projectile tells. Beams, XP motes, camera follow, parry/portal/dust, combat feedback, HUD, boss state, level window, dock, and the DOM debug line run even during hit-stop (`packages/client/src/scenes/ArenaScene.ts:2982-3187`). Thus hit-stop suppresses much of pose work but does not suppress the HUD/VFX tail.

Ranked by steady allocation frequency × approximate payload, rather than raw execution time:

| Rank | Path | Steady allocation at the stated load |
|---:|---|---|
| 1 | Belt bag/trading UI | Per open frame: bag index `map` + `sort`, panel/corner/edge arrays, an IIFE call per one of 12 cells, many formatted strings, and roughly 15–30 unconditional Text restyles depending on occupancy/shop mode (`ArenaScene.ts:8892-8898`, `ArenaScene.ts:8940-9279`). |
| 2 | Horde melee tell selection | Up to one candidate object per melee enemy, sorting, repeated `"melee:" + id` strings, and nested incumbent scans every frame; at 50 melee enemies this is thousands of short-lived objects/strings per second (`ArenaScene.ts:3614-3666`, `ArenaScene.ts:3826-3889`). |
| 3 | Arena carousel | With the current 21 active weapons, creates two arrays, 21 `{id, offset}` objects, several filter/map/sort arrays, spread arguments, and multiple signature arrays/strings every frame before the signatures can short-circuit mutations (`ArenaScene.ts:8479-8575`; active roster definition at `packages/shared/src/weapons.ts:1300-1310`). |
| 4 | Common HUD | Rebuilds HP/stats/weapon/objective/stakes strings every frame, plus an augment `Map`, split/filter array, spread, mapped strings, and joined output whenever augments exist (`ArenaScene.ts:7740-7897`). |
| 5 | Beams | Per beam/frame key strings in both the entry lookup and painted texture lookup, plus a fresh options object for each active sustain/redline audio call (`packages/client/src/vfx/BeamRenderer.ts:153-165`, `BeamRenderer.ts:357-413`, `ArenaScene.ts:9706-9765`). |
| 6 | Belt projection | Two closure objects per belt frame, followed by all live rigs and tracked projectile/pickup/zone containers (`ArenaScene.ts:6105-6145`). |
| 7 | Prediction/input | One `renderPos` result object per frame, a second while local beam prediction is visible, and a minted command plus spread copy every 50 ms (`packages/client/src/net/prediction.ts:213-216`, `prediction.ts:366-381`, `ArenaScene.ts:9673-9690`, `ArenaScene.ts:9791-9813`). |
| 8 | Projectile reconciliation | A new `Set<string>` on every frame even when no projectile was born (`ArenaScene.ts:4496-4502`). |
| 9 | Camera/debug miscellany | The arena camera creates an `axis` closure per frame; the debug line builds several strings and writes DOM text every frame (`ArenaScene.ts:6294-6306`, `ArenaScene.ts:9441-9456`). |

The raw allocation ranking is not the same as the time ranking: canvas Text restyles and Graphics rebuilds can cost much more than their small JS object counts, while the 54-rig pose path is expensive despite largely respecting the no-allocation rule.

## Ranked findings

### 1. Critical — renderer resolution has no total-pixel budget

`RENDER_DPR` is capped at 2, but not by total drawing-buffer pixels (`packages/client/src/render-dpr.ts:1-12`). The game allocates `innerWidth × DPR` by `innerHeight × DPR` and then camera-zooms by the same factor (`packages/client/src/main.ts:12-20`, `ArenaScene.ts:1770-1778`). DPR 2 is 4× the fragments and bandwidth of DPR 1; a 4K CSS window becomes a 7680×4320, 33.2-megapixel back buffer before overdraw from telegraphs, bloom/additive VFX, UI, and full-screen effects.

**Estimate:** +4–20 ms GPU/frame versus DPR 1 on a mid-range GPU; 15–40+ ms total GPU time is plausible at 4K CSS. **Fix:** cap by total pixels (for example 6–10 MP), expose render scale, and use a slow GPU-time controller to step scale down/up outside combat transients. Keep CSS/world dimensions unchanged. **Effort:** medium. **Risk:** medium—visual sharpness changes, but gameplay and layout do not.

### 2. Critical in belt mode — canvas Text is forcibly re-rasterized every frame

Phaser 4.1.0 is pinned (`packages/client/package.json:15`). Its `Text.setText` has an equality guard (`node_modules/.pnpm/phaser@4.1.0/node_modules/phaser/src/gameobjects/text/Text.js:639-655`), but `TextStyle.setColor` unconditionally calls `update` (`node_modules/.pnpm/phaser@4.1.0/node_modules/phaser/src/gameobjects/text/TextStyle.js:756-760`). Belt's closed arsenal calls `setColor` for the key, name, and hidden action tag in each of three slots, plus info and shop text—about 10–11 canvas re-rasterizations and texture uploads per frame (`ArenaScene.ts:8671-8779`, `ArenaScene.ts:8853-8858`). Those pooled texts are explicitly at resolution 2 or higher (`ArenaScene.ts:8650-8655`). Opening the bag/shop adds per-item name/tier/value and upgrade-band restyles (`ArenaScene.ts:9090-9128`, `ArenaScene.ts:9222-9279`) while clearing/rebuilding the panel Graphics (`ArenaScene.ts:8940-8944`).

**Estimate:** belt closed 1.5–5 ms CPU/upload per frame; populated bag/shop 4–12 ms, with a 5–25 ms first-open spike when uncached card canvases are baked (`packages/client/src/scenes/arena/card-art.ts:84-160`). **Fix:** keep a signature per Text and mutate text/style only on change; do not style hidden tags; update positions separately. Redraw arsenal/panel Graphics only on state/layout/hover changes. Pre-bake visible bag cards before opening or over idle frames. Bitmap/SDF text is a second step, not required for the first win. **Effort:** medium. **Risk:** low.

### 3. High — 54 procedural rigs execute a large pose program at render rate

Four player rigs plus 50 enemy rigs call the full `SpriteRig.animate` program on every unfrozen frame (`ArenaScene.ts:3160-3166`, `ArenaScene.ts:3668-3738`). The rig correctly keeps JIGGLE state in scalar fields and computes a clamped spring delta without obvious per-frame container allocation (`packages/client/src/entities/SpriteRig.ts:4008-4035`), but the offscreen test only skips/rebases procedural jiggle; subsequent hand/foot/weapon transforms and trigonometry still execute (`SpriteRig.ts:5037-5295`). This is a compute hotspot, not primarily a GC hotspot.

**Estimate:** 1.5–5 ms CPU/frame at 54 detailed rigs, depending on part counts and attack mix. **Fix:** introduce pose LOD: full rate for self/near/attacking rigs; 30 Hz cached pose for mid-distance rigs; skip the entire pose program for safely offscreen rigs while interpolation/root position continues. Keep telegraph timing outside the skipped pose. **Effort:** high. **Risk:** medium—animation discontinuities and gameplay-readable attacks need regression tests.

### 4. High — horde telegraphs allocate for all melee enemies and rebuild shared Graphics

Both telegraph Graphics objects are cleared each unfrozen frame (`ArenaScene.ts:3605-3608`). The scene samples every melee enemy, allocates a candidate object, looks up constructed `melee:<id>` keys multiple times, sorts candidates, and performs nested stability scans (`ArenaScene.ts:3614-3666`, `ArenaScene.ts:3712-3734`, `ArenaScene.ts:3826-3889`). Full footprints are sensibly capped to nearest six plus threats (`ArenaScene.ts:3845-3870`), and geometry arrays are rebuilt only when row geometry/zoom changes (`ArenaScene.ts:4127-4179`), but the cached geometry is still issued again to Graphics every frame; non-melee rows also update the retained foreshadow pool (`ArenaScene.ts:4114-4212`).

**Estimate:** 0.7–2.5 ms CPU/frame plus 0.2–1.2 ms GPU at 50 mostly-melee enemies; roughly 50 candidate objects and 100–150 short key strings per frame. **Fix:** keep a candidate struct/map per enemy and mutate it; store the telegraph row/key on the windup sample; replace the nested incumbent search with indexed ranks. Split static footprint geometry into retained Mesh/Shape objects and animate only fill/alpha, leaving the exact protected edge dynamic. **Effort:** medium-high. **Risk:** medium because danger geometry must remain exact.

### 5. High during beam use — exact capsules are an immediate-mode multiplier

The beam renderer has a good fixed pool: two Graphics, five body/lip rope pairs, and 18 reused capsule vectors (`packages/client/src/vfx/BeamRenderer.ts:97-127`). Nevertheless it clears both Graphics every frame (`BeamRenderer.ts:140-151`). Each sustained beam draws four capsule layers across up to five temporal samples, each with 18 vertices, then updates two painted ropes (`BeamRenderer.ts:303-345`, `BeamRenderer.ts:357-445`). Four simultaneous beams can therefore submit about 80 capsule fills/1,440 vertices per frame before endpoints and ropes. The damaging capsule intentionally is never culled.

**Estimate:** 0.6–2.5 ms CPU+GPU/frame for four active beams, more at DPR 2/additive overdraw. **Fix:** preserve one exact authoritative capsule layer, but render glow/core as retained quads/ropes with uniforms; quantize temporal sweep samples by angular displacement and quality tier. Cache body/lip texture keys on the entry instead of rebuilding strings. **Effort:** medium. **Risk:** medium—collision readability must match the retained exact layer.

### 6. High — the common HUD pays allocation every frame and forces at least two restyles

Even outside belt mode, `updateHud` constructs long level/weapon/objective strings, a filter/join loot prefix, and an augment `Map`/arrays every frame (`ArenaScene.ts:7765-7830`, `ArenaScene.ts:7835-7897`). `weaponText.setColor` and `modeText.setColor` run unconditionally, so both re-raster every frame despite `setText`'s equality guard (`ArenaScene.ts:7793-7815`, `ArenaScene.ts:7875-7897`). HP can legitimately update on patch/lerp boundaries; level stats, class copy, augment summary, and most objective text do not need 60 Hz. Downed copy also restyles every frame (`ArenaScene.ts:7900-7928`).

**Estimate:** arena baseline 0.4–2 ms CPU/upload per frame plus 3–15 KB/frame of ephemeral strings/collections; greater for wide localized text. **Fix:** separate layout (per resize), continuous bars (per frame), server-state labels (20 Hz/on patch), and static labels (on change). Cache augment/objective/weapon signatures and guard style changes explicitly. **Effort:** small-medium. **Risk:** low.

### 7. High — depth values are harmless, but queued full-list sorting is not

Depths near 100,000 do not make comparison more expensive; Phaser subtracts numeric depths (`node_modules/.pnpm/phaser@4.1.0/node_modules/phaser/src/gameobjects/DisplayList.js:206-208`). The cost comes from any `setDepth`: the setter queues a stable sort regardless of equality, and the scene later sorts the entire top-level display list (`node_modules/.pnpm/phaser@4.1.0/node_modules/phaser/src/gameobjects/components/Depth.js:52-59`, `DisplayList.js:174-191`). Ordinary rigs already round and guard changes (`packages/client/src/entities/SpriteRig.ts:1265-1270`), but moving rigs still change rows often; worm AO and up to 12 segment Images call raw `setDepth` every update (`packages/client/src/entities/WormRig.ts:897-918`, `WormRig.ts:921-1001`). One call is enough to sort all top-level objects; children inside Containers are not separate top-level sort entries.

**Estimate:** 0.2–1.2 ms CPU/frame with hundreds of loose VFX/UI objects; transient effect storms increase list length. **Fix:** add last-depth guards to worm Images/AO and any moving loose objects; quantize world-y depth; group fixed bands in Layers/Containers so the sortable list contains actor roots, not transient leaves. **Effort:** medium. **Risk:** medium—incorrect bucketing can create visible overlap errors.

### 8. High spike/GC risk — authored FX and painted particles are not actually pooled

`playFxPack` permits ten packs in one frame (`packages/client/src/vfx/fx-composer.ts:183-204`). A pack creates a new Image for each component plus Tween configs, tween-chain arrays, a local closure, and one completion closure per Image (`fx-composer.ts:218-274`, `fx-composer.ts:278-378`). `particleBurst` similarly creates one Image, Tween object, and closure per particle (`packages/client/src/vfx/particles.ts:38-74`). These paths violate the zero-steady-state-allocation discipline during exactly the horde/AoE frames most likely to be over budget.

**Estimate:** 2–12 ms CPU spike for a ten-pack contact frame, followed by a possible 2–8 ms young-generation GC; GPU overdraw can add 1–5 ms. **Fix:** fixed pools per texture/blend/depth band, reusable tween-state tables updated by one system, and a global per-frame object/vertex budget rather than only a pack-call budget. Degrade by component count before creating objects. **Effort:** high. **Risk:** medium—visual tails and pressure-steal semantics must be preserved.

### 9. High spike — expansion art can decode/upload in the middle of combat

Expansion weapon parts are intentionally absent from boot preload. First visibility queues every sliced part and starts Phaser's loader immediately; callers retry from per-frame pickup/equip synchronization (`ArenaScene.ts:2307-2340`, `ArenaScene.ts:2043`, `ArenaScene.ts:2356`). Network may be cached, but image decode, texture creation, mip generation, and GPU upload can still land on a combat frame. First bag display can also create/upload a `cardbg-*` canvas for each newly seen weapon (`packages/client/src/scenes/arena/card-art.ts:93-160`).

**Estimate:** 3–20 ms spike per HD part set; 10–40 ms for a multi-part weapon or several new loot items. **Fix:** announce upcoming loot/wave assets and preload in the preceding room/fade; pack expansion parts into on-demand atlases; throttle upload to one texture per safe frame and expose a placeholder until the whole rig is ready. **Effort:** medium-high. **Risk:** low-medium—requires server/content lookahead or staged reveal.

### 10. Medium-high — many smaller Graphics rebuilds accumulate

Beyond telegraphs/beams, every frame clears and redraws grab/parry state and nearby projectile tells (`ArenaScene.ts:6603-6675`), 48 ambient dust circles (`ArenaScene.ts:4738-4769`), the beam HUD (`ArenaScene.ts:7575-7645`), boss phase/notch marks while a boss is present (`ArenaScene.ts:4827-4846`), XP trails (`packages/client/src/vfx/xp-motes.ts:150-181`), and worm AO/ground/particles (`packages/client/src/entities/WormRig.ts:897-918`, `packages/client/src/vfx/worm-boss-vfx.ts:179-190`, `worm-boss-vfx.ts:325-370`). Each is bounded and small, but they cause repeated command-buffer rebuilds and draw submissions.

**Estimate:** 0.3–1.5 ms CPU and 0.2–1.5 ms GPU/frame combined in the stated boss case. **Fix:** update static boss ticks and ready-state rings only on change; retain dust as Images/particles; separate dynamic XP/worm trails from invariant geometry; skip `clear` when the layer is hidden/empty. **Effort:** medium. **Risk:** low.

### 11. Medium-high launch/VRAM risk — the core atlas is good, but combat VFX preload is too broad

The main rig atlas is the right design: a single multiatlas is loaded for non-expansion parts (`ArenaScene.ts:1271-1276`); the current PNG is 4096×1821 (about 28.4 MiB RGBA after decode). In the same preload, however, all roughly 48 particle sheets and all impact flipbooks are queued, and `VfxPlayer` queues all 12 component packs, every PER sheet, and every authored hero/scatter asset (`packages/client/src/vfx/particles.ts:9-13`, `packages/client/src/vfx/VfxPlayer.ts:288-311`, `ArenaScene.ts:1320-1321`). The repository's loose `public/vfx` and `public/particles` payloads are about 18.8 MB and 10.3 MB compressed. Once loaded, separate textures also increase bind pressure during mixed effects.

**Estimate:** 20–100 ms aggregate decode/upload stalls during arena preload on lower-end devices, plus tens to hundreds of MiB VRAM; mixed-effect binds can cost 0.2–1.5 ms GPU/driver time in burst frames. **Fix:** atlas VFX by blend mode/filtering, load only the selected dimension/weapon/element set, and stage optional packs during the menu fade or idle batches. Keep the main sprite atlas. **Effort:** medium-high. **Risk:** medium—atlas bleed, mip behavior, and optional-asset fallback need validation.

### 12. Medium burst — chain lightning regenerates jagged geometry and garbage every tween frame

One chain event allocates a closure, candidate array, `Set`, one position/candidate object per enemy, link/node arrays, a Graphics, and tween closures (`ArenaScene.ts:9293-9373`). During its approximately 180 ms life, every update calls `boltPoints` per link; that helper creates a new array and a new point object about every 22 pixels (`packages/client/src/scenes/arena/draw-util.ts:16-36`).

**Estimate:** 0.3–1.5 ms CPU on each active chain frame and tens to hundreds of objects/frame, with overlapping chains capable of triggering a 1–5 ms GC hitch. **Fix:** reuse candidate/node buffers, store positions in typed arrays, and generate into a fixed point bank; update jag only at 30 Hz or on alternating links. Pool the Graphics/tween state. **Effort:** medium. **Risk:** low.

### 13. Medium burst — damage Text is object-pooled but still style- and tween-allocation-heavy

Damage number GameObjects and same-frame aggregation are pooled correctly (`packages/client/src/scenes/arena/vfx.ts:1125-1149`, `vfx.ts:1187-1235`). On every spawn/aggregate, however, styling calls `setText`, `setFontSize`, unconditional `setColor`, font style, and stroke, potentially causing multiple canvas updates; each spawn also creates nested Tween configs/closures (`vfx.ts:1152-1184`, `vfx.ts:1235-1264`). Arena caps labels at 24 and full hit stacks at ten, which bounds but does not remove the burst (`ArenaScene.ts:190-193`, `ArenaScene.ts:7125-7189`). Other transient Text (combo, banner, level-up) is also created per event rather than pooled.

**Estimate:** 1–6 ms CPU/upload on a 10–24-label AoE patch, plus later GC. **Fix:** bucket damage styles into preconfigured pools, perform one style update after setting all changed fields, and drive motion/fade from a fixed table. Prefer a glyph atlas/BitmapText for numbers. **Effort:** medium. **Risk:** low-medium.

### 14. Medium transition spike — paper-fold capture churns a large RenderTexture

Depth transitions allocate/filter/sort a world object list, create a bounded RenderTexture and texture key, render the curated world into it, and capture it twice (`ArenaScene.ts:2490-2518`, `ArenaScene.ts:2522-2598`, `ArenaScene.ts:2655-2659`). The cap is 1600×900 (`ArenaScene.ts:197-198`), or about 5.5 MiB RGBA before backend overhead, and the texture is removed/destroyed after each transition (`ArenaScene.ts:2695-2710`). This is deliberate transition work, but it can hitch the animation edge.

**Estimate:** 5–20 ms for each capture on mid-range hardware; 15–50 ms on integrated/mobile GPUs. **Fix:** retain one reusable RenderTexture, reuse the world-list scratch array, and perform the first capture one frame before the fold starts. Lower capture scale under GPU pressure. **Effort:** medium. **Risk:** low-medium.

### 15. Medium first-use spike — audio decode is off both main and audio-render threads, but realization is still bursty

The sample manifest is fetched/parsed once and only three latency-critical IDs are warmed after the first AudioContext exists (`packages/client/src/audio/AudioBus.ts:76-98`, `AudioBus.ts:139-150`, `packages/client/src/audio/sample-bank.ts:191-235`, `sample-bank.ts:266-280`). Other cues trigger `fetch`/`arrayBuffer`/parallel `decodeAudioData` on first intent (`sample-bank.ts:288-298`, `sample-bank.ts:498-526`). Per the [Web Audio specification](https://webaudio.github.io/web-audio-api/#dom-baseaudiocontext-decodeaudiodata), decoding runs on a dedicated decoding thread—not the control/main thread and not the audio rendering thread—but fetch completion, Promise tasks, `AudioBuffer` publication/memory pressure, and source-node creation still meet the main/control thread. First gesture also fills a one-second noise buffer with `Math.random` synchronously (`AudioBus.ts:100-150`). The code falls back to synth while a sample decodes, so the main player-facing risk is a completion/memory hitch, not silence.

**Estimate:** first gesture 1–5 ms; a batch of first-use sample completions 1–8 ms control-thread/GC disturbance (decode itself off-thread). **Fix:** after gesture, warm the complete active combat cue set in small idle batches with limited decode concurrency; generate/fill the noise buffer during menu idle or use a short repeated buffer. **Effort:** small-medium. **Risk:** low.

### 16. Medium run-launch spike — `manifest.ts` is deferred, not eliminated

The menu dynamically imports Arena only when launching a run (`packages/client/src/scenes/MenuScene.ts:29-36`) and overlaps it with a 280 ms fade (`MenuScene.ts:466-488`), which protects first paint. Arena then eagerly imports the generated sprite manifest (`ArenaScene.ts:112`). The committed manifest is about 244 KB/13.9k lines, alongside an approximately 413 KB/9.8k-line Arena module and approximately 249 KB/5.5k-line SpriteRig source before bundling. Parsing/compiling/evaluating that graph can still delay arena readiness at the end of the fade.

**Estimate:** 3–15 ms desktop and 10–40 ms low-end run-launch main-thread work attributable to the large generated/static graph; this is not a combat-frame cost. **Fix:** emit compact data (JSON/binary arrays), split expansion metadata from active manifests, and preload the arena chunk when the user hovers/selects a destination rather than only after launch. **Effort:** medium. **Risk:** low.

### 17. Low-medium steady GC — the arena carousel's signature guard is too late

The dock mutates objects only when signatures change, which is good, but it constructs the candidate arrays, 21 offset objects, filtered/sorted arrays, joined layout signature, active signature, and held signature every frame before comparing them (`ArenaScene.ts:8457-8579`). Focus adds another live-signature array/join (`ArenaScene.ts:8583-8603`). Layout Graphics and Text changes themselves are event-driven (`ArenaScene.ts:8195-8249`, `ArenaScene.ts:8252-8290`).

**Estimate:** 0.05–0.35 ms CPU/frame and roughly 2–8 KB/frame allocation; periodic young GC can make this visible as 1–4 ms hitches. **Fix:** recompute neighbor IDs only when selection/roster/layout changes; compare primitive state fields instead of joined signatures; keep fixed scratch arrays for the four visible neighbors. **Effort:** small. **Risk:** low.

### 18. Low individually, material in aggregate — recent steady paths violate zero-allocation discipline

The concrete violations are: per-frame grab-target objects (`ArenaScene.ts:3011-3023`), projectile `Set` (`ArenaScene.ts:4496-4502`), camera closure (`ArenaScene.ts:6294-6306`), belt projection closures (`ArenaScene.ts:6105-6145`), predictor result objects and input spread copies (`packages/client/src/net/prediction.ts:366-381`, `ArenaScene.ts:9791-9813`), beam key/options objects (`packages/client/src/vfx/BeamRenderer.ts:153-165`, `ArenaScene.ts:9757-9765`), HUD collections, carousel arrays, and telegraph candidates. None is catastrophic alone; together they keep the nursery busy in a scene already creating event VFX.

**Estimate:** 0.1–0.6 ms CPU/frame plus 1–5 ms periodic young GC under combat. **Fix:** retained scratch records/sets, out-parameters for predictor position, direct command construction, module/static helper functions instead of per-frame closures, and primitive dirty bits rather than string signatures. Add a debug assertion/counter for allocations in audited systems. **Effort:** medium. **Risk:** low.

### 19. Low-medium — a shipped DOM debug update creates cross-renderer work every frame

The page always contains `#debug` (`packages/client/index.html:48`); Arena retains it (`ArenaScene.ts:1232`) and every update builds net/paper strings, reduces deaths, and assigns `textContent` (`ArenaScene.ts:9441-9456`). There are no explicit `import.meta.hot` hooks in committed client source, so Vite HMR itself is not a production-loop issue. The actual HMR/dev-era leftovers are this always-live overlay and the shipped global game handle (`packages/client/src/main.ts:47-53`).

**Estimate:** 0.05–0.4 ms CPU/frame plus strings/style invalidation, with DevTools open making it worse. **Fix:** compile-gate the overlay, or sample into a retained string at 2 Hz and only write when visible/changed; keep the global handle only in development. **Effort:** small. **Risk:** negligible.

### 20. Low normally — camera effects are bounded; the DPR-1 bloom filter is the effect to measure

The vignette Graphics is drawn only on build/resize and only alpha changes each frame (`ArenaScene.ts:1791-1793`, `ArenaScene.ts:7742-7750`). Hit-stop uses a rolling non-priority budget (`ArenaScene.ts:6856-6885`), and camera shake drops weaker overlaps (`ArenaScene.ts:6888-6900`); flash/fade/shake themselves do not create per-frame scene objects. The uncertain GPU cost is the one bloom filter over the VFX root, enabled at DPR 1 (`packages/client/src/vfx/VfxPlayer.ts:247-273`): its offscreen target size follows active-effect bounds and can become costly when effects are far apart.

**Estimate:** shake/fade generally below 0.1 ms CPU; bloom about 0.3–3 ms GPU while broad effect bounds are active. **Fix:** retain the shake/hit-stop policies; measure bloom target dimensions/GPU time, then use bounded regional bloom or emissive sprites if it exceeds budget. **Effort:** small to measure, medium to replace. **Risk:** low-medium visual change.

## Allocation-discipline compliance

The following recent systems comply well and should be preserved:

- **SpriteRig/JIGGLE:** retained scalar spring state, clamped delta, and rounded last-depth guard (`packages/client/src/entities/SpriteRig.ts:1258-1270`, `SpriteRig.ts:4008-4035`). The issue is computation/LOD, not obvious steady allocation in the core pose path.
- **Remote interpolation:** player and enemy snapshot sampling writes into retained `playerSample`/`enemySample` records (`ArenaScene.ts:900-901`, `ArenaScene.ts:3480-3494`, `ArenaScene.ts:5824-5848`). This makes its O(players + enemies) arithmetic cheap and allocation-free; only the local predictor result remains an avoidable object allocation.
- **XP motes:** fixed Images plus typed-array slot state and retained output records; update clears one trail Graphics but does not create per-mote objects (`packages/client/src/vfx/xp-motes.ts:57-98`, `xp-motes.ts:150-181`).
- **Worm:** snapshot rings, samples, topology, trails, and particle tables are typed/fixed (`packages/client/src/entities/WormRig.ts:83-136`, `WormRig.ts:412-456`, `packages/client/src/vfx/worm-boss-vfx.ts:24-65`). Its remaining costs are Graphics rebuilds and unguarded depth writes.
- **Telegraph foreshadows:** entries are retained, Images are capped at 12, and pruning avoids a per-frame live-ID Set (`packages/client/src/scenes/arena/vfx.ts:133-151`, `vfx.ts:168-207`). Geometry caching also avoids rebuilding point arrays on stable rows (`ArenaScene.ts:4127-4179`). Milestone `particleBurst` emissions still fall into finding 8.
- **PER/beam ribbons:** VFX surfaces and beam ropes are capped/retained; active swing Graphics still clear on every tween update (`packages/client/src/vfx/VfxPlayer.ts:242-269`, `VfxPlayer.ts:337-370`, `VfxPlayer.ts:468-504`). The canonical PER renderer retains point banks/UV state and updates coordinates in place (`packages/client/src/vfx/vfx-render.js:183-241`, `vfx-render.js:339-382`).

Texture switching inside the core rigs is state-edge driven rather than steady churn: tome open/close swaps happen on pose state changes (`packages/client/src/entities/SpriteRig.ts:1803`, `SpriteRig.ts:1858`), and worm card texture changes are guarded (`packages/client/src/entities/WormRig.ts:567`). The real texture churn is lazy resource creation, bag card canvases, and paper transition textures.

## `setText` inventory on the update-driven path

- **Every update or every visible update:** boss/victory labels (`ArenaScene.ts:4821-4878`), level-window tenth-second timer (`ArenaScene.ts:5045-5065`), offscreen portal/rift distance (`ArenaScene.ts:6786-6790`), HP/level/weapon/augment/mode/downed HUD (`ArenaScene.ts:7740-7928`), salvage label while held (`ArenaScene.ts:8029-8038`), belt arsenal/shop (`ArenaScene.ts:8700-8758`, `ArenaScene.ts:8853-8858`), and bag/trading panel (`ArenaScene.ts:8979-9279`). Same-value `setText` does not rasterize, but callers still build strings; paired `setColor` does rasterize.
- **Dirty/event driven:** carousel tab/junction/card labels (`ArenaScene.ts:8202-8211`, `ArenaScene.ts:8252-8290`, `ArenaScene.ts:8435-8452`) are reached behind layout/active/live signatures. Damage numbers are per hit/aggregate (`packages/client/src/scenes/arena/vfx.ts:1178-1264`). The level-window status at `ArenaScene.ts:5296` is a send event. These are burst costs, not baseline costs.

The timer at `ArenaScene.ts:5063-5065` changes only once per displayed tenth but is recomputed 60 times per second; update it on the authoritative decisecond edge. Boss/victory same-value calls are cheap because of Phaser's equality check, although boss segment Graphics still redraw.

## Belt versus arena

| Concern | Arena | Belt |
|---|---|---|
| Actor/render core | Same interpolation, rigs, telegraphs, beams, motes, combat FX, HUD, depth-sort exposure. | Same core plus a projection pass over all live rigs and tracked world containers, with two closures allocated per frame (`ArenaScene.ts:6105-6145`). |
| Dock/UI | Carousel computes 21-weapon neighbor/signature garbage every frame, but expensive object mutation is dirty-gated (`ArenaScene.ts:8457-8603`). | Carousel is hidden and replaced by the immediate-mode three-slot arsenal every frame; about 10–11 forced Text restyles even when the bag is closed (`ArenaScene.ts:8460-8467`, `ArenaScene.ts:8671-8807`). |
| Overlay | No bag/shop renderer. | Open bag/shop clears/rebuilds a large Graphics panel, sorts inventory, and restyles many pooled Texts every frame (`ArenaScene.ts:8940-9279`). This is the largest mode-specific CPU/GC gap. |
| Camera/background | Arena center camera allocates one helper closure per frame (`ArenaScene.ts:6294-6306`). Procgen floor build is dirty/one-shot. | Belt camera avoids that closure but has projected-y work and a gate Graphics redraw. Preload correctly loads only the selected belt backdrop/deck set (`ArenaScene.ts:1278-1300`). |
| Geometry | Normal world-y telegraphs and beam capsules. | Telegraph/beam/worm y values are foreshortened but command counts are essentially unchanged; lower apparent area does not remove CPU tessellation. |

At identical enemy/effect counts, belt should be expected to run several milliseconds slower on the main thread because of arsenal/panel Text and projection. Arena's main unique steady tax is carousel allocation; it is much smaller than belt's forced rasterization.

## First three probes to add

1. **Allocation-free phase timer at `ArenaScene.update` (`ArenaScene.ts:2982-3187`).** Use scalar `performance.now()` deltas written into fixed `Float32Array` rings for: input/sync (through `syncPortal`), interpolate/move, player rigs, enemy rigs+telegraphs, belt projection, beams+motes, combat FX, HUD/run state, dock, and debug. Emit percentiles once every 120 frames outside the measured frame. Include entity/effect counts and hit-stop state. This confirms whether rigs, telegraphs, or UI lead without PerformanceEntry allocation on every frame.

2. **Dev-only Phaser mutation probe installed before game creation in `main.ts` (`packages/client/src/main.ts:5`).** Wrap `Text.updateText` to count/time rasterizations and record canvas pixel area by owner tag; wrap `Graphics.clear` and count generated commands/points by layer; wrap `DisplayList.depthSort` to record list length and sort duration. Reset counters in a fixed struct each frame and publish at 2 Hz. This directly tests findings 2, 4–7, and 10.

3. **GPU/resource-realization probe around the renderer and loaders.** Use `EXT_disjoint_timer_query_webgl2` between Phaser pre/post-render events to record GPU frame time and back-buffer pixels; add marks around expansion `load.start`/complete (`ArenaScene.ts:2324-2338`), card bake (`packages/client/src/scenes/arena/card-art.ts:93-160`), paper capture (`ArenaScene.ts:2522-2598`), and sample fetch/decode completion (`packages/client/src/audio/sample-bank.ts:498-526`). Correlate these fixed-ring events with long frames. Run the same scripted worst case at DPR 1, DPR 2, arena, belt-closed, and belt-bag-open.

Highest-leverage fix: implement a total-pixel-budgeted dynamic render scale instead of unconditional DPR 2, because it removes the largest worst-case GPU multiplier from every sprite, Graphics layer, Text upload, beam, and post-effect at once.
