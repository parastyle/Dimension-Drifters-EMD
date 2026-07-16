# Weapon Dock — Senior UI/UX Design Specification

## Decision

Replace the bottom-centre fan with a screen-edge `┘`: a horizontal rail running left from the bottom-right corner and a vertical rail running up the right edge. Every resting chip is axis-aligned. The authoritative active weapon occupies the enlarged corner junction; Q/forward choices live above it and E/back choices live to its left.

The dock is a quiet navigator, not a second inventory screen. It wakes at full opacity when the player cycles, grabs, drops, or deliberately hovers it, then returns to a low-alpha edge watermark. A single focused chip may unfold diagonally inward into the existing full card (`packages/client/src/scenes/arena/card-art.ts:254-373`). Nothing fans, nothing rests at an angle, and no automatic event throws a full card over combat.

This redesign is for the non-belt roster. Belt play already replaces the carousel with a distinct three-slot arsenal and bag model; its branch hides the carousel before updating that HUD, and its three chips are 156×42 at the current HUD scale (`packages/client/src/scenes/ArenaScene.ts:6815-6822`, `packages/client/src/scenes/ArenaScene.ts:6974-7039`). Preserve that product boundary.

## What is being replaced

The scene currently constructs a full card for every `WEAPON_IDS` entry, while the shared roster omits fists and weapons still flagged as expansion content (`packages/client/src/scenes/ArenaScene.ts:6773-6777`, `packages/shared/src/weapons.ts:1262-1270`). Each card is natively 212×296; painted art occupies the top 34%, and the lower slab contains name, subtitle, as many as four damage equations, scaling grades, requirements, and a resource readout (`packages/client/src/scenes/arena/card-art.ts:254-365`).

The selected card presently sits at `screenH - 170` near horizontal centre, full scale and shifted upward another 24 px. Other cards are 0.62 scale, 0.82 alpha, rotated around a 700 px-radius arc in 0.26-radian steps (`packages/client/src/scenes/ArenaScene.ts:6830-6846`). `updateCarousel()` is called every scene frame, and outside belt mode every card passes through transforms and live stat/resource updates on that path (`packages/client/src/scenes/ArenaScene.ts:2784-2794`, `packages/client/src/scenes/ArenaScene.ts:6815-6895`). This is the obstruction the dock removes.

The existing optimizations are narrower than a real dock needs. A cached selection avoids redundant depth writes, but a selection change promotes the active card to depth 100100; that is above the level-window dim and panel stack beginning at 100010 (`packages/client/src/scenes/ArenaScene.ts:6827-6849`, `packages/client/src/scenes/ArenaScene.ts:4481-4525`). Belt mode has an explicit visibility guard, but non-belt cards are not visibility-culled before their live update loop (`packages/client/src/scenes/ArenaScene.ts:6815-6823`, `packages/client/src/scenes/ArenaScene.ts:6834-6895`).

## Experience contract

1. **The corner is truth.** Its content changes only when synced `self.weapon` changes. A key press may wake the dock immediately, but it may not falsely install the predicted next weapon.
2. **The rails express the ring.** Q/forward travels up the right arm; E/back travels left along the bottom arm. The shared helpers already define wraparound next/previous order, while the server authoritatively applies the direction and resets a cycled weapon to plain Common (`packages/shared/src/weapons.ts:1273-1283`, `packages/server/src/rooms/GameRoom.ts:655-667`).
3. **Rest is compact.** Chips identify order and silhouette; they do not miniaturize equations into illegibility.
4. **Focus is deliberate.** Hover dwell or a held cycle key unfolds one full card inward. A tap, pickup, or drop wakes the compact dock but does not auto-expand it.
5. **Idle means translucent, not absent.** The junction remains locatable at an alpha floor, while the persistent bottom-left weapon line continues to carry held identity and live ammo/reload state (`packages/client/src/scenes/ArenaScene.ts:6633-6672`).
6. **Fists are honest.** Because fists are excluded from `WEAPON_IDS`, the current `Math.max(0, indexOf(...))` fallback can visually select roster item zero when the player is unarmed (`packages/shared/src/weapons.ts:1262-1268`, `packages/client/src/scenes/ArenaScene.ts:6824-6829`). The new junction must instead show an explicit `EMPTY HANDS` chip whenever `self.weapon === FISTS_WEAPON`; neither rail order nor roster count changes.

