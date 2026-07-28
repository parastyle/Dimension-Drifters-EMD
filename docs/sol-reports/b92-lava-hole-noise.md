# B92 Lava Foundry hole-noise correction

Date: 2026-07-28
Branch: `sol/b92-lava-hole-noise`
Baseline: `5848753c`

## Decision

Derived collision retains a reactor hole only when its **maximum inscribed diameter is at least one
player diameter**:

```text
minimum retained opening = 2 * PLAYER_RADIUS = 2 * 24 = 48 px
```

This measures whether a full player body can fit inside the opening. It intentionally does not use
equivalent-area diameter: a long two-cell-wide molten seam can have a large area-equivalent diameter
while never reading or functioning as an opening.

The derivation contour is quantized to 12 px cells. `maximumInscribedDiameter` samples it every 2 px,
comfortably below the source precision, and records `minHoleInscribedDiameterPx: 48` in collision
provenance. `nativeScale` remains 1 and runtime still applies the 24 px body radius.

## Source-art finding

Inspection of both shipping PNGs resolves the ambiguous large equivalent-area contours:

- `broken-reactor-arena` has one round, visibly molten reactor well. Its equivalent-area diameter is
  70.4 px and its measured maximum inscribed diameter is about 57.2 px. It survives.
- `glass-to-reactor-vertical-bridge` has one round, visibly molten reactor well. Its equivalent-area
  diameter is 171.5 px and its maximum inscribed diameter is about 149.3 px. It survives.
- The bridge composite's 118.4 px and 131.6 px equivalent-area contours are not large floor openings.
  They are long perimeter/rim molten markings with maximum inscribed diameters of only about 24.0 px
  and 31.7 px. The 50.7–90.8 px cluster is likewise narrow glass-grating, rail, panel-seam, or rim
  detail. None can contain the 48 px body, so all are rejected.

The two genuine circular molten wells remain lethal. The art, alpha envelope, 12 px derivation cell,
and molten-color classifier are unchanged.

## Hole inventory

Sizes below are equivalent-area diameters to match the owner dump. Repeated sizes are compressed with
`xN`.

| Prefab | Before | After |
| --- | --- | --- |
| `broken-turntable-arena` | 0 | 0 |
| `broken-reactor-arena` | 1: 70.4 | 1: 70.4 |
| `broken-security-gate-platform` | 0 | 0 |
| `broken-glass-observatory` | 0 | 0 |
| `broken-lavafall-overlook` | 0 | 0 |
| `broken-mega-arena` | 0 | 0 |
| `dual-turntable-bridge` | 0 | 0 |
| `security-to-turntable-bridge` | 0 | 0 |
| `glass-to-reactor-vertical-bridge` | 21: 50.7 x3, 51.6, 52.4 x2, 54.2, 55.0, 55.8 x2, 57.4, 58.2, 63.5, 65.6 x2, 69.0, 80.1, 90.8, 118.4, 131.6, 171.5 | 1: 171.5 |

## Walkable share

The audit uses the b91 method: 12 px image cells and the same alpha/molten floor classifier form the
denominator; the numerator requires the complete 24 px player-radius disc to fit the collision
surface. Filling the twenty false bridge holes changes only that prefab.

| Prefab | Before | After |
| --- | ---: | ---: |
| `broken-turntable-arena` | 84.6% | 84.6% |
| `broken-reactor-arena` | 82.3% | 82.3% |
| `broken-security-gate-platform` | 89.1% | 89.1% |
| `broken-glass-observatory` | 84.5% | 84.5% |
| `broken-lavafall-overlook` | 83.7% | 83.7% |
| `broken-mega-arena` | 91.9% | 91.9% |
| `dual-turntable-bridge` | 87.6% | 87.6% |
| `security-to-turntable-bridge` | 88.8% | 88.8% |
| `glass-to-reactor-vertical-bridge` | 83.5% | 90.3% |

The five owner-reported regular arenas remain at 82.3–89.1%.

## Pit-reposition audit

The recovery rule itself is correct and is unchanged.

- Canon requires a grounded player over a real pit to take the fall consequence: 15% chip,
  reposition to last ground, and 0.6 s grace. Blocking ordinary walking at the lip would convert a
  real fall into an invisible wall and would violate that rule.
