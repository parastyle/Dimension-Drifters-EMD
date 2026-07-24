# Design Option B — Consolidate Attributes, Preserve Builds

## 1am summary

Replace STR, DEX, INT, CON, and LUK with **Power, Vitality, and Fortune**. Power raises every damaging source equally; Vitality alone owns HP and regeneration; Fortune alone owns crit and loot luck. Keep one visible `+2` choice per level, delete the hidden ballast point, attribute requirements, and per-delivery damage grades, and let the weapon’s class, delivery, grip, family, rarity, affix, resource, set bonus, and behavior carry its identity. The 326 active weapons do **not** need 326 design meetings: all already have usable identity tags, so their 383 scaling blocks and 320 requirement blocks can be converted mechanically. The expensive work is the honest work—rebalance caster growth, rewrite 12 stat-moving torsos, and turn the 20 attribute-derived ultimates into five explicit families with four explicit aspects. Catalog conversion is a weekend; the safe whole-system change is roughly a two-to-three-week feature-flagged project, not a Friday-night rename.

**Panel role:** `design-option-b-consolidate` — the middle path.

## Mandate and scope

This proposal will make the strongest concrete case that five attributes are too many for Dimension Drifters at its combat speed, while preserving attributes as a meaningful build layer. It will consolidate the current five-stat model to roughly three attributes, give every survivor exclusive mechanical ownership, and restructure weapon identity so melee, ranged, caster, authored-dual, and class-set builds remain equally supported. It will specify the exact level-up copy, catalog-retagging workload, save and economy migration, dependency audit for augments and ultimates, a rollback-safe phased rollout, research-backed comparisons, and an honest comparison with both conservative and radical alternatives.

The requested branch contains both generated expansion weapons and hand-authored curated/archived definitions, so this report distinguishes active, archived, generated, and curated content rather than treating every durable ID as currently acquirable. This is design and investigation only: no product code, catalog, generated file, test, asset, or live-game process was changed.

## Verified codebase facts

- The checked-out branch is `feat/v0.118-metagame`. The worktree already contains unrelated modified and untracked files, including live weapon work; none are part of this report.
- The run has a level cap of 30 and a five-second level-up choice window. Each resolved level grants three attribute points: +2 to the player's choice and +1 hidden “ballast” point (`packages/shared/src/leveling.ts:18-27`). The five choices are STR, DEX, INT, CON, and LUK (`leveling.ts:34-43`).
- Ballast goes to the lowest post-choice attribute, with stable STR-first tie-breaking, unless a caller explicitly makes it follow the choice (`leveling.ts:45-62`). `spreadAdjustedCon` separately remaps a sum-10 starting spread to the established one-CON HP baseline (`leveling.ts:64-67`). These are meaningful complexity costs even though the player makes only one click.
- STR/DEX/INT are not globally distinct verbs in derived stats. Per-source weapon scaling grades choose which attributes multiply damage, and the timeout choice selects whichever graded attribute is best (`leveling.ts:69-95`; `packages/shared/src/weapons.ts:730-760`). By contrast, CON exclusively owns max HP and regeneration at +8 HP and +0.7 HP/s per point over baseline (`leveling.ts:98-100,117-134`).
- Crit has overlapping ownership: 5% base, +2 percentage points per LUK, +0.8 points per DEX, capped at 75%, with a 2× multiplier (`leveling.ts:102-114`).
- A weapon definition already carries orthogonal identity tags for grip (`1H`, `2H`, `dual`, `mounted`), delivery, fire mode, element, class pool (`melee`, `ranged`, `caster`), family, range band, and free-form scaling labels (`packages/shared/src/weapons.ts:741-754`). Letter-grade attributes and minimum attribute requirements are separate mechanical fields (`weapons.ts:755-770`).
- The equipped class bonus counts the three class pools and gives a held weapon +8% damage at two matching slots or +18% at three (`weapons.ts:1166-1191`). Authored duals remain single definitions with pre-made render/combo behavior. Attribute consolidation therefore must not alter either identity system by accident.
- The canonical persistent roster is 335 IDs: **326 active and 9 archived** (`packages/shared/src/weapon-resource.ts:283-320`). Fists are runtime fallback rather than a catalog row, and archived definitions remain addressable while active catalog, curated roster, and expansion roster are exposed separately (`packages/shared/src/weapons.ts:2220-2238`).
- The 40-character roster is not stat-neutral: every character has a hand-authored sum-10 five-stat starting spread (`packages/shared/src/characters.ts:51-97`), and one active Drifter quirk is nothing but “ballast follows the chosen attribute” (`packages/shared/src/character-classes.ts:137-143`). Consolidation must replace all 40 spreads and that quirk; merely aliasing field names would erase identity silently.
- All five attributes are serialized directly on `PlayerState`; pending picks and the augment CSV are also wire state (`packages/shared/src/state.ts:103-132`). A server-private five-key `allocRun` ledger drives ultimate identity, while gear seeding and ballast routing carry additional migration state (`state.ts:349-360`).
- The 20 ultimates are structurally attribute content, not incidental references. Five families follow attribute order; each family has four secondary variants, explicitly omitting its own primary (`packages/shared/src/combat.ts:141-189`). The system ranks the allocation ledger to lock a family and variant, then scales damage at 10% per primary point and 4.5% per secondary point (`combat.ts:192-266`; `packages/server/src/rooms/progression.ts:84-117`). A three-stat model cannot keep that 5×4 grammar honestly.
- The 16 augment definitions consist of 14 enumerable cards plus two beam-only compatibility additions (`packages/shared/src/augments.ts:37-191`). Only **two** directly name an attribute in shipped formulas: Second Wind heals from CON, and Emberguard damages from INT (`augments.ts:80-104,215-224`; server consumers at `packages/server/src/rooms/GameRoom.ts:11664,11719`). The other cards can keep their IDs and mechanics; their riposte/aegis/hex flavor comments and icons need copy/tag cleanup, not rebalance by default.
- Attribute economy is already partially mirrored by permanent upgrades named Vitality, Fortune, and Power: they occupy synced upgrade fields (`packages/shared/src/state.ts:188-195`) and currently seed CON/HP, LUK, and STR respectively (`packages/server/src/rooms/GameRoom.ts:2003-2006,3312-3313`). This is strong evidence that the three proposed player concepts already exist in the game’s vocabulary.
- Gear is another real dependency: the 113-piece system includes direct attribute bonuses and twelve set powers whose identifiers describe five-stat redistribution (examples surfaced at `packages/shared/src/gear.ts:285,415,548,680,811,942,1075,1208,1341,1474,1605,1737`). Those twelve set identities need authored replacements; this proposal does not pretend a weapon-only migration is complete.

