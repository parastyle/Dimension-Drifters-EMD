# B22 / L1 reconciliation report

## Diagnosis and proof

The root cause is the live gate, not B22 game behavior.

- Current merge `839a89e` reproduced the reported assertion with
  `pathLateralDistanceToTarget = 162.91473556833392`. The pre-L1 merge parent is `d4333d4`.
- Catalog hypothesis rejected: the L1 diff removes `scalingGrades` and `requirements`, but all three
  fans retain their melee range and the complete hybrid payload: one zero-spread, one-pierce tornado
  at 520 px/s over 260 px. L1's `heldDamageMult` collapse only changes damage multiplication.
- Authority hypothesis rejected: `GameRoom.emitHybridProjectile` still freezes the accepted aim,
  uses the authored muzzle, and launches `fan:tornado` with
  `CombatDelivery.HybridProjectile`. `GameRoom.b3-fans.test.ts` proves a 0.5 s lifetime, forward
  travel in both facings, 520 px/s velocity, and the unchanged 48 x 76 damage capsule.
- RNG hypothesis rejected as a game-code cause: the damage probe uses stationary training dummies.
  L1 can change incidental scheduling or random consumption, but it cannot change a pinned dummy's
  position or the authored fan rail.
- Gate-harness hypothesis confirmed. The gate repeatedly sent an attack aimed at its dummy while the
  production 50 ms input heartbeat independently called `ArenaScene.currentBeamAim()` from the live
  pointer and overwrote the server's buffered aim. Diagnostics observed multiple same-weapon
  projectiles traveling left (for example `p6`, `p7`, and `p8`) while the selected target was on a
  different bearing; a later projectile (`p9`) took the intended path and hit.
- The gate then compounded that race by accepting any same-weapon hybrid contact and choosing the
  nearest-tick same-weapon sample. It could therefore pair one tornado's receipt with another
  in-flight tornado's path, producing the false 162.91 px lateral result.
- The old `moveIntoCloseRange` helper was not deterministic either. Its hand-minted input sequence
  raced the real predictor heartbeat and timed out when movement was actually required. The nearest
  dummy happened to start at 150 px, masking that dead assumption, while such a close collision could
  also remove a projectile before the browser observed a replicated travel row.

## Fix

The product implementation and all B20 stat teardown remain unchanged. The B22 live gate now:

1. Selects the stationary dummy closest to 250 px and requires it to be 200–300 px away, providing
   enough deterministic runway for replication without moving the player.
2. Starts every damage proof from a drained fan-projectile epoch.
3. Temporarily replaces `ArenaScene.currentBeamAim()` with a live player-to-dummy aim. Both the
   production input heartbeat and explicit attack messages therefore carry the same target, and the
   original method is restored when the epoch ends.
4. Admits a hybrid contact only after a same-weapon projectile sample exists within the original
   two-tick window, preventing cross-pairing with an unrelated same-weapon tornado.
5. Retries an accepted presentation attack up to three times only when its short-lived rendered row
   was not observable. A successful capture must still pass every original travel, geometry, and
   sole-VFX assertion.

No tolerance was loosened. The 72 px lateral bound, `[-72, range]` forward bounds, two-tick maximum,
48 px server travel, 16 px rendered travel, upright/non-spinning checks, and visual/damage capsule
equality are unchanged.

## Verification

- `pnpm gen:check`: passed.
- `pnpm typecheck`: passed.
- `pnpm test`: passed, 167 files and 2,192 tests.
- B22 live gate: passed twice consecutively after the final gate edit. Both runs asserted private
  client/game ports and rejected 5180/2567. The retained run used client 52580 and game 52579; its
  three damage proofs were one tick from their contacts with lateral distances 17.57, 27.18, and
  15.12 px.
- `black-screen.smoke.spec.ts`: passed on private game port 62858.
- `b23-kungfu-v2-live-gate.spec.ts`: passed on retry 2 with client 53209/game 53208. The untouched
  B23 gate showed pre-existing capture sensitivity on earlier attempts at unrelated audit points
  (different missing combo/showcase events, a four-sample frame, and one Phaser cadence reading).
  No B23 source, assertions, or retained B23 evidence was changed.

The retained evidence is
`docs/owner-notes-audit-v11-evidence/b22-l1-reconcile/live-gate.json` plus six facing screenshots and
`verification.md`.

## Files touched

- `e2e/tests/b22-fan-tornado-v2-live-gate.spec.ts`
- `docs/sol-reports/impl-b22-l1-reconcile.md`
- `docs/owner-notes-audit-v11-evidence/b22-l1-reconcile/*`

VERDICT: root cause = gate (production heartbeat aim overwrite plus cross-paired contact/projectile epochs); fix = pin a stationary mid-range target, align heartbeat and attack aim, drain/correlate projectile epochs, and retain every original bound; B22 gates 2x green; evidence = docs/owner-notes-audit-v11-evidence/b22-l1-reconcile/; files touched = e2e/tests/b22-fan-tornado-v2-live-gate.spec.ts, docs/sol-reports/impl-b22-l1-reconcile.md, docs/owner-notes-audit-v11-evidence/b22-l1-reconcile/*.
