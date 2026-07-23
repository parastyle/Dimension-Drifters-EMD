# Batch R ranged orders

Owner: Sol `ranged-orders`
Branch: `sol/ranged-orders`
Started: 2026-07-22

## Understanding and approach

This run audits every Batch R order against the built `@dd/shared` catalog before changing source,
implements only unmet work, preserves nominal accepted-trigger DPS when cadence or projectile count
changes, keeps all gun origins on the shared art-space muzzle affine, advances every affected guard,
and closes the headline visuals through a permanent private-stack live gate. Generated output remains
generator-owned. The owner's listeners on ports 5180 and 2567 are out of scope.

The existing accepted V7 supplier bitmaps under `public/projectiles/v7` and
`public/vfx/explosions/v7` are generated art, but they are not wired into the projectile/explosion
runtime. Those exact assets will be reused for their matching orders. New Helix, smoke-ring, and
replacement Hexbore subjects will each use a separate built-in image-generation call.

## Built-catalog audit

Audit source: a fresh `pnpm --filter @dd/shared build`, followed by inspection of the exported
`WEAPONS` records. A row is `needs work` if any part of its compound owner order is absent.

| Order | Current built state (before) | Audit |
| --- | --- | --- |
| Gravelthroat Repeater | `randomPellets={min:1,max:10,directions:"radial"}`; headings cover `-π..π` | **needs work** — count is right, but the cited cone law is absent |
| Plaguespitter Flak Gun | one `pellet` per trigger, no spread/random volley; toxic element and `explode={radius:58,damage:7}` | **needs work** — generated green-shot art exists but is unwired |
| Brimstone Gallows-Rifle | one generic `tracer`, `spread=0.11`; one derived art-space muzzle | **needs work** — generated flaming-cross art exists but is unwired |
| Brimstone Rocket Tube | `gripPoints.primary=(0.42,0.62)`, away from the painted trigger; shoulder support `(0.61,0.58)`; `explode={radius:220,damage:13}` | **needs work (partial)** — large blast is already satisfied; trigger/forward placement is not |
| Mesa Hand-Cannon | `fireRate=0.7`, `damage=16`, no `explode`; generated .50-cal projectile already wired | **needs work** — add 0.5 s cadence and a generated detonation while retaining aggregate DPS |
| Tesla Faradayer | generic `spark`, `projectileVisualScale=10`, no `projectileArt` registration | **needs work** — generated hand-drawn bolt exists but is unwired |
| Sanctus Siege Bombard | `recoil=0.0038`, no `userKnockbackMultiplier` | **needs work** — 5× player knockback is absent |
| Stormcaller Tesla Gatling | beam delivery plus six explicit art-space muzzle aperture points; fixed-muzzle beam authority emits six parallel rays | **already satisfied** — skip implementation; retain regression/live proof |
| Sidewinder Spitfire | one bullet, `spread=0.16`, one derived muzzle point | **needs work** — two parallel lanes are absent |
| Gravelung Punt-Rifle | generic slug at `projectileVisualScale=1` | **needs work** — 2× bullet presentation is absent |
| Ironhide Buffalo Gun | generic slug; no generated projectile registration | **needs work** — generated anti-tank .50 shell exists but is unwired |
| Galvanic Coachgun | seven generic tracer pellets in a cone; no generated projectile registration | **needs work** — generated blue electrical slug exists but is unwired |
| Ricochet Pistol | generic cyan `spark`, three bounces; no generated projectile registration | **needs work** — generated icicle exists but is unwired |
| Hailspitter Pepperbox | one slug, `spread=0.13`, one derived muzzle point | **needs work** — seven tight parallel barrel lanes are absent |
| Dustline Lever-Action | `displayLength=150` | **needs work** — ordered +60% size is 240 |
| Hexbore Voidmaw | `displayLength=140`, `grip=2H`, secondary under-barrel hand, perspective muzzle art; generated void-rune VFX | **needs work** — target is 112, one-handed pistol, and completely flat replacement held art; retain rune VFX |
| Tesla Drumbore | five generic tracer pellets, no generated projectile registration | **needs work** — generated electric-particle art exists but is unwired |
| Frostfang Speargun | generic slug, no generated projectile registration | **needs work** — generated pictured-harpoon art exists but is unwired |
| Thunderhead Lever-Gun | generic blue tracer, no generated projectile registration | **needs work** — generated blue helix art is absent and required |
| Thunderhead Repeater Cannon | generic blue tracer with shock blast, no generated projectile registration | **needs work** — generated circular smoke-ring shot art is absent and required |
| Ironhail Pepperbox | one-handed default origin at `gripFrac=0.16`, visibly on the rear grip rather than the painted trigger | **needs work** — add a trigger-aligned primary grip |
| Hailstorm Coilgun | `primary=(0.12,0.52)` on the stock and `secondary=(0.38,0.65)` near the receiver | **needs work** — move the primary to the trigger so the stock sits under the shoulder and move support forward under the barrels |

