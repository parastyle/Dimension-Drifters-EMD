# Solo rubberband telemetry evidence

Captured 2026-07-25T04:31:49.080Z through one real Colyseus client on OS-assigned loopback port 52761.
Ports 5180 and 2567 were not used.

- `run-summary.json` is the ranked scenario table and aggregate count.
- `run-telemetry.json` contains every fixed-tick authority row and every correction request.
- `top-offender-traces.json` retains correction ticks plus adjacent context for the top three.
- `run.log` is the compact scenario-by-scenario console ledger.
- The corporate elevator fixture suppresses belt combat waves to isolate placement motion.

Reproduce from the repository root:

```powershell
pnpm --filter @dd/shared build
pnpm --filter @dd/server exec tsx ../../tools/diag-rb-telemetry.mts
```
