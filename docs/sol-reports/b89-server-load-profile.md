# B89 server load profile

Date: 2026-07-27

Branch/worktree: `sol/b89-server-load-profile` / `C:/Users/Exped/ddv2-wt/b89-server-load-profile`
Scope: diagnosis only. No file under `packages/*/src/` was changed.

## Result

The current branch does not reproduce a 50 ms simulation-budget overrun at the captured entity
count. With one player, six live mixed Wild West enemies, and fourteen live mixed
hostile/friendly projectiles:

- `stepSim`: **0.047264 ms mean, 0.122000 ms p99, 0.203300 ms max** over 400 measured ticks.
- The phase means sum to 0.047003 ms. The in-memory timing markers themselves cost 0.001603 ms
  per synthetic 22-phase tick.
- The owner's 125.5 ms drift peak is 2,655x this measured mean and 1,029x this measured p99.
- The clean real-timer run produced **no multi-sub-step invocation**: 443 callbacks ran zero
  sub-steps, 200 ran one, and 0 ran two or more.
- Real Colyseus patch encoding at 6/14 was **0.007753 ms mean / 0.018900 ms p99**, for a
  318-byte patch. It is not material against a 50 ms budget.

There is one real superlinear hotspot, but not one large enough to explain the live capture:
phase 5.5 enemy body collision rose from 0.001221 ms at one enemy to 0.207473 ms at fifty.
That curve is approximately n^1.31 over 1 -> 50, and n^1.49 over 5 -> 50. It uses
`SpatialGrid`, but sorts the same candidate scratch repeatedly and, in the ordinary-radius path,
sorts it a second time.

The diagnosis is therefore: **the current 6/14 simulation and serializer do not account for the
125.5 ms event**. A live CPU/GC profile at the exact stall is still required to distinguish an
exact weapon/archetype path absent from this fixture, multi-room/process contention, a long major
GC, logging/I/O, or a server revision mismatch. The measured allocation rate makes GC worth
investigating, but this 10-second timer run did not exhibit a stall.

## Re-run command

Run from the repository root:

```text
node --no-warnings --expose-gc --loader ./tools/b89-profile-loader.mjs ./tools/b89-server-load-profile.mjs
```

The command emits one JSON document to stdout and progress messages to stderr. It completed in
about 13 seconds on this machine. The loader transpiles TypeScript and injects phase markers in
memory; it never writes or rewrites production source. It also verifies that all 22 phase
boundaries occur in the expected order, failing instead of silently profiling a changed contract.

Artifacts:

- `tools/b89-profile-loader.mjs`: read-only TypeScript loader and exact phase-contract injector.
- `tools/b89-server-load-profile.mjs`: room fixture, sweeps, real serializer measurement,
  allocation sampling, catalog counters, and timer/sub-step histogram.

## Method

Environment: Node v24.13.0, Windows x64, AMD64 Family 26 Model 68. Phase samples used 60 warm-up
ticks plus 400 measured ticks per point. Patch samples used 30 warm-up patches plus 200 measured
patches. Allocation samples used 1,200 ticks with a 2,048-byte V8 sampling interval and included
objects collected by both minor and major GC.

The fixture:

- constructs the real `GameRoom` and real Colyseus schema serializer;
- has one joined no-op client, so `broadcastPatch()` encodes once and sends to a real `raw` sink;
- uses training mode to suppress the survival spawn director while retaining all combat phases;
- cycles the Wild West roster for enemy AI coverage;
- keeps six enemies and fourteen moving projectiles live, with hostile/friendly projectiles
  alternating;
- makes the map ground-only in the fixture and restores entity origins after timed phase samples,
  preventing pit deletion, boundary expiration, or convergence from changing the swept count;
- times production `stepSim` only; restoration is outside the total timer;
- leaves phase 3's survival-only director idle. Boss-specific, belt-specific, active VFX, multiple
  players, network socket I/O, and exact owner weapon input are outside this fixture.

The phase boundary source is `packages/server/src/rooms/room/room-progression.ts:3691-4884`.
The golden contract is independently pinned at
`packages/server/src/rooms/GameRoom.test.ts:1647-1713`.

## Ranked representative per-phase cost

All values are milliseconds at six enemies / fourteen projectiles. Ranking is by mean.

