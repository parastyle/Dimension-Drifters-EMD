# Level-up UI parity — technical implementation

## Decision

Bring the existing paper folio forward, rather than replace it. The parity target is: Hades-like context and semantic glow, Vampire Survivors/Brotato-like build deltas and draft controls, and Risk of Rain-like one-glance clarity. The modal should answer three questions in order: **what changes**, **why it fits this build**, and **what other choices are available**.

Do this with shared data, procedural frames/glows, existing icons, and the installed painted FX only. Do not invent augment rarity, do not put combat on a client-only clock, and do not move input back inside a transformed container.

## What exists now

The current state edge is good. `updateLevelWindow` gives FLEX priority over signature, fingerprints the pending counts and `sigOffer`, destroys the previous object set only when that fingerprint changes, and drives the bar from the authoritative integer-decisecond `flexTimerDs` (`packages/client/src/scenes/ArenaScene.ts:4432`, `packages/client/src/scenes/ArenaScene.ts:4435`, `packages/client/src/scenes/ArenaScene.ts:4438`, `packages/client/src/scenes/ArenaScene.ts:4452`). The wire timer is a projection of a precise server-only timer, patched at decisecond granularity (`packages/shared/src/state.ts:58`, `packages/shared/src/state.ts:61`, `packages/shared/src/state.ts:135`; `packages/server/src/rooms/GameRoom.ts:1626`). Keep that ownership.

The folio is also worth keeping. Only its shell backing folds; title, timer, card copy, and hit geometry stay face-on, and reduced-motion bypasses the fold (`packages/client/src/scenes/ArenaScene.ts:4394`, `packages/client/src/scenes/ArenaScene.ts:4400`, `packages/client/src/scenes/ArenaScene.ts:4403`). Card input is sent immediately, guarded by a one-send latch, while visual hover/deal motion remains cosmetic (`packages/client/src/scenes/ArenaScene.ts:4556`, `packages/client/src/scenes/ArenaScene.ts:4567`, `packages/client/src/scenes/ArenaScene.ts:4605`).

Preserve the scene-level P0 fix exactly. Both builders put an invisible `scrollFactor(0)` rectangle at the screen position outside the transformed card container; the source comment records that a zone inside the container hit-tested in world space once the camera had scrolled (`packages/client/src/scenes/ArenaScene.ts:4675`, `packages/client/src/scenes/ArenaScene.ts:4679`, `packages/client/src/scenes/ArenaScene.ts:4684`; `packages/client/src/scenes/ArenaScene.ts:4749`, `packages/client/src/scenes/ArenaScene.ts:4751`). Every new card, footer action, focus ring, and compact-layout row must retain that pattern.

Two correctness fixes precede visual parity:

1. The client shows FLEX first when both picks are owed, but one timeout currently resolves one FLEX **and** one signature pick, so the hidden signature screen may never appear (`packages/client/src/scenes/ArenaScene.ts:4435`; `packages/server/src/rooms/GameRoom.ts:2494`, `packages/server/src/rooms/GameRoom.ts:2495`, `packages/server/src/rooms/GameRoom.ts:2499`). Timeout must resolve only the currently visible priority: `if (flexPending) ... else if (sigPending) ...`, then refresh the timer for the next screen.
2. `AugmentDef.stacks` says whether repeats are legal, but the draft samples the whole eligible delivery pool and selection validates only “real id” plus “present in this offer”; it does not reject a second non-stackable copy (`packages/shared/src/augments.ts:15`, `packages/shared/src/augments.ts:24`, `packages/shared/src/augments.ts:229`; `packages/server/src/rooms/GameRoom.ts:994`, `packages/server/src/rooms/GameRoom.ts:999`). Filter maxed definitions while drafting and repeat the check at selection time. The card may say `MAXED` only after the server enforces it.

The earlier game-feel audit correctly treats changing the invincible-breather cadence as a design ruling, not a UI cleanup (`docs/GAMEFEEL_AUDIT.md:120`, `docs/GAMEFEEL_AUDIT.md:121`). This pass keeps the five-second authoritative cadence and makes that time easier to use.

