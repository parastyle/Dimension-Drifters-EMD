# B41 ice-slide live gate

Captured 2026-07-24 against a production Colyseus server and source Vite client on private ephemeral
ports `53471` and `53472`. Protected owner ports `2567` and `5180` were not used.

The in-app browser backend was unavailable, so this gate used the real `colyseus.js` wire client plus
the production `SelfPredictor` directly. It created separate arena and Sky Carrier belt rooms, entered
Testing Grounds through the normal server messages, equipped the real weapons, sent sequence-numbered
movement commands and attack requests, reconciled every acknowledged patch, and recorded authority,
prediction, attack mode, velocity, and error.

| Mode | Attack path | Release tick | Zero/stable tick | Stop ticks | Recovery delta | Post-stop travel |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Arena | Sparkknuckle input slow | 14 | 16 | 2 | 0 px | 0 px |
| Arena | Stormfists root motion | 44 | 45 | 1 | 0 px | 0 px |
| Belt | Sparkknuckle input slow | 14 | 16 | 2 | 0 px | 0 px |
| Belt | Stormfists root motion | 44 | 45 | 1 | 0 px | 0 px |

All four captures satisfy the `<= 3` fixed-tick stop contract. Root-motion patches had zero error at
the authored movement edge; the final four recovery samples in every scenario had zero authority /
prediction delta, zero steering velocity, and no position travel.

Artifacts:

- `live-summary.json` — compact verdict and private-port receipt.
- `live-telemetry.json` — every acknowledged movement/attack/release frame.
- `unit-repro.json` — deterministic before/after stop-tail accounting.