| Rank | Phase | Mean ms | p99 ms | Max ms | Observed shape |
| ---: | --- | ---: | ---: | ---: | --- |
| 1 | 5.3 projectiles | 0.011940 | 0.031100 | 0.176000 | Linear in projectiles |
| 2 | 5.5 enemy body collision | 0.010462 | 0.026300 | 0.049500 | Superlinear in enemies/density |
| 3 | 5.1 enemy melee/combo AI | 0.004596 | 0.017900 | 0.030800 | Sublinear-to-linear in enemies here; E x players targeting |
| 4 | 4 player combat/resource | 0.003530 | 0.016200 | 0.036000 | Flat in these sweeps; one player |
| 5 | 0 tick/input/grid/traversal | 0.003378 | 0.013100 | 0.020700 | Small linear enemy-grid rebuild plus fixed player work |
| 6 | 5 generic enemy AI | 0.002630 | 0.011700 | 0.035400 | Linear in applicable enemy subset |
| 7 | 1 player movement | 0.001859 | 0.008100 | 0.035700 | Flat; one player |
| 8 | 4.7 ultimates | 0.001557 | 0.006600 | 0.007400 | Flat/inactive |
| 9 | 6 enemy contact damage | 0.001147 | 0.003800 | 0.006300 | E x players full scan |
| 10 | 5.4 zones | 0.001073 | 0.003900 | 0.018700 | Linear in zoner subset; no live zones |
| 11 | 5.2 enemy ranged fire | 0.000949 | 0.003100 | 0.024900 | Linear in enemy subset |
| 12 | 2 player body collision | 0.000784 | 0.003400 | 0.004900 | Flat; one player |
| 13 | 7 regen/death/status cleanup | 0.000776 | 0.004000 | 0.005300 | Flat; one player/no statuses |
| 14 | 5.6 enemy pitfalls | 0.000594 | 0.002100 | 0.009800 | Linear in enemies |
| 15 | 2.5 player pitfalls | 0.000460 | 0.001700 | 0.003500 | Flat; one player |
| 16 | 2.7 money/victory | 0.000261 | 0.001000 | 0.003800 | Flat/inactive |
| 17 | 3 clock/spawn director | 0.000237 | 0.000700 | 0.000900 | Flat because training suppresses director |
| 18 | 4.6 melee swings | 0.000233 | 0.001200 | 0.001600 | Flat/inactive |
| 19 | 5.15 boss AI | 0.000184 | 0.001000 | 0.003700 | Flat/inactive |
| 20 | 2.4 belt player collision | 0.000145 | 0.000500 | 0.001300 | Flat/non-belt |
| 21 | 4.65 deferred attacks | 0.000115 | 0.000400 | 0.000600 | Flat/inactive |
| 22 | 5.55 belt enemy collision | 0.000093 | 0.000600 | 0.001400 | Flat/non-belt |

## Enemy-count scaling

Projectile count is held at fourteen. Values are phase mean milliseconds. The total row is the
independently timed `stepSim` duration, including the phase-marker calls but excluding fixture
restoration.

