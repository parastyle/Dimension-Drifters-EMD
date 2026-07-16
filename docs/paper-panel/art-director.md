# Paper-craft art direction: charm-per-effort catalog

## Direction

Dimension Drifters should not merely have paper-doll characters. It should behave as if the entire game was assembled on a cutting mat: characters turn edge-on, weapons foreshorten as cardstock, enemies unfold from the floor, loot catches light as a flipped card, landmarks rise from a pop-up book, UI arrives on hinged panels, and changing dimensions physically replaces the page.

This is an extension of the shipped language, not a style graft. The rig already eases its committed facing through `scaleX = 0` (`packages/client/src/entities/SpriteRig.ts:656-674`); pickups already rotate around a fake vertical axis with `scaleX = baseScale * cos(theta)` (`packages/client/src/scenes/ArenaScene.ts:1140-1143`, `:1266-1278`); and orbit/spin already project a ground-plane ellipse, foreshorten the blade along its length, mirror the torso through edge-on, and depth-swap the far half (`packages/client/src/entities/SpriteRig.ts:1296-1346`, `:1368-1392`). The game-feel audit independently identified the through-zero facing turn as the desirable cure for a mechanical mirror pop (`docs/GAMEFEEL_AUDIT.md:37-41`). These are the style's grammar.

The catalog below is exhaustive for the reviewed surfaces. Its order is an art-director charm-per-effort ranking weighted by frequency, recognizability, and whether the beat makes the whole game feel authored—not simply arithmetic division of two scores.

## Style-bible law: turn through the sheet

> **ROTATION NEVER HAPPENS IN THE PLANE; IT HAPPENS THROUGH THE PLANE.**

When an object changes which way it faces, turns over, spins, opens, closes, enters, or exits, its primary cue must be a signed scale crossing zero on the hinged axis. Do not sell that semantic turn with `rotation`/angle alone.

- A left/right turn uses `scaleX = baseX * cos(PI * q)` for eased progress `q: 0 -> 1`. It is full-face at `+1`, edge-on at `0`, and shows the reverse face at `-1`.
- A floor/page fold uses the same rule on `scaleY`, with the object's origin or crop seam placed on the hinge.
- Change depth, crop, tint, text visibility, or front/back art only while `abs(scaleAxis) <= 0.04`; the sheet is edge-on, so the handoff is invisible.
- `rotation` is still legal for a gameplay path (aiming a blade along its authoritative sweep), a lean, or a paper ruffle. It is not a substitute for a turn. Secondary paper rotation stays within `+/-0.12 rad` for ordinary beats. The current `deathPop()` spin of two to five radians is therefore the one existing motion that should be retired (`packages/client/src/entities/SpriteRig.ts:319-343`).
- Text that must remain readable either disappears for the back half or counter-scales like the rig's “you” label already does (`packages/client/src/entities/SpriteRig.ts:675-681`). Never leave mirrored instructional copy on screen.
- A sheet never changes depth while broadside. The orbit's far-half swap is the model: cross edge-on, then move below/above the occluding body (`packages/client/src/entities/SpriteRig.ts:1387-1392`).
- Combat truth wins. Paper envelopes may multiply the existing pose, but may not move a weapon tip away from its authored damaging path; the audit treats visible slash/authority displacement as a defect (`docs/GAMEFEEL_AUDIT.md:93-96`).

### Reusable transform recipes

These five recipes require only Phaser Containers, Images, Rectangles/Graphics, crop or geometry masks, and ordinary transforms.

**P1 — Through-plane turn, 160 ms.** Let `q = smoothstep(clamp(t / 160, 0, 1))`. Set `scaleX = baseX * cos(PI * q)`, `skewY = 0.10 * sin(PI * q)`, and `rotation = 0.035 * sin(2 * PI * q)`. Perform any face/depth swap at `q = 0.5`. For a full continuing revolution use `theta += dt * omega`, `scaleX = baseX * cos(theta)`, and never clamp away the zero crossing.

