# Design Option C — Delete Allocated Attributes

## 1am summary

Delete STR/DEX/INT/CON/LUK from the player’s level-up ritual and spend all 29 in-run levels on things the player can immediately see: tune a specific equipped weapon, take one of the existing behavior-changing augments every fifth level, and explicitly choose an ultimate family and form. Preserve bruiser/glass-cannon identity as a visible, fixed **Frame + Signature** on the character or gear loadout, not five numbers the player feeds every few seconds. This is a stronger and more legible game on paper, but a flag-day backend deletion is the wrong move for this branch: all 326 active weapons use attribute grades, 320 use requirements, 129 have multiple damage sources, gear currently builds identity through a stat spread, and allocation selects all 20 ultimates. I would ship-test the player-facing deletion while retaining automatic hidden attributes as a compatibility layer, then delete the data model only if weapon-tuning choices prove more fun. Do **not** erase the current system first and hope the replacement catches up.

## Working mandate

This proposal tests the strongest credible version of removing per-level attribute allocation from Dimension Drifters. The hypothesis is that this game’s meaningful identity already lives in weapons, gear, augments, ultimates, pets, class synergies, and moment-to-moment combat, while STR/DEX/INT/CON/LUK allocation adds a recurring ritual whose choices are harder to read than their effects are fun. The central design obligation is therefore not merely to delete stats: it is to replace every level-up with a more legible, more exciting choice, preserve distinct character identities, describe the full migration and balance cost without minimizing it, and say plainly if that cost makes this the wrong option for this game.

> Status: complete design report. Findings are repository-verified; external claims are linked to named sources; proposed tuning values are identified as design targets.

## Investigation protocol

The repository’s reporting rule says to establish the report of record first, update it as findings become usable, and append validation last (`docs/sol-reports/README.md`). This file is the report of record requested by the panel brief. The work proceeds in four passes: map the shipped data model and runtime consumers; audit the content and balance blast radius; compare specific shipped progression systems and documented simplifications; then turn those constraints into a literal replacement level-up screen and an honest ship/no-ship verdict. No game code, content, assets, catalogs, generated files, processes, or live ports will be changed.

## Verified findings — pass 1: attributes are a load-bearing routing system

The five visible numbers do considerably more than their labels suggest. The shared model defines STR/DEX/INT/CON/LUK, level cap 30, a five-second decision window, and a `+2 chosen / +1 lowest` outcome; its comments explicitly describe one decision and three points of income per level (`packages/shared/src/leveling.ts:2-5`, `18-27`, `34-43`, `45-67`). Damage is not in `deriveStats`: CON alone produces max HP and regeneration there, while weapon-source grades consume the complete attribute record elsewhere (`packages/shared/src/leveling.ts:98-134`; `packages/shared/src/weapons.ts:1209-1289`). Crit is a second cross-cutting derivation: 5% base, +2 percentage points per LUK above 1, +0.8 points per DEX above 1, 75% cap, ×2 damage (`packages/shared/src/leveling.ts:102-115`).

The actual level-up UI already works hard to explain this opaque result. It previews `+2` to the selected attribute, computes the post-choice ballast destination, and then shows exact held-source damage, weapon-requirement, crit, HP, regen, and squad-harvest deltas (`packages/client/src/ui/level-up-model.ts:88-111`, `145-273`). The screen headline is `LEVEL {N} · GROWTH · CHOOSE 1`; its context says `PICK +2 • LOWEST +1 BALLAST`; its timeout chooses the held weapon’s best scaling grade; and its footer warns `WORLD LIVE` because the player gets only five seconds (`packages/client/src/ui/level-up-model.ts:404-428`; `packages/client/src/scenes/ArenaScene.ts:8061-8103`, `8163-8227`, `8621-8641`). This is unusually good surfacing of a fundamentally busy transaction. The proposal should not pretend the current problem is merely missing tooltip work.

The server makes the coupling explicit. Each allocation mutates a public attribute, tracks it again in the server-private `allocRun`, recalculates CON-derived HP, and immediately heals the gained max HP; each complete decision then reevaluates the ultimate (`packages/server/src/rooms/progression.ts:59-81`). At 15 allocated points the leading run allocation locks one of five ultimate families; a secondary attribute selects one of four variants; at 30 points the variant tempers (`packages/server/src/rooms/progression.ts:84-118`; `packages/shared/src/combat.ts:192-266`). Thus deleting allocation without a replacement rule deletes the selection logic for all 20 ultimate cells, not merely five damage knobs.

Level state is also wire and orchestration state. The schema publishes five attribute fields, `flexPending`, timer fields, augment ownership/offers, and a captured signature-gate queue; it privately retains `allocRun`, gear-seeding flags, the ballast rule, max-HP add, and ultimate lock state (`packages/shared/src/state.ts:103-132`, `191-208`, `219-239`, `349-360`). The room accepts `chooseAttribute`, freezes and untargets players while either pick is pending, auto-allocates on timeout, and uses raw attributes in combat and rewards (`packages/server/src/rooms/GameRoom.ts:2301-2327`, `4530`, `5402`, `9675-9710`). Direct server consumers include regeneration, at least nine crit roll sites, ultimate damage, squad LUK harvest/loot leadership, Second Wind’s CON heal, and Emberguard’s INT damage (`packages/server/src/rooms/GameRoom.ts:6276-6284`, `6678-7020`, `9522`, `11450`, `11664`, `11719-11726`, `13351-13354`). This is a schema migration, protocol change, balance rewrite, UI rewrite, test rewrite, and content migration.

