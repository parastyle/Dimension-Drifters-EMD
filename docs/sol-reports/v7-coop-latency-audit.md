# V7 Co-op Latency Audit

**Owner question:** Will the recently added combat and movement systems impact latency in the co-op game?

**Status:** Complete, measured 2026-07-22. This is the report of record.

## Direct answer

**No meaningful co-op network/server latency regression was measured.** In the realistic five-player V7
stress room, the authoritative tick was **0.485 ms p50 / 0.834 ms p95 / 1.630 ms max** against a **50 ms**
budget. Even at the Wave 2 enemy ceiling (80/80 effective bodies), it was **0.857 / 1.363 / 3.585 ms**.
That leaves **49.17 ms** of heavy-room p95 headroom (**48.37 ms** at its worst observed tick) and
**46.42 ms** at the single worst cap-load tick.

V7 adds **0.203 ms mean / 0.354 ms p95** over the same-population idle ablation. Outbound state is
**53.4 KB/s/client** in the realistic heavy room and **76.5 KB/s/client** at the 80-body cap, both below
the older audit's measured **85.8 KB/s/client** legal-ceiling baseline. Input/action message budgets are
at 25% and 12.5% per player, respectively.

The browser probe found only a small paired VFX increment: **+0.70 ms mean scene update** and
**+0.34 ms mean Phaser render** for all systems versus populated idle. Its absolute FPS is not a shipping
GPU result because it ran at 640x360 on headless SwiftShader; subsystem timings and paired deltas are the
usable evidence. No product hot-path change is justified by these measurements.

One real, bounded issue is separate from steady play: the full state is **10,908 B** at realistic load and
**15,867 B** at the cap. Both exceed Colyseus's default 8 KiB encoder buffer, and live joins emitted the
documented overflow/re-encode warning. That can add a small join/reconnect allocation spike, not ongoing
input latency. The cheapest follow-up is to size `Encoder.BUFFER_SIZE` once to 32 KiB at server startup;
it was not changed in this audit because the steady tick is healthy and product edits were last resort.

## What was measured

The benchmark uses a real in-process `GameRoom`, exact 50 ms logical steps, the installed Colyseus
encoder, and real registered input/attack handlers. Broadcast/listener side effects are the only things
replaced. Product code was not edited.

The principal room has five players:

- Snakeoil Tincture Scepter channel zone;
- Gravewax Seance-Globe channel zone;
- Gravelthroat Repeater 1-10 pellet bursts;
- Stormcaller Tesla Gatling with six authoritative beam rows;
- Rimewrit Grave-Slab with timed blade-extension melee.

It also has 48 mixed ordinary enemies and the active Seam-Eater worm boss. The clean heavy sample retains
only ticks with at least two zones and all six beam rows live. Enemies are parked and restored to high HP so
the same population survives warm-up instead of turning the benchmark into a declining-horde test. A paired
idle arm keeps the players, enemies, boss, and input cadence while disabling weapon deliveries. The cap arm
runs the same controllers at 80 effective bodies and samples every cap-pressure tick; simultaneous entities
are verified by its recorded peaks.

Environment: AMD Ryzen 7 9800X3D, 16 logical CPUs, Node v24.13.0, Windows x64, commit
`67fabe17c201221e1589e5765d9d1a8c58c3fada`. Each clean arm uses 600 warm-up ticks, then 2,000 samples
(1,200 for cap pressure); attribution uses a separate 1,200-sample instrumented run.

### Measurement log

| Stage | Result |
|---|---|
| Audit initialization | Report created before repository inspection or benchmark execution; product files marked read-only. |
| Baseline recovery | Read the complete V7 Sol report set and older tick/net/frame audit. Older tick/frame values were estimates; the schema-19 wire run was the quantitative baseline. |
| Harness shakedown | Reduced samples verified two zones, six beam rows, projectiles, blade sweeps, worm boss, and 80/80 cap admission. |
| Full server/wire run | 2,000 idle + 2,000 simultaneous-heavy clean ticks, 1,200 cap ticks, and 1,200 attribution ticks completed. |
| Browser run | Completed 90 idle + 90 non-beam + 45 six-active-beam samples on private listeners; renderer/population limitations recorded below. |
| Product decision | No steady hotspot met the bar for a product edit; no product code changed. |

