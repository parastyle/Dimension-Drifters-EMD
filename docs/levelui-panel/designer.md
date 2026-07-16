# Level-Up UI Parity — Senior UX/Game Design Specification

## The decision

Ship the level-up as a **ten-second shared breather with individual, authoritative choices**. The folio opens once, gives each player a clear build decision, and closes as soon as everyone is ready or the one hard deadline expires. A fifth-level FLEX pick and its Signature pick share that same deadline; they must not become two back-to-back ten-second interruptions.

The target is not a copy of Hades, Vampire Survivors, Brotato, or Risk of Rain. It combines:

- Hades' sense of provenance and power: the player immediately knows the family, rarity, and build context of an offer.
- Vampire Survivors' fast card scan and explicit remaining Reroll/Skip/Banish counts.
- Brotato's exact stat comparison and visible set progress, adapted to DD's dimension-chain economy instead of importing a material shop. The repository's own parity audit makes the same adaptation argument and identifies DD's in-run window, squad XP, and existing class set bonuses as the relevant differences (`docs/BROTATO_PARITY.md:3-17`, `docs/BROTATO_PARITY.md:34-45`).
- Risk of Rain's discipline: an effect is understandable from icon, name, verb, and number before flavor enters the picture.

Success means a first-time player can answer, within two seconds: **What are my choices? What changes numerically? What fits my build? How long do I have? What happens if I do nothing?**

## Current-state diagnosis

The current feature has a sound skeleton, but not yet the information design or co-op contract expected of a modern survivor-like.

### What is worth keeping

- The offer edge is clean: `updateLevelWindow` fingerprints the current level, pending counts, and Signature CSV, destroys the old objects only when that key changes, then builds FLEX before Signature (`packages/client/src/scenes/ArenaScene.ts:4432-4459`). This is the correct lifecycle seam for present, replace, confirm, and close animations.
- The folio already follows the paper-craft grammar: a 100 ms dim fade leads into a 320 ms two-piece fold with a signed `scaleY` crossing and an edge-on depth swap (`packages/client/src/scenes/ArenaScene.ts:4395-4429`). The style bible explicitly requires semantic turns to cross zero through the sheet and names the level-up folio as a signature use of that rule (`docs/paper-panel/art-director.md:11-23`, `docs/paper-panel/art-director.md:65-69`).
- Cards already stagger by 42 ms, keep their copy face-on, and use the backing as the turning cardstock (`packages/client/src/scenes/ArenaScene.ts:4557-4580`). Preserve that separation; readable text must never mirror.
- The scene-level invisible rectangles are the correct P0 input fix. They remain in fixed screen space while the visual card lives in a container, avoiding the old world-space hit-test failure after camera movement (`packages/client/src/scenes/ArenaScene.ts:4675-4691`, `packages/client/src/scenes/ArenaScene.ts:4749-4763`). Every redesign must preserve scene-level hit geometry and keep it synchronized with the card's final bounds.
- Selection is already single-send guarded, disables card input, sends immediately, and waits for the authoritative offer edge to close (`packages/client/src/scenes/ArenaScene.ts:4605-4615`). Preserve the zero-latency send; confirmation animation is feedback, not a delay before the message.
- The level edge already produces a world-space gold burst and audio, while the toast is deliberately above the modal and avoids camera shake (`packages/client/src/scenes/ArenaScene.ts:6293-6299`, `packages/client/src/scenes/ArenaScene.ts:6517-6562`). Keep the local celebration and the no-UI-shake rule.

### What is below the genre bar

