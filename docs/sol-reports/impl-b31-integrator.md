# Sol Report — impl-b31-integrator

## Wiring plan

### Emberleaf Chapbook (`x2-emberleaf-chapbook`)

- Replace the inherited four-pellet scatter behavior with one server-owned hold-to-charge fireball.
- Record charge start and normalized charge on authoritative player/projectile state so every client renders the same muzzle growth instead of running an independent visual timer.
- While held, render `vfx-emberleaf-fireball/part-1.png` at the authored muzzle and grow it from the tap scale to the full-charge scale.
- On release, spawn one projectile carrying the resolved charge fraction. Scale projectile size, direct damage, explosion damage, and explosion radius from that immutable fraction.
- Preserve the current full-cycle damage rate within ±10% and cover tap, capped charge, release, and explosion authority with unit tests.

#### Emberleaf charge curve

Let `q = clamp(heldSeconds / 1.2, 0, 1)`. The release snapshot uses:

| Property | Curve |
| --- | --- |
| Presented orb diameter | `56 * (0.55 + 0.95q)` px |
| Projectile direct damage | `Dmin + (Dmax - Dmin)q²` |
| Explosion damage | `Emin + (Emax - Emin)q²` |
| Explosion radius | `34 + 66q²` px |
| Projectile visual/collision scale | `0.55 + 0.95q` |

The quadratic damage ramp makes an uncharged tap a small quick bolt while reserving the large payoff for a deliberate full hold. The pinned values are direct damage `3..18`, explosion damage `2..22`, and explosion radius `34..100`; full-cycle DPS is `(18 + 22) / (1.2 + 0.3) = 26.667`, equal to the displaced scatter cycle `(4 + 4) / 0.3 = 26.667`.

### Wyrmscale Hex-Talon (`x2-wyrmscale-hex-talon`)

- Convert the definition to a pre-made `dual` melee set and render both recovered views: back-side `part-1` on one hand and palm-side `part-2` on the other.
- Replace the ranged scatter with an authoritative alternating combo whose steps explicitly alternate hands, use wide sweep hit paths, and retain nominal damage rate within ±10%.
- Give the client large opposing talon arcs and attach short-lived fire accents to those slash arcs only. No player aura, radial burst, ambient fire, chain, or tassel layer will be introduced.

### Unicorn Rainbow Beam (`x2-unicorn-rainbow-beam`)

- Keep the existing beam definition, authoritative damage, anchor, charge, sweep lag, and lifecycle untouched.
- Replace all procedural beam-body presentation with horizontally tiled `vfx-unicorn-rainbow-beam/part-1.png` from muzzle to authoritative beam endpoint.
- Remove displaced ribbons, cores, borders, procedural sparkles, and other redundant beam-body layers; the recovered tile supplies its own restrained glints.

### Emberfist Wraps (`x2-emberfist-wraps`)

- Add one new active expansion weapon using the recovered `part-1` wrap and registered `part-2` flame sheath.
- Clone `x2-coyote-trickster-s-sparkmitt`'s owner-approved eight-step authoritative combo bar, punch/cross/hook hand alternation, timing, performance, and animation signature.
- Use `glovePair` delivery so the single wrap art is duplicated onto both blob hands.
- At each step's impact window, composite `part-2` directly over the currently striking fist; do not emit particles or leave flame attached between punches.
- Balance the cloned eight-hit cadence to nominal DPS 20, register the definition in the catalog/generator inputs, add the L5 formula tier assignment, include it in the pack pool, and deliberately migrate the active-weapon census by +1.

## Progress

- Created this required implementation report before runtime or data edits.

## Implementation results

### Emberleaf Chapbook

- Added the `chargedProjectile` data contract, shared release-curve helpers, schema-38 replicated charge clock, server hold/release state machine, immutable projectile snapshot, recovered-art projectile factory, explosion scaling, and authoritative-muzzle presentation.
- The server now distinguishes an explicit false command from a stale held heartbeat. A transient transport/render stall cannot manufacture a release; the shot launches only on the accepted release edge.
- Tap/full unit receipts pin `0.55 / 34 px / 3+2 damage` and `1.5 / 100 px / 18+22 damage`. Live receipts observed right/left tap scales `0.748 / 0.708`, full scale `1.5`, and full explosion radius `100`.
- Full-cycle DPS is `26.667`, a `0%` change from the displaced scatter cycle and therefore inside the required ±10%.

