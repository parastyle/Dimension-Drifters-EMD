# Design Option A: Keep the Depth, Expose the Rules

## 1 a.m. summary

Keep the five attributes and all 326 weapons. The system is not too large; it is speaking in code names, making two stats buy crit, and asking a five-second screen to explain weapon grades, a post-choice lowest-stat rule, and a loadout at once. Rename the player-facing stats **Power, Precision, Focus, Health, and Fortune**; make Fortune the sole owner of crit; keep the automatic third point but call it **Balance Bonus** and show its destination on every choice; lead each level-up card with the exact outcome for the held weapon; and make the Armory say *why this fits my build* using tags the catalog already has. If only one change ships, rewrite the level-up cards around outcomes and `YOU +2 / BALANCE +1`. That is the cheapest honest test of whether five stats are the problem. My verdict: ship this clarity pass before cutting systems, but be willing to consolidate later if players still cannot form a build intention once the rules are visible.

## Position and scope

This proposal keeps all five attributes and the full weapon system. Its thesis is that Dimension Drifters is asking players to make reasonable choices through an interface that compresses or withholds the causal rules: the repair is to name stats for what they do, show every point being assigned, separate overlapping effects, and make weapon comparisons explain themselves. This is a design-only report; no product code, tests, catalogs, assets, or generated files were changed.

## Verified code findings

The central problem is not five nouns. It is a five-second screen trying to teach several hidden relationships at once.

- A level grants three points but only one choice: `POINTS_PER_LEVEL = 3`, split into `CHOSEN_POINTS_PER_LEVEL = 2` and `BALLAST_POINTS_PER_LEVEL = 1` (`packages/shared/src/leveling.ts:22-25`). Server truth applies the chosen +2 first, then gives +1 to the post-choice lowest attribute, with ties broken in fixed STR/DEX/INT/CON/LUK order (`leveling.ts:45-62`; `packages/server/src/rooms/progression.ts:72-81`). This is deterministic depth, but “ballast” is an internal-sounding word and “post-choice lowest” is a rule the player must simulate.
- The latest client is more informative than the brief's word “silently” suggests. It previews the exact destination and prints `+2 [CHOICE] (YOU) • +1 [ATTR] (BALLAST)` on each card (`packages/client/src/ui/level-up-model.ts:98-111, 261-272`), while the shell says `PICK +2 • LOWEST +1 BALLAST` (`level-up-model.ts:421-427`; `packages/client/src/scenes/ArenaScene.ts:8163-8199`). Ballast is therefore **surfaced in the current implementation, but not explained**. On timeout, the UI also names the full auto-allocation (`ArenaScene.ts:8085-8103`).
- More seriously, the current preview combines chosen and ballast points into one `after` state before it asks for the best damage delta (`level-up-model.ts:98-111, 177-198, 206-235`). That can misattribute causality. If choosing STR makes DEX the ballast recipient and DEX improves the held weapon, the STR card can display the weapon increase and then label STR as held scaling. The reverse failure also exists: in the worked example below, choosing INT sends ballast to LUK, but the INT branch does not show the crit/harvest benefit created by that LUK point (`level-up-model.ts:236-258`). The receipt is honest; the outcome attribution is not reliably honest. The proposal must calculate `chosen delta` and `Balance delta` separately.
- Crit has two parents. Base crit is 5%; each LUK above 1 adds 2 percentage points, each DEX above 1 adds 0.8 points, and total chance caps at 75%; crits deal 2× (`leveling.ts:102-114`). The card preview does show the resulting crit delta for either DEX or LUK (`level-up-model.ts:225-249`). What remains obscure is role ownership: a new player sees two apparently substitutable ways to buy the same outcome, without a plain distinction between DEX's weapon-scaling role and LUK's loot/crit/economy role.
- CON grants +8 max HP and +0.7 HP/s per effective point (`leveling.ts:98-100, 124-134`). However, sum-10 character spreads are translated through `spreadAdjustedCon(con) = 1 + con - 2` (`leveling.ts:26-27, 64-67`), and both server allocation and client preview use that adjusted value (`progression.ts:59-69`; `level-up-model.ts:218-224`). This compatibility offset is invisible system plumbing. It should never be taught as a rule, but every displayed number must come from the same derived-stat function so the plumbing cannot leak as a mismatch.
- INT is doing at least two jobs: weapon/source damage for caster-tagged content and signature effects. The augment catalog explicitly labels Hex as INT and gives Emberguard an INT-scaled fire wave (`packages/shared/src/augments.ts:19-33, 96-103, 215-224`); caster weapon-specific signature augments such as Overcharge and Arc Split are separately delivery-gated (`augments.ts:140-158, 261-299`). “INT = caster + signature” is internally coherent, but `INT` itself tells a non-D&D player none of that.
- The level-up UI already computes the best held-source damage delta through the weapon's source grades, requirement penalty, loot multiplier, and class-set bonus (`level-up-model.ts:131-203`). This is strong infrastructure. Yet the causal explanation is compressed into grade abbreviations such as `STR B/DEX C` on the footer (`level-up-model.ts:404-427`) and five cards simultaneously compete for attention in a five-second window (`leveling.ts:20-21`; `packages/client/src/ui/level-up-layout.ts:62-75`).
- Allocations are not merely damage tuning: every applied point, including ballast, is recorded in `allocRun`, and the ranked allocation determines ultimate family/variant at thresholds (`progression.ts:59-62, 84-118`). Hiding or deleting the third point would therefore alter ultimate authorship, not just stat totals.

