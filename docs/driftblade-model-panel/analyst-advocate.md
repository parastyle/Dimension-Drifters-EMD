# Driftblade-as-Model Panel — Model Analyst / Devil's Advocate

Directive under analysis (user, verbatim intent): *"The VFX and combo for Driftblade should be a MODEL
for 2-handed swords. Not saying to reuse the VFX asset or the combo, but they should have like-combos
and like-VFX"* … *"not ALL 2 handed swords, just like 40% of them."*

Sources read: `packages/shared/src/melee.ts` (combo tables, `SwingDescriptor`, chain indexing),
`packages/shared/src/weapons.ts` + `weapons-expansion.generated.ts` (roster), `packages/client/src/entities/SpriteRig.ts`
(`applyPommelBash`, `applyTrueChargedSlam`, combo routing at ~L4085–4160), `packages/client/src/vfx/vfx-render.js`
(PER renderer), `packages/client/src/vfx/VfxPlayer.ts` (PER metadata wiring), `packages/client/src/vfx/weapon-vfx.generated.ts`
(driftblade hero suite), `docs/bigsword-combos-panel/designer.md` (shipped family identities).

---

## 0. Ground truth — what "the Driftblade combo" actually is in code

Driftblade (`driftblade`: `sword`/XL, 2H, `range 300`, `displayLength 320`, `cooldown 0.62`, `swingArc 2.3`,
DEX-B/STR-C) authors **no** `swingStyle`/`comboFamily`/`comboVariant`. Resolution:
`swingStyleFor` → `orbit`; `bigSwordPanelVariantFor` (melee.ts ~L894) → variant **`greatsword`**;
family **`chop`**. The sequence (`MELEE_COMBO_VARIANT_SEQUENCES.greatsword`) is:

| Beat | Step | Timing (fraction of pose = cd × `SWING_WINDOW_FRAC` 0.64 ≈ 397 ms) | Path |
|---|---|---|---|
| 1 | shoulder chop (`chop[0]`) | anticipation 0→0.24, active 0.24→0.52, impact 0.52, follow→0.66 | sweep, arc×0.75, rng×1.00, dmg×1.00, kb 0 |
| 2 | pommel bash | anticipation 0→0.12, active 0.12→0.30, impact 0.28, follow→0.44 | capsule, rng×**0.55**, dmg×0.75, kb 28 |
| 3 | true charged step-slash (TCS) | anticipation 0→**0.46** (incl. tremor hold 0.22–0.34), active 0.46→0.64, impact 0.61, contact-deformation micro-beat 0.61–0.64, follow→0.80 | fan, arc×**0.72**, rng×**1.12**, dmg×1.25, kb 96 |

Three load-bearing facts the rest of this document depends on:

1. **The pose is carrying the quality, not the VFX.** The greatsword steps author *no* `ribbon` field.
   Driftblade's rendered VFX is its `hero-skin` (`vfx/driftblade.png`, rot 180, vfxRadius 162) plus the
   *default* PER blade ribbon at XL size. Furthermore, the per-step `MeleeComboRibbon` data that the
   big-sword panel authored for Momentum/Breach/Compass/Hookbreak (`radialStart`/`widthMultiplier`/`setupEcho`…)
   **has no consumer**: `renderPer`/`samplePerClock` in `vfx-render.js` read only `swing.activeStart/End/impactSeconds`,
   `meta.family`, `meta.size` — never `comboRibbon` (grep confirms zero client reads). "Like-VFX" must be
   defined against what *renders*, not what's authored.
2. **Two weapons already reuse the combo verbatim.** `bigSwordPanelVariantFor` routes `x2-gravechill-nodachi`
   and `x2-stormpetal-odachi` to the same `greatsword` step table Driftblade uses. Under the new directive
   ("NOT reuse the combo") the current state of the nodachi cousins is *non-compliant by the user's own words*,
   not a head start.
3. **The shipped panel explicitly warned against this directive's naive reading.** `docs/bigsword-combos-panel/designer.md`
   §2: the variant named `greatsword` "is really the Driftblade quality benchmark… Its TCS-inspired third
   beat is precisely the shape that should not be copied everywhere." The user's directive overrides that —
   but only for ~40%, which is exactly the reconciliation: the TCS *shape* propagates to one lineage, and
   the shipped Momentum/Breach/Compass/Hookbreak identities absorb the rest.

---

## 1. The model, decomposed — a checkable spec

