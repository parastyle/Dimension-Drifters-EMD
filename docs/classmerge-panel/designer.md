# CLASS MERGE — Systems Designer Panel Doc

**Author:** Systems Designer (Brotato/Hades build-craft pedigree)
**Directive (USER DECISION, confirmed):** dissolve the five character classes into one universal kit —
everyone parries AND dodge rolls; characters become base-stat spreads + one signature quirk each.
**Scope:** design only — no source modified. All numbers are tuning proposals against verified code.

---

## 0. Ground truth (verified in code before designing)

| Fact | Where |
|---|---|
| Five classes bias growth only: `classAttr`+`reqAttr` auto-grow +1 each per level; class is otherwise cosmetic-adjacent | `packages/shared/src/character-classes.ts` |
| Every character starts 1/1/1/1/1; class never sets base stats | `packages/shared/src/state.ts:57` (attrs default 1), `leveling.ts` |
| Level income = 3 pts: 2 auto (class) + 1 FLEX pick in a 5s invincible window; AFK flex auto-resolves to `classAttr` | `packages/server/src/rooms/progression.ts:36-61`, `GameRoom.ts:4334` |
| Signature draft every 5th level; gate SNAPSHOT at level-earn (G-09): `sigGateQueue` accumulates `augmentGateForWeapon(held)` so a last-frame swap can't rewrite the draft | `progression.ts:51-56`, `GameRoom.ts:4315-4320` |
| Gates are already weapon-derived, never character-derived: `parry / gun / cast / beam / cast+beam` from the held weapon's `classPool`+`delivery` | `augments.ts:288-315` |
| Class-gated augments shipped: Hollow-Points + Ricochet Rounds (`gun`), Overcharge + Arc Split (`cast`), Vented Coils + Steady Lens (`beam`, non-enumerable lane); 10 parry augments are universal | `augments.ts:37-188` |
| The "caster class mechanic" is ALREADY a weapon property: the `cast` block — RMB conjures a piercing INT-scaled arcane bolt on a flat cooldown, no ammo, no reload. Two shipped cast weapons (`x-staff-arcane-lance`, `x-staff-storm-rod`) + 57 1H casters in expansion | `weapons.ts:191-212, 1012-1084`, dualwield-panel census |
| Weapon-class set bonus reads the ARSENAL's `classPool` counts: +8% at 2, +18% at 3 | `weapons.ts:338-360` |
| Parry: 0.52s i-frames / 0.6s CD / 135px radius / 96px knockback; chain heal + riposte at 3; reflect ×2.2; it is explicitly THE only i-frame tool today | `constants.ts:608-681` |
| Space hop: 0.45s airtime / 0.7s CD, ~144px, **deliberately NO i-frames** ("MOVEMENT, NOT a dodge") | `constants.ts:373-391` |
| Enemy combo language: WHITE steps = parryable, RED steps = "dodge/jump-only sweeps, never glint"; parry-baits offer parry OR reposition as the two honest answers; juggle launchers (Sky Hook, Coffin Lid, Scissor Lift) launch the player | `docs/enemycombo-panel/designer.md`, `constants.ts:565-567` |
| Ultimate law reads FLEX picks only; attune at 5th flex (≈L6), temper at 10th (≈L11); tie-breaks fall through raw totals → classAttr → reqAttr → ATTRS order | `docs/ultimate-panel/designer.md §1` |
| Class labels surface in exactly three UI/logic sites beyond progression: HUD character line (`ArenaScene.ts:7808`), level-up receipt (`level-up-model.ts:380-397`), AFK auto-resolve (`GameRoom.ts:4334`) | grepped `classForCharacter` — 6 call sites total |

Design thesis: **the class system was a growth-bias wearing an identity costume.** Everything that
felt like class identity is actually carried elsewhere — weapons carry the caster mechanic, the
arsenal carries augment gates and set bonuses, the parry carries the melee fantasy. Dissolving the
class returns the only thing it truly owned — 2 of 3 level points — to the player, and moves
identity where Brotato proved it belongs: a starting spread + one rule the character breaks.

---

## 1. CHARACTER IDENTITY 2.0 — spreads + quirks

### 1.1 The spread law

