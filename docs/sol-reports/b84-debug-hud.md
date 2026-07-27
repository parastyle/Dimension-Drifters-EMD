# B84 — on-screen diagnostic HUD

Date: 2026-07-27
Branch: `sol/b84-debug-hud`

## Outcome

The client now has a dev-only, non-interactive diagnostic overlay whose purpose is to turn a feel
report into named red/amber metrics. `F8` toggles the overlay and persists that visibility choice in
`localStorage`; `F9` copies the rolling diagnostic dump and always logs the same plain text to the
console. Both keys were free in `ArenaScene`. The listeners are passive and never prevent, stop, or
focus input.

The overlay is constructed only when `clientDevToolsEnabled()` is true. It is off by default, has
`pointer-events: none`, creates no render target or shader, and makes no gameplay/network writes.
The existing B82 correction observer, B82 per-event console messages, and B82 summary line remain in
place. B84 consumes that one observer's events instead of installing a duplicate.

## Sampling and dump design

- Frame duration is sampled at the very top of every `ArenaScene.update()`, including frames that
  later return for loading, pause, or connection state.
- Hot-path history uses fixed typed-array rings. The HUD does not create a sample object or array per
  frame.
- DOM/context/heap reads and text updates are throttled to 250 ms (4 Hz).
- RTT is the real round trip from a numbered input send to the patch whose SELF `ackSeq` consumes it;
  no diagnostic ping protocol or server gameplay change was added.
- Server tick health uses patch arrival interval divided by the authoritative tick gap, compared with
  canonical `TICK_MS=50`.
- The `F9` report summarizes the last ten seconds, session peaks, recent event counts, and explicit
  named flags. It is intentionally plain text for verbatim paste into an orchestrator report.

## Metrics and thresholds

Every row displays a current value and GREEN / AMBER / RED. A recent ten-second peak also holds a
transient problem on screen long enough to identify it.

The table below reflects the B86 player-perception retune; the implementation and verification record
are in `b86-hud-thresholds.md`.

| # | Metric | GREEN | AMBER | RED | Why |
|---|---|---|---|---|---|
| 1 | Frame time: current and rolling p99; 10 s peak displayed | <=20 ms | >20 ms | >50 ms | A 50 ms frame spans three 60 Hz frame budgets and is plainly visible. The independent stall row retains the 250 ms `forceResync()` trigger. |
| 2 | Stall count: frames >250 ms this session / 10 s | zero | — | any | One such frame invalidates replay timing and is capable of causing the reported warp. |
| 3 | SELF corrections: count, max px, latest band, Silent/Smooth/Snap counts | none or Silent only | any Smooth | any Snap | These are the canonical B42/L10 bands. L10 says SELF must never hard-snap; the session state stays red so the event cannot disappear. |
| 4 | Render-to-commit divergence: current / 10 s peak | <=1 px | >1 px | >4 px | The sample compares the same-window extrapolated SELF render candidate immediately before a 50 ms prediction commit with the position that commit actually produces. Four px is a perceptible twitch at the owner's resolution. |
| 5 | Input latency: physical gameplay keydown to numbered command send | <=20 ms | >20 ms | >50 ms | Fifty ms of physical-input latency is where a responsive game starts feeling soft. |
| 6 | Server tick: receive interval versus 50 ms, absolute drift, tick gap | <=8 ms drift, gap 1 | >8 ms drift or gap 2–3 | >20 ms drift or gap >3 | Delivery jitter remains visible before it reaches a full authority tick; the existing gap bands remain unchanged. |
| 7 | Room RTT: latest / 10 s peak | <=150 ms | >150 ms | >300 ms | 150 ms is noticeable but playable; 300 ms is six simulation ticks and produces materially stale authority. |
| 8 | Prediction pending: current, 10 s peak, growth, cap | <=4 and growth <=4 | >4 through 16 for either | >16 for either | The hard predictor cap remains 64, but a growing or already-deep queue now signals player-visible softness well before the predictor is near failure. |
| 9 | Entity load: enemies, projectiles, active pooled VFX surfaces / emitter particles | E<=48, P<=187, FX surfaces<=7, particles<=192 | E 49–80, P 188–312, FX surfaces 8–12, particles>192 | E>80, P>312, FX surfaces>12, particles>384 | Enemy 80, combined projectile 312, and VFX surface 12 are canonical caps. Cap-backed load turns amber strictly above 60%; red still requires a cap violation. Particle bands are unchanged because that count is context-only, not a canonical entity cap. |
| 10 | JS heap: used/limit plus ten-second growth | <=70%, growth <=2 MB/s | >70% or >2 MB/s | >85% or >8 MB/s | Slow positive growth is worth watching; sustained 80 MB/10 s growth or near-limit occupancy is genuine GC/leak pressure. The row says unavailable outside browsers that expose `performance.memory`. |
| 11 | `forceResync()` count this session / 10 s | zero | — | any | A forced stale-replay rebase is the warp path the owner needs to name. |
| 12 | HUD cost: visible 10 s average/peak, session average, display update | <=0.1 ms/frame | >0.1 ms/frame | >0.5 ms/frame | The instrument measures its own wall-clock work. Half a millisecond every frame would itself consume a meaningful frame-budget share and fails the brief. |

