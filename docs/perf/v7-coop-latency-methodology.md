# V7 co-op latency benchmark methodology

This benchmark is the repeatable measurement companion to `docs/sol-reports/v7-coop-latency-audit.md`.
It deliberately leaves product code untouched.

## Server and wire harness

Run from the repository root after building shared declarations/runtime:

```powershell
pnpm --filter @dd/shared build
pnpm --filter @dd/server exec tsx ../../tools/perf-coop-latency.mjs
```

The harness constructs a real `GameRoom` in-process while replacing only listener/broadcast side effects.
It drives exact 50 ms authoritative substeps and uses the installed Colyseus `Encoder`, adding the same one
protocol byte used by the older audit. Every encoded patch is discarded before the next step, matching the
production dirty-change lifecycle.

The realistic-heavy room has five players, 48 mixed ordinary enemies, the active twelve-slot Seam-Eater
worm boss, and a dense combat lane. The V7 workload runs these deliveries together:

- Snakeoil Tincture Scepter channel zone;
- Gravewax Seance-Globe channel zone;
- Gravelthroat Repeater 1–10 radial pellets;
- Stormcaller Tesla Gatling's six authoritative beam rows;
- Rimewrit Grave-Slab's timed blade-extension melee sweep.

Every player sends one current input heartbeat per logical tick. The gun and blade owners also send one
attack request per tick; normal server cadence/buffer/resource laws decide what is accepted. Beam overheat,
release, cooling, and restart remain real. Samples are retained only while both zones and all six beam rows
are simultaneously live. The paired idle-population run keeps the same players/enemies/boss and input rate,
but does not activate the five weapon systems. A separate cap-pressure run raises effective enemy bodies to
the legal ceiling without bypassing admission rails.

Warm-up is long enough to fill boss history and stabilize JIT/GC. Reported server values are the clean,
unwrapped `stepSim` p50/p95/max; patch encoding is timed separately. Attribution is a second run with
instance-local wrappers around existing phase methods, grouped without double-counting nested calls.

Generated result: `docs/perf/v7-coop-latency-server-wire.json`.

## Client harness

The client measurement lives in `e2e/tests/v7-perf-coop-frame.spec.ts` and uses the repository's private
ephemeral Vite/Colyseus stack. It never binds or stops ports 5180/2567. The measured page uses a 640×360
software-renderer qualification viewport (the same low-overhead size used by existing fast-combat gates) and
renders one player;
four headless protocol clients join the same room without four extra render loops. The test measures the same
five-player/48-enemy/worm-boss workload in three paired phases: populated idle, zones/projectiles/blade, and
all systems including the six-beam structure.

Frame intervals come from `requestAnimationFrame`. Scene update and Phaser pre/post-render durations are
recorded separately, and selected existing scene subsystems are timed by page-local wrappers. The run records
the browser/renderer/DPR/back-buffer environment because headless SwiftShader and the reduced back buffer must
not be presented as physical-GPU or full-resolution timings. The paired main-thread deltas and subsystem rank
are the decision inputs; absolute GPU qualification requires representative hardware.

Generated result: `docs/perf/v7-coop-latency-client.json`.