Character identity is real authored work, but allocation is only part of it. The roster contains 40 playable identities including Drifter; every one has a sum-10 starting spread and a named quirk (`packages/shared/src/characters.ts:6-49`, `53-93`). The old class buckets already survive only as non-gating lineages—bruiser, duelist, caster, warden, scoundrel—while character quirks can alter crit, regen, parry, cooldowns, damage caps, and event hooks (`packages/shared/src/character-classes.ts:1-23`, `40-78`, `80-121`). Many declared quirks are currently explicitly partial or inert because their runtime seam does not exist (`packages/shared/src/character-classes.ts:125-190`, `293-429`). Any claim that deleting attributes “preserves all 40 characters via quirks” must therefore budget implementation and balance work for those inert identities; the data declarations alone do not preserve their playable distinction.

Gear is even more directly attached. Each gear definition can add attributes or move one point between attributes; resolving an eight-slot loadout begins from flat 2s, applies the torso’s spread moves, then adds every item’s stats and composes quirks/scalar modifiers (`packages/shared/src/gear.ts:26-70`, `2267-2304`). The catalog itself documents 96 launch items, nine former meta-upgrade ranks, and eight blank compatibility rows (`packages/shared/src/gear.ts:92-97`), i.e. the stated 113 rows. Removing attributes therefore invalidates the budget or player-facing promise of every item with `stats` or `spreadMoves`, plus ballast-related gear behavior. The scalar mod system—weapon/cooldown/healing/hazard/pickup modifiers and flat max HP—can survive (`packages/shared/src/gear.ts:37-53`, `2145-2209`).

One supplied census number does **not** match the current shared runtime catalog: `pets.ts` defines eight pet IDs, not 24 (`packages/shared/src/pets.ts:6-17`). Those eight already progress independently through Bond XP to level 10 and three visual bands, granting source-neutral sustain, capacity, collection, economy, reload, revive, and hazard bonuses (`packages/shared/src/pets.ts:20-54`, `56-121`, `129-180`). This report will use “24” as the wider content-plan/dev-portal claim but “8 implemented shared definitions” for blast-radius estimates. The distinction matters: pet meta-progression is not an attribute substitute to invent; a viable version already exists and should remain account-level, outside the 30 in-run choices.

## Verified findings — pass 2: the weapon catalog is the obvious replacement and the largest migration

The active-catalog number does verify, with an important boundary: shared exports 335 persisted/catalog rows, of which nine are archived, leaving exactly **326 active weapons**; runtime-only fists are excluded (`packages/shared/src/weapons.ts:2194-2197`, `2220-2238`). A read-only census of those exported definitions found all 326 have top-level scaling grades and 320 have attribute requirements. Across active definitions, attribute-grade occurrences were STR 156, DEX 207, INT 209, CON 16, LUK 51; requirement occurrences were STR 136, DEX 164, INT 172, CON 14, LUK 16. These are occurrences, not unique weapons, because a weapon can name multiple attributes and individual damage sources can override the top-level grades. The practical conclusion is firm: **326/326 active weapon rows need a migration decision, and roughly 320 need an explicit requirement replacement or removal.** This cannot honestly be scoped as “delete five fields and let existing weapons work.”

The good news is that weapons already carry a much clearer identity vocabulary. Each definition has an authored 1H/2H/dual/mounted grip, class pool, delivery, fire mode, element, family, range band, damage, reach, cadence, visual scale, and optional behaviors such as cast, gun, beam, throw, quake, chain lightning, scatter, ground zone, status, resurrection, and warp (`packages/shared/src/weapons.ts:440-526`, `528-740`, `741-770`). Multi-source weapons already enumerate their hit/shot/beam/throw/quake/chain/scatter/blast lines separately for truthful card copy (`packages/shared/src/weapons.ts:1292-1385`). This is more semantically useful than asking whether a number came from STR or DEX.

Two existing build systems survive deletion essentially intact. Weapon class composition grants +8% damage at 2-of-a-class and +18% at 3-of-a-class, and the same calculation is used by server damage and client preview (`packages/shared/src/weapons.ts:1166-1190`; `packages/server/src/rooms/GameRoom.ts:3230-3290`; `packages/client/src/ui/level-up-model.ts:404-427`). Dual wield already requires two different genuine 1H weapons with the same class and compatible live delivery, then preserves the individual hands’ grades, rarity, affix, and damage receipts under a throughput ceiling (`packages/shared/src/weapons.ts:1094-1163`). Under this proposal, only the words “grades” and their multiplier path change; class composition, pairing topology, cadence, rarity, affixes, three equipped slots plus bag, scrip, archiving, and bank-or-lose extraction are valuable weapon identity and should remain.

The 16 implemented augments are also already closer to the desired choice quality than attributes: the 14 enumerable cards plus two beam cards are behavior changes such as extra projectiles, ricochet, pierce, split casts, bullet return, shields, and faster beam recovery (`packages/shared/src/augments.ts:36-159`, `161-191`). Their draft is three random eligible choices; weapon delivery gates gun/cast/beam cards while universal parry cards remain eligible (`packages/shared/src/augments.ts:199-202`, `261-315`). Two augments are not attribute-independent: Second Wind scales its heal with CON and Emberguard its wave with INT (`packages/shared/src/augments.ts:215-224`; `packages/client/src/ui/level-up-model.ts:312-323`). Those formulas need new flat/level/stack tuning, but the behaviors themselves should survive.

## Research: what shipped games actually prove

