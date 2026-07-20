# Dimension Drifters Armory / Wardrobe UI Specification

Status: implementation contract

Target branch: `feat/v0.118-metagame`

Scope: design only; no game-code changes in this pass

Reference viewport: 1920 x 1080; supported floor: 1280 x 720

Visual proportion reference: [`mock.html`](./mock.html). It is a non-production wireframe; behavior and acceptance criteria in this document are authoritative.

## 1. Outcome and non-negotiables

This redesign turns the Closet, Armory, backpack/trading surfaces, Developer Portal, and Weaponsmith from small utility panels into legible, browse-at-scale workspaces. The character pair rig is the hero of the Closet; gear and weapons are art-first; details stay visible while browsing; the vocabulary is shared across Phaser and web UI.

The implementation is accepted only if all of the following are true:

1. No UI text renders below 14 px at a 1080p or 720p viewport. A narrow viewport reflows; it does not scale the entire interface and typography down.
2. The Closet hero occupies 30–40% of the viewport width: 620 px at 1920 and 384 px at 1280.
3. The 113 gear definitions and 326 weapon definitions can be searched, filtered, sorted, and traversed from a keyboard in their catalog surfaces.
4. Every rarity and art state uses icon plus text as well as color. Color is never the sole signal.
5. Hover and keyboard focus preview gear on the live hero. Equipping an owned item is one click/Enter; locked content never looks equippable.
6. A large collection never causes one display object/DOM node per catalog item. The grid/list virtualization contracts in section 11 are mandatory.
7. The existing bounds-derived wardrobe socket/anchor work remains authoritative. No implementation in this project may restore hand-authored preview anchors.
8. Portal cards select on single click; launching Testing Grounds is a separate explicit action. Trading tiles select on click; selling is a separate explicit action.

## 2. Survey: current screens

The inventory below is based on the current TypeScript/HTML and the checked-in visual audits. Measurements are authored pixels before device scaling.

| Screen | Current layout and density | Current interaction verbs | Principal failure |
|---|---|---|---|
| Closet / Wardrobe | `MenuScene` places a fixed 1160 x 440 panel in the viewport. It never scales above 1. At 1920 x 1080 that is 60.4% of width and 40.7% of height. The preview is 240 x 184 and the body target is only 76 px, capped at 1.65 scale. Eight slot buttons sit left, six text-only items/page sit center, all set lines are compressed into 280 x 124 at right, Prestige takes 310 x 184, and the 930 x 112 companion strip hangs below. Inspector copy reaches 7–9 px. | Click slot/preset/page/companion; hover locked or owned gear to preview; click owned gear to equip; `1–6` preset; `R` starter; Enter destination; two-stage Prestige with a two-second hold. | Most of the screen is unused, art is tiny, set completion is hard to parse, preset mutation is implicit, and the companion strip nearly collides at 720p. No search/filter/sort or keyboard grid navigation. |
| Menu Armory | Reuses the fixed 1160 x 440 shell. Eight 500 px text rows/page occupy the left; a terse summary and carry list occupy the right. Text is mostly 10–13 px. Stash is capped at 72 entries in the current flow. | Click a row to stage/remove, page, Enter a destination. | No art grid, persistent detail, search, filtering, or clear safe/at-risk spatial model. |
| Non-belt weapon dock | Mirrored L at bottom-right: junction, up to two previous chips, two next chips, a 31-tick strip, and a lazy 212 x 296 focus card. Large-roster chips are 60 x 44 / 44 x 60; idle state scales to 72%. Type falls to 9–13 px. | Tap `Q` to cycle; hold `Q` for 320 ms to open focus; `E` pickup/interact; tap `R` drop, hold `R` salvage. No pointer interaction. | Focus art and labels are too small; the 31 ticks cannot generalize to 326; action hints compete with world content. |
| Belt arsenal + backpack/trading | Three 156 x 42 bottom chips. Backpack is a 4 x 3, 12-item grid in an 864 x 288 panel at 1920; cells can be only 56 px high at the authored baseline, art is 44 px, and text is 10–13 px. Sell/bind/upgrade bands stack below the grid in trading mode. | `Q` next, `1–3` direct; closed chip selects; open bag tile equips; active slot stows; `Tab` bag; `F` trading. Current trading click can sell immediately. | Small targets, truncated names/pips, footer overlap risk, and an unsafe click-to-sell path. The three trading workflows compete vertically. |
| Testing Grounds weapon gallery | The server lays 326 weapons into eight world pages of up to 42 pickups: fixed 14 x 3 at 150 px spacing. Client labels are 10 px on 132 px black plates. | `Z/X` gallery page, `E` pickup, `Q` cycle, `R` drop/salvage, `T` training, `Tab` summon; Portal deep links use `/?dev=weapon:<id>`. | Forty-two always-on labels collide with world art. This is an evaluation room, but it currently tries to be a catalog too. |
| Developer Portal | Generated plain HTML with a sticky 236 px rail, sticky search/filter bar, max-1680 workspace, and cards as small as 246 x 104 (compact: 211 x 78). It embeds 697 definitions, including 326 weapons and 113 gear items, by generating all card DOM nodes. It has no persistent inspector. Type reaches 8–13 px. | Fuzzy search, `/`, category keys `1–9`, filters, A–Z/Z–A/ID sort, density, click/Enter/Space card to launch, copy ID. | Selection and launch are conflated; full-DOM rendering does not scale; thumbnail absence is ambiguous; filters do not expose the weapon/gear taxonomies needed for production. |
| Weaponsmith | 280 px roster rail, 48 px header, empty detail until selection, three similarly weighted reference squares, then long combined/studio and form columns. Roster rebuilds all 326 rows. The two Phaser preview canvases are already persistent. Type reaches 10–13 px. | Search, assignment-status filter, select, replay/rotate previews, sliders/size/thrown controls, click origin, edit/save prompts, expand/reroll candidates. | The working preview is not dominant, controls fall below the fold, no taxonomy filtering or keyboard list model exists, and rows have no semantic focus state. |

