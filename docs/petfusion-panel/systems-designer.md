# Pet Fusion + Deepened Evolution — Systems Designer

Role: systems proposal only. This document authorizes no source change.

## Design verdict

Fusion is an endgame collection layer for a player who has already reached a first capstone. It is not breeding, duplicate disposal, or a way to stack two pets. A fusion contains exactly **one parent's level-10 scaling bonus and the other parent's single capstone**. The player chooses the direction with a complete preview; there are no rolls, hidden traits, two-scaling kits, or two-capstone kits.

Parents are never consumed. They become **Bonded** and unavailable while their fusion is manifested, and return unchanged when it is dissolved outside a run. A fused companion is mechanically complete on creation. Its short independent progression is cosmetic/mastery progression, not a second climb back to power the player already earned.

The advocate's trust, authority, award, and stacking-envelope laws remain gates. I intentionally do **not** keep its literal "one `budgetKey` per pet" rule for fusion: combining two different inherited specialties is the point of a Persona-style fusion layer, and the current base roster already contains mixed clauses. Instead, fusion obeys a stricter **one power-budget law**: one scaling slot, one capstone slot, an explicit compatibility allowlist, no direct-compounding pair, and the full kit must pass the existing `+8%` sustained-output, `+15%` three-second-burst, and `+10%` total-recovery fixtures. The loadout is rejected if either inherited effect overlaps the selected character quirk's protected key.

The fusion advocate would go further: at most four fixed outputs, a catalog-fixed inheritance direction, one strict shared `budgetKey`, parents that never become unavailable, no Scrip or catalyst cost, and no mechanical stage-2 branch. This proposal departs deliberately because those restrictions remove the requested inheritance choice, bonded-parent commitment, economy goal, and evolution branches. The compensating constraints are concrete: every orientation is still an authored/versioned definition rather than a runtime trait merge; only ten pairs exist; two direct-compounding pairs are excluded up front; parents and progress are returned losslessly; the first corrective Aspect respec is free; costs unlock a permanent recipe rather than paying for attempts; and every result is exact-previewed with no random or concealed outcome.

The base panel still has a P0 dispute over Deep Reservoir, Pack Shell, Heavy Purse, and multiplicative regeneration. Fusion must not settle that dispute by quietly rewriting an inherited effect. Product first freezes the base catalog. A disputed capstone remains unavailable as a fusion donor until it passes the base acceptance fixture or is transparently revised under the advocate's compensation law.

## 1. Fusion rules

### Unlock and eligibility

- The **Concord** page unlocks account-wide when any base pet first reaches level 10. Before then, fusion recipes may be teased by name but not inspected as another onboarding system.
- A recipe requires two **distinct, owned, level-10 base pets**. Borrowing a capstone from an unmaxed parent would award power the player has not earned.
- Both parents must be idle in the kennel: not selected in a readied/active run, not Bonded into another manifested fusion, and not involved in a pending account transaction.
- An account may manifest at most **one fusion at a time**. The ordinary one-companion slot remains the only run slot, and ready-up snapshots either one base pet, one fusion, or no pet.
- Same-species fusion and duplicate copies do not exist. Fusion never creates a tradeable egg or inventory item.

### Compatibility classes

Compatibility is a hand-authored allowlist, not a rule that automatically approves all `8 choose 2 = 28` pairs. Ten unordered pair recipes ship; every other pair shows a short incompatibility reason. Each legal pair supports both inheritance directions after the base capstones are approved, for **20 meaningful kits**.

| Class | Legal unordered pairs | Design boundary |
|---|---|---|
| **Recovery weave** | Verdant Wing–Hearth Newt; Verdant Wing–Pale Firefly; Hearth Newt–Pale Firefly; Hearth Newt–Slate Tortoise; Pale Firefly–Slate Tortoise | Recovery, rescue, and surviving traversal may mix, but no pair may multiply the same recovery receipt. Verdant–Slate is excluded because Verdant's regen scaling and Sure Footing directly compound passive regen. |
| **Fieldcraft weave** | Verdant Wing–Copper Snail; Copper Snail–Brass Crab | Weapon endurance and carrying convenience may mix without adding damage, projectiles, or loot. Verdant–Brass is excluded because faster cycle recovery plus extra capacity directly compounds the same weapon cycle. |
| **Salvage weave** | Lodestar Moth–Copper Snail; Lodestar Moth–Gilded Gecko; Copper Snail–Gilded Gecko | Existing Echo, earned-weapon, and legitimate-sale receipts may mix; they never create drops, XP, sale provenance, or extra shop offers. |

Sharing a class is necessary but the listed pair is the actual contract. A future balance change does not automatically make an eleventh recipe. New links require their own full-stack fixtures and player-facing preview.

