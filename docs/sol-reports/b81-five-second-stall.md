# B81 — five-second client stall

Date: 2026-07-27

Branch: `sol/b81-five-second-stall`

Owner report: “feels kinda laggy, I warp forward every 5 seconds”

## Result

The predictor's `deltaMs > 250` handling was not changed. The defect was a sustained allocation
stream from retained Phaser `Graphics`: Phaser replayed and re-tessellated thousands of unchanged
floor commands and dozens of circular HUD/dust paths on every WebGL frame. On the affected browser,
that allocation stream periodically forces a large collection; a collection that exceeds 250 ms
correctly drives the existing backlog drop and hard resync, producing the visible warp.

The rendered runner did **not** reproduce an owner-sized frame over 250 ms before the fix. It did
reproduce the allocation/GC mechanism with overwhelming attribution, and the fix removed the large
command replays, cut sampled allocation by 89.0%, reduced minor-GC count by 72.5%, and removed all
major GCs from the corresponding trace.

## Rendered-browser method and cadence

The capture used the existing Playwright real-stack path through `runArenaSpec`, with
`VITE_DD_DEV_TOOLS=1`. Chromium 149 rendered and composited the Phaser canvas through:

`ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)`

This was not the non-compositing in-app pane: `requestAnimationFrame` returned 3,900+ samples per
65-second 320×180 run, WebGL renderer metadata was available, the canvas produced screenshots, and
normal eight-direction movement plus repeated attacks ran against the real local Colyseus stack.
The small viewport keeps this machine's software renderer out of its fill-rate ceiling while still
exercising the full scene, update, render, network, enemy, projectile, and VFX paths.

The owner-reported approximately five-second hitch did not occur on this runner. Therefore:

- measured pre-fix spikes over 250 ms: none;
- measured pre-fix spike durations: not applicable;
- exact pre-fix gaps between spikes: `[]`;
- measured post-fix spikes and exact gaps: none and `[]`;
- `forceResync()` calls during all reported 65-second runs: zero.

It would be false to invent a local five-second interval. The attribution below explains why a
browser with a smaller/slower heap can cross the 250 ms line periodically even though this runner's
collections remained shorter.

## Before/after frame captures

All values are milliseconds. These are unprofiled, rendered, 65-second normal-play runs at the same
320×180 viewport with auto-attacks enabled. Percentiles use the recorded per-rAF deltas.

| Build / dimension | Frames | p50 | p95 | p99 | Max | Frames >250 ms | Exact >250 ms gaps | Hard resyncs |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| Before / Ashlands | 3,919 | 16.7 | 16.7 | 16.8 | 33.4 | 0 | `[]` | 0 |
| After / Ashlands | 3,926 | 16.7 | 16.8 | 16.8 | 33.5 | 0 | `[]` | 0 |
| After / Lava Foundry | 3,902 | 16.7 | 16.8 | 16.8 | 33.4 | 0 | `[]` | 0 |

The 65-second after runs also recorded zero browser long tasks. Lava Foundry's result confirms that
the new dimension, its parallax, and its light/laser-era render path do not introduce a separate
periodic hitch.

## Profiler attribution

### Allocation sampling

CDP heap-allocation sampling covered the same rendered Ashlands combat workload for 20 seconds
before and after. Profiler setup and serialization were outside the rAF sample window.

| Sampled allocation site | Before | After | Reduction |
| --- | ---: | ---: | ---: |
| All sampled allocations | 5,461.15 MB | 598.23 MB | 89.0% |
| `GraphicsWebGLRenderer` | 2,271.45 MB | 169.35 MB | 92.5% |
| Phaser path `run` | 1,774.43 MB | 123.31 MB | 93.1% |
| Phaser path `batch` | 1,069.40 MB | 55.65 MB | 94.8% |

The pre-fix display-list inspection identified the exact retained buffers being replayed:

| Graphics layer | Retained command words | Expensive primitives |
| --- | ---: | --- |
| Pit depth, depth -14 | 16,323 | 1,182 lines, 856 filled rectangles |
| Pit lip, depth -13.8 | 9,926 | 916 lines, one circular path |
| Map-zone ground, depth -18.9 | 2,975 | 190 lines, 180 filled rectangles |
| Ambient dust | 624 | 48 circular paths rebuilt every frame |
| Objective plates | 507 | 36 circular/rounded paths |
| Drive HUD | 269 | 16 circular/rounded paths |
| Parry/roll indicator | 27 | two circular paths rebuilt every frame |

Phaser's WebGL Graphics renderer constructs path/point data while interpreting these commands. The
large static layers were paying that cost every frame despite never changing, while dust and HUD
code cleared and recreated circular commands every frame.

