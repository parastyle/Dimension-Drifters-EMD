# Client scenes + entities audit — 2026-07-18

Scope: `packages/client/src/scenes/**` and `packages/client/src/entities/**`, with only seam-level inspection of `ui/`, `net/`, `vfx/`, and `sprites/`. This is a static, read-only audit; the running dev server and render fleet were not touched. The known repository-wide Biome/CRLF debt is intentionally excluded.

## P0

No P0 findings in this territory.

## P1 findings

### P1-1 — The schema-version guard reports a mismatch but still installs and executes the incompatible patch path

- Evidence: `packages/client/src/scenes/ArenaScene.ts:3826-3843` detects `state.schemaVersion !== SCHEMA_VERSION`, writes an error, and then still calls `applyDevLaunch()`; `packages/client/src/scenes/ArenaScene.ts:3851-3863` subsequently installs `onPatch` without any schema-accepted gate.
- Why: after the schema 27→31 arc, a stale server can continue feeding decoded rows into prediction, gear, HUD, and presentation code even though the comment says the state may have corrupted field offsets.
- Fix: make the handshake fail closed: add a connection-local `schemaAccepted` latch, set it only after an exact match, make `onStateChange` return until it is true, and on mismatch detach the room callbacks, clear `this.room`, leave the room, and show a terminal reload message; add a connection test proving `onPatch` and `applyDevLaunch` are never called for a mismatched version.

### P1-2 — The old production character-cycle path now diverges from the wardrobe rig and can move predicted weapon origins without resizing the rendered actor

- Evidence: `packages/client/src/scenes/ArenaScene.ts:3882-3916` renders every gear-synced player on `PLAYER_SPRITE` but applies the legacy `characterScale(charId)` only when the rig is created; `packages/client/src/scenes/ArenaScene.ts:7875-7891` deliberately ignores later character changes when gear is synced; `packages/client/src/scenes/ArenaScene.ts:4166` still sends `cycleCharacter` from an unguarded production C key; `packages/client/src/scenes/ArenaScene.ts:13666-13678` immediately uses the changed `self.character` scale for the predicted beam origin.
- Why: pressing C can leave the visible boilerplate Drifter at its old scale while beam/presentation math uses the new legacy skin scale, violating WYSIWYG and keeping two identity systems alive after wardrobe became authoritative.
- Fix: remove C from the Arena key union and `addKeys` string, delete the production `cycleCharacter` send, make schema-31 player rigs always use `PLAYER_SPRITE` plus one canonical player scale, then delete `charOf` and the no-gear compatibility recreation path after P1-1 is fail closed; if legacy kit QA is still needed, keep `?dev=char` behind `import.meta.env.DEV` in a dedicated preview path and coordinate removal of character-scaled weapon origins with the server.

### P1-3 — `SpriteRig.animate` allocates for every rig every frame, while its LOD check suppresses only selected effects instead of sleeping an off-screen rig

- Evidence: `packages/client/src/entities/SpriteRig.ts:401-440` returns a fresh `PairCeremonySample` object (and creates `flipScale` while active), and `packages/client/src/entities/SpriteRig.ts:7938` calls it on every animation frame even when the ceremony is inactive; `packages/client/src/entities/SpriteRig.ts:6870`, `7065-7067`, `7940-7941`, `8143-8144`, `8266-8267`, and `8363-8364` create callback closures for repeated `some`/`find` scans; `packages/client/src/entities/SpriteRig.ts:7401-7435` creates a local sampler closure and result objects during rake/scissor poses; `packages/client/src/entities/SpriteRig.ts:6621-6629` computes `outsidePaperView`, but execution continues through the full method to `packages/client/src/entities/SpriteRig.ts:8596`. Arena invokes that path for every enemy and player at `packages/client/src/scenes/ArenaScene.ts:5178` and `8618`.
- Evidence of the local convention: `packages/client/src/entities/PetRig.ts:478-493` hides and returns when both remote owner and pet are off-screen, and `packages/client/src/entities/WormRig.ts:1032-1039` skips off-screen segment writes.
- Why: horde scenes pay thousands of short-lived allocations plus thousands of unnecessary transform writes per second for actors that cannot be seen, inviting GC spikes exactly where the newer entity implementations are allocation-free and LOD-aware.
- Fix: change `samplePairCeremony(elapsed, out)` to fill a retained per-rig sample, hoist `sampleRakePath(..., out)` with two retained outputs, retain front/back hand references when parts are built, cache firing-family booleans on equip, and add a remote sleep/wake branch mirroring `PetRig` that hides the root outside a threat-safe margin, advances only semantic clocks, resets secondary motion on wake, and skips the transform writer.