1. **The timer is five seconds, not the required ten.** The shared constant is `5`, the precise timer is server-only, and the client receives only integer deciseconds (`packages/shared/src/leveling.ts:17-20`, `packages/shared/src/state.ts:58-62`, `packages/shared/src/state.ts:134-135`). The current bar is only a 380×6 px fill with no number or stated timeout result, and its width is driven directly from `flexTimerDs / 10 / LEVELUP_WINDOW_SECONDS` (`packages/client/src/scenes/ArenaScene.ts:4516-4527`, `packages/client/src/scenes/ArenaScene.ts:4452-4459`).
2. **A fifth-level decision can chain.** FLEX is always shown before Signature, and consuming a FLEX point refreshes the timer while anything remains owed (`packages/client/src/scenes/ArenaScene.ts:4435-4450`, `packages/server/src/rooms/progression.ts:26-31`). Signature selection can refresh it again (`packages/server/src/rooms/GameRoom.ts:994-1007`). That turns one level moment into repeated modal time.
3. **The cards state categories, not outcomes.** FLEX currently shows `current → current + 1` plus a broad phrase such as “+ melee damage” or “+ rarity, crit & harvest” (`packages/client/src/scenes/ArenaScene.ts:4463-4472`, `packages/client/src/scenes/ArenaScene.ts:4696-4764`). It does not show the held weapon's real damage delta, crit percentage-point change, requirement breakpoint, max-HP gain, regen gain, harvest change, or set context.
4. **Signature copy is an unstructured paragraph.** `AugmentDef` has one `desc`, one icon id, a flavor tag, stackability, and an optional weapon gate; it has no rarity, numeric delta model, prerequisite, synergy, or presentation fields (`packages/shared/src/augments.ts:13-29`). The card renders that description verbatim under name and tag (`packages/client/src/scenes/ArenaScene.ts:4619-4692`).
5. **The current Signature roller can offer strategically invalid repeats or dependencies.** It filters only by weapon kind, chooses three distinct ids within that roll, and is not passed the player's owned or banished set (`packages/shared/src/augments.ts:224-240`). Yet some definitions are non-stackable, and Conflagration only produces a second pulse inside the Emberguard branch (`packages/shared/src/augments.ts:84-115`, `packages/server/src/rooms/GameRoom.ts:3373-3386`). Offer eligibility must understand ownership and prerequisites.
6. **Hover currently makes the backing narrower.** It lifts the root 4 px but changes `scaleX` to `0.965`, and it provides no persistent comparison/detail region (`packages/client/src/scenes/ArenaScene.ts:4581-4603`). That reads as a polite paper twitch, not confident focus or magnification.
7. **There is no modal keyboard route.** The scene key map includes movement/combat, Tab, Space, and only number keys 1–3 (`packages/client/src/scenes/ArenaScene.ts:1373-1398`); level cards bind pointer events in `prepareLevelCard` (`packages/client/src/scenes/ArenaScene.ts:4581-4615`). Keyboard focus, direct 4/5 selection, confirm, and economy commands are absent.
8. **Timeout chooses position, not intent.** The server auto-allocates FLEX to the class attribute, but Signature takes the first offered id; it then starts another full timer if anything remains (`packages/server/src/rooms/GameRoom.ts:2472-2506`). The UI never tells the player which automatic result is armed.
9. **The co-op protection and targeting stories disagree.** XP is applied to every player, so the squad levels in lockstep (`packages/server/src/rooms/GameRoom.ts:2465-2469`). A chooser is movement/action gated and immune to contact damage (`packages/server/src/rooms/GameRoom.ts:1711-1724`, `packages/server/src/rooms/GameRoom.ts:1904-1919`, `packages/server/src/rooms/GameRoom.ts:2133-2143`), but the enemy target list includes every alive player's position, including choosers (`packages/server/src/rooms/GameRoom.ts:1756-1763`, `packages/server/src/rooms/GameRoom.ts:2070-2077`). This is how a “safe” window can close into a pile of enemies.
10. **The shell is not responsive enough for its own content.** Its panel is capped at 780 px, while five 150 px cards plus four 16 px gaps require 814 px before any outer margin (`packages/client/src/scenes/ArenaScene.ts:4495-4501`, `packages/client/src/scenes/ArenaScene.ts:4696-4705`).

## Experience contract

### One event, one deadline

When squad XP crosses one or more level thresholds:

1. The authoritative server opens one `offerId` with one `expiresAtTick`, ten seconds in the future.
2. All owed FLEX marks and Signature picks are placed inside that offer.
3. The folio opens immediately. Input zones are active from frame one even while the paper unfolds.
4. Each player resolves their own marks and Signature cards. The timer never resets on a pick, page change, reroll, or banish.
5. The event ends when every connected living player is ready or the deadline expires.
6. At expiry, all unresolved choices use the exact auto-results printed in the header.

The server already advances an authoritative 20 Hz tick and syncs it on `ArenaState`; use that clock for an expiry tick rather than inventing a second client clock (`packages/shared/src/constants.ts:15-18`, `packages/shared/src/state.ts:313-317`). The existing decisecond value can remain as a compatibility field, but the visible bar should derive from `expiresAtTick - state.tick` and locally interpolate only between known tick samples.

### Fifth levels and stacked levels

