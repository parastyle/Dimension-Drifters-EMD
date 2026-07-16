# Technical implementer: make the world behave like paper

## Recommendation

Build the paper style as two cost tiers:

1. **Crowd tier:** transform the Images and Containers that already exist. Spawns, turns, downed poses, deaths, pickups, gates, and POIs should use scale-through-zero, non-uniform squash, rotation, depth swaps, and short one-shot envelopes. Do not add a mask, RenderTexture, mesh, or scrap emitter per rig.
2. **Hero tier:** flatten the visible world into one bounded RenderTexture for menu transitions, restart, and rift descent, then turn or warp that single sheet. This makes the expensive effect essentially independent of whether the frame contains 8 rigs or the full 80-enemy cap (`packages/shared/src/constants.ts:218-222`).

That division extends techniques already proven in the game. The rig eases its facing mirror through `scaleX = 0` (`packages/client/src/entities/SpriteRig.ts:656-674`); orbit weapons foreshorten only their length and swap behind/in front of the body (`SpriteRig.ts:1296-1305`, `:1336-1393`); punches and thrusts already compress, twist, and stretch the painted torso (`SpriteRig.ts:1059-1068`, `:1108-1115`). The new work should make those moves a world rule, not replace them with a separate 3D renderer.

## Phaser 4.1 constraints

The client is on Phaser 4.1.0 (`packages/client/package.json:12-16`) and selects its renderer with `Phaser.AUTO` (`packages/client/src/main.ts:5-7`). Three implementation details matter:

- Core Images and Containers do not expose a general skew transform in this build; the typed `setSkew` is on `DOMElement` (`packages/client/node_modules/phaser/types/phaser.d.ts:24723-24731`). For crowded objects, “skew” should mean a visual shear made from non-uniform scale plus a small counter-rotation. A real deform should use a textured strip or filter, not DOM elements over the canvas.
- Phaser 4.1 exposes `Rope`, not the old general `Mesh`/`Plane` factory. A Rope accepts a segmented point array, permits real-time point mutation, and rebuilds vertices after `setDirty()` (`packages/client/node_modules/phaser/types/phaser.d.ts:48861-48882`, `:49004-49010`). It is sufficient for a page curl or one-axis world fold. A radial crumple would require a custom WebGL filter/render node and should not be the first version.
- Masking differs by renderer. `GeometryMask` is Canvas-only in Phaser 4, while WebGL geometry masking goes through `filters.internal.addMask` (`packages/client/node_modules/phaser/types/phaser.d.ts:10617-10635`, `:21291-21302`). Because the game can fall back from WebGL, masks need a crop/scale fallback. Never make a mask part of the gameplay silhouette.

The most robust primitives for this codebase are therefore:

| Primitive | Use | Avoid |
|---|---|---|
| Existing-object `scaleX/scaleY`, rotation, alpha, depth | Every rig, pickup, gate, and POI | One Tween per body part |
| Crop/frame reveal | UI cards and the cheap page-turn halves | Renderer-specific mask dependency |
| One WebGL mask filter, with crop fallback | A hero UI/page reveal where the irregular edge matters | Per-rig or per-prop masks |
| RenderTexture snapshot | Menu page, restart sheet, rift sheet | Full-DPR or unbounded texture size |
| 12–16 point Rope | Optional page curl and rift world-fold | 80 meshes, one per actor |

## Effect catalog and hook points

### 1. Spawn unfold — highest feasibility, cheapest recurring signature

**Look and technique.** Start edge-on at `scaleX = 0.05`, slightly short at `scaleY = 0.82`, and rotated about 4 degrees. Over 220–280ms, expand through a small `Back.Out` overshoot, settle to the normal root scale, and grow the planted shadow a beat earlier. Add a single dark crease line only for bosses; ordinary rigs need no new object. A stable 0–70ms delay derived from the rig id prevents a synchronized horde “UI animation.”