Source data observed in this branch: 113 gear definitions across eight slots; 326 weapon definitions across 56 families; 12 named player-completable eight-piece gear sets. Blank/default and shop pools must not be counted as player-completable sets.

## 3. Shared design system

### 3.1 Color tokens

Use the exact values below in both the Phaser token module and web CSS. Surfaces stay nearly neutral so item art and rarity read cleanly; seams, double strokes, and sparse hatch texture provide the gritty stitched character.

| Token | Value | Use |
|---|---:|---|
| `bg` | `#080A0D` | viewport and scrim base |
| `surface-0` | `#0E1117` | large workspace |
| `surface-1` | `#11141A` | panels |
| `surface-2` | `#171A21` | tiles and controls |
| `surface-3` | `#20242C` | hover/selected inset |
| `border` | `#39414D` | default 1 px edge |
| `stitch` | `#59616D` | dashed seams and inactive icons |
| `text-primary` | `#F4EAD7` | titles and primary values |
| `text-secondary` | `#B9B2A6` | descriptions |
| `text-muted` | `#8F8A84` | metadata; never smaller than 14 px |
| `accent` | `#49D9E8` | focus, selection, links |
| `action` | `#F2C66D` | primary action and active preset |
| `success` | `#8EE28F` | ready/owned/safe |
| `warning` | `#FFAA55` | rendering/at-risk/pending |
| `danger` | `#FF6B6B` | unavailable/destructive |

All text/status colors above meet WCAG AA for normal text on `bg`, `surface-1`, and `surface-2`. The weakest supported pair is Cursed on `surface-2` at 5.01:1. Primary text is 14.59:1 or greater across those surfaces.

Rarity is one canonical language everywhere:

| Tier | Color | Redundant mark |
|---|---:|---|
| Common | `#9AA5B1` | `COMMON` + 1 filled diamond |
| Uncommon | `#59C96B` | `UNCOMMON` + 2 filled diamonds |
| Rare | `#4AA3FF` | `RARE` + 3 filled diamonds |
| Really Rare | `#2FD6C3` | `REALLY RARE` + 4 filled diamonds |
| Legendary | `#FFA53A` | `LEGENDARY` + 5 filled diamonds |
| Ultimate | `#FF4A6A` | `ULTIMATE` + 6 filled diamonds |
| Cursed | `#A06BFF` | `CURSED` + 6 hollow/dashed diamonds |

Do not create a weapon-definition rarity filter in Portal: weapon rarity belongs to runtime instances. Portal may expose `rarity-capable`; Armory may filter the actual instance rarity. Gear uses only the tiers its data supplies.

