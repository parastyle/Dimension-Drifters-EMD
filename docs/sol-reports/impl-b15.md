# B15 implementation report — small VFX removals

## Understanding

B15 removes bespoke visual effects from Rusty Cleaver (`rusty-cleaver`) and Tombstone Greatsword (`tombstone-greatsword`) through their authoritative base catalog data. The same serialized VFX change also carries the adjacent B10 amendment for Drowned Anchor (`x-sword-anchor`), removing its explicit deluge recipe and associated runtime/test expectations. All three weapons must retain their existing gameplay: Rusty's own-sprite throw and 124 px cosmetic arc, Tombstone's quake authority, and Drowned Anchor's blade damage, reach, cadence, and normal animation.

This is a data/VFX-generation task. It will not change `SpriteRig`, combat authority, attack cadence, damage, reach, or weapon animation behavior. The acceptance contract is that no weapon has a bespoke `WEAPON_VFX` treatment or effect-recipe resolution, including held, accepted-action/release, in-flight, and impact eligibility.

## Plan

1. Inspect the three catalog records, the VFX generator, effect-recipe table, and existing owner-order/census tests.
2. Add explicit no-VFX catalog contracts for Rusty Cleaver and Tombstone Greatsword; remove Tombstone's painted-quake metadata; remove Drowned Anchor's explicit recipe/emitter/timing metadata.
3. Remove any now-orphaned Drowned runtime recipe and update superseded positive owner-note expectations.
4. Regenerate authoritative output with `pnpm gen`, add a focused three-ID negative VFX test, and reconcile exact VFX census expectations.
5. Run `pnpm gen:check`, `pnpm typecheck`, the focused tests, and full `pnpm test`; verify LF endings and nominal DPS preservation.
6. Append per-weapon evidence and the final verdict, then commit the bounded implementation on `sol/b15-vfx-remove`.

## Source-of-truth note

The three IDs are legacy curated weapons and have no rows in `data/weapon-concepts-300.json`. Their authoritative definitions live in the pure-data `BASE_WEAPONS` table in `packages/shared/src/weapons.ts`. Duplicating them into the expansion concepts file would not be behavior-neutral: the expansion generator clamps Tombstone's 270 px quake radius to 220 px and supplies other generated defaults. The implementation therefore edits the actual base data table and the existing recipe/override data sources, leaving expansion concepts unchanged so gameplay remains exact.

## Rusty Cleaver (`rusty-cleaver`)

- Added the explicit `suppressVfx: true` catalog contract. No generated `WEAPON_VFX` entry or explicit effect recipe existed, so the suppression also prevents synthesized swing-suite eligibility.
- Preserved direct damage/cadence at `4 / 0.26`, the own-sprite thrown payload at 7 damage, three charges, 1.5 s refill, 660 speed, 520 range, two pierces, and the 124 px cosmetic arc.
- Focused evidence: `tests/b15-vfx-removals.test.ts` locks the empty resolved suite, absent generated entry/recipe, and all throw values.

## Tombstone Greatsword (`tombstone-greatsword`)

- Added `suppressVfx: true`, removed the authored `quake.vfx` block, and deleted the B10 `paintedQuake` override. Regeneration consequently removed Tombstone from `WEAPON_VFX`.
- Preserved direct damage/cadence at `11 / 0.78` and authoritative quake authority at radius 270 and damage 8.
- Updated `tests/b10-vfx-owner-orders.test.ts` to record the B10 stone/smoke treatment as superseded. The B15 test proves no painted/generated/fallback quake treatment resolves.

## Drowned Anchor (`x-sword-anchor`)

- Removed `effectRecipe`, `effectEmitter`, and `effectTiming` from the base definition; removed `drowned-anchor-deluge` from the shared recipe ID union, generator allow-list, and client recipe table.
- Preserved direct damage/cadence at `14 / 0.95`, range 172, display length 247.5, swing arc 3.1, two-handed blade identity, and normal fallback swing animation.
- Updated the superseded V6M positive water-density test. The B15 test proves the recipe and generated bespoke-VFX entry are absent.

## Verification

- `pnpm gen` — green; `weapon-vfx.generated.ts` regenerated with 30 entries and no B15 IDs.
- `pnpm gen:check` — green after final changes; generated weapon expansion, VFX, assignments, manifests, and portal are synchronized.
- `pnpm typecheck` — green across shared, client, and server.
- Focused gate — 5 test files / 395 tests passed, covering B15, B10, V6M, Drowned geometry, and data consistency.
- Full `pnpm test` — 151 test files / 1,967 tests passed.
- `git diff --check` and explicit touched-file newline census — green, LF only.
- No live stack was booted.

Verdict: 3 weapons stripped; evidence: `tests/b15-vfx-removals.test.ts` and `packages/client/src/vfx/weapon-vfx.generated.ts`; files touched: `packages/shared/src/weapons.ts`, `packages/client/src/vfx/weapon-effect-recipes.ts`, `packages/client/src/vfx/weapon-vfx.generated.ts`, `tools/artkit/gen-weapon-expansion.mjs`, `tools/artkit/weapon-vfx-overrides.json`, `tests/b15-vfx-removals.test.ts`, `tests/b10-vfx-owner-orders.test.ts`, `tests/v6m-melee-owner-orders.test.ts`, `docs/sol-reports/impl-b15.md`.
