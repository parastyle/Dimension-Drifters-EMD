# B53 facing-flip warp evidence

Captured 2026-07-25 with the permanent Playwright probe in
`e2e/tests/b53-flip-warp.probe.spec.ts`.

## Result

The probe records the rendered root plus body, head, front/back hands, front/back feet, and held
weapon on every `postupdate`, including committed facing, signed root scale, `facingBlend`, and
continuous `flipProgress`. Part steps are world-space pivots relative to the rendered root, so
ordinary walking translation is excluded while parent-scale, authored-layout, pose, and mount
motion remain. Because headless frames vary in duration, the gate normalizes each step to a 60 Hz
frame and retains the raw coordinates and raw step in the JSON.

| Capture | Scenarios | Worst part | Worst step @ 60 Hz | Raw sampled step | Steps over 6 px |
| --- | ---: | --- | ---: | ---: | ---: |
| Before | 24 | Drifter front hand, unarmed ADADAD | 13.3333 px | 93.2798 px / 116.6 ms | 90 |
| After | 24 | Drifter back hand, 2H melee ADADAD | 3.1623 px | 25.2732 px / 133.2 ms | 0 |

Both captures cover:

- `proto-cowboy-hidden-face`, `drifter`, and `proto-samurai`
- unarmed, Fool's Gold Revolver, Tombstone Greatsword held, and Tombstone mid-combo
- one right-to-left flip and six interrupted ADADAD direction changes

The before capture used a controlled render-only reversion to the legacy exponential mirror,
committed-facing layout offsets, and aimed-gun immediate scale assignment. The before and after
captures otherwise used the same finalized probe and attack cadence. The legacy run was
intentionally allowed to retain threshold failures; the fixed run passed its assertions.

## Files

- `before-per-frame-trace.json` and `after-per-frame-trace.json`: complete raw per-frame samples,
  per-part analyses, target-change frames, and threshold events.
- `before-single-flip.png` and `after-single-flip.png`: the one-handed gun at the committed
  direction-change frame.
- `before-rapid-adadad.png` and `after-rapid-adadad.png`: the two-handed mid-combo actor at the
  third interrupted direction change.

## Reproduction

Run the full fixed regression gate:

```text
node tools/b53-flip-warp-probe.mjs after
```

Run the short single-flip smoke case without overwriting this audit capture:

```text
node tools/b53-flip-warp-probe.mjs b53-smoke --baseline
```

Recompute a stored trace's analysis from its raw frames:

```text
node tools/b53-summarize-trace.mjs before
node tools/b53-summarize-trace.mjs after
```
