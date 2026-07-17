# Pet System — Systems Designer

## Design verdict

Ship **eight account-owned pets**, with exactly one selected for an entire run. A pet is a visible PSO2-MAG-style companion, not a combat unit: it follows, evolves, and supplies exactly two immutable benefits. **Bonus 1 is active at level 1 and scales through 10; bonus 2 is a fixed capstone that switches on at level 10.** There are no pet stat allocations, random personalities, breeding rolls, or duplicate copies.

The system's axis is **sustain and economy**. It makes a run more recoverable or less lossy without becoming another damage build, character quirk, augment draft, or flat-stat tree.

## 1. The progression model

### 1.1 Bond XP, not Scrip feeding

The equipped pet earns **Bond XP from completed run structure**. Bond XP is calculated authoritatively and banked with the account only when the run reaches a legitimate terminal result: extraction, victory, or squad wipe. Completed-clear receipts survive a wipe; abandoning a live run forfeits its unbanked receipts. A disconnect may rejoin the same run, but cannot cash out by reconnecting.

| One-time run receipt | Bond XP |
|---|---:|
| First dimension clear | 100 |
| Second dimension clear | 140 |
| Third dimension clear | 180 |
| Successful terminal extraction/victory | 80 |
| **Maximum per run** | **500** |

Only the first three clears pay, each dimension epoch can receipt once, and restart/training/debug states pay zero. A wipe after the first, second, or third clear banks 100, 240, or 420 XP. An early wipe before a clear banks zero. The rising 100/140/180 weights make “clear one easy dimension and reset” materially worse than finishing the 12–15 minute chain.

The receipt is squad-milestone based, not last-hit based. A player qualifies for a dimension receipt after being present for 60 seconds and issuing at least three accepted combat/support actions in that dimension; being downed later does not erase qualification. This blocks idle co-op leeching without making teammates compete for kills.

There is deliberately **no Bond XP for kills, damage, elapsed time, rarity, Scrip earned/spent, difficulty, or feeding**. Those faucets would reward trash loops, sponge milking, AFK time, hoarding sale stock, or picking a difficulty for XP-per-minute rather than play. The equipped pet alone receives XP; kennel pets do not passively level. A maxed pet discards further Bond XP—there is no XP-to-Scrip conversion or prestige power loop.

### 1.2 Ten-level curve and target time

| Pet level | XP to next | Cumulative XP |
|---:|---:|---:|
| 1 | 120 | 0 |
| 2 | 180 | 120 |
| 3 | 240 | 300 |
| 4 | 300 | 540 |
| 5 | 360 | 840 |
| 6 | 420 | 1,200 |
| 7 | 480 | 1,620 |
| 8 | 600 | 2,100 |
| 9 | 900 | 2,700 |
| 10 | — | **3,600** |

- A dedicated player doing full chains reaches level 10 in **8 runs**, about **1.6–2.0 hours** at 12–15 minutes each. Seven clears stop at 3,500, so the capstone still needs a final commitment.
- A casual player averaging 260–330 XP through a mix of wipes and clears reaches level 10 in **11–14 runs**, about **3–4.5 hours** including menus and restarts.
- The eight-pet launch collection therefore represents roughly **16–30 hours** of deliberate bonding, while every newly acquired pet is useful immediately at level 1.

XP banks after the run, so a level-up and its stronger scalar never appear halfway through combat. Reaching level 10 on the result screen activates the capstone for the next run.

### 1.3 Two immutable bonuses

For pet level `L` in `[1,10]`, each roster row defines one transparent `Bonus1(L)` formula. There are no breakpoints hidden behind rarity or affection. At level 10, the capstone is added; it does not replace Bonus 1. The pet card always shows the current number, next-level number, and locked capstone.

**Verdant Wing, the required green butterfly, is the reference contract.** Its regeneration multiplier is `1 + 0.05L`: **×1.05 at level 1 through ×1.50 at level 10**. It multiplies the already-derived passive regeneration, after CON: the current CON 1 baseline of 6 HP/s becomes 6.3 HP/s at level 1 and 9 HP/s at level 10.

At level 10, Verdant Wing also grants **+1 maximum charge to every charge-using weapon**. Against the shipped per-weapon ledger, that means:

- a gun uses `gun.magazine + 1`; a thrown weapon uses `thrown.charges + 1`;
- every accepted shot or throw still spends exactly one charge;
- reaching zero still starts the authored reload/refill timer, which restores the boosted maximum only when it completes;
- swapping saves and restores the weapon's existing cooldown, reload, and remaining-charge debt; the capstone never clears debt, refills on draw, or initializes a familiar weapon as a fresh pickup;
- melee and beam weapons receive nothing, and no projectile, duplicate attack, cooldown reduction, or damage is added.

This is literally one extra weapon use per full magazine/refill cycle, not “two attacks for one charge.” Selecting the pet before the run also means capacity cannot change mid-ledger.

### 1.4 Three visual evolution stages

Evolution is shared grammar with species-specific parts; it never changes collision or targeting.

| Stage | Levels | Visible contract |
|---|---|---|
| **Hatchling** | 1–3 | 65% mature scale, one simple appendage pair, muted secondary color, one faint trail. Follows about 52 px behind the owner's shoulder. |
| **Awakened** | 4–7 | 85% scale, second appendage/shell layer, saturated accent, one orbiting mote, wider idle motion. Follows about 62 px behind. |
| **Ascendant** | 8–10 | 100% scale, complete silhouette and markings, two restrained orbit motes, species-specific wake. At level 10 the existing core/glyph lights permanently; this is not a fourth silhouette. Follows about 72 px behind. |

The pet is a client-smoothed, non-colliding follower with no hurtbox, nav body, aggro, projectile interception, or damage event. It snaps cosmetically to its owner after teleports or extreme separation rather than pathfinding through the horde. The larger stages communicate account history without consuming combat space.

## 2. Acquisition

### 2.1 Primary acquisition: deterministic shopkeeper eggs

**Launch collection: eight pets.** Verdant Wing is free on completing the shopkeeper introduction at the end of onboarding and hatches immediately at level 1, before the first counted expedition. A new account can therefore bring one pet from the start of its first real run.

Six standard eggs are permanent, deterministic entries in a separate **Companions** row at the shopkeeper for **160 Scrip each**. They never rotate and never displace weapon offers or the existing `META_UPGRADES` cards. The player sees the pet's mature look, full level-10 numbers, and capstone before buying. An egg purchase is account-wide, one-time, and hatches at level 1 on the meta screen.

At current earned-weapon sale values of 4/9/18/34/60 Scrip, 160 is equivalent to 40 Common, 18 Uncommon, 9 Rare, 5 Epic, or 3 Legendary sales before mixing tiers. It sits below the 180–200 top ranks of Fortune/Power: a real choice, but not a tax that requires finishing every flat-stat track first.

### 2.2 Rare acquisition: one protected wild egg

Slate Tortoise is the launch wild pet. A **terminal-victory chest** makes one account-level roll—never trash, damage, or last hits—starting at 8%, increasing by 8 percentage points after every miss, and becoming guaranteed on the eighth eligible victory. The visible pity counter is account-persistent. The egg is awarded to each eligible account independently, occupies no arsenal/bag slot, cannot be stolen in co-op, and hatches at level 1 immediately after the terminal result.

There are no duplicate wild drops. This preserves the “found in a run” story while bounding bad luck, avoiding restart farming, and keeping seven of eight launch builds deterministic.

## 3. The slot law

**Exactly one owned pet is selected on character select**, alongside the character and starting loadout. “No pet” remains an explicit accessibility/clean-screen option, but it grants no compensation. The selection is included in the immutable run-start account snapshot.

There is **no mid-run switch**, including at shopkeepers, rifts, dimension descents, reconnects, or cosmetic character cycling. This is necessary commitment, not friction: swapping could otherwise heal on descent, expand a bag only while looting, equip the Scrip pet only while selling, turn reload debt into a different capacity, or sweep XP only at an exit. A pet should describe the run the same way a keepsake does, and teammates should be able to read that choice.

Pets are personal. Their effects do not form auras and identical pets do not stack across players. The Pale Firefly can improve a revive performed by its owner, but that is still one owner's output receipt.

### Downed and death rules