These findings support a sharper thesis: the system has already begun moving toward honest previews, but it still presents implementation vocabulary and simultaneous causality. Option A should finish that job instead of deleting attributes.

### Weapon-system census and visibility

- The active catalog is indeed 326 weapons in the current worktree: 335 persisted catalog definitions minus 9 archived rows. It consists of 305 active generated weapons plus 21 active hand-authored definitions; runtime-only Fists is not a catalog row. The catalog/active/archive split is encoded at `packages/shared/src/weapons.ts:2194-2237`. This matters because “326” is not one flat random-drop list: expansion and archived flags already provide presentation boundaries.
- Every `WeaponDef` is required to carry grip, size, delivery, fire mode, element, class, family, range band, and scaling tags (`weapons.ts:741-754`). An audit of the 305 active generated rows found no missing required tag block. Combined with the base roster, the active set breaks down as 118 melee, 112 ranged, and 96 caster; grip is 116 one-handed, 183 two-handed, 23 authored dual, and 4 mounted. In other words, the data needed for a legible armory already exists.
- The taxonomy is mechanically complete but too granular to be a first-reading vocabulary. The active rows use 57 distinct `family` strings (examples range from sword/katana/pistol to almanac/chapbook/ledger/manuscript and `relic/totem`). That is excellent search metadata and poor top-level navigation. The UI needs a small display taxonomy above it, not deletion of the underlying families.
- Eight active generated definitions currently disagree between their display-oriented `tags.scaling` array and the actual keys in `scalingGrades` (the affected rows are the hexbloom scattergrimoire, rimebound folio, pocket hexicon, maledict tome, twin whispervolumes, abyssal apocrypha, ledger of spent souls, and voltscript codicil). This is exactly the kind of overlap a tag audit should remove: one mechanical source should generate both the label and calculation. This audit is a read-only design finding, not a catalog edit.
- A weapon can have independent damage sources with different scaling (blade, quake, chain, magma, blast, gun explosion, beam, and so on); the source enumeration exists explicitly for WYSIWYG cards (`weapons.ts:1225-1237, 1292-1385`). Requirements reduce every source by 12% per missing point down to a 25% floor (`weapons.ts:1239-1289`). A one-word “damage grade” cannot honestly summarize every weapon, which is why the UI should show the dominant result first and retain a details drawer.
- Three equipped weapons create a class build: two matching class weapons grant +8% class damage and three grant +18% (`weapons.ts:1166-1190`). Every equipped slot is independent; a pre-made `grip: "dual"` definition supplies both rendered pieces and its authored combo from one slot. The player should see that grip identity before equipping it.
- The game already has pieces of the proposed answer. Weapon cards show grip/family/element, damage-source equations, scaling-grade chips, and color-coded requirements (`packages/client/src/scenes/arena/card-art.ts:661-775`). The metagame Armory has search plus filters for zone, class, rarity, and sorting (`packages/client/src/scenes/MenuScene.ts:2130-2145, 2272-2302`), and its model can also filter family, delivery, and provenance even though not all are exposed as toolbar controls (`packages/client/src/ui/armory/model.ts:52-77, 308-343`). The missing piece is contextual comparison: the Armory detail currently reports identity, tags, value, size, and source, but not “what happens to my build if I equip this?” (`MenuScene.ts:2297-2315`).
- The weapon-card source equations are the strongest existing pattern to extend: show exact damage, cadence, resource behavior, grip, and class impact for every equip decision.

## Research: what shipped games actually teach

The shipped facts below are sourced. Each lesson I draw for DD is my inference unless the cited studio explicitly gives a rationale. My synthesis is not “few stats good, many stats bad.” It is **show the immediate consequence first, use one stable vocabulary everywhere, and put exhaustive truth one deliberate action away**.

### Brotato: context can prune dead choices without deleting the system