Do not Tween `root.scaleX` directly while the rig is live: `animate()` writes the facing and base scale every frame (`packages/client/src/entities/SpriteRig.ts:669-674`). Add a `spawnStartMs`/`spawnFold` scalar to `SpriteRig` and multiply it into those final scale writes. That gives one state evaluation per rig and no Tween-manager contention. It also composes correctly with the existing turn-through-zero.

**Hooks.** Call `rig.playSpawnUnfold(animClock)` after player construction and scale assignment in `ArenaScene.addBlob` (`packages/client/src/scenes/ArenaScene.ts:1581-1591`). Call the same method after enemy construction, scale/glow/weapon setup, immediately before insertion into `this.enemies` (`ArenaScene.ts:1793-1819`). The spawn effect is cosmetic; synced position and collision remain untouched, matching the rig's existing client-only contract (`packages/client/src/entities/SpriteRig.ts:94-103`).

`removeBlob` is not a death hook. It is used both for a departed player and for the destroy/recreate character-swap path (`packages/client/src/scenes/ArenaScene.ts:1594-1605`, `:2964-2976`). Keep departures immediate. If the costume swap gets a gag, pass an explicit `reason: "skin-swap"` and overlap the old/new rigs for a 120ms flip-through-zero; never infer death from `removeBlob`.

**80-rig cost.** Zero new drawables and textures. At the cap, this is 80 short scalar envelopes and writes to transforms the rig already updates. The current parts resolve through the packed multiatlas specifically to keep a crowd on one texture (`packages/client/src/entities/SpriteRig.ts:15-33`), so the unfold does not break batching.

### 2. Player down and enemy death — crumple, then flutter away

**Player down.** The player is not removed on death; `animateBlobs` repeatedly sends the authoritative alive state to `setDowned` (`packages/client/src/scenes/ArenaScene.ts:3524-3533`). `SpriteRig.setDowned` is already edge-triggered and resets the combat chain (`packages/client/src/entities/SpriteRig.ts:537-543`), so that method is the exact place to start a 160ms accordion collapse: body `scaleY` to about 0.35, body `scaleX` to 1.15, hands droop, then settle as a grey cutout on the floor. Revive reverses the fold before the existing green flash. Keep the root position and collision unchanged.

**Enemy death.** Extend `deathPop`, which already owns a detached rig and self-destroys after 520ms (`SpriteRig.ts:319-343`). Replace its two independent Tweens with one `addCounter` or one scene-owned paper-death updater:

- 0–90ms: impact crumple (`scaleY 1 → 0.62`, `scaleX 1 → 1.12`);
- 90–420ms: launch on a directly computed root-position arc while the sheet flutters through two shallow scale-through-zero turns;
- 420–520ms: collapse to a narrow scrap and fade.

Because `syncEnemies` deletes the rig from the animated map before calling `deathPop`, its normal pose writer cannot fight the death transforms (`packages/client/src/scenes/ArenaScene.ts:1840-1886`). It also means the death updater must not call `setHop` and wait for interpolation: `setHop` only changes `hopTarget`, while `animate()` applies the visible lift later (`packages/client/src/entities/SpriteRig.ts:305-309`, `:1412-1429`). Put `-sin(pi * t) * peak` directly into the detached root's `y` calculation. Preserve the existing rift bulk-removal mute, which destroys old-dimension enemies without death VFX (`ArenaScene.ts:1851-1856`). That is already the correct protection against an 80-corpse paper storm.

**Budget.** Allow at most 12 full fluttering corpses at once, with toughs/bosses and on-screen kills taking priority. Overflow deaths use a 160ms squash-to-scrap on the existing root, then destroy. Twelve common five-part rigs retain roughly 60 existing Images for half a second; no extra body copies are needed. If loose scraps are added later, pool 36 small atlas-backed scrap Images globally and allow at most three per priority death.

The audit specifically identified death Tweens advancing while combat was visually frozen (`docs/GAMEFEEL_AUDIT.md:46-49`). New paper-death time should use the scene's freeze-aware animation clock or have the paper updater paused with hit-stop; do not add another wall-clock exception.

### 3. Pickups and gates — tabletop pieces, not holograms

