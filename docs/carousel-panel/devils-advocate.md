# Weapon Card Carousel Redesign — Devil's Advocate

> “It is in the way of seeing the game, should stick on the edges of the screen, fade away when not used, not fanned out; thinking a MIRRORED L SHAPE across the BOTTOM RIGHT CORNER.”

## Verdict

**Conditional accept.** Accept the mirrored-L edge geometry and the removal of the fan. Reject a literal wall of 21 fully labelled chips, reject hover-to-expand, and reject fading the active combat readout. The L should be a short, virtualized navigator around an always-readable active-weapon core—not a miniature inventory screen living in the aim lane.

## What the current carousel actually does

The scene builds one card for every id in the active roster, while the roster itself excludes fists and the uncurated expansion batch (`packages/client/src/scenes/ArenaScene.ts:6773-6777`; `packages/shared/src/weapons.ts:1262-1268`). `updateCarousel()` runs from the scene's per-frame update (`packages/client/src/scenes/ArenaScene.ts:2784-2794`).

These are not small selector tiles. Every card is authored at 212×296, with the painted art occupying the top 34% and a dense tooltip slab below (`packages/client/src/scenes/arena/card-art.ts:254-285`). That slab can contain up to four separate damage equations, scaling-grade chips, requirement tokens, and a bottom resource readout (`packages/client/src/scenes/arena/card-art.ts:308-365`). The selected card is placed near bottom-centre at full scale; all others sit on a 700px-radius arc at 0.62 scale and 0.82 alpha (`packages/client/src/scenes/ArenaScene.ts:6830-6846`).

The live presentation is load-bearing in one important way: every frame, the card equations incorporate current attributes, requirement penalties, and the selected weapon's rarity/affix multiplier (`packages/client/src/scenes/ArenaScene.ts:6851-6878`). Requirements are recoloured from the live attributes, and thrown-weapon charges are refreshed from player state for the selected card (`packages/client/src/scenes/ArenaScene.ts:6880-6891`).

The so-called culling/depth guards are narrower than a redesign might assume:

- The early guard only handles “no room/no cards,” and the explicit visibility cull only hides the entire carousel in belt mode before handing off to the three-slot arsenal HUD (`packages/client/src/scenes/ArenaScene.ts:6815-6822`). Outside belt mode, every card still goes through the transform and live-text loop each frame (`packages/client/src/scenes/ArenaScene.ts:6824-6895`).
- The selection cache prevents repeated depth writes, but a change promotes the selected card to depth 100100 (`packages/client/src/scenes/ArenaScene.ts:6827-6829`; `packages/client/src/scenes/ArenaScene.ts:6847-6849`). That is above the level-window dim/panel/title stack at depths 100010–100012, so the current depth guard is a sort-churn optimization, not a complete UI-occlusion policy (`packages/client/src/scenes/ArenaScene.ts:4488-4525`).
- The belt path is already a different product: it replaces the fan with three 156×42 scaled chips and persistent click zones (`packages/client/src/scenes/ArenaScene.ts:6974-6990`; `packages/client/src/scenes/ArenaScene.ts:7023-7039`). The proposed L should not silently rewrite that three-slot/bag interaction model.

The art pipeline does not require new renders. A card background is cached by weapon id, prefers existing dedicated card art, falls back to the installed atlas frame or loose weapon texture, and finally falls back to a procedural dark ground (`packages/client/src/scenes/arena/card-art.ts:51-75`; `packages/client/src/scenes/arena/card-art.ts:77-126`). The new panel can reuse those cached textures, existing weapon sprites, and procedural frames/ticks.

## Attack 1 — bottom-right is prime aim space

This objection is **sustained**. The client deliberately captures raw DOM pointer movement because cursor motion is the aiming source (`packages/client/src/scenes/ArenaScene.ts:1407-1424`). The same pointer determines the local rig's aim (`packages/client/src/scenes/ArenaScene.ts:5524-5549`), RMB is the attack hold, and cursor-derived world coordinates are sent with the attack (`packages/client/src/scenes/ArenaScene.ts:5624-5632`; `packages/client/src/scenes/ArenaScene.ts:5654-5673`; `packages/client/src/scenes/ArenaScene.ts:5791-5802`). LMB is already the parry hold (`packages/client/src/scenes/ArenaScene.ts:5805-5818`).

