# GEAR — Devil's Advocate

**Role:** attack the binding meta-game direction where it can fail, not reopen it.

The fixed target is one blank-slate Madness-style rig; eight gear slots; permanent gear unlocks found in
runs; pets remain permanent; weapons remain persistent but are all lost on death; and the shopkeeper's
`META_UPGRADES` become gear. That direction can work. It does **not** work if “eight visible slots” quietly
becomes “eight additive character kits.” The old envelope was one sum-10 spread, one quirk, and one pet.
The new envelope needs to remain that legible even after the wardrobe is complete.

---

## 0. What exists, and what the pitch is inheriting

- `CHARACTER_KITS` contains 40 sum-10 spreads in the 1..4 band and 40 quirk ids. The server currently
  snapshots one `runCharacter` and caches exactly one `QuirkDef` in `CombatState`.
- The hook table is not 40 shipped abilities. It currently marks **7 active, 1 partial, and 32 inert**.
  An item card pointing at an inert descriptor is not a successful migration.
- Level allocation is separately counted in `PlayerState.allocRun`. `allocate()` increments that count;
  `evaluateUltimateAllocation()` reads it at the unlock and temper thresholds.
- Ultimate tie-breaking currently falls through allocation totals to the character spread and then raw
  attributes. Both of those fallbacks become dangerous when “character” is replaced by additive gear.
- Pet persistence already accepts a local/offline client account claim, sanitizes it, derives exact levels
  and modifiers from the server catalog, and snapshots the run pet. Gear may use that same trust posture,
  but it grants more combat verbs and therefore needs an equally closed payload.
- Weapon drops already have their own combat cadence (`1.2%` trash, `5.5%` tough) and a uniform power-banded
  weapon pool. Putting clothes and pets into that same roll either starves weapons or makes permanent
  discoveries rain from trash.

The dangerous sentence is “each gear slot has stats or an ability.” Read literally at endgame, it creates
up to eight stat packages and eight hook sources before the pet is considered. No amount of item-by-item
tuning fixes an uncapped composition rule.

---

## 1. The slot-budget law

### Proposed law: eight appearance slots, six power payloads

The blank rig starts at `1/1/1/1/1`. An accepted loadout has exactly this gameplay shape:

| Payload | Count | Effect |
|---|---:|---|
| Stat mark | exactly 5 | Each adds exactly `+1` to one of STR/DEX/INT/CON/LUK |
| Keystone quirk | exactly 1 | Activates exactly one legacy quirk definition |
| Cosmetic-only slot | exactly 2 | Visual identity; zero hidden stats, procs, or set contribution |

Every physical item has at most one canonical `powerTag`: `stat:<attr>`, `keystone:<quirkId>`, or `none`.
There are no random affixes, rolled values, item levels, secondary stats, or outfit set bonuses. One item
cannot carry both a stat and a quirk. The server accepts a loadout only when:

```text
final[attr] = 1 + count(equipped stat:<attr>)
sum(final) = 10
1 <= final[attr] <= 4
equipped keystones = 1
```

This is the smallest law that makes the arithmetic honest. Five stat marks reconstruct every old spread,
including duplicates, while the per-attribute cap prevents five STR pieces from producing `6/1/1/1/1`.
One Keystone preserves the one-quirk era. The pet then stacks exactly as it does today; the wardrobe does
not multiply the number of hook sources.

**Recommended slot assignment:** hats are the Keystone slot. This makes the “hats especially” ruling
mechanically meaningful, makes the active ability readable in the wardrobe and squad HUD, and means a new
quirk unlock is immediately swappable without rebuilding seven other slots. Five of the remaining seven
slots carry stat marks and two are cosmetic-only. If abilities may instead live in arbitrary physical
slots, implementation still needs one explicit Keystone socket and must gray out every non-selected
ability; merely summing all worn hooks is forbidden.

