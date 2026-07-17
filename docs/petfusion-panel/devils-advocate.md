# Pet Fusion + Deeper Evolution Panel - Devil's Advocate

Panel role: devil's advocate. Scope: proposal only. This document authorizes no implementation.

## Verdict

**Reject unrestricted fusion. Conditionally approve one tightly authored extension after pet v1 is real, measured, and trusted.**

The dangerous pitch is "combine two pets." The game does not have two pet slots. It has one permanent-specialty slot whose arithmetic is already disputed by the base panel. If fusion copies both parents, the selected companion silently becomes two pets: two scaling bonuses, two capstones, two budget axes, and twice the stacking surface. Calling that creature one sprite does not make its power one slot wide.

The only defensible shape is:

- a fused companion still occupies the single pet slot and is snapshotted for the entire run;
- fusion is deterministic and non-consuming;
- launch fusion is a small catalog of fixed recipes, not all pairs;
- each fused definition contains exactly **one inherited scaling bonus and one inherited capstone**;
- both inherited clauses use the same strict `budgetKey` and pass the existing one-pet power envelope;
- both parents must already be level 10, and the fused companion adds no second combat-power leveling curve;
- deeper evolution is a fixed post-Ascendant visual form, not a mechanical branch tree;
- the exact result is shown before confirmation, with no random traits, outcomes, or hidden rolls.

Anything broader is not an evolution of pet v1. It is a second permanent build system wearing pet art.

## 1. Bonus arithmetic: fusion does not buy a second pet axis

### The failure case

A literal inheritance model grants:

```text
parent A scaling + parent A capstone
+ parent B scaling + parent B capstone
```

That immediately defeats the slot law. A fused pet could combine recovery with ammo endurance, collection reach with inventory capacity, or reload speed with a second resource effect while still leaving the character quirk, meta upgrades, augments, weapon set, affixes, and ultimate untouched. The base stacking audit is already strained by one pet. Full inheritance doubles the pet layer before the first real telemetry sample exists.

The broad systems label `sustain or economy` is not a sufficient compatibility rule. The base adversarial review correctly distinguishes strict keys such as `sustain.regen`, `sustain.revive`, `resource.ammo-efficiency`, and `economy.collection`. Two effects do not become comparable merely because both live somewhere under sustain.

### Single-envelope inheritance law

Every fused catalog definition must satisfy all of these conditions:

1. It has exactly one `scalingTraitId`, inherited from one named parent.
2. It has exactly one `capstoneTraitId`, inherited from the other named parent.
3. It never inherits the other scaling trait or the other capstone, even in reduced form.
4. `scalingTrait.budgetKey === capstoneTrait.budgetKey === fusion.budgetKey`.
5. The fixed recipe, not the player and not a random roll, determines which parent supplies which trait.
6. The inherited formula and capstone behavior are taken verbatim from their parent definitions. No averaging, summing, rerolling, or hidden fusion coefficient is allowed.
7. The resulting pair must pass the full base stacking matrix at its published values. If it fails, the recipe does not exist; the game must not quietly attenuate an advertised parent trait only when fused.

A fused pet therefore resolves to the same cardinality as a base pet:

```text
levels 1-10 shape: one scaling specialty
level-10 shape: that specialty plus one compatible capstone
```

Because both parents are level 10 before fusion, the fused companion enters play at the level-10 value. Parent levels are eligibility, not two live modifier sources. Runtime code resolves the fused catalog definition directly; it must never recursively merge both parents' `PetMods`.

The existing adversarial ceilings remain binding: no more than +8% sustained output, +15% in a rolling three-second burst, or +10% total survivability/recovery in any legal fixture; no extra projectiles, targets, zones, pickups, loot rolls, Scrip, XP, set counts, augment stacks, ultimate charge, or inventory slots merely because the pet is fused. The selected character's same `budgetKey` remains an illegal pairing.

This also exposes a prerequisite: the disputed v1 roster must be fixed before fusion families are assigned. Verdant Wing's regeneration plus ammo capstone is already cross-axis under the strict law; Copper Snail's capacity and Gilded Gecko's Scrip mint are already rejected by the base adversarial envelope. Fusion cannot use those contradictions as foundations.

## 2. Consumption is incompatible with the trust law

### Pick the non-consuming law