## Server tick cost

| Scenario | p50 | p95 | p99 | max | p95 of 50 ms | max of 50 ms |
|---|---:|---:|---:|---:|---:|---:|
| Same-population idle | 0.272 ms | 0.479 ms | 0.587 ms | 0.781 ms | 0.96% | 1.56% |
| V7 simultaneous heavy | **0.485 ms** | **0.834 ms** | **1.041 ms** | **1.630 ms** | **1.67%** | **3.26%** |
| Wave 2 cap pressure | **0.857 ms** | **1.363 ms** | **1.668 ms** | **3.585 ms** | **2.73%** | **7.17%** |

The heavy-room delta is +0.203 ms mean and +0.354 ms p95. Even the cap arm has 36.7x budget/p95
headroom. The intentional protocol waits remain much larger: 0-50 ms command mint, 0-50 ms server tick
wait, 120 ms remote-body interpolation, and one render interval.

### Per-system attribution

The wrappers add measurement overhead, so percentages come from the separate instrumented run; the clean
percentiles above are authoritative.

| Subsystem | mean | p95 | share of instrumented tick |
|---|---:|---:|---:|
| Collision/grid (includes projectile/contact broad phase) | 0.267 ms | 0.392 ms | **43.85%** |
| World zone ticking | 0.110 ms | 0.306 ms | **18.01%** |
| Inline movement/AI/contact/tail | 0.080 ms | 0.138 ms | **13.17%** |
| Pellet/burst gun work | 0.033 ms | 0.140 ms | 5.47% |
| Authored enemy AI | 0.030 ms | 0.051 ms | 4.98% |
| Projectile stepping | 0.029 ms | 0.055 ms | 4.83% |
| Six-row beam work | 0.027 ms | 0.043 ms | 4.44% |
| Melee/shared hit envelope/blade sweep | 0.014 ms | 0.079 ms | 2.36% |
| Boss/worm | 0.011 ms | 0.021 ms | 1.83% |
| Zone weapon emission | 0.003 ms | 0.007 ms | 0.53% |

The top three are collision/grid, world-zone ticks, and the inline movement/contact tail. They are the first
places to remeasure if entity limits rise, but their combined measured mean is only 0.457 ms. There is no
current performance case for changing them.

## Snapshot and wire cost

Patch sizes include the Colyseus protocol byte and use the installed schema-33 encoder. Bytes/sec are
application bytes before WebSocket/TCP overhead.

| Scenario | patch mean | patch p95 | patch max | encoder p95 | outbound/client |
|---|---:|---:|---:|---:|---:|
| Same-population idle | 774 B | 825 B | 834 B | 0.014 ms | 15.5 KB/s |
| V7 simultaneous heavy | **2,669 B** | **4,447 B** | **4,825 B** | **0.056 ms** | **53.4 KB/s** |
| Wave 2 cap pressure | **3,826 B** | **5,644 B** | **6,297 B** | **0.083 ms** | **76.5 KB/s** |

The older schema-19 audit's actual 2,000-patch legal-ceiling result was 4,292 B/patch mean,
0.055 ms encoder p95, 85.8 KB/s/client, and a 14,918 B initial state. Thus the current heavy mean is 62%
of the older wire ceiling; cap-pressure mean is 89%. Cap p95 is a 112.9 KB/s burst rate, but mean bandwidth
stays below the prior ceiling. The five-client heavy room emits 2.14 application Mbit/s total; cap pressure
emits 3.06 Mbit/s total.

Inbound measured wire messages are 111 B per input and 36 B per attack, including protocol framing. The
workload sends 100 inputs/s plus 40 attack requests/s: **12.54 KB/s total inbound application data**.
Each player uses one of four allowed input messages per tick (25%); gun/blade owners use one of eight
action messages (12.5%). Message budgets hold comfortably.

### Entity-cap pressure