### P1-4 — `ArenaScene` is a 13,929-line composition root with networking, input, entity reconciliation, combat direction, world rendering, persistence, and five HUDs sharing one mutable field block

- Evidence: `packages/client/src/scenes/ArenaScene.ts:1047-1648` is roughly 600 lines of mixed ownership state; `packages/client/src/scenes/ArenaScene.ts:3943-4255` is a 313-line update coordinator that also performs modal arbitration and command routing; HUD/persistence work resumes at `packages/client/src/scenes/ArenaScene.ts:10732-13179`, after combat and world presentation have already occupied most of the file.
- Why: recent schema, gear, Drive, banking, and bake changes have no enforceable ownership boundary, so a scene-lifecycle or modal edit can silently affect transport, prediction, actor state, or rendering order.
- Fix: keep `ArenaScene` as the Phaser lifecycle/composition shell and move code verbatim behind narrow injected ports in this order (one extraction per PR, with no behavioral redesign):

| Proposed module | Current `ArenaScene.ts` ranges | Responsibility and seam |
| --- | --- | --- |
| `arena/ArenaSession.ts` | `1784-1834`, `3746-3878`, `13346-13522` | Room join/leave, schema gate, message subscriptions, snapshot capture; emit typed session events and expose a read-only room view. |
| `arena/ArenaInputController.ts` | `1261-1347`, `2288-2360`, `3943-4176`, `8941-9322`, `13523-13928` | DOM/Phaser bindings, modal arbitration, action edges, fixed-step command mint/send; consume an `InputModalState` instead of reading HUD fields. |
| `arena/ArenaActorDirector.ts` | `3880-3941`, `4357-5216`, `7868-8939` | Player/enemy/pet/worm reconciliation, interpolation, rig animation, camera-follow targets; own actor maps and their teardown. |
| `arena/ArenaCombatPresentationDirector.ts` | `5217-6410`, `9238-10731`, `13183-13291` | Windups, exact telegraphs, projectile presentation, receipts, flinch/hit-stop/camera punch, contact VFX; receive actor lookup and audio/camera ports. |
| `arena/ArenaWorldDirector.ts` | `2719-3745`, `6334-6530`, `7981-8436` | Pickups, paper transitions, floor/gates/zones/portal, projection strategy and world camera; belt removal in P2-2 makes this seam smaller. |
| `arena/ArenaHud.ts` | `1508-1631`, `2394-2713`, `6703-7860`, `10732-13179` | Vital/objective/Drive/ultimate HUD, level modal, dock, bag/shop surfaces, and their pooled Phaser objects; return only modal/input intents to the scene. |

The smallest first step is `ArenaSession`: its disposer list and generation token already form a boundary, and extracting it also gives P1-1 one testable owner.

### P1-5 — `SpriteRig` is an 8,597-line facade whose gear-bake lifecycle and attachment writer are interleaved with weapon choreography and a 1,998-line frame writer

- Evidence: pure pose/state helpers occupy `packages/client/src/entities/SpriteRig.ts:214-1262`; construction and gear assembly occupy `1373-2415`; attack/tome/death lifetime occupies `2416-4217`; weapon-specific combo grammar occupies `4221-6304`; sprung head and gear placement resume at `6305-6598`; `animate` then spans `6599-8596` and calls the gear writer near `8502-8531` after all combat transforms.
- Why: the replacement-bake wave cannot be changed or tested as one cohesive subsystem because its ownership begins during construction, resumes after thousands of attack-pose lines, and commits only at the tail of the global animator.
- Fix: preserve the public `SpriteRig` API as a facade, but extract `rig/pose-samplers.ts` (`214-1262`), `rig/GearRigController.ts` (`1903-2415` plus `6305-6598`), `rig/AttackPoseDirector.ts` (`2864-4181` plus `4221-6304`), and `rig/RigAnimator.ts` (`6599-8596`); have directors mutate one retained `RigPose` record and let a single applier write Phaser objects, starting with the pure samplers and gear controller so existing tests can move without changing visuals.