Ten recipes are a larger QA surface than the advocate's ceiling of four, but remain finite: exactly 20 oriented definitions instead of 56 generated combinations. Each `A → B` and `B → A` orientation has its own catalog id, version, preview, test fixtures, and allowlist row. Runtime never receives a generic `mergeMods(parentA, parentB)` operation.

### Inheritance law

For a manifested fusion, the player chooses an orientation `A → B`:

1. Take parent A's exact level-10 scaling formula and A's selected stage-2 Aspect.
2. Take parent B's exact approved level-10 capstone.
3. Take nothing else: no A capstone, no B scaling, no B Aspect, no parent acquisition perk, and no fusion-only combat passive.

The selection screen prints both omitted clauses as **Not inherited**. Reversing the direction is a dissolve-and-reform operation outside a run, costs nothing after the pair recipe is attuned, and is fully previewed before confirmation.

The two inherited effects retain their original authoritative seams and restrictions. Fusion does not make the rendered follower position meaningful, does not change the one-pet run snapshot, and does not reset charge, reload, inventory, once-per-run, Scrip, or Bond ledgers. Downing suspends active benefits under the same base-pet rules.

The power review uses the complete oriented kit, including the chosen Aspect, lowest-capacity weapons, maximum relevant attributes/meta, six relevant augment stacks, set bonuses, peak loot, and character quirks. A recipe orientation is denied rather than silently weakened if it breaches an envelope. In particular, two effects that improve numerator and downtime of the same cycle are not considered two harmless half-budgets.

### Parent state, creation, and dissolution

Attuning an unordered recipe creates a permanent account record. Manifesting one orientation marks both parents **Bonded**:

- Bonded parents retain ownership, 3,600 Bond XP, level 10, stage, Aspect, cosmetics, and patch-compensation rights.
- They cannot be independently selected or used in another fusion while the child exists. The UI explains this before ready-up; it never silently falls back to another pet.
- Dissolution is available at any non-readied menu or result screen and is blocked during matchmaking, an active run, or unsettled results.
- Dissolution immediately returns both parents at 100% of their prior state. Pair Mastery and the attuned recipe remain on the account, so experimentation never destroys earned progress.

This temporary unavailability is the explicit departure from the advocate's always-selectable-parent rule. It prevents one lineage from being presented as simultaneously independent and fused, makes the manifested choice legible, and cannot strand the player because dissolution is free and immediate outside ready/run state. It is a reversible selection lock, not consumption, downgrade, or reset.

There is no monetary dissolution refund because manifestation itself costs nothing and attunement permanently bought the recipe. The effective refund is **100% of both parents and 100% of pair progress**. If a patch removes a recipe, changes its inherited topology, or materially nerfs it, the trust-law remedy is different: return its full `120 Scrip + 2 Convergence Cores`, convert all Pair Resonance XP to the account Bond Reserve, dissolve it automatically, and grant one free companion reselection.

### Fused leveling

A fusion starts at **Ascendant, level-10-equivalent power**. It does not replay levels 1–10 and it never temporarily loses either inherited clause. It has its own three-rank **Pair Resonance** line:

| Pair Resonance | Cumulative XP | Reward |
|---:|---:|---|
| 0 — Attuned | 0 | Both inherited effects active; A's Ascendant chassis with B's capstone glyph/accent. |
| 1 — Harmonized | 300 | Pair portrait treatment and species-paired idle chirp. |
| 2 — Interlocked | 700 | A second saved inheritance/Aspect preview preset; presets do not switch in a run. |
| 3 — Concordant | 1,200 | Permanent fused core mark, result-screen title, and collection completion stamp. No stats. |

Only an equipped fusion earns Pair Resonance, using the base `100/140/180/80`, maximum-500 terminal receipt rules. Parents earn none. Resonance belongs to the unordered recipe and therefore survives dissolution and orientation changes. At 1,200 it displays `Concordant` and discards overflow; there is no conversion wallet.

## 2. Evolution deepening

At level 4, when a base pet becomes Awakened, it chooses one of two deterministic **Aspects**. An Aspect replaces the ordinary scaling expression from levels 4–10; it is not added on top. The first choice and the first corrective respec are free. If the player dismisses the ceremony, the first, steadier option is selected so progression never blocks a run. Later respecs cost **40 Scrip** with no escalation, cooldown, XP loss, or seasonal restriction; they are available only outside a readied/active run, have a full final-form and numerical preview, and take effect next run.

Aspects redistribute timing, direction, or target coverage while preserving the original effect seam and cap. They add no capstone and no new pet position authority.

