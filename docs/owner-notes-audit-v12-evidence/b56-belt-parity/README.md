# B56 belt-mode parity evidence

Captured on 2026-07-25 with `proto-cowboy-hidden-face` on corporate-grid belt floors. Every live
stack used OS-assigned loopback ports; ports 5180 and 2567 were not used.

## Owner symptom reproduction

- `reproduction.json` records the pre-repair boot observation, aim controls, and the 17-sample
  mixed-space SELF trace (`502.508 px` maximum root step and `165.653 px` projection error).

## Live belt gate

- `belt-full-hud.png` shows the weapon dock, money, health, populated relic row, F1 counter, chest
  prompt, and objective; `belt-backpack-open.png` shows the reachable backpack panel.
- `belt-aim-*.png` covers four cursor positions across both facings.
- `belt-smoke.json` records exact cursor-axis checks and a 17-sample walk with zero projection error
  and zero unexplained root motion.
- `belt-action-{attack,parry,dodge,jump}.png` and the action receipts in `belt-smoke.json` cover the
  four requested verbs.
- `belt-chest-opened.png` shows a real authority-owned corporate-floor chest after its open receipt;
  the smoke also requires the chest and prompt to share the belt projection plane.
- `belt-corporate-floor-boots.json` proves all three direct corporate floor URLs reached live rooms.

## Permanent paired probes

- `belt-flip-probe.json`, `topdown-flip-baseline.json`, and `belt-flip-{left,right}.png` are the
  paired B53-style facing/aim/root gate.
- `belt-part-snap-trace-chart.json` is the B52 3-character × 3-pose belt sweep.
- `diag-rb-telemetry/run-summary.json` records 85 scenarios: 42 top-down plus 43 belt, with zero
  correction requests, nonzero corrections, or snaps. The telemetry port was 62478.

## Reproduction commands

```powershell
pnpm e2e --grep "B56"
pnpm e2e --grep "B52 (sweep|belt sweep)"
pnpm --filter @dd/shared build
pnpm --filter @dd/server exec tsx ../../tools/diag-rb-telemetry.mts
```