`META_UPGRADES` do not sit above this ledger. The shopkeeper should sell permanent gear unlocks or targeted
discoveries. Existing Power/Fortune/Vitality ownership should grant canonical STR/LUK/CON-mark gear (or an
explicitly budget-equivalent replacement), not leave `upPower`, `upFortune`, or `upVitality` adding stats
after the five marks. “Folded into gear” has to mean competing inside the wardrobe budget, not old account
power plus new gear power.

Two consequences are intentional:

1. Two of eight slots are allowed to be fashion. Eight categories are a visual promise, not eight damage
   lanes.
2. Later rarities may add acquisition prestige or visuals, never a second payload. A legendary hat is not
   allowed to mean “quirk plus two stats.”

### What fails without it

- Eight `+1` pieces turn the sum-10 identity into sum 13 before quirks and legacy upgrades.
- A maxed account becomes strictly stronger rather than differently expressive; new players are not
  missing options, they are missing several character kits' worth of numbers.
- Every future item must be balanced against every other item in seven slots. A local `+5%` that looks
  harmless becomes a multiplicative tower.
- Local-trust cheating becomes much more damaging: claiming all ownership is bounded under the law, while
  claiming eight stacked abilities is not.

---

## 2. The 40-character migration must be literal, not ceremonial

Every former character needs a checked-in migration row containing:

```text
legacy id/name
8-item outfit preset
5 stat marks -> exact old spread
1 Keystone -> old quirk id
quirk status: active | partial | inert | reauthored
visual source status
acquisition source
```

The preset is the proof. Starting from ones, its five marks must reproduce the old
`CHARACTER_KITS[legacyId].spread` byte-for-byte, and its Keystone must resolve to the old quirk. Shared stat
items are fine; claiming that 40 old bodies imply 320 ready gear pieces is not. The current character body
PNGs are mostly flattened bodies plus hands/feet, not eight independently anchored wardrobe layers.

The status column is release truth. Today only seven quirks are active and Temple Wall is partial. The 32
inert rows need their named authoritative seams before their gear can be called ability-bearing. A locked
card may preview future behavior; an owned card may not silently do nothing.

Several quirks also collide with the newly binding systems and require explicit re-authoring:

- **Overstuffed Bandoliers** and **Coldsnap** speak in magazine/reload terms that the universal recharging
  resource removes.
- **Pressurized** modifies beam vent and overheat lock, while the new law says a held beam drains the common
  bar and empty bar is the natural lock. It needs a bounded resource-bar interpretation, not a second heat
  economy.
- **Hazard Rates** starts with a fourth arsenal slot and no bag. The new weapon ruling names three active
  slots plus a persistent bag; this quirk cannot smuggle a fourth active slot back in.
- **Posted** and **The House** become much more valuable when weapon drops bank into a persistent bag and
  can be sold. Their output needs economy caps before migration.

### Quirk combinations that cease to be quirks

The class merge kept these exclusive by character. The gear rewrite must not discover their pair balance
in production. These are representative breakages, not a whitelist of all other pairs:

| Pair | Failure |
|---|---|
| Unwritten + any second Keystone | Removes the ballast tax and adds a real combat rule; it strictly dominates identities that still pay ballast |
| Does Not Stop + Mag-Boots | Immunity to slow, stun, knockback, and pull erases the enemy control vocabulary |
| Fox Dance + Iai | Two roll charges become two guaranteed-crit primers; dodge turns into an offensive battery |
| Habit and Prayer + Insufferably Graceful | The chain never expires and failed parries have no cooldown cost, enabling safe retries into an unbounded chain |
| Porcelain + Already Dead | Two lethal-prevention state machines create ordering, revive, and once-per-dimension receipt exploits |
| Bottled Spite + Whispered Rites | Every attacker is automatically Branded for double duration, approaching a permanent squad damage amp |
| Molten Core + Let It Out | Automatic low-health ignites recursively jump on kills, converting a bounded proc into a room-clearing chain |
| Posted + The House | Guaranteed elite drops plus best-of-two rarity prints persistent weapon value and Scrip |
| Planted + Bog Patience | Standing still grants damage reduction and then target cloak, creating an AFK-safe stall state |
| Half Projection + Fox Dance | Two roll charges can maintain decoys and rotate enemy target denial, especially disruptive in co-op |
| One Perfect Strike + Iai | The same opener can be doubled and guaranteed to crit; unspecified multiplication can skip boss phases |
| Coldsnap + Bandoliers/Pressurized | Their old reload, magazine, heat, and lock semantics no longer share a valid resource ledger |