## P2 findings

### P2-1 — Arena teardown drops active `SpriteRig` owners without calling their custom destructor

- Evidence: `packages/client/src/scenes/ArenaScene.ts:1846-1900` destroys only pet rigs before clearing the player/enemy maps and truncating `paperDeaths`; `packages/client/src/scenes/ArenaScene.ts:2144-2173` again destroys only worm/pet owners on shutdown; `packages/client/src/scenes/ArenaScene.ts:755-758` shows detached deaths also own `SpriteRig` instances; `packages/client/src/entities/SpriteRig.ts:4201-4216` shows `destroy()` cancels its timer, tears down tell/tome/weapon/gear objects, and releases the gear-bake lease.
- Why: the scene relies on secondary Phaser/cache shutdown side effects instead of honoring the rig ownership contract, and the defensive direct-create reset can retain callbacks or bake leases until a later cache shutdown.
- Fix: add one idempotent `destroyActorRigs()` that deduplicates `blobs`, `enemies`, and `paperDeaths[].rig`, calls `destroy()` once per rig, then clears all three collections; invoke it before map truncation in both shutdown and defensive reset, and add a scene-reentry test with fake rigs asserting exactly-once destruction for live players, live enemies, and detached deaths.

### P2-2 — The shelved belt renderer is a URL-only zombie mode threaded through the production Arena

- Evidence: `packages/client/src/scenes/MenuScene.ts:291-297` explicitly says belt is shelved from the menu and keeps it only for dev/testing; nevertheless belt state and projection live at `packages/client/src/scenes/ArenaScene.ts:1292-1306`, belt assets load at `1683-1705`, the custom floor/camera renderer occupies `7981-8346`, and belt-only persistence/arsenal/shop UI occupies `11955-13163`; dozens of `this.belt ? ...` branches also cross input, telegraphs, projectiles, actor animation, VFX, and beam prediction.
- Why: a hidden mode doubles coordinate-space and UI reasoning in the hottest production class while receiving no normal-player exercise, making it an unusually expensive regression surface.
- Fix: prune belt from `ArenaScene`: keep the new Drive/banking/loadout models, but move the URL-only renderer and belt input/HUD into a separate dev-only `BeltDevScene` if asset QA still needs it, then delete `this.belt` projection branches and belt-only localStorage helpers from the main scene; if no QA owner exists, delete the dev route and renderer outright instead of preserving another flag path.

### P2-3 — Post-wardrobe `MenuScene` repeats Arena's controller problem despite already having clean model/layout seams

- Evidence: wardrobe, prestige, pet, and armory state occupy `packages/client/src/scenes/MenuScene.ts:147-190`; `create()` manually nulls/rebuilds that state at `243-320`; prestige construction/transport spans `451-708`, wardrobe spans `710-1097`, armory spans `1098-1238`, and launch/layout logic continues through `1662`.
- Why: menu re-entry, prestige receipts, wardrobe preview, and launch state share one scene instance, so adding another metagame panel expands the same lifecycle reset list and tab-coupling that made Arena brittle.
- Fix: add `menu/WardrobeTabController.ts` owning wardrobe fields and methods `710-1097`, `menu/PrestigePanel.ts` owning `451-708`, and `menu/ArmoryTabController.ts` owning `1098-1238`; inject the existing `ui/wardrobe` and `ui/armory` pure models, give every controller `build/refresh/setVisible/destroy`, and leave `MenuScene` responsible only for audio, tabs, dimension cards, layout, and launch.

### P2-4 — Arena still creates avoidable transient collections in steady render/UI paths

