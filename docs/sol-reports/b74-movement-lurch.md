# B74 — Movement lurch

Date: 2026-07-26
Branch: `sol/b74-movement-lurch`

## Outcome

Ordinary locomotion now has exactly two root-speed states: `MOVE_SPEED` (`320 px/s`) for any
non-zero normalized input, and zero for released input. The only scalar seam left in the shared
stepper is its explicit `speed` argument, which is where sanctioned attack, parry, or environmental
slow rules compose. Facing, aim, gait, direction, relics, and retained velocity cannot alter the
ordinary speed.

No wire shape changed, so `SCHEMA_VERSION` did not change.

## Lurch root cause

The eight-way input path was already normalized exactly once. Aim/facing was not consulted by
movement, so there was no hidden backpedal multiplier and no diagonal-length error.

The speed violation was explicit in `steerVelocity`:

- Rest started through `MOVE_RECOVER_ACCEL`, producing `130`, `260`, then `320 px/s`.
- A movement-heading change greater than `MOVE_HITCH_MIN_ANGLE` applied `MOVE_HITCH_DIP`. A full
  reversal produced `306.56 px/s` for its first frame, then recovered to `320`.
- Release retained and decelerated the old magnitude instead of stopping immediately.

That made direction changes phase-lock a speed dip/recovery into the root. Backwards-down exposed
the lane clearly, but the code did not distinguish backpedalling; the same illegal magnitude change
was present in every direction.

There was a second presentation-side speed violation. The B68 root-debt limiter added both
`+48 px/s` and `+2 px per rendered frame` above declared locomotion. The latter was refresh-rate
dependent and allowed correction debt to pulse the visible root faster than the actor's movement
law. Active movement is now capped at declared locomotion plus sanctioned gun recoil. The `48 px/s`
floor is available only as a quiet idle-debt retirement rate, and the per-frame additive margin is
gone.

The live telemetry harness also exposed a scheduling race rather than another movement modifier.
One loaded render frame may mint up to `INPUT_MSGS_PER_TICK` fixed client steps, while the server
drains the newest report. The B42 continuity gate only admitted one step and could reject an
otherwise constant-rate batched report. Its report horizon now admits exactly the bounded fixed-step
batch while retaining the `320 px/s` velocity ceiling, navigation sweep, impulse checks, and
oversized-report rejection. A predicted gun shot sharing the same fixed tick likewise admits only
that gun's authored recoil; arbitrary impulse still rejects.

## Speed samples

Samples are velocity magnitudes in `px/s`. Each direction was entered from a full-speed opposite
heading, which is the strongest old hitch case. “Backpedal” points aim opposite the movement vector;
“forward” points aim with it.

| Direction | Before, forward | Before, backpedal | After, forward | After, backpedal |
| --- | --- | --- | --- | --- |
| E | `306.560000, 320.000000…` | `306.560000, 320.000000…` | `320.000000 ×24` | `320.000000 ×24` |
| SE (backwards-down repro) | `306.560000, 320.000000…` | `306.560000, 320.000000…` | `320.000000 ×24` | `320.000000 ×24` |
| S | `306.560000, 320.000000…` | `306.560000, 320.000000…` | `320.000000 ×24` | `320.000000 ×24` |
| SW | `306.560000, 320.000000…` | `306.560000, 320.000000…` | `320.000000 ×24` | `320.000000 ×24` |
| W | `306.560000, 320.000000…` | `306.560000, 320.000000…` | `320.000000 ×24` | `320.000000 ×24` |
| NW | `306.560000, 320.000000…` | `306.560000, 320.000000…` | `320.000000 ×24` | `320.000000 ×24` |
| N | `306.560000, 320.000000…` | `306.560000, 320.000000…` | `320.000000 ×24` | `320.000000 ×24` |
| NE | `306.560000, 320.000000…` | `306.560000, 320.000000…` | `320.000000 ×24` | `320.000000 ×24` |

The separate before-start sample was `130.000000, 260.000000, 320.000000…` in every direction.
After B74, both the persisted velocity magnitude and position-derived frame speed are
`320.000000000` for all 384 sampled frames (8 directions × 2 facing modes × 24 frames). Minimum,
maximum, and variance are respectively `320`, `320`, and `0`; test tolerance is `1e-9`.

The legacy Roadrunner Spur used the `"move-speed"` state slot to add 3% ordinary speed per stack.
Keeping that modifier would violate the owner law. The wire/state identifier remains compatible,
but the relic now reduces dodge recovery by `0.03 s` per stack and `relicMoveSpeed()` always returns
`MOVE_SPEED`.