Art status chips are also canonical:

- check + `READY`, green;
- hourglass + `ART RENDERING`, amber;
- warning triangle + `UNAVAILABLE`, red;
- hollow circle + `ARTLESS`, neutral.

`ARTLESS` is intentional, not an error. `UNAVAILABLE` means art was expected but cannot be loaded. Never infer those two states from a missing thumbnail alone; the generator/UI must consume explicit catalog or manifest state.

### 3.2 Type, spacing, and shape

No network fonts. Use `"Segoe UI Variable", "Segoe UI", Arial, sans-serif`; identifiers and tabular metrics use `"Cascadia Mono", Consolas, monospace`.

| Role | Size / line height | Weight |
|---|---:|---:|
| Display / hero name | 32 / 36 px | 700 |
| Page title | 24 / 30 px | 700 |
| Section / selected item | 18 / 24 px | 700 |
| Body / control | 16 / 22 px | 500–600 |
| Secondary / label / stats | 14 / 20 px | 500–700 |

Minimum rendered text is 14 px. Use tabular figures for `07/31`, counts, capacities, currency, and stat deltas. Uppercase is reserved for short labels/chips; body copy uses sentence case. Truncate only after two lines, and expose the full name in detail/focus state.

Spacing tokens: `4, 8, 12, 16, 24, 32, 48, 64` px. Panel padding is 24 px at 1080 and 16 px at 720. Gaps are 12 px at 1080 and 8 px at 720. Radii are `4` (chips), `8` (controls/tiles), and `12` (major panels). Strokes are 1 px default, 2 px selected, 3 px keyboard focus. Minimum hit target is 44 x 44 px.

The focus ring is a 3 px `accent` inner/outer stroke with a 1 px `bg` separator. Focus, hover, selected, equipped, locked, and disabled are separate states. Hover may lift by 2 px; focus must not move layout.

### 3.3 Icons and texture

Use a single 24 px line-icon grid, 2 px stroke, round joins. Slot icons: hat, glasses, facial hair, head/hair, torso, gloves, boots, cloak. State icons: check, hourglass, warning triangle, hollow circle, lock, eye, equipped check, at-risk knot, safe vault. Phaser draws these from shared path/primitive definitions; web uses matching inline SVG. Do not use emoji or font-dependent symbols.

Texture is low contrast and non-repeating at tile scale: one stitched/dashed inset edge, sparse 1 px scratches at 6–10% opacity, and a soft top-left highlight. It must never cross text or item silhouettes. No blur is required for hierarchy.

## 4. Global responsive frame

The app uses two explicit layout states, interpolating gutters only—not typography:

- **Wide, 1440–2560 px:** 24 px outer margin, 12 px gutters, 88 px application header, 64 px footer/hint rail.
- **Floor, 1280–1439 px:** 16 px outer margin, 8 px gutters, 72 px header, 60 px footer. Secondary columns narrow or become drawers, but the catalog remains at least two columns.
- **Below 1280 x 720:** supported as a safety reflow, not a design target. The detail panel becomes a right drawer over the catalog; text stays 14 px; no root down-scaling.

All major surfaces use the full safe viewport. Letterbox/game safe-area offsets are applied before these measurements.

## 5. Closet / Wardrobe

### Before

```text
                 fixed 1160 x 440 floating panel
+----------+----------------------+----------------------+----------+
| 8 slots  | presets + 240x184    | 6 text rows / page   | sets +   |
|          | tiny static preview  | no search/filter     | prestige |
+----------+----------------------+----------------------+----------+
           companion strip outside panel; empty screen below
```

### After at 1920 x 1080

```text
+ HEADER 88: CLOSET | Preset name [1..6] | collection 61/96 | World Tier +
| 132 SLOT | 620 HERO / PAIR RIG          | 680 CATALOG       | 404 DETAIL |
| RAIL     |                              | search + filters  | item name  |
| [hat]    |       large live rig         | sort + 113 count  | rarity     |
| [eyes]   |       hover/focus preview    | +----+----+----+  | stats +/-  |
| [...]    |                              | |art |art |art |  | set 6/8    |
|          | equipped silhouette/actions | |tile|tile|tile|  | 8 stitches |
|          | companion shelf at bottom   | +----+----+----+  | status     |
+----------+------------------------------+-------------------+------------+
+ FOOTER 64: arrows navigate | Enter equip | Q/E slot | Z/X page | R starter+
```