## Final information architecture

### Header

Use one compact header line: `LEVEL 12 · CHOOSE 1 FLEX` or `LEVEL 15 · CHOOSE 1 SIGNATURE`, followed by a smaller context line. For FLEX, name the two automatic gains from the active character class instead of hard-coding `+1 STR +1 CON`; automatic allocation is actually derived from `classForCharacter(player.character)` (`packages/server/src/rooms/progression.ts:40`, `packages/server/src/rooms/progression.ts:43`). For signature, say `PARRY`, `GUN`, or `CAST` according to the offer context; server drafting already gates weapon-specific augments from the held delivery (`packages/shared/src/augments.ts:26`, `packages/shared/src/augments.ts:229`; `packages/server/src/rooms/GameRoom.ts:2478`).

The countdown should be both a bar and text (`4.3s`). The current bar is a fixed 380 px fill computed from `flexTimerDs / 10 / LEVELUP_WINDOW_SECONDS` (`packages/client/src/scenes/ArenaScene.ts:4452`, `packages/client/src/scenes/ArenaScene.ts:4457`). Keep the bar continuous between patches with a cosmetic interpolation toward the latest decisecond value, but never display more time than the newest authoritative sample.

### Build-context rail

Above the cards on wide screens, and as two wrapping chips on compact screens, show:

- held weapon name and its scaling grades;
- loadout class count and the live set bonus;
- relevant owned augment counts.

The three arsenal slots and active slot are already synced (`packages/shared/src/state.ts:119`, `packages/shared/src/state.ts:123`). `weaponSetBonus` derives the held class multiplier from those weapon ids and returns 1.08 at two matching weapons or 1.18 at three (`packages/shared/src/weapons.ts:307`, `packages/shared/src/weapons.ts:310`, `packages/shared/src/weapons.ts:322`). The current arsenal HUD already proves the client-side call and display path (`packages/client/src/scenes/ArenaScene.ts:7041`, `packages/client/src/scenes/ArenaScene.ts:7043`). Reuse the function; do not duplicate threshold logic in UI copy.

### Card scan order

Each card has four bands:

1. **Identity:** icon, name, category/delivery chip.
2. **Primary outcome:** one large green `before → after` line.
3. **Context:** at most two smaller facts, only when they change or explain a synergy.
4. **Status:** `NEW`, `OWNED ×2`, `NEXT STACK`, `MAXED`, `MEETS REQUIREMENT`, or `SYNERGY`.

Card paragraphs are a fallback, not the headline. The existing attribute cards show only the raw attribute increment and a generic sentence, while augment cards show name, tag, and description (`packages/client/src/scenes/ArenaScene.ts:4727`, `packages/client/src/scenes/ArenaScene.ts:4735`; `packages/client/src/scenes/ArenaScene.ts:4642`, `packages/client/src/scenes/ArenaScene.ts:4651`, `packages/client/src/scenes/ArenaScene.ts:4660`). The new primary outcome should be the actual build delta.

## Data the cards can show today

### Attribute cards

Build a pure `attributeChoicePreview(self, attr)` view model. Clone the five synced attributes, increment only the candidate attribute, and compare the shared functions before and after. Do not maintain a second tuning table in `ArenaScene`.

