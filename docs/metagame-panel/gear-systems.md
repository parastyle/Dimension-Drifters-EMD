# Gear systems — the Drifter is what they wear

Status: systems specification. `DECISIONS.md` is binding. No `gear-advocate.md` is present in this checkout, so the budget, stacking, authority, allocation, and abuse laws below answer the likely adversarial cases directly rather than inventing an absent ruling.

The player character is one boilerplate Drifter. Gear is permanent identity, pets are permanent company, and weapons are carried stakes that can all be lost on death. The launch wardrobe contains 12 complete legacy-character sets: 96 authored items across eight slots. A naked Drifter remains viable and starts at flat 2s.

## 1. The slots

One item may be equipped in each slot. Empty is always legal. Gear is selected between runs, validated against canonical account ownership, and snapshotted on ready; a pickup during a run unlocks an item for the next run and never hot-swaps the current build.

### Slot classes and budgets

A **budget unit (BU)** is the comparison currency used in content review, not a player-facing stat. One BU is approximately one of: one spread move; +1 flat STR/DEX/INT/CON/LUK; +20 max HP; +4% sustained weapon output; +6% attack recovery, resource recovery, or movement speed; +5% damage mitigation or healing; +2 percentage points of crit chance; +10% to a geometric reach; or one bounded minor trigger with an 8-second-or-longer cooldown. Two improvements to the numerator and downtime of the same cycle are priced together.

| Slot | Fixed tier | Cap | Bonus class | Hard boundary |
|---|---|---:|---|---|
| Boots | Uncommon | 2 BU | Movement, dodge travel/recovery, impulse resistance, terrain handling | No damage, loot quality, extra dodge charge, or invulnerability |
| Gloves | Rare | 2 BU | Attack speed/recovery, aim/beam steering, swap and resource handling | No projectile, target, magazine, separate ammo, or free attack |
| Shirt | Uncommon | 3 BU | Vitals and up to two ordered spread moves | No signature trigger; at most +60 max HP on a legacy Shopkeep rank |
| Pants | Uncommon | 2 BU | Vitals and up to two ordered spread moves | Same spread law as shirts; no allocation credit |
| Cloak | Really Rare | 3 BU | Defensive or utility modifiers and bounded defensive hooks | No universal death prevention, permanent cloak, loot roll, or damage multiplier |
| Glasses | Rare | 3 BU | Precision, information, pickup/economy efficiency | Crit cap +6 points per loadout; no hidden enemy truth or client-authored reward |
| Facial hair | Common | 1 BU | Personality quirks, barks, harmless receipts, comic presentation | Launch facial hair is deliberately 0-BU cosmetic fun; it never becomes a tax slot |
| Hat | Ultimate | 4 BU | The **signature**: the largest rule-bender and the only legacy-character quirk slot | One hat means one signature. No second signature through a set bonus, pet, preset, or cosmetic override |

Rarity is fixed catalog metadata, not a random stat scaler. `Thornwatch Plume` is always the same Ultimate item; there is no Common version, affix roll, item level, or grandfathered stronger copy. This keeps permanent ownership legible and makes “duplicate” unambiguous.

### Spread-point law

The naked seed is `{ STR 2, DEX 2, INT 2, CON 2, LUK 2 }`. Shirts apply their printed moves first, then pants, left to right. `LUK→CON` means “move one seed point from LUK to CON.” A move is skipped if its donor is already 1 or its receiver is already 4. Therefore every mixed outfit remains in the 1–4 band and sums to 10 without a wardrobe error modal. The preview shows both applied and skipped moves.

After those moves, flat Shopkeep bonuses and run-earned allocations are applied as separate layers. Derived HP uses the resulting CON plus explicit max-HP gear. A complete legacy set reproduces its former `CHARACTER_KITS` spread exactly; mixed shirts and pants create new legal spreads. Gear points never enter `allocRun`.

Example: Veyra's shirt applies `INT→DEX` and her pants apply `LUK→DEX`, producing `2/4/1/2/1`. Her cloak reinforces parry timing, while her hat alone owns **Insufferably Graceful**. Identity is decomposed, not copied onto eight redundant passives.

### Loadout budget law

