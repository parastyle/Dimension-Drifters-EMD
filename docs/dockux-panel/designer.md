# Weapon Dock & Backpack — Size, Wording, and Panel UX Specification

Designer pass for the user directive: *"the weapon carousel — bigger, easier to read. Work on the internal wording to follow better user experience and professional look. Along with the backpack UI."*

Scope covers the shipped mirrored-L dock (`packages/client/src/ui/weapon-dock-layout.ts`, dock rendering in `packages/client/src/scenes/ArenaScene.ts:7901-8420`, chip/junction builders in `packages/client/src/scenes/arena/card-art.ts`) and the belt-mode arsenal + Tab bag panel (`packages/client/src/scenes/ArenaScene.ts:8562-8934`). This document changes presentation and copy only; every interaction contract, authority rule, and fade law from `docs/carousel-panel/designer.md` stays in force.

---

## 1. Size & readability

### 1.1 The core diagnosis

The dock is small twice over. The geometry tiers were sized for a *watermark*, and then the type inside them was sized for the geometry: a tier-C junction is 68 css px with a 9-px name and 8-px loot line; passive chips bottom out at 44×32 with 7-px footers. At the current roster (~21 weapons, tier C in `DOCK_TIERS`, `weapon-dock-layout.ts:47-72`), the active weapon's *name* renders smaller than the game's damage numbers. Meanwhile every chip tries to carry a name that no one can read.

The fix is **not** uniform enlargement — the last directive (do not block the game view) still binds. The fix is:

1. **Awake ≠ idle.** The dock earns its pixels only while the player is using it. Awake sizes go up ~33%; the idle dock *shrinks below even today's size* and carries less information, so net occlusion during combat goes down.
2. **Fewer words per chip.** Neighbours stop pretending to be readable cards. Pixels move from six illegible 7-px names into one legible 14-px active name and a 13-px ammo badge.

### 1.2 New dock tiers (replaces `DOCK_TIERS`, `weapon-dock-layout.ts:47-72`)

All values are **pre-`d` css px** — multiply by the existing `d = clamp(min(W/1600, H/900), 0.78, 1.25)` and half-pixel round exactly as today. The tier thresholds by roster count (≤7 / 8–13 / ≥14, `tierFor`, `weapon-dock-layout.ts:82-86`) are unchanged.

**AWAKE tier table** (`fadeProgress = 1`):

| Roster | Junction `A` | Bottom chip w×h | Right chip w×h | Gap |
|---:|---:|---:|---:|---:|
| 3–7 | 112 | 84×58 | 58×84 | 8 |
| 8–13 | 104 | 72×50 | 50×72 | 6 |
| 14–21 | 96 | 60×44 | 44×60 | 5 |

**IDLE multiplier:** the whole dock (elbow + both arms + tabs) scales by **0.72**, anchored at the bottom-right corner point `(W - R, H - B)` so it stays edge-flush. Idle tier-C junction = 69 css px — visually identical footprint to today's 68 — and idle chips ≈ 43×32. The scale rides the *existing* shared `fadeProgress` (`applyCarouselDockFade`, `ArenaScene.ts:8007-8019`): `dockScale = 0.72 + 0.28 × p`. No new tween, no new timing; the 120 ms wake / 2400 ms hold / 650 ms fade grammar is untouched. With `prefers-reduced-motion`, snap between 0.72 and 1.0 at the fade endpoints instead of interpolating.

Net occlusion check at 1920×1080 (`d = 1.2`, tier C): awake junction 115×115 css ≈ 1.0% of screen area (old: 82×82 ≈ 0.5%); idle junction 83×83 ≈ 0.53% — *at or below today's idle footprint*, and the idle rails at 0.72 scale occupy less than they do now. Bigger when you look, smaller when you fight.

The `fit` clamp floor rises from 0.74 to **0.80** (`weapon-dock-layout.ts:112-120`): with the neighbour chips carrying no text (see 1.4) they can compress slightly less before overflowing to the `+N` tab, and a 0.80 floor keeps the key-hint badges legible.

