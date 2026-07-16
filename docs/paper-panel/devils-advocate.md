# Paper-Craft Direction Panel — Devil's Advocate

## Verdict

Do **not** approve the brief as “put a flip, fold, page-turn, or cutout gag anywhere it can live.” In a readability-first bullet heaven, that instruction turns a strong material identity into ambient motion noise. Approve a narrower thesis:

> **The world is made of illustrated, weathered cut paper; paper motion is a scarce verb reserved for authored state changes.**

That distinction matters. Static cut edges, printed texture, layered shadows, pinned joints, and economical plane-turns can unify the game. A gag on every state change makes every object compete to be the punchline. The existing rig works because the paper illusion explains specific geometry: facing eases through a plane, orbit weapons foreshorten, and a spin can mirror the torso while the label stays stable (`packages/client/src/entities/SpriteRig.ts:656-681`, `packages/client/src/entities/SpriteRig.ts:1297-1303`, `packages/client/src/entities/SpriteRig.ts:1369-1378`). It is a vocabulary already, not permission to conjugate every noun.

My recommendation is **conditional approval**. The paper medium is strategically valuable. Ubiquitous paper motion is not.

## 1. When charm becomes gimmick noise

### The attack

Bullet-heaven readability depends on fast preattentive sorting: self, bullets, danger footprints, enemies, loot, then scenery. A fold is not visually neutral. It changes silhouette, apparent size, contrast, depth, and often visibility at once. Those are the same channels the combat system uses to say “this will hit,” “this can be parried,” “this target died,” or “this pickup is interactable.”

The current code already protects that hierarchy. Telegraphs live above bodies on a dedicated high-depth graphics layer (`packages/client/src/scenes/ArenaScene.ts:842-852`). Parryable attacks are white and dodge-only danger is red (`packages/client/src/scenes/ArenaScene.ts:2008-2014`, `packages/client/src/scenes/ArenaScene.ts:2102-2109`). The expanding-ring hazard is deliberately drawn at exactly the server’s damaging band width (`packages/client/src/scenes/ArenaScene.ts:2146-2155`). The floor likewise keeps painted rims beneath crisp vector lips and chevrons because the vectors are the gameplay read (`packages/client/src/scenes/arena/floor-renderer.ts:317-345`).

If enemies flap on spawn, weapons flip continuously, props curl, gates iris, hit numbers peel, and the UI page-turns at the same time, paper motion stops carrying meaning. Worse, scale-through-zero resembles disappearance. In a dense fight, eighty edge-on silhouettes can read as despawns, dodges, invulnerability, or dropped frames. The audit already identified binary animation discontinuities as a root cause of clunk and had to convert the facing snap into an eased turn (`docs/GAMEFEEL_AUDIT.md:9-12`, `docs/GAMEFEEL_AUDIT.md:37-41`). Reintroducing discontinuity as “style” would be regression wearing a bow tie.

**Fatal:** any paper treatment that changes the geometry, timing, color language, or continuous visibility of a live combat instruction.

**Manageable:** paper texture and motion that sit below the instruction layer, occur after resolution, or happen during a genuinely safe transition.

### Steelman

Cutout styling can improve readability when it strengthens silhouettes instead of animating them. A dark keyline, restrained contact shadow, fewer internal values, and clearly separated paper layers can make a painted mob easier to parse than soft volumetric rendering. The existing rig demonstrates the good version: the facing plane-turn is cosmetic and client-side, while aim remains separate; the “you” label explicitly counter-scales so it stays readable (`packages/client/src/entities/SpriteRig.ts:94-103`, `packages/client/src/entities/SpriteRig.ts:669-681`). The orbit blade still passes through the server’s damaged arc and changes depth only on the far half (`packages/client/src/entities/SpriteRig.ts:1297-1303`, `packages/client/src/entities/SpriteRig.ts:1387-1393`).

So the idea is not too broad aesthetically. It is too broad behaviorally. Make paper omnipresent as **material**, rare as **motion**.

## 2. Moments that must never become gags

### Live telegraphs: never stylize the contract