Exact wide columns: x/w `24/132`, `168/620`, `800/680`, `1492/404`; 12 px gutters. The hero is 32.3% of viewport width. Body y/h is `100/904`; footer begins at y `1016`.

At 1280 x 720: header 72, footer 60, body y/h `84/576`; x/w columns are `16/80`, `104/384`, `496/468`, `972/292`, with 8 px gutters. The hero remains 30% of viewport width. Slot labels collapse to icons plus focused tooltip, but targets remain at least 48 x 48.

Catalog anatomy:

- Toolbar row 1: search field; result count; Clear.
- Toolbar row 2: slot, rarity, set, class, ownership, art-status filters; sort by Recommended, Name, Rarity, Set, Owned, Newest. Slot rail selection synchronizes the slot filter.
- Wide grid: three 208 x 216 art tiles with a 12 px gap. Floor grid: two 212 x 184 tiles with an 8 px gap. Tile content is 55–60% art, then name, rarity marks, set and state. Never put prose on the art.
- Owned/equipped/locked/art-state appear as consistent corner chips. Locked tiles remain previewable; the primary action becomes a disabled reason such as `Requires Prestige 2`.

Detail anatomy, in fixed order: item name; rarity; status; 160 px crop/detail art when room permits; equipped comparison; stats; set block; ownership/source; primary action. The set block shows exact set name, `Owned n/8`, `Equipped n/8`, eight slot stitches, and missing slot names. It is completion information only; do not imply a set bonus unless gameplay supplies one.

Presets show their saved names, not only numbers. A persistent header label reads `Editing preset 3 — Ash Runner`; equipping mutates that preset and immediately changes its dirty/saved indication. Presets stay one-click and `1–6` accessible. Companion selection lives in a shelf within the hero column, not below the panel. Prestige opens a replacement detail drawer from the `World Tier` header control; its hold-to-confirm behavior remains.

Pointer/focus behavior:

1. Pointer enters a tile: after 80 ms intent, preview that item on the rig. Pointer leaves: restore the selected/equipped preview unless another tile has focus.
2. Keyboard focus changes: preview immediately. Focus wins over hover.
3. Single click or Enter on an owned item equips it; clicking the equipped item offers `Unequip` only if the slot can actually be empty. No confirmation is needed for reversible equip/unequip.
4. Arrows move the grid; `Q/E` previous/next slot; `Z/X` previous/next catalog viewport page when search input is not focused; `Enter` equip; `R` starter for selected slot; `1–6` preset; `Esc` back/close drawer.

## 6. Menu Armory

### Before / after

```text
BEFORE: [8 text rows/page----------------][small summary/carry] in 1160x440

AFTER 1920:
+ HEADER 88: ARMORY | Stash | Last Carry | search                         +
| 1016 LIBRARY / 4 art cards across | 432 SELECTED DETAIL | 400 CARRY PLAN |
| filters + sort + 72 count         | full art + stats    | ACTIVE 0/3     |
| [card][card][card][card]          | rarity/affix/source | PACK 0/cap     |
| [card][card][card][card]          | pair composition    | at risk value  |
| virtual rows                      | stage/remove action | safe vault     |
+ FOOTER 64: arrows | Enter stage | Q/E zone | destination actions          +
```

Exact wide column widths are 1016 / 432 / 400 with 12 px gutters and 24 px margins. At 1280 they are 640 / 304 / 288 with 8 px gutters and 16 px margins. The library uses four approximately 237 x 150 cards wide and two approximately 298 x 136 cards at the floor.

Filters: carry zone (`All`, `Safe`, `Staged`, `Active`, `Pack`, `Intake`), weapon class, family, delivery, actual instance rarity, provenance, and pair/single. Sort: Recommended, Name, Rarity, Value, Size, Newest. The detail panel always describes the focused item/pair and its comparison against the active item.

Staging/removing is reversible and one click/Enter. Active and Pack are visual drop zones but keyboard-complete: `Q/E` moves the selected staged item between valid zones; `1–3` selects an active slot. Show physical size as occupied cells, not a prose number. The carry column must continuously show at-risk entries, physical cells, value, required World Tier, and intake blocker. Entering a destination remains the commit boundary. Intake errors are inline in that column and never a modal.

## 7. In-game dock, backpack, and Testing Grounds