| Phase | E=1 | E=5 | E=10 | E=25 | E=50 |
| --- | ---: | ---: | ---: | ---: | ---: |
| **Total stepSim** | **0.022811** | **0.028821** | **0.043547** | **0.104517** | **0.271174** |
| Total p99 | 0.083100 | 0.114000 | 0.087300 | 0.247900 | 0.525100 |
| 0 tick/input/grid/traversal | 0.001713 | 0.001971 | 0.002823 | 0.003707 | 0.006941 |
| 1 player movement | 0.001048 | 0.000776 | 0.000759 | 0.000845 | 0.001059 |
| 2 player body collision | 0.000426 | 0.000438 | 0.000465 | 0.000451 | 0.000542 |
| 2.4 belt player collision | 0.000084 | 0.000082 | 0.000113 | 0.000088 | 0.000111 |
| 2.5 player pitfalls | 0.000358 | 0.000324 | 0.000294 | 0.000300 | 0.000428 |
| 2.7 money/victory | 0.000142 | 0.000142 | 0.000181 | 0.000145 | 0.000182 |
| 3 clock/spawn director | 0.000151 | 0.000145 | 0.000200 | 0.000151 | 0.000179 |
| 4 player combat/resource | 0.002276 | 0.001697 | 0.001666 | 0.002477 | 0.003439 |
| 4.6 melee swings | 0.000166 | 0.000164 | 0.000173 | 0.000356 | 0.000202 |
| 4.65 deferred attacks | 0.000065 | 0.000070 | 0.000092 | 0.000070 | 0.000084 |
| 4.7 ultimates | 0.001040 | 0.000800 | 0.000862 | 0.000897 | 0.001059 |
| 5 generic enemy AI | 0.000331 | 0.001033 | 0.002784 | 0.007023 | 0.012107 |
| 5.1 enemy melee/combo AI | 0.001298 | 0.003913 | 0.005905 | 0.012766 | 0.016669 |
| 5.15 boss AI | 0.000121 | 0.000126 | 0.000128 | 0.000152 | 0.000170 |
| 5.2 enemy ranged fire | 0.000246 | 0.000578 | 0.001062 | 0.002242 | 0.003415 |
| 5.3 projectiles | 0.010761 | 0.007445 | 0.006967 | 0.008213 | 0.008091 |
| 5.4 zones | 0.000320 | 0.000837 | 0.001798 | 0.002189 | 0.002935 |
| 5.5 enemy body collision | 0.001221 | 0.006641 | 0.014588 | 0.058788 | 0.207473 |
| 5.55 belt enemy collision | 0.000071 | 0.000071 | 0.000074 | 0.000074 | 0.000107 |
| 5.6 enemy pitfalls | 0.000183 | 0.000371 | 0.000623 | 0.000806 | 0.001688 |
| 6 enemy contact damage | 0.000213 | 0.000641 | 0.001365 | 0.002134 | 0.003446 |
| 7 regen/death/status cleanup | 0.000402 | 0.000388 | 0.000447 | 0.000470 | 0.000627 |

The phase 5.5 curve is the sole clear superlinear curve. A runtime-only diagnostic that bypassed
candidate-array sorting changed the 50-enemy collision phase from 0.207473 to 0.082210 ms
(-0.125263 ms, -60.4%) and total `stepSim` from 0.271174 to 0.141134 ms (-0.130040 ms,
-48.0%). At six enemies, the adjacent-run collision change was only 0.006171 -> 0.005558 ms
(-0.000613 ms). This is an optimization target at high density, not the source of a 125.5 ms
six-enemy stall.

## Projectile-count scaling

Enemy count is held at six. Values are phase mean milliseconds.

| Phase | P=0 | P=5 | P=14 | P=25 | P=50 | P=100 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| **Total stepSim** | **0.018998** | **0.021188** | **0.026308** | **0.039441** | **0.041701** | **0.070041** |
| Total p99 | 0.073600 | 0.083000 | 0.072300 | 0.077900 | 0.105500 | 0.162000 |
| 0 tick/input/grid/traversal | 0.002000 | 0.001942 | 0.001982 | 0.002323 | 0.001876 | 0.002219 |
| 1 player movement | 0.000809 | 0.000674 | 0.000732 | 0.000908 | 0.000735 | 0.000834 |
| 2 player body collision | 0.000388 | 0.000360 | 0.000416 | 0.000611 | 0.000394 | 0.000599 |
| 2.4 belt player collision | 0.000118 | 0.000080 | 0.000099 | 0.000139 | 0.000089 | 0.000094 |
| 2.5 player pitfalls | 0.000272 | 0.000244 | 0.000280 | 0.000351 | 0.000269 | 0.000292 |
| 2.7 money/victory | 0.000133 | 0.000119 | 0.000131 | 0.000181 | 0.000133 | 0.000153 |
| 3 clock/spawn director | 0.000151 | 0.000138 | 0.000176 | 0.000259 | 0.000147 | 0.000152 |
| 4 player combat/resource | 0.001622 | 0.001502 | 0.001334 | 0.001689 | 0.001403 | 0.002668 |
| 4.6 melee swings | 0.000140 | 0.000126 | 0.000132 | 0.000196 | 0.000144 | 0.000150 |
| 4.65 deferred attacks | 0.000072 | 0.000066 | 0.000068 | 0.000114 | 0.000062 | 0.000068 |
| 4.7 ultimates | 0.000805 | 0.000794 | 0.000749 | 0.000936 | 0.001483 | 0.000800 |
| 5 generic enemy AI | 0.001338 | 0.001204 | 0.001597 | 0.001673 | 0.001330 | 0.001453 |
| 5.1 enemy melee/combo AI | 0.002333 | 0.002318 | 0.002205 | 0.002749 | 0.002118 | 0.002748 |
| 5.15 boss AI | 0.000130 | 0.000117 | 0.000126 | 0.000157 | 0.000129 | 0.000130 |
| 5.2 enemy ranged fire | 0.000482 | 0.000443 | 0.000570 | 0.000749 | 0.000471 | 0.000496 |
| 5.3 projectiles | 0.000151 | 0.002919 | 0.007440 | 0.016073 | 0.023195 | 0.048595 |
| 5.4 zones | 0.000480 | 0.000483 | 0.000525 | 0.000681 | 0.000542 | 0.000658 |
| 5.5 enemy body collision | 0.006129 | 0.006353 | 0.006171 | 0.007829 | 0.005812 | 0.006479 |
| 5.55 belt enemy collision | 0.000073 | 0.000066 | 0.000069 | 0.000087 | 0.000067 | 0.000064 |
| 5.6 enemy pitfalls | 0.000341 | 0.000282 | 0.000385 | 0.000430 | 0.000305 | 0.000304 |
| 6 enemy contact damage | 0.000440 | 0.000420 | 0.000456 | 0.000556 | 0.000453 | 0.000469 |
| 7 regen/death/status cleanup | 0.000433 | 0.000398 | 0.000505 | 0.000540 | 0.000383 | 0.000436 |

