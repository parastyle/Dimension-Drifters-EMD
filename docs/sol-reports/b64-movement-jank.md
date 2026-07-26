# B64 movement jank

## Outcome

The regression was client-side frame pacing in the Testing Grounds weapon gallery, not network correction, map collision, or server tick work. Development builds had recently regained `?dev=` handling, which exposed a latent showroom workload: all 42 gallery pickups were instantiated as full world-loot effects, including a duplicate shine image and three persistent tweens per pickup. Because every gallery item stays alive at once, that animation work continued while the player moved anywhere on the board.

The fix keeps gallery pickups visually present but static. Ordinary spawned loot retains its shine, spawn animation, float/pulse animations, and spin animation. The stale ultimate telemetry scenario now skips explicitly when `ULTIMATES_ENABLED` is false and remains available automatically if ultimates return.

## Measurement method

I profiled the running client through Chromium/Playwright against a deterministic local room server. The browser used ANGLE/SwiftShader, a 320x180 viewport, and a nominal 60 Hz cadence. The profiler recorded:

- animation-frame deltas and scene update/render durations;
- local-rig movement versus authoritative movement;
- server-correction requests, applied corrections, and snaps;
- DOM reconnect-overlay mutations;
- heap drops, long frames, and depth-sort activity.

Before/after figures below are medians of three fresh-client runs on the same deterministic route and seed. Pit teleports were classified separately and excluded from ordinary movement deltas.

| Metric | Before | After |
| --- | ---: | ---: |
| Frame delta p50 | 16.7 ms | 16.6 ms |
| Frame delta p95 | 21.9 ms | 20.1 ms |
| Frame delta p99 | 37.3 ms | 37.2 ms |
| Scene update p50 | 1.0 ms | 0.8 ms |
| Scene update p99 | 5.2 ms | 4.9 ms |
| Largest synchronous update, three-run median | 15.7 ms | 12.1 ms |
| Ordinary movement delta p95 | 7.85 px | 7.24 px |
| Correction requests / applications / snaps | 0 / 0 / 0 | 0 / 0 / 0 |
| Reconnect-overlay mutations | 0 | 0 |

The meaningful pacing change is in the repeated workload: p95 frame time fell 1.8 ms, median update time fell 20%, the median synchronous peak fell 23%, and ordinary movement-step variance tightened. Absolute maximum-frame samples were noisy under software rendering and did not move consistently, so they were not used to claim the fix.

## Root-cause evidence

The recent commits were tested independently rather than reverted wholesale:

| Suspect | Evidence | Finding |
| --- | --- | --- |
| POI landmark deletion (`48f8f7f`) | Same deterministic route at 320x180: pre-deletion had 558 floor objects / 1,012 top-level display entries and frame p99 32.5 ms; current had 364 / 819 and frame p99 25.7 ms. Both had zero corrections. | Deletion reduced work; it did not create the regression. |
| Decal alpha and boundary shelf (`f82eb57`) | Interleaved exact-seed runs at 640x360 held frame p50 at 46.2-46.3 ms and scene update p50 at 1.4 ms. Removing the boundary-void layer at runtime did not improve pacing. | No measurable regression. |
| Ashlands PNGs | Tile sources are the expected 512x512 contract (rim 1024x256), with compressed files about 23-85 KB and no larger decoded upload dimensions than the other themes. | No anomalous texture/upload cost. |
| Reconnect overlay | Healthy-session overlay mutations were zero; `onLeave` and `onError` remain tied to actual transport events. | Not firing or thrashing during normal play. |
| Reconnection/UI batches | Interleaved current/parent/current measurements were stable at frame p50 46.0-46.3 ms. | No update-loop regression. |
| Testing Grounds gallery | The page contains 42 persistent `pk:` entities. Each took the ordinary-loot path: duplicate shine plus spawn, float, halo, and spin tween setup. Development-tools restoration (`e452381`) made the `?dev=` gallery path reachable again. Removing only gallery animation reduced the repeated frame/update metrics above while keeping corrections and overlay activity at zero. | Root cause. |

Depth sorting was cheap and stable, no garbage-collection signature correlated with the long frames, and the full telemetry matrix continued to report zero correction activity. A stock 1280x720 movement-jitter browser probe was not used as the bisect signal because SwiftShader rendered it near 6 fps even at pre-regression commits, stretching its nominal 5.6-second route independently of the product change.

## Changes

- `ArenaScene`: gallery (`pk:`) pickups no longer allocate the duplicate shine image or register spawn/float/halo/spin tweens. The ordinary world-loot path is unchanged.
- `diag-rb-telemetry.mts`: the ultimate scenario emits a clear `ULTIMATES_ENABLED=false` skip in both movement modes, and expected scenario counts derive from the feature flag. No other assertion was changed.
- Telemetry evidence was regenerated. The run completed all 83 enabled scenarios: 41 top-down and 42 belt.

No guarded map-art file was edited.

## Verification

- `pnpm gen:check`: PASS.
- `pnpm typecheck`: PASS.
- `pnpm test`: PASS — 228 files, 2,790 tests passed, 20 skipped.
- `pnpm exec tsx tools/diag-rb-telemetry.mts`: PASS — 83/83 enabled scenarios; zero correction requests, nonzero corrections, snaps, or correction magnitude.
- Post-fix play/profile run: healthy connection, zero overlay mutations, and the before/after pacing improvements shown above.

verdict: root cause = `e452381` re-exposed the 42-pickup Testing Grounds gallery's persistent shine/tween workload; fix = static gallery pickups plus a B55-aware ultimate telemetry skip; before/after = frame p50 16.7 to 16.6 ms, p95 21.9 to 20.1 ms, scene update p50 1.0 to 0.8 ms, ordinary movement p95 7.85 to 7.24 px; harness = PASS 83/83 with zero requests/corrections/snaps; tests = PASS `gen:check`, `typecheck`, 228 files / 2,790 tests.