What makes Driftblade "really cool" is **contrast with causality on a three-beat commitment ramp**: every
beat changes attack class (long edge → compact blunt → charged line), yet each exit *is* the next entry.
Below is that observation converted to measurable clauses.

**A two-handed sword follows the Driftblade model iff M1–M8 all hold** (fractions are of `poseSeconds`;
tolerances derived from the shipped tables):

- **M1 — Three-role cycle.** Exactly 3 steps with the roles **DRAW** (committed long cut), **PUNCTUATE**
  (short, fast, body-led utility beat), **PAYOFF** (charged decisive finisher). All three `motion` verbs
  distinct; ≥ 2 distinct `path.kind` values across the cycle (Driftblade: sweep / capsule / fan = 3).
- **M2 — Commitment ramp.** Anticipation fractions `A1 ∈ [0.20, 0.30]`, `A2 ≤ 0.6·A1` (and ≤ 0.15),
  `A3 ≥ 1.7·A1` (and ≥ 0.44). Driftblade: 0.24 / 0.12 / 0.46 → ratios 1 : 0.5 : 1.9. The middle beat
  *accelerates* the phrase so the finisher's delay reads as intent, not sluggishness.
- **M3 — Reach contrast.** `max(rangeMultiplier) / min(rangeMultiplier) ≥ 1.8`, minimum on PUNCTUATE
  (≤ 0.60), maximum on PAYOFF (> 1.0). Driftblade: 1.12 / 0.55 = 2.04. The silhouette must go
  large → compact → enormous, never three alternating crescents.
- **M4 — Focused finisher.** PAYOFF simultaneously **narrows** (`arcMultiplier ≤ 0.8`) and **extends**
  (`rangeMultiplier ≥ 1.08`); `damageMultiplier ≥ 1.2`, `knockback ≥ 90`, `impact ≥ 0.58`; a contact-deformation
  micro-beat of 0.02–0.04 of pose at impact; `followEnd ≥ 0.78` ending in a *planted hold*, only partially
  unwound. (TCS: arc 0.72, rng 1.12, dmg 1.25, kb 96, impact 0.61, deformation 0.61–0.64, hold to 0.80.)
- **M5 — Silhouette grammar (VFX-off test).** The three beats must remain distinguishable with all VFX
  disabled: DRAW reads as an oblique long bar outside the torso; PUNCTUATE reverses or retracts the weapon
  (Driftblade: blade at `aim + π`) and compresses two-hand spacing ≥ 35% (0.42H → 0.24H); PAYOFF includes
  an edge-on foreshortening phase (`weaponLengthScale` minimum ≤ 0.35 — TCS hits 0.22), ≥ 1
  `attackWeaponDepth` swap, a hold tremor when cadence permits (see gate below), and the attack shadow
  leading the blade to the contact point.
- **M6 — Causal handoff.** Each beat's follow-through travels *into* the next beat's entry (the pommel
  branch after 0.44 deliberately rises into the TCS load); the guard holds through the cadence gap
  (`comboHoldPose`); hands/feet ownership releases through the smootherstep `actionOwnershipAt` seam so
  follow-through decays as residual energy.
- **M7 — Ribbon language (as rendered).** Exactly **one** full-opacity business-edge ribbon per swing;
  history trail ≤ 0.35 × |arc| and ≤ 0.85 rad (the XL PER caps); alpha ramps ≈ f² tail→head with body
  alpha ≤ 0.78; a radial head lip only while active; follow-through fade ≤ 90 ms; any setup echo at
  neutral-dim only. Element paint stays the weapon's own.
- **M8 — Own skin, own words.** The weapon keeps its own hero art, `vfxRadius`, paint, and its own step
  names/motion verbs. **Sharing Driftblade's literal step table (`MELEE_COMBO_VARIANT_SEQUENCES.greatsword`)
  fails the model** — conformance is to the M1–M7 bands. "Like" is a lint, not a pointer.

**Cadence gate (critical honesty clause).** The tremor hold and deformation micro-beat are *time* effects:
at Driftblade's 0.62 s cd, A3 = 0.46 × 397 ms ≈ 183 ms of visible charge. At katana cadence (0.30 s cd,
pose 192 ms) the same fractions produce ~88 ms of charge — below read threshold. Below ~0.5 s cd the model
applies **phrase-level only** (M1–M3, M5 silhouette roles, M6, M7); M4's tremor/deformation sub-beats are
waived and the "charge" is expressed as guard-carry across the cadence gap instead. Without this gate the
model either excludes every fast cutter (killing the 40%) or degrades into invisible sub-frame theater.