Focus card (`focus` block, `weapon-dock-layout.ts:166-175`): the native 212×296 inspector and its `f = clamp(d, 0.82, 1.00)` are unchanged — the inspector was never the readability complaint — but raise the fallback squeeze from 0.74 to **0.78** and let the inspector overlap the (now-hidden-while-focused) rails before shrinking.

### 1.3 Type sizes — exact px

All dock text is authored in css px and already rendered at `setResolution(max(2, ceil(devicePixelRatio)))` (`card-art.ts:154-156`, `ArenaScene.ts:7914`), so a css size maps 1:1×DPR to device pixels with no blur. Table gives css px at `d = 1`, then device px at DPR 1×/1.5×/2×. Minimums are hard floors after `d` scaling (`d` can reach 0.78).

| Text object | Today | New css @ d=1 | Floor | Device px 1×/1.5×/2× | Style |
|---|---:|---:|---:|---|---|
| Junction weapon name (`card-art.ts:250-258`) | 10, `max(9, size×0.12)` | **14** (`max(12, A×0.125)`) | 12 | 14 / 21 / 28 | Bold, `#f1e8cf` |
| Junction tier · affix line (`card-art.ts:241-249`) | 8 | **11** (`max(10, A×0.10)`) | 10 | 11 / 16.5 / 22 | Bold, rarity colour |
| Junction ammo/heat badge (`card-art.ts:259-267`) | 9 | **13** (`max(11, A×0.115)`) | 11 | 13 / 19.5 / 26 | Bold, state colour |
| Junction index `3/21` (`card-art.ts:230-238`) | 9 | **10** | 9 | 10 / 15 / 20 | `#cfc6ae` |
| Chip key badge (replaces `order`, `card-art.ts:172-180`) | 8 | **11** | 9 | 11 / 16.5 / 22 | Bold, `#f1e8cf` on plate |
| Chip name footer (`card-art.ts:162-171`) | 9→7 | **deleted at rest** (see 1.4) | — | — | — |
| Rail tabs `← E` / `Q ↑` (`ArenaScene.ts:7908-7922`) | 10 | **11** | 9 | 11 / 16.5 / 22 | Bold |
| Focus-card name (`card-art.ts:504`) | 17 | 17 (unchanged) | — | 17 / 25.5 / 34 | Bold, accent |
| Focus-card stat rows (`card-art.ts:519-524`) | 13 | 13 (unchanged) | 10 | 13 / 19.5 / 26 | Bold |

Junction footer height (`layoutDockJunction`, `card-art.ts:302`): `max(23, size×0.31)` → **`max(30, A×0.30)`** — two text lines (name 14 + loot 11) plus 3 px breathing room fit a 34-px footer at tier C awake.

Name truncation on the junction rises from 17 chars (`ArenaScene.ts:8199`) to **20 chars** — "Tombstone Greatsword" (20) and "Gravedigger's Spade" (19), the two longest roster names, now fit untruncated at 14 px inside a 96-px junction. Keep the ellipsis fallback for expansion names.

### 1.4 Information hierarchy per chip state — what earns pixels, what dies

**Active junction, awake** (everything, largest type):
1. Painted art, full bleed (hero).
2. Rarity border, 3 px (identity-at-a-glance).
3. Weapon name, 14 px, footer line 1.
4. Tier · affix, 11 px rarity-tinted, footer line 2.
5. Ammo/heat badge, 13 px, top-right **on its own backing pill** (see 1.5) — this is the single most-glanced number on the dock; it outranks everything but the art.
6. Index `3/21`, 10 px top-left + the tick strip.

**Active junction, idle** (truth only): art at the existing 0.18 alpha floor, rarity border at 0.30, and the truth layer — **name + ammo badge only**. Move the tier·affix `loot` text out of the never-fading `truth` container into `chrome` (`card-art.ts:239-268`, faded by `applyCarouselDockFade`): "Rare · Keen" is not combat truth; ammo is. Idle carries two readable facts, not four faint ones.

**Neighbour chips (E1/E2 up the bottom arm, Q1/Q2 up the right arm)**: art + 1 px accent outline + **key badge only** — an 18×14 css plate in the chip's outer corner reading `E` / `Q` (nearest chip) and `E2` / `Q2` (second chip). **The chip name footer dies entirely at rest.** Today it only renders under 13 weapons anyway (`showNames`, `ArenaScene.ts:8101`) and at 7–9 px it was decoration pretending to be information. Identity at rest is silhouette + colour; anyone who needs the name dwells 160 ms or holds Q/E and gets the full 212×296 card. Delete `showNames` and the `shortDockName` path (`card-art.ts:185-223`) rather than keeping a dead branch.

