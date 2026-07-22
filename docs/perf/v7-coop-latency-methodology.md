# V7 co-op latency benchmark methodology

This is the repeatable measurement companion to
`docs/sol-reports/v7-coop-latency-audit.md`. Product code is not modified.

## Server and wire harness

Run from the repository root:

```powershell
pnpm --filter @dd/shared build
pnpm --filter @dd/server exec tsx ../../tools/perf-coop-latency.mjs
```

The harness constructs a real `GameRoom` in-process while replacing only listener/broadcast side effects.
It drives exact 50 ms authoritative substeps through the registered input/attack handlers and uses the
installed Colyseus `Encoder`, adding the protocol byte used by the older audit. Dirty changes are discarded
after each measured patch, matching the production patch lifecycle. The encoder buffer is enlarged inside
the harness so known full-state overflow/re-encode behavior does not contaminate steady-patch timing; full
state size and encode cost are recorded separately.

The realistic-heavy room has five players, 48 mixed ordinary enemies, and the active Seam-Eater worm boss:

- Snakeoil Tincture Scepter channel zone;
- Gravewax Seance-Globe channel zone;
- Gravelthroat Repeater 1-10 radial pellets;
- Stormcaller Tesla Gatling's six authoritative beam rows;
- Rimewrit Grave-Slab's timed blade-extension melee sweep.

Every player sends one input heartbeat per tick. Gun and blade owners also send one attack request per tick;
normal cadence, buffering, resources, admission rails, burst resolution, hit envelopes, and collision laws
remain active. The harness refills player HP/Drive and parks the durable enemy cohort in a dense safe lane so
the intended worst-case population and weapon systems survive warm-up. Beam overheat/release/restart logic
remains real. Heavy samples qualify only while both player zones and all six beam rows are live.

The paired idle run keeps the same actors/boss and input cadence but disables weapon systems. The cap arm
requests the legal enemy ceiling, runs the heavy controllers, and samples every cap-pressure tick; entity
peaks verify that it reaches 80 effective bodies plus six beams/zones/projectiles. It is not filtered by the
intermittent simultaneous-system predicate because its job is cap and wire pressure.

Defaults are 600 warm-up ticks, 2,000 clean idle/heavy samples, 1,200 cap samples, and 1,200 attribution
samples. Qualification is intermittent by design, so the attempt ceiling defaults to 50x; it can be changed
with `DD_PERF_MAX_ATTEMPT_MULTIPLIER`. Sample counts can be changed for shakedowns with
`DD_PERF_WARMUP_TICKS`, `DD_PERF_SAMPLE_TICKS`, `DD_PERF_CAP_SAMPLE_TICKS`, and
`DD_PERF_ATTR_SAMPLE_TICKS`.

Reported server values are unwrapped `stepSim` p50/p95/max. Encoding is timed separately. Attribution is a
second run with instance-local wrappers around existing phase methods and a residual bucket for inline work.

Output: `docs/perf/v7-coop-latency-server-wire.json`.

## Client harness

The client probe is `e2e/tests/v7-perf-coop-frame.spec.ts`. It uses the repository's private ephemeral
Vite/Colyseus stack and never binds or stops ports 5180/2567. One browser renders the room while four
protocol-only clients provide the remaining weapons without four extra render loops.

The completed artifact used a 640x360, DPR-1 qualification viewport on headless Chromium/SwiftShader. It
measured populated idle, zones/pellets/blade, and six-row active-beam phases. Frame intervals come from Phaser
post-render cadence; scene update and pre/post-render durations are recorded separately. Page-local wrappers
time existing scene subsystem methods without editing product files. Renderer, DPR, back-buffer, entity
peaks, and long tasks are stored with the result.

Headless SwiftShader is not a physical-GPU or full-resolution release qualification. Use paired phase deltas
and subsystem rankings from this artifact. Run the same probe on representative hardware before using
absolute frame intervals as a 60/120 FPS gate.

Output: `docs/perf/v7-coop-latency-client.json`.