**P2 — Bottom-hinge pop-up, 220 ms.** Put the origin at bottom-center. For `q = clamp(t / 220, 0, 1)`, use two segments: at `q <= 0.72`, `e = Back.easeOut(q / 0.72)`, `scaleY = baseY * (-0.04 + 1.12 * e)`, `scaleX = baseX * (0.82 + 0.18 * e)`, `skewX = 0.13 * (1 - e)`; afterward ease `scaleY` from `1.08 * baseY` to `baseY` and `skewX` to zero. The underside begins barely visible and crosses through edge-on instead of growing from a positive sliver. Grow the ground shadow from `(0.45, 0.25)` to `(1, 1)` and alpha `0.08 -> resting alpha` over the first 170 ms.

**P3 — Two-piece fold, 320 ms.** Duplicate the existing Image (or one RenderTexture snapshot of a compound UI/world group). Crop/mask both copies at `foldY = 0.58 * sourceHeight`. Anchor the lower crop at the object's bottom and the upper crop at the cut seam. Lower piece: P2 over 210 ms. Upper piece begins at 70 ms; with `u = smoothstep(clamp((t - 70) / 250, 0, 1))`, set `scaleY = baseY * (-0.92 + 1.92 * u)`, `skewX = 0.14 * sin(PI * u)`, and `rotation = 0.05 * sin(PI * u)`. It crosses zero at `u = 0.479`; move it above the lower crop there. Both finish at their authored transforms.

**P4 — Paper flutter, 520 ms.** With normalized `q`, deterministic phase `phi`, and requested drift `(dx, dy)`: `x = x0 + dx*q + 10*(1-q)*sin(6*PI*q + phi)`; `y = y0 + dy*q - 46*sin(PI*q) + 18*q*q`; `scaleX = baseX*cos(3*PI*q)`; `scaleY = baseY*(1 - 0.22*sin(PI*q))`; `skewY = 0.16*sin(6*PI*q + phi)`; `rotation = 0.07*sin(4*PI*q + phi)`; `alpha = (1-q)^1.6`. This is the standard corpse/scrap curve. Hash the entity id for `phi` and direction so clients choose stable variants.

**P5 — Paper ruffle, 110 ms.** For hit direction sign `d` and `q = clamp(t / 110, 0, 1)`, let `r = (1-q)*sin(5*PI*q)`. Multiply `scaleX *= 1 + 0.075*abs(r)`, `scaleY *= 1 - 0.045*abs(r)`, set `skewY += d*0.12*r`, and add only `rotation += d*0.045*r`. Hands trail the body by `x -= d*5*r`; feet receive half that. This reads as a struck sheet vibrating, not rubber squash.

## Ranked catalog

### 1. Pickups: finish the page-flip shimmer and give it an exit

**Charm / effort:** signature / extra-small. The hardest part is already shipped.

Keep the existing 1.7 s `cos(theta)` turn and front-face white duplicate (`packages/client/src/scenes/ArenaScene.ts:1226-1280`). Add a 2 px white edge sliver at the spinner center with `alpha = clamp((0.12 - abs(c)) / 0.12, 0, 1) * 0.9` and `scaleY = 0.75 + 0.25*abs(sin(theta))`; keep the existing face shine at `max(0, c)^5`. On creation, multiply the spinner by P2 with `scaleY -0.04 -> 1` while its continuous `scaleX = baseScale*cos(theta)` remains authoritative. On claim/removal, do not destroy immediately: accelerate `theta` to the next edge-on point over 120 ms, tween the label `scaleY: 1 -> 0` from its top edge, then destroy when `abs(c) < 0.03`. The reconcile and destruction hooks are `ArenaScene.ts:1144-1162` and `:1286-1302`.

### 2. Enemy spawn: unfold every combatant from the floor

**Charm / effort:** signature / small.

At new-enemy construction (`packages/client/src/scenes/ArenaScene.ts:1790-1819`), record a 220 ms spawn envelope on `SpriteRig`; calculate it inside `animate()` so a tween does not fight the facing scale written every frame. Multiply the existing root transforms by P2: `root.scaleX = facingBlend*baseScale*spawnX`, `root.scaleY = baseScale*spawnY`, and set `root.skewX = spawnSkew`. Keep the shadow visible from frame one and grow it as specified in P2. Delay hands 24 ms and weapons 38 ms by applying the same envelope to their local scale; this makes the body card rise first and the paper-doll attachments flick open after it. Toughs use 280 ms and overshoot to `1.12`; ordinary horde enemies use 220 ms. No alpha fade—the visible edge is the entrance.