The danger footprint may look printed, but its boundary, fill progression, safe gap, semantic color, and strike-time disappearance must remain mathematically literal. Do not curl its edge, wobble its radius, hinge it out of the floor, tear it at impact before damage resolves, or cover it with a page transition. The melee windup renderer intentionally smooths the 20 Hz source but snaps downward so the cue does not linger past the strike (`packages/client/src/scenes/ArenaScene.ts:1951-1964`). Projectile tells use a tightening white ring as a direct time-to-contact cue (`packages/client/src/scenes/ArenaScene.ts:3757-3783`). The audit calls out timing telegraphs as the one cue a 0.45-second parry is read against (`docs/GAMEFEEL_AUDIT.md:60-64`).

**Fatal:** a paper animation becomes part of the hitbox read.

**Manageable:** a static ink/halftone treatment outside the exact boundary, proven not to reduce contrast.

### Player damage, downed state, revive, and defeat: never make status ambiguous

Paper can frame these states; it cannot be the only evidence of them. A local hit currently has body flash, prioritized camera response, hurt audio, HP change, and vignette (`packages/client/src/scenes/ArenaScene.ts:4106-4123`, `packages/client/src/scenes/ArenaScene.ts:4409-4429`). Downed bodies grey and fade, revives flash green and sound a rising cue, and the HUD explicitly distinguishes DOWNED from DEFEATED (`packages/client/src/scenes/ArenaScene.ts:3524-3533`, `packages/client/src/scenes/ArenaScene.ts:4554-4566`). Those redundancies are good.

Do not fold a downed player flat, tear them out of the scene, or turn their body into loose scraps. Teammates must still locate the revive target in combat. Do not run a full-screen “book closes” animation when one co-op player goes down; that player may be spectating a live rescue. A torn wanted-poster defeat card is acceptable only after the unmistakable state text and only when the squad outcome is final.

**Fatal:** paper charm replaces persistent state feedback or makes a revivable body look removed.

**Manageable:** paper is an additive frame around status that remains readable with the embellishment disabled.

### Enemy death: stylize the outcome, never the confirmation

Enemy death is the important exception. Once the enemy has left authoritative state, its corpse animation is explicitly harmless client-local flavor (`packages/client/src/entities/SpriteRig.ts:319-343`). A cutout tumble, tear, or punched-out hole can be excellent here. But the baseline confirmation must still happen first: flash/number on damage, poof and sound at removal, then the detached corpse treatment (`packages/client/src/scenes/ArenaScene.ts:1840-1888`, `packages/client/src/scenes/ArenaScene.ts:3991-4047`).

The code already proves why this must be budgeted. Rift descent mutes bulk-removal VFX to prevent a corpse storm (`packages/client/src/scenes/ArenaScene.ts:1851-1856`), and horde hits cap full contact stacks at ten and pooled labels at twenty-four while preserving a cheap flash for the rest (`packages/client/src/scenes/ArenaScene.ts:135-138`, `packages/client/src/scenes/ArenaScene.ts:4028-4046`). Paper deaths belong inside that degradation policy, never outside it.

**Fatal:** death stylization can be mistaken for teleport, spawn, dodge, or a still-live target.

**Manageable:** a post-confirmation flourish with a cheap mass-kill fallback.

### Interaction commitment: never imply an action before authority commits it

A page turn means “we have left.” A fold shut means “this is unavailable.” Use neither while the outcome is still pending.

The rift has an authoritative 0→1 channel arc (`packages/client/src/scenes/ArenaScene.ts:3784-3798`). Its page-turn may begin only after that channel completes and the new state is accepted. Extraction and descent must retain distinct colors, labels, positions, and edge locators (`packages/client/src/scenes/ArenaScene.ts:2338-2402`, `packages/client/src/scenes/ArenaScene.ts:3882-3896`). This is especially important because extraction agency is already an open design problem: the audit notes that the current portal can bank the run as an instant tripwire (`docs/GAMEFEEL_AUDIT.md:123-124`). A flourish cannot disguise or “solve” that contract.

**Fatal:** transition motion starts on proximity, prediction, hover, or button-down when the server can still reject or reinterpret the action.

**Manageable:** transition motion acknowledges an accepted, irreversible state change.

## 3. Performance at eighty rigs

### The attack

“It is only transforms” is true in isolation and misleading at horde scale. Every enemy is already iterated every live frame, sampled, animated, branded, telegraphed, and depth-sorted (`packages/client/src/scenes/ArenaScene.ts:1905-2005`). Each `SpriteRig.animate()` updates body scale/rotation, every hand, every foot, and every weapon (`packages/client/src/entities/SpriteRig.ts:688-708`, `packages/client/src/entities/SpriteRig.ts:1214-1289`, `packages/client/src/entities/SpriteRig.ts:1291-1410`). At eighty rigs, one “small” per-part fold is hundreds of additional property writes and matrix recalculations per frame, before projectiles, telegraphs, dust, pickups, and impact VFX.