| Card fact | Exact display available now | Ground truth |
| --- | --- | --- |
| CON survivability | `Max HP 132 → 140 (+8)` and `Regen 8.8 → 9.5/s (+0.7)` | `deriveStats` is pure; CON contributes +8 HP and +0.7 HP/s per point (`packages/shared/src/leveling.ts:43`, `packages/shared/src/leveling.ts:75`). Allocation also immediately tops up newly gained maximum HP, so a `+8 current HP` subline is truthful (`packages/server/src/rooms/progression.ts:18`, `packages/server/src/rooms/progression.ts:23`). |
| DEX/LUK crit | current chance to next chance, in percentage points | Crit is a pure function of both stats: +0.8 points per DEX and +2 points per LUK, capped at 75% (`packages/shared/src/leveling.ts:47`, `packages/shared/src/leveling.ts:51`, `packages/shared/src/leveling.ts:57`). |
| LUK economy | `Harvest +4%` until cap; `rarity boost 1.06, compounded by tier` as secondary copy | Harvest is +4% per best-squad LUK over 1, capped at 50%, and rarity multiplies above-Common tier weights from the same LUK axis (`packages/shared/src/constants.ts:294`, `packages/shared/src/constants.ts:296`, `packages/shared/src/constants.ts:429`; `packages/shared/src/loot.ts:85`, `packages/shared/src/loot.ts:90`). Label harvest as **squad-best** context, because extraction uses `bestLuk()`, not necessarily the picker alone (`packages/server/src/rooms/GameRoom.ts:4468`, `packages/server/src/rooms/GameRoom.ts:4471`). |
| Weapon damage | per affected source, e.g. `shot 31 → 33` or `magma 9 → 10`; omit unaffected sources | Shared weapon definitions carry per-source grades; `weaponDamageSources` enumerates hit/shot/throw/quake/chain/scatter/blast, and `effectiveDamageMult` combines source scaling with requirement penalty (`packages/shared/src/weapons.ts:403`, `packages/shared/src/weapons.ts:414`, `packages/shared/src/weapons.ts:431`). The server then multiplies that result by loot identity and the class set bonus (`packages/server/src/rooms/GameRoom.ts:1165`, `packages/server/src/rooms/GameRoom.ts:1173`). |
| Requirement breakpoint | `Requirement met: STR 6` and the recovered damage penalty | Requirements and shortfall are shared; every missing point costs 12% down to a 25% floor (`packages/shared/src/weapons.ts:377`, `packages/shared/src/weapons.ts:383`, `packages/shared/src/weapons.ts:397`). |

For exact weapon numbers, calculate each source as `base × effectiveDamageMult × lootDamageMult × weaponSetBonus`; preserve `count` as copy (`6 × magma 10`) instead of multiplying it into a misleading single-hit number. The loot multiplier is shared and is the same multiplier used by the server (`packages/shared/src/loot.ts:113`; `packages/server/src/rooms/GameRoom.ts:1165`, `packages/server/src/rooms/GameRoom.ts:1173`).

There is one data gap to close before shipping those previews: `weaponDamageSources` handles gun and thrown primaries but currently falls through to a melee `hit` for cast weapons and never emits the cast bolt (`packages/shared/src/weapons.ts:431`, `packages/shared/src/weapons.ts:433`, `packages/shared/src/weapons.ts:448`, `packages/shared/src/weapons.ts:455`). Add a `def.cast` branch using `cast.damage` and `cast.scalingGrades`; otherwise an INT card can confidently show the wrong source, violating WYSIWYG.

### Augment cards

Without new content data, every augment card can already show `name`, `tag`, `desc`, `icon`, stackability, and optional `gun`/`cast` delivery (`packages/shared/src/augments.ts:15`, `packages/shared/src/augments.ts:29`). Owned stack counts are derivable from the synced augment CSV with the shared parser/count helper (`packages/shared/src/state.ts:63`; `packages/shared/src/augments.ts:207`, `packages/shared/src/augments.ts:213`).

Several next-stack numbers are already shared: Iron Stance adds 50% i-frame duration and 70% knockback per stack; Second Wind is `4 + 2 × (CON - 1)` healing per stack; Emberguard is `12 + 6 × (INT - 1)` damage; gun pierce/bounce add one; Overcharge adds 25% cast damage; Arc Split adds one bolt to a cap of three (`packages/shared/src/augments.ts:178`, `packages/shared/src/augments.ts:181`, `packages/shared/src/augments.ts:186`, `packages/shared/src/augments.ts:197`, `packages/shared/src/augments.ts:200`). Put their display math in a shared pure `augmentChoicePreview`, then have server mechanics and UI consume the same constants.

