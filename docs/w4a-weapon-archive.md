# W4A Weapon Archive

The weapon archive preserves canonical weapon definitions and resource rows while excluding archived weapons from active gameplay surfaces. This keeps historical IDs valid for persisted data and code generation without allowing those weapons to re-enter circulation.

## Archive policy

- `WeaponDef.archived` is the canonical marker. The generated catalog retains every archived row.
- `WEAPON_CATALOG_IDS` contains all 329 non-fists catalog rows. `ACTIVE_WEAPON_CATALOG_IDS` contains the 323 playable rows, and `ARCHIVED_WEAPON_IDS` contains the six retired rows.
- Random drops, direct bank acquisition, Testing Grounds, portal pages, and enemy wield pools use active IDs only.
- The in-run shop has no generated offer roster: it displays only the owner's carried inventory. Archived inventory is removed during join migration, and every acquisition boundary rejects archived IDs, so retired weapons cannot reach that shop listing.
- The weaponsmith hides archived weapons from its normal roster instead of adding an Archived filter. The canonical definitions remain available in source and generated data for migration and referential integrity.
- Weapon resource profiles intentionally retain archived IDs, so historical references do not dangle.
- On join, archived owned instances in stash, intake, and an open expedition are removed and converted at the established standard `scripValue(rarityIndex, true)` rate. Mixed paired entries retain the active weapon as a single entry, and carry placements are remapped. The migration is idempotent and runs before stale-expedition settlement; the existing join transaction performs the normal persistence revision bump.

## Archived weapons

- `x2-mistral-kusarigama`
- `x2-snakebite-lash`
- `x2-ferrous-serpent`
- `x2-dust-devil-flail`
- `x2-locust-flail`
- `x2-nine-tail-razorlash`

## Census changes

| Census | Before | After | Reason |
| --- | ---: | ---: | --- |
| Canonical non-fists catalog | 329 | 329 | Archived definitions survive code generation. |
| Active catalog | 329 | 323 | Six weapons retired. |
| Archived catalog | 0 | 6 | New archive distinction. |
| Total expansion IDs | 298 | 298 | Historical expansion IDs remain canonical. |
| Active expansion IDs | 298 | 292 | All six retirements are expansion weapons. |
| Curated active `WEAPON_IDS` | 31 | 31 | None of the six were curated base weapons. |
| Random drop pool | 219 | 215 | W4A removes four previously eligible rows; two retirements were already excluded by their acquisition rules. The combined concurrent W4A+W4G tree reads 214 because W4G independently changes one additional row's eligibility. |
| Testing Grounds roster | 329 | 323 | Active weapons only. |
| Portal weapon pages | 329 | 323 | Active weapons only. |
| Weaponsmith roster | 329 | 323 | Archived rows hidden by policy. |
| Resource profiles | 329 | 329 | Historical IDs intentionally remain resolvable. |

Enemy templates currently contain zero archived wield assignments after normalization, and all six IDs are explicitly excluded from generated melee/ranged wield pools.

## Widowmaker Wrecking-Ball

Widowmaker keeps its existing numeric stats and physical quake behavior, but its family is now `maul`. Its derived combat language is a weighted, two-hand-heavy `quake-mauler` with a rigid chop/slam motion, and its quake continues through the V3X physical `aftershock-eruption` / `quake-burst` recipe.

The existing sprite was used as the art reference. Render attempt 1 passed: the replacement keeps the pitted charcoal/gunmetal demolition sphere and braced industrial handle while joining them with one solid riveted haft. It contains no chain, rope, cable, hinge, gap, or disconnected head. The accepted master was keyed, passed alpha-speck scrubbing, sliced as one part, installed at `packages/client/public/sprites/x2-widowmaker-wrecking-ball/part-1.png`, and registered in the sprite manifest.