- Evidence: `packages/client/src/scenes/ArenaScene.ts:6120` allocates `flashedShooters` every frame even when no projectile is added; `11126` creates a loot-prefix array, and `11148-11154` splits augments, builds a `Map`, spreads it, and maps it every HUD frame; belt HUD creates loadout/label arrays at `12305-12314`, re-maps and sorts the bag on every open-panel frame at `12599-12612`, and rebuilds pair-preview arrays at `12907-12930`.
- Why: these allocations sit beside intentionally pooled Graphics/Text/renderers and can turn otherwise bounded combat or an open inventory into periodic garbage-collection work.
- Fix: retain and clear one `flashedShooters` set, cache weapon/augment display strings behind field signatures, keep a three-element loadout scratch array, and rebuild `bagDisplayOrder` plus pair-preview input only when a bag/loadout/attribute signature changes rather than on every draw.

## P3 findings

### P3-1 — Raw mouse tracking registers both pointer and compatibility mouse events for the same handler

- Evidence: `packages/client/src/scenes/ArenaScene.ts:2350-2357` attaches `pointermove` and `mousemove` simultaneously, and `packages/client/src/scenes/ArenaScene.ts:1791-1794` removes both later.
- Why: mouse-capable browsers commonly emit a compatibility mouse event after a pointer event, so the scene can perform the canvas bounds/DPR conversion twice and inflate `pointerMoves` for one physical move.
- Fix: register `pointermove` only when `window.PointerEvent` exists and use `mousemove` solely as the fallback; store which event name was installed so teardown removes exactly that listener.

### P3-2 — Recent-wave source comments and names preserve implementation archaeology instead of current contracts

- Evidence: `packages/client/src/entities/SpriteRig.ts:189-190` retains an always-true `CLIENT_VISUAL_COMBOS` rollback flag used at `3674`, `7091`, and `7120`; `packages/client/src/scenes/ArenaScene.ts:1059`, `3880`, `7868`, and `8438` still call player rigs “blobs” while sibling collections are named `petRigs` and `enemies`; historical voices such as “Finding #11” (`ArenaScene.ts:2626`), “Codex” (`ArenaScene.ts:1688`), version/section trails (`SpriteRig.ts:177-189`), and “MADNESS” (`SpriteRig.ts:6821`) are mixed with invariant comments.
- Why: dead rollback branches, legacy nouns, and ticket-era narration obscure which behavior is still contractual and make recent Sol-wave code read unlike the cleaner `PetRig`/`WormRig` implementations.
- Fix: decide the combo rollout and delete `CLIENT_VISUAL_COMBOS` plus its false branches, mechanically rename `blobs/addBlob/syncBlobs/animateBlobs` to `playerRigs/addPlayerRig/syncPlayerRigs/animatePlayerRigs`, and on touched sections rewrite comments to state only ownership, invariant, or non-obvious reason; move version/ticket/design-history prose to release notes rather than doing an unrelated repo-wide comment sweep.

### P3-3 — The replacement-bake test suite is filed under the facade and mixes three owners in one 747-line test file

- Evidence: `packages/client/src/entities/SpriteRig.boilerplate.test.ts:14-26` imports both `sprites/gear-parts` and `sprites/gear-texture-baker`; describe blocks at `204`, `282`, `364`, `413`, `432`, and `629` cover boilerplate integration, pure spring math, alternative heads, mixed sets, and cache-backed replacement baking.
- Why: failures in the sprite manifest/bake cache appear as an entity-facade suite, reinforcing the same ownership ambiguity that keeps gear code inside `SpriteRig`.
- Fix: move manifest/assembly tests to `sprites/gear-parts.test.ts`, cache/lease tests to `sprites/gear-texture-baker.test.ts`, spring sampler tests to `entities/rig/floating-head.test.ts`, and leave `SpriteRig.boilerplate.test.ts` with only facade integration cases that construct a rig and verify final attachment transforms.

## Executive summary
1. No P0 was found, but the schema guard must fail closed before another schema rollout.
2. Prune the production legacy character cycle because wardrobe rigs and character-scaled prediction can visibly diverge.
3. Extract Arena by session, input, actor, combat-presentation, world, and HUD ownership; it is now 13,929 lines.
4. Split SpriteRig's gear and attack directors, then fix its per-frame allocations and adopt the working PetRig/WormRig LOD idiom.
5. Remove the shelved belt mode from the production Arena, tighten lifecycle cleanup, and normalize comments/tests/names as code is touched.