## Planned implementation

1. Extend server-seeded random pellets with a declarative forward-cone mode and add cone volleys for
   Gravelthroat and Plaguespitter.
2. Reuse the accepted V7 generated projectile/explosion assets, generate the three missing subjects
   separately, and register/preload them through generator-owned manifests and data-driven recipes.
3. Author parallel art-space muzzle points for Sidewinder and Hailspitter, preserving trigger damage
   through the existing parallel-lane divisor.
4. Apply the remaining catalog size, cadence, blast, knockback, and grip changes; replace Hexbore held
   art through the canonical chroma-key/harvest/atlas pipeline.
5. Add focused catalog/authority/art/pose tests, update every affected census or cap guard, then run
   `pnpm gen`, `pnpm gen:check`, `pnpm assets:check`, focused tests, typecheck, full `pnpm test`, and a
   private live gate with retained evidence.

## Progress log

- Created this durable report as the first repository edit after the required read-only built-catalog
  audit. The worktree was clean and contained no `AGENTS.md`.
- Confirmed that the earlier V7 generated-art supplier produced matching accepted bitmaps for flaming
  cross, Faradayer bolt, Plaguespitter shot, Ironhide shell, Coachgun slug, Ricochet icicle, Drumbore
  particle, Frostfang harpoon, Mesa detonation, and Rocket Tube explosion. Runtime currently wires none
  of those V7 projectile/explosion paths.
- Confirmed Stormcaller is already structurally complete: its `WeaponDef.muzzle` owns six overridden
  aperture centers, the server chooses all fixed muzzle origins as simultaneous beam rays, and the
  client rebases every visible ray to the corresponding final rendered art-space muzzle.
- Added a typed deterministic `cone` random-pellet mode. Gravelthroat now keeps its 1–10 roll inside
  ±0.48 radians; Plaguespitter rolls 3–7 inside ±0.34 radians. Authority divides both direct and
  explosion damage by the requested roll before entity-cap admission.
- Raised the fixed-muzzle cap from six to seven, authored two Sidewinder and seven Hailspitter
  art-space apertures, and kept both volleys strictly parallel. Fixed parallel lanes divide one
  accepted-trigger damage pool rather than multiplying it.
- Reused all matching accepted V7 supplier art. Generated the two missing projectile subjects and the
  Hexbore replacement in three separate image-generation calls: blue helix, circular energy smoke
  ring, and completely flat side-profile Hexbore. Chroma-key cleanup and the canonical
  harvest/install/atlas pipeline produced the runtime assets; no generated manifest was hand-edited.
- Added generated projectile registrations for Gallows-Rifle, Plaguespitter, Faradayer, Ironhide,
  Coachgun, Ricochet, Drumbore, Frostfang, both Thunderheads, and retained Hexbore's void-rune VFX.
  Added data-driven painted explosion overlays for Mesa and Rocket Tube.