### 3. Enemy deaths: crumple, flutter, or tear instead of tumbling like a coin

**Charm / effort:** signature / small because `deathPop()` and its removal hook already exist (`packages/client/src/entities/SpriteRig.ts:319-343`; `packages/client/src/scenes/ArenaScene.ts:1840-1886`).

Choose a deterministic treatment from `hash(enemyId) % 3`, with toughs always using tear and bosses using the two-piece version:

- **Crumple:** for 90 ms, set `scaleX: 1 -> 1.12`, `scaleY: 1 -> 0.72`, `skewY: 0 -> +/-0.16`; for the next 150 ms collapse to `(0.18, 0.20)`, move `y += 12`, and fade `alpha: 1 -> 0`. Keep the existing outward displacement but remove its multi-radian `rotation`.
- **Flutter:** use P4 with the existing killer-away vector as `(dx, dy)` and retain the existing 520 ms duration and hop-shaped altitude. This directly replaces `root.rotation = spin` with through-plane `scaleX` flutter.
- **Tear:** duplicate the body image, crop left/right at `0.5*sourceWidth`, hide the original at the edge-on handoff, and run mirrored P4 curves: left `(dx-24, dy+8, phi)`, right `(dx+24, dy-6, phi+PI)`. Hands/feet attach to the nearest half. Separate the halves by 18 px in the first 80 ms before the main flutter. A boss uses the same recipe at 720 ms with `dx *= 1.4` and no extra particles.

Pit deaths remain a clean downward fold, not a celebratory tear: `scaleY = cos(PI*q/2)`, `scaleX = 1 - 0.25*q`, `skewX = 0.12*q`, then disappear edge-on. The existing pit branch is `ArenaScene.ts:1858-1861`.

### 4. Level-up window: a card folio opens, choices unfold one by one

**Charm / effort:** signature / small.

The modal is already rebuilt only when its offer key changes (`packages/client/src/scenes/ArenaScene.ts:2577-2597`), making that key edge the exact entrance/exit trigger. Put the framed shell objects into one screen-space container centered on `(cx, cy)`. Fade the dim only `0 -> 0.66` over 100 ms. Open the shell with P3 over 320 ms; the fold seam sits under the title/countdown, so the heading rises with the upper flap and the choices live on the lower page. Wrap each attribute/augment rectangle and its texts/icon in a card container, then stagger P1-like unfolds by 42 ms: `scaleX = -0.06 + 1.12*Back.easeOut(q)` for 180 ms, `skewY = 0.10*(1-q)`, settling from `1.06` to `1` over 55 ms. Hover is a hinge lift, not a generic zoom: `scaleX: 1 -> 0.965`, `skewY: 0 -> +/-0.055`, `y -= 4` in 80 ms. On selection, the chosen card flips through zero in 130 ms; siblings fold to `scaleX = 0` in 90 ms; then close the shell by reversing P3. Integration points are the shell at `ArenaScene.ts:2618-2662`, augment cards at `:2666-2713`, and stat cards at `:2718-2763`. Preserve the toast above the modal (`ArenaScene.ts:4343-4386`); give the toast P2 rather than its current plain drift.

### 5. Rift descent: the old world folds shut and the next page opens

**Charm / effort:** defining set-piece / medium.

The seed-key change already identifies the exact old-world/new-world boundary, destroys the prior floor, builds the replacement, and applies a violet flash (`packages/client/src/scenes/ArenaScene.ts:1365-1403`, `:1427-1457`). Replace the flash-only swap with a 420 ms two-page transition:

1. Before destroying `floorObjs`, draw the currently visible world once into a viewport-sized RenderTexture; make two Images from that existing rendered texture, crop/mask them at screen midline, and hinge both at that crease. UI stays above them.
2. Over 170 ms, top `scaleY: 1 -> -0.035`, `skewX: 0 -> +0.10`, `y += 5`; bottom `scaleY: 1 -> -0.035`, `skewX: 0 -> -0.10`, `y -= 5`. Both pass through zero during the final beat. Add a 10 px violet crease rectangle whose alpha follows `sin(PI*q)`.
3. At edge-on, perform the existing teardown/rebuild and snap. Capture the newly built visible world into the same two-piece layout. Set both new halves to the signed reverse edge value `scaleY = -0.035`, depth-swap them, and unfold to `+1` over 250 ms with `Cubic.easeOut`; both cross zero in the first 18 ms. Keep the existing descent audio/banner, but fire them when the new page reaches 70% open, not at teardown.
4. Suppress enemy removal VFX exactly as the current mute window does (`ArenaScene.ts:1443-1455`). Input may remain synced, but hold the render camera at the crease until the new page is open.

This is the manifesto shot: the dimension does not fade or teleport; reality is visibly another sheet.

### 6. Damage flinch: the body ruffles like struck cardstock

**Charm / effort:** high-frequency / extra-small.

Apply P5 to the existing recoil flinch after its lean/jolt calculation (`packages/client/src/entities/SpriteRig.ts:698-708`). Derive `d` from the sign of `recoilX` for players; for enemy hits, pass the already-computed attacker-to-enemy direction from `updateCombatFx()` (`packages/client/src/scenes/ArenaScene.ts:4006-4034`, `:4048-4077`). Small hits use amplitude `0.65`, big hits `1`, crits `1.25` capped at `skewY = 0.15`. Use the rig's unfrozen animation clock so hit-stop holds the bent contact pose instead of consuming the ruffle (`ArenaScene.ts:1747-1768`). Do not move the root or weapon.

### 7. Portals and rifts: open as cut holes with hinged inner flaps

**Charm / effort:** high / small.

At `buildGate()` (`packages/client/src/scenes/ArenaScene.ts:2338-2367`), leave the outer ground ring flat and turn the inner disc into the cut-out flap. On creation, start the inner at `scaleY = -0.08`, `scaleX = 0.82`, `skewX = 0.12`; over 240 ms use `scaleY = -0.08 + 1.08*Back.easeOut(q)`, crossing edge-on once, then settle from `1.06` to `1`. The label uses P2 from its baseline 45 ms later. The existing sine pulse may continue only as `scaleX: 1 -> 1.08`; remove uniform rubber breathing.

For the deeper rift channel (`ArenaScene.ts:3784-3797`), progressively fold the flap down: `scaleY = cos(PI*riftCharge)`, `skewX = 0.12*sin(PI*riftCharge)`. It is edge-on at 50% and visibly shows its violet underside afterward; at 100%, the descent transition owns the screen. Extraction reverses the gesture—flap lifts toward the player, `scaleY: 1 -> 0 -> -1` over the final 180 ms—before the end card appears. Gate creation/destruction edges already live in `syncPortal()` (`ArenaScene.ts:2370-2402`).

### 8. Menu-to-arena transition: selecting a dimension turns the page

**Charm / effort:** high / medium.

Replace the black-only fade in `MenuScene.launch()` (`packages/client/src/scenes/MenuScene.ts:382-390`) and the arena fade-in (`packages/client/src/scenes/ArenaScene.ts:940-945`) with one continuous card-to-page move. Find the selected `MenuCard.root`; over 90 ms fold every unselected card to `scaleX = 0` with 12 ms outward stagger. Move the selected root to screen center while its `scaleX = cos(PI*q/2)` reaches zero over 220 ms, `scaleY` grows from `1` to `screenH/CARD_H`, and `skewY = 0.12*sin(PI*q)`. Start Arena at the edge-on callback. In Arena, create a screen-sized page in the chosen palette at `scaleX = -0.035`, hinged on the opposite edge; unfold through zero to `scaleX = 1` in 220 ms, then peel it away with a second quarter-turn `1 -> 0` over 160 ms to reveal live play. Carry the dimension card's existing key art on that page when present (`packages/client/src/scenes/MenuScene.ts:240-255`); otherwise use its palette rectangle. This makes the selected card literally become the next world.

### 9. POIs: landmarks rise as a staggered pop-up book

