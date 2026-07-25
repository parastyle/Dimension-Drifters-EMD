# Sol implementation: B51 warp / snap corrections

## Result

B51 is fixed. Server-owned placements now register their motion epoch before synchronized
position fields change, the impulse window is derived from the actual capped decay, and every
confirmed client prediction/reconciliation mismatch from the diagnosis is covered by production
changes and passing regressions.

The final live harness completed all 41 scenarios with zero correction requests, zero nonzero
corrections, zero silent/smooth/snap applications, and zero total correction magnitude. The
pre-fix capture recorded 449 requests, 114 nonzero corrections, 6102.003706 px of correction,
and 6 snaps.

## Server placement ordering

`placeWithMotionEpoch(player, source, callback, ticks)` is the atomic placement primitive. It
calls `beginServerMotion` first and only then executes the callback that mutates position. The
audit converted 11 placement call sites:

| # | Placement |
| ---: | --- |
| 1 | Testing-Grounds center teleport |
| 2 | Run restart spawn |
| 3 | Belt pit snap-back |
| 4 | Arena pit snap-back |
| 5 | Corporate elevator board/depart/arrival positioning |
| 6 | Rift-descent spawn |
| 7 | Dimension Door outbound blink |
| 8 | Dimension Door return blink |
| 9 | Seismarch progressive placement |
| 10 | Event Horizon progressive placement |
| 11 | Alpha Strike target placement |

A follow-up assignment-to-`zeroMoveVel` / `beginServerMotion` grep found no remaining unwrapped
player-placement path. Matches that remain are inside the helper callback, so the epoch is already
open before each assignment.

## Impulse ownership window

The old fixed value of 12 protected only 11 future integrations because impulse sources register
after the current movement phase and the expiry tick is exclusive. The replacement derives the
duration from the same values as the decay:

```text
floor(log(IMPULSE_MAX / IMPULSE_EPSILON) /
      (IMPULSE_FRICTION * TICK_SECONDS)) + 2
= floor(log(780 / 5) / (9 * 0.05)) + 2
= 13 ticks
```

The first `+1` implicit in the floor-to-count conversion owns every nonzero integration under the
strict epsilon rule; the second owns the late-registration tick. At the cap, integration 12 starts
at 5.525058965 px/s, moves 0.276252948 px, and then decays below epsilon to zero. All 12 future
integrations are now inside the epoch.

## Client parity and correction policy

The client now:

- predicts direct gun and burst recoil and continuous active-beam recoil;
- mirrors beam charge/channel and Sunspite windup movement multipliers from existing synced rows;
- predicts relic air jumps while tracking/refilling the authoritative charge count;
- supplies belt depth bounds and the live room-gate bound to the shared movement step;
- preserves an in-progress medium correction across quiet patches and does not top it up on each
  active epoch patch;
- lets the B42 correction band win over the B44 locomotion presentation bound;
- treats server-motion and teleport edges as authoritative cuts rather than correction requests;
- admits the immediately preceding epoch only after motion releases, while retaining the complete
  numeric envelope, correction-sequence check, and navigation sweep. Active-motion and older-epoch
  reports remain inadmissible.

No correction threshold, envelope budget, navigation check, or silent/smooth/snap band was
weakened.

## Regression migration

The diagnosis repros were migrated to:

- `packages/server/src/rooms/GameRoom.b51-warp-fix.test.ts`
- `packages/client/src/net/prediction.b51-warp-fix.test.ts`

They contribute 21 effective passing cases: 11 server cases and 10 client cases. The existing B42
authority test now also proves that a one-epoch-old post-release report still runs through and can
pass the ordinary authority path.

## Telemetry proof

The harness now mirrors the production predictor's recoil, phase-scalar, air-jump, and belt-gate
context. It retains direct motion-source open events so one-tick epochs cannot be lost between frame
snapshots, uses the production elevator placement path for a stable fixture, and fails the command
unless all 41 scenarios run with zero nonzero corrections and zero snaps.

The full ranked comparison is
[`before-after-ranked.md`](../owner-notes-audit-v12-evidence/b51-warp-fix/before-after-ranked.md).
Raw authority frames and correction instrumentation are under
`docs/owner-notes-audit-v12-evidence/b51-warp-fix/`.

## Verification

- `pnpm gen` — PASS
- `pnpm gen:check` — PASS
- `pnpm typecheck` — PASS
- `pnpm test` — PASS, 215 files / 2,762 tests
- 41-scenario live telemetry — PASS, 41/41 clean
- `git diff --check` — PASS

## Files touched

The 28-file final delta comprises:

- 8 runtime/authority files: client prediction and arena wiring; server room shell, combat,
  movement, and progression; shared constants and movement authority;
- 3 regression files: the migrated client and server B51 suites plus the updated B42 authority
  expectation;
- 1 telemetry harness;
- 7 B51 evidence files, including the ignored-by-default `run.log` committed explicitly;
- 8 imported diagnosis report/evidence files used as the before capture;
- this implementation report.

verdict: 11 placement sites converted; impulse window = floor(log(780/5)/(9*0.05)) + 2 = 13 ticks, covering 12 future integrations; 41/41 scenarios clean (before: 114 nonzero / 6102.003706 px / 6 snaps; after: 0 / 0 px / 0); evidence: docs/owner-notes-audit-v12-evidence/b51-warp-fix/; files touched: 28 final-delta files.
