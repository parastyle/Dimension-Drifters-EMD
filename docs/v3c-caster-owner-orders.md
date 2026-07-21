# V3C caster implementation notes

## Thunderpost Fetish cadence

Thunderpost keeps its authored `0.60 s` accepted-attack interval. Its expanded code-generated phrase is
five beats long, so an uninterrupted loop takes `3.00 s` before returning to the opener:

| Beat | Motion | Direction | Accepted epoch |
|---:|---|---|---:|
| 1 | post draw | forward | 0.00 s |
| 2 | forking return | reverse | 0.60 s |
| 3 | copper rise | forward | 1.20 s |
| 4 | stormwheel | reverse | 1.80 s |
| 5 | thunderpost fall | forward | 2.40 s |

Every path keeps `damageMultiplier: 1`, `rangeMultiplier: 1`, and zero bonus knockback. The combo changes
the held animation sentence without multiplying damage; the existing server-owned cooldown and chain-
lightning payload remain the cadence and DPS authority.

## Damage redistribution

Arcanist's Lance retains its `16 / 0.62 = 25.806...` base cast DPS. One accepted cast now splits that
16-damage payload evenly across three simultaneous projectiles (`16 / 3` each) instead of duplicating it.
All other V3C orders leave their authored damage and cooldown values unchanged; radius changes alter
coverage only.