**Charm / effort:** high / small.

`buildPois()` already uses bottom-centered art, derived display scale, grounding shadows, and y-depth (`packages/client/src/scenes/arena/floor-renderer.ts:195-204`, `:229-256`). That is a ready-made P2 hinge. Create each shadow at scale `(0.45, 0.25)`/alpha `0.08`; create the image at `scaleX = 0.82*sc`, `scaleY = -0.04*sc`, `skewX = +/-0.13` and run P2. Use deterministic delay `min(480, distanceFromSpawn/9) + (poi.kind % 5)*24 ms`, so the environment opens outward in a wave from the safe ring. On a rift page-open, start the POI wave when the new world is 40% open. Do not replay when the camera later visits an off-screen POI.

### 10. Player join, initial spawn, and revive: assemble the paper doll

**Charm / effort:** high / small.

At `addBlob()` (`packages/client/src/scenes/ArenaScene.ts:1581-1592`), apply the same rig spawn envelope as enemies but over 280 ms: feet P2 at `t=0`, body at `t=35`, hands at `t=70`, weapon at `t=100`. This produces a visible assembly order and uses the existing sliced parts. The local player's camera may center immediately; do not wait for the unfold.

On `revivedSeq` change (`ArenaScene.ts:3524-3533`), unfold from the downed crease: body `scaleY: 0.62 -> 1.08 -> 1`, `skewX: 0.14 -> 0`, hands `scaleX: 0 -> 1` with 25 ms stagger, and alpha `0.5 -> 1` over 210 ms. Retain the green flash, but start it at the body's overshoot rather than frame one.

### 11. Boss arrival: tear the page open, then unfold the boss through it

**Charm / effort:** set-piece / medium.

The first-present boss edge already triggers quake, flash, boom, and a banner (`packages/client/src/scenes/ArenaScene.ts:2457-2475`, `:2505-2509`). Replace the flat camera flash with two dark screen-paper halves that tear apart 28 px over 130 ms, each using P1 from `scaleX +/-1 -> 0` and opposite `skewY +/-0.14`; reveal the boss behind them. The boss rig uses P3 over 440 ms, scaled by its authored `renderScale`, with feet/lower crop rising first and upper body crossing the fold 110 ms later. Start the quake at the upper crop's zero crossing, not at state appearance. Colossi (`renderScale >= 5`) use 620 ms and a 34 px crease; ordinary bosses use 440 ms. This composes with the existing lower-body framing (`packages/client/src/scenes/ArenaScene.ts:1804-1811`).

### 12. Menu cards: behave like a row of physical tabs before selection

**Charm / effort:** medium / extra-small.

Replace the current hover-only uniform `scale(1.04)` (`packages/client/src/scenes/MenuScene.ts:289-301`) with an 85 ms cardstock lift: `y -= 5`, `scaleX: 1 -> 0.975`, `scaleY: 1 -> 1.035`, `skewY: 0 -> 0.045*sideFromScreenCenter`, and shadow/frame alpha up 15%. On pointer-out, reverse in 110 ms with `Sine.easeOut`. On pointer-down, compress for 55 ms to `(1.025, 0.94)`, then hand off to the page-turn recipe. The title's existing pulse (`MenuScene.ts:168-174`) should become a subtle through-plane breath instead: `scaleX 1 -> 0.985 -> 1`, `skewY +/-0.018`; do not uniformly inflate typography.

### 13. Restart: crumple the used run and print a fresh sheet

**Charm / effort:** high / medium.

The button sends a restart directly (`packages/client/src/scenes/ArenaScene.ts:1054-1066`), while the new seed key later re-mints the floor and is currently indistinguishable from descent except for copy (`ArenaScene.ts:1398-1456`). On pointer-down, fold the button itself like a pull tab: `scaleY 1 -> 0.72 -> 1`, `skewX 0 -> 0.10 -> 0` over 120 ms. Set a pending-restart presentation flag. When the seed changes at depth 1, capture the viewport and crumple it in 260 ms: `scaleX 1 -> 0.72 -> 0.16`, `scaleY 1 -> 0.82 -> 0.18`, alternating `skewX +/-0.10` and `skewY -/+0.12` at 65 ms intervals, moving to screen center. Rebuild at the minimum size; unfold the fresh page with P3 over 320 ms in the safe-ring color. No violet descent flash and no death effects.