Do not solve this with a growing pairwise denylist. Forty quirks produce 780 unordered pairs before pets,
augments, and weapons. The one-Keystone law removes the combinatorial category and preserves the authored
meaning of “signature.”

---

## 3. Ultimate unlock: allocation must remain a sealed ledger

Gear is applied before the run; allocation is authored during the run. They must never share a mutation
helper.

Hard rule:

- `allocRun` starts at zero on every new run.
- Only an accepted level-allocation decision may increment it.
- Gear seeding, preset changes, account restoration, reconnect, shop purchases, migration, and pet effects
  must not call `allocate()` or otherwise touch `allocRun`.
- Family/variant ranking must not fall through to raw gear-inflated attributes.

The current `ultimateRankingForAllocation()` uses allocation, then the character spread, then raw stats.
After character retirement, blindly replacing `spreadForCharacter(runCharacter)` with “all gear stats”
would let a hat or migrated Power level decide tied matrix cells. The clean allocation-only tuple is:

```text
allocRun[attr] -> number of player-chosen allocations into attr -> fixed ATTRS order
```

That may require a small private `chosenRun` tally because `allocRun` also includes deterministic ballast.
It is still preferable to letting permanent gear rewrite a system sold as the result of in-run allocation.
If the five-mark reconstructed spread is intentionally retained as a tie-break, it must be a distinct
snapshotted `identitySpread` and must exclude all other gear/meta modifiers. That is the weaker option and
must be stated in the ultimate UI.

Test the exploit directly: two players making the same allocation choices with radically different owned
gear must unlock the same family and variant under the recommended law.

---

## 4. Acquisition: one drop economy cannot serve three masters

Weapons, gear, and pets have different ownership semantics:

| Category | Cadence | On death | Duplicate meaning |
|---|---|---|---|
| Weapons | Frequent combat loot | All carried copies lost | Useful; copies are inventory/stakes |
| Gear | Sparse permanent discovery | Ownership retained | No useful copy exists |
| Pets | Rare permanent companion discovery/progression | Ownership retained | No useful copy exists |

They must not be entries in one weighted table. Preserve three independent reward lanes:

1. **Weapon lane:** keep the existing enemy/tough roll and weapon power band. Gear/pet content never dilutes
   its probability.
2. **Gear discovery lane:** personal, boundary/chest/boss receipts, with at least one guaranteed discovery
   on a qualifying first dimension clear until the starter collection can form multiple valid builds.
3. **Pet discovery lane:** authored boss/biome milestones with its own pity. A pet roll never replaces the
   run's weapon roll or guaranteed gear discovery.

Required pacing targets are more useful than a fashionable rarity percentage:

- New account launches with one complete valid eight-item preset.
- A different usable Keystone is guaranteed by the second qualifying clear.
- A player can assemble a second valid spread without dismantling the starter preset by 8-10 qualifying
  clears.
- No category can go more than three qualifying clears without advancing its own pity while unowned
  content remains.

Permanent gear has no copies. A gear discovery draws without replacement from the player's unowned pool,
optionally scoped by slot or biome. If that pool is exhausted, the receipt becomes a fixed, disclosed Scrip
cache; it never creates duplicate inventory, shard dust, reroll currency, random stat growth, or an
unbounded sale faucet. The same principle applies to pet ownership. The account stores a set/presence map,
not quantities.