The pet **never dies**. Pet death would add escort AI, revival UI, focus-fire randomness, and a failure snowball to an account-progression system. Instead, when the owner is downed the pet parks beside the body at 35% opacity, loses its orbit motes, and all gameplay bonuses suspend. It cannot collect XP, pull loot, mint Scrip, revive, or benefit the surviving squad while its owner spectates.

On revive, bonuses resume with **no catch-up tick or retroactive receipt**. Existing inventory and weapon-ledger values are not destructively clamped while downed: a Copper Snail's 13th bag item remains but no new over-cap item may be added, and Verdant Wing's remaining charges are neither removed nor refilled. This treats suspension as “no new benefit while down,” not mutation of durable run state. Bond XP already earned from completed dimension receipts still banks on a later wipe.

## 4. Bonus taxonomy: one system axis

The one-axis law is about **system ownership**, not forcing both bonuses to repeat the same stat. Pets may touch only an existing sustain or economy scalar/receipt:

- **Sustain:** passive regeneration, explicit healing received, revive reach/return HP, environmental recovery, and gun/thrown resource endurance.
- **Economy:** XP-mote collection, earned-weapon pickup/carrying, and legitimate shopkeeper sale receipts.

If an effect cannot be expressed as a bounded change at one of those seams, it is not a pet bonus.

| System | It owns | It must not borrow from pets |
|---|---|---|
| **Character quirks** | Rule-benders tied to identity: new triggers, conversions, exceptions, or verbs. A roll that pickpockets Scrip remains a quirk because it creates a new receipt from a roll; an extra shop offer remains a quirk because it changes shop rules. | Pets do not add attacks, parry rules, movement verbs, shop offers, class gates, or conditional damage conversions. |
| **`META_UPGRADES`** | Permanent unconditional flat baselines: current Vitality `+20 max HP`, Fortune `+1 LUK`, Power `+1 STR` per rank. | Pets never grant max HP, STR/DEX/INT/CON/LUK, flat damage, crit, rarity, or movement speed. |
| **Augments** | Mid-run draftable and stackable build mechanics attached to weapon/parry delivery gates. | Pets never enter drafts, stack, read the held weapon to change offers, add ricochets/splits, or alter set bonuses. |
| **Ultimates** | Unlock, variant, charge, cast, and payload economy. | Pets never grant ultimate charge, meter retention, payload, invulnerability, or cooldown. |
| **Pets** | One pre-run account companion with one scaling sustain/economy scalar and one fixed sustain/economy capstone. | No damage multiplier, general attack cooldown, proc DPS, new active button, loot rarity/drop chance, or team aura. |

The launch effects below are intentionally deterministic. Even the timed Slate recovery is a non-stacking scalar on an existing pit receipt, not a chance proc or new defensive verb.

## 5. Economy integration and collection rules

The existing permanent-upgrade catalog costs **895 Scrip total**: Vitality 240, Fortune 310, and Power 345. The six paid eggs add **960 Scrip** of one-time horizontal collection sinks. They extend the shopkeeper's usefulness without turning each pet's ten levels into another 895-Scrip ladder.

There is **no Scrip feeding at launch**. Feeding would connect sale farming directly to power leveling, make the Gilded Gecko recursively best at raising every pet, and force players to choose between experimenting with companions and finishing `META_UPGRADES`. Scrip buys access; playing complete runs builds the bond. Cosmetic treats can exist later only if they grant zero XP and zero stats.

Gilded Gecko modifies only Scrip already legitimized by an earned-weapon shop sale. Its percentage is accumulated in a server-private per-run fractional bucket, whole Scrip is paid when the bucket crosses an integer, and the remainder is retained until the run ends. Pet-minted Scrip is capped as listed, so many Common sales cannot create an uncapped faucet. It gives no Bond XP and cannot modify egg prices.

Every species is an **account-unique record** with one level and one XP total. Shop rows become “Owned” after purchase; the wild roll is removed after acquisition. There are no duplicate copies, fusion fodder, randomized natures, alternate bonus rolls, or tradeable eggs. A species cannot be leveled twice for two builds.

There is also **no respec**, because there are no allocated points and both bonuses are set in stone. Players change strategy by selecting a different owned pet before the next run. If a future balance patch changes a pet, it changes the single catalog definition for every owner; it does not create legacy copies. Max-level overflow XP is discarded rather than refunded or converted, closing the last grind loop.

