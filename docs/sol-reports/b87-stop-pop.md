# B87 stop-pop report

Date: 2026-07-27
Branch: `sol/b87-stop-pop`

## Outcome

The proposed live-direction hypothesis is **refuted on this branch**, but the owner-visible stop pop
is confirmed.

B83 already makes ordinary `renderPos()` replay `inputSamples` through
`stepAliasedInputHorizontal()`. The live `previewCmd.dx/dy` assignment remains only on the fallback
stance path; it does not drive ordinary sampled walking. A direct 48 ms hold/release measured:

- predictor backward dip on release: **0.000000 px**;
- predictor forward pop at the following commit boundary: **0.000000 px**;
- actual final rendered-root forward pop on release: **13.056000 px**.

The boundary-only b85 metric also measured **0.000000 px** during this repro.

## Measurement and actual root cause

The failing trace mirrors `ArenaScene.stepNetInput()`, `SelfPredictor.renderPos()`, and the final B68
root limiter at 16 ms render cadence.

Before the first 50 ms commit, the sampled preview position moves immediately at the canonical
`320 px/s`, but `ArenaScene.presentBlobs()` used `clientMovementReport().mvx/mvy` to declare the
root's allowed speed. That report is committed state and remains zero during the first partial tick.
The final limiter therefore allowed only its idle `48 px/s` lane:

- correct first 16 ms sampled travel: **5.120 px**;
- actual first rendered-root travel: **0.768 px**;
- hidden debt after the first three 16 ms frames: **13.056 px**.

Once the first boundary commits, both the target and limiter move at 320 px/s, so the debt neither
grows nor retires. B75's intentional moving-to-stopped cut then places the root on the correct sampled
target in one frame. That pays the whole hidden debt forward as a visible pop without any server
correction, resync, stall, or boundary divergence.

The permanent pre-fix regression failed as follows:

| Hold duration | Release backward dip | Release forward pop | Boundary pop | Worst intra-tick disagreement |
| ---: | ---: | ---: | ---: | ---: |
| 40 ms | 0.000000 px | 10.880000 px | 0.000000 px | 10.880000 px |
| 65 ms | 0.000000 px | 13.056000 px | 0.000000 px | 13.056000 px |
| 130 ms | 0.000000 px | 13.056000 px | 0.000000 px | 13.056000 px |

This explains both load-bearing owner facts: the defect appears at the stop transition, and all
server-correction/boundary metrics remain zero.

## Fix

`SelfPredictor.renderPos()` now returns the horizontal movement and recoil velocities from the same
pure sampled preview state that produced its position. `ArenaScene.presentBlobs()` consumes those
preview velocities for:

- the root's real-time constant-speed allowance;
- current locomotion direction and animation speed;
- the preview recoil channel.

The committed B42 movement report is unchanged and remains the network payload. The 20 Hz command
heartbeat, immediate transport edges, prediction commit, reconciliation replay, and wire shape are
unchanged. `SCHEMA_VERSION` remains 50.

The final root still uses `frame.wallDeltaMs`; an attempted smoothed-clock unification was rejected
after the B68 browser capture showed that it could exceed real-time movement speed under a slow
renderer. The shipped fix therefore removes the debt at its source without catch-up speed,
deceleration, easing, damping, or stopping distance.

After the fix, all three hold durations measure:

- release backward dip: **0.000000 px**;
- release forward pop: **0.000000 px**;
- following-boundary pop: **0.000000 px**;
- worst intra-tick rendered-path disagreement: **0.000000 px**.

Forward-to-strafe changes after 40, 65, and 130 ms also preserve both sampled axes and cross their
next boundary with **0.000000 px** discontinuity. Direction changes therefore benefit too: the
preview position, limiter speed, pose direction, commit, and replay all consume the same frame-current
sampled state instead of waiting for committed velocity.

## L09 and L10

L09 remains intact. Every nonzero slice still uses the canonical constant movement speed. The final
root remains capped by that declared speed against real wall time. There is no stop smoothing or
extra catch-up allowance. B74 passes all eight directions in forward-facing and backpedal modes with
zero speed variance.

L10 improves at the affected presentation seam without changing the input pipeline. Software-added
input latency is **0 ms before and 0 ms after**: the target and the root both respond in the input's
sampled frame. Before the fix the root moved only 0.768 px of the expected 5.120 px on that first
16 ms frame; after it moves the full 5.120 px. No render wait or tick-boundary delay was added.

## Diagnostic blind spot

The existing exact-boundary value is retained as `boundary now/10s peak`, because it independently
detects commit/replay discontinuities.

The same HUD row now also records `intra now/10s peak` every presented SELF frame: actual rendered
root versus the sampled preview prefix that the current tick will commit. Its severity is the worst
of intra-tick and boundary values. The hot path performs one scalar distance calculation and writes
to fixed typed-array storage; it adds no per-frame allocation. A regression test feeds boundary
`0.0 px` and intra-tick `13.056 px` and requires the row to turn red and retain the 13.1 px peak.

## Coverage and verification

- New stop tests: 40/65/130 ms non-tick-multiple holds, zero release dip/pop and zero boundary pop.
- New direction-change tests: forward-to-strafe after 40/65/130 ms, both axes retained and zero
  boundary/intra-tick disagreement.
- First-frame response: **0.768 px -> 5.120 px**, same sampled frame.
- Focused B74, B42, L10, all b83 alias, b87, HUD, and B76 projectile suites: **85/85 passed**.
- `pnpm gen:check`: PASS.
- `pnpm typecheck`: PASS.
- `tools/diag-rb-telemetry.mts`: PASS **131/131** — 65 top-down, 66 belt; 0 correction
  requests, 0 applications/nonzero corrections, 0 silent/smooth/snap corrections, **0.000 px** total.
- Full `pnpm test`, consecutive runs: PASS/PASS — **247/247 files**, **2,950 passed,
  20 skipped** each.
- Modified source/test/report files use LF endings; `git diff --check` passes.

The B68 Playwright gate was also attempted. Its default shared-stack invocation cannot expose the
in-process authority row to the test worker. With the intended `DD_E2E_PER_TEST_STACK=1` invocation,
both top-down and belt reached their assertions, but this host rendered at roughly 6 Hz and crossed
the root threshold (the same software-renderer limitation already recorded in the b83 report).
The final code retains B68's real-wall root cap; live `walk-smoothness` telemetry passed in both modes
with zero corrections. No failed B68 artifact was written to tracked evidence.

No guarded data, lava dimension, walkability painter, aura, modal flow, attack displacement, or wire
schema was changed.

verdict: hypothesis confirmed n; root cause = ordinary sampled direction replay was already correct, but final SELF presentation used still-zero committed velocity during the first partial tick, accumulated 10.880-13.056 px of hidden root debt, and paid it forward through the stop cut; fix = return and consume sampled preview velocity/direction for the real-time constant-speed root and pose; dip/boundary-pop before/after = 0.000/0.000 px -> 0.000/0.000 px, actual release forward pop = 13.056 -> 0.000 px; input latency before/after = 0/0 ms (first 16 ms root travel 0.768 -> 5.120 px); metric blind-spot fix = fixed-ring worst intra-tick rendered-root versus sampled commit-prefix peak plus retained boundary value; telemetry = PASS 131/131, 65 top-down + 66 belt, 0 requests/applications/snaps/0.000 px; 2x test results = PASS/PASS, 247/247 files, 2,950 passed + 20 skipped each.