“Found in a run” also needs a banking edge. The decision says gear is permanent and weapons are the stakes,
so the least surprising rule is an idempotent account unlock at the accepted discovery event, even if the
run later wipes. Do not make a clothing pickup look permanent and then secretly require extraction.

In co-op, permanent discovery should be a private account receipt or a squad discovery granted once to
each eligible player. A single physical hat that only the fastest player can take turns co-op into account
progression theft.

---

## 5. Wardrobe without eight-slot homework

Eight slots multiplied by a growing catalog is not a pre-run ritual players will repeat willingly. The
normal launch path must select a preset, not ask eight questions.

**Preset law:** ship one immutable Starter/Reset preset, at least five writable named presets, and an
automatic Last Used pointer. A preset stores eight canonical item ids and its derived spread/Keystone
summary. Equip, duplicate, rename, and overwrite are one action each. Former-character migration presets
are one-click templates, not eight scavenger hunts through slot tabs.

- Launch always uses the last valid preset unless the player deliberately changes it.
- A new unlock receives a badge and comparison view; it never auto-equips, invalidates a preset, or opens a
  blocking modal.
- The compact launch card shows only spread, Keystone, pet, and three weapon starting slots. Per-slot
  browsing lives in Wardrobe.
- Presets are edited only between runs. Ready/launch snapshots the loadout; shops, rifts, death, revive,
  reconnect, and C-key input cannot change power or appearance for that run.
- If catalog changes make a preset invalid, show the exact invalid slot and fall back to Last Valid or
  Starter before matchmaking. Silent partial repair can change both spread and ultimate tie behavior.

Without presets, every permanent unlock increases menu cost. That is progression which makes the game
slower to start.

---

## 6. Local trust is acceptable; arbitrary ability payloads are not

The pet ruling is binding: local/offline account trust, no signatures or authenticated store. The honest
security claim is therefore “bounded and well-formed,” not “earned.” A player can edit local ownership.
The server must still prevent an edited browser blob from inventing hooks, values, or illegal stacks.

The client may claim only ownership ids and a selected preset/loadout. The server resolves all stats,
abilities, visuals, slot rules, and effect values from its closed `GEAR_CATALOG`, then snapshots once at
run start exactly as pet level/modifiers are derived and cached.

### Sanitization table

| Input | Server rule |
|---|---|
| Account version | Accept the one supported version; unsupported/missing version becomes a starter account, never partial interpretation |
| Revision | Finite integer, floor/clamp to account range; never grants power or wins over the current room snapshot |
| Owned gear | Iterate known catalog ids only; presence means owned; drop unknown ids, malformed rows, counts, levels, rarity, affixes, and duplicates |
| Item id | Exact closed-catalog membership; the client cannot send an embedded definition |
| Slot | Derive from catalog; reject an item in the wrong one of boots/gloves/shirt/pants/cloak/glasses/facial-hair/hat |
| Equipped map | Exactly one id for every slot, no repeated id unless the catalog explicitly marks it reusable; every id must be owned |
| Stat payload | Ignore client values; derive `stat:<attr>` from catalog, require exactly five, recompute final sum 10 and each attr 1..4 |
| Ability payload | Ignore client quirk/effect/hooks; derive one Keystone id from catalog and resolve its server-owned `QuirkDef`/successor |
| Meta upgrades | Migrate to owned gear grants, then clear/ignore additive upgrade levels for run power |
| Presets | Clamp count and name length; sanitize each as a complete loadout; invalid presets are display data only and cannot ready-up |
| Selected preset | Must resolve to one fully valid owned preset; otherwise use a visible Starter/Last Valid fallback |
| Cosmetic fields | Catalog ids and bounded palette index only; no client scale, depth, alpha, anchor, texture path, or bounds |
| Catalog version | Client value is advisory/ignored; room snapshots the server's current catalog version |
| Mid-run messages | No equip/change/loadout mutation exists; reject rather than resnapshot |