---

## 2. Selection rule — which ~40% adopt

### Enumeration: the real two-handed swords

Criteria: `tags.grip === "2H"`, melee delivery, sword lineage by family/silhouette. Excluded from the
denominator: glaives/voulges/fauchards/bardiches/halberds/naginatas (polearms — and already the shipped
Compass/Hookbreak identities), the four `cleaver`-family butcher tools (crushers with knife anatomy, not
swords; admitting them inflates the denominator to 18 and invites scope creep), `gravediggers-spade`
(family `spade`; borrows Tombstone art as placeholder), scythes/`exotic-melee`, and every non-blade 2H
(mauls, staves, tomes, totems, orbs).

| # | id | Name | family/size | cd | len/range | scaling | Today |
|---|---|---|---|---|---|---|---|
| 1 | `driftblade` | Driftblade | sword/XL | 0.62 | 320/300 | DEX-B STR-C | `greatsword` (benchmark) |
| 2 | `x2-gravechill-nodachi`† | Gravechill Nodachi | nodachi/XL | 0.66 | 330/300 | STR-B DEX-C, quake | `greatsword` (verbatim reuse) |
| 3 | `x2-stormpetal-odachi`† | Stormpetal Odachi | nodachi/XL | 0.64 | 335/300 | DEX-A STR-D | `greatsword` (verbatim reuse) |
| 4 | `x2-hailwidow-katana`† | Hailwidow Katana | katana/M | 0.30 | 128/140 | DEX-A | no combo (orbit hole) |
| 5 | `x2-voltfang-tachi`† | Voltfang Tachi | katana/M | 0.32 | 126/142 | DEX-B INT-C | no combo (orbit hole) |
| 6 | `tombstone-greatsword` | Tombstone Greatsword | sword/L | 0.78 | 124/156 | STR-A, quake | `greatsword-momentum` |
| 7 | `x-sword-coffin` | Reaper's Lid | sword/L | 0.90 | 200/166 | STR-A | `greatsword-momentum` |
| 8 | `x-sword-bone` | Wyrmtooth | sword/L | 0.72 | 120/150 | STR-C DEX-C | `greatsword-momentum` |
| 9 | `x2-riftcleaver-greatblade`† | Riftcleaver Greatblade | energy-blade/L | 0.70 | 142/156 | STR-C INT-B | `greatsword-momentum` |
| 10 | `x2-tombwarden-claymore`† | Tombwarden Claymore | broadsword/XL | 0.82 | 210/178 | STR-A CON-D, quake | `claymore-breach` |
| 11 | `x2-dustreaper-zweihander`† | Dustreaper Zweihander | broadsword/XL | 0.78 | 230/218 | STR-A | `claymore-breach` |
| 12 | `x-sword-anchor` | Drowned Anchor | sword/L | 0.95 | 165/172 | STR-A | no combo (orbit hole) |
| 13 | `x-sword-buzzsaw` | Buzzcutter | sword/M | 0.22 | 100/122 | STR-C DEX-C | no combo (orbit hole) |
| 14 | `x-sword-whirlwind` | Dervish Greatblade | greatsword/L | 1.00 | 118/150 | STR-B DEX-D | explicit `spin` (deliberate exception) |

† = expansion weapon, currently outside `WEAPON_IDS`.

### The rule

> **A 2H sword adopts the Driftblade model iff it is a nodachi-adjacent edge-precision cutter:
> (a) long single-edge cutter silhouette — family tag `nodachi`/`katana`, or `sword`-tagged with the blade
> dominating the sprite (`displayLength ≥ 300`, i.e. the "really long thin blade" build Driftblade
> demonstrates); AND (b) cutter cadence, `cooldown ≤ 0.66 s`; AND (c) not a shipped member of a
> Momentum/Breach/Compass/Hookbreak roster (identity-preservation override).**

Clause (a) is deliberately a trait the *player can see* (blade proportions + card family), not a hidden
stat — that is the 40%-boundary legibility guardrail (risk R3). Clause (c) makes the rule structurally
incapable of flattening the fresh panel families.

### Adopters — 5 of 14 (36%; 38% of the 13 combo-eligible after the deliberate spin exception — the honest "like 40%")