The dangerous implementation is not arithmetic; it is multiplying scene-graph work:

- Per-rig masks, filters, render textures, or dynamic paper meshes multiply draw cost and break batching.
- Long-lived Phaser tweens multiply update records and ownership problems. Pickups already carry perpetual float, halo, and spin tweens, with explicit cleanup for the counter tween Phaser cannot infer (`packages/client/src/scenes/ArenaScene.ts:1236-1283`, `packages/client/src/scenes/ArenaScene.ts:1295-1302`). Adding more continuous pickup “charm” is unjustified.
- Competing tweens on scale are structurally unsafe because `animate()` reassigns root and body scale every frame (`packages/client/src/entities/SpriteRig.ts:669-674`, `packages/client/src/entities/SpriteRig.ts:688-696`). Death tweening works only because the caller first removes the rig from the animated set (`packages/client/src/entities/SpriteRig.ts:319-323`).
- Display-list changes must be edge-triggered. The rig avoids repeated depth writes by quantizing and caching them, and orbit swaps front/back only when the side changes (`packages/client/src/entities/SpriteRig.ts:297-303`, `packages/client/src/entities/SpriteRig.ts:1387-1393`). A naïve fold that reorders children every frame would undo those safeguards.
- Full-floor “folds” are a trap. Painted terrain is roughly a hundred static images built once, and decor density scales with arena area (`packages/client/src/scenes/arena/floor-renderer.ts:119-135`, `packages/client/src/scenes/arena/floor-renderer.ts:374-416`). Animating those individual pieces converts cheap static dressing into a transition-time spike exactly when the floor is being destroyed and rebuilt.

The game has already needed explicit hit-VFX, label, hit-stop, and audio prioritization because horde events saturate presentation channels (`packages/client/src/scenes/ArenaScene.ts:135-138`, `packages/client/src/scenes/ArenaScene.ts:3945-3974`). Paper effects are not exempt merely because they are on-brand.

**Fatal:** per-rig filters/masks/render textures; per-part perpetual tweens; unbounded death/spawn flourishes; or animating a rebuilt floor object-by-object.

**Manageable:** scalar transforms composed into the existing animation pass, state-edge-only depth changes, one screen-space transition overlay, and explicit degraded paths for horde scale.

### Steelman

Paper fake-3D is one of the cheapest ways to imply volume. The existing orbit obtains a convincing camera-plane turn from trigonometry, scale, rotation, and one depth swap; it does not need a 3D renderer (`packages/client/src/entities/SpriteRig.ts:1297-1346`). Static floor cutouts are also cheap: terrain and decor are created once at negative depths and scroll with the camera (`packages/client/src/scenes/arena/floor-renderer.ts:27-35`, `packages/client/src/scenes/arena/floor-renderer.ts:110-120`).

Therefore performance does not veto the direction. It vetoes implementation by layer accumulation. One composed transform is style; five independent tweens, a mask, and a shader are a tax.

## 4. Tone: frontier grit versus paper whimsy

### The attack

“Paper Mario” is a useful visual shorthand and a dangerous tonal instruction. Players associate springy folds, cheerful page turns, sticker pops, and toy-box foley with comedy. Dimension Drifters’ Wild West foundation is rust bands, warm-black voids, hot pit lips, dust, bones, scrub, and collision-scaled landmarks (`packages/client/src/scenes/arena/floor-renderer.ts:261-265`, `packages/client/src/scenes/arena/floor-renderer.ts:284-292`, `packages/client/src/scenes/arena/floor-renderer.ts:398-415`). Boss language includes world-ending slams, heavy quakes, and deep impact audio (`packages/client/src/scenes/ArenaScene.ts:2059-2081`). A jaunty fold after that impact can puncture threat faster than bad dialogue.

The same issue spans dimensions. The menu and floor systems deliberately preserve separate palettes, key art, POI packs, and decal packs (`packages/client/src/scenes/MenuScene.ts:232-287`, `packages/client/src/scenes/arena/floor-renderer.ts:47-80`). A universal cream-paper edge, bouncy easing curve, and identical rustle sound would flatten Wild West, Frostfell, Verdant Ruins, Ashlands, and Neon Cyber into one scrapbook. The medium would eat the worlds it is meant to unify.