The active runtime should cache one normalized modifier record and one Keystone hook source. It should not
loop over eight raw client items at every damage, parry, movement, or resource tick. Public state exposes
the eight sanitized cosmetic ids (or a stable outfit descriptor) plus one Keystone icon/id; exact account
ownership remains owner-private.

---

## 7. Co-op readability: clothes cannot defeat combat language

Eight layers on four players means 32 wardrobe sprites before weapons, pets, effects, and enemies. The
blank rig must remain the silhouette contract.

### Silhouette law

- Gear never changes collider, movement radius, weapon reach, muzzle origin scale, root scale, or feet
  anchors. The old per-character `characterScale()` path retires; the blank rig has one scale.
- Non-hat opaque art stays within `1.15x` the blank body's width. Hats may extend to `1.25x` body width and
  at most `0.20x` body height above the authored head anchor. Cloaks render behind the body and may not hide
  hands, feet, held weapon, or ground contact.
- Gloves bind to hand anchors; boots to foot anchors; glasses/facial hair/hats to fixed head anchors. No
  item supplies arbitrary offsets at runtime.
- At remote LOD, glasses and facial hair collapse first; hat, shirt, cloak, weapon, team outline, and pet
  remain. Small fashion must lose before player identity or telegraphs do.

### Palette and telegraph law

- Each teammate receives a persistent high-contrast outline/ground pip from a reserved ally palette. Gear
  cannot tint or cover it. The squad HUD repeats that color and shows the one Keystone icon.
- Pure telegraph white and hostile red are reserved from gear emissives, outlines, flashes, and large-area
  fills. Gear can contain muted local color, but cannot impersonate a parry/dodge instruction.
- Every gear layer, including hats and cloaks, renders below the authoritative telegraph layer. A hat
  shader, flourish, or glow has no path above it. Overhead enemy tells also render above hats.
- Hats never emit opaque screenspace particles and never cover another player's ground pip. If a hat and a
  tell overlap, the tell wins in depth and alpha without an item-specific exception.

### Budget law

Use retained atlas-backed images, no per-frame object/Tween allocation, and one fixed eight-layer rig per
visible player. Render tests must cover four maximally layered players plus pets and simultaneous
white/red tells at the smallest supported viewport. The technical ten-player room cap also needs a degraded
LOD test even if four is the product target.

---

## 8. Retirement surface: remove the ghosts, reuse the value

| Surface | Retires | Re-purposes |
|---|---|---|
| Character select/cards | Character unlocking, 40-body selection, class/character identity copy | Layout becomes Loadout/Wardrobe; legacy characters become named outfit templates and migration provenance |
| `Companions` folio | Nothing about pet ownership, level, selection, or Bond progression | Remains the pet tab beside Wardrobe in one pre-run Loadout area; remove assumptions that it is adjacent to a character card |
| C key | Client binding, `cycleCharacter` message, server handler, training-only identity resnapshot | Leave unbound or later bind to a read-only loadout summary; never cycle gear or power mid-run |
| Shared/server identity | Runtime use of `PLAYABLE_CHARACTERS`, `nextCharacter`, `runCharacter`, `spreadForCharacter(character)`, `quirkForCharacter(character)`, `characterScale(character)` | Preserve a legacy migration registry; move spreads into preset proofs and quirks into the closed gear/Keystone catalog |
| Client player rig | `charOf` skin swapping and reconstruction of a whole `cc-*` rig | One blank rig plus fixed gear layers; outfit signature replaces character id for rebuild detection |
| HUD/level folio | Character name/lineage as active identity and character-derived quirk copy | Show composed spread, Keystone name/icon, pet, and allocation-only ultimate preview |
| Dev protocol/portal | `?dev=char:<id>`, `devEquip.character`, and the Characters catalog as live selectable bodies | Add `?dev=gear:<id>` and `?dev=outfit:<legacyId>`; one-release compatibility redirect may open the matching legacy preset |
| Character art assets | Direct player-runtime use of `public/sprites/cc-*`, their atlas rows, and per-character scale tuning | Archive as source art, portraits/lore cards, migration references, and visual targets. Re-author slot layers against blank-rig anchors; do not pretend flattened body PNGs are ready clothing cutouts |
| Character tooling | `gen-character-roster.mjs` as the runtime roster generator and character-only portal count | Convert to a gear catalog/migration validator or retain only as an archival import tool |
| Class icon assets/lineage | Any suggestion that lineage gates power or selection | Optional wardrobe filters, lore tags, or preset grouping only |