### Wyrmscale Hex-Talon

- Converted the weapon to a pre-made dual set with grip `dual`; manifest parts are the recovered back-side `part-1.png` and palm-side `part-2.png`, rendered concurrently.
- Added the four-beat `wyrmscale-inferno-talons` authoritative bar: lead/off/lead/off hands, opposing `5.27..5.85` radian damage arcs, and a theatrical wide-arc continuation window.
- Added `wyrmscale-fire-slash` as an impact-timed, blade-anchored `fire-bolt` recipe. It has no aura, radial distribution, ambient layer, chain, or tassel.
- Damage/cooldown is `11 / 0.46 = 23.913 DPS`, exactly equal to the displaced `5+6` damage cycle.

### Unicorn Rainbow Beam

- Preserved the shipped beam definition byte-for-byte: `20 DPS`, `0.1 s` tick, `64 px` width, `520 px` range, `0.65 s` charge, `0.12 s` sweep lag, and the existing overheat/movement rows.
- Replaced the active beam body with one `TileSprite` using `recovered:unicorn-rainbow-beam`, scaled and tiled along the authoritative `520 px` beam rectangle.
- Active recovered-tile rows explicitly suppress the old body, lip, structure, strand palette, and procedural sparkle stack. Live receipts report `bodyVisible=false`, `lipVisible=false`, `structure=null` in both facings.

### Emberfist Wraps

- Registered active weapon `x2-emberfist-wraps` at tier 2 in the catalog, tier formula output, drop pool, and locked pack candidates.
- Cloned Sparkmitt's eight-step hook/cross/jab/haymaker timing and performance signature. Added an explicit shared glove-pair combo clock so the two duplicated hands advance the one eight-beat bar instead of legacy per-hand chains.
- Manifest `part-1` is duplicated as held art on both hands. Registered `part-2` is composited over exactly one combo-selected striking fist only during its impact window; `suppressVfx=true` prevents particle or generic weapon-effect substitutes.
- Damage/cooldown is `2.4 / 0.12 = 20 DPS`. Live receipts completed at least eight authoritative punches per facing, sampled multiple combo steps, showed both striking hands, and found zero generic weapon-effect events.

### Census, protocol, and verification

- Schema advanced from `37` to `38`; all schema pins and affected tests were migrated.
- Weapon census is `358 total = 339 active + 19 archived`; active roster delta is exactly `+1`.
- Resource census is `179 melee` and `4 cast`; generated class counts are `132 melee / 111 ranged / 96 caster`.
- `pnpm gen`, `pnpm gen:check`, `pnpm typecheck`, `pnpm assets:check`, and full `pnpm test` pass. Full suite result: `183` files / `2,295` tests.
- Private live gate passes on `proto-cowboy-hidden-face` in both facings at client `65530` / game `65529`; protected ports `5180/2567` were not used.

### Files touched

- Data/generated/catalog: `data/weapon-concepts-300.json`, `data/weapon-muzzle-overrides.json`, `data/weapon-tiers.json`, weapon/tier/muzzle generated sources, sprite manifest, portal, and Weaponsmith generated views.
- Runtime: shared weapon/combat/resource/melee/state/constants surfaces; `GameRoom` weapon behavior; `ArenaScene`, `SpriteRig`, projectile factory, beam renderer/recipes, and weapon-effect recipes.
- Coverage/migrations: the dedicated B31 unit and live-gate specs plus affected census, tier, resource, archive, pose, dual, glove, beam, progression, and schema tests.
- Audit: this report, two derived muzzle reports, `README.md`, `live-gate.json`, and 26 retained PNGs under `docs/owner-notes-audit-v11-evidence/b31-integrator/`.
- Total changed paths: `76` (`45` modified tracked paths and `31` new paths, including `28` evidence artifacts).

verdict: 4 subjects wired (Emberleaf charge curve 1.2 s / 3..18 direct / 2..22 explosion / 34..100 px / 26.667 DPS; Wyrmscale dual set with four alternating wide fire slashes / 23.913 DPS; Unicorn recovered-art tiled beam swap with gameplay unchanged; new weapon x2-emberfist-wraps with shared eight-step glove combo, striking-fist overlay, and 20 DPS), census delta +1 active (339 active / 358 total / 19 archived), evidence path docs/owner-notes-audit-v11-evidence/b31-integrator/, files touched 76 paths (45 modified + 31 new).