### 14. Pickup grab and mystery reveal: peel the label, then stamp the prize

**Charm / effort:** high / small.

On a grab send (`packages/client/src/scenes/ArenaScene.ts:1644-1650`), fold the nearest pickup label upward `scaleY: 1 -> 0` from its top edge in 90 ms while the spinner executes the edge-on exit from rank 1. When held loot changes, replace the plain `flashBanner()` call (`ArenaScene.ts:4133-4151`) with a small receipt-card container: background rectangle plus the existing rarity text. Enter with P1 from `scaleX = -0.06` to `1` over 160 ms, hold 900 ms, then use P4 with `(dx=18, dy=-34, phi=hash(weaponId))` over 460 ms. The weapon equip itself should rise from the hand with `scaleY: 0 -> 1.08 -> 1` over 120 ms rather than appearing in one frame; the current equip boundary is `SpriteRig.ts:394-463`.

### 15. Downed and defeated: fold, do not merely gray out

**Charm / effort:** medium-high / small.

`setDowned()` currently changes only alpha/tint (`packages/client/src/entities/SpriteRig.ts:537-552`). On down, retain the root position and shadow but bend the visible body at a waist crease over 180 ms: lower body/feet remain at `scaleY = 1`; upper body and attached hands use `scaleY: 1 -> 0.62`, `skewX: 0 -> 0.14`, `y += 7`, and alpha to the existing `0.5`. This preserves a readable revivable body. On a full wipe, the centered defeat copy (`packages/client/src/scenes/ArenaScene.ts:4554-4566`) enters as a torn red card: two horizontal masked halves separate by 8 px, each P1-turning from edge-on to face-on over 180 ms. Avoid a full-screen black fade; the failed page remains visible underneath.

### 16. Extraction and victory: pull the run out as a finished card

**Charm / effort:** high / medium.

On the `won && !prevWon` edge (`packages/client/src/scenes/ArenaScene.ts:2513-2529`), finish the portal flap motion, then draw the visible arena into a screen-card RenderTexture. Scale it from viewport size to `0.72` over 260 ms while `scaleX = cos(PI*q)` crosses zero once; at edge-on, replace the back with the existing victory text on a palette-framed card and counter its local `scaleX` so the copy is upright. Settle the card to `scaleX = 1`, `scaleY = 1` with `Back.easeOut`, then leave it on screen as the run's printed result. Boss Rush uses a jagged two-piece top edge but the same transform. The restart pull tab remains available above it.

### 17. Pit falls and snap-back: slip between layers of the page

**Charm / effort:** medium-high / medium.

The fall event is caught before the hard snap, while the rig is still visibly over the pit (`packages/client/src/scenes/ArenaScene.ts:1460-1487`). At that pre-snap position, make a one-frame RenderTexture copy of the rig, hide the live root, and fold the copy downward over 150 ms: `scaleY = cos(PI*q/2)`, `scaleX = 1 - 0.28*q`, `skewX = 0.13*q`, `y += 14*q`, shadow `scale -> 0.25`. Hard-snap the live rig immediately as today, but reveal it with a 140 ms reverse P2 at the safe tile after the folded copy reaches edge-on. Keep the existing fall streak/audio/shake. This turns rubber-band avoidance into a paper-layer gag.

### 18. Floor decals: stamp down; do not stand up

**Charm / effort:** medium / small.

POIs are pop-ups, but litter is pasted to the ground. At decal creation (`packages/client/src/scenes/arena/floor-renderer.ts:398-415`), start `scaleX = 0.04*sc`, `scaleY = 0.55*sc`, `skewY = +/-0.10`, alpha `0.4`, then stamp to authored `(sc, sc, rotation)` over 130 ms with `Back.easeOut`. Add a one-frame 8% dark duplicate offset `(2, 3)` that reaches alpha zero by 90 ms, reading as glue pressure/shadow. Use deterministic `i % 9 * 12 ms` stagger only during the visible rift-page open; on initial loading, off-screen decals may build already settled.