Retirement should be tested by absence: no production message can change character/gear mid-run; no HUD
falls back to “The Drifter” as active identity; no weapon-reach calculation reads a retired character
scale; and no dev deep-link bypasses the gear sanitizer.

---

## Hard guardrails

| # | Guardrail | Required proof |
|---:|---|---|
| G1 | Eight slots are not eight power lanes | Catalog schema permits at most one `powerTag` per item |
| G2 | Exact old numeric envelope | Every valid loadout has five stat marks, one Keystone, two cosmetic slots |
| G3 | Spread honesty | Derived attributes sum to 10 and each is 1..4; property test all accepted combinations |
| G4 | No legacy additive tower | `upPower/upFortune/upVitality` cannot add run power after gear migration |
| G5 | Quirk exclusivity | Exactly one server-resolved Keystone; zero pairwise quirk dispatch paths |
| G6 | Honest 40-row migration | Every legacy id has an exact spread/preset/quirk/status/acquisition row; inert is never labeled active |
| G7 | Resource-era consistency | Bandoliers, Coldsnap, Pressurized, and Hazard Rates are reauthored or remain visibly unavailable |
| G8 | Ultimate isolation | Gear never mutates `allocRun`; identical allocation histories resolve identical ultimates under the recommended law |
| G9 | Closed local-trust payload | Server accepts ids only, derives all effects, rejects invalid loadouts, and snapshots once |
| G10 | No active-run wardrobe | No shop/rift/death/reconnect/C-key route can change the snapshot |
| G11 | No drop dilution | Weapon probability is unchanged by gear/pet catalog size; gear and pet pity are independent |
| G12 | No duplicate gear inventory | Discovery is without replacement; exhausted pools become one fixed disclosed fallback receipt |
| G13 | Presets are the normal path | Starter + at least five writable presets + Last Used; one-click launch from a valid preset |
| G14 | Co-op silhouette | Fixed blank scale/anchors; gear bounds validated; teammate outline and Keystone icon remain visible |
| G15 | Hats lose to tells | All hat art/VFX below telegraphs; max-chaos render fixture shows no obscured white/red instruction |
| G16 | Retirement is complete | Character cycle/select/deep-link/runtime-scale paths have no production callers after compatibility sunset |

**Kill criteria for the implementation shape, not the decided direction:** stop and redesign the gear data
model if a valid loadout can exceed sum 10, dispatch two quirks, change ultimate outcome without changing
allocation, reduce weapon-drop probability as the gear catalog grows, or equip a client-authored effect
value. Those are architecture failures, not tuning bugs.

---

## Three questions implementation needs answered

1. **Where is the single Keystone socket?** Recommended: hats own it, making all other slots stat/cosmetic.
   If arbitrary items may carry signature abilities, specify the one-active selection UI and invalid-loadout
   behavior before authoring any gear.
2. **What is the ultimate's gear-free tie rule?** Recommended: `allocRun`, then player-chosen allocation
   count, then fixed `ATTRS` order. If the reconstructed five-mark spread remains a tie-break, confirm that
   it alone—not other gear or migrated meta bonuses—is allowed to influence ties and teach that in UI.
3. **Who receives and when banks a permanent discovery?** Recommended: a private per-eligible-player gear
   receipt banks immediately, uses a without-replacement pool, and never consumes the independent weapon or
   pet reward. Confirm the qualifying-clear cadence, co-op eligibility, and exhausted-pool Scrip value.