**Fusion never consumes, downgrades, resets, locks, or overwrites either parent.** Both parents remain owned, remain at their earned Bond XP, and remain selectable in later runs. The fused result is a new account-unique catalog unlock with provenance back to those two records.

Consuming a parent is indefensible here. A player may have spent 3,600 Bond XP and 8 successful full runs, or 11-14 mixed runs, to reach one disclosed set-in-stone capstone. Destroying that record to reveal or create another pet collides directly with the trust law. Even an explicit confirmation does not repair the design: it merely documents that the game is asking the player to burn a promise it previously called permanent.

Non-consumption does create another collection record, but that inflation is bounded by the recipe law below. There are no duplicate base pets, duplicate fusions, fodder copies, fusion levels, dismantling, trading, or recursive fusion. Four unique derived records are a finite collection extension, not an inventory economy.

Nothing needs to be destroyed for fusion to feel earned. The requirements to own and max both parents are the acquisition cost. Equipping the fused result still sacrifices every other pet choice for that run. Artificial deletion is not meaningful commitment; it is sunk-cost leverage.

Do not add a Scrip fee, fusion dust, catalyst drop, duplicate egg, failure insurance, or salvage loop to manufacture sacrifice. Those create new farm incentives and turn the Companions page into an economy screen.

## 3. Grind doubling and farm distortion

The base curve costs 3,600 Bond XP per pet. Two maxed parents therefore represent 7,200 earned XP: about 16 successful full runs and 3.2-4.0 active hours for a dedicated player, or roughly 22-28 mixed-outcome runs and 6-9 hours for the base panel's casual pacing. That is already a substantial fusion gate.

Giving the fused pet another 3,600-XP combat track would add eight more full runs after the player has proved mastery twice. Consuming the parents and requiring their reacquisition would be worse, and is impossible under the base account-unique species law without inventing duplicate pets. A fusion-specific currency would distort play toward its best faucet; Scrip feeding would make Gilded Gecko or sale farming recursively optimal.

The hard pacing rule is:

> Max both parents once; unlock the fused companion at full combat strength; never reset or repeat combat-power progression.

Fusion itself is the deeper evolution moment. It unlocks a fixed post-Ascendant **Confluence** form and its already-previewed one-scaling/one-capstone definition. There is no level 11-20 ladder, fusion prestige, overflow conversion, or second power meter.

If a later proposal wants continued bonding after fusion, those rewards may be cosmetic only: portraits, chirp variants, paper-cutout flourishes, or lore. They must use the same terminal run receipts, must not create a more efficient shallow-reset route, and must never gate the fused pet's published mechanics. That cosmetic proposal should be paced from v1 telemetry, not guessed before v1 exists.

## 4. Twenty-eight pairs are not twenty-eight harmless skins

Eight launch pets create `8 choose 2 = 28` unordered pairs. Every pair is a new interaction between a scaling formula, a capstone, character quirks, meta stats, augments, weapons, affixes, sets, down/revive rules, and resource ledgers. If trait orientation is selectable, each pair can create two mechanical outputs, raising the surface to 56 before visual branches.

Same-dimension-only is not a workable safety rule for the current roster: Verdant Ruins has three pets, Wild West has two, and Ashlands, Frostfell, and Neon-Cyber have singletons. It would produce uneven access while saying nothing about bonus compatibility.

### Fixed fusion families

At launch, partition eligible pets into at most **four authored two-pet families**:

- each base pet has zero or one `fusionFamilyId`;
- each family has one unordered parent pair and exactly one fused output;
- both parents must share a strict `budgetKey` and a declared `capstoneCompatibilityClass`;
- the output's trait orientation is fixed in the catalog;
- recipes are explicitly whitelisted; no generic "any two pets" resolver exists;
- a fused companion cannot be fused again.

This changes the balance and asset surface from 28-56 generated combinations to no more than four reviewed definitions. If the corrected v1 roster cannot form four legal families, ship fewer. Equal recipe count is not worth violating the power law.

Future pets may add one authored recipe at a time. They do not automatically combine with the historical catalog. The UI must say that compatibility is authored, not imply that every missing pair is an undiscovered recipe.

## 5. Deeper evolution: do not turn stage 2 into a regret screen

