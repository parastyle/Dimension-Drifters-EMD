# B38 hammer layering live-gate attempt

Verdict: BLOCKED — no visual pass is claimed.

- Attempted: 2026-07-24
- Private client port: `64016`
- Private game port: `64017`
- Protected defaults avoided: `5180`, `2567`
- Character requested: `proto-cowboy-hidden-face`
- Requested live fixtures: three 1H revolvers and Twin-Maw, both facings
- Browser result: the in-app browser runtime returned `No browser is available`; browser discovery
  returned an empty list.
- Cleanup: both private listeners were stopped and verified closed.

The implementation's retained-display-list tests prove that either active hammer hand sorts after
both gun sprites and that the rear Twin-Maw hand returns to its ordinary layer when the beat ends.
Those automated results are not a substitute for the requested live screenshots, so this directory
intentionally contains no fabricated visual evidence.
