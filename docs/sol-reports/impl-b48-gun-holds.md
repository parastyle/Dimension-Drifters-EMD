# Sol report — B48 gun holds and mechanisms

Branch: `sol/b48-gun-holds`

Worktree: `C:/Users/Exped/ddv2-wt/b48-gun-holds`

Owner orders: 2026-07-24/25

## Verdict

PASS. All eight requested gun hold/mechanism corrections are implemented, generated, regression
tested, and captured live in both facings.

## Order closure

1. `x2-hallowbore-coachgun`
   - Reclassified from `pump` to `revolver`.
   - Added an authored `hammer` secondary grip.
   - Routed the B29 fan-hammer beat and above-weapon hand layer to the two-hand support hand.
2. `x2-boomstick-saddlegun`
   - Reclassified from `pump` to `lever`.
   - Re-anchored the trigger and painted lever hand; accepted shots drive the secondary lever hand.
3. `x2-dustline-lever-action`
   - Added a `0.72 rad` lever-hand angle relative to the weapon axis while retaining trigger-loop contact.
4. `x2-gravedog-auto-rifle`
   - Kept `bulletKind: "tracer"` and added `projectileArt: "bullet"`.
   - The projectile factory now renders a metallic ballistic core beneath the retained tracer presentation.
5. `x2-widowmaker-arbalest`
   - Moved the trigger grip rearward enough to seat the stock at the shoulder.
   - Re-anchored the second hand on the painted crank.
6. `x2-whisperbarb-hand-crossbow`
   - Added a persistent authored dual vertical split (`0.1` body height per half-gap).
   - The shared weapon/muzzle affine applies the same split, so presentation and launch origins agree.
7. `x2-powderkeg-mortar`
   - Moved the firing hand to the painted handle.
   - Preserved the prior fallback support point exactly at `(0.70, 0.68)`.
8. `x2-thunderhead-repeater-cannon`
   - Moved the support hand to the barrel.
   - Mechanism ownership is derived from the grip role, so the trigger hand performs the lever cycle.

## Deliberate census movement

| Census | Before | After | Delta |
| --- | ---: | ---: | ---: |
| Pump handling | 13 | 11 | -2 |
| Lever handling | 9 | 10 | +1 |
| Revolver / fan-hammer handling | 18 | 19 | +1 |
| Cycling mechanisms (`break`, `bolt`, `lever`, `pump`) | 29 | 28 | -1 |

The net cycling-mechanism decrease is Hallowbore leaving the pump family; Boomstick moves from pump
to lever and therefore remains in the cycling census.

## Schema and migration

- Added the declarative `hammer` secondary-grip role.
- Added optional `gripPoints.secondary.angleRad`.
- Added optional `dualVerticalSplit` for persistent paired presentation.
- Added `bullet` to the projectile-art schema and generator validation.
- Updated Pose Studio row validation and generated weapon definitions.
- Migrated B29, V3G, W4G, and SpriteRig pins to the new census and mechanism-grip exceptions.
- Added `tests/b48-gun-holds.test.ts` and the private-stack live gate
  `e2e/tests/b48-gun-holds-live-gate.spec.ts`.
- B45 gun-recoil constants and recoil authoring were not changed.

## Verification

- `pnpm gen` — PASS.
  - The tracked VFX-subject manifest was preserved after the known fresh-worktree scratch-art omission.
- `pnpm gen:check` — PASS.
  - Expected warning: VFX-subject check skipped because 339 gitignored reference artifacts are absent.
- `pnpm typecheck` — PASS.
- `pnpm test` — PASS: 212 files, 2,737 tests.
- Focused B48/migrated regressions — PASS: 65 tests plus the 14-test W4G migration suite.
- `pnpm e2e -- e2e/tests/b48-gun-holds-live-gate.spec.ts` — PASS.
  - 16 combat-scale screenshots: eight weapons × right/left facing.
  - Private client/game ports: `54922` / `54921`; protected defaults `5180` / `2567` untouched.
  - Runtime receipt asserts hammer routing, lever/pump ownership, lever-hand rotation, hand contact,
    dual separation, stock placement, and Gravedog's ballistic core.
- Final screenshot contact-sheet inspection — PASS.
- `git diff --check` — PASS.

## Evidence

Evidence root: `docs/owner-notes-audit-v12-evidence/b48-gun-holds/`

- `live-gate.json` — machine-readable ports, assertions, pose samples, and screenshot index.
- `live-gate-summary.md` — concise live-gate receipt.
- 16 PNG captures named `<weapon-id>-<left|right>.png`.

## Files touched

- Catalog/schema/generation:
  - `data/weapon-concepts-300.json`
  - `packages/shared/src/weapons.ts`
  - `packages/shared/src/weapons-expansion.generated.ts`
  - `tools/artkit/gen-weapon-expansion.mjs`
  - `tools/weaponsmith/catalog-row-store.mjs`
- Client presentation:
  - `packages/client/src/entities/SpriteRig.ts`
  - `packages/client/src/entities/rig/rig-gear.ts`
  - `packages/client/src/entities/rig/rig-gun-mechanisms.ts`
  - `packages/client/src/entities/rig/rig-pose.ts`
  - `packages/client/src/scenes/arena/projectile-factory.ts`
  - `packages/client/src/sprites/pose-language.ts`
  - `packages/client/src/sprites/secondary-grip.ts`
- Regression/live gates:
  - `packages/client/src/entities/SpriteRig.ranged.test.ts`
  - `tests/b29-ranged-presentation.test.ts`
  - `tests/b48-gun-holds.test.ts`
  - `tests/v3g-gun-handling.test.ts`
  - `tests/w4g-systemic-owner-orders.test.ts`
  - `e2e/tests/b48-gun-holds-live-gate.spec.ts`
- Audit artifacts:
  - `docs/owner-notes-audit-v12-evidence/b48-gun-holds/`
  - `docs/sol-reports/impl-b48-gun-holds.md`

verdict: 8 orders done; census deltas pump -2, lever +1, fan-hammer +1, cycling mechanisms -1; evidence `docs/owner-notes-audit-v12-evidence/b48-gun-holds/`; files touched listed above.