- Every character starts with a **base spread summing to exactly 10** (was 5×1). Each attribute is
  **1–4**. Equal budget = no character is numerically better, only differently aimed.
- The spread is the character's *lean*, not their destiny: it's ~10% of a capped run's ~97 total
  points, but 100% of levels 1–3 — it decides which weapons you can wear off the rack
  (`requirements` + `requirementPenalty`) and it casts the **tie-break vote** in the amended
  ultimate law (§2.3) that the class used to cast.
- The Drifter is the flat control group: 2/2/2/2/2.
- Some spreads intentionally duplicate — the quirk, not the spread, is the fingerprint.

### 1.2 The quirk law (Brotato's lesson: bend a rule, not a number)

- Exactly **one quirk per character**. A quirk changes *what is possible*, never just a coefficient
  (where a number appears below it's the cost/half of a trade, or a proc magnitude on a new rule).
- **Orthogonality to the ultimate matrix (hard constraint):** no quirk reads or writes level-up
  choices, choice counts, the charge meter, charge rates, attunement, or variants. Audited below —
  zero quirks touch that system, so **no character locks, biases, or accelerates any ultimate.**
  (Spreads touch it only via the tie-break, which is the amended law's *intent* — §2.3.)
- Quirks also never touch: rarity of the *starting* loadout, scrip mint rates (economy launder
  guard), or other players' verbs (co-op grief guard). Squad-positive effects are allowed.
- Vocabulary reuse: quirks are built almost entirely from shipped primitives — parry chain
  (`PARRY_CHAIN_*`), Brand (`BRAND_*`), ignite/burn, taunt/decoy (rift-decoy precedent), bag/slot
  economy (`ARSENAL_SLOTS`/`BAG_CAP`), draw-lock, knockback, telegraphs. Cheap to build, already
  taught.

### 1.3 The roster (spread = STR/DEX/INT/CON/LUK)

| Character | Spread | Quirk | The rule it bends |
|---|---|---|---|
| The Drifter | 2/2/2/2/2 | **Unwritten** | His ballast point (§2.1) follows his chosen attribute instead of his lowest — the only character who allocates all 3 points by will alone |
| Asha the Ash-Walker | 2/2/2/3/1 | **Mend the Broken** | Her parry-chain heal also heals the nearest ally within 220px for the same amount |
| Bryda Houndcall | 3/3/1/2/1 | **The Pack Finds You** | XP motes and weapon drops within 220px crawl toward her (pickup magnetism as a rule, not a radius stat) |
| Deepfall Korr | 3/1/2/3/1 | **Mag-Boots** | Immune to knockback and pull effects — nothing moves him but his own legs |
| Hollowmaw | 2/1/4/2/1 | **Whispered Rites** | Enemies he Brands (any source) stay Branded 2× duration |
| Mirelurk Caine | 3/2/1/3/1 | **Bog Patience** | Standing still 1.5s cloaks him — enemies drop him as a target until he acts |
| Raijin Kō, the Storm Fist | 4/2/1/2/1 | **Thunder Behind** | His melee combo finishers arc a spark to the nearest enemy within 160px (6 dmg, INT-scaled C) |
| Thornroot | 2/1/2/4/1 | **Regrow** | Every hit he takes plants a thorn patch at his feet (6 dmg/s, 2s) — wounding him seeds his garden |
| Dame Veyra of the Thornwatch | 2/4/1/2/1 | **Insufferably Graceful** | A whiffed parry costs no cooldown — the 0.6s miss penalty is waived (hit-parry economics unchanged) |
| Kuro-Oni, the Demon Mask | 3/2/1/3/1 | **Temple Wall** | Parry knockback doubled (96→192px) and parried melee attackers are stunned 0.4s |
| Mei-Ling of the Jade Ribbon | 1/4/2/1/2 | **Ribbon Step** | She can act (fire/parry) during the last 40% of her dodge roll — the dance never stops |
| Sōjiro the Wayward Blade | 3/4/1/1/1 | **Iai** | First swing after a weapon draw or dodge roll is a guaranteed crit |
| The Hollow Mask | 1/4/1/1/3 | **Porcelain** | Once per dimension, a killing blow leaves her at 1 HP instead — the mask cracks, she doesn't |
| Yuki the Hollow Smile | 2/4/1/1/2 | **Fox Dance** | Dodge roll holds 2 charges (recharge unchanged) |
| Neon Mirage | 1/4/1/2/2 | **Package Deal** | Weapon swaps have no draw-lock (`WEAPON_DRAW_LOCK_SECONDS` waived) — the courier never fumbles the handoff |
| Crowmantle Sel | 1/3/1/1/4 | **A Better Owner** | Rolling through an enemy pickpockets 1 scrip (3s per-enemy cooldown) |
| Cinderpyre | 2/1/4/2/1 | **Molten Core** | Below 30% HP, all his weapon hits ignite (4 dmg/s burn, 2s) |
| Corvane the Crimson Draught | 1/1/4/3/1 | **The Crimson Draught** | May pay 3 HP to instantly reset a cast weapon's cooldown (RMB during cooldown; can't reduce him below 1 HP) |
| Doctor Phineas Quill, Esq. | 1/2/3/1/3 | **Snake Oil** | The shopkeeper shows him one extra offer per visit — the pitch always has a third bottle |
| Gravewake | 2/1/2/3/2 | **Already Dead** | Once per dimension, dying leaves him swinging at 1 HP for 3s before he actually drops — kills during the grace revoke the death |
| Iridia of the Nine Veils | 1/2/4/1/2 | **Sees Every Future** | Enemy telegraphs render 25% earlier for her (client display of `windup`; server timings untouched) |
| Mawkin Sourgrin the Hex-Witch | 1/1/4/2/2 | **Bottled Spite** | Enemies that damage her are automatically Branded (+15% damage taken, 3s) — grudges, preserved |
| Pyra Cinderhowl | 2/2/4/1/1 | **Let It Out** | Her ignite/burn effects jump to the nearest enemy within 120px when their host dies |
| Tinker-Magnus Brasswick | 1/2/4/2/1 | **Pressurized** | Beam weapons in her hands vent heat 25% faster and overheat lock is halved — she reads the gauges |
| Bastion Vance | 3/1/1/4/1 | **Planted** | After 0.5s stationary, 20% damage reduction until he moves |
| Brother Cassian | 3/1/1/4/1 | **Habit and Prayer** | His parry chain never times out (`PARRY_CHAIN_WINDOW` ∞) — only taking a hit resets it |
| Brother Tendo of the Still Bell | 3/2/1/3/1 | **One Perfect Strike** | After 2s without attacking, his next melee hit deals ×2 and staggers 0.5s |
| Cogwarden | 3/1/1/4/1 | **Does Not Stop** | Immune to slows and stuns; his dodge roll cooldown is +50% — a door, not a dancer |
| Sir Galloway the Unbending | 2/1/1/4/2 | **The Unbending** | No single hit deals more than 25% of his max HP |
| Sir Mordrane, the Hollow Oath | 3/1/2/3/1 | **Hollow Oath** | At ≤25% HP: +30% weapon damage, but regen stops — the curse pays and collects |
| Halcyon-7 | 1/3/2/2/2 | **Half Projection** | Her dodge roll leaves a hardlight after-image (40 HP, 1s) that enemies target instead of her |
| "Buzzard" Jeptha Hale | 3/2/1/2/2 | **Overstuffed Bandoliers** | Gun magazines +50% capacity — reloads are for people with fewer bullets |
| Cordell "Coldsnap" Vane | 1/3/1/2/3 | **Coldsnap** | His dodge roll reloads his held gun |
| Dunkel the Coinblade | 2/2/1/2/3 | **Hazard Rates** | Starts with a **4th arsenal slot — but no bag** (the prompt's canonical bend: more hands, no haul) |
| Elias "Parson" Thorne | 2/2/2/1/3 | **Graveside Manner** | Kills within 180px heal him 1 HP (cap 5 HP/s) — he digs, he prays, he profits |
| Magdalene "The Ledger" Crowe | 2/3/1/2/2 | **Posted** | Elites she has damaged are Posted: guaranteed weapon drop on death (rarity rolls normally) |
| "Quickfinger" Odette Lacroix | 1/2/1/2/4 | **The House** | Her loot rarity rolls draw twice and keep the better card |
| The Bandida "La Sombra" | 2/3/1/1/3 | **A Shape in the Dust** | Her dodge roll drops a smoke puff: enemies inside 90px lose aim for 0.8s |
| Grix Boltcaster | 3/1/1/3/2 | **Braced** | He can fire guns while dodge-rolling (i-frames end the instant he fires — pick one) |
| Sable Cipher | 1/4/2/1/2 | **ICE Breaker** | A successful parry jams ranged attackers within 135px — they can't fire for 2s |

**Orthogonality audit:** no quirk above reads picks, choice counts, meter, charge, attunement, or
variants. Quirks that touch the *dodge roll* (Yuki, Mei-Ling, Cordell, La Sombra, Halcyon-7, Grix,
Cogwarden, Crowmantle) bend the new universal verb — that's the merge working as intended: the verb
is universal, the *relationship* to the verb is character.

---

## 2. ALLOCATION 2.0 — the level-up flow with auto-allocation dead

### 2.1 The flow: one decision per level, worth all three points

Income stays **3 points per level** (no re-tuning of `xpToNextLevel`, `deriveStats`, or grade
coefficients — total attribute supply at cap is byte-identical to today). What changes is who aims
them:

- **PICK (+2):** the level-up window offers the full five-attribute choice every level. The chosen
  attribute gets **+2**.
- **BALLAST (+1):** the third point auto-flows to the player's **current lowest attribute**
  (ties → `ATTRS` declaration order). No decision, no UI beyond a receipt chip.

**The decision-rate verdict: exactly ONE decision per level — unchanged from today.** A bullet
heaven's pick window is a 5s sacred pause inside a bullet field; the shipped cadence of one choice
per level (~15 choices by first boss, 29 at cap) is already at the ceiling. Offering all 3 points
as 3 choices would triple dead time and produce decision fatigue where Brotato deliberately offers
one 4-card pick. Offering full freedom per point (+3 anywhere) breaks the power envelope: mono-dump
would reach 91 in one attribute vs today's class-aligned max of ~59. The +2/+1 ballast split keeps
one press per level AND pins the mono-stat ceiling at **62** (2×29 + base 4) — within 5% of
today's, so every weapon grade coefficient, requirement table, and enemy HP band survives the merge
untouched.

Why ballast-to-lowest (and not to the character's spread-top, which would resurrect auto-class):
it inherits the old `reqAttr`'s real job — keeping weapon `requirements` reachable and a CON floor
under glass cannons — without ever steering identity. Damage builds leak ballast into CON/LUK;
tanks leak it into damage stats; the Drifter's quirk opts out entirely.

AFK/window-expiry (amends `GameRoom.ts:4334`): the auto-resolved pick goes to the player's
**most-chosen attribute so far** (first window: the character's highest base-spread attribute).
Ballast applies as normal. The auto-resolved pick counts as a choice for the ultimate law — same
posture as the shipped AFK rule.

Level-up receipt copy (amends `level-up-model.ts:397`): `AUTO-GROWTH APPLIED: +1 STR • +1 CON`
becomes `+2 DEX (you) • +1 CON (ballast)`.

### 2.2 What dies

`levelUpPlayer`'s two `allocate(player, cls.classAttr/reqAttr, 1)` calls (`progression.ts:45-47`),
`M0_CLASS_ATTR`/`M0_REQ_ATTR` (`leveling.ts:40-41`), and the entire `CHAR_CLASSES` table.
`flexPending` semantics survive unchanged (1 pending pick per level).

### 2.3 THE AMENDMENT — re-basing the ultimate panel's unlock law

The shipped law (`docs/ultimate-panel/designer.md §1`) counts *flex picks only* because auto points
were class-determined noise. With auto-allocation gone, every point of steering is a player
statement. Exact amendment text:

> **§1.1 (amended — What counts):** The law reads the **CHOSEN attribute of each level-up pick**
> (the +2). Ballast points and base spreads never generate counts — ballast is plumbing, not a
> vote, and spreads are the character's voice, which belongs in the tie-break, not the tally.
> One level = one vote, exactly as before.
>
> **§1.3 (amended — Timing):** ATTUNEMENT on the **5th pick** = **level 6**. DRIFT window = picks
> 6–9. TEMPER on the **10th pick** = **level 11**. *No renormalization is required*: the old law
> generated exactly one flex vote per level and the new law generates exactly one pick vote per
> level — the calendar (attune ≈ L6, temper ≈ L11, 3–6 rehearsal casts before the L13–15 first
> boss) is preserved to the level.
>
> **§1.4 (amended — Tie-breaks):** (1) higher pick count; (2) higher raw attribute total —
> base spread and ballast included, so **the character's spread casts the tie-break vote the class
> used to** (a mono-INT Pyra attunes INT-family on a split ballot; her 4-INT spread also tends to
> pick her *variant* when the player never splits picks — character fantasy expressing through the
> variant lane is the merge's gift, not a bug); (3) the character's highest base-spread attribute,
> then second-highest [replaces the dead classAttr/reqAttr rungs]; (4) `ATTRS` order.
>
> **AFK rule (amended):** an auto-resolved pick (§2.1) counts as a pick for the law.

Degenerate-case check: a mono-pick player's secondary falls to rule 2 → the spread's top remaining
attribute — every matrix cell stays reachable, every state resolves to one cell, replay-stable, no
RNG. The tracking cost is unchanged (the same `Record<Attr, uint8>`, incremented in the same
`chooseAttribute` handler).

---

## 3. AUGMENT GATES 2.0 — the arsenal is the class now

### 3.1 The generalized law

The beam fix (G-09) established the pattern: **snapshot the earned lane at level-earn time** so a
last-frame swap can't rewrite a draft. Generalize it from "the held weapon" to **the arsenal**:

> **Gate law:** when a signature level is earned, snapshot the **union of augment deliveries
> across ALL equipped arsenal slots** (bag excluded — stowed intent isn't wielded identity). The
> draft pool = the 10 universal parry augments + every weapon-lane augment whose delivery is in the
> snapshot. Gates read the ARSENAL. Gates **never** read the character. (They already don't —
> `augmentGateForWeapon` takes only a `WeaponDef`; this section makes that an invariant with a
> test, not an accident of history.)

Mechanically: `sigGateQueue` entries become delivery-CSVs (`"gun+cast"`, `"parry"` when the arsenal
is all-melee/thrown) — the shipped `cast+beam` compound gate is the precedent, and
`augmentDeliveriesForGate` already returns a delivery *list*, so the decode path is built.
`augmentGateForWeapon(held)` is replaced by `augmentGateForArsenal(slots)` = union of the per-slot
results, dropping `parry` from the union only when a weapon lane exists (parry augments are always
eligible regardless — see table). Proc rules are untouched: a gun augment still only fires on gun
shots. Dual-wield interaction: the dualwield doc's "gate reads the primary hand" rule is subsumed —
a pair contributes its (single, shared) classPool's delivery to the union like any slot.

Why arsenal, not held: with classes gone the arsenal IS the build (set bonuses already read it).
Held-weapon gating made drafts a timing lottery — earn the level while your melee is out and your
gun lane vanishes. Arsenal-snapshot means a drafted gun augment is never a dead pick: you *own* the
gun; swap to it and it procs. And it stays snapshot-honest: what you were carrying when you earned
it is what you draft from.

### 3.2 The shipped class-gated augments, re-gated

| Augment | Old gate (held weapon) | New gate (arsenal snapshot) | Proc condition (unchanged) |
|---|---|---|---|
| Hollow-Points | held `gun` | any equipped slot is `gun`-delivery | your bullets |
| Ricochet Rounds | held `gun` | any equipped slot is `gun`-delivery | your bullets |
| Overcharge | held `cast` | any equipped slot is `cast`-delivery | your arcane bolts |
| Arc Split | held `cast` | any equipped slot is `cast`-delivery | your casts |
| Vented Coils | held `beam` | any equipped slot is `beam`-delivery | your beam heat |
| Steady Lens | held `beam` | any equipped slot is `beam`-delivery | your beam aim |
| The 10 parry augments | universal | universal — and now *literally* universal: every character parries, so the melee-signature framing in the §8 header dies; parry is the shared signature lane | your parries |

Draft-texture guard: a 3-slot mixed arsenal can open all four lanes (10 parry + up to 6 lane cards
in one pool), diluting lane cards to ~2-in-16 odds. Recommendation: the 3-card draft **guarantees at
least one open-lane weapon card when any lane is open** (draft rule, not pool weight — deterministic
and testable). This keeps the "gunslinger draft" fantasy findable without starving parry augments.

---

## 4. CASTER MECHANIC 2.0 — it already lives in the weapon; let the class die

The audit finding: the caster class's *mechanic* was never on the character. The `cast` block
(`weapons.ts:191-212`) carries the whole identity — flat-cooldown conjured bolt, no magazine, no
reload, pierce-the-line, per-source INT `scalingGrades`. The class contributed exactly two things:
auto-grown INT (dies with all auto-allocation, §2) and a HUD blurb (dies in §6).

**Which weapons carry it:** everything with a `cast` block — today `x-staff-arcane-lance` and
`x-staff-storm-rod`; tomorrow the expansion's 57 one-handed casters (wands, orbs, gauntlets, foci,
scepters, relics) as they're curated in, plus dual-cast alternation per the dualwield doc. Beam
casters keep the separate heat economy; `cast+beam` hybrids keep their compound gate.

**What changes for a non-caster character picking up a tome: nothing — the weapon does the work.**
Sir Galloway picks up the storm rod and it conjures the same bolt on the same cooldown with the
same INT grades; at his INT 1 it hits like a wet glove (the grade multiplier bottoms out), at his
`requirements` shortfall it eats `requirementPenalty` — both of which are the *weapon's* laws,
shipped and character-blind. If he starts picking INT (+2 a level now that nothing stops him), the
rod wakes up. That is the entire design: attraction, not permission. The caster set bonus
(2/3-of-`classPool` +8%/+18%) is likewise arsenal math and survives verbatim.

One rename to keep the language honest: the weapon taxonomy field `classPool`
(`melee/ranged/caster`) should keep its values but shed the word "class" in UI copy — "arsenal
type" or "discipline" — so "class" can finish dying (§6). No data migration; it's a label.

---

## 5. DODGE ROLL ECONOMICS — the second universal verb, priced to not eat the first

### 5.1 The numbers

| Constant | Value | Note |
|---|---|---|
| `DODGE_DISTANCE` | 180 px | > hop's ~144px reach; less than half parry-reflect's threat range |
| `DODGE_DURATION` | 0.32 s | 562 px/s — reads as a burst, not a blink |
| `DODGE_IFRAMES` | 0.22 s | front-loaded from frame 0 (72% of the roll); the tail is vulnerable |
| `DODGE_RECOVERY` | 0.10 s | steerable, no fire/parry (Mei-Ling's quirk bends this) |
| `DODGE_COOLDOWN` | 2.5 s | 1 charge (Yuki: 2; Cogwarden: 3.75s) |
| `DODGE_BUFFER` | 0.2 s | matches `PARRY_BUFFER_SECONDS` — same input forgiveness language |
| Input | Shift / pad B | Space stays hop; G stays ultimate; no chords |
| Restrictions | no roll while airborne (hop) or launched/juggled; rolling clears no DoTs, drops no Brand | see 5.3 |
| Anti-stack | overlapping parry + roll i-frames take **max, not sum** — windows never concatenate | |

### 5.2 The division of labor (why both stay used)

| | **Parry (LMB)** | **Dodge roll (Shift)** | Hop (Space) |
|---|---|---|---|
| I-frames | 0.52s per 0.6s CD — up to ~87% uptime, **skill-gated** (rooted, must face the read) | 0.22s per 2.5s CD — **8.8% uptime**, unconditional | none, ever |
| Payoff | **Offensive:** reflect ×2.2, chain heal, riposte at 3, launch juggles, quirk/augment procs | **Spatial:** 180px displacement, nothing else. Zero damage, zero heal, zero resource | traversal: pits, verticality |
| Answers | WHITE telegraphs (parryable), parry-baits' first honest answer | RED telegraphs (unparryable sweeps that never glint), ground AoEs, bullet walls, the bait-return's *second* honest answer (the sidestep, now crisp) | geometry |

Parry stays the i-frame economy's centerpiece (the ultimate doc's envelope logic): the roll's
uptime is budgeted at under 9% and pays no offense, so the optimal loop remains parry-first. The
roll exists because the enemy-combo language shipped attacks the parry *cannot* answer — RED steps
are authored "dodge/jump-only," and the hop was explicitly built without i-frames. Today the only
answer to a RED sweep is raw positioning at 320 px/s; post-merge every character has one honest
emergency answer per combo.

### 5.3 The anti-redundancy argument vs the bait/juggle language

The enemycombo panel's toughs run 3–4 step combos over ~2.5–3.5s. **`DODGE_COOLDOWN` 2.5s is tuned
to that cadence: one roll per enemy combo.** You can roll the RED step *or* the bait-return — not
both, and never the whole string. The parry-bait's design contract ("both answers must be real":
parry the return for the jackpot, or reposition for safety-without-reward) is *strengthened*, not
voided — the roll is the reposition answer given a button, and it still pays nothing, exactly as
that doc prices it.

Juggles stay earned: **you cannot roll while launched.** Sky Hook / Coffin Lid / Scissor Lift must
be pre-dodged (the launcher is a RED step — the roll's intended target) or the string parried
before it. There is no mid-air get-out-of-juggle button; the roll prevents, never escapes. And
because rolling clears no Brand and cancels no hitstun, the parry remains the only *recovery* tool.
Three verbs, three jobs, zero overlap: parry converts danger to offense, roll converts position to
safety, hop converts geometry to path.

---

## 6. MIGRATION — meta/UI surfaces

**Data:**
- `character-classes.ts` → **`character-kits.ts`**: per-character `{ spread: Record<Attr, 1|2|3|4>,
  quirk: QuirkId, blurb }`. `CHAR_CLASSES`, `CharClassId`, `classForCharacter` deleted;
  `isPlayableCharacter` survives as-is. Kept out of the auto-generated `characters.ts` for the same
  clobber-proofing reason the classes file was.
- Spawn/init: player attrs seed from the spread instead of the schema's `= 1` defaults
  (`state.ts:57`); character swap (C key) mid-run does NOT re-seed attrs — allocated points are the
  player's; only the quirk swaps with the body (spread applies at run start / character lock-in).

**Code call sites (the full `classForCharacter` census, all six):**
- `progression.ts:45-47` — delete the 2 auto-allocates; add ballast (§2.1).
- `GameRoom.ts:4334` — AFK auto-resolve → most-chosen attr (§2.1).
- `level-up-model.ts:380-397` — `automaticGrowth` receipt → pick+ballast receipt copy.
- `ArenaScene.ts:7808` — HUD `[Bruiser] — grows STR` → quirk name (below).
- Imports in `GameRoom.ts:63` / `progression.ts:4` / `ArenaScene.ts:29` / `level-up-model.ts:15`.

**Character select / HUD copy — what replaces the class label:**
- **Portraits stay. Names stay. Class labels die everywhere.** The character card becomes three
  lines: (1) the authored flavor line from `data/character-concepts.json` (already written for all
  40 — "Death already collected his debt…"), (2) a **five-pip spread glyph** (S/D/I/C/L pips at
  1–4, attribute-colored — instant build-lean read, no words), (3) the **quirk chip**: quirk name
  in display caps + one rule sentence ("PORCELAIN — the first killing blow each dimension leaves
  her at 1 HP").
- HUD character line: `C: Yuki [Duelist] — grows DEX` → `C: Yuki — FOX DANCE`.
- The class *blurbs* ("Heavy melee. Grows STR + CON…") die with the table; the quirk sentence is
  the new one-line identity, and it's a better one — it says what the character *breaks*, not what
  the game does for you.
- "class" as a word survives only in weapon taxonomy, relabeled in UI copy (§4).
- No persistence migration: classes never wrote save/meta state (per-run only); dev-portal
  deep-links validate via `isPlayableCharacter`, which survives.

**Ship order:** (1) kits file + spread seeding + allocation 2.0 (playable immediately, quirks
stubbed no-op), (2) dodge roll + the 8 dodge-touching quirks, (3) remaining quirks in flavor-family
waves (parry benders → economy benders → survival benders), (4) arsenal gates, (5) UI copy sweep.
Each wave is independently shippable; the ultimate law amendment lands with wave 1 since it's
where `chooseAttribute` counting lives.