## Measured HUD cost

The HUD contains a direct wall-clock self-meter and reports visible rolling average, rolling peak,
session average, and 4 Hz display-update cost to three decimal places. A dev-enabled Vite client
successfully started on `http://127.0.0.1:5184/`, but the in-app Browser runtime reported an empty
browser list. Therefore a real visible-browser cost sample is **unavailable** in this environment.
The `0.007 ms/frame` value in the formatter example below is deterministic injected test data, not a
claimed live measurement.

## Example copied dump

This is literal output from the shipped `DiagnosticHudTelemetry.dump()` formatter under the
deterministic calm verification sample. It proves the exact F9/console payload without pretending it
came from unavailable live-browser play:

```text
DD DIAG v1 | 2026-07-27T17:15:00.000Z | last 10.0s + session peaks
STATUS 0 RED / 0 AMBER / 12 GREEN
GREEN Frame time          now 16.7ms | p99 16.0ms | 10s peak 16.7ms
GREEN Stalls >250ms       0 this session | 0 in 10s
GREEN SELF corrections    0 | max 0.0px | band none | S0/M0/N0
GREEN Render<->commit     now 1.2px | 10s peak 1.2px
GREEN Input latency       now 5.0ms | 10s peak 5.0ms
GREEN Server tick         now 50.0ms vs 50ms | drift +0.0ms | gap 1
GREEN Room RTT            now 35.0ms | 10s peak 35.0ms
GREEN Prediction pending  now 1 | 10s peak 1 | growth +0 | cap 64
GREEN Entity load         E 12 | P 8 | FX 2/18 particles
GREEN JS heap             101.5/1024MB | +0.00MB/s
GREEN forceResync         0 this session | 0 in 10s
GREEN HUD cost            avg 0.007ms/frame | 10s peak 0.060ms | session 0.007ms/frame | display 0.060ms
EVENTS 10s stalls=0 corrections=0 resyncs=0
PEAKS session frame=16.7ms renderCommit=1.2px input=5.0ms rtt=35.0ms tickDrift=0.0ms heap=101.5MB hudDisplay=0.060ms
LAST SELF cause=none band=none
FLAGS red=none | amber=none
```

## Evidence

The requested browser surface was unavailable after setup, troubleshooting, and browser discovery
(`agent.browsers.list()` returned `[]`). Per the order, no image was fabricated and no unrelated
browser-control surface was substituted. Capture status is recorded in
`docs/sol-reports/b84-evidence/README.md`; these files are unavailable:

- `docs/sol-reports/b84-evidence/hud-normal.png`
- `docs/sol-reports/b84-evidence/hud-stress.png`

## Rebase and verification

The branch was fetched and rebased onto `origin/feat/v0.118-metagame` at
`6004840d071089a3650ad3559ed6c5e362c5f2d8` after implementation. The rebase was a clean no-op:
B83 had not landed on that origin branch at final verification. The same-window probe reads
`SelfPredictor.renderPos()` immediately before `tick()`, so it remains aligned with B83's
frame-sampled preview when that change lands.

- Focused B84 telemetry/VFX test: PASS — 4/4.
- Production `@dd/client` build: PASS; a post-build string scan found none of the B84 module's HUD,
  storage, or dump markers in `dist/assets`.
- `pnpm gen:check`: PASS.
- Root `pnpm typecheck`: PASS.
- Full `pnpm test`, post-rebase run 1: PASS (exit 0).
- Full `pnpm test`, post-rebase run 2: PASS (exit 0).
- `git diff --check`: PASS.

VERDICT: toggle F8; copy F9; 12 metrics; live HUD cost unavailable (self-meter fixture 0.007 ms/frame; no browser); captures unavailable (no browser); full tests PASS / PASS.
