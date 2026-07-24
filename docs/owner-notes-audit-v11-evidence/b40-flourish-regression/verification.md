# B40 flourish regression verification

All runs used the test-only `startSpecStack`, which asks the OS for both client and game ports.
Protected defaults `5180` and `2567` were not bound or used.

## Live gates

| Pass | Gate | Result | Private ports | Key evidence |
| --- | --- | --- | --- | --- |
| 1 | B29 ranged presentation | 1/1 PASS | client `58365`, game `58363` | 22 captures; Kunai end-hook active in both facings with rotations `2.724` / `2.841` rad |
| 1 | pistol-twirl + Coilshot | 3/3 PASS | OS-assigned client, game `55412` | one-hand `6.870` rad; dual `6.661` / `6.653` rad; Coilshot `1.356` turns |
| 2 | B29 ranged presentation | 1/1 PASS | client `59899`, game `59898` | 22 captures; Kunai end-hook active in both facings with rotation `1.424` rad |
| 2 | pistol-twirl + Coilshot | 3/3 PASS | OS-assigned client, game `50165` | one-hand `6.803` rad; dual `6.658` / `6.743` rad; Coilshot `1.356` turns |

Commands for each pass:

```text
$env:DD_E2E_EVIDENCE_DIR='<this folder>/run-N'
pnpm exec playwright test e2e/tests/b29-ranged-presentation-live-gate.spec.ts --reporter=line
pnpm exec playwright test e2e/tests/pistol-twirl.spec.ts e2e/tests/coilshot-twirl.spec.ts --reporter=line
```

Each `run-N/b29-ranged-presentation/live-gate.json` contains the exact port record, world
transforms, accepted attack sequence, finite Kunai flourish epoch, active flourish rotation, and
screenshots for both facings. Each `run-N/pistol-twirl/*.json` contains measured rotations/onsets.
Each `run-N/coilshot-twirl/coilshot-twirl-after.json` contains the complete frame series, accepted
beat, pre-release revolution, and projectile release.

## Repository checks

```text
pnpm typecheck
PASS

pnpm test
PASS — 189 files, 2,347 tests
```

The first full-suite attempt identified missing ignored Artkit prerequisites in the isolated
worktree (`tools/artkit/node_modules/pngjs`, the reviewed orientation report, and the Dust
Ranger/Dummy preview fixtures). After bootstrapping those declared/canonical ignored inputs, the
unchanged full suite passed. No Artkit bootstrap file is tracked in this change.