Every legal loadout, including its 8/8 bonus, is tested as one object. Non-hat gear may not exceed +12% sustained output, +18% output in any rolling three-second burst, +18% attack/resource recovery, +18% movement, +15% mitigation, +15% non-regeneration healing, +6 crit points, or +25% duplicate-Scrip yield. Multipliers multiply and then receive the authored clamp once; additive values add and then clamp once. A zero remains zero.

Each non-hat item occupies one protected lane: output, handling, mobility, defense/recovery, or economy. A hat may contain two clauses only when they describe the same signature cycle, as Pressurized does with vent and lock. A full-set bonus is at most 1 BU, requires all eight exact set IDs, and receives no partial 2/4/6 threshold. Set completion never grants another quirk or makes an item count twice.

Signature hats may exceed a generic percentage ceiling only to preserve an old rule-bender, and then must pass bespoke worst-case fixtures with the other seven items, the selected pet, the weakest and strongest relevant weapon, augments, set bonus, low HP, down/revive, and ten-player play. The content is denied if it needs a silent nerf. In particular:

- Veyra's first parry press receives normal defensive frames. If it whiffs, its cooldown is refunded, but refunded presses before the original cooldown deadline are counter-only and grant zero defensive frames. A success starts the normal cooldown. There is no invulnerability loop.
- Quickfinger rolls eligible weapon and gear **tier** twice and keeps the higher result. It does not reroll pets, pity, Scrip, quest awards, item identity, or duplicate protection.
- Cordell restores the shared weapon resource bar; he does not recreate ammunition or reload ledgers.
- Tinker's beam still overheats naturally by draining/holding the shared bar. Faster vent and a shorter post-empty lock do not prevent empty from being the lock.
- Galloway caps one accepted damage event, not an entire tick or multi-hit attack. Separate valid hits remain separate.

Gear never adds projectiles, targets, zones, inventory slots, weapon insurance, weapon retention, pet Bond XP, ultimate charge, allocation credit, set count, or extra equipment slots. It never turns a client prediction into reward authority.

## 2. The migration

### Naked baseline

The Drifter is the boilerplate, not a fortieth collectible set:

```text
THE DRIFTER
STR 2 · DEX 2 · INT 2 · CON 2 · LUK 2
No gear modifiers · No set bonus · No signature
```

The current `Unwritten` character quirk does not survive as a hidden naked bonus: it changes allocation routing, while the new baseline must be readable from the five flat 2s. The standard run rule remains +2 to the chosen attribute and +1 ballast to the post-choice lowest attribute. “Unwritten” survives as the empty-hat gallery label and flavor, with no mechanics.

### One old identity becomes one set

The 39 authored identities are not compressed into 12 generic classes. Each owns a reserved eight-piece set and its old spread/quirk provenance. Twelve are fully authored for launch; the remaining 27 retain one-to-one names and must ship as complete later sets rather than donating their quirk to somebody else's hat.

| Launch set | Provenance | Origin pool | Reconstructed spread | Signature hat |
|---|---|---|---|---|
| Ash-Walker | Asha the Ash-Walker | Ashlands | 2/2/2/3/1 | Mend the Broken |
| Ashen Crusader | Brother Cassian | Ashlands | 3/1/1/4/1 | Habit and Prayer |
| Molten Core | Cinderpyre | Ashlands | 2/1/4/2/1 | Molten Core |
| Coldsnap | Cordell “Coldsnap” Vane | Frostfell | 1/3/1/2/3 | Coldsnap |
| Graveside | Elias “Parson” Thorne | Wild West | 2/2/2/1/3 | Graveside Manner |
| Nine Veils | Iridia of the Nine Veils | Frostfell | 1/2/4/1/2 | Sees Every Future |
| Demon Mask | Kuro-Oni | Verdant Ruins | 3/2/1/3/1 | Temple Wall |
| Thornwatch | Dame Veyra | Verdant Ruins | 2/4/1/2/1 | Insufferably Graceful |
| Neon Mirage | Neon Mirage | Neon-Cyber | 1/4/1/2/2 | Package Deal |
| House Edge | “Quickfinger” Odette Lacroix | Wild West | 1/2/1/2/4 | The House |
| Unbending | Sir Galloway | Frostfell | 2/1/1/4/2 | The Unbending |
| Pressurized | Tinker-Magnus Brasswick | Neon-Cyber | 1/2/4/2/1 | Pressurized |