| Pet | Aspect one | Aspect two |
|---|---|---|
| **Verdant Wing** | **Canopy:** keep passive regeneration `×(1 + 0.05L)` continuously. | **Dewpulse:** run without the pet multiplier between pulses. Accumulate exactly the bonus healing the `0.05L` term would have supplied and pay it every `4.0` living seconds. Do not bank at full HP, while downed, or while base regen is zero. This changes sustain into deterministic burst without increasing its four-second integral. |
| **Hearth Newt** | **Emberflow:** all eligible non-regen healing remains `×(1 + 0.02L)`. | **Flashcoal:** eligible healing is `×(1 + 0.04L)` while the owner is below `40%` max HP and `×1` at or above 40%. It concentrates the same specialty into crisis recovery; revive HP, regen, and the Traveling Hearth capstone remain excluded. |
| **Lodestar Moth** | **Wide Orbit:** Echo reach remains `180 + 18L` px. | **Slingshot:** reach is `180 + 9L` px normally and `180 + 36L` px for `2` seconds after the first eligible Echo enters reach, followed by `4` seconds in the normal state; no refresh. Its six-second weighted reach equals the Wide Orbit budget and it mints no Echo or XP. |
| **Copper Snail** | **Broad Compass:** every eligible earned-weapon pickup uses `46 + 4L` px. | **True North:** use `46 + 8L` px inside a `70°` cone around the owner's stable aim and the authored `46` px base outside it. It offers directed reach, not movement of the pickup or a second grab. |
| **Gilded Gecko** | **Even Scale:** legitimate sales add `2L%` until the existing `2L` per-run bonus cap. | **Quick Count:** add `4L%` until `L` bonus Scrip has been minted, then `1L%` until the same terminal cap. At level 10, Heavy Purse still changes only that terminal cap from 20 to 30. Provenance, fractions, and idempotency are unchanged. |
| **Brass Crab** | **Drawspring:** held reload/refill duration is `×(1 - 0.015L)` and stowed duration is `×(1 - 0.005L)`; at level 10, `×0.85` held and `×0.95` stowed. | **Backbench:** reverse those coefficients: `×(1 - 0.005L)` held and `×(1 - 0.015L)` stowed. Neither touches attack cooldown, beam heat, draw lock, or charge cost. |
| **Pale Firefly** | **Halo Lantern:** revive-effect reach remains `96 + 6L` px in all directions. | **Ribbon Beacon:** reach is `96 + 12L` px inside a `70°` stable-aim cone and `96 + 3L` px elsewhere. It still modifies only an existing owner-performed revive effect and creates no universal revive action. |
| **Slate Tortoise** | **Pit Cairn:** pit damage is `×max(0.70, 1 - 0.025L)` and other eligible authored ground-hazard damage is `×(1 - 0.005L)`; at level 10 these are `×0.75/×0.95`. | **Warding Cairn:** reverse the two coefficients, producing `×0.95` pit and `×0.75` eligible ground-hazard damage at level 10. Enemy zones, contact, projectiles, bosses, and self-costs remain ineligible. |

Aspect identity appears as a small existing-material tint, core pattern, and card glyph—never a fourth silhouette, rarity aura, new appendage, or gameplay telegraph. Hatchling remains unchanged; both branches use the approved Awakened and Ascendant species rigs.

Fusion inherits only the scaling parent's Aspect. A Bonded parent may still use its unused corrective respec or pay 40 Scrip through the fusion detail page; the preview updates immediately and the new Aspect enters the next run snapshot. The capstone donor's Aspect is shown but crossed out as not inherited. Pair Resonance never strengthens an Aspect.

## 3. The collection arc

Fusion appears only after the first capstone ceremony, when the player already understands pet selection, Bond XP, stages, and a fixed capstone. The first real fusion goal is therefore honest: max a second pet whose kit the player actually wants, then combine two fully earned identities. Convergence Cores can be earned while leveling that second pet, so the feature does not impose a separate pre-fusion farm.

The collection ceiling is deliberately finite:

- **8 base species** with one account record each;
- **10 attuned pair records** from the compatibility table;
- **20 oriented mechanical kits**, two per pair, saved as configurations rather than duplicate creatures;
- **16 base Aspects**, which are choices on the eight records rather than additional collection copies.

Thus the collection page has **18 completion nodes**—eight species plus ten pair bonds—not 28 unordered recipes, 56 directed fusion copies, randomized offspring, or duplicate fodder. Completing all ten Pair Resonance lines requires 12,000 applied XP; because each line caps separately and a perfect run pays 500, that is three full runs per pair, about 6–7.5 active hours for 30 successful 12–15 minute chains. It extends the base collection with authored goals without making the player repeat another 3,600-power-XP line for every fusion.