The base visual contract is deliberately linear: Hatchling at levels 1-3, Awakened at 4-7, Ascendant at 8-10, with a level-10 core light rather than a fourth silhouette. A mechanical branch choice at stage 2 would break several promises at once:

- players would choose before seeing the full base companion in play;
- one branch would become the optimization answer after balance or meta changes;
- the unchosen art and capstone would create FOMO;
- a no-respec rule would convert hours of Bond XP into regret;
- a paid or grind-based respec would monetize that regret;
- every branch would multiply art, UI, save, test, and balance surfaces.

Keep all base pets on the existing three-stage line. Fusion occurs only after both parents are Ascendant and creates one authored Confluence form for the derived companion. It is a fourth visual grammar tier, not a fourth live modifier clause. It must preserve the paper-cutout readability limits, remain cosmetic in its world position, and use a fixed authored silhouette rather than procedurally blending parent sprites.

There are no mechanical evolution branches in this proposal. If cosmetic branches are later approved, all variants unlock together and can be switched freely outside a run; their mechanics and collision/readability contract are identical. If the panel nevertheless mandates mechanical branches, the minimum trust rule is a free, unlimited out-of-run respec before ready-up, full final-form and final-number previews, and no XP loss, currency cost, cooldown, or seasonal lock. Mid-run changes remain forbidden. Anything harsher is a reroll system disguised as evolution.

## 6. The preview is the contract: no gacha, no surprise inheritance

Fusion must be deterministic. Reject every form of randomness:

- no success or failure chance;
- no random inherited parent;
- no random scaling range, capstone, nature, colorway, mutation, rarity, or slot;
- no hidden recessive trait;
- no reroll, pity, insurance, stabilizer, or duplicate-fodder loop.

Before confirmation, one preview must show exactly:

- fused companion name, catalog id, recipe version, Confluence portrait, and world silhouette;
- the parent supplying the scaling trait and its exact level-10 formula/value;
- the parent supplying the capstone and its exact behavior;
- the two parent traits that are **not** inherited;
- the shared `budgetKey`, compatibility class, and any illegal character pairing;
- confirmation that both parents remain owned and unchanged;
- confirmation that the result occupies the one pet slot and gains no hidden second effect;
- the live trust/patch policy that applies to the new definition.

The authoritative preview and unlock transaction must use the same catalog definition and account revision. Confirmation names the previewed recipe/version; if either changed, the server rejects the request and requires a fresh preview. It never substitutes a new result after the click. The unlock is idempotent, so retries cannot debit, duplicate, or mutate records.

Even without consumption, this precision matters. The player has already invested in two parents and may choose future pet investments based on the promised recipe. A silhouette teaser with concealed mechanics is still gacha-shaped UX when the sunk cost occurs before the reveal.

## 7. Scope creep: v2 cannot be allowed to force a v1 save rewrite

This is a proposal for a sequel layer on an unimplemented system. Pet v1 should not build fusion features now, but three v1 contracts must be shaped so a later fixed-recipe extension is additive rather than a migration crisis.

### Account schema shape

Do not make the durable key space synonymous with the eight base `PetId` values. Use a stable companion identity namespace that can hold base and derived definitions:

```ts
type CompanionId = string; // catalog-controlled: "pet:..." or "fusion:..."

type PersistedCompanion =
  | {
      kind: "base";
      definitionId: CompanionId;
      bondXp: number;
    }
  | {
      kind: "fusion";
      definitionId: CompanionId;
      recipeId: string;
      parentIds: readonly [CompanionId, CompanionId];
      unlockedAtRevision: number;
    };

interface MetaAccount {
  version: number;
  revision: number;
  companions: Partial<Record<CompanionId, PersistedCompanion>>;
  selectedCompanionId: CompanionId | "";
}
```

The exact syntax can change, but the invariants cannot: stable account-owned record identity, discriminated base/derived provenance, one selected companion reference, no copied combat coefficients, and versioned idempotent transactions. A fused record refers to parents for provenance only; deleting or balance-patching a parent definition must not recursively rewrite a live run.

Production ownership and progression still require the authenticated, revisioned account authority demanded by pet v1. A browser-owned blob is not made safe by adding parent ids.

### Pet identity model

Separate these concepts now:

- `definitionId`: the catalog-owned gameplay identity snapshotted for a run;
- `speciesId` or visual ancestry: the art/lore identity;
- account record: ownership, Bond XP, and fusion provenance;
- `formId`: Hatchling, Awakened, Ascendant, or a later Confluence form.