Reserved follow-on sets are: **Planted Bastion** (Bastion), **Still Bell** (Tendo), **Houndcall** (Bryda), **Overstuffed Bandolier** (Buzzard), **Does Not Stop** (Cogwarden), **Crimson Draught** (Corvane), **Better Owner** (Crowmantle), **Mag-Boot** (Deepfall), **Snake Oil** (Phineas), **Hazard Rates** (Dunkel), **Already Dead** (Gravewake), **Braced Boltcaster** (Grix), **Half Projection** (Halcyon-7), **Whispered Rites** (Hollowmaw), **Posted Ledger** (Magdalene), **Bottled Spite** (Mawkin), **Jade Ribbon** (Mei-Ling), **Bog Patience** (Mirelurk), **Let It Out** (Pyra), **Thunder Behind** (Raijin Kō), **Wayward Iai** (Sōjiro), **ICE Breaker** (Sable), **Hollow Oath** (Mordrane), **Shape in the Dust** (Bandida), **Porcelain** (the Hollow Mask), **Regrow** (Thornroot), and **Fox Dance** (Yuki).

An old quirk marked inert or partial in `character-classes.ts` cannot ship as a lying hat. Its catalog row may exist as locked preview, but acquisition stays disabled until the named authoritative seam exists. Scalars are read where the server already computes the quantity; rare effects return data descriptors at named events such as successful parry, roll end, kill, accepted damage, resource spend, and loot roll. The room interprets them. The client never executes a reward-bearing hat effect.

### Existing permanent upgrades become starter gear

The Trading Post's three `META_UPGRADES` tracks become visible starter lines, preserving their names, costs, and purchased value:

| Old track | Gear line | Rank I / II / III | Costs |
|---|---|---|---|
| Vitality | Mended Workshirt → Reinforced Workshirt → Shopkeep's Sunday Best | +20 / +40 / +60 max HP | ◈ 30 / ◈ 70 / ◈ 140 |
| Fortune | Brass Readers → Lucky Readers → Loaded Readers | +1 / +2 / +3 flat LUK | ◈ 40 / ◈ 90 / ◈ 180 |
| Power | Work Gloves → Knuckled Gloves → Ironhand Gloves | +1 / +2 / +3 flat STR | ◈ 45 / ◈ 100 / ◈ 200 |

Only the highest owned rank in a line is equipable; ranks never stack. A v2 account migration grants the item matching each owned level, preserves the old blob for rollback, and disables the old numerical application so the benefit is not doubled. On the first v3 wardrobe open, those three items are equipped only into empty slots. Future purchases are canonical gear transactions, not a fourth parallel upgrade system.

## 3. Acquisition

### Permanent on pickup

**A found gear item unlocks permanently on accepted pickup, not extraction.** Death already destroys every carried weapon with no insurance. Requiring extraction for clothes would make the same death erase both the run's stakes and the account journey, and would train players to treat a hat like another weapon. Pickup-unlock gives the run an irreversible bright spot while weapons remain frightening.

The server creates owner-qualified clothing drops. On pickup it performs an idempotent account transaction keyed by account, run, pickup, and catalog version. The item enters the current run only as an unlock receipt; it cannot be equipped until the Wardrobe. If persistence is temporarily unavailable, the receipt reads `Unlock pending`, the transaction retries durably, and the client does not optimistically claim ownership.

Gear extends the pet account rather than creating another save island. The next versioned account carries `revision`, `scrip`, the existing pet ownership/XP/selection/pity fields, `ownedGear` keyed by closed catalog ID, eight equipped IDs, and up to six presets. Presence in `ownedGear` is the ownership bit; there are no item copies, levels, rolled stats, durability, or mutable rarity. The sanitizer drops unknown IDs, clears unowned equipment, validates each item against its slot, and falls back to empty. The authenticated, revisioned account is canonical; browser state is a menu cache only. The run snapshots gear IDs, resolved modifiers, set ID, pet, and catalog versions once.

### Drop numbers

- Ordinary enemies make a personal gear roll at 0.6%; elites at 6%; a dimension boss grants every participating account one personal drop and has a 25% chance at a second.
- The current dimension supplies the set pool shown above. A Dimension Shifter's 25% gear roll uses all launch pools. No teammate can steal or consume another account's clothing drop.
- Ordinary tier weights are Common 38%, Uncommon 34%, Rare 18%, Really Rare 8%, Ultimate 2%. Boss weights are Uncommon 35%, Rare 35%, Really Rare 22%, Ultimate 8%. The fixed tier then selects a matching slot item from that dimension's sets.
- The first boss item chooses an unowned candidate at that tier whenever one exists. Other rolls choose unowned 80% / any candidate 20%; if the chosen tier has no valid item, step down one tier once rather than fabricate a variant.
- Locked previews state their source in sentence case: `Found in Frostfell` or `Ultimate · Dimension boss 8%`.

