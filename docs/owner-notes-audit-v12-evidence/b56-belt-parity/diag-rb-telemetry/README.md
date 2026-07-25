# Solo rubberband telemetry evidence

Captured 2026-07-25T16:46:43.068Z through one real Colyseus client on OS-assigned loopback port 62478.
Ports 5180 and 2567 were not used.

- `run-summary.json` is the ranked scenario table and aggregate count.
- `run-telemetry.json` contains every fixed-tick authority row and every correction request.
- `top-offender-traces.json` retains correction ticks plus adjacent context for the top three.
- `run.log` is the compact scenario-by-scenario console ledger.
- The standing movement/combat matrix runs once top-down and once on corporate-grid belt.
- The corporate elevator fixture is belt scenario 43 and suppresses combat waves to isolate placement motion.
- Acceptance: **PASS** (85/85 scenarios, 0 nonzero corrections, 0 snaps).

Reproduce from the repository root:

```powershell
pnpm --filter @dd/shared build
pnpm --filter @dd/server exec tsx ../../tools/diag-rb-telemetry.mts
```