Projectile phase growth is near-linear: P=5 -> P=100 is a 20x entity increase and a 16.6x
phase-cost increase. No other phase responds materially to projectile count.

## Top three costs and source evidence

### 1. Phase 5.3 projectiles

Source: `packages/server/src/rooms/room/room-progression.ts:4679-4680`;
implementation at `packages/server/src/rooms/room/room-combat.ts:5119-5412`.

Evidence:

- 6/14: 0.011940 ms mean, 0.031100 ms p99.
- P=0/5/14/25/50/100: 0.000151 / 0.002919 / 0.007440 / 0.016073 /
  0.023195 / 0.048595 ms.
- Friendly projectiles use `enemyGrid.queryAabb/queryRadius` at
  `room-combat.ts:5275-5290`, not a full enemy scan.
- Hostile projectiles scan live players at `room-combat.ts:5231-5266`.
- It allocates `doomed` once per tick at `room-combat.ts:5120` and `kills` once per friendly
  projectile at `room-combat.ts:5270`.

### 2. Phase 5.5 enemy body collision

Source: `packages/server/src/rooms/room/room-progression.ts:4700-4702`;
implementation at `packages/server/src/rooms/room/room-enemies.ts:572-679`.

Evidence:

- 6/14: 0.010462 ms mean, 0.026300 ms p99.
- E=1/5/10/25/50: 0.001221 / 0.006641 / 0.014588 / 0.058788 /
  0.207473 ms.
- It does use `SpatialGrid`, querying at `room-enemies.ts:586-591`.
- `SpatialGrid.queryAabb` sorts every nontrivial result at
  `packages/server/src/rooms/SpatialGrid.ts:59-78`, then the ordinary-radius collision path sorts
  the same candidate scratch again at `room-enemies.ts:597-600`.
- Bypassing candidate sorting reduced the 50-enemy phase by 60.4%, measured above.

This is not a global O(E^2) full scan in the measured layout. It is a per-enemy neighborhood query
with repeated O(k log k) sorts; in a same-cell crowd, k approaches E and the worst case can become
superquadratic in comparison count. The measured layout produced approximately n^1.31, not n^2.

### 3. Phase 5.1 enemy melee/combo AI

Source: `packages/server/src/rooms/room/room-progression.ts:4671-4673`;
implementation at `packages/server/src/rooms/room/room-enemies.ts:1395-1814`.

Evidence:

- 6/14: 0.004596 ms mean, 0.017900 ms p99.
- E=1/5/10/25/50: 0.001298 / 0.003913 / 0.005905 / 0.012766 /
  0.016669 ms.
- It scans the enemy map once, and idle attackers call the O(players)
  `nearestLivingPlayer` at `room-enemies.ts:2461-2474`. That is E x players, not E^2.
- A diagnostic one-player target bypass did not yield a repeatable saving at 50 enemies
  (0.016669 ms baseline vs 0.018461 ms bypass); this path is too small to optimize on current
  one-player evidence.

## SpatialGrid and full-scan audit

`SpatialGrid` is active in the important pair-sensitive paths:

