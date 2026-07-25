# Solo localhost rubberband telemetry diagnosis

Captured 2026-07-25 on branch `sol/diag-rb-telemetry` after B42 (`3a05a22`), B44
(`e9c94ad`), and B45 (`8d70bf3`). This is diagnosis only. No game-code fix is included.

## Result

Solo localhost does not have zero self-corrections. The clean 41-scenario run recorded:

- 35 B42 public counter edges;
- 449 calls to the production predictor's movement-correction path;
- 114 calls with a nonzero correction vector;
- 6,102.004 px of cumulative requested correction magnitude;
- 68 silent, 40 smooth, and 6 snap-band nonzero corrections.

The dominant events are authored placements, not ordinary locomotion: the corporate elevator made
two snap corrections totalling 3,883.037 px, Alpha Strike made five corrections totalling
1,209.172 px, and pit snap-back made one 320 px correction. Walk/stop, ordinary melee
attack-move-stop, chest open, all four completed kung-fu wrap combos, Sparkmitt's completed
eight-beat combo, Spade spin, and the above-direction parry were clean.

The complete machine-readable evidence is in
[`run-summary.json`](../owner-notes-audit-v12-evidence/diag-rb-telemetry/run-summary.json),
[`run-telemetry.json`](../owner-notes-audit-v12-evidence/diag-rb-telemetry/run-telemetry.json), and
[`top-offender-traces.json`](../owner-notes-audit-v12-evidence/diag-rb-telemetry/top-offender-traces.json).

## Method and metric definitions

The harness in [`tools/diag-rb-telemetry.mts`](../../tools/diag-rb-telemetry.mts) started the real
Colyseus game server on OS-assigned loopback port `52761`, joined one real `colyseus.js` client,
and drove the production `SelfPredictor` at the 50 ms fixed tick. Ports `5180` and `2567` were
untouched. The top-down scenarios used training mode. The elevator used the corporate belt room
with belt combat-wave spawning suppressed so enemy hits could not contaminate the placement trace.

Instrumentation wrapped the predictor instance's private `applyMovementCorrection()` method and
the local diagnostic room's motion-source map. It did not edit runtime client, server, or shared
game code. Every server patch was retained in tick order, including one-tick parry and pit states.
Gun coverage selected the highest-recoil active representative of each of the 17 live
`weapon.tags.family` values. All four ranged beam definitions were measured separately, followed
by the sustained Gatling scenario.

Table terms:

- **B42**: increase in `stats.selfCorrections`. This counts a correction-sequence edge,
  server-motion epoch edge, or teleport edge, not every reconciliation.
- **Apply**: every call to `applyMovementCorrection()`, including a zero vector while
  `serverMotionActive` is true.
- **NZ**: apply calls whose vector magnitude was greater than `0.000001` px. These are the
  correction counts used in the verdict.
- **Total/peak px**: sum and maximum of the requested nonzero vector magnitudes.
- **Debt ms**: sampled duration for which smooth correction debt remained. Silent and snap
  corrections have no debt. Smooth debt is capped at 140 ms.
- **Motion ms**: total sampled time for which the authority source was active.
- Bands are silent below 3 px, smooth from 3 px through 199.999 px, and snap at 200 px or more.

Severity is ranked by cumulative nonzero correction magnitude, then correction count, then
server-motion duration.

## Ranked scenario map

