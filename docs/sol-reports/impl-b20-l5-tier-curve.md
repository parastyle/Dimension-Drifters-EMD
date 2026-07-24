# B20 Lane 5 — Weapon Tier Curve Implementation Report

## Scope and authority

This final B20 lane replaces L2's isolated three-band placeholder with one authored `tier` field on
every active catalog weapon. That field is descriptive metadata only: no weapon damage, cadence,
range, behavior, or other combat stat is rebalanced. Chest weapon rolls, L4 weapon-pack rarity, and
L3 floor/bag disassembly will all consume the authored field directly. Authored enemy drops remain
exact weapon rewards rather than pool rolls, so they do not invent a second time sampler.

The synchronized arena schema remains at 37 unless implementation proves a wire-field change is
necessary. Chest receipts already carry ordinary JSON payloads, and a five-tier value does not
require a new synchronized field.

## Power-budget formula and authoring law

The audit-only budget is deterministic and operates on the final generated `WeaponDef`. It does not
run in any loot, pack, economy, or combat path.

For non-beam deliveries,
`budget = range-factor × normalized sustained DPS + fixed utility credits`.

Range factors use the authored range band: close `0.90`, mid `1.00`, long `1.10`.

Normalized sustained DPS uses the weapon's real delivery cadence:

- ordinary melee: at least `0.12s` between accepted uses;
- thrown: ordinary cooldown plus `refillSeconds / charges`;
- gun: at least `0.05s` fire rate plus `reloadSeconds / magazine`;
- cast: at least `0.05s` authored cast cooldown;
- beam: the stronger honest repeatable early-vent/full-overheat cycle, including charge, heat,
  cooling, lock, width, range, and sweep-control debt. That cycle already prices continuous range,
  so it is not multiplied by the discrete range factor a second time.

Direct damage includes the weapon's headline source, katana expected multiplier/burst, amortized
gun pellets and bursts, thrown return contact, caster total-volley damage, and expected pierce.
Expected pierce targets are `1 + 0.6 × (min(6, pierce) - 1)`. Fixed gun pellets receive the existing
`0.85` convergence factor; random-pellet guns retain their authored total trigger pool.

Behavior extras are conservative realized crowd damage:

- AoE target factor: `1 + min(2, radius / 180)`;
- gun/cast explosion: `0.55 × blast damage × emitted count × AoE factor`;
- quake: `0.55 × quake damage × AoE factor`;
- chain: `0.60 × sum(damage × falloff^link)` across authored jumps;
- scatter: `0.70 × projectile count × direct damage × pierce targets`, plus
  `0.35 × projectile count × explosion damage × AoE factor`;
- hybrid projectiles: the existing accepted-beat expectation, including finisher frequency and a
  returning contact;
- ground zones: `0.45 × DPS × min(2.5s, linger) × AoE factor`, with channel zones normalized as
  sustained output;
- damaging held auras: `0.45 × aura DPS × AoE factor`.

Fixed non-damage utility credits are intentionally small: warp `+2`, resurrection `+4`, authored
slow `+2`, and an invulnerable lunge `+1.5`.

Raw budget bands are:

| Budget | Authored tier |
| ---: | ---: |
| `< 16.5` | T1 |
| `16.5–<20` | T2 |
| `20–<26` | T3 |
| `26–<44` | T4 |
| `>= 44` | T5 |

Manual review is a closed, tested floor table rather than a hidden consumer formula. The initial
pass floors `x2-abyssal-apocrypha` at T4: its continuous full-circle authored performance is an
ultimate-adjacent behavior that the ordinary per-beat estimator deliberately does not extrapolate.
Top numeric outliers such as Galvanic Overcasters and Buzzard's Eye Marksman already land in T5 and
need no override. Wacky weapons receive no novelty boost or penalty: Confetti Cannon, Fish
Launcher, Unicorn Rainbow Beam, Exploding Present Lobber, and Squeaky Mallet remain T1 from their
real output; Bubble Wand Swarm Caster remains T4 because its five real splash events carry that
budget.

## Initial authored tier census

The planned assignment covers all 343 active catalog weapons:

| Tier | Count | Share |
| ---: | ---: | ---: |
| T1 | 69 | 20.1% |
| T2 | 72 | 21.0% |
| T3 | 66 | 19.2% |
| T4 | 68 | 19.8% |
| T5 | 68 | 19.8% |

All five tiers are populated and no tier exceeds 50% of the active pool. The generator input will
carry the authored assignment, `pnpm gen` will emit it into the shared catalog, and a census test
will recompute the budget/override derivation to catch drift.

## Run-clock chest tier curve

The Commons curve is a piecewise-linear table. Minutes below zero clamp to minute 0; minutes above
15 clamp to minute 15.

| Run minute | T1 | T2 | T3 | T4 | T5 |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 0 | 64% | 28% | 8% | 0% | 0% |
| 5 | 44% | 30% | 18% | 7% | 1% |
| 10 | 26% | 26% | 24% | 17% | 7% |
| 15+ | 14% | 18% | 25% | 25% | 18% |

Scar composition preserves L2's authored low/mid/high relationship by multiplying the interpolated
time weights before normalization:

| Tier | Commons multiplier | Scar multiplier |
| ---: | ---: | ---: |
| T1 | 1 | `7/12` |
| T2 | 1 | `7/12` |
| T3 | 1 | `4/3` |
| T4 | 1 | `5/2` |
| T5 | 1 | `5/2` |

Those ratios are L2's `35/60`, `40/30`, and `25/10` Scar-to-Commons low/mid/high bias, expanded
across five authored tiers. Luck then multiplies only T4/T5 by
`1 + 0.05 × clampedLuckStacks`, matching L2's prior high-band treatment. The final vector is
normalized after time, zone, luck, and unlocked-pool availability compose. T1/T2 remain possible
at the late anchor; the curve never strictly obsoletes them.