## Launch roster

In the formulas below, `L` is pet level 1–10. All base values cited are the current shipped values.

| Pet | Look, one line | Bonus 1, active at level 1 and scaling | Level-10 capstone, set in stone |
|---|---|---|---|
| **Verdant Wing** | Green leaf-veined butterfly; bud body opens into four luminous fern wings. | **Passive HP regeneration ×`(1 + 0.05L)`**: ×1.05 → ×1.50. Applies after CON-derived regen; CON 1's 6 HP/s becomes 6.3 → 9 HP/s. | **Deep Reservoir:** `+1` maximum charge for every gun magazine and thrown weapon. Each accepted use still costs 1; empty still starts the normal per-weapon reload/refill debt; no debt wipe, instant refill, melee, or beam effect. |
| **Hearth Newt** | Ember-orange shoulder newt; grows a warm glass belly and candle-flame crest. | **Non-regen healing received ×`(1 + 0.02L)`**: ×1.02 → ×1.20. Applies to explicit heal receipts such as parry-chain heals; excludes passive regen, max-HP changes, and revive base HP. | **Traveling Hearth:** each accepted dimension descent after initial spawn heals `15% max HP`, capped at max, once per dimension; no trigger on restart, training, wipe, or reconnect. |
| **Lodestar Moth** | Cobalt moth with compass-eye wings; matures into a small orbiting astrolabe. | **XP-mote reach `180 + 18L` px**: 198 → 360 px, still under the shipped 600 px hard cap. It changes reach only; it mints no XP. | **Last Light:** immediately before an accepted descent/extraction/victory cleanup, collect eligible live XP echoes within `600 px` of the owner. No sweep on wipe and no XP is created or doubled. |
| **Copper Snail** | Tiny brass snail on a magnetized coin-shell; gains panniers and a spinning compass rim. | **Earned-weapon pickup radius `46 + 4L` px**: 50 → 86 px. Does not change shop, interact, revive, or enemy-contact radii. | **Pack Shell:** personal bag capacity becomes `13` instead of `12`; combat arsenal remains three slots. Without this pet next run, a 13th carried item is retained but additions are locked until the bag is below 12. |
| **Gilded Gecko** | Coin-spotted gold gecko; its tail becomes a curled shopkeeper scale. | **Earned-sale Scrip +`2L%`**: +2% → +20%, accumulated fractionally; pet-minted bonus cap is `2L` Scrip/run: 2 → 20. Base 4/9/18/34/60 receipts remain the source. | **Heavy Purse:** raises only the max-level pet-minted bonus cap from `20` to **30 Scrip/run**; rate stays +20%, egg prices and non-sale faucets stay unchanged. |
| **Brass Crab** | Clockwork crab with a wind-up shell; gains twin gauge claws and a ticking halo. | **Gun reload/thrown refill duration ×`(1 - 0.01L)`**: ×0.99 → ×0.90. Applies to held and stowed reload/refill debt; never attack cooldown, draw lock, beam heat, or charge cost. | **Bench Winder:** stowed gun/thrown reload/refill debt advances at **1.25× real time**. Cooldown debt remains 1× and swapping never clears or reinitializes the ledger. |
| **Pale Firefly** | Milk-white firefly with a soft medical-lantern abdomen and paired ribbon feelers. | **Revive-effect reach `96 + 6L` px**: 102 → 156 px, only for a revive effect performed by the owner. It does not create a universal revive action. | **Second Glow:** allies revived by the owner return at **40% max HP instead of 30%**. The pet cannot self-revive, auto-revive, or act while its owner is downed. |
| **Slate Tortoise** | Palm-sized rune-stone tortoise; plates grow into a mossy cairn with a blue core. | **Pit-fall and authored ground-hazard damage ×`(1 - 0.015L)`**: ×0.985 → ×0.85. Enemy contact, melee, projectile, boss, and self-cost damage are unchanged. | **Sure Footing:** after surviving a pit snap-back, passive HP regeneration is **×1.50 for 3 seconds**; refreshes duration, never stacks, and grants no ultimate charge or immunity. |
