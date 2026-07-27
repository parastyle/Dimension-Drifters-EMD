# B82 — Canon L10: no SELF snap after a stall

Date: 2026-07-27
Branch: `sol/b82-l10-no-self-snap`

## Outcome

Canon L10 is now enforced at both reconciliation and final root presentation:

- A stale SELF replay caused by `forceResync()` or pending-command overflow rebases simulation
  immediately but preserves the currently rendered position and retires the residual through the
  existing 140 ms `Smooth` window.
- The B42 plausibility envelope and its normal `Silent` / `Smooth` / `Snap` classification are
  unchanged. Ordinary B42 rejections are reported as `envelope-violation`.
- Remote players, enemies, and bosses were not changed.
- The existing `deltaMs > 250` detector in `ArenaScene` is unchanged. It still drops the stale input
  backlog and calls `forceResync()`; only SELF presentation recovery changed.

The final root limiter now knows when `SelfPredictor` is already retiring correction debt. During
that window it accepts the predictor's graded position, avoiding a second snap-distance decision
that could turn a large Smooth correction back into a hard cut.

## Teleport versus correction

No wire change was needed. The protocol already carries the distinction:

- `teleportSeq` advances when the server deliberately places the player through `zeroMoveVel()` at
  authored placement sites (spawn/restart, rift or pit reposition, revive, and mechanics using that
  placement path). A changed `teleportSeq` remains an immediate cut and is instrumented as
  `band=snap cause=teleport`.
- `serverMotionEpoch` continues to identify server-authored motion and keeps its existing
  authoritative presentation behavior.
- `needResync` is local stale-prediction state. It is not evidence that the server intended a
  teleport, so it now forces the residual into `MovementCorrectionBand.Smooth` regardless of
  magnitude.

Teleport handling has precedence if teleport and stale-resync state arrive together. This prevents
a genuine authored placement from being accidentally converted into a glide. `SCHEMA_VERSION` was
not bumped because the existing sequence/epoch signals were sufficient.

## Dev-only diagnostic surface

The instrument exists only when `clientDevToolsEnabled()` is true. Production creates neither the
telemetry object nor the observer or DOM line.

Every SELF correction writes a console entry:

```text
[L10 self-correction] 92.0px band=smooth cause=stall-resync
```

Every rendered frame over 250 ms writes:

```text
[L10 long-frame] 318.5ms
```

The non-interactive HUD line continuously summarizes the run:

```text
L10 SELF · 4 corrections (0 silent / 4 smooth / 0 snap) · max 92.0px · causes 4 stall-resync / 0 envelope-violation / 0 teleport · >250ms 4 (max 318.5ms)
```

The line has `pointer-events: none`, opens no modal, takes no focus, and is removed on scene cleanup.
The long-frame sample is taken at the top of `ArenaScene.update()`, so pauses, overlays, and early
returns cannot hide a frame from the counter.

## Regression proof and measured displacement

`prediction.l10.test.ts` exercises both sides of the distinction in one test through the same final
presentation chain used by the arena:

- Controlled stale-prediction residual: 320.000 px.
- Before: 320.000 px in one frame. The former `needResync` hard path discarded the presentation
  residual; 320 px is also above the unchanged 200 px Snap boundary.
- After: reconciliation itself moves SELF 0 px, then the 140 ms Smooth window converges completely.
  At 60 Hz the measured worst single-frame step is 38.095238 px, below the stated 40 px threshold.
- Genuine teleport: the test advances `teleportSeq` and deliberately moves from `(680, 1000)` to
  `(3000, 2600)`. The full 2818.226393 px displacement is applied in one frame and is reported as
  `snap/teleport`.

A companion assertion proves a B42 movement rejection is still classified by the normal envelope
path (`50 px`, `Smooth`, `envelope-violation`).

## Stress attempt

I added a repeatable Playwright stress probe rather than using an idle map. For 30 seconds at
640×360 in software Chromium it maintained:

- 48 mixed enemies (critter, mote-swarm, pricklepulp, boothill, ronin, and gatlin), automatically
  refilled under attrition;
- a live Seam-Eater worm boss;
- continuous circular movement, a Gravelthroat Repeater attack every 90 ms, and parry traffic.

Observed clean-run result:

```text
frames=453
maxFrameMs=116.7
framesOver250ms=0
enemiesAtEnd=48
projectilesAtEnd=52
stallResyncCorrections=0
envelopeViolationCorrections=0
teleportCorrections=35
maxInstrumentedTeleportPx=185.6368
maxObservedSelfFrameStepPx=204.1614
```

The 35 snaps were all explicitly tagged `teleport`; the lethal stress setup repeatedly exercised
authored reposition/death placement. They are expected by L10 and demonstrate that the diagnostic
surface separates them from correction snaps.

The owner's stall cadence was **not reproduced**. The worst frame was 116.7 ms, so there was no
`>250 ms` event and no stall-resync correction to attribute. I found no evidence supporting a new
stall cause and did not invent one. The committed probe plus the dev HUD/console counters are the
trap left for the next owner run.

## Verification

- `pnpm gen:check`: PASS.
- `pnpm typecheck`: PASS.
- `tools/diag-rb-telemetry.mts`: PASS, 129/129 scenarios across both modes (topdown 64, belt 65);
  zero requests, applications, Silent/Smooth/Snap corrections, and pixels.
- `pnpm test`, consecutive run 1: PASS — 244 files, 2927 passed, 20 skipped (26.04 s).
- `pnpm test`, consecutive run 2: PASS — 244 files, 2927 passed, 20 skipped (25.28 s).
- `b82-l10-stress.probe.spec.ts`: PASS after the 30-second sustained-combat sample.

VERDICT: L10 implemented by forcing stale SELF resync through the existing Smooth window; genuine teleport remains instant (2818.226393 px `teleportSeq` proof); dev-only HUD plus per-event console instrumentation installed; stall reproduced: no; controlled worst SELF correction before/after: 320.000 px / 38.095238 px per frame; telemetry: 129/129, both modes, zero requests/applications/snaps/pixels; full tests: 2× PASS (244 files, 2927 passed, 20 skipped).
