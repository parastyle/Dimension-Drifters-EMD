# B62 — Weapon and relic legibility

## Result

Weapon identity now resolves through one shared player-facing function. An authored
`WeaponDef.description` is returned unchanged (apart from surrounding whitespace); otherwise the line is
derived from the same combat fields the server and client already consume. The resolver covers all 359
catalog definitions, including archived entries. The active player-facing catalog is 338 weapons: 91 use
authored copy and 247 use derived behavior copy.

The behavior line is rendered in:

- the carousel weapon card;
- the focused Testing Grounds pickup label;
- the known in-world pickup prompt;
- the chest reward banner;
- the rarity/affix pickup reveal;
- the backpack detail card.

Mystery drops remain mysterious until pickup. Their prompt does not leak the hidden weapon definition.

## Weapon derivation rules

`weaponBehaviourLine` applies these rules in order:

1. A non-empty authored `description` always wins.
2. A specialized authoritative behavior block wins over generic melee geometry. The priority is revive,
   cursor warp, charged projectile, ground zone, beam, gun, cast, thrown, rapid thrust, quake, scatter,
   chain lightning, hybrid projectile, held aura, and hit status.
3. A weapon without a specialized block uses its actual melee envelope: attack verb, full arc, reach, and
   cooldown.
4. Gun lines use their real pellet/random-pellet/burst mode first, then the most important projectile
   behavior (pierce, wall ricochet, explosion, or arc). A plain gun reports magazine and reload timing.
5. Counts, radii, ranges, durations, cooldowns, charge times, overheat times, and refill times come directly
   from the definition. Display formatting rounds pixel distances to whole pixels and preserves meaningful
   decimal timing.
6. The resolver changes no weapon field and performs no tuning. A data change automatically changes its
   derived copy.

## Ten derived samples

| Family | Weapon | Derived player-facing line |
|---|---|---|
| Melee envelope | Tombstone Greatsword | Swings through a 115° arc up to 156 px every 0.78 seconds. |
| Thrown | Rusty Cleaver | Throws one charge at a time up to 520 px; each throw hits up to 2 enemies; all 3 charges refill after 1.5 seconds. |
| Shotgun | Coffin Shotgun | Fires 7 pellets in a cone per trigger pull; reloads after 2 trigger pulls in 1.6 seconds. |
| Ricochet gun | Ricochet Pistol | Fires one shot every 0.34 seconds; each shot hits up to 2 enemies and ricochets off walls 3 times. |
| Caster | Storm Rod | Casts a bolt every 0.32 seconds; each bolt hits up to 3 enemies and the bolts weave from side to side. |
| Beam / cone | Doomsday Drum Cannon | Charges for 0.65 seconds, then channels a widening magma cone up to 560 px; overheats after 1.25 seconds. |
| Scatter | Wyrmtooth | Launches 6 projectiles in a cone every 0.72 seconds; each one explodes in a 56 px radius. |
| Chain lightning | Voltedge | Strikes within 138 px, then lightning jumps to 3 more enemies within 240 px. |
| Ground zone | Gravewax Séance Globe | Creates a damaging rift while held that reaches a 220 px radius for 2 seconds. |
| Charged projectile | Emberleaf Chapbook | Hold for up to 1.2 seconds, then release a projectile that explodes within 100 px. |

## Relic approach

Both relic definition types now require `desc`.

- The nine common descriptions are created by the same factory call that stores each definition's `value`.
  Drive capacity/regen, parry reach, dodge recovery, movement, health regen, luck, crit chance, and air
  jumps therefore cannot silently diverge from their displayed numbers.
- The four dodge relic descriptions read the same shared dodge profiles used by movement: distance
  multiplier and cooldown are not copied into prose-only data.
- Second Wind reads `REVIVE_HP_FRAC`; Death Ward reads `DEATH_WARD_HP_THRESHOLD` and
  `DEATH_WARD_COOLDOWN_SECONDS`.
- The chest pickup banner resolves the acquired relic by id and includes its description.
- Hovering the retained `TRINKETS` HUD row opens a list of owned relic names, stack counts, and descriptions.

## Locked guarantees and verification

`tests/b62-legibility.test.ts` asserts:

- every one of the 359 catalog weapon definitions resolves a non-empty behavior line;
- authored weapon descriptions beat derivation;
- representative gun, chain-lightning, and revive derivations report their exact live data;
- all 15 relic definitions have unique ids and non-empty resolvable descriptions.

Verification:

- `pnpm gen` — passed.
- `pnpm gen:check` — passed.
- `pnpm typecheck` — passed.
- `pnpm test` — passed: 224 files, 2,774 tests passed, 20 skipped.
- `git diff --check` — passed.
- Changed source and tests use LF endings.

## Live evidence

The private dev client and server started successfully on ports 5186 and 2573 with debug authority enabled.
The connected in-app browser reported no available browser instances, so live screenshots could not be
captured honestly in this session. No substitute or fabricated images were written. The requested target
paths remain:

- `docs/sol-reports/b62-evidence/weapon-desc-authored.png`
- `docs/sol-reports/b62-evidence/weapon-desc-derived.png`
- `docs/sol-reports/b62-evidence/relic-desc.png`

Verdict: 338 weapons covered (91 authored / 247 derived), 15 relics covered, 2,774 tests passed (20 skipped); captures blocked by unavailable in-app browser (requested paths listed above).
