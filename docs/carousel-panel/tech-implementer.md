# Technical implementer: mirrored-L weapon dock

## Recommendation

Replace the non-belt fan with a screen-pinned `┘` dock: the selected weapon sits at the bottom-right elbow, previous roster entries run left along a bottom-arm container, and next entries run up a right-arm container. Chips stay flat; no rotation, radial math, or overlapping cards. The dock wakes on actual weapon use, exposes the existing full infographic only during keyboard focus, and fades back to an almost invisible corner marker. This is a presentation refactor only: `PlayerState.weapon` remains the selected id, `WEAPON_IDS` remains the circular order, and the server remains the only authority that changes the held weapon (`packages/shared/src/state.ts:34-42`, `packages/shared/src/weapons.ts:1262-1283`, `packages/server/src/rooms/GameRoom.ts:655-667`).

Do not make the dock hoverable or clickable. Q/E is the focus path: a tap preserves its current command and wakes the rails; holding either key after that one `JustDown` reveals the detail card, and release returns to the timed peek. This avoids turning the bottom-right firing lane into a UI hit target.

## Current implementation map

| Concern | Current behavior | Refactor constraint |
|---|---|---|
| Construction | Scene creation calls `buildCarousel`, which eagerly calls `buildCard` for every active `WEAPON_IDS` entry (`packages/client/src/scenes/ArenaScene.ts:1447-1457`, `packages/client/src/scenes/ArenaScene.ts:6773-6777`). | Build one lightweight chip per roster id; build full detail cards lazily and cache them by id. |
| Card contract | A `Card` owns its container plus live damage-source texts, requirement-token texts, and resource text (`packages/client/src/scenes/arena/card-art.ts:13-23`). `buildCard` makes a 212x296 object tree and returns those handles (`packages/client/src/scenes/arena/card-art.ts:254-283`, `packages/client/src/scenes/arena/card-art.ts:308-373`). | Keep `Card` as the focused detail view. Add a separate `DockChip` type; do not shrink the full card tree and pretend it is a cheap chip. |
| Painted art | Preload queues only manifest-backed, non-expansion card JPGs (`packages/client/src/scenes/ArenaScene.ts:1037-1043`). `bakeCardArt` caches `cardbg-${id}`, clips to a rounded rectangle, cover-fits dedicated art, falls back to an atlas frame or loose sprite, and finally registers a canvas texture (`packages/client/src/scenes/arena/card-art.ts:51-70`, `packages/client/src/scenes/arena/card-art.ts:70-127`). | Reuse the same baked texture for chip thumbnails and full detail. Use crop/scale plus procedural frames; add no render dependency or new bitmap. |
| Selection | Every frame resolves `si` by finding authoritative `self.weapon` in `WEAPON_IDS`, clamping a miss to index 0, then computes a wrapped signed offset for every card (`packages/client/src/scenes/ArenaScene.ts:6824-6838`). | Keep the same circular order and wrap rule, but relayout only when the authoritative id changes. Represent a held non-roster id as an ephemeral elbow chip instead of falsely highlighting index 0. |
| Fan layout | Every card receives position, rotation, scale, and alpha writes on every call; the selected card is large and upright while the rest follow a 700px-radius arc (`packages/client/src/scenes/ArenaScene.ts:6830-6846`). | Replace the arc with two orthogonal arm containers and event-driven flat positions. |
| Depth guard | Depth changes are already guarded by `carouselDepthSelection`, so stable frames do not request display-list re-sorts (`packages/client/src/scenes/ArenaScene.ts:927-932`, `packages/client/src/scenes/ArenaScene.ts:6827-6849`). | Preserve the principle: fixed root/detail depth bands, arm-local child order, and depth writes only on selection/focus transitions. |
| Visibility guard | The belt branch checks the first card's visibility before hiding the full array, then delegates to the belt HUD (`packages/client/src/scenes/ArenaScene.ts:6815-6822`). There is no application-level idle/offscreen early-out inside the non-belt card loop; transforms and live texts are visited through the end of every card (`packages/client/src/scenes/ArenaScene.ts:6834-6895`). | Guard the dock root once. Capacity-cull far chips during layout and never visit them again until selection or viewport changes. |
| Live stats | For every card, every frame, the scene reconstructs attributes, recomputes requirement penalty and held loot multiplier, rewrites each source equation/color, recolors requirements, and rewrites charges/durability (`packages/client/src/scenes/ArenaScene.ts:6851-6894`). The card builder caps displayed damage sources at four (`packages/client/src/scenes/arena/card-art.ts:308-319`). | Move the math unchanged into one `refreshCardLive` helper; invoke it only for the visible detail card when its live-data signature changes. |
| Per-frame consumer | `ArenaScene.update` calls `updateCarousel` after the other HUD/run-window work on every frame (`packages/client/src/scenes/ArenaScene.ts:2782-2794`). | It may remain a cheap synchronization seam, but an idle call must perform no chip/card mutation. |
| Belt and bag | Belt mode already replaces the roster carousel with three active/stowed chips, persistent click zones, scrip/bag readout, and the bag panel (`packages/client/src/scenes/ArenaScene.ts:6974-7052`, `packages/client/src/scenes/ArenaScene.ts:7185-7244`). The shared player schema stores three slots, an active slot, and an overflow bag (`packages/shared/src/state.ts:116-128`). | Leave this branch intact in the first migration. The new dock is non-belt only. |