## Head, hand, and foot physics

The old `PROCEDURAL_JIGGLE` direction was converted into the narrower
`PROCEDURAL_LIMB_PHYSICS` doctrine. A deprecated alias remains for source compatibility, but rig
writers use the new name.

- Hands: damping ratio changed from `0.32` to critically damped `1`; maximum offsets dropped from
  `22/22 px` to `5/5.5 px`, maximum velocity from `420` to `90 px/s`, and turn/landing impulses were
  sharply reduced.
- Air feet: damping changed from `0.38` to `1`; maximum offsets dropped from `9/9 px` to
  `2.5/2.25 px`, maximum velocity from `240` to `60 px/s`. Planted feet remain critically damped with
  near-zero inertia.
- Head: damping changed from `0.48` to `1`; bounds dropped from `3/1.75 px` to `0.55/0.65 px`.
  A tiny two-axis idle equilibrium (`0.18/0.24 px`) now runs through the same physical follower, so
  the detached head is not a statue at idle.
- Idle hands and feet retain tiny independent equilibrium motion through their bounded followers.
  Movement, landing, and turning still drive them, but the reduced inertias and critical damping
  remove floppy overshoot.
- Reduced-motion, cut/rebase, and offscreen behavior still reset or suppress the cosmetic channels.

The physics remains a servant of B68. It uses B68's one `PresentationFrame` clock and commits through
the existing total limb-priority layer. Constraints, attacks, gun mechanisms, and flourishes still
win above locomotion/spring; B54 claims still define ownership; the 90 ms blend-in and 130 ms
blend-out are unchanged. No parallel transform writer was added.

Five focused regressions pin critical damping, bounded non-zero idle motion for all required parts,
moving responsiveness, and monotonic no-overshoot settling.

## B68 guarantees

The rendered smoothness regression passed in both modes after the B74 presentation tuning:

| Mode/scenario | Frames | Root max step at 60 Hz | Result |
| --- | ---: | ---: | --- |
| Top-down straight walk | 13 | `5.6642 px` | pass |
| Top-down hard reversal | 20 | `5.5721 px` | pass |
| Top-down walk + attack | 12 | `5.4542 px` | pass |
| Top-down rapid flip + attack | 133 | `5.7385 px` (`p95 5.4829`) | pass |
| Belt rapid flip + attack | 134 | `5.8611 px` (`p95 5.4311`) | pass |

Every case recorded zero root discontinuities, zero limb discontinuities, zero non-monotonic clock
edges, and zero missing/invalid priority resolutions. Belt head maximum was `5.2377 px`, below its
declared limit. The one presented actor state, unified clock, isolated root debt, priority ordering,
and blend timings remain intact.

## Verification

- `pnpm gen:check`: passed.
- `pnpm typecheck`: passed.
- Focused B74 tests: 4 files / 40 tests passed.
- Full `pnpm test`, consecutive run 1: 235/235 files passed; 2,850 passed, 20 skipped.
- Full `pnpm test`, consecutive run 2: 235/235 files passed; 2,850 passed, 20 skipped.
- `tools/diag-rb-telemetry.mts`: 101/101 scenarios passed, split 50 top-down and 51 belt.

| Telemetry mode | Scenarios | Requests | Applications/nonzero | Snaps | Corrected pixels |
| --- | ---: | ---: | ---: | ---: | ---: |
| Top-down | 50 | 0 | 0 | 0 | `0.000` |
| Belt | 51 | 0 | 0 | 0 | `0.000` |

The connected in-app browser runtime reported no available browser, including after the prescribed
runtime-selection retry. Consequently I could not perform a human-controlled interactive
backwards-down walk in that surface. The production-path Playwright rendered-rig runs and the live
Colyseus telemetry stack completed, and the exact SE backpedal predictor sample is
`320.000000 ×24` after the fix versus `306.560000, 320.000000…` on the old reversal lane.

Guardrails held: no lava dimension/map file, walkability-painter file, or
`data/weapon-concepts-300.json` change; no aura, modal, or non-gun attack displacement was added.

VERDICT: lurch cause+fix = deliberate startup/reversal hitch plus frame-additive root-debt headroom removed in favor of normalized direct 320 px/s movement and an exact declared presentation cap; 8-direction speed variance = 0 across forward and backpedal samples, including SE backwards-down; limb physics = subtle critically damped head/hands/feet active while idle and moving inside B68 priority; telemetry = 101/101, 50 top-down + 51 belt, 0 requests/applications/snaps/0.000 px; 2x test results = 235/235 files, 2,850 passed and 20 skipped in each consecutive run.