| Entity | Heavy peak / cap | Utilization | Cap arm peak / cap | Utilization |
|---|---:|---:|---:|---:|
| Effective enemy bodies | 58 / 80 | 72.5% | **80 / 80** | **100%** |
| Friendly projectiles | 25 / 192 | 13.0% | 36 / 192 | 18.8% |
| Hostile projectiles | 0 / 120 | 0% | 22 / 120 | 18.3% |
| Friendly beams | 6 / 32 | 18.8% | 6 / 32 | 18.8% |
| Ground zones | 14 / 48 | 29.2% | 20 / 48 | 41.7% |

The new content does not come close to projectile, beam, or zone caps under this deliberately dense load.
The 80-body admission rail is reached exactly and remains inside tick/wire budgets.

## Client frame cost

The client artifact is a completed 5-player browser run at 640x360, DPR 1, Chromium 149, SwiftShader
Vulkan. It recorded 90 idle frames, 90 non-beam frames, and 45 frames with all six Stormcaller rows active.
The all-system sample peaked at five player rigs, 29 friendly projectile visuals, three zones, and six visible
beam entries. Combat killed the ordinary population down to 28 during that phase (idle reached 49), so this
is a VFX attribution measurement, not a full 48-enemy GPU certification.

Follow-up replay attempts did not overwrite the artifact: the Stormcaller protocol client was intermittently
downed during setup, or its short active phase missed the browser's throttled patch/render cadence. The probe
is therefore a measurement capture, not yet a deterministic CI performance gate. The server/wire result does
not share this limitation because it restores the cohort and qualifies at the authoritative tick boundary.

| Phase | frame interval p95 | scene update mean / p95 | Phaser render mean / p95 |
|---|---:|---:|---:|
| Populated idle | 60.6 ms | 2.90 / 4.20 ms | 6.20 / 7.70 ms |
| Zones + pellets + blade | 60.3 ms | 3.03 / 4.20 ms | 6.11 / 7.60 ms |
| All above + six active beams | 60.9 ms | 3.60 / 4.50 ms | 6.54 / 7.80 ms |

Absolute frame interval is dominated by headless SwiftShader/long-task behavior and must not be translated
to shipping FPS. The paired result is useful: all V7 VFX added **0.70 ms mean scene update** and
**0.34 ms mean render** over idle; p95 frame interval moved only +0.3 ms. The largest measured V7 update
costs were projectile visuals (0.9-1.1 ms p95), player rig/equipment/blade work (0.6 ms p95), attack routing
and VFX (0.5-0.6 ms p95), and all six beam structures (0.3 ms p95). Zone presentation rounded below
0.1 ms/frame in this probe. Muzzle flashes are included in attack/VFX; readability structures and blade
extensions are included in their owning categories.

The measured main-thread/render work is not a responsiveness regression. A representative full-resolution
physical-GPU run remains the correct release gate for absolute 60/120 FPS, especially because DPR/back-buffer
pixels were the older audit's expected GPU multiplier.

## Risks and recommendations

There is **no steady-state latency hotspot requiring product work**. Do not invent an optimization project:
the worst cap tick used 7.17% of budget, mean outbound wire stayed below the previous ceiling, and new entity
families retained 58-81% capacity headroom.

The only concrete follow-up is join/reconnect hygiene:

1. Full snapshots exceed the default 8 KiB encoder buffer (10.9 KiB heavy, 15.9 KiB cap), and live joins
   logged overflow/re-encode warnings. Cheapest fix: set `Encoder.BUFFER_SIZE = 32 * 1024` once at server
   startup, then rerun the join microbenchmark. This is not urgent for combat latency.

If future caps grow, remeasure collision/grid first, world-zone ticking second, and projectile visuals on a
physical GPU third. Those are evidence-based watch points, not current defects.

## Artifacts and changes

- Repeatable methodology: `docs/perf/v7-coop-latency-methodology.md`
- Server/wire raw result: `docs/perf/v7-coop-latency-server-wire.json`
- Client raw result: `docs/perf/v7-coop-latency-client.json`
- Server harness: `tools/perf-coop-latency.mjs`
- Browser probe: `e2e/tests/v7-perf-coop-frame.spec.ts`

No product code was changed. No owner listener on 5180/2567 was touched; all browser runs used private
ephemeral listeners. No commit was created.