## Dock ownership and shape

Replace `carousel: Card[]` and `carouselDepthSelection` with one small controller record:

```ts
type CarouselDock = {
  root: Phaser.GameObjects.Container;
  bottomArm: Phaser.GameObjects.Container;
  rightArm: Phaser.GameObjects.Container;
  elbow: Phaser.GameObjects.Container;
  detailLayer: Phaser.GameObjects.Container;
  chips: Map<string, DockChip>;
  detailCards: Map<string, Card>;
  selectedId: string;
  selectedIndex: number;
  layoutSig: string;
  liveSig: string;
  state: "dormant" | "peek" | "focused" | "fading";
  fadeEvent?: Phaser.Time.TimerEvent;
  fadeTween?: Phaser.Tweens.Tween;
};
```

The root is `setScrollFactor(0)` like the present card containers (`packages/client/src/scenes/arena/card-art.ts:368-373`). Its children have distinct responsibilities:

- `bottomArm`: negative wrapped offsets, laid out leftward.
- `rightArm`: positive wrapped offsets, laid out upward.
- `elbow`: offset zero plus the persistent two-pixel corner marker.
- `detailLayer`: the selected full `Card`, visible only in `focused`.

Use the scene's CSS-space helpers, not camera buffer dimensions: `screenW/screenH` divide out `RENDER_DPR`, while `uiScale` supplies the existing clamped widescreen scale (`packages/client/src/scenes/ArenaScene.ts:1484-1497`). The resize listener already exposes the viewport-change seam (`packages/client/src/scenes/ArenaScene.ts:1447-1453`); add a dock relayout there or let the next update detect a changed `layoutSig`.

Let `m = 18*s`, `chipW = 92*s`, `chipH = 30*s`, `gap = 6*s`, and put the dock root at `(screenW()-m, screenH()-m)`. The local elbow center is `E = (-chipW/2, -chipH/2)`. Reuse the present wrapped `off` calculation exactly, then map it without rotation:

```text
off = 0: elbow     (E.x, E.y)
off < 0: bottomArm (E.x - abs(off) * (chipW + gap), E.y)
off > 0: rightArm  (E.x, E.y - abs(off) * (chipH + gap))
```

This keeps every rectangle inside the bottom/right safe margins and makes the selection direction legible: the same signed circular offset that currently drives fan angle drives arm membership instead (`packages/client/src/scenes/ArenaScene.ts:6834-6839`). For an even roster, retain the current strict `>`/`< -n/2` tie behavior so the exactly-opposite item does not jump arms unexpectedly (`packages/client/src/scenes/ArenaScene.ts:6835-6837`).

