# Sol report: B45 real gun recoil

Implemented physical shooter recoil for the full ranged-gun catalog. Every accepted gun shot now adds an impulse opposite the normalized aim vector, and every active ranged beam adds a small per-tick pressure impulse. Both paths immediately enter B42/B44 server-motion authority as `weapon-fire-recoil`.

Melee weapons and caster weapons remain planted. Damage, cadence, projectile behavior, parry, dodge, and the existing presentation-only `gun.recoil` camera/rig values are unchanged.

## Catalog formula

The generator authors the tunable top-level `WeaponDef.recoil` field. For a gun, the field is an instantaneous impulse-speed budget in px/s:

```text
directDamagePerTrigger = damagePerProjectile * fixedOrExpectedPelletCount
raw = 20 + 7 * sqrt(directDamagePerTrigger) + sizeBonus + familyBonus
rapidCap = 180 * fireRate, when fireRate <= 0.20 seconds
gunRecoil = round(clamp(min(raw, rapidCap), 8, 300))
```

Size bonuses are S `0`, M `15`, L `30`, and XL `55`. Family bonuses come from the catalog family/size:

| Heft class | Family bonus | Intended feel | Generated spot check |
| --- | ---: | --- | ---: |
| Pistol | 0 | Small nudge | Ashfall Peacemaker: 41 |
| Rifle | 30 | Controlled kick | Formula-derived per rifle |
| Shotgun | 70 | Solid shove | Buckshot Briar: 146 |
| Hand cannon | 80 | Solid shove | Mesa Hand Cannon: 143 |
| Cannon / launcher | 105 | Big push | Calamity Howitzer: 233 |
| Railgun | 110 | Big push | Sunbreaker Railgun: 213 |
| Heavy ordnance | 125 | Largest catalog push | Formula-derived, capped at 300 |
| Rapid-fire gun | Normal family, then rapid cap | Tiny ticks that accumulate | Hellbore Gatling: 13 |

Ranged beams use a separate sustained acceleration budget:

```text
beamRecoilPerSecond =
  round(clamp(12 + 2 * sqrt(beamDamage) + 0.25 * sizeBonus + heavyFamilyBonus, 8, 42))
```

The runtime applies `beamRecoilPerSecond * dt`, keeping channel pressure subtle. Caster beams author `0`. An explicit catalog-level `recoil` value overrides either generated result, so individual weapons remain tunable.

## Runtime and authority

- Gun impulses use the existing impulse rail, so its exponential decay remains crisp and composes with steering.
- Airborne recoil, pit entry, arena navigation clamps, and belt-mode X bounds all pass through ordinary authoritative movement.
- Dual guns alternate muzzle hands but add one body impulse for each accepted shot.
- `weapon-fire-recoil` is a distinct sanctioned source in the B44 motion census and opens/extends the server-motion epoch before B42 evaluates owner movement.
- No synchronized state field was added: recoil is catalog data and the existing epoch/source rails carry authority, so `SCHEMA_VERSION` remains at the current pin, 44.

## Verification

- `pnpm gen`: passed.
- `pnpm gen:check`: passed. The generator reported the repository's existing unavailable-art warnings for the optional VFX/scale checks.
- `pnpm typecheck`: passed.
- `pnpm test`: passed, 209 files and 2,725 tests.
- Formula table: six weapon spot checks across pistol, shotgun, hand-cannon, railgun, heavy cannon, and rapid-fire.
- Catalog census: all 113 ranged guns and all four ranged beams have positive physical recoil; every non-ranged definition remains at zero.
- Feel/integration: decay, input composition, sustained-fire accumulation, beam subtlety, airborne authority, dual alternation, pits, and belt bounds covered.

## Private two-client live gate

The final capture ran a real local Colyseus server and two simultaneous clients on OS-assigned ephemeral port `49153`; protected ports `5180` and `2567` were untouched.

| Run | Accepted shots | Authoritative displacement | B42 rejection counter | Observer error |
| --- | ---: | ---: | ---: | ---: |
| Revolver Cannon pistol | 1 | 8.366 px | 0 -> 0 | 0 px |
| Coffin Shotgun | 1 | 21.608 px | 0 -> 0 | 0 px |
| Calamity Howitzer | 1 | 31.589 px | 0 -> 0 | 0 px |
| Gatling sustained fire | 19 | 36.108 px | 0 -> 0 | 0 px |

Raw per-tick owner, observer, epoch/source, velocity, and correction telemetry is under `docs/owner-notes-audit-v11-evidence/b45-gun-recoil/`.

VERDICT: 113 guns recoiled across classes, classification clean, zero rejections, evidence path `docs/owner-notes-audit-v11-evidence/b45-gun-recoil/`, 16 files touched.
