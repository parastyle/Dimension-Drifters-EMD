# B90 — Lava Foundry guaranteed gaps

## Outcome

Lava Foundry placement is now deterministic graph construction. It no longer guesses whole layouts,
permits visible-rectangle overlap, retries 32 times, or exposes the old placement-exhaustion crash.
Every returned layout has:

- at least `LAVA_MIN_PLATFORM_CLEARANCE_PX = 72` px between every two distinct walkable collision
  surfaces;
- at most `LAVA_MAX_TRAVERSAL_GAP_PX = 340` px on every graph crossing, retaining the existing 32 px
  margin beneath the shipped 372 px distance jump;
- all visible bounds inside the existing 12 px map margin and 4800×4800 arena;
- every platform and massive room at `nativeScale: 1`.

The final verifier still measures every pair and graph edge and asserts these postconditions. It is a
tripwire for future collision-registry changes, not a placement mechanism.

## Construction algorithm

The abstract graph remains:

```text
spawn → route → hub → exit
                  ↘ branch → reward
```

For each graph edge, the seeded generator chooses a direction and a target in the feasible subset of
`[72, 340]` (ordinary targets remain 72–124 px). It places the child outside an axis-aligned barrier
at 72 px collision-bounds separation, measures the real polygon distance, and solves monotonically
outward to the chosen exact surface distance. The bounds barrier is only a construction proof for
non-edge rooms; it is not the reported clearance metric.

Rows and columns are built around separating bands. Rooms in adjacent bands cannot touch because
their complete collision bounds are on opposite sides of a 72 px barrier. Rooms in the same band are
placed outward from their graph parent through the same barrier operation. Landscape hub, landscape
reward, portrait hub, and portrait exit templates handle the 4K geometry without scaling. Crossings
are aligned to a deterministic longest flat support segment, or a deterministic extreme vertex when
the silhouette has a pointed edge. That keeps the exact shortest crossing usable by the shipped
20 px navigation raster rather than hiding it on an unrelated corner.

After construction, one translation centres the visible envelope in the available arena. Translation
does not change any gap. The seeded RNG decisions and numeric solve are deterministic; the evidence
digest is now `b03c4dba73073fe1d4eb9f402b0cd20af9c9f5b6464b0c9258c866a8ced9ea6c`.

Spawn remains fixed to `broken-security-gate-platform`. This is deliberate: the existing test proves
the full ±100 px join footprint on that deck is ground. Randomizing spawn among irregular decks would
require a separate safe-footprint selection contract and was not worth weakening that established
spawn guarantee. All other regular assignments are seeded, with the three narrowest collision
envelopes shuffled through the three-room middle band.

## Clearance metric

`measureLavaRoomClearance` computes the exact minimum Euclidean distance between the two filled
collision-polygon sets in world/source pixels:

1. translate every outer and hole boundary segment by the room's native-scale world position;
2. return zero for boundary intersection/touching;
3. return zero for filled-polygon containment;
4. otherwise take the minimum segment-to-segment distance across all outer and hole boundaries.

Thus transparent PNG margins, image dimensions, and `visibleBounds` do not participate. Holes remain
non-walkable, and the collision JSON/painter data was not weakened or edited. Collision bounds are
used only as conservative separating barriers: separation of those bounds proves the irregular
surfaces cannot collide, while the exact polygon metric supplies each realised graph gap.

## Deterministic degradation ladder

The old 32 random candidates and exhaustion throw were replaced with finite capabilities:

0. requested seeded prefabs, hero role, directions, and ordinary gaps;
1. retain the requested hero/role, use compact gaps and the smaller regular-prefab order;
2. retain the same hero but reroute it between its orientation-safe hub and destination template;
3. deterministic regular-only compact graph;
4. deterministic regular-only compact graph with reward coalesced into hub.

Each rung either constructs an invariant-safe layout or is known not to fit the visible arena
envelope; it never returns a touching or over-budget candidate. Rung 4 is smaller than the arena by
construction. The only remaining throw is the final impossible-state tripwire if future registry
data invalidates that proof. No sampled seed reached rungs 3 or 4, so no requested massive room was
dropped.

Over seeds 1–2000, 1780 used rung 0, 171 used rung 1, and 49 used rung 2.

Rung 1 seeds:

```text
4, 9, 15, 18, 21, 26, 40, 62, 72, 82, 87, 118, 120, 152, 164, 181, 198, 215, 224,
227, 231, 242, 243, 259, 274, 279, 290, 306, 308, 329, 331, 337, 350, 358, 385, 391,
393, 408, 414, 420, 429, 440, 451, 479, 486, 487, 500, 501, 503, 505, 510, 532, 548,
549, 584, 618, 623, 637, 643, 647, 650, 660, 676, 680, 683, 700, 708, 720, 747, 750,
761, 765, 767, 772, 776, 778, 789, 797, 803, 821, 834, 837, 842, 869, 876, 879, 888,
903, 911, 913, 934, 941, 944, 949, 964, 965, 986, 1005, 1013, 1020, 1029, 1037, 1038,
1039, 1049, 1051, 1077, 1085, 1086, 1114, 1140, 1143, 1158, 1205, 1210, 1223, 1248,
1253, 1278, 1310, 1311, 1324, 1352, 1385, 1388, 1395, 1404, 1446, 1450, 1466, 1478,
1494, 1499, 1539, 1549, 1551, 1588, 1591, 1592, 1600, 1608, 1620, 1629, 1646, 1652,
1654, 1667, 1681, 1684, 1697, 1721, 1738, 1740, 1777, 1787, 1793, 1795, 1797, 1813,
1849, 1860, 1873, 1897, 1898, 1907, 1913, 1936, 1958, 1972, 1978, 1999
```

Rung 2 seeds:

```text
24, 35, 53, 74, 147, 345, 399, 438, 454, 455, 557, 602, 604, 640, 710, 733, 795,
1002, 1011, 1061, 1088, 1097, 1116, 1219, 1226, 1230, 1237, 1405, 1429, 1430, 1486,
1529, 1533, 1541, 1543, 1544, 1593, 1595, 1623, 1647, 1649, 1661, 1663, 1665, 1769,
1798, 1875, 1909, 1946
```

## Seed-sweep measurements

The comparison uses seeds 1–2000 from the permanent property test and the same exact collision
polygon metric on both versions.

| Measurement | Before | After |
| --- | ---: | ---: |
| Generation throws | 0 | 0 |
| Seeds below 72 px pair clearance | 638 / 2000 | 0 / 2000 |
| Graph-edge gap min / median / max | 0 / 114.85 / 319.8 px | 72 / 108 / 324 px |
| Any 4K massive room | 341 / 2000 (17.05%) | 1017 / 2000 (50.85%) |
| `broken-mega-arena` specifically | 103 / 2000 (5.15%) | 252 / 2000 (12.60%) |
| Massive destination (`reward` or `exit`) | 0 / 2000 | 459 / 2000 (22.95%) |

Afterward, massive-role counts were hub 558, reward 347, and exit 112. Per-prefab appearances were
`broken-mega-arena` 252, `dual-turntable-bridge` 244, `security-to-turntable-bridge` 274, and
`glass-to-reactor-vertical-bridge` 247. `broken-mega-arena` itself occupied reward on 87 maps.

The property test measures all distinct room pairs, all 10,000 graph edges, generation completion,
native scale, hero indivisibility, hero destination frequency, and zero rejected placements. The
existing full-map test also rasterizes and runs `validateArena` across 100 seeds. The five historical
dimensions still route through their exact prior generator path.

## Scope and verification

- `pnpm gen:check` — pass. Its existing VFX-subject check reported unavailable untracked reference
  artifacts and skipped that optional comparison; all available generated outputs were in sync.
- `pnpm typecheck` — pass.
- `pnpm test` run 1 — pass: 248 files, 2963 passed, 20 skipped.
- `pnpm test` run 2 — pass: 248 files, 2963 passed, 20 skipped.
- LF endings retained.
- `SCHEMA_VERSION` unchanged because no Colyseus wire field changed; the added layout diagnostics are
  local deterministic map metadata.
- Canon L09/L10/L11 paths are untouched.
- `data/weapon-concepts-300.json`, the walkability painter, collision data, and all art are untouched.
- The five near-identical regular platform images remain an art-order problem and are intentionally
  out of scope.

VERDICT: construction method=seeded graph-first directional barrier construction; clearance metric=exact Euclidean filled collision-polygon distance including holes; min/median/max gap=72/108/324 px; seeds swept=2000; throws eliminated=yes; hero rate before/after=17.05%/50.85%; 2x test results=PASS (248 files, 2963 passed, 20 skipped each).