Compute arm capacities when laying out. Reserve the top HUD band and at least 240 scaled pixels at bottom-left; if both arms cannot contain the roster, hide the farthest absolute offsets and put a procedural `+N` chip at the rail end. Those hidden chips get one `setVisible(false)` during layout and no later work until selection/resize. Do not use masks: the current art is baked precisely because masks do not follow carousel container transforms cleanly (`packages/client/src/scenes/arena/card-art.ts:51-52`).

The focused 212x296 detail card should be scaled to at most `0.78*s` and anchored by its bottom-right corner immediately left of the vertical rail. Clamp it against the top and left safe margins. It may temporarily cover play space because focus is deliberate and short-lived; the dormant/peek states never show this large tree. The source card dimensions and lower tooltip slab are already authored in `buildCard` (`packages/client/src/scenes/arena/card-art.ts:254-285`).

## Fade and focus state machine

Use one timer and one root/arm tween, not per-chip tweens.

| State | Visual | Entry | Exit |
|---|---|---|---|
| `dormant` | Arms hidden; elbow marker/current chip at alpha 0.16; detail hidden. | Fade completes or scene starts idle. | Q/E use or an authoritative weapon-id change -> `peek`. |
| `peek` | Both rails and current chip at alpha 0.9; detail hidden. | Q/E `JustDown`, grab/equip patch, or focus release. Cancel any old timer/tween. | Either Q/E remains held for 220ms -> `focused`; 1100ms without use -> `fading`. |
| `focused` | Rails alpha 1; selected full detail visible and freshly dirtied. | Hold threshold fires. | Both Q and E up -> `peek`, with a fresh 900ms deadline. |
| `fading` | One 220ms ease on the arm containers toward zero and elbow toward 0.16. | Peek timer expires. | Tween completion -> `dormant`; any use cancels it -> `peek`. |

The keyboard focus hook belongs beside the current input routing, after `eFree` is known. E already grabs a nearby pickup and only cycles/browses when clear; that branch must remain exact (`packages/client/src/scenes/ArenaScene.ts:2669-2679`). In belt mode Q/E cycle non-empty slots and 1/2/3 select slots; in training Q/E pages the showroom; only ordinary arena sends `cycleWeapon` (`packages/client/src/scenes/ArenaScene.ts:2679-2700`). Therefore:

- call `dock.noteUse("Q" | "E")` only in the ordinary-arena cycle branch;
- do not wake/focus for an E press consumed by `grabWeapon`;
- still wake when the subsequent authoritative `self.weapon` changes, which covers grabs and dev equips;
- do not add key repeat: the existing `JustDown` must continue to emit exactly one server message per press.

The server cycle handler owns roster mutation, resets cycled weapons to Common/plain, and marks them conjured (`packages/server/src/rooms/GameRoom.ts:655-667`). The dock must never predict a different selected id; immediate Q/E feedback is only a wake animation, and the elbow changes when the state patch changes `self.weapon`.

### Why not hover or edge-dwell

Aim coordinates come from capture-phase raw DOM movement and are stored regardless of Phaser object interaction (`packages/client/src/scenes/ArenaScene.ts:1407-1425`). Local firing polls RMB-down continuously, then uses those pointer coordinates for the attack target (`packages/client/src/scenes/ArenaScene.ts:5620-5629`, `packages/client/src/scenes/ArenaScene.ts:5654-5661`). A bottom-right hover target would therefore sit in active aim space; clickable chips would also create ambiguity about whether a press means UI or combat. Keep every non-belt dock object non-interactive. If edge-dwell is ever offered as an accessibility option, require a narrow gutter, at least 450ms dwell, zero mouse buttons, and explicit opt-in; it is not the default interaction.

## Art and live-data migration

Add `buildDockChip(scene, id)` next to `buildCard`. It should contain only a cropped `cardbg-${id}` image, one procedural accent frame, one short name, and an optional Q/E direction glyph. `bakeCardArt` already returns early for an existing texture key, so a chip and a later detail card share the same canvas texture without rebaking (`packages/client/src/scenes/arena/card-art.ts:53-66`). The fallback resolves a weapon's installed sprite through the same `partTexture`/atlas path before trying a loose texture, so the chip does not need a second asset lookup system (`packages/client/src/scenes/arena/card-art.ts:70-76`, `packages/client/src/scenes/arena/card-art.ts:86-121`).