| Adopter | One-line justification |
|---|---|
| `driftblade` | The anchor. Stays the benchmark; its table is the reference, never the shared asset. |
| `x2-gravechill-nodachi` | Nodachi cousin, len 330 — already benchmark-routed, but must be **de-cloned** (M8): own PUNCTUATE/PAYOFF verbs; quake contact remapped to its impact frame per the panel's quake rule. |
| `x2-stormpetal-odachi` | DEX-A ōdachi, len 335 — the purest nodachi-adjacent case; also must be de-cloned per M8. |
| `x2-hailwidow-katana` | DEX-A 2H fast cutter currently in the `orbit → no combo` hole; phrase-level model (cadence gate) — pure win, nothing shipped gets overwritten. |
| `x2-voltfang-tachi` | DEX-B tachi, same hole, same phrase-level adoption; volt paint exercises M7/M8 (like-VFX ≠ same VFX). |

### Keep-their-identity — 9 of 14

| Keeper | One-line justification |
|---|---|
| `tombstone-greatsword` | Shipped Momentum flywheel + quake slab; STR-A crusher, cd 0.78 fails (b), identity fails (c). |
| `x-sword-coffin` (Reaper's Lid) | Shipped Momentum; a coffin lid is carried mass, the antithesis of edge precision. |
| `x-sword-bone` (Wyrmtooth) | Shipped Momentum; short (len 120) cleaving fang, no cutter silhouette. |
| `x2-riftcleaver-greatblade` | Shipped Momentum with energy PER skin; STR/INT, no DEX — the designed contrast case *next to* the model. |
| `x2-tombwarden-claymore` | Shipped Breach; formal guards + crossguard finisher is its own read. |
| `x2-dustreaper-zweihander` | Shipped Breach; STR-A guard-breaker, boundary case argued at R3. |
| `x-sword-anchor` (Drowned Anchor) | STR-A cd-0.95 haymaker; needs the anchor/mauler chain the panel deferred — **not** nodachi-lite. |
| `x-sword-buzzsaw` (Buzzcutter) | cd 0.22 auto grinder; a charged-payoff grammar is unreadable at saw cadence — needs powered-saw language. |
| `x-sword-whirlwind` (Dervish) | Explicit `spin`, bypasses the combo system by design; two-turn whirl *is* its identity. |

Net implementation delta: 2 de-clones (nodachi/ōdachi get authored variants instead of sharing
`greatsword`) + 2 new phrase-level variants (katana/tachi) + 0 changes to any shipped family member.
Prefer authoring `comboVariant` metadata on the four (the higher-priority seam in `meleeComboSelectionFor`)
over growing the `bigSwordPanelVariantFor` id switch.

---

## 3. Devil's advocate — attacks and guardrails

### R1 — "Like-combos" collapses into clones (the user explicitly forbade reuse)

The cheapest implementation — point 4 more weapons at `MELEE_COMBO_VARIANT_SEQUENCES.greatsword` — is
*already shipped for two of them*, and it is precisely what the user said not to do. The opposite failure
is also real: wholesale-new `SpriteRig` pose branches per adopter is roughly the cost of the entire
big-sword panel again for one lineage. **Guardrail:** conformance to M1–M8 is a *lint on step tables*, not
a shared variant id. Each adopter must differ from Driftblade in ≥ 2 of {PUNCTUATE verb, PAYOFF verb,
direction signs, timing values within band}. The honest middle: adopters share the model's *bands* and
reuse parameterized rig branches (`applyPommelBash`-class motions take timing/spacing arguments), with
bespoke authoring spent on finisher verbs only. If budget forces triage, de-clone stormpetal/gravechill
last — they are outside `WEAPON_IDS` and invisible to normal players; hailwidow/voltfang are the visible
proof the model works at a second cadence.

### R2 — Flattening the shipped families into nodachi-lite

The directive arrives days after Momentum/Breach/Compass/Hookbreak shipped with the explicit design note
that the TCS beat "should not be copied everywhere." A selection rule keyed on anything stat-shaped
("all XL swords", "all melee-arc 2H") silently eats Breach's claymores or Momentum's greatblades.
**Guardrail:** clause (c) is non-negotiable and mechanical: the adopter set and the four shipped rosters
in `bigSwordPanelVariantFor`/panel docs must be provably disjoint (a unit test can assert set
disjointness). The model propagates along a *lineage* (long thin cutters), not up a *size class*. Any
future pressure to convert a Momentum/Breach member is a new design decision, not rule drift.

### R3 — The 40% boundary reads as inconsistency

Worst visual pair: **Dustreaper Zweihander** (keeper, len 230, arc 3.1) vs **Stormpetal Odachi** (adopter,
len 335, arc 2.4) — both enormous 2H blades. Why one and not the other? **Guardrails, in order of
strength:** (1) the split follows *visible* traits — blade proportion (335 thin vs 230 broad), card
scaling (DEX-A vs STR-A), and speed (0.64 vs 0.78) — expressible diegetically as "DEX-led long cutters
fight like Driftblade"; (2) the boundary is *harmless* because no keeper is left combo-poor: every keeper
has a full shipped identity (Momentum/Breach/spin) — inconsistency only wounds when one of a similar pair
has visibly less polish. That flips the real risk: today `x-sword-anchor` and `x-sword-buzzsaw` sit in the
`orbit → no combo` hole. **If any roster weapon still has zero combo after this pass, the 40% boundary
will read as neglect, not curation** — the Anchor/saw grammars (panel-deferred) should be scheduled in the
same milestone, even at one-step quality; (3) never let the two boundary-adjacent weapons share hero-art
or paint (Riftcleaver's energy skin next to Stormpetal's petal steel keeps the families visually far
apart even when silhouettes rhyme).

### R4 — Regression risk to the fresh combo-chain indexing

`comboStepForChain` keys chains on `(weaponId, family)` with strict uint32 `advance === 1` and cadence
expiry. The adoption plan's safe properties: adding variants keeps family `chop` (via
`familyForSignatureVariant` default), so no chain identity changes; hailwidow/voltfang go from
`undefined` selection (length 0 → step 0) to length 3 — chains simply start at the opener; weapon swaps
already restart by `weaponId`. The sharp edges: (1) **new `MeleeComboVariant` union members** — the
exhaustive `Record<SignatureMeleeComboVariant, …>` catches a missing table at compile time, but
`familyForSignatureVariant`'s `return "chop"` default means a new *non-chop* variant silently routes to
chop and then fails `meleeComboSequenceFor`'s family guard, degrading to the base family sequence with no
error — add the mapping *first*; (2) the designer's proposed **rename of the misleading `greatsword`
variant** must not ride along with this pass — renaming the key while adding four variants multiplies the
places a stale string can hide (tests, `bigSwordPanelVariantFor`, weapon metadata) for zero player value;
(3) `x2-gravechill-nodachi` is a **quake carrier**: any new PAYOFF must remap its visible contact to
`swing.impactSeconds` exactly as the fulcrum flip does, or the quake detonates on an unrelated frame —
this is the single most likely functional regression of the whole effort; (4) do not touch
`comboStepForChain` semantics at all — the explosive-gun flake fix and the §50 dodge-integrity work just
stabilized this area; new adopters are pure data.