- Safe grounded ticks continually refresh `lastGround`. At `MOVE_SPEED = 320 px/s` and the 50 ms
  authoritative tick, first contact while ordinarily walking normally leaves the recovery point one
  16 px movement commit behind.
- While the actor remains over a pit during grace, `lastGround` intentionally does not advance.
  Long or repeated false unsafe bands can therefore make a later recovery use an old point. The
  reported 405.7 px Snap is disproportionate, but it is a consequence of the bogus seam/grating
  collision—not a separately authored 405.7 px recovery distance.

The correct fix is to stop painted detail from entering pit authority. Retuning recovery distance or
blocking at the edge would mask genuine falls. Both genuine reactor wells still fire the existing
fall rule.

## Regression

The authoritative server regression uses deterministic seed 14, finds the
`glass-to-reactor-vertical-bridge` hero room, and samples a natural left-lane path from its top deck
to its bottom deck in at most 12 px increments. The path detours around the genuine reactor core and
requires `fellSeq` to remain unchanged at every server tick.

Against the pre-fix collision data it failed at segment 2, sample 4/92:

```text
expected fellSeq 0, received 1
```

After re-derivation it completes end to end with zero pit repositions. Collision-contract coverage
also locks the 48 px provenance threshold, all nine walkable-share measurements, and lethality of
both surviving reactor openings.

## B90 invariant sweep

The permanent 2,000-seed property sweep and a metric pass both completed:

- generation throws: 0 / 2,000
- rejected placements: 0
- graph edges measured: 10,000
- graph-edge gap min / median / max: 72.0 / 108.0 / 326.1 px
- permitted graph-edge band: 72–340 px; real distance-jump reach: 372 px
- all room pairs measured: 27,500
- all-pair clearance min / median / max: 72.0 / 607.3 / 3,121.4 px
- touching collision surfaces: 0
- hero layouts: 1,017 / 2,000; destination heroes: 517 / 2,000
- degradation levels 0/1/2/3/4: 1,569 / 170 / 261 / 0 / 0

Thus filling the false holes did not weaken either b90 invariant.

## Verification

- `pnpm gen:check`: pass. Optional comparisons for unavailable untracked VFX reference artifacts
  were skipped by the existing generator checks.
- `pnpm typecheck`: pass.
- focused lava collision + authoritative movement tests: 50 / 50 pass.
- full `pnpm test`, run 1: 248 / 248 files; 2,973 passed; 20 skipped.
- full `pnpm test`, run 2: 248 / 248 files; 2,973 passed; 20 skipped.
- `nativeScale: 1`, b90 clearance/jump budgets, b91 runtime radius, and L09/L10/L11 are unchanged.
- Lava remains additive; no other dimension data or behavior changed.

VERDICT: threshold chosen = maximum inscribed opening diameter >= 1 player diameter (2 * 24 = 48 px), because only a contour that can contain the body is a meaningful fall opening; holes before/after = broken-turntable 0/0, broken-reactor 1[70.4]/1[70.4], broken-security 0/0, broken-glass 0/0, broken-lavafall 0/0, broken-mega 0/0, dual-turntable bridge 0/0, security-turntable bridge 0/0, glass-reactor bridge 21[50.7x3,51.6,52.4x2,54.2,55.0,55.8x2,57.4,58.2,63.5,65.6x2,69.0,80.1,90.8,118.4,131.6,171.5]/1[171.5]; walkable share before/after = 84.6/84.6, 82.3/82.3, 89.1/89.1, 84.5/84.5, 83.7/83.7, 91.9/91.9, 87.6/87.6, 88.8/88.8, 83.5/90.3 percent in the same prefab order; pit-reposition finding = real grounded falls must still chip+snap and first ordinary contact is normally one 16 px commit, while the 405.7 px outlier came from false unsafe bands retaining stale last-ground during grace, so recovery code stays unchanged; sweep result = 2,000/2,000, zero throws/touches/rejections, graph gaps 72.0/108.0/326.1 px min/median/max and every edge jumpable; 2x test results = PASS both runs, 248 files, 2,973 passed, 20 skipped each.
