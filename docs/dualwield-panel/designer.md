# DUAL WIELD — Systems Designer Panel Doc

**Author:** Systems Designer (loot/buildcraft economy — Diablo/Brotato/Hades pedigree)
**Directive:** "a dual wield system for one handed weapons of the same class."
**Scope:** design only — no source modified. Numbers are tuning proposals against verified code.
**Sibling note:** `devils-advocate.md` did not exist at write time; §7 pre-engages the objections that
doc will predictably raise. Where it lands differently, that section is the argument to answer.

---

## 0. Ground truth (verified in code before designing)

| Fact | Where |
|---|---|
| Arsenal = 3 slots (`ARSENAL_SLOTS`) + 12-entry bag (`BAG_CAP`); swap 1/2/3, cycle Q/E, bagStore/bagEquip/sellWeapon messages | `packages/shared/src/constants.ts:349`, `packages/server/src/rooms/GameRoom.ts:895–991` |
| An `ArsenalSlot` carries `{weapon, rarity, affix, earned}` + server-private cooldown/reload/charge debt that survives stowing | `packages/shared/src/state.ts:8–21` |
| Set bonus: `classCount` over the 3 slot ids → +8% at 2-of-class, +18% at 3 (`SET_BONUS_2/3`) | `packages/shared/src/weapons.ts:338–360` |
| Loot identity: 7 rarities (dmg ×1.0→×1.65), exactly ONE affix (dmg × cd mults), `earned` provenance; scrip = `[4,9,18,34,60]` by rarity, earned-only (anti-launder) | `packages/shared/src/loot.ts`, `constants.ts:361` |
| Per-source damage law already exists (`sourceDamageMult`, multi-line card via `weaponDamageSources`) — two hands with different grades is *already expressible* | `weapons.ts:394–530` |
| Beam overheat law: heat, ignition, lock — one channel is the entire economy | `weapons.ts:19–41` |
| Authored duals exist: `dual: true` + `grip: "dual"` render a part in EACH hand (twin-bowie-fangs; 22 in expansion). Dual fist-blade already routes to the dagger combo variant | `weapons.ts:740–765`, `melee.ts:1206–1213` |
| Augment gate derives from the HELD weapon's classPool/delivery | `packages/shared/src/augments.ts:288–300` |
| Drop pool is power-band curated per single weapon (`effectivePower`, 0.6–2.2× class median) | `loot.ts:203–300` |

### The real pairing pool (enumerated, not assumed)

**Active roster (`WEAPON_IDS`, what ships today):**

| classPool | genuinely 1H | ids |
|---|---|---|
| melee | 3 (2 pairable — see thrown exclusion §1) | rusty-cleaver (1H **thrown**), rattler-sabre (sword), Voltedge (sword) |
| ranged | 3 | Revolver Cannon (pistol), Nailgun, Ricochet Pistol (pistol) |
| caster | **0** | both staves are 2H |

**Expansion (295 weapons, curated in via the power band):**

| classPool | 1H | authored dual | biggest 1H families |
|---|---|---|---|
| melee | 36 | 10 | exotic-melee 11, saber 4, rapier 3, axe 3, flail 3 |
| ranged | 30 | 6 | pistol 11, exotic-ranged 8, hand-cannon 4, machine-pistol 4 |
| caster | **57** | 6 | gauntlet 15, orb 8, relic/totem 7, wand 6, focus 6, scepter 5 |

Two conclusions fall straight out of the census:

1. **Same-FAMILY pairing is dead on arrival.** In the active roster it permits exactly two pairs
   (sabre+Voltedge, revolver+ricochet-pistol); even in the expansion most families have 1–4 members.
   A pairing rule the player can hit maybe once a run is not a system, it's an easter egg.
2. **Caster is the sleeping giant.** Zero 1H casters ship today, but 1H/caster is the *largest*
   pool in the expansion (57 — wands, orbs, gauntlets). Design dual-cast now or retrofit it later
   under pressure.

---

## 1. PAIRING RULES

### What can pair

**Rule: same `classPool` + both `grip: "1H"` + a live compatible delivery.** Family is NOT required.

