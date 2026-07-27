# B78 census derivation report

## Outcome

The B63 guns 16-21 merge adds five net-new catalog rows: Helix Bullpup was already present in the
previous 380-row baseline, while Caseless Vanguard, Slugthrower Rail-9, Cyclone Micro-Gat, Smartlink
Burstmaster, and Recoilless Whisper advance the catalog from 380 to 385 and the active roster from
360 to 365. Archives remain fixed at 20.

All 23 reported failures are fixed. Pure catalog-size assertions now derive from the catalog or its
single protected census owner. Behavioral membership, historical transition, distribution, and
loss-detection pins remain literal.

## Classification rule

A number derives only when its sole meaning is "the current catalog has this many rows." A number
stays literal when changing it is part of reviewing an intentional contract: detecting a lost row,
proving that every member of a behavioral cohort is audited, recording an authored distribution, or
preserving a historical transition. New weapons must satisfy those literal cohort laws; the assertion
is never widened to admit a nonconforming weapon.

For the counts below, one pin means one census assertion or one exact aggregate golden object.
Specific-ID membership assertions also remain literal, but are not included in the numeric pin count.

## Failure classification and action

| # | Failure | Kind | Action |
|---:|---|---|---|
| 1 | `b24-radial-hunt`: resolver cohort 341 -> 346 | count growth | Kept literal and updated the total and per-layer membership pins; all five new rows satisfy the resolver law. |
| 2 | `b24-radial-hunt`: active roster 360 -> 365 | count growth | Derived active count from catalog minus archives. |
| 3 | `b30-expunged-vfx-envelope-audit`: envelope cohort 341 -> 346 | count growth | Kept literal and audited every new member through the hit-envelope law. |
| 4 | `b30-recovered-orders`: active roster 360 -> 365 | count growth | Derived active count from catalog minus archives. |
| 5 | `b31-recovered-art-integrator`: catalog 380 -> 385 | count growth | Kept the catalog, active, active-expansion, and archive literals because this test intentionally records Emberfist's historical one-row census move. |
| 6 | `b45-gun-recoil`: ranged-gun cohort 131 -> 136 | count growth | Kept literal; every added gun passes the positive recoil-coverage law. |
| 7 | `b50-caster-vfx`: active roster 360 -> 365 | count growth | Derived active and active-expansion totals; kept the archive loss pin. |
| 8 | `b6-weapon-archives`: catalog 380 -> 385 | count growth | Derived catalog, active, active-expansion, and resource totals; kept the archive loss pin and exact IDs. |
| 9 | `b62-legibility`: active roster 360 -> 365 | count growth | Derived the active total from non-archived catalog IDs. |
| 10 | `data-consistency`: source header said 129 ranged rows, actual 134 | real defect | Corrected `data/weapon-concepts-300.json` metadata to 134 without reordering or reformatting rows. |
| 11 | `v3x-auto-rifles`: generated portal count 360 -> 365 | count growth | Compared generated output to the shared active catalog length. |
| 12 | `v5g-gun-muzzle-alpha`: muzzle cohort 164 -> 169 | count growth | Kept literal; all five guns have valid derived/overridden muzzle allocations and satisfy the minimum-point law. |
| 13 | `v61-brutalist-greatswords`: catalog 380 -> 385 | count growth | Derived catalog, active, active-expansion, and resource totals. |
| 14 | `v61-brutalist-greatswords`: portal count 360 -> 365 | count growth | Compared portal output to the shared active catalog length. |
| 15 | `w4a-weapon-archive`: catalog 380 -> 385 | count growth | Derived catalog, active, active-expansion, and resource totals; kept the archive loss pin. |
| 16 | `w4a-weapon-archive`: portal/Weaponsmith count 360 -> 365 | count growth | Derived portal count and made Weaponsmith accessibility counts runtime-derived from loaded active rows. |
| 17 | `weapon-resource`: resource IDs 380 -> 385 | count growth | Pointed the test at the single protected source census owner instead of duplicating its literal. |
| 18 | `weapon-resource`: gun delivery median 10.75 -> 10 | count growth | Kept and updated the literal distribution golden; formula coefficients and overrides were not changed. |
| 19 | `weapon-tiers`: tier distribution changed to `[75, 77, 70, 78, 65]` | count growth | Kept and updated the authored tier-population golden. |
| 20 | `gun-sfx`: active-gun cohort 139 -> 144 | count growth | Kept literal; exact registry equality and installed-family checks pass for all five new guns. |
| 21 | `pose-language`: Caseless Vanguard fell through to generic rifle pose | real defect | Added the four missing named families (`caseless-carbine`, `rail-pistol`, `smart-burst-rifle`, and `integrally-suppressed-rifle`) to ranged pose classification. |
| 22 | `GameRoom.economy-bank`: gallery roster 360 -> 365 | count growth | Derived the roster assertion from the shared active catalog. |
| 23 | `GameRoom`: duplicate gallery roster 360 -> 365 | count growth | Derived the roster assertion from the shared active catalog. |