Extract the existing live-stat block verbatim into:

```ts
refreshCardLive(card: Card, def: WeaponDef | undefined, self: PlayerState): void
```

Preserve per-source grades, requirement penalty, held rarity/affix multiplier, decimal formatting, requirement colors, and live thrown charges (`packages/client/src/scenes/ArenaScene.ts:6851-6894`). This is part of WYSIWYG, not layout styling: the server applies effective stat/requirement scaling plus loot identity to held damage, and authoritative melee registers the resulting edge damage on the shared `SwingDescriptor` (`packages/server/src/rooms/GameRoom.ts:1162-1174`, `packages/server/src/rooms/GameRoom.ts:2232-2261`). The shared descriptor owns effective cooldown, pose/active/impact times, while shared helpers derive the active edge clock (`packages/shared/src/melee.ts:609-626`, `packages/shared/src/melee.ts:656-706`, `packages/shared/src/melee.ts:740-761`). The dock refactor must not touch `SpriteRig`, melee timing, server damage, or weapon definitions.

Only refresh the visible detail when this signature changes:

```text
weapon | rarity | affix | charges | str | dex | int | con | luk
```

Selection changes always dirty it. Attribute changes dirty equations and requirements; loot identity dirties the held multiplier/color; charges dirties the resource line. Static durability needs no frame polling. Chips contain no live stat text.

There is one identity edge case worth fixing during migration. `WEAPON_IDS` deliberately excludes fists and expansion weapons (`packages/shared/src/weapons.ts:1262-1270`), while the training gallery includes the active roster plus expansion ids (`packages/server/src/rooms/GameRoom.ts:1278-1295`). The current `Math.max(0, indexOf(...))` displays roster index 0 when the held id is absent (`packages/client/src/scenes/ArenaScene.ts:6824-6829`). Keep `selectedId = self.weapon`; when `selectedIndex === -1`, create/reuse a temporary elbow chip and focused detail for that valid `WEAPONS` id, leave the two roster arms in canonical order, and let the next normal cycle return through the existing server rule. That prevents the UI from showing a different weapon than the rig/server is using.

## Idle performance contract

An unchanged, dormant frame may read `self` and compare two short signatures. It must make zero calls on any chip/card to `setPosition`, `setRotation`, `setScale`, `setAlpha`, `setDepth`, `setVisible`, `setText`, `setColor`, `Graphics.clear`, or `bakeCardArt`.

Work is bounded by events:

- selection change: O(roster) reparent/position/visibility pass, one elbow/detail swap, one depth/order update;
- viewport change: O(roster) capacity and position pass;
- focus entry or live signature change while focused: O(displayed sources + requirements) text refresh;
- fade: one timer and at most two container tweens, independent of roster size;
- belt: retain the current one-time carousel-hide guard before the existing arsenal HUD path (`packages/client/src/scenes/ArenaScene.ts:6815-6822`).

The current eager path creates a full image, multiple graphics, many texts, and high-DPI text resolution for every roster card (`packages/client/src/scenes/arena/card-art.ts:282-370`). Lazy full-card construction removes those idle display objects without discarding the cached painted textures.

## Q/E, belt, bag, and drop-bar migration

No server message names or payloads change. Ordinary arena continues to send `cycleWeapon {dir}`, belt continues to send `cycleSlot`/`swapSlot`, and training continues to send `galleryPage` (`packages/client/src/scenes/ArenaScene.ts:2679-2700`). Their authoritative handlers already separate full-roster cycling from non-empty three-slot cycling (`packages/server/src/rooms/GameRoom.ts:655-667`, `packages/server/src/rooms/GameRoom.ts:690-718`).