**Fatal:** “paper” is implemented as a universal cute-comedy behavior pack.

**Manageable:** paper is treated as a production medium whose stock, print process, wear, edge, and sound change by dimension and dramatic context.

### Steelman

Paper is not inherently whimsical. It can be a torn wanted poster, a pulp horror broadside, a woodcut, a scorched map, a pressed botanical plate, or a fluorescent punk zine. That is a strong unifier for a game about drifting between visually different dimensions: the worlds change, but all were printed, cut, layered, and weathered by the same hand.

The tonal solution is an art bible, not retreat. Wild West can use tobacco-stained pulp, knife cuts, black ink, and dry hinges; Frostfell can use pale vellum and brittle creases; Verdant Ruins can use pressed-fiber and leaf silhouettes; Ashlands can use charred cardstock; Neon Cyber can use laminated zine stock and misregistered fluorescent ink. Combat sounds remain steel, impact, void, and thunder. Paper rustle belongs mainly to menus and macro transitions, not to every kill.

## 5. Moment-by-moment ruling

| System | Ruling | Allowed paper language | Non-negotiable prohibition |
|---|---|---|---|
| Facing / authored melee | **Keep; manageable** | Existing plane-turn, body twist, orbit foreshortening, and edge-triggered front/back pass | Do not stack a second generic fold on root/body scale; do not let the pose disagree with the authoritative attack arc (`packages/client/src/entities/SpriteRig.ts:783-806`, `packages/client/src/entities/SpriteRig.ts:1297-1303`) |
| Menu | **Best candidate** | Layered cut cards, restrained hover lift, a selected-card page turn into the run | Never turn card copy edge-on or move its input geometry; cards are deliberately fixed-size with matching hit areas (`packages/client/src/scenes/MenuScene.ts:14-15`, `packages/client/src/scenes/MenuScene.ts:287-301`) |
| Run launch | **Good macro beat** | Replace or accompany the current post-selection fade with one acknowledged page transition | Do not delay scene launch on asset-heavy per-card animation; preserve the double-launch guard and async arena readiness (`packages/client/src/scenes/MenuScene.ts:382-390`) |
| Ordinary enemy spawn | **Use sparingly** | A brief pop-up or punched-out silhouette at a stable spawn point | Never obscure a spawn warning, keep flapping after activation, or resemble enemy death |
| Boss spawn | **Accent only** | One large, weighty reveal after the threat location is established | Never replace health bar, arrival quake, flash, or boss identity; those already carry threat (`packages/client/src/scenes/ArenaScene.ts:2457-2485`) |
| Enemy death | **Good post-resolution beat** | Tear, tumble, punched-out hole, or detached cutout launch within the existing VFX budget | Never replace flash/number/poof/audio, and never fire during rift bulk removal (`packages/client/src/scenes/ArenaScene.ts:1840-1888`) |
| Player down / defeat | **Mostly protected** | Static torn-border overlay after status is literal; final defeat card after squad wipe | Never remove or fold flat a revivable body; never page-close a live co-op rescue (`packages/client/src/scenes/ArenaScene.ts:4554-4566`) |
| Pickups | **Already at the ceiling** | Cut-paper silhouette and perhaps a one-shot unfold on creation | Do not add more perpetual motion. Preserve the stable label, halo, and exact grab-target ring while only the inner art spins (`packages/client/src/scenes/ArenaScene.ts:1186-1230`, `packages/client/src/scenes/ArenaScene.ts:3711-3721`) |
| Portals / rifts | **Good only after commitment** | Gate as layered paper aperture; one full-screen page change after accepted extraction/descent | Never distort the radius, label, semantic color, edge arrow, or rift charge; never begin the transition on proximity alone (`packages/client/src/scenes/ArenaScene.ts:2338-2402`, `packages/client/src/scenes/ArenaScene.ts:3784-3798`) |
| Rift descent | **Strong signature opportunity** | One screen-space page/fold covering the authoritative teleport and floor swap | Do not fold eighty rigs or a hundred floor tiles individually. Do not replay death gags for cleared enemies (`packages/client/src/scenes/ArenaScene.ts:1400-1456`) |
| Level-up window | **Natural but restrained** | Cards may arrive as dealt paper and then remain perfectly face-on; panel frame can read as a cut mat | Never animate copy during decision time, hide the countdown, or make selection wait for flourish. The modal cadence and enemy pile-up are already an open design issue (`packages/client/src/scenes/ArenaScene.ts:2575-2662`, `docs/GAMEFEEL_AUDIT.md:120-121`) |
| Restart | **Distinct reset grammar** | A crumple, tear-out, or hard new-sheet replacement after restart is acknowledged | Never reuse the descent page-turn: progress and reset are opposite meanings. The floor gate currently recognizes both as remints and only the depth check distinguishes the banner (`packages/client/src/scenes/ArenaScene.ts:1398-1456`) |
| Floor props / POIs | **Prefer static craft** | Printed edge wear, layered contact shadows, pinned/slot-tab construction, dimension-specific stock | Never let decor overlap pit lips or animate near danger reads. POI visible width must continue matching collision scale (`packages/client/src/scenes/arena/floor-renderer.ts:195-258`, `packages/client/src/scenes/arena/floor-renderer.ts:317-345`) |

