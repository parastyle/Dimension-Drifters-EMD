# Beat-'em-up conversion plan (TMNT: Shredder's Revenge-style)

> New direction: top-down bullet-heaven → **2.5D belt-scroller** (Shredder's Revenge / Streets of
> Rage 4 feel). Progress through wide scrolling rooms, camera follows horizontally, parallax
> backgrounds, 4K widescreen. Plus: 3-weapon slots + bag + shopkeepers. This doc is the staged plan.

## The one architectural insight that makes this tractable

Your server **already** owns 2D floor positions `(x, y)`. A belt-scroller floor is *also* 2D. So we
**reinterpret the existing axes** and add the perspective as a **client-only projection** — the
authoritative sim barely changes:

| Axis | Meaning | Owner |
|---|---|---|
| `x` | horizontal along the belt (left/right) | **server** (already have it) |
| `z` (= today's `y`) | depth on the shallow floor band (toward/away) | **server** (already have it) |
| `height` | jump off the floor | server if it affects hits; else client cosmetic |

**Rule that keeps netcode clean:** the sim reasons only in floor world-units (`x, z, height`). The
projection (`horizon`, `depthScale`, parallax, camera) is **client-only presentation and never feeds
back into the sim or hit detection.** Retune the look without touching/re-certifying the server.

Client projection each frame (pure presentation):
```
screenX = x - cameraX
screenY = horizonY + z * depthScale - height      // depthScale ≈ 0.5 (foreshortening)
```
Y-sort floor actors by **`z` descending** (not screenY, so jumps don't scramble order); local player
gets a small +bias. Shadow blob drawn at the floor row (ignores height) sells depth + jumps.

## What this touches (impact map)

- **Low/no change (server sim):** movement (`x,z` already exist), Colyseus schema (rename semantics
  only), netcode/prediction/interpolation (unchanged structure), most damage plumbing.
- **Add to server:** a shallow **depth-band clamp** (z ∈ [0, ~256] world units instead of the 4800²
  arena), **room/arena bounds + wave-gate** state, the multiplayer **camera leash** (authoritative
  x-clamp so players can't tear the shared camera apart), attack **depth-tolerance** in hit tests.
- **Rewrite (client presentation):** the entity render (feet-anchored + projected + shadows +
  y-sort), the **camera** (belt-scroll follow, arena lock, deadzone), **parallax** background system,
  and re-projecting every world-space VFX/telegraph (boss telegraphs currently draw in top-down space).
- **Replace:** the open 4800² procedural arena + POIs + pits (`mapgen.ts`) → a sequence of wide
  **rooms** with gates. Repurpose or retire pit/POI systems.
- **New systems:** 3-slot weapons + bag + hotswap + menu; shopkeepers (sell + meta progression).

## Staged build order (each stage independently testable; ✅ = done)

- **Stage 0 — Parallax + perspective prototype** ✅ *(standalone experiment, doesn't touch the game —
  validates the sky-carrier look, drifting clouds, belt-scroll camera, depth band, shadows).*
- **Stage 1 — Client perspective projection layer.** Feet-anchored sprites, `screenY` projection,
  shadow blobs, y-sort by `z`. Gate behind a flag / new scene so top-down still runs. *Biggest client
  change; no server change.*
- **Stage 2 — Belt-scroll camera.** Horizontal eased follow (lerpX ≈ 0.10), locked vertical, deadzone,
  arena bounds; multiplayer = bounding-box follow + **authoritative leash** (no player past the
  trailing player by > ~1 screen). Reuse the existing eased-follow scaffold.
- **Stage 3 — Rooms + progression.** Server room model `{leftBound, rightBound, waves, gate}`; "clear
  the wave → gate opens → scroll to next room," boss arena at the end. Retire open-arena mapgen.
- **Stage 4 — Parallax in-game.** ✅ *(v0.118)* Codex sky-carrier + storm-bridge backdrops pinned to the
  viewport; a **procedural, transparent drifting-cloud band** over the upper sky (canvas radial puffs,
  seam-wrapped TileSprite, `tilePositionX = camFocus.x * 0.35 + drift`) — camera-independent clouds, no
  art dependency. Theme #1 = **sky aircraft carrier**. *(Deck-plating texture still vector-only: Phaser-4
  GeometryMask2 won't bind to a TileSprite for the varying-trapezoid clip — documented blocker.)*
- **Stage 5 — Depth-tolerance hit detection.** ✅ *(v0.118)* Belt melee is now a **lane hit** (forward
  reach in the facing dir **and** `|Δy| ≤ DEPTH_TOL_PLAYER` + radius), enemy contact is tight
  (`DEPTH_TOL_ENEMY`), and a body rolling/moving in depth shrinks its own hurtbox (`DEPTH_DODGE_MULT`)
  for real dodges. Non-belt keeps the top-down angular sweep. *(Boss-telegraph re-projection still TODO.)*
- **Stage 6 — Weapons: 3 slots + bag + shopkeepers.** ✅ *(v0.118)* `PlayerState.slots[3]` + `activeSlot`
  + `bag` + `scrip` (`ArsenalSlot` carries rarity/affix/earned). Belt grabs ACCUMULATE into empty slots →
  overflow to bag → drop only when full (never destroyed). Keys 1/2/3 + Q/E swap; Tab bag overlay
  (equip/stash); shopkeeper NPC at `beltShopX` with an **F: TRADE** sell-for-scrip overlay
  (proximity-gated, earned-only). Arena/training keep the carousel. *(Cross-run meta-persistence of scrip
  still TODO — currently per-session.)*
- **Stage 7 — Art pass.** ¾-view feet-anchored character/enemy sprites, floor-band art, shadow polish.

## Numeric starting points (from research; 640×360 internal, ×3 for HD)

- Internal res: **640×360** (integer-scales to 4K ×6) *or* HD virtual **1920×1080** (×3 the numbers).
- Walkable band ≈ ⅓ screen: `horizonY ≈ 200`, front ≈ 330; world depth `z ∈ [0,256]`; **`depthScale ≈ 0.5`**.
- Depth hit tolerance: **±16** world units (player attacks) / **±10** (enemy); halve while target moves in z.
- Camera: **lerpX 0.10**, lerpY 0 (locked), deadzone ≈ ⅓ width × band, `roundPixels: true`.
- Parallax: 5 layers, scrollFactors **0.05 / 0.2 / 0.4 / 0.7 / 1.0** + foreground **1.2**; clouds
  scrollFactor 0.1, drift ~6 px/s, 2–3 staggered cloud layers.
- Rooms: arena lock **1–1.5 viewports**; room segment **2–4**; full stage **8–20 viewports**.
- Ultrawide/4K fairness: anchor band to height %, cap the *gameplay* view to ~16:9–18:9, let extra
  ultrawide width show non-interactive parallax only (no combat-awareness advantage).

## Decisions — LOCKED (2026-07-08)

1. **Art path → HD 1920×1080 (SoR4 style).** Virtual canvas 1920×1080; the world-unit numbers above are
   the 640×360 figures **×3**. Reuses the existing harvested/AI sprite style; least art rework.
2. **Run structure → keep the dimension-chain, re-skinned as rooms.** Extract-or-descend greed loop,
   boss clock, and shifters stay; each "dimension" becomes a sequence of belt rooms with wave gates.
3. **Bosses → keep all 11 (incl. Gorogoth), re-project telegraphs** onto the depth band. Reuse the whole
   `bosses.ts` / `boss-primitives.ts` / `BossController` framework.
4. **Meta progression → persistent currency for permanent unlocks.** Shopkeepers convert sold gear into a
   meta-currency banked across runs (a save) and spent on permanent unlocks/upgrades. Roguelite meta.

### HD numbers (×3 of the 640×360 figures)
Virtual 1920×1080; `horizonY ≈ 642`, front ≈ 990, band ≈ 348px; **world depth `z ∈ [0, 696]`**;
`depthScale ≈ 0.5`; depth hit tol **±48** (player) / **±30** (enemy); camera lerpX 0.10; parallax factors
are ratios (unchanged); level width in viewports unchanged. The projection (horizon/depthScale) is
CLIENT-ONLY — only `DEPTH_MAX = 696` and the depth tolerances live in the shared sim.

## Appendix — full belt-scroller research

<details><summary>Plane model, hit detection, camera, rooms, parallax, art, numerics (sourced)</summary>

Sources: boghog/Patreon beat-'em-up dev guides, GameMaker "Building a Beat 'Em Up" pts 1–2, SoR4 dev
interview (PS Blog), Phaser TileSprite/camera docs, Wikipedia beat-'em-up, Gambetta netcode, Colyseus.

- **Plane:** server `{x, z, height, facing}`; client collapses to screen via the projection above.
  Reuse-Y-as-depth is the common 2D-engine convention; keep axes explicitly named on the wire.
- **Hit detection:** `0 ≤ (target.x−attacker.x)*facing ≤ reachX` AND `|target.z−attacker.z| ≤ depthTol`.
  Depth tolerance is THE feel knob (player-generous, enemy-tight). SoR4 shrinks hurtbox depth while a
  character repositions in z, so movement genuinely dodges. Jump: unhittable by ground attacks when
  `|Δheight| > verticalWindow`. All server-authoritative in world units; never derive tol from screen.
- **Camera:** horizontal soft-follow (lerp 0.08–0.12), vertical locked, deadzone, `setBounds` clamped
  to the current arena; on fight-start lock the right bound, on clear open the gate. Multiplayer =
  follow the bounding box of all players + a **leash wall** (authoritative) so the party can't separate
  > ~1 screen; zoom-to-fit only as a clamped fallback (4-player zoom gets cramped). Camera is local
  presentation — each client derives its own from replicated positions.
- **Rooms:** level = sequence of wide rooms; lock pockets 1–2 screens; walk 2–4 between gates; stage
  8–20 screens; depth band constant throughout. Server owns bounds/gate/wave triggers.
- **Parallax:** 4–6 layers via TileSprite; pin looping layers `setScrollFactor(0)` + manual
  `tilePositionX = cam.scrollX * f` for seamless infinite wrap (avoids the ultrawide seam gotcha,
  Phaser #6128). Clouds: add camera-independent drift `+ time * driftSpeed`; 2–3 staggered cloud
  layers; slow opposite-direction far ocean sells altitude on the carrier. Author layers ≥2× res for 4K.
- **Art:** slightly-elevated ¾ view (painted into backgrounds, implied by shallow band + depthScale<1;
  no real 3D). Anchor sprite origin at the **feet** (floor contact) — trivial depth-sort, hitbox align,
  ground FX. **Shadow blob** ellipse at floor row (ignores height) under every actor on a layer beneath
  bodies; shrink shadow as height grows. Floor = flat textured band with perspective painted in + a
  near lip + back wall framing the ~⅓-screen strip. NOT a live perspective grid.

</details>
