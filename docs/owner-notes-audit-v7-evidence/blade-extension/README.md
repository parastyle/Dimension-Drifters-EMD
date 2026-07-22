# V7.1 blade-extension live evidence

This directory contains real-swing before/after captures for Sanctified Headsman's Pale Procession and all
six brutalist greatswords. Every weapon subdirectory includes both-facing screenshots and full sampled-frame
JSON. The after capture also includes a real second Colyseus client so the remote
`flushObservedSignature -> spawnSlash -> blade attachment` path is measured, not inferred.

## Fixed after thresholds

- Blade-tip join axial error: `<= 0.25 px`
- Blade-tip join lateral error: `<= 0.25 px`
- Derived-width error: `<= 0.25 px`
- Extension/blade angle error: `<= 0.002 rad`
- Emerged-length/reveal error: `<= 0.002`
- Whole-swing traversal: `> 0.35 rad` for local/remote and both facings

No threshold was changed to obtain a pass.

## Before

The historical capture ran detached commit `faadfb159155699c7f025b375fb42f5f8bcec49d` on private ephemeral
listeners. Across all seven weapons, the old independent remote pose produced:

- maximum axial error per weapon: `239.59-313.00 px`
- maximum lateral error per weapon: `167.87-204.57 px`
- `23` directly sampled re-ignitions across `48` per-swing extension surfaces
- at least `2.900 rad` of blade-angle traversal per facing

Files: `before-remote-right-up-rise.png`, `before-remote-right-up-combo.png`,
`before-remote-left-up-swing.png`, and `before-summary.json` in each weapon directory.

## After

The permanent gate sampled `1,651` frames, including `747` remote-wielder frames. Aggregate maxima were:

- axial error: `4.54745621887899e-13 px`
- lateral error: `4.54702040108402e-13 px`
- measured-width error: `7.105427357601e-15 px`
- angle error: `1.11022302462516e-15 rad`
- emerged-length/reveal error: `3.33066907387547e-16`
- minimum local/remote, both-facing angle traversal: `3.09160596275514 rad`

Every local combo sampled exactly one ignition and held full reveal across later hits. Remote observation
sampled zero or one initial transition depending on whether the accepted swing arrived before or after the
100 ms rise, then recorded zero drops/re-ignitions after reaching full length.

Files: local and `after-remote-*` screenshots plus `after-summary.json` in each weapon directory.

Permanent reproduction command:

```text
pnpm exec playwright test --config=e2e/playwright.config.ts e2e/tests/v7-blade-extension-live-gate.spec.ts --workers=1
```