Tab remains untouched. It toggles the bag only in belt mode and otherwise owns the training summon menu (`packages/client/src/scenes/ArenaScene.ts:2710-2719`). Slot/bag clicks continue to send `swapSlot`, `bagStore`, and `bagEquip` from their existing persistent zones (`packages/client/src/scenes/ArenaScene.ts:7023-7039`, `packages/client/src/scenes/ArenaScene.ts:7220-7235`); server stash/equip preserves rarity, affix, and earned provenance (`packages/server/src/rooms/GameRoom.ts:720-760`).

Keep the R hold/salvage bar centered and independent of the dock. It is transient action feedback, currently placed at screen center and hidden when not holding (`packages/client/src/scenes/ArenaScene.ts:6779-6810`); moving it into the bottom-right rail would make the aim-space problem worse and couple it to dock fade.

## Build order

1. **Characterize before moving.** Add pure tests for wrapped offset behavior, the even-roster tie, unknown selected ids, arm capacity, and viewport-safe positions. Record the current equations/colors/resources from `updateCarousel` as fixtures (`packages/client/src/scenes/ArenaScene.ts:6824-6894`).
2. **Extract live refresh.** Move the stat mutation block into `refreshCardLive` with no formula or color changes. Continue calling it from the current fan until parity is verified.
3. **Add lightweight chips.** Implement `DockChip` and `buildDockChip` beside `buildCard`, consuming `bakeCardArt` and `WEAPON_ACCENT`; leave the full `Card` API intact (`packages/client/src/scenes/arena/card-art.ts:13-27`, `packages/client/src/scenes/arena/card-art.ts:51-127`).
4. **Build the four-layer dock.** Replace eager full-card construction with root/bottom/right/elbow/detail containers, implement the `┘` math, capacity culling, unknown-id elbow, and resize invalidation. No fade yet.
5. **Make updates dirty-driven.** Replace the per-card hot loop with selection/layout/live signatures. Assert with instrumentation that a dormant frame performs zero game-object mutations.
6. **Add focus/fade.** Wire ordinary-arena Q/E use after `eFree`, add hold-to-focus and the single timer/tween state machine, then verify interruption at every transition.
7. **Protect alternate modes.** Keep the belt early return and existing arsenal/bag renderer; verify training gallery paging and E-near-pickup behavior before removing the old `carousel` fields.
8. **Remove the fan.** Delete arc constants, rotation/scale writes, and `carouselDepthSelection` only after the dock owns selection ordering and fixed depth bands.

## Acceptance checks

- At 1280x720, 1600x900, ultrawide, and 4K/DPR-scaled viewports, no chip crosses the right or bottom edge; far chips cull deterministically, and resize causes one relayout. The scene's UI coordinates are CSS-space rather than raw camera-buffer space (`packages/client/src/scenes/ArenaScene.ts:1484-1497`).
- In ordinary arena, Q and free E send one cycle command, wake the dock immediately, and move the elbow only on the authoritative weapon patch; E beside a pickup grabs and does not browse/focus (`packages/client/src/scenes/ArenaScene.ts:2669-2700`).
- In belt, Q/E and 1/2/3 still select slots, Tab still opens the bag, and all existing slot/bag click zones remain active (`packages/client/src/scenes/ArenaScene.ts:2679-2690`, `packages/client/src/scenes/ArenaScene.ts:2710-2719`, `packages/client/src/scenes/ArenaScene.ts:7023-7039`).
- Holding Q/E exposes one full selected card; releasing it peeks, idling fades it, and a new use cleanly cancels an in-flight fade. No dock object has an input hit area.
- Attribute, rarity, affix, and charge changes update the focused card once and retain the present WYSIWYG equations/colors (`packages/client/src/scenes/ArenaScene.ts:6851-6894`).
- A held expansion weapon in training displays its own chip/detail rather than Rusty Cleaver; normal roster order remains `WEAPON_IDS` (`packages/shared/src/weapons.ts:1264-1283`, `packages/server/src/rooms/GameRoom.ts:1278-1310`).
- A performance capture over ten dormant seconds shows no per-chip transforms, text writes, graphics clears, depth changes, or art bakes; only a root/container tween is active during fade.