## Research: what shipped games actually teach

These are observations from named games or documented changes; conclusions labeled **DD judgment** are my application to this game, not claims made by those developers.

- **Vampire Survivors** uses a global Might stat: the documented PowerUp raises inflicted damage by 5% per rank, while Armor, Max Health, Recovery, Cooldown, Area, projectile Speed, Amount, Move Speed, Magnet, and Luck remain separate, plainly named axes. Its level-up pauses play and offers three or four item/passive choices. Sources: [Vampire Survivors PowerUps](https://vampire-survivors.fandom.com/wiki/PowerUps), [level-up flow](https://vampire-survivors.fandom.com/wiki/Level_up). **DD judgment:** a universal damage axis does not erase weapon identity when weapons still differ through cadence, area, projectile behavior, evolutions, and inventory composition. It does make a five-second choice legible.
- **Brotato** proves the opposite design can work too: it has separate Melee, Ranged, and Elemental Damage stats, but it also foregrounds weapon classes, and collecting two through six matching-class weapons grants explicit stepped bonuses. Some weapons have multiple classes, which feeds later shop odds as well as the set payoff. Source: [Brotato Wiki — Weapon Classes](https://brotato.wiki.spellsandguns.com/Weapon_class). **DD judgment:** DD already imported the most readable part—loadout class sets—but not Brotato’s paused shop cadence or persistent on-card stat-shopping context. With only three DD slots and five seconds, class identity should carry the style distinction; three parallel “damage, but for this delivery” attributes are an expensive second copy of the same decision.
- **Last Epoch Alpha 0.6** explicitly reworked attributes so they no longer globally granted offensive damage/attack/cast speed; Strength became armor, Dexterity dodge, Intelligence ward retention, and individual skills received stated per-attribute scaling. The same patch made skill tooltips expose event tags. Source: [Last Epoch Alpha 0.6 patch notes](https://lastepoch.fandom.com/wiki/Alpha_0.6). **DD judgment:** this is the strongest case for keeping STR/DEX/INT only when each owns a genuinely different base mechanic and the slower game can surface per-skill tags. DD has no accuracy/evasion/mana/ward trio to justify them; its three labels mostly route damage.
- **Path of Exile 2** is a useful high-complexity counterexample. Its documented attributes gate aligned equipment but inherently grant different resources—Strength life, Dexterity accuracy, Intelligence mana—and explicitly do not grant generic skill damage. Source: [PoE2DB attribute reference](https://poe2db.tw/us/Attributes) (community-maintained reference, not a developer statement). **DD judgment:** if DD wanted PoE-like attributes, it would first need three real combat economies. Inventing accuracy, evasion, or mana solely to rescue five labels would move in the wrong direction for this brief.
- **Diablo III’s 2012 rune redesign** removed physical rune items and ranks after Blizzard found roughly 3,000 rune/quality combinations tedious to inventory. The replacement put a single strong variant directly in the skill UI; the same post says the team exposed skill categories because unexposed internal categories did not help players understand builds. Source: [archived Blizzard “Skill and Rune Changes” post](https://www.bluetracker.gg/diablo3/topic/us-en/4475014-skill-and-rune-changes/). **DD judgment:** preserve the expressive result—the weapon behavior or ultimate aspect—not the intermediate bookkeeping that produced it.
- **Diablo III patch 2.0.1 / Loot 2.0** condensed crafting materials to reduce stash use and simplify old recipes, converted existing materials, introduced Smart Loot to stop class items rolling inappropriate stats, and separated primary/secondary properties so direct and indirect power did not compete in the same slot. It notably left old items unchanged while converting potions/materials, showing that migration policy was content-specific rather than doctrinaire. Source: [Blizzard’s Patch 2.0.1 notes](https://news.blizzard.com/en-gb/article/12671560/patch-2-0-1-now-live). **DD judgment:** DD can preserve owned weapon IDs, rarity, affix, and value while replacing their obsolete attribute metadata; ownership and old formulas do not have to be treated as the same promise.
- In an early **Diablo IV systems post**, Blizzard described Attack/Defense as a quick “is this broadly stronger?” signal while keeping affixes for optimization, and removed Attack/Defense from jewelry to restore item-type fantasy. Source: [David Kim, “System Design in Diablo IV (Part II)”](https://news.blizzard.com/en-us/article/23230076/system-design-in-diablo-iv-part-ii). **DD judgment:** put the broad Power relationship on every damage card, then let class, delivery, family, grip, affix, resource, and bespoke behavior do the interesting work. Do not ask STR/DEX/INT to impersonate weapon fantasy.

## Concrete proposal: three stats, one visible choice, zero ballast

STR, DEX, and INT **die as allocatable stats**. Their fantasy survives in weapon identity—`melee`, `ranged`, `caster`, delivery, family, element, grip, and bespoke behavior—but they no longer make three versions of “my matching weapon deals more damage.” CON survives, renamed **Vitality**. LUK survives, renamed **Fortune**. DEX’s crit contribution moves entirely to Fortune.

| Attribute | Owns, exclusively | Does **not** own |
|---|---|---|
| **POWER** | The additive base-damage multiplier for every player damage source: melee edge/quake/throw, gun bullet/explosion, cast, beam, aura, damaging augment, pet damage if pets later read player stats, and ultimate | Crit, cooldown, attack speed, area, range, projectile count, Drive, HP, healing, loot |
| **VITALITY** | Maximum HP, passive HP regeneration, and explicitly Vitality-scaled healing such as Second Wind | Damage, damage reduction, armor, i-frames, crit, loot |
| **FORTUNE** | Critical-hit chance, rarity weighting, and squad harvest/luck effects | Base damage, crit multiplier, cooldown, HP, regeneration |

The “exclusive” claim is mechanical: one derived mechanic reads one attribute. Fortune still increases expected damage through crit, but no crit formula also reads Power or a deleted DEX. Gear, affixes, augments, and set bonuses may still modify outputs directly; they are build content, not a second hidden attribute table.

Initial tuning target, deliberately close to current visible increments:

```text
powerMultiplier = 1 + 0.06 × (POWER − 1)
maxHP           = 100 + 8 × (VITALITY − 2) + existing flat gear HP
regenPerSecond  = 6 + 0.7 × (VITALITY − 2), then existing gear/quirk multipliers
critChance      = clamp(5% + 2 percentage points × (FORTUNE − 1) + explicit gear/quirk adds, 0%, 75%)
```

Every ordinary level grants **+2 to the chosen attribute and nothing else**. This keeps the current chosen package (+2) and its satisfying size, but deletes the invisible +1. Over levels 2–30 that is 58 player-directed points rather than 58 directed plus 29 silently routed points. Timeout is stated up front and always chooses **Power**; it is never a dead pick, never depends on held-weapon metadata, and never changes because the player swapped one frame before expiry.

Starting profiles become fixed sum-6 three-stat spreads, minimum 1 in each. Generate a first pass from `(max(STR, DEX, INT), CON, LUK)`, then normalize the three weights to six pips with largest-remainder rounding. Examples: flat Drifter `2/2/2/2/2 → 2/2/2`; Bastion `3/1/1/4/1 → 2/3/1`; Cinderpyre `2/1/4/2/1 → 3/2/1`; Crowmantle `1/3/1/1/4 → 2/1/3`. This preserves each character’s strongest offensive bias without rewarding a generalist three times for merging three baselines. The generated 40-row table still gets a short human review for ties and fantasy. Replace the now-dead Drifter quirk with literal, visible text: **“Unwritten — Start each run with +1 Power, +1 Vitality, and +1 Fortune.”** Its authored base spread must be reduced correspondingly so that this is identity, not three free budget units.

Attack speed remains where it is: authored weapon cooldown, affix, augment, or explicit gear modifier. The code already says an attack-speed attribute source is open (`packages/shared/src/leveling.ts:124-128`). This option closes that question with **none**; putting speed into Power or Fortune would immediately recreate overlap and favor rapid-proc deliveries.

### Why melee, ranged, caster, and authored duals scale equally

For any damaging source `s`:

```text
damage(s) = base(s)
          × PowerMultiplier
          × rarity/affix damage multiplier
          × held-class set multiplier
          × applicable augment/gear/quirk multiplier
```

At +2 Power, `PowerMultiplier` gains exactly `0.12` for a sword edge, gun pellet, explosion, cast bolt, beam tick, aura tick, parry fire wave, or ultimate hit. The source may hit at a different cadence or hit more targets, but the **percentage elasticity is identical**. Multi-source weapons no longer risk a blade growing while its magma does not. This is the main balance guarantee.

Crit is also delivery-neutral in expectation. With the existing 2× crit multiplier, a crit chance `c` gives expected hit damage `1 + c`; +2 Fortune adds four percentage points to that expectation until the 75% cap. Rapid guns converge on the expectation more smoothly and slow hammers remain swingier, but neither gets a higher mean from the stat.

The read-only catalog census found 118 melee, 112 ranged, and 96 caster active weapons. For each weapon’s primary source, the median current **best single-attribute coefficient** is 6% per point for melee, 6% for ranged, and 8% for caster; the observed ranges are 4.5–10%, 3–10%, and 6–10% respectively. Therefore 6% is a defensible first universal coefficient, not a guess. It also exposes the cost: current caster growth is intentionally steeper. Caster base damage/cadence and late-run curves need an explicit pass; do not ship the schema change and call the resulting caster nerf “simplification.”

The class-set math stays exactly +8% for two and +18% for three. A three-melee, three-ranged, or three-caster loadout receives the same multiplier after universal Power. Mixed loadouts trade the set multiplier for coverage and utility as today.

An authored dual keeps its one definition, class, requirements, cadence, and combo. Both rendered pieces receive the same Power factor because there is only one gameplay definition; there is no player-selected second weapon or union-of-two requirement penalty.

## Restructure weapon identity around what the weapon does

A weapon stops saying “STR B / DEX C / needs 8 DEX” and leads with information that still matters after a swap:

1. **Class:** melee, ranged, caster—drives the 2/3-slot set bonus.
2. **Delivery and family:** thrown, gun, cast, beam, aura, quake, chain, scatter, etc.—drives handling and augment eligibility.
3. **Grip:** 1H, 2H, dual, mounted—declares physical commitment; `dual` is pre-made by the definition.
4. **Output:** real source damage, cadence/cooldown, reach, charges/magazine/Drive, pierce, area.
5. **Loot identity:** rarity and affix.
6. **Bespoke rule:** the sentence that changes play—combo, overheat, detonation, status, warp, recall, and so on.

The card needs no replacement “Power grade.” A universal stat with S/A/B responsiveness would still make one weapon gain more from the same click and would recreate the style-balance hazard in a smaller font.

Rendered example, verbatim:

```text
RUSTY CLEAVER · COMMON
MELEE · THROWN · 1H · THROWN FAMILY

THROW 7 DAMAGE · 0.26s CADENCE · 520 RANGE
3 CHARGES · 1.5s REFILL · PIERCE 2

POWER APPLIES TO ALL DAMAGE
MELEE SET 2/3 · +8% DAMAGE
PAIRABLE · 1H MELEE
```

The dynamic set line reads `MELEE SET 1/3 · NEXT: +8%`, `MELEE SET 2/3 · +8% DAMAGE`, or `MELEE SET 3/3 · +18% DAMAGE`. Ranged and caster use the same sentence and thresholds. A paired row shows both identities; it does not invent a “dual” fourth stat.

### Exactly what happens to the weapon catalog

The runtime census is precise:

| Scope | IDs | Explicit scaling blocks | Requirement-bearing IDs | Human class/delivery decisions |
|---|---:|---:|---:|---:|
| Active catalog | 326 | 383 | 320 | 0 |
| — curated active roster | 29 | 40 | 23 | 0 |
| — active expansion | 297 | 343 | 297 | 0 |
| Archived compatibility rows | 9 | 9 | 9 | 0 |
| **All durable IDs** | **335** | **392** | **329** | **0** |

All 335 durable definitions already have a non-empty `tags.scaling` array and an explicit grade block; every active definition already has `classPool`, delivery, family, grip, range band, and the rest of the identity taxonomy (`packages/shared/src/weapons.ts:741-760`). Therefore:

- **326 active weapons are mechanically rewritten**, plus 9 archived rows for schema consistency.
- **Zero weapons require a designer to decide whether they are melee, ranged, or caster.** That truth already exists: 118/112/96.
- For the **297 generated active expansion weapons**, change `data/weapon-concepts-300.json` and `tools/artkit/gen-weapon-expansion.mjs`, then regenerate; the generator explicitly owns scaling and requirement fields and the consistency test enforces a source/output bijection (`tools/artkit/gen-weapon-expansion.mjs:68-69,236-270`; `tests/data-consistency.test.ts:48-97`). Do not hand-edit `weapons-expansion.generated.ts`.
- For the **29 active curated weapons and 9 archived compatibility definitions** in `weapons.ts`, run one deterministic schema codemod: drop STR/DEX/INT/CON/LUK from `tags.scaling`, remove top-level and nested `scalingGrades`, and remove `requirements`. Review the diff and census, but make no weapon-by-weapon scaling choice. Every damage resolver then applies Power.
- The 57 additional active source blocks beyond one-per-weapon are why the resolver change matters. A text replacement that touches only the top-level field would leave hybrid explosions, scatters, quakes, or casts on old scaling.
- Archived IDs keep ID/art/receipt resolution. Their obsolete stat metadata can be ignored at runtime or mechanically normalized; they do not return to acquisition.

This **catalog transformation is a weekend task**, in my estimate: roughly half a day for schema/generator changes, half a day for generated census and compile/test repairs, and one day for focused cards and combat fixtures. It is not 326 hand balances. Balance validation is separate: exhaustively smoke the 29 curated weapons, run automated effective-power distributions over all 326, and manually sample every delivery/grip/class cell plus every multi-source outlier. That is another three to five working days, with caster progression the named risk. The complete option costs more because weapons are not the hard dependency.

## Level-up screen — verbatim

The ordinary screen has exactly three cards. Here is the literal rendered copy for a no-gear player at Power 2 / Vitality 2 / Fortune 2; live numbers substitute the player’s actual values.

```text
LEVEL 2 · CHOOSE ONE
SAFE · 5.0s

┌────────────────────────────┐
│ POWER +2                   │
│ ALL DAMAGE 106% → 118%     │
│ Every weapon. Every        │
│ damaging skill.            │
└────────────────────────────┘

┌────────────────────────────┐
│ VITALITY +2                │
│ MAX HP 100 → 116           │
│ REGEN 6.0/s → 7.4/s        │
└────────────────────────────┘

┌────────────────────────────┐
│ FORTUNE +2                 │
│ CRIT 7.0% → 11.0%          │
│ SQUAD HARVEST 4% → 12%     │
│ Improves high-tier drops.  │
└────────────────────────────┘

NO CHOICE: POWER · NO HIDDEN POINTS
```

Those sentences are the UI contract. Do not append grade equations, ballast receipts, requirement recovery, or “no held-weapon scaling.” The current model needs branches for all of those (`packages/client/src/ui/level-up-model.ts:98-110,163-274`); their disappearance is a feature.

At a signature level the existing augment draft follows as a second step, with the header `SIGNATURE · CHOOSE ONE`. It never replaces the attribute choice, preserving the current six augment opportunities through level 30. If several choices are pending, resolve one complete three-card decision at a time and show `2 PICKS LEFT`; do not stack invisible allocations behind one click.

## Migration story

### Existing saves and live runs

Persistent `MetaAccountV4` stores scrip, pets, owned/equipped gear, prestige, and the weapon bank—not run STR/DEX/INT/CON/LUK (`packages/shared/src/meta.ts:115-127`). Attributes, the allocation ledger, and ultimate lock are room/player state (`packages/shared/src/state.ts:103-132,349-360`). Use that boundary:

- Do **not** transform a live room in place. Old-version rooms finish under five-stat rules; new matchmaking creates only three-stat rooms. Reconnects route to the room version they joined.
- On deployment, drain old rooms before deleting compatibility code. A run ending is already the natural reset for level, attributes, augments, and ultimate.
- Bump the account/schema envelope only for changed gear catalog semantics and client compatibility, not because the account suddenly needs three attribute totals. Preserve revision, scrip, pets, prestige, weapon bank, owned gear IDs, and equipped slots byte-for-byte after sanitization.
- Very old V2 accounts already express upgrades as `vitality`, `fortune`, and `power` (`packages/shared/src/meta.ts:9-55`). Their established migration grants gear; retain those grants and reinterpret the resulting gear under the new names. No one repurchases an upgrade.

### Owned weapons, pairs, archiving, and scrip

A persisted weapon instance contains weapon ID, rarity, affix, provenance, and source world tier—no requirement satisfaction or scaling snapshot (`packages/shared/src/bank.ts:54-76`). Therefore every active single and pair keeps the same instance ID, entry ID, rarity, affix, provenance, location, expedition stake, and selected carry position.

Do **not** refund, reroll, or convert active weapons into scrip. Their fantasy and economic identity remain. Their damage response changes globally just as a balance patch changes a weapon formula.

Scrip also needs no denomination change: sale value reads rarity and the `earned` flag, not attributes or power (`packages/shared/src/loot.ts:140-145`). Keep prices and balances at launch, then watch keep/sell rates because removing requirements makes newly found off-style weapons immediately useful and may reduce selling. That is an economy telemetry question, not justification for a pre-emptive wipe.

Keep the existing archived-weapon migration exactly as is. It is already idempotent across stash, intake, expedition, pairs, and last-carry references and pays standard rarity scrip (`packages/shared/src/bank.ts:530-608`). Attribute consolidation neither restores the 9 archived IDs nor pays them twice.

### The 113 gear pieces and 12 eight-piece sets

Keep all 113 IDs, art, ownership, slots, rarity, and equipped choices. The runtime census finds only 18 rows with direct five-stat mechanics:

- `Brass/Lucky/Loaded Readers` mechanically become `+1/+2/+3 Fortune`.
- `Work/Knuckled/Ironhand Gloves` mechanically become `+1/+2/+3 Power`.
- The 12 set torsos contain attribute moves. Project each move through `STR|DEX|INT → Power`, `CON → Vitality`, `LUK → Fortune`. A surviving cross-axis move stays a one-pip move. A collapsed `Power → Power` move becomes a flat **+5% outgoing weapon damage** budget unit so an owned torso does not turn into “no effect.” Then human-review and rewrite the 12 effect sentences; this is twelve judgments, not 113.

The projection is deliberately a migration bridge, not eternal law. A later gear pass can replace a bland +5% with a more thematic cooldown, parry, status, or resource hook while keeping the same gear ID. Ship the bridge first so no owned set becomes inert mid-refactor.

The Drifter’s ballast-only `Unwritten` quirk must be replaced at the same boundary, as specified above. Other quirks that add crit or multiply regen continue to modify the derived result without becoming attributes (`packages/shared/src/character-classes.ts:40-53`).

### All 16 augments

The content count is 14 enumerable definitions plus two beam-only compatibility definitions. Migration by ID:

- **Second Wind:** rename the tooltip to `Parry heals a Vitality-scaled sliver of HP.` Keep `4 + 2 × (Vitality − baseline)` per stack as the initial formula, then validate against new starting profiles.
- **Emberguard:** rename to `Parry erupts a Power-scaled fire wave.` Remove its bespoke `base + 6 × INT` formula and send it through the same Power multiplier as all other damage. Start from base damage 17 so a neutral Power-2 profile lands near the current INT-2 value of 18; tune from playtest.
- **Counterblade/Twin Fang and any other fixed damaging augment:** now apply universal Power. Their base numbers may need a neutral-profile calibration, but there is no attribute tag to author.
- **All remaining definitions:** IDs, ownership CSV, stack counts, draft gates, delivery gates, and mechanics remain. Riposte/aegis/hex remain flavor tags; comments and icons stop claiming they are STR/DEX, CON, or INT branches. The two beam cards remain resource/control effects and do not acquire fake damage scaling.

Existing run augments finish in their old room. Augments are not persisted in the account, so there is no owned-content refund problem.

### All 20 ultimates: preserve the content, replace the attribute matrix

The current system is five families × four attribute drifts, automatically selected from allocation rank. Collapsing five attributes to three would otherwise delete eight cells, make duplicate cells, or bias family access. Do none of those.

Keep the five families, their VFX, controls, charge economy, and stable codes 1–20. Replace the attribute variant type with four explicit **aspects** available to every family:

1. **IMPACT** — higher immediate damage, execute, or stun.
2. **REACH** — more distance, speed, width, or targets.
3. **ECHO** — stronger lingering fissure, brand, blast, or decoy.
4. **SHELTER** — shield, healing, or longer safety window.

At the fifth resolved attribute choice, show `ULTIMATE · CHOOSE A FAMILY` with all five named family cards; do not infer it from the largest stat. At the tenth, show `TEMPER · CHOOSE AN ASPECT` with the four cards above. These are rare, explicit build moments, so five/four options are acceptable where five near-identical ordinary attributes were not. If the timer expires, use a seeded run-stable default shown on the screen, not current weapon or stat ranking.

This retains all 20 family/aspect cells. Most shipped behavior already maps cleanly. For example, Seismarch’s current longer/smaller DEX leap becomes Reach, the longer/harder INT fissure becomes Echo, the CON ally shield becomes Shelter, and the LUK crit version becomes Impact (`packages/server/src/rooms/GameRoom.ts:6769-6848`). The remaining families need the same 20-row naming and behavior audit; variants that today differ only through attribute scaling need a real aspect effect. Damage from every family uses Power; crit uses Fortune; Shelter effects are fixed or Vitality-scaled only when the tooltip says so.

Preserve unlock cadence by counting **resolved choices**, not raw points: fifth choice replaces `15 allocations`, tenth replaces `30 allocations`. This prevents removal of ballast from delaying ultimate unlock/temper. Ultimate selection is room state, so old rooms keep old codes and new rooms interpret the same 1–20 envelope as family/aspect cells.

## Phased path: never leave main with a broken half-system

Each phase ends in a playable, revertible state. The order is part of the proposal.

### Phase 0 — Pin the old world (1 day, read-only behavior)

- Snapshot the 326-active/9-archived census, 383 active source blocks, 118/112/96 class distribution, 116 1H / 183 2H / 23 dual / 4 mounted grip distribution, drop-pool membership, class power medians, and all 20 ultimate codes.
- Record DPS/output curves at representative starting, mid-run, and cap allocations for each class/delivery; include set 1/2/3 and single/matched/unmatched dual cases.
- Pin account fixtures for V2→V4 legacy upgrades, V4 owned/equipped gear, active singles, pairs, expedition entries, and archived salvage.

No behavior changes. These fixtures are the rollback oracle.

### Phase 1 — Add the three-stat model in shadow (1–2 days)

- Introduce Power/Vitality/Fortune types, formulas, three-stat spread generation, and choice-count milestones behind a room-version feature flag.
- Compute both old and new previews in tests/dev telemetry, but keep old combat authoritative.
- Do not append three more direct fields to the already saturated `PlayerState`; create a versioned new-room schema or a nested progression envelope. Old clients/rooms keep the old schema.

Main remains five-stat playable.

### Phase 2 — Convert the catalog mechanically, dual emit (1–2 days)

- Teach the source generator to emit the old attribute metadata and a new universal-Power view side by side.
- Route new-mode damage through universal Power for every source; old mode still reads grades and requirements.
- Assert 335 IDs in both views, no missing source, no class/delivery/grip drift, and unchanged persistence identity.
- Switch the new-mode weapon card to identity-first copy.

Main can run either complete formula; there is no commit where half the weapons have no scaling.

### Phase 3 — Progression and UI, new rooms only (2–3 days)

- Enable the three-card level screen, +2-only resolution, Power timeout, and choice-count ultimate milestones in new rooms.
- Seed converted three-stat character/gear profiles at run start.
- Leave old-room allocation, ballast, timeout, HUD, and client decoding untouched.

At this point the new mode is end-to-end playable even though dependent content may still be in compatibility form.

### Phase 4 — Migrate dependent content under the same flag (3–4 days)

- Convert the 6 direct-stat gear rows and 12 torso moves; replace Unwritten.
- Convert all damaging augment paths, Second Wind, Emberguard, tooltips, icons, and previews.
- Replace the ultimate attribute matrix with family/aspect selection and audit all 20 cells.
- Prove V4/V2 account fixtures preserve scrip, ownership, equipped slots, weapon entries, pairs, expeditions, pets, and prestige.

Do not expose three-stat matchmaking until this phase is green; otherwise an ultimate or owned set can become inert.

### Phase 5 — Balance gate and limited rollout (3–5 days plus playtest time)

- Require melee/ranged/caster representative cap-DPS bands to sit within an agreed tolerance—start with ±10%, tighten after live data—without using class-specific Power coefficients.
- Re-run the existing effective-power/drop-band census. Fix outlier base damage or cadence, not attribute elasticity.
- Test 1/2/3 class sets, all 23 dual-grip catalog rows, matched and unmatched pair ceilings, multi-source weapons, beams, casts, auras, explosions, crit cap, Fortune rarity distribution, and all ultimate aspects.
- Roll new rooms to a small cohort. Compare average decision time, timeout rate, weapon keep/sell rate, class share, Power/Vitality/Fortune pick share, run depth, and boss time-to-kill.

One feature flag reverts new matchmaking; persistent IDs/currency never need rollback.

### Phase 6 — Cut old code only after a full stable release

Stop creating old rooms, wait for the maximum room lifetime, then remove STR/DEX/INT/CON/LUK wire fields, ballast logic, grade/requirement readers, old ultimate ranking, and dual catalog emission in a separate cleanup change. Never combine cleanup with first rollout.

## What this costs—mechanically and creatively

### Depth and expression lost

- **Hybrid source specialization disappears.** Wyrmtooth-style “blade likes physical attributes, magma likes INT” builds become one Power build. Geometry, element, status, and timing remain, but the allocation puzzle is gone.
- **Weapon commitment disappears.** The 320 active requirement-bearing weapons become immediately usable. This improves swap legibility and makes drops less dead, but removes planning around meeting a future requirement and removes the sting of carrying an aspirational weapon.
- **Character delivery affinity weakens.** A high offensive profile benefits every weapon rather than implying sword/gun/caster compatibility. Quirks, gear, class sets, and signatures must carry more character identity.
- **Ultimate emergence becomes explicit selection.** Players no longer discover that their allocation silently authored a Seismarch/DEX cell. The new choice is clearer and fairer, but less systemic and less surprising.
- **Power/Vitality/Fortune may be solvable.** Power is throughput, Vitality is safety, Fortune is variance/economy. If encounter pressure does not make all three situationally valuable, the game can collapse to a dominant ratio. Three clean choices are easier to balance, not automatically interesting.
- **Fortune bundles two rewards.** It alone owns both crit and loot quality. That is legible, but snowball risk rises: better drops increase power while crit also raises damage. The 75% crit cap, rarity exponent cap, and telemetry must remain; Fortune may need a softer rarity coefficient.

### Work estimate

This is **my judgment**, based on the verified census rather than a production commitment:

| Workstream | Scope | Estimate |
|---|---|---:|
| Catalog/schema/codegen | 335 rows, 392 scaling blocks, 329 requirements; no per-weapon design | 1–2 days |
| Progression/wire/UI | versioned room schema, three choices, previews, timeout, milestones | 2–3 days |
| Gear/characters/augments | 40 spread outputs, 18 impacted gear rows, 16 augments, one dead quirk | 2–3 days |
| Ultimates | 20 aspect cells, selection UI, scaling and copy | 2–3 days |
| Balance/QA/rollout | 326 simulations, curated smoke, dual/set/delivery matrix, telemetry | 3–5 days |
| **Single-owner total** | with review and safe phases | **roughly 10–16 working days** |

The weapon catalog itself is a weekend. The complete safe option is two to three weeks. A demand to hand-review all 326 scaling fantasies would turn it into a month, but that is specifically **not** this design; universal elasticity is the point.

## What I would not change

- **Do not shrink the 326 active catalog.** Complexity is in interpreting each weapon, not the count by itself. Archive only for quality/balance reasons already governed by the archive system.
- **Do not change weapon IDs, art, rarity, affix, provenance, resource profiles, scrip values, bank entries, expedition stakes, or archive semantics.** They are valuable identity and economy, not attribute clutter.
- **Do not remove the three equipped slots or bag.** Three slots create a comprehensible loadout problem and make the 2/3 class thresholds meaningful.
- **Do not remove class set bonuses.** They are the cleanest existing statement of melee/ranged/caster build identity and are symmetric today.
- **Do not simplify authored duals into a damage affix.** Their pre-made two-piece rendering and alternating/both-hand combos create visible weapon behavior.
- **Do not make attack speed, area, range, cooldown, projectile count, Drive, or crit multiplier attribute effects.** Keep them as authored weapon identity or explicit affix/augment/gear hooks.
- **Do not change level cap 30, squad-shared XP, the five-second safe window, the +2 visible package, or signature cadence in the same release.** Choice-count milestone rewiring preserves their current timing.
- **Do not remove rarity/affix WYSIWYG math, the class-median drop gate, or exact damage previews.** A simpler stat model should be more truthful, not less inspectable.

## Honest verdict

**Yes—I would ship Option B, but only through the phased new-room rollout above.** The repository evidence is unusually strong: three attributes mostly route damage, crit already has split ownership, CON is already pure, every weapon already has richer identity tags, and the old meta vocabulary has already converged on Power/Vitality/Fortune. The simplification removes duplicated routing rather than removing the actual weapon verbs.

It is weaker than the **conservative option** in preservation and delivery risk. Better surfacing could make the current grades, requirements, ballast receipt, and exact outcomes understandable while keeping hybrid builds and the emergent 5×4 ultimate system. If the owner needs a low-risk patch this week—or player tests show knowledgeable players make varied five-stat choices—the conservative route is smarter.

It is weaker than the **radical option** in purity. Three stats still create repetitive level-up arithmetic and may settle into a solved ratio. If testing shows players always click Power until a fixed HP threshold and then Fortune, the stats are ceremony; remove them and put progression entirely into weapons, augments, gear, and explicit ultimate aspects.

The middle path earns its cost if three results appear together: ordinary pick time drops, off-class weapon pickups become genuinely usable, and melee/ranged/caster cap curves remain comparable without class-specific Power coefficients. If any one fails, do not defend the refactor because it is already large—fall back to conservative surfacing or continue to the radical model.

## Validation of this design report

- Read the reporting regime first after initializing this required report; maintained the report incrementally throughout investigation.
- Verified branch `feat/v0.118-metagame` and observed unrelated dirty/untracked work; wrote only `docs/design/design-option-b-consolidate.md`.
- Performed read-only runtime censuses from the canonical shared registries: 326 active + 9 archived weapons; active class split 118/112/96; active grip split 116/183/23/4; 383 active scaling blocks; 320 active requirement-bearing IDs; 113 gear rows with 18 direct five-stat dependencies.
- Inspected the shared/server/client attribute, damage, requirement, class-set, authored-dual, persistence, scrip, augment, gear, ultimate, progression, and level-up UI paths cited above.
- Used named shipped-game documentation, patch notes, and developer posts; marked cross-game applications as DD judgment.
- Did not edit product code, tests, assets, catalogs, generated files, other reports, or the live game stack; did not bind, stop, or inspect ports 5180/2567.