Synergy badges must describe actual activation, not keyword vibes. For example, Conflagration's current description says it combos with Brand, but the server schedules its second pulse only inside the Emberguard branch (`packages/shared/src/augments.ts:109`; `packages/server/src/rooms/GameRoom.ts:3373`, `packages/server/src/rooms/GameRoom.ts:3376`). Add structured optional metadata such as `requires?: string[]`, `synergizes?: string[]`, and `scalesWith?: Attr[]` to `AugmentDef`; these are shared static definition fields, so they require no Colyseus schema change. The initial truth should be `requires: ["emberguard"]`, `synergizes: ["brand"]` for Conflagration.

Do not call the existing accent a rarity. `AugmentDef` has no rarity or quality field, and the current three colors are mapped from `riposte`, `aegis`, and `hex` tags (`packages/shared/src/augments.ts:13`, `packages/shared/src/augments.ts:15`; `packages/client/src/scenes/ArenaScene.ts:4474`). Use a restrained category halo, a brighter synergy halo, and a desaturated `MAXED` state. A Hades-style randomized rarity layer should wait until tiers actually alter an augment's authoritative effect; cosmetic “Epic” copy with identical mechanics would break the doctrine.

## Reroll, skip, and banish are server features

The client must never generate an offer, charge, exclusion, or skip result. The existing signature offer is server-rolled, serialized on `PlayerState`, and selection is accepted only when the id belongs to that offer (`packages/shared/src/state.ts:66`, `packages/shared/src/state.ts:69`; `packages/server/src/rooms/GameRoom.ts:2478`, `packages/server/src/rooms/GameRoom.ts:994`). Extend that contract instead of adding local buttons over it.

Recommended semantics:

| Action | Message | Server mutation | Timer rule |
| --- | --- | --- | --- |
| Choose FLEX | `chooseAttribute { offerSeq, attr }` | Validate the current FLEX screen, allocate one, consume one pending point. | Existing next-screen refresh. |
| Choose augment | `chooseAugment { offerSeq, id }` | Validate current signature screen, eligibility, stackability, and membership; append one owned id and consume one signature pick. | Existing next-screen refresh. |
| Reroll | `rerollAugmentOffer { offerSeq }` | Spend one synced reroll charge; draft a replacement excluding banished/maxed ids and, when the pool permits, all current ids; increment `offerSeq`. | **Do not refresh.** Resetting grants more invincible time and makes reroll a survival exploit. |
| Banish | `banishAugment { offerSeq, id }` | Validate offered id; spend one synced banish charge; persist the exclusion; replace only that card; increment `offerSeq`. The pick remains open. | **Do not refresh.** |
| Skip signature | `skipAugment { offerSeq }` | Consume the current signature pick without granting an augment; clear the offer and increment `offerSeq`. | Refresh only if another pick is pending. |

Do not offer “skip FLEX” as “lose a stat point”; that changes the locked three-points-per-level progression (`packages/shared/src/leveling.ts:2`, `packages/server/src/rooms/progression.ts:40`). If a low-friction escape is required, label it `AUTO-ASSIGN` and invoke the same class-attribute fallback used by timeout (`packages/server/src/rooms/GameRoom.ts:2495`).

### Offer epoch and validation

Append these fields to the **end** of `PlayerState`:

```ts
@type("uint32") levelOfferSeq = 0;
@type("uint8") augmentRerolls = 1;
@type("uint8") augmentBanishes = 1;
@type("string") banishedAugments = "";
```

The epoch is required for choices as well as rerolls. Today a modified client can replay valid `chooseAttribute` messages against multiple stacked `flexPending` points, and the per-tick action budget is a flood limit rather than idempotency (`packages/server/src/rooms/GameRoom.ts:511`, `packages/server/src/rooms/GameRoom.ts:982`, `packages/server/src/rooms/GameRoom.ts:985`). It also guarantees a UI rebuild when a reroll happens to reproduce the same CSV; the current key contains offer text but no monotonic identity (`packages/client/src/scenes/ArenaScene.ts:4438`). Increment it before every newly visible decision and every in-place offer replacement.

