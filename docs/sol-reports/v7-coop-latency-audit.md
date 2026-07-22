# V7 Co-op Latency Audit

**Owner question:** Will the recently added combat and movement systems impact latency in the co-op game?

**Status:** Measurement in progress (2026-07-22). This file is the incremental report of record.

## Scope and guardrails

- Branch/worktree target: `feat/v0.118-metagame` in `C:/Users/Exped/DDv2`.
- Compare against the repository's earlier latency audit methodology and budgets.
- Measure authoritative server tick cost, snapshot/wire cost, and client frame cost under a matched realistic heavy co-op scenario.
- Use only private benchmark listeners; do not touch the owner's listeners on ports 5180 or 2567.
- Product code remains read-only unless a high-confidence hotspot is demonstrated with before/after measurements.

## Measurement log

| Time (America/New_York) | Phase | Result |
|---|---|---|
| 2026-07-22 | Audit initialized | Report created before repository inspection or benchmark execution. Baselines and measured results pending. |
| 2026-07-22 | Prior-audit recovery | Read the complete V7 Sol report set and the earlier `structure-latency-panel` tick/net/frame audits. The earlier server and client numbers were explicitly static estimates; its reproducible wire benchmark is the quantitative baseline. |
| 2026-07-22 | Harness implementation | Added read-only, in-process GameRoom/Colyseus measurement tooling and a documented paired idle-vs-V7 methodology under the exclusive `tools/perf-*` / `docs/perf/**` paths. No product file was edited. |
| 2026-07-22 | Harness shakedown | Reduced-sample run completed on schema 33. It proved the scenario reaches 80/80 effective bodies under cap pressure, six simultaneous Stormcaller beam rows, both player zones, projectiles, and the worm boss. Shakedown figures are not final results; full warmed runs pending. |

## Results

### Comparable baseline recovered from the older audit

- Simulation cadence/budget: 20 Hz, one logical step every 50 ms; a delayed callback may execute up to three logical steps before one patch.
- Older server tick audit: no measured percentile baseline. It prescribed a deterministic stress room and phase timers; its cost bands were estimates and will not be presented as measured regressions.
- Older wire benchmark (`2,000` warmed patches, legal schema-v19 ceiling): `4,292.4 B/patch` mean, encoder `0.031 ms` mean / `0.055 ms` p95 / `0.067 ms` p99, or `85.8 KB/s/client` at 20 Hz. Population was 10 players, 80 effective enemy bodies, 120 hostile projectiles, 10 beams, 32 receipts, 12 worm slots, and 35 XP echoes. Full initial state was `14,918 B`.
- Older hot wire slices: 10 moving players `316 B`; 80 moving enemies `1,126 B`; 120 moving projectiles `1,793 B`; 10 active beams `516 B`; 12 worm segments `183 B` on their 10 Hz pose tick; worst 32-receipt overwrite `1,794 B`.
- Older client frame audit: no measured percentile baseline. It estimated four beams at `0.6–2.5 ms/frame`, 54 full-rate procedural rigs at `1.5–5 ms/frame`, ten-pack FX edges at `2–12 ms` plus possible `2–8 ms` GC, and identified DPR/back-buffer pixels as the dominant GPU multiplier. These remain hypotheses until the current browser measurement.
- Network-latency constants retained for interpretation: command mint wait `0–50 ms`, server tick wait `0–50 ms`, remote body interpolation `120 ms`, and one render frame up to `16.7 ms` at 60 Hz. This audit measures processing/serialization/render cost; it does not relabel those intentional protocol waits as V7 regressions.

### V7 workload map recovered from durable reports

- Server-side additions to stress together: swept/capsule projectile collision, timed ground-zone damage, round-resolved burst/pellet/parallel spawn packets, shared hit-envelope resolution, sampled blade-extension sweeps, iframe/roll windows, cone streams, six-tip beam delivery, and immediate movement/prediction changes.
- Client-side additions to stress together: five retained beam-structure families, ice-only Frostquill rope art, blade extensions, support-hand mechanism animation, full-card tumble movement, generated projectile/explosion identity art, muzzle flashes/projectile admission, and dense hit/zone feedback.
- Existing measured live gates establish geometry/correctness, not throughput. Their zero-pixel muzzle/beam attachment results and movement reconciliation envelope are therefore treated as correctness prerequisites rather than latency measurements.

Current benchmark measurements remain pending.

### Current measurement scenario

The repeatable harness and exact commands are documented in `docs/perf/v7-coop-latency-methodology.md`.
The principal room uses five co-op players so all named server/client surfaces are simultaneous: two channel
zones, Gravelthroat's 1–10 radial-pellet gun, Stormcaller's six beam rows, and Rimewrit's timed blade extension,
with 48 mixed ordinary enemies plus the twelve-slot Seam-Eater boss. A paired idle-population run holds the
same actors/boss/input rate but disables those five weapon systems. A separate run fills the enemy admission
rail to 80 effective bodies. Final samples use 600 warm-up ticks and 2,000 qualifying heavy ticks; only ticks
with both player zones and all six beam rows live qualify.

## Verdict

Pending measured evidence.