## Pins derived: 24

| File | Derived pins | Why derivation is safe |
|---|---:|---|
| `tests/b24-radial-hunt.test.ts` | 1 | Active total has no meaning beyond catalog minus archives. |
| `tests/b30-recovered-orders.test.ts` | 1 | Active total has no meaning beyond catalog minus archives. |
| `tests/b50-caster-vfx.test.ts` | 2 | Active and active-expansion totals are direct catalog projections. |
| `tests/b6-weapon-archives.test.ts` | 4 | Catalog, active, active-expansion, and resource totals are direct projections; archive intent remains separately pinned. |
| `tests/b62-legibility.test.ts` | 1 | Active count is the non-archived catalog projection. |
| `tests/v3x-auto-rifles.test.ts` | 1 | Portal count must equal the shared active roster. |
| `tests/v61-brutalist-greatswords.test.ts` | 4 | Catalog, active, resource, and portal counts only prove equality between representations. |
| `tests/w4a-weapon-archive.test.ts` | 7 | Catalog, active, active-expansion, resource, portal, Weaponsmith search, and Weaponsmith option-size counts only mirror live data. |
| `tests/weapon-resource.test.ts` | 1 | The test consumes the protected source pin instead of creating a second literal owner. |
| `packages/server/src/rooms/GameRoom.economy-bank.test.ts` | 1 | Gallery roster size must equal the shared active roster. |
| `packages/server/src/rooms/GameRoom.test.ts` | 1 | The duplicate gallery assertion must equal the shared active roster. |

Weaponsmith no longer embeds `360` in static HTML. Its search label is populated from
`allWeapons.length`, while rendered options continue to use `filteredWeapons.length` for
`aria-setsize`.

## Pins deliberately kept literal: 27

| File or owner | Literal pins | Reason |
|---|---:|---|
| `tests/b24-radial-hunt.test.ts` | 5 | Resolver total, layer distribution, active resolver members, archived resolver members, and archive total detect membership loss. |
| `tests/b30-expunged-vfx-envelope-audit.test.ts` | 1 | The exact cohort size proves no eligible weapon escaped the envelope audit. |
| `tests/b30-recovered-orders.test.ts` | 1 | Archive total is a loss tripwire. |
| `tests/b31-recovered-art-integrator.test.ts` | 4 | Catalog, active, active-expansion, and archive literals encode the named recovery's historical one-row move. |
| `tests/b45-gun-recoil.test.ts` | 2 | Ranged-gun and beam cohort sizes prove complete recoil-law coverage. |
| `tests/b50-caster-vfx.test.ts` | 1 | Archive total is a loss tripwire. |
| `tests/b6-weapon-archives.test.ts` | 1 | Archive total is a loss tripwire. |
| `tests/v5g-gun-muzzle-alpha.test.ts` | 2 | Muzzle cohort size and minimum allocation count prove complete muzzle-law coverage. |
| `tests/v61-brutalist-greatswords.test.ts` | 1 | Archive total is a loss tripwire. |
| `tests/w4a-weapon-archive.test.ts` | 1 | Archive total is a loss tripwire. |
| `packages/shared/src/weapon-resource.ts` | 1 | The catalog/active/archive census object is the single intentional source tripwire against silent weapon loss. |
| `tests/weapon-resource.test.ts` delivery census | 1 | Exact delivery ownership proves new guns entered the gun formula branch. |
| `tests/weapon-resource.test.ts` distribution bands | 4 | Melee, thrown, gun, and cast min/median/max goldens detect formula or population drift. |
| `tests/weapon-tiers.test.ts` | 1 | Exact tier populations encode authored tier assignment. |
| `packages/client/src/audio/gun-sfx.test.ts` | 1 | Exact active-gun cohort size plus registry equality detects a missing SFX family. |