**Overflow**: unchanged — index ticks under the junction plus `+N` folded into the rail tab.

### 1.5 Contrast, outlines, and backing plates — reading over any arena

The dock floats over lava, ice, void, and confetti. Every text element gets a guaranteed dark backing; no glyph ever sits on raw art or raw arena.

- **Ammo badge plate**: rounded-rect pill `#0a0805` at alpha 0.88, 1 px stroke in the badge's state colour at 0.6, padding 4×2 css. Kills the current failure where `10/24` in `#f1e8cf` sits directly on bright painted art.
- **Index plate**: same treatment at 0.78 alpha, top-left.
- **Chip key badge plate**: `#0a0805` at 0.9, 1 px `#cfc6ae` stroke at 0.35.
- **Junction footer**: keep `#0a0805` at 0.90 (`card-art.ts:313-315`) — verified ≥ 12:1 contrast for `#f1e8cf`, and ≥ 4.5:1 for every rarity colour in `RARITIES` (worst case Rare `#4aa3ff` ≈ 6.8:1).
- **Text shadow**: every dock text gets `setShadow(0, 1, "#000000", 2, true, true)` as belt-and-braces over the plates. Cheaper and cleaner than a stroke at these sizes.
- **Outline weights**: junction rarity border 3 px (unchanged); chip accent outline 1 px awake; add a 1 px `#000` outer rim outside the accent line (2-px total edge) so light-accent chips (Gatling's `#fff0a0`) still separate from bright floors.
- Preserve the paper doctrine (`docs/carousel-panel/designer.md` §Paper-craft): no glow, no blur, hierarchy from plate coverage and border weight.

---

## 2. The wording pass

### 2.1 Canonical terminology (use these words everywhere, forever)

| Concept | Canonical term | Kills |
|---|---|---|
| A weapon | **weapon** | "item", "gun/blade" as generic |
| Belt loadout position 1/2/3 | **slot** | "chip", "arsenal slot" |
| The Tab inventory | **Backpack** (panel title), **pack** in compact readouts | "bag", "BAG", "stash" |
| Put a weapon into the pack | **stow** | "stash", "store" |
| Take a weapon out of the pack | **equip** | — |
| Trade a weapon for Scrip | **sell** | — |
| Destroy held weapon for carried salvage | **salvage** | — |
| Currency | **Scrip** (capitalised, mass noun), written `◈ 45` — glyph, space, amount | "scrip", "+12◈", "45 ◈" (inconsistent orders) |
| Rarity tier | **tier**, title-case names (Common … Cursed) | "rarity" in player-facing copy |
| Affix | title-case name after the tier: `Rare · Keen` | `RARE KEEN` smash-caps |
| S–E scaling letters | **grade** | — |
| The shopkeeper | **Trading Post** | "SHOP", "shopkeeper" in UI copy |
| No weapon held | **Unarmed** | "EMPTY HANDS" |

**Case policy**: UPPERCASE is reserved for two things only — panel/section titles (`BACKPACK`, `TRADING POST`) and ≤ 10-char combat-state badges (`RELOADING`, `OVERHEAT`). Everything else is sentence case. Weapon, tier, affix, and upgrade names are Title Case proper nouns.

**Key-hint grammar**: `[Key] Action` — bracketed key, one space, capitalised verb: `[Tab] Close`, `[F] Trade`, `[R] Hold to salvage`. Separator between hints is ` · `. Never `Key: action`, `key — action`, or a dangling bare key like today's `·  Tab`.

**Number formatting**: capacities and ammo `7/12`, `10/24` — no spaces around the slash. Percent deltas signed: `+15%`. Scrip always `◈ 45`; gains `+◈ 12`. Timers under a minute `1.2s`; over, `m:ss`. Never print a raw internal id — every `?? self.weapon` / `?? item.weapon` / `?? wid` fallback becomes the literal string `Unknown weapon` (an id like `x-gun-nailgun` on screen is a defect, not a fallback).

### 2.2 Complete copy table — every current string → replacement

**Dock (non-belt), junction + rails:**

| Location | Current | Replacement | Rationale |
|---|---|---|---|
| `ArenaScene.ts:8198`, `card-art.ts:251` | `EMPTY HANDS` | `Unarmed` | Sentence-case state, not a shout; 7 chars fits every tier |
| `ArenaScene.ts:8199` | `def?.name ?? self.weapon` (id leak) | `def?.name ?? "Unknown weapon"` | Never leak ids |
| `ArenaScene.ts:8201` | `RARE KEEN` (upcased concat) | `Rare · Keen` (title case, interpunct) | Two facts, one separator; matches HUD loot prefix |
| `ArenaScene.ts:8210` | `RELOAD` | `RELOADING` | It's a state in progress, not a command to the player; badge stays red |
| `ArenaScene.ts:8210` | `{c}/{max}` | unchanged | Correct already |
| `ArenaScene.ts:8193-8196` | `3/21`, `—/21` | unchanged | Correct already |
| `ArenaScene.ts:7916, 8147` | `← E`, `+9  ← E` | `[E] ‹`, `[E] ‹ +9` | Key first per hint grammar; `+N` reads as "9 more this way" |
| `ArenaScene.ts:7920, 8151` | `Q ↑`, `+9  Q ↑` | `[Q] ›`, `[Q] › +9` | Symmetric; chevrons say "cycle", arrows implied direction only |
| chip `order` text (`ArenaScene.ts:8128, 8140`) | `E1`/`Q2` | `E` / `E2` / `Q` / `Q2` (nearest chip drops the 1) | The nearest chip is "what E does next" — the 1 is noise |

**Dock beam/heat badge (`beamStatusText`, `ArenaScene.ts:7519-7539`)** — the current strings are terse mixed-metaphor jargon (`REDLINE 87%`, `VENT 33%`, `LOCK 1.2s`, `RELEASE`):

| Current | Replacement | Note |
|---|---|---|
| `READY {n}%` | `Ready` | The heat % on a ready weapon is engineer-brain; the player needs the verdict |
| `CHARGE {n}%` | `Charging {n}%` | Verb form |
| `BEAM {n}%` | `Heat {n}%` | Says what the number is |
| `REDLINE {n}%` | `OVERHEAT {n}%` | The one earned caps badge — it's the alarm |
| `VENT {n}%` | `Cooling {n}%` | Plain language |
| `LOCK {n}s` | `Locked {n}s` | State, with countdown |
| `RELEASE` | `Ready` | "RELEASE" told the player to do something with no context |

**Bottom-left weapon line (`ArenaScene.ts:7743-7769`):**

| Current | Replacement |
|---|---|
| `⚔ Rare Keen Neon Katana ◆◆◇◇ · Q to cycle` | `⚔ Rare Keen Neon Katana ◆◆◇◇ · [Q]/[E] Switch` |
| `⟳ reloading…` | `⟳ Reloading…` (case policy only) |
| `heldWeapon?.name ?? self.weapon` | `?? "Unknown weapon"` |

**Drop/salvage hold bar (`ArenaScene.ts:7991`):**

| Current | Replacement |
|---|---|
| `hold: SALVAGE · release: DROP` | `[R] Hold to salvage · Release to drop` |
| `SALVAGED` | `Salvaged +{salvageValue(rarity)}` (show the payout — the bar's whole point is the greed decision) |

**Focus card (`card-art.ts:504-573`):**

| Current | Replacement |
|---|---|
| grip token `dual` / `2-hand` / `1-hand` (`card-art.ts:506`) | `Dual-wield` / `Two-handed` / `One-handed` |
| subtitle `dual · blade · fire` | `Dual-wield · Blade · Fire` (title-case each token) |
| stat rows `12 + 4.5 = 16.5` | unchanged — the WYSIWYG equation is locked design |
| durability bare number (`ArenaScene.ts:8370`) | unchanged number; the icon labels it |
| `BASE PREVIEW` (spec'd passive-focus label) | `Base preview` (case policy) |

**Belt arsenal HUD (`ArenaScene.ts:8590-8681`):**

| Location | Current | Replacement |
|---|---|---|
| `8625` | empty slot `—` | `Empty` (11 px, `#5c6672` — the dash reads as a rendering bug) |
| `8625` | `WEAPONS[wid]?.name ?? wid` | `?? "Unknown weapon"` |
| `8654` | `◈ 147 scrip     BAG 3/12  ·  Tab` | `◈ 147 Scrip · Pack 3/12 · [Tab] Backpack` |
| `8651` | `⚔ SET +15%` | `⚔ Set bonus +15%` |
| `8662` | `+12 ◈ SCRIP` | `+◈ 12 Scrip` |

**Shopkeeper (`ArenaScene.ts:8715-8730`):**

| Current | Replacement |
|---|---|
| `SHOP` (stall sign, far) | `TRADING POST` |
| `◈ F: TRADE` (near) | `[F] Trade` |
| `TRADING` (open) | `TRADING POST` + green tint (the state is already shown by the open panel; "TRADING" as a sign is odd) |

**Backpack / Trading panel (`ArenaScene.ts:8785-8925`):**

| Location | Current | Replacement |
|---|---|---|
| `8800` title | `BAG — click a weapon to equip · click a slot to stash · Tab to close` | Title `BACKPACK 7/12` + right-aligned hint line `[Click] Equip · [Tab] Close` (the slot-stow hint moves onto the slot chips themselves — see 3.4) |
| `8799` title | `SHOP — buy permanent upgrades (persist across runs) · click a weapon or slot to SELL · F to close` | Title `TRADING POST` + hint `[Click] Sell · [F] Close` + one-time sub-line under the upgrade band: `Upgrades are permanent — they carry across runs` |
| `8847` | `Rusty Cleaver  +6◈` | `Rusty Cleaver` + separate value chip `◈ 6` (see 3.3) |
| `8847` | `Rusty Cleaver  ·` (worthless — cryptic dot) | value chip reads `No value` in `#5a6472` (conjured weapons sell for nothing per `scripValue`; say so) |
| `8895` | `Vitality  1/3\n+20 max HP` | `Vitality 1/3` / `+20 max HP` (structure fine; see next rows for descs) |
| `meta.ts:23` desc | `+1 LUK (rarity·crit·harvest)` | `+1 LUK — better loot & crits` |
| `meta.ts:24` desc | `+1 STR (melee damage)` | `+1 STR — melee damage` |
| `meta.ts:22` desc | `+20 max HP` | unchanged |
| `8904` | `MAX` | `Maxed` |
| `8904` | `45 ◈` | `◈ 45` |
| — (missing) | *(no empty-state)* | Empty pack, centered: `Your pack is empty` + sub `Click a slot below to stow its weapon` (Backpack mode) / `Nothing to sell` (Trading mode) |
| — (missing) | *(no feedback when stow fails on full pack)* | `flashBanner("Pack full — 12/12", "#ff8a2b")` client-side when `bag.length >= BAG_CAP` before sending `bagStore` |
| — (missing) | *(no feedback on unaffordable upgrade click)* | `flashBanner("Not enough Scrip", "#ff8a2b")` |
| — (missing) | *(no confirmation on sell)* | reuse the existing scrip flash (`8662`) — it already covers this; no extra toast |

**Mode line (belt segment, `ArenaScene.ts:7851`):** `… R grab · 1/2/3 swap · Tab bag · F trade` → `… [R] Grab · [1-3] Swap · [Tab] Backpack · [F] Trade`. (The full mode-line rewrite is out of this panel's scope; only the belt segment's bag/trade vocabulary must match.)

---

## 3. The Backpack panel redesign

### 3.1 Layout — grid of item cards, dock visual language

Keep the bottom-centre anchor above the arsenal chips and the 4-column grid (`BAG_CAP = 12` → 4×3, `ArenaScene.ts:8812-8817`), but replace the text-only cells with **item cards** built from the dock's own parts:

```
┌──────────────────────────────────────────────────────────────┐
│ BACKPACK 7/12                        [Click] Equip · [Tab] Close │  header, 34s
│ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐ │
│ │▒art▒│ Name │ │▒art▒│ Name │ │▒art▒│ Name │ │▒art▒│ Name │ │  3 rows of
│ │▒▒▒▒▒│ Tier │ │▒▒▒▒▒│ Tier │ │▒▒▒▒▒│ Tier │ │▒▒▒▒▒│ Tier │ │  56s cells
│ └────────────┘ └────────────┘ └────────────┘ └────────────┘ │
│  … rows 2–3; empty cells = faint dashed outline …            │
└──────────────────────────────────────────────────────────────┘
        [1 chip]        [2 chip]        [3 chip]                   arsenal, unchanged pos
```

Exact geometry (all × existing `uiScale()` `s`):

- Panel: width `min(screenW − 80s, 720s)` (unchanged); height `= 34s header + bandH + 3×(56s + 8s) + 14s pad` → **240s** in Backpack mode (was 210s), plus the existing 74s upgrade band in Trading mode. Position formula unchanged (`8792-8793`).
- Cell: `cellW = (panelW − 32s)/4`, height **56s** (was 40s), corner 6s.
- Cell anatomy: 44×44s art thumbnail at left (reuse `bakeCardArt(scene, id, 212, 296, 14)` with the same `setCrop(0, 0, 212, 212)` square crop the dock chips use — one shared texture, zero new bakes); name 12s bold rarity-tinted, top-right of the art; tier line 10s (`Rare · Keen` when affix data is available on bag entries; tier alone otherwise) bottom-right; 1.5s rarity border (unchanged rule).
- **Empty cells render** (today they vanish, making capacity unreadable): 1s dashed `#3a3f47` outline at 0.5 alpha, no fill, no text. The player sees 12 sockets, 7 full.
- Name text floor 10s css; names over 16 chars ellipsize rather than shrink below the floor.

### 3.2 Capacity, sort order

- Capacity lives in the title: `BACKPACK 7/12`, and turns amber `#ff8a2b` at 12/12. Delete the duplicate `Pack 3/12` from the arsenal readout *while the panel is open* (it stays in the compact readout when closed).
- **Sort order (display only)**: tier descending → name ascending → stable. The server's `bag` array order is authoritative for messages, so the renderer builds `displayOrder: number[]` (sorted indices) and the click zone for visual cell `k` sends `bagEquip`/`sellWeapon` with `index: displayOrder[k]`. Never re-order the actual array; never let a sort change which index a message targets mid-click (rebuild `displayOrder` in the same pass that rebuilds zones, `8817-8858`).

### 3.3 Sell-value display (Trading mode)

Each occupied cell gains a bottom-right **value chip**: `◈ 6` at 11s bold, `#9cff6a` if `scripValue > 0`, or `No value` at 10s `#5a6472` for conjured/gallery weapons (`scripValue(rarity, earned)`, `packages/shared/src/loot.ts:140-143`). The cell border shifts from rarity colour to amber `#ffd24a` on hover to telegraph "this click sells". In Backpack mode the value chip is absent — price is trade-context information.

### 3.4 Interaction copy — affordances live on the things

- Occupied cell hover (Backpack): 1-line footer strip inside the panel bottom, 11s: `Equip Rusty Cleaver — swaps with slot 2` (active slot number live from `self.activeSlot`).
- Occupied cell hover (Trading): `Sell Rusty Cleaver for ◈ 6`.
- Slot chips (`8618-8630`) while panel is open gain a 9s overlay tag in the chip's top-right: `[Click] Stow` (Backpack) / `[Click] Sell` (Trading). This replaces the title trying to explain three different click targets in one sentence.
- Keyboard note in header hint only: `[Tab] Close` / `[F] Close`. One key per mode, matching the key that opened it (`3081-3099`).

### 3.5 Open/close choreography — the dock's fade grammar

The dock grammar is 120 ms cubic-out wake / 650 ms smoothstep idle / 150 ms cubic-in collapse (`8036-8065`, `8308-8317`). The panel is a deliberate modal, not an ambient watermark, so it uses the *deliberate* pair:

- **Open**: 120 ms, alpha 0→1 + rise 8s px, `Cubic.easeOut` — same curve and duration as dock wake.
- **Close**: 150 ms, alpha 1→0 + drop 8s px, `Cubic.easeIn` — same as focus collapse. Zones disable on frame 0 of the close, not at tween end.
- `prefers-reduced-motion`: snap both, per the existing `prefersReducedPaperMotion()` convention.
- No idle fade — an inventory the player opened stays at alpha 1 until closed. (It already blocks nothing new: it opens only in belt mode where the L-dock is hidden, `8380-8388`.)

### 3.6 Spatial coexistence with the dock

In belt mode the mirrored-L dock is hidden and the arsenal owns the bottom-centre (`ArenaScene.ts:8380-8388`); the panel keeps its bottom-centre anchor with no conflict. Rule for any future mode where both exist: the panel's right edge must stop `16d` left of `cornerLeft` (the dock junction's left edge from `weaponDockLayout`), and opening the panel sets the dock to its blocked/idle state via the existing `setCarouselDockBlocked` path (`8068-8084`) — one input owner at a time, consistent with the modal policy in `docs/carousel-panel/designer.md` §Modal policy.

---

## 4. Accessibility

- **Minimum text size**: hard floor **10 css px** after all scaling (`d`, `fit`, `s`) for any glyph the player must read; key badges and index may floor at 9. Nothing below 9 ever renders — prefer omission (the neighbour-chip name deletion in 1.4 is this rule applied).
- **Colourblind-safe tiers**: `RARITIES` colours (`loot.ts:40-48`) put Uncommon green `#59c96b` / Rare blue `#4aa3ff` / Really Rare teal `#2fd6c3` in deutan/protan collision range. Add a redundant **tier pip row**: 0–6 small diamonds (◆) under the tier name on the junction footer, focus card, and backpack cell — Common 0 … Ultimate 5, Cursed 6 drawn hollow (◇) with a dashed border on its card. Colour stays the fast channel; pips are the truthful one. Tier names are already written out wherever space allows, which is the strongest redundancy — never drop the word to save pixels.
- **Requirement met/unmet** (`refreshCarouselDockCard`, `ArenaScene.ts:8363-8365`) is currently green-vs-red only: prefix the number with `✓ ` / `✗ ` at the same size.
- **Ammo state colours** (green/amber/red, `8210-8217`): the `RELOADING` word and the pip/number count already carry the state redundantly — keep both, that's correct.
- **Text crispness**: retain `setResolution(max(2, ceil(devicePixelRatio)))` on every new text object (both existing patterns: `card-art.ts:154-156`, `ArenaScene.ts:7914`); all new plates/pips are vector Graphics, DPR-safe by construction.
- **Hit targets**: backpack cells at 56s ≥ 44 px at s ≥ 0.79 — meets the 44-px pointer-target guideline at every supported scale; slot chips (156×42s) already comply.

---

## 5. Implementer checklist (mechanical order)

1. `weapon-dock-layout.ts`: replace `DOCK_TIERS` values per 1.2; raise `fit` floor 0.74 → 0.80; export an `IDLE_DOCK_SCALE = 0.72` constant.
2. `ArenaScene.ts` `applyCarouselDockFade`: add the corner-anchored `0.72 + 0.28×p` scale on elbow/arms/tabs; move `loot` text from `truth` to `chrome` (with `card-art.ts` container change).
3. `card-art.ts`: junction/chip font sizes, footer height, ammo/index backing plates, key badge (replacing `order` text + deleting the chip `name` object and `shortDockName`), text shadows, tier pips.
4. `ArenaScene.ts`: apply every row of the §2.2 copy tables (junction strings `8193-8220`, tabs `8146-8153`, weapon line `7743-7769`, hold bar `7991`, beam strings `7519-7539`, arsenal `8618-8662`, shopkeeper `8715-8730`, panel `8796-8804`, upgrade band `8894-8908`).
5. `packages/shared/src/meta.ts:22-24`: the two upgrade desc strings.
6. `ArenaScene.ts` `renderBagPanel`: cell art thumbnails, 56s cells, empty-cell sockets, header/capacity, `displayOrder` sort mapping, value chips, hover footer, slot-chip overlay tags, open/close tweens, pack-full / not-enough-Scrip banners.

No new assets, no new textures beyond the already-cached `cardbg-*` bakes, no timing-grammar changes, no authority changes.