## 6. Guardrails any implementation must obey

1. **Paper is the material; motion is a semantic verb.** No task may justify an animation only with “there was room for a gag.” It must name the state change the motion communicates.

2. **The gameplay contract renders last and stays literal.** Telegraph boundaries, safe gaps, parry windows, projectile cores, HP/ammo, interaction radii, countdowns, and downed/revive state may receive static styling only. Their geometry, timing, opacity floor, and white/red semantics are protected.

3. **Use one verb for one meaning.** Recommended lexicon: plane-turn = facing/depth; unfold/pop-up = arrival; tear/punch-out = resolved enemy removal; page-turn = accepted forward scene transition; crumple/new sheet = reset; fold-shut = confirmed unavailable. Never use the same verb for death and spawn, or descent and restart.

4. **Outcome effects never replace confirmation.** Damage flash/number, hit audio, state text, and authoritative removal remain the baseline. Paper flourishes are an additive upper tier with a cheap fallback.

5. **No live instruction may pass through zero visibility.** Scale-through-zero is allowed for authored rig facing and weapon depth where continuity and labels are already handled. It is forbidden on live telegraphs, the local player’s status silhouette, pickup labels/targets, and gate charge.

6. **One transform owner per property.** Do not tween `SpriteRig` root/body scale or rotation independently of `animate()`. Compose approved paper poses into the existing animation calculation, or detach the object first as death-pop already does. No two systems fight over `scaleX`, depth, alpha, or child order.

7. **No per-rig expensive rendering.** No masks, filters, render textures, dynamic geometry, or bespoke shader pass on the horde. No object-by-object full-floor transition. Macro transitions use a bounded screen-space overlay; static craft belongs in authored/baked textures.

8. **Every mass event has a budget and degraded path.** Spawn, death, hit, and loot paper effects must participate in visibility/importance prioritization. Stress cases include eighty enemies, ten players, an AoE clear, multiple drops, a boss telegraph, and a rift remint in the same second. Off-screen and over-budget actors get the stable silhouette/flash path, not a cheaper flickering fold.

9. **Motion cannot delay control or acknowledgement.** Menu, level-up, pickup, restart, extraction, and descent inputs remain responsive while flourish plays. Irreversible transition motion begins only after authoritative acceptance. Reduced-motion mode replaces plane turns/page curls with cuts or short dissolves without losing information.

10. **Dimension and tone own the finish.** Paper stock, edge wear, print registration, easing, and foley are dimension- and context-specific. Combat threat retains metal, impact, quake, and void audio; paper rustle does not become the universal response sound.

11. **Protect negative space.** No ambient flap, curl, dust, decal, banner, or paper particle may cross the local player, live projectile corridor, danger footprint, pickup target, or gate charge. If charm competes with instruction, charm loses.

12. **Ship only after worst-case readability and frame-time review.** Review at gameplay zoom, not in isolated asset viewers. Capture crowded fights with effects on/off, verify exact telegraph/hitbox alignment, profile frame time and display-object/tween counts, and reject any treatment whose meaning cannot be identified in motion without explanation.

The sharp version of the direction is not “Paper Mario everywhere.” It is: **a brutal illustrated world physically constructed from paper, with a disciplined stagehand who only moves the scenery when the player needs the movement to mean something.**