### 7.1 Non-belt dock

```text
BEFORE bottom-right: tiny ticks--prev--[junction]--next + 212x296 focus

AFTER bottom-right:
                                    + 360 x 520 FOCUS CARD (hold Q) +
                         [prev]      | art / name / stats / verbs   |
                    [prev] [152] [next]                             |
                           [next]  07/31  --page--                   |
```

At 1080p the awake junction is 152 px, idle is 116 px, horizontal neighbor chips are 104 x 72, vertical chips are 72 x 104, and focus is 360 x 520. At 720p use 128, 96, 88 x 64, 64 x 88, and 320 x 456 respectively. Name is 18 px; all metadata/hints are at least 14 px. Replace the per-weapon tick strip with a tabular `07/31` and a compact relative-position bar. Only the junction, four neighbors, and focus card exist as display objects; the focus-card cache remains capped at three.

`Q`, hold `Q`, `E`, and `R` behavior does not change. The enlarged dock stays non-pointer-interactive so it cannot steal attacks. Art status appears in focus, not on every neighbor chip.

### 7.2 Belt arsenal and backpack/trading

```text
BEFORE: [three 156x42 chips] + 4x3 small cells + stacked sell/bind/upgrade bands

AFTER:
  dimmed but visible live world; WORLD LIVE chip
  + BACKPACK ------------------------------------------------------+
  | header + tabs INVENTORY / SELL / BIND / UPGRADES               |
  | 4 x 3 large art tiles (left)       | persistent detail/action  |
  | 244x176 wide; 181x136 at 1280      | stats, value, explicit CTA|
  +---------------------------------------------------------------+
  | [ACTIVE 1] [ACTIVE 2] [ACTIVE 3]    capacity / close hint       |
  +---------------------------------------------------------------+
```

At 1920 the modal occupies at most 1536 x 824 (80% width), with a 72 px header and 120 px bottom dock. Use a 1040 px grid region, 432 px detail, and 16 px gap. At 1280 it is 1184 x 624, header 64, dock 100, with approximately 760 / 360 / 16 columns. Preserve a visible world perimeter and show `WORLD LIVE`: online simulation continues. Pointer-over UI continues to suppress attacks.

The fixed 12-item grid does not need virtualization, but it must redraw only when its state signature changes. Inventory click/Enter equips; active-slot click/Enter stows. In SELL, tile click only selects. Selling requires the explicit detail action `Sell for ◈N`; that button is the destructive confirmation, so no extra modal is required. BIND and UPGRADES likewise use explicit labeled buttons. Do not stack the three workflows below one grid.

Keyboard: arrows navigate; `Enter` invokes the current primary action; `Q` cycles active slot; `1–3` direct slots; `Z/X` changes SELL/BIND/UPGRADES sub-tabs when a text field is not focused; `Esc`/`Tab` closes according to existing routing. Focus remains trapped in the modal while open.

### 7.3 Testing Grounds gallery

```text
BEFORE: 14 x 3 world pickups, all with competing 10 px labels

AFTER:
+ WEAPON EVALUATION  page 03/08 | Z/X page | / open Portal search +
| world art + small index plates; only nearest/focused weapon gets  |
| a full 14 px two-line name card and E PICK UP affordance           |
+ Q cycle | E pickup | R drop/hold salvage | direct link ID          +
```

Testing Grounds is an evaluation surface, not the primary 326-item browser. Keep the existing world paging and `Z/X`. Replace constant long labels with small numbered plates; reveal one full label for the nearest/focused pickup. A top command band identifies page and filters inherited from a Portal deep link. Full browse/search lives in Portal/Weaponsmith. This avoids expanding scope into server gallery generation.

## 8. Developer Portal (plain HTML)

### Before / after

```text
BEFORE: 236 rail | sticky toolbar | full DOM card grid; card click launches

AFTER 1920:
+ 264 NAV + 84 TOPBAR: search / filters / sort / density / 326 results +
| LIBRARY: virtual 264x196 art cards, fills remaining width | 420 INSPECTOR |
| [card][card][card][card] ...                              | large art    |
| selection stays in grid                                  | facts/status |
|                                                          | Copy ID      |
|                                                          | OPEN IN TG   |
```

