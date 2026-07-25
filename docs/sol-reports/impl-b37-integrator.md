# B37 art integrator report

## Outcome

All four harvested art sets are wired into authoritative gameplay and client presentation:

1. **Ironhide Buffalo Gun** — regenerated metadata measures the redrawn `part-1.png` at
   768×252 with body center `(364.97, 137.14)`. The derived muzzle is `(767, 92.9)`.
   Re-authored normalized grips are primary `(0.29, 0.68)` and under-barrel secondary
   `(0.48, 0.66)`; alpha-sampling coverage and the two live facings verify that both hands land
   on the new flat side-profile art.
2. **Exploding Present Lobber** — all five installed present skins are preloaded and selected by
   one server-seeded roll per accepted shot. The one-based variant is replicated in the appended
   `ProjectileState.visualVariant` field under schema 43, making the server roll the sole truth for
   every client. Variant 5 is the big payload at exactly 1-in-8 odds. It uses 1.75× explosion
   radius and damage; regular payloads use `6.25 / 7` (0.892857…) explosion damage. Starting from
   8 direct + 11 explosion damage, the weighted result remains exactly 19 expected damage per shot
   (0% DPS delta): `8 + (7/8 × 9.821428… + 1/8 × 19.25) = 19`.
3. **Quicksilver Streetsweeper** — the B30 grenade placeholder is replaced with harvested shell
   `part-1.png`, and its impact uses harvested explosion `part-2.png` with procedural explosion
   layers suppressed. Authority radius 62 maps to an exact 124 px painted damage/display diameter.
4. **Fan tornadoes** — Iron Gale, Ember Fire, and Storm Shock each preload and cycle their three
   installed frames at 10 fps. Frame choice is derived deterministically from replicated
   `bornTick + flightAgeTicks` at the 20 Hz simulation rate. The sprite and its projectile
   container remain upright at rotation 0; the bitmap frames provide all visible spin.

The implementation retains the standing no-aura/no-chain/no-radial guardrails and does not touch
movement or netcode.

## Verification

Required gates:

- `pnpm gen` — PASS
- `pnpm gen:check` — PASS
- `pnpm typecheck` — PASS
- `pnpm test` — PASS, 193 test files / 2369 tests
- `pnpm assets:check` — PASS, including 31 projectile-art and 17 weapon-VFX URLs
- `git diff --check` — PASS
- changed text LF scan — PASS

Targeted B37 coverage:

- `tests/b37-art-integrator.test.ts` validates Buffalo dimensions, derived muzzle, grip alpha,
  five present assets, the seeded 1-in-8 roll, exact expected damage preservation, Streetsweeper
  shell/explosion envelope, and deterministic three-frame tornado cadence.
- `packages/server/src/rooms/GameRoom.b37-art-integrator.test.ts` validates replicated regular/big
  present authority plus the Streetsweeper grenade row.
- Existing projectile-facing and all explicit schema-version pins were migrated.

Live gate:

- `pnpm exec playwright test --config=e2e/playwright.config.ts e2e/tests/b37-art-integrator-live-gate.spec.ts --workers=1 --reporter=list`
  — PASS.
- Private ephemeral ports only: client 50633, game 50632; forbidden defaults 5180/2567 were not
  used.
- Buffalo was held and fired facing both right and left.
- Four authoritative present shots produced variants 4, 5, 4, and 1; variant 5 carried radius
  101.5 versus regular radius 58.
- Streetsweeper shell arc and painted explosion were captured; live audit reported matching
  `damageDiameter: 124` and `displayDiameter: 124`.
- All three frame textures for each of the three traveling tornadoes were captured with image and
  container rotations equal to zero.

Evidence is under `docs/owner-notes-audit-v11-evidence/b37-integrator/`: `live-gate.json`,
`README.md`, two Buffalo captures, three observed present-variant captures, two Streetsweeper
captures, and nine tornado frame captures (18 artifacts total).

## Files touched

Implementation, generated metadata, tests, and report (28 paths):

- `data/weapon-concepts-300.json`
- `packages/client/src/scenes/ArenaScene.ts`
- `packages/client/src/scenes/arena/projectile-facing.test.ts`
- `packages/client/src/scenes/arena/vfx.ts`
- `packages/client/src/sprites/manifest.ts`
- `packages/client/src/sprites/projectile-manifest.ts`
- `packages/client/src/vfx/VfxPlayer.ts`
- `packages/client/src/vfx/generated-image-weapon-vfx-recipes.ts`
- `packages/client/src/vfx/generated-image-weapon-vfx.ts`
- `packages/client/src/vfx/gun-projectile-art.ts`
- `packages/client/src/vfx/projectile-explosion-vfx-recipes.ts`
- `packages/client/src/vfx/wacky-weapon-vfx.ts`
- `packages/client/src/vfx/weapon-vfx.generated.ts`
- `packages/server/src/rooms/BossController.test.ts`
- `packages/server/src/rooms/GameRoom.b37-art-integrator.test.ts`
- `packages/server/src/rooms/GameRoom.test.ts`
- `packages/server/src/rooms/GameRoom.ts`
- `packages/server/src/rooms/progression.test.ts`
- `packages/shared/src/constants.ts`
- `packages/shared/src/state.ts`
- `packages/shared/src/weapons-expansion.generated.ts`
- `packages/shared/src/weapons.ts`
- `tools/artkit/build-weapon-vfx.mjs`
- `tools/artkit/gen-w4r-projectiles.mjs`
- `tools/artkit/weapon-vfx-overrides.json`
- `e2e/tests/b37-art-integrator-live-gate.spec.ts`
- `tests/b37-art-integrator.test.ts`
- `docs/sol-reports/impl-b37-integrator.md`

The 18 evidence artifacts named above are also included.

VERDICT: PASS — 4 sets wired; payload odds: part-5 big payload 1 in 8; tornado fps: 10; evidence path: docs/owner-notes-audit-v11-evidence/b37-integrator/; files touched: 28 implementation/test/report paths plus 18 evidence artifacts.
