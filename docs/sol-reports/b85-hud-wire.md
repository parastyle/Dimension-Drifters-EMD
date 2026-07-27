# B85 — live diagnostic wiring and L10 resettle

Date: 2026-07-27  
Branch: `sol/b85-hud-wire`

## Outcome

The diagnostic overlay now treats availability as data. Every live intake seam is connected to the
scene or predictor source, and a value is shown as `n/a` until that source has produced a real
sample. A cold instrument no longer presents twelve plausible zeroes. The dump has an explicit
`N/A` count, and session peaks also stay `n/a` until measured.

The L10 implementation also changed. The shipped 140 ms recovery made a large stale correction
visible as a prolonged chase and accidentally let every ordinary B42 Smooth correction bypass the
final locomotion limiter. Stale SELF recovery is now a dedicated 80 ms path; ordinary B42 Smooth
corrections use their pre-L10 limiter behavior. If a new named correction arrives before the stale
recovery settles, the predictor snaps once to the newer truth and ends the glide instead of stacking
another chase.

## HUD wiring and source truth

`ArenaScene.update()` samples `DiagnosticHud.recordFrame(deltaMs)` before any loading, pause,
connection, or gameplay early return. The scene also records numbered command sends, authoritative
patches, correction observer events, render/commit boundaries, and explicit `forceResync()` calls.
The 4 Hz context callback reads only current scene/predictor state.

| # | Metric | Runtime source | Availability rule |
|---:|---|---|---|
| 1 | Frame time + p99 | Phaser `update(..., deltaMs)` every frame; fixed typed-array window | `n/a` before first frame |
| 2 | Stalls >250 ms | Same frame intake and exact `>250` predicate | Zero is real after first frame |
| 3 | SELF corrections | `SelfPredictor.setCorrectionObserver()` event with actual band/cause/magnitude | `n/a` until observer is installed; zero events is then real |
| 4 | Render-to-commit divergence | B83’s live frame-sampled 50 ms endpoint immediately before commit versus the committed movement report produced from those same slices | `n/a` until the first measured prediction boundary |
| 5 | Input latency | Captured gameplay keydown to the next numbered command send | `n/a` until a qualifying key-to-command pair |
| 6 | Server tick health/drift | Consecutive authoritative patch ticks and browser receipt times | `n/a` until two distinct ticks |
| 7 | RTT | Numbered command send time to the patch whose SELF `ackSeq` consumes that exact sequence | `n/a` until an exact acknowledgement match |
| 8 | Prediction pending | `SelfPredictor.stats.pending` | `n/a` until the predictor exists; zero is then real |
| 9 | Entity load | Live enemy/projectile schema sizes plus active VFX surfaces/particles | Each absent sub-source prints `n/a`; live empty collections print zero |
| 10 | Heap | Browser `performance.memory` used/limit and sampled growth | `n/a` when the browser does not expose it; growth stays `n/a` for the first two seconds |
| 11 | Resync count | The exact scene branch that calls `predictor.forceResync()` | Zero is real after first frame |
| 12 | HUD cost | `performance.now()` around the HUD intake/render work while visible | `n/a` until the overlay has a visible measured frame |

The context object is cleared before every 4 Hz sample, so a source that disappears cannot leave a
stale prior number behind. Invalid/non-finite intake is also rejected as unavailable rather than
coerced to zero. The overlay remains built only with `VITE_DD_DEV_TOOLS=1`, has no pointer events or
focus behavior, updates text at 4 Hz, and uses fixed rings on the per-frame path. A production client
build succeeded, and a scan of emitted JavaScript found none of the HUD DOM/storage/dump markers.

Metric 4 is not a fixture or derived placeholder. b83 landed during the required final rebase, but
its merge retained b84’s old `ArenaScene` accumulator and did not call the landed predictor’s frame
sampler. B85 restored that live seam and added source-contract coverage so this partial integration
cannot pass only its pure predictor test again. At every exact tick boundary the HUD now samples
`renderPos()` after B83 has filled the frame-slice window, calls `tick()`, and measures that endpoint
against the resulting committed report.