Do not assume `petId + levelBand 1..3` is the permanent public visual key. Either reserve a general `formId` or make the descriptor extensible without reinterpreting old values. A fused companion is one catalog definition, not two parents simultaneously equipped and not a runtime-generated species hash.

### Bonus-hook generality

Pet v1 should land on the source-neutral modifier/effect contract already recommended by the technical panel. Each trait needs a stable id, `budgetKey`, trigger family, authoritative hook descriptor, value function, and source attribution. The resolver must enforce one scaling trait plus zero-or-one active capstone and return one bounded companion contribution.

Do not branch on species ids inside `GameRoom`, copy coefficients into account saves, or expose a generic `mergeMods(parentA, parentB)` function. Fusion should add catalog definitions and compatibility validation, not a second effect interpreter. Run start snapshots one `definitionId`, definition version, resolved values, and counters exactly as v1 does.

### Unanswered v1 decisions remain gates

Fusion cannot be frozen until the base panel settles its three open product decisions:

- what "set in stone" protects: immutable effect identity with bounded tuning and compensation, or immutable numbers too;
- whether v1 remains server-owned passive mechanics plus a client-cosmetic follower, or pays for authoritative pet-position gameplay;
- whether progression is one account-wide record per pet, only the selected pet earns Bond XP, the target pacing is accepted, and selection remains locked for the run.

The technical panel's account authority, reconnect settlement, exact award eligibility, and disputed roster effects also remain P0 dependencies. Designing fusion around an unchosen answer guarantees migration or betrayal later.

## Hard guardrails

- [ ] Pet v1 ships, is telemetry-validated, and resolves its roster/budget disputes before fusion balance is frozen.
- [ ] A fused companion occupies exactly one pet slot and cannot change after ready-up.
- [ ] Fusion never consumes, downgrades, resets, locks, or overwrites a parent.
- [ ] Both parents must be owned and level 10; neither duplicate pets nor fodder copies exist.
- [ ] At most four fixed fusion families launch; no all-pairs or recursive fusion.
- [ ] Each fused definition has exactly one inherited scaling trait and one inherited capstone, never two of either.
- [ ] Both traits share one strict `budgetKey` and compatibility class and pass the full one-pet stacking envelope.
- [ ] Parent modifier objects are never merged recursively at runtime.
- [ ] The fused companion unlocks at full combat strength; there is no second power curve, prestige, level reset, or overflow conversion.
- [ ] Deeper evolution adds one fixed Confluence visual form, not a mechanical stage-2 branch.
- [ ] Any cosmetic branch is mechanically identical and freely swappable outside a run.
- [ ] Fusion is deterministic: no random outcomes, stats, inheritance, failure, rerolls, pity, or hidden traits.
- [ ] The exact art, inherited clauses, omitted clauses, parents-retained rule, and final numbers are previewed before confirmation.
- [ ] Preview and unlock use the same authoritative catalog version and account revision; retries are idempotent.
- [ ] No fusion currency, Scrip fee, catalyst farm, duplicate egg, trading, dismantling, or salvage economy is introduced.
- [ ] Stable companion ids, derived provenance, extensible form ids, and source-neutral bonus hooks are v1 design requirements.
- [ ] Fused follower position remains cosmetic and contributes no attack, collection, collision, aura, or 20 Hz pet entity.
- [ ] Balance patches obey the base identity/tuning/compensation trust law for fused definitions too.

## Three questions for the user

1. Do you approve **non-consuming, fixed-family fusion**: both maxed parents remain permanently owned, launch has at most four authored pair recipes, and there is no all-pairs, fodder, Scrip, catalyst, or recursive-fusion economy?
2. Do you approve the **single-envelope inheritance law**: every fused companion gets exactly one predetermined parent scaling trait plus one predetermined compatible parent capstone, shares one strict `budgetKey`, occupies the existing one-pet slot, and gains no additional combat-power leveling track?
3. Do you approve **linear deeper evolution**: the base Hatchling/Awakened/Ascendant path stays unchanged, fusion unlocks one deterministic Confluence form only after both parents reach level 10, and any future visual branches are cosmetic and freely swappable rather than irreversible mechanical choices?