### 19. Transient banners: arrive as strips of paper, leave as scraps

**Charm / effort:** medium / small.

`flashBanner()` already owns all boss, loot, depth, and room notices and already stacks them safely (`packages/client/src/scenes/ArenaScene.ts:2532-2570`). Wrap each Text in a narrow tinted Rectangle container. Replace the generic scale pop with `scaleX = -0.04 + 1.04*Back.easeOut(q)`, `scaleY = 0.86 + 0.14*q`, `skewY = 0.08*(1-q)` over 180 ms. Hold 1.35 s. Exit with P4 reduced to `dx=12`, `dy=-24`, `rotation amplitude=0.035`, `scaleX=cos(PI*q/2)`, alpha to zero over 520 ms. Depth/death warnings use a downward flutter; loot uses upward.

### 20. Character and weapon swaps: expose the paper-doll construction

**Charm / effort:** medium / medium.

Character changes currently destroy/rebuild the entire rig (`packages/client/src/scenes/ArenaScene.ts:2964-2973`); weapon equips destroy/create parts in one frame (`packages/client/src/entities/SpriteRig.ts:394-400`). For character swap, fold the old rig to `root.scaleX = facingBlend*baseScale*cos(PI*q/2)` over 100 ms, rebuild only at edge-on, seed the new rig at signed `-0.03`, and unfold to its facing sign over 130 ms. For weapon swap, fold only the old weapon along its grip axis: `scaleY: base -> 0`, `skewX: 0 -> 0.12` over 75 ms; replace at zero; unfold `0 -> 1.08 -> 1` over 120 ms. Hands never disappear, which makes the swap read as changing a pinned paper accessory.

### 21. Parry/brace: a stiff cardstock snap

**Charm / effort:** medium / extra-small.

The brace already snaps weapon, hands, and body into a guarded pose (`packages/client/src/entities/SpriteRig.ts:718-725`, `:1208-1212`, `:1248-1254`). Add a 95 ms P5 envelope at 55% amplitude with the sign opposite incoming aim: body `skewY +/-0.07`, hands separate by 4 px then return, and weapon thickness axis `scaleX *= 0.88 + 0.12*abs(cos(PI*q))`. On a successful parry, execute one 100 ms P1 half-flip on the weapon's shine/impact duplicate only; the actual weapon pose stays locked to the gameplay path. This makes the block feel stiff and laminated, not elastic.

### 22. Landing: one accordion crease, then flat

**Charm / effort:** medium / extra-small.

The rig already detects landing and applies a 110 ms body squash (`packages/client/src/entities/SpriteRig.ts:1412-1430`). Shape it as an accordion: during the existing `landSquash`, multiply `scaleY *= 1 - 0.14*k`, `scaleX *= 1 + 0.08*k`, `skewX += 0.06*sin(PI*k)`, feet rotate only `+/-0.04 rad` toward the crease, then all return to zero. At `k > 0.75`, flip a thin ellipse dust cutout through `scaleY: 0 -> 1 -> 0` over 140 ms. Do not bounce the root a second time.

### 23. Initial menu reveal: open the cover, then fan out the dimension tabs

**Charm / effort:** medium / small.

Replace the camera-only fade-in (`packages/client/src/scenes/MenuScene.ts:107-108`) with a cover opening. Title/subtitle begin `scaleY = -0.04`, `skewX = 0.10`; unfold through zero to face-on in 220 ms. Cards created at `MenuScene.ts:139-142` enter left-to-right using P1 from `scaleX = -0.04` to `1`, 45 ms apart, while moving `y: +12 -> 0`. The hint folds up last with `scaleY: 0 -> 1` over 130 ms. A short black fade may remain under the paper motion for loading concealment, but it cannot be the visible transition.

### 24. Belt/room changes: flip the backdrop at the gate like a book tab

**Charm / effort:** medium / small, secondary because belt is not the primary menu mode.