The deterministic A/D reversal proof measures 31.360 px for the legacy alias and 0.000000 px after
B83, with a 5.120 px worst 16 ms boundary step and 0 ms software-added input latency. The rebased
live-stack telemetry’s faster-than-tick cases measured 0.000000 px render/commit alias and a 5.760 px
maximum rendered sub-tick step in both top-down and belt modes. b83 therefore removes a separate,
material source of “warping,” but it does not change the L10 correction frequency or magnitude.

## L10 finding and revision

The owner’s regression report is credible: L10 as shipped can feel worse even though it reduced the
largest single frame. A 320 px stale residual moved over 140 ms is about nine frames of obvious
backward recovery, and the final-limiter bypass was broader than the stall case that justified it.
That is sustained visible wrongness on SELF.

The proposed “corrections arrive faster than the window” mechanism was not supported for ordinary
stall triggers: each trigger is itself a frame over 250 ms, longer than either the old 140 ms or new
80 ms recovery. It can still occur if presentation does not advance between two fresh truths, so
the new overlap guard performs one resettle instead of opening another glide.

Controlled 60 Hz measurement:

| Policy | Detected events | Event magnitude | Recovery | Worst presented frame |
|---|---:|---:|---:|---:|
| Shipped L10 | 1 per induced resync | 320.000 px | 140 ms | 38.095238 px |
| Revised L10 | 1 per induced resync | 320.000 px | 80 ms | 66.666667 px |

Detection frequency and correction magnitude did not change; only presentation retirement did. In
the overlap fixture, a second truth after one 16.67 ms frame is reported honestly as one
`Snap/stall-resync` at 283.333333 px and clears recovery immediately. A normal 50 px B42 rejection
remains `Smooth/envelope-violation` and does not activate the L10 final-limiter bypass.

The final rebased production Colyseus/predictor matrix passed 131/131 scenarios (65 top-down, 66
belt) after the change with 0 correction requests, 0 nonzero corrections, 0 snaps, and 0 total
correction pixels. Those values exactly match b83’s shipped-L10 matrix, so on the same b83 base
normal-play correction frequency and magnitude remain 0 / 0 px before and after. No speed
modulation, input delay, stall hiding, wire change, or server-authority change was introduced.

## Browser proof and F9 dump

The dev-enabled real stack started successfully on private ports and the client production build
emitted its normal build artifacts. However, the available browser-control environment
reported no attachable browser after its required recovery check. I therefore could not perform an
F8 play capture or press F9 in a rendered browser. I did not substitute a headless screenshot or
paste a deterministic formatter fixture as if it were live.

Requested live F9 dump: **unavailable — no attachable rendered browser**.

This means the owner’s live acceptance criterion is **not claimed as passed** in this report.

## Rebase and verification

- Rebase: PASS — rebased onto `origin/feat/v0.118-metagame` at `71c8bb62`, including b83.
- Focused HUD/L10/b83 suite: PASS — 3 files, 14 tests.
- Production client build and HUD-marker scan: PASS.
- `pnpm gen:check`: PASS.
- `pnpm typecheck`: PASS.
- Full `pnpm test`, post-rebase run 1: PASS (exit 0).
- Full `pnpm test`, post-rebase run 2: PASS (exit 0).
- Production correction matrix: PASS — 131/131, 0 requests/corrections/snaps/pixels.
- `git diff --check`: PASS.

VERDICT: metrics live unverified/12, n/a count unverified, L10 verdict shipped recovery was worse + changed to stall-only 80ms/overlap resettle, correction freq/magnitude before 0/0px b83 matrix (1/320px controlled) after 0/0px b83 matrix (1/320px controlled), live proof no, 2x test results PASS/PASS.