**Pickups.** `syncPickups` already uses the correct paper vocabulary: the weapon turns through `scaleX = cos(t)`, with a face-on glint (`packages/client/src/scenes/ArenaScene.ts:1140-1149`, `:1266-1278`). Add only a one-shot “tag pops out of the floor” entrance when the container is created (`ArenaScene.ts:1149-1162`, `:1186-1230`): `scaleY 0.08 → 1`, `scaleX 0.8 → 1`, label delayed 70ms. On removal, fold the local container closed for 100ms instead of destroying it immediately.

The removal loop currently cannot distinguish grab, expiry, and other authoritative removal (`ArenaScene.ts:1286-1291`), so do not fly the pickup toward the player without an explicit server event. A generic close-fold is honest in every case. Keep cleanup centralized in `destroyPickup`; its explicit counter cleanup is the precedent for every pooled paper effect that owns a non-GameObject Tween target (`ArenaScene.ts:1295-1302`). Do not add another infinite Tween—the pickup already has float, halo, spin, and optional cursed breathing.

**Portals and rifts.** `buildGate` constructs one container and its pulse (`ArenaScene.ts:2338-2367`); `syncPortal` owns creation/removal for both gates (`ArenaScene.ts:2370-2402`). On creation, unfold the marker from a horizontal slit and rotate its label up like a tab. On removal, immediately clear the scene field, retain a local reference, fold it to zero over 120ms, then destroy; clearing the field first prevents `syncPortal` from restarting the close every frame.

**Cost.** No new persistent drawables. One entrance/exit envelope per state edge. There are only two gates. Pickup entrance work is proportional to newly observed pickups, not the 80 rigs, and adds no new repeating animation.

### 4. Pop-up POIs — make every arena a paper diorama

`buildPois` already anchors each landmark at its base, derives visual scale from the collision radius, and depth-sorts it at world `y` (`packages/client/src/scenes/arena/floor-renderer.ts:199-205`, `:238-256`). That makes a pop-up-book entrance almost free:

1. Create the Image at its final bottom-biased origin.
2. Set `scaleX = finalScale * 0.9`, `scaleY = finalScale * 0.03`, and a small alternating rotation.
3. Tween to the final uniform scale in 260–420ms with `Back.Out`; scale the existing grounding shadow from 0.4 to 1 over the first 180ms.
4. Delay by a deterministic wave from map spawn to POI, capped at 240ms, so the scenery rises outward as the player arrives.

The map has 28 POI slots (`packages/shared/src/constants.ts:149-158`), so a full rebuild produces 28 one-shot Image Tweens and no extra props. Add the entrance handles to the `objs` lifecycle returned by `buildPois`, because `maybeBuildFloor` destroys that entire list on a seed/dimension change (`packages/client/src/scenes/ArenaScene.ts:1398-1403`, `:1427-1435`).

Do not animate the seeded ground decals. That path can place roughly 70 times the arena-area scale and intentionally treats them as flat litter (`packages/client/src/scenes/arena/floor-renderer.ts:398-415`). Hundreds of little pop-ups would be noisy, expensive, and would make painted ground marks look accidentally vertical.

### 5. Level-up window — a hand-dealt spread

The level window has a clean state edge: `updateLevelWindow` destroys/rebuilds its object list only when the offer key changes (`packages/client/src/scenes/ArenaScene.ts:2575-2599`). Use that edge, not the per-frame timer update, for motion.

Refactor each attribute/augment card and its text into one local Container, then deal the containers from a central stack with 45ms stagger: `scaleX 0.04 → 1`, rotation ±0.06 → 0, and `y + 16 → y`. The shell should open like a folio—panel `scaleY 0.08 → 1` from its top edge—while the dim simply fades. The current shell/card construction points are `ArenaScene.ts:2618-2662`, `:2665-2713`, and `:2717-2763`.