For every level-window message, validate in this order: action budget; player exists and is alive; expected mode is pending; `offerSeq` is a finite integer equal to the synced epoch; remaining charge if applicable; type guard; current offer membership; delivery/banish/max-stack eligibility. Mutate counts, offer, epoch, and timer atomically. A stale choice that arrives after timeout or reroll then fails by epoch even if its id also appears in the replacement.

Lock build-changing RPCs while `inLevelWindow(player)` is true. Slot swaps currently require only a living player, while the signature draft is gated from whichever weapon was held when the server rolled it (`packages/server/src/rooms/GameRoom.ts:692`, `packages/server/src/rooms/GameRoom.ts:695`; `packages/server/src/rooms/GameRoom.ts:2478`). Either rejecting cycle/swap/grab/drop/character changes for that player or binding an explicit offer delivery to state is necessary; rejecting them for five seconds is simpler and matches the modal.

### Schema discipline

Colyseus field order is a wire contract. The repository explicitly requires appending synced fields and bumping `SCHEMA_VERSION` whenever a field is added, removed, reordered, or retyped (`packages/shared/src/state.ts:100`; `packages/shared/src/constants.ts:8`, `packages/shared/src/constants.ts:13`). Keep the legacy timer slot and `flexTimerDs` where they are; append after the present last player field (`packages/shared/src/state.ts:58`, `packages/shared/src/state.ts:135`). Reset the new per-run fields beside the existing pending picks and augment CSV on restart (`packages/server/src/rooms/GameRoom.ts:1378`, `packages/server/src/rooms/GameRoom.ts:1381`).

Server tests must pin: same-epoch replay consumes once; stale epoch consumes nothing; timeout resolves only the visible mode; maxed non-stackables never draft or select; reroll/banish never refresh invincibility time; exclusions survive later signature levels; skip consumes signature but not FLEX; invalid/off-offer ids and exhausted charges are no-ops; and a reproduced CSV still advances the epoch.

## Input, layout, and accessibility

### Modal input router

The dim rectangle blocks pointer events behind the panel, but normal scene keyboard handling still runs before `updateLevelWindow`; Q/E, slot keys, training/debug keys, character cycling, and other actions are processed in the main update path (`packages/client/src/scenes/ArenaScene.ts:2608`, `packages/client/src/scenes/ArenaScene.ts:2679`, `packages/client/src/scenes/ArenaScene.ts:2701`, `packages/client/src/scenes/ArenaScene.ts:2735`, `packages/client/src/scenes/ArenaScene.ts:2792`). Add an early `handleLevelWindowInput(self)` branch after reading self state: while either pending count is nonzero, route number keys/arrows/Enter and footer shortcuts only, while networking, sync, rendering, and HUD updates continue.

Fix the asymmetric attack guard at the same time. Parry blocks both pending modes, but local attack animation/send currently blocks only FLEX (`packages/client/src/scenes/ArenaScene.ts:5627`; `packages/client/src/scenes/ArenaScene.ts:5813`). Use one client `inLevelWindow` predicate matching the server's definition (`packages/server/src/rooms/GameRoom.ts:1620`).

Keyboard/controller focus must drive the same scene-level rectangles as pointer input. `1–5` selects a FLEX card, `1–3` selects an augment, arrows/D-pad move focus, Enter/A chooses, `R` rerolls, `X` banishes the focused augment, and `S` skips. Show shortcuts only for available actions. After any send, disable every card and footer zone; if the authoritative epoch has not changed after a short acknowledgement timeout, re-enable the unchanged screen instead of leaving a rejected request dead until auto-pick. The current latch otherwise remains set until the offer fingerprint changes (`packages/client/src/scenes/ArenaScene.ts:4445`, `packages/client/src/scenes/ArenaScene.ts:4606`).

### Responsive composition