After the fix, the three large floor buffers no longer exist in the display list, objective geometry
is invisible except while it is rasterized after a layout change, and the final Ashlands/Lava
snapshots contain **zero visible circular Graphics commands**. The largest ordinary visible buffer
in the final Ashlands snapshot was the 108-word rectangular Drive HUD; the only 507-word buffer was
the intentionally invisible objective bake source.

### GC trace

The 65-second Chrome trace independently confirmed the allocation-to-GC link:

| V8 GC evidence | Before | After |
| --- | ---: | ---: |
| Minor GC events | 378 | 104 |
| Major GC events | 2 | 0 |
| Largest GC event | 7.677 ms major GC | 3.420 ms minor GC |

This runner's two pre-fix major GCs were 56.027 seconds apart, not five seconds, and neither paused
for 250 ms. Heap size, collector throughput, and software/hardware differences control when the same
allocation stream crosses a collection threshold; that is why the owner cadence cannot be claimed
as locally measured.

### Ruled-out leading suspects

- The audio watchdog was dormant in ordinary play. `AudioBus.armLoopWatchdog()` only arms its 250 ms
  interval while a sampled beam or boss-rumble loop is live; there were zero sweep invocations in
  these normal-play captures, so it cannot create an idle five-second cadence.
- No periodic 42-object pickup/tween rebuild appeared in the scene or allocation profile.
- The long-lived allocation leaders were Phaser Graphics replay/path functions, not Colyseus patch
  application, asset decode, canvas refresh, schema application, or the character rig. The largest
  named game update allocation before the fix was rig pose animation at 18.30 MB/20 s, versus
  2,271.45 MB/20 s in `GraphicsWebGLRenderer`.
- Runtime canvas refreshes introduced by the fix occur once when a small atlas is built, once when a
  static floor is baked, or only when the objective layout signature changes. They are not periodic.

## Fix

- Rasterized seeded, static map-zone, pit-depth, and pit-lip Graphics once at half resolution, then
  destroyed the command sources and retained ordinary depth-correct Images.
- Replaced static Ashlands spawn-patch and Lava Foundry spawn-ring Graphics with small canvas-backed
  Images.
- Replaced 48 per-frame dust circles with four pre-baked dot frames and 48 reusable Blitter Bobs.
- Rasterized objective plate geometry only on a viewport/layout-signature change.
- Replaced rounded Drive bars with visually equivalent rectangular commands, removing 16 arc
  tessellations per frame.
- Replaced continuously redrawn parry and roll arcs with pre-baked 33-step/17-step atlas frames.
- Added a rendered regression probe that records rAF deltas, long tasks, resyncs, scene state, audio
  sweeps, allocation/trace artifacts, and visible Graphics command buffers. It asserts zero frames
  over 250 ms and rejects oversized retained visible Graphics buffers.

No movement authority, correction band, B42 behavior, travel speed, attack displacement, or
`deltaMs > 250` recovery logic was changed. `data/weapon-concepts-300.json` was not touched.

## Verification

- `pnpm gen:check`: PASS.
- `pnpm typecheck`: PASS for all workspaces.
- `pnpm test`, pass 1: PASS, exit 0, 27.8 seconds.
- `pnpm test`, pass 2 immediately after pass 1: PASS, exit 0, 26.0 seconds.
- `pnpm --filter @dd/server exec tsx ../../tools/diag-rb-telemetry.mts`: PASS, 129/129
  scenarios:
  - top-down: 64/64;
  - belt: 65/65;
  - correction requests: 0;
  - correction applications: 0;
  - silent/smooth/snap corrections: 0/0/0;
  - total correction pixels: 0.
- Rendered Ashlands and Lava Foundry 65-second runs: PASS, zero frames over 250 ms and zero hard
  resyncs.
- Final 20-second allocation-profile run: p50 16.7, p95 16.8, p99 16.8, max 33.3, zero frames over
  250 ms while profiling.

VERDICT: stall cause = retained Phaser Graphics replay/tessellation allocation pressure driving periodic GC; cadence = owner-reported ~5 s but not reproduced on the compositing runner (measured >250 ms gaps `[]`; pre-fix major-GC gap 56.027 s); fix = bake static floor/spawn art and replace per-frame dust/HUD/parry arcs with cached textures and reusable objects; frames >250 ms = 0 before / 0 after Ashlands / 0 after Lava Foundry; telemetry = 129/129 with 0 requests, applications, snaps, or pixels in both modes; tests = `pnpm test` PASS twice consecutively (27.8 s, 26.0 s).
