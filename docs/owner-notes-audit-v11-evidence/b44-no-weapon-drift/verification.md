# B44 verification and census

## Standing-law census

- Recursive runtime-catalog census: zero `forwardDrift`, `rootMotion`, `lunge`,
  `finisherDashImpulse`, `dashImpulse`, or `userKnockbackMultiplier` fields.
- Schema/generator census: the same displacement keys have no accepted schema or generated mapping.
- Runtime census: no pending weapon-lunge queue, weapon-lunge movement mode, gun locomotion recoil,
  cursor-warp player placement, or client weapon-recoil prediction remains.
- Retained server motion is closed over the typed `ServerMotionSource` union. Both
  `beginServerMotion` and `zeroMoveVel` require a source at compile time.
- Direct player transform writes were audited. The only writes outside named epochs are initial
  spawn/join placement and ordinary client-input, impulse-decay, body-collision, and navigation
  integration; none is an exceptional server-owned motion source.

The executable census and reach guard are in `tests/b44-no-weapon-drift.test.ts`.

## Reproduce and prove

- `GameRoom.b42-relaxed-authority.test.ts` drives a moving Sparkmitt full combo plus moving
  Cinderbrand and Venomtongue attacks. All three keep correction sequence zero and never open a
  weapon server-motion epoch.
- The private live gate used a real Colyseus server on OS-assigned loopback port 54741 with two
  simultaneous clients per scenario. Protected ports 5180 and 2567 were untouched.
- Sparkmitt: 28 moving frames, 7 accepted attacks, zero owner corrections, correction sequence
  `0 -> 0`.
- Venomtongue: 18 moving frames, 1 accepted attack, zero owner corrections, correction sequence
  `0 -> 0`.
- Stormfists: 18 moving frames, 1 accepted attack, zero owner corrections, correction sequence
  `0 -> 0`.
- A deliberately illegal 555.25 px client jump advanced the correction sequence and snapped to
  zero error, proving the telemetry rail was active during the gate.
- A committed-enemy parry slide advanced the server-motion epoch and converged both clients to
  zero error.
- Corporate elevator boarding advanced each player's epoch and teleport sequence and placed both
  clients at zero cross-client error.

Machine-readable results are in `live-summary.json`; every sampled frame is in
`live-telemetry.json`.

## Verification

- `pnpm gen` — pass
- `pnpm gen:check` — pass
- `pnpm typecheck` — pass
- `pnpm test` — pass, 197 files / 2,394 tests
- `DD_B44_LIVE=1 pnpm --filter @dd/server exec tsx ../../tools/b42-live-capture.mts` — pass
