# B91 Lava Foundry walkable-floor truth

Date: 2026-07-27
Branch: `sol/b91-lava-walkable-truth`
Baseline: `8824484c`

## Cause verification

### Bug 1: short jump attempts

This bug is related to the undersized collision, but its direct cause is an independent jump-abort
branch.

Before the fix, both the server and client prediction validated a distance-jump endpoint with
`safeSpawnPos`. When validation collapsed the endpoint back onto the takeoff point, the resulting
horizontal length was effectively zero. Both implementations then cancelled the move stance before
assigning the jump's vertical velocity. The authoritative airtime was therefore `0.00 s`; client-side
presentation could make that cancellation read as the reported approximately `0.1 s` hop. The
48-pixel inset and 13% trim made endpoint collapse much more common, but the takeoff pit test itself
was not cancelling an already-launched jump: the movement loop already skips pit resolution while
vertical velocity is positive.

The regression isolates a legitimate standing position as the only safe landing. It failed before
the fix with zero airborne ticks. A valid jump direction now always starts the authored jump
sentence. If endpoint validation leaves no horizontal travel, the jump becomes stationary
(`dashSpeed = 0`) and still receives `DIST_JUMP_VERTICAL_VELOCITY`; it is no longer cancelled.
Server and prediction use the same rule. The test observes the complete authored `0.60 s` ballistic
airtime, resolving on the first 50 ms simulation tick after the trajectory reaches ground.

### Bug 2: damage while visibly on a platform

Confirmed as collision provenance loss after the good alpha trace. The baked 48-pixel erosion plus
the blanket per-column bottom trim classified plainly drawn floor as lava. Before the fix, one
radius-clear visible-floor sample on each of the five reported platforms took pit damage and snapped
back after one server tick. All five parameterized cases failed.

The stored polygon now follows the alpha-derived floor envelope with `edgeInsetPx: 0`. Lava runtime
queries apply `PLAYER_RADIUS = 24` to the body centre with exact polygon and hole edge distance, so
future body sizes can use the same art-derived surface. This radius-aware test is used for player
ground contact and Lava Foundry safe-position correction only; the five existing dimensions retain
their previous tile behavior.

### Bug 3: damage and knockback during a connected-platform jump

Confirmed as the same false-pit classification at the destination side of a valid graph edge. The
airborne samples were protected, but the old shrunken destination polygon treated a drawn landing
point as lava. The pit impulse then restored `lastGround`, producing the reported return to the
original platform. The pre-fix connected-platform arc regression failed at its landing sample with
pit damage and a changed fall sequence. After the collision correction, every sampled point from
takeoff through landing remains damage-free.

## Collision derivation decision

- Stored edge inset: changed from 48 px for platforms and 24 px for hero rooms to 0 px.
- Runtime clearance: the player's 24 px physical radius is applied at test time.
- `bottomTrimFraction`: deleted (13% on regular platforms, 9% on hero rooms).
- `nativeScale`: remains 1.

The bottom trim was a blanket per-column haircut, not a platform-specific under-hang rule. There was
no evidence that any of the five reported platforms needed it. It also removed valid floor based on
total column height rather than the way the art reads. Real transparent edges continue to come from
the alpha envelope; painted molten openings continue to be rejected; authored holes, including the
reactor openings, remain lethal. Those mechanisms preserve actual holes and edges without discarding
the lower portion of every silhouette.

## Walkable-share measurements

The reproducible audit uses the same 12 px cells, alpha threshold 40, occupancy threshold, and molten
rejection as derivation. Its denominator is the PNG's visible-floor candidate cells. Its numerator
requires a player body centre to be inside the derived floor and at least `PLAYER_RADIUS` from every
outer or hole edge. This is stricter than measuring polygon coverage alone and directly represents a
legitimate standing position.

The owner-supplied baseline is retained alongside a same-method before/after audit because the two
baseline measurement procedures produce slightly different percentages.

| Platform | Owner baseline | Same-method before | Same-method after |
| --- | ---: | ---: | ---: |
| `broken-glass-observatory` | 30.8% | 36.9% | 84.5% |
| `broken-turntable-arena` | 34.5% | 36.4% | 84.6% |
| `broken-lavafall-overlook` | 35.5% | 46.9% | 83.7% |
| `broken-reactor-arena` | 36.5% | 42.9% | 82.3% |
| `broken-security-gate-platform` | 45.0% | 50.5% | 89.1% |
| `broken-mega-arena` | not supplied | 69.7% | 91.9% |

The five owner-reported regular platforms now span 82.3–89.1% walkable share. The remaining loss is
the intended player-radius edge clearance plus transparent and molten holes, rather than a baked
48-pixel polygon erosion.

The indivisible hero-room composites were also audited with the same method:

| Hero room | Before | After |
| --- | ---: | ---: |
| `dual-turntable-bridge` | 64.7% | 87.6% |
| `security-to-turntable-bridge` | 67.0% | 88.8% |
| `glass-to-reactor-vertical-bridge` | 62.7% | 83.5% |

## B90 invariant sweep

The first enlarged-polygon sweep exposed 364 generation throws in 2,000 seeds because the previous
side-by-side spawn placement no longer fit the arena bounds. Spawn is now stacked above route in the
two affected layout constructors. The B90 invariants were not weakened: minimum surface clearance
remains exactly 72 px, traversal budget remains 340 px against the real 372 px reach, and no overlap
tolerance was introduced.

Final deterministic 2,000-seed sweep:

- generation throws: 0 / 2,000
- graph-edge surface gaps (10,000 edges): min 72.0 px, median 108.0 px, max 326.1 px
- all-pair surface clearances (27,500 pairs): min 72.0 px, median 607.3 px, max 3,121.4 px
- hero layouts: 1,017 / 2,000
- destination hero rooms: 517 / 2,000
- degradation levels 0/1/2/3/4: 1,569 / 170 / 261 / 0 / 0

Every graph edge stayed within the jump budget, every platform pair retained exact minimum
clearance, and generation never threw.

## Regressions and verification

The three requested regressions were added:

1. A jump whose only safe landing is takeoff runs its complete authored airtime. A matching client
   prediction regression protects reconciliation parity.
2. A radius-clear standing sample on each reported platform takes no pit damage or snapback.
3. Every sample along an arc between graph-connected spawn and route floors takes no pit damage.

All seven server cases (one airtime, five platform samples, one connected arc) failed against the
pre-fix implementation. The client parity case also exercises the old cancellation branch.

Final verification:

- `pnpm gen:check`: clean
- `pnpm typecheck`: clean
- B90 property sweep: 2,000 / 2,000 seeds, zero throws, all invariants held
- full `pnpm test`, run 1: 248 files passed; 2,972 passed, 20 skipped
- full `pnpm test`, run 2: 248 files passed; 2,972 passed, 20 skipped
- `git diff --check`: clean
- prohibited files and the walkability painter: untouched

VERDICT: bug1 cause+fix = endpoint collapse independently aborted a valid jump, now launches a stationary full-airtime jump; bug2/3 cause+fix = post-trace polygon loss falsely triggered pit damage/snapback, now the drawn floor is radius-tested at runtime; inset before/after = 48 px platforms and 24 px hero rooms / 0 px stored; trim kept y/n = no; walkable share before/after = owner 30.8–45.0% (same-method 36.4–50.5%) / 82.3–89.1% on the five reported platforms; sweep result = 2,000/2,000, 0 throws, graph gaps 72.0/108.0/326.1 px min/median/max, all b90 invariants held; 2x test results = 248/248 files, 2,972 passed and 20 skipped on each run.