Remove the workspace max-width. At 1920 use a 264 px rail, 84 px topbar, and a persistent 420 px inspector. At 1280 collapse the rail to 88 px icons and use a 360 px inspector. Below that, inspector becomes a drawer. Comfortable cards are approximately 264 x 196; compact density may reduce art and padding but not text below 14 px.

Information architecture:

- Global: fuzzy search, category, art status, A–Z/Z–A/ID, density, result count.
- Gear: slot, rarity, named set/pool, class, ownership applicability, art status.
- Weapons: class, family, delivery, grip, element, source, rarity-capable, art status. Do not expose definition rarity.
- Catalog set facts may show eight-piece membership and art readiness. Player-owned set completion belongs only in Closet.

Single click/Enter selects and fills the inspector. The primary inspector button opens Testing Grounds; secondary actions copy ID/deep link. `/` focuses search; arrows use a roving grid focus; `Enter` selects; `Shift+Enter` or the explicit button launches; number keys retain category shortcuts. Every card is an option in a labelled grid with `aria-rowcount`, `aria-rowindex`, and `aria-activedescendant` or an equivalent roving-tabindex implementation.

The localhost/service indicator must report a real probe state (`CONNECTED`, `OFFLINE`, `CHECKING`); do not show a decorative always-on dot. Persist only filters/density/category, not transient hover.

## 9. Weaponsmith web UI

### Before / after

```text
BEFORE: 280 roster | empty/long editor: 3 equal references, preview, forms below fold

AFTER:
+ 72 HEADER: WEAPONSMITH | selected ID | dirty state | Save +
| 384 VIRTUAL LIBRARY | 55% PREVIEW STUDIO       | 45% INSPECTOR |
| search + taxonomy   | one large Combined view | accordion     |
| <=30 rendered rows  | tabs: Weapon/Painted/    | assignment    |
| Z/X prev/next       | Engine/Combined          | origin/size   |
|                     | 3 small references below | prompt/cands  |
|                     | replay Q / rotate        | sticky actions|
```

Select the first filtered weapon on load so the workspace is never blank. Header is 72 px, library is 384 px, and the rest is split approximately 55/45 between preview studio and inspector. The Combined preview is the dominant square, sized from available viewport height. Weapon/Painted/Engine/Combined are view tabs, not four simultaneous canvases. Three small reference thumbnails live below it.

Preserve exactly the two persistent WebGL/Phaser preview contexts already in `app.js`; reparent/resize their hosts and call their refresh path. Do not instantiate a context per tab or row. `vfx-engine.js` is read-only in this project.

Library filters: class, family, delivery, grip, element, source, assignment state, and art state. Assignment (`Bespoke`, `Generated`, `None`) is not art status. For Painted VFX, use `ARTLESS` for intentionally engine-only definitions, `ART RENDERING` while requested/running, `READY` for an available candidate, and `UNAVAILABLE` when a promised asset cannot be loaded.

The inspector uses accessible accordions in this order: Overview, Assignment, Origin/Scale/Thrown, Prompt, Candidate history. Save and dirty status remain sticky. `Z/X` selects previous/next filtered weapon, `Q` replays, and `E` opens the selected weapon in Testing Grounds when no input/control has focus. Rows are semantic options with roving focus.

## 10. Component inventory

| Component | Required states/content | Phaser | Web |
|---|---|:---:|:---:|
| App header | title, location tabs, preset/selection, global status | yes | yes |
| Slot rail | eight icons, equipped/new/locked, tooltip | yes | no |
| Search field | value, clear, count, `/` hint | optional menu | yes |
| Filter chip/menu | active count, clear, keyboard menu | yes | yes |
| Virtual art grid/list | loading/empty/error, roving focus, overscan | yes | yes |
| Item tile | art, name, rarity, set/family, equipped/locked/art status | yes | yes |
| Persistent detail | art, comparison, stats, set/source, primary action | yes | yes |
| Set completion | owned/equipped n/8, eight slot stitches, missing names | yes | catalog facts only |
| Carry capacity | active/pack cells, value, risk, blocker | yes | no |
| Status chip | icon + exact status text | yes | yes |
| Rarity mark | word + diamond count + color | yes | yes |
| Command rail | current keyboard/pointer verbs | yes | yes |
| Confirm action | explicit inline destructive CTA; hold progress for Prestige/salvage | yes | yes |
| Empty state | reason, clear-filter/retry action | yes | yes |
| Live preview surface | opaque rig surface or persistent WebGL host | yes | Weaponsmith only |