- **Ordinary level:** allocate all owed FLEX marks, then ready.
- **Every fifth level:** allocate FLEX, then the lower page turns through the plane to Signature without rebuilding the shell or resetting the deadline. Signature currently occurs every five levels (`packages/shared/src/augments.ts:164-168`).
- **Multiple levels in one XP grant:** show `ALLOCATE 3 GROWTH MARKS`, not three modal rebuilds. Repeatedly choosing a stat increments the preview on that card. A compact `3 → 2 → 1` mark counter sits beside the header. Once all FLEX marks are assigned, advance to however many Signature drafts are owed. The one event still has one ten-second ceiling.
- **Timeout with work remaining:** allocate remaining FLEX marks to the printed class recommendation and select the printed Signature recommendation for each unresolved pick. No reward is silently lost.

This preserves the existing progression rule—two automatic class/requirement points plus one player-directed FLEX mark per level—while improving how pending marks are presented (`packages/server/src/rooms/progression.ts:33-51`).

## Layout

At 1280×720 and above, use a 1040×590 folio. The world remains visible around it under a vignette-like ink wash; do not blur the battlefield or hide the local player's position.

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ LEVEL 15  •  SIGNATURE                    AUTO: EMBERGUARD IN 07.8       │
│ [P1 READY] [P2 CHOOSING] [P3 READY]       ████████████████░░░░░░        │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────┐   ┌─────────────────┐   ┌─────────────┐                 │
│  │ RARE        │   │ LEGENDARY       │   │ COMMON      │                 │
│  │    ICON     │   │      ICON       │   │    ICON     │                 │
│  │ EMBERGUARD  │   │ CONFLAGRATION   │   │ SECOND WIND │                 │
│  │ Fire wave   │   │ Repeat the wave │   │ Heal/parry  │                 │
│  │ 38 → 44 dmg │   │ +1 delayed wave │   │ 12 → 20 HP  │                 │
│  │ [HEX 2]     │   │ [EMBER ✓] [HEX] │   │ [AEGIS 1]   │                 │
│  └─────────────┘   └─────────────────┘   └─────────────┘                 │
│                                                                          │
├──────────────────────────────────────────────────────────────────────────┤
│ FOCUSED DETAIL: exact stack math • prerequisites • held-weapon context   │
│ [R] REROLL ×2     [B] BANISH ×1     [X] SKIP ×1 → +1 INT                │
└──────────────────────────────────────────────────────────────────────────┘
```

Layout rules:

- Header band: level, step (`GROWTH` or `SIGNATURE`), remaining marks, co-op readiness, explicit auto-result, numeric countdown, and bar.
- Choice band: five equal compact stat cards or three wider Signature cards. The focused card rises above siblings but never overlaps their hit rectangles.
- Detail band: stable height; content changes without moving the cards. This is where full math and longer context live.
- Economy band: present only for a randomized Signature draft. A deterministic all-five-attribute page must not show a meaningless Reroll or Banish.
- At 900–1099 px wide, FLEX becomes a 3+2 grid and Signature remains a three-card row. Below 900 px, FLEX is a 2+2+1 grid and the detail band becomes a fixed right-side drawer or a one-line footer plus `TAB: DETAILS`. Never reduce body copy below 16 px merely to keep one row.
- The dim should be `0.48` at the edges and approximately `0.30` in a broad procedural clear area around the local player. The current flat `0.66` overlay is visually safe but unnecessarily erases combat context (`packages/client/src/scenes/ArenaScene.ts:4488-4493`).

## Card anatomy

Every card is a physical object with a strict scan order. The front face contains only what is needed to choose; the detail band contains proof.

1. **Frame and tier word.** Rarity is always written (`COMMON`, `RARE`, `LEGENDARY`) and reinforced by color, corner cut, and a small glyph. Attribute cards use `ATTRIBUTE`, not a fake rarity.
2. **Icon.** 56–72 px visual anchor. Reuse `drawIcon` vocabulary for current augments and attributes; current Signature cards already source `def.icon` through that renderer (`packages/client/src/scenes/ArenaScene.ts:4640-4641`).
3. **Name.** One or two lines, never auto-shrunk below 20 px.
4. **WHAT IT DOES.** One verb-led line, 42 characters preferred, 58 hard maximum: “Parry erupts a fire wave.” Never start this line with lore.
5. **Numeric delta.** The most decision-relevant before/after result in tabular numerals: `38 → 44 DAMAGE (+6)`, `12.6% → 14.6% CRIT (+2.0 pp)`, or `1 → 2 FORKS`. If a card adds a mechanic rather than changing a prior number, say `NEW • 1 FIRE WAVE`.
6. **Synergy chips.** Two visible, three maximum: real set context, prerequisite state, owned stack, or weapon relevance. Examples: `CASTER 2/3 • +8%`, `EMBERGUARD ✓`, `OWNED ×1 → ×2`, `NO HELD SCALING`.
7. **Input hint.** A small slot number in the top-left corner, shown only for the active input family.

### The one-line rule

The face answers one question: **what changes if I take this now?** Examples:

| Offer | WHAT IT DOES | Numeric line | Chips |
|---|---|---|---|
| STR | Raises STR-scaled weapon sources. | `BLADE 42 → 45 (+3)` | `STR A`, `REQ 9/10 → 10/10` |
| DEX | Raises DEX scaling and crit chance. | `CRIT 12.6% → 13.4% (+0.8 pp)` | `2 SOURCES`, `RANGED 2/3` |
| CON | Raises max HP and regeneration. | `HP 132 → 140 • REGEN +0.7/s` | `AEGIS`, `SURVIVAL` |
| LUK | Raises crit, harvest, and high-tier odds. | `CRIT +2.0 pp • HARVEST +4 pp` | `LUCK-SCALED GUN` |
| Hollow-Points | Bullets pass through one more enemy. | `PIERCE 2 → 3 (+1)` | `RANGED`, `OWNED ×1 → ×2` |
| Overcharge | Arcane bolts deal more damage. | `BOLT 48 → 60 (+12)` | `CAST`, `OWNED ×1 → ×2` |
| Conflagration | Repeats your Emberguard wave. | `WAVES 1 → 2 (+1)` | `EMBERGUARD ✓`, `BRAND: COMBO` |

The exact CON, crit, and harvest per-point changes already exist as shared constants: +8 max HP and +0.7 HP/s per CON, +2 percentage points per LUK, +0.8 percentage points per DEX, and +4 percentage points of harvest per LUK until cap (`packages/shared/src/leveling.ts:43-59`, `packages/shared/src/constants.ts:294-297`). Weapon deltas must use the existing grade coefficients and effective damage function rather than a second UI formula (`packages/shared/src/weapons.ts:331-355`, `packages/shared/src/weapons.ts:403-411`).

### Detail band

On hover/focus, show:

- one complete sentence of rules text;
- all affected live damage sources from the held weapon, not only the headline source;
- base → new value → absolute delta → percent delta;
- requirement threshold changes and removed penalties;
- owned stack count and the next stack's exact effect;
- prerequisite and combo explanation;
- current weapon class set progress.

DD already defines a real 2-of-class `+8%` and 3-of-class `+18%` weapon set bonus (`packages/shared/src/weapons.ts:307-328`). Show `MELEE/RANGED/CASTER n/3` from that system. The augment tags `riposte`, `aegis`, and `hex` are currently organizing flavor, not mechanical set thresholds (`packages/shared/src/augments.ts:13-19`). Therefore:

- `HEX • 2 OWNED` is valid collection context.
- `HEX 2/3 SET BONUS` is forbidden until a real threshold and effect exist in shared simulation data.
- A chip that does not change because of the current pick is muted context; a chip the pick advances uses `2 → 3` and shows the unlocked number.

This is WYSIWYG applied to progression: no decorative threshold, rarity, or “synergy” may imply a mechanic the server does not execute. The same repository doctrine requires the visible weapon path and authoritative hit path to remain aligned (`packages/shared/src/melee.ts:6-12`).

## Rarity model

Do not apply loot rarity colors to a plain `+1` attribute mark. That would claim different power where none exists.

Signature cards gain a static **impact tier**:

- **Common:** stackable numeric improvement; high availability; clean ink frame.
- **Rare:** unique mechanic or build starter; saturated edge, soft painted mote halo.
- **Legendary:** prerequisite-gated combo payoff; gold double edge, named prerequisite chip, restrained lightning crease.

Recommended initial classification:

- Common: Twin Fang, Iron Stance, Second Wind, Hollow-Points, Ricochet Rounds, Overcharge, Arc Split.
- Rare: Counterblade, Hair-Trigger, Deflector, Bulwark, Emberguard, Brand.
- Legendary: Conflagration, eligible only while Emberguard is owned.

Rarity must be shared offer data, not client inference. The server owns the roll and the client renders the resulting tier. Do not let LUK change Signature rarity in the first pass: LUK already changes weapon rarity odds and its card must describe that existing effect honestly (`packages/shared/src/loot.ts:85-96`, `packages/shared/src/constants.ts:429-431`). Revisit LUK-to-Signature weighting only after balance telemetry exists.

Offer rules:

- Exclude already-owned non-stackable augments.
- Include stackable augments and show `×n → ×n+1`.
- Enforce prerequisites before rolling; Conflagration requires Emberguard.
- Preserve the current weapon-kind gate for gun/cast offers (`packages/shared/src/augments.ts:224-233`).
- Never show two cards with the same id in one spread.
- A reroll cannot immediately return a rejected id during the same `offerId` unless the eligible pool is exhausted.
- If fewer than three eligible cards remain, show the real count and disable Banish; do not manufacture duplicates.

## Pick economy

Use **per-run, per-player charges**, not Scrip or salvage. Scrip is already a distinct permanent/meta currency (`packages/shared/src/state.ts:126-133`), and spending it inside a ten-second combat interruption would create cross-economy anxiety instead of a build choice.

Starting allowance:

| Action | Start | Cost | Result | Deadline behavior |
|---|---:|---:|---|---|
| Reroll | 2 | 1 charge | Replace all Signature cards from the eligible pool. | Never resets or extends time. |
| Banish | 1 | 1 charge | Enter Banish mode; selecting one card removes that id from future Signature offers this run and refills that slot. | Never resets time; disabled below 2.0 s. |
| Skip | 1 | 1 charge | Decline this Signature pick and gain `+1` to the character's class attribute instead. | Resolves immediately; copy names the exact fallback. |

Rules:

- Economy appears on Signature only. FLEX already exposes all five attributes, so rerolling or banishing that deterministic set is dishonest busywork.
- Charges are visible even at zero (`REROLL ×0`), with a short disabled-state explanation on focus.
- No confirmation dialog. Reroll is immediate. Banish is a two-state interaction because the target matters. Skip requires a 350 ms hold or a second press, since it permanently trades away a rare Signature pick.
- At 2.0 seconds remaining, Reroll and Banish fold shut and disable. Pick and Skip stay active to the authoritative edge.
- The server validates offer id, remaining charge, eligibility, and target. Duplicate/late messages are idempotent.
- Charges replenish only on a fresh run in v1. Do not add meta upgrades until telemetry shows players understand and use the base economy.

## Input and focus

The level-up layer owns an explicit modal input router. While it is open, gameplay handlers do not receive consumed presses.

### Keyboard and mouse

- `←/→` or `A/D`: move among cards.
- `↑/↓` or `W/S`: move between card row, detail band, and economy row.
- `1–5`: direct-pick the visible card in that slot.
- `Enter` or `Space`: choose focused card. Space must not queue a jump while the modal owns it.
- `R`: Reroll.
- `B`: enter/cancel Banish mode.
- `X`: hold to Skip.
- `Tab`: pin/unpin expanded detail on compact layouts. It must not open the arsenal bag while the modal owns it.
- `Esc`: leave detail/Banish mode and return focus to cards. It never closes an unresolved level event.

Ignore any key that was already held on the exact frame the offer opened; require a fresh down edge. This prevents a weapon-slot `1/2/3`, movement key, Space, R, B, or Tab action from becoming an accidental level choice.

Pointer hover moves focus and updates the same detail band keyboard uses. Pointer-out does not clear focus; one card remains focused at all times. Click and keyboard activation call the same selection function and the existing single-send guard.

### Focus treatment

- Focused card: `y -= 10`, visual group `scale = 1.06`, backing `scaleX = 0.975`, restrained ±0.035 rad hinge lean, stronger contact shadow, and a 2 px light inner keyline.
- Siblings: remain full contrast and fully readable; never dim below 75%.
- The scene-level hit rectangle grows to the focused visual bounds or remains at a non-overlapping union-safe size. Visual magnification must not create a dead strip around the card.
- Focus transition: 90 ms; pointer and keyboard use identical motion.
- Reduced-motion mode: no scale/lean travel; switch keyline, shadow, and detail content instantly.

## Countdown done right

The timer is a decision aid, not decoration.

### Required presentation

- Header copy: `AUTO: EMBERGUARD IN 07.8` or `AUTO: +1 STR IN 07.8`.
- 12 px high bar, 720 px target width on the wide layout, with rounded paper-track ends.
- Numeric tenths use tabular figures and are always visible.
- 10.0–4.1 s: parchment gold.
- 4.0–2.1 s: amber; one restrained edge pulse when crossing each whole second.
- 2.0–0.0 s: vermilion; economy actions close; no full-screen flash.
- At expiry: bar reaches zero, copy changes to `AUTO-SELECTING…`, and the UI waits for the server patch. Never fake a local choice.

### Clock behavior

- Source of truth: server `expiresAtTick`.
- Client rendering: interpolate between tick-stamped patches for smooth motion, but never move the bar backward within one `offerId`.
- A new `offerId` may refill the bar; a step/page change within the same offer may not.
- Browser tab suspension: on return, recompute from the latest server tick. Do not play missed pulses.
- Network rejection: unlock inputs only if the offer is still live and show `CHOICE NOT ACCEPTED — TRY AGAIN`; do not silently leave a dead modal.

The current server rounds the private timer upward into deciseconds and only patches changes at 10 Hz (`packages/server/src/rooms/GameRoom.ts:1626-1630`). That is adequate for authority but not for a premium 60 fps bar without interpolation or an expiry tick.

## Co-op etiquette

The rule is: **no player controls another player's build, no fast player is punished for deciding quickly, and no slow player can hold combat longer than ten seconds.**

### Shared breather

- Opening an event creates a squad draft truce. Player movement/actions and hostile AI/projectile advancement pause authoritatively, while network ticks, connection handling, and cosmetic ambient motion continue.
- The truce ends as soon as all connected living players resolve their own offers or at the hard deadline.
- Early finishers see their chosen card as a small sealed tab plus the readiness row; they do not re-enter combat alone while teammates remain invulnerable.
- On close, the folio folds away in 180 ms and all players regain control together. Hostile damage resumes after a 350 ms telegraphed release grace; movement resumes immediately.
- A disconnected player is removed from the ready quorum. A reconnect after the event receives the server-resolved result, not a reopened modal.

This replaces the current per-player resumption behavior, in which selection clears that player's pending state while another player may still be choosing (`packages/server/src/rooms/GameRoom.ts:981-1007`, `packages/server/src/rooms/GameRoom.ts:1620-1624`). It also eliminates the current pile-up created when hostile target selection continues to use every alive body during the window (`packages/server/src/rooms/GameRoom.ts:1756-1763`, `packages/server/src/rooms/GameRoom.ts:2035-2077`).

### Readiness row

- Show portrait/initial, player color, and only `CHOOSING`, `READY`, `AUTO`, or `DISCONNECTED`.
- Do not reveal a teammate's hovered card. Reveal final choices together as small 1.2-second tabs after the truce closes; this celebrates builds without inviting mid-timer backseating.
- No host “force pick” button.
- Voice/chat remains available.
- If only one player is connected, omit the readiness row and close immediately on completion.

## Presentation beats

### Open: 0–420 ms

- `0 ms`: existing level-up audio and local gold burst fire from the authoritative level edge.
- `0–100 ms`: ink wash fades in; local-player clear area remains readable.
- `0–320 ms`: existing P3 folio lower sheet pops and upper sheet crosses through the plane.
- `90 ms onward`: card backs present at 42 ms stagger. Hit rectangles are already active; the player may choose before motion finishes.
- `180 ms`: focus defaults to the recommended card, detail band populated, timer already visible and counting.

### Hover/focus

- Magnify the whole readable face to 1.06 while the cardstock performs a smaller hinge lift.
- Raise the focused card above siblings and reveal its contact shadow; do not use world camera zoom.
- Update detail text immediately, then animate only its keyline/diagram over 80 ms. Information should never wait for motion.

### Confirm

1. On activation, disable real input and send immediately.
2. Chosen card compresses to `scaleY 0.94` for 45 ms, then flips forward through `scaleX = 0` over 130 ms.
3. At edge-on, swap to a sealed back carrying the chosen icon and tier glyph.
4. Siblings fold to edge-on over 90 ms, outward from the chosen card.
5. Emit 4–6 card-local painted motes plus procedural paper flecks. No camera shake.
6. If more picks remain, reverse-unfold the next spread inside the same shell and deadline. Otherwise place the sealed card in the ready rail.

### Close

- All sealed teammate tabs stamp once in player-color order, 35 ms apart.
- Reverse the folio fold over 180 ms; remove the wash at the sheet's edge-on crossing.
- Restore world audio over 120 ms and show a compact `BUILD UPDATED` toast only if the local detail changed by more than one queued pick.

## Art and effects plan: existing assets only

No new render is required.

- Frames, corner cuts, timer track, shadows, glyphs, paper flecks, and crease light are Phaser Graphics.
- Icons reuse the current procedural `drawIcon` vocabulary.
- The painted particle library is already a data-driven set whose manifest spans 96 entries (`packages/client/src/vfx/particle-manifest.ts:9-107`). Use at most six existing mote/spark frames for a confirmation, tinted only where the source art tolerates it.
- The component composer exposes twelve existing packs, including lightning-ball and storm-call, and already degrades to procedural VFX when optional textures are missing (`packages/client/src/vfx/fx-composer.ts:17-46`, `packages/client/src/vfx/fx-composer.ts:152-173`). For a Legendary confirmation, reuse only a lightning ring/arc component behind the card through a UI-safe adapter; do not call the full world-space pack at combat scale.
- The eight six-frame impact strips are combat-sized additive flipbooks (`packages/client/src/scenes/arena/vfx.ts:21-34`, `packages/client/src/scenes/arena/vfx.ts:363-429`). Do not use them as card icons or rarity loops; their visual semantics are “a hit happened.”
- Rarity glow is a restrained static/slow halo: Common none, Rare one soft mote orbit, Legendary one low-alpha crease arc. No permanent particle emitter per card.
- Cap the entire modal at 18 transient particle images and one Legendary component accent. The composer already enforces a ten-play-per-frame combat budget, which is a warning not to turn a UI choice into a VFX storm (`packages/client/src/vfx/fx-composer.ts:183-204`).

The paper rule remains binding: primary presents, flips, page changes, and closes use a signed scale through zero; rotation is only lean/ruffle. The rig uses the same through-zero facing grammar in live character presentation (`packages/client/src/entities/SpriteRig.ts:2226-2239`). Level UI motion stays scene-local and must not mutate the shared `SwingDescriptor`, whose immutable fields own combat pose, active, and impact times (`packages/shared/src/melee.ts:609-626`, `packages/shared/src/melee.ts:656-706`).

## Data and authority contract

The UI cannot reach parity on client-authored strings. Add shared, structured presentation data and server-owned offer state.

### Shared offer definition

Conceptual shape:

```ts
type OfferRarity = "common" | "rare" | "legendary";

