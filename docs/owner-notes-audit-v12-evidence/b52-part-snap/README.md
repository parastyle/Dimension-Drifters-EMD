# B52 part-snap evidence

This directory retains the actual Phaser `postupdate` samples used to diagnose and verify B52.
Each frame records the rendered root, HEAD, BODY, both hands, both feet, equipped weapon (when
present), and the rig locomotion/debug state.

## Before

[`before-trace-chart.json`](./before-trace-chart.json) was captured from the unfixed client while
walking the hidden-face cowboy straight right:

- 32 rendered frames over 4,266.5 ms; root advanced 1,037.37 px.
- HEAD moved backward 17.8552 px in one frame while the root advanced 5.3333 px.
- HEAD moved 35.0562 px relative to the root on that frame.
- One visible HEAD reversal gives a headless sampled rate of 0.2344 Hz.
- The rig stride clock exceeded its continuous-frame ceiling 18 times (4.2189 Hz), reaching a
  2.6196-radian single-frame advance. Those clock jumps also produced oversized local steps on both
  hands and both feet.

The owner's approximately 2 Hz cadence is not asserted as the headless rate: this production canvas
renders at roughly 6-9 FPS under headless load. The retained measurement reports the observed
headless event rate instead of extrapolating it.

## After

[`after-trace-chart.json`](./after-trace-chart.json) contains the final 3-character by 3-pose sweep:

| Character | Walking | Held gun | Attacking |
| --- | ---: | ---: | ---: |
| `proto-cowboy-hidden-face` | 0 snaps / 1,205.9 px | 0 / 1,200.0 px | 0 / 1,200.0 px |
| `drifter` | 0 / 1,232.0 px | 0 / 1,184.0 px | 0 / 1,200.0 px |
| `proto-samurai` | 0 / 1,184.0 px | 0 / 1,248.0 px | 0 / 1,168.0 px |

All mounted HEAD, BODY, hand, foot, and weapon nodes reported zero discontinuities. HEAD had zero
backward events in every scenario. The maximum stride-clock advance was 1.4159 radians (1.0472 in
the held-gun gait), with zero clock discontinuities.

## Assertions

- HEAD/BODY may not move backward more than 1 px while the root is monotonic.
- Part-local frame steps must stay below pose-aware ceilings chosen above the largest authored
  walk/hold/attack arcs and below the reproduced stale-frame jumps.
- The shared stride clock must advance continuously by 0 to 1.5 radians per rendered frame.
- Every sweep scenario must retain at least 19 actual frames and advance at least 850 px through a
  server-authoritative, collision-checked 1,700 px corridor.