## Coordinate system and anchor

All dimensions below are authored in CSS pixels. The scene already derives screen-space UI dimensions by dividing the DPR-scaled camera viewport by `RENDER_DPR`; use the same `screenW()` / `screenH()` coordinate space (`packages/client/src/scenes/ArenaScene.ts:1484-1491`).

Define:

```text
W = screenW()
H = screenH()
d = clamp(min(W / 1600, H / 900), 0.78, 1.25)
R = max(platformSafeRight, 8d)
B = max(platformSafeBottom, 8d)
```

`d` is intentionally capped below the main HUD's 2.1 maximum so an ultrawide/4K dock remains peripheral; the existing general HUD scale is width-based and clamped to `[1, 2.1]` (`packages/client/src/scenes/ArenaScene.ts:1493-1498`). If no platform safe-area value is available, use zero for that term, leaving the 8d visual gutter.

For active-junction side `A`, its rect is exactly:

```text
cornerLeft = W - R - A
cornerTop  = H - B - A
cornerRect = [cornerLeft, cornerTop, A, A]
```

The active chip is therefore flush to the safe bottom and right edges. Its shadow and focus expansion project only inward/up-left; no pixels bleed beyond safe bounds.

```text
                         RIGHT SAFE EDGE
                    ┌──────────────┐
                    │ Q +3         │
                    ├──────────────┤
       focus card   │ Q +2         │
       unfolds      ├──────────────┤
       up-left  ←   │ Q +1         │
                    ├──────────────┤
… [E -3] [E -2] [E -1] [ ACTIVE ] │
────────────────────────────────────┘ BOTTOM SAFE EDGE
```

This is a rectilinear rail, not a curve: Q feeds the junction from above; E feeds it from the left.

## Exact population and geometry

Let `n` be the current non-belt roster count, excluding the temporary fists junction. Let index zero below mean the active roster index.

```text
qCount = ceil((n - 1) / 2)   // positive offsets; right arm; Q/forward
eCount = floor((n - 1) / 2)  // negative offsets; bottom arm; E/back
```

For an even roster, the single antipodal weapon belongs to the Q arm. This makes every weapon's arm assignment deterministic.

Use the following pre-`d` dimensions:

| Roster count | Junction `A` | Bottom chip `w×h` | Right chip `w×h` | Gap `g` | Resting chip content |
|---:|---:|---:|---:|---:|---|
| 3–7 | 84 | 64×44 | 44×64 | 6 | art, short name, order pip |
| 8–13 | 76 | 54×38 | 38×54 | 4 | art, 8-char ellipsis, order pip |
| 14–21 | 68 | 44×32 | 32×44 | 3 | art/silhouette and order pip only |

Multiply every numeric value in the table by `d`, then round positions and sizes to the nearest half CSS pixel. Resting rotation is exactly `0` for every chip.

For E/back offset `k = 1..eCount`, using the bottom-chip dimensions:

```text
x = cornerLeft - k(w + g)
y = H - B - h
```

For Q/forward offset `k = 1..qCount`, using the right-chip dimensions:

```text
x = W - R - w
y = cornerTop - k(h + g)
```

The first E chip is one gap left of the junction; the first Q chip is one gap above it. Put a procedural `E` tab on the inner end of the bottom rail and a `Q` tab on the inner end of the right rail. In awake state, add `activeIndex + 1 / n` in 10d px type inside the junction's upper-left corner.

### Junction anatomy

The junction uses the current weapon's painted crop or sprite fallback as a full-bleed background, a 24d px dark paper footer, a two-line maximum name at 11d px, and a top-left resource badge at 11d px. The badge shows live `charges / maxCharges`, `RELOAD`, or nothing; it never invents durability state. Charges and maximum charges are synchronized fields, whereas the existing card's durability branch prints the static weapon-definition value (`packages/shared/src/state.ts:71-79`, `packages/client/src/scenes/ArenaScene.ts:6886-6893`).