The current FLEX row is 814 px wide (`5 × 150 + 4 × 16`) while the folio panel caps at 780 px; the augment row is 632 px wide (`3 × 196 + 2 × 22`), and the panel height is a fixed 400 px (`packages/client/src/scenes/ArenaScene.ts:4495`, `packages/client/src/scenes/ArenaScene.ts:4496`; `packages/client/src/scenes/ArenaScene.ts:4625`, `packages/client/src/scenes/ArenaScene.ts:4627`; `packages/client/src/scenes/ArenaScene.ts:4702`, `packages/client/src/scenes/ArenaScene.ts:4704`). This needs reflow, not smaller unreadable type.

Use CSS-pixel breakpoints because `screenW/screenH` already divide the DPR-scaled camera buffer back to visible CSS units (`packages/client/src/scenes/ArenaScene.ts:1484`, `packages/client/src/scenes/ArenaScene.ts:1486`).

| Tier | FLEX | Signature | Footer |
| --- | --- | --- | --- |
| `w ≥ 980` and `h ≥ 620` | five equal cards in one row | three equal cards in one row | actions centered below cards |
| `620 ≤ w < 980` or short landscape | `3 + 2` grid | three compact cards in one row, reduced description width | actions at lower-right, context chips wrap |
| `w < 620` or portrait | five horizontal 52–60 px rows | three horizontal 88–104 px rows, icon left and delta/status right | full-width 44 px action row |

Keep a minimum 44 CSS px hit target, safe inset of 16–24 px, and a text floor of 14 CSS px. Compact mode removes decorative whitespace and secondary copy before shrinking the primary result. The existing `uiScale()` has a minimum of 1 and is designed only to grow the HUD on large screens, so it is not a small-screen solution (`packages/client/src/scenes/ArenaScene.ts:1493`, `packages/client/src/scenes/ArenaScene.ts:1496`).

Include layout tier and rounded `screenW/screenH` in the window fingerprint, or explicitly invalidate `levelWinKey` on resize. The current resize handler resizes the camera and redraws only the vignette, while the modal key contains state but no viewport dimensions (`packages/client/src/scenes/ArenaScene.ts:1447`, `packages/client/src/scenes/ArenaScene.ts:1451`; `packages/client/src/scenes/ArenaScene.ts:4438`). Rebuilding on a breakpoint/size edge is cheap because the modal owns a bounded object list.

For crisp text, apply a single modal text factory that sets resolution using the render DPR. The canvas is rendered at capped device DPR and laid out in CSS units (`packages/client/src/render-dpr.ts:2`, `packages/client/src/render-dpr.ts:12`), and the existing card renderer already raises Phaser Text resolution because the default texture becomes soft under hi-DPI scaling (`packages/client/src/scenes/arena/card-art.ts:368`, `packages/client/src/scenes/arena/card-art.ts:370`).

## Visual treatment with no new renders

Use procedural rounded rectangles, double strokes, corner ticks, thin separators, tag-color underlines, and alpha pulses. Do not depend on a bloom filter for the “rarity”/synergy halo: the VFX runtime disables its per-object bloom when `RENDER_DPR !== 1` because the filter framebuffer misaligns under the zoomed camera (`packages/client/src/vfx/VfxPlayer.ts:254`, `packages/client/src/vfx/VfxPlayer.ts:260`). Two or three expanding low-alpha strokes plus a narrow additive edge give a stable DPR-safe glow.

Reuse `drawIcon` for card identity, as the current augment builder already does (`packages/client/src/scenes/ArenaScene.ts:4641`). A confirmed selection may use a small painted spark burst only after adding a screen-space/parent option to the particle helper: `particleBurst` currently creates ordinary scene images and never sets `scrollFactor(0)`, so calling it with modal coordinates would reproduce the camera-space class of bug the P0 hit rectangles fixed (`packages/client/src/vfx/particles.ts:37`, `packages/client/src/vfx/particles.ts:56`). The helper already no-ops when a texture is missing, so a procedural rosette/spark fallback remains mandatory (`packages/client/src/vfx/particles.ts:45`, `packages/client/src/vfx/particles.ts:47`).