Loading never substitutes `UNAVAILABLE`: show skeletons while state is unknown. An empty filtered result says `No matches` and provides `Clear filters`. Errors retain the selected item's text data even if art fails.

## 11. Rendering, virtualization, and input contract

### Phaser

Use retained Phaser GameObjects and object pools. Do not use Phaser DOM Elements for in-game catalogs: they introduce DPR, focus-routing, canvas stacking, and capture inconsistencies. The grid calculates visible row range from scroll offset and rebinds a fixed pool.

- Closet wide: 3 columns x (visible rows + 2 overscan), normally 15 tiles. Floor: 2 x 4, normally 8 tiles.
- Menu Armory: pool at most 30 cards.
- Dock: five chips plus a focus card; retain the existing focus-card LRU cap of three.
- Backpack: exactly 12 fixed cells; no virtualization, but update only on dirty signature.
- Never allocate textures, text, arrays, or tweens in a per-frame layout loop. Texture baking remains generation-cancelled. Pointer preview waits 80 ms; keyboard preview is immediate.

Use a single focus controller per surface. It owns `focusedIndex`, selected ID, hover ID, row/column math, scroll-into-view, and precedence (`keyboard focus > hover > equipped/default`). Text-input focus suspends letter shortcuts. Key-up/cancel must clear held-action progress.

### Web

Portal grid and Weaponsmith roster use fixed measured row/card heights, two overscan rows, `ResizeObserver`, and a spacer/window technique. Portal must not mount all 697 cards; Weaponsmith should mount at most 30 weapon rows plus group/header nodes. Preserve stable item IDs and focus when filtering; if the item disappears, select the first result and announce the count.

Targets at 1920 x 1080 on a production build:

- p95 interaction/scroll frame under 16.7 ms;
- no filter/search main-thread task over 50 ms;
- no texture bake started for an item that never survives the 80 ms pointer intent;
- two and only two Weaponsmith preview contexts;
- no console warnings for hidden focused nodes or invalid ARIA indices.

## 12. Bounds-anchor dependency: explicit freeze

There is active, uncommitted work in `SpriteRig`, gear parts/baking, wardrobe preview tests, and the gear manifest. Those files are outside this implementation partition and must not be edited, reformatted, or reverted.

Track A may build the hero column around an opaque preview surface, but final integration waits for the bounds-derived anchor work to land. The post-merge preview boundary must accept the destination art rectangle/scale policy and current loadout/preview override; the preview owns sockets, baked bounds, generation cancellation, and pair motion. The layout must not know hat/head/cloak coordinates and must not restore the current 76 px target or 1.65 scale cap. The desired behavior is:

```ts
preview.setViewport(heroArtRect);
preview.show(loadout, { overrideItemId, motion: "closet" });
preview.clearOverride();
```

The names above are an interface description, not permission to edit the in-flight files. If the merged API differs, adapt only the Track A caller. Track B has no bounds-anchor dependency.

## 13. Implementation partition — exactly two tracks

The lists below are exclusive write ownership. Neither implementer may edit a file owned by the other track or any frozen dependency. If a required change falls outside the list, stop and coordinate before writing it.

### Track A — in-game Closet / Armory / dock / backpack

Exclusive existing files:

- `packages/client/src/scenes/MenuScene.ts`
- `packages/client/src/scenes/ArenaScene.ts`
- `packages/client/src/scenes/arena/card-art.ts`
- `packages/client/src/ui/weapon-dock-layout.ts`
- `packages/client/src/ui/wardrobe/layout.ts`
- `packages/client/src/ui/wardrobe/model.ts`
- `packages/client/src/ui/wardrobe/layout.test.ts`
- `packages/client/src/ui/wardrobe/model.test.ts`
- `packages/client/src/ui/armory/model.ts`
- `packages/client/src/ui/armory/model.test.ts`

Permitted new files, also Track A exclusive:

- `packages/client/src/ui/armory-ui/tokens.ts`
- `packages/client/src/ui/armory-ui/icons.ts`
- `packages/client/src/ui/armory-ui/virtual-grid.ts`
- `packages/client/src/ui/armory-ui/virtual-grid.test.ts`
- `packages/client/src/ui/weapon-dock-layout.test.ts`