Rarity/affix identity controls the junction border and footer label. Current state explicitly synchronizes that loot identity because it changes authoritative damage/cooldown and the card is expected to show the same result (`packages/shared/src/state.ts:74-79`). When unarmed, use a procedural folded-glove silhouette, warm-grey border, `EMPTY HANDS`, and no resource badge.

### Fit and overflow

Compute exclusion limits before laying out rails:

```text
leftStop = max(16d, bottomLeftHudUnion.right + 16d)
topStop  = max(56d, restartButtonBounds.bottom + 12d)
```

The bottom-left union includes HP, XP, level, weapon, and augment bounds. That HUD starts at `20s`, uses 240s-wide HP/XP bars, and stacks its text in the lower 81s of the viewport (`packages/client/src/scenes/ArenaScene.ts:1503-1513`, `packages/client/src/scenes/ArenaScene.ts:6578-6583`, `packages/client/src/scenes/ArenaScene.ts:6615-6689`). The top stop measures the live restart control, which is anchored at `W - 14s, 14s` (`packages/client/src/scenes/ArenaScene.ts:6566-6576`, `packages/client/src/scenes/ArenaScene.ts:6633`).

First, scale only the passive chips and gaps by this fit multiplier:

```text
fit = min(
  1,
  (cornerLeft - leftStop) / max(1, eCount(w + g)),
  (cornerTop - topStop)   / max(1, qCount(h + g))
)
```

Clamp `fit` no lower than `0.74`. If the rails still cross an exclusion boundary, render the maximum nearest chips that fit and replace the farthest visible position on that arm with a procedural `+N` overflow chip. The overflow chip is not selectable; cycling rotates hidden entries toward the junction. Thus 3–21 weapons always remain navigable, while a sub-960×540 window may show a bounded window instead of unreadable confetti.

At 1600×900, all 21 fit simultaneously under the 14–21 tier. Validate the edge cases at counts 3, 7, 8, 13, 14, and 21.

## Wake, fade, and focus state machine

Use one normalized fade progress plus a separate focus-panel alpha. Derive the junction, rail, and tab alphas from that shared progress; do not run independent tweens on 21 containers.

### Wake events

Set `lastDockActivity = now`, cancel the idle fade, and animate root alpha to 1 on:

- Q or free-E `JustDown` immediately;
- R/E grab intent immediately, then again on authoritative held-weapon confirmation;
- authoritative `weapon:rarity:affix` change, including pickup, cycle, swap, drop, or salvage;
- pointer dwell over an actual chip/focus rect, subject to the hover safety law below;
- pointer movement inside an already-open focus card;
- pickup/drop flight start and completion.

The client already sends Q/E cycle messages from edge-triggered key input and treats E as grab when a pickup is near, so the dock can wake at the same decision points without changing selection semantics (`packages/client/src/scenes/ArenaScene.ts:2669-2700`). A held-loot fingerprint of `weapon:rarity:affix` also already exists for reveal feedback and can supply the authoritative visual-change edge (`packages/client/src/scenes/ArenaScene.ts:6301-6323`).

### Exact fade

| Phase | Timing | Target opacity | Curve |
|---|---:|---:|---|
| Wake-in | 120 ms | shared progress current → 1.00 | `1 - (1-t)^3` |
| Awake hold | 2400 ms after last activity | all dock categories 1.00 | constant |
| Idle fade | 650 ms | shared progress 1.00 → 0.00 | `smoothstep(t) = t²(3-2t)` |
| Idle junction floor | after fade | junction overlay 0.30; art 0.18 | constant |
| Idle passive rail | after fade | 0.10 | constant |
| Idle Q/E tabs | after fade | 0.18 | constant |

The root remains at 1 while focused, while a valid hover is held, or while a pickup/drop flight is active. Focus exit restarts the 2400 ms hold; it does not jump directly to idle. A new wake event during fade reverses from the current alpha over at most 120 ms.

### Hover safety law

Raw DOM pointer movement is the aim source, RMB is the attack hold, and LMB is the parry hold (`packages/client/src/scenes/ArenaScene.ts:1407-1434`, `packages/client/src/scenes/ArenaScene.ts:5622-5632`, `packages/client/src/scenes/ArenaScene.ts:5808-5818`). Therefore “hover” means deliberate rest, not merely crossing the bottom-right aim lane:

1. The pointer must remain inside a chip's real rectangular hit area for 160 ms.
2. Pointer travel during that dwell must be ≤4 CSS px.
3. Neither left nor right mouse button may be down.
4. Any mouse-button down immediately collapses focus in 80 ms and suspends hover wake until all buttons are up.
5. Chips have no `pointerdown` weapon-selection behavior in live combat. Hover/focus is presentational, so parry and fire retain their meanings.

On a valid dwell, wake to full opacity and focus that chip. Crossing a translucent rail while aiming does nothing. Hit areas are disabled for culled/overflow chips and while a modal owns input.

For keyboard inspection, holding the Q or E key for 320 ms after its one cycle action expands the now-authoritative active card; release collapses it. Tapping Q/E never auto-expands.

## Focus expansion

The focused chip unfolds diagonally into the free interior above-left of the junction. Reuse the native 212×296 card, scaled by:

```text
f = clamp(d, 0.82, 1.00)
focusW = 212f
focusH = 296f
focusRight  = cornerLeft - 12d
focusBottom = cornerTop  - 12d
focusX = focusRight  - focusW
focusY = focusBottom - focusH
```

If that rect intersects the bottom-left HUD union, the centre-bottom drop bar exclusion, or the viewport top, reduce `f` to 0.74. If it still cannot fit, hide the passive rails while focused and present a 184×232 compact inspector containing art, name, the same individual source rows, requirements, and resource. Never merge sources into a decorative score, clip a row, or shrink text below 10 CSS px.

The current full card already owns the correct information architecture and live handles: one text object per damage source, recolourable requirement tokens, and a resource text (`packages/client/src/scenes/arena/card-art.ts:13-23`, `packages/client/src/scenes/arena/card-art.ts:308-373`). Preserve it rather than redesigning the stat language.

Expansion timing is 190 ms:

```text
0–65 ms    hinge lift: scaleY 1.00→1.06, inward shadow 0→8d, rotation 0→-2.5°
65–160 ms  unfold/morph to focus rect with cubic-out position and scale
160–190 ms settle rotation -2.5°→0°, scale 1.02→1.00 with smoothstep
```

Collapse reverses position/scale in 150 ms without overshoot. Only transitional rotation is allowed; the focused card rests at `0°`.

For the active weapon, the inspector shows live player attributes, requirement penalty, held rarity/affix multiplier, and current charges. The current carousel computes those exact per-source totals and colours unmet requirements from live attributes (`packages/client/src/scenes/ArenaScene.ts:6851-6889`). For a passive roster weapon, label the inspector `BASE PREVIEW`, use current attributes and requirement penalty, but apply loot multiplier `1` and default charges. This prevents the current held item's rarity from leaking into an unequipped preview.

## Selection motion along the L

Use axis motion, never an arc.

### Q / forward

After the authoritative weapon patch:

- the nearest right-arm chip descends into the junction;
- the old junction moves left into E/back offset 1;
- the remaining right chips move down one slot;
- the remaining bottom chips move left one slot;
- the far wrap chip enters at the appropriate rail endpoint.

### E / back

After the authoritative weapon patch:

- the nearest bottom-arm chip moves right into the junction;
- the old junction moves up into Q/forward offset 1;
- the other chips advance one straight slot in the reverse direction.

Both transitions last 180 ms, use cubic-out translation, and hold rotation at zero. On keydown but before the patch, send a 2d-wide accent “seam” 18d toward the junction over 120 ms; do not move weapon art or change the corner label. If no state change arrives within 500 ms, the seam retracts. This communicates acknowledged intent without presenting an unaccepted weapon as equipped.

## Pickup, swap, and drop flows

These motions must follow authoritative state. The client chooses the nearest in-range pickup and sends `grabWeapon`; the server independently rejects grace-period pickups, resolves the nearest valid one, reveals hidden identity, swaps the held weapon out in non-belt play, and deletes consumed `drop*` pickups (`packages/client/src/scenes/ArenaScene.ts:2614-2637`, `packages/server/src/rooms/GameRoom.ts:850-907`). Do not launch a triumphant dock flight solely from keydown.

