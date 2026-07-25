# B42 — relaxed movement authority

Implemented on `sol/b42-relaxed-authority` from B41's shared attack-movement parity baseline. Movement feel
is now owner-authored inside a bounded server envelope; combat, enemies, damage, loot, chests, relics,
bosses, progression, and economy remain server-authoritative.

## Wire and adoption flow

Schema `42 → 43`. Each fixed prediction tick now appends the owner's post-step `x/y`, steering velocity
`mvx/mvy`, impulse velocity `vx/vy`, last observed `serverMotionEpoch`, and last observed
`movementCorrectionSeq` to the existing sequence-numbered input. Transport-only edge samples do not claim
a movement tick.

1. The client runs B41's shared fixed step and sends that exact resulting pose with the command sequence.
2. The server still runs the same shared step. This preserves parity validation and a safe fallback.
3. A fresh report is considered only when its correction and server-motion epochs match the current wire
   state and no server-motion window is active. Held/stale reports are never re-adopted.
4. The pure shared envelope rejects non-finite values, component speed excess, combined speed excess, and
   excess displacement.
5. The room sweeps the complete segment in 4 px samples through arena/belt bounds, pits, POIs, deck
   obstacles, lanes, and closed gates.
6. Accepted `x/y/mvx/mvy` become `PlayerState` truth after the legacy friend-body pass. Enemy targeting,
   committed lunges, hit registration, and every remote snapshot therefore consume the adopted point.
7. A violation leaves the server simulation point intact and increments `movementCorrectionSeq`. The owner
   then applies the correction-band policy.

No movement report contains combat results or economy state. Co-op friends are intentionally not movement
authority walls, but map navigation remains enforced.

## Plausibility envelope

| Row | Accepted budget | Reject |
| --- | --- | --- |
| Numeric floor | All six pose/velocity values and all envelope inputs finite | NaN/infinity or partial malformed report |
| Walk / attack transition | Relic-adjusted base speed, plus 24 px/s tolerance | `|mv| > budget + 24` |
| Distance jump / dodge | Authored dash or roll speed for its active shared-sim tick | Speed beyond the active verb budget |
| B41 attack movement | The shared server step's exact current authored movement vector | Generic speed outside that authored tick |
| Owner-authored recoil | Current/recoil weapon impulse budget | `|impulse| > budget + 24` |
| Combined motion | Move + impulse vector within the summed budgets plus one 24 px/s tolerance | Excess total velocity |
| Continuity | `(move budget + impulse budget) × 50 ms + 3 px`, plus an explicit authored allowance when supplied | Teleport-sized displacement |
| Arena navigation | Full swept segment inside player bounds, off grounded pits, and clear of POIs | Wall/POI/pit/out-of-world clip |
| Belt navigation | Full swept segment inside playable X, depth lane, current gate, deck obstacles, and grounded pit gaps | Lane/gate/deck/pit clip |
| Server motion | Client report ignored for the complete epoch | Client cannot overwrite parry/launch/lunge/elevator/pit/revive placement |

The shared matrix covers walk, dash/dodge, authored allowance, NaN, infinity, move speed, impulse speed,
combined speed, and continuity. Room tests add arena bounds, pits, swept navigation, stale epoch behavior,
parry placement, and a single continuous elevator departure/arrival epoch.

## Server-motion epochs

`DualWieldState` appends:

- `movementCorrectionSeq: uint32`
- `serverMotionEpoch: uint32`
- `serverMotionActive: boolean`

Hostile/contact impulses, parry lifts/slides, juggle launches, weapon lunges, ult-owned motion, pit/revive
and other `zeroMoveVel` placements now open or extend server ownership. Epochs advance only on an inactive
to active edge. Corporate departure reassertions no longer mint a fresh teleport/epoch every tick; the
departure and arrival are one continuous server-motion epoch with two actual placement cuts.

## Correction bands

| Error | Owner behavior | Remote/spectator behavior |
| --- | --- | --- |
| `< 3 px` | Silent snap; no correction tail | Snap to the newer sample; do not extrapolate dust |
| `3 px` to `< 200 px` | Linear smoothing with a non-restartable hard deadline of **140 ms** | Interpolate over `min(snapshot span, 140 ms)` |
| `≥ 200 px` or non-finite | Instant snap | Instant cut; never interpolate/extrapolate |

Fresh patches cannot restart an active medium window. At the deadline, float epsilon handling forces both
error and remaining time to exact zero. The old uncapped exponential/directional correction path is no
longer used in production. The net debug readout now includes the cumulative self-correction counter as
`…/<count>c`.

## Co-op and authority guardrails

- Accepted movement is written before enemy/combat phases, so enemy chase, B33 commit targeting, melee,
  projectiles, and boss logic use the adopted server `PlayerState`.
- Dodge/parry immunity and all damage decisions remain server verbs; a pose report cannot claim an evade.
- Damage, loot, money, chests, relics, weapon state, enemies, and bosses were not added to the client report.
- B41 shared attack-movement tests and the complete B33/parry/dodge/hit suite remain green.
- Invalid numeric and out-of-world reports cannot enter schema state.

## Verification

- `pnpm gen:check` — pass.
- `pnpm typecheck` — pass.
- `pnpm test` — pass, **194 files / 2,376 tests**.
- Focused B42 matrix — pass, **30 tests** across shared envelope, owner correction, remote snapshots, room
  adoption, parry, and elevator epochs.
- Real transport gate — pass on OS-assigned loopback port **57676**; ports 5180/2567 untouched; no live-stack
  boot. Each scenario used two simultaneous Colyseus clients.

Live results:

- 32 aggressive attack–move–stop ticks: `selfCorrections = 0`, `movementCorrectionSeq = 0`.
- Observer: exact adopted authority (`0 px` mismatch) and 25 intermediate interpolation samples.
- Forced debug teleport: 560 px violation, correction sequence `0 → 1`, owner error `560 → 0 px`
  immediately, remaining correction time `0 ms`.
- Real committed-lunge parry: 25.6001 px server slide, epoch `1 → 2`, medium window starts at `140 ms` and
  ends at `0 px` owner error; observer error `0 px`.
- Real corporate elevator: floor `1 → 2`, one epoch `0 → 1`, both players agree on both clients with
  `0 px` cross-client error.

Evidence:

- [`README.md`](../owner-notes-audit-v11-evidence/b42-relaxed-authority/README.md)
- [`live-summary.json`](../owner-notes-audit-v11-evidence/b42-relaxed-authority/live-summary.json)
- [`live-telemetry.json`](../owner-notes-audit-v11-evidence/b42-relaxed-authority/live-telemetry.json)

## Files touched

- Shared: `packages/shared/src/{constants,index,state,movement-authority,movement-authority.test}.ts`
- Server: `packages/server/src/rooms/{GameRoom,GameRoom.test,GameRoom.b42-relaxed-authority.test,BossController.test,progression.test}.ts`
- Client: `packages/client/src/net/{prediction,prediction.b42.test,snapshots,snapshots.test}.ts`,
  `packages/client/src/scenes/ArenaScene.ts`
- Gate/evidence/report: `tools/b42-live-capture.mts`,
  `docs/owner-notes-audit-v11-evidence/b42-relaxed-authority/{README.md,live-summary.json,live-telemetry.json}`,
  `docs/sol-reports/impl-b42-relaxed-authority.md`

Verdict: self-corrections zero in normal play (telemetry): PASS (0/32); envelope matrix: PASS; cap ms: 140; co-op verified 2-client: PASS; evidence path: `docs/owner-notes-audit-v11-evidence/b42-relaxed-authority/`; files touched: 20.