Track A should land shared tokens/icons/virtual grid first, then Closet and menu Armory, then dock/backpack/Testing Grounds command-band changes. Tests cover 1920 x 1080 and 1280 x 720 geometry, 14 px floor, focus wrap/scroll, virtual pool bounds, set completion, and reversible/destructive action separation.

### Track B — Developer Portal + Weaponsmith web UIs

Exclusive files:

- `tools/portal/gen-portal.mjs`
- `tools/portal/index.html` (generated output only; never hand-edit)
- `tools/weaponsmith/public/index.html`
- `tools/weaponsmith/public/app.js`
- `tools/weaponsmith/public/style.css` (new; extract presentation from HTML here)
- `tools/weaponsmith/server.mjs` (metadata/API exposure only; no behavior rewrite)

Track B implements the literal CSS equivalents of section 3, Portal selection/inspector/virtual grid and explicit launch, then Weaponsmith layout/virtual roster/filtering. Keep `tools/weaponsmith/public/vfx-engine.js`, assignment data/store files, all `packages/*`, and all art outputs read-only. Regenerate `tools/portal/index.html` only through `gen-portal.mjs` and verify the generated diff.

There is intentionally no shared cross-track token file: Track A writes TypeScript literals and Track B writes CSS custom properties. This avoids an ownership collision. The values in section 3 are the source contract.

## 14. Acceptance checklist

- Capture 1920 x 1080 and 1280 x 720 for Closet, menu Armory, dock focus, backpack SELL, Portal gear + weapon categories, and Weaponsmith selected state.
- Automated geometry asserts no panel overlap, no text below 14 px, hero width 30–40%, and at least 44 px targets.
- Traverse each surface without a pointer; focus is always visible and selected/focused detail stays synchronized.
- Test 113 gear, 326 weapons, zero results, one result, maximum stash, 12-item bag, missing expected art, intentionally artless content, and rendering-in-progress.
- Confirm rarity word/diamonds/color match across Phaser, Portal, and Weaponsmith.
- Confirm Closet hover/focus moves the pair rig without stale bakes, manual socket constants, or layout-owned anchors.
- Confirm Portal mounts a bounded card window and Weaponsmith mounts at most 30 roster rows.
- Confirm tile click cannot accidentally launch Portal content or sell a trading item.
- Confirm online world continues behind the backpack and pointer-over UI does not fire attacks.

## 15. Survey notes

Primary source locations inspected: `MenuScene.ts`, `ArenaScene.ts`, `ui/wardrobe/*`, `ui/armory/*`, `ui/weapon-dock-layout.ts`, `scenes/arena/card-art.ts`, `tools/portal/gen-portal.mjs`, generated Portal HTML, and `tools/weaponsmith/*`. Existing visual audits inspected: `tools/artkit/out/audit-armory/weaponsmith-all-326.png` and `weaponsmith-driftblade-edit.png`; pickup before/after captures were inventoried. A live in-app browser session was not available during this design pass, so code and checked-in captures—not a newly captured runtime—are the measurement authority for the before state.

No owner decision is required to begin either track. The specification deliberately keeps Testing Grounds server layout, weapon VFX engine behavior, and in-flight preview anchors out of scope.

## 16. Track B implementation notes

- The Developer Portal now uses the section 3 CSS tokens, full-viewport rail/library/inspector geometry, a bounded fixed-row virtual grid with two overscan rows, category-specific filtering and sorting, persistent selection details, rarity diamonds, explicit art-state chips, and separate selection, deep-link copy, and launch actions. Weapon and gear deep links and the Places rail remain available. Gear metadata derives the twelve eight-piece player-completable set states without changing source manifests.
- The generated Portal artifact remains owned by `gen-portal.mjs`; its emitted catalog contains 326 weapons, 113 gear items, and the existing non-armory categories.
- Weaponsmith now uses the same visual contract with a full-height virtual roster (at most 30 mounted rows), eight metadata filters, four preview modes, three reference panes, two persistent render contexts, accessible inspector accordions, and explicit Testing Grounds launch and save controls. The existing full-catalog API, assignment workflow, render queue, candidate comparison, prompt editing, and save payload remain intact.
- `server.mjs` adds presentation metadata only: delivery, element, candidate count, and the explicit `READY`, `RENDERING`, `ARTLESS`, or `UNAVAILABLE` art state used by the web UI.