| Rank | Scenario | B42 | Apply | NZ | Total px | Peak px | Debt ms | Motion ms | Motion source at nonzero correction |
|---:|---|---:|---:|---:|---:|---:|---:|---:|---|
| 1 | Corporate elevator board / depart / arrive | 2 | 90 | 2 | 3883.037 | 3570.000 | 0 | 4500 | `elevator-boarding` |
| 2 | Ultimate — Alpha Strike (4 targets) | 4 | 6 | 5 | 1209.172 | 444.894 | 100 | 300 | `ultimate` |
| 3 | Pit fall / snap-back | 1 | 1 | 1 | 320.000 | 320.000 | 0 | 50 | `pit-snapback` |
| 4 | Slide-hop input chain | 1 | 17 | 11 | 284.357 | 70.857 | 520 | 850 | `dodge-roll`, `distance-jump` |
| 5 | Distance jump / pound | 1 | 9 | 6 | 119.571 | 31.000 | 280 | 450 | `distance-jump` |
| 6 | Dodge roll | 1 | 6 | 6 | 110.500 | 32.000 | 280 | 300 | `dodge-roll` |
| 7 | Parry — incoming from left | 1 | 1 | 1 | 25.600 | 25.600 | 50 | 50 | `parry-slide` |
| 8 | Parry — incoming from right | 1 | 1 | 1 | 25.600 | 25.600 | 50 | 50 | `parry-slide` |
| 9 | Gun class — shotgun | 1 | 9 | 4 | 20.597 | 8.448 | 140 | 450 | `weapon-fire-recoil` |
| 10 | Sustained Gatling | 1 | 43 | 15 | 17.786 | 1.532 | 0 | 2150 | `weapon-fire-recoil` |
| 11 | Gun class — blunderbuss | 1 | 9 | 4 | 17.390 | 8.550 | 100 | 450 | `weapon-fire-recoil` |
| 12 | Gun class — marksman-rifle | 1 | 10 | 4 | 14.848 | 7.300 | 100 | 500 | `weapon-fire-recoil` |
| 13 | Parry — incoming from below | 1 | 10 | 4 | 10.864 | 4.349 | 100 | 500 | `parry-launch` |
| 14 | Gun class — heavy-ordnance | 1 | 10 | 4 | 9.634 | 4.737 | 100 | 500 | `weapon-fire-recoil` |
| 15 | Gun class — lever-rifle | 1 | 9 | 3 | 5.964 | 3.411 | 50 | 450 | `weapon-fire-recoil` |
| 16 | Gun class — auto-rifle | 1 | 9 | 3 | 5.574 | 3.188 | 50 | 450 | `weapon-fire-recoil` |
| 17 | Gun class — hand-cannon | 1 | 10 | 2 | 3.303 | 2.988 | 0 | 500 | `weapon-fire-recoil` |
| 18 | Gun class — scrap-cannon | 1 | 9 | 2 | 2.889 | 2.294 | 0 | 450 | `weapon-fire-recoil` |
| 19 | Gun class — railgun | 1 | 9 | 1 | 2.883 | 2.883 | 0 | 450 | `weapon-fire-recoil` |
| 20 | Gun class — pistol | 1 | 9 | 1 | 2.327 | 2.327 | 0 | 450 | `weapon-fire-recoil` |
| 21 | Gun class — grenade-launcher | 1 | 10 | 1 | 2.307 | 2.307 | 0 | 500 | `weapon-fire-recoil` |
| 22 | Gun class — exotic-ranged | 1 | 10 | 1 | 1.633 | 1.633 | 0 | 500 | `weapon-fire-recoil` |
| 23 | Gun class — concussion-cannon | 1 | 10 | 1 | 1.438 | 1.438 | 0 | 500 | `weapon-fire-recoil` |
| 24 | Ranged beam — Stormcaller Tesla Gatling | 1 | 25 | 9 | 0.950 | 0.190 | 0 | 1250 | `weapon-fire-recoil` |
| 25 | Gun class — nailgun | 1 | 9 | 1 | 0.925 | 0.925 | 0 | 450 | `weapon-fire-recoil` |
| 26 | Gun class — machine-pistol | 1 | 9 | 1 | 0.733 | 0.733 | 0 | 450 | `weapon-fire-recoil` |
| 27 | Ranged beam — Mirage Coilrifle | 1 | 25 | 8 | 0.698 | 0.155 | 0 | 1250 | `weapon-fire-recoil` |
| 28 | Ranged beam — Permafrost Siege Lobber | 1 | 27 | 6 | 0.542 | 0.155 | 0 | 1350 | `weapon-fire-recoil` |
| 29 | Ranged beam — Doomsday Drum Cannon | 1 | 27 | 5 | 0.475 | 0.095 | 0 | 1350 | `weapon-fire-recoil` |
| 30 | Gun class — gauntlet | 1 | 10 | 1 | 0.405 | 0.405 | 0 | 500 | `weapon-fire-recoil` |
| 31 | Gun class — gun (single Gatling shot) | 1 | 10 | 0 | 0.000 | 0.000 | 0 | 500 | active `weapon-fire-recoil`; zero vector |
| 32 | Chest open | 0 | 0 | 0 | 0.000 | 0.000 | 0 | 0 | — |
| 33 | Kung-fu wrap — Drunken Fist Wraps | 0 | 0 | 0 | 0.000 | 0.000 | 0 | 0 | — |
| 34 | Kung-fu wrap — Iron Palm Wraps | 0 | 0 | 0 | 0.000 | 0.000 | 0 | 0 | — |
| 35 | Kung-fu wrap — Muay Thai Wraps | 0 | 0 | 0 | 0.000 | 0.000 | 0 | 0 | — |
| 36 | Kung-fu wrap — Wing Chun Wraps | 0 | 0 | 0 | 0.000 | 0.000 | 0 | 0 | — |
| 37 | Attack / move / stop — Cinderbrand Cleaver | 0 | 0 | 0 | 0.000 | 0.000 | 0 | 0 | — |
| 38 | Parry — incoming from above | 0 | 0 | 0 | 0.000 | 0.000 | 0 | 0 | — |
| 39 | Gravedigger's Spade spin | 0 | 0 | 0 | 0.000 | 0.000 | 0 | 0 | — |
| 40 | Sparkmitt eight-beat combo | 0 | 0 | 0 | 0.000 | 0.000 | 0 | 0 | — |
| 41 | Walk / stop | 0 | 0 | 0 | 0.000 | 0.000 | 0 | 0 | — |

