# B22 / L1 reconciliation verification

All commands ran from `C:/Users/Exped/ddv2-wt/b22-l1-reconcile` on
`sol/b22-l1-reconcile`.

| Check | Result |
| --- | --- |
| `pnpm gen:check` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm test` | PASS — 167 files, 2,192 tests |
| B22 live gate, consecutive run 1 | PASS — private ports asserted by the gate; game port 60586 |
| B22 live gate, consecutive run 2 | PASS — client 52580, game 52579 |
| `black-screen.smoke.spec.ts` | PASS — private game port 62858 |
| `b23-kungfu-v2-live-gate.spec.ts` | PASS on retry 2 — client 53209, game 53208 |

The B23 cross-gate command exited 0 with a flaky classification. Earlier attempts missed unrelated
page-side audit observations at changing points; the successful retry satisfied the full untouched
B23 gate. No B23 source or retained evidence is part of this change.

The retained B22 `live-gate.json` records:

- all eight aggregate assertions as true;
- six player-height, upright, non-spinning, forward-travel facing captures;
- a single generated-image tornado VFX per capture;
- three authoritative hybrid-projectile damage receipts against `dummy0`;
- receipt/sample tick deltas of 1, 1, and 1;
- lateral path distances of 17.57 px, 27.18 px, and 15.12 px against the unchanged 72 px maximum;
- 48 x 76 visual and damage geometry and 520 px/s, 260 px authored motion;
- private ports 52580/52579, neither of which is 5180 or 2567.