- Authored the remaining size, recoil, and pose data: Dustline 240, Gravelung projectile scale 2,
  Sanctus recoil multiplier 5, Hexbore 112/one-hand/pistol, Rocket Tube trigger `(0.28,0.74)`,
  Ironhail trigger `(0.38,0.70)`, and Hailstorm trigger/support `(0.43,0.68)/(0.78,0.54)`.
- The first focused pass exposed Mesa's ordinary expansion-generator ceiling clipping `1.2` to `0.9`.
  Mesa now has a narrow 1.2-second ceiling exception; all other weapon cadence bands are unchanged.
  The second focused pass passed 428/428 tests across catalog, art, census, and server authority.

## Implementation verdict

| Order | Before → implemented result | Verdict |
| --- | --- | --- |
| Gravelthroat Repeater | radial 1–10 → cone 1–10, half-angle `0.48` | **done** |
| Plaguespitter Flak Gun | one generic shot → 3–7 green generated shots, cone half-angle `0.34` | **done** |
| Brimstone Gallows-Rifle | generic spread `0.11` → tiny generated flaming cross, `spread=0` | **done** |
| Brimstone Rocket Tube | primary `(0.42,0.62)` → trigger `(0.28,0.74)`; existing 220/13 blast retained and painted large-blast art wired | **done** |
| Mesa Hand-Cannon | `16 / 0.7`, no blast → `(16 + 11.428571) / 1.2`, radius 74 generated detonation | **done** |
| Tesla Faradayer | 10× generic spark → scale-1 generated hand-drawn bolt | **done** |
| Sanctus Siege Bombard | ordinary recoil → `userKnockbackMultiplier=5` | **done** |
| Stormcaller Tesla Gatling | six server/client art-space beam apertures → unchanged | **skipped — already done** |
| Sidewinder Spitfire | one spread shot → two parallel art-space lanes | **done** |
| Gravelung Punt-Rifle | scale-1 slug → `projectileVisualScale=2` | **done** |
| Ironhide Buffalo Gun | generic slug → generated anti-tank .50 shell | **done** |
| Galvanic Coachgun | generic tracers → generated blue electrical slugs | **done** |
| Ricochet Pistol | generic spark → generated icicle | **done** |
| Hailspitter Pepperbox | one spread shot → seven tight parallel art-space lanes | **done** |
| Dustline Lever-Action | length 150 → 240 (+60%) | **done** |
| Hexbore Voidmaw | length 140, two-hand, perspective held art → 112, one-hand pistol, flat side-profile held art; rune VFX retained | **done** |
| Tesla Drumbore | generic tracers → generated electric particles | **done** |
| Frostfang Speargun | generic slug → generated pictured harpoon | **done** |
| Thunderhead Lever-Gun | generic blue tracer → separately generated blue helix | **done** |
| Thunderhead Repeater Cannon | generic blue tracer → separately generated circular energy smoke ring | **done** |
| Ironhail Pepperbox | default rear-grip hand → explicit trigger `(0.38,0.70)` | **done** |
| Hailstorm Coilgun | hand on stock/receiver → stock clear under shoulder; trigger hand and forward support hand authored | **done** |

## DPS ledger

| Affected count/cadence order | Before DPS | After DPS | Preservation mechanism |
| --- | ---: | ---: | --- |
| Gravelthroat 1–10 random volley | `6 / 0.15 = 40` | `6 / 0.15 = 40` | requested random count divides one trigger pool |
| Plaguespitter 3–7 random volley | `(5 + 7) / 0.24 = 50` | `(5 + 7) / 0.24 = 50` | direct and blast pools both divide by requested count |
| Mesa +0.5 s cadence | `16 / 0.7 = 22.857143` | `(16 + 11.428571) / 1.2 = 22.857143` | cadence budget moved into detonation |
| Sidewinder two lanes | `5 / 0.10 = 50` | `5 / 0.10 = 50` | two fixed lanes divide one trigger pool |
| Hailspitter seven lanes | `6 / 0.14 = 42.857143` | `6 / 0.14 = 42.857143` | seven fixed lanes divide one trigger pool |

