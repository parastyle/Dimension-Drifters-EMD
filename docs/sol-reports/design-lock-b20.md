# B20 Design Lock — Chest-Relic Economy + Booster-Pack Meta

Locked with the owner in chat, 2026-07-23/24. This supersedes the stat/requirement designs
discussed the same night (both explicitly abandoned by the owner) and closes task #75's
design question. Rules below marked **LOCKED** are owner decisions; rules marked *default*
are orchestrator-recommended starting values, tunable without re-approval.

## The locked rules

1. **LOCKED — No level-ups, no stats, no requirements.** The in-run level/XP system is deleted.
   Weapons have no stat scaling and no stat gates; any character can use any weapon at any time.
   Weapon damage comes from the weapon def alone.
2. **LOCKED — Weapon quality is time-gated within the run.** Better weapons become available as
   the run progresses. *Default:* each weapon gets a `tier` derived from its power budget; chest
   weapon rolls sample tiers by run-clock, later = higher budget with wider variance (never strict
   obsolescence of early tiers).
3. **LOCKED — Abilities are relics, found in chests.** Two bands:
   - **Fungible commons** (stackable stat lines): +energy pool, +energy regen, +parry
     radius/forgiveness, −dodge cooldown, +movement speed, +HP regen, +drain regen, +luck,
     +crit, +jump count.
   - **Rare ability-changers**: dodge-roll types (the shuffle, DS2 ninja-flip, phase out/in,
     bloodhound step), ultimate grants, revive, one-shot protection.
4. **LOCKED — Chests are the sole in-run itemization channel**: weapons, relics, money.
   *Default:* chest contents are instanced per player in co-op; rubber-band guarantees a
   weapon-bearing chest at least every 2.5 minutes so a dry streak cannot brick a run.
5. **LOCKED — No shopkeeper.** The shop NPC, shop UI, and sell-for-scrip flow are removed
   ("overused concept and gates the fun"). Art is archived, not deleted.
6. **LOCKED — Disassemble on the floor.** Weapons are disassembled mid-run where they lie,
   converting to money instantly. This replaces "sell". No menu, no interruption.
7. **LOCKED — Money is a pure meta currency.** There is no in-run money sink. Unspent money
   banks automatically at run end.
8. **LOCKED — The bank buys booster packs outside runs.** Packs contain pets, new weapons
   (permanent unlocks into the run drop pool), and new characters.
9. **LOCKED — Duplicate pulls refund 50% of the item's cost, weighted by rarity.** The refund
   is shown in the pack-open moment itself (on the card flip), never silently.
10. **LOCKED — No weapon stashing between runs.** Run arsenals are ephemeral; persistence lives
    in the unlock pool and the bank.

## Dispositions (what happens to existing systems)

| System | Disposition |
| --- | --- |
| Stat spreads / class stat-bias (#36) | DELETE |
| Weapon `scalingGrades` + `requirements` (all ~340 defs) | DELETE from defs + generator + tests |
| `heldDamageMult` stat scaling | DELETE (flat weapon damage) |
| LUK/DEX crit derivation (#25) | Flat base crit + crit relic lines |
| Stat-frequency ultimate unlocks (#50) | Ultimates become rare relic grants |
| XP orbs / level curve / level UI (#45) | DELETE; XP pickups become money drops |
| Shopkeeper NPC + shop UI + sell (#24) | DELETE (archive art) |
| 3 slots + bag + swap (#22/#23) | KEEP unchanged |
| Scrip | Renamed/unified as **money** (drop + disassembly + bank) |
| Weapon bank / stash | DELETE (replaced by pack-unlock pool) |
| Pets (#58) | KEEP; pets become pack pulls; pet stat-mods become relic-like lines |
| Parry / dodge / energy kits (#56, #63) | KEEP mechanics; their tuning knobs move to relic lines |

## Implementation lanes (serial merge order)

1. **L1 — Core teardown** (shared/server/gen): remove stats, scaling, requirements, XP/level;
   flat crit; money-drop conversion. Biggest diff, merges first.
2. **L2 — Chests + relics** (server-authoritative): chest spawn cadence + rubber-band, content
   rolls (weapon tier by run-clock, relics, money), relic state + effects, pickup presentation.
3. **L3 — Economy**: floor disassembly interaction, run-end auto-banking, shopkeeper removal.
4. **L4 — Booster meta**: pack shop menu tab, pack-open flow with rarity-weighted 50% dupe
   refund, pack pools (weapons/pets/characters), persistence.
5. **L5 — Weapon tier curve**: assign tiers across the full catalog from power budgets; chest
   sampling curve; census tests.

Every lane: full gen/typecheck/test green + private-port live gate before merge; serial merges
only (all lanes touch shared/server surfaces).