This is a better fit than a full-screen mask. It preserves interactive card geometry, creates five reusable animation roots, and avoids WebGL/Canvas mask divergence. On choice, immediately disable card input and send the existing message—do not add 90ms of control latency. A pooled visual clone can fold forward above the UI while the authoritative state closes and destroys the real card. The level-up world burst and toast already trigger from a level edge and render above the dim (`ArenaScene.ts:4125-4131`, `:4343-4386`); keep those, but replace the generic ring's first beat with a small paper rosette if art becomes available.

### 6. Menu-to-arena page turn — one RenderTexture, two implementation levels

The current handoff fades Menu out, starts Arena, then Arena fades in (`packages/client/src/scenes/MenuScene.ts:382-390`, `packages/client/src/scenes/ArenaScene.ts:940-945`). Replace that black sandwich with a page overlay owned by Arena:

1. Menu launches Arena with a `paperFromMenu` flag and remains alive for the capture frame.
2. Arena creates one screen-sized RenderTexture, mirrors Menu's screen camera, and draws Menu's display objects into it. Arena then stops Menu.
3. Save the RenderTexture under one fixed transient texture key and keep the RenderTexture alive until every overlay Image/Rope using it is gone. Phaser's `saveTexture` aliases the same live texture; destroying the RenderTexture first invalidates consumers (`packages/client/node_modules/phaser/types/phaser.d.ts:47173-47208`).
4. Reveal the live Arena behind the captured page. Skip the ordinary Arena fade-in for this route; retain it for direct dev launches, which currently bypass the normal Menu launch path (`MenuScene.ts:91-98`).

**Version A, ship first:** add left/right frames to the captured texture, show two screen-space Images, and collapse the right half around the spine with `scaleX 1 → 0`. A narrow parchment-colored rectangle plus moving dark strip sells the curl. Cropped frames are renderer-neutral and loud enough at 280–360ms.

**Version B, only after Version A is stable:** use one 12-point horizontal Rope over the snapshot. Bend the last points forward and toward the spine, tint the backside warmer, then move the curl across. This is the real mesh warp, but it should remain a single screen object.

Do not blindly pass the complete Arena display list to `RenderTexture.draw`: an array draw bypasses normal `willRender` checks (`packages/client/node_modules/phaser/types/phaser.d.ts:47315-47318`). Menu is small enough to capture explicitly; Arena snapshots should pass a curated visible-world list so they do not render every offscreen floor/entity or duplicate the HUD.

### 7. Rift descent and restart — fold the old world, reveal the new sheet

The authoritative transition is already centralized. `maybeBuildFloor` detects a new seed/dimension, destroys the prior floor, rebuilds the new one, clears interpolation buffers, and currently flashes violet (`packages/client/src/scenes/ArenaScene.ts:1365-1457`). Capture immediately after `seedKey !== lastSeedKey` is known and **before** the old `floorObjs` are destroyed (`ArenaScene.ts:1398-1403`). The new floor can build underneath while the captured old world remains on top.

For a rift descent, target the fold at the rift's screen position:

- During the existing synced `riftCharge > 0` telegraph (`ArenaScene.ts:3784-3797`), add only a cheap crease/shadow in the live world—no RenderTexture yet.
- On the seed change, capture the old visible world into the shared transition RenderTexture.
- Present it as one 12–16 point horizontal Rope. Animate the point row toward the rift's screen-space `y`, bow the points nearest its `x`, shrink Rope `scaleY` toward 0.04, then collapse alpha. Call `setDirty()` only while the 350–450ms fold is active.
- Leave HUD and level-up UI outside the capture so the world folds under stable controls.

This is a map fold, not a radial black-hole simulation. A Rope is a one-axis strip mesh; trying to pinch every point in two axes needs a custom filter and creates a much larger compatibility/test surface. The one-crease version aligns with a physical sheet and is more legible.

Restart uses the same capture point but a different exit: yank the old page diagonally off-screen with a 6-degree rotation and expose the rebuilt depth-1 map underneath. The button at `ArenaScene.ts:1054-1066` should get an immediate 80ms dog-ear press, but the full page replacement must wait for the authoritative seed change; starting it on click risks covering a delayed or rejected restart. The existing `depth > 1` branch distinguishes the rift presentation from the restart remint (`ArenaScene.ts:1443-1455`).