## Live proof

- Permanent gate: `e2e/tests/ranged-orders-live-gate.spec.ts`.
- Retained measurements:
  `docs/owner-notes-audit-v8-evidence/ranged-orders/ranged-orders-live-capture.json`.
- Retained screenshots cover both cones, both parallel volleys, all ten generated projectile
  identities, and Stormcaller's six beams under
  `docs/owner-notes-audit-v8-evidence/ranged-orders/`.
- Gravelthroat emitted 3 projectiles in the captured 1–10 roll; maximum absolute aim delta was
  `0.362909363`, below the `0.48` half-angle.
- Plaguespitter emitted 7 projectiles in the captured 3–7 roll; maximum absolute aim delta was
  `0.269670689`, below the `0.34` half-angle.
- Sidewinder emitted exactly 2 lanes and Hailspitter exactly 7 lanes. Each capture's maximum heading
  delta was `0`, while each lane retained its distinct art-space spawn origin.
- Gallows, Frostfang, Galvanic, Ironhide, Plaguespitter, Drumbore, Faradayer, both Thunderheads, and
  Ricochet all rendered the requested generated texture. Every measured projectile had `0px`
  muzzle-origin error; the largest rotation error was below `5e-16` radians, versus gate thresholds
  of `2.5px` and `0.01` radians.
- Stormcaller retained 6 authoritative beam rows and 6 visible beam structures. All six measured
  muzzle deltas were `0px`.
- The final passing capture booted the real Colyseus/Vite stack on private ephemeral ports
  (`50475`/`50476`). The harness shut both down after the gate; owner ports `5180`/`2567` were never
  touched.

## Validation

- `pnpm gen` — pass: 321 expansion weapons, 141 muzzle definitions, 313 VFX subjects, 40 character
  sprites, 319 cards, 24 generated projectile sprites, and 333 portal records. The ten documented
  unavailable VFX references and one documented unavailable character-parts input remained explicit
  generator skips.
- `pnpm gen:check` — pass, including the supplemental projectile manifest's check mode.
- `pnpm assets:check` — pass: 422 weapon sprites / 762 parts, 413 atlas mappings, 319 cards, 24
  projectile URLs, and 96 particle URLs; no missing runtime asset.
- Focused catalog, data, art, pose, muzzle, and server-authority suite — 428/428 pass.
- `pnpm typecheck` — pass for shared, server, and client.
- `pnpm test` — pass: 136 files, 1,786 tests. The first full pass exposed the scoped
  one-hand/default-arc census change (`119 → 120`) and an existing waveform fixture whose random
  enemies could intercept its projectile; the census now matches the catalog and the fixture clears
  enemies before its waveform-only assertion.
- `pnpm exec playwright test e2e/tests/ranged-orders-live-gate.spec.ts --workers=1` — 1/1 pass against
  the private real stack, with all evidence retained.

## Census and final verdict

- Runtime weapon count remains 333; the expansion catalog remains 321.
- Art-space muzzle definitions are 141. The fixed-muzzle safety cap is now 7 so Hailspitter's seven
  authored apertures are legal; the existing six-point Stormcaller definition remains unchanged.
- Pistol handling census is 30 after Hexbore's requested one-hand conversion; the derived
  `arc/default` routing census is 120.
- Generated projectile manifest census is 24 after registering the reused and new Batch R subjects.
- Every unmet Batch R order is implemented and verified. Stormcaller Tesla Gatling is the sole
  `skipped — already done` row and is protected by catalog, authority, and live-render assertions.
- Server boot, cone bounds, parallel counts, six-beam visibility, generated texture identity,
  art-space muzzle alignment, DPS redistribution, generator drift, asset existence, typecheck, and
  the full test suite are green.