Duplicates convert atomically on pickup: Common **◈ 4**, Uncommon **◈ 8**, Rare **◈ 16**, Really Rare **◈ 32**, Ultimate **◈ 64**. The receipt says `Already owned · +◈ 16 Scrip`. Duplicate Scrip and ownership use the same account revision; repeated pickup messages cannot mint twice. Shop purchases and migration grants never generate duplicate Scrip.

## 4. The Wardrobe

The between-run Wardrobe repurposes character select. The Drifter mannequin remains centered; the old character carousel becomes an eight-slot paper-doll rail. Selecting a slot opens owned items first and locked silhouettes second. The right inspector always shows `Current → Preview`, the five seed stats, max HP, protected-lane totals, active signature, pet kept separately, and `Set 6/8` or `Set complete`.

The screen obeys dockux grammar: short structural titles in uppercase, sentence-case body copy, title-case item names, opaque dark backing plates, minimum 10 CSS px text, tier conveyed by word + color + pips, and Scrip written `◈ 16`. Typical footer copy is `[Click] Equip · [R] Clear slot · [1-6] Preset · [Enter] Ready`.

Six account presets store only the eight gear IDs and an optional player-written name of 20 characters. Pets remain an adjacent `COMPANION` selection and are snapshotted with gear on ready, but changing a gear preset does not silently change the pet. Invalid or newly locked IDs clear visibly. Presets may be overwritten between runs; there is no mid-run preset action.

The **HAT GALLERY** is the hero surface: `No hat · Unwritten` first, then 39 named pedestals in legacy roster order. Launch hats render full-size; reserved hats remain readable silhouettes with their old quirk and dependency/acquisition copy. Hat cards are twice the area of ordinary item cards, show the full rule text without hover, and expose a one-click `Try on` preview. Cosmetic preview never activates an unowned signature. Completing a full set changes the mannequin's pose and paper frame, but the 1-BU set bonus remains explicit text rather than a hidden visual reward.

## 5. Ultimate and allocation interaction

Gear is starting state, not run history. It never increments the shipped `allocRun` counters, never opens a level-choice window, and never advances the ultimate's **15 allocation-point family lock** or **30-point temper**. With +2 chosen and +1 ballast, those thresholds still arrive after five and ten completed run choices.

The old ultimate tie-break used the selected character spread. With one Drifter, family and variant ranking use `allocRun` only, then stable `STR, DEX, INT, CON, LUK` order for a true tie. Shirt/pants moves, flat Shopkeep stats, hat effects, set bonuses, and pets are excluded from family/variant ranking. Swapping wardrobe presets between runs therefore cannot pre-attune an ultimate.

After the family is chosen, raw combat attributes—including equipped gear—may affect the shipped ultimate damage formula just as they affect ordinary combat. That is output scaling, not allocation credit, and it remains inside the full-loadout output fixtures. Gear cannot modify ultimate charge gain, charge cap, windup, target count, family, variant, drift, or temper.

## 6. Launch content: 12 sets × 8 slots

Every cell is one permanent catalog item: `Name (fixed tier) — exact effect`. Attack recovery changes the accepted interval, not animation alone. “No combat effect” facial hair is intentional.