- grid rebuild: `room-enemies.ts:529-537`;
- friendly projectile broad phase: `room-combat.ts:5275-5290`;
- enemy body separation: `room-enemies.ts:576-641`.

The tick still contains intentional full scans, but none is an E x E loop in this fixture:

- generic AI scans E once (`room-progression.ts:4620-4670`);
- melee/combo AI scans E and performs O(players) target selection (`room-enemies.ts:1395-1434`);
- enemy pitfalls scan E once (`room-progression.ts:4728-4737`);
- contact damage scans E x players (`room-progression.ts:4749-4799`);
- ranged cooldown and zoner cooldown pruning allocate copied key arrays at
  `room-enemies.ts:1349` and `room-enemies.ts:2753`;
- generic dodge pruning allocates a copied key array at `room-progression.ts:4616`.

The broad phase is therefore present. The defect is repeated candidate ordering/allocation, not a
silent fallback to a global enemy-pair scan.

## Allocation / garbage

The allocation profile deliberately included objects already collected by minor and major GC, so
these are gross allocation estimates, not retained-heap deltas:

| Scenario | Gross bytes/tick | At 20 Hz |
| --- | ---: | ---: |
| Idle simulation, 1 player, 0 enemies, 0 projectiles | 6,596 | 0.132 MB/s |
| Representative simulation, 1 player, 6 enemies, 14 projectiles | 37,732 | 0.755 MB/s |
| Representative simulation + one real patch encode/tick | 55,346 | 1.107 MB/s |
| Load increment over idle, simulation only | 31,136 | 0.623 MB/s |
| Encoder increment over representative simulation | 17,614 | 0.352 MB/s |

The combined result is 57% of the owner's +1.93 MB/s. The missing portion could be active weapon
paths, socket/message work, other rooms, logging/telemetry, or sampling error. The owner rate is
not reproduced, but accidental per-tick garbage is confirmed.

The largest sampled simulation allocator was native `sort`: 11,109,816 sampled bytes over 1,200
ticks, or **9,258 bytes/tick (24.5% of simulation allocation)**. The caller chain is the
`SpatialGrid.queryAabb` ordering at `SpatialGrid.ts:76-78` and the redundant collision ordering at
`room-enemies.ts:597-600`. Other high allocation frames were iterator `next`/`values`,
`queryAabb/queryRadius`, the projectile callback, and array `push`.

The forced-GC retained values were noisy and are not a leak measurement. This harness can state
gross bytes per tick; it cannot establish whether the owner's 251 MB session peak is a monotonic
leak or a high-water mark. A multi-minute live soak with GC events and old-space after each major
GC is needed for that answer.

## `update()` sub-steps

The clean scheduler measurement used the production `update(deltaMs)` accumulator with a real
`setInterval(TICK_MS / 5)` driver for 10.014 seconds:

| Sub-steps in one invocation | Invocations | Share |
| ---: | ---: | ---: |
| 0 | 443 | 68.90% |
| 1 | 200 | 31.10% |
| 2+ | 0 | 0.00% |

Callback cost was 0.107638 ms mean / 0.518400 ms p99 / 0.842200 ms max. Actual timer intervals
were 15.573436 ms mean / 16.679000 ms p99 / 21.959000 ms max on Windows. None crossed the 50 ms
sub-step threshold far enough to batch two steps.

The code can run multiple steps: `room-progression.ts:3675-3686` caps the accumulator at 3.5 ticks
and drains it in a `while`, broadcasting once afterward. A 125.5 ms elapsed callback normally
drains two exact steps (possibly three depending on the prior remainder), which is the client's
whole-tick jump mechanism. It simply did not occur under the measured 6/14 headless load.

## `broadcastPatch()` cost

Representative dedicated result: **0.007753 ms mean, 0.018900 ms p99, 0.033600 ms max,
318 bytes**. That is 0.016% of the 50 ms budget by mean.

Enemy scaling at fourteen projectiles:

| Enemies | Mean ms | p99 ms | Patch bytes |
| ---: | ---: | ---: | ---: |
| 1 | 0.003841 | 0.011500 | 236 |
| 5 | 0.005243 | 0.017200 | 304 |
| 10 | 0.005570 | 0.017100 | 382 |
| 25 | 0.007733 | 0.018900 | 608 |
| 50 | 0.013509 | 0.063300 | 974 |

Projectile scaling at six enemies:

| Projectiles | Mean ms | p99 ms | Patch bytes |
| ---: | ---: | ---: | ---: |
| 0 | 0.001621 | 0.005300 | 108 |
| 5 | 0.002692 | 0.018000 | 183 |
| 14 | 0.005280 | 0.014300 | 318 |
| 25 | 0.006637 | 0.021100 | 483 |
| 50 | 0.012408 | 0.029500 | 858 |
| 100 | 0.026634 | 0.054300 | 1,643 |

Encoding is roughly linear in changed entity rows and is not material at 6/14. The allocation
increment from encoding is material garbage (17.6 KB/tick), but its measured CPU cost is not a
stall source.

## Catalog-proportional work

For 1,000 representative ticks the harness wrapped:

- `Object.keys`, `Object.values`, and `Object.entries` for `WEAPONS`, `ENEMY_KINDS`, and
  `AUGMENTS`;
- ID-array iteration and `indexOf` for `WEAPON_IDS`, `ENEMY_KIND_IDS`, and `AUGMENT_IDS`.

Every counter was **zero**. Source inspection agrees: tick paths perform keyed lookups against the
catalogs. Catalog-wide aggregation such as the max enemy radius at
`room-progression.ts:643` happens at module initialization, not per tick. No measured tick work is
proportional to weapon, enemy-kind, or augment catalog size.

## Ranked fix proposals — do not implement in this branch

1. **Preserve deterministic candidate order without sorting every query, and remove the second
   phase-5.5 sort.** Change `SpatialGrid` to emit stable insertion order using reusable integer
   order scratch/merge logic, then remove the already-redundant `room-enemies.ts:597-600` sort.
   Measured diagnostic ceiling: at 50 enemies, collision -0.125263 ms (-60.4%) and total
   `stepSim` -0.130040 ms (-48.0%); at six enemies, collision -0.000613 ms. It also targets up to
   9,258 sampled allocation bytes/tick at 6/14. Risk: **medium-high** — deterministic pair order,
   pierce target order, collision goldens, and exact stacked-body behavior must remain identical.

2. **Make projectile scratch room-owned and remove per-projectile `kills` allocation.** Reuse
   tick-local `doomed`/`kills` buffers and keep separate scratch for nested chain/ricochet damage;
   preserve the existing grid query and hit order. Expected saving cannot be measured without an
   implementation; the measured upper bound is the entire 6/14 projectile phase (0.011940 ms)
   and the sampled projectile callback contributes about 2.9 KB/tick. A realistic saving must be
   remeasured, not assumed. Risk: **medium** — aliased scratch across nested damage calls can lose
   kills or change pierce/ricochet ordering.

3. **Reuse live-player identity targets and remove copied-key prune arrays.** Pass a tick-local
   identity-bearing living-player scratch to melee/combo AI, and prune `dodgeState`,
   `enemyFireCd`, and `zonerDropCd` without `[...keys()]` copies. Expected CPU saving is not
   measurable on one-player evidence; the measured ceiling is phase 5.1 itself (0.004596 ms at
   six, 0.016669 ms at fifty), and the direct nearest-player bypass showed no repeatable benefit.
   The justification is garbage/co-op scaling, not current CPU. Risk: **medium** — target identity,
   duel-token ownership, and safe deletion during iteration are gameplay contracts.

None of these fixes plausibly converts 125.5 ms to budget at six enemies, because the measured
current total is already below 0.05 ms. The highest-value next diagnostic is a production
CPU+GC profile triggered by a >50 ms tick, annotated with room/entity counts and exact equipped
weapons, rather than speculative optimization of these microsecond phases.

## Verification

- `pnpm typecheck`: **PASS**.
- Full `pnpm test`: **PASS** — 247 test files, 2,951 passed, 20 skipped (2,971 total).
- Production source changes: **none**.

VERDICT: worst representative phase = 5.3 projectiles at 0.011940 ms mean / 0.031100 ms p99 (linear in projectiles; collision becomes ~n^1.31 and worst at 50 with 0.207473 ms); sub-steps/invocation at 6/14 = 0:443, 1:200, >1:0/643; broadcast = 0.007753 ms mean / 0.018900 ms p99; top fix = eliminate duplicate/per-query SpatialGrid candidate sorts, expected -0.000613 ms collision at 6 enemies and -0.125263 ms collision / -0.130040 ms total at 50; pnpm typecheck PASS; pnpm test PASS (247 files, 2,951 passed, 20 skipped).
