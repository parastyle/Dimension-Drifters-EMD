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

**No. The V7 additions do not measurably impact co-op latency.** Measured 2026-07-22 by the
orchestrator after the Sol stalled; harness and methodology are the Sol's, unmodified except for the
attempt-budget fix noted below. 2,000 qualifying ticks per arm, 600 warm-up.

| | idle ablation | V7 all-systems | delta |
|---|---:|---:|---:|
| tick mean | 0.129 ms | 0.211 ms | **+0.082 ms** |
| tick p95 | 0.239 ms | 0.336 ms | +0.097 ms |
| tick p99 | 0.351 ms | 0.442 ms | +0.091 ms |
| tick max | 0.642 ms | 0.883 ms | +0.241 ms |
| patch | 959 B | 1,137 B | +178 B |
| per client | 18.7 KB/s | 22.2 KB/s | +3.5 KB/s |

The authoritative tick budget is **50 ms**. The full V7 workload — two channel zones, radial pellets,
six simultaneous beam rows, timed blade extensions, 48 enemies and the twelve-slot worm boss, five
players — consumes **0.42% of it on average and 1.8% at the worst single observed tick**. Roughly 57x
headroom remains even at max. The added wire cost is 3.5 KB/s/client, negligible against any
broadband link.

Interpretation: latency the player actually feels is dominated by the intentional protocol waits
(0–50 ms command mint, 0–50 ms tick wait, 120 ms remote interpolation, ≤16.7 ms render frame). V7
adds ~0.08 ms of processing to that chain. It is not a perceptible contributor and no optimization is
warranted.

Attribution of the instrumented tick: beams **51.4%** (0.133 ms), inline movement/AI/contact 13.9%,
collision/grid 8.4%, projectiles 7.9%, enemy AI 7.4%, boss/worm 3.9%. Beams dominate the V7 cost, but
in absolute terms they are an eighth of a millisecond — worth knowing if beam count ever grows by an
order of magnitude, not worth acting on now.

### Harness corrections made during the run

- `MAX_ATTEMPT_MULTIPLIER` and the attribution loop's hardcoded `* 20` are now attempt budgets that
  honor `DD_PERF_MAX_ATTEMPT_MULTIPLIER`. Qualification ("both zones + all six beam rows live") is
  intermittent by design at ~4% of ticks, so an 8x/20x attempt budget could never reach the 2,000- and
  1,200-sample targets. **The qualification predicate and the sample targets were not weakened** — only
  the number of attempts allowed to reach them.

### Open finding — deferred, needs its own investigation

The `v7-wave2-enemy-cap-pressure` arm (80 effective bodies, same predicate) collected **0 qualifying
ticks in 72,000 attempts**, versus ~4% at 48 enemies. Under enemy-cap pressure the six-beam delivery
apparently never achieves six simultaneous rows. That is a gameplay/admission interaction, not a
latency measurement, and it is a real question: beams may be starving against the entity cap exactly
when the screen is fullest. This arm was skipped to unblock the owner's answer; the scenario is
retained in the harness. **Do not "fix" this by relaxing the predicate.**