| Set | Boots | Gloves | Shirt | Pants | Cloak | Glasses | Facial hair | Hat |
|---|---|---|---|---|---|---|---|---|
| Ash-Walker | Cinderstep Wraps (Uncommon) — +8% move speed at or below 50% HP | Mender's Knuckles (Rare) — parry recovery is 8% faster | Ash-Stitched Jerkin (Uncommon) — `LUK→CON` | Sootroad Trousers (Uncommon) — +10 max HP | Smoke-Bitten Mantle (Really Rare) — +10% non-regeneration healing received | Emberglass Lenses (Rare) — +2 crit points while missing HP | Mercy Muttonchops (Common) — revive prompts say `Mend`; no combat effect | Ash-Walker's Cowl (Ultimate) — a successful parry heal also heals the nearest ally within 220 px for the same amount |
| Ashen Crusader | Pilgrim's Sabatons (Uncommon) — knockback and pull distance −10% | Votive Gauntlets (Rare) — parry recovery is 8% faster | Ashen Habit (Uncommon) — `DEX→CON`, then `INT→CON` | Censer-Worn Trousers (Uncommon) — `LUK→STR` | Unbroken Vestment (Really Rare) — at parry chain 3+, incoming damage −6% | Prayer-Script Spectacles (Rare) — +2 crit points against an enemy parried in the last 2s | Censer-Cord Beard (Common) — chain 5 tolls a soft bell; no combat effect | Crusader's Cowl (Ultimate) — the parry chain never expires; taking damage resets it |
| Molten Core | Slagstep Boots (Uncommon) — fire-terrain movement penalties −20% | Kilnhand Gloves (Rare) — caster and beam attack recovery is 8% faster | Furnace Shirt (Uncommon) — `DEX→INT` | Coal-Seam Trousers (Uncommon) — `LUK→INT` | Magma-Shed Mantle (Really Rare) — fire and ground-hazard damage −10% | Clinkerglass Goggles (Rare) — +2 crit points against burning enemies | Furnace Fork (Common) — glows below 30% HP; no combat effect | Cinder Crown (Ultimate) — below 30% HP, weapon hits ignite for 8% hit damage over 2s; refresh, no stack |
| Coldsnap | Black-Ice Boots (Uncommon) — dodge travel +8% | Quickload Gloves (Rare) — gun attack recovery is 6% faster | Drifter's Duster Shirt (Uncommon) — `STR→DEX` | Frostline Trousers (Uncommon) — `INT→LUK` | Coldsnap Duster (Really Rare) — frost and ground-hazard damage −10% | Deadeye Snowglass (Rare) — +4 crit points for 1.5s after a resource restore | Coldsnap Handlebar (Common) — a restore draws frost breath; no combat effect | Rimebrim Stetson (Ultimate) — ending a dodge restores 12% weapon resource; 4s cooldown |
| Graveside | Gravelane Boots (Uncommon) — +8% move speed while within 180 px of an enemy | Undertaker's Gloves (Rare) — melee attack recovery is 6% faster | Parson's Black Shirt (Uncommon) — `CON→LUK` | Wake Trousers (Uncommon) — +10 max HP | Graveside Coat (Really Rare) — incoming damage −6% while within 180 px of an enemy | Near-Death Readers (Rare) — +2 crit points within 180 px | Graveside Whiskers (Common) — qualifying close kills toll once; no combat effect | Sexton's Hat (Ultimate) — kills within 180 px heal 1 HP, capped at 5 HP/s |
| Nine Veils | Veilstep Slippers (Uncommon) — dodge recovery is 8% faster | Oracle's Gloves (Rare) — caster attack recovery is 8% faster | First Veil Shirt (Uncommon) — `STR→INT` | Ninth Veil Trousers (Uncommon) — `CON→INT` | Forked-Future Cloak (Really Rare) — parry defensive frames +8% | Tomorrowglass (Rare) — +2 crit points against an enemy in an active telegraph | Prophecy Wisps (Common) — a clean tell-avoid leaves a paper afterimage; no combat effect | Nine-Veil Circlet (Ultimate) — private enemy telegraph previews begin 25% earlier; server impact time is unchanged |
| Demon Mask | Temple-Grip Sandals (Uncommon) — knockback and pull distance −20% | Wallmaker Tekko (Rare) — parry recovery is 8% faster | Demon-Stitch Shirt (Uncommon) — `INT→STR` | Gatekeeper Hakama (Uncommon) — `LUK→CON` | Red Temple Cloak (Really Rare) — incoming melee damage −8% | Oni-Sight Lenses (Rare) — +2 melee crit points | Lacquered Tusks (Common) — stunned enemies receive a `TEMPLE WALL` badge; no combat effect | Demon Mask (Ultimate) — parry knockback ×2; parried melee attackers are stunned 0.4s |
| Thornwatch | Thornstep Boots (Uncommon) — +8% move speed for 2s after a successful parry | Roseguard Gloves (Rare) — melee attack recovery is 6% faster | Thornwatch Shirt (Uncommon) — `INT→DEX` | Court-Duel Trousers (Uncommon) — `LUK→DEX` | Insufferable Cloak (Really Rare) — parry defensive frames +10% | Gracepoint Glasses (Rare) — +2 crit points for 2s after a successful parry | Thorncurl Moustache (Common) — a perfect parry prints `Obviously.`; no combat effect | Thornwatch Plume (Ultimate) — a whiffed parry refunds its cooldown under the counter-only safety rule |
| Neon Mirage | Afterimage Trainers (Uncommon) — +8% move speed for 1s after a weapon swap | Hot-Swap Gloves (Rare) — weapon attack recovery is 6% faster | Signal Shirt (Uncommon) — `STR→DEX` | Chromeline Pants (Uncommon) — `INT→DEX` | Packet-Loss Cloak (Really Rare) — incoming damage −6% for 1s after a swap | Reticle Glasses (Rare) — the first hit within 1s of a swap gains +3 crit points | Pixel Five-O'Clock (Common) — swaps leave a palette afterimage; no combat effect | Zero-Latency Cap (Ultimate) — weapon swaps have no draw-lock |
| House Edge | House-Edge Boots (Uncommon) — +6% move speed while owned loot is visible within 240 px | Dealer's Gloves (Rare) — gun attack recovery is 6% faster | Lacroix Shirt (Uncommon) — `STR→LUK` | Loaded-Seam Pants (Uncommon) — `INT→LUK` | Inside-Pocket Cloak (Really Rare) — owned-pickup reach +10% | Double-Down Lenses (Rare) — duplicate gear yields +10% Scrip, rounded down after the run total | House Pencil (Common) — duplicate receipts flip a paper coin; no combat effect | Quickfinger's Boater (Ultimate) — eligible weapon and gear tier rolls twice and keeps the higher tier |
| Unbending | Marchfast Greaves (Uncommon) — knockback and pull distance −20% | Unbending Gauntlets (Rare) — heavy-weapon attack recovery is 6% faster | Keepwall Shirt (Uncommon) — `DEX→CON` | Last-Stand Trousers (Uncommon) — `INT→CON` | Castleback Cloak (Really Rare) — incoming damage −8% below 50% HP | Impact Readers (Rare) — taking a capped hit grants +2 crit points for 3s | Ironclad Beard (Common) — capped hits stamp `UNBENT`; no combat effect | Unbending Greathelm (Ultimate) — no single accepted damage event deals more than 25% max HP |
| Pressurized | Pressure-Valve Boots (Uncommon) — +8% move speed while a beam is cooling or locked | Calibration Gloves (Rare) — beam steering lag −10% | Boiler Shirt (Uncommon) — `STR→INT` | Vent-Seam Trousers (Uncommon) — `LUK→INT` | Blast Apron (Really Rare) — ground-hazard damage −10% | Gaugeglass (Rare) — +2 beam crit points | Brasswick Whiskers (Common) — natural overheat sounds a pressure whistle; no combat effect | Magnus Pressure Hat (Ultimate) — beam heat vents 25% faster and overheat lock duration ×0.5 |

### Full-set bonuses

| 8/8 set | One-BU nod to the old identity |
|---|---|
| Ash-Walker | A successful parry heals self for 4 HP; 8s cooldown |
| Ashen Crusader | Each parry-chain step grants +1% move speed, maximum +5%; taking damage resets it |
| Molten Core | At or below 30% HP, move speed +6% |
| Coldsnap | The first shot within 1.5s of the hat's resource restore gains +2 crit points |
| Graveside | A qualifying close kill pulls owned XP Echoes within 80 px |
| Nine Veils | Avoiding a previewed telegraph without damage grants +5% move speed for 3s; 8s cooldown |
| Demon Mask | A successful parry grants 6% damage reduction for 2s |
| Thornwatch | A successful parry grants +4 crit points for 2s |
| Neon Mirage | The boots' post-swap movement bonus lasts 2s instead of 1s |
| House Edge | The first duplicate gear pickup each run grants an extra ◈ 1 Scrip |
| Unbending | When the hat caps a hit, gain +6% move speed for 2s; 10s cooldown |
| Pressurized | When an overheat lock ends, gain +6% move speed for 2s |

These 96 items are the launch catalog. The reserved 27 sets require their own 216-item content table and seam approval; they are not permission to clone launch stats under new art.