interface LevelChoicePresentation {
  id: string;
  name: string;
  icon: string;
  rarity?: OfferRarity;       // Signature only
  what: string;               // verb-led face copy
  deltaKind: string;          // resolved by shared calculator
  tags: readonly string[];
  prerequisiteIds?: readonly string[];
  excludesWhenOwned?: boolean;
  stackCap?: number;
}
```

Do not serialize preformatted numeric prose from the server. Put the calculation in shared pure functions, evaluate “before” and hypothetical “after” from the same player snapshot, and format on the client. DD already uses this shared-function model for derived survivability, crit, weapon grades, requirements, and set bonuses (`packages/shared/src/leveling.ts:56-79`, `packages/shared/src/weapons.ts:313-411`).

### Authoritative per-player offer state

Append or nest fields equivalent to:

- `offerId`
- `offerKind/step`
- `choiceIds`
- `expiresAtTick`
- `autoChoiceId`
- `flexRemaining`
- `signatureRemaining`
- `rerollsRemaining`
- `skipsRemaining`
- `banishesRemaining`
- `banishedIds`
- `ready`

The current wire state exposes only pending counts, a Signature CSV, and deciseconds (`packages/shared/src/state.ts:55-70`, `packages/shared/src/state.ts:134-135`). New fields must be server-authored, validated against `offerId`, and appended/nested without disturbing existing schema offsets; the state file explicitly treats field order as compatibility-sensitive (`packages/shared/src/state.ts:100-115`).

### Messages

- `chooseLevelCard { offerId, choiceId }`
- `rerollLevelOffer { offerId }`
- `banishLevelChoice { offerId, choiceId }`
- `skipLevelOffer { offerId }`

Keep legacy `chooseAttribute` and `chooseAugment` only for a migration window. The current handlers correctly validate the requested attribute or offered augment before mutating state (`packages/server/src/rooms/GameRoom.ts:981-1007`); the unified handlers must retain that untrusted-client posture and add charge/deadline/idempotency validation.

### Auto recommendation

The recommendation must be deterministic and inspectable:

1. A card that crosses a held-weapon requirement.
2. A card that completes a real 2/3 or 3/3 weapon set threshold, if the offer type can affect one.
3. A prerequisite-satisfied Legendary combo.
4. A stat/augment that scales the held delivery and is not capped.
5. Character class attribute for FLEX; highest-scored eligible Signature card; stable id tie-break.

The server sends the chosen auto id and the client prints it. The client may independently compute the same score for test diagnostics, but it never decides the timeout result.

## Accessibility and failure states

- Rarity uses word + color + corner shape; never color alone.
- Minimum 4.5:1 contrast for body copy and 3:1 for large labels/keylines.
- Minimum pointer target 48×48 px; card targets cover the visible face at rest and focus.
- Reduced paper motion: shell/card transitions become 80 ms alpha/keyline states with no zero-crossing flicker; information and deadline remain identical.
- Screen-reader/DOM accessibility, if added, announces: level, step, time, focused card name, what line, delta line, owned stack, and action charges in that order.
- If optional painted VFX are missing, Graphics-only confirmation remains complete. The existing FX loader already treats optional decode/404 failures as non-fatal (`packages/client/src/vfx/fx-composer.ts:152-173`).
- If a choice is rejected, restore interaction only while the same offer is live and announce the reason visually.
- If the room patch arrives after local expiry, show `WAITING FOR SERVER`; never count upward or choose locally.
- Resize during the modal recomputes layout and scene-level hit rectangles without rebuilding `offerId`, replaying presents, or resetting focus.

## Acceptance criteria

### Comprehension

- In a five-second unmoderated test, at least 90% of players can identify the largest numeric improvement among three Signature cards.
- At least 85% can state the timeout result before it happens.
- No participant interprets an augment flavor tag as a set bonus unless the chip explicitly names a real threshold and number.

### Interaction

- Mouse, keyboard, and controller-equivalent focus paths reach every card and economy action.
- `1–5`, Enter/Space, R, B, X, Tab, and Esc cannot leak into gameplay while the modal owns them.
- A held key at offer-open cannot select or spend a charge.
- Exactly one selection/economy message is accepted per action, including double-click, key repeat, and 200 ms latency tests.
- Focus magnification never creates mismatched or overlapping scene-level hit areas.

### Timing and co-op

- A normal, fifth-level, or multi-level event lasts at most 10.0 authoritative seconds plus patch latency; page changes and economy actions do not extend it.
- The timer shows a numeric auto-result, transitions color at 4.0 and 2.0 seconds, and never grows within one `offerId`.
- All-ready closes early.
- One slow, disconnected, background-tabbed, or high-latency client cannot extend the squad truce.
- No hostile advances, fires, or accumulates on a choosing player during the truce; combat resumes with the stated 350 ms release grace.

### Truth

- Every displayed before/after number matches a shared simulation calculation for the exact synced build.
- CON, crit, harvest, weapon source, requirement, stack, and set-bonus deltas have golden tests.
- Non-stackable owned augments and unmet-prerequisite Legendaries never appear.
- Timeout selects the printed auto id on the server.
- Banish persists only for the current run; all charge counts reset only on a fresh run.

### Presentation and performance

- The folio, page changes, card presents, confirm, and close cross through the plane; text is never mirrored.
- The chosen card confirms instantly without camera shake.
- Missing painted assets leave a complete procedural presentation.
- At 1280×720, 1920×1080, ultrawide, 900 px width, and high-DPI scale, no text clips and every hit rectangle matches its visual.
- Modal transient budget never exceeds 18 particle images plus one component accent; all tweens, counters, hit rectangles, and particles are destroyed on offer edge and scene shutdown.

## Ship order

1. **Authority and clock:** one `offerId`, ten-second `expiresAtTick`, unified no-reset event, deterministic auto-choice, co-op truce.
2. **Information architecture:** structured WHAT/delta/prerequisite/rarity data, shared preview calculators, detail band, real set chips.
3. **Input:** modal router, focus model, 1–5/Enter/Space navigation, held-key suppression, scene-level hit-rect preservation.
4. **Economy:** two Rerolls, one Banish, one Skip; eligibility, idempotency, and timeout lockout.
5. **Presentation:** responsive folio, hover magnification, confirm/close beats, painted asset accents, reduced-motion path.
6. **Telemetry and tuning:** time-to-first-focus, time-to-pick, auto-pick rate, reroll/banish/skip use, card pick rates by build, rejected-message rate, and co-op wait distribution.

Do not ship the rarity glow or economy first. Without authoritative structured deltas and the one-deadline co-op contract, those features add spectacle and buttons while leaving the director's actual complaint—weak decisions under pressure—unsolved.