## Tier consumer tables

Weapon-pack rarity reads only the authored tier:

| Tier | Pack rarity |
| ---: | --- |
| T1 | Common |
| T2 | Common |
| T3 | Uncommon |
| T4 | Rare |
| T5 | Legendary |

Floor and bag disassembly use the same tier lookup:

| Tier | Money |
| ---: | ---: |
| T1 | 4 |
| T2 | 8 |
| T3 | 16 |
| T4 | 32 |
| T5 | 60 |

## Implementation log

- Read the design lock and shipped L1–L4 reports; inventoried the L2 sampler, L3 disassembly seam,
  L4 rarity seam, catalog generator, active roster, and relevant tests.
- Recorded the exact budget, manual review rule, 343-weapon census, and time/zone curve before
  runtime source edits.
- Added the canonical `data/weapon-tiers.json` generator input for all 358 addressable definitions
  (343 active, 14 archived, and runtime fists). The weapon generator validates every tier as an
  integer from 1 through 5, requires every generated concept to have an assignment, emits the
  checked tier registry, and joins it into the final shared `WeaponDef`.
- Added the deterministic audit formula and closed manual-floor table. The active catalog matches
  its derived assignment exactly at 69/72/66/68/68; no combat stat was changed.
- Deleted L2's placeholder budget and low/mid/high tier functions. Chest rolls now interpolate the
  0/5/10/15-minute five-tier table, compose Scar and luck multiplicatively, mask unavailable
  unlocked tiers, and report the selected definition's authored tier. The authority now prices the
  run clock when the chest is opened rather than freezing quality at spawn time.
- Replaced L4's duplicate budget rarity mapping with the authored-tier lookup and L3's continuous
  placeholder-budget disassembly value with the shared T1–T5 value table.
- Added focused tests for formula determinism, generator-input emission, exact census, outlier
  review, simulated 0/5/10/15 distributions, Scar composition, candidate renormalization, authored
  reward labels, and tier-only pack/disassembly consumers.

## Verification

- `pnpm gen` — PASS; emitted 336 generated weapons, the checked tier registry, and 37 combo bars.
- `pnpm gen:check` — PASS; generated weapon definitions and tiers are in sync. The isolated
  worktree lacks 338 untracked subject-reference PNGs, so the existing generator explicitly
  skipped that unrelated optional subject check.
- `pnpm typecheck` — PASS.
- `pnpm test` — PASS, 175 files and 2,250 tests. The isolated checkout's ignored artkit output
  fixture directories were read through local junctions to the primary worktree; no fixture or
  tracked source was copied or changed.
- `pnpm assets:check` — PASS: 478 sprites/1,007 parts, 635 frames, 320 cards, 6 POI sprites,
  9 decals, 24 projectile textures, 96 particles, and 9 VFX textures.
- `git diff --check` — PASS.

The schema remains at 37 and every existing pin remains current: `tier` is catalog metadata, while
the already-JSON `chestOpened` receipt carries its numeric value without synchronized-state shape
changes.

## Private live gate

The reproducible gate under
`docs/owner-notes-audit-v11-evidence/b20-l5-tier-curve/` started only isolated, OS-assigned
ephemeral listeners: Vite `61312` and Colyseus `61314`. It fetched the client shell (HTTP 200),
joined real schema-37 room `L6GNdE8c0`, and shut both listeners down; protected ports 5180 and 2567
were unused.

A gate-only `GameRoom` subclass installed the full active unlock pool and opened 2,000 authoritative
weapon caches at each point in one room, fast-forwarding the authority from run tick 0 to tick
18,000:

| Live point | T1 | T2 | T3 | T4 | T5 | Low T1-T2 | High T4-T5 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Minute 0, Commons | 1,267 | 582 | 151 | 0 | 0 | 92.45% | 0.00% |
| Minute 15, Commons | 287 | 356 | 504 | 495 | 358 | 32.15% | 42.65% |
| Minute 15, Scar | 98 | 146 | 414 | 777 | 565 | 12.20% | 67.10% |

Every one of the 6,000 `chestOpened` weapon receipts matched the selected catalog definition's
authored tier. The late Commons sample retained positive T1 and T2 probability while opening T4
and T5; Scar composition then raised the late high-tier share multiplicatively. The retained JSON
records the exact curve weights, elapsed clock, counts, shares, ports, schema, room, and zero
mismatches.

## Files touched

- Tier authoring/generation: `data/weapon-tiers.json`,
  `tools/artkit/gen-weapon-expansion.mjs`,
  `packages/shared/src/weapon-tiers.generated.ts`, and the regenerated
  `packages/shared/src/weapons-expansion.generated.ts`.
- Shared catalog/audit: `packages/shared/src/weapons.ts`,
  `packages/shared/src/weapon-tiers.ts`, and `packages/shared/src/index.ts`.
- Three consumers/authority: `packages/shared/src/chests.ts`,
  `packages/shared/src/booster-packs.ts`, `packages/shared/src/economy.ts`, and
  `packages/server/src/rooms/GameRoom.ts`.
- Coverage: `tests/weapon-tiers.test.ts`, `tests/chests.test.ts`,
  `tests/booster-packs.test.ts`, and `tests/economy.test.ts`.
- Reporting/evidence: this report plus
  `docs/owner-notes-audit-v11-evidence/b20-l5-tier-curve/{README.md,live-gate.mts,live-observations.json}`.

VERDICT: 343 weapons tiered (T1 69, T2 72, T3 66, T4 68, T5 68); curve live replacing the placeholder; 3 consumers unified on the tier field; evidence at docs/owner-notes-audit-v11-evidence/b20-l5-tier-curve/; files touched listed above.
