# B75 skate + pit report

## Defect 1 — post-input skating

### Measured divergence

The regression is between simulation truth and the B68 presented root, not in B74 travel:

- At `MOVE_SPEED = 320 px/s`, the predictor's 25 ms fractional preview places the rendered target
  `8.00 px` ahead of the committed authoritative root.
- On the zero-input command, shared movement immediately reports `mvx = 0`, the predicted committed
  root remains at the authoritative `x = 3000`, and its render target is also `x = 3000`.
- The pre-fix presented root still held the `x = 3008` preview. Its idle correction lane paid the
  discrepancy back at `48 px/s`, so the character visibly moved another `8.00 px` over ten 60 Hz
  frames (`166.67 ms`) while simulation velocity was already zero.

`rig-presentation.test.ts` now records those authoritative/predicted values separately from the
presented-root trace.

### Stop policy

I chose to exclude a legitimate ordinary input stop from the general root ease. On the
moving-to-zero-input edge, the final root limiter discards fractional prediction lead and reaches the
stopped target on that render sample. The asserted bound is one 60 Hz frame, `<= 17 ms`; the following
frame moves `0.00 px`.

The alternatives were weaker fits:

- A shorter general stop blend would still render motion after both authority and prediction had
  stopped, only for fewer frames.
- Reinstating a simulation stop ramp would reintroduce changing movement speed and place the B74
  constant-speed law at risk.

The cut cannot recreate the turn hitch: it requires prior nonzero movement intent, current zero
intent, and no stance/recoil root-motion exception. Held travel and every nonzero direction change,
including a full reversal, stay on the normal presentation path. Simulation movement was not changed.
The existing B74 test still covers eight directions in both forward-facing and backpedalling modes
(16 cases), enters each from a full-speed reversal, and reports zero velocity and step-speed variance
within `1e-9`.

B68's structure is retained: there is still one `PresentedActorState` per actor per frame, the unified
presentation clock is unchanged, the limiter remains root-only, and limb ownership/priorities/blends
were not touched.

## Defect 2 — pit damage before the visible edge

### Measured boundary

The gameplay boundary is the exact 80 px tile line. `buildPaintedRims` centres the 256 px Wild West
rim texture on that line; image sampling finds its strongest horizontal lip transition at source row
129 versus centre row 128, or `+1.00 px` into the pit. The renderer's amber/rust gameplay semaphore is
drawn directly on the tile line.

The old player hazard query sampled the torso/root centre. The default character's production paper
shadow contact is:

`TARGET_BODY_H 76 * shadow fraction 0.42 * characterScale * whole-art scale = 21.1418767 px`

below the root. Consequently the centre sample was `20.14 px` from the strongest painted-rim edge.
When approaching a north pit edge—the owner-visible early-damage case—it fired `21.14 px` before the
shadow contact reached the exact lip.

The player-only pit query now samples `24 px` below the root, at the bottom of the authoritative player
body disc. At the trigger, the default visible shadow contact is `2.86 px` on the ground side of the
exact rail and `3.86 px` from the measured painted transition. The pixel regression asserts a `4 px`
maximum mismatch, so the measured offset changes from `20.14 px` to `3.86 px`.

This is a translated player contact sample, not a globally shrunken pit. Raw `isPitAtPx` tile truth,
enemy falls, map generation, and `nearestGroundPx` are unchanged. Player last-ground validation uses
the same foot contact, while the existing 15% fall damage, 0.6 s grace, and snap-back behavior remain
unchanged. The live room regression probes `0.25 px` on either side of the contact boundary: apparent
ground takes no damage; crossing it damages, increments `fellSeq`, and recovers to the last visually
safe root.

The guarded floor renderer was inspected for the measurement but not changed; the fix belongs on the
sampling side.

## Regression coverage

- `rig-presentation.test.ts`: reproduces the 8 px sim/presentation debt, the old 166.67 ms ease, and
  asserts a stable presented root within `<= 17 ms` after release.
- `prediction.b74-constant-speed.test.ts`: all eight directions, forward and backpedal, zero travel
  variance.
- `pit-edge-alignment.test.ts`: samples the installed Wild West rim asset and production render
  constants, then asserts damage-to-painted-edge agreement within 4 px.
- `GameRoom.movement.test.ts`: verifies both sides of the live foot-contact boundary plus damage and
  `nearestGroundPx`-compatible recovery.
- Gun-recoil and rollback diagnostic pit fixtures now place the pit under the same player contact
  point.

## Verification

- `pnpm gen:check`: PASS.
- `pnpm typecheck`: PASS.
- Focused regressions: 4 files, 47 tests PASS.
- Full `pnpm test`, consecutive run 1: 236 files PASS; 2,854 passed, 20 skipped.
- Full `pnpm test`, consecutive run 2: 236 files PASS; 2,854 passed, 20 skipped.
- `tools/diag-rb-telemetry.mts`: PASS, all 101 scenarios (50 top-down, 51 belt);
  correction requests `0`, applications/nonzero corrections `0`, silent/smooth/snaps `0`, total
  magnitude `0 px`.
- Modified text files use LF endings.

verdict: skate = 8.00 px of fractional-preview debt eased for 166.67 ms after simulation velocity hit zero, fixed by cutting only the ordinary moving-to-zero-input presentation edge (post-release drift 8.00 px -> 0.00 px, full stop <= 17 ms); pit = root-centre sampling was 20.14 px off the default Wild West painted lip (21.14 px early against the exact north lip), fixed with a 24 px foot-disc sample to 3.86 px painted-edge error (<= 4 px); B74 eight-direction forward/backpedal constant-speed test passes with zero variance; telemetry passes 101/101 top-down+belt with zero requests/applications/snaps/pixels; `pnpm test` PASS x2.
