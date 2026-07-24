# B41 ice-slide playfeel fix

## Outcome

The attack speed multiplier was already present in both simulations, so the hand-merge did not leave
a simple client/server multiplier omission. The two paths did, however, compose that rule separately.
They now call one shared `stepPlayerAttackMovement` seam, including the belt bounds, which makes
ordinary attack steering identical by construction.

The long visible slide came from authored root motion. Stormfists replaced server input with a large
server-authored displacement, while the owner predictor only knew that `RootMotion` made input speed
zero. Reconciliation therefore mislabeled the authored distance as generic prediction error. Its
ordinary movement-budget-limited decay kept moving the rendered character after the stick was
released. A deterministic 360 px authored move took 28 fixed ticks (1.4 s) to retire in the old path.

The predictor now recognizes the enter/exit edge of authoritative root motion and presents that
authored result directly instead of turning it into correction debt. It also retires only the
mathematically bounded correction created when a released `InputSlow` attack returns to `Normal`.
Unrelated reconciliation errors retain the existing smoothing behavior.

## Stale-mode and damping checks

- `playerAttackMoveMode` returned to `Normal` after the attack in the server regression.
- Releasing input during `InputSlow` stopped `mvx`/`mvy` in 2 fixed ticks.
- The existing `MOVE_STOP_DECEL = 2600` path was healthy; it was not the source of the seconds-long
  tail.
- The server player remained position-stable after both velocity zero and attack-mode recovery.

## Regression coverage

`packages/client/src/net/prediction.b41.test.ts` pins:

- tick-for-tick authority/predictor equality while attack input is slowed;
- zero-input velocity stop within 3 fixed ticks;
- the old 28-tick decay reproduction for a 360 px authored root move;
- zero reconciliation debt through root-motion entry, release, and recovery;
- bounded slow-mode release correction retirement.

`packages/server/src/rooms/GameRoom.b5-attackroot.test.ts` now also pins the server stop bound, mode
cleanup, and stationary recovery.

## Verification

- `pnpm typecheck` — pass.
- `pnpm test` — pass: 190 files, 2348 tests.
- Private live stack — production Colyseus server and source client on game port `53471` and client
  port `53472`; protected defaults `2567`/`5180` were untouched.
- Arena Sparkknuckle `InputSlow` — stopped in 2 ticks, 0 px recovery delta, 0 px post-stop travel.
- Arena Stormfists `RootMotion` — stopped in 1 tick, 0 px recovery delta, 0 px post-stop travel.
- Belt Sparkknuckle `InputSlow` — stopped in 2 ticks, 0 px recovery delta, 0 px post-stop travel.
- Belt Stormfists `RootMotion` — stopped in 1 tick, 0 px recovery delta, 0 px post-stop travel.

The in-app browser backend exposed no browser instance during the gate. The live fallback still used
the real private-port server, real `colyseus.js` protocol, normal room/input/attack messages, and the
production `SelfPredictor`; it did not replace either simulation with a test double.

## Evidence

All receipts are under `docs/owner-notes-audit-v11-evidence/b41-ice-slide/`:

- `unit-repro.json` — deterministic old/new tail accounting.
- `live-summary.json` — compact four-scenario gate result and private-port receipt.
- `live-telemetry.json` — acknowledged frame telemetry for authority, prediction, movement mode,
  velocity, and error.
- `live-gate.md` — capture method and readable result table.

## Files touched

- `packages/shared/src/movement.ts`
- `packages/client/src/net/prediction.ts`
- `packages/client/src/net/prediction.b41.test.ts`
- `packages/server/src/rooms/GameRoom.ts`
- `packages/server/src/rooms/GameRoom.b5-attackroot.test.ts`
- `tools/b41-live-capture.mts`
- `docs/owner-notes-audit-v11-evidence/b41-ice-slide/{unit-repro.json,live-summary.json,live-telemetry.json,live-gate.md}`
- `docs/sol-reports/impl-b41-ice-slide.md`

Merge note: the `GameRoom.ts` edit is confined to the ordinary movement integration block; preserve
the shared helper call when rebasing over B36 combo work. There is no SpriteRig/B40 overlap.

VERDICT: root cause = authored RootMotion and bounded InputSlow mode-edge corrections were misclassified as generic reconciliation debt; parity restored with one shared attack-movement seam and attack-aware reconciliation; stop 28 ticks before -> 1-2 ticks after (contract <= 3); evidence path = docs/owner-notes-audit-v11-evidence/b41-ice-slide/; files touched = shared movement, client prediction/tests, server movement/test, live capture, evidence, and this report.