**80-rig cost.** The one-time capture draws the visible rigs once, then all deformation is one Rope with 24–32 paired vertices. Runtime warp cost is constant with population. Cap the capture at 1600×900 (about 5.5MiB of RGBA color storage; reserve roughly 11MiB transient budget for backing/copy) and scale it to the viewport. Never allocate at physical-DPR 4K size. Phaser notes that resizing a RenderTexture recreates its framebuffer and erases it (`packages/client/node_modules/phaser/types/phaser.d.ts:47134-47171`), so keep one reusable maximum-bounded surface rather than resizing during the effect.

## Pooling and hard budgets

Use one scene-owned `PaperFx` service rather than letting each feature invent cleanup rules.

| Resource | Hard rule |
|---|---|
| Rig spawn/down fold | Inline timestamp/scalar on `SpriteRig`; no pooled GameObject, no closure allocation per frame |
| Full death flutter | 12 simultaneous; overflow uses lite crumple; reuse the existing detached rig |
| Loose scraps | Optional later; 36 pooled atlas Images, 3 per priority death, never masks |
| POI pop-up | Up to all 28 on a floor build; one-shot only; never animate flat decals |
| Pickup/gate fold | Piggyback existing objects; no new infinite Tweens |
| Screen snapshot | Exactly one active RenderTexture, maximum 1600×900; a new request finishes/replaces the old transition |
| Page pieces | Pool two cropped Images, one curl-shadow rectangle, and one 16-point Rope |
| Masks/filters | At most one screen/UI mask active; no mask per rig/prop; always provide crop/scale fallback |
| Transition duration | 280–450ms; no snapshot remains resident after the effect |

Every pooled item needs `acquire → reset all transform/filter/crop state → play → release`. Release must stop/remove owned Tweens, clear filters/masks, hide the object, and remove the transient texture key only after all consumers are released. The pickup counter leak guard at `ArenaScene.ts:1281-1302` is the model. Scene shutdown already clears run-owned collections and display handles (`ArenaScene.ts:680-752`) and must also force-release the paper pool.

Add debug counters beside the existing FPS/entity readout (`ArenaScene.ts:5177-5188`): active full deaths, scrap use, snapshot dimensions, transition time, and peak paper objects. The performance gate is the real 80-enemy cap, not an empty test arena.

## Cheapest-loudest-first build order

1. **Rig spawn unfold + death/down crumple.** Existing objects only; touches the two most repeated lifecycle beats and immediately makes the whole horde obey the paper rule. Acceptance: 80 simultaneous spawns add no GameObjects; 80 removals never exceed 12 full deaths.
2. **POI pop-up + pickup/gate fold.** Makes every arena a diorama and every reward/objective a tabletop piece. Acceptance: 28 POIs settle once, decals remain flat, and no new repeating pickup Tween exists.
3. **Level-up dealt cards + restart dog-ear/page yank.** High player attention, moderate refactor because cards need Containers. Acceptance: input hit areas remain correct throughout the animation and selection cannot double-send.
4. **Menu page turn Version A (cropped halves).** Establishes capture ownership, resolution cap, teardown, resize, Canvas fallback, and direct-dev behavior without mesh risk. Delete/skip the existing paired black fades only for successful captured transitions.
5. **Rift world-fold with one Rope.** Reuse the proven snapshot pool and cleanup path. Acceptance: HUD stays stable, the fold targets the visible rift, old-dimension enemy removals remain muted, and a 1600×900/80-rig profile stays inside the transition budget.
6. **Optional Rope page curl and irregular mask edges.** Pure polish after the renderer matrix is stable. A custom radial warp/filter is explicitly out of scope until profiling and Canvas/WebGL fallback tests justify it.

The style succeeds when players can predict the implementation rule: living pieces unfold, defeated pieces crumple, landmarks stand up, choices are dealt, and whole dimensions are sheets that can turn or fold. The technical rule underneath should be equally consistent: transforms for many objects, one flattened texture for the whole world, and mesh deformation only on that one texture.