Record a local pending grab candidate `{pickupId, screenX, screenY, publicWeapon, sentAt}` on R/E intent. Confirm it only when the local player's synced held fingerprint changes consistently within 650 ms. If another player takes it, grace rejects it, or correlation is ambiguous, retain the ordinary world removal and wake the dock without a false flight.

### Confirmed pickup: world → junction

Create one screen-space paper token from the existing painted card crop or weapon sprite fallback (`packages/client/src/scenes/arena/card-art.ts:70-126`):

| Segment | Time | Motion |
|---|---:|---|
| Pinch | 0–90 ms | at pickup screen position; `scaleX 1→0.16`, `scaleY 1→0.92` |
| Flight | 90–390 ms | cubic Bézier `P0=source`, `P1=P0+(0,-64d)`, `P2=cornerCenter+(-120d,-72d)`, `P3=cornerCenter`; scale to 0.62 |
| Slot | 390–470 ms | token disappears under junction footer; junction `scaleY 0.94→1.04→1` |

Use a ±3° deterministic paper cant based on pickup id during flight, returning to zero at the slot. The dock stays at alpha 1 through `t=470 ms` and starts its 2400 ms hold at completion. The current pickup-removal path already folds visible pickup art over 120 ms and skips that embellishment off-screen, under reduced motion, or over budget; coordinate with it rather than stacking a second world fold (`packages/client/src/scenes/ArenaScene.ts:1889-1925`, `packages/client/src/scenes/ArenaScene.ts:1956-1991`).

### Confirmed drop: junction → world

The server spawns the held weapon in front of the player with the same weapon, rarity, and affix, applies re-grab grace, then sets the player to fists (`packages/server/src/rooms/GameRoom.ts:1057-1084`). On the patch that contains both the new `drop*` pickup and the local held-state change:

| Segment | Time | Motion |
|---|---:|---|
| Eject | 0–80 ms | duplicate thumbnail slides 16d inward from the junction; corner footer tears open procedurally |
| Flight | 80–330 ms | Bézier `P0=cornerCenter`, `P1=P0+(-110d,-52d)`, `P2=end+(0,-70d)`, `P3=end`; scale 0.62→1 |
| Land | 330–410 ms | token `scaleY 0.88→1.06→1`; hand-off to the world pickup's existing spawn treatment |

If the destination is off-screen, omit the flight: play the 120 ms corner tear and let the off-screen world state stand. A salvage confirmation uses the same corner tear but dissolves into three procedural paper fibres over 220 ms; it does not fabricate a floor pickup because the server consumes the weapon and returns fists (`packages/server/src/rooms/GameRoom.ts:833-848`).

### Grab while already armed

This is a two-token swap because the server drops the old weapon before installing the grabbed one (`packages/server/src/rooms/GameRoom.ts:887-900`). Start outgoing corner→world at `t=0`; start incoming world→corner at `t=90 ms`; change junction art at `t=300 ms`; settle both by `t=520 ms`. Outgoing uses the old loot border, incoming uses the new revealed rarity. Cap concurrent dock flights at two and coalesce any later state change to the final authoritative junction.

## Paper-craft presentation

No new raster render is required. Bespoke card images are preloaded only when they exist; other weapons already fall back to their installed atlas frame, loose runtime texture, or a dark procedural ground (`packages/client/src/scenes/ArenaScene.ts:1037-1043`, `packages/client/src/scenes/arena/card-art.ts:51-127`). The bake is cached by `cardbg-${id}`, so focus and chip crops should share it (`packages/client/src/scenes/arena/card-art.ts:53-61`).

Use the following procedural treatment:

- rail backing: `#090805`, alpha 0.72 awake / 0.08 idle, 1d px warm edge `#cfc6ae` at 0.28;
- chip footer: `#0a0805`, alpha 0.90;
- chip outline: 1d px weapon accent; junction outline: 3d px rarity colour, falling back to weapon accent;
- inward shadow: black, alpha 0.32, offset `-4d,-4d`, blur-equivalent rendered as three stepped translucent rects (no shader dependency);
- paper rim: 1d px `#f1e8cf` at 0.24 on the inward/top edges only;
- hinge/crease: one procedural 1d px line, light on the inward side and dark on the edge side;
- awake chips retain full object alpha; hierarchy comes from footer coverage and border weight, not arbitrary translucency;
- no additive glow, glass blur, elastic bob, or continuous idle motion.

