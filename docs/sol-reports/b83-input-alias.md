# B83 input alias report

## Verdict

The hypothesis is confirmed. The legacy renderer could preview almost a full 50 ms window in one
direction and then commit the opposite live direction at the boundary. Under 16 ms A/D alternation,
the measured displayed-position-to-commit boundary discontinuity was **31.360 px**. The often-quoted
16 px is the maximum one-sided 50 ms lead at 320 px/s; an immediate reversal can expose nearly twice
that distance.

## Measurement before changing production code

I added a deterministic measurement that drives a fresh direction every 16 ms, faster than the 50 ms
simulation tick. It retains the last displayed position, advances the untouched legacy predictor with
the direction sampled at the tick boundary, and measures the boundary rebase.

- Input pattern: alternating A/D every 16 ms.
- Canonical speed: 320 px/s.
- Worst legacy render/commit boundary divergence: **31.360 px**.
- First-frame response: **5.120 px** in the same sampled frame.
- Software-added input latency: **0 ms**.

That measurement supports the proposed root cause, so I did not pursue the stall/resync path.

## Fix

I chose **frame-rate sampling into the pending 50 ms window while retaining the 20 Hz heartbeat**.

`ArenaScene.stepNetInput` now divides elapsed input on exact tick boundaries and records each physical
frame's direction and duration. `SelfPredictor` uses the same retained slices for:

1. the current render preview;
2. the fixed-tick prediction commit;
3. replay of unacknowledged commands after reconciliation.

The B42 movement report therefore carries the endpoint of the same path that was displayed. No network
field changed, so `SCHEMA_VERSION` remains 50. Immediate direction-edge transport is also unchanged.

The final presentation cone had one related alias: when the presented root lagged the prediction target
during a reversal, it could classify ordinary withheld displacement as a Smooth correction. Smooth
corrections intentionally bypass the locomotion cap for L10, so that classification could create a
larger root step. Ordinary reversal constraints now remain ordinary root debt and pass through the
canonical speed cap; genuine L10 correction debt retains its existing Smooth behavior.

## L09 and L10

L09 remains intact. Every nonzero input slice calls the canonical movement step at the same constant
speed. There is no acceleration, damping, easing, turn weight, or direction-dependent multiplier.
The reversal presentation regression also asserts that the final root moves exactly one canonical
frame step, without creating Smooth debt.

L10 remains intact. A fresh frame sample affects `renderPos` immediately; the renderer does not wait
for a heartbeat. The bounded immediate direction-edge send remains in place. Measured software-added
input latency is therefore **0 ms before and 0 ms after**, with a 16 ms sample producing 5.120 px of
movement in that same frame in both cases.

## After measurement

The same 16 ms A/D driver measured:

- Worst render/commit alias: **0.000000 px**.
- Worst displayed 16 ms step: **5.120 px**.
- Worst commit-boundary displayed step: **5.120 px**.

The live telemetry scenario rotates through W/A/S/D with 16/16/18 ms slices, three direction changes
inside every heartbeat. In both top-down and belt modes it measured:

- Worst rendered sub-tick step: **5.760 px**.
- Stated threshold: **5.761 px**.
- Render/commit alias: **0.000000 px**.
- Correction requests/applications/snaps/pixels: **0 / 0 / 0 / 0.000**.

## Coverage and verification

- `pnpm gen:check`: pass.
- `pnpm typecheck`: pass.
- B74 constant-speed coverage: 16 cases pass, including eight directions, forward movement, and
  backpedal with zero speed variance.
- B76 projectile aim-lock coverage remains green in the full suite; the focused combat file also passed
  41 tests.
- L10 correction instrumentation and its permanent tests pass unchanged.
- Full `pnpm test`, consecutive run 1: **245 files passed; 2,930 tests passed; 20 skipped**.
- Full `pnpm test`, consecutive run 2: **245 files passed; 2,930 tests passed; 20 skipped**.
- `tools/diag-rb-telemetry.mts`: **PASS, 131/131 scenarios** — 65 top-down and 66 belt; 0 correction
  requests, 0 nonzero applications, 0 silent/smooth/snap applications, and 0.000 total pixels.

I also exercised the B68 Playwright artifact gate without changing its source. This host's default
software renderer ran the scene at roughly 5 Hz and overran B68's authored clear-patch capture, while a
hardware-rendered control ran at 60 Hz and changed the limb sampler's established cadence. The same
failure reproduced with B83 frame sampling temporarily disabled, so it was not accepted as a B83
regression or as replacement evidence. I restored the tracked passing B68 artifacts and committed no
test instrumentation or failed capture. The final constant-speed reversal regression plus the live
top-down/belt telemetry directly cover B83's changed seams.

No guarded content was touched: no weapon-concepts data, lava dimension, walkability painter, player
auras, modal flow, attack displacement, or wire/schema shape.

verdict: hypothesis confirmed y; root cause = live per-frame direction and tick-boundary commit described different pending-window paths, with ordinary reversal debt also entering the Smooth lane; fix = render, commit, and replay the same frame-sampled constant-speed path at the unchanged 20 Hz send rate and keep ordinary reversal debt under the constant-speed cap; divergence before/after = 31.360/0.000 px; input latency before/after = 0/0 ms software-added; telemetry = PASS 131/131, 65 top-down + 66 belt, 0 requests/applications/snaps/0.000 px; 2x test results = PASS 245/245 files, 2,930 passed + 20 skipped each.