Therefore a bottom-right panel that wakes on pointer proximity will flash precisely when a player aims down-right, and a clickable chip risks sharing an input gesture with parry or fire. The current card container is screen-pinned and depth-set but not made interactive; its update path changes transforms from weapon selection, not pointer state (`packages/client/src/scenes/arena/card-art.ts:368-373`; `packages/client/src/scenes/ArenaScene.ts:6827-6849`). Adding hover expansion would be new behavior, not a preservation requirement.

**Steelman.** The director is right about the larger spatial trade: a narrow rail on the extreme bottom and right edges can reclaim the bottom-centre playfield now occupied by a 212×296 selected card. Stable, upright chips also eliminate the fan's rotation and lateral spread.

**Verdict.** Bottom-right is acceptable only if the panel is presentation-only during live combat, pointer movement can never reveal or expand it, and the expanded inspector appears solely after explicit non-aim input.

## Attack 2 — 21 edge chips become illegible confetti

This objection is **sustained**. The active roster feeds one card per id into the carousel (`packages/client/src/scenes/ArenaScene.ts:6773-6777`; `packages/shared/src/weapons.ts:1264-1268`), but each card's useful identity currently depends on a 17px name, a 10px grip/family/element subtitle, 13px equations, and additional icon rows inside a 212px-wide surface (`packages/client/src/scenes/arena/card-art.ts:296-318`; `packages/client/src/scenes/arena/card-art.ts:322-365`). Scaling all of that into 21 simultaneous edge labels would preserve object count while destroying information.

**Steelman.** The mirrored L gives the roster a stable order and two clear directions. Shared wraparound helpers already define next/previous roster traversal (`packages/shared/src/weapons.ts:1273-1283`), so the two arms can express that order without a fan.

**Verdict.** Show at most the active core plus two previous and two next readable chips. Represent the full roster only with thin procedural index ticks and an `n / total` marker while the rail is awake. Do not render 21 names or 21 stat blocks at once. The rest are virtualized, not shrunk.

## Attack 3 — fading hides ammo and durability

This objection is **split**.

Ammo is load-bearing. The client refuses to animate/fire a gun or thrown weapon at zero charges (`packages/client/src/scenes/ArenaScene.ts:5630-5632`), while the authoritative server initializes the magazine/charges, decrements them on accepted attacks, and runs the reload/refill timers (`packages/server/src/rooms/GameRoom.ts:1926-1941`; `packages/server/src/rooms/GameRoom.ts:1949-1973`). Player charges and maximum charges are synchronized fields (`packages/shared/src/state.ts:71-73`).

But the carousel is not the only ammo display. The persistent equipped-weapon HUD already shows pips or a numeric magazine, changes to “reloading…” at zero, and turns amber/red at low/empty ammo (`packages/client/src/scenes/ArenaScene.ts:6634-6642`; `packages/client/src/scenes/ArenaScene.ts:6652-6672`). This means the arsenal navigator may fade only if that active identity/resource spine remains continuously readable.

Durability is not load-bearing today. The shared definition explicitly says depletion/break/repair is unbuilt display scaffolding (`packages/shared/src/weapons.ts:260-265`), and the carousel prints the static weapon-definition value rather than synchronized current durability (`packages/client/src/scenes/ArenaScene.ts:6886-6893`). Treating it like live ammo would misrepresent the current simulation.

**Verdict.** Never fade active ammo/reload state. Do not reserve permanent HUD prominence for static durability; when authoritative current durability actually exists, it inherits the same never-fade rule.

## Accepted contract

### Geometry and population

- The non-belt roster becomes two short, orthogonal, unrotated rails meeting at the bottom-right elbow. No fan and no card rotation.
- The elbow is the active core. It shows weapon silhouette/accent, concise weapon identity, and the active resource state. It stays inside an edge-safe inset and never grows merely because the pointer is nearby.
- The revealed rails show a five-item window: previous ×2, active, next ×2. The remaining roster is conveyed by procedural ticks plus position/total. All entries remain reachable through the existing cyclic order; virtualization changes presentation, not selection semantics.
- The full 212×296-style inspector may open inward/up-left only on an explicit inspect action. A Q/E selection change may wake the compact rails, but it must not automatically throw the full card into the aim lane. Arena mode already sends Q/E roster-cycle commands, and the scene exposes the resulting change through the cached selected index (`packages/client/src/scenes/ArenaScene.ts:2696-2699`; `packages/client/src/scenes/ArenaScene.ts:6824-6829`).
- Belt mode keeps its existing “hide carousel, update three-slot arsenal HUD” branch unless a separate belt-HUD redesign is approved (`packages/client/src/scenes/ArenaScene.ts:6817-6822`).