Use the existing per-weapon accent map and its warm fallback, but let actual held rarity win on the active junction (`packages/client/src/scenes/arena/card-art.ts:25-39`, `packages/client/src/scenes/arena/card-art.ts:256-263`). Painted art remains the hero; procedural paper merely frames and folds it.

For reduced motion, honor the existing media-query check: snap selection geometry on the authoritative patch, replace pickup/drop travel with an 80 ms crossfade at source and destination, and remove rotation/overshoot (`packages/client/src/scenes/ArenaScene.ts:198-202`). Fade timing and information hierarchy remain intact.

## Safe areas, arrows, modals, and depth

### Existing HUD exclusions

- Do not move or cover the bottom-left health/XP/weapon/augment stack; measure its live bounds, because weapon and augment strings can exceed the 240s bar width (`packages/client/src/scenes/ArenaScene.ts:6578-6583`, `packages/client/src/scenes/ArenaScene.ts:6615-6689`).
- Preserve the centre-bottom salvage bar exclusion `[W/2 - 94, H - 150, 188, 38]`. Its current bar is 180×12 at `H - 132`, with a label 12 px above (`packages/client/src/scenes/ArenaScene.ts:6779-6810`).
- Preserve the top-right restart bounds plus 12d clearance (`packages/client/src/scenes/ArenaScene.ts:1569-1581`, `packages/client/src/scenes/ArenaScene.ts:6633`).

### Edge locators

Portal/rift locators currently clamp to a 46 px edge pad at depth 99997, which places them directly in the proposed rail corridor and under screen HUD layers (`packages/client/src/scenes/ArenaScene.ts:5943-6006`). Treat the occupied bottom and right rail segments as exclusion intervals. If an arrow lands inside one, slide it along the same edge to the nearest free point with 16d clearance; if both adjacent edge intervals are blocked, prefer the top edge over covering the active junction. Direction remains computed from the real bearing; only the final edge anchor is displaced.

### Modal policy and depth bands

Use these fixed bands:

```text
100004  rail backing and paper shadows
100005  passive chips and Q/E tabs
100006  active junction
100007  pickup/drop flight tokens
100008  focus card
100009  focus hit zone / connector crease
100010+ existing modal dim, panels, and choices
```

On `flexPending > 0`, `sigPending > 0`, summon modal open, death terminal overlay, or any future input-owning modal: collapse focus, disable dock hit areas, and set the compact dock to idle alpha in 80 ms. The current level shell starts with an interactive full-screen dim at 100010 and builds its panel/text above it (`packages/client/src/scenes/ArenaScene.ts:4431-4459`, `packages/client/src/scenes/ArenaScene.ts:4481-4525`). The dock must never repeat the current active card's 100100 promotion.

The paper-world snapshot already uses a curated list of floor, rigs, pickups, projectiles, zones, portal, and rift, then camera-culls that world-only set; HUD is intentionally excluded (`packages/client/src/scenes/ArenaScene.ts:2057-2076`). Keep the dock and its flight tokens screen-pinned and out of that capture list.

## Rendering and update budget

Replace `Card[]` as the resting presentation with lightweight `DockChip[]`. A chip needs one clipped image, one procedural frame/footer, at most one short text, and one hit rectangle. Keep only one visible full `Card` inspector.

Required invalidation signatures:

```text
layoutSig = W:H:d:n:activeIndex:leftStop:topStop:modal:belt
statSig   = focusId:str:dex:int:con:luk:weapon:rarity:affix:charges:maxCharges
alphaSig  = dockState:lastDockActivity:hoverId:flightCount
```

- Recompute chip positions/visibility only when `layoutSig` changes or during the 180 ms selection transition.
- Recompute full-card equations only when `statSig` changes. Do not rewrite every weapon's equations every frame as the current loop does (`packages/client/src/scenes/ArenaScene.ts:6851-6895`).
- Change depths only on selection, focus, modal, or flight-count edges; preserve the current intent behind selection-cached depth writes (`packages/client/src/scenes/ArenaScene.ts:6827-6849`).
- Set culled/overflow chips `visible=false` and disable their hit areas.
- In belt mode, hide the dock root once and hand off to the existing arsenal HUD.
- Lazily construct the full inspector on first focus. Keep at most three hidden inspector containers in an LRU cache; the baked art texture may remain cached because `bakeCardArt()` already returns early when its key exists (`packages/client/src/scenes/arena/card-art.ts:53-61`).