**Vampire Survivors proves viability, not causality.** It does not ask the player to allocate STR/DEX/INT/CON/LUK at level-up. The paused level-up offers three or four weapons/passive items, while characters retain identity through a starting weapon and bonuses; weapons can be advanced and then evolved with a matching passive. Those mechanics are documented by the community-maintained [Level up](https://vampire-survivors.fandom.com/wiki/Level_up) and [Weapons](https://vampire-survivors.fandom.com/wiki/Weapons) references. Poncle’s own [Steam description and starting tips](https://store.steampowered.com/app/1794680/Vampire_Survivors/) tell players to acquire a few offensive weapons and focus on leveling them individually; the page’s enormous review footprint establishes that the loop is commercially validated. But Vampire Survivors still has numerical stats, passive stat items, character bonuses, and permanent power-ups. The defensible lesson is “visible point allocation is not required,” not “numbers are unnecessary” or “removal caused the game’s success.”

**Risk of Rain 2 is the best precedent for the middle-radical version.** Its survivor level silently raises base damage/health/regen rather than opening an allocation modal ([community level reference](https://riskofrain2.fandom.com/wiki/Level)), while its authored pitch makes the player-visible build about more than 110 stacking items and survivors with distinct combat styles and alternate skills ([official Steam page](https://store.steampowered.com/app/632360/Risk_of_Rain_2/)). This is exactly the pattern “hidden automatic baseline, visible item identity.” It also warns that removing the modal does not require removing server-side level scaling.

**Deep Rock Galactic: Survivor supplies the milestone structure.** Its ordinary levels can still be numerical weapon-stat upgrades, so it is not a pure anti-stat example. More usefully, focusing upgrades levels individual weapons, and weapon levels 6, 12, and 18 grant two balanced then one unstable overclock—discrete modification moments rather than an undifferentiated +damage stream ([official DRG wiki, Overclocks](https://deeprockgalactic.wiki.gg/wiki/Survivor%3AOverclocks); [official DRG wiki, Weapons](https://deeprockgalactic.wiki.gg/wiki/Survivor%3AWeapons)). The publisher pitch is explicitly “wield the full arsenal” and “upgrade your gear” ([Steam](https://store.steampowered.com/app/2321470/Deep_Rock_Galactic_Survivor/)). Dimension Drifters can use the same dramatic cadence without copying its exact numbers: frequent weapon ranks, behavior choices at authored thresholds.

**20 Minutes Till Dawn shows how characters survive a shared perk pool.** A level pauses the game and offers a random upgrade/synergy selection; its 25 upgrade trees contain 100 upgrades, including prerequisites and capstones ([community XP reference](https://20minutestilldawn.wiki.gg/wiki/XP); [community upgrade reference](https://20minutestilldawn.wiki.gg/wiki/Upgrades)). Character-specific upgrades instead arrive from elite chests ([character upgrades](https://20minutestilldawn.wiki.gg/wiki/Character_Upgrades)). The useful separation is: common level-ups build the run; rarer character cards express who is running it. That maps cleanly to Dimension Drifters’ existing augment draft plus character quirks.

**Hades shows an adjacent, encounter-paced version.** It does not use XP level-ups as this game does, but it makes the build legible through weapon aspects, Daedalus weapon modifications, and offered god boons. Supergiant describes “dozens of powerful Boons” and “thousands of viable character builds,” while keeping permanent power in the Mirror of Night ([official Steam page](https://store.steampowered.com/app/1145360/Hades/OFFICIAL)); its patch notes show aspects that change attack speed, dodge, pull behavior, or the special itself ([Nighty Night update](https://www.supergiantgames.com/blog/hades-the-nighty-night-update-patch-notes/)). The lesson is not to copy room rewards, but to name the changed verb on the card.

**Brotato and Halls of Torment are the strongest rebuttal.** Brotato explicitly treats primary stats as a core late-run power source and grants a stat upgrade at level-up; it also gets strong composition decisions from multi-weapon class bonuses ([Stats](https://brotato.wiki.spellsandguns.com/Stats), [Experience](https://brotato.wiki.spellsandguns.com/Experience), [Weapon Classes](https://brotato.wiki.spellsandguns.com/Weapon_class)). Halls of Torment deliberately chose an action-RPG middle ground: level-up traits can be stat increases, while hero and ability traits enter ranked pools ([Trait reference](https://hot.fandom.com/wiki/Trait)). Both shipped successfully enough to invalidate any blanket claim that attributes are inherently wrong for the genre. The narrower case against Dimension Drifters’ allocation is specific: five abstract points overlap an unusually large, already-authored weapon/gear/augment identity surface, and the `+2/+1 ballast` transaction makes the result harder to predict than the comparable games’ directly named upgrades.

**Diablo III is the closest documented simplification—and a warning against simplistic triumphalism.** In a retrospective Q&A, Wyatt Cheng said internal tests found assignable attributes intimidating and easy to hoard because players could not judge permanence or future needs; the team used skill-rune unlocks to restore level-up reward. He then said he regretted making a fixed number of rune effects because they overlapped a space better occupied by Legendary items ([transcribed Q&A](https://www.wowhead.com/news/wyatt-cheng-q-a-about-diablo-iii-development-inferno-difficulty-talismans-rmah-327085)). Blizzard’s 1.0.4 patch later explicitly made Legendaries more memorable with unique proc effects and added such effects to more than 50 Legendary and set items ([official patch notes](https://news.blizzard.com/en-us/article/7029347/patch-1-0-4-now-live)). The direct lesson for this proposal is two-sided: move identity onto concrete things, but do not replace five attribute buttons with 29 formulaic, obligatory “runes designed to a number.” Every behavior card must earn its place, and ordinary weapon ranks need a bounded generic library.

My judgment from these sources: the genre supports three successful patterns—manual stat choices (Brotato/Halls), automatic hidden growth plus items (Risk of Rain 2), and item/behavior choices at the progression beat (Vampire Survivors/20 Minutes Till Dawn/DRG:S). Research does not select the winner. Dimension Drifters’ own content topology makes the third pattern attractive; its already-built allocation dependencies make a staged middle-radical path safer.

## Concrete proposal: the Arsenal Draft

### The rule in one sentence

Every level still stops *this player* for the existing five-second, invincible, world-live decision, but the choice is now **which owned thing changes**, never which abstract attribute rises.

There are still 29 choices from level 2 through 30. The cadence is intentionally deterministic:

| Level | Screen | What the player chooses |
|---|---|---|
| 2–4, 7–9, 12–14, 16–19, 21–24, 26–29 | **Arsenal Draft** (21 total) | One of three exact upgrades to an equipped weapon. |
| 5, 10, 15, 20, 25, 30 | **Signature Breakthrough** (6 total) | One of three eligible augments from the existing 16-card pool. |
| 6 | **Ultimate Ignition** | One of all five ultimate families, explicitly. |
| 11 | **Ultimate Temper** | One of that family’s four behaviorally named forms, explicitly. |

This preserves the current six augment beats and almost exactly preserves the current ultimate timing: today five complete `+2/+1` decisions lock the family and ten temper the variant (`packages/server/src/rooms/progression.ts:84-118`). It simply turns the calculation into an informed choice.

### Weapon tuning: three tracks, three ranks each

Each weapon has nine run-only tune ranks. The ranks attach to the weapon instance, survive stowing and bag moves, and disappear when the expedition ends; archiving and permanent weapon value stay unchanged.

- **Force I–III:** a bounded additive increase to every damage source on that weapon. Starting tuning target: +12% of the rank-zero source damage per rank.
- **Tempo I–III:** improves the weapon’s real action cycle—attack/cast cadence, reload/refill, or beam recovery as appropriate. Starting target: roughly 8% faster per rank, with the card showing seconds rather than the formula.
- **Form I–III:** changes the weapon’s delivery. It uses a small authored profile library keyed by the existing delivery/fire-mode/family tags: pierce or bounce for projectiles; pellets or pattern for spread; fork/homing for casts; vent/focus for beams; charge/ricochet for throws; sweep/finisher for melee; footprint/duration for ground zones; and bespoke profiles for warp, resurrection, glove pairs, and other exceptions. Any geometry change must drive both authoritative hit geometry and VFX; the current “size never scales” law would be deliberately replaced, not silently violated (`packages/shared/src/weapons.ts:490-495`, `609-639`).

The draft samples three uncapped `(weapon instance, track)` candidates with these guarantees: at least one card is for the held weapon; no card has zero effect; a stowed equipped weapon cannot go more than three ordinary drafts without appearing; and the server snapshots the offered weapon instances when the level is earned, as it already snapshots signature delivery in `sigGateQueue` (`packages/shared/src/state.ts:206-208`; `packages/server/src/rooms/progression.ts:138-143`). If only one weapon is equipped, the screen can show Force, Tempo, and Form for that weapon—still a real three-way choice.

Investing in an early weapon must not make later loot feel unusable. Replacing a tuned weapon therefore offers an atomic **Reforge**: transfer that instance’s nine-rank vector to the incoming weapon, remapping Force→Force, Tempo→Tempo, Form→Form, and strip the dropped item so ranks cannot duplicate. The pickup preview says exactly what transfers. A player may instead keep the old tuned weapon in the bag and start the new one at rank zero. This is new state and transaction work, but without it the proposal turns the existing 326-weapon loot game into a sunk-cost trap.

### Literal ordinary level-up screen

The following is the exact proposed copy for an example level 8 screen; numbers are illustrative starting tuning, not claims about current balance:

```text
LEVEL 8 · ARSENAL DRAFT · CHOOSE 1
BASELINE GROWTH  +2 MAX HP · +0.1 HP/s     WORLD LIVE

[1]  RUSTY CLEAVER                         FORCE II
     HIT 28 → 32  (+4)
     ALL CLEAVER SOURCES +12%
     WEAPON RANK 3/9 → 4/9

[2]  ARC-LANCE                             TEMPO I
     CAST 0.80s → 0.74s
     RECOVERS 8% FASTER
     WEAPON RANK 1/9 → 2/9

[3]  RIVET PISTOL                          FORM I
     NEW · BULLETS PIERCE +1 ENEMY
     MAGAZINE AND DAMAGE UNCHANGED
     WEAPON RANK 0/9 → 1/9

AUTO: RUSTY CLEAVER · FORCE II IN 4.6s
HELD: RUSTY CLEAVER · MELEE 2/3 (+8%) · 1–3 PICK · ←/→ · ENTER
```

On compact layouts the cards retain the weapon name, changed verb, exact before→after receipt, and rank; lore and unchanged details collapse first. The default timeout takes the held weapon’s lowest uncapped track, with Force→Tempo→Form as the stable tie order. It never guesses from scaling grades.

### Literal Signature screen

The existing augment pool and weapon-delivery eligibility remain, but non-stacking cards already owned are removed instead of displaying “NO NEW EFFECT.” A level-10 caster example reads:

```text
LEVEL 10 · SIGNATURE BREAKTHROUGH · CHOOSE 1
ARC-LANCE GATE CAPTURED WHEN THIS LEVEL WAS EARNED     WORLD LIVE

[1]  CAST · OVERCHARGE
     BOLT DAMAGE ×1.25
     OWNED ×1 → ×2

[2]  CAST · ARC SPLIT
     FORKED BOLTS 1 → 2
     MAX 3

[3]  PARRY · BULWARK
     NEW · PARRY GRANTS 12 SHIELD
     DOES NOT EXTEND INVULNERABILITY

AUTO: OVERCHARGE IN 4.6s
1–3 PICK · ←/→ · ENTER
```

Second Wind becomes a flat heal per stack plus a small percentage of max HP; Emberguard gets an authored flat wave damage plus stack scaling. Neither mentions CON or INT. Counterblade and other augment damage uses an explicit augment power table, not the held weapon’s hidden grade.

### Literal Ultimate screens

At level 6, show all five families. Do not pretend a random three-card offer is an interesting constraint when the choice is run-defining and only happens once:

```text
LEVEL 6 · ULTIMATE IGNITION · CHOOSE 1
LOCKED FOR THIS RUN · FORM CHOICE ARRIVES AT LEVEL 11

[1]  SEISMARCH
     LEAP AND AUTHOR THE FAULT LINE

[2]  ALPHA STRIKE
     BECOME THE SIX-CUT VERDICT

[3]  SUNSPITE COMET
     HURL THE SYNCHRONIZED COMET

[4]  EVENT HORIZON
     PHASE THROUGH AND BRAND THE HORDE

[5]  DIMENSION DOOR
     FOLD DISTANCE · PRESS F AGAIN TO RETURN

AUTO: RECOMMENDED · SEISMARCH IN 4.6s
F CASTS ULTIMATE · 1–5 PICK · ←/→ · ENTER
```

“Recommended” may use the equipped weapon composition and Frame, but recommendation never restricts the five choices. At level 11, the four current attribute-coded variants receive family-specific names and exact behavioral text. For a Seismarch run:

```text
LEVEL 11 · TEMPER SEISMARCH · CHOOSE 1
LOCKED FOR THIS RUN

[1]  QUICKFAULT
     IMPACT AREA 20% SMALLER
     JUMP IS READY ON LANDING

[2]  LONG RIFT
     FISSURE LASTS 5.0s
     LOWER DAMAGE EACH TICK

[3]  WARDEN'S LANDING
     ALLIES IN THE IMPACT GAIN 20 SHIELD
     INNER IMPACT DAMAGE IS REDUCED

[4]  GILDED FAULT
     SEISMARCH CRIT CHANCE ×1.5
     DAMAGE AND AREA UNCHANGED

AUTO: QUICKFAULT IN 4.6s
1–4 PICK · ←/→ · ENTER
```

Those descriptions reflect mechanics that already exist in the server’s four Seismarch variants—smaller radius plus jump reset, longer lower-damage fissure, ally shield with reduced inner damage, and higher crit chance (`packages/server/src/rooms/GameRoom.ts:6769-6849`). The other 16 cells require the same naming/copy pass, but their mechanics need not be thrown away.

### Where power comes from and how the run arcs

The starting target for automatic baseline sustain is +2 max HP and +0.1 HP/s per level. This replaces the survival floor that ballast currently creates without asking the player to spend a card on “not falling behind.” It is displayed in the header receipt, so “automatic” is not “secret.” Exact values require simulation against the current CON distribution; they are my design targets, not researched facts.

The run then has four readable acts:

1. **Levels 1–5 — establish:** the starting Frame, gear, pet, rarity/affix, and first weapon tunes define immediate feel; level 5 adds the first behavior augment.
2. **Levels 6–11 — declare:** choose the ultimate family, concentrate Force/Tempo/Form ranks, take a second augment, then lock the ultimate form.
3. **Levels 12–20 — combine:** the second and third equipped weapons create class-set and dual-wield decisions; augments at 15 and 20 make interactions rather than merely raise totals.
4. **Levels 21–30 — specialize:** scarce remaining tune ranks force one mastered weapon or a broad arsenal; levels 25 and 30 complete the six-augment signature. The cap receipt shows the finished three-weapon rank grid, Frame, gear effects, augment stack, ultimate, and pet—not five final attribute totals.

That is earned progression: 21 irreversible-for-the-run weapon decisions, six behavior decisions, two ultimate decisions, automatic survival growth, plus whatever rarity, affix, gear, pet, set, pair, and loot changes the expedition produces. Level still matters even when no attribute exists.

## Preserve identity without allocation: Frame + Signature

Pure deletion should not turn every body into the same mannequin. Each run identity gets two visible layers:

- **Frame:** two or three fixed, direct modifiers that establish physique and handling. It says “+25 max HP,” “weapon recovery 8% slower,” or “+6 crit points,” never “CON 4” or “DEX 4.”
- **Signature:** the existing named character/gear quirk, expressed as a rule. This is where The Unbending, Graveside Manner, Pressurized, and the rest belong.

Example character-select copy for opposite identities:

```text
SIR GALLOWAY · THE UNBENDING
BULWARK FRAME
MAX HP 125 · REGEN 7.5/s · WEAPON RECOVERY 8% SLOWER
SIGNATURE · NO SINGLE HIT DEALS MORE THAN 25% OF MAX HP
```

```text
THE HOLLOW MASK
RAZOR FRAME
MAX HP 80 · WEAPON DAMAGE +12% · CRIT +6 POINTS
SIGNATURE · ONCE PER DIMENSION, A KILLING BLOW LEAVES YOU AT 1 HP
```

These are proposed authored identities, not mechanical translations presented as finished balance. Galloway’s cap is currently active; Porcelain is currently declarative but inert, so shipping the second card means building its missing per-dimension lethal-prevention token (`packages/shared/src/character-classes.ts:226-231`, `340-345`). This illustrates the honest cost: a Frame preserves the spread’s *intent*, but a loved character is not preserved until the signature actually runs.

There are two viable authoring methods:

1. **Recommended quality bar:** hand-author 40 Frames using each spread, lineage, quirk, name, and silhouette as source material; cap each at three direct modifiers and show all of them. This preserves fantasy rather than mechanically freezing the old formula.
2. **Migration scaffold only:** translate above-flat spread points into direct lanes (STR→melee force, DEX→ranged/handling, INT→cast/augment power, CON→HP/regen, LUK→crit/scavenge), then have a designer rewrite the result. Shipping the mechanical translation untouched would merely hide the old attributes under prose and keep cross-class traps.

Current code already defines the precedence rule worth keeping: when validated gear exists, gear owns run identity; character kits are the compatibility fallback (`packages/server/src/rooms/GameRoom.ts:3295-3367`). The new resolver should likewise output one `Frame`, one `Signature`, and direct mods whether its source is a legacy character or an eight-piece gear loadout. Characters remain art, lore, fallback identities, and migration provenance; gear remains the modern buildable identity.

The gear blast radius is large but more bounded than “rewrite 113 unique stat items.” A read-only catalog census found 113 rows total; only six have nonempty `stats`, 12 have `spreadMoves`, 12 carry a quirk, and 23 have scalar `mods`. Among the 96 launch-set pieces, none has nonempty `stats`; the 12 set torsos carry the spread moves, 12 pieces carry quirks, and 20 carry scalar mods. Thus the mechanical conversion targets are the 12 torso Frame rules plus six legacy Power/Fortune stat rows; the other rows still require copy and budget auditing but most already speak in direct effects. The source model and resolver are at `packages/shared/src/gear.ts:55-70`, `92-97`, and `2267-2304`. Also, `GEAR_CLASS_BONUSES` is currently five empty arrays (`packages/shared/src/gear.ts:2118-2124`): the live +8%/+18% thresholds are **weapon** class composition, not an eight-piece gear-set bonus. Do not invent a gear-set system merely to justify keeping the set art.

## Explicit replacements for every attribute job

| Current job | Pure-deletion replacement |
|---|---|
| Weapon damage grades | Force ranks plus rank-zero damage rebase. Source ratios remain authored; no S–E player-facing grade. |
| Attribute requirements | Delete the damage penalty. Grip, rarity, world tier, bank/carry risk, three slots, pairing compatibility, and class composition already gate access. A requirement without allocatable attributes is only a hidden tax. |
| Crit from DEX/LUK | Each damage source gets an explicit base crit (default migration target around the current early-run 8%), weapon Form can add crit, and Frame/gear/augment bonuses remain additive. Preserve the 75% cap and ×2 crit receipt. |
| Ultimate crit and damage | Each of the 20 cells receives fixed base tuning plus its named form effects. It does not borrow the held weapon’s crit, avoiding swap-at-cast exploits. |
| CON max HP/regen | Visible automatic level growth supplies the floor; Frame, gear, augments, and pets provide differentiation. Flat and percentage sustain effects replace CON coefficients. |
| Second Wind / Emberguard | Flat + max-HP heal per stack; authored wave base + stack multiplier. |
| LUK rarity weighting | Direct `Scavenge +N% high-tier weight` on specific gear/Frames/pets. Show the percentage. |
| Squad harvest from best LUK | Direct `Harvest +N%`, retaining the current “best living squad member” policy only if cooperative testing says the leader mechanic is fun. Otherwise sum with a cap. |
| Ballast | Automatic baseline HP/regen plus guaranteed valid weapon cards. There is no lowest stat to repair. |
| Timeout default | Held weapon’s lowest uncapped tune track; stable Force→Tempo→Form tie order. |
| Ultimate family/variant ranking | Explicit level-6 and level-11 choices. Keep all 20 mechanics, remove `allocRun` ranking. |
| Character/gear spread | Visible fixed Frame + Signature. No mutable five-number record. |
| Legacy Power/Fortune/Vitality ranks | Preserve account value by migrating to the already-visible gear ranks: Power becomes direct weapon damage, Fortune direct crit/scavenge, Vitality remains flat HP. Current gear-seeded runs already zero the three compatibility counters (`packages/server/src/rooms/GameRoom.ts:3342-3351`). |
| Pet progression | Keep Bond XP, levels 1–10, stage bands, and direct mods. Rebalance Verdant Wing’s regen multiplier against the new baseline; no pet needs an attribute. |

The crit migration is not cosmetic. The server currently rolls crit across melee, gun, cast, beam, projectile, zone, augment, and ultimate seams and exposes a crit-flash receipt (`packages/server/src/rooms/GameRoom.ts:6678-7020`, `8698-8699`, `11194`, `11273-11279`; `packages/shared/src/state.ts:382-385`). Every call needs a declared source policy. “Use 5% everywhere” would erase LUK builds; “use the held weapon everywhere” would create nonsensical pet/augment/ultimate coupling.

## What genuinely breaks: blast radius

### Catalog and balance

- **326 of 326 active weapons** need a rank-zero damage rebase and tune-profile assignment; **320** need requirements removed or replaced. There is no untouched control group.
- **129 active weapons have more than one enumerated damage source** (maximum three). Those require manual source-by-source audit because their current independent grades let, for example, an edge and explosion favor different builds. A mechanical “one Force scalar” conversion loses that expressiveness.
- Existing tags cover all active rows and can seed the profile library, but special forms still need manual treatment: the current active catalog includes 22 beams, 117 guns, 18 thrown weapons, 38 quakes, 17 chain-lightning definitions, 45 scatter definitions, seven ground zones, one warp, one resurrection carrier, two glove pairs, and 54 performance blocks. Categories overlap. These are read-only runtime census results, not estimates.
- The minimum honest content scope is therefore 326 reviewed mappings, with 129 high-touch mappings—not “roughly the 20 weird weapons.” A generator can propose profiles, but generated output must be inspected and balance-tested.
- Damage, cooldown, reload/refill, beam heat, crit, class-set multiplication, rarity/affix multiplication, dual-wield throughput ceilings, boss time-to-kill, XP pacing, and enemy scaling all need new reference builds at levels 1/5/10/20/30. Requirements currently suppress many weapons early; removing them changes both average and worst-case power even before any tune is selected.

### Character, gear, augment, ultimate, and pet content

- **40 legacy identities:** author and test 40 Frames; audit all quirks; implement or deliberately mark every inert signature. The existing sum-10 spreads can be archived as migration provenance but no longer execute.
- **113 gear rows / 12 eight-piece sets:** convert 12 spread-moving torsos and six stat-bearing compatibility items mechanically, preserve direct scalar mods/quirks, and review all effect text and budgets. The set artwork and class labels survive.
- **16 augments:** keep the behaviors, replace two attribute formulas, establish source crit/power rules, remove already-owned nonstacking dead offers, and balance six picks against the new weapon ranks.
- **20 ultimate cells:** preserve mechanics and VFX, rename every variant, write exact cards, replace allocation scaling, choose base damage/crit, and test every family/form in solo and co-op. Explicit choice will increase access to the currently strongest cell, so “usage will average out” is not a balance plan.
- **Pets:** eight shared definitions are implemented despite the 24-pet wider census claim. Bond XP/account schema survives. Regen, healing, capacity, economy, revive, and hazard mods need interaction tests against the new baselines; the remaining planned pets should be authored directly, never through deleted attributes.

### Server, protocol, client, persistence, and tests

- `PlayerState` serializes five attributes plus the flex/timer fields and sits at a documented 64-direct-field ceiling. Removing fields reindexes Colyseus schema data; adding per-instance tune state needs a nested row or a major schema rebuild (`packages/shared/src/state.ts:86-132`, `191-208`, `230-239`). A rolling-compatible release should leave five fixed tombstones until the next hard schema version rather than reclaiming them casually.
- The `chooseAttribute` message, pending counters, timeout loop, freeze/untarget policy, client modal, prediction freeze, level-up pure model, weapon card scaling/requirement art, pair preview, menu stat preview, and broad test fixtures all change (`packages/server/src/rooms/GameRoom.ts:2301-2327`, `9675-9710`; `packages/client/src/net/prediction.ts:114`; `packages/client/src/scenes/arena/card-art.ts:732-758`; `packages/client/src/ui/pair-preview.ts:44-74`; `packages/client/src/scenes/MenuScene.ts:1566`, `1930`).
- Server combat cannot merely stop calling `critChanceFor`: direct attribute reads also drive regen, ultimate scale, harvest, loot leadership, parry healing, Emberguard, run snapshots, and legacy meta upgrades (`packages/server/src/rooms/GameRoom.ts:3295-3367`, `6276-6284`, `6678-7020`, `9522`, `11450`, `11664`, `11719-11726`).
- Weapon ranks must follow an instance through active slot, stowed slots, bag, dual-wield pair, pickup/drop, reconnect, and reforge without entering permanent bank value. That touches the arsenal transaction paths even though rarity, affix, scrip, and archiving rules do not conceptually change.
- `packages/shared/src/leveling.ts`, `weapons.ts`, `combat.ts`, `gear.ts`, `state.ts`, `character-classes.ts`, and generated character/weapon data all have type or formula dependencies. Core server impact is concentrated in `progression.ts` and the very large `GameRoom.ts`; core client impact is concentrated in `level-up-model.ts`, `ArenaScene.ts`, card art, pair preview, and menu previews. The associated tests are extensive and valuable—they must be rewritten around new invariants, not deleted for expediency.

Order-of-magnitude only, because this repository provides no team-velocity basis: this is plausibly **18–30 person-weeks** of engineering, content conversion, UI, automated coverage, balance simulation, multiplayer soak, and manual catalog QA before release confidence. The 326-row migration and 20-cell/40-identity playtest matrix dominate; multiple people can shorten calendar time but not erase the work. A one-sprint estimate would be unserious.

## What is lost, even if execution is excellent

The deletion removes real systemic expression:

- A single stat investment currently powers multiple compatible weapons, so swapping from one INT caster to another preserves the build. Instance-bound ranks instead reward commitment to the object; Reforge reduces but does not erase that difference.
- Multi-source weapons can currently lean toward different components. Wyrmtooth’s physical edge and INT magma are the explicit code comment example (`packages/shared/src/weapons.ts:1227-1236`, `1794-1833`). One Force track compresses that hybrid identity unless its Form profile restores a branch.
- Requirements create a delayed “grow into this weapon” goal. Deleting them makes every acquired weapon immediately usable. I think that is correct for a three-slot, frequent-swap bullet-heaven, but players who enjoy aspirational loot lose a planning horizon.
- STR/DEX/INT/CON/LUK provide a shared language across weapons, survivability, crit, loot, augments, and ultimate. Direct effects are clearer locally but less systemic globally; every new interaction requires authored policy.
- Offense versus CON versus LUK is a universal opportunity cost. Weapon-only drafts can over-focus offense unless automatic sustain and scavenge-bearing Frames/gear are tuned carefully.
- Today the ultimate emerges from the build’s allocation history. Explicit selection is clearer and fairer, but it loses the pleasant interpretation that “the way I grew revealed my ultimate.”
- Ballast is an inelegant but effective guardrail: it quietly keeps neglected stats moving. The replacement must put the same safety into baseline growth, offer validity, and enemy tuning rather than simply remove the safety net.
- A fixed five-number spread efficiently differentiates 40 characters and every weapon at once. Forty direct Frames read better, but cost more to author and are more vulnerable to exceptions, tooltip growth, and balance drift.

There is also a subtler risk: the current level-up implementation is not a lazy spreadsheet. It already gives exact before→after receipts, requirement status, held-source damage, crit, regen, squad harvest, class-set context, smart timeout, responsive layouts, and strong presentation. If testing says players understand and enjoy those decisions, deletion would destroy a surfaced system—not rescue a buried one. “Attributes are vestigial” is a hypothesis this option must beat in play, not a fact established by Vampire Survivors.

## Middle-radical option: delete allocation for players, keep identity attributes underneath

This is the version I would test first. The player sees the exact Arsenal Draft, Signature, and Ultimate screens above and never allocates or sees STR/DEX/INT/CON/LUK. The server temporarily retains the five values as a compatibility implementation for weapon grades, crit, CON, character/gear spreads, and existing balance.

The hidden values must be deterministic, not secretly steered by the weapon held when the timer expires. At the run boundary, the selected character or gear loadout produces a **Frame growth vector**—five nonnegative weights summing to three points per level. At level `L`, the server derives each compatibility value directly from starting spread plus `(L−1) × weight`; it does not mutate points from choices. The vector is authored once per Frame and its *effects* are summarized in direct language such as `BULWARK FRAME · HIGH HP GROWTH · SLOWER WEAPON RECOVERY`. Recomputing from level makes reconnect/replay deterministic and deletes `allocRun` as a gameplay choice even before the five fields disappear.

Four guardrails keep this from becoming a dishonest hidden-stat game:

1. Weapon cards show the final rank-zero and tuned damage/cadence produced by the current Frame; no grade letters are shown.
2. Attribute requirements are disabled during the experiment. Hiding the reason for a 25–88% damage penalty would be unacceptable.
3. Ultimate family and form are explicit choices immediately; `allocRun` no longer ranks them.
4. The level-up header shows direct automatic receipts for any changed HP/regen/crit/scavenge outcome. “Hidden” means no allocation grammar, not unexplained power.

This bridge preserves most current damage slopes and all starting spread work while the 326 tune profiles are evaluated. It also creates a clean kill criterion: if players choose faster, can predict the result, swap weapons more, and produce at least as much build diversity, then migrate grade scaling into Force/Form, convert Frames to direct mods, and finally tombstone the compatibility fields. If the Arsenal Draft is repetitive or makes loot swaps feel worse, remove the experiment and retain the current exact-outcome allocation screen. The rollback does not require reconstructing deleted content.

The bridge is not the final ideal. Hidden attributes still make balance hard to reason about and let one unseen value influence unrelated systems. Leaving them forever would produce the worst documentation burden: direct prose on the surface, five invisible causes underneath. It is a risk-reduction step with an explicit decision gate, not a compromise to ship indefinitely.

## What I would not change

- **XP structure:** keep squad-shared XP, the 1.15 curve, cap 30, cross-dimension level persistence, and the existing reachability target (`packages/shared/src/leveling.ts:10-21`). They already produce the desired run spine.
- **The protected decision beat:** keep five seconds, local freeze, untargetability/invulnerability, world-live co-op, authoritative offer, deterministic timeout, and input-release safety. Change the content, not the reliable shell.
- **Arsenal topology:** keep three equipped slots plus bag, active/stowed weapon identity, rarity, affix, earned provenance, Scrip, bank-or-lose expedition stakes, extraction, prestige archive handling, and reconnect ownership.
- **Weapon feel and legibility:** keep delivery families, authored cadence, source-specific WYSIWYG hit/VFX rules, muzzle truth, performance blocks, and exact before→after card math. Tune Form may alter geometry only when the visual follows it.
- **Composition:** keep +8%/+18% weapon class thresholds and same-class/compatible-delivery 1H pairing. These are simple, visible reasons to care about the loadout as a set.
- **Augment behaviors:** keep the six-pick signature cadence, three-card eligible drafts, stacks, and weapon gate snapshot. Improve dead-card filtering and remove only attribute coefficients.
- **Ultimate mechanics and spectacle:** keep all five families, four forms each, F input, charge/phase/receipt/VFX machinery, and late-join state. Change selection, names, and scaling.
- **Gear, character, and pet authored identity:** keep all art, names, lore, set groupings, scalar effects, quirks, Bond XP, pet levels/bands, and cosmetic sync. Replace numeric spread execution; do not delete the content that motivated it.

## Honest verdict

**Would I ship pure deletion as one change on `feat/v0.118-metagame`? No.** It is too destructive for this specific game in its current state. The owner has not merely sketched five stats: the work is embedded in 326 weapons, 40 legacy identities, gear-run snapshots, crit and loot, the signature draft, 20 ultimate cells, network schema, exact UI previews, and a substantial test suite. The replacement is itself a major weapon-progression feature. Deleting first would trade a functioning, unusually well-surfaced system for a design promise.

**Would I ship the player-facing radical direction after a contained playtest? Yes.** The game’s strongest distinctive assets are its huge authored arsenal, moment-to-moment weapon feel, gear looks/effects, augments, ultimates, and pets. Asking “which weapon do I change, and how?” is more immediate than asking which acronym should receive two visible points and one invisible ballast point. Explicit ultimate choice is also plainly more legible than reverse-engineering a 15/30-point ranking rule.

My recommendation is therefore: approve **Option C-middle** as the first playable decision—remove allocation from the experience, run the Arsenal Draft, retain deterministic hidden compatibility growth, disable requirements, and make ultimates explicit. Do not approve permanent data-model deletion until the replacement beats the current screen on four concrete tests: median decision time, percentage of choices with an immediately observed effect, weapon-swap rate after level 10, and diversity of weapon/augment/ultimate end states without higher down/wipe rates. If it wins, finish the deletion and pay the 326-row/129-high-touch migration cost deliberately. If it does not, keep attributes and simplify only the language. That outcome would not invalidate the experiment; it would prove that the owner’s existing work is earning its complexity.

## Validation

- Required sections present: 1am summary, codebase verification with file/line references, named research sources, concrete proposal, verbatim UI copy, costs/losses, preserved systems, middle-radical alternative, and honest verdict.
- All 17 distinct locally cited source files exist; no local reference resolved to a missing path.
- Nineteen external source links are inline with the claims they support.
- Markdown structure check: six balanced fenced blocks, no trailing-whitespace lines.
- Workspace scope check reports this report as an untracked file. The wider worktree was already actively dirty with other Sol work; this task wrote only `docs/design/design-option-c-radical.md` and did not touch those files.
- Per the design-only mandate, no product build, test suite, generator, game process, or live port was run or changed. Runtime censuses were read-only imports of the existing shared build.
