# B20 L5 private live-gate evidence

The retained gate ran an isolated Vite client on OS-assigned ephemeral port `61312` and an
isolated Colyseus listener on OS-assigned ephemeral port `61314`. Protected ports `5180` and
`2567` were neither selected nor touched, and a post-gate listener check confirmed that both
private listeners had shut down. The client shell returned HTTP 200 and the real transport joined
schema-37 room `L6GNdE8c0`.

The gate-only room subclass uses the shipped `GameRoom` open authority without adding a production
debug message. It installed the full 343-weapon active unlock pool, held luck at zero, opened
2,000 weapon caches per sample point, and intercepted only each owner's ordinary `chestOpened`
receipt. The same live room then advanced its authoritative clock from tick 0 (minute 0) to tick
18,000 (minute 15):

| Point | T1 | T2 | T3 | T4 | T5 | T1+T2 | T4+T5 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Minute 0, Commons | 1,267 | 582 | 151 | 0 | 0 | 92.45% | 0.00% |
| Minute 15, Commons | 287 | 356 | 504 | 495 | 358 | 32.15% | 42.65% |
| Minute 15, Scar | 98 | 146 | 414 | 777 | 565 | 12.20% | 67.10% |

Minute 0 therefore remained concentrated in T1-T2, minute 15 opened T4-T5 while preserving a
strictly positive low-tier tail, and the multiplicative Scar bias raised the same late T4-T5 share
from 42.65% to 67.10%. All 6,000 receipts agreed with the selected weapon definition's authored
`tier`; the observed mismatch count is zero at every point.

`live-observations.json` retains the ports, client probe, room/session/schema identifiers, active
tier census, exact curve inputs, sample counts, shares, elapsed run seconds, and gate verdict.
`live-gate.mts` is the reproducible private transport/fast-forward harness.