Stable idle frames should perform no chip transforms, no depth writes, and no stat-text writes. Only the root alpha interpolates during the 120/650 ms fade windows.

## WYSIWYG rules

The shared melee doctrine defines visible blade contact as the actual tight swept hit region, and the shared `SwingDescriptor` carries the accepted/predicted pose, active, and impact clock (`packages/shared/src/melee.ts:7-12`, `packages/shared/src/melee.ts:609-626`). The dock follows the same broader rule: presentation may omit detail, but it may not claim false gameplay state.

- The junction equals synced `self.weapon`; predicted navigation is only a seam (`packages/shared/src/state.ts:25-35`).
- Active focus uses the same damage-source, grade, requirement-penalty, rarity, and affix math as combat. Never substitute a rounded decorative “power” score.
- Passive focus is explicitly marked `BASE PREVIEW` and never inherits active loot.
- Current charges and reload are live; static durability is labelled `BASE DURABILITY`, never implied to be a depleting synchronized meter.
- Pickup/drop flights require authoritative confirmation. Ambiguity resolves to no flight, not a persuasive lie.
- Compact chips omit stats. Omission is honest; stale numbers are not.

## Acceptance gates

1. **Geometry:** at 1600×900 and counts 3, 7, 8, 13, 14, and 21, all resting chips are unrotated, edge-flush, non-overlapping, and active is exactly at the bottom-right junction.
2. **Responsive:** at 1280×720, 960×540, 3440×1440, and DPR 1/1.5/2, no rail crosses the measured bottom-left HUD or restart exclusions. Below fit, a correct `+N` chip appears.
3. **Fade:** after 2400 ms idle the dock begins a 650 ms smoothstep to the specified alpha floors; Q/E, grab/drop, or qualified hover returns it to full opacity within 120 ms.
4. **Aim safety:** move or hold the cursor over the dock while RMB fires or LMB parries. No hover wake, focus, selection, or input interception occurs. Release both buttons and dwell 160 ms; the intended chip wakes and unfolds.
5. **Keyboard focus:** tap Q/E and only the compact rails wake. Hold 320 ms and the authoritative active card expands; release and it collapses.
6. **Authority:** inject 500 ms simulated RTT. The intent seam may wait, but the corner never shows the next weapon before the server patch.
7. **Fists:** drop or salvage the active weapon. The junction becomes `EMPTY HANDS`, not roster item zero.
8. **Pickup/swap/drop:** successful self pickup flows world→junction; grab-while-armed shows the staggered two-token swap; another player's pickup and a rejected grace pickup never fly to the local dock.
9. **Card truth:** for active and passive focus, verify every displayed source total and requirement colour against the current calculation. Verify active loot applies only to active focus.
10. **Layering:** open the level/augment window during focus or flight. The dock collapses below the 100010 dim, hit areas disable, and no card overlays the modal.
11. **Locator safety:** force portal and rift arrows toward the bottom/right edges at every bearing. They slide around the occupied rail and remain readable.
12. **Belt:** enter belt play. The `┘` dock is absent and the existing three-slot arsenal/bag UI remains authoritative.
13. **Reduced motion:** with `prefers-reduced-motion: reduce`, selection snaps and pickup/drop uses crossfades; no rotation, Bézier travel, or overshoot remains.
14. **Performance:** with 21 weapons idle, a frame records zero chip transform/depth/stat-text writes. During focus, only the single inspector responds to `statSig` changes.
15. **Asset constraint:** network and asset logs show no new image request; every chip/focus/flight uses existing card art, installed weapon art, cached card bake, and procedural Graphics/Text.

## Ship definition

The redesign is complete when the bottom-centre playfield is permanently clear, the resting weapon navigator reads as a restrained paper `┘` attached to the bottom/right edges, the active corner always tells the authoritative truth, and intentional use can still recover the full painted card and exact stats in one focused inward unfold.
