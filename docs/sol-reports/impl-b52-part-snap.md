# impl-b52-part-snap

## Verdict

First bad commit: `0854445d1392eff872198b86f5123770accf0bd3` (`fix: eliminate B51 warp
corrections`), incorporated by B51 merge `407efcb` and later carried through `f1cbca8`.

The B51 owner-presentation/reconciliation changes made the rendered root's per-frame derivative
non-uniform. `ArenaScene.animateBlobs()` still used that derivative as `SpriteRig`'s locomotion
speed and direction. The root itself was presented smoothly, but the rig integrated a separate gait
clock from correction/presentation debt. It alternately stalled and consumed multiple normal gait
steps, moving HEAD and limbs to stale/advanced targets before their springs caught up.

The fix keeps the rendered root path unchanged. While SELF has active movement input and the
rendered root is advancing, the rig now consumes the predictor's fixed-tick `mvx/mvy` locomotion
vector. Remote rigs, idle/blocked SELF, authored impulses, and pose composition retain their prior
paths. This is a clock-source correction only; it does not redesign gait, bob, head nod, attacks, or
gear poses.

## Headless proof and bisect

I built `e2e/tests/b52-part-snap.probe.spec.ts` before changing production code. It boots a real
Phaser/Colyseus arena, captures every actual `postupdate`, and records root plus per-node world/local
coordinates and rig clocks.

Live first-bad boundary:

| Revision | Result |
| --- | --- |
| `d5ff2d9` (`0854445^`) | PASS |
| `0854445` | FAIL: HEAD `dx=-41.1174 px` while root `dx=+1.4487 px` |

The retained unfixed HEAD chart on the current integration baseline reproduced a `-17.8552 px`
backward frame while the root advanced `+5.3333 px`; HEAD's root-relative x changed `-35.0562 px`.
That trace observed one visible event in 4.2665 seconds (`0.2344 Hz`) and 18 oversized stride-clock
advances (`4.2189 Hz`, maximum `2.6196 rad/frame`). The owner's approximately 2 Hz report remains
the real-time observation; the headless production canvas rendered only 6-9 FPS, so the report and
evidence preserve the measured headless cadence without extrapolation.

The alternative phase-wrap hypothesis was rejected: `strideT` did not wrap backward. It jumped
forward because correction-bearing presentation distance was being differentiated into locomotion
speed. A stable fixed-tick locomotion source removed both the clock jumps and node reversals.

## Regression sweep

The sweep uses three characters:

- `proto-cowboy-hidden-face`
- `drifter`
- `proto-samurai`

Each runs walking/fists, walking with held `x2-barrett-50-cal-sniper`, and walking while repeatedly
attacking with `rusty-cleaver`. A same-process authority fixture hard-resets every case to the same
collision-checked 1,700 px straight corridor, and each retained trace must advance more than 850 px.

Final result: 9/9 scenarios passed, covering 1,168-1,248 px each. Every mounted HEAD, BODY, both
hands, both feet, and weapon node had zero discontinuities; every HEAD had zero backward events.
The corrected stride clock stayed within `1.0472-1.4159 rad/frame` with zero jump/reset events.

## Verification

- `pnpm typecheck` — PASS
- `pnpm test` — PASS (`216` files, `2,775` tests)
- `DD_B52_TRACE_LABEL=after pnpm e2e -- e2e/tests/b52-part-snap.probe.spec.ts --grep "B52 sweep"` — PASS
- `pnpm e2e -- e2e/tests/b52-part-snap.probe.spec.ts` — PASS (`2/2`)
- `git diff --check` — PASS

Evidence:

- `docs/owner-notes-audit-v12-evidence/b52-part-snap/before-trace-chart.json`
- `docs/owner-notes-audit-v12-evidence/b52-part-snap/after-trace-chart.json`
- `docs/owner-notes-audit-v12-evidence/b52-part-snap/README.md`

Files touched:

- `packages/client/src/scenes/ArenaScene.ts`
- `e2e/tests/b52-part-snap.probe.spec.ts`
- `docs/owner-notes-audit-v12-evidence/b52-part-snap/README.md`
- `docs/owner-notes-audit-v12-evidence/b52-part-snap/before-trace-chart.json`
- `docs/owner-notes-audit-v12-evidence/b52-part-snap/after-trace-chart.json`
- `docs/sol-reports/impl-b52-part-snap.md`