The Companions page gains a Concord tab after unlock:

- a ten-link constellation grouped into Recovery, Fieldcraft, and Salvage, with the other 18 pairs visibly incompatible rather than mysteriously absent;
- an orientation toggle that previews exact current numbers, inherited Aspect, inherited capstone, omitted clauses, protected-key conflicts, parents' Bonded state, cost, and Pair Resonance;
- one manifested-fusion slot with **Dissolve** and **Reform** actions, disabled with a plain reason while readied or in a run;
- base cards marked `Bonded to: <pair>` and a direct route to the relevant fusion card;
- post-run Pair Resonance receipts using the same milestone breakdown as Bond XP, with no combat meter or popup.

In-world art uses the scaling parent's Ascendant silhouette and part budget, plus the capstone donor's existing material accent/core glyph and paired chirp. Fusion does not demand a new species, larger follower, extra particles, or authoritative position. The card name stays literal—`Verdant Wing // Hearth Newt`—so players can read the inheritance without memorizing 20 invented names.

## 4. Economy and anti-farm posture

| Action or award | Exact rule |
|---|---|
| Aspect first choice | Free at level 4. |
| Aspect respec | First correction per pet free; later changes cost `40 Scrip`, previewed, authoritative, outside a run. |
| Attune one unordered recipe | `120 Scrip + 2 Convergence Cores`, once. Both orientations and permanent pair record included. |
| Manifest, dissolve, or reverse an owned recipe | Free outside ready/run state. Parents and Pair Resonance are lossless. |
| Convergence Core award | After Concord unlock, award exactly `1` on a terminal victory/extraction in which the account qualified for all three unique `100/140/180` clear receipts. Maximum one per account/run. |
| Pair Resonance | Same base terminal receipts, maximum 500/run, equipped fusion only. |

Convergence Cores are deterministic, account-bound boss-victory receipts—not random drops. A wipe, abandon, shallow reset, repeated dimension epoch, training/debug run, unqualified clear, or terminal callback replay awards zero. The transaction key is account/run/result scoped, so reconnect and settlement retry cannot duplicate it. There is no daily/weekly gate, pity counter, trade, salvage value, store purchase, or real-money path.

The advocate prefers the two maxed parents to be the entire cost. This proposal adds a bounded economy goal because a permanent recipe should mark a fresh collection achievement, but it avoids the farm traps the advocate identifies: the fee is paid once per unordered pair, manifestation and reversal are free forever, the Core is deterministic and comes only from the base system's deepest legitimate completion route, and neither currency can reroll or improve the inherited result.

The base anti-farm posture remains intact: trash, damage, last hits, elapsed time, XP Echoes, weapon pickups, rarity, Scrip spent, and difficulty grant zero Bond or Pair Resonance and zero Cores. Presence and accepted-action qualification remain exactly the base `60 seconds + 3 accepted combat/support actions` for each paid dimension receipt. A deeper complete chain is the only Core route.

Scrip is debited through the canonical account transaction. Gilded Gecko may continue to mint only its already-capped bonus from legitimate earned-weapon sales; it cannot reduce fusion prices, multiply Cores, create recipe refunds, or modify any XP receipt. No fusion effect grants offline progress or kennel XP. Maxed base pets and Concordant pairs discard overflow.

## 5. Example fusions

1. **Verdant Wing → Hearth Newt:** Canopy or Dewpulse `×1.50`-budget regeneration from Verdant Wing + **Traveling Hearth**, healing 15% max HP on each accepted descent. *A leaf-wing ember carries a safe campsite between dimensions.*
2. **Verdant Wing → Pale Firefly:** Canopy or Dewpulse regeneration from Verdant Wing + **Second Glow**, returning allies revived by the owner at 40% instead of 30% max HP. *The green butterfly becomes a field medic's quiet pulse between rescues.*
3. **Lodestar Moth → Gilded Gecko:** Wide Orbit or Slingshot Echo reach from Lodestar Moth + **Heavy Purse**, raising only the level-10 legitimate-sale bonus cap from 20 to 30 Scrip. *A compass-wing broker finds what the expedition left behind and weighs it honestly.*
4. **Brass Crab → Copper Snail:** Drawspring or Backbench reload/refill scaling from Brass Crab + **Pack Shell**, setting personal bag admission to 13. *A clockwork quartermaster keeps the arsenal moving and one last trophy packed.*
5. **Slate Tortoise → Hearth Newt:** Pit Cairn or Warding Cairn hazard mitigation from Slate Tortoise + **Traveling Hearth**, healing 15% max HP on accepted descent. *A warm cairn survives the bad road and rekindles at every crossing.*