### R5 — Telegraph-legibility budget if adopters get richer ribbons

Cold fact first: per-step ribbons **do not render** — `renderPer` never reads `comboRibbon`, and the PER
clock samples the *style-derived* descriptor seconds, not `comboTiming`. So "give adopters richer ribbons"
means building the consumer, which re-opens the §50 telegraph fight (the last raw slash-arc stroke was
killed for reading as a white streak; PER caps body alpha at 0.78 and history at 0.85 rad for a reason).
Budget math: an XL blade ribbon is a ~38 px-wide additive strip over a ~300 px radius arc; worst case
4-player co-op with three adopters on screen is three simultaneous XL strips plus enemy telegraphs from
the just-shipped diegetic-telegraph pass. **Guardrails:** (1) M7 is a *ceiling*, not a floor — adopters
get zero new alpha, zero new paints, one business edge, setup echoes neutral-dim only (the panel's own
PER rule); (2) any comboRibbon consumer must clip full opacity to the legacy centered sweep (panel §3)
so a cosmetic hook/reverse never implies a hit the server won't award — this is a dodge-integrity
invariant, not a style choice; (3) if the consumer doesn't ship this milestone, "like-VFX" is *already
satisfied in the truthful sense*: adopters share the rendered PER grammar (arc body + head lip + short
history) in their own paint and hero art — say so rather than authoring more inert ribbon fields that
drift from what players see; (4) keep the `perQuality 4` fallback path exercised — five adopters is five
more weapons whose worst-case draw is the canvas fallback arc.

### Summary judgment

The directive is satisfiable without touching a single shipped family member: fix the two clones the user
already implicitly rejected, fill the two katana-shaped holes, and hold the boundary with a rule players
can see. The two places this goes wrong are both quiet: the gravechill quake frame, and defining
"like-VFX" against authored-but-unrendered ribbon data.