The room-name edge and backdrop texture replacement are adjacent (`packages/client/src/scenes/ArenaScene.ts:3330-3346`). On room change, tween the old backdrop `scaleX = cos(PI*q)` over 240 ms. At `q=0.5`, when edge-on, call `setTexture(nextKey)`, invert a local base sign so the new art is upright, and depth-swap the room banner above it. Add `skewY = 0.05*sin(PI*q)`; keep clouds independent so the sky does not look glued to the turning page. The existing room banner uses the strip recipe at rank 19.

### 25. Off-screen portal/rift locators: folded margin tabs

**Charm / effort:** small but constant / extra-small.

The edge locators are already dedicated containers (`packages/client/src/scenes/ArenaScene.ts:221-224`, `:3882-3897`). Give each arrow a 1.25 s tab flip: `scaleX = 0.92 + 0.08*cos(theta)` most of the cycle, then once per cycle execute P1 through zero over 140 ms; at edge-on, swap between its arrow face and a short “EXTRACT”/“RIFT” label face. Counter-scale the text on the back half. Pin the hinge to the screen edge so it reads as a bookmark protruding from the current page.

### 26. Ambient dust: reserve a few motes as drifting paper fibers

**Charm / effort:** low individually / extra-small; use sparingly.

The ambient layer already owns screen-space drifting motes (`packages/client/src/scenes/ArenaScene.ts:209-210`, `:2405-2426`). Convert at most one in eight into a 2x7 px rectangle or existing mote object with `scaleX = cos(theta)`, `skewY = 0.12*sin(theta)`, and `theta += dt*(2.2 + hash*1.4)`. Its path is `x += wind*dt`, `y += (4 + 2*sin(time+phi))*dt`; alpha stays below `0.18`. This is connective tissue, not confetti. Disable during level-up, defeat, and victory so the hero paper motions remain clean.

## Production guardrails

- Horde-scale spawn and hit envelopes are scalar state evaluated inside `SpriteRig.animate()`, not per-part perpetual tweens. The scene can animate up to a large horde every unfrozen frame (`packages/client/src/scenes/ArenaScene.ts:1737-1769`); avoid closure and GameObject allocation in that path.
- One-shot menu, modal, gate, POI, and transition folds may use Phaser tweens. Kill or remove them with their owner; the pickup counter already demonstrates why plain-object tweens need explicit cleanup (`packages/client/src/scenes/ArenaScene.ts:1281-1302`).
- Hash ids for death variant, flutter phase, fold direction, and stagger. Cosmetic timing may be local, but two co-op clients should not see an enemy tear left on one screen and crumple on another.
- A paper turn changes silhouette/depth only. Never change server position, hit radius, portal radius, pickup radius, or active weapon geometry.
- At crowd scale, preserve the hierarchy: player, boss, pickup, and portal get full two-piece treatment; ordinary enemies get one hinge plus one flutter; ambient objects get a single-axis fold. If everything tears into six scraps, the style becomes visual noise.
- Do not add beige paper textures over the painted art. “Paper” is communicated by planar transforms, hinges, cut silhouettes, undersides, depth handoffs, and restrained flutter. Preserve every dimension's palette and cel shading.

## The five to ship first

1. **Pickup page-flip completion** — add edge glint, hinged spawn, and edge-on claim exit around the already-shipped cosine spinner (`ArenaScene.ts:1140-1143`, `:1266-1302`).
2. **Enemy spawn unfold** — one reusable rig envelope at the new-enemy hook (`ArenaScene.ts:1790-1819`), immediately visible hundreds of times per run.
3. **Death crumple/flutter/tear** — replace the off-style in-plane tumble inside the existing `deathPop()` path (`SpriteRig.ts:319-343`; `ArenaScene.ts:1840-1886`).
4. **Level-up folio** — group the existing shell/cards and apply the fold/stagger recipes at the offer-key edge (`ArenaScene.ts:2577-2763`). It proves the style owns UI as well as combat.
5. **Rift world fold** — turn the existing seed-swap/flash boundary into the signature old-page/new-page transition (`ArenaScene.ts:1365-1457`). It is the shot that makes every smaller fold read as deliberate foreshadowing.

Those five establish the complete ladder: collectible, common enemy entrance, common enemy exit, core progression UI, and world-scale transition. After they ship, the remaining catalog is expansion of a language players already understand—not a collection of unrelated gags.
