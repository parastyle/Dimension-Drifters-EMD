# B12 Mirage blade-extension live evidence

Private live gate:

```text
pnpm exec playwright test --config=e2e/playwright.config.ts \
  e2e/tests/v7-blade-extension-live-gate.spec.ts
7 passed (2.4m)
```

- Character: `proto-cowboy-hidden-face`, for both the local player and real remote Colyseus player.
- Private listeners: client `59953`, game server `59952`; protected ports `5180` and `2567` were
  explicitly rejected by the gate.
- Census: the six frozen brutalist greatswords plus `x2-mirage-hardlight-saber`.
- Total sampled blade-owned frames: 1,973, including local/remote and right/left facings for every
  weapon.
- Every weapon sampled combo steps `0,1,2`, exactly one local ignition, zero remote relight drops,
  full hold across later hits, and post-combo retraction.
- Worst join/affine errors over all seven weapons: axial `4.55e-13 px`, lateral `4.55e-13 px`,
  angle `1.11e-15 rad`, measured width `7.11e-15 px`, and shared reveal/reach `3.33e-16`.
- Mirage full visible tip versus authoritative damage radius: `3.41e-13 px` worst error across all
  local/remote and right/left full-extension frames. This includes its existing combo-step-2
  `1.08` reach multiplier (`310.068 px` visible and authoritative versus `287.1 px` on steps 0/1).
- Mirage ignition is a single shared 100 ms rise; the idle/retracted PNGs show only the shipped short
  blade, the rise PNG shows the partial hardlight blade, and combo PNGs show the full cyan-white
  extension. Retraction uses the shared 90 ms presentation window.
- `x2-sanctified-headsman` is absent from the shared census and treatment resolver; server/unit gates
  keep it on its ordinary blade envelope.

Each weapon directory contains:

- `after-idle-retracted.png`
- `after-right-up-rise.png`
- `after-right-up-combo.png`
- `after-combo-retracted.png`
- `after-left-up-swing.png`
- `after-remote-right-up-rise.png`
- `after-remote-right-up-combo.png`
- `after-remote-left-up-swing.png`
- `after-summary.json` with thresholds, per-frame affines, ignition/retraction state, ports, and
  reach diagnostics.

| Weapon | Frames | Axial px | Lateral px | Width px | Reveal/reach |
|---|---:|---:|---:|---:|---:|
| `x2-rimewrit-grave-slab` | 272 | 4.28e-13 | 4.52e-13 | 0 | 2.22e-16 |
| `x2-pyre-gallows-brand` | 295 | 4.46e-13 | 4.47e-13 | 7.11e-15 | 2.22e-16 |
| `x2-stormrail-colossus` | 276 | 4.55e-13 | 4.48e-13 | 0 | 3.33e-16 |
| `x2-nullwake-ordinance` | 275 | 4.46e-13 | 4.55e-13 | 7.11e-15 | 2.22e-16 |
| `x2-dawnwall-testament` | 290 | 4.33e-13 | 4.53e-13 | 7.11e-15 | 3.33e-16 |
| `x2-cairnfall-monolith` | 280 | 4.53e-13 | 4.34e-13 | 7.11e-15 | 2.22e-16 |
| `x2-mirage-hardlight-saber` | 285 | 2.06e-13 | 4.14e-13 | 0 | 2.22e-16 |
