# V3X auto-rifle balance placement

Reference cohort: the 28 pre-V3X catalog guns with one projectile, no authored burst, and an automatic
cadence of 0.25 seconds or faster. This avoids comparing the new foregrip rifles to shotguns, grenade
launchers, and deliberately slow marksman weapons.

- Median firing DPS (`damage / fireRate`): **37.50**.
- Median magazine-cycle DPS (`damage * magazine / (fireRate * magazine + reloadSeconds)`): **22.95**.

| Weapon                  | Element / role          | Damage | Fire rate | Magazine / reload | Firing DPS | Cycle DPS | Placement                                                                                |
| ----------------------- | ----------------------- | -----: | --------: | ----------------: | ---------: | --------: | ---------------------------------------------------------------------------------------- |
| Gravedog Auto-Rifle     | Physical workhorse      |      5 |    0.16 s |       24 / 1.60 s |      31.25 |     22.06 | Stable, forgiving magazine; 3.9% below cohort cycle median.                              |
| Stormspur Coil Carbine  | Shock precision carbine |      4 |    0.12 s |       21 / 1.45 s |      33.33 |     21.16 | Fastest cadence and longest range, paid for by the lowest per-shot damage and cycle DPS. |
| Brimstone Gallows-Rifle | Fire heavy rifle        |      8 |    0.25 s |       18 / 2.10 s |      32.00 |     21.82 | Heaviest hit and recoil, paid for by cadence, spread, and reload.                        |

All three sit below the comparable cohort's firing and magazine-cycle medians. Their differentiation is
therefore presentation, handling, range, and cadence rather than a DPS step upward. No existing weapon
damage or timing values changed.