- **melee:** both `melee-arc`. 1H **thrown** (rusty-cleaver) is EXCLUDED v1 — thrown already runs a
  charge/refill economy; merging two charge pools is real complexity for a fantasy the authored dual
  thrown weapons (Coyote's Grin) already serve.
- **ranged:** both have a `gun` block (`projectile`/`spread` 1H). All shipping 1H guns qualify.
- **caster:** both have a `cast` block. **`beam` delivery is categorically unpairable** — two
  channels is double heat throughput, which the overheat law exists to forbid. (Today all beams are
  2H anyway; this rule keeps it true forever.)
- **Authored `grip: "dual"` weapons can never pair.** They are already a pair sold as one item.
  No dual-of-duals, ever.
- Cross-family is legal and encouraged (sabre + Voltedge; revolver + nailgun; wand + orb).
  **Matched-family kicker** (§3): identical `family` on both hands softens the off-hand penalty —
  the chase without the gate.

**Why classPool and not family:** the directive says "same class," the code's class concept IS
`classPool` (it's what set bonuses, augment gates, and drop curation all read), and the census above
shows family-pairing starves the player. classPool keeps one law aligned with every existing system.

### How pairing happens

**An explicit BIND service at the shopkeeper.** Not automatic, not a bag-UI drag.

- **Not automatic:** auto-pairing two eligibles on equip silently consumes a weapon the player meant
  to sell or swap — in a game where `earned` provenance and per-item affixes carry real scrip value,
  eating an item without a deliberate action is an economy bug wearing a convenience costume.
- **Not free-form in the bag UI:** the bag is a hauling container; its existing verbs (store, equip,
  sell) all move items, none transform them. Transformation belongs at the vendor, where the player
  already goes to convert weapons into value. This also makes the bag matter MORE: you now haul a
  second pistol to the shop *on purpose*.
- **At the shop:** stand in `SHOP_RADIUS`, pick two eligible weapons from any mix of slots/bag, pay
  the bind fee (§5), receive ONE paired item in the primary weapon's slot. The player designates
  which weapon is the **primary hand** at bind time (defaults to the higher-rarity half).

### Unpairing

- **Free, at the shopkeeper only.** Splits back into the two original halves — rarity, affix,
  `earned` flag, durability all preserved exactly. The bind fee is NOT refunded (it's a sink, §5).
- Requires a free slot-or-bag space for the second half; otherwise the unbind is refused (no floor-
  spill dupes).
- Dropping a pair in the field drops ONE pickup that is the pair (grab it back whole). Selling a
  pair is legal without unbinding (§5).
- **Nothing about bind/unbind ever rerolls rarity or affix.** This is the anti-launder law: the
  vendor transforms *configuration*, never *identity*.

---

## 2. SLOT ECONOMY — one slot, and the laws that make that fair

**A pair occupies ONE arsenal slot (and one bag entry when stowed).** This is my defended answer.

The two-slot alternative ("the pair fills two slots, you get the power without compression") sounds
conservative but is actually worse: it deletes the entire reason to dual-wield. With 3 slots, a
two-slot pair means dual-wielders play a 2-loadout game in a 3-loadout system — you've taxed the
player's *variety*, which in a per-weapon-cooldown-debt game (stowed cooldowns stay authoritative —
`state.ts:14–20`) is the real currency. One slot is the payoff; the fairness comes from what the
pair COSTS and what it's FORBIDDEN from double-dipping:

1. **Set-bonus law (the no-double-dip):** a pair counts as **ONE** weapon of its class toward
   `classCount`. Never two. If it counted double, pair + any same-class single = instant +18% in two
   slots, and pair+pair+pair becomes the only rational endgame arsenal. Counting one preserves the
   set bonus as a *breadth* incentive while dual-wield is a *depth* incentive — orthogonal axes, the
   Brotato lesson.
2. **Price law:** a pair consumed two real drops plus a scrip fee (§5). Its throughput ceiling
   (~1.37×, §3) is deliberately BELOW two separate weapons' paper sum (1.7× naive) and only modestly
   above the +18% a third same-class single would grant the whole class.
3. **Affix law (anti-speed-stack):** the pair's cadence reads the **primary hand's** cooldown affix
   only. Two Swift (×0.82 cd) halves do NOT compound to ×0.67 — the off-hand's cd affix is dormant
   while bound (its *damage* affix stays live on its own hits). Primary-hand dominance on speed,
   per-hand honesty on damage.
4. **Requirement law:** the pair's §11 requirements are the **union** (per-attribute max) of both
   halves; `requirementPenalty` applies to every hit of both hands. Strapping a dex-12 Voltedge to
   your belt-knife does not launder its requirement.
5. **Debt law:** the pair keeps ONE shared swing/fire ledger (it is one item in one slot); ammo is
   the exception (§3 guns). Swapping to a pair obeys the same `WEAPON_DRAW_LOCK_SECONDS` gate —
   dual-wield never becomes a swap-macro exploit.

Data-shape note for the tech seats: `ArsenalSlot` grows an off-hand mirror
(`offWeapon/offRarity/offAffix/offEarned` + a second private ammo ledger). Everything else reuses
the shipped `dual: true` render path and the per-source damage law.

## 3. THE POWER MODEL

One law, three skins: **alternation**. The pair acts on a shared cadence of
**`DUAL_CADENCE = 0.62 ×` the primary hand's effective cooldown**, hands strictly alternating;
**off-hand hits deal ×0.70** (`DUAL_OFFHAND_MULT`), raised to **×0.80 for a matched-family pair**.

Throughput check (equal halves): `((1.0 + 0.7)/2) / 0.62 ≈ 1.37×` one weapon's DPS — matched pair
≈ 1.45×. Calibration: it must beat SET_BONUS_3 (+18%) or the passive bonus dominates the active
system; it must stay under ~1.5× or dual becomes mandatory. 1.37 sits in the pocket, and it cost two
drops + scrip + a dormant cd affix + union requirements.

**Every hit is WYSIWYG per-hand:** each hand's hit uses its OWN base damage, its OWN
`scalingGrades` (the engine's `sourceDamageMult` already does exactly this), its OWN rarity dmg
mult, and its OWN damage affix. **No blending, no averaging** — this is the anti-farm choice.
Averaging invites farm-the-blend games (bind a cursed Blessed half to smear ×1.6 onto a common) and
makes the card a lie. Per-hand honesty means the card simply shows two lines, which
`weaponDamageSources` was built for.

### Per classPool

**MELEE — the alternating flurry.** Swings alternate hands on `DUAL_CADENCE`; each swing uses that
hand's own `range`/`halfArc`/procs (an off-hand Voltedge still seeds its chain lightning, at ×0.70).
The renderer reuses the `dual` two-hand rig. **Combo law:** the pair runs the **primary hand's**
combo family/variant (`resolveMeleeCombo` on the primary def); a matched pair of `fist-blade`/dagger-
shaped weapons upgrades to the dagger rake variant exactly as twin-bowie-fangs does today. Off-hand
swings advance the same combo clock — one combo, two blades, no second state machine.

**GUNS — interleaved fire, separate magazines.** Alternating shots down the shared aim on
`DUAL_CADENCE` (primary's fireRate × 0.62), each bullet with its hand's own damage/pierce/bounces/
bulletKind. **Ammo pools stay SEPARATE** — each hand keeps its own magazine + reload, and here is
the gun-pool's signature payoff: **when one hand reloads, the other keeps firing at its solo
cadence.** Reload-downtime smoothing is the akimbo fantasy AND an honest, bounded power source
(it's already priced into `effectivePower`'s reload-folded cadence — the curator sees it, §5).
Recoil: sum of both hands × 0.85 so akimbo hand-cannons feel like a drumroll, not a screenshake DoS.

**CASTERS — alternating pulses (dual channels are banned).** The advocate is right that dual
channels die to the overheat law — so beams don't pair, period. For `cast`-block casters the law is
the same alternation: bolts alternate hands on `DUAL_CADENCE` of the primary's `cast.cooldown`,
off-hand bolts ×0.70 with their own pierce/bulletKind/INT grades. Wand (fast, thin) + orb (slow,
fat) becomes a woven two-texture stream — the best *feel* argument for cross-family pairing, and it
future-proofs the 57-strong 1H caster expansion pool before it's curated in.

**Cross-system laws:** the pair counts **1** toward set bonuses (§2). The augment gate reads the
**primary hand** (same classPool means the lane rarely differs; a melee pair gates `parry` like any
melee). Ultimate/flex attunement (docs/ultimate-panel) is untouched — dual-wield reads zero flex
state and grants none; systems stay orthogonal.

---

## 4. ACQUISITION ARC

**Available from the first shopkeeper, no level gate, no augment gate.** Two rejected alternatives:

- *Free-anywhere from level 1:* transformation without a vendor breaks the anti-launder posture
  (§1) and skips the ceremony. Also floods minute-one decision space.
- *Behind an augment draft:* drafts are RNG (`rollAugmentDraft`) and gate-laned per weapon delivery.
  Locking a core arsenal verb behind a dice roll the player might never see is the worst of both —
  and it would burn a signature pick that currently buys parry/gun/cast identity.

The shop is the right gate because the *run itself* paces it: you need (a) two eligible 1H drops of
one class, (b) the walk to `beltShopX`, (c) the fee. Realistically that's minutes 3–6 of a run —
after the player has a build opinion, before the midgame plateau. The bind is a **greed decision at
the vendor**: those same two weapons are also sellable scrip, and the fee is priced in scrip — every
bind visibly competes with the §31 meta-upgrade sink.

**The ceremony of first pairing:** at the counter, both weapons slide across, cross into an X, one
hard spark on the beat (paper-cutout flash per the art bible), and return as a single card — both
sprites crossed, two damage lines, the primary hand's name first ("Voltedge & Rattler Sabre").
First bind of each RUN gets the full beat; later binds get the short version. The pair card is the
teach: two lines, one cadence stat, the ×0.70 off-hand tag explicit. WYSIWYG or it didn't happen.

---

## 5. ECONOMY

- **Bind fee:** `scripValue` of the **better half** at its rarity — 4/9/18/34/60 scrip. Reads as
  "the smith charges what the finer weapon is worth," scales with greed, and becomes the game's
  first *recurring* scrip sink besides meta buys. Unbind free (fee not refunded).
- **Sell value of a pair:** the **sum of the two halves' `scripValue`**, each under its own `earned`
  flag — an unearned (conjured/gallery) half contributes 0 forever, even inside a pair. Binding is
  never a laundering step: fee in, zero value out. Selling a pair at the counter needs no unbind.
- **Salvage:** hold-to-salvage a pair banks both halves' `salvageValue` (earned halves only), same
  law.
- **Drop-curator awareness:** pairs NEVER drop — drops are single weapons; pairs are player-made.
  `effectivePower`/`isDropEligible` continue to evaluate singles only, and the 0.6–2.2× band needs
  no change: the dual multiplier is a flat, class-uniform ×~1.37 on top of any two in-band singles,
  so it cannot smuggle an out-of-band outlier into play that two in-band weapons wouldn't already
  imply. What the curator SHOULD watch when expansion waves land: 1H drop *frequency* per class —
  today's active pool gives ranged three eligible 1H but caster zero, so dual-caster is dead until
  the first 1H caster wave is curated in. Recommend the first caster wave leads with wand/orb/
  gauntlet 1Hs specifically to open the lane.
- **Rarity/affix interaction recap (anti-farm):** identities never merge, never reroll, never
  average; primary hand alone drives cadence affix; per-hand damage identity stays live. The only
  new numbers in the whole system are `0.62`, `0.70`, `0.80`, and the fee table it already ships.

---

## 6. Tuning constants (single table for the tech seats)

| Constant | Value | Meaning |
|---|---|---|
| `DUAL_CADENCE_MULT` | 0.62 | pair acts at primary's effective cooldown × this |
| `DUAL_OFFHAND_MULT` | 0.70 | off-hand hit damage multiplier |
| `DUAL_MATCHED_OFFHAND_MULT` | 0.80 | off-hand mult when both halves share `tags.family` |
| `DUAL_RECOIL_MULT` | 0.85 | applied to the sum of both guns' recoil |
| Bind fee | `SCRIP_BY_RARITY[max(rarityA, rarityB)]` | 4/9/18/34/60 |
| Set-bonus count | 1 | a pair contributes one toward `classCount` |
| Pair slot cost | 1 slot / 1 bag entry | the compression IS the reward |

---

## 7. Engaging the advocate (pre-emptively — their doc wasn't written yet)

1. **"Dual is a strictly dominant stat stick — +37% for one slot."** It costs two drops (one of
   which was sellable scrip), a fee, a dormant off-hand cd affix, union requirements, and a set-
   bonus count of one. A third same-class *single* gives the whole class +18% AND a second swap
   option AND full sell liquidity. Dual is the depth pick, not the default.
2. **"Caster dual violates the overheat law."** Agreed at the beam level — beams are unpairable by
   rule, not by tuning. Cast-block alternation adds zero heat surface.
3. **"Automatic pairing is friendlier."** Automatic pairing *consumes items* without consent in an
   economy with provenance and single-roll affixes. Friendliness that eats a Legendary is not
   friendliness.
4. **"One slot + counts-as-one still compresses the bag too."** Yes — a stowed pair is one bag
   entry. That's bounded (you can hold at most a few pairs), paid for, and it makes hauling
   *pairable* loot to the vendor a plan rather than a chore.
5. **"The alternation cadence will fight the melee combo system."** It rides it: one combo clock,
   primary-hand family, and the dual→dagger routing already shipped for twin-bowie-fangs. The
   renderer's two-hand rig exists; the server's per-source damage law exists. This is an assembly of
   shipped parts, not a new physics.

If the advocate's doc lands somewhere these answers don't cover, §2's laws (count-as-one, primary-
hand cadence, per-hand identity, union requirements) are the load-bearing walls — attack those, not
the 0.62.