`Brotato` makes a many-stat, many-weapon build game readable partly through weapon classes: collecting multiple weapons of a class grants visible threshold bonuses, and held classes also influence what the shop offers. The exact class ladder is documented by the [Brotato community wiki's weapon-class table](https://brotato.wiki.spellsandguns.com/Weapon_class); this is a secondary source describing shipped behavior, not a developer rationale.

The stronger primary-source evidence is [Brotato patch 1.1.15.2](https://steamcommunity.com/app/1942280/allnews/) (May 19, 2026). The studio restricted useless level-up upgrades for characters that nullify them and explicitly said the goal was not to remove options, but to avoid useless upgrades. That is the right distinction for DD: do not hide Power because the held weapon does not scale with it; label it `NO CHANGE TO VOLTEDGE` so the player can still invest for a planned swap. Reserve actual suppression for a choice that truly cannot function for that character/run.

### Vampire Survivors: reveal combinations at the decision and filter the archive

`Vampire Survivors` [patch 0.3.2](https://store.steampowered.com/news/app/1794680/view/3131696199131643254) added discovered evolution information directly to level-up panels. Later, [v1.8.200](https://store.steampowered.com/news/posts/?enddate=1701883547&feed=steam_community_announcements) added filters to the Collection page so players could find what they still needed. My inference is that these are small presentation patches aimed at the moment of choice and the long-tail catalog respectively—the same two surfaces DD needs to fix.

### Hades: concise choice cards plus an inspectable truth layer

Supergiant kept `Hades` boon/build interactions deep while repeatedly improving access to explanation. The official [Welcome to Hell update notes](https://www.supergiantgames.com/blog/hades-welcome-to-hell-update-patch-notes/) list a Boon Info overlay, keyword tooltips, prophecy indicators on boon/upgrade choices, and feedback for failed actions such as casting without ammo. The usable pattern is progressive disclosure: the choice remains fast, while the player can deliberately inspect keywords and the whole build. DD should copy the pattern, not Hades' particular number of choices.

### Last Epoch: scaling tags need an in-game reference, not community archaeology

Eleventh Hour Games announced a searchable, collapsible, cross-linked [in-game Game Guide in patch 0.7.8](https://forum.lastepoch.com/t/the-game-guide-is-coming-in-our-next-update/20111). Its [0.9 patch notes](https://forum.lastepoch.com/t/the-convergence-update-beta-0-9-patch-notes/51975) also record systemic tooltip work: skills with area effects gained an Area tag, and non-100% damage effectiveness was added to advanced text. Last Epoch demonstrates both halves of the answer: tags make complex scaling scannable, and a searchable guide catches the detail that cannot fit in a combat-speed card.

My judgment, not a sourced studio claim: Last Epoch is also a warning. A tag such as `Intelligence` is not self-explanatory if its per-skill result varies. DD's exact numeric before/after preview is better than a tag alone and should remain the first line.

### Path of Exile: normalize the taxonomy while preserving mechanics

Grinding Gear Games' [Heist Balance Manifesto](https://www.pathofexile.com/forum/view-thread/2935368) is the closest precedent for this proposal. GGG said it standardized different systems on one set of mod tags, simplified the categorization philosophy, and reviewed existing tags so crafting would be clearer and more predictable. The manifesto notes thousands of tag changes while stressing that most crafting methods were not significantly affected. DD's scale is vastly smaller. The lesson is concrete: do one catalog-wide semantic audit, generate display labels from the same mechanical fields, and stop allowing descriptive tags to drift from `scalingGrades`.

### Diablo III: simplify competition and expose comparison; amputate only when the overlap is dead

Blizzard's official [`Diablo III` 2.0.1 / Loot 2.0 notes](https://news.blizzard.com/en-gb/article/12671560/patch-2-0-1-now-live) give both sides of this panel honestly. The patch separated item properties into Primary and Secondary specifically to prevent direct and indirect power stats from competing, narrowed stat ranges, added CTRL-visible roll ranges, and introduced Smart Loot so class-specific items did not roll inappropriate stats. It also genuinely cut or condensed systems—crafting materials, difficulties, skill runes, and potions—where the team judged categories dead or redundant.

The conservative takeaway is not “never cut.” It is “first remove false competition and show the comparison.” DD's DEX/LUK crit overlap is false competition; 326 distinct weapon identities are not. If playtests still show five choices producing hesitation after the overlap and presentation fixes, Diablo III is evidence that a more aggressive consolidation can be justified rather than taboo.

## Diagnosis: exactly where the player is lost

In order of severity:

1. **The choice card describes the accounting before the benefit.** `STR`, `DEX`, a letter grade, and `BALLAST` are meaningful to the implementation. The player needs “Voltedge hit +0.9,” “max HP +16,” or “no change to Voltedge” first. The current client calculates much of this already, but the result shares a tiny card with receipts and context.
2. **Crit has no single owner.** Both DEX and LUK visibly raise crit, but the interface does not give them distinct jobs. This makes Fortune feel optional when Precision can buy weapon damage and some crit at once. It is not deep tension; it is overlapping ownership.
3. **The automatic point is visible but semantically opaque—and can blur causality.** The current screen does not literally hide ballast, but `LOWEST +1 BALLAST` asks the player to learn internal vocabulary and reason about a post-choice state. Because the preview evaluates chosen and automatic points together, an automatic-point outcome can appear to belong to the chosen stat or can be omitted from the outcome text. The destination changing between cards is particularly easy to miss under a timer.
4. **INT describes genre literacy, not behavior.** It covers caster-source scaling and some marked signature effects. A player should not need to know the D&D convention that intelligence means spell damage, and “signature” is not implied even if they do.
5. **The attribute-to-damage relation lives at the weapon-source level.** That architecture is correct, but the player sees a stat grid as if attributes have universal damage rules. In reality the grade on each weapon source decides the payoff. A character sheet without the held weapon is therefore an incomplete explanation.
6. **The Armory is a catalog, not an adviser.** Search and metadata help someone who already knows what they want. They do not answer “why should *this build* equip this?” Set thresholds, requirement penalties, dual eligibility, rarity, affix, and source behavior remain mentally composited by the player.
7. **The five-second window magnifies every naming fault.** Five options can fit in five seconds only when their first lines are instantly comparable. Extending the timer may help onboarding, but it cannot repair ambiguous causality.

`spreadAdjustedCon` is not itself a player-complexity problem. It is compatibility plumbing. It becomes a problem only if a client independently recomputes a different HP number. Keep it below the waterline and route every preview through the authoritative derived-stat path.

## Concrete proposal: five attributes with five jobs

Keep the wire/data keys `str`, `dex`, `int`, `con`, and `luk`. Change only the presentation vocabulary at first, showing the legacy abbreviation in an advanced tooltip during migration.

| Player-facing name | Legacy key | Literal short definition | Sole/primary ownership |
|---|---:|---|---|
| **POWER** | STR | “Raises damage on Power-scaled weapon sources.” | Power grades; commonly heavy/melee sources |
| **PRECISION** | DEX | “Raises damage on Precision-scaled weapon sources.” | Precision grades; commonly finesse/ranged sources |
| **FOCUS** | INT | “Raises caster damage and Focus-marked signatures.” | Focus grades and explicitly marked signatures |
| **HEALTH** | CON | “Raises max HP and HP regeneration.” | Max HP and regeneration |
| **FORTUNE** | LUK | “Raises crit chance, loot quality, and squad extraction gains.” | Crit, high-tier loot weighting, and harvest |

These are deliberately behavioral, not archetypal. `POWER` does not promise that every melee weapon uses it; the weapon must say `STRONG POWER SCALING`. `FOCUS` does not promise that every signature scales; the signature must carry the label `FOCUS-MARKED`. Where a single noun cannot be exhaustive, the short definition supplies the contract.

For accessibility and veteran continuity, the details view can read `POWER (formerly STR)`, and a settings toggle may retain legacy abbreviations. Do not show both vocabularies permanently on the combat-speed card; that recreates the clutter the rename is meant to solve.

### One owner for crit

In this option, **DEX stops adding crit and LUK/Fortune becomes crit's sole owner**. Keep the 5% base, +2 percentage points per Fortune above 1, 75% cap, and 2× crit multiplier. Precision remains valuable because its weapon-source grades are often excellent. Fortune now has a clean identity: spikes, rarity, and extraction economy.

This is the proposal's one intentional mechanical simplification. It removes a hybrid optimization—high DEX incidentally producing crit—and therefore requires balancing; it does not remove an attribute, a weapon, or a build axis. If the owner wants a presentation-only first release, the UI can ship before this tuning change, but the overlap should remain a tracked design debt rather than be defended as meaningful choice.

### Ballast stays, becomes explicit, and gets a player-facing name

Keep the exact rule: the player chooses +2; after that choice, +1 goes to the lowest attribute, including the existing fixed tie behavior and character quirk. Rename it **BALANCE BONUS**.

Why keep it:

- It is a guardrail against accidental dead-bottom stats without forbidding specialization.
- It preserves the existing three-points-per-level curve, ultimate allocation history, character quirk, and 30-level tuning.
- It produces a small, legible consequence to every choice: the build grows where it is weakest.
- Removing it would be a deceptively large balance and content change for very little cognitive benefit; the player would still choose among five cards.

The rule must be described as a receipt, not a puzzle. Every card shows the exact destination. The global explanation is:

> **Choose +2. BALANCE BONUS adds +1 to the lowest stat shown on that card.**

The existing “ballast follows choice” quirk becomes:

> **ALL-IN — Your Balance Bonus joins the stat you choose.**

Do not teach the fixed tie-break order. It is not an interesting rule. Show the actual recipient before confirmation, which makes the tie order irrelevant to play.

### Translate damage grades without flattening them

Keep the grade coefficients and per-source scaling in `weapons.ts`. Their location in code is not a design defect; failure to translate them is. Use words in the fast surface and retain letters/math in details:

| Grade | Fast label | Detail text |
|---:|---|---|
| S | **Exceptional** | `S • +10% source damage per point` |
| A | **Strong** | `A • +8% source damage per point` |
| B | **Good** | `B • +6% source damage per point` |
| C | **Moderate** | `C • +4.5% source damage per point` |
| D | **Low** | `D • +3% source damage per point` |
| E | **Trace** | `E • +1.5% source damage per point` |

The top line may summarize `STRONG PRECISION SCALING`, but a multi-source weapon keeps separate rows in details. A read-only census found 215 of 305 active generated weapons have more than one scaling key, so a universal “main stat” label would often lie. The interface should select the largest immediate delta for the card and let the details drawer enumerate every source.

## The level-up screen, verbatim

The following before/after uses one fixed example so the copy can be judged rather than imagined: Level 8, Voltedge equipped, no damage affix or set bonus, squad-best LUK 2, and current stats STR 4 / DEX 15 / INT 2 / CON 5 / LUK 2. Those stats total 28, consistent with six completed three-point allocations after a sum-10 start. The “before” is a faithful mock-up of the strings produced by the current templates; layout, truncation, and the live timer can vary by viewport.

### Before: what the current screen says

```text
LEVEL 8 · GROWTH · CHOOSE 1
PICK +2 · LOWEST +1 BALLAST
AUTO: +2 DEX (YOU) · +1 INT (BALLAST) IN 4.3s

ATTRIBUTE          ATTRIBUTE          ATTRIBUTE
STR                DEX                INT
STR 4 → 6 (+2)     HIT 11.7 → 12.5    INT 2 → 4 (+2)
                   (+0.9)
NO HELD-WEAPON     CRIT 18.2% →       NO HELD-WEAPON
SCALING · +2 STR   19.8% (+1.6pp) ·   SCALING · +2 INT
(YOU) · +1 INT     +2 DEX (YOU) ·     (YOU) · +1 LUK
(BALLAST)          +1 INT (BALLAST)   (BALLAST)

ATTRIBUTE          ATTRIBUTE
CON                LUK
HP 124 → 140       CRIT 18.2% → 22.2%
(+16)              (+4.0pp)
REGEN 8.1/s →      SQUAD HARVEST
9.5/s (+1.4) ·     4.0% → 12.0% ·
+2 CON (YOU) ·     +2 LUK (YOU) ·
+1 INT (BALLAST)   +1 INT (BALLAST)

HELD: Voltedge · DEX A · MELEE 1/3 · WORLD LIVE
1–5 PICK · ←/→ · ENTER/SPACE
```

This is more truthful than a typical hidden-stat screen. Its failure is hierarchy: the useful effect, accounting receipt, grade code, current equipment, set count, and control legend all have nearly equal visual weight.

### After: the proposed fast screen

```text
LEVEL 8 — CHOOSE GROWTH
Choose +2. BALANCE BONUS adds +1 to the lowest stat shown on each card.
IF TIME RUNS OUT: PRECISION +2, FOCUS +1 — 4.3s

POWER              PRECISION          FOCUS
NO CHANGE TO       VOLTEDGE HIT        NO CHANGE TO
VOLTEDGE            11.7 → 12.5 (+0.9) VOLTEDGE

Power-scaled       Strong Precision   Caster weapons and
sources hit harder scaling (A)         Focus-marked signatures grow

YOU +2: 4 → 6      YOU +2: 15 → 17    YOU +2: 2 → 4
BALANCE +1 FOCUS   BALANCE +1 FOCUS   BALANCE +1 FORTUNE
                                        Crit +2.0pp · extraction +4.0pp

HEALTH             FORTUNE
MAX HP             CRIT CHANCE
124 → 140 (+16)    7.0% → 11.0% (+4.0pp)
REGEN              SQUAD EXTRACTION BONUS
8.1/s → 9.5/s      4.0% → 12.0%

YOU +2: 5 → 7      YOU +2: 2 → 4
BALANCE +1 FOCUS   BALANCE +1 FOCUS

VOLTEDGE · 1H BLADE · MID RANGE · STRONG PRECISION SCALING
MELEE SET 1/3 · NEXT: +8% CLASS DAMAGE AT 2
[TAB] WHY THESE NUMBERS · [1–5] CHOOSE
```

The visual treatment should reinforce the copy:

- The exact outcome is the largest line; the stat name is a smaller stable label.
- `NO CHANGE TO VOLTEDGE` is neutral gray, not a red warning. The choice can still support a planned weapon swap.
- `YOU +2` and `BALANCE +1` share one receipt block with distinct person/balance icons.
- Calculate them in two passes: `before → after chosen` and `after chosen → final after Balance`. Never credit a Balance-created weapon increase to the chosen stat. When Balance changes a visible outcome, print that secondary delta directly below its receipt.
- The Balance recipient is highlighted on each card before selection.
- Requirement completion, if applicable, replaces the secondary descriptor with `REQUIREMENT MET — FULL WEAPON OUTPUT`.
- Keep the world live and the five-second window for the first test. If comprehension still fails, test seven seconds before deleting a stat. Do not allow an inspect overlay to pause an invulnerable live player.

`TAB` opens a compact read-only explanation without changing the selection:

```text
WHY PRECISION CHANGES VOLTEDGE

Voltedge has STRONG Precision scaling (A).
Each Precision point adds 8% of base damage to its hit and chain sources.

+2 Precision:
  HIT    11.7 → 12.5 (+0.9)
  CHAIN   8.5 →  9.1 (+0.6 per target)

Balance Bonus goes to Focus because Focus is your lowest stat after this choice.
RUN GROWTH RECEIPT: Precision +2 · Focus +1
```

The exact chain numbers above follow Voltedge's base-4 chain source and current A-grade coefficient before rarity/affix/set modifiers; production copy must use the same shared function as server damage. The key design is not those sample decimals. It is naming the source, coefficient, and reason in one place.

The timeout label remains explicit. The automatic choice should use the same receipt and briefly flash the chosen card, so a player who misses the timer still knows what happened.

### Outside the level-up window

The pause/build panel owns the full teaching layer:

```text
PRECISION 15
Raises damage on Precision-scaled weapon sources.

CURRENT LOADOUT BENEFIT
Voltedge — Strong (A)
  Hit:   +112% of base damage
  Chain: +112% of base damage

DOES NOT DO
Crit chance is controlled by Fortune.
```

The last line is unusually important during migration because it closes the old DEX/LUK ambiguity. The build panel should also expose the current run's allocation receipt and ultimate lean because `allocRun` already uses every assigned point, including Balance Bonus. Do not silently change ultimate authorship as part of a copy project.

## Make 326 weapons legible without cutting one

The answer is a hierarchy, not a smaller catalog. Preserve all mechanical tags and add a display layer above them.

### 1. Twelve browse groups above the 57 exact families

Use these top-level Armory groups:

1. Light Blades
2. Heavy Blades & Axes
3. Polearms
4. Hammers & Flails
5. Gauntlets & Exotic Melee
6. Sidearms
7. Rifles
8. Scatterguns
9. Heavy Ordnance
10. Wands, Staves & Foci
11. Tomes
12. Relics & Orbs

These are navigation buckets, not new combat rules. `katana`, `rapier`, `naginata`, `almanac`, `ledger`, and every other exact family remain visible and searchable beneath them. Exotic outliers get a deliberate override rather than forcing a thirteenth mechanical family.

### 2. Contextual filter chips

The first filter row answers player questions:

```text
[RECOMMENDED] [SCALES WITH MY TOP STAT] [COMPLETES A SET]
[PAIRABLE NOW] [REQUIREMENTS MET] [NEW / UNMASTERED]
```

An `ADVANCED FILTERS` drawer exposes the existing dimensions: class, browse group, exact family, 1H/2H/authored-dual/mounted, delivery, range band, element, rarity, affix, provenance, and archived state.

`RECOMMENDED` must never be an unexplained power score. It is a sort by disclosed reasons: requirement met, uses a top stat, crosses a 2/3 or 3/3 class threshold, fits an open/equippable slot, can legally pair, then rarity/affix. Every recommended badge is clickable and lists its reasons.

### 3. Every card answers “why it fits” and “what I give up”

Literal Armory detail copy:

```text
VOLTEDGE
Rare · 1H Light Blade · Melee · Mid Range

WHY IT FITS YOUR BUILD
✓ Uses your Precision 15 — STRONG scaling (A)
✓ Requirements met — Precision 15 / 12
✓ Equipping reaches MELEE 2/3 — +8% class damage

WHAT CHANGES
Hit: 11.7 before rarity/affix/set modifiers
Chain: 8.5 to the first target · up to 3 jumps

TRADEOFFS
• Replaces a thrown weapon
• Cannot dual-pair with that weapon: different delivery lanes

[COMPARE LOADOUT]  [EQUIP]  [ARCHIVE DETAILS]
```

If a reason is absent, omit the row. If a requirement is missed, do not merely color `9/12` red:

```text
UNDER REQUIREMENT — 64% WEAPON OUTPUT
Need +3 Precision for full weapon output.
This level: 9 → 11 would raise it to 88% weapon output.
```

That turns the current 12%-per-missing-point penalty into an actionable plan.

### 4. Compare the loadout, not two isolated rectangles

`COMPARE LOADOUT` opens current versus proposed columns and lists only changed consequences:

```text
EQUIP VOLTEDGE IN SLOT 2

+ MELEE SET       1/3 → 2/3  (+8% class damage)
+ REQUIREMENT     met
+ NEW SOURCE      chain lightning, up to 3 jumps
− RANGED COVERAGE one thrown lane removed
− DUAL PAIR       current pair breaks: delivery mismatch

RARITY / AFFIX
Current: Common · Plain
New:     Rare · Balanced
         Rarity +18% damage · Affix +6% damage · cooldown ×0.92
```

There should be no universal DPS number. Damage coverage, resource cadence, area, chain falloff, range, authored-dual behavior, and set changes make a single score falsely authoritative. Show arithmetic where it is comparable and behavior where it is not.

### 5. Make thresholds anticipatory

Wherever the UI shows `MELEE 1/3`, add the next consequence:

```text
MELEE SET 1/3 · ADD 1 FOR +8% MELEE DAMAGE
```

At two:

```text
MELEE SET 2/3 · ACTIVE +8% · ADD 1 FOR +18%
```

This copies the readable threshold logic that makes weapon classes useful in Brotato: the count and its consequence travel together.

### 6. One source of truth for scaling labels

Generate `tags.scaling` display chips from the actual grade/source keys rather than maintaining parallel claims. The eight known mismatches should be corrected by the catalog pipeline/audit, not patched in UI copy. Where a weapon has different source grades, show `MIXED SCALING` on the small card and exact rows in details.

## What this costs

This is conservative, not free.

### Depth or expressiveness lost

- Removing DEX's +0.8 percentage points of crit per point eliminates an incidental Precision/Fortune hybrid and lowers expected damage for every high-DEX build, even when its held weapon is not DEX-scaled. At DEX 12, the current contribution is 8.8 percentage points; at DEX 15 it is 11.2 points. That is a real cut and must be compensated or accepted deliberately.
- Compressing 57 families into 12 browse groups loses some flavor at first glance. The exact family remains one layer down, so this is information ordering rather than content removal.
- Outcome-first cards may bias players toward the held weapon and away from planned swaps. Neutral `NO CHANGE TO VOLTEDGE` copy, a pinned build-plan marker, and the full build panel mitigate but do not erase that bias.
- Five choices still occupy considerable screen width, and five seconds remains demanding. This option makes the test fair; it cannot guarantee that five is the right final count.

### Existing content and systems touched

- Keep legacy attribute IDs in save, network, server, and mechanical data. The copy migration still touches the character sheet, level-up and signature screens, weapon cards, Armory, ultimate reveal, tutorials, accessibility narration, and localization/snapshots.
- All 40 playable characters need presentation QA because their starting spreads and build summaries expose the old vocabulary; their numeric spreads need no conversion (`packages/shared/src/characters.ts:6-49`). All 20 ultimate family/variant cells need reveal/tooltip QA because the ranked run allocation chooses them, but the 5×4 selection grammar remains intact (`packages/shared/src/combat.ts:160-189`).
- A source audit found only 18 user-facing gear effect strings containing the old abbreviations, plus two visible attribute strings in metagame definitions. The 113 gear pieces do **not** need mechanical conversion; the affected copy needs review. Character descriptions and any authored tutorial prose need a separate text search.
- The Balance Bonus rename does not break balance if its rule and `allocRun` recording stay unchanged. Its all-in character quirk needs renamed copy and QA.
- Fortune-only crit changes combat balance globally. At minimum, audit the 169 active generated weapons that include DEX/Precision scaling, all hand-authored DEX weapons, DEX-heavy legacy character spreads, crit-facing gear/augments, and the cap curve. The 169 figure is a census, not a claim that all need number edits: many may remain healthy after the loss.
- Exact outcome UI must continue to account for rarity, affix, set bonus, requirements, and multi-source behavior. Any duplicated client formula risks lying; verification should compare preview and server damage across representative weapons.

### Weapon catalog retagging cost

- **Mechanical retags required for the MVP: 0 of 326.** The required class, grip, delivery, family, range, element, and scaling data already exist.
- **Immediate consistency review: all 326, with 8 known active mismatches.** This can be automated for scaling-key equality, then human-reviewed for naming.
- **Browse-group mapping: mostly central rules plus roughly 50–70 manual overrides (about 15–20% of the catalog).** That is my estimate, not a measured source fact. Most of the 57 family strings map once; exotic melee/ranged and hybrid relic/book rows need judgment.
- **Subjective tags such as “boss killer,” “crowd clear,” or “safe” would require human validation of all 326.** Do not make them an MVP dependency. Derive only objective tags from mechanics until there is a reliable combat taxonomy.

### Rebalancing and QA

- Re-run expected-damage curves over representative low/mid/high Precision and Fortune values after the crit ownership change. Decide whether Precision weapons need grade/base compensation or whether their direct scaling was already paying for the incidental crit.
- Validate requirements at every missing-point count, both class-set thresholds, each rarity/affix combination, and multi-source cards.
- Validate top-level group/filter counts against the active/archive split so 326 active and 9 archived rows never leak into the wrong surface.
- Test narrow, medium, and wide level-up layouts. The proposed copy is intentionally hierarchical, but the compact presentation will need line-budget decisions rather than simply shrinking type.

## What I would not change

- **Do not cut any of the five attributes yet.** They own distinct build jobs once crit overlap is removed and Focus is named honestly.
- **Do not remove the Balance Bonus.** Make it visible and predictable. Its guardrail and ultimate contribution are more valuable than the one line of explanation it costs.
- **Do not expose `spreadAdjustedCon`.** It is implementation compatibility, not a build choice. Show authoritative HP and regen outcomes.
- **Do not move damage grades out of weapons merely to make attributes look important.** Per-weapon and per-source grades are what let 326 weapons express different stat affinities. Surface them at the choice.
- **Do not reduce the catalog, merge exact families, or delete archived history.** Add browse groups, filters, reasons, and comparison.
- **Do not remove three equipped slots, bag decisions, 2/3 class bonuses, authored grip identities, requirements, rarity, affixes, scrip, or archiving.** These systems create loadout stories. Their rules should travel with the relevant action.
- **Do not invent a universal item-level or DPS score.** It would make comparison faster by making it less truthful.
- **Do not silently exclude a stat because the current weapon ignores it.** A future swap can make it valuable. Say `NO CHANGE TO [HELD WEAPON]`; only suppress choices that literally cannot function, following Brotato's more limited precedent.

## Cheapest changes with the biggest legibility win

Ranked by expected legibility gained per implementation/content cost:

| Rank | Change | Rough effort | Why it pays |
|---:|---|---:|---|
| **1** | Rewrite level-up hierarchy around exact outcome, split chosen/Balance deltas, and rename Ballast to Balance Bonus | Small | The calculations and receipts already exist; their attribution needs separating. This repairs the highest-pressure decision without rebalance. |
| **2** | Add one shared presentation-name dictionary: Power / Precision / Focus / Health / Fortune, with legacy aliases in details | Small–medium | Removes D&D literacy and gives copy one vocabulary. Mechanical IDs stay stable. |
| **3** | Add `WHY IT FITS` reasons from requirement, top-stat scaling, class threshold, and pair eligibility | Small–medium | Uses existing metadata to turn browsing into a build decision. |
| **4** | Always show the next class-set threshold beside `1/3` or `2/3` | Small | Converts an unexplained count into an immediate plan. |
| **5** | Expose the Armory model's existing family/delivery/provenance filters and add the 12-group display map | Medium | Makes 326 feel browsable without touching combat data. |
| **6** | Make scaling labels derive from grade/source truth; add automated catalog consistency checks | Medium | Stops future UI/math drift and catches the eight known mismatches. |
| **7** | Make Fortune the sole crit owner and run the balance pass | Medium–large | Produces the cleanest five-job system, but changes global expected damage. |
| **8** | Build full current-loadout versus proposed-loadout comparison | Large | Highest Armory ceiling; more UI and verification work than the quick wins above. |

**If I could make only one change, I would ship rank 1:** rewrite the existing level-up cards so the first line is the exact consequence and the last line is the explicit `YOU +2 / BALANCE +1` receipt. It needs no catalog reduction, no save migration, and no balance decision. It also creates the fairest possible test: if players still cannot explain their choice after this, the case for consolidation gets much stronger.

## Honest verdict

I would ship Option A as the next design iteration, not sign it as the eternal final answer. The code already contains unusually good ingredients for legibility: exact allocation previews, source-aware damage calculation, mandatory weapon metadata, set/pair rules, and a 326/9 active/archive boundary. Cutting attributes or weapons before those ingredients are used would destroy expressive content without proving that content caused the confusion.

I would sequence it in two releases: first the outcome-first cards, Balance Bonus, names, threshold copy, and contextual Armory reasons; then Fortune-only crit with a measured balance pass. Instrument timeout rate, time-to-choice, `NO CHANGE` picks, Armory filter usage, requirement failures, set completion, and a short post-run “what made your build stronger?” comprehension prompt. Those measurements are my proposed validation method, not claims sourced to the games above.

The aggressive option may still be the right call for this game. If new players, after two focused playtests of the clear version, still treat the highlighted held-weapon stat as the only real choice; if most level-ups are auto-selected; or if players cannot predict how a future weapon changes their build, then attributes are functioning as a tax on a weapon-led bullet-heaven. At that point I would favor consolidating to three broad player stats or moving most growth into direct weapon/perk choices. That would be a better game than keeping five nouns out of pride.

Today, however, the evidence says the five-stat system has not yet received an honest trial. It is not too complex to explain. It is too compressed, multiply owned, and catalog-blind. Make it visible first.