The 12 component packs, including lightning-ball and storm-call, are available in the existing composer (`packages/client/src/vfx/fx-composer.ts:17`, `packages/client/src/vfx/fx-composer.ts:19`, `packages/client/src/vfx/fx-composer.ts:25`). Reserve them for a rare accepted-pick flourish tied to a matching augment family; a storm animation behind every card would reduce clarity and turn combat FX into menu wallpaper.

## Client-only visual slow-motion

Do **not** slow, pause, or globally time-scale the combat world for one client's modal. The server freezes the choosing player inside the per-player loop and excludes that player from damage while enemy AI, duelists, bosses, spitters, and projectiles continue stepping (`packages/server/src/rooms/GameRoom.ts:1620`, `packages/server/src/rooms/GameRoom.ts:1713`, `packages/server/src/rooms/GameRoom.ts:1716`, `packages/server/src/rooms/GameRoom.ts:2014`, `packages/server/src/rooms/GameRoom.ts:2069`, `packages/server/src/rooms/GameRoom.ts:2138`). The client continues syncing players, enemies, and projectiles, then interpolating and moving them under the overlay (`packages/client/src/scenes/ArenaScene.ts:2740`, `packages/client/src/scenes/ArenaScene.ts:2743`, `packages/client/src/scenes/ArenaScene.ts:2745`, `packages/client/src/scenes/ArenaScene.ts:2772`, `packages/client/src/scenes/ArenaScene.ts:2774`). Slowing that presentation for seconds would make a co-op teammate and enemy bullets visibly diverge from what can hit them, then require a catch-up jump—directly contrary to WYSIWYG.

Safe “slowmo feel” is modal-local only: a 100 ms dim fade, the existing folio fold, slightly reduced ambient-dust alpha, restrained audio ducking, and UI tweens on their own scale. Keep authoritative entity interpolation, projectile motion, the countdown, network input, and teammates at real time. If the director wants true combat slow motion, it must be a server room policy affecting every client and all simulation clocks; that is a separate co-op design feature, not level-panel polish.

## Build order

1. **Correctness first:** make timeout resolve only the visible mode; enforce non-stackable eligibility in draft and choice; centralize the client/server `inLevelWindow` gates; add regression tests.
2. **Shared card facts:** fix the missing cast source, add pure attribute/augment preview view models and structured augment synergy metadata, and test representative STR/DEX/INT/CON/LUK plus multi-source weapons.
3. **Responsive shell:** split layout computation from object creation; implement wide/medium/compact tiers, modal text resolution, resize invalidation, keyboard/controller focus, and scene-level zones for every target. Keep the current folio/reduced-motion paths.
4. **Authoritative draft actions:** append epoch/charge/banish state, bump `SCHEMA_VERSION`, implement and adversarially test reroll/banish/skip messages, restart resets, timeout races, and replay rejection.
5. **Wire the footer:** render counts and disabled states from synced state; send epoch on every action; animate only after authoritative state changes. Add the acknowledgement recovery path.
6. **Polish last:** procedural category/synergy glows, existing iconography, one bounded accepted-pick burst, audio duck/sting, and reduced-motion equivalents. Do not add cosmetic rarity tiers.

## Acceptance gates

- At 390×844, 844×390, 1366×768, 1920×1080, and 2560×1440 at DPR 1/1.5/2, every card and footer target is visible, at least 44 CSS px, and text is crisp.
- With the camera far from world origin, every card and action remains clickable throughout deal, hover, resize, reroll, and folio motion.
- A level-five timeout shows and resolves FLEX first, then opens a full fresh signature screen; it never silently grants the hidden first augment.
- Exact card deltas match server damage, requirement, crit, survivability, harvest, set-bonus, and augment-stack tests.
- Replayed, stale, malformed, off-offer, maxed, banished, or exhausted-charge messages make no mutation.
- In two clients, the picker sees the same real-time teammate/enemy/projectile positions as the non-picker; only the modal presentation is eased.
- Reduced-motion mode removes folds, pulses, and particle flourish without removing focus, hierarchy, countdown, status, or feedback.