## Trigger map by authority source

Every nonzero event in this run had an explicit source. There were no unclassified correction
vectors.

| Authority source | B42 | Apply | NZ | Total px | Peak px | Nonzero bands | Scenario coverage |
|---|---:|---:|---:|---:|---:|---|---|
| `elevator-boarding` | 2 | 90 | 2 | 3883.037 | 3570.000 | 2 snap | elevator |
| `ultimate` | 4 | 6 | 5 | 1209.172 | 444.894 | 2 smooth, 3 snap | Alpha Strike |
| `pit-snapback` | 1 | 1 | 1 | 320.000 | 320.000 | 1 snap | pit fall |
| `distance-jump` | 1 | 20 | 12 | 296.571 | 70.857 | 12 smooth | jump/pound, slide-hop |
| `dodge-roll` | 2 | 12 | 11 | 217.857 | 32.000 | 11 smooth | dodge, slide-hop |
| `weapon-fire-recoil` | 22 | 308 | 77 | 113.303 | 8.550 | 66 silent, 11 smooth | 17 gun families, 4 beams, sustained Gatling |
| `parry-slide` | 2 | 2 | 2 | 51.200 | 25.600 | 2 smooth | left/right parry |
| `parry-launch` | 1 | 10 | 4 | 10.864 | 4.349 | 2 silent, 2 smooth | below parry |

The requested `slide-hop` source never appeared. That scenario was actually a `dodge-roll` window
followed by `distance-jump`; its 11 corrections must be assigned to those two sources. In the
jump/pound scenario all six nonzero events were `distance-jump`; the pound did not create a
separate correction source. Above-direction parry had no displacement source and no correction.

## Top-offender tick traces

### 1. Corporate elevator

| Frame | Server tick | Time ms | Authoritative position | Step px | Epoch | Teleport | B42 | Apply vector | Band/source |
|---:|---:|---:|---|---:|---:|---:|---:|---|---|
| 43 | 60 | 2150 | (4056, 2224) | 0.000 | 0 | 0 | 0 | none | inactive |
| 44 | 62 | 2200 | (3990, 2530) | 313.037 | 1 | 1 | 1 | (66, -306), 313.037 px | snap, `elevator-boarding` |
| 45 | 63 | 2250 | (3990, 2530) | 0.000 | 1 | 1 | 0 | (0, 0) | silent, `elevator-boarding` |
| 51 | 71 | 2550 | (3990, 2530) | 0.000 | 1 | 1 | 0 | (0, 0) | silent, `elevator-boarding` |
| 52 | 74 | 2600 | (420, 2530) | 3570.000 | 1 | 2 | 1 | (3570, 0), 3570.000 px | snap, `elevator-boarding` |
| 53 | 75 | 2650 | (420, 2530) | 0.000 | 1 | 2 | 0 | (0, 0) | silent, `elevator-boarding` |

The departure placement and cross-floor arrival are both teleports. The active elevator window
lasted 4.5 seconds and called the correction path 90 times, but 88 calls were exactly zero. The two
visible cuts are 313.037 px when boarding and 3,570 px at the new floor.

### 2. Alpha Strike

