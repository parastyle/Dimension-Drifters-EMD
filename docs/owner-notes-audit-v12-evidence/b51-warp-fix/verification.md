# B51 verification ledger

## Required repository checks

| Check | Result | Evidence |
| --- | --- | --- |
| `pnpm gen` | PASS | Generators completed; the unavailable local VFX reference-art output was restored to the tracked baseline rather than committing an unrelated empty manifest. |
| `pnpm gen:check` | PASS | All available generated artifacts reported in sync. The VFX subject check reported its existing skip because 339 untracked reference artifacts are unavailable locally. |
| `pnpm typecheck` | PASS | Shared, client, and server TypeScript checks completed with no errors. |
| `pnpm test` | PASS | 215 test files passed; 2,762 tests passed. |
| B51 focused regressions | PASS | 21 effective B51 cases pass: 10 client cases plus 11 server cases (the capped-impulse matrix expands one parameterized test to four sources). |
| `git diff --check` | PASS | No whitespace errors. |

## Live telemetry acceptance

Command:

```powershell
pnpm --filter @dd/shared build
pnpm --filter @dd/server exec tsx ../../tools/diag-rb-telemetry.mts
```

The final run used a real single Colyseus client on OS-assigned loopback port 61081. Protected
ports 5180 and 2567 were untouched.

| Measure | Before | After |
| --- | ---: | ---: |
| Scenarios completed | 41 | 41 |
| Correction requests | 449 | 0 |
| Nonzero corrections | 114 | 0 |
| Silent corrections | 68 | 0 |
| Smooth corrections | 40 | 0 |
| Snap corrections | 6 | 0 |
| Total correction magnitude | 6102.003706 px | 0 px |

Harness acceptance gate: **PASS** — all 41 scenarios ran, nonzero corrections were zero, and
snap corrections were zero.
