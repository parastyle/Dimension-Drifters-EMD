# B51 warp correction telemetry: before / after

Both captures used the same 41-scenario solo Colyseus harness and production `SelfPredictor`.
Rows retain the original severity ranking so the fixed build can be compared against each
pre-fix offender directly. `Bands` are `silent/smooth/snap`.

| Before rank | Scenario | Before nonzero | Before total px | Before max px | Before bands | After rank | After nonzero | After total px | After max px | After bands |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | elevator-board | 2 | 3883.036739 | 3570 | 0/0/2 | 1 | 0 | 0 | 0 | 0/0/0 |
| 2 | ultimate-alpha-strike | 5 | 1209.171721 | 444.894457 | 0/2/3 | 28 | 0 | 0 | 0 | 0/0/0 |
| 3 | pit-fall | 1 | 320 | 320 | 0/0/1 | 31 | 0 | 0 | 0 | 0/0/0 |
| 4 | slide-hop | 11 | 284.357143 | 70.857143 | 0/11/0 | 7 | 0 | 0 | 0 | 0/0/0 |
| 5 | jump-pound | 6 | 119.571429 | 31 | 0/6/0 | 13 | 0 | 0 | 0 | 0/0/0 |
| 6 | dodge-roll | 6 | 110.5 | 32 | 0/6/0 | 27 | 0 | 0 | 0 | 0/0/0 |
| 7 | parry-left | 1 | 25.6 | 25.6 | 0/1/0 | 29 | 0 | 0 | 0 | 0/0/0 |
| 8 | parry-right | 1 | 25.6 | 25.6 | 0/1/0 | 30 | 0 | 0 | 0 | 0/0/0 |
| 9 | gun-shotgun | 4 | 20.597461 | 8.447886 | 1/3/0 | 26 | 0 | 0 | 0 | 0/0/0 |
| 10 | sustained-gatling | 15 | 17.78639 | 1.532433 | 15/0/0 | 2 | 0 | 0 | 0 | 0/0/0 |
| 11 | gun-blunderbuss | 4 | 17.390449 | 8.55 | 2/2/0 | 15 | 0 | 0 | 0 | 0/0/0 |
| 12 | gun-marksman-rifle | 4 | 14.847986 | 7.3 | 2/2/0 | 23 | 0 | 0 | 0 | 0/0/0 |
| 13 | parry-below | 4 | 10.863938 | 4.349436 | 2/2/0 | 8 | 0 | 0 | 0 | 0/0/0 |
| 14 | gun-heavy-ordnance | 4 | 9.633976 | 4.736537 | 2/2/0 | 20 | 0 | 0 | 0 | 0/0/0 |
| 15 | gun-lever-rifle | 3 | 5.963845 | 3.411311 | 2/1/0 | 21 | 0 | 0 | 0 | 0/0/0 |
| 16 | gun-auto-rifle | 3 | 5.573687 | 3.188141 | 2/1/0 | 14 | 0 | 0 | 0 | 0/0/0 |
| 17 | gun-hand-cannon | 2 | 3.30325 | 2.988287 | 2/0/0 | 10 | 0 | 0 | 0 | 0/0/0 |
| 18 | gun-scrap-cannon | 2 | 2.889045 | 2.294276 | 2/0/0 | 25 | 0 | 0 | 0 | 0/0/0 |
| 19 | gun-railgun | 1 | 2.882935 | 2.882935 | 1/0/0 | 12 | 0 | 0 | 0 | 0/0/0 |
| 20 | gun-pistol | 1 | 2.327343 | 2.327343 | 1/0/0 | 11 | 0 | 0 | 0 | 0/0/0 |
| 21 | gun-grenade-launcher | 1 | 2.307238 | 2.307238 | 1/0/0 | 19 | 0 | 0 | 0 | 0/0/0 |
| 22 | gun-exotic-ranged | 1 | 1.633214 | 1.633214 | 1/0/0 | 17 | 0 | 0 | 0 | 0/0/0 |
| 23 | gun-concussion-cannon | 1 | 1.4381 | 1.4381 | 1/0/0 | 16 | 0 | 0 | 0 | 0/0/0 |
| 24 | beam-x2-stormcaller-tesla-gatling | 9 | 0.95 | 0.19 | 9/0/0 | 6 | 0 | 0 | 0 | 0/0/0 |
| 25 | gun-nailgun | 1 | 0.924561 | 0.924561 | 1/0/0 | 24 | 0 | 0 | 0 | 0/0/0 |
| 26 | gun-machine-pistol | 1 | 0.733272 | 0.733272 | 1/0/0 | 22 | 0 | 0 | 0 | 0/0/0 |
| 27 | beam-x2-mirage-coilrifle | 8 | 0.6975 | 0.155 | 8/0/0 | 5 | 0 | 0 | 0 | 0/0/0 |
| 28 | beam-x2-permafrost-siege-lobber | 6 | 0.5425 | 0.155 | 6/0/0 | 4 | 0 | 0 | 0 | 0/0/0 |
| 29 | beam-x2-doomsday-drum-cannon | 5 | 0.475 | 0.095 | 5/0/0 | 3 | 0 | 0 | 0 | 0/0/0 |
| 30 | gun-gauntlet | 1 | 0.404982 | 0.404982 | 1/0/0 | 18 | 0 | 0 | 0 | 0/0/0 |
| 31 | gun-gun | 0 | 0 | 0 | 0/0/0 | 9 | 0 | 0 | 0 | 0/0/0 |
| 32 | chest-open | 0 | 0 | 0 | 0/0/0 | 32 | 0 | 0 | 0 | 0/0/0 |
| 33 | kung-fu-wrap-x2-drunken-fist-wraps | 0 | 0 | 0 | 0/0/0 | 33 | 0 | 0 | 0 | 0/0/0 |
| 34 | kung-fu-wrap-x2-iron-palm-wraps | 0 | 0 | 0 | 0/0/0 | 34 | 0 | 0 | 0 | 0/0/0 |
| 35 | kung-fu-wrap-x2-muay-thai-wraps | 0 | 0 | 0 | 0/0/0 | 35 | 0 | 0 | 0 | 0/0/0 |
| 36 | kung-fu-wrap-x2-wing-chun-wraps | 0 | 0 | 0 | 0/0/0 | 36 | 0 | 0 | 0 | 0/0/0 |
| 37 | melee-attack-move-stop | 0 | 0 | 0 | 0/0/0 | 37 | 0 | 0 | 0 | 0/0/0 |
| 38 | parry-above | 0 | 0 | 0 | 0/0/0 | 38 | 0 | 0 | 0 | 0/0/0 |
| 39 | spade-spin | 0 | 0 | 0 | 0/0/0 | 39 | 0 | 0 | 0 | 0/0/0 |
| 40 | sparkmitt-x2-coyote-trickster-s-sparkmitt | 0 | 0 | 0 | 0/0/0 | 40 | 0 | 0 | 0 | 0/0/0 |
| 41 | walk-stop | 0 | 0 | 0 | 0/0/0 | 41 | 0 | 0 | 0 | 0/0/0 |

## Totals and acceptance

| Capture | Correction requests | Nonzero corrections | Silent | Smooth | Snap | Total magnitude |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Before | 449 | 114 | 68 | 40 | 6 | 6102.003706 px |
| After | 0 | 0 | 0 | 0 | 0 | 0 px |

Acceptance: **PASS** — 41/41 scenarios ran, every scenario had zero nonzero corrections, and
there were zero snaps.