Exact archive IDs, marked resolver IDs, registry keys, coefficient values, and other named membership
assertions remain literal for the same intent-preserving reason.

## Real defects fixed

1. The concept catalog's `byType.ranged` source metadata remained at 129 after five ranged rows were
   added. It is now 134.
2. The pose classifier recognized Helix's `bullpup-rifle` but omitted four other new gun families.
   Those families are now explicitly ranged, so none of guns 16-21 uses a generic fallback pose.

The SFX registry, sprite manifest, muzzle derivation/overrides, recoil data, limb claims, and
hit-envelope behavior were audited and already satisfy their laws. No assertion was loosened.

## Recurrence proof

Simulating one ordinary active expansion gun produces catalog 386, active 366, archives 20, active
expansion 337, resources 386, and gun delivery 146. All 24 derived pins follow those collections
without edits. The generated portal becomes 366 after `pnpm gen`; Weaponsmith reads 366 from loaded
data; both server gallery tests read 366 from the shared roster.

The deliberate review points would move only if the new gun belongs to their cohort: B24 resolver
and B30 envelope become 347, ranged recoil becomes 137, muzzle coverage becomes 170, and active gun
SFX becomes 145. Those edits are justified because each forces the new gun through a behavioral law.
The resource median remains unchanged unless recomputing the distribution actually moves it.

After the weapon author's source/art work lands, a normal active gun has nine manual census/audit
review locations:

1. `packages/shared/src/weapon-resource.ts` -- bump the one protected catalog/active/archive owner.
2. `tests/b31-recovered-art-integrator.test.ts` -- preserve the explicitly required historical
   census literal.
3. `tests/weapon-resource.test.ts` -- update delivery ownership and any distribution golden that
   genuinely moves.
4. `tests/weapon-tiers.test.ts` -- update the authored tier population.
5. `tests/b24-radial-hunt.test.ts` -- update only when the resolver cohort gains the row, after the
   resolver law passes.
6. `tests/b30-expunged-vfx-envelope-audit.test.ts` -- update only when the envelope cohort gains the
   row, after the envelope law passes.
7. `tests/b45-gun-recoil.test.ts` -- update the gun cohort only after positive recoil coverage passes.
8. `tests/v5g-gun-muzzle-alpha.test.ts` -- update the muzzle cohort only after allocation coverage
   passes.
9. `packages/client/src/audio/gun-sfx.test.ts` -- update the active-gun cohort only after exact SFX
   registry coverage passes.

The weapon itself still necessarily adds/edits `data/weapon-concepts-300.json`,
`data/weapon-tiers.json`, `packages/client/src/sprites/manifest.ts`, and its sprite asset. A genuinely
new vocabulary or mechanism may also require its appropriate production owner, such as
`packages/client/src/audio/gun-sfx.ts` or `packages/client/src/sprites/pose-language.ts`; that is a
behavior implementation, not census churn. Pump/lever/revolver/bolt/break, beam, or combo-route
classifications likewise touch their existing behavioral owner only when applicable.

`pnpm gen` may update generated expansion, limb-claim, muzzle, tier, card-manifest, portal, and VFX
subject artifacts. Those are generated outputs, not hand-maintained count pins. The thirteen former
pure-count test consumers require no future numeric edits.

## Verification

- `pnpm gen`: pass.
- `pnpm gen:check`: pass. The fresh isolated worktree emitted the expected skip warning for the VFX
  subject check because its 366 ignored reference artifacts are unavailable; every available
  generated artifact was in sync.
- `pnpm typecheck`: pass for shared, client, and server.
- Targeted affected set: 19/19 files pass, 854 passed and 10 skipped.
- Full suite run 1: 236/236 files pass; 2,873 passed and 20 skipped (2,893 total).
- Full suite run 2, consecutive with run 1: 236/236 files pass; 2,873 passed and 20 skipped (2,893
  total).
- Off-limit owner-map files are unchanged.

verdict: 23 tests fixed, 24 pins derived, 27 pins kept literal, 2 real defects found+fixed, files a future batch still touches: 9 manual census/audit review files plus authored/generated/conditional behavior owners, 2x test results: 236/236 files and 2,873 passed / 20 skipped each run.