| Frame | Server tick | Time ms | Authoritative position | Step px | Epoch | Teleport | B42 | Correction px | Band |
|---:|---:|---:|---|---:|---:|---:|---:|---:|---|
| 0 | 1509 | 0 | (2200.000, 1500.000) | 0.000 | 30 | 2 | 0 | 0.000 | inactive |
| 1 | 1511 | 50 | (2326.000, 1500.000) | 126.000 | 31 | 4 | 1 | 126.000 | smooth |
| 2 | 1512 | 100 | (2326.000, 1500.000) | 0.000 | 31 | 4 | 0 | 81.000 | smooth debt |
| 3 | 1513 | 150 | (2224.304, 1701.778) | 225.957 | 31 | 5 | 1 | 212.204 | snap |
| 4 | 1515 | 200 | (1926.589, 1527.303) | 345.073 | 31 | 6 | 1 | 345.073 | snap |
| 5 | 1516 | 250 | (1926.589, 1527.303) | 0.000 | 31 | 6 | 0 | 0.000 | silent |
| 6 | 1517 | 300 | (2170.406, 1155.169) | 444.894 | 31 | 7 | 1 | 444.894 | snap |
| 7 | 1520 | 350 | (2170.406, 1155.169) | 0.000 | 31 | 7 | 0 | 0.000 | inactive |

One motion epoch contains four teleport edges. The first 126 px correction opens smooth debt, and
the unchanged next patch applies an additional 81 px without incrementing B42. Three later target
placements snap.

### 3. Pit fall

| Frame | Server tick | Time ms | Authoritative position | Step px | Correction/epoch/teleport delta | Apply vector | Source |
|---:|---:|---:|---|---:|---|---|---|
| 0 | 1242 | 0 | (1880, 1500) | 320.000 | +1 / +1 / +1 | (320, 0), 320 px snap | `pit-snapback` |
| 1 | 1244 | 50 | (1880, 1500) | 0.000 | 0 / 0 / 0 | none | inactive |

The pit event is the only top-three case that raises all three B42 causes together: movement
envelope rejection, server-motion epoch, and teleport.

## Diagnosis

1. **B42 telemetry substantially undercounts active-window work.** The public counter advances only
   on a correction-sequence edge, server-motion epoch edge, or teleport edge
   (`prediction.ts:1294-1315`). Reconciliation nevertheless requests a correction on every patch
   while `serverMotionActive` is true (`prediction.ts:1306-1312`, `1432-1436`). That produced 35
   public edges versus 449 correction-path calls and 114 nonzero vectors.

2. **B45 recoil is the high-frequency offender.** `applyWeaponFireRecoil()` adds authoritative root
   velocity and opens a 12-tick `weapon-fire-recoil` window
   (`room-combat.ts:3917-3935`). Across the 22 recoil scenarios it produced 308 correction-path
   calls and 77 nonzero vectors, while B42 exposed only 22 edges. Sustained Gatling alone produced
   43 calls and 15 nonzero vectors under one B42 edge.

3. **The client predictor has a recoil prediction rail, but the live attack path does not call it.**
   `SelfPredictor.addPredictedImpulse()` is documented as the gun-recoil prediction entry point
   (`prediction.ts:982-990`). The only production search hit is its declaration; `ArenaScene.sendAttack()`
   predicts camera shake, muzzle flash, audio, and sends `attack`, but never adds root recoil
   (`ArenaScene.ts:9665-10031`). Therefore every accepted B45 recoil begins as server-only root
   motion and is reconciled for the active window. This is a data finding, not a proposed fix.

4. **B44's ordinary no-drift paths remain clean.** Walk/stop, melee attack-move-stop, all completed
   wrap/Sparkmitt combos, and Spade spin produced no correction requests. The observed melee and
   special-weapon paths did not reintroduce generic weapon-driven root motion.

5. **Traversal correction labels are precise but coarse at the scenario name level.** Slide-hop is
   not an active source in this run; it composes dodge-roll and distance-jump authority. Pound also
   did not add a separate source. This matters when using scenario names as telemetry labels.

## Reproduction and evidence

From the repository root:

```powershell
pnpm --filter @dd/shared build
pnpm --filter @dd/server exec tsx ../../tools/diag-rb-telemetry.mts
```

Evidence inventory:

- [`README.md`](../owner-notes-audit-v12-evidence/diag-rb-telemetry/README.md): capture identity
  and command;
- [`run.log`](../owner-notes-audit-v12-evidence/diag-rb-telemetry/run.log): compact per-scenario
  ledger;
- [`run-summary.json`](../owner-notes-audit-v12-evidence/diag-rb-telemetry/run-summary.json):
  ranked data;
- [`run-telemetry.json`](../owner-notes-audit-v12-evidence/diag-rb-telemetry/run-telemetry.json):
  all frames and all correction-path calls;
- [`top-offender-traces.json`](../owner-notes-audit-v12-evidence/diag-rb-telemetry/top-offender-traces.json):
  compact top-three traces.

verdict: 41 scenarios, top-3 offenders elevator-board (2), ultimate-alpha-strike (5), pit-fall (1).