### What never fades

1. Active weapon identity, including rarity/affix treatment.
2. Current/max ammo or charge state, the empty/reloading state, and the low-ammo warning colour.
3. The active focus marker and enough cycle affordance to make previous/next direction unambiguous.
4. Future current/max durability, but only after it becomes authoritative gameplay state.

The active core has a hard idle alpha floor; critical resource text remains fully opaque. Neighbour chips, index ticks, decorative art, and stat detail may fade completely. “Fade away when not used” applies to browsing chrome, not to combat truth.

### Hover law

1. Pointer movement alone never wakes, selects, reorders, raises, or expands the panel.
2. Pointer proximity may only **reduce** the alpha of noncritical panel chrome; it may never increase alpha. Entering the bottom-right aim lane cannot cause a reveal flash.
3. During live combat, the panel has no interactive hit areas. Transparent or faded objects are also noninteractive. This avoids creating a pointerdown path that competes with RMB attack or LMB parry (`packages/client/src/scenes/ArenaScene.ts:5624-5632`; `packages/client/src/scenes/ArenaScene.ts:5808-5818`).
4. Full-card expansion requires explicit inspect intent. If clickable inspection is ever added, it is enabled only in a state that also gates combat input; hover remains cosmetic within that already-open state.
5. Fade transitions are eased, never snapped: explicit navigation may reveal the compact rails, hold them briefly, then return only the noncritical pieces to zero. A selection event—not cursor position—resets that timer.

### WYSIWYG and layering

The gamefeel audit already treats a visible position that trails authoritative resolution as a WYSIWYG failure (`docs/GAMEFEEL_AUDIT.md:94`). Resource and stat presentation deserves the same standard.

- The expanded active card must keep the live per-source equations, requirement state, and held rarity/affix multiplier. Shared combat math explicitly promises that the multiplier the server applies is the multiplier the card shows (`packages/shared/src/weapons.ts:393-411`), and the current update path formats those live totals (`packages/client/src/scenes/ArenaScene.ts:6859-6878`).
- Compact mode may omit equations; it must not show rounded, decorative, or stale substitutes. Omission is safer than a number that no longer equals the authoritative result.
- Reuse the existing baked card background/weapon fallback and procedural Graphics/Text. No new image rendering is part of this contract (`packages/client/src/scenes/arena/card-art.ts:51-126`; `packages/client/src/scenes/arena/card-art.ts:282-292`).
- Give dormant cards real visibility culling and skip their live-text work; do not rely on arc geometry to place most of them off-screen. Preserve the “write depth only when selection/layer state changes” discipline (`packages/client/src/scenes/ArenaScene.ts:6827-6829`; `packages/client/src/scenes/ArenaScene.ts:6847-6849`).
- Keep the carousel panel below modal UI or hide it while a modal is open. It must never repeat the current selected-card promotion above the level-window stack (`packages/client/src/scenes/ArenaScene.ts:4488-4525`; `packages/client/src/scenes/ArenaScene.ts:6847-6849`).

## Acceptance gates

- Park the cursor in the bottom-right quadrant while holding RMB: no chip wakes, expands, changes depth, or becomes more opaque; aiming and attack remain uninterrupted.
- Hold LMB over the panel footprint: parry remains the only live-combat meaning; no weapon selection fires.
- At zero ammo, the active core remains readable as reloading/empty even after every neighbour and decorative element has faded.
- Cycle continuously through the complete roster: order wraps correctly, only five readable chips exist at once, and no chip is rotated.
- Open the explicit inspector after levelling or equipping a rarity/affix item: every displayed equation still matches the live WYSIWYG calculation.
- Open the level-up/augment modal: the carousel is hidden or below the dim and choice cards.
- Enter belt mode: the three-slot arsenal/bag path still owns that HUD; the roster L does not appear.

**Final position:** ship the mirrored L as a quiet edge navigator, not as 21 tiny cards and not as a hover toy. The active combat truth is permanent; the browsing apparatus earns the right to disappear.
